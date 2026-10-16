/**
 * Interactive Konva overlay for one PDF page. Stage units are display points
 * (stage.scale = zoom), so every value read from Konva converts to PDF space
 * with the coordinate engine and stays independent of zoom and DPI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Transformer, Line } from 'react-konva';
import { useEditor } from '../../stores/editor-store.js';
import {
  signatureDisplayFrame,
  displayBoxFromFrame,
  displayRectToPdf,
  displayPointToPdf,
  displaySize,
  clampRectToPage,
  rotate,
  applyToPoint,
} from '../../engines/coordinate-engine/index.js';
import { snapBox, snapTargets } from '../../engines/coordinate-engine/snapping.js';
import { resolveTemplate } from '../../engines/template-engine/index.js';
import { fontRegistry } from '../../services/font-service.js';
import { SignatureNode, MIN_BOX_SIZE } from './SignatureNode.jsx';
import { useImageVersion } from './shapes.jsx';

const SNAP_PX = 6;

export function useRenderModels(signatures) {
  const displayMode = useEditor((s) => s.displayMode);
  const runtimeData = useEditor((s) => s.runtimeData);
  const cache = useRef(new Map());
  return useMemo(() => {
    const next = new Map();
    for (const sig of signatures) {
      const prev = cache.current.get(sig.id);
      if (prev && prev.template === sig.template && prev.mode === displayMode && prev.data === runtimeData) next.set(sig.id, prev);
      else next.set(sig.id, { template: sig.template, mode: displayMode, data: runtimeData, model: resolveTemplate(sig.template, { mode: displayMode, runtimeData, measure: fontRegistry.measure }) });
    }
    cache.current = next;
    return next;
  }, [signatures, displayMode, runtimeData]);
}

export function PageOverlay({ pageNumber, geom, zoom, viewRotation }) {
  const signatures = useEditor((s) => s.signatures);
  const selection = useEditor((s) => s.selection);
  const settings = useEditor((s) => s.settings);
  const pageSigs = useMemo(() => signatures.filter((s) => s.page === pageNumber), [signatures, pageNumber]);
  const models = useRenderModels(pageSigs);
  const imageVersion = useImageVersion();
  const [guides, setGuides] = useState([]);
  const [elementGuides, setElementGuides] = useState([]);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const elTrRef = useRef(null);
  const size = displaySize(geom, viewRotation);
  const raf = useRef(0);

  const selectedSig = pageSigs.find((s) => s.id === selection.signatureId) ?? null;
  const selectedEl = selectedSig?.template.elements.find((e) => e.id === selection.elementId) ?? null;

  // Attach transformers to the selected box frame or element.
  useEffect(() => {
    const stage = stageRef.current;
    const boxTr = trRef.current;
    const elTr = elTrRef.current;
    if (!stage || !boxTr || !elTr) return;
    const frame = selectedSig && !selectedEl && !selectedSig.locked ? stage.findOne(`#frame-${selectedSig.id}`) : null;
    boxTr.nodes(frame ? [frame] : []);
    const elNode = selectedSig && selectedEl && !selectedEl.locked && !selectedSig.locked ? stage.findOne(`#${selectedEl.id}`) : null;
    elTr.nodes(elNode ? [elNode] : []);
    boxTr.getLayer()?.batchDraw();
  });

  const toPdfRect = (sig, origin, rotation, design) => clampRectToPage(geom, displayRectToPdf(geom, displayBoxFromFrame(origin, rotation, design), viewRotation));

  const snapTargetsFor = (sigId) => {
    const others = pageSigs.filter((s) => s.id !== sigId).map((s) => signatureDisplayFrame(geom, s, viewRotation).box);
    return snapTargets({ x: 0, y: 0, width: size.width, height: size.height }, others);
  };

  const handleMove = (sig, frame) => (origin, phase) => {
    const st = useEditor.getState();
    if (phase === 'start') {
      st.beginLive();
      if (st.selection.signatureId !== sig.id) st.select(sig.id);
      return null;
    }
    const raw = displayBoxFromFrame(origin, frame.rotation, frame.design);
    let box = raw;
    if (settings.snap) {
      const r = snapBox(box, snapTargetsFor(sig.id), { threshold: SNAP_PX / zoom, grid: settings.grid ? settings.gridSize : 0 });
      box = { ...box, x: r.x, y: r.y };
      setGuides(settings.guides && phase === 'live' ? r.guides : []);
    }
    // keep the box on the page
    box = { ...box, x: Math.min(Math.max(box.x, 0), Math.max(0, size.width - box.width)), y: Math.min(Math.max(box.y, 0), Math.max(0, size.height - box.height)) };
    const corrected = { x: origin.x + box.x - raw.x, y: origin.y + box.y - raw.y };
    const rect = clampRectToPage(geom, displayRectToPdf(geom, box, viewRotation));
    st.setSignatureRect(sig.id, rect, { live: true });
    if (phase === 'end') {
      st.endLive();
      setGuides([]);
    }
    return corrected;
  };

  const handleElementChange = (sig) => (elementId, patch, phase) => {
    const st = useEditor.getState();
    if (phase === 'start') return st.beginLive();
    if (patch) st.updateElement(sig.id, elementId, patch, { live: true });
    if (phase === 'end') st.endLive();
  };

  // Box resize: the Transformer scales the frame rect inside the rotated group.
  const onBoxTransform = (phase) => () => {
    const st = useEditor.getState();
    const node = trRef.current?.nodes()[0];
    if (!node || !selectedSig) return;
    if (phase === 'start') return st.beginLive();
    const frame = signatureDisplayFrame(geom, selectedSig, viewRotation);
    const design = { width: Math.max(MIN_BOX_SIZE, frame.design.width * node.scaleX()), height: Math.max(MIN_BOX_SIZE, frame.design.height * node.scaleY()) };
    const offset = applyToPoint(rotate(frame.rotation), node.x(), node.y());
    const origin = { x: frame.origin.x + offset.x, y: frame.origin.y + offset.y };
    node.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    st.setSignatureRect(selectedSig.id, toPdfRect(selectedSig, origin, frame.rotation, design), { live: true });
    if (phase === 'end') st.endLive();
  };

  const anchorSnap = (oldPos, newPos) => {
    if (!settings.snap || !selectedSig) return newPos;
    const t = snapTargetsFor(selectedSig.id);
    const th = SNAP_PX;
    const snap1 = (v, lines) => {
      let best = v;
      let d = th + 1;
      for (const l of lines) {
        const dist = Math.abs(l * zoom - v);
        if (dist < d) {
          d = dist;
          best = l * zoom;
        }
      }
      if (d > th && settings.grid) return Math.round(v / zoom / settings.gridSize) * settings.gridSize * zoom;
      return d <= th ? best : v;
    };
    return { x: snap1(newPos.x, t.x), y: snap1(newPos.y, t.y) };
  };

  const onPointerMove = () => {
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const pdf = displayPointToPdf(geom, { x: p.x / zoom, y: p.y / zoom }, viewRotation);
      useEditor.getState().setCursor({ page: pageNumber, x: pdf.x, y: pdf.y });
    });
  };

  return (
    <Stage
      ref={stageRef}
      width={size.width * zoom}
      height={size.height * zoom}
      scaleX={zoom}
      scaleY={zoom}
      className="absolute inset-0"
      onMouseMove={onPointerMove}
      onMouseLeave={() => useEditor.getState().setCursor(null)}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) useEditor.getState().clearSelection();
      }}
      onTap={(e) => {
        if (e.target === e.target.getStage()) useEditor.getState().clearSelection();
      }}
    >
      <Layer>
        {pageSigs.map((sig) => {
          const frame = signatureDisplayFrame(geom, sig, viewRotation);
          return (
            <SignatureNode
              key={sig.id}
              sig={sig}
              frame={frame}
              model={models.get(sig.id).model}
              zoom={zoom}
              selected={selection.signatureId === sig.id}
              selectedElementId={selection.signatureId === sig.id ? selection.elementId : null}
              imageVersion={imageVersion}
              settings={settings}
              onSelect={(id, el) => useEditor.getState().select(id, el)}
              onMove={handleMove(sig, frame)}
              onElementChange={handleElementChange(sig)}
              setElementGuides={setElementGuides}
              elementGuides={elementGuides}
            />
          );
        })}
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <Line key={i} points={[g.at, 0, g.at, size.height]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} dash={[4, 3]} listening={false} />
          ) : (
            <Line key={i} points={[0, g.at, size.width, g.at]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} dash={[4, 3]} listening={false} />
          )
        )}
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          flipEnabled={false}
          keepRatio={false}
          ignoreStroke
          anchorSize={8}
          anchorCornerRadius={2}
          anchorStroke="#4f46e5"
          anchorFill="#ffffff"
          borderStroke="#4f46e5"
          borderStrokeWidth={1}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']}
          anchorDragBoundFunc={anchorSnap}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < MIN_BOX_SIZE * zoom || Math.abs(newBox.height) < MIN_BOX_SIZE * zoom ? oldBox : newBox)}
          onTransformStart={onBoxTransform('start')}
          onTransform={onBoxTransform('live')}
          onTransformEnd={onBoxTransform('end')}
        />
        <Transformer
          ref={elTrRef}
          rotateEnabled
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={4}
          flipEnabled={false}
          keepRatio={!!selectedEl?.lockAspectRatio}
          ignoreStroke
          anchorSize={7}
          anchorStroke="#db2777"
          anchorFill="#ffffff"
          borderStroke="#db2777"
          borderDash={[3, 2]}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 2 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
}
