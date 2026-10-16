/**
 * Undo/redo history for immutable snapshots. Supports
 *  - coalescing: consecutive commits with the same key within `windowMs`
 *    collapse into one step (typing in a field = one undo step);
 *  - transactions: begin() … end() wraps a drag/resize so the many live
 *    updates become a single step.
 */
export const HISTORY_LIMIT = 100;

export function createHistory() {
  return { past: [], future: [], lastKey: null, lastAt: 0, txBase: null };
}

export function record(h, prev, { key = null, now = Date.now(), windowMs = 800 } = {}) {
  if (h.txBase) return h; // inside a transaction: the base is recorded on end()
  const coalesce = key && h.lastKey === key && now - h.lastAt < windowMs && h.past.length > 0;
  const past = coalesce ? h.past : [...h.past, prev].slice(-HISTORY_LIMIT);
  return { ...h, past, future: [], lastKey: key, lastAt: now };
}

export function begin(h, current) {
  return h.txBase ? h : { ...h, txBase: current };
}

export function end(h, current) {
  if (!h.txBase) return h;
  const base = h.txBase;
  const cleared = { ...h, txBase: null, lastKey: null };
  return base === current ? cleared : { ...cleared, past: [...h.past, base].slice(-HISTORY_LIMIT), future: [] };
}

export function undo(h, current) {
  if (!h.past.length) return null;
  const prev = h.past[h.past.length - 1];
  return { history: { ...h, past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null, txBase: null }, value: prev };
}

export function redo(h, current) {
  if (!h.future.length) return null;
  const [next, ...rest] = h.future;
  return { history: { ...h, past: [...h.past, current].slice(-HISTORY_LIMIT), future: rest, lastKey: null, txBase: null }, value: next };
}
