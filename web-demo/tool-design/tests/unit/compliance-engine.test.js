import { describe, it, expect } from 'vitest';
import { evaluateCompliance, aggregate, analyzePixels, classifyInk, RULES } from '../../src/engines/compliance-engine/index.js';
import { buildTemplateLibrary } from '../../src/features/templates/library.js';
import { createPageGeometry, mmToPoints } from '../../src/engines/coordinate-engine/index.js';
import { clone, createElement } from '../../src/engines/template-engine/index.js';
import { pngDataUrl, rgbaBuffer } from '../helpers/png.js';
import { templateSchema } from '../../src/schemas/designer-schema.js';

// Synthetic artwork: a coloured disc on a transparent background.
function disc(color, { transparent = true, size = 64 } = {}) {
  const px = (x, y) => {
    const inside = (x - size / 2) ** 2 + (y - size / 2) ** 2 < (size / 2 - 2) ** 2;
    if (inside) return [...color, 255];
    return transparent ? [0, 0, 0, 0] : [255, 255, 255, 255];
  };
  const analysis = analyzePixels(rgbaBuffer(size, size, px), 'image/png');
  return { src: pngDataUrl(size, size, px), width: size, height: size, analysis };
}
const RED = [215, 25, 32];
const BLUE = [31, 63, 191];

function lib(assets) {
  return Object.fromEntries(buildTemplateLibrary(assets).map((t) => [t.id, t]));
}
const A4 = createPageGeometry({ mediaBox: [0, 0, 595.28, 841.89] });
const resultOf = (report, id) => report.results.find((r) => r.ruleId === id);

describe('image analysis', () => {
  it('classifies ink colours', () => {
    expect(classifyInk(...RED)).toBe('red');
    expect(classifyInk(...BLUE)).toBe('blue');
    expect(classifyInk(10, 10, 10)).toBe('black');
    expect(classifyInk(255, 255, 255)).toBe('white');
  });
  it('detects transparency, dominant colour and content bounds', () => {
    const a = disc(RED).analysis;
    expect(a.hasAlpha).toBe(true);
    expect(a.cornersTransparent).toBe(true);
    expect(a.dominantColor).toBe('red');
    expect(a.contentBox.width).toBeGreaterThan(0.85);
    const opaque = disc(BLUE, { transparent: false }).analysis;
    expect(opaque.hasAlpha).toBe(false);
    expect(opaque.cornersTransparent).toBe(false);
    expect(opaque.dominantColor).toBe('blue');
  });
});

describe('rule registry', () => {
  it('every rule has id, legal reference, applicable types, severity and explanation', () => {
    const ids = new Set();
    for (const r of RULES) {
      expect(ids.has(r.id), `duplicate ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(r.legalRef.document).toBe('Nghị định 30/2020/NĐ-CP');
      expect(r.legalRef.location).toMatch(/Phụ lục I|Điều/);
      expect(r.legalRef.quote.length).toBeGreaterThan(20);
      expect(r.profiles.length).toBeGreaterThan(0);
      expect(['error', 'warning']).toContain(r.severity);
      expect(['auto', 'heuristic', 'manual']).toContain(r.kind);
      expect(r.explanation.length).toBeGreaterThan(10);
    }
  });
});

describe('aggregation', () => {
  it('is compliant only when every rule passed', () => {
    expect(aggregate([{ status: 'pass' }, { status: 'pass' }])).toBe('compliant');
    expect(aggregate([{ status: 'pass' }, { status: 'manual', severity: 'error' }])).toBe('warning');
    expect(aggregate([{ status: 'pass' }, { status: 'not-evaluated', severity: 'error' }])).toBe('warning');
    expect(aggregate([{ status: 'fail', severity: 'warning' }])).toBe('warning');
    expect(aggregate([{ status: 'fail', severity: 'error' }, { status: 'pass' }])).toBe('non-compliant');
    expect(aggregate([])).toBe('not-evaluated');
  });
  it('custom templates are not evaluated (Custom Mode)', () => {
    const t = lib({}).personal;
    const r = evaluateCompliance({ template: t });
    expect(r.overall).toBe('not-evaluated');
    expect(r.customMode).toBe(true);
  });
});

describe('Preset B — người có thẩm quyền', () => {
  const sig = (template) => ({ id: 'b', page: 1, rect: { x: 372, y: 207, width: 120, height: 56 }, rotation: 0, visible: true, template });

  it('fails with the built-in specimen until a real image is attested', () => {
    const t = lib({ signature: { ...disc(BLUE) } })['nd30-authorized-person'];
    const r = evaluateCompliance({ template: t, signature: sig(t), geom: A4 });
    expect(resultOf(r, 'ND30-B-01').status).toBe('pass');
    expect(resultOf(r, 'ND30-B-02').status).toBe('pass');
    expect(resultOf(r, 'ND30-B-03').status).toBe('pass');
    expect(resultOf(r, 'ND30-B-04').status).toBe('pass');
    expect(resultOf(r, 'ND30-B-M1').status).toBe('fail'); // specimen
    expect(r.overall).toBe('non-compliant');
  });

  it('flags red ink, JPEG and opaque backgrounds', () => {
    const t = lib({ signature: disc(RED, { transparent: false }) })['nd30-authorized-person'];
    t.elements[0].image.src = t.elements[0].image.src.replace('image/png', 'image/jpeg');
    const r = evaluateCompliance({ template: t, signature: sig(t), geom: A4 });
    expect(resultOf(r, 'ND30-B-02').status).toBe('fail');
    expect(resultOf(r, 'ND30-B-03').status).toBe('fail');
    expect(resultOf(r, 'ND30-B-04').status).toBe('fail');
  });

  it('checks centring between title and name using the PDF text layer', () => {
    const t = lib({ signature: disc(BLUE) })['nd30-authorized-person'];
    t.elements[0].image.isSpecimen = false;
    t.complianceAttestations = { 'ND30-B-M1': { confirmed: true, note: 'Ảnh chữ ký do người ký cung cấp', at: '2026-10-17' } };
    // title baseline at y=290 centred on x=432; name baseline y=195
    const pageText = { 1: [
      { str: 'PHÓ GIÁM ĐỐC', x: 382, y: 290, width: 100, height: 14 },
      { str: 'Trần Thị Minh Anh', x: 372, y: 195, width: 120, height: 14 },
    ] };
    const ok = evaluateCompliance({ template: t, signature: sig(t), geom: A4, pageText });
    expect(resultOf(ok, 'ND30-B-05').status).toBe('pass');
    expect(ok.overall).toBe('compliant');

    const off = evaluateCompliance({ template: t, signature: { ...sig(t), rect: { x: 100, y: 207, width: 120, height: 56 } }, geom: A4, pageText });
    expect(resultOf(off, 'ND30-B-05').status).toBe('fail');
    expect(off.overall).toBe('warning'); // heuristic rule → warning, not non-compliant

    const noText = evaluateCompliance({ template: t, signature: sig(t), geom: A4 });
    expect(resultOf(noText, 'ND30-B-05').status).toBe('manual');
    expect(noText.overall).toBe('warning');
  });

  it('requires manual review when extra text is displayed', () => {
    const t = lib({ signature: disc(BLUE) })['nd30-authorized-person'];
    t.elements.push(createElement('text', { text: { content: '{{signer.name}}' } }));
    const r = evaluateCompliance({ template: t, signature: sig(t), geom: A4 });
    expect(resultOf(r, 'ND30-B-X1').status).toBe('manual');
  });
});

describe('Preset A — cơ quan, tổ chức', () => {
  const signerTpl = (assets) => lib(assets)['nd30-authorized-person'];

  function setup(sealX) {
    const assets = { seal: disc(RED), signature: disc(BLUE) };
    const L = lib(assets);
    const signer = { id: 'signer', page: 1, rect: { x: 372, y: 207, width: 120, height: 56 }, rotation: 0, template: L['nd30-authorized-person'] };
    const sealTpl = L['nd30-organization'];
    const sealSize = sealTpl.size.width;
    const seal = { id: 'seal', page: 1, rect: { x: sealX, y: 190, width: sealSize, height: sealSize }, rotation: 0, template: sealTpl };
    return { signer, seal, docs: [signer, seal] };
  }

  it('measures the seal at its declared physical size (±1 mm)', () => {
    const { seal, docs } = setup(300);
    const r = evaluateCompliance({ template: seal.template, signature: seal, geom: A4, documentSignatures: docs });
    // disc art leaves a 2px transparent margin on a 64px canvas → ~0.94 of 36mm ≈ 33.9 mm → fails
    expect(resultOf(r, 'ND30-A-05').status).toBe('fail');
    const t = clone(seal.template);
    t.elements[0].image.physicalSizeMm = 33.8;
    const r2 = evaluateCompliance({ template: t, signature: { ...seal, template: t }, geom: A4, documentSignatures: docs });
    expect(resultOf(r2, 'ND30-A-05').status).toBe('pass');
    t.elements[0].image.physicalSizeMm = null;
    expect(resultOf(evaluateCompliance({ template: t, signature: seal, geom: A4 }), 'ND30-A-05').status).toBe('not-evaluated');
  });

  it('checks the ~1/3 overlap on the left of the signer image', () => {
    // signer image content spans roughly x∈[400,464] (contain-fit disc in 120×56 box)
    const base = setup(0);
    const sigImg = base.signer.template.elements[0];
    expect(sigImg).toBeTruthy();
    const sealW = base.seal.template.size.width;
    const cases = [
      [400 + 64 / 3 - sealW, 'pass'], // seal right edge covers 1/3 of the signer image from the left
      [400 - sealW - 5, 'fail'], // no overlap
      [400 + 64 * 0.8 - sealW, 'fail'], // covers too much
    ];
    for (const [x, expected] of cases) {
      const { seal, docs } = setup(x);
      const r = evaluateCompliance({ template: seal.template, signature: seal, geom: A4, documentSignatures: docs });
      expect(resultOf(r, 'ND30-A-06').status, `x=${x}`).toBe(expected);
    }
  });

  it('is not evaluated without an authorized-person signature on the page', () => {
    const { seal } = setup(300);
    const r = evaluateCompliance({ template: seal.template, signature: seal, geom: A4, documentSignatures: [seal] });
    expect(resultOf(r, 'ND30-A-06').status).toBe('not-evaluated');
  });

  it('rejects a blue seal', () => {
    const t = lib({ seal: disc(BLUE) })['nd30-organization'];
    expect(resultOf(evaluateCompliance({ template: t }), 'ND30-A-04').status).toBe('fail');
    expect(signerTpl({}).complianceProfile).toBe('nd30-authorized-person');
  });
});

describe('Preset C — bản sao điện tử', () => {
  const t0 = () => lib({})['nd30-electronic-copy'];
  const placeTopRight = { id: 'c', page: 1, rect: { x: 380, y: 770, width: 200, height: 42 }, rotation: 0, visible: true };

  it('the built-in preset is fully compliant when placed top-right on page 1', () => {
    const t = t0();
    const r = evaluateCompliance({ template: t, signature: { ...placeTopRight, template: t }, geom: A4 });
    const notPass = r.results.filter((x) => x.status !== 'pass').map((x) => `${x.ruleId}:${x.status}:${x.message}`);
    expect(notPass).toEqual([]);
    expect(r.overall).toBe('compliant');
  });

  it.each([
    ['page 2', (t, s) => [t, { ...s, page: 2 }], 'ND30-C-P1', 'fail'],
    ['bottom-left', (t, s) => [t, { ...s, rect: { ...s.rect, x: 40, y: 40 } }], 'ND30-C-P2', 'fail'],
    ['font', (t, s) => ((t.elements[0].text.fontFamily = 'Arial'), [t, s]), 'ND30-C-T1', 'fail'],
    ['uppercase', (t, s) => ((t.elements[0].text.textTransform = 'uppercase'), [t, s]), 'ND30-C-T2', 'fail'],
    ['italic', (t, s) => ((t.elements[0].text.fontStyle = 'italic'), [t, s]), 'ND30-C-T3', 'fail'],
    ['size 11', (t, s) => ((t.elements[0].text.fontSize = 11), [t, s]), 'ND30-C-T4', 'fail'],
    ['red', (t, s) => ((t.elements[0].text.color = '#ff0000'), [t, s]), 'ND30-C-T5', 'fail'],
    ['bold', (t, s) => ((t.elements[0].text.fontWeight = 'bold'), [t, s]), 'ND30-C-T6', 'fail'],
    ['non-ISO', (t, s) => ((t.dateTime.dateFormat = 'DD/MM/YYYY'), [t, s]), 'ND30-C-T7', 'fail'],
    ['UTC', (t, s) => ((t.dateTime.timeZone = 'UTC'), [t, s]), 'ND30-C-T7', 'fail'],
    ['image', (t, s) => (t.elements.push(createElement('image', { image: { src: disc(RED).src } })), [t, s]), 'ND30-C-P3', 'fail'],
    ['missing copy form', (t, s) => ((t.elements[0].text.content = '{{copy.organization}} {{signing.datetime}}'), [t, s]), 'ND30-C-I1', 'fail'],
    ['bad copy form', (t, s) => ((t.sampleData.copy.form = 'BẢN SAO'), [t, s]), 'ND30-C-I2', 'fail'],
  ])('%s → %s', (_, mutate, ruleId, expected) => {
    const [t, s] = mutate(t0(), { ...placeTopRight });
    const r = evaluateCompliance({ template: t, signature: { ...s, template: t }, geom: A4 });
    expect(resultOf(r, ruleId).status).toBe(expected);
    if (resultOf(r, ruleId).severity === 'error') expect(r.overall).toBe('non-compliant');
  });

  it('uses runtime data in runtime mode', () => {
    const t = t0();
    const r = evaluateCompliance({ template: t, signature: { ...placeTopRight, template: t }, geom: A4, mode: 'runtime', runtimeData: { copy: { form: 'TRÍCH SAO' } } });
    expect(resultOf(r, 'ND30-C-I2').status).toBe('pass');
  });

  it('placement-dependent rules are not evaluated without a PDF', () => {
    const r = evaluateCompliance({ template: t0() });
    expect(resultOf(r, 'ND30-C-P2').status).toBe('not-evaluated');
    expect(r.overall).toBe('warning');
  });
});

describe('Preset A2 — văn bản kèm theo', () => {
  it('is compliant when placed top-right on page 1', () => {
    const t = lib({})['nd30-attachment'];
    const r = evaluateCompliance({ template: t, signature: { id: 'k', page: 1, rect: { x: 380, y: 790, width: 200, height: 28 }, rotation: 0, template: t }, geom: A4 });
    expect(r.overall).toBe('compliant');
  });
});

describe('library', () => {
  it('provides the 10 required templates (+ extras), all valid against the designer schema', () => {
    const all = buildTemplateLibrary({ seal: disc(RED), signature: disc(BLUE), logo: disc(BLUE), hospitalLogo: disc([15, 118, 110]) });
    expect(all.length).toBeGreaterThanOrEqual(10);
    for (const t of all) {
      const parsed = templateSchema.safeParse(t);
      expect(parsed.success, `${t.id}: ${JSON.stringify(parsed.error?.issues?.slice(0, 3))}`).toBe(true);
      expect(t.sampleData.signer.name).toBeTruthy();
    }
    expect(all.map((t) => t.id)).toEqual(expect.arrayContaining(['nd30-authorized-person', 'nd30-organization', 'nd30-electronic-copy', 'personal', 'personal-organization', 'enterprise', 'doctor', 'hospital', 'contract', 'custom-blank']));
  });
  it('the organisation preset seal box equals the declared seal diameter', () => {
    const t = lib({})['nd30-organization'];
    expect(t.size.width).toBeCloseTo(mmToPoints(36));
  });
});
