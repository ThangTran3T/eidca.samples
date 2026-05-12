# eIDCA — API Reference
> **Version:** 1.0.7 | **Ngày:** 20/03/2026 | **Phân loại:** Confidential

---

## 📋 Tổng quan các luồng API

| # | Nhóm nghiệp vụ | Luồng | Số bước |
|---|---|---|---|
| 1 | CTS Cá nhân | Đăng ký CTS | 3 bước |
| 2 | CTS Cá nhân | Ký văn bản | 4 bước |
| 3 | CTS Cá nhân thuộc Tổ chức | Đăng ký CTS | 3 bước |
| 4 | CTS Cá nhân thuộc Tổ chức | Ký văn bản | 4 bước |
| 5 | QR Code (Cá nhân & Cá nhân TT) | Đăng ký CTS | 5 bước |
| 6 | QR Code (Cá nhân & Cá nhân TT) | Ký văn bản | 5 bước |

### Header chung cho tất cả API

| Header | Giá trị |
|---|---|
| `Content-Type` | `application/json` |
| `Accept` | `*/*` |
| `Accept-Encoding` | `gzip, deflate, br` |
| `x-api-key` | `{APIKey value}` |

### Mã lỗi chung

| Error Code | Mô tả |
|---|---|
| `401` | APIKey không đúng |
| `ERROR_99` | Lỗi không xác định |

---

## 1. NGHIỆP VỤ CHỨNG THƯ SỐ CÁ NHÂN

### 1.1. LUỒNG ĐĂNG KÝ CTS CÁ NHÂN

```
[Client] --Step1: Get Challenge--> [Server]
[Client] --Step2: Send Signature + NFC Data + Selfie--> [Server]
[Client] --Step3: Poll Check Status--> [Server]
```

---

#### STEP 1 — Lấy Challenge

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/challenge` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `id_number` | String | Mã định danh 12 số (CCCD/CC) |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `success` | Boolean | `true` nếu thành công |
| `error.code` | String | Mã lỗi |
| `error.message` | String | Miêu tả lỗi |
| `data.transaction_code` | String | Mã giao dịch hệ thống |
| `data.challenge` | String | Dùng để tạo signature |
| `data.token_challenge` | String | Enroll token chứa challenge |

---

#### STEP 2 — Gửi Signature, thông tin thẻ, selfie và contact info

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/signature` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `transaction_code` | String | Mã giao dịch từ STEP 1 |
| `token_challenge` | String | Enroll token từ STEP 1 |
| `raw_data.sod` | String | Base64 của SOD ICAO container |
| `raw_data.dg1` | String | Base64 của DG1 ICAO container |
| `raw_data.dg2` | String | Base64 của DG2 ICAO container |
| `raw_data.dg13` | String | Base64 của DG13 ICAO container |
| `raw_data.dg15` | String | Base64 của DG15 ICAO container |
| `info.ip_address` | String | IPv4 của thiết bị |
| `info.hand_sig_image_base64` | String | Chữ ký tay của chủ thể |
| `info.machine_name` | String | Tên thiết bị |
| `info.machine_type` | String | Loại thiết bị |
| `info.operating_system` | String | Hệ điều hành |
| `info.version` | String | Version thiết bị |
| `info.serial_device` | String | Số seri thiết bị |
| `info.permanent_city` | String | Mã thành phố |
| `info.permanent_district` | String | Tên thành phố |
| `info.phone` | String | Số điện thoại nhận link Public CA |
| `info.email` | String | Email nhận link Public CA |
| `info.image` | String | Hình selfie (Base64) |
| `signature` | String | Signature sinh từ token challenge |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `success` | Boolean | `true` nếu thành công |
| `data.transaction_code` | String | Mã giao dịch hệ thống |
| `data.status` | String | `processing` / `completed` / `failed` |
| `data.interval` | String | Interval để refresh kiểm tra CTS |
| `data.expired_at` | String | Timestamp hết hạn đăng ký CTS |
| `data.token_signature` | String | Token signature |

---

#### STEP 3 — Kiểm tra trạng thái cấp CTS

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/check` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `transaction_code` | String | Mã giao dịch từ STEP 2 |
| `token_signature` | String | Signature từ STEP 2 |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.status` | String | `processing` / `completed` / `failed` |
| `data.cert_info.serial_number` | String | Số seri chứng thư số |
| `data.cert_info.id_number` | String | Mã định danh 12 số |
| `data.cert_info.full_name` | String | Tên chủ thể |
| `data.cert_info.phone` | String | Số điện thoại |
| `data.cert_info.email` | String | Email |
| `data.cert_info.cert` | String | Thông tin CTS |
| `data.cert_info.date_issue` | String | Ngày cấp |
| `data.cert_info.date_expire` | String | Ngày hết hạn |

---

### 1.2. LUỒNG KÝ VĂN BẢN (CTS Cá nhân)

```
[Client] --Step1: Upload Document--> [Server] --> token_sign + doc_challenge
[Client] --Step2: Send Biometric + Signature--> [Server] --> signed_docs
[Client] --Step3: Download Signed File--> [Server]
[Client] --Step4: Check Session (nếu dùng phiên ký)--> [Server]
```

---

#### STEP 1 — Tải văn bản để ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/sign/challenge` |
| **Content-Type** | `multipart/form-data` |
| **Header bổ sung** | `code: {mã partner}` |

**Form Request**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `documents` | File | PDF, tối đa 10MB |
| `id_number` | String | Số định danh cá nhân người ký |
| `sign_props` | String | JSON Array (stringify) — Thông tin tùy chỉnh vị trí & hình thức chữ ký trên PDF. Xem chi tiết bên dưới. |
| `expire_at` | String | *(Optional)* Thời gian hết hạn chữ ký |
| `doc_name` | String | *(Optional)* Tên thay thế tài liệu |
| `session_timeout` | String | *(Optional)* `ONE_HOUR` / `TWO_HOURS` / `FOUR_HOURS` / `EIGHT_HOURS` / `TWELVE_HOURS` / `FULL_DAY` |
| `security_level` | String | `LEVEL_2` (ký với CTS công cộng) |

**Chi tiết tham số `sign_props`**

Giá trị là một **JSON Array được stringify** (dạng chuỗi), mỗi phần tử trong array tương ứng với **một vị trí chữ ký** trên tài liệu PDF.

*Ví dụ giá trị gửi lên:*

```
[{\"page\":1,\"lLx\":65,\"lLy\":320,\"width\":260,\"height\":90,\"template\":\"right\",\"show_info\":[\"reason\",\"location\",\"contact\",\"name\",\"org\",\"date\"],\"location\":\"HCM city\",\"location_label\":\"Tại: Phòng giao dịch\",\"reason\":\"Ký test\",\"reason_label\":\"\",\"contact\":\"Giám đốc\",\"contact_label\":\"Email: eidca.vn@gmail.com\",\"date_label\":\"Ngày ký\",\"text_color\":\"#0000ff\",\"font_size\":11,\"sign_visibility\":\"shown\",\"watermark_pos\":\"center\",\"watermark_img_b64\":\"\",\"hand_sig_img_b64\":\"\"}]
```

*Cấu trúc một phần tử trong array:*

| Trường | Kiểu | Mô tả |
|---|---|---|
| `page` | Number | Số trang đặt chữ ký (bắt đầu từ `1`) |
| `lLx` | Number | Tọa độ X góc dưới trái của vùng chữ ký (đơn vị: point PDF) |
| `lLy` | Number | Tọa độ Y góc dưới trái của vùng chữ ký (đơn vị: point PDF) |
| `width` | Number | Chiều rộng vùng chữ ký (đơn vị: point PDF) |
| `height` | Number | Chiều cao vùng chữ ký (đơn vị: point PDF) |
| `template` | String | Bố cục hiển thị: `"right"` — logo bên phải, text bên trái |
| `show_info` | Array\<String\> | Danh sách thông tin hiển thị trong ô chữ ký. Các giá trị hợp lệ: `"reason"`, `"location"`, `"contact"`, `"name"`, `"org"`, `"date"` |
| `location` | String | Giá trị địa điểm ký (ví dụ: `"HCM city"`) |
| `location_label` | String | Nhãn hiển thị trước địa điểm (ví dụ: `"Tại: Phòng giao dịch"`) |
| `reason` | String | Lý do ký (ví dụ: `"Ký test"`) |
| `reason_label` | String | Nhãn hiển thị trước lý do (để trống nếu không cần) |
| `contact` | String | Thông tin liên hệ người ký (ví dụ: `"Giám đốc"`) |
| `contact_label` | String | Nhãn hiển thị trước contact (ví dụ: `"Email: eidca.vn@gmail.com"`) |
| `date_label` | String | Nhãn hiển thị trước ngày ký (ví dụ: `"Ngày ký"`) |
| `text_color` | String | Màu chữ trong ô chữ ký (hex, ví dụ: `"#0000ff"`) |
| `font_size` | Number | Cỡ chữ trong ô chữ ký (ví dụ: `11`) |
| `sign_visibility` | String | Hiển thị ô chữ ký: `"shown"` — hiển thị \| `"hidden"` — ẩn (chữ ký nhúng không hiển thị) |
| `watermark_pos` | String | Vị trí watermark: `"center"` \| `"top-left"` \| `"top-right"` \| `"bottom-left"` \| `"bottom-right"` |
| `watermark_img_b64` | String | Ảnh watermark dạng Base64 (để trống nếu không dùng) |
| `hand_sig_img_b64` | String | Ảnh chữ ký tay dạng Base64 (để trống nếu không dùng) |

> **Lưu ý:** Hệ thống tọa độ PDF gốc nằm ở góc dưới trái trang. `lLx` / `lLy` là tọa độ của góc dưới trái vùng chữ ký tính từ gốc đó.

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.transaction_code` | String | Mã giao dịch hệ thống |
| `data.token_sign` | String | Sign token |
| `data.docs[].doc_id` | String | UUID tài liệu |
| `data.docs[].doc_name` | String | Tên tài liệu |
| `data.docs[].doc_type` | String | Loại file (`file`/`string`) |
| `data.docs[].doc_challenge` | String | Token signature challenge |

---

#### STEP 2 — Gửi thông tin sinh trắc + signature để xác nhận ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/sign/signature` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `transaction_code` | String | Mã giao dịch hệ thống |
| `token_sign` | String | Sign token từ STEP 1 |
| `info.image` | String | Hình selfie (Base64) |
| `doc_signs[].doc_id` | String | UUID tài liệu |
| `doc_signs[].signature` | String | Signature từ token challenge STEP 1 |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.status` | String | `signing` / `completed` / `failed` |
| `data.token` | String | Token sign |
| `data.interval` | String | Interval refresh |
| `data.expired_at` | String | Timestamp hết hạn |
| `data.signed_docs[].doc_id` | String | UUID tài liệu |
| `data.signed_docs[].doc_name` | String | Tên tài liệu |
| `data.signed_docs[].ca_signature` | String | Chữ ký CTS cá nhân |
| `data.signed_docs[].sign_at` | String | Timestamp thời điểm ký |
| `data.signed_docs[].expire_at` | String | Timestamp hết hạn |
| `data.signed_docs[].doc_hash` | String | Hash SHA256 (Base64) |

---

#### STEP 3 — Download tài liệu đã ký

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/sign/download/{{doc-id}}` |
| **Header bổ sung** | `code`, `transaction_code`, `token_sign`, `os-type` *(optional)* |

**Response**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `Data` | Byte | Dữ liệu nhị phân của file đã ký |

---

#### STEP 4 — Kiểm tra phiên ký *(chỉ dùng khi mở phiên ký)*

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/event/check-session` |
| **Header bổ sung** | `code`, `transaction_code`, `token_sign`, `os-type` *(optional)* |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.remaining_time` | Date | Thời gian còn lại của phiên ký |

---

## 2. NGHIỆP VỤ CHỨNG THƯ SỐ CÁ NHÂN THUỘC TỔ CHỨC

### 2.1. LUỒNG ĐĂNG KÝ CTS CÁ NHÂN THUỘC TỔ CHỨC

```
[Client] --Step1: Get Challenge (kèm company_id)--> [Server]
[Client] --Step2: Send Signature + NFC Data + Selfie--> [Server]
[Client] --Step3: Poll Check Status--> [Server]
```

---

#### STEP 1 — Lấy Challenge

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-company/challenge` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `id_number` | String | Mã định danh 12 số (CCCD/CC) |
| `company_id` | Int | ID của tổ chức |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.transaction_code` | String | Mã giao dịch hệ thống |
| `data.token_challenge` | String | Enroll token chứa challenge |

---

#### STEP 2 — Gửi Signature, thông tin thẻ, selfie và contact info

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-company/signature` |

**Request Body (JSON)** *(tương tự cá nhân, không có ip/machine/device info)*

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `code` | String | Mã partner/subpartner |
| `transaction_code` | String | Mã giao dịch từ STEP 1 |
| `token_challenge` | String | Enroll token từ STEP 1 |
| `raw_data.sod` | String | Base64 SOD ICAO container |
| `raw_data.dg1` | String | Base64 DG1 ICAO container |
| `raw_data.dg2` | String | Base64 DG2 ICAO container |
| `raw_data.dg13` | String | Base64 DG13 ICAO container |
| `raw_data.dg15` | String | Base64 DG15 ICAO container |
| `info.phone` | String | Số điện thoại nhận link Public CA |
| `info.email` | String | Email nhận link Public CA |
| `info.image` | String | Hình selfie (Base64) |
| `signature` | String | Signature từ token challenge |

**Response:** Tương tự STEP 2 cá nhân — trả về `transaction_code`, `status`, `interval`, `expired_at`, `token_signature`.

---

#### STEP 3 — Kiểm tra trạng thái cấp CTS

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-company/check` |

**Request/Response:** Tương tự STEP 3 cá nhân. Response trả về `cert_info` chứa thông tin CTS cá nhân thuộc tổ chức.

---

### 2.2. LUỒNG KÝ VĂN BẢN (CTS Cá nhân thuộc Tổ chức)

Tương tự luồng ký văn bản cá nhân, khác ở **STEP 1** có thêm `company_id`.

---

#### STEP 1 — Tải văn bản để ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/sign-company/challenge` |

**Tham số bổ sung so với cá nhân:**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `company_id` | String | ID của tổ chức |

**Response:** Tương tự — trả về `transaction_code`, `token_sign`, `docs[]` (với field `challenge` thay vì `doc_challenge`).

---

#### STEP 2 — Gửi signature xác nhận ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/sign-company/signature` |

**Request/Response:** Tương tự luồng ký cá nhân.

---

#### STEP 3 — Download tài liệu đã ký

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/sign/download/{{doc-id}}` |

*(Dùng chung endpoint với luồng cá nhân)*

---

#### STEP 4 — Kiểm tra phiên ký *(chỉ dùng khi mở phiên ký)*

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/event/check-session` |

*(Dùng chung endpoint với luồng cá nhân)*

---

## 3. NGHIỆP VỤ QR CODE (Cá nhân & Cá nhân thuộc Tổ chức)

### 3.1. LUỒNG ĐĂNG KÝ CTS QIA QR CODE

```
[Web]    --Step1: Gen QR Code--> [Server] --> encrypted_data + session_id
[Mobile] --Step2: Scan QR, Get Challenge (NFC)--> [Server]
[Mobile] --Step3: Send Signature + NFC Data + Selfie--> [Server]
[Mobile] --Step4: Poll Check Status--> [Server]
[Web]    --Step5: Listen Event via SSE (session_id)--> [Server]
```

---

#### STEP 1 — Gen mã QR Code từ Web

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/qr/onboard` |

**Request Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `id_number` | String | Số CC/CCCD của chủ thể |
| `full_name` | String | Họ tên đầy đủ |
| `date_of_birth` | Date | Ngày sinh |
| `date_of_issue` | Date | Ngày phát hành |
| `code` | String | Mã partner/subpartner |
| `type` | String | `Personal` / `Personal_company` |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.encrypted_data` | String | Thông tin được mã hóa (nội dung QR) |
| `data.expired_at` | String | Timestamp hết hạn |
| `data.type` | String | Loại QR code |
| `data.url` | String | URL hệ thống |
| `data.session_id` | String | Mã định danh duy nhất cho QR code |

---

#### STEP 2 — Lấy Challenge từ Mobile App (sau khi scan QR)

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/challenge` |

*(Dùng chung endpoint với luồng cá nhân — STEP 1)*

---

#### STEP 3 — Gửi Signature + NFC Data + Selfie từ Mobile

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/signature` |

*(Dùng chung endpoint với luồng cá nhân — STEP 2)*

---

#### STEP 4 — Kiểm tra trạng thái cấp CTS

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/eid-personal/check` |

*(Dùng chung endpoint với luồng cá nhân — STEP 3)*

---

#### STEP 5 — Nhận Event qua Session ID (Server-Sent Events)

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/apievent?session_id={session_id}` |

**Request**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `session_id` | String | Mã định danh duy nhất của QR code |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.ca_status` | String | Trạng thái truyền event |
| `data.result` | String | Trạng thái chung giao dịch |
| `data.transaction_code` | String | Mã giao dịch |
| `data.token_sign` | String | Sign token phục vụ luồng ký |
| `data.cert` | String | Thông tin chứng thư số |
| `data.doc_ids` | String | ID document *(trả về với luồng ký tài liệu)* |

---

### 3.2. LUỒNG KÝ VĂN BẢN QIA QR CODE

```
[Web]    --Step1: Upload Doc, Gen QR--> [Server] --> encrypted_data + session_id
[Mobile] --Step2: Nhận document từ Web--> [Server] --> binary file
[Mobile] --Step3: Send Biometric + Signature--> [Server] --> signed_docs
[Web/Mobile] --Step4: Download File đã ký--> [Server]
[Web]    --Step5: Listen Event via SSE (session_id)--> [Server]
```

---

#### STEP 1 — Tải văn bản, Gen QR Code ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/qr/sign` |

**Request Body (JSON/Form)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `documents` | File | PNG/JPG/XML/PDF/DOC, tối đa 100MB |
| `code` | String | Mã partner/subpartner |
| `sign_props` | String | Thông tin tùy chỉnh chữ ký PDF |
| `security_level` | String | `LEVEL_2` (ký với CTS công cộng) |
| `info` | String | Thông tin cá nhân phục vụ NFC mobile |
| `type` | String | `Personal` / `Personal_company` |

**Response Body (JSON)**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `data.encrypted_data` | String | Thông tin mã hóa (nội dung QR) |
| `data.expired_at` | String | Timestamp hết hạn |
| `data.type` | String | Loại QR code |
| `data.url` | String | URL hệ thống |
| `data.session_id` | String | Mã định danh duy nhất cho QR code |

---

#### STEP 2 — Mobile nhận document từ Web

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/file/{{filename}}` |

**Response**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `Data` | Byte | Dữ liệu nhị phân của file cần ký |

---

#### STEP 3 — Gửi Biometric + Signature xác nhận ký

| | |
|---|---|
| **Endpoint** | `POST {{api-base-url}}/ca/api/sign/signature` |

*(Dùng chung endpoint với luồng ký cá nhân — STEP 2)*

---

#### STEP 4 — Download tài liệu đã ký

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/api/sign/download/{{doc-id}}` |

*(Dùng chung endpoint với luồng ký cá nhân — STEP 3)*

---

#### STEP 5 — Nhận Event qua Session ID

| | |
|---|---|
| **Endpoint** | `GET {{api-base-url}}/ca/apievent?session_id={session_id}` |

*(Tương tự STEP 5 của luồng đăng ký QR Code)*

---

## 4. TỔNG HỢP TẤT CẢ ENDPOINTS

| Method | Endpoint | Mô tả | Nhóm |
|---|---|---|---|
| `POST` | `/ca/api/eid-personal/challenge` | Lấy challenge (cá nhân) | CTS Cá nhân / QR |
| `POST` | `/ca/api/eid-personal/signature` | Gửi NFC + Selfie + Signature | CTS Cá nhân / QR |
| `POST` | `/ca/api/eid-personal/check` | Kiểm tra trạng thái CTS | CTS Cá nhân / QR |
| `POST` | `/ca/api/eid-company/challenge` | Lấy challenge (cá nhân TT) | CTS Cá nhân TT |
| `POST` | `/ca/api/eid-company/signature` | Gửi NFC + Selfie + Signature | CTS Cá nhân TT |
| `POST` | `/ca/api/eid-company/check` | Kiểm tra trạng thái CTS TT | CTS Cá nhân TT |
| `POST` | `/ca/api/sign/challenge` | Upload doc để ký (cá nhân) | Ký văn bản |
| `POST` | `/ca/api/sign/signature` | Xác nhận ký (cá nhân / QR) | Ký văn bản / QR |
| `GET` | `/ca/api/sign/download/{doc-id}` | Download file đã ký | Ký văn bản / QR |
| `GET` | `/ca/api/event/check-session` | Kiểm tra phiên ký | Ký văn bản |
| `POST` | `/ca/api/sign-company/challenge` | Upload doc để ký (cá nhân TT) | Ký văn bản TT |
| `POST` | `/ca/api/sign-company/signature` | Xác nhận ký (cá nhân TT) | Ký văn bản TT |
| `POST` | `/ca/api/qr/onboard` | Gen QR đăng ký CTS | QR |
| `POST` | `/ca/api/qr/sign` | Gen QR ký văn bản | QR |
| `GET` | `/ca/api/file/{filename}` | Mobile nhận document từ web | QR Ký |
| `GET` | `/ca/apievent?session_id=` | SSE event theo session QR | QR |

---
