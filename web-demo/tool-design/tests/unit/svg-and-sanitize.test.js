// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { modelToSvg, escapeXml } from '../../src/engines/rendering-engine/svg-renderer.js';
import { sanitizeSvg } from '../../src/services/image-service.js';

describe('SVG renderer', () => {
  const model = {
    width: 100,
    height: 40,
    style: { background: { color: '#ffffff', opacity: 0 }, border: { width: 0 } },
    items: [
      { type: 'text', visible: true, x: 2, y: 2, width: 90, height: 20, rotation: 0, opacity: 1, text: { font: { family: 'Times New Roman', weight: 'bold', style: 'normal', size: 10 }, color: '#000000', lines: [{ text: '<script>alert("x")</script> & Đà Nẵng', x: 0, baseline: 9 }] } },
      { type: 'image', visible: true, x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, image: { src: 'data:image/svg+xml;base64,PHN2Zz4=', draw: { x: 0, y: 0, width: 10, height: 10 } } },
    ],
  };
  it('escapes user text and never inlines non-raster images', () => {
    const svg = modelToSvg(model);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Đà Nẵng');
    expect(svg).not.toContain('image/svg+xml');
    expect(svg).toContain('clip-path="url(#box)"');
    expect(escapeXml('a\u0001b')).toBe('ab');
  });
});

describe('SVG upload sanitiser', () => {
  it('removes scripts, event handlers, foreignObject and external links', () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><circle r="5"/></a><image href="https://evil.example/x.png"/><defs><path id="p" d="M0 0"/></defs><text><textPath href="#p">ok</textPath></text></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/onload|<script|foreignObject|javascript:|evil\.example/i);
    expect(clean).toContain('href="#p"'); // same-document references survive
  });
  it('rejects non-SVG markup', () => {
    expect(() => sanitizeSvg('<div>hello</div>')).toThrow();
  });
});
