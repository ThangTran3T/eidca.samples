# VNeCA Tool Check PHP

Bản PHP thuần để kiểm tra chữ ký số XML và PDF trên Apache/shared hosting. Không cần Node.js, Composer, database hoặc tiến trình chạy nền.

## Yêu cầu hosting

- PHP 8.1 trở lên.
- Extension `dom`/`libxml` và `openssl`.
- Cho phép upload file và đọc `php://input`.
- Khuyến nghị `memory_limit` tối thiểu 256 MB nếu kiểm tra file 50 MB.

Kiểm tra môi trường sau khi upload:

```text
https://example.vn/tool-check/api/health.php
```

`status` phải là `UP`, đồng thời `dom` và `openssl` phải là `true`.

## Cài trên shared hosting/cPanel

1. Upload toàn bộ thư mục `sdk/tool-check-php` vào ví dụ `public_html/tool-check`.
2. Giữ nguyên `.htaccess`, `.user.ini`, các thư mục `api`, `assets`, `src`.
3. Đảm bảo PHP của domain đang là 8.1 trở lên.
4. Mở `https://example.vn/tool-check/`.

Frontend dùng URL tương đối nên chạy được cả ở domain riêng và thư mục con. Không cần cấu hình reverse proxy.

Nếu hosting không đọc `.user.ini`, đặt các giá trị sau trong PHP Selector/MultiPHP INI Editor:

```ini
upload_max_filesize=50M
post_max_size=75M
memory_limit=256M
max_execution_time=120
max_input_time=120
```

`post_max_size` phải lớn hơn `upload_max_filesize`; request JSON Base64 lớn hơn file gốc khoảng 33%.

## Cấu hình

Sửa `config.php`:

```php
return [
    'max_file_size_mb' => 50,
    'cors_origin' => '*',
];
```

Có thể đặt `cors_origin` thành một domain hoặc danh sách cách nhau bằng dấu phẩy. Nếu frontend và API cùng domain thì nên đặt đúng origin, ví dụ `https://check.example.vn`.

## API

### multipart/form-data

```bash
curl -X POST https://example.vn/tool-check/api/verify.php \
  -F "file=@signed_document.xml"
```

### JSON Base64

```http
POST /tool-check/api/verify.php
Content-Type: application/json

{
  "file_base64": "JVBERi0xLjQK...",
  "file_name": "document.pdf"
}
```

API cũng nhận `file_base64` bằng form field và chấp nhận Base64 data URL. HTTP 200 nghĩa là quá trình kiểm tra đã hoàn thành; kết quả chữ ký đọc tại:

```json
{
  "success": true,
  "verification": {
    "status": "VALID",
    "valid": true,
    "integrity_valid": true,
    "signature_count": 1
  }
}
```

Các trạng thái:

- `VALID`: chữ ký và nội dung được tham chiếu hợp lệ.
- `VALID_WITH_WARNINGS`: chữ ký hợp lệ nhưng chứng thư có cảnh báo.
- `INVALID`: chữ ký hoặc nội dung đã ký không hợp lệ.
- `UNSIGNED`: không tìm thấy chữ ký hỗ trợ.

Endpoint bổ sung:

- `GET api/health.php`: kiểm tra PHP và extension.
- `GET api/info.php`: thông tin input và giới hạn API.

## Phạm vi xác minh

- XML: RSA-SHA1/SHA256/SHA384/SHA512, SHA-1/256/384/512, Inclusive/Exclusive C14N, enveloped signature và reference cùng tài liệu.
- PDF: `/ByteRange`, CMS/PKCS#7 detached signature, `messageDigest`, nhiều revision và chứng thư nhúng.
- XPath transform chỉ hỗ trợ biểu thức đơn giản dùng để loại `Signature` khỏi node-set.
- Không tải external reference của XML.
- Không đánh giá trust chain CA, OCSP, CRL hoặc tính hợp lệ timestamp token. Các phần này trả về `NOT_EVALUATED`; tool không thay thế dịch vụ xác thực có giá trị pháp lý.

## Xử lý sự cố

- `DEGRADED`: bật extension PHP `dom` và `openssl`.
- HTTP 413 hoặc request rỗng: tăng `upload_max_filesize`, `post_max_size` và giới hạn request của Apache/WAF.
- HTTP 500 ngay khi mở trang: hosting có thể không cho dùng `Options -Indexes`; xóa riêng dòng đó trong `.htaccess`.
- File lớn gây hết bộ nhớ: tăng `memory_limit` hoặc giảm `max_file_size_mb` trong `config.php`.

## Chạy test bằng PHP CLI

```bash
php tests/run.php
```

Test dùng các file mẫu của repository để kiểm tra XML hợp lệ, PDF hợp lệ và PDF bị thay đổi.
