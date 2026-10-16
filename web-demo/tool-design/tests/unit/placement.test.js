import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { suggestPlacement } from '../../src/features/templates/placement.js';
import { buildTemplateLibrary } from '../../src/features/templates/library.js';
import { evaluateCompliance, analyzePixels } from '../../src/engines/compliance-engine/index.js';
import { createPageGeometry, pdfRectToDisplay, displaySize } from '../../src/engines/coordinate-engine/index.js';
import { createSignatureFromTemplate } from '../../src/features/signatures/operations.js';
import { pngDataUrl, rgbaBuffer } from '../helpers/png.js';

const manifest = JSON.parse(await readFile(new URL('../../public/samples/manifest.json', import.meta.url), 'utf8'));
const qd = manifest.find((m) => m.file === 'quyet-dinh-mau.pdf');
const A4 = createPageGeometry({ mediaBox: [0, 0, 595.28, 841.89] });
const pageGeoms = { 1: A4, 2: A4 };

function disc(color, size = 64) {
  const px = (x, y) => ((x - size / 2) ** 2 + (y - size / 2) ** 2 < (size / 2 - 2) ** 2 ? [...color, 255] : [0, 0, 0, 0]);
  return { src: pngDataUrl(size, size, px), width: size, height: size, analysis: analyzePixels(rgbaBuffer(size, size, px), 'image/png') };
}
const lib = Object.fromEntries(buildTemplateLibrary({ seal: disc([215, 25, 32]), signature: disc([31, 63, 191]) }).map((t) => [t.id, t]));
const place = (tpl, s, page = 1) => ({ ...createSignatureFromTemplate(tpl, { page, geom: A4 }), rect: s.rect, page: s.page });

describe('Decree 30 default placement', () => {
  it('puts Preset C and A2 in the top-right corner of page 1 and passes the placement rules', () => {
    for (const id of ['nd30-electronic-copy', 'nd30-attachment']) {
      const s = suggestPlacement(lib[id], { pageGeoms, currentPage: 2 });
      expect(s.page).toBe(1);
      const d = pdfRectToDisplay(A4, s.rect);
      expect(d.x + d.width).toBeCloseTo(displaySize(A4).width - 15 * 72 / 25.4);
      const sig = place(lib[id], s);
      expect(evaluateCompliance({ template: sig.template, signature: sig, geom: A4 }).overall).toBe('compliant');
    }
  });

  it('centres Preset B in the sample decision signature block', () => {
    const s = suggestPlacement(lib['nd30-authorized-person'], { pageGeoms, sampleMeta: qd });
    expect(s.rect.x + s.rect.width / 2).toBeCloseTo(qd.signatureBlock.centerX);
    expect(s.rect.y).toBeGreaterThan(qd.signatureBlock.nameTopY);
    expect(s.rect.y + s.rect.height).toBeLessThan(qd.signatureBlock.titleBottomY + 12);
  });

  it('places Preset A so the seal covers ~1/3 of the signer image on the left', () => {
    const sb = suggestPlacement(lib['nd30-authorized-person'], { pageGeoms, sampleMeta: qd });
    const signer = place(lib['nd30-authorized-person'], sb);
    const sa = suggestPlacement(lib['nd30-organization'], { pageGeoms, signatures: [signer], currentPage: 1 });
    const seal = place(lib['nd30-organization'], sa);
    const r = evaluateCompliance({ template: seal.template, signature: seal, geom: A4, documentSignatures: [signer, seal] });
    expect(r.results.find((x) => x.ruleId === 'ND30-A-06').status).toBe('pass');
  });

  it('returns null for custom templates and when context is missing', () => {
    expect(suggestPlacement(lib.personal, { pageGeoms })).toBe(null);
    expect(suggestPlacement(lib['nd30-organization'], { pageGeoms, signatures: [] })).toBe(null);
    expect(suggestPlacement(lib['nd30-authorized-person'], { pageGeoms })).toBe(null);
  });
});
