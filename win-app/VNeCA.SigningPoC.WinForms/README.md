# VNeCA R0.2 — WinForms

Giao diện test USB token, dùng chung lõi CAPI/CNG và worker có timeout với bản console. Không cần biết trước thumbprint.

```powershell
dotnet run --project .\win-app\VNeCA.SigningPoC.WinForms
```

Hoặc mở `bin/Debug/net8.0-windows/VNeCA.SigningPoC.WinForms.exe` sau khi build.

1. Chọn CAPI/CNG và provider; có sẵn Microsoft Smart Card và Bit4id. Reader có thể để trống; CSP type mặc định 1, timeout mặc định 60 giây.
2. Bấm **Lấy chứng thư (GetCert)**. Nhập PIN trong hộp thoại middleware khi được hỏi. Chương trình không có ô nhập/lưu PIN và không ký ở bước này.
3. Bấm chọn một dòng chứng thư/binding, xem chi tiết. Không tự chọn dòng đầu; thumbprint tự tính từ chứng thư.
4. Bấm **Kiểm tra trust / revocation**; xem kết quả riêng trong tab JSON và nhật ký.
5. Bấm **Ký dữ liệu thử nghiệm** và xác nhận trong hộp thoại hiển thị chứng thư, provider, KeySpec, thuật toán và chuỗi dữ liệu cố định. Mặc định của hộp thoại là Không. Không có đầu vào tài liệu thật.
6. Bấm **Xuất JSON** để lưu báo cáo đã loại DN/serial/DER/container/PIN. Thông tin cá nhân chỉ xuất hiện trong danh sách/chi tiết/hộp xác nhận ở giao diện cục bộ.

**Hủy thao tác** dừng worker đang chờ provider/PIN. Đóng cửa sổ khi đang chạy cũng hủy worker trước khi thoát. Không tự ký lại khi timeout; chữ ký có thể đã được token tạo trước khi worker bị dừng. Middleware ngoài process tree có thể còn hộp thoại; ứng dụng không kill dịch vụ middleware.

Trust FAIL/UNKNOWN vẫn giữ nghiệm thu tổng thể FAIL ngay cả khi chữ ký verify thành công. Không import root, sửa token/middleware hoặc export private key. Đọc được chứng thư công khai không chứng minh PIN đã xác thực; provider có thể hỏi PIN khi ký hoặc dùng cache.

```powershell
dotnet build .\win-app\VNeCA.SigningPoC.WinForms
.\win-app\VNeCA.SigningPoC.WinForms\bin\Debug\net8.0-windows\VNeCA.SigningPoC.WinForms.exe --smoke-test
```

Smoke-test tự mở/đóng form, kiểm tra trạng thái ban đầu, worker JSON, chặn thiếu consent, timeout và hủy. Không đọc store/token, không nhập PIN, không ký. Không thêm NuGet dependency.

Lõi kỹ thuật và các giới hạn nghiệm thu: [PoC console](../VNeCA.SigningPoC/README.md).
