# Agent.md — Windows App Integration Example

> **Dành cho AI Agent**: File này cung cấp toàn bộ context cần thiết để làm việc hiệu quả trong project `win-app`.

---

## 🎯 Mục đích Project

Dự án mẫu hướng dẫn tích hợp **eIDCA ký số từ xa** vào **ứng dụng Windows Desktop** (.NET/WPF hoặc WinForms). Hỗ trợ **hai cách** kết nối đầu đọc thẻ 3TE4/HN212:
1. **SocketIO** — Gọi qua local SocketIO Bridge service (giống web-app).
2. **C# SDK** — Dùng thư viện C# do eIDCA cung cấp, kết nối trực tiếp qua USB/SDK.

---

## 🗂️ Cấu trúc thư mục

```
win-app/
├── Agent.md                        ← File này (context cho AI Agent)
├── README.md                       ← Hướng dẫn cài đặt & chạy demo
├── eIDCA.WinApp.sln                ← Solution file Visual Studio
├── appsettings.json                ← Cấu hình app (API URL, credentials)
├── appsettings.Development.json    ← Config môi trường dev
└── src/
    ├── api/
    │   ├── EidcaHttpClient.cs      ← HttpClient wrapper gọi eIDCA API
    │   ├── AuthService.cs          ← OAuth2 token management
    │   ├── RegisterService.cs      ← Logic đăng ký chữ ký số
    │   └── SignService.cs          ← Logic ký tài liệu
    ├── socket/
    │   ├── SocketBridgeClient.cs   ← SocketIO.Client wrapper kết nối bridge
    │   ├── DeviceEventHandler.cs   ← Xử lý events từ đầu đọc
    │   └── CardReaderSocket.cs     ← Đọc CCCD qua SocketIO
    ├── sdk/
    │   ├── CardReaderSdk.cs        ← Wrapper cho C# SDK của eIDCA
    │   ├── SdkEventHandler.cs      ← Xử lý callbacks từ SDK
    │   └── NativeInterop.cs        ← P/Invoke nếu SDK dùng native DLL
    ├── ui/
    │   ├── MainWindow.xaml         ← Cửa sổ chính WPF
    │   ├── MainWindow.xaml.cs
    │   ├── RegisterView.xaml       ← UI luồng đăng ký
    │   ├── RegisterView.xaml.cs
    │   ├── SignView.xaml           ← UI luồng ký số
    │   ├── SignView.xaml.cs
    │   └── DeviceStatusControl.xaml ← Widget trạng thái đầu đọc
    └── utils/
        ├── CryptoHelper.cs         ← SHA256 hash, base64
        ├── PdfHelper.cs            ← Đọc/ghi PDF (iTextSharp/PdfSharp)
        ├── ConfigManager.cs        ← Đọc appsettings.json
        └── Logger.cs               ← Serilog logging
```

---

## 🔧 Stack kỹ thuật

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| UI Framework | WPF (.NET 6/8) | Có thể dùng WinForms nếu cần |
| HTTP Client | `HttpClient` + `System.Text.Json` | Gọi eIDCA REST API |
| SocketIO | `SocketIOClient` NuGet | Kết nối SocketIO Bridge |
| PDF | `iTextSharp` hoặc `PdfSharp` | Nhúng chữ ký vào PDF |
| Logging | `Serilog` | Log ra file + console |
| Config | `Microsoft.Extensions.Configuration` | appsettings.json |
| DI | `Microsoft.Extensions.DependencyInjection` | IoC container |

---

## 🔄 Luồng tích hợp

### Chế độ SocketIO
```
App khởi động → SocketBridgeClient.Connect("ws://localhost:9090")
             → Event "device:connect" → Enable UI
             → User đặt thẻ → Event "card:inserted"
             → Emit "card:read" → Event "card:data"
             → Gọi eIDCA API (RegisterService / SignService)
```

### Chế độ C# SDK
```
App khởi động → CardReaderSdk.Initialize(portName)
             → SDK callback: OnDeviceConnected → Enable UI
             → User đặt thẻ → SDK callback: OnCardInserted
             → CardReaderSdk.ReadCard() → trả về CccdData object
             → Gọi eIDCA API (RegisterService / SignService)
```

---

## ⚙️ Cấu hình (appsettings.json)

```json
{
  "EidcaApi": {
    "BaseUrl": "https://sandbox-api.eidca.vn/v1",
    "ClientId": "your_client_id",
    "ClientSecret": "your_client_secret",
    "TimeoutSeconds": 30
  },
  "CardReader": {
    "Mode": "SocketIO",
    "SocketBridgeUrl": "ws://localhost:9090",
    "SdkDllPath": "libs/EidcaCardReaderSdk.dll",
    "SdkPortName": "COM3"
  },
  "Logging": {
    "LogLevel": "Information",
    "LogFilePath": "logs/eidca-winapp.log"
  }
}
```

> **Quan trọng**: `Mode` có thể là `"SocketIO"` hoặc `"SDK"`. Chọn tùy theo loại đầu đọc và yêu cầu dự án.

---

## 📌 Quy ước code (C#)

- **Async/await** cho tất cả I/O operations (HTTP, SDK, file).
- **IDisposable** đúng pattern cho SDK và HTTP resources.
- **Try-catch** với logging chi tiết cho mọi API call.
- **MVVM pattern** cho WPF (ViewModel ↔ View binding).
- Không hardcode credentials — luôn dùng `appsettings.json`.

---

## 🐛 Các vấn đề thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| DLL not found (SDK mode) | Thiếu SDK DLL | Copy DLL vào `libs/`, kiểm tra `SdkDllPath` |
| COM port không nhận diện được | Sai tên port | Kiểm tra Device Manager, cập nhật `SdkPortName` |
| SSL certificate error | Môi trường sandbox | Thêm cert exception hoặc dùng `HttpClientHandler` |
| SocketIO disconnect liên tục | Firewall block localhost | Thêm exception firewall cho port 9090 |

---

## 📚 Tài liệu tham khảo

- `../docs/api-reference.md` — eIDCA API Reference
- `../docs/authentication-flow.md` — Chi tiết luồng xác thực
- `../docs/architecture.md` — Kiến trúc tổng quan
- [SocketIOClient NuGet](https://github.com/doghappy/socket.io-client-csharp)
- [iTextSharp docs](https://itextpdf.com/en/resources/documentation)
- eIDCA C# SDK Docs — Nhận từ nhóm kỹ thuật eIDCA
