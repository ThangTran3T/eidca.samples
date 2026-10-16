/**
 * SVG renderer for the render model. Text is emitted as <text> with
 * pre-computed line positions (same layout as canvas/PDF) and all user data
 * is XML-escaped. Images are inlined as data URLs (PNG/JPEG only — never
 * user SVG markup).
 */
import { familyInfo } from './fonts.js';

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip control characters that are illegal in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const n = (v) => (Math.round(v * 1000) / 1000).toString();

function roundRectAttrs(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  return `x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rr ? ` rx="${n(rr)}"` : ''}`;
}

function itemSvg(item, idx) {
  const { width: w, height: h } = item;
  switch (item.type) {
    case 'text': {
      const t = item.text;
      const f = familyInfo(t.font.family);
      const family = `'${f.label}', '${f.substitute}', ${f.fallbackCss.split(',').pop().trim()}`;
      const tspans = t.lines
        .filter((l) => l.text)
        .map((l) => `<tspan x="${n(l.x)}" y="${n(l.baseline)}">${escapeXml(l.text)}</tspan>`)
        .join('');
      return `<text font-family="${escapeXml(family)}" font-size="${n(t.font.size)}" font-weight="${t.font.weight === 'bold' ? 'bold' : 'normal'}" font-style="${t.font.style === 'italic' ? 'italic' : 'normal'}" fill="${t.color}" xml:space="preserve">${tspans}</text>`;
    }
    case 'image': {
      const src = item.image.src;
      if (!src || !/^data:image\/(png|jpeg);base64,/.test(src)) return '';
      const d = item.image.draw;
      const clipId = `clip${idx}`;
      const clip = d.clip ? `<clipPath id="${clipId}"><rect x="0" y="0" width="${n(w)}" height="${n(h)}"/></clipPath>` : '';
      return `${clip}<image href="${src}" x="${n(d.x)}" y="${n(d.y)}" width="${n(d.width)}" height="${n(d.height)}" preserveAspectRatio="none"${d.clip ? ` clip-path="url(#${clipId})"` : ''}/>`;
    }
    case 'qr': {
      const q = item.qr;
      const side = Math.min(w, h);
      const ox = (w - side) / 2;
      const oy = (h - side) / 2;
      let out = q.transparentBackground ? '' : `<rect x="${n(ox)}" y="${n(oy)}" width="${n(side)}" height="${n(side)}" fill="${q.background}"/>`;
      if (q.modules) {
        const size = q.modules.size;
        const cell = side / (size + 2);
        let d = '';
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (q.modules.data[r * size + c]) d += `M${n(ox + (c + 1) * cell)} ${n(oy + (r + 1) * cell)}h${n(cell)}v${n(cell)}h${n(-cell)}z`;
        out += `<path d="${d}" fill="${q.color}" shape-rendering="crispEdges"/>`;
      }
      return out;
    }
    case 'rect': {
      const s = item.shape;
      const dash = s.dashed ? ` stroke-dasharray="${n(s.strokeWidth * 3)} ${n(s.strokeWidth * 2)}"` : '';
      return `<rect ${roundRectAttrs(0, 0, w, h, s.radius)} fill="${s.fill}" fill-opacity="${n(s.fillOpacity)}" stroke="${s.strokeWidth > 0 ? s.stroke : 'none'}" stroke-width="${n(s.strokeWidth)}"${dash}/>`;
    }
    case 'line': {
      const l = item.line;
      const dash = l.dashed ? ` stroke-dasharray="${n(l.strokeWidth * 3)} ${n(l.strokeWidth * 2)}"` : '';
      return `<line x1="0" y1="0" x2="${n(w)}" y2="${n(h)}" stroke="${l.stroke}" stroke-width="${n(l.strokeWidth)}"${dash}/>`;
    }
    default:
      return '';
  }
}

/** Serialize a render model to a standalone SVG document (units: pt). */
export function modelToSvg(model, { opacity = 1, title = 'Hình thức chữ ký' } = {}) {
  const { width: W, height: H } = model;
  const { background, border } = model.style ?? {};
  const parts = [];
  if (background && background.opacity > 0) {
    parts.push(`<rect ${roundRectAttrs(0, 0, W, H, border?.radius)} fill="${background.color}" fill-opacity="${n(background.opacity)}"/>`);
  }
  if (border && border.width > 0) {
    const half = border.width / 2;
    const dash = border.style === 'dashed' ? ` stroke-dasharray="${n(border.width * 3)} ${n(border.width * 2)}"` : '';
    parts.push(`<rect ${roundRectAttrs(half, half, W - border.width, H - border.width, border.radius)} fill="none" stroke="${border.color}" stroke-width="${n(border.width)}"${dash}/>`);
  }
  model.items.forEach((item, i) => {
    if (!item.visible) return;
    const body = itemSvg(item, i);
    if (!body) return;
    const rot = item.rotation ? ` rotate(${n(item.rotation)})` : '';
    parts.push(`<g transform="translate(${n(item.x)} ${n(item.y)})${rot}" opacity="${n(item.opacity)}">${body}</g>`);
  });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}pt" height="${n(H)}pt" viewBox="0 0 ${n(W)} ${n(H)}">` +
    `<title>${escapeXml(title)}</title>` +
    // Clip to the signature box, consistent with canvas and PDF output.
    `<clipPath id="box"><rect x="0" y="0" width="${n(W)}" height="${n(H)}"/></clipPath>` +
    `<g opacity="${n(opacity)}" clip-path="url(#box)">${parts.join('')}</g></svg>\n`
  );
}
