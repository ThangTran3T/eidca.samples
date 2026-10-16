/**
 * Verbatim legal text used by the compliance rules.
 * Source: Nghị định 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư,
 * Phụ lục I "Thể thức, kỹ thuật trình bày văn bản hành chính và bản sao văn bản".
 * Text cross-checked against consolidated publications (thuvienphapluat.vn,
 * vietjack.me reproduction of Phụ lục I) on 2026-10-17; the official
 * vbpl.vn record (ItemID=141142) is the authoritative copy. See DECREE30_COMPLIANCE.md.
 */
export const DECREE = 'Nghị định 30/2020/NĐ-CP';

export const REFS = {
  signerImage: {
    location: 'Phụ lục I, Phần I, Mục II, khoản 7, điểm d',
    quote:
      'Hình ảnh, vị trí chữ ký số của người có thẩm quyền là hình ảnh chữ ký của người có thẩm quyền trên văn bản giấy, màu xanh, định dạng Portable Network Graphics (.png) nền trong suốt; đặt canh giữa chức vụ của người ký và họ tên người ký.',
  },
  organizationImage: {
    location: 'Phụ lục I, Phần I, Mục II, khoản 8, điểm a',
    quote:
      'Hình ảnh, vị trí chữ ký số của cơ quan, tổ chức là hình ảnh dấu của cơ quan, tổ chức ban hành văn bản trên văn bản, màu đỏ, kích thước bằng kích thước thực tế của dấu, định dạng (.png) nền trong suốt, trùm lên khoảng 1/3 hình ảnh chữ ký số của người có thẩm quyền về bên trái.',
  },
  attachment: {
    location: 'Phụ lục I, Phần I, Mục II, khoản 8, điểm b',
    quote:
      'Văn bản kèm theo cùng tệp tin với nội dung văn bản điện tử, Văn thư cơ quan chỉ thực hiện ký số văn bản và không thực hiện ký số lên văn bản kèm theo; văn bản không cùng tệp tin với nội dung văn bản điện tử, Văn thư cơ quan thực hiện ký số của cơ quan, tổ chức trên văn bản kèm theo. Vị trí: Góc trên, bên phải, trang đầu của văn bản kèm theo. Hình ảnh chữ ký số của cơ quan, tổ chức: Không hiển thị. Thông tin: Số và ký hiệu văn bản; thời gian ký (ngày tháng năm; giờ phút giây; múi giờ Việt Nam theo tiêu chuẩn ISO 8601) được trình bày bằng phông chữ Times New Roman, chữ in thường, kiểu chữ đứng, cỡ chữ 10, màu đen.',
  },
  copyForm: {
    location: 'Phụ lục I, Phần II, Mục I, khoản 1',
    quote: 'Hình thức sao: “SAO Y” hoặc “SAO LỤC” hoặc “TRÍCH SAO”.',
  },
  electronicCopy: {
    location: 'Phụ lục I, Phần II, Mục I, khoản 3',
    quote:
      'Vị trí: Góc trên, bên phải, trang đầu của văn bản, trình bày tại ô số 14 Mục IV Phần I Phụ lục này. Hình ảnh chữ ký số của cơ quan, tổ chức: Không hiển thị. Thông tin: Hình thức sao, tên cơ quan, tổ chức sao văn bản, thời gian ký (ngày tháng năm; giờ phút giây; múi giờ Việt Nam theo tiêu chuẩn ISO 8601) được trình bày bằng phông chữ Times New Roman, chữ in thường, kiểu chữ đứng, cỡ chữ 10, màu đen.',
  },
  font: {
    location: 'Phụ lục I, Phần I, Mục I, khoản 4',
    quote: 'Phông chữ tiếng Việt Times New Roman, bộ mã ký tự Unicode theo Tiêu chuẩn Việt Nam TCVN 6909:2001, màu đen.',
  },
  legalValue: {
    location: 'Điều 13, khoản 7',
    quote: 'Vị trí, hình ảnh chữ ký số theo quy định tại Phụ lục I Nghị định này.',
  },
};

export const PROFILES = {
  'nd30-authorized-person': {
    label: 'NĐ 30 — Chữ ký số của người có thẩm quyền',
    short: 'Preset B',
    documentType: 'Văn bản hành chính điện tử',
    signerType: 'Người có thẩm quyền',
  },
  'nd30-organization': {
    label: 'NĐ 30 — Chữ ký số của cơ quan, tổ chức',
    short: 'Preset A',
    documentType: 'Văn bản hành chính điện tử',
    signerType: 'Cơ quan, tổ chức (Văn thư)',
  },
  'nd30-attachment': {
    label: 'NĐ 30 — Chữ ký số cơ quan trên văn bản kèm theo (khác tệp)',
    short: 'Preset A2',
    documentType: 'Văn bản kèm theo văn bản chính, không cùng tệp tin',
    signerType: 'Cơ quan, tổ chức (Văn thư)',
  },
  'nd30-electronic-copy': {
    label: 'NĐ 30 — Chữ ký số trên bản sao điện tử',
    short: 'Preset C',
    documentType: 'Bản sao văn bản sang định dạng điện tử',
    signerType: 'Cơ quan, tổ chức sao văn bản',
  },
};
