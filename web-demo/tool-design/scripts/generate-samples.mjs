/**
 * Generates the realistic Vietnamese sample PDFs used by the app and tests.
 *   node scripts/generate-samples.mjs
 * Output: public/samples/*.pdf + public/samples/manifest.json
 *
 * All organisations, people and numbers are fictional. Every page carries a
 * footer stating the document is a sample with no legal value.
 */
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(root, 'public', 'fonts');
const outDir = path.join(root, 'public', 'samples');

const A4 = [595.28, 841.89];
const mm = (v) => (v * 72) / 25.4;
// Decree 30 margins: top/bottom 20–25 mm, left 30–35 mm, right 15–20 mm.
const M = { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) };
const FOOTER = 'Tài liệu mẫu phục vụ thử nghiệm VNeCA Signature Designer — không có giá trị pháp lý.';

async function loadFonts(doc) {
  doc.registerFontkit(fontkit);
  const load = (f) => readFile(path.join(fontDir, f)).then((b) => doc.embedFont(b, { subset: true }));
  return {
    regular: await load('LiberationSerif-Regular.ttf'),
    bold: await load('LiberationSerif-Bold.ttf'),
    italic: await load('LiberationSerif-Italic.ttf'),
  };
}

function wrap(font, text, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function makeWriter(page, fonts) {
  const { width } = page.getSize();
  const contentWidth = width - M.left - M.right;
  const api = {
    y: page.getSize().height - M.top,
    text(str, { x, size = 13, font = fonts.regular, align = 'left', boxX = M.left, boxW = contentWidth, color } = {}) {
      const w = font.widthOfTextAtSize(str, size);
      let tx = x ?? boxX;
      if (align === 'center') tx = boxX + (boxW - w) / 2;
      if (align === 'right') tx = boxX + boxW - w;
      page.drawText(str, { x: tx, y: api.y - size, size, font, color: color ?? rgb(0, 0, 0) });
      return { x: tx, width: w };
    },
    line(dy) {
      api.y -= dy;
    },
    paragraph(str, { size = 14, indent = mm(12.7), font = fonts.regular, spacing = 1.15, after = 6 } = {}) {
      const first = wrap(font, str, size, contentWidth - indent);
      const firstLine = first[0];
      const rest = str.slice(firstLine.length).trim();
      api.text(firstLine, { x: M.left + indent, size, font });
      api.line(size * spacing);
      for (const l of rest ? wrap(font, rest, size, contentWidth) : []) {
        api.text(l, { size, font });
        api.line(size * spacing);
      }
      api.line(after);
    },
    contentWidth,
  };
  return api;
}

function footer(page, fonts, index, total) {
  const { width } = page.getSize();
  const size = 8;
  const t = `${FOOTER}  Trang ${index}/${total}`;
  page.drawText(t, {
    x: (width - fonts.italic.widthOfTextAtSize(t, size)) / 2,
    y: mm(10),
    size,
    font: fonts.italic,
    color: rgb(0.45, 0.45, 0.45),
  });
}

// ─── 1. Quyết định (administrative document per Decree 30, Phụ lục I) ────────
async function quyetDinh() {
  const doc = await PDFDocument.create();
  doc.setTitle('Quyết định ban hành Quy chế sử dụng chữ ký số (mẫu)');
  doc.setAuthor('Sở Khoa học và Công nghệ tỉnh Mẫu (giả lập)');
  doc.setLanguage('vi-VN');
  const fonts = await loadFonts(doc);
  const p1 = doc.addPage(A4);
  const w = makeWriter(p1, fonts);
  const colL = { boxX: M.left - mm(10), boxW: mm(80) };
  const colR = { boxX: M.left + mm(68), boxW: A4[0] - M.right - (M.left + mm(68)) };

  const y0 = w.y;
  w.text('UBND TỈNH MẪU', { ...colL, align: 'center', size: 12.5 });
  w.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { ...colR, align: 'center', size: 12.5, font: fonts.bold });
  w.line(15);
  w.text('SỞ KHOA HỌC VÀ CÔNG NGHỆ', { ...colL, align: 'center', size: 12.5, font: fonts.bold });
  const motto = w.text('Độc lập - Tự do - Hạnh phúc', { ...colR, align: 'center', size: 13.5, font: fonts.bold });
  p1.drawLine({ start: { x: motto.x, y: w.y - 17 }, end: { x: motto.x + motto.width, y: w.y - 17 }, thickness: 0.6 });
  p1.drawLine({ start: { x: colL.boxX + mm(28), y: w.y - 17 }, end: { x: colL.boxX + mm(52), y: w.y - 17 }, thickness: 0.6 });
  w.line(30);
  w.text('Số: 125/QĐ-SKHCN', { ...colL, align: 'center', size: 13 });
  w.text('Tỉnh Mẫu, ngày 15 tháng 10 năm 2026', { ...colR, align: 'center', size: 13, font: fonts.italic });
  w.line(36);
  w.text('QUYẾT ĐỊNH', { align: 'center', size: 14, font: fonts.bold });
  w.line(18);
  w.text('Về việc ban hành Quy chế quản lý và sử dụng chữ ký số', { align: 'center', size: 14, font: fonts.bold });
  w.line(17);
  w.text('trong hoạt động của Sở Khoa học và Công nghệ tỉnh Mẫu', { align: 'center', size: 14, font: fonts.bold });
  w.line(30);
  w.text('GIÁM ĐỐC SỞ KHOA HỌC VÀ CÔNG NGHỆ', { align: 'center', size: 14, font: fonts.bold });
  w.line(28);
  w.paragraph('Căn cứ Luật Giao dịch điện tử ngày 22 tháng 6 năm 2023;', { font: fonts.italic });
  w.paragraph('Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;', { font: fonts.italic });
  w.paragraph('Căn cứ Quyết định số 45/2025/QĐ-UBND của Ủy ban nhân dân tỉnh Mẫu quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Sở Khoa học và Công nghệ;', { font: fonts.italic });
  w.paragraph('Theo đề nghị của Chánh Văn phòng Sở.', { font: fonts.italic, after: 14 });
  w.text('QUYẾT ĐỊNH:', { align: 'center', size: 14, font: fonts.bold });
  w.line(26);
  w.paragraph('Điều 1. Ban hành kèm theo Quyết định này Quy chế quản lý và sử dụng chữ ký số, chứng thư số trong hoạt động của Sở Khoa học và Công nghệ tỉnh Mẫu.');
  w.paragraph('Điều 2. Quyết định này có hiệu lực kể từ ngày ký. Các quy định trước đây trái với Quyết định này đều bãi bỏ.');
  w.paragraph('Điều 3. Chánh Văn phòng Sở, Trưởng các phòng, đơn vị thuộc Sở và các tổ chức, cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này./.');
  w.line(4);

  // Nơi nhận (left) + signature block (right)
  const blockTop = w.y;
  const sizeSmall = 11;
  w.text('Nơi nhận:', { x: M.left, size: 12, font: fonts.bold });
  const sig = { boxX: M.left + mm(80), boxW: A4[0] - M.right - (M.left + mm(80)) };
  w.text('KT. GIÁM ĐỐC', { ...sig, align: 'center', size: 14, font: fonts.bold });
  w.line(14);
  for (const r of ['- Như Điều 3;', '- UBND tỉnh (để b/c);', '- Lãnh đạo Sở;', '- Lưu: VT, VP.']) {
    w.text(r, { x: M.left, size: sizeSmall });
    if (r === '- Như Điều 3;') w.text('PHÓ GIÁM ĐỐC', { ...sig, align: 'center', size: 14, font: fonts.bold });
    w.line(13);
  }
  const titleBottom = blockTop - 28 - 14; // below "PHÓ GIÁM ĐỐC"
  w.y = blockTop - 28 - 14 - mm(30);
  const nameY = w.y;
  w.text('Trần Thị Minh Anh', { ...sig, align: 'center', size: 14, font: fonts.bold });

  // Page 2: Quy chế (attachment in the same file)
  const p2 = doc.addPage(A4);
  const w2 = makeWriter(p2, fonts);
  w2.text('UBND TỈNH MẪU', { ...colL, align: 'center', size: 12.5 });
  w2.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { ...colR, align: 'center', size: 12.5, font: fonts.bold });
  w2.line(15);
  w2.text('SỞ KHOA HỌC VÀ CÔNG NGHỆ', { ...colL, align: 'center', size: 12.5, font: fonts.bold });
  w2.text('Độc lập - Tự do - Hạnh phúc', { ...colR, align: 'center', size: 13.5, font: fonts.bold });
  w2.line(44);
  w2.text('QUY CHẾ', { align: 'center', size: 14, font: fonts.bold });
  w2.line(18);
  w2.text('Quản lý và sử dụng chữ ký số trong hoạt động của Sở', { align: 'center', size: 14, font: fonts.bold });
  w2.line(17);
  w2.text('(Kèm theo Quyết định số 125/QĐ-SKHCN ngày 15/10/2026 của Giám đốc Sở)', { align: 'center', size: 13, font: fonts.italic });
  w2.line(30);
  w2.text('Chương I. QUY ĐỊNH CHUNG', { align: 'center', size: 14, font: fonts.bold });
  w2.line(26);
  w2.paragraph('Điều 1. Phạm vi điều chỉnh. Quy chế này quy định việc quản lý, sử dụng chữ ký số, chứng thư số chuyên dùng công vụ và chứng thư số công cộng trong việc ký số văn bản điện tử của Sở.');
  w2.paragraph('Điều 2. Đối tượng áp dụng. Quy chế áp dụng đối với lãnh đạo Sở, công chức, viên chức và người lao động thuộc Sở được cấp chứng thư số.');
  w2.paragraph('Điều 3. Hình thức hiển thị chữ ký số. Vị trí, hình ảnh chữ ký số của người có thẩm quyền và của cơ quan thực hiện theo Phụ lục I Nghị định số 30/2020/NĐ-CP. Hình ảnh hiển thị chỉ là hình thức thể hiện; giá trị pháp lý của chữ ký số được xác định bằng việc kiểm tra chữ ký số và chứng thư số.');
  w2.paragraph('Điều 4. Trách nhiệm. Người được cấp chứng thư số có trách nhiệm bảo quản thiết bị lưu khóa bí mật, không cho người khác sử dụng và thông báo ngay cho cơ quan quản lý khi phát hiện thiết bị bị mất hoặc lộ mật khẩu.');

  const pages = doc.getPages();
  pages.forEach((p, i) => footer(p, fonts, i + 1, pages.length));
  const sigColumnCenter = sig.boxX + sig.boxW / 2;
  return {
    bytes: await doc.save(),
    meta: {
      file: 'quyet-dinh-mau.pdf',
      title: 'Quyết định hành chính (Nghị định 30) — 2 trang',
      pages: 2,
      // Signature block geometry in PDF points (lower-left origin) for presets.
      signatureBlock: {
        page: 1,
        centerX: round(sigColumnCenter),
        titleBottomY: round(titleBottom),
        nameTopY: round(nameY),
      },
    },
  };
}

// ─── 2. Hợp đồng điện tử (3 pages, two parties) ──────────────────────────────
async function hopDong() {
  const doc = await PDFDocument.create();
  doc.setTitle('Hợp đồng cung cấp dịch vụ chứng thực chữ ký số (mẫu)');
  doc.setLanguage('vi-VN');
  const fonts = await loadFonts(doc);
  const clauses = [
    ['Điều 1. Đối tượng hợp đồng', 'Bên B cung cấp cho Bên A dịch vụ chứng thực chữ ký số công cộng và dịch vụ ký số từ xa cho 25 thuê bao, thời hạn 36 tháng kể từ ngày hợp đồng có hiệu lực.'],
    ['Điều 2. Giá trị hợp đồng và phương thức thanh toán', 'Tổng giá trị hợp đồng là 186.000.000 đồng (Bằng chữ: Một trăm tám mươi sáu triệu đồng chẵn), đã bao gồm thuế giá trị gia tăng. Bên A thanh toán bằng chuyển khoản theo từng năm.'],
    ['Điều 3. Quyền và nghĩa vụ của Bên A', 'Bên A cung cấp thông tin chính xác, đầy đủ về thuê bao; quản lý và chịu trách nhiệm đối với việc sử dụng khóa bí mật của các thuê bao thuộc đơn vị mình theo quy định của pháp luật.'],
    ['Điều 4. Quyền và nghĩa vụ của Bên B', 'Bên B bảo đảm tính sẵn sàng của hệ thống tối thiểu 99,5% thời gian trong tháng; thông báo cho Bên A ít nhất 30 ngày trước khi chứng thư số hết hạn; bảo mật thông tin của Bên A theo quy định.'],
    ['Điều 5. Bảo mật thông tin', 'Hai bên cam kết không tiết lộ thông tin của nhau cho bên thứ ba khi chưa có sự đồng ý bằng văn bản, trừ trường hợp theo yêu cầu của cơ quan nhà nước có thẩm quyền.'],
    ['Điều 6. Giải quyết tranh chấp', 'Mọi tranh chấp phát sinh được giải quyết trước hết bằng thương lượng. Trường hợp không thương lượng được, một trong hai bên có quyền đưa tranh chấp ra Tòa án nhân dân có thẩm quyền.'],
    ['Điều 7. Hiệu lực hợp đồng', 'Hợp đồng được lập dưới dạng thông điệp dữ liệu, có hiệu lực kể từ thời điểm cả hai bên hoàn tất ký số. Hợp đồng điện tử có giá trị pháp lý như hợp đồng bằng văn bản giấy.'],
  ];
  let page = doc.addPage(A4);
  let w = makeWriter(page, fonts);
  w.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center', size: 13, font: fonts.bold });
  w.line(16);
  w.text('Độc lập - Tự do - Hạnh phúc', { align: 'center', size: 13, font: fonts.bold });
  w.line(40);
  w.text('HỢP ĐỒNG CUNG CẤP DỊCH VỤ', { align: 'center', size: 15, font: fonts.bold });
  w.line(19);
  w.text('CHỨNG THỰC CHỮ KÝ SỐ CÔNG CỘNG', { align: 'center', size: 15, font: fonts.bold });
  w.line(18);
  w.text('Số: 2026/HĐ-CKS/0815', { align: 'center', size: 13, font: fonts.italic });
  w.line(30);
  w.paragraph('Hôm nay, ngày 16 tháng 10 năm 2026, tại Hà Nội, chúng tôi gồm:', { size: 13 });
  w.paragraph('BÊN A (Bên sử dụng dịch vụ): CÔNG TY CỔ PHẦN DƯỢC PHẨM AN KHANG. Mã số thuế: 0109876543. Địa chỉ: Số 18 phố Lê Thánh Tông, phường Hoàn Kiếm, Hà Nội. Đại diện: Ông Lê Quang Huy — Tổng Giám đốc.', { size: 13 });
  w.paragraph('BÊN B (Bên cung cấp dịch vụ): CÔNG TY TNHH GIẢI PHÁP CHỮ KÝ SỐ VIỆT (giả lập). Mã số thuế: 0101234567. Địa chỉ: Tầng 9, tòa nhà Sao Mai, phường Cầu Giấy, Hà Nội. Đại diện: Bà Phạm Thu Hà — Giám đốc.', { size: 13, after: 12 });
  for (const [title, body] of clauses) {
    if (w.y < M.bottom + 110) {
      page = doc.addPage(A4);
      w = makeWriter(page, fonts);
    }
    w.text(title, { size: 13, font: fonts.bold });
    w.line(17);
    w.paragraph(body, { size: 13, after: 8 });
  }
  page = doc.addPage(A4);
  w = makeWriter(page, fonts);
  w.paragraph('Hợp đồng được lập thành thông điệp dữ liệu điện tử, mỗi bên lưu giữ một bản có giá trị pháp lý như nhau. Hai bên đã đọc, hiểu rõ và đồng ý ký số dưới đây.', { size: 13, after: 24 });
  const half = w.contentWidth / 2;
  w.text('ĐẠI DIỆN BÊN A', { boxX: M.left, boxW: half, align: 'center', size: 13, font: fonts.bold });
  w.text('ĐẠI DIỆN BÊN B', { boxX: M.left + half, boxW: half, align: 'center', size: 13, font: fonts.bold });
  w.line(16);
  w.text('(Ký số)', { boxX: M.left, boxW: half, align: 'center', size: 12, font: fonts.italic });
  w.text('(Ký số)', { boxX: M.left + half, boxW: half, align: 'center', size: 12, font: fonts.italic });
  const sigTop = w.y - 14;
  w.line(mm(32));
  w.text('Lê Quang Huy', { boxX: M.left, boxW: half, align: 'center', size: 13, font: fonts.bold });
  w.text('Phạm Thu Hà', { boxX: M.left + half, boxW: half, align: 'center', size: 13, font: fonts.bold });
  const pages = doc.getPages();
  pages.forEach((p, i) => footer(p, fonts, i + 1, pages.length));
  return {
    bytes: await doc.save(),
    meta: {
      file: 'hop-dong-dien-tu.pdf',
      title: 'Hợp đồng điện tử — nhiều trang, 2 bên ký',
      pages: pages.length,
      signatureAreas: [
        { party: 'A', page: pages.length, x: round(M.left), yTop: round(sigTop), width: round(half) },
        { party: 'B', page: pages.length, x: round(M.left + half), yTop: round(sigTop), width: round(half) },
      ],
    },
  };
}

// ─── 3. Phiếu kết quả xét nghiệm (hospital / doctor) ─────────────────────────
async function phieuKetQua() {
  const doc = await PDFDocument.create();
  doc.setTitle('Phiếu kết quả xét nghiệm (mẫu)');
  doc.setLanguage('vi-VN');
  const fonts = await loadFonts(doc);
  const page = doc.addPage(A4);
  const w = makeWriter(page, fonts);
  w.text('SỞ Y TẾ TỈNH MẪU', { size: 12 });
  w.line(15);
  w.text('BỆNH VIỆN ĐA KHOA TỈNH MẪU', { size: 12, font: fonts.bold });
  w.line(15);
  w.text('Khoa Xét nghiệm', { size: 12 });
  w.line(30);
  w.text('PHIẾU KẾT QUẢ XÉT NGHIỆM HUYẾT HỌC', { align: 'center', size: 15, font: fonts.bold });
  w.line(30);
  for (const l of [
    'Họ tên người bệnh: Nguyễn Thị Hồng Nhung        Năm sinh: 1987        Giới: Nữ',
    'Địa chỉ: Xã Thạch Hà, tỉnh Mẫu        Mã người bệnh: BN26-004517',
    'Chẩn đoán: Theo dõi thiếu máu        Bác sĩ chỉ định: BS. Đỗ Văn Khải',
  ]) {
    w.text(l, { size: 12 });
    w.line(17);
  }
  w.line(10);
  const rows = [
    ['Chỉ số', 'Kết quả', 'Đơn vị', 'Trị số tham chiếu'],
    ['Hồng cầu (RBC)', '4,12', 'T/L', '3,8 – 5,4'],
    ['Huyết sắc tố (HGB)', '108', 'g/L', '120 – 160'],
    ['Hematocrit (HCT)', '0,34', 'L/L', '0,35 – 0,47'],
    ['Bạch cầu (WBC)', '7,6', 'G/L', '4,0 – 10,0'],
    ['Tiểu cầu (PLT)', '268', 'G/L', '150 – 400'],
  ];
  const cols = [0, 170, 260, 330];
  rows.forEach((r, i) => {
    r.forEach((c, j) => w.text(c, { x: M.left + cols[j], size: 12, font: i === 0 ? fonts.bold : fonts.regular }));
    page.drawLine({ start: { x: M.left, y: w.y - 17 }, end: { x: A4[0] - M.right, y: w.y - 17 }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });
    w.line(21);
  });
  w.line(24);
  const right = { boxX: A4[0] - M.right - mm(80), boxW: mm(80) };
  w.text('Ngày 16 tháng 10 năm 2026', { ...right, align: 'center', size: 12, font: fonts.italic });
  w.line(16);
  w.text('TRƯỞNG KHOA XÉT NGHIỆM', { ...right, align: 'center', size: 12, font: fonts.bold });
  const sigTop = w.y - 16;
  w.line(mm(30));
  w.text('BS.CKII. Vũ Thanh Tâm', { ...right, align: 'center', size: 12, font: fonts.bold });
  footer(page, fonts, 1, 1);
  return {
    bytes: await doc.save(),
    meta: {
      file: 'phieu-ket-qua-xet-nghiem.pdf',
      title: 'Phiếu kết quả xét nghiệm — bệnh viện/bác sĩ',
      pages: 1,
      signatureArea: { page: 1, x: round(right.boxX), yTop: round(sigTop), width: round(right.boxW) },
    },
  };
}

// ─── 4. Rotation / CropBox test document ─────────────────────────────────────
async function rotated() {
  const doc = await PDFDocument.create();
  doc.setTitle('Tài liệu kiểm thử xoay trang và CropBox');
  doc.setLanguage('vi-VN');
  const fonts = await loadFonts(doc);
  const specs = [
    { rotate: 0, label: 'Trang 1 — không xoay (A4 dọc)' },
    { rotate: 90, label: 'Trang 2 — /Rotate 90 (hiển thị ngang)' },
    { rotate: 180, label: 'Trang 3 — /Rotate 180' },
    { rotate: 270, label: 'Trang 4 — /Rotate 270' },
    { rotate: 0, label: 'Trang 5 — CropBox lệch gốc (36, 36, 559, 806)', crop: [36, 36, 523.28, 769.89] },
  ];
  for (const s of specs) {
    const page = doc.addPage(A4);
    page.setRotation(degrees(s.rotate));
    if (s.crop) page.setCropBox(...s.crop);
    // Draw text in the *unrotated* coordinate system; viewers rotate it.
    page.drawText(s.label, { x: 60, y: 760, size: 18, font: fonts.bold });
    page.drawText('Góc dưới-trái của hệ tọa độ PDF (0,0) được đánh dấu bằng hình vuông đỏ.', { x: 60, y: 730, size: 12, font: fonts.regular });
    page.drawRectangle({ x: 0, y: 0, width: 24, height: 24, color: rgb(0.85, 0.1, 0.1) });
    page.drawRectangle({ x: 47, y: 693 - 300, width: 167, height: 95, borderColor: rgb(0.1, 0.3, 0.9), borderWidth: 1, borderDashArray: [4, 3] });
    page.drawText('Khung tham chiếu lLx=47, lLy=393, 167×95 pt', { x: 50, y: 380, size: 10, font: fonts.italic, color: rgb(0.1, 0.3, 0.9) });
    for (let gx = 0; gx <= 595; gx += 100) page.drawText(String(gx), { x: gx + 2, y: 30, size: 8, font: fonts.regular, color: rgb(0.5, 0.5, 0.5) });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => footer(p, fonts, i + 1, pages.length));
  return {
    bytes: await doc.save(),
    meta: { file: 'kiem-thu-xoay-trang.pdf', title: 'Kiểm thử xoay trang & CropBox — 5 trang', pages: pages.length, rotations: specs.map((s) => s.rotate) },
  };
}

function round(v) {
  return Math.round(v * 100) / 100;
}

await mkdir(outDir, { recursive: true });
const results = [await quyetDinh(), await hopDong(), await phieuKetQua(), await rotated()];
for (const r of results) {
  await writeFile(path.join(outDir, r.meta.file), r.bytes);
  console.log(`✓ ${r.meta.file} (${r.bytes.length} bytes)`);
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(results.map((r) => r.meta), null, 2) + '\n');
console.log('✓ manifest.json');
