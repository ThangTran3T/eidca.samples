# eIDCA — Luồng xác thực & ký số chi tiết

## 1. Luồng Đăng ký Chữ ký số (Registration Flow)

```
┌──────────┐        ┌──────────────┐        ┌────────────┐        ┌──────────┐
│ Người    │        │  Ứng dụng    │        │ SocketIO/  │        │ eIDCA    │
│ dùng     │        │  Đối tác     │        │ NFC SDK    │        │ API      │
└────┬─────┘        └──────┬───────┘        └─────┬──────┘        └────┬─────┘
     │                     │                      │                    │
     │  1. Yêu cầu đăng ký │                      │                    │
     │────────────────────>│                      │                    │
     │                     │  2. POST /register/initiate               │
     │                     │──────────────────────────────────────────>│
     │                     │  3. session_id + challenge                │
     │                     │<──────────────────────────────────────────│
     │  4. Đặt thẻ CCCD    │                      │                    │
     │<────────────────────│                      │                    │
     │  5. Quét thẻ CCCD   │                      │                    │
     │────────────────────────────────────────────>│                    │
     │                     │  6. cccd_chip_data   │                    │
     │                     │<─────────────────────│                    │
     │                     │  7. POST /register/confirm                │
     │                     │──────────────────────────────────────────>│
     │                     │  8. certificate_id                        │
     │                     │<──────────────────────────────────────────│
     │  9. Đăng ký thành công                     │                    │
     │<────────────────────│                      │                    │
```

## 2. Luồng Ký số (Signing Flow)

```
┌──────────┐        ┌──────────────┐        ┌────────────┐        ┌──────────┐
│ Người    │        │  Ứng dụng    │        │ SocketIO/  │        │ eIDCA    │
│ dùng     │        │  Đối tác     │        │ NFC SDK    │        │ API      │
└────┬─────┘        └──────┬───────┘        └─────┬──────┘        └────┬─────┘
     │                     │                      │                    │
     │  1. Chọn tài liệu   │                      │                    │
     │     cần ký          │                      │                    │
     │────────────────────>│                      │                    │
     │                     │  2. Tính hash tài liệu (SHA256)           │
     │                     │  3. POST /sign/prepare                    │
     │                     │──────────────────────────────────────────>│
     │                     │  4. signing_session_id + challenge        │
     │                     │<──────────────────────────────────────────│
     │  5. Nhập PIN + đặt  │                      │                    │
     │     thẻ CCCD        │                      │                    │
     │────────────────────>│                      │                    │
     │                     │  6. Xác thực CCCD    │                    │
     │                     │─────────────────────>│                    │
     │                     │  7. auth_data        │                    │
     │                     │<─────────────────────│                    │
     │                     │  8. POST /sign/confirm                    │
     │                     │──────────────────────────────────────────>│
     │                     │  9. signature + timestamp                 │
     │                     │<──────────────────────────────────────────│
     │  10. Ký thành công  │                      │                    │
     │<────────────────────│                      │                    │
```

## 3. Tích hợp SocketIO (Web & Windows)

SocketIO bridge chạy như một **local service** trên máy tính người dùng, kết nối đầu đọc thẻ vật lý và expose WebSocket interface cho ứng dụng.

```
[Ứng dụng] ←──WebSocket/SocketIO──→ [SocketIO Bridge Service] ←──USB──→ [Đầu đọc 3TE4/HN212]
```

### Events SocketIO quan trọng:

Sử dụng lài liệu từ file `device-reference.md` để hiểu rõ các events và cách sử dụng của SocketIO Bridge Service.

## 4. Tích hợp NFC SDK (Mobile)

Mobile SDK xử lý toàn bộ giao tiếp NFC với chip CCCD theo chuẩn ICAO 9303:

```
[iOS/Android App] ──→ [eIDCA Mobile SDK] ──→ [NFC Controller] ──→ [CCCD Chip]
                              │
                              ▼
                   Đọc DG1, DG2, SOD
                   Xác thực chữ ký SOD
                   Trả về encrypted_chip_data
```

### Bước đọc NFC:
1. **MRZ Scanning** — Camera scan mã MRZ (mặt sau CCCD) để lấy key giải mã.
2. **BAC/PACE** — Thiết lập kênh bảo mật với chip.
3. **Đọc Data Groups** — DG1 (thông tin cá nhân), DG2 (ảnh chip), SOD.
4. **Verify SOD** — Kiểm tra chữ ký số của Bộ Công an trên SOD.
5. **Encrypt & Return** — Mã hóa dữ liệu, trả về ứng dụng.
