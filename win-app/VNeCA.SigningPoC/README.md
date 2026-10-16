# VNeCA R0.2 — Bit4id CAPI/CNG Signing PoC

Console .NET 8 Windows, chạy dưới tài khoản Windows tương tác hiện tại. Không dùng VGCASignService/PKCS#11; không sửa middleware, token, Windows trust store hoặc ứng dụng WPF.

## Luồng GetCert không cần biết thumbprint trước

```powershell
dotnet run --project .\win-app\VNeCA.SigningPoC
```

1. Gõ `GET CERT` để cho phép gọi provider và hiển thị hộp thoại PIN của middleware nếu provider yêu cầu. Bước này tuyệt đối không ký.
2. Hàm `Native.GetCertificates` lấy chứng thư trực tiếp từ token. Với CAPI, mở context của container hiện có có cho phép UI, đọc `PP_USER_CERTSTORE`; khi provider không hỗ trợ thuộc tính này, đọc `CryptGetUserKey` + `CryptGetKeyParam(KP_CERTIFICATE)`.
3. Chương trình hiển thị từng chứng thư/binding, subject, issuer, thumbprint tự tính, thời hạn, Key Usage, provider và KeySpec. Người dùng chủ động chọn một dòng trong danh sách của phiên hiện tại, kể cả khi chỉ có một dòng. Không chọn cố định Certificate 0 hoặc tự chọn chứng thư đầu tiên. Cùng một chứng thư có nhiều khóa/KeySpec vẫn được hiển thị riêng.
4. Kiểm tra Windows chain/trust và revocation độc lập; hiển thị dữ liệu thử nghiệm và SHA-256.
5. Để ký, gõ chính xác `SIGN <thumbprint được hiển thị>`. Thumbprint được lấy từ chứng thư vừa chọn; không phải thông tin người dùng phải biết trước.
6. Mở đúng binding đã chọn, so khớp public key và kiểm tra chứng thư đọc lại từ khóa trên token trùng DER của chứng thư đã chọn trước khi ký. Nếu token/chứng thư thay đổi, dừng với `TOKEN_CERTIFICATE_CHANGED`.
7. Ký dữ liệu thử nghiệm, xác minh bằng public key, xuất JSON đã loại thông tin cá nhân đầy đủ.

**PIN chỉ được nhập trong hộp thoại middleware.** PoC không thu thập, truyền, lưu hay đặt PIN qua API. CSP/KSP quyết định lúc hiện UI: có thể hỏi trong GetCert, có thể chỉ hỏi khi ký, hoặc dùng PIN cache đã có. Đọc được chứng thư công khai không chứng minh PIN đã được xác thực. Trường `certificateRetrieval.pinAuthentication=NOT_PROVEN_BY_CERTIFICATE_READ` nêu rõ giới hạn này. Không tạo chữ ký ẩn để ép hộp thoại PIN. GetCert và ký dùng worker riêng, nên middleware có thể hỏi PIN lại khi ký; PoC không sửa chính sách cache để tránh việc đó.

Không tự thử lại khi hủy UI hoặc nhận lỗi PIN. KSP có thể bỏ qua key không đọc được nhưng các mã hủy/PIN sai/PIN bị khóa là lỗi kết thúc, không chuyển qua key khác để thử lại.

## Chỉ lấy chứng thư và kiểm tra chain

```powershell
dotnet run --project .\win-app\VNeCA.SigningPoC -- --get-cert
```

Vẫn yêu cầu `GET CERT` và người dùng chọn chứng thư, sau đó kiểm tra chain và ghi báo cáo; không mở luồng ký. Có thể dùng để kiểm tra GetCert/PIN mà chưa đồng ý ký dữ liệu thử nghiệm.

CAPI mặc định dùng Microsoft Base Smart Card Crypto Provider, type 1. Để giới hạn reader hoặc dùng CSP bit4id đã đăng ký:

```powershell
dotnet run --project .\win-app\VNeCA.SigningPoC -- --get-cert --reader 'bit4id TokenME EVO v2 0'
dotnet run --project .\win-app\VNeCA.SigningPoC -- --csp 'Bit4id Universal Middleware Provider' --csp-type 1
```

Đường CNG dùng `NCryptEnumKeys`, `NCryptOpenKey`, `SmartCardKeyCertificate` với UI được cho phép; kiểm tra provider hardware trước khi đọc key:

```powershell
dotnet run --project .\win-app\VNeCA.SigningPoC -- --key-api cng --get-cert
```

`--reader` chỉ hỗ trợ CAPI; CNG liệt kê key của provider trong ngữ cảnh tài khoản hiện tại, có thể gồm nhiều token. Có thể cấu hình `--ksp 'TEN_KSP'`. Không tự chuyển API/provider khi gặp lỗi PIN.

`--thumbprint <SHA1>` chỉ là bộ lọc tùy chọn nếu đã có thông tin để đối chiếu; mặc định không cần. `--provider <name>` lọc binding được hiển thị. Nếu không tìm được kết quả khớp thì dừng, không lấy từ store để thay thế token đã chọn.

## Build, inventory và self-test

```powershell
dotnet build .\win-app\VNeCA.SigningPoC
dotnet run --project .\win-app\VNeCA.SigningPoC -- --self-test
dotnet run --project .\win-app\VNeCA.SigningPoC -- --list
dotnet run --project .\win-app\VNeCA.SigningPoC -- --help
```

Không có NuGet dependency. Self-test không đọc store/token và không ký: kiểm tra lựa chọn không cần thumbprint trước, lựa chọn rõ ràng không mặc định dòng đầu, chống đổi chứng thư token, chặn UI chưa được cho phép, chính sách trust, redaction lỗi, timeout và hủy worker.

`--list` là inventory public ở CurrentUser/My, CSP và KSP với discovery SILENT. Nó không gọi luồng GetCert tương tác, không ký và không chứng minh có thể dùng private key. Các provider cần UI sẽ được báo lỗi. Không dùng `CERT_STORE_PROV_SMART_CARD` vì Microsoft ghi nhận không được sử dụng.

## Ký và nghiệm thu

Dữ liệu duy nhất được ký là UTF-8, không BOM, không newline:

```text
VNeCA R0.2 | Bit4id CAPI/CNG PoC | TEST DATA ONLY | v1
```

Sau xác nhận ký, `CryptAcquireCertificatePrivateKey` cho phép CAPI/CNG, so khớp public key và tắt healing. Kiểm tra provider hardware, thuật toán khóa thực tế và Key Usage trước khi ký. Không export private key, tạo key/container, import root hoặc repair cấu hình.

RSA dùng SHA-256/PKCS#1 v1.5 qua CryptSignHash/NCryptSignHash; chuyển byte order RSA của CAPI trước khi xác minh. ECDSA dùng CNG SHA-256/IEEE P1363. Thuật toán khác, RSA-PSS-only hoặc provider không hỗ trợ lựa chọn này sẽ FAIL; không hạ xuống SHA-1 hoặc tự thử ký lại. Thuật toán chữ ký certificate của CA được ghi riêng với thuật toán ký dữ liệu. EKU được ghi lại; không áp thêm chính sách nghiệp vụ ngoài PoC.

- `certificateRetrieval`: API GetCert, trạng thái đọc chứng thư, PIN UI thuộc middleware và giới hạn xác nhận PIN.
- `selected`: thumbprint/SHA-256 certificate tự tính, provider, KeySpec, OID, thời hạn, usage. `selectionMode=UserSelectedFromToken`; `expectedThumbprint` là bộ lọc tùy chọn và thường null.
- `crypto`: provider/API thực tế, hardware flag, private-key access, thuật toán, signature, kết quả public-key verification.
- `validation`: Windows system trust, revocation Online/ExcludeRoot, NoFlag; mọi trạng thái chain và từng phần tử.
- `overallStatus=PASS` chỉ khi đã chọn chứng thư/binding, đồng ý ký, mở hardware key, signature verify thành công và validation PASS.
- Trust thất bại, revoked, OfflineRevocation, RevocationStatusUnknown, chain thiếu, timeout hoặc hủy không thể bị che bằng kết quả mật mã PASS.
- GOOD_WITHIN_WINDOWS_POLICY có thể dùng CRL/OCSP cache hợp lệ; không khẳng định vừa tải dữ liệu mới. Root không kiểm tra thu hồi vì là trust anchor; Windows vẫn phải tin cậy root. Không bỏ qua lỗi root, không CustomRootTrust/AllowUnknownCertificateAuthority.

JSON mặc định trong `reports/` được gitignore; `--out <path>` chỉ tạo file mới. Không lưu subject, issuer, serial, DER, container, PIN, private key hoặc raw exception của middleware. Chứng thư đầy đủ chỉ hiển thị cục bộ để người dùng chọn; tránh chuyển hướng console vào log. Thumbprint vẫn có thể liên kết danh tính, nên chỉ chia sẻ báo cáo khi cần.

Mỗi worker đọc token/store, kiểm tra chain hoặc ký có deadline riêng: mặc định 60s, `--timeout-seconds 1..600`. Ctrl+C/timeout hủy process tree và không chờ native cleanup vô hạn. Không tự ký lại sau timeout vì thao tác token có thể đã diễn ra. Middleware ngoài process tree có thể còn UI; PoC không kill dịch vụ middleware. Input redirect bị từ chối trước GetCert tương tác và trước ký; không có `--yes`.

Exit code 0: nghiệm thu PASS, hoặc list/self-test/GetCert-only hoàn tất đọc và chọn chứng thư. GetCert-only/list luôn có overall FAIL do chưa ký; không dùng exit code của chúng để nghiệm thu chữ ký. Code 1: FAIL/hủy/timeout; code 2: tham số/nền tảng/lỗi ghi JSON.

## Kiểm tra tương tác trên token

1. Chạy không truyền thumbprint, gõ GET CERT, nhập PIN trong middleware nếu có, chọn chứng thư sau khi xem danh tính/usage/provider.
2. Chạy `--get-cert`: có báo cáo retrieval/validation và crypto NOT_RUN; không có chữ ký ẩn.
3. Nhiều chứng thư/binding: không tự chọn dòng đầu; Enter hoặc số ngoài danh sách hủy.
4. Hủy hộp thoại PIN hoặc PIN sai một lần: kết thúc lỗi, không tự thử PIN/key khác. Đọc cert không hỏi PIN không được báo đã xác thực PIN.
5. Đổi/rút token giữa lựa chọn và ký: certificate/public-key mismatch hoặc lỗi token; không tự chọn lại chứng thư.
6. Hủy PIN, để UI quá timeout, Ctrl+C khi đang chờ provider: parent thoát trong deadline thao tác, JSON không PASS giả.
7. Trust/revocation lỗi nhưng signature hợp lệ: crypto và validation tách riêng, overall FAIL.
8. Kiểm tra báo cáo không có DN/serial/DER/container/PIN. Không push, merge hoặc deploy.

Build/self-test không chứng minh token thật ký được. Nghiệm thu phần cứng cần phiên tương tác với xác nhận ký của người dùng.

## Tham chiếu API

- [Certificate requirements and enumeration](https://learn.microsoft.com/en-us/windows/security/identity-protection/smart-cards/smart-card-certificate-requirements-and-enumeration)
- [CryptAcquireContext](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-cryptacquirecontextw)
- [CryptGetProvParam / PP_USER_CERTSTORE](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-cryptgetprovparam)
- [CryptGetKeyParam / KP_CERTIFICATE](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-cryptgetkeyparam)
- [CryptAcquireCertificatePrivateKey](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-cryptacquirecertificateprivatekey)
- [CNG key storage properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers)
