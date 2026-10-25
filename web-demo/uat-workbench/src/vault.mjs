import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { protectedSourceRoots } from './config.mjs';

// Same key names as the Postman Local Vault in QUICK-START-VI.md §1.
export const VAULT_KEYS = Object.freeze({
  'vneca-local-eidca-caller': { kind: 'caller', label: 'Caller Local (agc_…)', env: 'LOCAL' },
  'vneca-server-caller': { kind: 'caller', label: 'Caller Server (agc_…)', env: 'SERVER' },
  'vneca-signing-identity': { kind: 'identity', label: 'Danh tính signer đã xác minh' },
  'vneca-operator-jwt': { kind: 'jwt', label: 'JWT operator (chỉ Operator)' },
  'vneca-operator-username': { kind: 'text', label: 'Username operator (00 LOGIN)' },
  'vneca-operator-password': { kind: 'secret', label: 'Password operator (00 LOGIN)' },
  'vneca-private-input': { kind: 'input', label: 'Tài liệu riêng (input JSON)' },
});

const MAX_SECRET_BYTES = 64 * 1024;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const IDENTITY_FIELDS = ['subject_ref', 'national_id'];

export class VaultError extends Error {}

function decodeJwtClaims(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function validate(key, value) {
  const { kind } = VAULT_KEYS[key];
  if (typeof value !== 'string' || !value.length) throw new VaultError('EMPTY_VALUE');
  if (kind === 'caller') {
    if (!/^agc_[0-9a-f]{64}$/.test(value)) {
      throw new VaultError(value.split('.').length === 3 ? 'JWT_IS_NOT_AGENT_CALLER_ACCESS' : 'CALLER_FORMAT_AGC_64_HEX_REQUIRED');
    }
  } else if (kind === 'jwt') {
    if (!decodeJwtClaims(value)) throw new VaultError('JWT_FORMAT_REQUIRED');
    if (value.startsWith('agc_')) throw new VaultError('AGENT_CALLER_IS_NOT_OPERATOR_JWT');
  } else if (kind === 'identity') {
    let id;
    try { id = JSON.parse(value); } catch { throw new VaultError('IDENTITY_JSON_REQUIRED'); }
    if (!id || typeof id !== 'object' || Array.isArray(id)) throw new VaultError('IDENTITY_JSON_OBJECT_REQUIRED');
    if (Object.keys(id).some(k => !IDENTITY_FIELDS.includes(k))) throw new VaultError('IDENTITY_UNKNOWN_FIELD');
    if (Object.values(id).some(v => typeof v !== 'string' || !v.length)) throw new VaultError('IDENTITY_STRING_VALUES_REQUIRED');
  } else if (kind === 'input') {
    let input;
    try { input = JSON.parse(value); } catch { throw new VaultError('INPUT_JSON_REQUIRED'); }
    if (!['FILE', 'HASH'].includes(input?.mode)) throw new VaultError('INPUT_MODE_REQUIRED');
  }
  if (Buffer.byteLength(value) > (kind === 'input' ? MAX_INPUT_BYTES * 1.4 : MAX_SECRET_BYTES)) throw new VaultError('VALUE_TOO_LARGE');
}

function describe(key, value) {
  const { kind } = VAULT_KEYS[key];
  if (kind === 'caller') return { format: 'agc_ + 64 hex' };
  if (kind === 'jwt') {
    const c = decodeJwtClaims(value) || {};
    const exp = typeof c.exp === 'number' ? new Date(c.exp * 1000).toISOString() : null;
    return {
      expiresAt: exp,
      expired: exp ? Date.parse(exp) <= Date.now() : null,
      subject: typeof c.sub === 'string' ? c.sub : null,
      username: typeof c.username === 'string' ? c.username : typeof c.preferred_username === 'string' ? c.preferred_username : null,
      roles: Array.isArray(c.roles) ? c.roles.slice(0, 10) : typeof c.role === 'string' ? [c.role] : [],
      // prepare-private.mjs refuses tenant-scoped or impersonation tokens as operator access.
      tenantScoped: 'tenant_id' in c,
      impersonation: 'imp' in c,
    };
  }
  if (kind === 'identity') {
    const id = JSON.parse(value);
    return {
      fields: Object.keys(id),
      subjectRefPresent: 'subject_ref' in id,
      nationalIdShape: 'national_id' in id ? (/^\d{12}$/.test(id.national_id) ? '12_DIGITS' : 'OTHER') : null,
    };
  }
  if (kind === 'input') {
    const input = JSON.parse(value);
    const bytes = input.mode === 'FILE' ? Buffer.from(input.content_base64 || '', 'base64') : null;
    return {
      mode: input.mode,
      format: input.format,
      fileName: input.file_name || null,
      bytes: bytes ? bytes.length : null,
      sha256: bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : null,
      digestRole: input.digest_role || null,
    };
  }
  return { length: value.length };
}

// Credentials live only in this process memory. They are never written to disk by the
// website and never returned to the browser; the UI only sees describe() metadata.
export function createVault() {
  const entries = new Map();
  return {
    set(key, value, source) {
      if (!VAULT_KEYS[key]) throw new VaultError('UNKNOWN_VAULT_KEY');
      const v = String(value ?? '').replace(/^﻿/, '').trim();
      validate(key, v);
      entries.set(key, { value: v, source, setAt: new Date().toISOString() });
    },
    loadFile(key, file, maxBytes) {
      if (!VAULT_KEYS[key]) throw new VaultError('UNKNOWN_VAULT_KEY');
      if (!path.isAbsolute(file)) throw new VaultError('ABSOLUTE_PATH_REQUIRED');
      const stat = fs.statSync(file, { throwIfNoEntry: false });
      if (!stat?.isFile()) throw new VaultError('FILE_NOT_FOUND');
      const limit = maxBytes ?? (VAULT_KEYS[key].kind === 'input' ? MAX_INPUT_BYTES * 1.4 : MAX_SECRET_BYTES);
      if (stat.size > limit) throw new VaultError('FILE_TOO_LARGE');
      let text;
      try { text = fs.readFileSync(file, 'utf8'); } catch { throw new VaultError('FILE_READ_FAILED'); }
      this.set(key, text, 'file:' + path.basename(file));
    },
    get(key) {
      return entries.get(key)?.value ?? null;
    },
    has(key) {
      return entries.has(key);
    },
    clear(key) {
      entries.delete(key);
    },
    status() {
      return Object.fromEntries(Object.entries(VAULT_KEYS).map(([key, meta]) => {
        const e = entries.get(key);
        return [key, { ...meta, present: !!e, source: e?.source ?? null, setAt: e?.setAt ?? null, info: e ? describe(key, e.value) : null }];
      }));
    },
  };
}

// Lists (names only, never contents) the protected handover files written by
// prepare-private.mjs and the earlier caller handover, so the tester can pick one.
export function listCandidateFiles() {
  const wanted = /^(operator-jwt\.txt|caller\.txt|local-eidca-caller\.txt|input\.json|installation-request\.json)$/i;
  const out = [];
  for (const root of protectedSourceRoots()) {
    const walk = (dir, depth) => {
      let items;
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const it of items) {
        const full = path.join(dir, it.name);
        if (it.isDirectory() && depth < 3) walk(full, depth + 1);
        else if (it.isFile() && wanted.test(it.name)) {
          const st = fs.statSync(full);
          out.push({ path: full, name: it.name, bytes: st.size, modifiedAt: st.mtime.toISOString() });
        }
      }
    };
    walk(root, 0);
  }
  return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 50);
}
