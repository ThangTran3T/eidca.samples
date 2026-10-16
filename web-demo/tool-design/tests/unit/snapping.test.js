import { describe, it, expect } from 'vitest';
import { snapBox, snapTargets, snapValue } from '../../src/engines/coordinate-engine/snapping.js';
import { displayBoxFromFrame, signatureDisplayFrame, createPageGeometry, pdfRectToDisplay } from '../../src/engines/coordinate-engine/index.js';

describe('snapping', () => {
  const page = { x: 0, y: 0, width: 600, height: 800 };
  it('snaps edges and centres to page and sibling lines and reports guides', () => {
    const t = snapTargets(page, [{ x: 100, y: 100, width: 50, height: 50 }]);
    const r = snapBox({ x: 97, y: 396, width: 20, height: 10 }, t, { threshold: 5 });
    expect(r.x).toBe(100); // left edge → sibling left edge
    expect(r.y).toBe(395); // centre (401) → page centre (400)
    expect(r.guides).toEqual([{ axis: 'x', at: 100 }, { axis: 'y', at: 400 }]);
  });
  it('falls back to the grid when no guide is within the threshold', () => {
    const r = snapBox({ x: 233, y: 517, width: 20, height: 10 }, snapTargets(page), { threshold: 2, grid: 10 });
    expect(r).toEqual({ x: 230, y: 520, guides: [] });
    expect(snapValue(14, 5)).toBe(15);
    expect(snapValue(14, 0)).toBe(14);
  });
});

describe('displayBoxFromFrame', () => {
  it.each([0, 90, 180, 270])('inverts signatureDisplayFrame at rotation %i', (rot) => {
    for (const pageRot of [0, 90]) {
      const g = createPageGeometry({ mediaBox: [0, 0, 595, 842], rotate: pageRot });
      const placement = { rect: { x: 100, y: 200, width: 160, height: 80 }, rotation: rot };
      const f = signatureDisplayFrame(g, placement, 90);
      expect(displayBoxFromFrame(f.origin, f.rotation, f.design)).toEqual(pdfRectToDisplay(g, placement.rect, 90));
    }
  });
});
