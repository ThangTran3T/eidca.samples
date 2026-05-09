# Agent.md — iOS Module (mobi-app/ios)

> **Dành cho AI Agent**: Context chi tiết cho việc làm việc trong module iOS.

## Stack

- **Swift 5.9+** với async/await + Combine
- **UIKit** (hoặc SwiftUI tùy branch)
- **CoreNFC** cho đọc CCCD chip
- **Vision Framework** cho scan MRZ
- **URLSession** / Alamofire cho HTTP
- **PDFKit** cho xem PDF, **Keychain** cho lưu trữ bảo mật

## Quy ước iOS

- Deployment target: iOS 15+
- Bundle ID: `vn.eidca.example`
- Architecture: MVVM + Combine
- Tất cả network calls dùng `async/await`
- Lưu `access_token` và `certificate_id` trong **Keychain** (không dùng UserDefaults)

## NFC trên iOS (CoreNFC)

```swift
// Entitlements (đã có sẵn):
// com.apple.developer.nfc.readersession.iso7816.select-identifiers

// Info.plist:
// NFCReaderUsageDescription = "..."

// CoreNFC chỉ hoạt động trên thiết bị thật, KHÔNG hoạt động trên Simulator
```

> ⚠️ **Quan trọng**: Luôn test NFC trên **thiết bị thật**. Simulator không hỗ trợ CoreNFC.

## Entry points quan trọng

- `AppDelegate.swift` — App lifecycle
- `NFCSessionManager.swift` — Quản lý CoreNFC session
- `EidcaNFCSdk.swift` — ĐIỂM TÍCH HỢP CHÍNH với eIDCA iOS SDK
- `KeychainHelper.swift` — Lưu trữ bảo mật token & certificate

## Tài liệu thêm

- `docs/ios-setup.md` — Cài đặt Xcode, certificates, provisioning profile
- `docs/nfc-troubleshooting.md` — Debug NFC issues trên iOS
