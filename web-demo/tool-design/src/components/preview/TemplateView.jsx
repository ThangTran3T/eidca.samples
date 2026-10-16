/**
 * Mode 1 — Template preview: the selected signature's appearance on its own,
 * enlarged, with direct element editing. Works without any PDF.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage, Layer, Transformer, Rect } from 'react-konva';
import { ZoomIn, ZoomOut, Maximize, LayoutTemplate } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { SignatureNode, MIN_BOX_SIZE } from '../canvas/SignatureNode.jsx';
import { useImageVersion } from '../canvas/shapes.jsx';
import { useRenderModels } from '../canvas/PageOverlay.jsx';
import { pdfRectToDisplay, rectFromDisplayPlacement, clampRectToPage } from '../../engines/coordinate-engine/index.js';
import { EmptyState, IconButton, Badge } from '../ui/index.jsx';
import { useT } from '../../i18n/index.js';

const PAD = 48;

export function TemplateView() {
  const t = useT();
  const signatures = useEditor((s) => s.signatures);
  const selection = useEditor((s) => s.selection);
  const settings = useEditor((s) => s.settings);
  const sig = signatures.find((s) => s.id === selection.signatureId) ?? null;
  const models = useRenderModels(sig ? [sig] : []);
  const imageVersion = useImageVersion();
  const wrapRef = useRef(null);
  const trRef = useRef(null);
  const elTrRef = useRef(null);
  const stageRef = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  const [zoom, setZoom] = useState(null);
  const [elementGuides, setElementGuides] = useState([]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // auto-select the first signature so the view is never blank when there is something to show
  useEffect(() => {
    if (!sig && signatures[0]) useEditor.getState().select(signatures[0].id);
  }, [sig, signatures]);

  const design = sig?.template.size;
  const fit = design ? Math.max(0.5, Math.min(8, Math.min((box.w - PAD * 2) / design.width, (box.h - PAD * 2) / design.height))) : 1;
  const z = zoom ?? fit;
  const origin = design ? { x: Math.max(PAD, (box.w - design.width * z) / 2) / z, y: Math.max(PAD, (box.h - design.height * z) / 2) / z } : { x: 0, y: 0 };

  const selectedEl = sig?.template.elements.find((e) => e.id === selection.elementId) ?? null;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !trRef.current || !elTrRef.current) return;
    trRef.current.nodes(sig && !selectedEl && !sig.locked ? [stage.findOne(`#frame-${sig.id}`)].filter(Boolean) : []);
    elTrRef.current.nodes(sig && selectedEl && !selectedEl.locked ? [stage.findOne(`#${selectedEl.id}`)].filter(Boolean) : []);
    stage.batchDraw();
  });

  if (!sig) {
    return (
      <div ref={wrapRef} className="canvas-bg flex flex-1 items-center justify-center">
        <EmptyState icon={<LayoutTemplate className="h-5 w-5" />} title={t('view.template')} testId="template-empty">
          {t('canvas.templateEmpty')}
        </EmptyState>
      </div>
    );
  }

  const st = useEditor.getState;
  const geom = st().geometry(sig.page);
  const onElementChange = (elementId, patch, phase) => {
    if (phase === 'start') return st().beginLive();
    if (patch) st().updateElement(sig.id, elementId, patch, { live: true });
    if (phase === 'end') st().endLive();
  };
  const onBoxTransform = (phase) => () => {
    const node = trRef.current?.nodes()[0];
    if (!node) return;
    if (phase === 'start') return st().beginLive();
    const size = { width: Math.max(MIN_BOX_SIZE, design.width * node.scaleX()), height: Math.max(MIN_BOX_SIZE, design.height * node.scaleY()) };
    node.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    // keep the placement's upright top-left corner fixed on the page
    const tl = pdfRectToDisplay(geom, sig.rect);
    const rect = clampRectToPage(geom, rectFromDisplayPlacement(geom, { x: tl.x, y: tl.y }, size, sig.rotation, 0));
    st().setSignatureRect(sig.id, rect, { live: true });
    if (phase === 'end') st().endLive();
  };

  return (
    <div ref={wrapRef} className="relative flex-1 overflow-hidden" data-testid="template-view" style={{ backgroundImage: 'repeating-conic-gradient(var(--canvas) 0% 25%, var(--panel-2) 0% 50%)', backgroundSize: '20px 20px' }}>
      <Stage
        ref={stageRef}
        width={box.w}
        height={box.h}
        scaleX={z}
        scaleY={z}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) st().select(sig.id, null);
        }}
      >
        <Layer>
          <Rect x={origin.x} y={origin.y} width={design.width} height={design.height} fill="#ffffff" shadowColor="#0f172a" shadowBlur={18 / z} shadowOpacity={0.18} listening={false} />
          <SignatureNode
            sig={sig}
            frame={{ origin, rotation: 0, design }}
            model={models.get(sig.id).model}
            zoom={z}
            selected
            selectedElementId={selection.elementId}
            imageVersion={imageVersion}
            draggable={false}
            directElementSelect
            settings={settings}
            onSelect={(id, el) => st().select(id, el)}
            onMove={() => null}
            onElementChange={onElementChange}
            setElementGuides={setElementGuides}
            elementGuides={elementGuides}
          />
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            flipEnabled={false}
            keepRatio={false}
            enabledAnchors={['middle-right', 'bottom-center', 'bottom-right']}
            anchorStroke="#4f46e5"
            borderStroke="#4f46e5"
            anchorSize={8}
            onTransformStart={onBoxTransform('start')}
            onTransform={onBoxTransform('live')}
            onTransformEnd={onBoxTransform('end')}
          />
          <Transformer
            ref={elTrRef}
            rotateEnabled
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            flipEnabled={false}
            keepRatio={!!selectedEl?.lockAspectRatio}
            anchorStroke="#db2777"
            borderStroke="#db2777"
            borderDash={[3, 2]}
            anchorSize={7}
          />
        </Layer>
      </Stage>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 shadow-lg">
        <IconButton label="Thu nhỏ" onClick={() => setZoom(Math.max(0.5, z / 1.25))}>
          <ZoomOut className="h-4 w-4" />
        </IconButton>
        <span className="w-12 text-center text-[11.5px] tabular-nums text-[var(--text-muted)]">{Math.round(z * 100)}%</span>
        <IconButton label="Phóng to" onClick={() => setZoom(Math.min(8, z * 1.25))}>
          <ZoomIn className="h-4 w-4" />
        </IconButton>
        <IconButton label="Vừa khung" onClick={() => setZoom(null)}>
          <Maximize className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <Badge tone="brand">{sig.name}</Badge>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
          {Math.round(design.width * 100) / 100} × {Math.round(design.height * 100) / 100} pt
        </span>
      </div>
    </div>
  );
}
