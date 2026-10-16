import { describe, it, expect } from 'vitest';
import {
  createPageGeometry,
  normalizeRotation,
  displaySize,
  userToDisplayMatrix,
  pdfPointToDisplay,
  displayPointToPdf,
  pdfRectToDisplay,
  displayRectToPdf,
  viewportTransform,
  displayToViewport,
  viewportToDisplay,
  clientToDisplay,
  backingStoreSize,
  designToUserMatrix,
  designToDisplayMatrix,
  signatureDisplayFrame,
  designSizeForRect,
  rectFromDisplayPlacement,
  clampRectToPage,
  pointsToMm,
  mmToPoints,
  applyToPoint,
  compose,
  invert,
  rotate,
  translate,
  multiply,
} from '../../src/engines/coordinate-engine/index.js';

const A4 = [0, 0, 595.28, 841.89];
const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const closePt = (p, q, eps = 1e-9) => {
  close(p.x, q.x, eps);
  close(p.y, q.y, eps);
};
const closeRect = (r, s, eps = 1e-9) => {
  close(r.x, s.x, eps);
  close(r.y, s.y, eps);
  close(r.width, s.width, eps);
  close(r.height, s.height, eps);
};

describe('matrix helpers', () => {
  it('compose applies transforms left-to-right', () => {
    const m = compose(translate(10, 0), rotate(90));
    // translate first: (0,0) → (10,0); then rotate 90° (clockwise in y-down) → (0,10)
    closePt(applyToPoint(m, 0, 0), { x: 0, y: 10 });
  });
  it('invert(m) ∘ m = identity', () => {
    const m = compose(rotate(30), translate(5, -7), [2, 0, 0, 3, 1, 1]);
    const id = multiply(invert(m), m);
    [1, 0, 0, 1, 0, 0].forEach((v, i) => close(id[i], v, 1e-12));
  });
  it('right-angle rotations are exact', () => {
    expect(rotate(90)).toEqual([0, 1, -1, 0, 0, 0]);
  });
});

describe('page geometry', () => {
  it('normalizes rotation values', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(undefined)).toBe(0);
  });
  it('clips CropBox to MediaBox and normalizes inverted boxes', () => {
    const g = createPageGeometry({ mediaBox: [0, 0, 600, 800], cropBox: [700, 900, 50, 40] });
    expect(g.view).toEqual([50, 40, 600, 800]);
  });
  it('rejects malformed and non-intersecting boxes', () => {
    expect(() => createPageGeometry({ mediaBox: [0, 0, 'x', 1] })).toThrow();
    expect(() => createPageGeometry({ mediaBox: [0, 0, 10, 10], cropBox: [20, 20, 30, 30] })).toThrow();
  });
  it('swaps display size for 90/270 rotation (page or view)', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 90 });
    expect(displaySize(g)).toEqual({ width: 841.89, height: 595.28 });
    expect(displaySize(g, 90)).toEqual({ width: 595.28, height: 841.89 });
  });
});

describe('PDF ↔ display conversion', () => {
  it('flips the y axis for unrotated pages (bottom-left → top-left origin)', () => {
    const g = createPageGeometry({ mediaBox: A4 });
    closePt(pdfPointToDisplay(g, { x: 0, y: 0 }), { x: 0, y: 841.89 });
    closePt(pdfPointToDisplay(g, { x: 0, y: 841.89 }), { x: 0, y: 0 });
  });

  it('honours a CropBox offset (display origin = CropBox top-left)', () => {
    const g = createPageGeometry({ mediaBox: [0, 0, 612, 792], cropBox: [36, 36, 576, 756] });
    closePt(pdfPointToDisplay(g, { x: 36, y: 756 }), { x: 0, y: 0 });
    closePt(pdfPointToDisplay(g, { x: 576, y: 36 }), { x: 540, y: 720 });
  });

  it.each([0, 90, 180, 270])('maps the visible page corners onto the display rect at /Rotate %i', (r) => {
    const g = createPageGeometry({ mediaBox: [10, 20, 310, 420], rotate: r });
    const size = displaySize(g);
    const m = userToDisplayMatrix(g);
    const corners = [
      [10, 20],
      [310, 20],
      [10, 420],
      [310, 420],
    ].map(([x, y]) => applyToPoint(m, x, y));
    const xs = corners.map((p) => p.x).sort((a, b) => a - b);
    const ys = corners.map((p) => p.y).sort((a, b) => a - b);
    close(xs[0], 0);
    close(ys[0], 0);
    close(xs[3], size.width);
    close(ys[3], size.height);
  });

  it('rotates clockwise: the PDF top-left corner goes to the display top-right at 90°', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 90 });
    closePt(pdfPointToDisplay(g, { x: 0, y: 841.89 }), { x: 841.89, y: 0 });
  });

  it.each([0, 90, 180, 270])('round-trips points and rects at rotation %i', (r) => {
    const g = createPageGeometry({ mediaBox: [0, 0, 612, 792], cropBox: [20, 30, 600, 780], rotate: r });
    const p = { x: 123.4, y: 567.8 };
    closePt(displayPointToPdf(g, pdfPointToDisplay(g, p)), p);
    const rect = { x: 47, y: 693 - 400, width: 167, height: 95 };
    closeRect(displayRectToPdf(g, pdfRectToDisplay(g, rect)), rect);
    // also with an additional view rotation
    closeRect(displayRectToPdf(g, pdfRectToDisplay(g, rect, 270), 270), rect);
  });

  it('matches the VNeCA sample: lLx=47,lLy=693 on A4 portrait is near the top-left', () => {
    const g = createPageGeometry({ mediaBox: A4 });
    const d = pdfRectToDisplay(g, { x: 47, y: 693, width: 167, height: 95 });
    closeRect(d, { x: 47, y: 841.89 - 693 - 95, width: 167, height: 95 }, 1e-9);
  });
});

describe('zoom, viewport and high-DPI independence', () => {
  it('viewport transform equals display transform scaled by zoom', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 270 });
    const p = { x: 100, y: 200 };
    for (const zoom of [0.25, 1, 1.5, 4]) {
      const v = applyToPoint(viewportTransform(g, zoom), p.x, p.y);
      closePt(viewportToDisplay(v, zoom), pdfPointToDisplay(g, p));
    }
  });

  it('a pointer position maps to the same PDF point at every zoom level', () => {
    const g = createPageGeometry({ mediaBox: A4 });
    const pdfPoint = { x: 300, y: 400 };
    const elementRect = { left: 120, top: 80 };
    for (const zoom of [0.25, 0.5, 1, 2, 3, 4]) {
      const viewport = displayToViewport(pdfPointToDisplay(g, pdfPoint), zoom);
      const client = { x: viewport.x + elementRect.left, y: viewport.y + elementRect.top };
      const back = displayPointToPdf(g, clientToDisplay(client.x, client.y, elementRect, zoom));
      closePt(back, pdfPoint, 1e-9);
    }
  });

  it('backing store scales with devicePixelRatio and is capped for memory', () => {
    expect(backingStoreSize(100, 50, 2)).toEqual({ width: 200, height: 100, ratio: 2 });
    const big = backingStoreSize(4000, 4000, 3, 16_000_000);
    expect(big.width * big.height).toBeLessThanOrEqual(16_000_000);
  });
});

describe('signature frames', () => {
  const placement = { rect: { x: 100, y: 200, width: 160, height: 80 }, rotation: 0 };

  it('design size swaps on rotated pages so content stays upright', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 90 });
    expect(designSizeForRect(g, placement.rect, 0)).toEqual({ width: 80, height: 160 });
  });

  it.each([0, 90, 180, 270])('design→user matrix maps the design box exactly onto the PDF rect (page /Rotate %i)', (pr) => {
    for (const sr of [0, 90, 180, 270]) {
      const g = createPageGeometry({ mediaBox: [0, 0, 612, 792], cropBox: [10, 15, 600, 780], rotate: pr });
      const p = { ...placement, rotation: sr };
      const { design } = signatureDisplayFrame(g, p);
      const m = designToUserMatrix(g, p);
      const corners = [
        [0, 0],
        [design.width, 0],
        [0, design.height],
        [design.width, design.height],
      ].map(([u, v]) => applyToPoint(m, u, v));
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      close(Math.min(...xs), 100, 1e-9);
      close(Math.max(...xs), 260, 1e-9);
      close(Math.min(...ys), 200, 1e-9);
      close(Math.max(...ys), 280, 1e-9);
    }
  });

  it('upright content: the design top edge points to the page top on an unrotated page', () => {
    const g = createPageGeometry({ mediaBox: A4 });
    const m = designToUserMatrix(g, placement);
    closePt(applyToPoint(m, 0, 0), { x: 100, y: 280 }); // design top-left = PDF upper-left
    closePt(applyToPoint(m, 0, 80), { x: 100, y: 200 });
  });

  it('upright content on a /Rotate 90 page: design "up" points to the display top', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 90 });
    const toDisplay = designToDisplayMatrix(g, placement);
    const topLeft = applyToPoint(toDisplay, 0, 0);
    const bottomLeft = applyToPoint(toDisplay, 0, 10);
    expect(bottomLeft.y).toBeGreaterThan(topLeft.y); // y grows downwards on screen → upright
    close(bottomLeft.x, topLeft.x);
  });

  it('view rotation never changes the PDF location of the design', () => {
    const g = createPageGeometry({ mediaBox: A4, rotate: 90 });
    const base = designToUserMatrix(g, placement);
    for (const vr of [90, 180, 270]) {
      const viaView = compose(designToDisplayMatrix(g, placement, vr), invert(userToDisplayMatrix(g, vr)));
      base.forEach((v, i) => close(viaView[i], v, 1e-9));
    }
  });

  it('rectFromDisplayPlacement is the inverse of the display frame', () => {
    for (const pr of [0, 90, 180, 270]) {
      for (const vr of [0, 90]) {
        const g = createPageGeometry({ mediaBox: A4, rotate: pr });
        const design = { width: 170, height: 90 };
        const rect = rectFromDisplayPlacement(g, { x: 50, y: 60 }, design, 0, vr);
        const frame = signatureDisplayFrame(g, { rect, rotation: 0 }, vr);
        close(frame.box.x, 50, 1e-9);
        close(frame.box.y, 60, 1e-9);
        close(frame.design.width, 170, 1e-9);
        close(frame.design.height, 90, 1e-9);
      }
    }
  });

  it('clamps rectangles into the visible page area', () => {
    const g = createPageGeometry({ mediaBox: [0, 0, 612, 792], cropBox: [36, 36, 576, 756] });
    expect(clampRectToPage(g, { x: -50, y: 900, width: 100, height: 50 })).toEqual({ x: 36, y: 706, width: 100, height: 50 });
  });

  it('converts points and millimetres (incl. UserUnit)', () => {
    close(pointsToMm(72), 25.4);
    close(mmToPoints(40), 113.38582677165354);
    close(pointsToMm(72, 2), 50.8);
  });
});
