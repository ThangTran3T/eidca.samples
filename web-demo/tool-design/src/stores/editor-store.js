/**
 * Editor state (Zustand). Only `signatures` is undoable. The PDF document
 * lives in memory only and is never persisted. Custom templates are saved to
 * localStorage only when the user explicitly saves them.
 */
import { create } from 'zustand';
import * as H from './history.js';
import * as ops from '../features/signatures/operations.js';
import { clone, DEFAULT_SAMPLE_DATA } from '../engines/template-engine/index.js';
import { geometryFromPdfJsView, clampRectToPage } from '../engines/coordinate-engine/index.js';
import { loadCustomTemplates, saveCustomTemplates, loadPreferences, savePreferences } from './persistence.js';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

const prefs = loadPreferences();

export const useEditor = create((set, get) => {
  /** Apply an undoable change to the signatures array. */
  const commit = (fn, opts) => {
    const { signatures, history } = get();
    const next = fn(signatures);
    if (next === signatures) return;
    set({ signatures: next, history: H.record(history, signatures, opts) });
  };
  const geomOf = (page) => get().geometry(page);

  return {
    // ── document ──────────────────────────────────────────────────────────
    doc: null, // { name, bytes, pdf, pages: [{pageNumber, view, rotate, userUnit}], sampleMeta? }
    docStatus: 'empty', // empty | loading | ready | error
    docError: null,
    pageText: {},

    // ── design (undoable) ─────────────────────────────────────────────────
    signatures: [],
    history: H.createHistory(),

    // ── UI state ──────────────────────────────────────────────────────────
    selection: { signatureId: null, elementId: null },
    zoom: 1,
    viewRotation: 0,
    currentPage: 1,
    view: 'placement', // template | placement | rendered
    displayMode: 'sample', // placeholder | sample | runtime
    runtimeData: clone(DEFAULT_SAMPLE_DATA),
    settings: { grid: false, snap: true, gridSize: 5, rulers: true, guides: true, units: 'mm', ...prefs.settings },
    theme: prefs.theme ?? 'light',
    locale: prefs.locale ?? 'vi',
    library: [],
    libraryReady: false,
    customTemplates: loadCustomTemplates(),
    toasts: [],
    cursor: null, // {x, y} in PDF points on currentPage
    panels: { left: true, right: true },
    togglePanel: (side) => set({ panels: { ...get().panels, [side]: !get().panels[side] } }),

    // ── geometry helpers ──────────────────────────────────────────────────
    geometry(page) {
      const info = get().doc?.pages?.[page - 1];
      return info ? geometryFromPdfJsView(info.view, info.rotate, info.userUnit) : ops.DEFAULT_A4;
    },
    pageGeoms() {
      const out = {};
      (get().doc?.pages ?? []).forEach((p) => (out[p.pageNumber] = geometryFromPdfJsView(p.view, p.rotate, p.userUnit)));
      return out;
    },

    // ── document actions ──────────────────────────────────────────────────
    setDocLoading: () => set({ docStatus: 'loading', docError: null }),
    setDocError: (message) => set({ docStatus: get().doc ? 'ready' : 'error', docError: message }),
    setDocument(doc) {
      const old = get().doc;
      old?.pdf?.destroy?.();
      // Keep signatures but clamp them into the new document's pages.
      const pages = doc.pages.length;
      const sigs = get().signatures.map((s) => {
        const page = Math.min(Math.max(1, s.page), pages);
        const info = doc.pages[page - 1];
        const g = geometryFromPdfJsView(info.view, info.rotate, info.userUnit);
        return ops.setSignatureRect({ ...s, page }, clampRectToPage(g, s.rect), g);
      });
      set({ doc, docStatus: 'ready', docError: null, pageText: {}, currentPage: 1, signatures: sigs, view: get().view === 'rendered' ? 'placement' : get().view });
    },
    closeDocument() {
      get().doc?.pdf?.destroy?.();
      set({ doc: null, docStatus: 'empty', docError: null, pageText: {}, currentPage: 1 });
    },
    setPageText: (page, items) => set({ pageText: { ...get().pageText, [page]: items } }),

    // ── history ───────────────────────────────────────────────────────────
    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,
    undo() {
      const r = H.undo(get().history, get().signatures);
      if (r) set({ signatures: r.value, history: r.history, selection: fixSelection(get().selection, r.value) });
    },
    redo() {
      const r = H.redo(get().history, get().signatures);
      if (r) set({ signatures: r.value, history: r.history, selection: fixSelection(get().selection, r.value) });
    },
    beginLive: () => set({ history: H.begin(get().history, get().signatures) }),
    endLive: () => set({ history: H.end(get().history, get().signatures) }),
    /** Update during a live transaction (no history entry until endLive). */
    live: (fn) => set({ signatures: fn(get().signatures) }),

    // ── selection & view ──────────────────────────────────────────────────
    select(signatureId, elementId = null) {
      const sig = ops.findSignature(get().signatures, signatureId);
      set({ selection: { signatureId: sig ? signatureId : null, elementId: sig ? elementId : null }, currentPage: sig ? sig.page : get().currentPage });
    },
    clearSelection: () => set({ selection: { signatureId: null, elementId: null } }),
    setZoom: (z) => set({ zoom: clampZoom(z) }),
    setView: (view) => set({ view }),
    setDisplayMode: (displayMode) => set({ displayMode }),
    setRuntimeData: (runtimeData) => set({ runtimeData }),
    setCurrentPage: (p) => set({ currentPage: p }),
    rotateView: (delta) => set({ viewRotation: (((get().viewRotation + delta) % 360) + 360) % 360 }),
    resetView: () => set({ zoom: 1, viewRotation: 0 }),
    setCursor: (cursor) => set({ cursor }),
    updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      savePreferences({ settings, theme: get().theme, locale: get().locale });
    },
    setTheme(theme) {
      set({ theme });
      savePreferences({ settings: get().settings, theme, locale: get().locale });
    },
    setLocale(locale) {
      set({ locale });
      savePreferences({ settings: get().settings, theme: get().theme, locale });
    },

    // ── library ───────────────────────────────────────────────────────────
    setLibrary: (library) => set({ library, libraryReady: true }),
    saveCustomTemplate(template) {
      const t = { ...clone(template), builtIn: false, category: template.category === 'nd30' ? 'nd30' : template.category, updatedAt: new Date().toISOString() };
      const list = [t, ...get().customTemplates.filter((x) => x.id !== t.id)];
      const ok = saveCustomTemplates(list);
      if (ok) set({ customTemplates: list });
      return ok;
    },
    deleteCustomTemplate(id) {
      const list = get().customTemplates.filter((t) => t.id !== id);
      saveCustomTemplates(list);
      set({ customTemplates: list });
    },

    // ── signature actions ─────────────────────────────────────────────────
    addFromTemplate(template, { page, displayTopLeft, rect } = {}) {
      const p = page ?? get().currentPage;
      let sig = ops.createSignatureFromTemplate(template, { page: p, geom: geomOf(p), viewRotation: get().viewRotation, displayTopLeft });
      if (rect) sig = ops.setSignatureRect(sig, rect, geomOf(p));
      commit((s) => ops.addSignature(s, sig));
      set({ selection: { signatureId: sig.id, elementId: null }, currentPage: p });
      return sig;
    },
    addSignatures(list) {
      commit((s) => [...s, ...list]);
      if (list[0]) set({ selection: { signatureId: list[0].id, elementId: null } });
    },
    replaceSignatures(list) {
      commit(() => list);
      set({ selection: { signatureId: list[0]?.id ?? null, elementId: null } });
    },
    applyTemplate(sigId, template) {
      commit((sigs) => sigs.map((s) => (s.id === sigId ? ops.applyTemplateToSignature(s, template, geomOf(s.page)) : s)));
    },
    removeSignature(id) {
      commit((s) => ops.removeSignature(s, id));
      set({ selection: { signatureId: null, elementId: null } });
    },
    duplicateSignature(id) {
      const s = ops.findSignature(get().signatures, id);
      if (!s) return;
      const r = ops.duplicateSignature(get().signatures, id, geomOf(s.page));
      commit(() => r.sigs);
      set({ selection: { signatureId: r.newId, elementId: null } });
    },
    updateSignature: (id, patch, opts) => commit((s) => ops.updateSignature(s, id, patch), opts),
    setSignatureRect(id, rect, { live = false, key } = {}) {
      const fn = (sigs) => sigs.map((s) => (s.id === id ? ops.setSignatureRect(s, rect, geomOf(s.page)) : s));
      live ? get().live(fn) : commit(fn, { key });
    },
    setSignaturePage(id, page) {
      const g = geomOf(page);
      commit((sigs) => sigs.map((s) => (s.id === id ? ops.setSignatureRect({ ...s, page }, clampRectToPage(g, s.rect), g) : s)));
      set({ currentPage: page });
    },
    setSignatureRotation(id, rotation) {
      commit((sigs) => sigs.map((s) => (s.id === id ? ops.setSignatureRotation(s, rotation, geomOf(s.page)) : s)));
    },
    updateTemplate: (sigId, patch, opts) => commit((s) => ops.updateTemplate(s, sigId, patch), opts),

    // ── element actions ───────────────────────────────────────────────────
    addElement(sigId, el) {
      commit((s) => ops.addElement(s, sigId, el));
      set({ selection: { signatureId: sigId, elementId: el.id } });
    },
    updateElement(sigId, elId, patch, { live = false, key } = {}) {
      const fn = (s) => ops.updateElement(s, sigId, elId, patch);
      live ? get().live(fn) : commit(fn, { key });
    },
    removeElement(sigId, elId) {
      commit((s) => ops.removeElement(s, sigId, elId));
      set({ selection: { signatureId: sigId, elementId: null } });
    },
    duplicateElement(sigId, elId) {
      const r = ops.duplicateElement(get().signatures, sigId, elId);
      commit(() => r.sigs);
      set({ selection: { signatureId: sigId, elementId: r.newId } });
    },
    reorderElement: (sigId, elId, dir) => commit((s) => ops.reorderElement(s, sigId, elId, dir)),

    // ── toasts ────────────────────────────────────────────────────────────
    toast(message, tone = 'info', ms = 4200) {
      const id = Math.random().toString(36).slice(2);
      set({ toasts: [...get().toasts, { id, message, tone }] });
      if (ms) setTimeout(() => get().dismissToast(id), ms);
      return id;
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  };
});

function fixSelection(sel, sigs) {
  const sig = sigs.find((s) => s.id === sel.signatureId);
  if (!sig) return { signatureId: null, elementId: null };
  const el = sig.template.elements.find((e) => e.id === sel.elementId);
  return { signatureId: sig.id, elementId: el ? el.id : null };
}

// Selectors
export const selectSelectedSignature = (s) => s.signatures.find((x) => x.id === s.selection.signatureId) ?? null;
export const selectSelectedElement = (s) => {
  const sig = selectSelectedSignature(s);
  return sig?.template.elements.find((e) => e.id === s.selection.elementId) ?? null;
};
