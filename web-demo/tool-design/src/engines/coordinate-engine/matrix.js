/**
 * 2D affine matrices using the PDF convention [a, b, c, d, e, f]:
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 * `multiply(m1, m2)` returns the matrix that applies m2 FIRST, then m1
 * (i.e. m1 ∘ m2), matching how transforms are composed in PDF content streams
 * when read right-to-left.
 */

export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

export function multiply(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/** Compose left-to-right in "apply order": compose(A, B, C) applies A, then B, then C. */
export function compose(...ms) {
  return ms.reduce((acc, m) => multiply(m, acc), IDENTITY);
}

export function translate(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

export function scale(sx, sy = sx) {
  return [sx, 0, 0, sy, 0, 0];
}

/** Rotation by `deg` degrees, counter-clockwise in a y-up system (clockwise in y-down). */
export function rotate(deg) {
  const r = (deg * Math.PI) / 180;
  const cos = cleanTrig(Math.cos(r));
  const sin = cleanTrig(Math.sin(r));
  return [cos, sin, -sin, cos, 0, 0];
}

export function invert(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) throw new Error('Matrix is not invertible');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function applyToPoint(m, x, y) {
  const [a, b, c, d, e, f] = m;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

/** Axis-aligned bounding box of a rect transformed by m. */
export function applyToRect(m, rect) {
  const pts = [
    applyToPoint(m, rect.x, rect.y),
    applyToPoint(m, rect.x + rect.width, rect.y),
    applyToPoint(m, rect.x, rect.y + rect.height),
    applyToPoint(m, rect.x + rect.width, rect.y + rect.height),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// Avoid 6.123e-17 artefacts for right angles so that results stay exact.
function cleanTrig(v) {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-12 ? r : v;
}
