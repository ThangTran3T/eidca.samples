# Kiến trúc — VNeCA Signature Designer

Ứng dụng client-side thuần (React 19 + Vite 8, JavaScript ES2022). Không có backend. Logic nghiệp vụ nằm trong các **engine thuần** (không React, không DOM) để kiểm thử độc lập và tái sử dụng (ví dụ trong một dịch vụ Node sau này); UI chỉ điều phối.

```text
             ┌────────────── UI (React, Tailwind, Radix, Konva) ──────────────┐
             │ Toolbar · LeftSidebar · Workspace(PdfViewer/TemplateView/       │
             │ RenderedPreview) · PropertiesPanel · Dialogs                    │
             └──────┬───────────────────────┬───────────────────────┬─────────┘
                    │ Zustand store (undo)  │ features/* (hành động) │ services/* (PDF.js, ảnh, phông)
   ┌────────────────┴──────┬────────────────┴──────┬────────────────┴───────┬──────────────────┐
   │ coordinate-engine     │ template-engine       │ rendering-engine       │ compliance-engine │
   │ PDF↔display↔viewport  │ biến, ngày giờ, điều  │ text-layout, canvas,   │ quy tắc NĐ30,      │
   │ snapping              │ kiện, ràng buộc       │ SVG, PDF (pdf-lib)     │ phân tích ảnh      │
   └───────────────────────┴───────────────────────┴────────────────────────┴──────────────────┘
                    schemas/ (Zod)            adapters/ (vneca-legacy, registry)
```

## Mô hình dữ liệu (Designer Schema)

`src/schemas/designer-schema.js` là mô hình chuẩn (canonical). Tệp Designer JSON:

```jsonc
{
  "format": "vneca.signature-designer", "schemaVersion": 1,
  "document": { "name": "quyet-dinh-mau.pdf", "pageCount": 2, "pages": [{ "view": [0,0,595.28,841.89], "rotate": 0 }] },
  "signatures": [{
    "id": "sig_…", "name": "…", "page": 1,
    "rect": { "x": 372.29, "y": 215.38, "width": 120, "height": 56 },   // PDF user space, gốc dưới-trái, pt
    "rotation": 0,                                                       // xoay nội dung 0/90/180/270
    "opacity": 1, "visible": true, "locked": false,
    "template": {
      "id", "name", "description", "category", "signatureType", "version",
      "complianceProfile": "nd30-authorized-person" | … | null,
      "complianceAttestations": { "ND30-B-M1": { "confirmed": true, "note": "…", "at": "ISO" } },
      "size": { "width": 120, "height": 56 },                            // kích thước thiết kế (đứng thẳng)
      "style": { "background", "border", "padding", "imageOpacity" },
      "dateTime": { "dateFormat", "timeFormat", "timeZone", "showDate", "showTime" },
      "elements": [ /* text | image | qr | rect | line — xem schema */ ],
      "sampleData": { "signer", "certificate", "signing", "document", "transaction", "copy" },
      "legacy": { "template", "contact", "labels", "extra" }             // chỉ dùng khi chiếu sang legacy
    }
  }]
}
```

Phần tử dùng tọa độ **không gian thiết kế**: điểm (pt), gốc trên-trái khung, trục y xuống, xoay theo chiều kim đồng hồ quanh góc trên-trái phần tử. Mỗi phần tử có `role` ngữ nghĩa (ví dụ `seal`, `hand-signature`, `signing-date`) dùng cho adapter legacy và quy tắc tuân thủ.

**Bất biến:** `template.size` luôn bằng kích thước đứng thẳng suy ra từ `rect` (đổi chiều khi trang `/Rotate` 90/270 hoặc `rotation` 90/270). Chỉ `operations.setSignatureRect()` thay đổi `rect`, đồng thời áp ràng buộc bố cục cho phần tử (cỡ chữ không bao giờ bị co giãn). Tọa độ được làm tròn 0,01 pt.

## Hệ tọa độ (critical)

`src/engines/coordinate-engine/index.js` — mọi chuyển đổi đều đi qua đây.

| Không gian | Đơn vị | Gốc / trục | Ghi chú |
|---|---|---|---|
| PDF user space | pt | dưới-trái, y lên | **Lưu trữ chuẩn** (`rect`), là `lLx/lLy` gửi VNeCA |
| Display | pt | trên-trái vùng hiển thị (CropBox∩MediaBox) sau khi xoay | Konva stage dùng đơn vị này (`stage.scale = zoom`) |
| Viewport | CSS px | = display × zoom | trùng `page.getViewport()` của PDF.js |
| Backing store | device px | = viewport × devicePixelRatio (có trần bộ nhớ) | canvas PDF.js sắc nét trên high-DPI |
| Client | px | vị trí trên màn hình | `clientToDisplay()` |

Ma trận user→display cho tổng góc xoay `R = /Rotate + xoay khung nhìn` (theo chiều kim đồng hồ), vùng hiển thị `[x0,y0,x1,y1]`:

| R | X | Y |
|---|---|---|
| 0 | x − x0 | y1 − y |
| 90 | y − y0 | x − x0 |
| 180 | x1 − x | y − y0 |
| 270 | y1 − y | x1 − x |

Kiểm thử `tests/integration/pdfjs-coordinates.test.js` so sánh ma trận này với **PDF.js thật** trên tệp `kiem-thu-xoay-trang.pdf` (5 trang × 4 mức zoom × 4 góc xoay khung nhìn) — khớp tới 1e-9.

Khung chữ ký: nội dung đứng thẳng theo hướng người đọc thấy trang (có tính `/Rotate`) cộng thêm `rotation` của chữ ký. `designToUserMatrix()` ánh xạ không gian thiết kế → PDF user space và **không phụ thuộc** zoom hay xoay khung nhìn (có test). Renderer PDF ghép ma trận này với phép lật trục y để vẽ chữ bằng pdf-lib; test đọc lại bằng PDF.js xác nhận chữ nằm trong `rect` và đứng thẳng ở cả 4 góc `/Rotate`.

Quy ước `lLx/lLy` khi CropBox không bắt đầu tại (0,0): xuất **tọa độ tuyệt đối PDF** (như iText/PDFBox) và cảnh báo — xem VNECA_INTEGRATION.md.

## Bộ máy mẫu & biến

- `variables.js`: nội suy `{{key}}` chỉ cho khóa trong danh sách trắng `VARIABLES`, tra cứu bằng `hasOwnProperty`, ngữ cảnh `Object.create(null)`, giá trị không bị nội suy lại, giá trị không phải chuỗi/số bị bỏ qua. Tùy chọn “ẩn dòng có biến trống”.
- `datetime.js`: định dạng theo múi giờ bằng `Intl.DateTimeFormat#formatToParts`, token `DD MM YYYY HH mm ss Z`, preset `ISO8601` (`2026-10-15T09:30:45+07:00`) và `vi-long`.
- `conditions.js`: điều kiện hiển thị khai báo (`notEmpty`, `empty`, `equals`, `notEquals`, `contains`).
- `constraints.js`: ràng buộc ngang/dọc `left/right/center/stretch/scale` khi đổi kích thước khung.
- `resolveTemplate()` tạo **render model** (hình học tuyệt đối, dòng chữ đã ngắt, module QR) dùng chung cho mọi renderer.

## Kết xuất — một nguồn sự thật

`text-layout.js` ngắt dòng bằng độ rộng glyph từ **fontkit** (đúng số liệu pdf-lib dùng) và đặt baseline theo ascent/descent của phông, nên canvas, PNG, SVG và PDF xuống dòng giống hệt nhau. Phông được tải một lần (`font-service.js`): byte cấp cho fontkit, đồng thời đăng ký `FontFace` cho canvas.

| Renderer | Dùng cho |
|---|---|
| `canvas-renderer.js` | Editor (Konva `sceneFunc` gọi `drawItemContent`), PNG, ảnh thu nhỏ |
| `svg-renderer.js` | Xuất SVG (escape XML, chỉ nhúng ảnh PNG/JPEG) |
| `pdf-renderer.js` | PDF kết xuất (pdf-lib, nhúng phông subset, ToUnicode → trích xuất chữ được) |

Nội dung bị cắt (clip) theo khung chữ ký ở cả ba renderer, giống BBox của appearance stream thật. PDF kết xuất được đóng dấu thông báo “bản xem trước” ở mép dưới mỗi trang có chữ ký, ghi `Subject/Producer` tương ứng và **không** tạo AcroForm/`/Sig`/`/ByteRange` (có test).

## Tuân thủ

`compliance-engine/rules.js` định nghĩa quy tắc dạng dữ liệu + hàm `evaluate(ctx)`; `index.js` tổng hợp. Ngữ cảnh gồm mẫu, vị trí đặt, hình học trang, các chữ ký khác (để kiểm tra dấu trùm 1/3 chữ ký), lớp chữ của PDF (để kiểm tra “canh giữa chức vụ và họ tên”) và dữ liệu xem trước. Phân tích điểm ảnh (`image-analysis.js`) chạy khi tải ảnh lên và lưu kết quả vào phần tử (độ trong suốt, màu mực chủ đạo, khung nội dung có mực). Chi tiết pháp lý: DECREE30_COMPLIANCE.md.

## Adapter

`adapters/index.js` là registry; mỗi adapter cung cấp `export`, `import`, `serialize`, `fileName`. Hiện có `vneca-legacy`. Thêm nhà cung cấp ký số khác = thêm một mục registry, không đụng UI hay engine.

## Trạng thái & hoàn tác

`stores/editor-store.js` (Zustand). Chỉ `signatures` có lịch sử (`history.js`, tối đa 100 bước): gộp các lần gõ liên tiếp cùng trường trong 800 ms; kéo/đổi kích thước dùng giao dịch `beginLive → live → endLive` thành **một** bước. Tài liệu PDF giữ trong bộ nhớ, không lưu.

## Nhúng vào VNeCA CMS

```js
import { mount } from './src/embed.js';
const designer = mount(document.getElementById('designer'), { theme: 'light', locale: 'vi' });
await designer.openPdf(pdfBytes, 'van-ban.pdf');
const { payload, warnings } = designer.exportVnecaSignProps({ integerCoordinates: true });
designer.subscribe((signatures) => { /* lưu nháp phía host */ });
designer.unmount();
```

Bản build dùng `base: './'` nên đặt được dưới bất kỳ đường dẫn nào; cũng có thể nhúng qua `<iframe>`. CSP của bản build nằm trong thẻ `<meta>` (sinh bởi `vite.config.js`); thẻ meta không hỗ trợ `frame-ancestors`, vì vậy chính sách cho phép nhúng iframe phải đặt bằng HTTP header trên máy chủ phục vụ.

## Kiểm thử

| Bộ | Phạm vi |
|---|---|
| `tests/unit/coordinate-engine` | ma trận, CropBox, 4 góc xoay, zoom/DPI, khung chữ ký |
| `tests/integration/pdfjs-coordinates` | đối chiếu với PDF.js thật |
| `tests/integration/pdf-rendering` | chữ tiếng Việt trích xuất nguyên văn, vị trí trên trang xoay, không có `/Sig` |
| `tests/unit/template-engine` | biến (kể cả chống prototype pollution), ngày giờ, điều kiện, ràng buộc, bố cục chữ |
| `tests/unit/compliance-engine`, `placement` | từng quy tắc NĐ 30, tổng hợp, vị trí mặc định |
| `tests/unit/vneca-adapter`, `designer-io` | round-trip với tệp thật trong `docs/`, cảnh báo, validate |
| `tests/unit/store-history`, `snapping`, `svg-and-sanitize` | hoàn tác, bắt dính, escape SVG, làm sạch SVG |
| `tests/e2e/editor.spec.js` (Playwright) | luồng chính trên trình duyệt thật |

## Giới hạn đã biết

- **Kích thước bundle**: ~2,3 MB JS (≈ 0,8 MB gzip) do PDF.js, fontkit và Konva; pdf-lib được tải khi cần.
- **Phông thay thế**: xem trước bằng Liberation thay Times New Roman/Arial (tương thích số đo; hình dạng glyph khác chút).
- **Xoay khung chữ ký** chỉ theo bội số 90° (khung widget PDF luôn thẳng trục); phần tử bên trong xoay tự do.
- Quy tắc **B-05** (canh giữa chức vụ/họ tên) cần PDF có lớp chữ và tìm theo chuỗi trong dữ liệu người ký; PDF scan hoặc trang có `/Rotate` chuyển sang kiểm tra thủ công.
- **UserUnit ≠ 1** chỉ được dùng khi quy đổi mm; hiếm gặp, chưa kiểm thử với PDF thật.
- PDF có mật khẩu chưa được hỗ trợ; tài liệu lớn (> 60 trang) không trích lớp chữ ngầm.
- Nhập legacy chỉ dựng lại bố cục **gần đúng** (định dạng legacy không chứa bố cục chi tiết).
- Giao diện tối ưu cho desktop (≥ 1280 px); dưới đó dùng nút ẩn/hiện bảng bên.
- Tiếng Anh mới phủ phần khung giao diện; thông điệp tuân thủ giữ tiếng Việt vì trích dẫn luật Việt Nam.
