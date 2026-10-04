import { createHash } from 'node:crypto';
import { ApiError } from '../errors.js';

const PDF_HEADER = Buffer.from('%PDF-');
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodeBase64(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, 'FILE_REQUIRED', "Field 'file' or 'file_base64' is required.");
  }

  const withoutDataUrl = value.trim().replace(/^data:[^;,]+;base64,/i, '');
  const normalized = withoutDataUrl.replace(/\s+/g, '');
  if (normalized.length === 0 || normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) {
    throw new ApiError(400, 'INVALID_BASE64', "Field 'file_base64' is not valid Base64.");
  }

  return Buffer.from(normalized, 'base64');
}

export function detectDocumentType(buffer, fileName = '') {
  if (buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) return 'PDF';

  const head = buffer
    .subarray(0, Math.min(buffer.length, 1024))
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<')) return 'XML';

  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'PDF';
  if (extension === 'xml') return 'XML';

  throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and XML files are supported.');
}

export function describeFile(buffer, fileName, type) {
  return {
    name: fileName || `document.${type.toLowerCase()}`,
    type,
    mime_type: type === 'PDF' ? 'application/pdf' : 'application/xml',
    size: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

export function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
