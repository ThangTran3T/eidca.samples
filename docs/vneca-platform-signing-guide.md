# Hướng dẫn tích hợp VNeCA Platform

Tài liệu này được biên soạn từ collection [VNeCA Platform.postman_collection.json](VNeCA%20Platform.postman_collection.json). Collection mô tả API ký số tài liệu PDF/XML qua hai chế độ: **Local Agent** và **Server Agent**.

## 1. Chọn chế độ tích hợp

| Chế độ | Base URL mặc định trong collection | Đặc điểm | Khi nên dùng |
|---|---|---|---|
| Local Agent | `http://127.0.0.1:17889` | Gọi agent đang chạy trên máy người dùng; lệnh ký có thể hiển thị UI/PIN và trả về tệp đã ký ngay. | Ứng dụng desktop hoặc web có Local Agent cài trên máy ký. |
| Server Agent | `https://k8s.vneca.vn` | Tạo giao dịch ký, sau đó tra cứu trạng thái và tải tệp theo `transaction_id`. | Tích hợp luồng bất đồng bộ qua server. |

Luồng tổng quát:

```text
Local Agent:   gửi tài liệu → Local Agent/nguời dùng ký → nhận signed_file_base64

Server Agent:  gửi tài liệu → nhận transaction_id (WAITING_EVENT)
               → chờ quá trình ký hoàn tất → GET trạng thái (COMPLETED)
               → GET download để nhận tệp đã ký
```

## 2. Cấu hình biến

Khi import collection vào Postman, cấu hình các collection variable dưới đây. Không đưa CCCD thật, tệp Base64 thật hoặc thông tin chứng thư vào source code/log.

| Biến | Ý nghĩa | Giá trị mẫu |
|---|---|---|
| `local_url` | Địa chỉ Local Agent | `http://127.0.0.1:17889` |
| `server_url` | Địa chỉ Server Agent | `https://k8s.vneca.vn` |
| `file_base64_pdf` | Nội dung PDF mã hoá Base64 | `<base64-pdf>` |
| `file_base64_xml` | Nội dung XML mã hoá Base64 | `<base64-xml>` |
| `user_id` | CCCD của người ký | `<cccd-12-so>` |
| `id_number` | Theo mô tả collection: serial chứng thư khi dùng `APP_CA_REMOTE_SIGNING`; các ví dụ hiện dùng CCCD. | `<serial-chung-thu-hoac-cccd>` |
| `ca_name` | Tên Public CA khi dùng `APP_CA_REMOTE_SIGNING` | `<public-ca-name>` |
| `sign_props` | Thuộc tính hiển thị chữ ký PDF | JSON hoặc chuỗi JSON, tuỳ kiểu gửi |
| `signature_placement` | Vị trí chèn chữ ký XML | `first_child_of:/KHAMSUCKHOE/CHUKYDONVI/CKS_NGUOI_KET_LUAN` |

Collection không khai báo cơ chế xác thực hoặc header API key cho các endpoint trong tài liệu này. Nếu môi trường thực tế yêu cầu xác thực, lấy thông số đó từ đơn vị vận hành VNeCA.

## 3. Phương thức ký (`method_code`)

| Mã | Local Agent | Server Agent | Ghi chú trong collection |
|---|---:|---:|---|
| `USB_TOKEN` | Có | Có | Ký bằng USB Token |
| `CCCD_NFC` | Có | Có | Ký qua CCCD NFC |
| `VNEID` | Có | Có | Ký qua VNeID |
| `APP_CA_REMOTE_SIGNING` | Có | Có | Cần dùng thêm `id_number` và `ca_name` theo mô tả payload PDF |
| `SMART_CARD` | Có | Không được liệt kê | Chỉ được liệt kê trong payload Local Agent |

## 4. Local Agent

### 4.1 Kiểm tra Agent

```http
GET {{local_url}}/api/status
```

Collection không cung cấp ví dụ response. Hãy gọi endpoint này trước khi mở luồng ký để xác nhận Local Agent đang chạy và trình duyệt/ứng dụng kết nối được tới `127.0.0.1`.

### 4.2 Ký từ dữ liệu Base64

```http
POST {{local_url}}/api/sign-document
Content-Type: application/json
```

Ví dụ ký PDF:

```json
{
  "file_base64": "<base64-pdf>",
  "file_type": "pdf",
  "method_code": "SMART_CARD",
  "user_id": "<cccd-12-so>",
  "id_number": "<serial-chung-thu-hoac-cccd>",
  "ca_name": "<public-ca-name>",
  "sign_props": {
    "page": 1,
    "lLx": 47,
    "lLy": 693,
    "width": 167,
    "height": 95,
    "template": "text_only"
  }
}
```

Ví dụ ký XML:

```json
{
  "file_base64": "<base64-xml>",
  "file_type": "xml",
  "method_code": "SMART_CARD",
  "user_id": "<cccd-12-so>",
  "id_number": "<serial-chung-thu-hoac-cccd>",
  "signature_placement": "first_child_of:/KHAMSUCKHOE/CHUKYDONVI/CKS_NGUOI_KET_LUAN"
}
```

Theo mô tả request trong collection, Local Agent tự tạo hash, tạo giao dịch, hiển thị giao diện lấy PIN và chèn chữ ký trước khi trả kết quả.

Ví dụ response thành công (`200`):

```json
{
  "status": "SUCCESS",
  "transaction_id": "ist_...",
  "signed_file_id": "file_...",
  "signed_file_base64": "<base64-cua-tep-da-ky>"
}
```

Ví dụ khi người dùng hủy (`400`):

```json
{
  "status": "ERROR",
  "error_code": "USER_CANCELLED",
  "error_message": "Người dùng đã hủy tiến trình.",
  "final_result": null
}
```

### 4.3 Ký bằng tệp multipart/form-data

Vẫn dùng endpoint `POST {{local_url}}/api/sign-document`, nhưng gửi `multipart/form-data`.

| Trường | Kiểu | Áp dụng | Ghi chú |
|---|---|---|---|
| `file` | File | PDF, XML | Tệp cần ký |
| `file_type` | Text | PDF, XML | `pdf` hoặc `xml` |
| `method_code` | Text | PDF, XML | Xem các mã ký ở trên |
| `user_id` | Text | PDF, XML | CCCD người ký |
| `id_number` | Text | PDF, XML | Dùng cho `APP_CA_REMOTE_SIGNING` theo collection |
| `sign_props` | Text | PDF | Thuộc tính chữ ký PDF |
| `signature_placement` | Text | XML | Vị trí chèn chữ ký XML |

Response thành công/lỗi có cùng cấu trúc với cách gửi Base64.

### 4.4 Đăng ký chứng thư cá nhân

```http
POST {{local_url}}/api/register-personal-certificate
```

Collection dùng raw JSON cho payload này nhưng không khai báo header. Khi client gửi JSON, đặt `Content-Type: application/json`.

Payload mẫu trong collection:

```json
{
  "id_number": "<cccd-12-so>",
  "phone": "<so-dien-thoai>",
  "email": "<email>",
  "permanent_city": "<ma-tinh-thanh>",
  "permanent_district": "<quan-huyen>",
  "hand_sig_image_base64": "<base64-chu-ky-tay-hoac-rong>",
  "device": {
    "ip_address": "127.0.0.1",
    "machine_name": "<ten-may>",
    "machine_type": "WINDOWS_PC",
    "operating_system": "Windows",
    "version": "<phien-ban-agent>",
    "serial_device": "<serial-hoac-rong>"
  }
}
```

Collection không kèm response mẫu cho API này.

### 4.5 Lấy CCCD

```http
POST {{local_url}}/api/get_cccd
Content-Type: application/json
```

Collection không có body hoặc response mẫu; chỉ nên giả định endpoint lấy thông tin CCCD sau khi đã kiểm tra thông số với phía cung cấp.

## 5. Server Agent

### 5.1 Tạo giao dịch ký

Các endpoint tạo giao dịch dùng cùng đường dẫn:

```http
POST {{server_url}}/api/sign-document
```

Có thể gửi JSON/Base64 với `Content-Type: application/json`, hoặc gửi `multipart/form-data` với danh sách trường giống phần Local Agent. Khác biệt là Server Agent không liệt kê `SMART_CARD` trong `method_code`.

Ví dụ JSON ký PDF:

```json
{
  "file_base64": "<base64-pdf>",
  "file_type": "pdf",
  "method_code": "USB_TOKEN",
  "user_id": "<cccd-12-so>",
  "id_number": "<serial-chung-thu-hoac-cccd>",
  "ca_name": "<public-ca-name>",
  "sign_props": {
    "page": 1,
    "lLx": 47,
    "lLy": 693,
    "width": 167,
    "height": 95
  }
}
```

Response mẫu (`200`) cho thấy đây là bước khởi tạo bất đồng bộ:

```json
{
  "status": "SUCCESS",
  "code": "SUCCESS",
  "transaction_id": "tx_sa_...",
  "data": {
    "transaction_id": "tx_sa_...",
    "document_hash": "<sha-256-hex>",
    "status": "WAITING_EVENT",
    "client_instruction": null,
    "created_at": "2026-08-25T04:36:14.732Z"
  },
  "message": "Đã trích xuất Hash và khởi tạo giao dịch ký số thành công."
}
```

Lưu `transaction_id`; không giả định rằng `WAITING_EVENT` là tệp đã ký.

### 5.2 Theo dõi trạng thái

```http
GET {{server_url}}/api/v1/agent/documents/{{transaction_id}}/status
```

Collection có ví dụ giao dịch hoàn tất:

```json
{
  "code": "SUCCESS",
  "data": {
    "transaction_id": "tx_sa_...",
    "status": "COMPLETED",
    "signed_at": "2026-08-25T05:06:10.835Z",
    "download_url": "/api/v1/agent/documents/tx_sa_.../download",
    "signature_value": "<base64-signature>",
    "certificate_base64": "<base64-certificate>"
  }
}
```

Chỉ tải tệp khi `data.status` là `COMPLETED`. Collection không quy định chu kỳ polling hoặc danh sách đầy đủ các trạng thái, vì vậy cần thống nhất timeout, khoảng lặp và cách xử lý thất bại với VNeCA.

### 5.3 Tải tệp đã ký

```http
GET {{server_url}}/api/v1/agent/documents/{{transaction_id}}/download
```

Dùng chính `transaction_id` nhận từ bước khởi tạo. Collection không có response mẫu cho endpoint download; client cần xử lý response như dữ liệu tệp, đồng thời kiểm tra `Content-Type` và HTTP status thực tế.

### 5.4 Health check

```http
GET {{server_url}}/health
```

Collection không cung cấp schema response; dùng endpoint để kiểm tra khả dụng của service trước khi gọi luồng ký.

## 6. Thuộc tính chữ ký PDF (`sign_props`)

Collection chứa file mẫu [sign_props_template.json](sign_props_template.json). Các trường đáng chú ý là:

| Trường | Ý nghĩa |
|---|---|
| `page` | Trang đặt chữ ký, bắt đầu từ 1 |
| `lLx`, `lLy` | Toạ độ góc dưới trái của vùng chữ ký |
| `width`, `height` | Kích thước vùng chữ ký |
| `template` | Mẫu hiển thị, ví dụ `text_only` |
| `show_info` | Các thông tin hiển thị trong khung chữ ký |
| `location`, `reason`, `contact` | Nội dung ký hiển thị |
| `text_color`, `font_size` | Định dạng chữ |
| `sign_visibility` | Hiện/ẩn khung chữ ký |
| `watermark_img_b64`, `hand_sig_img_b64` | Ảnh watermark/chữ ký tay dạng Base64 |

Khi gửi JSON, `sign_props` là object JSON. Khi gửi multipart, collection khai báo trường này là `Text`; hãy serialize object thành chuỗi JSON và bảo đảm encoding chính xác.

## 7. Checklist triển khai

1. Cấu hình URL theo môi trường và thay toàn bộ dữ liệu mẫu bằng dữ liệu hợp lệ.
2. Kiểm tra Local Agent bằng `/api/status`, hoặc Server Agent bằng `/health`.
3. Chọn cách gửi Base64 hoặc `multipart/form-data`; đặt `file_type` khớp tệp.
4. Chọn `method_code` được hỗ trợ bởi chế độ đang dùng.
5. Với Local Agent, xử lý kết quả `SUCCESS` và `USER_CANCELLED`.
6. Với Server Agent, lưu `transaction_id`, polling endpoint status đến `COMPLETED`, rồi gọi download.
7. Không ghi `file_base64`, CCCD, chữ ký, certificate hoặc PIN vào log ứng dụng.

## 8. Điểm cần xác nhận với VNeCA

- Header/xác thực bắt buộc cho từng môi trường, vì collection không khai báo.
- Chu kỳ polling, timeout, toàn bộ trạng thái và error code của Server Agent.
- Kiểu dữ liệu `id_number` chính xác cho từng `method_code`, đặc biệt `APP_CA_REMOTE_SIGNING`.
- Kiểu response của `get_cccd`, `register-personal-certificate`, `/api/status`, `/health` và `/download` vì collection không kèm ví dụ đầy đủ.
