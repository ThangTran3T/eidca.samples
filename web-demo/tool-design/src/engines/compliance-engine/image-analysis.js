/**
 * Pixel analysis used by compliance rules (transparent background, ink
 * colour, visible content bounds). Pure: takes an ImageData-like
 * { width, height, data: RGBA } so it runs in browsers and tests alike.
 */

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function classifyInk(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v > 0.92 && s < 0.12) return 'white';
  if (v < 0.28) return 'black';
  if (s < 0.25) return v < 0.6 ? 'black' : 'white'; // greys
  if (h < 20 || h >= 330) return 'red';
  if (h >= 190 && h < 265) return 'blue';
  if (h >= 75 && h < 170) return 'green';
  return 'other';
}

const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');

/**
 * @param {{width:number,height:number,data:Uint8ClampedArray}} img
 * @param {string} mime
 */
export function analyzePixels(img, mime) {
  const { width, height, data } = img;
  const total = width * height;
  let transparent = 0;
  let semi = 0;
  const counts = { red: 0, blue: 0, black: 0, green: 0, other: 0, white: 0 };
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let ink = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  // Sample at most ~250k pixels for speed on large uploads.
  const step = Math.max(1, Math.floor(Math.sqrt(total / 250_000)));
  let sampled = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      sampled++;
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 16) {
        transparent++;
        continue;
      }
      if (a < 250) semi++;
      const cls = classifyInk(data[i], data[i + 1], data[i + 2]);
      counts[cls]++;
      if (cls !== 'white') {
        ink++;
        sr += data[i];
        sg += data[i + 1];
        sb += data[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cornerSize = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 10)));
  const cornerTransparent = (cx, cy) => {
    for (let y = cy; y < cy + cornerSize; y++)
      for (let x = cx; x < cx + cornerSize; x++) if (data[(y * width + x) * 4 + 3] >= 16) return false;
    return true;
  };
  const cornersTransparent =
    cornerTransparent(0, 0) &&
    cornerTransparent(width - cornerSize, 0) &&
    cornerTransparent(0, height - cornerSize) &&
    cornerTransparent(width - cornerSize, height - cornerSize);

  let dominantColor = 'none';
  if (ink > 0) {
    const ranked = ['red', 'blue', 'black', 'green', 'other'].sort((a, b) => counts[b] - counts[a]);
    dominantColor = counts[ranked[0]] / ink >= 0.5 ? ranked[0] : 'other';
  }
  return {
    mime,
    hasAlpha: transparent > 0 || semi > 0,
    transparentRatio: transparent / sampled,
    cornersTransparent,
    dominantColor,
    averageColor: ink ? `#${toHex(sr / ink)}${toHex(sg / ink)}${toHex(sb / ink)}` : null,
    redRatio: ink ? counts.red / ink : 0,
    blueRatio: ink ? counts.blue / ink : 0,
    // Visible content bounds as fractions of the image (seal size rules use the inked area, not the canvas).
    contentBox:
      maxX >= 0
        ? { x: minX / width, y: minY / height, width: Math.min(1, (maxX - minX + step) / width), height: Math.min(1, (maxY - minY + step) / height) }
        : null,
  };
}
