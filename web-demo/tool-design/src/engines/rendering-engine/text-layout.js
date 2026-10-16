/**
 * Deterministic text layout shared by canvas, SVG/PNG and PDF renderers.
 * Line breaking uses an injected `measure(text)` (fontkit advances), and
 * baselines are computed from the font's ascent/descent so that all outputs
 * place glyphs identically.
 */

function breakWord(word, maxWidth, measure) {
  const pieces = [];
  let cur = '';
  for (const ch of Array.from(word)) {
    if (cur && measure(cur + ch) > maxWidth) {
      pieces.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) pieces.push(cur);
  return pieces;
}

export function wrapLines(text, maxWidth, measure, wrap = true) {
  const paragraphs = String(text).normalize('NFC').split(/\r?\n/);
  if (!wrap || maxWidth <= 0) return paragraphs;
  const lines = [];
  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/ +/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word) > maxWidth) {
        const pieces = breakWord(word, maxWidth, measure);
        lines.push(...pieces.slice(0, -1));
        line = pieces[pieces.length - 1] ?? '';
      } else line = word;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * @returns {{ lines: {text:string,x:number,baseline:number,width:number}[], contentHeight:number, overflow:boolean }}
 */
export function layoutText({ text, width, height, fontSize, lineHeight = 1.25, align = 'left', verticalAlign = 'top', wrap = true, measure, ascent, descent }) {
  const raw = wrapLines(text, width, measure, wrap);
  const lineBox = fontSize * lineHeight;
  const contentHeight = raw.length * lineBox;
  let top = 0;
  if (verticalAlign === 'middle') top = (height - contentHeight) / 2;
  else if (verticalAlign === 'bottom') top = height - contentHeight;
  const glyphHeight = (ascent + descent) * fontSize;
  const lines = raw.map((t, i) => {
    const w = measure(t);
    let x = 0;
    if (align === 'center') x = (width - w) / 2;
    else if (align === 'right') x = width - w;
    const baseline = top + i * lineBox + (lineBox - glyphHeight) / 2 + ascent * fontSize;
    return { text: t, x, baseline, width: w };
  });
  const maxLineWidth = Math.max(0, ...lines.map((l) => l.width));
  return { lines, contentHeight, overflow: contentHeight > height + 0.5 || (!wrap && maxLineWidth > width + 0.5) };
}
