/**
 * Coordinate engine — the single source of truth for every conversion between
 *
 *   1. PDF user space   (points, origin bottom-left of the PDF coordinate system, y up)
 *   2. Display space    (points, origin top-left of the *visible, rotated* page, y down)
 *   3. Viewport space   (CSS pixels = display × zoom)
 *   4. Backing store    (device pixels = viewport × devicePixelRatio)
 *   5. Client/screen    (viewport + element offset on screen)
 *
 * The visible page area is the CropBox clipped to the MediaBox (exactly what
 * PDF.js calls `page.view`). Page /Rotate and an optional extra *view*
 * rotation (the user rotating the view in the editor) are both clockwise
 * multiples of 90°, as in the PDF specification.
 *
 * Canonical storage: signature rectangles are stored in PDF user space
 * (lower-left x/y, width/height), which is what signing back-ends consume.
 * Everything else is derived, so zoom, DPI and view rotation can never move a
 * signature on the physical page.
 *
 * Pure functions only — no DOM, no PDF.js — so they are fully unit-testable.
 */
import { applyToPoint, applyToRect, compose, invert, rotate, scale, translate } from './matrix.js';

export * from './matrix.js';

export const POINTS_PER_INCH = 72;
export const MM_PER_INCH = 25.4;

export function normalizeRotation(deg) {
  const n = Number(deg) || 0;
  if (n % 90 !== 0) return 0; // The PDF spec requires multiples of 90; ignore invalid values like viewers do.
  return ((n % 360) + 360) % 360;
}

function normalizeBox(box) {
  if (!Array.isArray(box) || box.length !== 4 || box.some((v) => !Number.isFinite(Number(v)))) {
    throw new Error('Invalid PDF box: expected [x0, y0, x1, y1]');
  }
  const [a, b, c, d] = box.map(Number);
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/**
 * Build normalized page geometry.
 * @param {{mediaBox:number[], cropBox?:number[], rotate?:number, userUnit?:number}} input
 */
export function createPageGeometry({ mediaBox, cropBox, rotate: rot = 0, userUnit = 1 }) {
  const media = normalizeBox(mediaBox);
  const crop = cropBox ? normalizeBox(cropBox) : media;
  // CropBox is clipped to the MediaBox (ISO 32000-1 §14.11.2).
  const view = [
    Math.max(media[0], crop[0]),
    Math.max(media[1], crop[1]),
    Math.min(media[2], crop[2]),
    Math.min(media[3], crop[3]),
  ];
  if (view[2] <= view[0] || view[3] <= view[1]) {
    throw new Error('CropBox does not intersect MediaBox');
  }
  return {
    mediaBox: media,
    cropBox: crop,
    view,
    rotate: normalizeRotation(rot),
    userUnit: Number(userUnit) > 0 ? Number(userUnit) : 1,
  };
}

/** Geometry for PDF.js's `view` array (already CropBox∩MediaBox). */
export function geometryFromPdfJsView(view, rot, userUnit = 1) {
  return createPageGeometry({ mediaBox: view, cropBox: view, rotate: rot, userUnit });
}

export function totalRotation(geom, viewRotation = 0) {
  return normalizeRotation(geom.rotate + normalizeRotation(viewRotation));
}

export function unrotatedSize(geom) {
  const [x0, y0, x1, y1] = geom.view;
  return { width: x1 - x0, height: y1 - y0 };
}

/** Size of the visible page in display points. */
export function displaySize(geom, viewRotation = 0) {
  const { width, height } = unrotatedSize(geom);
  const r = totalRotation(geom, viewRotation);
  return r === 90 || r === 270 ? { width: height, height: width } : { width, height };
}

/**
 * Matrix mapping PDF user space → display space (points, top-left origin, y down).
 * Equivalent to PDF.js `page.getViewport({ scale: 1, rotation }).transform`.
 */
export function userToDisplayMatrix(geom, viewRotation = 0) {
  const [x0, y0, x1, y1] = geom.view;
  switch (totalRotation(geom, viewRotation)) {
    case 0: //   X = x − x0,  Y = y1 − y
      return [1, 0, 0, -1, -x0, y1];
    case 90: //  X = y − y0,  Y = x − x0
      return [0, 1, 1, 0, -y0, -x0];
    case 180: // X = x1 − x,  Y = y − y0
      return [-1, 0, 0, 1, x1, -y0];
    case 270: // X = y1 − y,  Y = x1 − x
      return [0, -1, -1, 0, y1, x1];
    default:
      throw new Error('unreachable');
  }
}

export function displayToUserMatrix(geom, viewRotation = 0) {
  return invert(userToDisplayMatrix(geom, viewRotation));
}

/** PDF.js-compatible viewport transform (CSS pixels). */
export function viewportTransform(geom, zoom, viewRotation = 0) {
  return compose(userToDisplayMatrix(geom, viewRotation), scale(zoom));
}

export function pdfPointToDisplay(geom, point, viewRotation = 0) {
  return applyToPoint(userToDisplayMatrix(geom, viewRotation), point.x, point.y);
}

export function displayPointToPdf(geom, point, viewRotation = 0) {
  return applyToPoint(displayToUserMatrix(geom, viewRotation), point.x, point.y);
}

/** Axis-aligned PDF rect {x,y,width,height} (lower-left origin) → display rect (top-left origin). */
export function pdfRectToDisplay(geom, rect, viewRotation = 0) {
  return applyToRect(userToDisplayMatrix(geom, viewRotation), rect);
}

export function displayRectToPdf(geom, rect, viewRotation = 0) {
  return applyToRect(displayToUserMatrix(geom, viewRotation), rect);
}

export function displayToViewport(point, zoom) {
  return { x: point.x * zoom, y: point.y * zoom };
}

export function viewportToDisplay(point, zoom) {
  return { x: point.x / zoom, y: point.y / zoom };
}

/** Client (mouse event) coordinates → display points, given the page element's bounding rect. */
export function clientToDisplay(clientX, clientY, elementRect, zoom) {
  return viewportToDisplay({ x: clientX - elementRect.left, y: clientY - elementRect.top }, zoom);
}

/** Canvas backing-store size for crisp rendering on high-DPI screens (capped to protect memory). */
export function backingStoreSize(cssWidth, cssHeight, devicePixelRatio = 1, maxPixels = 16_777_216) {
  let ratio = Math.max(1, devicePixelRatio || 1);
  if (cssWidth * cssHeight * ratio * ratio > maxPixels) {
    ratio = Math.max(0.5, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
  }
  return { width: Math.floor(cssWidth * ratio), height: Math.floor(cssHeight * ratio), ratio };
}

export function pointsToMm(pt, userUnit = 1) {
  return (pt * userUnit * MM_PER_INCH) / POINTS_PER_INCH;
}

export function mmToPoints(mm, userUnit = 1) {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH / userUnit;
}

/**
 * Orientation of a signature's content relative to PDF user space.
 * `sigRotation` is the content rotation the user chose relative to the
 * page as viewers show it; the page /Rotate is added so content is upright
 * for readers of the rotated page.
 */
export function contentOrientation(geom, sigRotation = 0) {
  return normalizeRotation(geom.rotate + normalizeRotation(sigRotation));
}

/** Design (upright content) size of a signature given its PDF rect. */
export function designSizeForRect(geom, rect, sigRotation = 0) {
  const o = contentOrientation(geom, sigRotation);
  return o === 90 || o === 270
    ? { width: rect.height, height: rect.width }
    : { width: rect.width, height: rect.height };
}

/** PDF rect width/height for a design size. Inverse of designSizeForRect. */
export function rectSizeForDesign(geom, size, sigRotation = 0) {
  const o = contentOrientation(geom, sigRotation);
  return o === 90 || o === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * Frame of a signature in display space: where the design origin (top-left of
 * the upright content) lands and the clockwise rotation to apply to content.
 * This is what the canvas uses (Konva rotation is clockwise in y-down space).
 */
export function signatureDisplayFrame(geom, placement, viewRotation = 0) {
  const box = pdfRectToDisplay(geom, placement.rect, viewRotation);
  const rotation = normalizeRotation(normalizeRotation(placement.rotation) + normalizeRotation(viewRotation));
  const origins = {
    0: { x: box.x, y: box.y },
    90: { x: box.x + box.width, y: box.y },
    180: { x: box.x + box.width, y: box.y + box.height },
    270: { x: box.x, y: box.y + box.height },
  };
  const design = designSizeForRect(geom, placement.rect, placement.rotation);
  return { box, rotation, origin: origins[rotation], design };
}

/** Matrix mapping design space (top-left origin, y down, points) → display space. */
export function designToDisplayMatrix(geom, placement, viewRotation = 0) {
  const { rotation, origin } = signatureDisplayFrame(geom, placement, viewRotation);
  return compose(rotate(rotation), translate(origin.x, origin.y));
}

/**
 * Matrix mapping design space → PDF user space. Independent of view rotation
 * and zoom by construction; used by the PDF renderer.
 */
export function designToUserMatrix(geom, placement) {
  return compose(designToDisplayMatrix(geom, placement, 0), displayToUserMatrix(geom, 0));
}

/**
 * Create a PDF rect from a design size whose upright top-left corner should
 * appear at `displayTopLeft` (display points, view rotation applied).
 */
export function rectFromDisplayPlacement(geom, displayTopLeft, designSize, sigRotation = 0, viewRotation = 0) {
  const rotation = normalizeRotation(normalizeRotation(sigRotation) + normalizeRotation(viewRotation));
  const swap = rotation === 90 || rotation === 270;
  const displayRect = {
    x: displayTopLeft.x,
    y: displayTopLeft.y,
    width: swap ? designSize.height : designSize.width,
    height: swap ? designSize.width : designSize.height,
  };
  return displayRectToPdf(geom, displayRect, viewRotation);
}

/** Keep a PDF rect inside the visible page area. */
export function clampRectToPage(geom, rect) {
  const [x0, y0, x1, y1] = geom.view;
  const width = Math.min(rect.width, x1 - x0);
  const height = Math.min(rect.height, y1 - y0);
  return {
    x: Math.min(Math.max(rect.x, x0), x1 - width),
    y: Math.min(Math.max(rect.y, y0), y1 - height),
    width,
    height,
  };
}

export function isRectInsidePage(geom, rect, tolerance = 0.01) {
  const [x0, y0, x1, y1] = geom.view;
  return (
    rect.x >= x0 - tolerance &&
    rect.y >= y0 - tolerance &&
    rect.x + rect.width <= x1 + tolerance &&
    rect.y + rect.height <= y1 + tolerance
  );
}

export function roundRect(rect, decimals = 2) {
  const f = 10 ** decimals;
  const r = (v) => Math.round(v * f) / f;
  return { x: r(rect.x), y: r(rect.y), width: r(rect.width), height: r(rect.height) };
}
