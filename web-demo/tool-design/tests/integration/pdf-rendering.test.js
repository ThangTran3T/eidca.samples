/**
 * Rendered-PDF preview: appearances are drawn at the exact PDF rect, upright
 * on rotated pages, with Vietnamese text embedded as real Unicode text, and
 * the output is clearly marked as an unsigned preview.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderAppearancesToPdf, PREVIEW_NOTICE } from '../../src/engines/rendering-engine/pdf-renderer.js';
import { createElement, createTemplate } from '../../src/engines/template-engine/index.js';
import { nodeFontRegistry, readSample } from '../helpers/node-fonts.js';
import { pngDataUrl } from '../helpers/png.js';

let fonts;
beforeAll(async () => {
  fonts = await nodeFontRegistry();
});

const VI = 'Nguyễn Thị Ánh Tuyết — Phê duyệt văn bản ở Đà Nẵng';

function template(extra = []) {
  return createTemplate({
    size: { width: 220, height: 60 },
    style: { background: { color: '#eef2ff', opacity: 1 }, border: { width: 1, color: '#1d4ed8', style: 'dashed', radius: 4 }, padding: 0, imageOpacity: 1 },
    elements: [
      createElement('text', { id: 't', x: 6, y: 6, width: 208, height: 14, text: { content: VI, fontSize: 9 } }),
      createElement('text', { id: 'n', x: 6, y: 24, width: 208, height: 14, text: { content: 'Ký bởi: {{signer.name}}', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'Arial', fontSize: 9 } }),
      createElement('qr', { id: 'q', x: 180, y: 22, width: 36, height: 36 }),
      createElement('rect', { id: 'r', x: 2, y: 2, width: 20, height: 10, shape: { radius: 3, fillOpacity: 0.5, fill: '#ff0000' } }),
      createElement('line', { id: 'l', x: 6, y: 50, width: 150, height: 0 }),
      ...extra,
    ],
  });
}

async function textItems(bytes, pageNo) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const page = await doc.getPage(pageNo);
  const content = await page.getTextContent();
  return { doc, page, items: content.items.filter((i) => i.str) };
}

describe('PDF appearance rendering', () => {
  it('embeds Vietnamese text that extracts back verbatim (Unicode fonts, ToUnicode)', async () => {
    const pdf = await readSample('quyet-dinh-mau.pdf');
    const sig = { id: 's', page: 1, rect: { x: 300, y: 120, width: 220, height: 60 }, rotation: 0, opacity: 1, template: template() };
    const { bytes } = await renderAppearancesToPdf(pdf, [sig], { fontRegistry: fonts });
    const { items, doc } = await textItems(bytes, 1);
    const all = items.map((i) => i.str).join('|');
    expect(all).toContain(VI);
    expect(all).toContain('Ký bởi: Nguyễn Văn An');
    expect(all).toContain(PREVIEW_NOTICE);
    expect(doc.numPages).toBe(2);
    const meta = await doc.getMetadata();
    expect(meta.info.Subject).toBe(PREVIEW_NOTICE);
  });

  it('does not add any signature field, /ByteRange or /Sig object', async () => {
    const pdf = await readSample('quyet-dinh-mau.pdf');
    const sig = { id: 's', page: 1, rect: { x: 300, y: 120, width: 220, height: 60 }, rotation: 0, template: template() };
    const { bytes } = await renderAppearancesToPdf(pdf, [sig], { fontRegistry: fonts });
    const latin = Buffer.from(bytes).toString('latin1');
    expect(latin).not.toMatch(/\/ByteRange/);
    expect(latin).not.toMatch(/\/Type\s*\/Sig\b/);
    expect(latin).not.toMatch(/\/FT\s*\/Sig/);
  });

  it.each([
    [1, 0],
    [2, 90],
    [3, 180],
    [4, 270],
    [5, 0],
  ])('page %i (/Rotate %i): text sits inside the PDF rect and reads upright', async (pageNo, rot) => {
    const pdf = await readSample('kiem-thu-xoay-trang.pdf');
    const rect = { x: 120, y: 420, width: rot % 180 ? 60 : 220, height: rot % 180 ? 220 : 60 };
    const sig = { id: 's', page: pageNo, rect, rotation: 0, template: template() };
    const { bytes } = await renderAppearancesToPdf(pdf, [sig], { fontRegistry: fonts });
    const { items, page } = await textItems(bytes, pageNo);
    const item = items.find((i) => i.str === VI);
    expect(item, 'appearance text present').toBeTruthy();
    const [a, b, , , e, f] = item.transform; // text matrix in user space
    expect(e).toBeGreaterThanOrEqual(rect.x - 0.01);
    expect(e).toBeLessThanOrEqual(rect.x + rect.width + 0.01);
    expect(f).toBeGreaterThanOrEqual(rect.y - 0.01);
    expect(f).toBeLessThanOrEqual(rect.y + rect.height + 0.01);
    // Page /Rotate R turns content clockwise on screen, so upright text must run at R° (CCW) in user space.
    const angle = (Math.round((Math.atan2(b, a) * 180) / Math.PI) + 360) % 360;
    expect(angle).toBe(rot);
    expect(page.rotate).toBe(rot);
  });

  it('respects signature rotation (content rotated 90° on an unrotated page)', async () => {
    const pdf = await readSample('kiem-thu-xoay-trang.pdf');
    const sig = { id: 's', page: 1, rect: { x: 100, y: 300, width: 60, height: 220 }, rotation: 90, template: template() };
    const { bytes } = await renderAppearancesToPdf(pdf, [sig], { fontRegistry: fonts });
    const { items } = await textItems(bytes, 1);
    const item = items.find((i) => i.str === VI);
    const [a, b] = item.transform;
    expect(Math.round((Math.atan2(b, a) * 180) / Math.PI)).toBe(-90); // clockwise on screen
  });

  it('embeds PNG images and skips signatures on missing pages', async () => {
    const png = pngDataUrl(8, 8, (x, y) => (x + y) % 2 ? [220, 20, 20, 255] : [0, 0, 0, 0]);
    const img = createElement('image', { id: 'img', x: 0, y: 0, width: 40, height: 40, image: { src: png, naturalWidth: 8, naturalHeight: 8, fit: 'cover' } });
    const sigs = [
      { id: 'a', page: 1, rect: { x: 50, y: 50, width: 220, height: 60 }, rotation: 0, template: template([img]) },
      { id: 'b', page: 9, rect: { x: 50, y: 50, width: 220, height: 60 }, rotation: 0, template: template() },
    ];
    const { bytes, skipped } = await renderAppearancesToPdf(null, sigs, { fontRegistry: fonts });
    expect(skipped).toEqual([{ id: 'b', reason: 'Trang 9 không tồn tại' }]);
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const page = await doc.getPage(1);
    const ops = await page.getOperatorList();
    expect(ops.fnArray).toContain(pdfjs.OPS.paintImageXObject);
  });
});
