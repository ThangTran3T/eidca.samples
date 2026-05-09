# Mobile App — eIDCA Integration Demo

## Giới thiệu

Demo tích hợp eIDCA vào **Mobile Application** (iOS & Android) sử dụng:
- 📱 **NFC tích hợp** trên thiết bị di động để đọc chip CCCD
- 📷 **Camera** để scan MRZ (mặt sau CCCD) lấy key giải mã chip
- 🌐 **eIDCA REST API** để đăng ký và ký số

## Cấu trúc

```
mobi-app/
├── android/    ← Android project (Kotlin + Jetpack)
└── ios/        ← iOS project (Swift + UIKit)
```

## Yêu cầu thiết bị

- **iOS**: iPhone 7 trở lên, iOS 15+
- **Android**: Thiết bị có hỗ trợ NFC, Android 6.0 (API 23)+

## Bắt đầu

- 📱 **Android**: Xem `android/Agent.md` và `android/docs/android-setup.md`
- 🍎 **iOS**: Xem `ios/Agent.md` và `ios/docs/ios-setup.md`

## Luồng sử dụng

1. **Scan MRZ** — Mở camera, đặt CCCD vào khung → app tự nhận diện MRZ
2. **Đọc NFC chip** — Đặt mặt sau CCCD lên mặt lưng điện thoại → chờ đọc xong
3. **Đăng ký / Ký số** — App gọi eIDCA API tự động với dữ liệu chip đã đọc
