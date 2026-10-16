/**
 * One signature appearance on a Konva stage whose units are display points
 * (stage scale = zoom). The outer group sits at the design origin and is
 * rotated so content stays upright for the reader; all geometry results are
 * reported back as (origin, design size) and converted to PDF space by the
 * parent via the coordinate engine.
 */
import { memo, useRef } from 'react';
import { Group, Rect, Line } from 'react-konva';
import { ItemShape, BoxStyleShape } from './shapes.jsx';
import { snapBox, snapTargets } from '../../engines/coordinate-engine/snapping.js';

const MIN = 6;

function SignatureNodeImpl({
  sig,
  frame, // { origin, rotation, design }
  model,
  zoom,
  selected,
  selectedElementId,
  imageVersion,
  draggable = true,
  directElementSelect = false, // template view: single click selects elements
  settings,
  onSelect,
  onMove, // (origin, phase)
  onElementChange, // (elementId, patch, phase)
  setElementGuides,
  elementGuides,
  registerNode,
}) {
  const groupRef = useRef(null);
  const { origin, rotation, design } = frame;
  const elementMode = selected && !!selectedElementId;
  const canDragBox = draggable && !sig.locked && !elementMode;

  const selectFromEvent = (e) => {
    const target = e.target;
    const isElement = target.name() === 'element';
    if (directElementSelect || (selected && (elementMode || e.evt?.detail >= 2))) {
      onSelect(sig.id, isElement ? target.id() : null);
    } else if (!selected) {
      onSelect(sig.id, null);
    }
  };

  // ── element dragging with design-space snapping ─────────────────────────
  const elementDragMove = (el, node) => {
    let x = node.x();
    let y = node.y();
    if (settings.snap && !el.rotation) {
      const others = model.items.filter((i) => i.id !== el.id && i.visible).map((i) => ({ x: i.x, y: i.y, width: i.width, height: i.height }));
      const targets = snapTargets({ x: 0, y: 0, width: design.width, height: design.height }, others);
      const r = snapBox({ x, y, width: el.width, height: el.height }, targets, { threshold: 4 / zoom, grid: settings.grid ? settings.gridSize : 0 });
      x = r.x;
      y = r.y;
      node.position({ x, y });
      setElementGuides?.(settings.guides ? r.guides : []);
    }
    onElementChange(el.id, { x, y }, 'live');
  };

  return (
    <Group
      ref={(n) => {
        groupRef.current = n;
        registerNode?.(sig.id, n);
      }}
      id={`sig-${sig.id}`}
      name="signature"
      x={origin.x}
      y={origin.y}
      rotation={rotation}
      opacity={sig.visible === false ? 0.35 : sig.opacity ?? 1}
      draggable={canDragBox}
      onMouseDown={selectFromEvent}
      onTap={selectFromEvent}
      onDblClick={(e) => {
        if (e.target.name() === 'element') onSelect(sig.id, e.target.id());
      }}
      onDblTap={(e) => {
        if (e.target.name() === 'element') onSelect(sig.id, e.target.id());
      }}
      onDragStart={(e) => {
        if (e.target !== groupRef.current) return;
        onMove(origin, 'start');
      }}
      onDragMove={(e) => {
        if (e.target !== groupRef.current) return;
        const p = onMove({ x: e.target.x(), y: e.target.y() }, 'live');
        if (p) e.target.position(p);
      }}
      onDragEnd={(e) => {
        if (e.target !== groupRef.current) return;
        onMove({ x: e.target.x(), y: e.target.y() }, 'end');
      }}
    >
      <Group clipX={0} clipY={0} clipWidth={design.width} clipHeight={design.height}>
        {/* background hit area for selecting/dragging the whole box */}
        <Rect name="frame-hit" width={design.width} height={design.height} fill="transparent" />
        <BoxStyleShape model={model} />
        {model.items
          .filter((item) => item.visible || item.id === selectedElementId)
          .map((item) => {
            const el = sig.template.elements.find((e) => e.id === item.id);
            const isSel = selected && selectedElementId === item.id;
            return (
              <ItemShape
                key={item.id}
                item={item}
                zoom={zoom}
                imageVersion={imageVersion}
                draggable={isSel && !el?.locked && !sig.locked}
                onDragStart={() => onElementChange(item.id, null, 'start')}
                onDragMove={(e) => elementDragMove(el, e.target)}
                onDragEnd={(e) => {
                  setElementGuides?.([]);
                  onElementChange(item.id, { x: e.target.x(), y: e.target.y() }, 'end');
                }}
                onTransformStart={() => onElementChange(item.id, null, 'start')}
                onTransform={(e) => {
                  const n = e.target;
                  const patch = {
                    x: n.x(),
                    y: n.y(),
                    width: Math.max(1, n.width() * n.scaleX()),
                    height: Math.max(el?.type === 'line' ? 0 : 1, n.height() * n.scaleY()),
                    rotation: Math.round(n.rotation() * 10) / 10,
                  };
                  n.scale({ x: 1, y: 1 });
                  onElementChange(item.id, patch, 'live');
                }}
                onTransformEnd={() => onElementChange(item.id, null, 'end')}
              />
            );
          })}
        {elementMode &&
          (elementGuides ?? []).map((g, i) =>
            g.axis === 'x' ? (
              <Line key={i} points={[g.at, -2000, g.at, 2000]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} listening={false} dash={[4, 3]} />
            ) : (
              <Line key={i} points={[-2000, g.at, 2000, g.at]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} listening={false} dash={[4, 3]} />
            )
          )}
      </Group>
      {/* selection / hover outline (not clipped) */}
      <Rect
        width={design.width}
        height={design.height}
        stroke={selected ? '#4f46e5' : '#6366f1'}
        strokeWidth={selected ? 1.25 : 1}
        opacity={selected ? 1 : 0.55}
        dash={selected && !elementMode ? undefined : [4, 3]}
        strokeScaleEnabled={false}
        listening={false}
      />
      {/* frame node the box Transformer attaches to */}
      <Rect id={`frame-${sig.id}`} name="frame" width={design.width} height={design.height} listening={false} />
    </Group>
  );
}

export const SignatureNode = memo(SignatureNodeImpl);

export { MIN as MIN_BOX_SIZE };
