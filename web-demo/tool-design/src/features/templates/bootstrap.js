/** Rasterise specimen artwork and build the built-in library (browser only). */
import { processImage, rasterizeSvg } from '../../services/image-service.js';
import { buildTemplateLibrary } from './library.js';
import { SEAL_SPECIMEN_SVG, SIGNATURE_SPECIMEN_SVG, LOGO_SPECIMEN_SVG, HOSPITAL_LOGO_SPECIMEN_SVG } from './specimens.js';
import { resolveTemplate } from '../../engines/template-engine/index.js';
import { renderModelToCanvas } from '../../engines/rendering-engine/canvas-renderer.js';
import { fontRegistry } from '../../services/font-service.js';

async function specimen(svg, longSide) {
  const png = await rasterizeSvg(svg, { targetLongSide: longSide });
  const r = await processImage(png);
  return { src: r.src, width: r.naturalWidth, height: r.naturalHeight, analysis: r.analysis };
}

export async function bootstrapLibrary() {
  const [seal, signature, logo, hospitalLogo] = await Promise.all([
    specimen(SEAL_SPECIMEN_SVG, 800),
    specimen(SIGNATURE_SPECIMEN_SVG, 900),
    specimen(LOGO_SPECIMEN_SVG, 400),
    specimen(HOSPITAL_LOGO_SPECIMEN_SVG, 400),
  ]);
  return buildTemplateLibrary({ seal, signature, logo, hospitalLogo });
}

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Render a thumbnail data URL for a template (sample data). */
export async function renderThumbnail(template, { maxWidth = 220, maxHeight = 96 } = {}) {
  const model = resolveTemplate(template, { mode: 'sample', measure: fontRegistry.measure });
  const srcs = [...new Set(model.items.filter((i) => i.type === 'image' && i.image.src).map((i) => i.image.src))];
  const imgs = new Map(await Promise.all(srcs.map(async (s) => [s, await loadImg(s)])));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const k = Math.min(maxWidth / model.width, maxHeight / model.height) * dpr;
  const canvas = renderModelToCanvas(model, { pixelsPerPoint: k, getImage: (s) => imgs.get(s) ?? null, showPlaceholders: true, placeholderScale: k });
  return canvas.toDataURL('image/png');
}
