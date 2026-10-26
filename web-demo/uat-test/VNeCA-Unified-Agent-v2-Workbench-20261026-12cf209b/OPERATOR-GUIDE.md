# Operator setup, không đẩy internal flow cho người ký

Control plane TEST thực tế: `https://127.0.0.1:29443`. Tenant cố định `ten_2990dee8-2d4c-4c27-b542-af46ebf5edc3`. Nhãn environment `production` và endpoint sandbox của Owner được giữ nguyên; không tự đổi endpoint, credential reference hoặc publish Provider revision.

| Hạng mục | Workflow thật / điều kiện đầu ra |
|---|---|
| Operator login | POST `/v1/auth/login`, username/password thực trong Local Vault. JWT admin riêng; không dùng làm Agent caller |
| Read exact gates | GET `/v1/admin/tenants/{tenant}/agent-preflight`, quyền `tenant.method.read`, global unexpired admin, không impersonation/customer JWT. Request-bound S2S tới Tenant/Signing, không public customer diagnostics |
| Mapping/native plan | GET method-providers, Provider APIs/flows, native-provider-readiness trong folder 01. Đọc revision/hash thật; không chỉ đọc label trên UI |
| Managed Agent provisioning | POST `/v1/admin/tenants/{tenant}/agent-installations`, folder 90. Existing parent/customer, approved Agent/public key, proof-of-possession và pinned business/Provider revisions. Tạo profile/registration/caller bằng workflow audited; không SQL/JWT giả |
| Binding publication | POST `/v1/admin/tenants/{tenant}/native-bindings/{flow}:publish`, expected version + exact plan pins. Owner review exact diff trước publish; không đổi Provider endpoint bằng seed |
| Copy policy | POST `/v1/admin/tenants/{tenant}/agent-copy-profiles`, exact allowlist/hash. Không phải signing-use hoặc verifier authority |
| Activation/cohort | Existing signing activation owner CLI/workflow, không public endpoint giả. Xác minh validated manifest/profile/policy/artifact + signed verifier authority, pointer/cohort exact scope trước enable. Diagnostics chỉ đọc, không activate |
| Credential / signer enrollment | Provider/issuer evidence workflow hiện hữu, exact fingerprint/SPKI/identity/tenant/environment. Không suy từ certificate còn hạn hoặc Vault đọc được |
| Signing-use | Key custodian/provider owner workflow và audit, exact signer/key/method/purpose/window. Caller grant không thay quyền dùng khóa |
| Verifier/trust/revocation | Signed Platform verifier policy + trust source/chain/current CRL hoặc đúng contract OCSP. Không tự ký policy/grant hoặc dùng lại quyền cohort TEST cũ |

Request ghi chỉ chạy khi `operator_once` bằng chính tên request và `operator_prepared_json` chứa command đã được review. Không Run folder 90. Credential/admin/grant bytes không đưa vào JSON environment hoặc evidence. Owner workflow chỉ-CLI/approval không bị ngụy trang thành request Postman.

Chuẩn bị access bằng helper thật (không HTTP nếu không nói khác):

```powershell
# Real login duy nhất, file tài khoản bảo vệ đã có. stdout chỉ path/expiry.
node --use-system-ca prepare-private.mjs operator-access C:/protected/existing-accounts.json poc.ui.platform
# Đọc file output local vào Vault vneca-operator-jwt. Không dùng JWT đó cho Customer.

# Sign PoP với authentication private key hiện hữu; không tạo key/grant.
node prepare-private.mjs installation-command C:/protected/exact-command.json C:/protected/existing-authentication-key.pem
# Đưa command output vào request PROVISION_EXISTING_AGENT, chỉ Send khi scope/parent/window hợp lệ.

# Sau successful installation, lưu connection response bảo vệ rồi decrypt đúng scope:
node prepare-private.mjs open-caller C:/protected/connection.json C:/protected/existing-authentication-key.pem ten_2990dee8-2d4c-4c27-b542-af46ebf5edc3 agent_uat01_eidca_local
```

Exact `AgentInstallationProtocol.Command` fields: commandId, tenantId, flowId, parentCredentialId, customerUserId, agentId, agentVersion, businessFlowRevision, businessFlowHash, providerFlowRevision, providerFlowHash, issuedAt, expiresAt; publicKeyPem được derive từ key hiện hữu. Các ID/hash phải lấy từ effective config/owner evidence, không tự tạo fixture thay quyền. Output wrapper chứa command + proof đúng protocol. Connection decrypt kiểm tenant/Agent/SPKI/expiry, không chứng minh authorization runtime; gọi preflight để kiểm grant. File output nằm `%LOCALAPPDATA%/VNeCA/Postman/Workbench/<uuid>` với ACL Windows user + SYSTEM.

Hiện chưa thể chuẩn bị command cấp thật vì parent/window/scope mới cần được xác minh và nhiệm vụ này không yêu cầu tạo authority. Local caller cũ đã hết hạn; registration/profile cũ không được đổi tenant để cứu phiên. Server đang thuộc closed software cohort và không có installation cho tenant này; giữ nguyên runtime đó. Operator phải provision installation Server riêng khi có quyền/scoped parent hợp lệ, không tái kích hoạt closed cohort.

Nguồn thực thi activation/current owner workflows xem source đang chạy và diagnostic code trong `evidence/runtime-preflight.json`. Khi không có quyền hoặc API đọc cho một issuer/use/trust, output phải `NOT_CHECKED`/`BLOCKED_AUTHORITY`, không tự sinh xác nhận.

`collect-cardinality.mjs <tenant> <canonical-root>` chạy read-only trên đúng Docker TEST `vneca-unified-test-postgres-1`, kiểm network internal và scope trước SQL parameter-safe/bounded. Nó không provision hoặc sửa DB, không đọc secret, không tuyên bố key-action receipt. Nếu không có quyền Docker/DB, operator lấy cùng metadata từ owner có quyền; customer không chạy helper này. Giữ snapshot trước/sau, exact Provider operation handle/receipt từ owner audit và independently verified result. Một attempt không chứng minh một key action, và Billing có eventual delivery nên cần đối soát event-ID/quantity thay vì chỉ đếm root.
