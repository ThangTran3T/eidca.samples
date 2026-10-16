import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor, clampZoom } from '../../stores/editor-store.js';
import { geometryFromPdfJsView, displaySize, signatureDisplayFrame } from '../../engines/coordinate-engine/index.js';
import { PageCanvas } from './PageCanvas.jsx';
import { PageOverlay } from '../canvas/PageOverlay.jsx';
import { Ruler, RULER } from '../canvas/Ruler.jsx';
import { openPdfFile } from '../../features/document/document-actions.js';
import { useT } from '../../i18n/index.js';

const GAP = 28;
const PAD = 40;

export const TEMPLATE_DRAG_TYPE = 'application/x-vneca-template';

export function PdfViewer() {
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.zoom);
  const viewRotation = useEditor((s) => s.viewRotation);
  const settings = useEditor((s) => s.settings);
  const currentPage = useEditor((s) => s.currentPage);
  const theme = useEditor((s) => s.theme);
  const selected = useEditor((s) => s.signatures.find((x) => x.id === s.selection.signatureId) ?? null);
  const t = useT();
  const scrollRef = useRef(null);
  const pageRefs = useRef(new Map());
  const [origin, setOrigin] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dropActive, setDropActive] = useState(false);
  const zoomAnchor = useRef(null);
  const userScroll = useRef(true);

  const pages = doc?.pages ?? [];
  const maxWidth = Math.max(1, ...pages.map((p) => displaySize(geometryFromPdfJsView(p.view, p.rotate), viewRotation).width));

  // Ruler origin = current page's top-left relative to the scroll viewport.
  const measure = useCallback(() => {
    const sc = scrollRef.current;
    const el = pageRefs.current.get(useEditor.getState().currentPage);
    if (!sc || !el) return;
    const a = sc.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setOrigin({ x: b.left - a.left, y: b.top - a.top, w: sc.clientWidth, h: sc.clientHeight });
  }, []);

  useLayoutEffect(measure, [measure, zoom, viewRotation, currentPage, pages.length]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Track the page most visible in the viewport.
  const onScroll = () => {
    measure();
    if (!userScroll.current) return;
    const sc = scrollRef.current;
    const mid = sc.getBoundingClientRect().top + sc.clientHeight / 3;
    let best = currentPage;
    for (const [n, el] of pageRefs.current) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) best = n;
    }
    if (best !== useEditor.getState().currentPage) useEditor.getState().setCurrentPage(best);
  };

  // Scroll requests from thumbnails / signature list.
  useEffect(() => {
    const onReq = (e) => {
      const el = pageRefs.current.get(e.detail);
      if (!el) return;
      userScroll.current = false;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      useEditor.getState().setCurrentPage(e.detail);
      setTimeout(() => (userScroll.current = true), 600);
    };
    const onFit = () => {
      const sc = scrollRef.current;
      if (sc) useEditor.getState().setZoom(clampZoom((sc.clientWidth - PAD * 2 - RULER) / maxWidth));
    };
    window.addEventListener('vneca:scroll-to-page', onReq);
    window.addEventListener('vneca:fit-width', onFit);
    return () => {
      window.removeEventListener('vneca:scroll-to-page', onReq);
      window.removeEventListener('vneca:fit-width', onFit);
    };
  }, [maxWidth]);

  // Ctrl/⌘ + wheel zoom anchored at the cursor.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = useEditor.getState().zoom;
      const next = clampZoom(z * Math.exp(-e.deltaY * 0.0015));
      if (next === z) return;
      const r = sc.getBoundingClientRect();
      zoomAnchor.current = { cx: e.clientX - r.left, cy: e.clientY - r.top, sx: sc.scrollLeft, sy: sc.scrollTop, k: next / z };
      useEditor.getState().setZoom(next);
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const sc = scrollRef.current;
    if (!a || !sc) return;
    sc.scrollLeft = (a.sx + a.cx) * a.k - a.cx;
    sc.scrollTop = (a.sy + a.cy) * a.k - a.cy;
    zoomAnchor.current = null;
  }, [zoom]);

  const onDrop = (e, pageNumber) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) return openPdfFile(file);
    const tplId = e.dataTransfer.getData(TEMPLATE_DRAG_TYPE);
    if (!tplId || !pageNumber) return;
    const st = useEditor.getState();
    const tpl = [...st.library, ...st.customTemplates].find((x) => x.id === tplId);
    if (!tpl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    st.addFromTemplate(tpl, { page: pageNumber, displayTopLeft: { x: p.x - tpl.size.width / 2, y: p.y - tpl.size.height / 2 } });
  };

  // ruler highlight for the selected box (display points)
  let hl = null;
  if (selected && selected.page === currentPage && pages[currentPage - 1]) {
    const g = geometryFromPdfJsView(pages[currentPage - 1].view, pages[currentPage - 1].rotate);
    const b = signatureDisplayFrame(g, selected, viewRotation).box;
    hl = { h: { start: b.x, end: b.x + b.width }, v: { start: b.y, end: b.y + b.height } };
  }
  const dark = theme === 'dark';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="pdf-viewer">
      {settings.rulers && (
        <div className="flex shrink-0">
          <div style={{ width: RULER, height: RULER }} className="border-b border-r border-[var(--border)] bg-[var(--panel)] text-center text-[9px] leading-5 text-[var(--text-subtle)]">
            {settings.units}
          </div>
          <div className="overflow-hidden">
            <Ruler orientation="h" length={Math.max(0, origin.w)} originPx={origin.x} zoom={zoom} units={settings.units} highlight={hl?.h} dark={dark} />
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {settings.rulers && (
          <div className="shrink-0 overflow-hidden">
            <Ruler orientation="v" length={Math.max(0, origin.h)} originPx={origin.y} zoom={zoom} units={settings.units} highlight={hl?.v} dark={dark} />
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="canvas-bg scroll-thin relative min-w-0 flex-1 overflow-auto"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDropActive(true);
            }
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => onDrop(e, null)}
          data-testid="pdf-scroll"
        >
          <div className="flex min-w-fit flex-col items-center" style={{ padding: PAD, gap: GAP }}>
            {pages.map((p) => {
              const geom = geometryFromPdfJsView(p.view, p.rotate, p.userUnit);
              const size = displaySize(geom, viewRotation);
              return (
                <div key={p.pageNumber} className="flex flex-col items-center gap-1.5">
                  <div
                    ref={(el) => (el ? pageRefs.current.set(p.pageNumber, el) : pageRefs.current.delete(p.pageNumber))}
                    className="page-shadow relative bg-white"
                    style={{ width: size.width * zoom, height: size.height * zoom }}
                    data-testid={`page-${p.pageNumber}`}
                    data-page-number={p.pageNumber}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(TEMPLATE_DRAG_TYPE)) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      onDrop(e, p.pageNumber);
                    }}
                  >
                    <PageCanvas pdf={doc.pdf} pageNumber={p.pageNumber} geom={geom} zoom={zoom} viewRotation={viewRotation} className="absolute inset-0" />
                    {settings.grid && <GridOverlay size={size} zoom={zoom} step={settings.gridSize} />}
                    <PageOverlay pageNumber={p.pageNumber} geom={geom} zoom={zoom} viewRotation={viewRotation} />
                  </div>
                  <div className="text-[11px] text-[var(--text-subtle)]">
                    {t('canvas.page', { n: p.pageNumber })}
                    {p.rotate ? ` · /Rotate ${p.rotate}°` : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {dropActive && (
            <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-500/10 text-sm font-semibold text-brand-700">{t('canvas.drop')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GridOverlay({ size, zoom, step }) {
  // grid every `step` pt, stronger every 10 steps
  const px = step * zoom;
  if (px < 4) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        width: size.width * zoom,
        height: size.height * zoom,
        backgroundImage: `linear-gradient(to right, rgba(99,102,241,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.12) 1px, transparent 1px)`,
        backgroundSize: `${px}px ${px}px`,
      }}
    />
  );
}
