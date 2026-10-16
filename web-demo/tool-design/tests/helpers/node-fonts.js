import { readFile } from 'node:fs/promises';
import { createFontRegistry } from '../../src/engines/rendering-engine/fonts.js';

export async function nodeFontRegistry() {
  const reg = createFontRegistry((file) => readFile(new URL(`../../public/fonts/${file}`, import.meta.url)));
  await reg.loadAll();
  return reg;
}

export async function readSample(file) {
  return new Uint8Array(await readFile(new URL(`../../public/samples/${file}`, import.meta.url)));
}
