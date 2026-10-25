# VNeCA Unified Agent v2 — Website UAT thủ công

Website chạy cục bộ thay Postman Desktop cho bộ workbench trong [`../uat-test`](../uat-test/QUICK-START-VI.md). Mỗi request chỉ được gửi khi người test bấm nút, theo đúng 6 bước của `QUICK-START-VI.md`. Website không có Runner, không tự poll, không tự retry, không tự phê duyệt.

## Chạy

Yêu cầu: Windows, Node.js ≥ 22.15. Không cần `npm install`, vì website không dùng thư viện ngoài.

```powershell
cd web-demo/uat-workbench
npm start          # = node --use-system-ca src/server.mjs
```

Sau đó mở <http://127.0.0.1:17990/>.

- `--use-system-ca` cho Node dùng trust Windows đã phê duyệt khi gọi `https://localhost:17889`. Không tắt kiểm TLS.
- Website tự tìm gói `VNeCA-Unified-Agent-v2-Workbench-*` mới nhất trong `web-demo/uat-test/`. Nếu gói nằm chỗ khác, đặt `UAT_PACKAGE_DIR`.
- Khi khởi động, website kiểm SHA256 của từng file theo `PACKAGE-MANIFEST.json` và SHA512 của PDFBox. Nếu file trọng yếu (script, collection, environment, mẫu input) không khớp, website từ chối chạy.

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `UAT_PORT` | `17990` | Cổng, chỉ lắng nghe trên `127.0.0.1` |
| `UAT_PACKAGE_DIR` | gói mới nhất trong `../uat-test` | Thư mục gói workbench đã giải nén |
| `UAT_DATA_DIR` | `%LOCALAPPDATA%\VNeCA\UatWorkbench` | Registry phiên, state riêng, kết quả UAT, file kết quả đã lưu |

## Các trang

| Trang | Tương ứng | Nội dung |
|---|---|---|
| Tổng quan | README, READINESS-MATRIX, evidence | Kiểm checksum gói, runtime evidence, ma trận Method → Provider, quy tắc an toàn |
| Bước 1 · Nạp access | QUICK-START §1 | Vault bộ nhớ: caller `agc_`, danh tính signer, JWT/tài khoản operator, quét file bảo vệ do `prepare-private.mjs` tạo |
| Bước 2 · Preflight | QUICK-START §2, Operator collection | 00 LOGIN, 01 scoped preflight (bảng gate), 02–06 đọc metadata, Agent transport, 90 manual writes (có khóa `operator_once`) |
| Bước 3 · Tạo & khóa phiên | QUICK-START §3 | 00.1 NEW, 00.2 SELECT, chọn Method/input mẫu hoặc tài liệu riêng, 02 LOCK (không gửi HTTP) |
| Bước 4 · Send & tiếp tục | QUICK-START §4 | 03 START, 05/06 CONTINUE, 07 STATUS, 08 RESULT, 09 CANCEL, có `send_once` |
| Bước 5 · Khi lỗi | QUICK-START §5, CONTRACT-RECOVERY | 10 RETRY original START, 11 REPLAY command cũ, ca C chỉ chạy harness, bảng A–L |
| Bước 6 · Lưu & verify | QUICK-START §6, VERIFY-RESULT | Lưu RESULT vào thư mục bảo vệ, chạy `verify-result.ps1` / `verify-material.mjs`, lệnh đối soát cardinality |
| Kịch bản UAT | — | 41 ca kiểm thử. Người test tự ghi kết quả, gắn bằng chứng đã redact và xuất báo cáo Markdown/JSON |

## Giữ nguyên hành vi của gói

Website nạp trực tiếp `session-state.cjs` và validator contract nhúng trong `Customer-Signing.postman_collection.json`. Phần `customer-pre.js` / `customer-post.js` được port sang server:

- Key START chỉ sinh ở 00.1 NEW. LOCK đóng băng toàn bộ body START (bytes, danh tính, key, lựa chọn, profile).
- Mutation (`START`, `CHOICE`, `INTERACTION`, `CANCEL`, `RETRY_START`, `RETRY_MUTATION`) cần `send_once = <12 ký tự đầu phiên>:<OPERATION>`. Mỗi lần gửi tiêu thụ mã một lần.
- 03 START bị chặn khi preflight `NOT_CHECKED`. Trạng thái preflight chỉ đổi khi có response thật của 01 Complete scoped preflight, không sửa tay được.
- Command được lưu trước khi gửi HTTP. Khi lỗi transport, kết quả là chưa rõ: dùng 07 STATUS hoặc 10 RETRY, không NEW.
- Response được kiểm bằng validator contract, đối chiếu mã HTTP theo `publicErrorHttpStatus`, kiểm digest artifact/signing input. Nếu không khớp, phiên giữ nguyên. `FAILED` không bao giờ là PASS.
- 07 STATUS / 08 RESULT tôn trọng `poll_after_ms` (`WAIT_SERVER_POLL_DELAY`).
- Request tới Agent không có `Origin` / `Sec-Fetch-*` / cookie và không theo redirect. Website dùng `node:http` thay vì `fetch()`, vì `fetch()` tự thêm `sec-fetch-mode`.

## Bí mật và dữ liệu

- Caller, JWT, mật khẩu, danh tính và tài liệu riêng chỉ nằm trong bộ nhớ tiến trình server. Website không ghi các giá trị này ra file và không trả về trình duyệt; trình duyệt chỉ thấy metadata. Khởi động lại server thì phải nạp lại.
- State riêng của phiên (body START đã khóa, command, continuation), tương đương mục Vault `vneca-wb-session-<id>` của Postman, nằm trong `UAT_DATA_DIR\private\`. Thư mục này được `icacls` giới hạn cho user hiện tại + SYSTEM, giống `prepare-private.mjs`. Không chia sẻ thư mục này.
- Response hiển thị trên trình duyệt đã che continuation token, opaque reference, URL phê duyệt và bytes. URL hosted approval chỉ được lấy khi bấm “Mở UI phê duyệt”.
- Server chỉ nhận Host `127.0.0.1`/`localhost` đúng cổng, bắt buộc header `X-UAT-Workbench`, từ chối `Origin` lạ và có CSP `'self'`.

## Lưu ý khi test

- Contract hiện hành yêu cầu `identity.subject_ref`, nhưng QUICK-START mô tả `{"national_id": …}`. Thiếu `subject_ref` thì LOCK bị từ chối `CONTRACT_REQUEST_INVALID`. Cần xác nhận với owner identity field đúng của profile trước khi test thật.
- Theo bàn giao, caller Local đã hết hạn lúc 22:04:09 ngày 25/10/2026 và overall preflight là `BLOCKED_AUTHORITY`. Hiện chỉ quan sát được refusal thật (ca K: 403 FORBIDDEN). Không dùng website để vượt các gate đó.
- Ca C (cùng key, đổi intent) chỉ chạy trong harness của gói (`npm ci --ignore-scripts && npm test` trong thư mục gói). Website luôn từ chối gửi ca này.

## Kiểm thử

```powershell
npm test
```

Bộ test dùng Agent giả lập (inject transport), không gửi request ra ngoài. Các ca được kiểm:

- NEW trùng bị từ chối; LOCK hai lần bị từ chối.
- START bị chặn khi preflight `NOT_CHECKED` hoặc `send_once` sai.
- Luồng START → CHOICE → STATUS → RESULT; poll delay được tôn trọng; lưu artifact có digest khớp.
- RETRY gửi nguyên body cũ với nonce mới; lỗi 403 FORBIDDEN không làm phiên tiến trạng thái; HTTP sai contract bị bỏ qua.
- Server Agent từ chối phần cứng NFC/USB.
- Evidence đã redact không lộ bí mật.
- Các guard Host/Origin/CSP hoạt động.
