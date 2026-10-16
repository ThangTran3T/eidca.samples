/**
 * Default placement for Decree 30 presets so they start out where the law
 * puts them. Returns { page, rect } in PDF space, or null for "centre on the
 * current page".
 *   Preset B → centred between the signer's title and name (sample manifest)
 *   Preset A → seal covering ~1/3 of the signer image, on its left
 *   Presets C / A2 → top-right corner of page 1
 */
import { mmToPoints, displaySize, rectFromDisplayPlacement, clampRectToPage, rectSizeForDesign } from '../../engines/coordinate-engine/index.js';
import { imageContentUserRect, visibleImages } from '../../engines/compliance-engine/rules.js';

const MARGIN_RIGHT = mmToPoints(15);
const MARGIN_TOP = mmToPoints(10);

export function suggestPlacement(template, { pageGeoms, sampleMeta, signatures = [], currentPage = 1 }) {
  const profile = template.complianceProfile;
  if (!profile) return null;

  if (profile === 'nd30-electronic-copy' || profile === 'nd30-attachment') {
    const g = pageGeoms[1];
    if (!g) return null;
    const size = displaySize(g);
    const tl = { x: size.width - MARGIN_RIGHT - template.size.width, y: MARGIN_TOP };
    return { page: 1, rect: clampRectToPage(g, rectFromDisplayPlacement(g, tl, template.size, 0, 0)) };
  }

  if (profile === 'nd30-authorized-person' && sampleMeta?.signatureBlock) {
    const b = sampleMeta.signatureBlock;
    const g = pageGeoms[b.page];
    if (!g) return null;
    const { width, height } = rectSizeForDesign(g, template.size, 0);
    const midY = (b.titleBottomY + b.nameTopY) / 2 + 6; // nameTopY is the baseline of the name line
    return { page: b.page, rect: clampRectToPage(g, { x: b.centerX - width / 2, y: midY - height / 2, width, height }) };
  }

  if (profile === 'nd30-organization') {
    const signer =
      signatures.find((s) => s.page === currentPage && s.template.complianceProfile === 'nd30-authorized-person') ??
      signatures.find((s) => s.template.complianceProfile === 'nd30-authorized-person');
    const img = signer && visibleImages(signer.template, 'hand-signature').find((e) => e.image.src);
    const g = signer && pageGeoms[signer.page];
    if (!img || !g) return null;
    const r = imageContentUserRect(g, signer, img);
    const { width, height } = rectSizeForDesign(g, template.size, 0);
    // The seal's *inked* content should end one third into the signer image.
    const sealImg = visibleImages(template, 'seal')[0];
    const cb = sealImg?.image.analysis?.contentBox ?? { x: 0, width: 1 };
    const contentRight = (cb.x + cb.width) * width;
    const x = r.x + r.width / 3 - contentRight;
    const y = r.y + r.height / 2 - height / 2;
    return { page: signer.page, rect: clampRectToPage(g, { x, y, width, height }) };
  }
  return null;
}
