/**
 * Specimen artwork for built-in templates (rasterised to PNG at runtime).
 * They are deliberately marked "MẪU" so they can never pass the
 * "real seal / real signature" compliance rules.
 */

export const SEAL_SPECIMEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><path id="ring" d="M300,300 m-218,0 a218,218 0 1,1 436,0 a218,218 0 1,1 -436,0"/></defs>
  <g fill="none" stroke="#d71920">
    <circle cx="300" cy="300" r="290" stroke-width="16"/>
    <circle cx="300" cy="300" r="270" stroke-width="5"/>
    <circle cx="300" cy="300" r="168" stroke-width="5"/>
  </g>
  <text fill="#d71920" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="44" letter-spacing="3">
    <textPath href="#ring" startOffset="0">SỞ KHOA HỌC VÀ CÔNG NGHỆ • TỈNH MẪU •</textPath>
  </text>
  <polygon fill="#d71920" points="300,150 318,203 374,203 329,236 346,289 300,257 254,289 271,236 226,203 282,203"/>
  <text x="300" y="370" text-anchor="middle" fill="#d71920" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="92">MẪU</text>
  <text x="300" y="418" text-anchor="middle" fill="#d71920" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30">KHÔNG CÓ GIÁ TRỊ</text>
</svg>`;

export const SIGNATURE_SPECIMEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300" viewBox="0 0 640 300">
  <g fill="none" stroke="#1f3fbf" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="9" d="M40 205 C 70 90, 120 60, 135 120 S 120 240, 95 215 S 150 110, 200 140 S 210 225, 240 190 C 265 160, 280 120, 300 150 S 300 220, 330 185 C 360 150, 380 95, 410 120 S 395 215, 440 175 C 470 150, 500 140, 520 165"/>
    <path stroke-width="7" d="M70 240 C 220 222, 400 230, 600 205"/>
    <path stroke-width="6" d="M455 95 C 470 80, 500 85, 495 110"/>
  </g>
  <text x="600" y="285" text-anchor="end" fill="#1f3fbf" font-family="Arial, Helvetica, sans-serif" font-size="30" font-style="italic">mẫu</text>
</svg>`;

export const LOGO_SPECIMEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <path d="M150 18 L262 62 V150 C262 220 212 262 150 284 C88 262 38 220 38 150 V62 Z" fill="#1d4ed8"/>
  <path d="M150 48 L236 82 V150 C236 203 199 236 150 254 C101 236 64 203 64 150 V82 Z" fill="#ffffff"/>
  <text x="150" y="172" text-anchor="middle" fill="#1d4ed8" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="64">eCA</text>
</svg>`;

export const HOSPITAL_LOGO_SPECIMEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <circle cx="150" cy="150" r="140" fill="#0f766e"/>
  <rect x="122" y="62" width="56" height="176" rx="10" fill="#ffffff"/>
  <rect x="62" y="122" width="176" height="56" rx="10" fill="#ffffff"/>
</svg>`;
