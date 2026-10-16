/** Opening documents: local files, bundled samples and a blank A4 page. */
import { useEditor } from '../../stores/editor-store.js';
import { readPdfFile, openPdf, extractPageText, PdfError } from '../../services/pdf-service.js';

const base = new URL(import.meta.env.BASE_URL, document.baseURI);

let manifest = null;
export async function loadSampleManifest() {
  if (!manifest) {
    const res = await fetch(new URL('samples/manifest.json', base));
    manifest = res.ok ? await res.json() : [];
  }
  return manifest;
}

async function openBytes(bytes, name, sampleMeta = null) {
  const store = useEditor.getState();
  const { doc, pages } = await openPdf(bytes);
  store.setDocument({ name, bytes, pdf: doc, pages, sampleMeta });
  // Text layer feeds the "centred between title and name" rule; small docs only, in the background.
  if (pages.length <= 60) {
    (async () => {
      for (const p of pages) {
        try {
          const page = await doc.getPage(p.pageNumber);
          useEditor.getState().setPageText(p.pageNumber, await extractPageText(page));
        } catch {
          /* text extraction is best-effort */
        }
      }
    })();
  }
}

function fail(err) {
  const message = err instanceof PdfError ? err.message : `Không mở được tài liệu: ${err?.message ?? err}`;
  useEditor.getState().setDocError(message);
  useEditor.getState().toast(message, 'danger', 6000);
}

export async function openPdfFile(file) {
  const store = useEditor.getState();
  store.setDocLoading();
  try {
    const bytes = await readPdfFile(file);
    await openBytes(bytes, file.name);
    store.toast(`Đã mở "${file.name}" — xử lý cục bộ, không tải lên máy chủ.`, 'success');
  } catch (err) {
    fail(err);
  }
}

export async function openSamplePdf(fileName) {
  const store = useEditor.getState();
  store.setDocLoading();
  try {
    const [res, list] = await Promise.all([fetch(new URL(`samples/${fileName}`, base)), loadSampleManifest()]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    await openBytes(bytes, fileName, list.find((m) => m.file === fileName) ?? null);
  } catch (err) {
    fail(err);
  }
}

export async function openBlankPdf() {
  const store = useEditor.getState();
  store.setDocLoading();
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    pdf.setTitle('Trang A4 trắng');
    await openBytes(await pdf.save(), 'trang-a4-trang.pdf');
  } catch (err) {
    fail(err);
  }
}
