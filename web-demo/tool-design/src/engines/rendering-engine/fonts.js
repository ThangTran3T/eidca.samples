/**
 * Font registry. Templates reference *logical* families ("Times New Roman",
 * "Arial") because that is what legal rules and signing back-ends talk about.
 * Rendering uses bundled, redistributable, metric-compatible fonts with full
 * Vietnamese coverage (Liberation, SIL OFL 1.1) so that canvas, SVG/PNG and
 * the generated PDF share identical glyph metrics and nothing is loaded from
 * remote servers.
 */
import fontkit from '@pdf-lib/fontkit';

export const FONT_FAMILIES = {
  'Times New Roman': {
    label: 'Times New Roman',
    substitute: 'Liberation Serif',
    cssFamily: 'VNeCA Serif',
    fallbackCss: '"Times New Roman", Times, serif',
    files: {
      normal: 'LiberationSerif-Regular.ttf',
      bold: 'LiberationSerif-Bold.ttf',
      italic: 'LiberationSerif-Italic.ttf',
      boldItalic: 'LiberationSerif-BoldItalic.ttf',
    },
    metrics: { unitsPerEm: 2048, ascent: 1825, descent: -443 },
  },
  Arial: {
    label: 'Arial',
    substitute: 'Liberation Sans',
    cssFamily: 'VNeCA Sans',
    fallbackCss: 'Arial, Helvetica, sans-serif',
    files: {
      normal: 'LiberationSans-Regular.ttf',
      bold: 'LiberationSans-Bold.ttf',
      italic: 'LiberationSans-Italic.ttf',
      boldItalic: 'LiberationSans-BoldItalic.ttf',
    },
    metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434 },
  },
};

export const DEFAULT_FONT_FAMILY = 'Times New Roman';

export function familyInfo(family) {
  return FONT_FAMILIES[family] ?? FONT_FAMILIES[DEFAULT_FONT_FAMILY];
}

export function variantKey(weight, style) {
  const bold = weight === 'bold' || Number(weight) >= 600;
  const italic = style === 'italic';
  return bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
}

export function fontFileFor(family, weight, style) {
  return familyInfo(family).files[variantKey(weight, style)];
}

/** Normalized ascent/descent (fractions of the em) for baseline placement. */
export function normalizedMetrics(family) {
  const m = familyInfo(family).metrics;
  return { ascent: m.ascent / m.unitsPerEm, descent: -m.descent / m.unitsPerEm };
}

/** CSS font shorthand for canvas drawing. */
export function cssFont({ family, weight, style, size }) {
  const f = familyInfo(family);
  const w = variantKey(weight, style).startsWith('bold') ? 'bold' : 'normal';
  const s = style === 'italic' ? 'italic' : 'normal';
  return `${s} ${w} ${size}px "${f.cssFamily}", ${f.fallbackCss}`;
}

/**
 * Font registry backed by fontkit. `loadBytes(fileName)` returns the TTF bytes
 * (fetch in the browser, fs in Node). Measurement uses the exact same glyph
 * advances pdf-lib uses, so line breaks are identical in every output.
 */
export function createFontRegistry(loadBytes) {
  const bytes = new Map();
  const parsed = new Map();

  async function load(file) {
    if (!bytes.has(file)) {
      const b = await loadBytes(file);
      bytes.set(file, b instanceof Uint8Array ? b : new Uint8Array(b));
      parsed.set(file, fontkit.create(bytes.get(file)));
    }
    return parsed.get(file);
  }

  async function loadAll() {
    const files = Object.values(FONT_FAMILIES).flatMap((f) => Object.values(f.files));
    await Promise.all(files.map(load));
  }

  function measure(text, { family, weight, style, size }) {
    const font = parsed.get(fontFileFor(family, weight, style));
    if (!font) {
      // Fallback before fonts are loaded: rough average advance.
      return text.length * size * 0.5;
    }
    let width = 0;
    // layout() applies GSUB/GPOS (Vietnamese stacked diacritics are precomposed in NFC).
    width = font.layout(text.normalize('NFC')).advanceWidth;
    return (width / font.unitsPerEm) * size;
  }

  return {
    load,
    loadAll,
    ensure: (family, weight, style) => load(fontFileFor(family, weight, style)),
    measure,
    getBytes: (family, weight, style) => bytes.get(fontFileFor(family, weight, style)),
    isLoaded: (family, weight, style) => parsed.has(fontFileFor(family, weight, style)),
  };
}
