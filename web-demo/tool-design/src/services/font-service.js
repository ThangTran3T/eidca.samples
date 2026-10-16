/**
 * Loads the bundled fonts once: the bytes feed fontkit (measurement + PDF
 * embedding) AND are registered as FontFace objects for canvas drawing, so
 * every renderer uses the very same glyphs. No remote font requests.
 */
import { createFontRegistry, FONT_FAMILIES } from '../engines/rendering-engine/fonts.js';

const base = new URL(import.meta.env.BASE_URL, document.baseURI);

export const fontRegistry = createFontRegistry(async (file) => {
  const res = await fetch(new URL(`fonts/${file}`, base));
  if (!res.ok) throw new Error(`Không tải được phông ${file} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
});

const VARIANTS = {
  normal: { weight: 'normal', style: 'normal', css: { weight: '400', style: 'normal' } },
  bold: { weight: 'bold', style: 'normal', css: { weight: '700', style: 'normal' } },
  italic: { weight: 'normal', style: 'italic', css: { weight: '400', style: 'italic' } },
  boldItalic: { weight: 'bold', style: 'italic', css: { weight: '700', style: 'italic' } },
};

let loading = null;
export function loadFonts() {
  if (!loading) {
    loading = (async () => {
      await fontRegistry.loadAll();
      const faces = [];
      for (const [family, info] of Object.entries(FONT_FAMILIES)) {
        for (const [key, v] of Object.entries(VARIANTS)) {
          if (!info.files[key]) continue;
          const bytes = fontRegistry.getBytes(family, v.weight, v.style);
          const face = new FontFace(info.cssFamily, bytes.slice().buffer, v.css);
          faces.push(face.load().then((f) => document.fonts.add(f)));
        }
      }
      await Promise.all(faces);
    })();
  }
  return loading;
}
