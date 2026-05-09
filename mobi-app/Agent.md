# Agent.md — Mobile App Integration Example (iOS & Android)

> **Dành cho AI Agent**: File này cung cấp toàn bộ context cần thiết để làm việc hiệu quả trong project `mobi-app`.

---

## 🎯 Mục đích Project

Dự án mẫu hướng dẫn tích hợp **eIDCA ký số từ xa** vào **ứng dụng Mobile** (iOS và Android). Người dùng dùng **NFC tích hợp** trên thiết bị di động để đọc chip CCCD. Ứng dụng sử dụng **iOS SDK** (Swift) và **Android SDK** (Kotlin) do eIDCA cung cấp, kết hợp với **eIDCA REST API**.

> **Lưu ý thiết bị**: iOS từ iPhone 7+, Android từ tầm trung trở lên có hỗ trợ NFC.

---

## 🗂️ Cấu trúc thư mục

```
mobi-app/
├── Agent.md                            ← File này (context cho AI Agent)
├── README.md                           ← Hướng dẫn tổng quan cả 2 platform
│
├── android/                            ← Android project (Kotlin + Jetpack)
│   ├── Agent.md                        ← Context chi tiết cho Android
│   ├── app/
│   │   └── src/main/
│   │       ├── java/vn/eidca/example/
│   │       │   ├── api/
│   │       │   │   ├── EidcaApiClient.kt   ← Retrofit client
│   │       │   │   ├── AuthRepository.kt   ← OAuth2 token management
│   │       │   │   ├── RegisterRepository.kt
│   │       │   │   └── SignRepository.kt
│   │       │   ├── nfc/
│   │       │   │   ├── NfcReaderManager.kt     ← NFC session management
│   │       │   │   ├── CccdNfcReader.kt         ← Đọc CCCD chip qua NFC
│   │       │   │   ├── MrzScanner.kt            ← Camera scan MRZ (dùng ML Kit)
│   │       │   │   └── EidcaNfcSdk.kt           ← Wrapper eIDCA Android SDK
│   │       │   ├── ui/
│   │       │   │   ├── MainActivity.kt
│   │       │   │   ├── RegisterActivity.kt      ← UI đăng ký
│   │       │   │   ├── SignActivity.kt           ← UI ký số
│   │       │   │   ├── NfcScanFragment.kt        ← Fragment hướng dẫn scan NFC
│   │       │   │   └── ResultFragment.kt
│   │       │   └── utils/
│   │       │       ├── CryptoUtils.kt
│   │       │       ├── FileUtils.kt
│   │       │       └── PermissionUtils.kt
│   │       ├── assets/
│   │       │   └── eidca-sdk/              ← eIDCA SDK assets (nếu có)
│   │       └── res/layout/                 ← XML layouts
│   └── docs/
│       ├── android-setup.md
│       └── nfc-troubleshooting.md
│
├── ios/                                ← iOS project (Swift + UIKit/SwiftUI)
│   ├── Agent.md                        ← Context chi tiết cho iOS
│   ├── Sources/eIDCAExample/
│   │   ├── api/
│   │   │   ├── EidcaApiClient.swift    ← URLSession/Alamofire client
│   │   │   ├── AuthManager.swift       ← OAuth2 token management
│   │   │   ├── RegisterService.swift
│   │   │   └── SignService.swift
│   │   ├── nfc/
│   │   │   ├── NFCSessionManager.swift     ← CoreNFC session
│   │   │   ├── CccdNFCReader.swift          ← Đọc CCCD chip
│   │   │   ├── MRZScanner.swift             ← Camera scan MRZ (Vision framework)
│   │   │   └── EidcaNFCSdk.swift            ← Wrapper eIDCA iOS SDK
│   │   ├── ui/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── RegisterViewController.swift
│   │   │   ├── SignViewController.swift
│   │   │   ├── NFCScanViewController.swift  ← Hướng dẫn đặt thẻ NFC
│   │   │   └── ResultViewController.swift
│   │   └── utils/
│   │       ├── CryptoUtils.swift
│   │       ├── FileUtils.swift
│   │       └── KeychainHelper.swift         ← Lưu certificate_id an toàn
│   ├── Resources/
│   │   └── Info.plist                  ← NFC Usage Description & entitlements
│   └── docs/
│       ├── ios-setup.md
│       └── nfc-troubleshooting.md
│
└── docs/
    ├── nfc-ux-guidelines.md            ← UX hướng dẫn người dùng scan NFC
    └── sdk-integration-notes.md        ← Ghi chú tích hợp SDK từ eIDCA
```

---

## 🔧 Stack kỹ thuật

### Android

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| Language | Kotlin | Coroutines cho async |
| Architecture | MVVM + Repository | Jetpack ViewModel |
| HTTP Client | Retrofit + OkHttp | Gọi eIDCA REST API |
| NFC | Android NFC API + eIDCA SDK | Đọc CCCD chip |
| Camera/MRZ | ML Kit Text Recognition | Scan MRZ mặt sau CCCD |
| PDF | iTextG (Android port) | Nhúng chữ ký |
| DI | Hilt | Dependency injection |
| Min API | 23 (Android 6.0) | NFC support |

### iOS

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| Language | Swift 5.9+ | Async/await |
| Architecture | MVVM + Combine | Reactive programming |
| HTTP Client | URLSession / Alamofire | Gọi eIDCA REST API |
| NFC | CoreNFC + eIDCA SDK | Đọc CCCD chip |
| Camera/MRZ | Vision Framework | Scan MRZ mặt sau CCCD |
| PDF | PDFKit | Xem/tạo PDF |
| Storage | Keychain | Lưu token & certificate_id |
| Min iOS | iOS 15 | CoreNFC stable |

---

## 🔄 Luồng tích hợp Mobile

### Bước 1 — Scan MRZ (lấy key giải mã chip)
```
User → Mở camera → Vision/ML Kit nhận diện MRZ mặt sau CCCD
     → Parse MRZ → lấy document_number, date_of_birth, expiry_date
     → Tính BAC key để mở kênh NFC bảo mật
```

### Bước 2 — Đọc NFC chip
```
User đặt CCCD lên mặt sau điện thoại
→ NFC session mở (CoreNFC / NfcAdapter)
→ BAC/PACE handshake với chip
→ Đọc DG1 (thông tin), DG2 (ảnh), SOD (chữ ký BCA)
→ Verify SOD signature
→ Encrypt data → cccd_chip_data
```

### Bước 3 — Đăng ký / Ký số
```
cccd_chip_data → POST /register/confirm hoặc /sign/confirm (eIDCA API)
              → Nhận certificate_id hoặc signature
              → Lưu vào Keychain (iOS) / EncryptedSharedPreferences (Android)
```

---

## ⚙️ Cấu hình

### Android (`local.properties` + `BuildConfig`)
```properties
# local.properties (KHÔNG commit lên git)
EIDCA_API_BASE_URL=https://sandbox-api.eidca.vn/v1
EIDCA_CLIENT_ID=your_client_id
EIDCA_CLIENT_SECRET=your_client_secret
```

### iOS (`Config.xcconfig`)
```
EIDCA_API_BASE_URL = https://sandbox-api.eidca.vn/v1
EIDCA_CLIENT_ID = your_client_id
EIDCA_CLIENT_SECRET = your_client_secret
```

### iOS `Info.plist` (bắt buộc cho NFC)
```xml
<key>NFCReaderUsageDescription</key>
<string>Ứng dụng cần đọc chip CCCD để xác thực danh tính và đăng ký chữ ký số.</string>
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
    <string>A0000002471001</string>
</array>
```

---

## 📌 Quy ước code

- **Kotlin**: Dùng `suspend fun` + `Flow` cho async. Không dùng callback hell.
- **Swift**: Dùng `async/await` + `Combine`. Không dùng delegation pattern cho NFC callback.
- **Keychain/EncryptedPrefs**: Luôn lưu trữ `access_token` và `certificate_id` an toàn.
- **NFC Error handling**: Luôn có fallback UI khi NFC thất bại (thiết bị không hỗ trợ / đặt sai vị trí).
- **Never log sensitive data**: Không log `cccd_chip_data`, PIN, hay token.

---

## 🐛 Các vấn đề thường gặp

| Vấn đề | Platform | Nguyên nhân | Giải pháp |
|--------|----------|-------------|-----------|
| NFC session timeout | iOS | Người dùng cầm thẻ không đủ lâu | Hiển thị countdown UI, nhắc giữ thẻ |
| `NFCTagCommandConfiguration` error | iOS | Sai entitlement | Kiểm tra `Signing & Capabilities` → Near Field Communication |
| NFC không hoạt động | Android | NFC disabled | Hướng dẫn bật NFC trong Settings |
| MRZ parse fail | Cả 2 | Ảnh mờ / thiếu sáng | Yêu cầu đủ ánh sáng, retry logic |
| `BAC authentication failed` | Cả 2 | MRZ key sai | Kiểm tra parse MRZ, đặc biệt ngày tháng |
| API 401 | Cả 2 | Token hết hạn | Tự động refresh token, retry request |

---

## 📚 Tài liệu tham khảo

- `../docs/api-reference.md` — eIDCA API Reference
- `../docs/authentication-flow.md` — Chi tiết luồng NFC & ký số
- `../docs/architecture.md` — Kiến trúc tổng quan
- `docs/nfc-ux-guidelines.md` — Hướng dẫn UX cho NFC scan
- [CoreNFC Documentation (Apple)](https://developer.apple.com/documentation/corenfc)
- [Android NFC API](https://developer.android.com/guide/topics/connectivity/nfc)
- [ICAO 9303 Standard](https://www.icao.int/publications/pages/publication.aspx?docnum=9303)
- eIDCA iOS/Android SDK Docs — Nhận từ nhóm kỹ thuật eIDCA
