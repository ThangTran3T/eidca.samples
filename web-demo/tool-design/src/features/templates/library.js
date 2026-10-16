/**
 * Built-in template library. Pure data factories: `buildTemplateLibrary(assets)`
 * receives the rasterised specimen images ({ seal, signature, logo,
 * hospitalLogo } → { src, width, height, analysis }) so it also runs in tests.
 */
import { createElement, createTemplate, clone, DEFAULT_SAMPLE_DATA } from '../../engines/template-engine/index.js';
import { mmToPoints } from '../../engines/coordinate-engine/index.js';

const SEAL_DIAMETER_MM = 36; // the specimen artwork represents a 36 mm round seal

const img = (asset, extra = {}) => ({
  src: asset?.src ?? '',
  naturalWidth: asset?.width ?? 0,
  naturalHeight: asset?.height ?? 0,
  analysis: asset?.analysis ?? null,
  isSpecimen: Boolean(asset?.src),
  fit: 'contain',
  ...extra,
});

const ND30_SAMPLE = {
  ...clone(DEFAULT_SAMPLE_DATA),
  // Matches public/samples/quyet-dinh-mau.pdf so placement checks can find the signature block.
  signer: { name: 'Trần Thị Minh Anh', organization: 'Sở Khoa học và Công nghệ tỉnh Mẫu', title: 'PHÓ GIÁM ĐỐC' },
};

const TNR10 = { fontFamily: 'Times New Roman', fontSize: 10, color: '#000000', fontWeight: 'normal', fontStyle: 'normal' };

export function buildTemplateLibrary(assets = {}) {
  const sealPt = mmToPoints(SEAL_DIAMETER_MM);
  return [
    // 1 ── NĐ30: người có thẩm quyền (Preset B) ─────────────────────────────
    createTemplate({
      id: 'nd30-authorized-person',
      name: 'Nghị định 30 — Chữ ký người có thẩm quyền',
      description:
        'Hình ảnh chữ ký của người có thẩm quyền trên văn bản giấy, màu xanh, PNG nền trong suốt, đặt canh giữa chức vụ và họ tên người ký (Phụ lục I, Phần I, Mục II, khoản 7, điểm d). Đây là vùng hiển thị — không phải bản thân chữ ký số.',
      category: 'nd30',
      signatureType: 'authorized-person',
      complianceProfile: 'nd30-authorized-person',
      size: { width: 120, height: 56 },
      elements: [
        createElement('image', {
          id: 'hand-sig',
          role: 'hand-signature',
          name: 'Hình ảnh chữ ký',
          x: 0,
          y: 0,
          width: 120,
          height: 56,
          image: img(assets.signature),
        }),
      ],
      sampleData: clone(ND30_SAMPLE),
      legacy: { template: 'center' },
      builtIn: true,
    }),

    // 2 ── NĐ30: cơ quan, tổ chức (Preset A) ────────────────────────────────
    createTemplate({
      id: 'nd30-organization',
      name: 'Nghị định 30 — Chữ ký cơ quan/tổ chức',
      description: `Hình ảnh dấu của cơ quan ban hành văn bản, màu đỏ, kích thước bằng kích thước thật của dấu, PNG nền trong suốt, trùm khoảng 1/3 ảnh chữ ký người có thẩm quyền về bên trái (Phụ lục I, Phần I, Mục II, khoản 8, điểm a). Ảnh mẫu tương ứng con dấu ${SEAL_DIAMETER_MM} mm — hãy thay ảnh và khai báo kích thước dấu thật.`,
      category: 'nd30',
      signatureType: 'organization',
      complianceProfile: 'nd30-organization',
      size: { width: sealPt, height: sealPt },
      elements: [
        createElement('image', {
          id: 'seal',
          role: 'seal',
          name: 'Hình ảnh dấu',
          x: 0,
          y: 0,
          width: sealPt,
          height: sealPt,
          image: img(assets.seal, { physicalSizeMm: SEAL_DIAMETER_MM }),
        }),
      ],
      sampleData: clone(ND30_SAMPLE),
      legacy: { template: 'center' },
      builtIn: true,
    }),

    // 3 ── NĐ30: bản sao điện tử (Preset C) ─────────────────────────────────
    createTemplate({
      id: 'nd30-electronic-copy',
      name: 'Nghị định 30 — Chữ ký trên bản sao điện tử',
      description:
        'Góc trên, bên phải, trang đầu (ô số 14). Không hiển thị hình ảnh. Thông tin: hình thức sao, tên cơ quan sao, thời gian ký ISO 8601 múi giờ Việt Nam; Times New Roman, chữ in thường, đứng, cỡ 10, màu đen (Phụ lục I, Phần II, Mục I, khoản 3).',
      category: 'nd30',
      signatureType: 'electronic-copy',
      complianceProfile: 'nd30-electronic-copy',
      size: { width: 200, height: 42 },
      dateTime: { dateFormat: 'ISO8601', timeFormat: 'HH:mm:ss', timeZone: 'Asia/Ho_Chi_Minh', showDate: true, showTime: true },
      elements: [
        createElement('text', {
          id: 'copy-info',
          role: 'copy-info',
          name: 'Thông tin bản sao',
          x: 0,
          y: 0,
          width: 200,
          height: 42,
          constraints: { horizontal: 'stretch', vertical: 'stretch' },
          text: { ...TNR10, content: '{{copy.form}}\n{{copy.organization}}\nThời gian ký: {{signing.datetime}}', lineHeight: 1.2, align: 'left' },
        }),
      ],
      sampleData: clone(ND30_SAMPLE),
      legacy: { template: 'text_only' },
      builtIn: true,
    }),

    // 3b ── NĐ30: văn bản kèm theo khác tệp (Preset A2) ─────────────────────
    createTemplate({
      id: 'nd30-attachment',
      name: 'Nghị định 30 — Chữ ký cơ quan trên văn bản kèm theo',
      description:
        'Áp dụng khi văn bản kèm theo không cùng tệp với văn bản chính. Góc trên, bên phải, trang đầu; không hiển thị hình ảnh; số và ký hiệu văn bản, thời gian ký ISO 8601; Times New Roman, in thường, đứng, cỡ 10, màu đen (Phụ lục I, Phần I, Mục II, khoản 8, điểm b).',
      category: 'nd30',
      signatureType: 'attachment-organization',
      complianceProfile: 'nd30-attachment',
      size: { width: 200, height: 28 },
      dateTime: { dateFormat: 'ISO8601', timeFormat: 'HH:mm:ss', timeZone: 'Asia/Ho_Chi_Minh', showDate: true, showTime: true },
      elements: [
        createElement('text', {
          id: 'attach-info',
          role: 'document-number',
          name: 'Số, ký hiệu và thời gian ký',
          x: 0,
          y: 0,
          width: 200,
          height: 28,
          constraints: { horizontal: 'stretch', vertical: 'stretch' },
          text: { ...TNR10, content: 'Số: {{document.number}}\nThời gian ký: {{signing.datetime}}', lineHeight: 1.2 },
        }),
      ],
      sampleData: clone(ND30_SAMPLE),
      legacy: { template: 'text_only' },
      builtIn: true,
    }),

    // 3c ── Cơ quan/tổ chức kèm thông tin (không thuộc preset NĐ30) ─────────
    createTemplate({
      id: 'organization-info',
      name: 'Chữ ký cơ quan/tổ chức (kèm thông tin)',
      description: 'Ảnh dấu kèm tên cơ quan và thời gian ký, dùng cho văn bản không thuộc phạm vi Nghị định 30 (ví dụ chứng từ, hồ sơ nội bộ). Chế độ tùy chỉnh.',
      category: 'organization',
      signatureType: 'organization',
      size: { width: 210, height: 80 },
      elements: [
        createElement('image', { id: 'oi-seal', role: 'seal', name: 'Hình ảnh dấu', x: 0, y: 0, width: 80, height: 80, constraints: { horizontal: 'left', vertical: 'scale' }, image: img(assets.seal) }),
        createElement('text', { id: 'oi-org', role: 'organization', name: 'Tên cơ quan', x: 86, y: 16, width: 124, height: 26, constraints: { horizontal: 'stretch', vertical: 'center' }, text: { content: 'Ký bởi: {{signer.organization}}', fontSize: 9, fontWeight: 'bold', color: '#b91c1c', lineHeight: 1.2 } }),
        createElement('text', { id: 'oi-date', role: 'signing-datetime', name: 'Thời gian ký', x: 86, y: 44, width: 124, height: 24, constraints: { horizontal: 'stretch', vertical: 'center' }, text: { content: 'Ngày ký: {{signing.date}}\nGiờ ký: {{signing.time}}', fontSize: 8.5, color: '#b91c1c', lineHeight: 1.25 } }),
      ],
      legacy: { template: 'left' },
      builtIn: true,
    }),

    // 4 ── Cá nhân ──────────────────────────────────────────────────────────
    createTemplate({
      id: 'personal',
      name: 'Chữ ký cá nhân',
      description: 'Ảnh chữ ký bên trái, thông tin người ký và thời gian bên phải.',
      category: 'personal',
      signatureType: 'personal',
      size: { width: 200, height: 64 },
      style: { background: { color: '#ffffff', opacity: 0 }, border: { width: 0.75, color: '#1d4ed8', style: 'solid', radius: 4 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('image', { id: 'p-sig', role: 'hand-signature', name: 'Hình ảnh chữ ký', x: 6, y: 6, width: 70, height: 52, constraints: { horizontal: 'left', vertical: 'scale' }, image: img(assets.signature) }),
        createElement('text', {
          id: 'p-info',
          role: 'signer-name',
          name: 'Thông tin',
          x: 82,
          y: 8,
          width: 112,
          height: 50,
          constraints: { horizontal: 'stretch', vertical: 'stretch' },
          text: { content: 'Ký bởi: {{signer.name}}\nNgày ký: {{signing.date}}\nGiờ ký: {{signing.time}}', fontFamily: 'Arial', fontSize: 8, color: '#1d4ed8', lineHeight: 1.35 },
        }),
      ],
      legacy: { template: 'left' },
      builtIn: true,
    }),

    // 5 ── Cá nhân thuộc tổ chức ────────────────────────────────────────────
    createTemplate({
      id: 'personal-organization',
      name: 'Chữ ký cá nhân thuộc tổ chức',
      description: 'Logo tổ chức, họ tên, chức vụ, tên tổ chức và thời gian ký.',
      category: 'personal-organization',
      signatureType: 'personal-organization',
      size: { width: 210, height: 70 },
      style: { background: { color: '#f8fafc', opacity: 1 }, border: { width: 0.75, color: '#94a3b8', style: 'solid', radius: 6 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('image', { id: 'po-logo', role: 'logo', name: 'Logo', x: 8, y: 13, width: 44, height: 44, constraints: { horizontal: 'left', vertical: 'center' }, image: img(assets.logo, { isSpecimen: false }) }),
        createElement('text', { id: 'po-name', role: 'signer-name', name: 'Họ tên', x: 60, y: 8, width: 144, height: 14, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signer.name}}', fontFamily: 'Arial', fontSize: 10, fontWeight: 'bold', color: '#0f172a' } }),
        createElement('text', { id: 'po-title', role: 'organization', name: 'Chức vụ — tổ chức', x: 60, y: 23, width: 144, height: 22, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signer.title}}\n{{signer.organization}}', fontFamily: 'Arial', fontSize: 7.5, color: '#334155', lineHeight: 1.25 } }),
        createElement('text', { id: 'po-date', role: 'signing-datetime', name: 'Thời gian ký', x: 60, y: 50, width: 144, height: 12, constraints: { horizontal: 'stretch', vertical: 'bottom' }, text: { content: 'Thời gian ký: {{signing.datetime}}', fontFamily: 'Arial', fontSize: 7.5, color: '#334155' } }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signer: { name: 'Phạm Quốc Bảo', title: 'Trưởng phòng Kế hoạch – Tài chính', organization: 'Công ty CP Dược phẩm An Khang' } },
      legacy: { template: 'left' },
      builtIn: true,
    }),

    // 6 ── Doanh nghiệp (giống bố cục text_only mặc định của VNeCA) ─────────
    createTemplate({
      id: 'enterprise',
      name: 'Chữ ký doanh nghiệp',
      description: 'Bố cục chữ tương thích mẫu text_only của VNeCA: tổ chức, người ký, lý do, nơi ký, ngày ký.',
      category: 'enterprise',
      signatureType: 'enterprise',
      size: { width: 190, height: 80 },
      style: { background: { color: '#ffffff', opacity: 0 }, border: { width: 1, color: '#ff0033', style: 'solid', radius: 0 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('text', {
          id: 'e-info',
          role: 'organization',
          name: 'Thông tin chữ ký',
          x: 6,
          y: 6,
          width: 178,
          height: 68,
          constraints: { horizontal: 'stretch', vertical: 'stretch' },
          text: { content: 'Ký bởi: {{signer.organization}}\nNgười ký: {{signer.name}}\nLý do: {{signing.reason}}\nNơi ký: {{signing.location}}\nNgày ký: {{signing.datetime}}', fontFamily: 'Arial', fontSize: 9, color: '#ff0033', lineHeight: 1.3 },
        }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signer: { name: 'Lê Quang Huy', title: 'Tổng Giám đốc', organization: 'CÔNG TY CỔ PHẦN DƯỢC PHẨM AN KHANG' }, signing: { timestamp: '2026-10-16T14:05:12+07:00', reason: 'Ký hợp đồng điện tử', location: 'Hà Nội' } },
      legacy: { template: 'text_only' },
      builtIn: true,
    }),

    // 7 ── Bác sĩ ───────────────────────────────────────────────────────────
    createTemplate({
      id: 'doctor',
      name: 'Chữ ký bác sĩ',
      description: 'Chữ ký và họ tên bác sĩ trên phiếu kết quả, chỉ định, đơn thuốc điện tử.',
      category: 'doctor',
      signatureType: 'doctor',
      size: { width: 170, height: 78 },
      elements: [
        createElement('image', { id: 'd-sig', role: 'hand-signature', name: 'Hình ảnh chữ ký', x: 35, y: 0, width: 100, height: 44, constraints: { horizontal: 'center', vertical: 'top' }, image: img(assets.signature) }),
        createElement('text', { id: 'd-name', role: 'signer-name', name: 'Họ tên bác sĩ', x: 0, y: 46, width: 170, height: 14, constraints: { horizontal: 'stretch', vertical: 'bottom' }, text: { content: '{{signer.title}} {{signer.name}}', fontSize: 10.5, fontWeight: 'bold', align: 'center' } }),
        createElement('text', { id: 'd-date', role: 'signing-datetime', name: 'Thời gian ký', x: 0, y: 62, width: 170, height: 12, constraints: { horizontal: 'stretch', vertical: 'bottom' }, text: { content: 'Ký số lúc {{signing.time}} ngày {{signing.date}}', fontSize: 8, fontStyle: 'italic', align: 'center', color: '#1e3a8a' } }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signer: { name: 'Vũ Thanh Tâm', title: 'BS.CKII.', organization: 'Bệnh viện Đa khoa tỉnh Mẫu' }, document: { name: 'phieu-ket-qua-xet-nghiem.pdf', number: '' } },
      legacy: { template: 'center' },
      builtIn: true,
    }),

    // 8 ── Bệnh viện ────────────────────────────────────────────────────────
    createTemplate({
      id: 'hospital',
      name: 'Chữ ký bệnh viện',
      description: 'Chữ ký số của cơ sở khám chữa bệnh: logo, tên bệnh viện, thời gian và mã QR tra cứu giao dịch.',
      category: 'hospital',
      signatureType: 'hospital',
      size: { width: 220, height: 66 },
      style: { background: { color: '#f0fdfa', opacity: 1 }, border: { width: 0.75, color: '#0f766e', style: 'solid', radius: 4 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('image', { id: 'h-logo', role: 'logo', name: 'Logo bệnh viện', x: 7, y: 11, width: 44, height: 44, constraints: { horizontal: 'left', vertical: 'center' }, image: img(assets.hospitalLogo, { isSpecimen: false }) }),
        createElement('text', { id: 'h-org', role: 'organization', name: 'Tên bệnh viện', x: 57, y: 8, width: 110, height: 26, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signer.organization}}', fontFamily: 'Arial', fontSize: 8.5, fontWeight: 'bold', color: '#115e59', textTransform: 'uppercase', lineHeight: 1.2 } }),
        createElement('text', { id: 'h-date', role: 'signing-datetime', name: 'Thời gian ký', x: 57, y: 36, width: 110, height: 24, constraints: { horizontal: 'stretch', vertical: 'bottom' }, text: { content: 'Ký số: {{signing.datetime}}\nMã GD: {{transaction.id}}', fontFamily: 'Arial', fontSize: 7, color: '#134e4a', lineHeight: 1.3 } }),
        createElement('qr', { id: 'h-qr', role: 'qr', name: 'QR tra cứu', x: 171, y: 9, width: 46, height: 46, constraints: { horizontal: 'right', vertical: 'center' }, qr: { content: '{{transaction.id}}', color: '#134e4a', background: '#ffffff' } }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signer: { name: 'Bệnh viện Đa khoa tỉnh Mẫu', title: '', organization: 'Bệnh viện Đa khoa tỉnh Mẫu' }, signing: { timestamp: '2026-10-16T10:12:03+07:00', reason: 'Trả kết quả xét nghiệm', location: 'Tỉnh Mẫu' } },
      legacy: { template: 'left' },
      builtIn: true,
    }),

    // 9 ── Hợp đồng điện tử ─────────────────────────────────────────────────
    createTemplate({
      id: 'contract',
      name: 'Chữ ký hợp đồng điện tử',
      description: 'Đặt dưới "ĐẠI DIỆN BÊN A/B": ảnh chữ ký, họ tên, chức vụ, tổ chức và số hiệu chứng thư.',
      category: 'enterprise',
      signatureType: 'contract',
      size: { width: 200, height: 92 },
      style: { background: { color: '#ffffff', opacity: 0 }, border: { width: 0.75, color: '#7c3aed', style: 'dashed', radius: 6 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('image', { id: 'c-sig', role: 'hand-signature', name: 'Hình ảnh chữ ký', x: 50, y: 4, width: 100, height: 40, constraints: { horizontal: 'center', vertical: 'top' }, image: img(assets.signature) }),
        createElement('text', { id: 'c-name', role: 'signer-name', name: 'Họ tên', x: 6, y: 46, width: 188, height: 14, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signer.name}}', fontSize: 11, fontWeight: 'bold', align: 'center' } }),
        createElement('text', { id: 'c-meta', role: 'serial', name: 'Thông tin chứng thư', x: 6, y: 61, width: 188, height: 27, constraints: { horizontal: 'stretch', vertical: 'bottom' }, text: { content: '{{signer.title}} — {{signer.organization}}\nSerial: {{certificate.serial}} · {{signing.datetime}}', fontFamily: 'Arial', fontSize: 6.5, align: 'center', color: '#4c1d95', lineHeight: 1.3 } }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signer: { name: 'Phạm Thu Hà', title: 'Giám đốc', organization: 'Công ty TNHH Giải pháp Chữ ký số Việt' } },
      legacy: { template: 'center' },
      builtIn: true,
    }),

    // 10 ── Xác nhận ────────────────────────────────────────────────────────
    createTemplate({
      id: 'confirmation',
      name: 'Chữ ký xác nhận',
      description: 'Khung xác nhận nội dung (đã xem, đã kiểm tra...). Không phải dấu hiệu chữ ký hợp lệ.',
      category: 'confirmation',
      signatureType: 'confirmation',
      size: { width: 180, height: 52 },
      style: { background: { color: '#fff7ed', opacity: 1 }, border: { width: 1, color: '#c2410c', style: 'dashed', radius: 4 }, padding: 4, imageOpacity: 1 },
      elements: [
        createElement('text', { id: 'cf-head', role: 'reason', name: 'Nội dung xác nhận', x: 6, y: 6, width: 168, height: 14, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signing.reason}}', fontFamily: 'Arial', fontSize: 9, fontWeight: 'bold', color: '#9a3412', align: 'center' } }),
        createElement('text', { id: 'cf-body', role: 'signer-name', name: 'Người xác nhận', x: 6, y: 22, width: 168, height: 26, constraints: { horizontal: 'stretch', vertical: 'stretch' }, text: { content: '{{signer.name}} — {{signer.title}}\n{{signing.datetime}}', fontFamily: 'Arial', fontSize: 7.5, color: '#7c2d12', align: 'center', lineHeight: 1.3 } }),
      ],
      sampleData: { ...clone(DEFAULT_SAMPLE_DATA), signing: { timestamp: '2026-10-16T16:40:00+07:00', reason: 'Đã kiểm tra nội dung', location: 'Hà Nội' } },
      legacy: { template: 'text_only' },
      builtIn: true,
    }),

    // 11 ── Tùy chỉnh ───────────────────────────────────────────────────────
    createTemplate({
      id: 'custom-blank',
      name: 'Chữ ký tùy chỉnh',
      description: 'Khung trống để tự thiết kế. Chế độ tùy chỉnh — không đánh giá tuân thủ NĐ 30.',
      category: 'custom',
      signatureType: 'custom',
      size: { width: 180, height: 70 },
      style: { background: { color: '#ffffff', opacity: 0 }, border: { width: 0.75, color: '#64748b', style: 'dashed', radius: 0 }, padding: 0, imageOpacity: 1 },
      elements: [
        createElement('text', { id: 'cb-name', role: 'signer-name', name: 'Họ tên', x: 8, y: 8, width: 164, height: 16, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signer.name}}', fontWeight: 'bold', fontSize: 11 } }),
        createElement('text', { id: 'cb-date', role: 'signing-datetime', name: 'Thời gian ký', x: 8, y: 28, width: 164, height: 14, constraints: { horizontal: 'stretch', vertical: 'top' }, text: { content: '{{signing.datetime}}', fontSize: 9 } }),
      ],
      builtIn: true,
    }),
  ];
}

/** Category order for the sidebar. */
export const LIBRARY_ORDER = ['nd30', 'organization', 'personal', 'personal-organization', 'enterprise', 'hospital', 'doctor', 'confirmation', 'custom'];
