/**
 * Cross-checks the coordinate engine against PDF.js itself on real PDFs
 * (rotated pages, CropBox offset, multipage) — this is the renderer the
 * editor uses, so agreement here means on-screen placement is exact.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  geometryFromPdfJsView,
  viewportTransform,
  displaySize,
  pdfRectToDisplay,
} from '../../src/engines/coordinate-engine/index.js';

async function open(file) {
  const data = new Uint8Array(await readFile(new URL(`../../public/samples/${file}`, import.meta.url)));
  return pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false }).promise;
}

describe('coordinate engine ≡ PDF.js viewport', () => {
  let doc;
  beforeAll(async () => {
    doc = await open('kiem-thu-xoay-trang.pdf');
  });

  it('loads the multipage rotation fixture', () => {
    expect(doc.numPages).toBe(5);
  });

  it.each([1, 2, 3, 4, 5])('page %i: transform and size match PDF.js for all zooms and view rotations', async (n) => {
    const page = await doc.getPage(n);
    const geom = geometryFromPdfJsView(page.view, page.rotate, page.userUnit);
    for (const zoom of [0.25, 1, 1.75, 4]) {
      for (const extra of [0, 90, 180, 270]) {
        const vp = page.getViewport({ scale: zoom, rotation: (page.rotate + extra) % 360 });
        const ours = viewportTransform(geom, zoom, extra);
        ours.forEach((v, i) => expect(v).toBeCloseTo(vp.transform[i], 9));
        const size = displaySize(geom, extra);
        expect(size.width * zoom).toBeCloseTo(vp.width, 6);
        expect(size.height * zoom).toBeCloseTo(vp.height, 6);
      }
    }
  });

  it('reports the page rotations and CropBox written by the generator', async () => {
    const rotations = [];
    for (let n = 1; n <= 5; n++) rotations.push((await doc.getPage(n)).rotate);
    expect(rotations).toEqual([0, 90, 180, 270, 0]);
    const p5 = await doc.getPage(5);
    expect(p5.view.map((v) => Math.round(v * 100) / 100)).toEqual([36, 36, 559.28, 805.89]);
  });

  it('a PDF rect lands at the same viewport pixels as PDF.js convertToViewportPoint', async () => {
    const rect = { x: 47, y: 393, width: 167, height: 95 };
    for (let n = 1; n <= 5; n++) {
      const page = await doc.getPage(n);
      const geom = geometryFromPdfJsView(page.view, page.rotate);
      const vp = page.getViewport({ scale: 2, rotation: page.rotate });
      const [x1, y1] = vp.convertToViewportPoint(rect.x, rect.y);
      const [x2, y2] = vp.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height);
      const d = pdfRectToDisplay(geom, rect);
      expect(d.x * 2).toBeCloseTo(Math.min(x1, x2), 9);
      expect(d.y * 2).toBeCloseTo(Math.min(y1, y2), 9);
      expect(d.width * 2).toBeCloseTo(Math.abs(x2 - x1), 9);
      expect(d.height * 2).toBeCloseTo(Math.abs(y2 - y1), 9);
    }
  });
});
