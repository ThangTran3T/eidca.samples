/**
 * VNeCA legacy `sign_props` schema, derived ONLY from what this repository
 * documents and uses (docs/api-reference.md §sign_props,
 * docs/sign_props_template.json, web-app Step1Upload.js, web-demo/sign).
 * Fields are optional because existing clients send partial objects
 * (e.g. only page/lLx/lLy/width/height in the Server Agent example).
 */
import { z } from 'zod';

export const LEGACY_TEMPLATES = ['right', 'left', 'center', 'text_only'];
export const LEGACY_SHOW_INFO = ['reason', 'location', 'contact', 'name', 'org', 'date'];
export const LEGACY_WATERMARK_POS = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const LEGACY_HAND_SIG_POS = ['center', 'right', 'left'];
export const LEGACY_HAND_SIG_INDEX = ['top', 'bottom'];

const label = z.string().max(500);

export const legacySignPropsSchema = z.looseObject({
  page: z.number().int().min(1),
  lLx: z.number().finite(),
  lLy: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  template: z.enum(LEGACY_TEMPLATES).optional(),
  show_info: z.array(z.enum(LEGACY_SHOW_INFO)).optional(),
  location: label.optional(),
  location_label: label.optional(),
  reason: label.optional(),
  reason_label: label.optional(),
  contact: label.optional(),
  contact_label: label.optional(),
  date_label: label.optional(),
  text_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  font_size: z.number().positive().max(200).optional(),
  sign_visibility: z.enum(['shown', 'hidden']).optional(),
  watermark_pos: z.enum(LEGACY_WATERMARK_POS).optional(),
  watermark_img_b64: z.string().optional(),
  hand_sig_img_b64: z.string().optional(),
  hand_sig_pos: z.enum(LEGACY_HAND_SIG_POS).optional(),
  hand_sig_index: z.enum(LEGACY_HAND_SIG_INDEX).optional(),
});

export const KNOWN_LEGACY_FIELDS = new Set(Object.keys(legacySignPropsSchema.shape));

export const legacyArraySchema = z.array(legacySignPropsSchema).min(1).max(100);
