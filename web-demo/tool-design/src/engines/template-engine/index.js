/**
 * Template engine: resolves a template + data into a renderer-agnostic
 * "render model" (absolute geometry, final text lines, visibility, QR
 * modules). Canvas, SVG/PNG and PDF renderers all consume this model.
 */
import QRCode from 'qrcode';
import { buildVariableContext, interpolate } from './variables.js';
import { evaluateCondition } from './conditions.js';
import { layoutText } from '../rendering-engine/text-layout.js';
import { normalizedMetrics } from '../rendering-engine/fonts.js';

export * from './constants.js';
export * from './variables.js';
export * from './conditions.js';
export * from './constraints.js';
export * from './factory.js';
export * from './datetime.js';

/** Display modes: placeholders ({{…}}), template sample data, or runtime data supplied by the user. */
export const DISPLAY_MODES = { placeholder: 'Biến', sample: 'Dữ liệu mẫu', runtime: 'Dữ liệu thực tế' };

/** Apply text-transform without touching {{placeholders}} (they must stay readable in design mode). */
function transformCase(text, mode) {
  if (mode !== 'uppercase' && mode !== 'lowercase') return text;
  return text
    .split(/({{[^}]*}})/)
    .map((part, i) => (i % 2 === 1 ? part : mode === 'uppercase' ? part.toLocaleUpperCase('vi-VN') : part.toLocaleLowerCase('vi-VN')))
    .join('');
}

const qrCache = new Map();
export function qrModules(content, errorCorrection = 'M') {
  const key = `${errorCorrection}|${content}`;
  if (qrCache.has(key)) return qrCache.get(key);
  let result = null;
  if (content) {
    try {
      const qr = QRCode.create(content, { errorCorrectionLevel: errorCorrection });
      result = { size: qr.modules.size, data: Array.from(qr.modules.data, Boolean) };
    } catch {
      result = null; // content too long for a QR code
    }
  }
  if (qrCache.size > 200) qrCache.clear();
  qrCache.set(key, result);
  return result;
}

/** Compute where an image is drawn inside its element box for a fit mode. */
export function imageDrawRect(fit, boxW, boxH, natW, natH) {
  if (fit === 'stretch' || !natW || !natH) return { x: 0, y: 0, width: boxW, height: boxH, clip: false };
  const k = fit === 'cover' ? Math.max(boxW / natW, boxH / natH) : Math.min(boxW / natW, boxH / natH);
  const width = natW * k;
  const height = natH * k;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height, clip: fit === 'cover' };
}

export function dataForMode(template, mode, runtimeData) {
  if (mode === 'runtime') return runtimeData ?? {};
  return template.sampleData ?? {};
}

/**
 * @param {object} template
 * @param {{ mode?: 'placeholder'|'sample'|'runtime', runtimeData?: object, measure: Function }} opts
 *   measure(text, {family, weight, style, size}) → width in points
 */
export function resolveTemplate(template, { mode = 'sample', runtimeData, measure }) {
  const ctx = buildVariableContext(dataForMode(template, mode, runtimeData), template.dateTime);
  const imageOpacity = template.style?.imageOpacity ?? 1;
  const items = [];
  for (const el of template.elements) {
    // Conditions are evaluated with real data; in placeholder mode everything stays visible for editing.
    const conditionOk = mode === 'placeholder' ? true : evaluateCondition(el.condition, ctx);
    const visible = el.visible !== false && conditionOk;
    const item = {
      id: el.id,
      type: el.type,
      role: el.role,
      name: el.name,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation || 0,
      opacity: el.opacity ?? 1,
      visible,
      hiddenByCondition: el.visible !== false && !conditionOk,
    };
    if (el.type === 'text') {
      const t = el.text;
      const font = { family: t.fontFamily, weight: t.fontWeight, style: t.fontStyle, size: t.fontSize };
      const content = transformCase(interpolate(t.content, ctx, { mode: mode === 'placeholder' ? 'placeholder' : 'data', hideEmptyLines: t.hideEmptyLines }), t.textTransform);
      const metrics = normalizedMetrics(t.fontFamily);
      const layout = layoutText({
        text: content,
        width: el.width,
        height: el.height,
        fontSize: t.fontSize,
        lineHeight: t.lineHeight,
        align: t.align,
        verticalAlign: t.verticalAlign,
        wrap: t.wrap,
        measure: (s) => measure(s, font),
        ...metrics,
      });
      item.text = { content, font, color: t.color, lines: layout.lines, overflow: layout.overflow, empty: content.trim() === '' };
    } else if (el.type === 'image') {
      const im = el.image;
      item.opacity *= imageOpacity;
      item.image = { src: im.src, fit: im.fit, draw: imageDrawRect(im.fit, el.width, el.height, im.naturalWidth, im.naturalHeight), missing: !im.src };
    } else if (el.type === 'qr') {
      // A QR code cannot show "{{…}}" meaningfully, so placeholder mode encodes the sample data.
      const qrCtx = mode === 'placeholder' ? buildVariableContext(template.sampleData, template.dateTime) : ctx;
      const content = interpolate(el.qr.content, qrCtx);
      item.qr = { content, modules: qrModules(content, el.qr.errorCorrection), color: el.qr.color, background: el.qr.background, transparentBackground: el.qr.transparentBackground };
    } else if (el.type === 'rect') {
      item.shape = { ...el.shape };
    } else if (el.type === 'line') {
      item.line = { ...el.line };
    }
    items.push(item);
  }
  return {
    width: template.size.width,
    height: template.size.height,
    style: template.style,
    items,
    context: ctx,
  };
}
