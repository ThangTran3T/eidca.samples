/** Browser-side export/import flows (downloads, PNG/SVG/PDF rendering, JSON import). */
import { useEditor } from '../../stores/editor-store.js';
import { resolveTemplate } from '../../engines/template-engine/index.js';
import { renderModelToCanvas } from '../../engines/rendering-engine/canvas-renderer.js';
import { modelToSvg } from '../../engines/rendering-engine/svg-renderer.js';
import { fontRegistry } from '../../services/font-service.js';
import { processImage } from '../../services/image-service.js';
import { exportDesignerDocument, exportTemplateFile, parseJsonText, detectJsonKind, importDesignerDocument, importTemplateFile } from './designer-io.js';
import { getAdapter } from '../../adapters/index.js';
import { signatureSchema, formatZodIssues } from '../../schemas/designer-schema.js';

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text, fileName, type = 'application/json') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), fileName);
}

export function slug(s) {
  return (
    String(s || 'chu-ky')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'chu-ky'
  );
}

function currentModel(sig) {
  const { displayMode, runtimeData } = useEditor.getState();
  // Exports never contain {{placeholders}}: placeholder mode exports sample data.
  const mode = displayMode === 'placeholder' ? 'sample' : displayMode;
  return resolveTemplate(sig.template, { mode, runtimeData, measure: fontRegistry.measure });
}

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportPng(sig, { dpi = 300, transparent = true } = {}) {
  const model = currentModel(sig);
  const srcs = [...new Set(model.items.filter((i) => i.type === 'image' && i.image.src).map((i) => i.image.src))];
  const imgs = new Map(await Promise.all(srcs.map(async (s) => [s, await loadImg(s)])));
  const canvas = renderModelToCanvas(model, { pixelsPerPoint: dpi / 72, background: transparent ? null : '#ffffff', getImage: (s) => imgs.get(s) ?? null, opacity: sig.opacity ?? 1 });
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  downloadBlob(blob, `${slug(sig.name)}.png`);
}

export function exportSvg(sig) {
  const svg = modelToSvg(currentModel(sig), { opacity: sig.opacity ?? 1, title: sig.name });
  downloadText(svg, `${slug(sig.name)}.svg`, 'image/svg+xml');
}

export function exportDesignerJson() {
  const { doc, signatures } = useEditor.getState();
  const value = exportDesignerDocument({ documentName: doc?.name ?? '', pages: doc?.pages ?? [], signatures });
  downloadText(JSON.stringify(value, null, 2), `${slug(doc?.name?.replace(/\.pdf$/i, '') || 'thiet-ke')}.signature-designer.json`);
}

export function exportTemplateJson(template) {
  downloadText(JSON.stringify(exportTemplateFile(template), null, 2), `${slug(template.name)}.signature-template.json`);
}

export function buildLegacyExport({ integerCoordinates = true } = {}) {
  const { signatures, pageGeoms, displayMode, runtimeData } = useEditor.getState();
  const adapter = getAdapter('vneca-legacy');
  return adapter.export(signatures, {
    pageGeoms: pageGeoms(),
    integerCoordinates,
    data: (sig) => (displayMode === 'runtime' ? runtimeData : sig.template.sampleData),
  });
}

export async function renderPreviewPdf() {
  const { doc, signatures, displayMode, runtimeData } = useEditor.getState();
  const mode = displayMode === 'placeholder' ? 'sample' : displayMode;
  // pdf-lib is only needed here — load it on demand to keep the initial bundle small.
  const { renderAppearancesToPdf } = await import('../../engines/rendering-engine/pdf-renderer.js');
  return renderAppearancesToPdf(doc?.bytes ?? null, signatures, { fontRegistry, mode, runtimeData, title: doc?.name ? `Xem trước hình thức chữ ký — ${doc.name}` : 'Xem trước hình thức chữ ký' });
}

/** Convert non-embeddable images (WebP/GIF from legacy JSON) to PNG and analyse all images. */
async function normalizeImages(signatures) {
  for (const sig of signatures) {
    for (const el of sig.template.elements) {
      if (el.type !== 'image' || !el.image.src) continue;
      try {
        const r = await processImage(el.image.src, { fileName: el.image.fileName });
        Object.assign(el.image, { src: r.src, naturalWidth: r.naturalWidth, naturalHeight: r.naturalHeight, analysis: r.analysis });
      } catch {
        el.image.src = '';
      }
    }
  }
  return signatures;
}

/**
 * Import any supported JSON. Returns a report:
 *   { kind, ok, imported, warnings: [], errors: [] }
 */
export async function importJsonText(text, { replace = false } = {}) {
  const store = useEditor.getState();
  const value = parseJsonText(text);
  const kind = detectJsonKind(value);
  if (kind === 'designer') {
    const r = importDesignerDocument(value);
    if (!r.ok) return { kind, ok: false, imported: 0, warnings: [], errors: r.errors };
    const warnings = [];
    if (store.doc && r.document.pageCount && r.document.pageCount !== store.doc.pages.length) {
      warnings.push({ code: 'page-count', message: `Thiết kế được tạo cho tài liệu ${r.document.pageCount} trang; tài liệu hiện tại có ${store.doc.pages.length} trang.` });
    }
    replace ? store.replaceSignatures(r.signatures) : store.addSignatures(r.signatures);
    return { kind, ok: true, imported: r.signatures.length, warnings, errors: [] };
  }
  if (kind === 'template') {
    const r = importTemplateFile(value);
    if (!r.ok) return { kind, ok: false, imported: 0, warnings: [], errors: r.errors };
    store.saveCustomTemplate(r.template);
    store.addFromTemplate(r.template);
    return { kind, ok: true, imported: 1, warnings: [], errors: [] };
  }
  if (kind === 'legacy') {
    const adapter = getAdapter('vneca-legacy');
    const r = adapter.import(value, { pageGeoms: store.pageGeoms(), pageCount: store.doc?.pages.length });
    const sigs = await normalizeImages(r.signatures);
    const valid = [];
    const errors = [...r.errors];
    for (const s of sigs) {
      const p = signatureSchema.safeParse(s);
      if (p.success) valid.push(p.data);
      else errors.push(...formatZodIssues(p.error));
    }
    if (valid.length) replace ? store.replaceSignatures(valid) : store.addSignatures(valid);
    return { kind, ok: valid.length > 0, imported: valid.length, warnings: r.warnings, errors };
  }
  return { kind, ok: false, imported: 0, warnings: [], errors: ['Không nhận dạng được định dạng JSON (Designer, mẫu chữ ký hoặc VNeCA sign_props).'] };
}
