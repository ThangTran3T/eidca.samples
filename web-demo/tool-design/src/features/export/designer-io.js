/**
 * Designer JSON (complete, lossless) import/export for documents and
 * single templates. Never embeds PDF bytes or document contents.
 */
import { designerDocumentSchema, templateFileSchema, formatZodIssues } from '../../schemas/designer-schema.js';
import { DESIGNER_FORMAT, TEMPLATE_FORMAT, SCHEMA_VERSION, uid, clone } from '../../engines/template-engine/index.js';

export const MAX_JSON_BYTES = 25 * 1024 * 1024;
const APP = 'VNeCA Signature Designer';

export function exportDesignerDocument({ documentName = '', pages = [], signatures }) {
  return {
    format: DESIGNER_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    application: APP,
    document: { name: documentName, pageCount: pages.length, pages: pages.map((p) => ({ view: p.view, rotate: p.rotate })) },
    signatures: clone(signatures),
  };
}

export function exportTemplateFile(template) {
  const t = clone(template);
  t.builtIn = false;
  t.updatedAt = new Date().toISOString();
  return { format: TEMPLATE_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), template: t };
}

/** Parse text safely and classify it as designer document, template file or something else. */
export function parseJsonText(text) {
  if (typeof text !== 'string') throw new Error('Nội dung không hợp lệ.');
  if (text.length > MAX_JSON_BYTES) throw new Error('Tệp JSON quá lớn (tối đa 25 MB).');
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`JSON không hợp lệ: ${e.message}`);
  }
}

export function detectJsonKind(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.format === DESIGNER_FORMAT) return 'designer';
    if (value.format === TEMPLATE_FORMAT) return 'template';
    if ('sign_props' in value || ('lLx' in value && 'lLy' in value)) return 'legacy';
  }
  if (Array.isArray(value) && value.length && value.every((v) => v && typeof v === 'object' && 'lLx' in v)) return 'legacy';
  if (typeof value === 'string' && value.trim().startsWith('[')) return 'legacy';
  return 'unknown';
}

function checkVersion(value) {
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Tệp được tạo bởi phiên bản mới hơn (schema v${value.schemaVersion}); phiên bản này hỗ trợ v${SCHEMA_VERSION}.`);
  }
}

/** Re-key ids so imported content never collides with existing objects. */
function freshIds(signature) {
  const s = clone(signature);
  s.id = uid('sig');
  return s;
}

export function importDesignerDocument(value) {
  checkVersion(value);
  const r = designerDocumentSchema.safeParse(value);
  if (!r.success) return { ok: false, errors: formatZodIssues(r.error) };
  return { ok: true, document: r.data.document, signatures: r.data.signatures.map(freshIds) };
}

export function importTemplateFile(value) {
  checkVersion(value);
  const r = templateFileSchema.safeParse(value);
  if (!r.success) return { ok: false, errors: formatZodIssues(r.error) };
  const t = r.data.template;
  return { ok: true, template: { ...t, id: t.builtIn ? uid('tpl') : t.id, builtIn: false } };
}
