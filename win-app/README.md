# Win App — eIDCA Integration Demo

## Giới thiệu

Demo tích hợp eIDCA vào **Windows Desktop Application** (.NET 8 / WPF) sử dụng:
- 🖨️ Đầu đọc thẻ **3TE4** hoặc **HN212** (kết nối USB)
- 🔌 **SocketIO** hoặc **C# SDK** để giao tiếp với đầu đọc
- 🌐 **eIDCA REST API** để đăng ký và ký số

## Yêu cầu

- .NET 8 SDK
- Visual Studio 2022 hoặc Rider
- Đầu đọc thẻ 3TE4 hoặc HN212 đã cài driver
- Tài khoản đối tác eIDCA

## Cài đặt

```bash
# 1. Mở solution
eIDCA.WinApp.sln

# 2. Cập nhật appsettings.Development.json với credentials của bạn

# 3. Build và chạy
dotnet run --project src/
```

## Chọn chế độ đầu đọc

Trong `appsettings.json`, đặt `CardReader.Mode`:
- `"SocketIO"` — Dùng khi có SocketIO Bridge service đang chạy
- `"SDK"` — Dùng C# SDK trực tiếp (cần DLL từ eIDCA)

Xem `Agent.md` để hiểu đầy đủ cấu trúc và luồng tích hợp.
