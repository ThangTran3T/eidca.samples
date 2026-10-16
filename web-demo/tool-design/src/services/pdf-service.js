/**
 * PDF.js wrapper. PDFs are processed locally in the browser only — bytes are
 * never uploaded or persisted. Validation rejects non-PDF, oversized,
 * encrypted and malformed files with user-friendly messages.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { backingStoreSize, geometryFromPdfJsView, totalRotation } from '../engines/coordinate-engine/index.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const base = new URL(import.meta.env.BASE_URL, document.baseURI);
const asset = (p) => new URL(p, base).href;

export const MAX_PDF_BYTES = 100 * 1024 * 1024;

export class PdfError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Validate a File/Blob and return its bytes. */
export async function readPdfFile(file) {
  if (!file) throw new PdfError('empty', 'Chưa chọn tệp.');
  const nameOk = /\.pdf$/i.test(file.name ?? '');
  const typeOk = !file.type || file.type === 'application/pdf' || file.type === 'application/x-pdf';
  if (!nameOk && !typeOk) throw new PdfError('type', 'Chỉ hỗ trợ tệp PDF (.pdf).');
  if (file.size === 0) throw new PdfError('empty', 'Tệp rỗng.');
  if (file.size > MAX_PDF_BYTES) throw new PdfError('size', 'Tệp vượt quá 100 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdfHeader(bytes);
  return bytes;
}

export function assertPdfHeader(bytes) {
  // The header must appear within the first 1024 bytes (ISO 32000-1 §7.5.2 tolerance used by viewers).
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!head.includes('%PDF-')) throw new PdfError('header', 'Tệp không phải PDF hợp lệ (thiếu phần đầu %PDF-).');
}

export async function openPdf(bytes) {
  assertPdfHeader(bytes);
  const task = pdfjs.getDocument({
    data: bytes.slice(), // PDF.js transfers the buffer; keep our copy for the rendered preview
    cMapUrl: asset('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: asset('pdfjs/standard_fonts/'),
    wasmUrl: asset('pdfjs/wasm/'),
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new PdfError('encrypted', 'PDF được bảo vệ bằng mật khẩu — chưa hỗ trợ.');
    if (err?.name === 'InvalidPDFException') throw new PdfError('invalid', 'Tệp PDF bị hỏng hoặc không đúng định dạng.');
    throw new PdfError('load', `Không mở được PDF: ${err?.message ?? err}`);
  }
  if (doc.numPages < 1) throw new PdfError('empty', 'PDF không có trang nào.');
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    pages.push({ pageNumber: n, view: [...page.view], rotate: page.rotate, userUnit: page.userUnit ?? 1 });
  }
  return { doc, pages };
}

export function pageGeometry(info) {
  return geometryFromPdfJsView(info.view, info.rotate, info.userUnit);
}

/** Render a page into `canvas` for the given zoom/view rotation; returns a cancellable task. */
export function renderPage(page, canvas, { zoom, viewRotation = 0, devicePixelRatio = window.devicePixelRatio || 1 }) {
  const geom = geometryFromPdfJsView(page.view, page.rotate, page.userUnit);
  const rotation = totalRotation(geom, viewRotation);
  const viewport = page.getViewport({ scale: zoom, rotation });
  const { width, height, ratio } = backingStoreSize(viewport.width, viewport.height, devicePixelRatio);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d', { alpha: false });
  return page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    annotationMode: pdfjs.AnnotationMode.ENABLE,
  });
}

/** Text items in PDF user space (used by the "centred between title and name" rule). */
export async function extractPageText(page) {
  const content = await page.getTextContent();
  return content.items
    .filter((i) => i.str && i.str.trim())
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width, height: i.height || Math.hypot(i.transform[2], i.transform[3]) }));
}

export { pdfjs };
