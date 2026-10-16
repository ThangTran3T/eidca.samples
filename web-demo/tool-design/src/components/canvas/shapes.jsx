/**
 * Konva shapes that delegate drawing to the shared canvas renderer, so the
 * editor shows exactly what PNG/thumbnail exports produce.
 */
import { forwardRef, useEffect, useReducer } from 'react';
import { Shape } from 'react-konva';
import { drawItemContent, drawBoxStyle } from '../../engines/rendering-engine/canvas-renderer.js';
import { getCachedImage, onImageLoaded } from '../../services/image-service.js';

/** Re-render when async images finish decoding. */
export function useImageVersion() {
  const [v, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => onImageLoaded(bump), []);
  return v;
}

const HIT_PAD = 3;

export const ItemShape = forwardRef(function ItemShape({ item, zoom, showPlaceholders = true, imageVersion, ...props }, ref) {
  return (
    <Shape
      ref={ref}
      id={item.id}
      name="element"
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      opacity={item.visible ? item.opacity : 0.18}
      perfectDrawEnabled={false}
      // imageVersion is read so the shape redraws when images load
      data-image-version={imageVersion}
      sceneFunc={(ctx) => {
        drawItemContent(ctx._context, item, { getImage: getCachedImage, showPlaceholders, placeholderScale: zoom });
      }}
      hitFunc={(ctx, shape) => {
        ctx.beginPath();
        const pad = HIT_PAD / zoom;
        ctx.rect(-pad, -pad, Math.max(item.width, 0) + pad * 2, Math.max(item.height, 0) + pad * 2);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
      {...props}
    />
  );
});

export function BoxStyleShape({ model }) {
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        drawBoxStyle(ctx._context, model);
      }}
    />
  );
}
