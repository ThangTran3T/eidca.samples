import { describe, it, expect, beforeAll } from 'vitest';
import {
  interpolate,
  buildVariableContext,
  extractVariables,
  unknownVariables,
  formatDateTime,
  signingDateParts,
  timeZoneOffsetMinutes,
  evaluateCondition,
  applyConstraints,
  resizeTemplate,
  createElement,
  createTemplate,
  resolveTemplate,
  imageDrawRect,
  qrModules,
  DEFAULT_SAMPLE_DATA,
} from '../../src/engines/template-engine/index.js';
import { layoutText, wrapLines } from '../../src/engines/rendering-engine/text-layout.js';
import { nodeFontRegistry } from '../helpers/node-fonts.js';

let fonts;
beforeAll(async () => {
  fonts = await nodeFontRegistry();
});

describe('safe variable interpolation', () => {
  const ctx = buildVariableContext(DEFAULT_SAMPLE_DATA, { dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', timeZone: 'Asia/Ho_Chi_Minh' });

  it('resolves all 13 required variables', () => {
    const keys = [
      'signer.name', 'signer.organization', 'signer.title', 'certificate.subject', 'certificate.issuer', 'certificate.serial',
      'signing.date', 'signing.time', 'signing.datetime', 'signing.reason', 'signing.location', 'document.name', 'transaction.id',
    ];
    for (const k of keys) expect(interpolate(`{{${k}}}`, ctx), k).not.toBe('');
    expect(interpolate('{{signing.date}} {{signing.time}}', ctx)).toBe('15/10/2026 09:30:45');
    expect(interpolate('{{ signer.name }}', ctx)).toBe('Nguyễn Văn An');
  });

  it('never evaluates code or walks prototypes', () => {
    const evil = buildVariableContext({ signer: { name: '{{signer.title}}' } }, {});
    // values are not re-interpolated
    expect(interpolate('{{signer.name}}', evil)).toBe('{{signer.title}}');
    expect(interpolate('{{constructor.constructor}}', ctx)).toBe('{{constructor.constructor}}');
    expect(interpolate('{{__proto__.polluted}}', ctx)).toBe('{{__proto__.polluted}}');
    expect(interpolate('${process.exit()} {{signer.name}}', ctx)).toBe('${process.exit()} Nguyễn Văn An');
    const proto = buildVariableContext(JSON.parse('{"signer":{"__proto__":{"name":"x"}}}'), {});
    expect(proto['signer.name']).toBe('');
    expect(Object.getPrototypeOf(ctx)).toBe(null);
  });

  it('ignores non-string data values instead of stringifying objects', () => {
    const c = buildVariableContext({ signer: { name: { toString: () => 'pwned' } } }, {});
    expect(c['signer.name']).toBe('');
  });

  it('keeps placeholders in design mode', () => {
    expect(interpolate('Ký bởi: {{signer.name}}', ctx, { mode: 'placeholder' })).toBe('Ký bởi: {{signer.name}}');
  });

  it('removes lines whose variables are all empty when hideEmptyLines is on', () => {
    const c = buildVariableContext({ signer: { name: 'A' }, signing: {} }, {});
    expect(interpolate('Ký bởi: {{signer.name}}\nLý do: {{signing.reason}}\nGhi chú tĩnh', c, { hideEmptyLines: true })).toBe('Ký bởi: A\nGhi chú tĩnh');
    expect(interpolate('Lý do: {{signing.reason}}', c, { hideEmptyLines: false })).toBe('Lý do: ');
  });

  it('extracts and flags unknown variables', () => {
    expect(extractVariables('{{signer.name}} {{foo.bar}} {{signer.name}}')).toEqual(['signer.name', 'foo.bar']);
    expect(unknownVariables('{{signer.name}} {{foo.bar}}')).toEqual(['foo.bar']);
  });
});

describe('date & time formatting', () => {
  const ts = '2026-10-15T02:30:45Z';
  it('formats in Vietnam time (UTC+07:00) and ISO 8601', () => {
    expect(formatDateTime(ts, 'DD/MM/YYYY HH:mm:ss', 'Asia/Ho_Chi_Minh')).toBe('15/10/2026 09:30:45');
    expect(formatDateTime(ts, 'ISO8601', 'Asia/Ho_Chi_Minh')).toBe('2026-10-15T09:30:45+07:00');
    expect(formatDateTime(ts, 'vi-long', 'Asia/Ho_Chi_Minh')).toBe('ngày 15 tháng 10 năm 2026');
    expect(formatDateTime(ts, 'HH:mm Z', 'UTC')).toBe('02:30 +00:00');
  });
  it('handles day rollover across time zones', () => {
    expect(formatDateTime('2026-12-31T20:00:00Z', 'YYYY-MM-DD', 'Asia/Ho_Chi_Minh')).toBe('2027-01-01');
  });
  it('computes offsets', () => {
    expect(timeZoneOffsetMinutes(new Date(ts), 'Asia/Ho_Chi_Minh')).toBe(420);
    expect(timeZoneOffsetMinutes(new Date(ts), 'Asia/Singapore')).toBe(480);
  });
  it('falls back for invalid timestamps and zones', () => {
    expect(formatDateTime('not a date', 'DD/MM/YYYY')).toBe('');
    expect(formatDateTime(ts, 'HH:mm', 'Not/AZone')).toBe('09:30');
  });
  it('respects show/hide date and time', () => {
    expect(signingDateParts(ts, { showDate: false })).toEqual({ date: '', time: '09:30:45', datetime: '09:30:45' });
    expect(signingDateParts(ts, { showTime: false })).toEqual({ date: '15/10/2026', time: '', datetime: '15/10/2026' });
    expect(signingDateParts(ts, { dateFormat: 'ISO8601' }).datetime).toBe('2026-10-15T09:30:45+07:00');
  });
});

describe('conditional visibility', () => {
  const ctx = { 'signing.reason': 'Phê duyệt', 'signing.location': '' };
  it.each([
    [{ variable: 'signing.reason', operator: 'notEmpty' }, true],
    [{ variable: 'signing.location', operator: 'notEmpty' }, false],
    [{ variable: 'signing.location', operator: 'empty' }, true],
    [{ variable: 'signing.reason', operator: 'equals', value: 'Phê duyệt' }, true],
    [{ variable: 'signing.reason', operator: 'notEquals', value: 'Phê duyệt' }, false],
    [{ variable: 'signing.reason', operator: 'contains', value: 'duyệt' }, true],
    [{ variable: 'evil.key', operator: 'empty' }, true],
    [null, true],
  ])('%j → %s', (cond, expected) => {
    expect(evaluateCondition(cond, ctx)).toBe(expected);
  });
});

describe('layout constraints', () => {
  const el = createElement('text', { x: 10, y: 10, width: 50, height: 20 });
  const old = { width: 100, height: 50 };
  const next = { width: 200, height: 100 };
  it.each([
    ['left', 'top', { x: 10, y: 10, width: 50, height: 20 }],
    ['right', 'bottom', { x: 110, y: 60, width: 50, height: 20 }],
    ['center', 'center', { x: 60, y: 35, width: 50, height: 20 }],
    ['stretch', 'stretch', { x: 10, y: 10, width: 150, height: 70 }],
    ['scale', 'scale', { x: 20, y: 20, width: 100, height: 40 }],
  ])('%s/%s', (h, v, expected) => {
    const r = applyConstraints({ ...el, constraints: { horizontal: h, vertical: v } }, old, next);
    expect({ x: r.x, y: r.y, width: r.width, height: r.height }).toEqual(expected);
  });
  it('locks aspect ratio inside the constrained area', () => {
    const r = applyConstraints({ ...el, lockAspectRatio: true, constraints: { horizontal: 'stretch', vertical: 'top' } }, old, next);
    expect(r.width / r.height).toBeCloseTo(50 / 20);
  });
  it('never scales font size', () => {
    const tpl = createTemplate({ size: old, elements: [el] });
    expect(resizeTemplate(tpl, next).elements[0].text.fontSize).toBe(10);
  });
});

describe('text layout', () => {
  const measure = (s) => fonts.measure(s, { family: 'Times New Roman', weight: 'normal', style: 'normal', size: 10 });
  it('wraps Vietnamese text by words and breaks over-long words', () => {
    const lines = wrapLines('Sở Khoa học và Công nghệ tỉnh Mẫu', 80, measure);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(measure(l)).toBeLessThanOrEqual(80));
    const long = wrapLines('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 50, measure);
    expect(long.length).toBeGreaterThan(1);
  });
  it('aligns and reports overflow', () => {
    const r = layoutText({ text: 'Một\nHai\nBa', width: 100, height: 20, fontSize: 10, lineHeight: 1.2, align: 'right', measure, ascent: 0.891, descent: 0.216 });
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].x + r.lines[0].width).toBeCloseTo(100);
    expect(r.overflow).toBe(true);
    expect(r.lines[1].baseline - r.lines[0].baseline).toBeCloseTo(12);
  });
  it('measures with real font metrics (bold is wider than regular)', () => {
    const reg = fonts.measure('Nguyễn Văn An', { family: 'Times New Roman', weight: 'normal', style: 'normal', size: 12 });
    const bold = fonts.measure('Nguyễn Văn An', { family: 'Times New Roman', weight: 'bold', style: 'normal', size: 12 });
    expect(reg).toBeGreaterThan(50);
    expect(bold).toBeGreaterThan(reg);
  });
});

describe('resolveTemplate', () => {
  it('produces a render model honouring visibility, conditions, case and QR', () => {
    const tpl = createTemplate({
      size: { width: 200, height: 80 },
      elements: [
        createElement('text', { id: 'a', width: 190, height: 15, text: { content: 'Ký bởi: {{signer.name}}', textTransform: 'uppercase' } }),
        createElement('text', { id: 'b', width: 190, height: 15, visible: false, text: { content: 'x' } }),
        createElement('text', { id: 'c', width: 190, height: 15, condition: { variable: 'signing.reason', operator: 'empty' }, text: { content: 'Không có lý do' } }),
        createElement('qr', { id: 'd', width: 40, height: 40 }),
      ],
    });
    const model = resolveTemplate(tpl, { mode: 'sample', measure: fonts.measure });
    expect(model.items[0].text.lines[0].text).toBe('KÝ BỞI: NGUYỄN VĂN AN');
    expect(model.items[1].visible).toBe(false);
    expect(model.items[2].visible).toBe(false);
    expect(model.items[2].hiddenByCondition).toBe(true);
    expect(model.items[3].qr.content).toBe('TX-2026-000123');
    expect(model.items[3].qr.modules.size).toBeGreaterThanOrEqual(21);

    const design = resolveTemplate(tpl, { mode: 'placeholder', measure: fonts.measure });
    expect(design.items[0].text.content).toBe('KÝ BỞI: {{signer.name}}'); // placeholders survive text-transform
    expect(design.items[2].visible).toBe(true); // conditions are not applied while designing

    const runtime = resolveTemplate(tpl, { mode: 'runtime', runtimeData: { signer: { name: 'Lê Thị Bình' } }, measure: fonts.measure });
    expect(runtime.items[0].text.content).toBe('KÝ BỞI: LÊ THỊ BÌNH');
    expect(runtime.items[2].visible).toBe(true);
  });

  it('computes contain/cover/stretch image rectangles', () => {
    expect(imageDrawRect('contain', 100, 50, 200, 200)).toEqual({ x: 25, y: 0, width: 50, height: 50, clip: false });
    expect(imageDrawRect('cover', 100, 50, 200, 200)).toEqual({ x: 0, y: -25, width: 100, height: 100, clip: true });
    expect(imageDrawRect('stretch', 100, 50, 200, 200)).toEqual({ x: 0, y: 0, width: 100, height: 50, clip: false });
  });

  it('returns null QR modules for empty or oversize content', () => {
    expect(qrModules('')).toBe(null);
    expect(qrModules('x'.repeat(5000))).toBe(null);
  });
});
