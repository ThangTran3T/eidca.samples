/**
 * Figma-style layout constraints applied when a signature box is resized.
 * Font sizes are never scaled (legal presets fix them); text reflows instead.
 */

function axis(mode, pos, size, oldTotal, newTotal) {
  if (oldTotal <= 0) return { pos, size };
  const delta = newTotal - oldTotal;
  switch (mode) {
    case 'left':
    case 'top':
      return { pos, size };
    case 'right':
    case 'bottom':
      return { pos: pos + delta, size };
    case 'center':
      return { pos: pos + delta / 2, size };
    case 'stretch':
      return { pos, size: Math.max(1, size + delta) };
    case 'scale':
    default: {
      const k = newTotal / oldTotal;
      return { pos: pos * k, size: Math.max(1, size * k) };
    }
  }
}

export function applyConstraints(element, oldSize, newSize) {
  const c = element.constraints ?? { horizontal: 'scale', vertical: 'scale' };
  const h = axis(c.horizontal, element.x, element.width, oldSize.width, newSize.width);
  const v = axis(c.vertical, element.y, element.height, oldSize.height, newSize.height);
  let width = h.size;
  let height = v.size;
  if (element.lockAspectRatio && element.width > 0 && element.height > 0) {
    const ratio = element.width / element.height;
    // Keep the box inside the area the constraints produced, centred on it.
    if (width / height > ratio) {
      const w = height * ratio;
      return { ...element, x: h.pos + (width - w) / 2, y: v.pos, width: w, height };
    }
    const hh = width / ratio;
    return { ...element, x: h.pos, y: v.pos + (height - hh) / 2, width, height: hh };
  }
  return { ...element, x: h.pos, y: v.pos, width, height };
}

export function resizeTemplate(template, newSize) {
  const oldSize = template.size;
  if (oldSize.width === newSize.width && oldSize.height === newSize.height) return template;
  return {
    ...template,
    size: { width: newSize.width, height: newSize.height },
    elements: template.elements.map((el) => applyConstraints(el, oldSize, newSize)),
  };
}
