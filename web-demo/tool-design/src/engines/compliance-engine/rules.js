/**
 * Decree 30/2020 rule set. Each rule:
 *   id, title, legalRef {document, location, quote}, profiles (applicable
 *   signer/document types), severity ('error'|'warning'), kind:
 *     'auto'      — fully determined by the template/placement data
 *     'heuristic' — automatic, but the legal text is qualitative ("khoảng 1/3",
 *                   "góc trên, bên phải"); tolerances are OUR interpretation and
 *                   are stated in `explanation`
 *     'manual'    — cannot be verified by software; needs a human attestation
 *   explanation (human-readable), evaluate(ctx) → {status, message, measured?}
 *
 * status: 'pass' | 'fail' | 'manual' (needs attestation) | 'not-evaluated' (missing inputs)
 */
import { DECREE, REFS } from './legal-references.js';
import { extractVariables } from '../template-engine/variables.js';
import { COPY_FORMS } from '../template-engine/constants.js';
import { imageDrawRect } from '../template-engine/index.js';
import {
  designToUserMatrix,
  compose,
  translate,
  rotate,
  applyToRect,
  pdfRectToDisplay,
  displaySize,
  isRectInsidePage,
  pointsToMm,
} from '../coordinate-engine/index.js';

const ref = (key) => ({ document: DECREE, ...REFS[key] });
const pass = (message, measured) => ({ status: 'pass', message, measured });
const fail = (message, measured) => ({ status: 'fail', message, measured });
const notEvaluated = (message) => ({ status: 'not-evaluated', message });
const manual = (message) => ({ status: 'manual', message });

// ─── helpers ────────────────────────────────────────────────────────────────
const shown = (el) => el.visible !== false;
export const visibleImages = (t, role) => t.elements.filter((e) => e.type === 'image' && shown(e) && (!role || e.role === role));
const withSrc = (els) => els.filter((e) => e.image?.src);
export const visibleTexts = (t) => t.elements.filter((e) => e.type === 'text' && shown(e) && e.text.content.trim() !== '');

function primaryImage(t, role) {
  const imgs = withSrc(visibleImages(t, role));
  return imgs.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

/** Axis-aligned PDF user-space rect of an image's visible (inked) content. */
export function imageContentUserRect(geom, signature, el, { contentOnly = true } = {}) {
  const d = imageDrawRect(el.image.fit, el.width, el.height, el.image.naturalWidth, el.image.naturalHeight);
  const cb = contentOnly ? el.image.analysis?.contentBox : null;
  const local = cb ? { x: d.x + cb.x * d.width, y: d.y + cb.y * d.height, width: cb.width * d.width, height: cb.height * d.height } : { x: d.x, y: d.y, width: d.width, height: d.height };
  const m = compose(rotate(el.rotation || 0), translate(el.x, el.y), designToUserMatrix(geom, signature));
  return applyToRect(m, local);
}

const ISO_OK = (dt) => dt?.dateFormat === 'ISO8601';
const VN_TZ = 'Asia/Ho_Chi_Minh';

function textUsesVariable(t, keys) {
  return visibleTexts(t).some((e) => extractVariables(e.text.content).some((k) => keys.includes(k)));
}

function staticTextOf(content) {
  return content.replace(/\{\{[^}]*\}\}/g, ' ');
}

function isAllCaps(s) {
  const letters = s.replace(/[^\p{L}]/gu, '');
  return letters.length >= 2 && letters === letters.toLocaleUpperCase('vi-VN') && letters !== letters.toLocaleLowerCase('vi-VN');
}

// ─── reusable rule builders ─────────────────────────────────────────────────
function imageRules(prefix, profile, role, roleLabel, colorKey, colorLabel, refKey) {
  return [
    {
      id: `${prefix}-01`,
      title: `Có ${roleLabel}`,
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: `Hình thức chữ ký phải là ${roleLabel}. Mẫu phải có phần tử ảnh vai trò "${roleLabel}" đang hiển thị và đã có ảnh.`,
      evaluate: ({ template }) => {
        const imgs = visibleImages(template, role);
        if (!imgs.length) return fail(`Chưa có phần tử ${roleLabel} hiển thị.`);
        if (!withSrc(imgs).length) return fail(`Phần tử ${roleLabel} chưa có ảnh.`);
        return pass(`Có ${roleLabel}.`);
      },
    },
    {
      id: `${prefix}-02`,
      title: 'Định dạng ảnh PNG',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Ảnh phải ở định dạng Portable Network Graphics (.png).',
      evaluate: ({ template }) => {
        const img = primaryImage(template, role);
        if (!img) return notEvaluated('Chưa có ảnh để kiểm tra.');
        return img.image.src.startsWith('data:image/png;') ? pass('Ảnh PNG.') : fail('Ảnh không phải PNG (JPEG không hỗ trợ nền trong suốt).');
      },
    },
    {
      id: `${prefix}-03`,
      title: 'Nền trong suốt',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Ảnh phải có nền trong suốt. Kiểm tra: ảnh có kênh alpha và cả bốn góc ảnh trong suốt.',
      evaluate: ({ template }) => {
        const img = primaryImage(template, role);
        const a = img?.image.analysis;
        if (!img) return notEvaluated('Chưa có ảnh để kiểm tra.');
        if (!a) return notEvaluated('Chưa phân tích được điểm ảnh (hãy tải lại ảnh).');
        if (!a.hasAlpha) return fail('Ảnh không có vùng trong suốt.');
        if (!a.cornersTransparent) return fail('Các góc ảnh không trong suốt — có thể nền chưa được xóa.', `Tỉ lệ trong suốt: ${Math.round(a.transparentRatio * 100)}%`);
        return pass('Nền trong suốt.', `Tỉ lệ điểm ảnh trong suốt: ${Math.round(a.transparentRatio * 100)}%`);
      },
    },
    {
      id: `${prefix}-04`,
      title: `Màu ${colorLabel}`,
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: `Ảnh phải có màu ${colorLabel}. Kiểm tra: trên 50% điểm ảnh có màu (không tính nền) thuộc dải sắc độ ${colorLabel}.`,
      evaluate: ({ template }) => {
        const img = primaryImage(template, role);
        const a = img?.image.analysis;
        if (!img) return notEvaluated('Chưa có ảnh để kiểm tra.');
        if (!a) return notEvaluated('Chưa phân tích được điểm ảnh.');
        const ratio = colorKey === 'red' ? a.redRatio : a.blueRatio;
        const measured = `Màu chủ đạo: ${a.dominantColor}; tỉ lệ ${colorLabel}: ${Math.round((ratio ?? 0) * 100)}%; màu trung bình ${a.averageColor ?? '—'}`;
        return a.dominantColor === colorKey ? pass(`Ảnh màu ${colorLabel}.`, measured) : fail(`Màu chủ đạo của ảnh không phải màu ${colorLabel}.`, measured);
      },
    },
  ];
}

function placementRules(prefix, profile, refKey, cellNote) {
  return [
    {
      id: `${prefix}-P1`,
      title: 'Trang đầu của văn bản',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Chữ ký phải đặt ở trang đầu (trang 1) của văn bản.',
      evaluate: ({ signature }) => {
        if (!signature) return notEvaluated('Chưa đặt chữ ký lên tài liệu.');
        return signature.page === 1 ? pass('Đặt tại trang 1.') : fail(`Đang đặt ở trang ${signature.page}.`);
      },
    },
    {
      id: `${prefix}-P2`,
      title: `Góc trên, bên phải${cellNote ? ` (${cellNote})` : ''}`,
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'warning',
      kind: 'heuristic',
      explanation:
        'Văn bản quy định "góc trên, bên phải" nhưng không có số đo. Diễn giải của công cụ: tâm khung nằm ở nửa phải trang và mép trên của khung nằm trong 20% chiều cao trang tính từ mép trên (theo hướng hiển thị của trang).',
      evaluate: ({ signature, geom }) => {
        if (!signature || !geom) return notEvaluated('Cần tài liệu PDF và vị trí đặt để đánh giá.');
        const d = pdfRectToDisplay(geom, signature.rect);
        const size = displaySize(geom);
        const cx = (d.x + d.width / 2) / size.width;
        const top = d.y / size.height;
        const measured = `Tâm ngang: ${Math.round(cx * 100)}% chiều rộng; mép trên: ${Math.round(top * 100)}% chiều cao`;
        return cx >= 0.5 && top <= 0.2 ? pass('Khung nằm ở góc trên bên phải.', measured) : fail('Khung chưa nằm ở góc trên bên phải trang.', measured);
      },
    },
    {
      id: `${prefix}-P3`,
      title: 'Không hiển thị hình ảnh chữ ký',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Hình ảnh chữ ký số của cơ quan, tổ chức: Không hiển thị. Mẫu không được chứa ảnh (dấu, chữ ký, logo, ảnh nền) đang hiển thị.',
      evaluate: ({ template }) => {
        const imgs = visibleImages(template);
        return imgs.length ? fail(`Có ${imgs.length} phần tử ảnh đang hiển thị.`) : pass('Không có hình ảnh.');
      },
    },
  ];
}

function typographyRules(prefix, profile, refKey) {
  const texts = (t) => visibleTexts(t);
  const each = (t, pred) => texts(t).filter((e) => !pred(e));
  return [
    {
      id: `${prefix}-T1`,
      title: 'Phông chữ Times New Roman',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Thông tin được trình bày bằng phông chữ Times New Roman. (Bản xem trước dùng Liberation Serif — phông tương thích số đo với Times New Roman; dịch vụ ký số phải dùng Times New Roman.)',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bad = each(template, (e) => e.text.fontFamily === 'Times New Roman');
        return bad.length ? fail(`${bad.length} phần tử không dùng Times New Roman.`) : pass('Times New Roman.');
      },
    },
    {
      id: `${prefix}-T2`,
      title: 'Chữ in thường',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation:
        'Chữ in thường (không viết hoa toàn bộ). Kiểm tra phần chữ tĩnh và thuộc tính chuyển chữ hoa; giá trị biến như số ký hiệu văn bản ("125/QĐ-...") hay hình thức sao ("SAO Y") không bị tính vì văn bản pháp luật quy định chúng ở dạng chữ hoa.',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bad = each(template, (e) => e.text.textTransform !== 'uppercase' && !isAllCaps(staticTextOf(e.text.content)));
        return bad.length ? fail(`${bad.length} phần tử đang viết hoa toàn bộ.`) : pass('Chữ in thường.');
      },
    },
    {
      id: `${prefix}-T3`,
      title: 'Kiểu chữ đứng',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Kiểu chữ đứng (không in nghiêng).',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bad = each(template, (e) => e.text.fontStyle !== 'italic');
        return bad.length ? fail(`${bad.length} phần tử in nghiêng.`) : pass('Chữ đứng.');
      },
    },
    {
      id: `${prefix}-T4`,
      title: 'Cỡ chữ 10',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Cỡ chữ 10 (pt).',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bad = each(template, (e) => e.text.fontSize === 10);
        return bad.length ? fail(`${bad.length} phần tử có cỡ chữ khác 10.`, bad.map((e) => `${e.name || e.id}: ${e.text.fontSize}`).join(', ')) : pass('Cỡ chữ 10.');
      },
    },
    {
      id: `${prefix}-T5`,
      title: 'Màu đen',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Chữ màu đen (#000000).',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bad = each(template, (e) => e.text.color.toLowerCase() === '#000000');
        return bad.length ? fail(`${bad.length} phần tử không phải màu đen.`) : pass('Màu đen.');
      },
    },
    {
      id: `${prefix}-T6`,
      title: 'Không dùng chữ đậm (chưa quy định)',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'warning',
      kind: 'heuristic',
      explanation: 'Văn bản quy định "chữ in thường, kiểu chữ đứng" nhưng không nhắc tới độ đậm. Chữ đậm không bị cấm rõ ràng; công cụ cảnh báo để người dùng tự xem xét.',
      evaluate: ({ template }) => {
        if (!texts(template).length) return notEvaluated('Không có văn bản.');
        const bold = texts(template).filter((e) => e.text.fontWeight === 'bold');
        return bold.length ? fail(`${bold.length} phần tử in đậm — cần xem xét.`) : pass('Không in đậm.');
      },
    },
    {
      id: `${prefix}-T7`,
      title: 'Thời gian ký theo ISO 8601, múi giờ Việt Nam',
      legalRef: ref(refKey),
      profiles: [profile],
      severity: 'error',
      kind: 'auto',
      explanation: 'Thời gian ký gồm ngày tháng năm; giờ phút giây; múi giờ Việt Nam theo ISO 8601 (ví dụ 2026-10-15T09:30:45+07:00). Kiểm tra: định dạng ngày "ISO8601", múi giờ Asia/Ho_Chi_Minh, có hiển thị thời gian ký.',
      evaluate: ({ template }) => {
        const dt = template.dateTime ?? {};
        if (!textUsesVariable(template, ['signing.datetime', 'signing.date', 'signing.time'])) return fail('Mẫu không hiển thị thời gian ký.');
        if (dt.showDate === false || dt.showTime === false) return fail('Đang ẩn ngày hoặc giờ ký.');
        if (dt.timeZone !== VN_TZ) return fail(`Múi giờ đang là ${dt.timeZone}, cần Asia/Ho_Chi_Minh (UTC+07:00).`);
        if (!ISO_OK(dt)) return fail(`Định dạng ngày "${dt.dateFormat}" không phải ISO 8601.`);
        return pass('ISO 8601, UTC+07:00.');
      },
    },
  ];
}

function noExtraTextRule(prefix, profile, refKey) {
  return {
    id: `${prefix}-X1`,
    title: 'Thông tin văn bản bổ sung (không được quy định)',
    legalRef: ref(refKey),
    profiles: [profile],
    severity: 'warning',
    kind: 'manual',
    explanation:
      'Phụ lục I chỉ quy định hình ảnh. Việc hiển thị thêm thông tin dạng chữ (tên, thời gian...) không được quy định — không mặc định là vi phạm, nhưng cần người có trách nhiệm xem xét và xác nhận.',
    evaluate: ({ template }) => {
      const t = visibleTexts(template);
      return t.length ? manual(`Mẫu hiển thị thêm ${t.length} phần tử chữ.`) : pass('Chỉ hiển thị hình ảnh.');
    },
  };
}

function authenticImageRule(prefix, profile, role, label, refKey) {
  return {
    id: `${prefix}-M1`,
    title: `Ảnh là ${label} thật (không phải ảnh mẫu)`,
    legalRef: ref(refKey),
    profiles: [profile],
    severity: 'error',
    kind: 'manual',
    explanation: `Phần mềm không thể xác minh ảnh là ${label} thật của cơ quan/người ký. Ảnh mẫu đi kèm công cụ (có chữ "MẪU") luôn không đạt. Ảnh do người dùng tải lên cần được xác nhận thủ công.`,
    evaluate: ({ template }) => {
      const img = primaryImage(template, role);
      if (!img) return notEvaluated('Chưa có ảnh.');
      if (img.image.isSpecimen) return fail('Đang dùng ảnh MẪU của công cụ — thay bằng ảnh thật.');
      return manual('Cần xác nhận ảnh là bản thật, được phép sử dụng.');
    },
  };
}

const generalRules = (profile) => [
  {
    id: `ND30-G-01-${profile}`,
    baseId: 'ND30-G-01',
    title: 'Hình thức chữ ký được hiển thị',
    legalRef: ref('legalValue'),
    profiles: [profile],
    severity: 'error',
    kind: 'auto',
    explanation: 'Vị trí, hình ảnh chữ ký số theo Phụ lục I — chữ ký phải được hiển thị (không đặt chế độ ẩn).',
    evaluate: ({ signature }) => (signature && signature.visible === false ? fail('Chữ ký đang bị ẩn.') : pass('Đang hiển thị.')),
  },
  {
    id: `ND30-G-02-${profile}`,
    baseId: 'ND30-G-02',
    title: 'Nằm trong vùng hiển thị của trang',
    legalRef: ref('legalValue'),
    profiles: [profile],
    severity: 'error',
    kind: 'auto',
    explanation: 'Khung chữ ký phải nằm trọn trong vùng hiển thị (CropBox) của trang.',
    evaluate: ({ signature, geom }) => {
      if (!signature || !geom) return notEvaluated('Cần tài liệu PDF và vị trí đặt.');
      return isRectInsidePage(geom, signature.rect) ? pass('Nằm trong trang.') : fail('Khung vượt ra ngoài trang.');
    },
  },
];

// ─── Preset B — người có thẩm quyền ─────────────────────────────────────────
const P_B = 'nd30-authorized-person';
const presetB = [
  ...generalRules(P_B),
  ...imageRules('ND30-B', P_B, 'hand-signature', 'hình ảnh chữ ký', 'blue', 'xanh', 'signerImage'),
  {
    id: 'ND30-B-05',
    title: 'Canh giữa chức vụ và họ tên người ký',
    legalRef: ref('signerImage'),
    profiles: [P_B],
    severity: 'warning',
    kind: 'heuristic',
    explanation:
      'Ảnh chữ ký đặt canh giữa chức vụ và họ tên người ký. Công cụ tìm dòng chức vụ (signer.title) và họ tên (signer.name) trong lớp chữ của PDF; đạt khi tâm ngang ảnh lệch ≤ 15 pt so với tâm hai dòng chữ và ảnh nằm giữa hai dòng theo chiều dọc. Nếu không tìm thấy chữ trong PDF, cần kiểm tra thủ công.',
    evaluate: ({ signature, template, geom, pageText, data: previewData }) => {
      if (!signature || !geom) return notEvaluated('Cần tài liệu PDF và vị trí đặt.');
      const img = primaryImage(template, 'hand-signature');
      if (!img) return notEvaluated('Chưa có ảnh chữ ký.');
      if (geom.rotate !== 0) return manual('Trang có /Rotate — kiểm tra canh giữa bằng mắt.');
      const items = pageText?.[signature.page];
      const data = previewData?.signer ?? {};
      if (!items?.length) return manual('PDF không có lớp chữ để tìm chức vụ/họ tên — kiểm tra bằng mắt.');
      const norm = (s) => String(s ?? '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
      const find = (needle) => (needle ? items.filter((i) => norm(i.str).includes(norm(needle))) : []);
      const titles = find(data.title);
      const names = find(data.name);
      if (!titles.length || !names.length) return manual(`Không tìm thấy dòng "${data.title ?? ''}" hoặc "${data.name ?? ''}" trên trang ${signature.page}.`);
      const r = imageContentUserRect(geom, signature, img);
      const cx = r.x + r.width / 2;
      // pick the title above and the name below the image, closest to it
      const above = titles.filter((t) => t.y >= r.y).sort((a, b) => a.y - b.y)[0];
      const below = names.filter((n) => n.y <= r.y + r.height).sort((a, b) => b.y - a.y)[0];
      if (!above || !below) return fail('Ảnh chữ ký không nằm giữa dòng chức vụ (phía trên) và họ tên (phía dưới).');
      const textCx = ((above.x + above.width / 2) + (below.x + below.width / 2)) / 2;
      const dx = Math.abs(cx - textCx);
      const between = r.y + r.height <= above.y + 2 && r.y >= below.y + below.height * 0.5 - 2;
      const measured = `Lệch tâm ngang: ${dx.toFixed(1)} pt`;
      if (dx > 15) return fail('Ảnh chữ ký chưa canh giữa so với chức vụ và họ tên.', measured);
      if (!between) return fail('Ảnh chữ ký chồng lên dòng chức vụ hoặc họ tên.', measured);
      return pass('Canh giữa chức vụ và họ tên.', measured);
    },
  },
  authenticImageRule('ND30-B', P_B, 'hand-signature', 'chữ ký của người có thẩm quyền trên văn bản giấy', 'signerImage'),
  noExtraTextRule('ND30-B', P_B, 'signerImage'),
];

// ─── Preset A — cơ quan, tổ chức ────────────────────────────────────────────
const P_A = 'nd30-organization';
const presetA = [
  ...generalRules(P_A),
  ...imageRules('ND30-A', P_A, 'seal', 'hình ảnh dấu', 'red', 'đỏ', 'organizationImage'),
  {
    id: 'ND30-A-05',
    title: 'Kích thước bằng kích thước thực tế của dấu',
    legalRef: ref('organizationImage'),
    profiles: [P_A],
    severity: 'error',
    kind: 'auto',
    explanation:
      'Hình ảnh dấu có kích thước bằng kích thước thực tế của dấu. Người dùng khai báo đường kính/cạnh thật của con dấu (mm); công cụ đo phần có mực của ảnh khi hiển thị (đã trừ viền trong suốt). Dung sai: ±1 mm (diễn giải của công cụ).',
    evaluate: ({ template, geom }) => {
      const img = primaryImage(template, 'seal');
      if (!img) return notEvaluated('Chưa có ảnh dấu.');
      const declared = img.image.physicalSizeMm;
      if (!declared) return notEvaluated('Chưa khai báo kích thước thật của con dấu (mm).');
      const d = imageDrawRect(img.image.fit, img.width, img.height, img.image.naturalWidth, img.image.naturalHeight);
      const cb = img.image.analysis?.contentBox ?? { width: 1, height: 1 };
      const sizePt = Math.max(d.width * cb.width, d.height * cb.height);
      const mm = pointsToMm(sizePt, geom?.userUnit ?? 1);
      const measured = `Hiển thị: ${mm.toFixed(1)} mm; khai báo: ${declared} mm`;
      return Math.abs(mm - declared) <= 1 ? pass('Đúng kích thước thực tế.', measured) : fail('Kích thước hiển thị khác kích thước thật của dấu.', measured);
    },
  },
  {
    id: 'ND30-A-06',
    title: 'Trùm lên khoảng 1/3 ảnh chữ ký người có thẩm quyền về bên trái',
    legalRef: ref('organizationImage'),
    profiles: [P_A],
    severity: 'warning',
    kind: 'heuristic',
    explanation:
      'Ảnh dấu trùm lên khoảng 1/3 hình ảnh chữ ký số của người có thẩm quyền, về bên trái. Công cụ tìm chữ ký "người có thẩm quyền" (Preset B) trên cùng trang, đo phần chiều ngang ảnh chữ ký bị dấu che tính từ mép trái. Diễn giải "khoảng 1/3": từ 20% đến 45%; dấu phải nằm lệch về bên trái và chồng lên ảnh theo chiều dọc.',
    evaluate: ({ signature, geom, documentSignatures, pageGeoms, template }) => {
      if (!signature || !geom) return notEvaluated('Cần tài liệu PDF và vị trí đặt.');
      const seal = primaryImage(template, 'seal');
      if (!seal) return notEvaluated('Chưa có ảnh dấu.');
      const signer = (documentSignatures ?? []).find(
        (s) => s.id !== signature.id && s.page === signature.page && s.template.complianceProfile === 'nd30-authorized-person' && primaryImage(s.template, 'hand-signature')
      );
      if (!signer) return notEvaluated(`Chưa có chữ ký người có thẩm quyền (có ảnh chữ ký) trên trang ${signature.page} để đối chiếu.`);
      const sg = pageGeoms?.[signer.page] ?? geom;
      const sigRect = imageContentUserRect(sg, signer, primaryImage(signer.template, 'hand-signature'));
      const sealRect = imageContentUserRect(geom, signature, seal);
      const ox0 = Math.max(sigRect.x, sealRect.x);
      const ox1 = Math.min(sigRect.x + sigRect.width, sealRect.x + sealRect.width);
      const oy0 = Math.max(sigRect.y, sealRect.y);
      const oy1 = Math.min(sigRect.y + sigRect.height, sealRect.y + sealRect.height);
      const overlapW = Math.max(0, ox1 - ox0);
      const overlapsV = oy1 > oy0;
      const ratio = overlapW / sigRect.width;
      const leftSide = sealRect.x + sealRect.width / 2 < sigRect.x + sigRect.width / 2 && ox0 <= sigRect.x + 0.5;
      const measured = `Phần chữ ký bị dấu che (theo chiều ngang): ${Math.round(ratio * 100)}%`;
      if (!overlapsV || overlapW === 0) return fail('Dấu không chồng lên ảnh chữ ký.', measured);
      if (!leftSide) return fail('Dấu chồng lên ảnh chữ ký nhưng không ở phía bên trái.', measured);
      if (ratio < 0.2 || ratio > 0.45) return fail('Dấu chưa trùm khoảng 1/3 ảnh chữ ký.', measured);
      return pass('Dấu trùm khoảng 1/3 ảnh chữ ký về bên trái.', measured);
    },
  },
  authenticImageRule('ND30-A', P_A, 'seal', 'dấu của cơ quan, tổ chức ban hành văn bản', 'organizationImage'),
  noExtraTextRule('ND30-A', P_A, 'organizationImage'),
];

// ─── Preset A2 — văn bản kèm theo (khác tệp) ────────────────────────────────
const P_K = 'nd30-attachment';
const presetK = [
  ...generalRules(P_K),
  ...placementRules('ND30-K', P_K, 'attachment'),
  {
    id: 'ND30-K-I1',
    title: 'Thông tin: số và ký hiệu văn bản; thời gian ký',
    legalRef: ref('attachment'),
    profiles: [P_K],
    severity: 'error',
    kind: 'auto',
    explanation: 'Thông tin gồm số và ký hiệu văn bản ({{document.number}}) và thời gian ký ({{signing.datetime}}).',
    evaluate: ({ template }) => {
      const missing = [];
      if (!textUsesVariable(template, ['document.number'])) missing.push('số và ký hiệu văn bản');
      if (!textUsesVariable(template, ['signing.datetime']) && !(textUsesVariable(template, ['signing.date']) && textUsesVariable(template, ['signing.time']))) missing.push('thời gian ký');
      return missing.length ? fail(`Thiếu: ${missing.join(', ')}.`) : pass('Đủ thông tin.');
    },
  },
  ...typographyRules('ND30-K', P_K, 'attachment'),
];

// ─── Preset C — bản sao điện tử ─────────────────────────────────────────────
const P_C = 'nd30-electronic-copy';
const presetC = [
  ...generalRules(P_C),
  ...placementRules('ND30-C', P_C, 'electronicCopy', 'ô số 14'),
  {
    id: 'ND30-C-I1',
    title: 'Thông tin: hình thức sao, cơ quan sao, thời gian ký',
    legalRef: ref('electronicCopy'),
    profiles: [P_C],
    severity: 'error',
    kind: 'auto',
    explanation: 'Thông tin gồm hình thức sao ({{copy.form}}), tên cơ quan, tổ chức sao văn bản ({{copy.organization}}) và thời gian ký ({{signing.datetime}}).',
    evaluate: ({ template }) => {
      const missing = [];
      if (!textUsesVariable(template, ['copy.form'])) missing.push('hình thức sao');
      if (!textUsesVariable(template, ['copy.organization'])) missing.push('tên cơ quan sao');
      if (!textUsesVariable(template, ['signing.datetime']) && !(textUsesVariable(template, ['signing.date']) && textUsesVariable(template, ['signing.time']))) missing.push('thời gian ký');
      return missing.length ? fail(`Thiếu: ${missing.join(', ')}.`) : pass('Đủ thông tin.');
    },
  },
  {
    id: 'ND30-C-I2',
    title: 'Hình thức sao hợp lệ',
    legalRef: ref('copyForm'),
    profiles: [P_C],
    severity: 'error',
    kind: 'auto',
    explanation: `Hình thức sao là một trong: ${COPY_FORMS.map((f) => `"${f}"`).join(', ')}. Kiểm tra trên dữ liệu đang xem trước (mẫu hoặc thực tế).`,
    evaluate: ({ data }) => {
      const form = String(data?.copy?.form ?? '').trim();
      if (!form) return notEvaluated('Chưa có giá trị hình thức sao trong dữ liệu.');
      return COPY_FORMS.includes(form) ? pass(`"${form}"`) : fail(`"${form}" không phải hình thức sao hợp lệ.`);
    },
  },
  ...typographyRules('ND30-C', P_C, 'electronicCopy'),
];

export const RULES = [...presetB, ...presetA, ...presetK, ...presetC];

export function rulesForProfile(profile) {
  return RULES.filter((r) => r.profiles.includes(profile));
}
