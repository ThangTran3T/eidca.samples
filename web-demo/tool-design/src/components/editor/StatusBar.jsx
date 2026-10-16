import { MousePointer2, BoxSelect, ShieldAlert, X } from 'lucide-react';
import { useEditor, selectSelectedSignature } from '../../stores/editor-store.js';
import { pointsToMm } from '../../engines/coordinate-engine/index.js';
import { useT } from '../../i18n/index.js';

const f = (v) => (Math.round(v * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const fmm = (v) => (Math.round(pointsToMm(v) * 10) / 10).toLocaleString('vi-VN');

export function StatusBar() {
  const t = useT();
  const cursor = useEditor((s) => s.cursor);
  const sig = useEditor(selectSelectedSignature);
  const zoom = useEditor((s) => s.zoom);
  const viewRotation = useEditor((s) => s.viewRotation);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--panel)] px-3 text-[11px] text-[var(--text-muted)] tabular-nums" data-testid="status-bar">
      <span className="flex items-center gap-1.5" data-testid="status-cursor">
        <MousePointer2 className="h-3 w-3" />
        {cursor ? `Tr.${cursor.page} · x ${f(cursor.x)} · y ${f(cursor.y)} pt` : '—'}
      </span>
      <span className="flex items-center gap-1.5" data-testid="status-selection">
        <BoxSelect className="h-3 w-3" />
        {sig
          ? `lLx ${f(sig.rect.x)} · lLy ${f(sig.rect.y)} · ${f(sig.rect.width)} × ${f(sig.rect.height)} pt (${fmm(sig.rect.width)} × ${fmm(sig.rect.height)} mm)`
          : '—'}
      </span>
      <span>
        {Math.round(zoom * 100)}%{viewRotation ? ` · xoay khung nhìn ${viewRotation}°` : ''}
      </span>
      <span className="ml-auto flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
        <ShieldAlert className="h-3 w-3" /> {t('status.notSigned')}
      </span>
    </footer>
  );
}

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  const tones = {
    info: 'border-[var(--border)] bg-[var(--panel)]',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    danger: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
  };
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {toasts.map((tt) => (
        <div key={tt.id} className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border px-3.5 py-2.5 text-[12.5px] shadow-xl animate-fade-in ${tones[tt.tone] ?? tones.info}`} data-testid={`toast-${tt.tone}`}>
          <span className="flex-1">{tt.message}</span>
          <button type="button" aria-label="Đóng" onClick={() => useEditor.getState().dismissToast(tt.id)} className="opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
