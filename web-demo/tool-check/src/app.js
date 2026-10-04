import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { ApiError, errorMessage } from './errors.js';
import { decodeBase64, describeFile, detectDocumentType } from './services/file-utils.js';
import { verifyXml } from './services/xml-verifier.js';
import { verifyPdf } from './services/pdf-verifier.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, '..', 'public');

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const maxFileSizeBytes = Math.floor(
  positiveNumber(process.env.MAX_FILE_SIZE_MB, 50) * 1024 * 1024
);

export async function verifyDocument(buffer, fileName = '') {
  const type = detectDocumentType(buffer, fileName);
  const verification = type === 'PDF' ? await verifyPdf(buffer) : await verifyXml(buffer);
  return {
    success: true,
    checked_at: new Date().toISOString(),
    file: describeFile(buffer, fileName, type),
    verification
  };
}

function corsOptions() {
  const configured = process.env.CORS_ORIGIN?.trim() || '*';
  if (configured === '*') return { origin: '*' };
  const allowed = new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
  return {
    origin(origin, callback) {
      callback(null, !origin || allowed.has(origin));
    }
  };
}

export function createApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes, files: 1, fields: 20 }
  });
  const jsonLimit = `${Math.ceil(maxFileSizeBytes * 1.4 / (1024 * 1024)) + 1}mb`;

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: jsonLimit }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'UP', service: 'vneca-tool-check', version: '1.0.0' });
  });

  app.get('/api/info', (_request, response) => {
    response.json({
      service: 'vneca-tool-check',
      endpoint: 'POST /api/verify',
      accepted_content_types: ['multipart/form-data', 'application/json'],
      fields: {
        multipart: { file: 'PDF or XML file' },
        json: { file_base64: 'Base64-encoded PDF or XML', file_name: 'Optional file name' }
      },
      max_file_size: maxFileSizeBytes,
      trust_validation: 'Certificate chain, OCSP and CRL validation are not enabled.'
    });
  });

  app.post('/api/verify', upload.single('file'), async (request, response, next) => {
    try {
      const buffer = request.file?.buffer || decodeBase64(request.body?.file_base64);
      if (buffer.length === 0) {
        throw new ApiError(400, 'EMPTY_FILE', 'The supplied file is empty.');
      }
      if (buffer.length > maxFileSizeBytes) {
        throw new ApiError(413, 'FILE_TOO_LARGE', `File exceeds the ${maxFileSizeBytes}-byte limit.`);
      }

      const fileName = request.file?.originalname || request.body?.file_name || request.body?.fileName || '';
      response.json(await verifyDocument(buffer, fileName));
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(publicDirectory, { extensions: ['html'] }));

  app.use('/api', (_request, response) => {
    response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API route not found.' } });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      response.status(status).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' }
      });
      return;
    }

    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    response.status(statusCode).json({
      success: false,
      error: {
        code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
        message: errorMessage(error),
        ...(error instanceof ApiError && error.details ? { details: error.details } : {})
      }
    });
  });

  return app;
}
