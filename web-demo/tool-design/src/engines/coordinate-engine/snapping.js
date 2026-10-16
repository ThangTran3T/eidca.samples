/**
 * Snapping for drag/resize: aligns the moving box's edges and centre lines
 * to target lines (page edges/centre, other boxes) and optionally to a grid.
 * Pure — works in any space (display points or design points).
 */

export function boxLines(b) {
  return {
    x: [b.x, b.x + b.width / 2, b.x + b.width],
    y: [b.y, b.y + b.height / 2, b.y + b.height],
  };
}

/** Collect snap targets from a container rect and sibling boxes. */
export function snapTargets(container, others = []) {
  const xs = [container.x, container.x + container.width / 2, container.x + container.width];
  const ys = [container.y, container.y + container.height / 2, container.y + container.height];
  for (const o of others) {
    const l = boxLines(o);
    xs.push(...l.x);
    ys.push(...l.y);
  }
  return { x: xs, y: ys };
}

function bestOffset(lines, targets, threshold) {
  let best = null;
  for (const line of lines) {
    for (const t of targets) {
      const d = t - line;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
    }
  }
  return best;
}

/**
 * @param {{x,y,width,height}} box candidate position
 * @param {{x:number[], y:number[]}} targets
 * @param {{threshold:number, grid?:number}} opts grid snapping applies when no guide matched on that axis
 * @returns {{ x, y, guides: {axis:'x'|'y', at:number}[] }}
 */
export function snapBox(box, targets, { threshold, grid = 0 }) {
  const lines = boxLines(box);
  const guides = [];
  let { x, y } = box;
  const bx = bestOffset(lines.x, targets.x, threshold);
  if (bx) {
    x += bx.d;
    guides.push({ axis: 'x', at: bx.at });
  } else if (grid > 0) x = Math.round(x / grid) * grid;
  const by = bestOffset(lines.y, targets.y, threshold);
  if (by) {
    y += by.d;
    guides.push({ axis: 'y', at: by.at });
  } else if (grid > 0) y = Math.round(y / grid) * grid;
  return { x, y, guides };
}

export function snapValue(v, grid) {
  return grid > 0 ? Math.round(v / grid) * grid : v;
}
