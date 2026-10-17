# Tích hợp VNeCA — cấu hình `sign_props`

Tài liệu này mô tả cách VNeCA Signature Designer xuất/nhập cấu hình vị trí & hình thức chữ ký cho nền tảng VNeCA. **Không có API backend nào bị thay đổi**; công cụ chỉ sinh JSON theo định dạng mà các client hiện có trong repo đang gửi.

## Nguồn tham chiếu (trong repo này)

Schema legacy được suy ra **chỉ** từ:

- `docs/api-reference.md` — mục “Chi tiết tham số `sign_props`” (bảng trường, enum `template`, `watermark_pos`, `sign_visibility`; ghi chú gốc tọa độ dưới-trái).
- `docs/sign_props_template.json`, `docs/sign_props_string.txt`, `docs/vneca-platform-signing-guide.md` §6.
- Client hiện có: `web-app/src/flows/personal-sign/Step1Upload.js` (enum `hand_sig_pos`, `hand_sig_index`, base64 không kèm tiền tố `data:`), `web-demo/sign/index.html`, `web-demo/cms/demo_signing.php`, `win-app/.../Step1UploadViewModel.cs`.

Không có trường nào được bịa thêm. Trường không có trong các nguồn trên được coi là “không xác định” và được **giữ nguyên** khi nhập/xuất lại.

## Hai schema

| | Designer Schema | VNeCA Legacy Schema |
|---|---|---|
| Mục đích | Dựng lại chính xác toàn bộ thiết kế | Cấu hình gửi dịch vụ ký |
| Tệp | `*.signature-designer.json`, `*.signature-template.json` | `*.sign_props.json` |
| Định nghĩa | `src/schemas/designer-schema.js` | `src/schemas/legacy-schema.js` |
| Chiều | không mất mát | **mất mát** (chiếu một phần) |

## Các trường legacy và cách ánh xạ

| Trường | Kiểu | Lấy từ Designer |
|---|---|---|
| `page` | số, từ 1 | `signature.page` |
| `lLx`, `lLy` | pt | `signature.rect.x/y` — tọa độ PDF tuyệt đối, gốc dưới-trái |
| `width`, `height` | pt | `signature.rect.width/height` (đã đổi chiều trên trang `/Rotate` 90/270) |
| `template` | `right` \| `left` \| `center` \| `text_only` | gợi ý `template.legacy.template`, nếu không có thì suy từ vị trí ảnh chữ ký tay (trái/giữa/phải), không có ảnh → `text_only` |
| `show_info` | mảng `reason, location, contact, name, org, date` | biến đang hiển thị: `signing.reason→reason`, `signing.location→location`, `signer.title→contact`, `signer.name`/`certificate.subject→name`, `signer.organization→org`, `signing.date/time/datetime→date` (theo thứ tự chuẩn của ví dụ VNeCA) |
| `reason`, `location` | chuỗi | dữ liệu đang xem trước (mẫu hoặc thực tế) |
| `contact` | chuỗi | `template.legacy.contact` hoặc `signer.title` |
| `*_label` | chuỗi | phần chữ tĩnh đứng trước biến trên cùng dòng, ví dụ `Lý do: {{signing.reason}}` → `reason_label: "Lý do:"` |
| `text_color`, `font_size` | hex, số | phần tử chữ (có biến) đầu tiên |
| `sign_visibility` | `shown` \| `hidden` | `signature.visible` |
| `hand_sig_img_b64` | base64 **không** tiền tố | ảnh vai trò `hand-signature`; nếu bố cục là logo trái/phải/giữa và không có ảnh chữ ký thì dùng ảnh `logo` (tài liệu: “`right` — logo bên phải”) |
| `hand_sig_pos`, `hand_sig_index` | `center/left/right`, `top/bottom` | vị trí ngang của ảnh; `top` nếu ảnh nằm trên mọi phần tử chữ |
| `watermark_img_b64`, `watermark_pos` | base64, 5 vị trí | ảnh còn lại lớn nhất (dấu, ảnh nền, logo); vị trí gần nhất trong 5 vị trí |

Đầu ra luôn là **mảng** (mỗi phần tử một vị trí ký), đúng như `docs/api-reference.md`. Hộp thoại xuất có 3 dạng:

- **JSON body** — dùng làm `sign_props` dạng object/array trong `POST /api/sign-document` (Local Agent, JSON).
- **Rút gọn** — một dòng.
- **Chuỗi multipart** — mảng được `JSON.stringify` thành chuỗi, dùng cho trường `sign_props` kiểu Text khi gửi `multipart/form-data`.

Tọa độ mặc định làm tròn tới số nguyên điểm (sai số ≤ 0,5 pt ≈ 0,18 mm, có cảnh báo) vì mọi ví dụ trong repo dùng số nguyên; có thể tắt để giữ 2 chữ số thập phân.

## Không bao giờ bỏ qua âm thầm

Mỗi tính năng không biểu diễn được trong legacy sinh một cảnh báo có mã, gắn với chữ ký/phần tử. Người dùng phải tích “Tôi đã hiểu…” trước khi tải hoặc sao chép. Các mã:

`layout` (vị trí/kích thước từng phần tử) · `static-text` · `combined-line` · `unsupported-variable` (`certificate.issuer`, `certificate.serial`, `document.name`, `transaction.id`, `document.number`, `copy.*`) · `unsupported-element` (QR, hình chữ nhật, đường kẻ) · `extra-image` · `logo-as-hand-sig` · `image-format` · `font` / `font-family` / `font-style` / `alignment` / `text-transform` · `multiple-colors` / `multiple-sizes` · `border` / `background` · `opacity` / `rotation` · `condition` · `date-format` · `page-rotation` · `cropbox-origin` · `template-mismatch` · `rounding`.

## Nhập legacy

Chấp nhận: object, mảng, chuỗi JSON (kể cả chuỗi đã stringify hai lần như dạng multipart) và payload có trường `sign_props`. Mỗi phần tử được kiểm tra bằng Zod; phần tử lỗi bị báo riêng, phần tử hợp lệ vẫn được nhập.

**Định dạng legacy không chứa bố cục chi tiết**, nên Designer chỉ dựng lại bố cục **gần đúng** từ `template` (ảnh chữ ký trái/phải/giữa, khối chữ theo `show_info`, watermark theo `watermark_pos`, độ mờ 0,18 như web-app) và luôn hiện cảnh báo `layout-synthesized`. Giá trị gốc (nhãn, `contact`, trường không xác định) được lưu trong `template.legacy` để xuất lại cho ra cùng giá trị — có test round-trip với `docs/sign_props_template.json` và chuỗi ví dụ trong `docs/api-reference.md`. Ảnh WebP/GIF (ví dụ watermark trong `web-demo/sign/index.html` là WebP) được chuyển sang PNG để xem trước.

## Gửi lên VNeCA (ví dụ, không thay đổi API)

```js
// Local Agent — JSON body (docs/vneca-platform-signing-guide.md §4.2)
const { payload } = designer.exportVnecaSignProps();
await fetch(`${localUrl}/api/sign-document`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ file_base64, file_type: 'pdf', method_code: 'USB_TOKEN', user_id, sign_props: payload[0] }),
});

// multipart/form-data — sign_props là chuỗi JSON
form.append('sign_props', JSON.stringify(payload));
```

Lưu ý ví dụ Local Agent trong guide gửi **một object**, còn API Server/CA gửi **mảng stringify** — chọn đúng dạng cho từng endpoint.

## Kiến trúc adapter

`src/adapters/index.js` là registry `{ id → adapter }`. Một adapter cung cấp `export(signatures, opts)`, `import(input, opts)`, `serialize(payload, variant)`, `fileName(docName)`. Để thêm nhà cung cấp ký số khác: tạo `src/adapters/<provider>/…`, đăng ký vào `ADAPTERS`; Designer Schema không đổi.

## Điểm cần VNeCA xác nhận

Các giả định sau **chưa được xác nhận** bởi tài liệu trong repo — cần đơn vị vận hành VNeCA trả lời trước khi dùng cho sản xuất:

1. **Gốc tọa độ khi CropBox ≠ MediaBox hoặc không bắt đầu tại (0,0)**: Designer xuất tọa độ tuyệt đối của PDF (như iText/PDFBox). Nếu backend tính theo CropBox, cần trừ gốc CropBox. Có cảnh báo `cropbox-origin`.
2. **Trang có `/Rotate`**: backend có tự xoay appearance cho đứng thẳng không, và `width/height` hiểu theo trục PDF hay theo hướng hiển thị? Designer xuất theo trục PDF (cảnh báo `page-rotation`).
3. `lLx/lLy/width/height` có chấp nhận số thập phân không (mặc định làm tròn số nguyên).
4. Ý nghĩa chính xác của `template` khi dùng logo thay vì chữ ký tay, và thứ tự hiển thị các dòng `show_info`.
5. Phông chữ, định dạng ngày giờ và múi giờ mà backend dùng khi vẽ appearance (legacy không có trường này) — quan trọng với Preset C/A2 (Times New Roman cỡ 10, ISO 8601).
6. Backend có hỗ trợ hiển thị ảnh dấu đúng kích thước thật và chồng 1/3 lên ảnh chữ ký (Preset A/B) hay không — legacy không có trường để mô tả quan hệ hai chữ ký.
7. Định dạng ảnh chấp nhận cho `*_img_b64` (client hiện có giả định PNG; mẫu `web-demo/sign` gửi WebP).
8. Cơ chế xác thực/header của từng môi trường (guide §8 cũng ghi chưa khai báo).

Cho tới khi có xác nhận, hãy coi **Designer JSON là nguồn sự thật** và `sign_props` là bản chiếu tương thích.
