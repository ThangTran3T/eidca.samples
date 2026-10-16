import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { exportLegacy, importLegacy, normalizeLegacyInput, detectBase64Image, stripDataUrl } from '../../src/adapters/vneca/legacy-adapter.js';
import { vnecaLegacyAdapter, getAdapter } from '../../src/adapters/index.js';
import { legacySignPropsSchema } from '../../src/schemas/legacy-schema.js';
import { buildTemplateLibrary } from '../../src/features/templates/library.js';
import { createElement, createTemplate } from '../../src/engines/template-engine/index.js';
import { createPageGeometry } from '../../src/engines/coordinate-engine/index.js';
import { pngDataUrl } from '../helpers/png.js';

// Real fixtures from this repository (docs/)
const repoTemplate = JSON.parse(await readFile(new URL('../../../../docs/sign_props_template.json', import.meta.url), 'utf8'));
const API_REFERENCE_STRING =
  '[{\\"page\\":1,\\"lLx\\":65,\\"lLy\\":320,\\"width\\":260,\\"height\\":90,\\"template\\":\\"right\\",\\"show_info\\":[\\"reason\\",\\"location\\",\\"contact\\",\\"name\\",\\"org\\",\\"date\\"],\\"location\\":\\"HCM city\\",\\"location_label\\":\\"Tại: Phòng giao dịch\\",\\"reason\\":\\"Ký test\\",\\"reason_label\\":\\"\\",\\"contact\\":\\"Giám đốc\\",\\"contact_label\\":\\"Email: eidca.vn@gmail.com\\",\\"date_label\\":\\"Ngày ký\\",\\"text_color\\":\\"#0000ff\\",\\"font_size\\":11,\\"sign_visibility\\":\\"shown\\",\\"watermark_pos\\":\\"center\\",\\"watermark_img_b64\\":\\"\\",\\"hand_sig_img_b64\\":\\"\\"}]';

const SUPPORTED = ['page', 'lLx', 'lLy', 'width', 'height', 'template', 'show_info', 'location', 'location_label', 'reason', 'reason_label', 'contact', 'contact_label', 'date_label', 'text_color', 'font_size', 'sign_visibility', 'watermark_pos', 'watermark_img_b64', 'hand_sig_img_b64'];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const PNG = pngDataUrl(4, 4, () => [30, 60, 200, 255]);

describe('legacy input normalisation', () => {
  it('accepts object, array, JSON string, double-encoded string and request payloads', () => {
    expect(normalizeLegacyInput(repoTemplate)).toHaveLength(1);
    expect(normalizeLegacyInput([repoTemplate, repoTemplate])).toHaveLength(2);
    expect(normalizeLegacyInput(JSON.stringify([repoTemplate]))).toHaveLength(1);
    expect(normalizeLegacyInput(JSON.stringify(JSON.stringify([repoTemplate])))).toHaveLength(1);
    expect(normalizeLegacyInput({ file_base64: 'x', sign_props: repoTemplate })).toHaveLength(1);
    // the documented multipart form: an escaped JSON array string
    expect(normalizeLegacyInput(`"${API_REFERENCE_STRING}"`)).toHaveLength(1);
  });
  it('rejects garbage', () => {
    expect(() => normalizeLegacyInput('{not json')).toThrow();
    expect(() => normalizeLegacyInput(42)).toThrow();
  });
});

describe('legacy import', () => {
  it('imports the repository sample and preserves every supported field on re-export', () => {
    const { signatures, warnings, errors } = importLegacy(repoTemplate);
    expect(errors).toEqual([]);
    expect(signatures).toHaveLength(1);
    expect(warnings[0].code).toBe('layout-synthesized'); // honest about synthetic layout
    const s = signatures[0];
    expect(s.rect).toEqual({ x: 47, y: 693, width: 167, height: 95 });
    const { payload } = exportLegacy(signatures);
    const exported = payload[0];
    expect(pick(exported, SUPPORTED)).toEqual(pick(repoTemplate, SUPPORTED));
    // legacy-only fields not in the base list survive too
    expect(exported.hand_sig_pos).toBeUndefined(); // no hand image in the sample → nothing to position
  });

  it('round-trips the documented API reference example (multipart string form)', () => {
    const original = JSON.parse(JSON.parse(`"${API_REFERENCE_STRING}"`))[0];
    const { signatures } = importLegacy(`"${API_REFERENCE_STRING}"`);
    expect(pick(exportLegacy(signatures).payload[0], SUPPORTED)).toEqual(pick(original, SUPPORTED));
  });

  it('preserves unknown fields verbatim and warns about them', () => {
    const { signatures, warnings } = importLegacy({ ...repoTemplate, custom_flag: true, nested: { a: 1 } });
    expect(warnings.some((w) => w.code === 'unknown-fields')).toBe(true);
    const out = exportLegacy(signatures).payload[0];
    expect(out.custom_flag).toBe(true);
    expect(out.nested).toEqual({ a: 1 });
  });

  it('builds hand-signature and watermark elements and keeps image bytes', () => {
    const b64 = stripDataUrl(PNG);
    const { signatures } = importLegacy({ ...repoTemplate, template: 'left', hand_sig_img_b64: b64, hand_sig_pos: 'left', hand_sig_index: 'bottom', watermark_img_b64: b64, watermark_pos: 'top-right' });
    const els = signatures[0].template.elements;
    const hand = els.find((e) => e.role === 'hand-signature');
    expect(hand.x).toBeLessThan(signatures[0].template.size.width / 2);
    expect(els.indexOf(hand)).toBeLessThan(els.findIndex((e) => e.type === 'text')); // index bottom
    const out = exportLegacy(signatures).payload[0];
    expect(out.hand_sig_img_b64).toBe(b64);
    expect(out.watermark_img_b64).toBe(b64);
    expect(out.hand_sig_pos).toBe('left');
    expect(out.hand_sig_index).toBe('bottom');
    expect(out.watermark_pos).toBe('top-right');
  });

  it('detects image types from base64 (incl. the WebP watermark used in web-demo/sign)', async () => {
    const html = await readFile(new URL('../../../sign/index.html', import.meta.url), 'utf8');
    const webp = /"watermark_img_b64":\s*"([^"]+)"/.exec(html)[1];
    expect(detectBase64Image(webp)).toBe('image/webp');
    expect(detectBase64Image(stripDataUrl(PNG))).toBe('image/png');
    expect(detectBase64Image('/9j/4AAQ')).toBe('image/jpeg');
    const { warnings } = importLegacy({ ...repoTemplate, watermark_img_b64: webp });
    expect(warnings.some((w) => w.code === 'image-converted')).toBe(true);
  });

  it('reports schema errors per item without aborting the others', () => {
    const { signatures, errors } = importLegacy([repoTemplate, { page: 0, lLx: 'a' }]);
    expect(signatures).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/#2/);
  });

  it('honours sign_visibility hidden and swaps design size on rotated pages', () => {
    const geom = createPageGeometry({ mediaBox: [0, 0, 595, 842], rotate: 90 });
    const { signatures } = importLegacy({ ...repoTemplate, sign_visibility: 'hidden' }, { pageGeoms: { 1: geom } });
    expect(signatures[0].visible).toBe(false);
    expect(signatures[0].template.size).toEqual({ width: 95, height: 167 });
    expect(exportLegacy(signatures).payload[0].sign_visibility).toBe('hidden');
  });
});

describe('legacy export', () => {
  const lib = Object.fromEntries(buildTemplateLibrary({ signature: { src: PNG, width: 4, height: 4 }, seal: { src: PNG, width: 4, height: 4 }, logo: { src: PNG, width: 4, height: 4 }, hospitalLogo: { src: PNG, width: 4, height: 4 } }).map((t) => [t.id, t]));
  const place = (template, extra = {}) => ({ id: 's1', name: 'Chữ ký 1', page: 1, rect: { x: 47.4, y: 693.6, width: 167.2, height: 95 }, rotation: 0, opacity: 1, visible: true, template, ...extra });

  it('produces schema-valid legacy objects for every library template', () => {
    for (const t of Object.values(lib)) {
      const { payload } = exportLegacy([place(t)]);
      const r = legacySignPropsSchema.safeParse(payload[0]);
      expect(r.success, `${t.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it('maps the enterprise template to text_only with labels, colour and size', () => {
    const { payload } = exportLegacy([place(lib.enterprise)]);
    const o = payload[0];
    expect(o).toMatchObject({ page: 1, lLx: 47, lLy: 694, width: 167, height: 95, template: 'text_only', text_color: '#ff0033', font_size: 9, reason: 'Ký hợp đồng điện tử', location: 'Hà Nội', reason_label: 'Lý do:', location_label: 'Nơi ký:', date_label: 'Ngày ký:' });
    expect(o.show_info).toEqual(['reason', 'location', 'name', 'org', 'date']);
  });

  it('keeps 2-decimal coordinates when integer rounding is disabled', () => {
    const { payload, warnings } = exportLegacy([place(lib.enterprise)], { integerCoordinates: false });
    expect(payload[0].lLx).toBe(47.4);
    expect(warnings.some((w) => w.code === 'rounding')).toBe(false);
    expect(exportLegacy([place(lib.enterprise)]).warnings.some((w) => w.code === 'rounding')).toBe(true);
  });

  it('never silently discards unsupported features', () => {
    const t = createTemplate({
      size: { width: 200, height: 80 },
      style: { background: { color: '#eeeeee', opacity: 1 }, border: { width: 1, color: '#000000', style: 'solid', radius: 0 }, padding: 0, imageOpacity: 1 },
      elements: [
        createElement('text', { text: { content: 'Ký bởi: {{signer.name}}\nSerial: {{certificate.serial}}\nGhi chú tĩnh', color: '#111111', fontWeight: 'bold', align: 'center' } }),
        createElement('text', { text: { content: '{{signing.date}}', color: '#222222', fontSize: 12 } }),
        createElement('qr'),
        createElement('rect'),
        createElement('line'),
        createElement('image', { role: 'logo', image: { src: PNG } }),
        createElement('image', { role: 'seal', image: { src: PNG } }),
        createElement('text', { condition: { variable: 'signing.reason', operator: 'notEmpty' }, text: { content: '{{signing.reason}}' } }),
      ],
    });
    const geom = createPageGeometry({ mediaBox: [0, 0, 612, 792], cropBox: [10, 10, 600, 780], rotate: 90 });
    const { warnings } = exportLegacy([place(t, { opacity: 0.5, rotation: 90 })], { pageGeoms: { 1: geom } });
    const codes = new Set(warnings.map((w) => w.code));
    for (const c of ['static-text', 'unsupported-variable', 'unsupported-element', 'extra-image', 'multiple-colors', 'multiple-sizes', 'font-style', 'alignment', 'border', 'background', 'opacity', 'rotation', 'condition', 'page-rotation', 'cropbox-origin', 'layout', 'date-format']) {
      expect(codes.has(c), `missing warning ${c}`).toBe(true);
    }
    expect(warnings.filter((w) => w.code === 'unsupported-element')).toHaveLength(3);
    expect(warnings.every((w) => w.signatureId === 's1')).toBe(true);
  });

  it('infers template/hand_sig_pos from the hand-signature position', () => {
    const { payload } = exportLegacy([place(lib.personal)]);
    expect(payload[0].template).toBe('left');
    expect(payload[0].hand_sig_pos).toBe('left');
    expect(payload[0].hand_sig_index).toBe('bottom');
    expect(payload[0].hand_sig_img_b64).toBe(stripDataUrl(PNG));
  });

  it('serialises for JSON bodies and multipart fields', () => {
    const { payload } = exportLegacy([place(lib.enterprise)]);
    expect(JSON.parse(vnecaLegacyAdapter.serialize(payload, 'pretty'))).toEqual(payload);
    expect(JSON.parse(JSON.parse(vnecaLegacyAdapter.serialize(payload, 'multipart')))).toEqual(payload);
    expect(getAdapter('vneca-legacy')).toBe(vnecaLegacyAdapter);
    expect(() => getAdapter('nope')).toThrow();
  });
});
