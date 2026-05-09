# Agent.md — Web App Integration Example

> **Dành cho AI Agent**: File này cung cấp toàn bộ context cần thiết để làm việc hiệu quả trong project `web-app`.

---

## 🎯 Mục đích Project

Dự án mẫu hướng dẫn tích hợp **eIDCA ký số từ xa** vào một **ứng dụng Web** (trình duyệt). Người dùng dùng đầu đọc thẻ vật lý (3TE4 hoặc HN212) kết nối USB vào máy tính, ứng dụng web giao tiếp với đầu đọc qua **SocketIO**, và gọi **eIDCA REST API** để đăng ký và thực hiện ký số.

---

## 🗂️ Cấu trúc thư mục

```
web-app/
├── Agent.md                    ← File này (context cho AI Agent)
├── README.md                   ← Hướng dẫn cài đặt & chạy demo
├── package.json
├── .env.example                ← Template biến môi trường
├── public/
│   └── index.html
└── src/
    ├── api/
    │   ├── eidcaClient.js      ← HTTP client gọi eIDCA API (axios/fetch)
    │   ├── auth.js             ← OAuth2 token management
    │   ├── register.js         ← API calls: /register/initiate, /register/confirm
    │   └── sign.js             ← API calls: /sign/prepare, /sign/confirm
    ├── socket/
    │   ├── socketClient.js     ← SocketIO client kết nối đầu đọc
    │   ├── deviceEvents.js     ← Xử lý events: device:connect, card:inserted...
    │   └── cardReader.js       ← Logic đọc CCCD chip qua SocketIO
    ├── ui/
    │   ├── app.js              ← Entry point ứng dụng
    │   ├── registerFlow.js     ← UI luồng đăng ký chữ ký số
    │   ├── signFlow.js         ← UI luồng ký số tài liệu
    │   └── deviceStatus.js     ← Hiển thị trạng thái đầu đọc
    └── utils/
        ├── crypto.js           ← Hash tài liệu (SHA256), encode/decode
        ├── fileUtils.js        ← Đọc file PDF, xuất file đã ký
        └── logger.js           ← Logging utility
```

---

## 🔧 Stack kỹ thuật

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| UI Framework | Vanilla JS hoặc Vue 3 | Không phụ thuộc framework |
| HTTP Client | `axios` | Gọi eIDCA REST API |
| WebSocket | `socket.io-client` | Kết nối SocketIO Bridge |
| File Handling | `pdf-lib` | Đọc/ghi PDF |
| Crypto | Web Crypto API | SHA256 hash |
| Build Tool | Vite | Dev server + bundler |

---

## 🔄 Luồng tích hợp (Integration Flow)

### Bước 1 — Kiểm tra đầu đọc
```
App khởi động → socketClient.connect("ws://localhost:9090")
             → Event "device:connect" → hiển thị trạng thái "Đầu đọc sẵn sàng"
             → Event "device:disconnect" → hiển thị "Vui lòng kết nối đầu đọc"
```

### Bước 2 — Đăng ký chữ ký số
```
User nhấn "Đăng ký" → emit "card:read" (SocketIO)
                    → Event "card:inserted" → đọc CCCD data
                    → POST /register/initiate (eIDCA API)
                    → POST /register/confirm với cccd_data
                    → Lưu certificate_id
```

### Bước 3 — Ký tài liệu
```
User chọn file PDF → SHA256 hash file
                  → POST /sign/prepare (eIDCA API)
                  → emit "card:read" (SocketIO) — xác thực CCCD
                  → User nhập PIN
                  → POST /sign/confirm
                  → Nhúng signature vào PDF
                  → Download PDF đã ký
```

---

## ⚙️ Biến môi trường (.env)

```env
# eIDCA API
VITE_EIDCA_API_BASE_URL=https://sandbox-api.eidca.vn/v1
VITE_EIDCA_CLIENT_ID=your_client_id_here
VITE_EIDCA_CLIENT_SECRET=your_client_secret_here

# SocketIO Bridge (local service trên máy người dùng)
VITE_SOCKET_BRIDGE_URL=ws://localhost:9090

# App
VITE_APP_NAME=eIDCA Web Integration Demo
VITE_APP_ENV=development
```

---

## 📌 Quy ước code

- **Ngôn ngữ comments**: Tiếng Việt cho nghiệp vụ, Tiếng Anh cho kỹ thuật.
- **Error handling**: Luôn catch lỗi API và hiển thị thông báo user-friendly.
- **Token refresh**: `auth.js` tự động refresh token trước khi hết hạn.
- **SocketIO reconnect**: Tự động reconnect khi mất kết nối.

---

## 🐛 Các vấn đề thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| SocketIO không kết nối được | SocketIO Bridge chưa chạy | Chạy service đầu đọc trước khi mở app |
| CORS error khi gọi API | Thiếu header Origin | Thêm domain vào whitelist eIDCA |
| `card:data` trả về empty | Thẻ CCCD đặt sai vị trí | Nhắc user đặt lại thẻ |
| Token expired 401 | Token hết hạn | Gọi lại `/auth/token` |

---

## 📚 Tài liệu tham khảo

- `../docs/api-reference.md` — eIDCA API Reference
- `../docs/authentication-flow.md` — Chi tiết luồng xác thực
- `../docs/architecture.md` — Kiến trúc tổng quan
- [socket.io-client docs](https://socket.io/docs/v4/client-api/)
- [Web Crypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
