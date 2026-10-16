/** Designer schema identifiers. Bump SCHEMA_VERSION on breaking changes and add a migration. */
export const DESIGNER_FORMAT = 'vneca.signature-designer';
export const TEMPLATE_FORMAT = 'vneca.signature-template';
export const SCHEMA_VERSION = 1;

/**
 * Whitelisted dynamic variables. Interpolation only resolves these paths —
 * anything else is left untouched (no eval, no property traversal).
 * `extension: true` marks variables added for Decree 30 presets that the
 * VNeCA legacy schema does not know about.
 */
export const VARIABLES = [
  { key: 'signer.name', label: 'Họ tên người ký', group: 'signer' },
  { key: 'signer.organization', label: 'Cơ quan/tổ chức', group: 'signer' },
  { key: 'signer.title', label: 'Chức vụ', group: 'signer' },
  { key: 'certificate.subject', label: 'Chủ thể chứng thư số', group: 'certificate' },
  { key: 'certificate.issuer', label: 'Tổ chức cấp chứng thư', group: 'certificate' },
  { key: 'certificate.serial', label: 'Số hiệu chứng thư', group: 'certificate' },
  { key: 'signing.date', label: 'Ngày ký', group: 'signing' },
  { key: 'signing.time', label: 'Giờ ký', group: 'signing' },
  { key: 'signing.datetime', label: 'Thời gian ký', group: 'signing' },
  { key: 'signing.reason', label: 'Lý do ký', group: 'signing' },
  { key: 'signing.location', label: 'Nơi ký', group: 'signing' },
  { key: 'document.name', label: 'Tên tài liệu', group: 'document' },
  { key: 'transaction.id', label: 'Mã giao dịch', group: 'transaction' },
  { key: 'document.number', label: 'Số, ký hiệu văn bản', group: 'document', extension: true },
  { key: 'copy.form', label: 'Hình thức sao', group: 'copy', extension: true },
  { key: 'copy.organization', label: 'Cơ quan sao văn bản', group: 'copy', extension: true },
];
export const VARIABLE_KEYS = new Set(VARIABLES.map((v) => v.key));

/** Raw (unformatted) runtime data fields. signing.date/time/datetime are derived from signing.timestamp. */
export const DEFAULT_SAMPLE_DATA = Object.freeze({
  signer: { name: 'Nguyễn Văn An', organization: 'Sở Khoa học và Công nghệ tỉnh Mẫu', title: 'Giám đốc' },
  certificate: {
    subject: 'CN=Nguyễn Văn An, O=Sở Khoa học và Công nghệ tỉnh Mẫu, C=VN',
    issuer: 'VNeCA Test CA (mẫu)',
    serial: '5401 0A9F 3C7E 21B6',
  },
  signing: { timestamp: '2026-10-15T09:30:45+07:00', reason: 'Phê duyệt văn bản', location: 'Hà Nội' },
  document: { name: 'quyet-dinh-mau.pdf', number: '125/QĐ-SKHCN' },
  transaction: { id: 'TX-2026-000123' },
  copy: { form: 'SAO Y', organization: 'Văn phòng UBND tỉnh Mẫu' },
});

export const ELEMENT_TYPES = ['text', 'image', 'qr', 'rect', 'line'];

/** Semantic roles. They drive the legacy export mapping and the compliance rules. */
export const ROLES = {
  text: 'Văn bản',
  'signer-name': 'Họ tên người ký',
  'signer-title': 'Chức vụ',
  organization: 'Tên cơ quan/tổ chức',
  subject: 'Chủ thể chứng thư',
  'signing-date': 'Ngày ký',
  'signing-time': 'Giờ ký',
  'signing-datetime': 'Thời gian ký',
  reason: 'Lý do ký',
  location: 'Nơi ký',
  contact: 'Liên hệ',
  issuer: 'Tổ chức cấp chứng thư',
  serial: 'Số hiệu chứng thư',
  'copy-info': 'Thông tin bản sao',
  'document-number': 'Số, ký hiệu văn bản',
  'hand-signature': 'Hình ảnh chữ ký',
  seal: 'Hình ảnh con dấu',
  logo: 'Logo',
  background: 'Ảnh nền',
  qr: 'Mã QR',
  shape: 'Hình chữ nhật',
  line: 'Đường kẻ',
};

export const SIGNATURE_TYPES = {
  'authorized-person': 'Người có thẩm quyền (NĐ 30)',
  organization: 'Cơ quan, tổ chức (NĐ 30)',
  'attachment-organization': 'Cơ quan, tổ chức trên văn bản kèm theo (NĐ 30)',
  'electronic-copy': 'Bản sao điện tử (NĐ 30)',
  personal: 'Cá nhân',
  'personal-organization': 'Cá nhân thuộc tổ chức',
  enterprise: 'Doanh nghiệp',
  hospital: 'Bệnh viện',
  doctor: 'Bác sĩ',
  contract: 'Hợp đồng điện tử',
  confirmation: 'Xác nhận',
  custom: 'Tùy chỉnh',
};

export const TEMPLATE_CATEGORIES = {
  nd30: 'Nghị định 30/2020/NĐ-CP',
  organization: 'Chữ ký cơ quan/tổ chức',
  personal: 'Chữ ký cá nhân',
  'personal-organization': 'Chữ ký cá nhân thuộc tổ chức',
  enterprise: 'Chữ ký doanh nghiệp',
  hospital: 'Chữ ký bệnh viện',
  doctor: 'Chữ ký bác sĩ',
  confirmation: 'Chữ ký xác nhận',
  custom: 'Mẫu tùy chỉnh',
};

export const DATE_FORMATS = {
  'DD/MM/YYYY': '15/10/2026',
  'DD-MM-YYYY': '15-10-2026',
  'DD.MM.YYYY': '15.10.2026',
  'YYYY-MM-DD': '2026-10-15',
  'vi-long': 'ngày 15 tháng 10 năm 2026',
  ISO8601: '2026-10-15T09:30:45+07:00 (ISO 8601)',
};
export const TIME_FORMATS = {
  'HH:mm:ss': '09:30:45',
  'HH:mm': '09:30',
  'HH:mm:ss Z': '09:30:45 +07:00',
  'HH:mm Z': '09:30 +07:00',
};
export const TIME_ZONES = {
  'Asia/Ho_Chi_Minh': 'Việt Nam (UTC+07:00)',
  UTC: 'UTC',
  'Asia/Bangkok': 'Bangkok (UTC+07:00)',
  'Asia/Singapore': 'Singapore (UTC+08:00)',
};

export const COPY_FORMS = ['SAO Y', 'SAO LỤC', 'TRÍCH SAO'];
