# Ma trận khả năng và bằng chứng

Snapshot: xem timestamp UTC trong `evidence/runtime-preflight.json`. Tenant cố định `ten_2990dee8-2d4c-4c27-b542-af46ebf5edc3`, installation Local environment **production**, endpoint eIDCA Owner cấu hình **api-sandbox.jth.vn**. Không suy sandbox qualification từ endpoint hoặc đọc được Vault. Không gửi START/challenge/submit trong runtime hiện tại ở nhiệm vụ này.

| Method → Provider chính thức | Local runtime hiện tại | Server runtime hiện tại | Thiết bị/approval |
|---|---|---|---|
| CCCD_NFC → prv_eidca_hash | BLOCKED_AUTHORITY: key/registration/caller hết hạn; profile/policy publication PASS; native plan dry-read PASS. Chưa có exact activation/cohort/verifier | UNSUPPORTED client hardware; không relay Local | HN212 NFC/AA/camera và consent thật, chưa đọc/capture |
| VNEID → prv_ca2_vneid | BLOCKED_CONFIG: installation hiện FIXED_V1 CCCD_NFC, chưa có route/profile VNEID. Assignment tenant có nhưng không tự thành native route | BLOCKED_CONFIG: chưa install cho fixed tenant; runtime cũ giữ nguyên | App approval thật; không phụ thuộc Vault eIDCA để kiểm cấu hình riêng |
| APP_CA_REMOTE_SIGNING → prv_esign_ca2 | BLOCKED_CONFIG: chưa có native route/profile eSIGN trong installation này | BLOCKED_CONFIG: chưa install cho fixed tenant; closed TEST software cohort không được tái dùng | Chọn CA khi được offer, app/hosted approval theo contract |
| USB_TOKEN → prv_7a161b93-174e-48e5-92d7-ff6c6fe3bab7 | BLOCKED_CONFIG: USB connector đang disabled và fixed profile CCCD_NFC. Native USB recovery được kiểm riêng bằng controlled adapter, không token thật UAT | UNSUPPORTED client hardware; không relay Local | USB/SDK/PIN UI thật |

Provider dự phòng FPT_RS_V trong legacy assignment không được biến thành Provider thứ hai cho official Method VNEID. Customer không có SELECT_PROVIDER/SELECT_FLOW. Khi nhiều technical flows, operator pin trong provisioning; không chọn flow đầu.

| Gate | Trạng thái runtime được chứng minh | Cần xử lý ở đâu |
|---|---|---|
| Local Windows TLS/listener, Server health | PASS read-only | Giữ normal TLS; không Ignore SSL |
| Tenant/Signing owner metadata S2S | PASS, operator preflight HTTP200 | Chỉ operator RBAC, không expose cho customer |
| Authentication key / registration / caller | BLOCKED_AUTHORITY, hết hạn 2026-10-25T15:04:09.384Z | Workflow managed Agent installation với parent còn hiệu lực, exact same tenant và authentication key. Không dùng bearer cũ |
| Integration profile / policy publication | PASS metadata exact revisions/hash | Không phải runtime policy ALLOW hoặc quyền ký |
| Current policy for future intent | NOT_CHECKED | Runtime kiểm đúng nghiệp vụ khi được phép gửi, không gọi START để tạo preflight PASS |
| Native eIDCA plan | PASS dry-read `NativeEidcaHashAction/v1`, exact immutable revision | Không có external Provider call/credential read; không chứng minh signer/certificate authority |
| Active manifest / admission cohort | BLOCKED_CONFIG | Existing owner activation workflow exact profile/policy/artifact, không SQL, không mở cohort cũ |
| Signed verifier authority | BLOCKED_AUTHORITY | Current signed policy không có scope cho tenant/key/artifact mới này |
| Signing backend dispatch flag | PASS flag only | Local AllowDispatch vẫn false; flag không phải authorization |
| Local dispatch | BLOCKED_CONFIG, false | Chỉ enable sau authority/manifest/owner scope hợp lệ |
| Provider credential/environment qualification | NOT_CHECKED hiện hành | Kiểm service identity/Vault scope và credential owner; không suy từ HTTP metadata hoặc legacy read PASS |
| Selected certificate ownership, key-use, trust/revocation | NOT_CHECKED | Exact provider/issuer evidence, use-authority và verifier/trust source; không tạo lại enrollment mặc định |
| Device presence/capture, actual app approval | BLOCKED_OPERATOR / NOT_CHECKED | Phiên operator thực tế; không capture/AA/selfie trong preflight này |
| Real Provider signing/PDF UAT, fee | NOT_CHECKED / NOT_EXECUTED | Cần scope/certificate/authority/chi phí và quyết định Send thật; không chứng minh bằng controlled peers |

## Input/output contract

| Public input | Profile/output | Source/controlled coverage | Current real Provider coverage |
|---|---|---|---|
| FILE/PDF | PADES_B_B / ARTIFACT | PAdES engine + independent retained TEST PDF verification PASS | NOT_EXECUTED trên tenant/Provider này |
| FILE/XML | XMLDSIG_RSA_SHA256 / ARTIFACT | Source capability, controlled independent XML vectors positive/tamper/revoked PASS | NOT_EXECUTED |
| FILE/BINARY | CMS_DETACHED / ARTIFACT (result CMS) | Source capability, controlled detached CMS vectors positive/wrong input/revoked PASS | NOT_EXECUTED |
| HASH/CMS DOCUMENT_DIGEST | CMS_DETACHED / SIGNING_MATERIAL | Public typed hash input + material lifecycle source; raw material verifier only | NOT_EXECUTED; không hứa assembled PDF |
| HASH/CMS CMS_SIGNED_ATTRIBUTES | Exact signed attrs + context, CMS_DETACHED / SIGNING_MATERIAL | SDK/journal contract; phải exact DER attrs và selected cert, không hash PDF rồi giả attrs | NOT_EXECUTED, không tạo sample giả cryptographic context |
| HASH/XML XML_SIGNED_INFO | Exact canonical SignedInfo/references/context | SDK source/input guards; independent XML artifact vectors không đồng nghĩa mode này UAT | NOT_EXECUTED |
| HASH → PDF artifact trực tiếp | UNSUPPORTED public packaging choice này | Dùng FILE/PDF engine hoặc actual caller packaging theo contract | Không đổi mode âm thầm |

Capability theo profile/Provider có thể hẹp hơn schema chung. Không ép cả bốn Method vào flow CCCD_NFC. `SIGNING_MATERIAL` không phải completed PDF artifact. Independent trust verification không cấp ownership/use permission. Các kết quả `negative PASS`, schema PASS, retained TEST crypto PASS và native fixture PASS được tách trong `evidence/test-results.json`; tất cả Real Provider/physical UAT giữ NOT_EXECUTED.
