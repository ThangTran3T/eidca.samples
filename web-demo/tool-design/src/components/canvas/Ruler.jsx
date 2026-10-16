/**
 * Canvas ruler aligned to the current page's display origin. Units: mm or pt.
 * Highlights the selected box extent.
 */
import { useEffect, useRef } from 'react';
import { pointsToMm } from '../../engines/coordinate-engine/index.js';

export const RULER = 20;

function niceStep(pxPerUnit) {
  // choose a major step so labels are ≥ 50px apart
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  return candidates.find((s) => s * pxPerUnit >= 50) ?? 1000;
}

export function Ruler({ orientation, length, originPx, zoom, units = 'mm', highlight, dark }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const horiz = orientation === 'h';
    const w = horiz ? length : RULER;
    const h = horiz ? RULER : length;
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = dark ? '#151821' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const pxPerUnit = units === 'mm' ? zoom / pointsToMm(1) : zoom; // px per mm or per pt
    if (highlight) {
      ctx.fillStyle = dark ? 'rgba(129,140,248,0.25)' : 'rgba(99,102,241,0.14)';
      const a = originPx + highlight.start * zoom;
      const b = originPx + highlight.end * zoom;
      if (horiz) ctx.fillRect(a, 0, b - a, h);
      else ctx.fillRect(0, a, w, b - a);
    }
    const major = niceStep(pxPerUnit);
    const minor = major / (major % 5 === 0 ? 5 : 2);
    ctx.strokeStyle = dark ? '#3a4152' : '#c9cdd8';
    ctx.fillStyle = dark ? '#8b92a5' : '#6b7080';
    ctx.font = '9.5px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const startUnit = Math.floor(-originPx / pxPerUnit / minor) * minor;
    const endUnit = (length - originPx) / pxPerUnit;
    ctx.beginPath();
    for (let u = startUnit; u <= endUnit; u += minor) {
      const p = Math.round(originPx + u * pxPerUnit) + 0.5;
      const isMajor = Math.abs(u / major - Math.round(u / major)) < 1e-6;
      const len = isMajor ? RULER * 0.55 : RULER * 0.25;
      if (horiz) {
        ctx.moveTo(p, RULER);
        ctx.lineTo(p, RULER - len);
      } else {
        ctx.moveTo(RULER, p);
        ctx.lineTo(RULER - len, p);
      }
      if (isMajor) {
        const label = String(Math.round(u));
        if (horiz) ctx.fillText(label, p + 2, 2);
        else {
          ctx.save();
          ctx.translate(2, p + 2);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(label, 0, -9);
          ctx.restore();
        }
      }
    }
    ctx.stroke();
    ctx.strokeStyle = dark ? '#262b38' : '#e4e6ec';
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(0, RULER - 0.5);
      ctx.lineTo(w, RULER - 0.5);
    } else {
      ctx.moveTo(RULER - 0.5, 0);
      ctx.lineTo(RULER - 0.5, h);
    }
    ctx.stroke();
  }, [orientation, length, originPx, zoom, units, highlight?.start, highlight?.end, dark, highlight]);
  return <canvas ref={ref} aria-hidden="true" className="block" />;
}
