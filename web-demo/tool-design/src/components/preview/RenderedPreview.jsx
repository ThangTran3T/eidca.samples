/**
 * Mode 3 — Rendered PDF preview: generates a PDF with the appearances drawn
 * (pdf-lib) and displays it through PDF.js. Clearly not a signed document.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { renderPreviewPdf, downloadBlob, slug } from '../../features/export/export-actions.js';
import { openPdf, pageGeometry } from '../../services/pdf-service.js';
import { PREVIEW_NOTICE } from '../../engines/rendering-engine/notice.js';
import { PageCanvas } from '../pdf/PageCanvas.jsx';
import { Button, Callout, Spinner, Badge } from '../ui/index.jsx';

export function RenderedPreview() {
  const signatures = useEditor((s) => s.signatures);
  const displayMode = useEditor((s) => s.displayMode);
  const runtimeData = useEditor((s) => s.runtimeData);
  const docName = useEditor((s) => s.doc?.name);
  const [state, setState] = useState({ status: 'idle' });
  const generatedFor = useRef(null);

  const generate = async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const { bytes, skipped } = await renderPreviewPdf();
      const { doc, pages } = await openPdf(bytes);
      state.doc?.destroy?.();
      generatedFor.current = { signatures, displayMode, runtimeData };
      setState({ status: 'ready', bytes, doc, pages, skipped });
    } catch (err) {
      setState({ status: 'error', error: err?.message ?? String(err) });
    }
  };

  useEffect(() => {
    generate();
    return () => state.doc?.destroy?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outdated = state.status === 'ready' && generatedFor.current && (generatedFor.current.signatures !== signatures || generatedFor.current.displayMode !== displayMode || generatedFor.current.runtimeData !== runtimeData);
  const fileName = `${slug((docName || 'tai-lieu').replace(/\.pdf$/i, ''))}.xem-truoc-hinh-thuc.pdf`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="rendered-preview">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5">
        <Callout tone="danger" icon={<ShieldAlert className="h-4 w-4" />} className="flex-1 py-1.5" testId="preview-notice">
          <strong>{PREVIEW_NOTICE}</strong> Tệp không chứa chữ ký số, không có giá trị pháp lý và không chứng minh danh tính hay sự đồng ý của người ký.
        </Callout>
        {outdated && <Badge tone="warning">Thiết kế đã thay đổi</Badge>}
        <Button onClick={generate} disabled={state.status === 'loading'} data-testid="regenerate">
          <RefreshCw className="h-3.5 w-3.5" /> Tạo lại
        </Button>
        <Button variant="primary" disabled={state.status !== 'ready'} onClick={() => downloadBlob(new Blob([state.bytes], { type: 'application/pdf' }), fileName)} data-testid="download-preview">
          <Download className="h-3.5 w-3.5" /> Tải PDF xem trước
        </Button>
      </div>
      <div className="canvas-bg scroll-thin min-h-0 flex-1 overflow-auto">
        {state.status === 'loading' && (
          <div className="flex h-full items-center justify-center gap-2 text-[var(--text-muted)]">
            <Spinner /> Đang kết xuất PDF…
          </div>
        )}
        {state.status === 'error' && (
          <div className="p-6">
            <Callout tone="danger" title="Không tạo được PDF xem trước">
              {state.error}
            </Callout>
          </div>
        )}
        {state.status === 'ready' && (
          <div className="flex flex-col items-center gap-6 p-10">
            {state.skipped?.length > 0 && (
              <Callout tone="warning" title="Một số chữ ký không được vẽ">
                {state.skipped.map((s) => s.reason).join('; ')}
              </Callout>
            )}
            {state.pages.map((p) => (
              <PageCanvas key={p.pageNumber} pdf={state.doc} pageNumber={p.pageNumber} geom={pageGeometry(p)} zoom={1.25} className="page-shadow relative" testId={`rendered-page-${p.pageNumber}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
