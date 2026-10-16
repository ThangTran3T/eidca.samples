/**
 * Copies PDF.js runtime assets (CMaps, standard fonts, WASM image decoders)
 * into public/pdfjs so PDFs render fully offline — no CDN requests.
 */
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'pdfjs-dist');
const dest = path.join(root, 'public', 'pdfjs');
await mkdir(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(path.join(src, dir), path.join(dest, dir), { recursive: true, force: true });
}
console.log('✓ PDF.js assets copied to public/pdfjs');
