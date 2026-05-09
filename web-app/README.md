# Web App — eIDCA Integration Demo

## Giới thiệu

Demo tích hợp eIDCA vào **Web Application** sử dụng:
- 🖨️ Đầu đọc thẻ **3TE4** hoặc **HN212** (kết nối USB)
- 🔌 **SocketIO** để giao tiếp với đầu đọc qua local bridge service
- 🌐 **eIDCA REST API** để đăng ký và ký số

## Yêu cầu

- Node.js 18+
- Đầu đọc thẻ 3TE4 hoặc HN212 đã cài driver
- SocketIO Bridge Service đang chạy trên `localhost:9090`
- Tài khoản đối tác eIDCA (sandbox hoặc production)

## Cài đặt

```bash
# 1. Cài dependencies
npm install

# 2. Sao chép file cấu hình
cp .env.example .env

# 3. Điền thông tin vào .env
nano .env

# 4. Chạy dev server
npm run dev
```

## Cấu trúc code

Xem `Agent.md` để hiểu đầy đủ cấu trúc và luồng tích hợp.

## Demo

Truy cập `http://localhost:5173` sau khi chạy `npm run dev`.

1. **Đăng ký chữ ký số**: Nhấn "Đăng ký" → Đặt CCCD vào đầu đọc → Làm theo hướng dẫn.
2. **Ký tài liệu**: Nhấn "Ký tài liệu" → Chọn file PDF → Đặt CCCD → Nhập PIN → Download.
