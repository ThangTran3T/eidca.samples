import { DEFAULT_SAMPLE_DATA } from './constants.js';

let counter = 0;
export function uid(prefix = 'id') {
  counter = (counter + 1) % 1e6;
  const rand =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 14);
  return `${prefix}_${rand}${counter.toString(36)}`;
}

export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

const TEXT_DEFAULTS = {
  content: 'Nội dung',
  fontFamily: 'Times New Roman',
  fontSize: 10,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#000000',
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.25,
  wrap: true,
  hideEmptyLines: true,
  textTransform: 'none',
};
const IMAGE_DEFAULTS = { src: '', fileName: '', fit: 'contain', naturalWidth: 0, naturalHeight: 0, analysis: null, physicalSizeMm: null, isSpecimen: false };
const QR_DEFAULTS = { content: '{{transaction.id}}', color: '#000000', background: '#ffffff', transparentBackground: false, errorCorrection: 'M' };
const SHAPE_DEFAULTS = { fill: '#ffffff', fillOpacity: 0, stroke: '#000000', strokeWidth: 1, radius: 0, dashed: false };
const LINE_DEFAULTS = { stroke: '#000000', strokeWidth: 1, dashed: false };

export function createElement(type, overrides = {}) {
  const { text, image, qr, shape, line, ...rest } = overrides;
  const base = {
    id: uid('el'),
    name: '',
    role: type === 'image' ? 'logo' : type === 'qr' ? 'qr' : type === 'rect' ? 'shape' : type === 'line' ? 'line' : 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    lockAspectRatio: type === 'image' || type === 'qr',
    constraints: { horizontal: 'scale', vertical: 'scale' },
    condition: null,
    type,
    ...rest,
  };
  switch (type) {
    case 'text':
      return { ...base, text: { ...TEXT_DEFAULTS, ...text } };
    case 'image':
      return { ...base, image: { ...IMAGE_DEFAULTS, ...image } };
    case 'qr':
      return { ...base, qr: { ...QR_DEFAULTS, ...qr } };
    case 'rect':
      return { ...base, shape: { ...SHAPE_DEFAULTS, ...shape } };
    case 'line':
      return { ...base, line: { ...LINE_DEFAULTS, ...line } };
    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

export function createTemplate(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uid('tpl'),
    name: 'Mẫu chữ ký mới',
    description: '',
    category: 'custom',
    signatureType: 'custom',
    version: '1.0.0',
    complianceProfile: null,
    complianceAttestations: {},
    size: { width: 180, height: 80 },
    style: {
      background: { color: '#ffffff', opacity: 0 },
      border: { width: 0, color: '#000000', style: 'solid', radius: 0 },
      padding: 0,
      imageOpacity: 1,
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm:ss', timeZone: 'Asia/Ho_Chi_Minh', showDate: true, showTime: true },
    elements: [],
    sampleData: clone(DEFAULT_SAMPLE_DATA),
    legacy: {},
    builtIn: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Catalogue of insertable elements shown in the left sidebar.
 * `make(size)` receives the current template size so items land sensibly.
 */
export const ELEMENT_CATALOG = [
  { key: 'text', label: 'Văn bản', icon: 'Type', make: () => createElement('text', { role: 'text', name: 'Văn bản', width: 120, height: 16, text: { content: 'Văn bản' } }) },
  { key: 'signer-name', label: 'Họ tên người ký', icon: 'UserRound', make: () => createElement('text', { role: 'signer-name', name: 'Họ tên', width: 150, height: 16, text: { content: '{{signer.name}}', fontWeight: 'bold' } }) },
  { key: 'signer-title', label: 'Chức vụ', icon: 'BadgeCheck', make: () => createElement('text', { role: 'signer-title', name: 'Chức vụ', width: 150, height: 16, text: { content: '{{signer.title}}' } }) },
  { key: 'subject', label: 'Chủ thể chứng thư số', icon: 'IdCard', make: () => createElement('text', { role: 'subject', name: 'Chủ thể', width: 170, height: 28, text: { content: 'Ký bởi: {{certificate.subject}}', fontSize: 8 } }) },
  { key: 'organization', label: 'Tên cơ quan/tổ chức', icon: 'Building2', make: () => createElement('text', { role: 'organization', name: 'Cơ quan', width: 170, height: 16, text: { content: '{{signer.organization}}' } }) },
  { key: 'signing-date', label: 'Ngày ký', icon: 'CalendarDays', make: () => createElement('text', { role: 'signing-date', name: 'Ngày ký', width: 140, height: 16, text: { content: 'Ngày ký: {{signing.date}}' } }) },
  { key: 'signing-time', label: 'Giờ ký', icon: 'Clock', make: () => createElement('text', { role: 'signing-time', name: 'Giờ ký', width: 140, height: 16, text: { content: 'Giờ ký: {{signing.time}}' } }) },
  { key: 'reason', label: 'Lý do ký', icon: 'MessageSquareText', make: () => createElement('text', { role: 'reason', name: 'Lý do', width: 170, height: 16, text: { content: 'Lý do: {{signing.reason}}' } }) },
  { key: 'location', label: 'Nơi ký', icon: 'MapPin', make: () => createElement('text', { role: 'location', name: 'Nơi ký', width: 170, height: 16, text: { content: 'Nơi ký: {{signing.location}}' } }) },
  { key: 'issuer', label: 'Tổ chức cấp chứng thư', icon: 'ShieldCheck', make: () => createElement('text', { role: 'issuer', name: 'Tổ chức cấp', width: 170, height: 16, text: { content: 'Cấp bởi: {{certificate.issuer}}', fontSize: 8 } }) },
  { key: 'serial', label: 'Số hiệu chứng thư', icon: 'Hash', make: () => createElement('text', { role: 'serial', name: 'Serial', width: 170, height: 16, text: { content: 'Serial: {{certificate.serial}}', fontSize: 8 } }) },
  { key: 'hand-signature', label: 'Hình ảnh chữ ký', icon: 'PenLine', make: () => createElement('image', { role: 'hand-signature', name: 'Hình ảnh chữ ký', width: 90, height: 45 }) },
  { key: 'seal', label: 'Hình ảnh con dấu', icon: 'Stamp', make: () => createElement('image', { role: 'seal', name: 'Con dấu', width: 100, height: 100 }) },
  { key: 'logo', label: 'Logo', icon: 'Image', make: () => createElement('image', { role: 'logo', name: 'Logo', width: 40, height: 40 }) },
  { key: 'qr', label: 'Mã QR', icon: 'QrCode', make: () => createElement('qr', { role: 'qr', name: 'Mã QR', width: 50, height: 50 }) },
  { key: 'rect', label: 'Hình chữ nhật', icon: 'Square', make: () => createElement('rect', { role: 'shape', name: 'Hình chữ nhật', width: 80, height: 40, lockAspectRatio: false }) },
  { key: 'line', label: 'Đường kẻ', icon: 'Minus', make: () => createElement('line', { role: 'line', name: 'Đường kẻ', width: 120, height: 0, lockAspectRatio: false }) },
  {
    key: 'background',
    label: 'Ảnh nền',
    icon: 'Wallpaper',
    make: (size) =>
      createElement('image', { role: 'background', name: 'Ảnh nền', x: 0, y: 0, width: size?.width ?? 180, height: size?.height ?? 80, opacity: 0.25, lockAspectRatio: false, image: { fit: 'contain' } }),
  },
];
