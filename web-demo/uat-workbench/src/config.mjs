import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(APP_ROOT, 'public');

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.UAT_PORT || 17990);

// Measured endpoints pinned by the workbench package (session-state.cjs refuses any other origin).
export const AGENT_ORIGINS = Object.freeze({ LOCAL: 'https://localhost:17889', SERVER: 'http://127.0.0.1:29080' });
export const PLATFORM_ORIGIN = 'https://127.0.0.1:29443';
export const ENV_KINDS = Object.freeze(['LOCAL', 'SERVER']);

export const PACKAGE_PREFIX = 'VNeCA-Unified-Agent-v2-Workbench-';
export const DEFAULT_PACKAGE_BASE = path.resolve(APP_ROOT, '..', 'uat-test');

export function defaultDataDir() {
  if (process.env.UAT_DATA_DIR) return path.resolve(process.env.UAT_DATA_DIR);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'VNeCA', 'UatWorkbench');
  return path.join(APP_ROOT, '.uat-data');
}

// Where prepare-private.mjs and earlier handovers leave protected access files.
export function protectedSourceRoots() {
  return process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'VNeCA', 'Postman')] : [];
}
