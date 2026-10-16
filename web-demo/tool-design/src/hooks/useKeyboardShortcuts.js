import { useEffect } from 'react';
import { useEditor, clampZoom } from '../stores/editor-store.js';
import { useDialogs, openFilePicker } from '../stores/ui-store.js';
import { openPdfFile } from '../features/document/document-actions.js';
import { pdfRectToDisplay, displayRectToPdf, clampRectToPage } from '../engines/coordinate-engine/index.js';

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const st = useEditor.getState();
      const dialogs = useDialogs.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (dialogs.dialog) return; // Radix handles Esc inside dialogs
      const key = e.key.toLowerCase();

      // Global shortcuts that also work while typing would be surprising; only mod-combos below.
      if (mod && key === 'z' && !isTyping(e)) {
        e.preventDefault();
        return e.shiftKey ? st.redo() : st.undo();
      }
      if (mod && key === 'y' && !isTyping(e)) {
        e.preventDefault();
        return st.redo();
      }
      if (mod && key === 'o') {
        e.preventDefault();
        return openFilePicker('application/pdf,.pdf', openPdfFile);
      }
      if (mod && key === 's') {
        e.preventDefault();
        if (st.selection.signatureId) dialogs.open('save');
        return;
      }
      if (mod && key === 'e') {
        e.preventDefault();
        if (st.signatures.length) dialogs.open('export');
        return;
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        return st.setZoom(clampZoom(st.zoom * 1.2));
      }
      if (mod && key === '-') {
        e.preventDefault();
        return st.setZoom(clampZoom(st.zoom / 1.2));
      }
      if (mod && key === '0') {
        e.preventDefault();
        return st.resetView();
      }
      if (isTyping(e)) return;

      const { signatureId, elementId } = st.selection;
      const sig = st.signatures.find((s) => s.id === signatureId);
      if (mod && key === 'd' && sig) {
        e.preventDefault();
        return elementId ? st.duplicateElement(sig.id, elementId) : st.duplicateSignature(sig.id);
      }
      if (mod) return;

      if (e.key === '?') return dialogs.open('shortcuts');
      if (key === 'g') return st.updateSettings({ grid: !st.settings.grid });
      if (key === '1') return st.setView('template');
      if (key === '2') return st.setView('placement');
      if (key === '3') return st.signatures.length && st.setView('rendered');
      if (e.key === 'Escape') {
        if (elementId) return st.select(signatureId, null);
        return st.clearSelection();
      }
      if (!sig) return;
      if (e.key === 'Enter' && !elementId && sig.template.elements[0]) {
        e.preventDefault();
        return st.select(sig.id, sig.template.elements[sig.template.elements.length - 1].id);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        return elementId ? st.removeElement(sig.id, elementId) : st.removeSignature(sig.id);
      }
      if (elementId && (e.key === '[' || e.key === ']')) return st.reorderElement(sig.id, elementId, e.key === ']' ? 'up' : 'down');

      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key]) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = arrows[e.key].map((v) => v * step);
        if (elementId) {
          const el = sig.template.elements.find((x) => x.id === elementId);
          if (!el || el.locked) return;
          // arrows move in the reader's (design) directions
          return st.updateElement(sig.id, elementId, { x: el.x + dx, y: el.y + dy }, { key: `nudge:${elementId}` });
        }
        if (sig.locked) return;
        // move in screen directions, honouring the view rotation
        const geom = st.geometry(sig.page);
        const d = pdfRectToDisplay(geom, sig.rect, st.viewRotation);
        const rect = clampRectToPage(geom, displayRectToPdf(geom, { ...d, x: d.x + dx, y: d.y + dy }, st.viewRotation));
        return st.setSignatureRect(sig.id, rect, { key: `nudge:${sig.id}` });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
