/**
 * Safe variable interpolation: `{{signer.name}}` style placeholders are
 * resolved ONLY against a whitelist (VARIABLE_KEYS) via plain object lookups.
 * No eval/Function, no prototype traversal, and the output is plain text that
 * is drawn on canvas/PDF — it is never injected as HTML.
 */
import { VARIABLE_KEYS, VARIABLES } from './constants.js';
import { signingDateParts } from './datetime.js';

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\s*\}\}/g;

export function extractVariables(str) {
  if (typeof str !== 'string') return [];
  const found = new Set();
  for (const m of str.matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}

export function unknownVariables(str) {
  return extractVariables(str).filter((k) => !VARIABLE_KEYS.has(k));
}

function own(obj, key) {
  return obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function toText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/**
 * Build the flat lookup map used by interpolation from raw data
 * ({ signer, certificate, signing: { timestamp, reason, location }, ... }).
 */
export function buildVariableContext(data = {}, dateTime = {}) {
  const ctx = Object.create(null);
  for (const { key } of VARIABLES) {
    const [group, field] = key.split('.');
    ctx[key] = toText(own(own(data, group), field));
  }
  const signing = own(data, 'signing') ?? {};
  const derived = signingDateParts(own(signing, 'timestamp'), dateTime);
  // Explicitly provided formatted values win over derived ones (runtime back-ends may send them).
  ctx['signing.date'] = toText(own(signing, 'date')) || derived.date;
  ctx['signing.time'] = toText(own(signing, 'time')) || derived.time;
  ctx['signing.datetime'] = toText(own(signing, 'datetime')) || derived.datetime;
  if (dateTime.showDate === false) ctx['signing.date'] = '';
  if (dateTime.showTime === false) ctx['signing.time'] = '';
  return ctx;
}

/**
 * @param {string} str
 * @param {Record<string,string>} ctx flat context from buildVariableContext
 * @param {{mode?: 'placeholder'|'data', hideEmptyLines?: boolean}} [opts]
 *   mode 'placeholder' leaves known variables as `{{key}}` (design view).
 *   hideEmptyLines removes lines whose variables all resolved to '' (e.g. a
 *   "Lý do: {{signing.reason}}" line when no reason is supplied).
 */
export function interpolate(str, ctx, { mode = 'data', hideEmptyLines = false } = {}) {
  if (typeof str !== 'string' || !str) return '';
  if (mode === 'placeholder') return str;
  const lines = str.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    let hadVars = false;
    let anyValue = false;
    const replaced = line.replace(PLACEHOLDER, (match, key) => {
      if (!VARIABLE_KEYS.has(key)) return match; // unknown → leave literally, flagged by validators
      hadVars = true;
      const v = ctx[key] ?? '';
      if (v) anyValue = true;
      return v;
    });
    if (hideEmptyLines && hadVars && !anyValue) continue;
    out.push(replaced);
  }
  return out.join('\n');
}

export function variableLabel(key) {
  return VARIABLES.find((v) => v.key === key)?.label ?? key;
}
