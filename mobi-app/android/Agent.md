# Agent.md — Android Module (mobi-app/android)

> **Dành cho AI Agent**: Context chi tiết cho việc làm việc trong module Android.

## Stack

- **Kotlin** + Coroutines + Flow
- **Jetpack**: ViewModel, Navigation, Hilt DI
- **Retrofit** + OkHttp cho HTTP
- **Android NFC API** + eIDCA Android SDK cho đọc CCCD chip
- **ML Kit Text Recognition** cho scan MRZ
- **iTextG** cho PDF signing

## Quy ước Android

- Package name: `vn.eidca.example`
- Min SDK: 23, Target SDK: 34
- Tất cả async dùng `suspend fun` + `viewModelScope`
- Repository pattern: ViewModel → Repository → API/SDK
- Lưu sensitive data bằng `EncryptedSharedPreferences`

## NFC trên Android

```kotlin
// Manifest permission (đã có sẵn)
// <uses-permission android:name="android.permission.NFC" />
// <uses-feature android:name="android.hardware.nfc" android:required="true" />

// Trong Activity: bật foreground dispatch để ưu tiên app nhận NFC tag
nfcAdapter.enableForegroundDispatch(activity, pendingIntent, intentFiltersArray, techListsArray)
```

## Entry points quan trọng

- `MainActivity.kt` — Kiểm tra NFC availability, điều hướng
- `NfcReaderManager.kt` — Quản lý NFC session lifecycle
- `EidcaNfcSdk.kt` — ĐIỂM TÍCH HỢP CHÍNH với eIDCA Android SDK

## Tài liệu thêm

- `docs/android-setup.md` — Cài đặt môi trường Android
- `docs/nfc-troubleshooting.md` — Debug NFC issues
