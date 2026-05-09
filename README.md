# eIDCA Integration Examples

> **Giải pháp Ký số từ xa eIDCA** — Đăng ký chữ ký số và ký bằng thẻ Căn cước công dân

Kho lưu trữ này cung cấp **03 dự án mẫu (example)** giúp lập trình viên tích hợp hệ thống eIDCA vào các nền tảng khác nhau.

---

## 📁 Cấu trúc thư mục

```
eIDCA/
├── README.md                   ← Tài liệu tổng quan (file này)
├── docs/                       ← Tài liệu chung (kiến trúc, flow tổng quát)
│   ├── architecture.md
│   ├── api-reference.md
│   └── authentication-flow.md
├── shared/                     ← Types & Constants dùng chung
│   ├── api-types/
│   └── constants/
├── web-app/                    ← 🌐 Project 1: Tích hợp Web Application
├── win-app/                    ← 🖥️ Project 2: Tích hợp Windows Application
└── mobi-app/                   ← 📱 Project 3: Tích hợp Mobile Application (iOS & Android)
```

---

## 🚀 Ba dự án tích hợp

| # | Project | Nền tảng | Kết nối thiết bị | Ngôn ngữ |
|---|---------|----------|-----------------|----------|
| 1 | **web-app** | Trình duyệt Web | SocketIO (đầu đọc 3TE4/HN212) | JavaScript / TypeScript |
| 2 | **win-app** | Windows Desktop | SocketIO hoặc C# SDK (đầu đọc 3TE4/HN212) | C# / .NET |
| 3 | **mobi-app** | iOS & Android | NFC tích hợp, iOS/Android SDK | Swift / Kotlin |

---

## 🔑 Điều kiện tiên quyết

- **Tài khoản đối tác eIDCA** — Cần có `client_id`, `client_secret`, và `api_base_url` do eIDCA cấp.
- **Môi trường Sandbox/Production** — Xem chi tiết trong từng thư mục project.
- **Thiết bị đọc thẻ**:
  - Web & Win: Đầu đọc **3TE4** hoặc **HN212** có hỗ trợ CCCD chip.
  - Mobile: Thiết bị iOS/Android **có hỗ trợ NFC** (iPhone 7+, Android tầm trung trở lên).

---

## 📖 Bắt đầu

1. Clone repo và vào thư mục project bạn cần.
2. Đọc file `Agent.md` trong từng project để hiểu context và cấu trúc.
3. Đọc file `README.md` của từng project để biết cách cài đặt và chạy.
4. Tham khảo `docs/api-reference.md` để biết chi tiết API eIDCA.

---

## 📞 Hỗ trợ

Liên hệ nhóm kỹ thuật eIDCA để được cấp tài khoản sandbox và tài liệu API đầy đủ.
