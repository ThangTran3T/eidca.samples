# eIDCA — API Reference (JSON Payload)
> **Version:** 1.0.7 | **Ngày:** 20/03/2026 | **Phân loại:** Confidential

Tài liệu này chuẩn hóa các endpoint, tham số request và response thành định dạng JSON dựa trên file `api-reference.md`.

---

## 📋 Common Headers

Áp dụng cho tất cả các API nếu không có yêu cầu đặc biệt:

```json
{
  "Content-Type": "application/json",
  "Accept": "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "x-api-key": "{APIKey value}"
}
```

---

## 1. CHỨNG THƯ SỐ CÁ NHÂN

### 1.1. Lấy Challenge Đăng Ký CTS
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-personal/challenge`

**Request Payload:**
```json
{
  "code": "string",
  "id_number": "string"
}
```

**Response Payload:**
```json
{
  "success": true,
  "error": {
    "code": "string",
    "message": "string"
  },
  "data": {
    "transaction_code": "string",
    "challenge": "string",
    "token_challenge": "string"
  }
}
```

### 1.2. Gửi Signature, Biometric & Thông tin đăng ký
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-personal/signature`

**Request Payload:**
```json
{
  "code": "string",
  "transaction_code": "string",
  "token_challenge": "string",
  "raw_data": {
    "sod": "string (Base64)",
    "dg1": "string (Base64)",
    "dg2": "string (Base64)",
    "dg13": "string (Base64)",
    "dg15": "string (Base64)"
  },
  "info": {
    "ip_address": "string (IPv4)",
    "hand_sig_image_base64": "string (Base64)",
    "machine_name": "string",
    "machine_type": "string",
    "operating_system": "string",
    "version": "string",
    "serial_device": "string",
    "permanent_city": "string",
    "permanent_district": "string",
    "phone": "string",
    "email": "string",
    "image": "string (Base64)"
  },
  "signature": "string"
}
```

**Response Payload:**
```json
{
  "success": true,
  "data": {
    "transaction_code": "string",
    "status": "processing | completed | failed",
    "interval": "string",
    "expired_at": "string",
    "token_signature": "string"
  }
}
```

### 1.3. Kiểm Tra Trạng Thái Cấp CTS
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-personal/check`

**Request Payload:**
```json
{
  "code": "string",
  "transaction_code": "string",
  "token_signature": "string"
}
```

**Response Payload:**
```json
{
  "data": {
    "status": "processing | completed | failed",
    "cert_info": {
      "serial_number": "string",
      "id_number": "string",
      "full_name": "string",
      "phone": "string",
      "email": "string",
      "cert": "string",
      "date_issue": "string",
      "date_expire": "string"
    }
  }
}
```

---

## 2. KÝ VĂN BẢN (CÁ NHÂN)

### 2.1. Upload Document Lấy Challenge
- **Method:** `POST`
- **Endpoint:** `/ca/api/sign/challenge`
- **Content-Type:** `multipart/form-data`
- **Header Bổ Sung:** `code: {mã partner}`

**Request Payload (Form-Data):**
```json
{
  "documents": "File (PDF, max 10MB)",
  "id_number": "string",
  "expire_at": "string (Optional)",
  "doc_name": "string (Optional)",
  "session_timeout": "string (Optional)",
  "security_level": "LEVEL_2",
  "sign_props": "[{\"page\":1,\"lLx\":65,\"lLy\":320,\"width\":260,\"height\":90,\"template\":\"right\",\"show_info\":[\"reason\",\"location\",\"contact\",\"name\",\"org\",\"date\"],\"location\":\"HCM city\",\"location_label\":\"Tại: Phòng giao dịch\",\"reason\":\"Ký test\",\"reason_label\":\"\",\"contact\":\"Giám đốc\",\"contact_label\":\"Email: eidca.vn@gmail.com\",\"date_label\":\"Ngày ký\",\"text_color\":\"#0000ff\",\"font_size\":11,\"sign_visibility\":\"shown\",\"watermark_pos\":\"center\",\"watermark_img_b64\":\"\",\"hand_sig_img_b64\":\"\"}]"
}
```

**Response Payload:**
```json
{
  "data": {
    "transaction_code": "string",
    "token_sign": "string",
    "docs": [
      {
        "doc_id": "string",
        "doc_name": "string",
        "doc_type": "string",
        "doc_challenge": "string"
      }
    ]
  }
}
```

### 2.2. Xác Nhận Ký (Signature & Biometric)
- **Method:** `POST`
- **Endpoint:** `/ca/api/sign/signature`

**Request Payload:**
```json
{
  "code": "string",
  "transaction_code": "string",
  "token_sign": "string",
  "info": {
    "image": "string (Base64)"
  },
  "doc_signs": [
    {
      "doc_id": "string",
      "signature": "string"
    }
  ]
}
```

**Response Payload:**
```json
{
  "data": {
    "status": "signing | completed | failed",
    "token": "string",
    "interval": "string",
    "expired_at": "string",
    "signed_docs": [
      {
        "doc_id": "string",
        "doc_name": "string",
        "ca_signature": "string",
        "sign_at": "string",
        "expire_at": "string",
        "doc_hash": "string (Base64)"
      }
    ]
  }
}
```

### 2.3. Download Tài Liệu Đã Ký
- **Method:** `GET`
- **Endpoint:** `/ca/api/sign/download/{doc-id}`
- **Header Bổ Sung:** `x-api-key`, `code`, `transaction-code`, `token-sign`, `os-type` (Optional)

**Response Payload:**
```json
// Binary data của file đã ký
```

### 2.4. Kiểm Tra Phiên Ký
- **Method:** `GET`
- **Endpoint:** `/ca/api/event/check-session`
- **Header Bổ Sung:** `x-api-key`, `code`, `transaction-code`, `token-sign`, `os-type` (Optional)

**Response Payload:**
```json
{
  "data": {
    "remaining_time": "Date string"
  }
}
```

---

## 3. CHỨNG THƯ SỐ CÁ NHÂN THUỘC TỔ CHỨC

### 3.1. Lấy Challenge Đăng Ký CTS Tổ Chức
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-company/challenge`

**Request Payload:**
```json
{
  "code": "string",
  "id_number": "string",
  "company_id": 123
}
```

**Response Payload:**
```json
{
  "data": {
    "transaction_code": "string",
    "token_challenge": "string"
  }
}
```

### 3.2. Gửi Signature Đăng Ký CTS Tổ Chức
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-company/signature`

**Request Payload:**
```json
{
  "code": "string",
  "transaction_code": "string",
  "token_challenge": "string",
  "raw_data": {
    "sod": "string (Base64)",
    "dg1": "string (Base64)",
    "dg2": "string (Base64)",
    "dg13": "string (Base64)",
    "dg15": "string (Base64)"
  },
  "info": {
    "phone": "string",
    "email": "string",
    "image": "string (Base64)"
  },
  "signature": "string"
}
```

**Response Payload:**
```json
{
  "success": true,
  "data": {
    "transaction_code": "string",
    "status": "processing | completed | failed",
    "interval": "string",
    "expired_at": "string",
    "token_signature": "string"
  }
}
```

### 3.3. Kiểm Tra Trạng Thái Cấp CTS Tổ Chức
- **Method:** `POST`
- **Endpoint:** `/ca/api/eid-company/check`
*(Sử dụng Request/Response Payload giống `1.3`)*

---

## 4. KÝ VĂN BẢN (CÁ NHÂN THUỘC TỔ CHỨC)

### 4.1. Upload Document Lấy Challenge
- **Method:** `POST`
- **Endpoint:** `/ca/api/sign-company/challenge`
- **Content-Type:** `multipart/form-data`

**Request Payload (Form-Data):**
```json
{
  "documents": "File",
  "company_id": "string",
  "id_number": "string",
  "security_level": "LEVEL_2",
  "sign_props": "string (JSON Array)"
}
```

**Response Payload:**
```json
{
  "data": {
    "transaction_code": "string",
    "token_sign": "string",
    "docs": [
      {
        "doc_id": "string",
        "doc_name": "string",
        "doc_type": "string",
        "challenge": "string"
      }
    ]
  }
}
```

### 4.2. Xác Nhận Ký Văn Bản Tổ Chức
- **Method:** `POST`
- **Endpoint:** `/ca/api/sign-company/signature`
*(Sử dụng Request/Response Payload giống `2.2`)*

---

## 5. QR CODE

### 5.1. Generate QR Đăng Ký
- **Method:** `POST`
- **Endpoint:** `/ca/api/qr/onboard`

**Request Payload:**
```json
{
  "id_number": "string",
  "full_name": "string",
  "date_of_birth": "string (Date)",
  "date_of_issue": "string (Date)",
  "code": "string",
  "type": "Personal | Personal_company"
}
```

**Response Payload:**
```json
{
  "data": {
    "encrypted_data": "string",
    "expired_at": "string",
    "type": "string",
    "url": "string",
    "session_id": "string"
  }
}
```

### 5.2. Generate QR Ký Văn Bản
- **Method:** `POST`
- **Endpoint:** `/ca/api/qr/sign`
- **Content-Type:** `multipart/form-data`

**Request Payload (Form-Data):**
```json
{
  "documents": "File (PNG/JPG/XML/PDF/DOC, max 100MB)",
  "code": "string",
  "sign_props": "string (JSON Array)",
  "security_level": "LEVEL_2",
  "info": "string",
  "type": "Personal | Personal_company"
}
```

**Response Payload:**
```json
{
  "data": {
    "encrypted_data": "string",
    "expired_at": "string",
    "type": "string",
    "url": "string",
    "session_id": "string"
  }
}
```

### 5.3. Nhận File Từ Web Sang Mobile
- **Method:** `GET`
- **Endpoint:** `/ca/api/file/{filename}`
- **Header Bổ Sung:** `x-api-key`

**Response Payload:**
```json
// Binary data của file
```

### 5.4. Lắng Nghe Event (SSE)
- **Method:** `GET`
- **Endpoint:** `/ca/apievent?session_id={session_id}`
- **Header Bổ Sung:** `x-api-key`

**Response Payload (Event Data):**
```json
{
  "data": {
    "ca_status": "string",
    "result": "string",
    "transaction_code": "string",
    "token_sign": "string",
    "cert": "string",
    "doc_ids": "string"
  }
}
```
