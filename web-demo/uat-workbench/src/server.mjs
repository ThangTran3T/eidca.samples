import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HOST, PORT, PUBLIC_DIR, DEFAULT_PACKAGE_BASE, ENV_KINDS, AGENT_ORIGINS, PLATFORM_ORIGIN, defaultDataDir } from './config.mjs';
import { findPackageDir, loadPackage, DOC_FILES } from './package-loader.mjs';
import { createStore } from './store.mjs';
import { createVault, VaultError, VAULT_KEYS, listCandidateFiles } from './vault.mjs';
import { createEnvState, EDITABLE_VARS } from './env-state.mjs';
import { createWorkbenchService, Refusal } from './workbench.mjs';
import { createOperatorService, OPERATOR_REQUESTS } from './operator.mjs';
import { saveCompletedResult, runIndependentVerify, runVerifyMaterial } from './results.mjs';
import { UAT_GROUPS, RESULT_STATUSES, createUatStore, renderReport } from './uat-plan.mjs';
import { nativeRequest } from './native-http.mjs';

// Readiness per Method from READINESS-MATRIX.md (runtime snapshot of the package).
const METHODS = [
  { code: 'CCCD_NFC', label: 'Local NFC / HN212 SDK', provider: 'prv_eidca_hash', serverAllowed: false,
    local: 'BLOCKED_AUTHORITY', localNote: 'key/registration/caller hết hạn; profile/policy publication PASS; native plan dry-read PASS; chưa có activation/cohort/verifier',
    server: 'UNSUPPORTED', serverNote: 'phần cứng client; không relay Local', device: 'HN212 NFC/AA/camera và consent thật',
    guide: 'Chỉ khi action và phiên đã được phép: đặt CCCD vào HN212, thực hiện consent trên Local SDK. Không nhập dữ liệu chip, AA, selfie vào website.' },
  { code: 'VNEID', label: 'VNeID approval', provider: 'prv_ca2_vneid', serverAllowed: true,
    local: 'BLOCKED_CONFIG', localNote: 'installation FIXED_V1 CCCD_NFC, chưa có route/profile VNEID',
    server: 'BLOCKED_CONFIG', serverNote: 'chưa install cho tenant cố định', device: 'Phê duyệt thật trên app VNeID',
    guide: 'Xác nhận giao dịch trên ứng dụng VNeID theo action. Không mở thêm START khi app chậm.' },
  { code: 'APP_CA_REMOTE_SIGNING', label: 'eSIGN / chọn CA nếu được offer', provider: 'prv_esign_ca2', serverAllowed: true,
    local: 'BLOCKED_CONFIG', localNote: 'chưa có native route/profile eSIGN trong installation',
    server: 'BLOCKED_CONFIG', serverNote: 'chưa install; closed TEST cohort không được tái dùng', device: 'Chọn CA khi được offer, app/hosted approval',
    guide: 'Chỉ eSIGN có thể yêu cầu chọn CA. Hoàn tất approval trên app/hosted UI theo contract.' },
  { code: 'USB_TOKEN', label: 'Local USB / PIN trên UI tin cậy', provider: 'prv_7a161b93-174e-48e5-92d7-ff6c6fe3bab7', serverAllowed: false,
    local: 'BLOCKED_CONFIG', localNote: 'USB connector đang disabled, profile cố định CCCD_NFC',
    server: 'UNSUPPORTED', serverNote: 'phần cứng client; không relay Local', device: 'USB token, PIN trên UI/SDK tin cậy',
    guide: 'Cắm token đúng certificate, nhập PIN trong UI/SDK tin cậy. Không nhập PIN vào website.' },
  { code: 'AUTO', label: 'Chưa chọn Method', provider: 'Platform resolve', serverAllowed: true,
    local: '—', localNote: '', server: '—', serverNote: '', device: 'Theo Method được chọn',
    guide: 'START không gửi method_code; khi Agent trả SELECT_METHOD, chọn theo chỉ số option của response hiện tại.' },
];

const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/markdown.js': 'markdown.js' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'BODY_TOO_LARGE'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON_REQUIRED');
  const buf = await readBody(req, 2 * 1024 * 1024);
  try {
    return JSON.parse(buf.toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

export function createApp({ pkg, store, vault = createVault(), send = nativeRequest }) {
  const envState = createEnvState(pkg, store);
  const log = [];
  const onEvent = e => {
    log.unshift({ at: new Date().toISOString(), ...e });
    if (log.length > 500) log.length = 500;
  };
  const workbench = createWorkbenchService({ pkg, store, vault, envState, send, onEvent });
  const operator = createOperatorService({ vault, envState, send });
  const uat = createUatStore(store);
  const lastOperator = {};
  const lastSaved = {};
  const lastRefusal = {}; // per env: newest refusal made before any HTTP (NOT SENT)

  const envOf = v => {
    if (!ENV_KINDS.includes(v)) throw new HttpError(400, 'UNKNOWN_ENVIRONMENT');
    return v;
  };

  function meta() {
    const samples = Object.fromEntries(Object.entries(pkg.samples).map(([k, s]) => {
      const bytes = s.input.mode === 'FILE' ? Buffer.from(s.input.content_base64, 'base64') : null;
      return [k, { mode: s.input.mode, format: s.input.format, fileName: s.input.file_name || null, profile: s.signature_profile, output: s.output, bytes: bytes?.length ?? null, sha256: bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : null, path: path.join(pkg.dir, pkg.sampleFiles[k]) }];
    }));
    return {
      methods: METHODS,
      samples,
      vaultKeys: VAULT_KEYS,
      editableVars: EDITABLE_VARS,
      origins: { ...AGENT_ORIGINS, PLATFORM: PLATFORM_ORIGIN },
      operatorRequests: Object.fromEntries(Object.entries(OPERATOR_REQUESTS).map(([k, d]) => [k, { name: d.name, mode: d.mode, method: d.method }])),
      package: { dir: pkg.dir, name: path.basename(pkg.dir), integrity: pkg.integrity },
      evidence: pkg.evidence,
      docs: DOC_FILES,
      dataDir: store.dataDir,
      protection: store.protection,
      useSystemCa: process.execArgv.includes('--use-system-ca') || /--use-system-ca/.test(process.env.NODE_OPTIONS || ''),
      uat: { groups: UAT_GROUPS, statuses: RESULT_STATUSES },
    };
  }

  function state(kind) {
    const vars = envState.vars(kind);
    const pre = envState.preflight(kind);
    return {
      env: kind,
      vars,
      preflight: pre ? { status: pre.status, overall: pre.overall, at: pre.at, json: pre.json } : { status: 'NOT_CHECKED' },
      vault: vault.status(),
      sessions: workbench.sessionsList(kind),
      selected: workbench.selectedView(kind),
      lastOperator: lastOperator[kind] || null,
      lastSaved: lastSaved[kind] || null,
    };
  }

  function evidenceFromSession(kind) {
    const sel = workbench.selectedView(kind);
    if (!sel) throw new Refusal('NO_SELECTED_SESSION_USE_NEW_OR_SELECT');
    // lastResponse is this server run's display copy; events persist in the registry across restarts.
    const last = sel.lastResponse, s = sel.summary, ev = s.events.at(-1);
    const refusal = lastRefusal[kind];
    // A NOT SENT refusal newer than the last HTTP response is the evidence the tester just produced.
    if (refusal && refusal.sessionRef === s.sessionRef && (!last || refusal.at > last.at)) {
      return { source: 'session', env: kind, sessionRef: s.sessionRef.slice(0, 12), caseId: s.caseId, runId: s.runId, state: s.state, signingId: s.signingId, op: refusal.op, http: null, sent: false, refused: 'NOT SENT ' + refusal.code, requestId: null, tests: [] };
    }
    return {
      source: 'session', env: kind, sessionRef: s.sessionRef.slice(0, 12), caseId: s.caseId, runId: s.runId, state: s.state, signingId: s.signingId,
      op: last?.op || ev?.command || null, http: last?.http ?? ev?.http ?? null, status: last?.reply?.status || ev?.status || null,
      errorCode: last?.reply?.error?.code || ev?.errorCode || null, requestId: last?.reply?.request_id || ev?.responseRequestId || null,
      tests: last?.tests?.map(t => (t.pass ? 'PASS ' : 'FAIL ') + t.name) || [], transport: last?.transportError?.code || null,
    };
  }

  const routes = {
    'GET /api/meta': () => meta(),
    'GET /api/state': (req, url) => state(envOf(url.searchParams.get('env'))),
    'GET /api/log': () => log,
    'GET /api/vault/candidates': () => listCandidateFiles(),
    'GET /api/doc': (req, url) => {
      const text = pkg.readDoc(url.searchParams.get('name'));
      if (text == null) throw new HttpError(404, 'DOC_NOT_FOUND');
      return { name: url.searchParams.get('name'), text };
    },
    'GET /api/uat': () => uat.get(),
    'POST /api/env': async req => {
      const b = await readJsonBody(req), kind = envOf(b.env);
      try {
        if (b.reset) envState.reset(kind);
        else envState.update(kind, b.changes);
      } catch (e) {
        throw new Refusal(e.message);
      }
      return state(kind);
    },
    'POST /api/vault': async req => {
      const b = await readJsonBody(req);
      if (b.action === 'clear') vault.clear(b.key);
      else if (b.action === 'file') vault.loadFile(b.key, b.path);
      else if (b.action === 'identity') {
        const id = {};
        if (b.subjectRef) id.subject_ref = String(b.subjectRef).trim();
        if (b.nationalId) id.national_id = String(b.nationalId).trim();
        vault.set('vneca-signing-identity', JSON.stringify(id), 'form');
      } else if (b.action === 'set') vault.set(b.key, b.value, 'manual');
      else throw new HttpError(400, 'UNKNOWN_VAULT_ACTION');
      return { ok: true, vault: vault.status() };
    },
    'POST /api/input/upload': async (req, url) => {
      if (!/^application\/octet-stream/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'OCTET_STREAM_REQUIRED');
      const format = url.searchParams.get('format'), mode = url.searchParams.get('mode') || 'FILE';
      const name = path.basename(String(url.searchParams.get('name') || 'input')).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 200) || 'input';
      if (!['PDF', 'XML', 'BINARY'].includes(format) || !['FILE', 'HASH'].includes(mode)) throw new Refusal('USE_PDF_XML_BINARY_FILE_OR_HASH');
      if (mode === 'HASH' && format === 'XML') throw new Refusal('XML_SIGNED_INFO_REQUIRES_SDK_CONTEXT');
      const bytes = await readBody(req, 64 * 1024 * 1024);
      if (!bytes.length) throw new Refusal('EMPTY_FILE');
      if (format === 'PDF' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Refusal('NOT_A_PDF_FILE');
      const digest = crypto.createHash('sha256').update(bytes).digest('base64');
      const input = mode === 'FILE'
        ? { mode: 'FILE', format, file_name: name, content_base64: bytes.toString('base64') }
        : { mode: 'HASH', format: 'CMS', digest_role: 'DOCUMENT_DIGEST', digest: { algorithm: 'SHA-256', value: digest }, document_digest: { algorithm: 'SHA-256', value: digest } };
      vault.set('vneca-private-input', JSON.stringify(input), 'upload:' + name);
      return { ok: true, vault: vault.status(), inlineLimitBytes: pkg.wire.DEFAULT_INLINE_LIMITS?.input ?? null };
    },
    'POST /api/wb': async req => {
      const b = await readJsonBody(req), kind = envOf(b.env);
      const out = await workbench.run(kind, String(b.op || ''), b.params || {});
      if (out.refused) lastRefusal[kind] = { op: out.op, code: out.refused, at: new Date().toISOString(), sessionRef: out.view?.summary?.sessionRef || null };
      return { ...out, state: state(kind) };
    },
    'POST /api/wb/approval-url': async req => {
      const b = await readJsonBody(req);
      return { url: workbench.approvalUrl(envOf(b.env)) };
    },
    'POST /api/operator': async req => {
      const b = await readJsonBody(req), kind = envOf(b.env);
      const out = await operator.run(kind, String(b.id || ''), b.params || {});
      lastOperator[kind] = { id: out.id, name: out.name, at: new Date().toISOString(), http: out.http ?? null, ok: out.ok, refused: out.refused || null, transport: out.transportError?.code || null, tests: out.tests || [], preflightStatus: out.preflightStatus || null };
      onEvent({ env: kind, op: 'OPERATOR ' + (out.name || b.id), sent: !!out.sent, http: out.http ?? null, refused: out.refused || null, transport: out.transportError?.code || null });
      return { ...out, state: state(kind) };
    },
    'POST /api/result/save': async req => {
      const b = await readJsonBody(req), kind = envOf(b.env);
      const saved = saveCompletedResult(workbench.completed(kind), store);
      lastSaved[kind] = saved;
      onEvent({ env: kind, op: 'SAVE_RESULT', sent: false, refused: null, state: saved.status });
      return saved;
    },
    'POST /api/result/verify': async req => {
      const b = await readJsonBody(req);
      const r = await runIndependentVerify(pkg.dir, b);
      onEvent({ env: b.env || null, op: 'VERIFY ' + b.format, sent: false, state: r.status });
      return r;
    },
    'POST /api/result/verify-material': async req => {
      const b = await readJsonBody(req);
      const r = await runVerifyMaterial(pkg.dir, b);
      onEvent({ env: b.env || null, op: 'VERIFY_MATERIAL', sent: false, state: r.status });
      return r;
    },
    'POST /api/uat': async req => {
      const b = await readJsonBody(req);
      try {
        return uat.update(b);
      } catch (e) {
        throw new Refusal(e.message);
      }
    },
    'POST /api/uat/attach': async req => {
      const b = await readJsonBody(req), kind = envOf(b.env);
      let ev;
      if (b.source === 'operator') {
        if (!lastOperator[kind]) throw new Refusal('NO_OPERATOR_RESPONSE_YET');
        ev = { source: 'operator', env: kind, op: lastOperator[kind].name, http: lastOperator[kind].http, status: lastOperator[kind].preflightStatus || (lastOperator[kind].ok ? 'HTTP_OK' : 'NOT_OK'), refused: lastOperator[kind].refused, transport: lastOperator[kind].transport };
      } else if (b.source === 'saved') {
        if (!lastSaved[kind]) throw new Refusal('NO_SAVED_RESULT_YET');
        ev = { source: 'saved', env: kind, op: 'SAVE_RESULT', status: lastSaved[kind].status, files: lastSaved[kind].files.map(f => `${f.role} ${f.sha256}`) };
      } else ev = evidenceFromSession(kind);
      try {
        return uat.attach(b.caseId, ev);
      } catch (e) {
        throw new Refusal(e.message);
      }
    },
  };

  function serveStatic(res, pathname) {
    const file = STATIC[pathname];
    if (!file) return false;
    const body = fs.readFileSync(path.join(PUBLIC_DIR, file));
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[path.extname(file)] });
    res.end(body);
    return true;
  }

  return async function handler(req, res, port) {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    // DNS-rebinding guard: only loopback Host headers for this exact port.
    if (!allowedHosts.includes(req.headers.host)) {
      res.writeHead(421, SECURITY_HEADERS);
      return res.end('Misdirected request');
    }
    const url = new URL(req.url, 'http://' + req.headers.host);
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && serveStatic(res, url.pathname)) return;
        throw new HttpError(404, 'NOT_FOUND');
      }
      // CSRF guard: custom header forces a CORS preflight that this server never answers,
      // and a browser Origin, when present, must be this page.
      if (req.headers['x-uat-workbench'] !== '1') throw new HttpError(403, 'WORKBENCH_HEADER_REQUIRED');
      if (req.headers.origin && !allowedHosts.map(h => 'http://' + h).includes(req.headers.origin)) throw new HttpError(403, 'FOREIGN_ORIGIN');
      if (req.method === 'GET' && url.pathname === '/api/uat/report') {
        const report = renderReport(uat.get(), { packageName: path.basename(pkg.dir), sourceRevision: pkg.integrity.sourceRevision, runtimeAt: pkg.evidence.runtime?.at });
        res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="uat-report.md"' });
        return res.end(report);
      }
      const route = routes[req.method + ' ' + url.pathname];
      if (!route) throw new HttpError(404, 'NOT_FOUND');
      const out = await route(req, url);
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(out));
    } catch (e) {
      let status = 500, body;
      if (e instanceof HttpError) {
        status = e.status;
        body = { ok: false, error: e.message };
      } else if (e instanceof Refusal || e instanceof VaultError) {
        status = 200;
        body = { ok: false, refused: e.code || e.message, detail: e.detail ?? null };
      } else {
        console.error(e);
        body = { ok: false, error: 'INTERNAL_ERROR' };
      }
      if (!res.headersSent) res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    }
  };
}

export function startServer({ pkg, store, vault, send, host = HOST, port = PORT }) {
  const handler = createApp({ pkg, store, vault, send });
  const server = http.createServer((req, res) => handler(req, res, server.address().port));
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.env.UAT_PACKAGE_DIR ? path.resolve(process.env.UAT_PACKAGE_DIR) : findPackageDir(DEFAULT_PACKAGE_BASE);
  let pkg;
  try {
    pkg = loadPackage(dir, { allowModified: process.env.UAT_ALLOW_MODIFIED_PACKAGE === '1' });
  } catch (e) {
    console.error('Không nạp được gói workbench: ' + e.message);
    process.exit(1);
  }
  const store = createStore(defaultDataDir());
  const server = await startServer({ pkg, store });
  const { port } = server.address();
  const i = pkg.integrity;
  console.log(`VNeCA UAT Workbench: http://${HOST}:${port}/`);
  console.log(`Gói: ${pkg.dir}`);
  console.log(`Manifest: ${i.passed}/${i.checked} file khớp SHA256, PDFBox ${i.verifierJar}`);
  console.log(`Dữ liệu phiên: ${store.dataDir} (${store.protection})`);
  if (!(process.execArgv.includes('--use-system-ca') || /--use-system-ca/.test(process.env.NODE_OPTIONS || ''))) {
    console.warn('CẢNH BÁO: chưa bật --use-system-ca. TLS tới https://localhost:17889 sẽ không dùng trust Windows đã phê duyệt. Dùng: npm start');
  }
}
