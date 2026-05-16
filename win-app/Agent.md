# Agent.md — Win App Integration Example

> **Dành cho AI Agent**: File này cung cấp toàn bộ context để làm việc với project `win-app`.
> Đây là bản tương đồng của `web-app/Agent.md` nhưng cho nền tảng **Windows Desktop (.NET 8 / WPF)**.
> Tham chiếu: `../docs/api-reference.md` và `../docs/device-reference.md`.

---

## 🎯 Mục đích Project

Dự án mẫu hướng dẫn tích hợp **eIDCA ký số từ xa** vào **ứng dụng Windows Desktop (WPF / .NET 8)**.
Người dùng dùng đầu đọc thẻ vật lý (3TE4 hoặc HN212) kết nối USB. App giao tiếp với đầu đọc qua **SocketIO** (hoặc SDK C# trong tương lai), và gọi **eIDCA REST API** để đăng ký và thực hiện ký số.
Có **Mock Mode** để phát triển không cần phần cứng thật.

---

## 🗂️ Cấu trúc thư mục (đề xuất)

```
win-app/
├── Agent.md                          ← File này (context cho AI Agent)
├── README.md                         ← Hướng dẫn cài đặt & chạy
├── eIDCA.WinApp.sln                  ← Solution file
└── src/
    ├── eIDCA.WinApp.csproj           ← WPF project (.NET 8)
    ├── App.xaml / App.xaml.cs        ← Entry point WPF
    ├── appsettings.json              ← Config (apiUrl, apiKey, partnerCode, mode)
    ├── appsettings.Development.json  ← Local config (không commit)
    │
    ├── Core/
    │   ├── AppConfig.cs              ← Đọc config từ appsettings.json
    │   └── MockData.cs               ← Mock data tĩnh (NFC + Webcam)
    │
    ├── Services/
    │   ├── IDeviceService.cs         ← Interface chung cho NFC + Webcam
    │   ├── MockDeviceService.cs      ← Giả lập NFC + Webcam (không cần thiết bị)
    │   ├── SocketDeviceService.cs    ← Real SocketIO client (SocketIO.Client)
    │   └── EidcaApiService.cs        ← HTTP client gọi eIDCA REST API (HttpClient)
    │
    ├── ViewModels/
    │   ├── MainWindowViewModel.cs    ← Shell: điều hướng, mode toggle, socket state
    │   ├── DevicePanelViewModel.cs   ← Sidebar: NFC status, Webcam preview, Card info
    │   │
    │   ├── PersonalOnboarding/       ← Luồng 1 — Đăng ký CTS Cá nhân
    │   │   ├── PersonalOnboardingViewModel.cs    ← Điều phối 3 bước
    │   │   ├── Step1ChallengeViewModel.cs
    │   │   ├── Step2SignatureViewModel.cs
    │   │   └── Step3CheckViewModel.cs
    │   │
    │   ├── PersonalSign/             ← Luồng 2 — Ký số Cá nhân
    │   │   ├── PersonalSignViewModel.cs
    │   │   ├── Step1UploadViewModel.cs
    │   │   ├── Step2SignatureViewModel.cs
    │   │   └── Step3DownloadViewModel.cs
    │   │
    │   ├── CompanyOnboarding/        ← Luồng 3 — Đăng ký CTS Tổ chức
    │   │   ├── CompanyOnboardingViewModel.cs
    │   │   ├── Step1ChallengeViewModel.cs
    │   │   ├── Step2SignatureViewModel.cs
    │   │   └── Step3CheckViewModel.cs
    │   │
    │   └── CompanySign/              ← Luồng 4 — Ký số Tổ chức
    │       ├── CompanySignViewModel.cs
    │       ├── Step1UploadViewModel.cs
    │       └── Step2SignatureViewModel.cs
    │
    └── Views/
        ├── MainWindow.xaml / .cs
        ├── Controls/
        │   ├── DevicePanelControl.xaml    ← Sidebar NFC + Webcam
        │   ├── CodePanelControl.xaml      ← JSON Request/Response viewer
        │   ├── StepperControl.xaml        ← Horizontal step indicator
        │   └── ModeToggleControl.xaml     ← Mock/Live toggle + config
        │
        ├── PersonalOnboarding/
        │   ├── PersonalOnboardingView.xaml
        │   ├── Step1ChallengeView.xaml
        │   ├── Step2SignatureView.xaml
        │   └── Step3CheckView.xaml
        │
        ├── PersonalSign/
        │   ├── PersonalSignView.xaml
        │   ├── Step1UploadView.xaml
        │   ├── Step2SignatureView.xaml
        │   └── Step3DownloadView.xaml
        │
        ├── CompanyOnboarding/
        │   └── ... (tương tự PersonalOnboarding)
        │
        └── CompanySign/
            └── ... (tương tự PersonalSign, dùng chung Step3Download)
```

---

## 🔧 Stack kỹ thuật

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| Framework | .NET 8 + WPF | Windows only |
| Architecture | MVVM | `INotifyPropertyChanged`, `RelayCommand` |
| HTTP Client | `HttpClient` (native .NET) | Không dùng RestSharp hay Flurl |
| WebSocket | `SocketIO.Client` (NuGet) | `SocketIOClient` package |
| DI Container | `Microsoft.Extensions.DependencyInjection` | Đăng ký services trong `App.xaml.cs` |
| Config | `appsettings.json` + `Microsoft.Extensions.Configuration` | |
| Image | `BitmapImage` / `WriteableBitmap` | Hiển thị webcam frame |
| File Dialog | `Microsoft.Win32.OpenFileDialog` | Chọn file PDF để ký |
| Multipart | `MultipartFormDataContent` + `HttpClient` | Upload PDF |

---

## ⚙️ Config (appsettings.json)

```json
{
  "AppMode": "Mock",
  "MockApi": {
    "BaseUrl": "http://localhost:3001",
    "ApiKey": "MOCK_API_KEY_DEMO",
    "PartnerCode": "PARTNER_DEMO_001"
  },
  "LiveApi": {
    "BaseUrl": "https://api.eidca.vn",
    "ApiKey": "",
    "PartnerCode": ""
  },
  "Socket": {
    "NfcUrl": "https://192.168.5.1:8000",
    "CamUrl": "https://192.168.5.1:9000"
  }
}
```

> **Lưu ý**: Config được đọc lúc khởi động. Khi user đổi mode trong UI → `AppConfig` object được cập nhật runtime (không reload appsettings).

---

## 🔄 Kiến trúc Runtime

### Mode Toggle (Mock/Live)

```
ModeToggleControl (View)
  → MainWindowViewModel.ToggleModeCommand
  → AppConfig.IsMock = !AppConfig.IsMock
  → Dispose IDeviceService cũ
  → Tạo IDeviceService mới (Mock hoặc Socket)
  → Kết nối lại DevicePanelViewModel với service mới
  → Reload flow hiện tại
```

### Device Service Interface

Cả `MockDeviceService` và `SocketDeviceService` đều implement cùng `IDeviceService`:

```csharp
public interface IDeviceService
{
    // Events — tương đương socket.on.* trong web-app
    event EventHandler NfcConnected;
    event EventHandler NfcDisconnected;
    event EventHandler<DeviceInfoEventArgs> DeviceInfoReceived;
    event EventHandler<PersonalInfoEventArgs> PersonalInfoReceived;
    event EventHandler<AvatarImageEventArgs> AvatarImageReceived;
    event EventHandler<DsCertEventArgs> DsCertReceived;
    event EventHandler<CardErrorEventArgs> CardErrorReceived;
    event EventHandler<AaResponseEventArgs> AaResponseReceived;
    event EventHandler CamConnected;
    event EventHandler CamDisconnected;
    event EventHandler<WebcamFrameEventArgs> WebcamFrameReceived;

    // Methods
    Task ConnectAsync();
    Task DisconnectAsync();
    Task SendAAAsync(string challenge);
    Task SendReReadAsync(string idCode, string dateOfBirth, string expiryDate);
    void PauseCam();
    void ResumeCam();
    Task SimulateCardReadAsync(); // Chỉ Mock
    bool IsNfcConnected { get; }
    bool IsCamConnected { get; }
}
```

### Webcam Frame Dispatch (UI Thread)

```csharp
// Trong SocketDeviceService / MockDeviceService:
Application.Current.Dispatcher.Invoke(() => {
    WebcamFrameReceived?.Invoke(this, new WebcamFrameEventArgs { Base64 = frameData });
});
```

---

## 📡 Mock Device Service — Timing

| Sự kiện | Delay |
|---------|-------|
| NFC connect | 600ms sau `ConnectAsync()` |
| Webcam connect | 800ms sau `ConnectAsync()` |
| `personalInfo` | +800ms sau NFC connect |
| `avatarImage` | +600ms sau personalInfo |
| `dsCert` | +400ms sau avatarImage |
| `aaResponse` | 500ms sau `SendAAAsync()` |
| Webcam frames | Mỗi 200ms (5fps) |

---

## 📡 Real Socket Device Service

Kết nối qua `SocketIOClient` NuGet package:

```csharp
// NFC Reader: https://192.168.5.1:8000
_nfcClient = new SocketIO(config.NfcUrl, new SocketIOOptions {
    Reconnection = true,
    ReconnectionAttempts = 5,
    ReconnectionDelay = 2000,
    ConnectionTimeout = TimeSpan.FromSeconds(10),
});

_nfcClient.On("/info", response => { /* DeviceInfo */ });
_nfcClient.On("/event", response => {
    var id = response.GetValue<int>("id");
    switch (id) {
        case 2: /* PersonalInfo */ break;
        case 4: /* AvatarImage */ break;
        case 5: /* DsCert */ break;
        case 3: /* CardError */ break;
        case 7: /* AaResponse */ break;
    }
});

// Gửi AA:
await _nfcClient.EmitAsync("/get_aa", new { clientId = _clientId, challenge });

// Webcam: https://192.168.5.1:9000
_camClient.On("/image", response => { /* WebcamFrame */ });
```

---

## 🔀 Luồng 1 — Đăng ký CTS Cá nhân

**ViewModel**: `PersonalOnboardingViewModel`

**State dùng chung (truyền qua constructor injection):**
```csharp
public class PersonalOnboardingState {
    public string PartnerCode { get; set; }
    public string IdNumber { get; set; }
    public string TransactionCode { get; set; }
    public string Challenge { get; set; }
    public string TokenChallenge { get; set; }
    public RawNfcData RawData { get; set; }  // { sod, dg1, dg2, dg13, dg15 }
    public string AaSignature { get; set; }
    public string SelfieBase64 { get; set; }
    public string TokenSignature { get; set; }
    public int Interval { get; set; } = 3000;
}
```

**3 bước:**
```
STEP 1 (Step1ChallengeViewModel)
  └── POST /ca/api/eid-personal/challenge
      Body: { code, id_number }
      → { transaction_code, challenge, token_challenge }
      → Gọi ActivateStep2()

STEP 2 (Step2SignatureViewModel)
  ├── Đợi NFC event id:4 → rawData
  ├── service.SendAAAsync(challenge) → đợi AaResponseReceived → aa_signature
  ├── Lấy selfie từ DevicePanelViewModel.CurrentFrame
  └── POST /ca/api/eid-personal/signature
      Body: { code, transaction_code, token_challenge, raw_data, info, signature }
      → { transaction_code, status, interval, expired_at, token_signature }
      → Gọi ActivateStep3()

STEP 3 (Step3CheckViewModel)
  └── POST /ca/api/eid-personal/check  [poll mỗi interval ms]
      Body: { code, transaction_code, token_signature }
      → { status: "processing"|"completed"|"failed", cert_info? }
```

---

## 🔀 Luồng 2 — Ký số Cá nhân

**ViewModel**: `PersonalSignViewModel`

**State dùng chung:**
```csharp
public class PersonalSignState {
    public string PartnerCode { get; set; }
    public string IdNumber { get; set; }
    public string TransactionCode { get; set; }
    public string TokenSign { get; set; }
    public List<DocInfo> Docs { get; set; }  // [{doc_id, doc_name, doc_challenge}]
    public string SelectedFilePath { get; set; }
    public string AaSignature { get; set; }
    public string SelfieBase64 { get; set; }
    public List<SignedDoc> SignedDocs { get; set; }
    public string TokenSigned { get; set; }
}
```

**3 bước:**
```
STEP 1 (Step1UploadViewModel)
  ├── OpenFileDialog → chọn PDF
  ├── Nhập id_number (hoặc tự điền từ NFC)
  ├── Cấu hình sign_props (JSON)
  └── POST /ca/api/sign/challenge  [multipart/form-data]
      Headers: { x-api-key, code }
      Body: FormData(documents, id_number, sign_props, security_level)
      → { transaction_code, token_sign, docs[] }

STEP 2 (Step2SignatureViewModel)
  ├── service.SendAAAsync(docs[0].doc_challenge) → aa_signature
  ├── Lấy selfie từ DevicePanelViewModel
  └── POST /ca/api/sign/signature
      Body: { code, transaction_code, token_sign, info:{image}, doc_signs:[{doc_id, signature}] }
      → { status, token, signed_docs[], interval }

STEP 3 (Step3DownloadViewModel)
  ├── Hiển thị danh sách tài liệu đã ký
  └── GET /ca/api/sign/download/{doc-id}
      Headers: { x-api-key, code, transaction-code, token-sign, os-type:"Windows" }
      → byte[] → SaveFileDialog → lưu PDF
```

---

## 🔀 Luồng 3 — Đăng ký CTS Cá nhân thuộc Tổ chức

**ViewModel**: `CompanyOnboardingViewModel`

Tương tự Luồng 1, khác biệt:
- STEP 1: Thêm input `company_id`, endpoint `/eid-company/challenge`
- STEP 1 response: **không có** trường `challenge` riêng (chỉ có `token_challenge`)
- STEP 2: Payload `info` gọn hơn (chỉ `phone`, `email`, `image`), endpoint `/eid-company/signature`
- STEP 3: Endpoint `/eid-company/check`

```
STEP 1 → POST /ca/api/eid-company/challenge
  Body: { code, id_number, company_id }
  → { transaction_code, token_challenge }   ← Không có "challenge" riêng

STEP 2 → POST /ca/api/eid-company/signature
  Body: { code, transaction_code, token_challenge, raw_data, info:{phone,email,image}, signature }

STEP 3 → POST /ca/api/eid-company/check  [poll]
  Body: { code, transaction_code, token_signature }
```

---

## 🔀 Luồng 4 — Ký số Cá nhân thuộc Tổ chức

**ViewModel**: `CompanySignViewModel`

Tương tự Luồng 2, khác biệt:
- STEP 1: Thêm `company_id`, endpoint `/sign-company/challenge`
- STEP 2: Endpoint `/sign-company/signature`
- STEP 3: **Dùng chung** `Step3DownloadViewModel` từ PersonalSign (endpoint `/sign/download/{doc-id}` không đổi)

```
STEP 1 → POST /ca/api/sign-company/challenge  [multipart]
  Headers: { x-api-key, code }
  Body: FormData(documents, id_number, company_id, sign_props, security_level)

STEP 2 → POST /ca/api/sign-company/signature
  Body: { code, transaction_code, token_sign, info:{image}, doc_signs:[{doc_id, signature}] }

STEP 3 → GET /ca/api/sign/download/{doc-id}   ← Endpoint chung với Luồng 2
```

---

## 🧩 Các ViewModel chính

### `MainWindowViewModel`

- Tab navigation: 4 luồng → mỗi tab là 1 ContentControl với DataTemplate
- `IsMock` toggle → rebuild IDeviceService → notify DevicePanelViewModel
- `CurrentFlowViewModel` (binding đến main content area)
- Mỗi lần chuyển tab: reset flow VM, giữ nguyên device service

**Routes (Tab):**
```csharp
{ Header = "Đăng ký CTS Cá nhân",    VM = PersonalOnboardingViewModel }
{ Header = "Ký số Cá nhân",           VM = PersonalSignViewModel }
{ Header = "Đăng ký CTS Tổ chức",    VM = CompanyOnboardingViewModel }
{ Header = "Ký số Tổ chức",           VM = CompanySignViewModel }
```

### `DevicePanelViewModel`

- `NfcStatus` (Disconnected / Connected / Reading)
- `NfcSerial` — số serial đầu đọc
- `CardName`, `CardId` — từ personalInfo (id:2)
- `WebcamStatus` — Connected / Disconnected
- `WebcamFrame` — `BitmapSource` cập nhật theo event webcamFrame (~5fps)
- `CurrentFrame` — Base64 frame mới nhất (dùng để chụp selfie)
- `PauseCam()` / `ResumeCam()` — giữ frame selfie

### `CodePanelViewModel`

- `RequestTitle`, `ResponseTitle`
- `RequestJson` — JSON object hiển thị request
- `ResponseJson` — JSON object hiển thị response
- `State` — Success / Error / Processing (đổi màu title)
- `CopyRequestCommand`, `CopyResponseCommand`

### `ModeToggleViewModel`

- `IsMock` toggle
- Khi Mock: hiển thị URL `localhost:3001` readonly
- Khi Live: form nhập `ApiBaseUrl`, `ApiKey`, `PartnerCode`
- `ApplyCommand` → callback lên MainWindowViewModel để rebuild service

---

## 🏗️ EidcaApiService

```csharp
public class EidcaApiService
{
    private readonly AppConfig _config;
    private readonly HttpClient _http;

    // FLOW 1
    Task<ChallengeResponse>  PersonalGetChallengeAsync(string idNumber);
    Task<SignatureResponse>  PersonalSendSignatureAsync(PersonalSignatureRequest req);
    Task<CheckResponse>      PersonalCheckStatusAsync(string txCode, string tokenSig);

    // FLOW 2
    Task<SignChallengeResponse> SignGetChallengeAsync(MultipartFormDataContent form);
    Task<SignatureConfirmResponse> SignSendSignatureAsync(SignConfirmRequest req);
    Task<byte[]> DownloadSignedDocAsync(string docId, string txCode, string tokenSign);

    // FLOW 3
    Task<CompanyChallengeResponse> CompanyGetChallengeAsync(string idNumber, int companyId);
    Task<SignatureResponse> CompanySendSignatureAsync(CompanySignatureRequest req);
    Task<CheckResponse> CompanyCheckStatusAsync(string txCode, string tokenSig);

    // FLOW 4
    Task<SignChallengeResponse> SignCompanyGetChallengeAsync(MultipartFormDataContent form);
    Task<SignatureConfirmResponse> SignCompanySendSignatureAsync(SignConfirmRequest req);
}
```

**Headers chung:**
```csharp
_http.DefaultRequestHeaders.Add("x-api-key", config.ApiKey);
_http.DefaultRequestHeaders.Add("Accept", "*/*");
// "code" (partnerCode) gửi trong body JSON hoặc header tùy endpoint
```

**Multipart upload (Sign Challenge):**
```csharp
var form = new MultipartFormDataContent();
form.Add(new StreamContent(fileStream), "documents", fileName);
form.Add(new StringContent(idNumber), "id_number");
form.Add(new StringContent(signPropsJson), "sign_props");
form.Add(new StringContent("LEVEL_2"), "security_level");
// Header: x-api-key + code (partnerCode) — KHÔNG set Content-Type (HttpClient tự set boundary)
```

**Download (os-type: Windows):**
```csharp
request.Headers.Add("os-type", "Windows");
request.Headers.Add("transaction-code", txCode);
request.Headers.Add("token-sign", tokenSign);
```

---

## 📌 Quy ước code

- **Ngôn ngữ comments**: Tiếng Việt cho nghiệp vụ, Tiếng Anh cho kỹ thuật.
- **MVVM**: Không có code-behind xử lý logic trong `.xaml.cs`, chỉ WPF binding + command.
- **Thread safety**: Mọi update UI từ background thread đều qua `Application.Current.Dispatcher.Invoke`.
- **Async**: Tất cả API call là `async/await`. Dùng `CancellationToken` cho polling.
- **Error handling**: Wrap trong `try/catch`, hiển thị lỗi lên `CodePanelViewModel` + `StatusMessage`.
- **Selfie**: Lấy `CurrentFrame` từ DevicePanel. Sau khi chụp → `PauseCam()`. Nút "Chụp lại" → `ResumeCam()` + reset frame.
- **Polling (Step3)**: `CancellationTokenSource`, poll mỗi `state.Interval` ms, tối đa 100 lần, dừng khi `status == "completed"` hoặc `"failed"`.
- **sign_props**: Default JSON phù hợp cho demo. User có thể không cần chỉnh sửa (hardcode mẫu hợp lệ).

---

## 🐛 Các vấn đề thường gặp (Win-app)

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| SocketIO SSL error | Server dùng self-signed cert | Set `RejectUnauthorized = false` trong SocketIOOptions |
| UI freeze khi gọi API | Không dùng async/await đúng cách | Đảm bảo `await` trên background thread, update UI qua `Dispatcher` |
| Multipart upload lỗi | Content-Type bị set thủ công | Để HttpClient tự set multipart boundary |
| `AaResponse` không đến | SendAA gọi trước khi NFC connect | Check `IsNfcConnected` trước khi gọi |
| Selfie luôn là ảnh cũ | `CurrentFrame` chưa được clear | `PauseCam()` → clear frame → `ResumeCam()` khi retry |
| Company flow không có `challenge` | `/eid-company/challenge` không trả về field riêng | Dùng `token_challenge` trực tiếp |
| File download bị corrupt | Response không đọc đúng byte[] | Dùng `response.Content.ReadAsByteArrayAsync()` |

---

## 🚀 Khởi động nhanh

```bash
# Cài đặt dependencies
dotnet restore

# Chạy Mock server (nếu dùng Mock Mode)
cd ../mock
node mock-server.js   # localhost:3001

# Build và chạy win-app
cd ../win-app/src
dotnet run
```

Hoặc mở `eIDCA.WinApp.sln` trong Visual Studio 2022, chọn Mock Mode trong UI.

---

## 📚 Tài liệu tham khảo

- `../docs/api-reference.md` — eIDCA API Reference (tất cả endpoints, request/response schema)
- `../docs/device-reference.md` — SocketIO Bridge Service (events, commands)
- `../mock/mock-server.js` — Mock HTTP server cho API
- `../web-app/Agent.md` — Web app implementation reference (logic flow tương đồng)
- [SocketIOClient NuGet](https://github.com/doghappy/socket.io-client-csharp)
- [Microsoft.Extensions.Configuration](https://learn.microsoft.com/en-us/dotnet/core/extensions/configuration)
