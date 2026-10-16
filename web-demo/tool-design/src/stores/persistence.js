/**
 * localStorage persistence for user-saved templates and UI preferences only.
 * PDF bytes, document text and runtime signer data are never persisted.
 * Stored templates are re-validated on load; invalid entries are dropped.
 */
import { templateSchema } from '../schemas/designer-schema.js';

const TEMPLATES_KEY = 'vneca.signature-designer.templates.v1';
const PREFS_KEY = 'vneca.signature-designer.prefs.v1';

function storage() {
  try {
    const s = typeof localStorage !== 'undefined' ? localStorage : null;
    return s && typeof s.getItem === 'function' && typeof s.setItem === 'function' ? s : null;
  } catch {
    return null; // e.g. disabled storage, sandboxed iframe, Node without --localstorage-file
  }
}

export function loadCustomTemplates() {
  const raw = storage()?.getItem(TEMPLATES_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((t) => templateSchema.safeParse(t)).filter((r) => r.success).map((r) => r.data);
  } catch {
    return [];
  }
}

/** @returns {boolean} false when the browser quota is exceeded */
export function saveCustomTemplates(list) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(TEMPLATES_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function loadPreferences() {
  try {
    return JSON.parse(storage()?.getItem(PREFS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function savePreferences(prefs) {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors for preferences */
  }
}
