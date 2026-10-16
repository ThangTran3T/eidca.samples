import { describe, it, expect } from 'vitest';
import { exportDesignerDocument, importDesignerDocument, exportTemplateFile, importTemplateFile, parseJsonText, detectJsonKind } from '../../src/features/export/designer-io.js';
import { buildTemplateLibrary } from '../../src/features/templates/library.js';
import { pngDataUrl } from '../helpers/png.js';

const PNG = pngDataUrl(4, 4, () => [200, 20, 20, 255]);
const lib = buildTemplateLibrary({ seal: { src: PNG, width: 4, height: 4 }, signature: { src: PNG, width: 4, height: 4 } });
const sigs = lib.slice(0, 4).map((t, i) => ({ id: `s${i}`, name: t.name, page: 1 + (i % 2), rect: { x: 50 + i, y: 60, width: t.size.width, height: t.size.height }, rotation: i % 2 ? 90 : 0, opacity: 0.9, visible: true, locked: i === 0, template: t }));

describe('Designer JSON', () => {
  it('round-trips a full document losslessly (except regenerated signature ids)', () => {
    const json = JSON.stringify(exportDesignerDocument({ documentName: 'quyet-dinh-mau.pdf', pages: [{ view: [0, 0, 595.28, 841.89], rotate: 0 }], signatures: sigs }));
    const value = parseJsonText(json);
    expect(detectJsonKind(value)).toBe('designer');
    const r = importDesignerDocument(value);
    expect(r.ok).toBe(true);
    expect(r.signatures).toHaveLength(4);
    r.signatures.forEach((s, i) => {
      const { id, ...rest } = s;
      const { id: _o, ...orig } = sigs[i];
      expect(id).not.toBe(sigs[i].id);
      expect(rest).toEqual(orig);
    });
    expect(r.document.name).toBe('quyet-dinh-mau.pdf');
  });

  it('never contains PDF bytes', () => {
    const doc = exportDesignerDocument({ documentName: 'x.pdf', pages: [], signatures: sigs });
    expect(JSON.stringify(doc)).not.toMatch(/application\/pdf|%PDF-/);
  });

  it('rejects invalid documents with readable errors', () => {
    const doc = exportDesignerDocument({ documentName: 'x.pdf', pages: [], signatures: sigs });
    doc.signatures[0].template.elements[0].image.src = 'javascript:alert(1)';
    doc.signatures[1].rect.width = -5;
    const r = importDesignerDocument(doc);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/PNG hoặc JPEG/);
    expect(r.errors.join('\n')).toMatch(/rect\.width/);
  });

  it('rejects SVG/HTML payloads smuggled as images', () => {
    const doc = exportDesignerDocument({ documentName: 'x.pdf', pages: [], signatures: sigs.slice(0, 1) });
    doc.signatures[0].template.elements[0].image.src = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+';
    expect(importDesignerDocument(doc).ok).toBe(false);
  });

  it('refuses files from a newer schema version', () => {
    const doc = exportDesignerDocument({ documentName: '', pages: [], signatures: [] });
    doc.schemaVersion = 99;
    expect(() => importDesignerDocument(doc)).toThrow(/phiên bản mới hơn/);
  });

  it('exports and re-imports a single template file', () => {
    const file = exportTemplateFile(lib[0]);
    expect(detectJsonKind(file)).toBe('template');
    const r = importTemplateFile(JSON.parse(JSON.stringify(file)));
    expect(r.ok).toBe(true);
    expect(r.template.builtIn).toBe(false);
    expect(r.template.elements).toEqual(lib[0].elements);
  });

  it('detects legacy JSON and handles bad text', () => {
    expect(detectJsonKind([{ page: 1, lLx: 1, lLy: 1 }])).toBe('legacy');
    expect(detectJsonKind({ sign_props: '[]' })).toBe('legacy');
    expect(detectJsonKind({ foo: 1 })).toBe('unknown');
    expect(() => parseJsonText('{')).toThrow(/JSON không hợp lệ/);
    expect(parseJsonText('﻿{"a":1}')).toEqual({ a: 1 });
  });
});
