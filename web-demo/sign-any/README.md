# VNeCA · Universal Broker (provider = ANY) — PHP Demo

Demo PHP thuần mô phỏng **đầy đủ** luồng ký số *Universal Broker* với `provider = ANY` theo
collection `universal-broker.postman_collection.json`. Không cần Node.js, Composer, database
hay tiến trình chạy nền; chỉ cần một hosting PHP 8.1+.

## Điểm khác biệt của flow `provider = ANY`

| Flow thường | Flow `provider = ANY` |
| --- | --- |
| 1.1 tạo giao dịch kèm `method_code` cụ thể | 1.1 tạo giao dịch **không** có `method_code` |
| Client biết trước CA | Nền tảng không biết trước CA |
| Không có bước trung gian | Trả `client_instruction.type = REDIRECT_BROKER` |
| — | Người ký tự chọn CA trên portal `/broker` (2.2) |
| — | Nền tảng resume bước `broker_selection` rồi chạy phiên ký |

Luồng demo:

```text
0.1  POST /v1/auth/oauth/token                                      → access_token
1.1  POST /v1/integration/signing-transactions                      → CLIENT_ACTION_REQUIRED
                                                                    + REDIRECT_BROKER (broker_url, resume_token)
1.2  GET  /v1/integration/signing-transactions/{id}                 → xác nhận đang chờ người ký
2.1  POST /v1/broker/sessions                                       → session_token + danh sách CA
2.2  POST /v1/broker/sessions/{session_id}:resume                   → METHOD_SELECTED, chạy phiên provider
3.2  GET  /v1/integration/signing-transactions/{id}                 → WAITING_CLIENT → COMPLETED
```

Nhánh phụ:

- `2.3 POST /v1/broker/sessions/{session_id}:revoke` — người dùng rời portal trước khi chọn CA.
- `3.1 POST /v1/integration/signing-transactions/{id}/client-steps/broker_selection:resume`
  — đường S2S dùng `resume_token` **một lần** (gửi lần hai trả `409 RESUME_TOKEN_USED`).

## Yêu cầu hosting

- PHP 8.1 trở lên (dùng `readonly` property, `never`, `match`).
- Thư mục `runtime/` ghi được (lưu `store.json`).
- Mode `live` cần thêm extension `curl`.
- Không cần Composer hay autoloader; toàn bộ `src/` được `require_once` thủ công.

Kiểm tra môi trường sau khi upload:

```text
https://example.vn/sign-any/api/health.php
```

`status` phải là `UP` và `runtime_store.writable` phải là `true`.

## Cài trên shared hosting/cPanel

1. Upload toàn bộ thư mục `web-demo/sign-any` vào ví dụ `public_html/sign-any`.
2. Giữ nguyên `.htaccess`, `.user.ini` và các thư mục `api`, `assets`, `runtime`, `src`.
3. Đảm bảo PHP của domain là 8.1 trở lên và `runtime/` có quyền ghi (755 hoặc 775).
4. Mở `https://example.vn/sign-any/`.

Frontend dùng URL tương đối nên chạy được cả ở domain riêng và thư mục con.

## Cấu hình `config.php`

```php
return [
    'mode' => 'mock',                       // 'mock' | 'live'
    'platform_url' => 'https://api.vneca.vn',
    'runtime_dir' => __DIR__ . '/runtime',
    'broker_page_base' => 'https://portal.vneca.vn/broker',
    'provider_page_base' => 'https://ca.vneca.vn/redirect',
    'flow_declares_business_category' => true,
    'flow_business_category' => 'medical_record',
    'mock_complete_seconds' => 6,
    'mock_providers' => [ /* ... */ ],
];
```

- `mode = mock` (mặc định): `MockPlatform` giả lập đúng contract ngay trong PHP, **không gọi mạng**,
  không cần credential thật — dùng để học luồng và thử lỗi.
- `mode = live`: `HttpPlatform` chuyển tiếp nguyên request tới `platform_url` qua cURL
  (`Authorization` là credential thật của bạn).

`defaults` là giá trị điền sẵn cho form demo: **mỗi `data-field` trong `index.php` phải có khóa
cùng tên** trong `config.php > defaults`. Lệch tên (ví dụ `document_hash_base64`) thì ô đó bị để
trống và 1.1 trả `400 DOCUMENT_HASH_REQUIRED`.

Sau khi chạy flow ở `mode = mock`, bạn có thể đặt `mode = live` và dùng lại đúng màn hình đó
để gọi API Gateway thật; UI không cần đổi gì.

## Thử các tình huống lỗi

| Muốn thấy | Cách làm |
| --- | --- |
| `400 METHOD_NOT_ALLOWED_FOR_ANY` | Nhập `method_code` ở mục 01 rồi chạy 1.1 |
| `400 BUSINESS_CATEGORY_MISMATCH` | Đổi `business_category` khác `flow_business_category` |
| `409 DOCUMENT_HASH_MISMATCH` | Chạy 1.1, đổi `document_hash`, chạy 1.1 lại với cùng `idempotency_key` |
| idempotent replay | Chạy 1.1 hai lần với cùng `idempotency_key` và cùng digest (`replayed = true`) |
| `409 BROKER_SESSION_ALREADY_ISSUED` | Chạy 2.1, đổi `device_fingerprint`, chạy 2.1 lại |
| `401 DEVICE_MISMATCH` | Chạy 2.1, đổi `device_fingerprint`, chạy 2.2 |
| `401 BROKER_SESSION_REVOKED` | Chạy 2.3 rồi chạy lại 2.2 với cùng phiên |
| `409 RESUME_TOKEN_USED` | Chạy 3.1 hai lần với cùng `resume_token` |
| `providers` rỗng | Đặt `'mock_providers' => []` trong `config.php` rồi chạy 2.1 |
| `400 DOCUMENT_HASH_REQUIRED` | Ô `document_hash` bị để trống (khi mở trang, `fillForm()` tự điền từ `config.php > defaults`) |
| `409 BROKER_NOT_WAITING` khi bấm Auto-run lần hai | `idempotency_key` cũ vẫn trỏ về giao dịch đã chạy xong: đổi `idempotency_key`, hoặc xoá `runtime/store.json` để chạy lại từ đầu |

## Kiến trúc

```text
index.php            UI demo (flow diagram, form tham số, portal /broker mô phỏng, nhật ký HTTP)
api/bff.php          Front controller: action → request nền tảng; trả lại cả REQUEST + RESPONSE
api/health.php       Kiểm tra PHP, mode, ext-curl, quyền ghi runtime/
src/Platform.php     Interface: send(method, path, body, headers) → [http_status, body]
src/MockPlatform.php Giả lập contract nền tảng (state machine, không gọi mạng)
src/HttpPlatform.php Gọi API Gateway thật bằng cURL (mode = live)
src/Store.php        Lưu state giả lập vào runtime/store.json với flock
src/bootstrap.php    app_config() / app_platform() / app_defaults()
assets/app.js        Bộ điều khiển luồng (module ES, fetch api/bff.php)
assets/styles.css    Giao diện
```

`runtime/store.json` là **state giả lập** (giao dịch, phiên broker, token) và bị `.htaccess` chặn
truy cập qua web. Xoá file này để reset toàn bộ state, hoặc bấm **Xoá nhật ký & state** trên UI.

## API của BFF

`POST api/bff.php` với JSON:

```json
{ "action": "get", "access_token": "...", "transaction_id": "ist_..." }
```

Các `action`: `token`, `create`, `get`, `broker_open`, `broker_resume`, `broker_revoke`,
`client_step_resume`.

Kết quả luôn có dạng:

```json
{
  "success": true,
  "step": "1.1 Tạo giao dịch (provider = ANY)",
  "mode": "mock",
  "request":  { "method": "POST", "url": "...", "path": "...", "headers": { }, "body": { } },
  "response": { "http_status": 200, "body": { "success": true, "data": { } } },
  "duration_ms": 3,
  "derived":  { "transaction_id": "ist_...", "broker_url": "...", "resume_token": "..." }
}
```

`derived` chứa đúng những biến mà test-script trong collection Postman trích ra
(`transaction_id`, `broker_url`, `broker_challenge`, `session_id`, `session_token`, `providers`, ...).
Giá trị nhạy cảm (`client_secret`, `access_token`, `session_token`) được che khi hiển thị trong
`request`, nhưng vẫn còn nguyên trong `derived` để UI dùng cho bước tiếp theo.

Hai token dễ lẫn nhau:

- `derived.broker_challenge` — `resume_token` **nằm trong `broker_url`**, dùng để mở portal
  `/broker` ở bước 2.1; trình lại được (không tiêu hao).
- `derived.resume_token` — token **dùng MỘT lần** của đường S2S ở bước 3.1.

Mỗi lần đọc lại giao dịch (1.1 tạo/gửi lại, 1.2 GET) nền tảng phát **challenge mới** cho giao dịch
còn ở bước broker. Vì vậy client luôn phải dùng `broker_challenge` của **response gần nhất** trước
khi gọi 2.1 (UI làm việc này tự động; challenge cũ sẽ trả `404 RESUME_TOKEN_NOT_FOUND`).

## Trạng thái giao dịch

`MockPlatform` mô phỏng vòng đời sau khi người ký chọn CA (mặc định 6 giây, chỉnh bằng
`mock_complete_seconds`):

```text
CLIENT_ACTION_REQUIRED  (chưa ai mở portal, còn REDIRECT_BROKER)
      │ 2.1 mở phiên + 2.2 chọn CA
      ▼
RUNNING → WAITING_CLIENT (METHOD_SELECTED) → COMPLETED
```

`client_instruction.type = REDIRECT_BROKER` **chỉ** được trả về khi giao dịch còn ở bước broker.
Sau khi phiên provider bắt đầu, `client_instruction` là `null` và bước chuyển sang `COMPLETED`.

## Xử lý sự cố

- `DEGRADED` ở `api/health.php`: mode `live` nhưng thiếu ext-curl.
- `runtime_store.writable = false`: cấp quyền ghi cho thư mục `runtime/`.
- HTTP 500 ngay khi mở trang: hosting có thể không cho `Options -Indexes`; xoá riêng dòng đó trong `.htaccess`.
- `runtime/` trả 403 khi mở trực tiếp: đúng như thiết kế (chặn bằng `.htaccess`).
- `UPSTREAM_UNREACHABLE` khi mode `live`: kiểm tra `platform_url` và kết nối ra Internet của hosting.

## Kiểm tra nhanh bằng CLI

```bash
php -l index.php
php -l api/bff.php
php -l src/MockPlatform.php
```

Hoặc chạy server nội bộ khi có PHP:

```bash
php -S localhost:8080 -t .
# rồi mở http://localhost:8080/
```

## Ghi chú phạm vi

- Demo này **không** ký tài liệu thật: `MockPlatform` chỉ mô phỏng hợp đồng API và vòng đời trạng thái.
- Không validate chứng thư, OCSP/CRL hay timestamp — đây là demo tích hợp, không thay thế
  môi trường kiểm thử chính thức của nền tảng.
