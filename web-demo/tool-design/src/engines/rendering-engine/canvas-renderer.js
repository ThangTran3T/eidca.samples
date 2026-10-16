/**
 * Canvas 2D renderer for the render model. Used by the interactive editor
 * (Konva shapes call drawItemContent from their sceneFunc), PNG export and
 * template thumbnails — one drawing code path for every on-screen output.
 * All coordinates are design-space points; callers apply zoom/DPR via the
 * context transform.
 */
import { cssFont } from './fonts.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Background and border of the signature box. */
export function drawBoxStyle(ctx, model) {
  const { background, border } = model.style ?? {};
  const w = model.width;
  const h = model.height;
  if (background && background.opacity > 0) {
    ctx.save();
    ctx.globalAlpha *= background.opacity;
    ctx.fillStyle = background.color;
    roundRectPath(ctx, 0, 0, w, h, border?.radius ?? 0);
    ctx.fill();
    ctx.restore();
  }
  if (border && border.width > 0) {
    ctx.save();
    ctx.strokeStyle = border.color;
    ctx.lineWidth = border.width;
    ctx.setLineDash(border.style === 'dashed' ? [border.width * 3, border.width * 2] : []);
    const half = border.width / 2;
    roundRectPath(ctx, half, half, w - border.width, h - border.width, border.radius ?? 0);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draw one item in its local coordinate system (origin = element top-left,
 * no rotation/opacity applied — the caller or Konva node handles those).
 * @param {{ getImage?: (src:string)=>CanvasImageSource|null, showPlaceholders?: boolean, placeholderScale?: number }} opts
 */
export function drawItemContent(ctx, item, opts = {}) {
  const { width: w, height: h } = item;
  switch (item.type) {
    case 'text': {
      const t = item.text;
      ctx.font = cssFont(t.font);
      ctx.fillStyle = t.color;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      for (const line of t.lines) {
        if (line.text) ctx.fillText(line.text, line.x, line.baseline);
      }
      break;
    }
    case 'image': {
      const img = item.image.src && opts.getImage ? opts.getImage(item.image.src) : null;
      if (img) {
        const d = item.image.draw;
        ctx.save();
        if (d.clip) {
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.clip();
        }
        ctx.drawImage(img, d.x, d.y, d.width, d.height);
        ctx.restore();
      } else if (opts.showPlaceholders) {
        drawImagePlaceholder(ctx, item, opts.placeholderScale ?? 1);
      }
      break;
    }
    case 'qr': {
      const q = item.qr;
      const side = Math.min(w, h);
      const ox = (w - side) / 2;
      const oy = (h - side) / 2;
      if (!q.transparentBackground) {
        ctx.fillStyle = q.background;
        ctx.fillRect(ox, oy, side, side);
      }
      if (q.modules) {
        const n = q.modules.size;
        const quiet = 1; // 1-module quiet zone keeps small codes scannable
        const cell = side / (n + quiet * 2);
        ctx.fillStyle = q.color;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            // +0.02 overlap avoids hairline seams between modules when antialiasing
            if (q.modules.data[r * n + c]) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell + 0.02, cell + 0.02);
          }
        }
      }
      break;
    }
    case 'rect': {
      const s = item.shape;
      roundRectPath(ctx, 0, 0, w, h, s.radius);
      if (s.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= s.fillOpacity;
        ctx.fillStyle = s.fill;
        ctx.fill();
        ctx.restore();
      }
      if (s.strokeWidth > 0) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.strokeWidth;
        ctx.setLineDash(s.dashed ? [s.strokeWidth * 3, s.strokeWidth * 2] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'line': {
      const l = item.line;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.strokeWidth;
      ctx.setLineDash(l.dashed ? [l.strokeWidth * 3, l.strokeWidth * 2] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    default:
      break;
  }
}

export function drawImagePlaceholder(ctx, item, k = 1) {
  const { width: w, height: h } = item;
  ctx.save();
  ctx.fillStyle = 'rgba(99,102,241,0.06)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(99,102,241,0.55)';
  ctx.lineWidth = 0.75 / k;
  ctx.setLineDash([3 / k, 2 / k]);
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);
  const size = Math.max(4, Math.min(9, h / 4));
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(79,70,229,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = { 'hand-signature': 'Ảnh chữ ký', seal: 'Ảnh con dấu', logo: 'Logo', background: 'Ảnh nền' }[item.role] ?? 'Ảnh';
  ctx.fillText(label, w / 2, h / 2);
  ctx.restore();
}

/** Draw a whole render model with transforms/opacity applied. */
export function drawModel(ctx, model, opts = {}) {
  ctx.save();
  ctx.globalAlpha *= opts.opacity ?? 1;
  drawBoxStyle(ctx, model);
  for (const item of model.items) {
    if (!item.visible) continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.globalAlpha *= item.opacity;
    drawItemContent(ctx, item, opts);
    ctx.restore();
  }
  ctx.restore();
}

/** Render a model to a canvas element at `pixelsPerPoint`. Returns the canvas. */
export function renderModelToCanvas(model, { pixelsPerPoint = 4, background = null, createCanvas, ...opts } = {}) {
  const canvas = createCanvas ? createCanvas() : document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(model.width * pixelsPerPoint));
  canvas.height = Math.max(1, Math.ceil(model.height * pixelsPerPoint));
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(pixelsPerPoint, pixelsPerPoint);
  drawModel(ctx, model, opts);
  return canvas;
}
