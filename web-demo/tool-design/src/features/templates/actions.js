import { useEditor } from '../../stores/editor-store.js';
import { suggestPlacement } from './placement.js';

/** Add a template to the document, using the Decree 30 default position when one applies. */
export function placeTemplate(template, opts = {}) {
  const st = useEditor.getState();
  let target = {};
  if (!opts.displayTopLeft && st.doc) {
    const s = suggestPlacement(template, { pageGeoms: st.pageGeoms(), sampleMeta: st.doc.sampleMeta, signatures: st.signatures, currentPage: st.currentPage });
    if (s) target = { page: s.page, rect: s.rect };
  }
  const sig = st.addFromTemplate(template, { ...opts, ...target });
  if (target.page && target.page !== opts.page) window.dispatchEvent(new CustomEvent('vneca:scroll-to-page', { detail: target.page }));
  return sig;
}
