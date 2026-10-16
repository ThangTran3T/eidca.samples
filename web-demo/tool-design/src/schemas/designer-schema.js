/**
 * Designer Schema — the canonical internal data model. It contains complete
 * element-level information and can reconstruct the entire visual design.
 * The VNeCA legacy schema (see legacy-schema.js) is a lossy projection of it.
 */
import { z } from 'zod';
import { DESIGNER_FORMAT, TEMPLATE_FORMAT, SCHEMA_VERSION, ROLES, SIGNATURE_TYPES, TEMPLATE_CATEGORIES } from '../engines/template-engine/constants.js';
import { FONT_FAMILIES } from '../engines/rendering-engine/fonts.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải ở dạng #RRGGBB');
const unit = z.number().min(0).max(1);
const finite = z.number().finite();
const nonNeg = z.number().finite().min(0);
// Images are embedded as data URLs so templates are self-contained; only raster types we can embed in PDFs.
const imageDataUrl = z
  .string()
  .max(8_000_000, 'Ảnh quá lớn (tối đa ~6 MB)')
  .refine((s) => s === '' || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s), 'Ảnh phải là PNG hoặc JPEG dạng data URL');

export const conditionSchema = z
  .object({
    variable: z.string().max(64),
    operator: z.enum(['notEmpty', 'empty', 'equals', 'notEquals', 'contains']),
    value: z.string().max(500).optional(),
  })
  .nullable();

export const constraintsSchema = z.object({
  horizontal: z.enum(['left', 'right', 'center', 'stretch', 'scale']).default('scale'),
  vertical: z.enum(['top', 'bottom', 'center', 'stretch', 'scale']).default('scale'),
});

const baseElement = {
  id: z.string().min(1).max(64),
  name: z.string().max(120).default(''),
  role: z.enum(Object.keys(ROLES)).default('text'),
  x: finite,
  y: finite,
  width: nonNeg,
  height: nonNeg,
  rotation: finite.default(0),
  opacity: unit.default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  lockAspectRatio: z.boolean().default(false),
  constraints: constraintsSchema.default({ horizontal: 'scale', vertical: 'scale' }),
  condition: conditionSchema.default(null),
};

export const textPropsSchema = z.object({
  content: z.string().max(4000),
  fontFamily: z.enum(Object.keys(FONT_FAMILIES)).default('Times New Roman'),
  fontSize: z.number().min(2).max(200).default(10),
  fontWeight: z.enum(['normal', 'bold']).default('normal'),
  fontStyle: z.enum(['normal', 'italic']).default('normal'),
  color: hexColor.default('#000000'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'),
  lineHeight: z.number().min(0.8).max(4).default(1.25),
  wrap: z.boolean().default(true),
  hideEmptyLines: z.boolean().default(true),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
});

export const imageAnalysisSchema = z
  .object({
    mime: z.string(),
    hasAlpha: z.boolean(),
    transparentRatio: unit,
    cornersTransparent: z.boolean(),
    dominantColor: z.enum(['red', 'blue', 'black', 'green', 'other', 'none']),
    averageColor: hexColor.nullable(),
    redRatio: unit,
    blueRatio: unit,
    contentBox: z.object({ x: unit, y: unit, width: unit, height: unit }).nullable(),
  })
  .partial()
  .nullable();

export const imagePropsSchema = z.object({
  src: imageDataUrl.default(''),
  fileName: z.string().max(255).default(''),
  fit: z.enum(['contain', 'cover', 'stretch']).default('contain'),
  naturalWidth: nonNeg.default(0),
  naturalHeight: nonNeg.default(0),
  analysis: imageAnalysisSchema.default(null),
  /** Declared physical diameter/size of the real seal in mm (Decree 30 seal size rule). */
  physicalSizeMm: z.number().min(0).max(200).nullable().default(null),
  isSpecimen: z.boolean().default(false),
});

export const qrPropsSchema = z.object({
  content: z.string().max(1500).default('{{transaction.id}}'),
  color: hexColor.default('#000000'),
  background: hexColor.default('#ffffff'),
  transparentBackground: z.boolean().default(false),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
});

export const shapePropsSchema = z.object({
  fill: hexColor.default('#ffffff'),
  fillOpacity: unit.default(0),
  stroke: hexColor.default('#000000'),
  strokeWidth: z.number().min(0).max(20).default(1),
  radius: z.number().min(0).max(200).default(0),
  dashed: z.boolean().default(false),
});

export const linePropsSchema = z.object({
  stroke: hexColor.default('#000000'),
  strokeWidth: z.number().min(0.1).max(20).default(1),
  dashed: z.boolean().default(false),
});

export const elementSchema = z.discriminatedUnion('type', [
  z.object({ ...baseElement, type: z.literal('text'), text: textPropsSchema }),
  z.object({ ...baseElement, type: z.literal('image'), image: imagePropsSchema }),
  z.object({ ...baseElement, type: z.literal('qr'), qr: qrPropsSchema }),
  z.object({ ...baseElement, type: z.literal('rect'), shape: shapePropsSchema }),
  z.object({ ...baseElement, type: z.literal('line'), line: linePropsSchema }),
]);

export const templateStyleSchema = z.object({
  background: z.object({ color: hexColor.default('#ffffff'), opacity: unit.default(0) }).default({ color: '#ffffff', opacity: 0 }),
  border: z
    .object({
      width: z.number().min(0).max(20).default(0),
      color: hexColor.default('#000000'),
      style: z.enum(['solid', 'dashed']).default('solid'),
      radius: z.number().min(0).max(100).default(0),
    })
    .default({ width: 0, color: '#000000', style: 'solid', radius: 0 }),
  padding: z.number().min(0).max(100).default(0),
  imageOpacity: unit.default(1),
});

export const dateTimeSchema = z.object({
  dateFormat: z.string().max(40).default('DD/MM/YYYY'),
  timeFormat: z.string().max(40).default('HH:mm:ss'),
  timeZone: z.string().max(64).default('Asia/Ho_Chi_Minh'),
  showDate: z.boolean().default(true),
  showTime: z.boolean().default(true),
});

const textData = z.record(z.string(), z.string().max(2000));
export const sampleDataSchema = z.object({
  signer: textData.default({}),
  certificate: textData.default({}),
  signing: textData.default({}),
  document: textData.default({}),
  transaction: textData.default({}),
  copy: textData.default({}),
});

export const attestationSchema = z.object({
  confirmed: z.boolean(),
  note: z.string().max(1000).default(''),
  at: z.string().max(40),
});

export const templateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  category: z.enum(Object.keys(TEMPLATE_CATEGORIES)).default('custom'),
  signatureType: z.enum(Object.keys(SIGNATURE_TYPES)).default('custom'),
  version: z.string().max(20).default('1.0.0'),
  complianceProfile: z
    .enum(['nd30-authorized-person', 'nd30-organization', 'nd30-attachment', 'nd30-electronic-copy'])
    .nullable()
    .default(null),
  complianceAttestations: z.record(z.string(), attestationSchema).default({}),
  size: z.object({ width: z.number().min(4).max(2000), height: z.number().min(4).max(2000) }),
  style: templateStyleSchema.prefault({}),
  dateTime: dateTimeSchema.prefault({}),
  elements: z.array(elementSchema).max(200),
  sampleData: sampleDataSchema.prefault({}),
  /** Hints used only when projecting into the VNeCA legacy schema. */
  legacy: z
    .object({
      template: z.enum(['right', 'left', 'center', 'text_only']).optional(),
      contact: z.string().max(500).optional(),
      /** Labels imported from legacy JSON that have no element-level meaning (e.g. contact_label). */
      labels: z.record(z.string(), z.string().max(500)).optional(),
      /** Unknown legacy fields, preserved verbatim and re-emitted on export. */
      extra: z.record(z.string(), z.unknown()).optional(),
    })
    .default({}),
  builtIn: z.boolean().default(false),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
});

export const rectSchema = z.object({ x: finite, y: finite, width: z.number().positive(), height: z.number().positive() });

export const signatureSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(160).default('Chữ ký'),
  page: z.number().int().min(1),
  /** PDF user space, lower-left origin, points. */
  rect: rectSchema,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  opacity: unit.default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  template: templateSchema,
});

export const designerDocumentSchema = z.object({
  format: z.literal(DESIGNER_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string().max(40).optional(),
  application: z.string().max(80).optional(),
  document: z
    .object({
      name: z.string().max(255).default(''),
      pageCount: z.number().int().min(0).default(0),
      pages: z
        .array(z.object({ view: z.array(finite).length(4), rotate: z.number().int() }))
        .max(5000)
        .default([]),
    })
    .default({ name: '', pageCount: 0, pages: [] }),
  signatures: z.array(signatureSchema).max(100),
});

export const templateFileSchema = z.object({
  format: z.literal(TEMPLATE_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string().max(40).optional(),
  template: templateSchema,
});

export function formatZodIssues(error, max = 8) {
  return error.issues.slice(0, max).map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`);
}
