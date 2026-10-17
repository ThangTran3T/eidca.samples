/**
 * Image ingestion: validation, SVG sanitising + rasterising, normalisation to
 * PNG/JPEG data URLs (the only formats embeddable in PDFs), and pixel
 * analysis for the compliance rules. Everything stays in the browser.
 */
import DOMPurify from 'dompurify';
import { analyzePixels } from '../engines/compliance-engine/image-analysis.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif';

function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return null;
}

// Only same-document references (e.g. <textPath href="#ring">) survive; external/javascript: URLs are stripped.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if ((data.attrName === 'href' || data.attrName === 'xlink:href') && !/^#[\w-]+$/.test(data.attrValue ?? '')) data.keepAttr = false;
});

/** Sanitise untrusted SVG markup: no scripts, event handlers, foreignObject, styles or external references. */
export function sanitizeSvg(markup) {
  const clean = DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'image', 'use', 'a', 'style'],
    FORBID_ATTR: ['style'],
    ADD_ATTR: ['href'], // vetted by the hook above: only #fragment references are kept
  });
  if (!clean || !/<svg[\s>]/i.test(clean)) throw new Error('SVG không hợp lệ hoặc bị loại bỏ khi làm sạch.');
  return clean;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không giải mã được ảnh.'));
    img.src = src;
  });
}

function canvasFor(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function analyse(img, mime) {
  const k = Math.min(1, 512 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const c = canvasFor((img.naturalWidth || img.width) * k, (img.naturalHeight || img.height) * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return analyzePixels(ctx.getImageData(0, 0, c.width, c.height), mime);
}

function bytesToDataUrl(bytes, mime) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Rasterise an SVG string to PNG at a sensible resolution. */
export async function rasterizeSvg(markup, { targetLongSide = 1200 } = {}) {
  const clean = sanitizeSvg(markup);
  const blobUrl = URL.createObjectURL(new Blob([clean], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(blobUrl);
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 600;
    const k = targetLongSide / Math.max(w, h);
    const c = canvasFor(w * k, h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Normalise any accepted image (File, Blob or data URL) into
 * { src, naturalWidth, naturalHeight, analysis, fileName }.
 */
export async function processImage(input, { fileName = '' } = {}) {
  let bytes;
  let name = fileName;
  if (typeof input === 'string') {
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(input);
    if (!m) throw new Error('Dữ liệu ảnh không hợp lệ.');
    const bin = atob(m[2]);
    bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } else {
    if (input.size > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
    bytes = new Uint8Array(await input.arrayBuffer());
    name = name || input.name || '';
  }
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
  const mime = sniffMime(bytes);
  if (!mime || !ACCEPT.includes(mime)) throw new Error('Định dạng ảnh không được hỗ trợ (PNG, JPEG, WebP, GIF, SVG).');

  let src;
  if (mime === 'image/svg+xml') {
    src = await rasterizeSvg(new TextDecoder().decode(bytes));
  } else {
    src = bytesToDataUrl(bytes, mime);
  }
  let img = await loadImage(src);
  let outMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const tooBig = Math.max(img.naturalWidth, img.naturalHeight) > MAX_DIMENSION;
  if (tooBig || (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/svg+xml')) {
    const k = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const c = canvasFor(img.naturalWidth * k, img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    src = c.toDataURL(outMime, 0.92);
    img = await loadImage(src);
  }
  if (mime === 'image/svg+xml') outMime = 'image/png';
  return { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, analysis: analyse(img, outMime), fileName: name };
}

/**
 * Make near-white pixels transparent (for scanned seals/signatures) and
 * return a PNG. `tolerance` 0–100.
 */
export async function removeWhiteBackground(src, tolerance = 18) {
  const img = await loadImage(src);
  const c = canvasFor(img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const t = 255 - (tolerance / 100) * 160;
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (min >= t) d[i + 3] = 0;
    else if (min >= t - 30) d[i + 3] = Math.min(d[i + 3], Math.round(((t - min) / 30) * 255)); // soft edge
  }
  ctx.putImageData(data, 0, 0);
  return processImage(c.toDataURL('image/png'));
}

/** Image cache for canvas drawing (data URL → HTMLImageElement). */
const cache = new Map();
const listeners = new Set();
export function getCachedImage(src) {
  if (!src) return null;
  const hit = cache.get(src);
  if (hit instanceof HTMLImageElement) return hit;
  if (!hit) {
    cache.set(src, 'loading');
    loadImage(src)
      .then((img) => {
        cache.set(src, img);
        listeners.forEach((fn) => fn());
      })
      .catch(() => cache.delete(src));
  }
  return null;
}
export function onImageLoaded(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
