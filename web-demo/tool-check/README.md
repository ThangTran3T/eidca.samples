# VNeCA Tool Check

Tool Node.js kiểm tra tính toàn vẹn chữ ký số trong file XML và PDF. Backend cung cấp API nhận file multipart hoặc Base64; frontend cho phép kéo thả/upload file và hiển thị kết quả.

## Chạy local

Yêu cầu Node.js 20 trở lên.

```bash
cd sdk/tool-check
npm install
copy .env.example .env
npm start
```

Mở `http://127.0.0.1:17990`. Các biến cấu hình:

- `HOST`: địa chỉ bind, mặc định `127.0.0.1`.
- `PORT`: cổng HTTP, mặc định `17990`.
- `MAX_FILE_SIZE_MB`: dung lượng file tối đa, mặc định `50`.
- `CORS_ORIGIN`: `*` hoặc danh sách origin cách nhau bởi dấu phẩy.

## API

### Upload multipart/form-data

```bash
curl -X POST http://127.0.0.1:17990/api/verify \
  -F "file=@samples/bkavca-tenant/signed_xml-test.xml"
```

Field file phải có tên `file`.

### Gửi file_base64

```http
POST /api/verify
Content-Type: application/json

{
  "file_base64": "JVBERi0xLjQK...",
  "file_name": "document.pdf"
}
```

`file_name` không bắt buộc nhưng nên truyền để kết quả có đúng tên file. API cũng chấp nhận Base64 data URL.

### Kết quả

HTTP 200 được trả về khi quá trình kiểm tra hoàn tất, kể cả khi chữ ký không hợp lệ. Trạng thái nghiệp vụ nằm tại `verification.status`:

- `VALID`: chữ ký mật mã và nội dung được tham chiếu hợp lệ.
- `VALID_WITH_WARNINGS`: chữ ký hợp lệ nhưng có cảnh báo về chứng thư.
- `INVALID`: chữ ký hoặc nội dung đã ký không hợp lệ.
- `UNSIGNED`: không tìm thấy chữ ký được hỗ trợ.

Kết quả gồm SHA-256 của file, số chữ ký, thuật toán, `ByteRange`/reference, thông tin chứng thư và cảnh báo. Ví dụ rút gọn:

```json
{
  "success": true,
  "file": {
    "name": "document.pdf",
    "type": "PDF",
    "sha256": "..."
  },
  "verification": {
    "status": "VALID",
    "valid": true,
    "integrity_valid": true,
    "signature_count": 1,
    "signatures": []
  }
}
```

Các endpoint bổ sung:

- `GET /health`: health check.
- `GET /api/info`: mô tả input và giới hạn API.

## Phạm vi kiểm tra

- XML: XMLDSig enveloped/detached same-document, digest của reference và `SignatureValue`, gồm tương thích Inclusive C14N do .NET tạo.
- PDF: `/ByteRange`, CMS/PKCS#7 detached signature, các revision tăng dần và chứng thư nhúng trong CMS.
- Không tải external reference trong XML.
- Hiện chưa xây dựng trust store, chưa kiểm tra chuỗi CA, OCSP, CRL hoặc tính hợp lệ của timestamp token. Các mục này được trả về là `NOT_EVALUATED`; vì vậy tool không thay thế dịch vụ xác thực chữ ký có giá trị pháp lý.

## Test

```bash
npm test
```

Test tích hợp bao phủ frontend/health, multipart PDF, Base64 XML, file PDF bị thay đổi và JSON lỗi khi thiếu file.
