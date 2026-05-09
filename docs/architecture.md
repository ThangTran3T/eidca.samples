# eIDCA — Kiến trúc tổng quan

## Tổng quan hệ thống

eIDCA (Electronic Identity Certificate Authority) là giải pháp **Ký số từ xa** cho phép:
- Đăng ký chữ ký số cá nhân dựa trên thẻ Căn cước công dân (CCCD) gắn chip.
- Ký số tài liệu điện tử từ xa mà không cần USB Token.

## Sơ đồ kiến trúc tổng quát

```
┌─────────────────────────────────────────────────────────────┐
│                     ỨNG DỤNG ĐỐI TÁC                        │
│   ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│   │ Web App  │   │  Windows App │   │  Mobile App      │    │
│   │(Browser) │   │  (.NET/WPF)  │   │  (iOS/Android)   │    │
│   └────┬─────┘   └──────┬───────┘   └────────┬─────────┘    │
└────────│────────────────│────────────────────│─────────────┘
         │                │                    │
         ▼                ▼                    ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│  SocketIO       │  │ SocketIO     │  │  NFC (CCCD chip)│
│  (3TE4/HN212)   │  │ hoặc C# SDK  │  │  iOS/Android SDK│
└────────┬────────┘  └──────┬───────┘  └────────┬────────┘
         │                  │                   │
         └──────────────────┴───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   eIDCA API Gateway   │
                │  (HTTPS / REST API)   │
                └───────────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │ Identity │  │ Signing  │  │  Certificate │
       │ Service  │  │ Service  │  │  Authority   │
       └──────────┘  └──────────┘  └──────────────┘
```

## Luồng nghiệp vụ chính

### 1. Đăng ký chữ ký số (Registration Flow)
```
Người dùng → Ứng dụng → Đọc CCCD chip (NFC/Đầu đọc)
           → eIDCA API: POST /register
           → Xác thực danh tính (CCCD data)
           → Tạo cặp khóa (HSM)
           → Cấp Certificate
           → Lưu trữ bảo mật
```

### 2. Ký số tài liệu (Signing Flow)
```
Người dùng → Ứng dụng → Chọn tài liệu cần ký
           → eIDCA API: POST /sign/prepare → nhận signing_session_id
           → Xác thực người dùng (PIN/Biometric + CCCD)
           → eIDCA API: POST /sign/confirm → nhận signed_document
           → Lưu/Hiển thị tài liệu đã ký
```

## Các thành phần kỹ thuật

| Thành phần | Mô tả |
|-----------|-------|
| **eIDCA API** | REST API chuẩn HTTPS, xác thực OAuth2/JWT |
| **SocketIO Bridge** | Dịch vụ cầu nối đầu đọc thẻ vật lý ↔ ứng dụng web/win |
| **NFC SDK** | Thư viện đọc CCCD chip trên iOS/Android |
| **HSM** | Hardware Security Module lưu trữ khóa ký an toàn |

## Bảo mật

- Tất cả API call dùng **HTTPS/TLS 1.2+**.
- Xác thực qua **OAuth2 Client Credentials** (đối với server-to-server).
- Xác thực người dùng qua **PIN + CCCD chip data** (two-factor).
- Không có Private Key nào rời khỏi HSM của eIDCA.
