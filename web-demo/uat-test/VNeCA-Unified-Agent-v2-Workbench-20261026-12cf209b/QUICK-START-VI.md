# Unified Agent v2 — Postman từng bước

Bộ này dùng Postman Desktop, gửi từng request bằng **Send**. Không dùng Collection Runner, CLI/Newman hoặc browser cookie. Local và Server là hai đường độc lập. Bản chụp runtime và blocker nằm trong `evidence/runtime-preflight.json`; bảng giải thích ở `READINESS-MATRIX.md`. Có collection không đồng nghĩa Provider đã sẵn sàng ký.

## 1. Import và nạp access một lần

Import `Customer-Signing.postman_collection.json`, `Operator-Setup-Preflight.postman_collection.json` và hai environment. Chọn **Local** cho `https://localhost:17889`, **Server** cho `http://127.0.0.1:29080`. Bật SSL certificate verification; không dùng `-k` hoặc Ignore SSL. Local loopback sử dụng trust Windows đã phê duyệt. Server hiện chạy installation của cohort TEST cũ, chưa provision cho tenant hiện tại; environment Server cố ý không điền giả profile/grant.

Mở **Vault** của Postman Desktop, thêm secret và cho phép scripts của collection truy cập Vault. Không đặt access vào environment/collection/shared variables:

| Vault key | Nội dung lấy ở đâu |
|---|---|
| `vneca-local-eidca-caller` | Bearer `agc_…` từ connection artifact của workflow Agent installation hợp lệ, không phải JWT đăng nhập portal/admin |
| `vneca-server-caller` | Caller access của installation Server đúng tenant/binding; chưa có cho tenant hiện tại |
| `vneca-signing-identity` | Local hiện đọc `national_id`, namespace `vn-national-id`, issuer `eidca`: JSON `{"national_id":"<12 chữ số của signer đã xác minh>"}`. Không điền synthetic identity cho CA thật. Installation khác lấy đúng identity field từ profile, không suy từ mẫu |
| `vneca-operator-jwt` | JWT thật của operator có quyền quản trị, chỉ Operator collection dùng |

Caller Local cũ nằm trong thư mục bảo vệ `%LOCALAPPDATA%/VNeCA/Postman/aig_63faf1d5954f3d3211016d80a3d64be2/local-eidca-caller.txt`, nhưng **đã hết hạn lúc 22:04:09 ngày 25/10/2026 (Asia/Saigon)**. Không nạp nó để ký. Operator phải dùng workflow installation hiện hữu với parent authorization còn hiệu lực để cấp access mới, không gia hạn quyền signing-key hoặc mở cohort cũ. Chi tiết chuẩn bị PoP/decrypt nằm ở `OPERATOR-GUIDE.md`.

Postman native HTTP không gửi `Origin` hoặc `Sec-Fetch-*`; dùng `agc_` theo contract nên **không cần xin lại browser pairing**. Browser portal vẫn dùng consent `/api/usb/session` riêng. Không sao chép browser session sang Postman. Nếu TLS/policy/authority từ chối, sửa nguyên nhân đó; không tắt validation.

## 2. Preflight trước START

Trong Operator collection, đăng nhập thật bằng request `00 LOGIN` (username/password trong Local Vault), hoặc nạp JWT thật đã được helper `prepare-private.mjs operator-access` lưu vào file bảo vệ. Bấm `01 Complete scoped preflight`, rồi `02–05` đọc mapping, API metadata và native plan. Không bấm các request ghi trong folder 90 nếu chưa có command/phạm vi được phép. Preflight đọc không tạo transaction, challenge hay grant.

Response từng gate phải được phân biệt: `PASS`, `BLOCKED_CONFIG`, `BLOCKED_AUTHORITY`, `BLOCKED_OPERATOR`, `UNSUPPORTED`, `NOT_CHECKED`. `PASS` transport chỉ chứng minh đọc được owner. `NOT_CHECKED` về ownership/use/trust/credential không phải PASS. Thông tin exact manifest/cohort/verifier nằm trong response scoped preflight. Không tự sửa `operator_preflight_status=PASS` từ health.

Bộ cho phép **Send có chủ đích** khi đã biết blocker để quan sát lỗi thật, bằng one-shot ở bước 4; request từ chối vẫn đỏ. Khi preflight chưa chạy (`NOT_CHECKED`), START chưa được gửi. Không dùng START để kiểm tra thiết bị, credential hoặc fee mà chưa được phép tạo giao dịch.

## 3. Tạo và khóa đúng phiên

1. Đặt `case_id=CCCD-PDF`, `run_id=lan-001`; bấm **00.1 NEW**. Key chỉ sinh ở đây. Đừng bấm NEW để xử lý timeout.
2. Mở folder Method cần thử. CCCD_NFC/USB_TOKEN dùng Local; VNEID/eSIGN có thể dùng hai Agent khi installation/capability tương ứng sẵn sàng. Folder **AUTO** gửi START chưa chọn Method. Provider do Platform resolve, chỉ eSIGN có thể yêu cầu chọn CA.
3. Mẫu PDF không nhạy cảm đã có trong environment. `signature_profile=PADES_B_B`, `output_kind=ARTIFACT`. XML/CMS và HASH phải dùng đúng tổ hợp trong `samples/inputs.json` và matrix; không chỉ đổi đuôi file. Với tài liệu riêng: `node prepare-private.mjs input "C:/protected/input.pdf" PDF FILE`, đưa JSON trong file bảo vệ vào Vault `vneca-private-input`, đặt `input_vault_key=vneca-private-input`. Không đưa tài liệu thật vào environment export.
4. Bấm **02 LOCK original intent**. Đây là thao tác local, chưa gửi HTTP. START body được đóng băng trong Local Vault, gồm bytes/identity/key/selection/profile. Sửa biến sau LOCK không đổi phiên. Muốn nghiệp vụ khác phải tạo case/run/key khác có chủ đích.

**Tôi đang ở phiên nào?** Bấm **00.3 VIEW**, đọc environment `wb_selected_summary`: case/run, `startKey`, `sessionRef`, Agent/tenant/binding/environment, `signingId`, `state`, `last`, `commands`, `next`. Không có signing_id toàn cục dùng chung các case. Request 01/02/VIEW không phải network health test: chúng chỉ quản lý state. Đọc readiness thật ở Operator collection và evidence runtime.

## 4. Send và tiếp tục từng bước

Trước mutation, đặt `send_once=<12 ký tự đầu selected_session>:<operation>`; operation là `START`, `CHOICE`, `INTERACTION`, `CANCEL`, `RETRY_START`, hoặc `RETRY_MUTATION`. Mỗi Send tiêu thụ một lần. Ví dụ `ab12cd34ef56:START`. Đây là chống bấm nhầm, không phải authorization/approval. Mọi quyết định dùng khóa vẫn do runtime xác thực.

1. Bấm **03 START**. Environment hiện là `production` theo cấu hình tenant, endpoint eIDCA đang là `https://api-sandbox.jth.vn`; nhãn TEST của Docker không đổi môi trường Provider. Provider/CA thật có thể phát sinh phí chưa được xác định. Không Send nếu chưa được quyền thực hiện giao dịch.
2. `ACTION_REQUIRED`: mở **Visualize** của response để đọc loại action và options có số thứ tự. Đặt `selected_option_index` bằng số 1-based của **response hiện tại**, rồi bấm **05 CONTINUE**. Không tự chọn option đầu, không copy opaque reference từ phiên khác. Với hosted approval thật, hoàn tất trên UI/app được cung cấp, đặt `interaction_completed=YES`, bấm **06 CONTINUE**; script không tạo approval.
3. NFC/AA/camera: chỉ khi action và phiên đã được phép, đặt CCCD vào HN212, thực hiện consent trên Local SDK; không nhập dữ liệu chip, AA, selfie giả vào Postman. USB: cắm token đúng certificate, nhập PIN trong UI/SDK tin cậy, không nhập PIN vào variables. VNeID/eSIGN: xác nhận giao dịch trên ứng dụng Provider theo action. Không mở thêm START khi app chậm.
4. `PROCESSING`: chờ `poll_after_ms`, bấm **07 STATUS** trên đúng phiên. Không coi ACK/PROCESSING là ký xong. `COMPLETED`: bấm **08 RESULT**; kết quả lặp phải giữ digest/certificate/profile. Xem cách lưu và verify dưới đây.
5. Muốn hủy: bấm **09 CANCEL** của đúng phiên bằng current handle; STATUS có thể cung cấp CANCEL-only handle. `PROCESSING` là chờ hủy, chỉ `CANCELLED` mới là đã hủy. Hủy sau commit không xóa chữ ký hoặc phí.

## 5. Khi lỗi, bấm gì?

| Tình huống | Thao tác tiếp theo |
|---|---|
| Mất response START, chưa biết signing_id | **10 RETRY original START**, cùng key/body đã khóa. Không NEW, không đổi intent |
| Mất response CONTINUE/dispatch | **07 STATUS** cùng signing_id; nếu cần replay thì **11 REPLAY CONTINUE/CANCEL** dùng nguyên command cũ. Không chọn lại/new key để thay command chưa rõ |
| 401/403, caller hết hạn/revoked | Operator sửa access bằng workflow thật. Giữ nguyên phiên; không đổi tenant để lấy kết quả |
| 422 CAPABILITY_NOT_READY | Operator xem exact activation/profile/cohort/capability. Không retry tự động |
| 503 DEPENDENCY_UNAVAILABLE | Xem owner code/runtime và đối soát trước; chỉ retry đúng request khi dependency đã phục hồi. Recovery không phải quyền tự ký lại |
| Continuation hết hạn | STATUS phiên gốc; SDK chỉ refresh lựa chọn chưa claim khi owner fence còn khớp. Approval đã claim/hết hạn không được tự làm mới |
| Sai option/tenant/session | Dừng; chọn đúng phiên và options hiện hành. Không sửa opaque token |

Chọn lại phiên: đặt case_id/run_id rồi **00.2 SELECT**, hoặc nhập chính xác `select_session_id`. Giữ đúng environment/Agent/caller slot. **00.4 EXPORT** tạo `wb_export_redacted`; lưu thành file evidence mới. **00.5 CLOSE** chỉ đóng sổ local, giữ lịch sử; không gửi CANCEL. Không xóa registry/Vault khi chưa đối soát mutation chưa rõ.

## 6. Lưu, verify và kiểm tra ký/tính phí trùng

Save response RESULT vào file local được bảo vệ, không commit/chia sẻ raw response. Chạy:

```powershell
node save-result.mjs C:/protected/result.json C:/protected/signed.pdf
./verify-result.ps1 -Format PDF -Artifact C:/protected/signed.pdf -Original C:/protected/input.pdf -Leaf C:/approved/leaf.pem -TrustedRoots C:/approved/root.pem -Intermediates C:/approved/intermediate.pem -Crls C:/approved/current-crls.pem -JavaHome 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot'
```

Helper chỉ ghi file mới, kiểm digest, không ghi đè PDF cũ. Verifier offline độc lập dùng JDK21 + PDFBox/BC có checksum trong ZIP, cần chain/CRL đã được chấp nhận. Không dùng TEST root thay CA thật. `SIGNING_MATERIAL` vẫn là JSON; `verify-material.mjs` chỉ verify raw signature, không được gọi là PDF/CMS/XML artifact PASS.

Postman schema/digest PASS chưa chứng minh không ký trùng. Operator dùng `collect-cardinality.mjs` (quyền Docker/DB read-only của stack TEST đã xác minh) hoặc nguồn telemetry/receipt CA hợp lệ để đối soát **đúng tenant/canonical root**: root, attempt, committed result, usage event, quantity và key-action receipt. Helper không suy key-action từ số attempt. So sánh snapshot trước/sau từng replay; không cộng số toàn hệ thống để chứng minh một phiên. Evidence chưa có độc lập crypto/cardinality giữ `NOT_CHECKED`.

Scripts của bộ chỉ gọi API khi bạn Send, không tự poll/auto retry/auto approve. Postman vẫn hiển thị raw request/response cho người dùng local; đừng chụp Console hoặc export request có bearer/CCCD/tài liệu. Chỉ chia sẻ bản `wb_export_redacted` và kết quả kiểm chứng đã loại dữ liệu nhạy cảm.

Nguồn hành vi Postman: [Local Vault script API](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-vault/), [workflow controls](https://learning.postman.com/docs/tests-and-scripts/running-collections/building-workflows). State/retry ở đây theo source SDK hiện tại, không dựa vào browser session.
