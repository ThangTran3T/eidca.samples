/**
 * Renders one PDF.js page into a canvas. Lazy (only when near the viewport),
 * cancels stale renders, and keeps the previous bitmap stretched while a new
 * zoom level renders so zooming feels instant.
 */
import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../../services/pdf-service.js';
import { displaySize } from '../../engines/coordinate-engine/index.js';

export function PageCanvas({ pdf, pageNumber, geom, zoom, viewRotation = 0, lazy = true, className, onRendered, testId }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(!lazy);
  const [error, setError] = useState(null);
  const size = displaySize(geom, viewRotation);

  useEffect(() => {
    if (!lazy || !wrapRef.current) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)), { rootMargin: '600px' });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!visible || !pdf) return;
    let task = null;
    let cancelled = false;
    const canvas = canvasRef.current;
    // stretch the old bitmap immediately
    if (canvas) {
      canvas.style.width = `${size.width * zoom}px`;
      canvas.style.height = `${size.height * zoom}px`;
    }
    const timer = setTimeout(async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        // Render into an offscreen canvas, then swap — avoids a blank flash.
        const off = document.createElement('canvas');
        task = renderPage(page, off, { zoom, viewRotation });
        await task.promise;
        if (cancelled || !canvasRef.current) return;
        const c = canvasRef.current;
        c.width = off.width;
        c.height = off.height;
        c.getContext('2d').drawImage(off, 0, 0);
        c.style.width = off.style.width;
        c.style.height = off.style.height;
        setError(null);
        onRendered?.();
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) setError(err?.message ?? String(err));
      }
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pdf, pageNumber, zoom, viewRotation]);

  return (
    <div ref={wrapRef} className={className} style={{ width: size.width * zoom, height: size.height * zoom }} data-testid={testId}>
      <canvas ref={canvasRef} className="block bg-white" style={{ width: size.width * zoom, height: size.height * zoom }} aria-hidden="true" />
      {error && <div className="absolute inset-0 flex items-center justify-center bg-rose-50 p-4 text-center text-xs text-rose-700">Không hiển thị được trang: {error}</div>}
    </div>
  );
}
