import { describe, it, expect, beforeEach } from 'vitest';
import * as H from '../../src/stores/history.js';
import * as ops from '../../src/features/signatures/operations.js';
import { useEditor } from '../../src/stores/editor-store.js';
import { buildTemplateLibrary } from '../../src/features/templates/library.js';
import { createElement } from '../../src/engines/template-engine/index.js';
import { createPageGeometry, pdfRectToDisplay } from '../../src/engines/coordinate-engine/index.js';

const lib = buildTemplateLibrary({});
const byId = Object.fromEntries(lib.map((t) => [t.id, t]));

describe('history', () => {
  it('records, undoes and redoes', () => {
    let h = H.createHistory();
    h = H.record(h, 'a');
    h = H.record(h, 'b');
    const u = H.undo(h, 'c');
    expect(u.value).toBe('b');
    const r = H.redo(u.history, 'b');
    expect(r.value).toBe('c');
    expect(H.undo(H.createHistory(), 'x')).toBe(null);
  });
  it('coalesces same-key commits within the window', () => {
    let h = H.createHistory();
    h = H.record(h, 'v0', { key: 'name', now: 1000 });
    h = H.record(h, 'v1', { key: 'name', now: 1300 });
    h = H.record(h, 'v2', { key: 'name', now: 1600 });
    expect(h.past).toEqual(['v0']);
    h = H.record(h, 'v3', { key: 'name', now: 5000 });
    expect(h.past).toEqual(['v0', 'v3']);
  });
  it('turns a transaction into one step', () => {
    let h = H.begin(H.createHistory(), 'start');
    h = H.record(h, 'ignored');
    h = H.end(h, 'final');
    expect(h.past).toEqual(['start']);
    expect(H.end(H.begin(H.createHistory(), 'same'), 'same').past).toEqual([]);
  });
  it('caps the history length', () => {
    let h = H.createHistory();
    for (let i = 0; i < H.HISTORY_LIMIT + 20; i++) h = H.record(h, i);
    expect(h.past).toHaveLength(H.HISTORY_LIMIT);
  });
});

describe('signature operations', () => {
  const geom = createPageGeometry({ mediaBox: [0, 0, 595.28, 841.89] });

  it('centres a new placement on the visible page and preserves template size', () => {
    const s = ops.createSignatureFromTemplate(byId.enterprise, { geom });
    const d = pdfRectToDisplay(geom, s.rect);
    expect(d.x + d.width / 2).toBeCloseTo(595.28 / 2);
    expect(d.width).toBe(190);
    expect(s.template.id).not.toBe('enterprise');
    expect(s.template.builtIn).toBe(false);
  });

  it('places on a rotated page with upright, swapped design size', () => {
    const g90 = createPageGeometry({ mediaBox: [0, 0, 595.28, 841.89], rotate: 90 });
    const s = ops.createSignatureFromTemplate(byId.enterprise, { geom: g90, displayTopLeft: { x: 20, y: 30 } });
    expect(s.rect.width).toBe(80);
    expect(s.rect.height).toBe(190);
    expect(pdfRectToDisplay(g90, s.rect)).toMatchObject({ x: 20, y: 30, width: 190, height: 80 });
  });

  it('resizing reflows elements via constraints, never scaling fonts', () => {
    const s = ops.createSignatureFromTemplate(byId.enterprise, { geom });
    const r = ops.setSignatureRect(s, { ...s.rect, width: 380, height: 160 }, geom);
    expect(r.template.size).toEqual({ width: 380, height: 160 });
    expect(r.template.elements[0].width).toBe(178 + 190);
    expect(r.template.elements[0].text.fontSize).toBe(9);
  });

  it('rotating content by 90° swaps the rect around its centre', () => {
    const s = ops.createSignatureFromTemplate(byId.enterprise, { geom });
    const r = ops.setSignatureRotation(s, 90, geom);
    expect(r.rect.width).toBeCloseTo(s.rect.height);
    expect(r.rect.x + r.rect.width / 2).toBeCloseTo(s.rect.x + s.rect.width / 2);
    expect(ops.setSignatureRotation(r, 270, geom).rect).toEqual(r.rect);
  });

  it('applies a template keeping the centre', () => {
    const s = ops.createSignatureFromTemplate(byId.enterprise, { geom });
    const r = ops.applyTemplateToSignature(s, byId['nd30-electronic-copy'], geom);
    expect(r.rect.x + r.rect.width / 2).toBeCloseTo(s.rect.x + s.rect.width / 2);
    expect(r.template.complianceProfile).toBe('nd30-electronic-copy');
  });

  it('reorders layers', () => {
    let sigs = [ops.createSignatureFromTemplate(byId.hospital, { geom })];
    const id = sigs[0].id;
    const order = () => sigs[0].template.elements.map((e) => e.id);
    expect(order()).toEqual(['h-logo', 'h-org', 'h-date', 'h-qr']);
    sigs = ops.reorderElement(sigs, id, 'h-logo', 'top');
    expect(order()).toEqual(['h-org', 'h-date', 'h-qr', 'h-logo']);
    sigs = ops.reorderElement(sigs, id, 'h-logo', 'down');
    expect(order()).toEqual(['h-org', 'h-date', 'h-logo', 'h-qr']);
    sigs = ops.reorderElement(sigs, id, 'h-qr', 'bottom');
    expect(order()).toEqual(['h-qr', 'h-org', 'h-date', 'h-logo']);
  });

  it('merges nested props on element update', () => {
    let sigs = [ops.createSignatureFromTemplate(byId.enterprise, { geom })];
    sigs = ops.updateElement(sigs, sigs[0].id, 'e-info', { text: { fontSize: 14 } });
    expect(sigs[0].template.elements[0].text.fontSize).toBe(14);
    expect(sigs[0].template.elements[0].text.color).toBe('#ff0033');
  });
});

describe('editor store undo/redo', () => {
  beforeEach(() => {
    useEditor.setState({ signatures: [], history: H.createHistory(), selection: { signatureId: null, elementId: null } });
  });

  it('undoes and redoes add, edit, move and delete', () => {
    const st = useEditor.getState();
    const sig = st.addFromTemplate(byId.enterprise);
    expect(useEditor.getState().signatures).toHaveLength(1);
    useEditor.getState().updateSignature(sig.id, { name: 'A' }, { key: 'name' });
    useEditor.getState().updateSignature(sig.id, { name: 'AB' }, { key: 'name' }); // coalesced
    useEditor.getState().beginLive();
    for (let i = 1; i <= 10; i++) useEditor.getState().setSignatureRect(sig.id, { ...sig.rect, x: sig.rect.x + i }, { live: true });
    useEditor.getState().endLive();
    useEditor.getState().addElement(sig.id, createElement('qr'));
    useEditor.getState().removeSignature(sig.id);
    expect(useEditor.getState().signatures).toHaveLength(0);

    const undo = () => useEditor.getState().undo();
    undo(); // delete
    expect(useEditor.getState().signatures).toHaveLength(1);
    undo(); // add element
    expect(useEditor.getState().signatures[0].template.elements).toHaveLength(1);
    undo(); // whole drag is one step
    expect(useEditor.getState().signatures[0].rect.x).toBe(sig.rect.x);
    expect(useEditor.getState().signatures[0].name).toBe('AB');
    undo(); // both renames
    expect(useEditor.getState().signatures[0].name).toBe(sig.name);
    undo(); // add
    expect(useEditor.getState().signatures).toHaveLength(0);
    expect(useEditor.getState().canUndo()).toBe(false);

    for (let i = 0; i < 5; i++) useEditor.getState().redo();
    expect(useEditor.getState().signatures).toHaveLength(0);
    expect(useEditor.getState().canRedo()).toBe(false);
    undo();
    expect(useEditor.getState().signatures[0].rect.x).toBe(sig.rect.x + 10);
    expect(useEditor.getState().selection.signatureId).toBe(null); // selection fixed after undo
  });

  it('a new edit clears the redo stack', () => {
    const sig = useEditor.getState().addFromTemplate(byId.enterprise);
    useEditor.getState().updateSignature(sig.id, { opacity: 0.5 });
    useEditor.getState().undo();
    expect(useEditor.getState().canRedo()).toBe(true);
    useEditor.getState().updateSignature(sig.id, { opacity: 0.7 });
    expect(useEditor.getState().canRedo()).toBe(false);
  });
});
