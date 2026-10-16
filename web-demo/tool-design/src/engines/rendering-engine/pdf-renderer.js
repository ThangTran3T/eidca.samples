/**
 * Renders signature *appearances* into a PDF with pdf-lib (vector text with
 * embedded Unicode fonts, images, shapes, QR codes).
 *
 * IMPORTANT: this produces a visual preview only. No signature dictionary,
 * no /ByteRange, no CMS — the output is NOT a digitally signed document and
 * every page carrying an appearance is stamped with a notice saying so.
 */
import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rectangle,
  clip,
  endPath,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  createPageGeometry,
  designToUserMatrix,
  rectFromDisplayPlacement,
  compose,
  scale as scaleM,
  translate,
  rotate,
} from '../coordinate-engine/index.js';
import { resolveTemplate } from '../template-engine/index.js';
import { variantKey } from './fonts.js';

export const PREVIEW_NOTICE = 'Đây là bản xem trước hình thức chữ ký, chưa phải tài liệu được ký số hợp lệ.';

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  const v = m ? parseInt(m[1], 16) : 0;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

export function dataUrlToBytes(dataUrl) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl ?? '');
  if (!m || !m[2]) return null;
  const bin = atob(m[3]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes: out };
}

function geometryOf(page) {
  const mb = page.getMediaBox();
  const cb = page.getCropBox();
  return createPageGeometry({
    mediaBox: [mb.x, mb.y, mb.x + mb.width, mb.y + mb.height],
    cropBox: [cb.x, cb.y, cb.x + cb.width, cb.y + cb.height],
    rotate: page.getRotation().angle,
  });
}

function roundRectSvgPath(w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  if (!rr) return `M0 0 H${w} V${h} H0 Z`;
  return `M${rr} 0 H${w - rr} A${rr} ${rr} 0 0 1 ${w} ${rr} V${h - rr} A${rr} ${rr} 0 0 1 ${w - rr} ${h} H${rr} A${rr} ${rr} 0 0 1 0 ${h - rr} V${rr} A${rr} ${rr} 0 0 1 ${rr} 0 Z`;
}

function makeResourceCache(pdfDoc, fontRegistry) {
  const fonts = new Map();
  const images = new Map();
  return {
    async font(f) {
      const key = `${f.family}|${variantKey(f.weight, f.style)}`;
      if (!fonts.has(key)) {
        await fontRegistry.ensure(f.family, f.weight, f.style);
        const bytes = fontRegistry.getBytes(f.family, f.weight, f.style);
        fonts.set(key, await pdfDoc.embedFont(bytes, { subset: true }));
      }
      return fonts.get(key);
    },
    async image(src) {
      if (!images.has(src)) {
        const parsed = dataUrlToBytes(src);
        let img = null;
        if (parsed?.mime === 'image/png') img = await pdfDoc.embedPng(parsed.bytes);
        else if (parsed?.mime === 'image/jpeg') img = await pdfDoc.embedJpg(parsed.bytes);
        images.set(src, img);
      }
      return images.get(src);
    },
  };
}

/** Draw one resolved render model onto `page` at `placement` (PDF rect + rotation). */
export async function drawModelOnPage(page, model, placement, resources, { opacity = 1 } = {}) {
  const geom = geometryOf(page);
  const M = designToUserMatrix(geom, placement);
  // Local drawing space: y-up, origin at design top-left (see ARCHITECTURE.md §Coordinates).
  const local = compose(scaleM(1, -1), M);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...local));
  // Clip to the signature box, like the appearance stream BBox of a real signature widget.
  page.pushOperators(rectangle(0, -model.height, model.width, model.height), clip(), endPath());

  const { background, border } = model.style ?? {};
  const W = model.width;
  const H = model.height;
  if (background && background.opacity > 0) {
    page.drawSvgPath(roundRectSvgPath(W, H, border?.radius), { x: 0, y: 0, color: hexToRgb(background.color), opacity: background.opacity * opacity, borderWidth: 0 });
  }
  if (border && border.width > 0) {
    const half = border.width / 2;
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(1, 0, 0, 1, half, -half));
    page.drawSvgPath(roundRectSvgPath(W - border.width, H - border.width, border.radius), {
      x: 0,
      y: 0,
      borderColor: hexToRgb(border.color),
      borderWidth: border.width,
      borderOpacity: opacity,
      borderDashArray: border.style === 'dashed' ? [border.width * 3, border.width * 2] : undefined,
    });
    page.pushOperators(popGraphicsState());
  }

  for (const item of model.items) {
    if (!item.visible) continue;
    const a = item.opacity * opacity;
    const el = compose(rotate(-(item.rotation || 0)), translate(item.x, -item.y));
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...el));
    const w = item.width;
    const h = item.height;
    switch (item.type) {
      case 'text': {
        const font = await resources.font(item.text.font);
        for (const line of item.text.lines) {
          if (!line.text) continue;
          page.drawText(line.text, { x: line.x, y: -line.baseline, size: item.text.font.size, font, color: hexToRgb(item.text.color), opacity: a });
        }
        break;
      }
      case 'image': {
        if (!item.image.src) break;
        const img = await resources.image(item.image.src);
        if (!img) break;
        const d = item.image.draw;
        if (d.clip) page.pushOperators(pushGraphicsState(), rectangle(0, -h, w, h), clip(), endPath());
        page.drawImage(img, { x: d.x, y: -(d.y + d.height), width: d.width, height: d.height, opacity: a });
        if (d.clip) page.pushOperators(popGraphicsState());
        break;
      }
      case 'qr': {
        const q = item.qr;
        const side = Math.min(w, h);
        const ox = (w - side) / 2;
        const oy = (h - side) / 2;
        if (!q.transparentBackground) page.drawRectangle({ x: ox, y: -(oy + side), width: side, height: side, color: hexToRgb(q.background), opacity: a, borderWidth: 0 });
        if (q.modules) {
          const n = q.modules.size;
          const cell = side / (n + 2);
          let d = '';
          for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++) if (q.modules.data[r * n + c]) d += `M${ox + (c + 1) * cell} ${oy + (r + 1) * cell}h${cell}v${cell}h${-cell}z`;
          if (d) page.drawSvgPath(d, { x: 0, y: 0, color: hexToRgb(q.color), opacity: a, borderWidth: 0 });
        }
        break;
      }
      case 'rect': {
        const s = item.shape;
        page.drawSvgPath(roundRectSvgPath(w, h, s.radius), {
          x: 0,
          y: 0,
          color: s.fillOpacity > 0 ? hexToRgb(s.fill) : undefined,
          opacity: s.fillOpacity * a,
          borderColor: s.strokeWidth > 0 ? hexToRgb(s.stroke) : undefined,
          borderWidth: s.strokeWidth,
          borderOpacity: a,
          borderDashArray: s.dashed ? [s.strokeWidth * 3, s.strokeWidth * 2] : undefined,
        });
        break;
      }
      case 'line': {
        const l = item.line;
        page.drawLine({ start: { x: 0, y: 0 }, end: { x: w, y: -h }, thickness: l.strokeWidth, color: hexToRgb(l.stroke), opacity: a, dashArray: l.dashed ? [l.strokeWidth * 3, l.strokeWidth * 2] : undefined });
        break;
      }
      default:
        break;
    }
    page.pushOperators(popGraphicsState());
  }
  page.pushOperators(popGraphicsState());
}

/** Stamp the "preview only" notice at the top of the visible page area, upright for the reader. */
async function stampNotice(page, resources) {
  const geom = geometryOf(page);
  const font = await resources.font({ family: 'Arial', weight: 'bold', style: 'normal', size: 7 });
  const size = 7;
  const text = PREVIEW_NOTICE;
  const tw = font.widthOfTextAtSize(text, size);
  const disp = geom.rotate === 90 || geom.rotate === 270;
  const visW = disp ? geom.view[3] - geom.view[1] : geom.view[2] - geom.view[0];
  const bandW = Math.min(visW - 8, tw + 10);
  // A tiny render model placed with the same maths as signatures, so it is upright on rotated pages.
  const design = { width: bandW, height: 12 };
  const placement = { rect: rectFromDisplayPlacement(geom, { x: (visW - bandW) / 2, y: 3 }, design, 0, 0), rotation: 0 };
  const model = {
    width: design.width,
    height: design.height,
    style: { background: { color: '#fff1f2', opacity: 0.92 }, border: { width: 0.6, color: '#e11d48', style: 'solid', radius: 2 } },
    items: [
      {
        type: 'text',
        visible: true,
        x: 5,
        y: 0,
        width: bandW - 10,
        height: 12,
        rotation: 0,
        opacity: 1,
        text: { font: { family: 'Arial', weight: 'bold', style: 'normal', size }, color: '#be123c', lines: [{ text, x: 0, baseline: 8.4 }] },
      },
    ],
  };
  await drawModelOnPage(page, model, placement, resources);
}

/**
 * @param {Uint8Array|null} pdfBytes existing PDF; when null a blank A4 document is created
 * @param {object[]} signatures designer signatures ({page, rect, rotation, opacity, visible, template})
 * @param {{ fontRegistry, mode?: string, runtimeData?: object, stampNotice?: boolean }} opts
 */
export async function renderAppearancesToPdf(pdfBytes, signatures, { fontRegistry, mode = 'sample', runtimeData, stampNotice: stamp = true, title } = {}) {
  const pdfDoc = pdfBytes ? await PDFDocument.load(pdfBytes, { ignoreEncryption: false, updateMetadata: false }) : await PDFDocument.create();
  if (!pdfBytes) pdfDoc.addPage([595.28, 841.89]);
  pdfDoc.registerFontkit(fontkit);
  const resources = makeResourceCache(pdfDoc, fontRegistry);
  const pages = pdfDoc.getPages();
  const stampedPages = new Set();
  const skipped = [];
  for (const sig of signatures) {
    if (sig.visible === false) continue;
    const page = pages[sig.page - 1];
    if (!page) {
      skipped.push({ id: sig.id, reason: `Trang ${sig.page} không tồn tại` });
      continue;
    }
    const model = resolveTemplate(sig.template, { mode, runtimeData, measure: fontRegistry.measure });
    await drawModelOnPage(page, model, sig, resources, { opacity: sig.opacity ?? 1 });
    stampedPages.add(sig.page - 1);
  }
  if (stamp) {
    const targets = stampedPages.size ? [...stampedPages] : [0];
    for (const i of targets) await stampNotice(pages[i], resources);
  }
  pdfDoc.setSubject(PREVIEW_NOTICE);
  pdfDoc.setKeywords(['VNeCA Signature Designer', 'appearance-preview', 'not-signed']);
  pdfDoc.setProducer('VNeCA Signature Designer (appearance preview — not digitally signed)');
  if (title) pdfDoc.setTitle(title);
  return { bytes: await pdfDoc.save(), skipped };
}
