/**
 * Pure, immutable operations on the signatures array. The store wraps these
 * with undo/redo; tests exercise them directly.
 */
import { clone, uid, resizeTemplate } from '../../engines/template-engine/index.js';
import {
  createPageGeometry,
  designSizeForRect,
  rectFromDisplayPlacement,
  displaySize,
  clampRectToPage,
  normalizeRotation,
  pdfRectToDisplay,
} from '../../engines/coordinate-engine/index.js';

export const DEFAULT_A4 = createPageGeometry({ mediaBox: [0, 0, 595.28, 841.89] });

const mapSig = (sigs, id, fn) => sigs.map((s) => (s.id === id ? fn(s) : s));

export function findSignature(sigs, id) {
  return sigs.find((s) => s.id === id) ?? null;
}

export function findElement(sigs, sigId, elId) {
  return findSignature(sigs, sigId)?.template.elements.find((e) => e.id === elId) ?? null;
}

/** Create a placement for a template. Default: centred on the visible page. */
export function createSignatureFromTemplate(template, { page = 1, geom = DEFAULT_A4, viewRotation = 0, displayTopLeft, name } = {}) {
  const t = clone(template);
  t.id = uid('tpl');
  t.builtIn = false;
  const size = displaySize(geom, viewRotation);
  const tl = displayTopLeft ?? { x: (size.width - t.size.width) / 2, y: (size.height - t.size.height) / 2 };
  const rect = clampRectToPage(geom, rectFromDisplayPlacement(geom, tl, t.size, 0, viewRotation));
  return { id: uid('sig'), name: name ?? template.name, page, rect, rotation: 0, opacity: 1, visible: true, locked: false, template: t };
}

export function addSignature(sigs, sig) {
  return [...sigs, sig];
}

export function removeSignature(sigs, id) {
  return sigs.filter((s) => s.id !== id);
}

export function updateSignature(sigs, id, patch) {
  return mapSig(sigs, id, (s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
}

export function duplicateSignature(sigs, id, geom = DEFAULT_A4) {
  const s = findSignature(sigs, id);
  if (!s) return { sigs, newId: null };
  const copy = clone(s);
  copy.id = uid('sig');
  copy.name = `${s.name} (bản sao)`;
  copy.locked = false;
  copy.rect = clampRectToPage(geom, { ...s.rect, x: s.rect.x + 12, y: s.rect.y - 12 });
  return { sigs: [...sigs, copy], newId: copy.id };
}

/**
 * Move/resize a signature to `rect` (PDF space). The template's design size
 * follows the rect and its elements reflow through their layout constraints.
 */
export function setSignatureRect(sig, rect, geom = DEFAULT_A4) {
  const size = designSizeForRect(geom, rect, sig.rotation);
  return { ...sig, rect, template: resizeTemplate(sig.template, size) };
}

/** Rotate content by 90° steps, keeping the box centre fixed on the page. */
export function setSignatureRotation(sig, rotation, geom = DEFAULT_A4) {
  const r = normalizeRotation(rotation);
  if (r === sig.rotation) return sig;
  const swap = ((r - sig.rotation + 360) % 180) !== 0;
  if (!swap) return { ...sig, rotation: r };
  const c = { x: sig.rect.x + sig.rect.width / 2, y: sig.rect.y + sig.rect.height / 2 };
  const rect = clampRectToPage(geom, { x: c.x - sig.rect.height / 2, y: c.y - sig.rect.width / 2, width: sig.rect.height, height: sig.rect.width });
  return { ...sig, rotation: r, rect };
}

/** Replace the template of a placement, keeping its centre. */
export function applyTemplateToSignature(sig, template, geom = DEFAULT_A4) {
  const t = clone(template);
  t.id = uid('tpl');
  t.builtIn = false;
  const c = { x: sig.rect.x + sig.rect.width / 2, y: sig.rect.y + sig.rect.height / 2 };
  const o = (geom.rotate + sig.rotation) % 180 !== 0;
  const w = o ? t.size.height : t.size.width;
  const h = o ? t.size.width : t.size.height;
  const rect = clampRectToPage(geom, { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
  return { ...sig, name: template.name, rect, template: t };
}

export function updateTemplate(sigs, sigId, patch) {
  return mapSig(sigs, sigId, (s) => ({ ...s, template: { ...s.template, ...(typeof patch === 'function' ? patch(s.template) : patch), updatedAt: new Date().toISOString() } }));
}

export function updateElement(sigs, sigId, elId, patch) {
  return updateTemplate(sigs, sigId, (t) => ({
    elements: t.elements.map((e) => {
      if (e.id !== elId) return e;
      const p = typeof patch === 'function' ? patch(e) : patch;
      const next = { ...e, ...p };
      // merge nested type-specific props instead of replacing them
      for (const k of ['text', 'image', 'qr', 'shape', 'line']) if (p[k] && e[k]) next[k] = { ...e[k], ...p[k] };
      return next;
    }),
  }));
}

export function addElement(sigs, sigId, el) {
  return updateTemplate(sigs, sigId, (t) => ({ elements: [...t.elements, el] }));
}

export function removeElement(sigs, sigId, elId) {
  return updateTemplate(sigs, sigId, (t) => ({ elements: t.elements.filter((e) => e.id !== elId) }));
}

export function duplicateElement(sigs, sigId, elId) {
  const el = findElement(sigs, sigId, elId);
  if (!el) return { sigs, newId: null };
  const copy = { ...clone(el), id: uid('el'), name: `${el.name || 'Phần tử'} (bản sao)`, x: el.x + 6, y: el.y + 6, locked: false };
  return { sigs: updateTemplate(sigs, sigId, (t) => ({ elements: [...t.elements, copy] })), newId: copy.id };
}

/** Layer ordering. Later elements draw on top. */
export function reorderElement(sigs, sigId, elId, direction) {
  return updateTemplate(sigs, sigId, (t) => {
    const els = [...t.elements];
    const i = els.findIndex((e) => e.id === elId);
    if (i < 0) return {};
    const [el] = els.splice(i, 1);
    const target = { up: Math.min(els.length, i + 1), down: Math.max(0, i - 1), top: els.length, bottom: 0 }[direction] ?? i;
    els.splice(target, 0, el);
    return { elements: els };
  });
}

/** Signature display box at the current view, for UI read-outs. */
export function signatureDisplayBox(sig, geom, viewRotation = 0) {
  return pdfRectToDisplay(geom, sig.rect, viewRotation);
}
