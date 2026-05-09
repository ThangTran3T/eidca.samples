# eIDCA — API Reference

> ⚠️ **Lưu ý:** Tài liệu này là placeholder mẫu. Vui lòng thay thế bằng tài liệu API chính thức từ eIDCA cung cấp cho đối tác.

## Base URL

| Môi trường | URL |
|-----------|-----|
| Sandbox   | `https://sandbox-api.eidca.vn/v1` |
| Production | `https://api.eidca.vn/v1` |

## Xác thực (Authentication)

Tất cả request cần header:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Lấy Access Token

```http
POST /auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&scope=sign register
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "sign register"
}
```

---

## Endpoints chính

### 1. Đăng ký chữ ký số

#### `POST /register/initiate`
Khởi tạo phiên đăng ký, nhận session để xác thực CCCD.

**Request:**
```json
{
  "citizen_id": "012345678901",
  "callback_url": "https://yourapp.com/callback/register"
}
```

**Response:**
```json
{
  "session_id": "sess_abc123",
  "expires_at": "2026-05-07T14:00:00Z",
  "qr_code_url": "https://sandbox-api.eidca.vn/qr/sess_abc123"
}
```

#### `POST /register/confirm`
Xác nhận đăng ký sau khi CCCD đã được xác thực.

**Request:**
```json
{
  "session_id": "sess_abc123",
  "cccd_data": "<encrypted_chip_data>",
  "pin": "<hashed_pin>"
}
```

**Response:**
```json
{
  "certificate_id": "cert_xyz789",
  "status": "active",
  "valid_from": "2026-05-07T00:00:00Z",
  "valid_to": "2029-05-07T00:00:00Z"
}
```

---

### 2. Ký số tài liệu

#### `POST /sign/prepare`
Chuẩn bị phiên ký, upload hash tài liệu cần ký.

**Request:**
```json
{
  "certificate_id": "cert_xyz789",
  "document_hash": "sha256:abcdef1234567890...",
  "document_name": "hop_dong_001.pdf",
  "signing_reason": "Ký hợp đồng điện tử",
  "signing_location": "Hà Nội, Việt Nam"
}
```

**Response:**
```json
{
  "signing_session_id": "sign_sess_456",
  "expires_at": "2026-05-07T13:35:00Z",
  "challenge": "random_challenge_string"
}
```

#### `POST /sign/confirm`
Xác nhận ký số sau khi người dùng xác thực.

**Request:**
```json
{
  "signing_session_id": "sign_sess_456",
  "cccd_auth_data": "<encrypted_auth_data>",
  "pin_hash": "<hashed_pin>"
}
```

**Response:**
```json
{
  "signature": "base64_encoded_signature...",
  "timestamp": "2026-05-07T13:30:15Z",
  "certificate_chain": ["cert_pem_1", "cert_pem_2"],
  "ltv_data": "<LTV_data_for_long_term_validation>"
}
```

---

### 3. Kiểm tra trạng thái Certificate

#### `GET /certificate/{certificate_id}/status`

**Response:**
```json
{
  "certificate_id": "cert_xyz789",
  "status": "active",
  "citizen_id": "012345678901",
  "valid_from": "2026-05-07T00:00:00Z",
  "valid_to": "2029-05-07T00:00:00Z"
}
```

---

## Mã lỗi (Error Codes)

| Code | HTTP Status | Mô tả |
|------|------------|-------|
| `AUTH_001` | 401 | Token không hợp lệ hoặc hết hạn |
| `AUTH_002` | 403 | Không có quyền truy cập |
| `REG_001` | 400 | CCCD không hợp lệ |
| `REG_002` | 409 | Công dân đã đăng ký chữ ký số |
| `SIGN_001` | 400 | Hash tài liệu không hợp lệ |
| `SIGN_002` | 410 | Phiên ký đã hết hạn |
| `SIGN_003` | 401 | Xác thực PIN thất bại |
| `CERT_001` | 404 | Certificate không tồn tại |
| `CERT_002` | 403 | Certificate đã bị thu hồi (revoked) |

---

## Webhook Events

eIDCA gửi webhook đến `callback_url` của bạn khi có sự kiện:

```json
{
  "event": "register.completed",
  "timestamp": "2026-05-07T13:30:15Z",
  "data": {
    "session_id": "sess_abc123",
    "certificate_id": "cert_xyz789",
    "status": "active"
  }
}
```

| Event | Mô tả |
|-------|-------|
| `register.completed` | Đăng ký chữ ký số thành công |
| `register.failed` | Đăng ký thất bại |
| `sign.completed` | Ký số hoàn thành |
| `sign.failed` | Ký số thất bại |
| `certificate.revoked` | Certificate bị thu hồi |
