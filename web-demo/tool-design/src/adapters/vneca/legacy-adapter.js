/**
 * VNeCA legacy `sign_props` adapter.
 *
 * Export (Designer → legacy) is a LOSSY projection: the legacy format only
 * carries a rectangle, a layout keyword, a list of info fields, one colour,
 * one font size and two images. Everything else is reported as a warning —
 * never silently dropped.
 *
 * Import (legacy → Designer) cannot recover visual layout the legacy format
 * does not contain. It synthesises an approximate, clearly-labelled layout
 * from the layout keyword and keeps all original values (including unknown
 * fields) so that a re-export reproduces them.
 *
 * Coordinates: lLx/lLy/width/height are PDF points, lower-left origin
 * (docs/api-reference.md). We emit absolute PDF user-space coordinates;
 * whether the back-end expects CropBox-relative values on pages whose
 * CropBox does not start at (0,0) is UNCONFIRMED — a warning is raised.
 */
import { legacySignPropsSchema, KNOWN_LEGACY_FIELDS, LEGACY_SHOW_INFO } from '../../schemas/legacy-schema.js';
import { extractVariables } from '../../engines/template-engine/variables.js';
import { createElement, createTemplate, uid, clone, DEFAULT_SAMPLE_DATA } from '../../engines/template-engine/index.js';
import { designSizeForRect } from '../../engines/coordinate-engine/index.js';

export const ADAPTER_ID = 'vneca-legacy';

/** Designer variable → legacy show_info key. */
const VAR_TO_INFO = {
  'signing.reason': 'reason',
  'signing.location': 'location',
  'signer.title': 'contact',
  'signer.name': 'name',
  'certificate.subject': 'name',
  'signer.organization': 'org',
  'signing.date': 'date',
  'signing.time': 'date',
  'signing.datetime': 'date',
};
const INFO_LABEL_FIELD = { reason: 'reason_label', location: 'location_label', contact: 'contact_label', date: 'date_label' };
const UNSUPPORTED_VARS = {
  'certificate.issuer': 'Tổ chức cấp chứng thư',
  'certificate.serial': 'Số hiệu chứng thư',
  'document.name': 'Tên tài liệu',
  'transaction.id': 'Mã giao dịch',
  'document.number': 'Số, ký hiệu văn bản',
  'copy.form': 'Hình thức sao',
  'copy.organization': 'Cơ quan sao',
};

const warn = (code, message, extra = {}) => ({ code, severity: 'warning', message, ...extra });
const visible = (el) => el.visible !== false;

export function stripDataUrl(src) {
  const m = /^data:image\/[a-z+]+;base64,(.*)$/s.exec(src ?? '');
  return m ? m[1] : '';
}

export function detectBase64Image(b64) {
  if (!b64) return null;
  const head = b64.slice(0, 16);
  if (head.startsWith('iVBOR')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  return null;
}

function nearestCorner(el, size) {
  const cx = (el.x + el.width / 2) / size.width;
  const cy = (el.y + el.height / 2) / size.height;
  if (Math.abs(cx - 0.5) < 0.2 && Math.abs(cy - 0.5) < 0.2) return 'center';
  return `${cy < 0.5 ? 'top' : 'bottom'}-${cx < 0.5 ? 'left' : 'right'}`;
}

function horizontalSide(el, size) {
  const cx = (el.x + el.width / 2) / size.width;
  if (cx < 0.4) return 'left';
  if (cx > 0.6) return 'right';
  return 'center';
}

function round(v, integers) {
  return integers ? Math.round(v) : Math.round(v * 100) / 100;
}

/** Info fields + labels used by a template's visible text, plus unsupported pieces. */
function analyseText(template, warnings) {
  const info = new Set();
  const labels = {};
  const texts = template.elements.filter((e) => e.type === 'text' && visible(e));
  for (const el of texts) {
    const lines = el.text.content.split(/\r?\n/);
    let hasVar = false;
    for (const line of lines) {
      const vars = extractVariables(line);
      if (!vars.length) {
        if (line.trim()) warnings.push(warn('static-text', `Dòng chữ tĩnh "${line.trim().slice(0, 40)}" (phần tử "${el.name || el.id}") không có trường tương ứng trong schema legacy.`, { elementId: el.id }));
        continue;
      }
      hasVar = true;
      const prefix = line.slice(0, line.indexOf('{{')).trim();
      for (const v of vars) {
        const key = VAR_TO_INFO[v];
        if (key) {
          info.add(key);
          const lf = INFO_LABEL_FIELD[key];
          if (lf && labels[lf] === undefined && v !== 'signing.time') labels[lf] = prefix;
        } else {
          warnings.push(warn('unsupported-variable', `Biến {{${v}}}${UNSUPPORTED_VARS[v] ? ` (${UNSUPPORTED_VARS[v]})` : ''} không được schema legacy hỗ trợ.`, { elementId: el.id }));
        }
      }
      const after = line.replace(/\{\{[^}]*\}\}/g, '').replace(prefix, '').trim();
      if (vars.length > 1 || after) {
        warnings.push(warn('combined-line', `Dòng "${line.trim().slice(0, 50)}" kết hợp nhiều nội dung; legacy chỉ hỗ trợ "nhãn + một giá trị" cho mỗi trường.`, { elementId: el.id }));
      }
    }
    if (!hasVar) continue;
    const t = el.text;
    if (t.fontFamily !== 'Arial' && t.fontFamily !== 'Times New Roman') warnings.push(warn('font', `Phông ${t.fontFamily} không có trong legacy.`, { elementId: el.id }));
    if (t.fontWeight === 'bold' || t.fontStyle === 'italic') warnings.push(warn('font-style', `Chữ đậm/nghiêng (phần tử "${el.name || el.id}") không có trong legacy.`, { elementId: el.id }));
    if (t.align !== 'left') warnings.push(warn('alignment', `Căn lề "${t.align}" không có trong legacy.`, { elementId: el.id }));
    if (t.textTransform !== 'none') warnings.push(warn('text-transform', 'Chuyển chữ hoa/thường không có trong legacy.', { elementId: el.id }));
  }
  const withVars = texts.filter((e) => extractVariables(e.text.content).length);
  const colors = new Set(withVars.map((e) => e.text.color.toLowerCase()));
  const sizes = new Set(withVars.map((e) => e.text.fontSize));
  const families = new Set(withVars.map((e) => e.text.fontFamily));
  if (colors.size > 1) warnings.push(warn('multiple-colors', `Mẫu dùng ${colors.size} màu chữ; legacy chỉ có một text_color (dùng màu của phần tử đầu tiên).`));
  if (sizes.size > 1) warnings.push(warn('multiple-sizes', `Mẫu dùng ${sizes.size} cỡ chữ; legacy chỉ có một font_size.`));
  if (families.size) warnings.push(warn('font-family', `Legacy không có trường phông chữ — phông do hệ thống ký VNeCA quyết định (mẫu đang dùng: ${[...families].join(', ')}).`));
  return { info, labels, first: withVars[0] ?? null };
}

/**
 * @param {object[]} signatures designer signatures
 * @param {{ data?: (sig)=>object, pageGeoms?: Record<number,object>, integerCoordinates?: boolean }} [opts]
 * @returns {{ payload: object[], warnings: object[], perSignature: {id, warnings}[] }}
 */
export function exportLegacy(signatures, { data, pageGeoms = {}, integerCoordinates = true } = {}) {
  const payload = [];
  const all = [];
  const perSignature = [];
  for (const sig of signatures) {
    const warnings = [];
    const t = sig.template;
    const d = data ? data(sig) : t.sampleData ?? {};
    const size = t.size;
    const { info, labels, first } = analyseText(t, warnings);

    const images = t.elements.filter((e) => e.type === 'image' && visible(e) && e.image.src);
    const hand = images.find((e) => e.role === 'hand-signature');
    const watermarkCandidates = images.filter((e) => e !== hand);
    const watermark = watermarkCandidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    for (const extra of watermarkCandidates.filter((e) => e !== watermark)) {
      warnings.push(warn('extra-image', `Ảnh "${extra.name || extra.id}" bị bỏ qua: legacy chỉ có 1 ảnh watermark và 1 ảnh chữ ký tay.`, { elementId: extra.id }));
    }
    for (const im of [hand, watermark].filter(Boolean)) {
      if (!im.image.src.startsWith('data:image/png')) warnings.push(warn('image-format', `Ảnh "${im.name || im.id}" không phải PNG; các client hiện có giả định PNG.`, { elementId: im.id }));
      if (im.rotation) warnings.push(warn('rotation', `Góc xoay của ảnh "${im.name || im.id}" không có trong legacy.`, { elementId: im.id }));
    }
    if (watermark && watermark.opacity < 1) warnings.push(warn('opacity', 'Độ trong suốt của ảnh watermark do hệ thống ký quyết định.', { elementId: watermark.id }));

    for (const el of t.elements.filter(visible)) {
      if (el.type === 'qr' || el.type === 'rect' || el.type === 'line') {
        warnings.push(warn('unsupported-element', `Phần tử ${{ qr: 'mã QR', rect: 'hình chữ nhật', line: 'đường kẻ' }[el.type]} "${el.name || el.id}" không được legacy hỗ trợ và sẽ không hiển thị khi ký.`, { elementId: el.id }));
      }
      if (el.condition) warnings.push(warn('condition', `Điều kiện hiển thị của "${el.name || el.id}" không có trong legacy.`, { elementId: el.id }));
    }
    const style = t.style ?? {};
    if (style.border?.width > 0) warnings.push(warn('border', 'Viền khung chữ ký không có trong legacy.'));
    if (style.background?.opacity > 0) warnings.push(warn('background', 'Màu nền khung chữ ký không có trong legacy.'));
    if ((sig.opacity ?? 1) < 1) warnings.push(warn('opacity', 'Độ trong suốt của chữ ký không có trong legacy.'));
    if (sig.rotation) warnings.push(warn('rotation', `Xoay nội dung ${sig.rotation}° không có trong legacy.`));
    const dt = t.dateTime ?? {};
    if (info.has('date')) warnings.push(warn('date-format', `Định dạng ngày/giờ ("${dt.dateFormat}"/"${dt.timeFormat}", ${dt.timeZone}) không có trong legacy — do hệ thống ký quyết định.`));

    const geom = pageGeoms[sig.page];
    if (geom) {
      if (geom.rotate) warnings.push(warn('page-rotation', `Trang ${sig.page} có /Rotate ${geom.rotate}; cách hệ thống ký xử lý trang xoay chưa được xác nhận.`));
      if (geom.view[0] !== 0 || geom.view[1] !== 0) warnings.push(warn('cropbox-origin', `CropBox trang ${sig.page} không bắt đầu tại (0,0); lLx/lLy được xuất theo tọa độ tuyệt đối của PDF — cần xác nhận với VNeCA.`));
    }

    const template = t.legacy?.template ?? (hand ? horizontalSide(hand, size) : 'text_only');
    if (hand && template === 'text_only') warnings.push(warn('template-mismatch', 'Mẫu có ảnh chữ ký tay nhưng bố cục là text_only — ảnh sẽ không hiển thị.'));
    warnings.push(warn('layout', `Vị trí/kích thước từng phần tử không có trong legacy; hệ thống ký tự dàn trang theo bố cục "${template}".`));

    const ordered = LEGACY_SHOW_INFO.filter((k) => info.has(k));
    const obj = {
      page: sig.page,
      lLx: round(sig.rect.x, integerCoordinates),
      lLy: round(sig.rect.y, integerCoordinates),
      width: round(sig.rect.width, integerCoordinates),
      height: round(sig.rect.height, integerCoordinates),
      template,
      show_info: ordered,
      location: String(d.signing?.location ?? ''),
      location_label: labels.location_label ?? t.legacy?.labels?.location_label ?? '',
      reason: String(d.signing?.reason ?? ''),
      reason_label: labels.reason_label ?? t.legacy?.labels?.reason_label ?? '',
      contact: String(t.legacy?.contact ?? d.signer?.title ?? ''),
      contact_label: labels.contact_label ?? t.legacy?.labels?.contact_label ?? '',
      date_label: labels.date_label ?? t.legacy?.labels?.date_label ?? '',
      text_color: first?.text.color ?? '#000000',
      font_size: first?.text.fontSize ?? 10,
      sign_visibility: sig.visible === false ? 'hidden' : 'shown',
      watermark_pos: watermark ? nearestCorner(watermark, size) : 'center',
      watermark_img_b64: watermark ? stripDataUrl(watermark.image.src) : '',
      hand_sig_img_b64: hand ? stripDataUrl(hand.image.src) : '',
    };
    if (hand) {
      obj.hand_sig_pos = horizontalSide(hand, size);
      const handIndex = t.elements.indexOf(hand);
      const textIdx = t.elements.map((e, i) => (e.type === 'text' && visible(e) ? i : -1)).filter((i) => i >= 0);
      obj.hand_sig_index = textIdx.every((i) => i < handIndex) ? 'top' : 'bottom';
    }
    if (integerCoordinates) {
      const exact = [sig.rect.x, sig.rect.y, sig.rect.width, sig.rect.height];
      if (exact.some((v) => Math.abs(v - Math.round(v)) > 1e-6)) warnings.push(warn('rounding', 'Tọa độ được làm tròn tới số nguyên điểm PDF (sai số ≤ 0,5 pt ≈ 0,18 mm).'));
    }
    // Re-emit unknown fields that were imported from legacy JSON.
    for (const [k, v] of Object.entries(t.legacy?.extra ?? {})) if (!(k in obj)) obj[k] = v;

    payload.push(obj);
    const tagged = warnings.map((w) => ({ ...w, signatureId: sig.id, signatureName: sig.name }));
    perSignature.push({ id: sig.id, warnings: tagged });
    all.push(...tagged);
  }
  return { payload, warnings: all, perSignature };
}

/** Accepts an object, an array, a JSON string (incl. stringified array) or a request payload with `sign_props`. */
export function normalizeLegacyInput(input) {
  let v = input;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      throw new Error('Không đọc được JSON legacy.');
    }
  }
  if (v && !Array.isArray(v) && typeof v === 'object' && 'sign_props' in v) return normalizeLegacyInput(v.sign_props);
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  throw new Error('JSON legacy phải là object, mảng hoặc payload có trường sign_props.');
}

const DEFAULT_LABELS = { reason: 'Lý do:', location: 'Nơi ký:', contact: '', date: 'Ngày ký:' };
const INFO_LINES = {
  name: () => 'Ký bởi: {{signer.name}}',
  org: () => '{{signer.organization}}',
  contact: (p) => `${p.contact_label ?? DEFAULT_LABELS.contact} {{signer.title}}`.trim(),
  reason: (p) => `${p.reason_label ?? DEFAULT_LABELS.reason} {{signing.reason}}`.trim(),
  location: (p) => `${p.location_label ?? DEFAULT_LABELS.location} {{signing.location}}`.trim(),
  date: (p) => `${p.date_label ?? DEFAULT_LABELS.date} {{signing.datetime}}`.trim(),
};

/**
 * @returns {{ signatures: object[], warnings: object[], errors: string[] }}
 *   Images keep their original MIME in data URLs; call the browser-side
 *   normaliser to convert WebP/GIF to PNG before schema validation.
 */
export function importLegacy(input, { pageGeoms = {}, pageCount } = {}) {
  const items = normalizeLegacyInput(input);
  const signatures = [];
  const warnings = [
    warn('layout-synthesized', 'Định dạng legacy không chứa bố cục chi tiết; bố cục hiển thị trong Designer được dựng lại gần đúng từ trường "template" và chỉ mang tính minh họa — hệ thống ký VNeCA có thể trình bày khác.'),
  ];
  const errors = [];
  items.forEach((raw, index) => {
    const parsed = legacySignPropsSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Phần tử #${index + 1}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      return;
    }
    const p = parsed.data;
    const extra = Object.fromEntries(Object.entries(raw).filter(([k]) => !KNOWN_LEGACY_FIELDS.has(k)));
    if (Object.keys(extra).length) warnings.push(warn('unknown-fields', `Phần tử #${index + 1}: giữ nguyên các trường không xác định: ${Object.keys(extra).join(', ')}.`));
    if (pageCount && p.page > pageCount) warnings.push(warn('page-out-of-range', `Phần tử #${index + 1}: trang ${p.page} vượt quá số trang tài liệu (${pageCount}).`));
    const rect = { x: p.lLx, y: p.lLy, width: p.width, height: p.height };
    const geom = pageGeoms[p.page];
    const size = geom ? designSizeForRect(geom, rect, 0) : { width: p.width, height: p.height };
    const template = synthesizeTemplate(p, size, extra);
    signatures.push({
      id: uid('sig'),
      name: `Chữ ký legacy #${index + 1}`,
      page: p.page,
      rect,
      rotation: 0,
      opacity: 1,
      visible: p.sign_visibility !== 'hidden',
      locked: false,
      template,
    });
    for (const [field, label] of [['hand_sig_img_b64', 'chữ ký tay'], ['watermark_img_b64', 'watermark']]) {
      const mime = detectBase64Image(p[field]);
      if (p[field] && !mime) warnings.push(warn('image-unknown', `Phần tử #${index + 1}: không nhận dạng được định dạng ảnh ${label}.`));
      if (mime && mime !== 'image/png' && mime !== 'image/jpeg') warnings.push(warn('image-converted', `Phần tử #${index + 1}: ảnh ${label} dạng ${mime} sẽ được chuyển sang PNG để xem trước.`));
    }
  });
  return { signatures, warnings, errors };
}

function synthesizeTemplate(p, size, extra) {
  const W = size.width;
  const H = size.height;
  const tplKind = p.template ?? 'text_only';
  const showInfo = p.show_info ?? [];
  const order = ['name', 'org', 'contact', 'reason', 'location', 'date'];
  const lines = order.filter((k) => showInfo.includes(k)).map((k) => INFO_LINES[k](p));
  const color = p.text_color ?? '#000000';
  const fontSize = p.font_size ?? 10;
  const elements = [];
  const handMime = detectBase64Image(p.hand_sig_img_b64);
  const wmMime = detectBase64Image(p.watermark_img_b64);
  const hasHand = tplKind !== 'text_only' && handMime;

  if (wmMime) {
    const wmW = W * 0.45;
    const wmH = H * 0.9;
    const pos = p.watermark_pos ?? 'center';
    const x = pos.endsWith('left') ? 0 : pos.endsWith('right') ? W - wmW : (W - wmW) / 2;
    const y = pos.startsWith('top') ? 0 : pos.startsWith('bottom') ? H - wmH : (H - wmH) / 2;
    elements.push(createElement('image', { role: 'background', name: 'Watermark (legacy)', x, y, width: wmW, height: wmH, opacity: 0.18, image: { src: `data:${wmMime};base64,${p.watermark_img_b64}` } }));
  }
  let textBox = { x: 4, y: 4, width: W - 8, height: H - 8 };
  let handEl = null;
  if (hasHand) {
    const src = `data:${handMime};base64,${p.hand_sig_img_b64}`;
    const pos = tplKind === 'center' ? 'center' : (p.hand_sig_pos ?? tplKind);
    if (pos === 'center') {
      handEl = createElement('image', { role: 'hand-signature', name: 'Chữ ký tay (legacy)', x: W * 0.125, y: H * 0.125, width: W * 0.75, height: H * 0.75, image: { src } });
    } else {
      const iw = W * 0.4;
      handEl = createElement('image', { role: 'hand-signature', name: 'Chữ ký tay (legacy)', x: pos === 'left' ? 4 : W - iw - 4, y: 4, width: iw, height: H - 8, image: { src } });
      textBox = { x: pos === 'left' ? iw + 8 : 4, y: 4, width: W - iw - 12, height: H - 8 };
    }
  }
  const textEl = lines.length
    ? createElement('text', {
        role: 'signer-name',
        name: 'Thông tin chữ ký (legacy)',
        ...textBox,
        constraints: { horizontal: 'stretch', vertical: 'stretch' },
        text: { content: lines.join('\n'), color, fontSize, fontFamily: 'Arial', lineHeight: 1.25, hideEmptyLines: false },
      })
    : null;
  const index = p.hand_sig_index ?? 'top';
  if (handEl && index === 'bottom') elements.push(handEl);
  if (textEl) elements.push(textEl);
  if (handEl && index !== 'bottom') elements.push(handEl);

  const sample = clone(DEFAULT_SAMPLE_DATA);
  sample.signing.reason = p.reason ?? '';
  sample.signing.location = p.location ?? '';
  if (p.contact !== undefined) sample.signer.title = p.contact;
  const labels = {};
  for (const k of ['location_label', 'reason_label', 'contact_label', 'date_label']) if (p[k] !== undefined) labels[k] = p[k];
  return createTemplate({
    name: `Nhập từ VNeCA legacy (${tplKind})`,
    description: 'Mẫu dựng lại gần đúng từ JSON legacy. Bố cục thực tế do hệ thống ký VNeCA quyết định.',
    category: 'custom',
    signatureType: 'custom',
    size: { width: W, height: H },
    elements,
    sampleData: sample,
    legacy: { template: tplKind, contact: p.contact, labels, extra },
  });
}
