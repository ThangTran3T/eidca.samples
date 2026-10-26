# Contract và recovery theo source

Customer wire dùng validator shipping `sdk/server-agent/src/unified/Contract.ts` và `contract.generated.ts`; cùng contract với Local. Collection nhúng bản validator build từ source, không tải thư viện/schema lúc Send. Headers `X-VNeCA-Workbench-*` chỉ là metadata template, bị xóa trước HTTP.

| Trường/phạm vi | Semantics thực tế |
|---|---|
| START `idempotency_key` | Cố định cho một intent. Journal dedup theo `start + scopeHash + key`; scope gồm tenant/caller principal/registered Agent/binding/environment |
| START intent | Hash canonical `agent-signing-intent/v2` + request bỏ `interaction`; key/input/identity/profile/output/selection nằm trong intent. Workbench giữ nguyên **toàn body**, kể cả interaction |
| CONTINUE/CANCEL key | Key mới cho một logical command mới; domain command + scope + signing_id + key. Replay đúng command giữ nguyên key/body/token/reply, không lấy token mới thay vào request cũ |
| continuation | Claim một lần, gắn protected presentation/fence/canonical root/action revision/attempt/caller. Hết hạn không quá 300 giây và hạn caller. `CHOICE.option_reference` opaque thuộc options hiện tại |
| `signing_id` | Opaque Agent session persistent, không phải ID canonical Platform. Tenant derive internal owner idempotency key từ scope + public START key, không yêu cầu khách chọn flow |
| `request_id` | Correlation của response, không phải dedup key. Cached response có thể giữ request_id cũ. `X-VNeCA-Request-Id` transport nonce mới trên mỗi HTTP, không tạo transaction mới |
| STATUS/RESULT | Không có idempotency_key, giữ signing_id gốc. Current caller vẫn được kiểm quyền kể cả đọc/replay. STATUS có thể reconcile tác vụ gốc; không là START mới |
| STATUS handle | Recovery/cancel-only; không dùng nó để dựng lại CONTINUE lựa chọn cũ |

Hai SDK đã sửa gap cache ACTION_REQUIRED có continuation hết hạn: chỉ refresh **unconsumed METHOD/CA/CERTIFICATE choice**, owner STATUS còn cùng root/actionRevision/attempt/state, caller hiện hành có STATUS. Không refresh device ceremony, hosted approval, factor/interaction, consumed claim hoặc fence đã đổi. Cần đọc trạng thái/operator reconciliation nếu không đáp ứng; không tự cấp lại approval.

HTTP của response được đối chiếu trực tiếp `publicErrorHttpStatus` trong generated contract; `PROCESSING` dùng 202, các non-failure còn lại 200. FAILED/schema hợp lệ vẫn là business failure đỏ. Chỉ negative test có expected refusal trong harness mới được ghi negative PASS; không đổi nó thành signing PASS.

| Ca | Thao tác/mức bằng chứng |
|---|---|
| A first START | Manual 03 START, khóa body/key trước HTTP. Runtime thật chưa ký trong nhiệm vụ này |
| B exact START replay | 10 RETRY START, nguyên private raw; không sinh key tại Send |
| C same key changed intent | Bị chặn live; journal/facade harness kiểm đúng conflict. Không fault vào CA thật |
| D independent key | NEW với case/run khác, không dùng để cứu response mất |
| E processed CONTINUE replay | 11 replay exact stored command; `replay_command_ordinal` là chỉ số commands 1-based hiển thị trong summary, blank chọn lastMutation |
| F lost START response | Nếu chưa có signing_id, chỉ exact START replay. Không tự retry; không suy FAILED network là chưa admission |
| G lost CONTINUE/dispatch | STATUS original session trước; exact replay khi phù hợp. Controlled owner harness đối soát original-handle recovery và cardinality |
| H repeated STATUS | Không key mới; tôn trọng poll delay, không auto loop |
| I repeated RESULT | Original signing_id, stable result digest/profile/certificate; artifact độc lập verify |
| J cancellation phases | Harness trước effect/pending/terminal; PROCESSING chưa phải CANCELLED, không đảo committed result |
| K expired/revoked caller | Current policy kiểm cả cache replay/read; không token giả, không đổi caller/tenant để né |
| L stale/cross-tenant choice | Wrong namespace/opaque option/fence bị từ chối; SDK owner tests tách khỏi registry tests |

Registry metadata không giữ START input/identity hoặc token. Local Vault giữ original START và từng mutation có claim; cần retained bytes để retry sau process/Postman restart. Đừng export Vault. Namespace bao gồm Agent origin/kind, tenant, binding, environment và caller **Vault slot**, không bao gồm runtime revision để compatible restart vẫn recover được. Runtime vẫn xác minh principal thật; thay token sang principal khác không chuyển ownership. Registry từ chối cấu trúc/field lạ/prototype injection, giới hạn 100 phiên và 1000 commands/events mỗi phiên.

Revision/build trong session/events lấy từ operator snapshot của environment (`running_revision`, `agent_artifact_sha256`), không phải cryptographic runtime attestation trong response signing. Kiểm preflight/runtime fingerprint lại sau deployment rồi cập nhật metadata trước phiên; đổi build không cho phép đổi tenant/caller/binding hoặc dựng lại request cũ. Artifact đang chạy và source từng service được ghi riêng trong evidence runtime.

Timeout được ghi trước HTTP là command pending. STATUS không đè pending CONTINUE bằng cancel-only handle. Replay acknowledgement cũ không xóa mutation mới đang chưa rõ hoặc làm COMPLETED/CANCELLED lùi về action cũ. Export được whitelist metadata; digest là checksum, không phải ownership proof. Đây là workbench state, không thay journal/idempotency/authority của Agent hoặc owner.

Source: `sdk/{local-agent/VNeCA-Plugin/UnifiedSigning,server-agent/src/unified}/{SessionJournal,SessionFacade}`, `backend/services/tenant-service/.../NativeTransactionCallerController`, generated public contract. Scope/timestamp hiện hành trong evidence runtime có ưu tiên hơn environment snapshot đã import từ trước.
