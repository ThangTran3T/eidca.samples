import { Eye, EyeOff, Lock, Unlock, Trash2, FileText } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { geometryFromPdfJsView, pdfRectToDisplay, displaySize } from '../../engines/coordinate-engine/index.js';
import { PageCanvas } from '../pdf/PageCanvas.jsx';
import { EmptyState, IconButton, Badge } from '../ui/index.jsx';
import { useT } from '../../i18n/index.js';

const THUMB_W = 150;

export function PagesPanel() {
  const t = useT();
  const doc = useEditor((s) => s.doc);
  const signatures = useEditor((s) => s.signatures);
  const currentPage = useEditor((s) => s.currentPage);
  const selection = useEditor((s) => s.selection);
  const viewRotation = useEditor((s) => s.viewRotation);
  const st = useEditor.getState;
  const goTo = (n) => window.dispatchEvent(new CustomEvent('vneca:scroll-to-page', { detail: n }));

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto" data-testid="pages-panel">
      <div className="border-b border-[var(--border)] px-3 py-3">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{t('sidebar.signatures')}</div>
        {signatures.length === 0 ? (
          <p className="text-[11.5px] text-[var(--text-subtle)]">{t('sidebar.noSignatures')}</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="signature-list">
            {signatures.map((s) => (
              <li
                key={s.id}
                className={`group flex items-center gap-1 rounded-md px-2 py-1 text-[12px] ${selection.signatureId === s.id ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100' : 'hover:bg-[var(--panel-2)]'}`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => {
                    st().select(s.id);
                    if (st().view === 'placement') goTo(s.page);
                  }}
                >
                  {s.name}
                </button>
                <Badge>Tr. {s.page}</Badge>
                <IconButton label={s.visible === false ? 'Hiện' : 'Ẩn (sign_visibility = hidden)'} className="h-6 w-6" onClick={() => st().updateSignature(s.id, { visible: s.visible === false })}>
                  {s.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </IconButton>
                <IconButton label={s.locked ? 'Mở khóa vị trí' : 'Khóa vị trí'} className="h-6 w-6" onClick={() => st().updateSignature(s.id, { locked: !s.locked })}>
                  {s.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </IconButton>
                <IconButton label="Xóa chữ ký" className="h-6 w-6 hover:text-rose-600" onClick={() => st().removeSignature(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!doc ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={t('sidebar.pages')}>
          {t('canvas.emptyTitle')}
        </EmptyState>
      ) : (
        <div className="flex flex-col items-center gap-3 px-3 py-3">
          {doc.pages.map((p) => {
            const geom = geometryFromPdfJsView(p.view, p.rotate, p.userUnit);
            const size = displaySize(geom, viewRotation);
            const k = THUMB_W / size.width;
            const sigs = signatures.filter((s) => s.page === p.pageNumber);
            return (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => {
                  st().setView('placement');
                  goTo(p.pageNumber);
                }}
                className={`group flex flex-col items-center gap-1 rounded-lg p-1.5 ${currentPage === p.pageNumber ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30' : 'hover:bg-[var(--panel-2)]'}`}
                data-testid={`thumb-${p.pageNumber}`}
                aria-label={t('canvas.page', { n: p.pageNumber })}
                aria-current={currentPage === p.pageNumber ? 'page' : undefined}
              >
                <div className="relative overflow-hidden shadow" style={{ width: size.width * k, height: size.height * k }}>
                  <PageCanvas pdf={doc.pdf} pageNumber={p.pageNumber} geom={geom} zoom={k} viewRotation={viewRotation} className="absolute inset-0" />
                  {sigs.map((s) => {
                    const r = pdfRectToDisplay(geom, s.rect, viewRotation);
                    return (
                      <div
                        key={s.id}
                        className={`absolute border ${selection.signatureId === s.id ? 'border-brand-600 bg-brand-500/30' : 'border-brand-400 bg-brand-400/20'}`}
                        style={{ left: r.x * k, top: r.y * k, width: r.width * k, height: r.height * k }}
                      />
                    );
                  })}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {p.pageNumber}
                  {sigs.length ? ` · ${sigs.length} chữ ký` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
