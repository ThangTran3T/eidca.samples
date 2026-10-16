import { useRef } from 'react';
import { FileUp, FileText, FilePlus2, LayoutTemplate, AlertTriangle, Lock } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { PdfViewer } from '../pdf/PdfViewer.jsx';
import { TemplateView } from '../preview/TemplateView.jsx';
import { RenderedPreview } from '../preview/RenderedPreview.jsx';
import { Button, Spinner, Callout } from '../ui/index.jsx';
import { openPdfFile, openSamplePdf, openBlankPdf } from '../../features/document/document-actions.js';
import { useT } from '../../i18n/index.js';

export const SAMPLE_DOCS = [
  { file: 'quyet-dinh-mau.pdf', title: 'Quyết định hành chính (NĐ 30)', note: '2 trang · có khối chữ ký' },
  { file: 'hop-dong-dien-tu.pdf', title: 'Hợp đồng điện tử', note: '3 trang · 2 bên ký' },
  { file: 'phieu-ket-qua-xet-nghiem.pdf', title: 'Phiếu kết quả xét nghiệm', note: 'Bệnh viện/bác sĩ' },
  { file: 'kiem-thu-xoay-trang.pdf', title: 'Kiểm thử xoay trang & CropBox', note: '5 trang · /Rotate 0–270' },
];

export function Workspace() {
  const view = useEditor((s) => s.view);
  const docStatus = useEditor((s) => s.docStatus);
  const docError = useEditor((s) => s.docError);
  const hasDoc = useEditor((s) => !!s.doc);

  if (view === 'template') return <TemplateView />;
  if (view === 'rendered') return <RenderedPreview />;
  if (docStatus === 'loading' && !hasDoc) return <LoadingState />;
  if (!hasDoc) return <EmptyWorkspace error={docError} />;
  return <PdfViewer />;
}

function LoadingState() {
  const t = useT();
  return (
    <div className="canvas-bg flex flex-1 items-center justify-center gap-2 text-[var(--text-muted)]" data-testid="pdf-loading">
      <Spinner /> {t('canvas.loading')}
    </div>
  );
}

function EmptyWorkspace({ error }) {
  const t = useT();
  const input = useRef(null);
  const hasSignatures = useEditor((s) => s.signatures.length > 0);
  return (
    <div
      className="canvas-bg flex flex-1 items-center justify-center overflow-auto p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) openPdfFile(f);
      }}
      data-testid="empty-workspace"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-xl animate-fade-in">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
          <FileUp className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">{t('canvas.emptyTitle')}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{t('canvas.emptyBody')}</p>
        {error && (
          <Callout tone="danger" icon={<AlertTriangle className="h-4 w-4" />} className="mt-4" testId="pdf-error">
            {error}
          </Callout>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" size="lg" onClick={() => input.current?.click()} data-testid="empty-open-pdf">
            <FileUp className="h-4 w-4" /> {t('toolbar.openPdf')}
          </Button>
          <Button size="lg" onClick={openBlankPdf}>
            <FilePlus2 className="h-4 w-4" /> {t('toolbar.blank')}
          </Button>
          {hasSignatures && (
            <Button size="lg" variant="ghost" onClick={() => useEditor.getState().setView('template')}>
              <LayoutTemplate className="h-4 w-4" /> {t('view.template')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          data-testid="empty-pdf-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openPdfFile(f);
            e.target.value = '';
          }}
        />
        <div className="mt-7">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{t('toolbar.samples')}</div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_DOCS.map((d) => (
              <button
                key={d.file}
                type="button"
                onClick={() => openSamplePdf(d.file)}
                data-testid={`sample-${d.file}`}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/20"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span>
                  <span className="block text-[12.5px] font-medium">{d.title}</span>
                  <span className="block text-[11px] text-[var(--text-subtle)]">{d.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-[11.5px] text-[var(--text-subtle)]">
          <Lock className="h-3.5 w-3.5" /> Tệp PDF không rời khỏi máy của bạn. Không có dữ liệu nào được gửi ra ngoài.
        </div>
      </div>
    </div>
  );
}
