import { renderMarkdown } from './markdown.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const S = {
  env: localStorage.getItem('uat.env') === 'SERVER' ? 'SERVER' : 'LOCAL',
  page: location.hash.slice(1) || 'overview',
  meta: null,
  st: null,
  uat: null,
  log: [],
  form: {},
  out: { operator: {}, op: null, verify: null, material: null },
  docName: 'QUICK-START-VI.md',
  docText: '',
  candidates: null,
  pending: false,
  pollUntil: 0,
  openCases: new Set(),
};

const PAGES = [
  ['overview', 'Tổng quan'],
  ['vault', 'Bước 1 · Nạp access'],
  ['preflight', 'Bước 2 · Preflight'],
  ['session', 'Bước 3 · Tạo & khóa phiên'],
  ['send', 'Bước 4 · Send & tiếp tục'],
  ['recovery', 'Bước 5 · Khi lỗi'],
  ['verify', 'Bước 6 · Lưu & verify'],
  ['uat', 'Kịch bản UAT'],
  ['log', 'Nhật ký'],
  ['docs', 'Tài liệu gói'],
];

const PREFLIGHT_VARS = ['installation_binding', 'installation_environment', 'agent_id', 'agent_version', 'authentication_key_id', 'profile_revision', 'policy_revision', 'caller_grant_id', 'policy_hash', 'verifier_artifact', 'finalization_mode', 'owner_signature_profile', 'verifier_revision', 'running_revision', 'agent_artifact_sha256'];
const READ_VARS = ['operator_provider_id', 'operator_provider_revision', 'operator_provider_hash', 'canonical_transaction_id', 'operator_flow_id'];
const SESSION_STATES = ['NEW', 'LOCKED', 'ACTION_REQUIRED', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

const NEXT_VI = {
  'Evidence retained; STATUS/RESULT still allowed': 'Đã đóng sổ — vẫn được 07 STATUS / 08 RESULT phiên gốc',
  'STATUS first, or explicit exact mutation replay': '07 STATUS trước, hoặc 11 REPLAY đúng command cũ (Bước 5)',
  'Retry original request only after checking dependency/state': 'Chỉ gửi lại đúng request gốc sau khi kiểm dependency/trạng thái',
  'Operator must resolve refusal; no automatic retry': 'Operator phải xử lý nguyên nhân từ chối; không tự retry',
  '02 Lock intent': '02 LOCK original intent (Bước 3)',
  '03 START (after full Operator preflight)': '03 START sau khi đã chạy đủ Operator preflight (Bước 4)',
  'Read action; select current option index or complete real interaction': 'Đọc action; chọn chỉ số option hiện tại hoặc hoàn tất tương tác thật',
  'STATUS after poll delay': '07 STATUS sau poll delay',
  'RESULT; independent verification and Operator cardinality': '08 RESULT; verify độc lập (Bước 6) và Operator đối soát cardinality',
  'Read evidence / original session': 'Đọc evidence / phiên gốc',
};

// Explanations for refusals produced before any HTTP (website, session-state.cjs, vault).
const REFUSALS = {
  MANUAL_SEND_ONCE_REQUIRED: 'send_once chưa đúng. Gõ chính xác: {detail}. Đây là chống bấm nhầm, không phải authorization.',
  OPERATOR_PREFLIGHT_REQUIRED_SEE_MATRIX: 'Preflight đang NOT_CHECKED — START chưa được gửi. Chạy 01 Complete scoped preflight ở Bước 2.',
  COMPLETE_REAL_APPROVAL_FIRST: 'Hoàn tất phê duyệt thật trên UI/app tin cậy rồi tích xác nhận trước khi gửi 06.',
  WAIT_SERVER_POLL_DELAY: 'Chưa hết poll_after_ms (còn khoảng {detail} ms). Chờ rồi bấm lại — website không tự poll.',
  CURRENT_AGENT_CALLER_ACCESS_REQUIRED_NOT_ADMIN_OR_BROWSER_TOKEN: 'Chưa có caller agc_ hợp lệ trong Vault cho environment này (Bước 1). Không dùng JWT admin/portal.',
  SESSION_ALREADY_EXISTS_SELECT_IT: 'case/run hoặc key đã tồn tại trong environment này — dùng 00.2 SELECT.',
  INVALID_CASE_RUN_OR_KEY: 'case_id/run_id chỉ gồm chữ, số, . _ - (≤ 96 ký tự); key tối thiểu 8 ký tự.',
  INSTALLATION_CONTEXT_REQUIRED: 'Thiếu tenant/binding/environment/caller slot của installation.',
  WRONG_AGENT_ORIGIN: 'Origin Agent khác endpoint đã đo trong gói.',
  SELECT_EXACT_EXISTING_SESSION: 'Không tìm thấy đúng một phiên với case/run này trong environment hiện tại.',
  SESSION_CONTEXT_MISMATCH: 'Phiên không thuộc Agent/tenant/binding/environment/caller slot hiện tại.',
  NO_SELECTED_SESSION_USE_NEW_OR_SELECT: 'Chưa chọn phiên — dùng 00.1 NEW hoặc 00.2 SELECT (Bước 3).',
  FOLDER_METHOD_DOES_NOT_MATCH_SELECTED_SESSION: 'Method khác Method đã khóa của phiên.',
  UNKNOWN_METHOD: 'Method không hợp lệ.',
  INTENT_ALREADY_LOCKED: 'Intent đã khóa. Muốn nghiệp vụ khác phải tạo case/run/key khác có chủ đích.',
  UNSUPPORTED_SERVER_HARDWARE: 'Server Agent không hỗ trợ CCCD_NFC/USB_TOKEN (phần cứng phía client, không relay Local).',
  CA_SELECTION_ONLY_ESIGN: 'Chỉ APP_CA_REMOTE_SIGNING (eSIGN) được chọn CA.',
  PROVIDER_IS_RESOLVED_BY_PLATFORM: 'Provider do Platform resolve; khách hàng không chọn Provider.',
  INTERNAL_FIELD_IN_CUSTOMER_START: 'START chứa trường nội bộ (flow/binding/tenant) — không được phép.',
  PRIVATE_INPUT_NOT_IN_VAULT: 'Chưa nạp tài liệu riêng vào Vault.',
  SIGNING_IDENTITY_NOT_IN_VAULT: 'Chưa nạp danh tính signer (vneca-signing-identity) ở Bước 1.',
  CONTRACT_REQUEST_INVALID: 'Request không qua validator contract. {detail}',
  INPUT_COMBINATION_NOT_IN_MATRIX: 'Tổ hợp input/profile/output không có trong ma trận (samples/inputs.json).',
  UNKNOWN_SAMPLE_INPUT: 'Mẫu input không tồn tại.',
  LOCK_INTENT_FIRST: 'Phiên chưa LOCK intent (Bước 3).',
  PRIVATE_PENDING_MUTATION_RECONCILE_FIRST: 'Còn mutation chưa rõ kết quả — đối soát bằng 07 STATUS / 11 REPLAY trước khi CLOSE.',
  UNCERTAIN_SESSION_RECONCILE_FIRST: 'Phiên còn command chưa rõ kết quả — đối soát trước khi CLOSE.',
  HARNESS_CASE_ONLY_NO_LIVE_FAULT_INJECTION: 'Ca C chỉ chạy trong harness kiểm soát; không bơm lỗi vào Provider thật.',
  NO_SIGNING_ID_RETRY_ORIGINAL_START_ONLY: 'Chưa có signing_id — chỉ được 10 RETRY original START.',
  NO_CURRENT_CONTINUATION: 'Phiên không có continuation hiện hành.',
  PENDING_MUTATION_READ_STATUS_OR_REPLAY_EXACT_REQUEST: 'Có mutation đang chờ — đọc 07 STATUS hoặc 11 REPLAY đúng command cũ.',
  CONTINUATION_EXPIRED_READ_ORIGINAL_SESSION: 'Continuation hết hạn — đọc 07 STATUS phiên gốc.',
  REAL_INTERACTION_COMPLETION_REQUIRED: 'Action hiện tại không phải hosted approval thật.',
  COMPLETION_NOT_CURRENT_SESSION: 'Completion reference không thuộc phiên hiện tại.',
  NO_SELECTABLE_CURRENT_ACTION: 'Action hiện tại không có lựa chọn.',
  COMPLETE_REAL_HOSTED_INTERACTION_FIRST: 'Action này là hosted approval — dùng 06 CONTINUE sau khi hoàn tất thật.',
  EXPLICIT_CURRENT_OPTION_INDEX_REQUIRED: 'Chọn chỉ số option (1-based) của response hiện tại.',
  NO_ORIGINAL_MUTATION: 'Không có command CONTINUE/CANCEL gốc ở vị trí này để replay.',
  SESSION_CLOSED_EVIDENCE_RETAINED: 'Phiên đã đóng — chỉ còn STATUS/RESULT.',
  BUSY_ANOTHER_REQUEST_IN_FLIGHT: 'Đang có request khác chạy — chờ xong.',
  PRIVATE_SESSION_STATE_MISSING: 'Không tìm thấy state riêng (frozen request) của phiên.',
  PRIVATE_SESSION_MISMATCH: 'State riêng không khớp registry.',
  LOCKED_INTENT_CHANGED: 'Intent đã khóa bị thay đổi — từ chối.',
  PRIVATE_VAULT_OR_SESSION_VALIDATION_FAILED: 'Kiểm tra Vault/phiên thất bại; phiên gốc được giữ nguyên.',
  NO_COMPLETED_RESULT_IN_MEMORY_SEND_08_RESULT: 'Chưa có RESULT COMPLETED trong bộ nhớ server — bấm 08 RESULT trước (Bước 4).',
  NO_CURRENT_HOSTED_APPROVAL: 'Không có hosted approval hiện hành.',
  HOSTED_APPROVAL_EXPIRED_READ_ORIGINAL_SESSION: 'Hosted approval đã hết hạn — đọc STATUS phiên gốc, không tự làm mới.',
  OPERATOR_CREDENTIALS_NOT_IN_VAULT: 'Chưa nạp username/password operator vào Vault (Bước 1).',
  REAL_OPERATOR_LOGIN_REQUIRED: 'Chưa có JWT operator — 00 LOGIN hoặc nạp operator-jwt.txt.',
  EXACT_MANUAL_OPERATOR_ONCE_REQUIRED: 'operator_once phải bằng đúng tên request: {detail}.',
  OWNER_REVIEWED_SCOPE_CONFIRMATION_REQUIRED: 'Xác nhận owner đã review exact scope/diff trước khi gửi ghi.',
  REAL_WORKFLOW_PREPARED_JSON_POP_REQUIRED: 'Cần JSON đã chuẩn bị bằng workflow thật (command + PoP).',
  WRONG_MEASURED_TEST_CONTROL_PLANE: 'Control plane khác endpoint đã đo.',
  JWT_IS_NOT_AGENT_CALLER_ACCESS: 'Đây là JWT, không phải caller agc_. Không dùng JWT admin/portal làm customer bearer.',
  CALLER_FORMAT_AGC_64_HEX_REQUIRED: 'Caller phải có dạng agc_ + 64 ký tự hex.',
  JWT_FORMAT_REQUIRED: 'Giá trị không phải JWT.',
  AGENT_CALLER_IS_NOT_OPERATOR_JWT: 'Caller agc_ không phải JWT operator.',
  IDENTITY_JSON_REQUIRED: 'Danh tính phải là JSON.',
  IDENTITY_UNKNOWN_FIELD: 'Danh tính chỉ gồm subject_ref / national_id.',
  IDENTITY_STRING_VALUES_REQUIRED: 'Giá trị danh tính phải là chuỗi không rỗng.',
  EMPTY_VALUE: 'Giá trị rỗng.',
  ABSOLUTE_PATH_REQUIRED: 'Cần đường dẫn tuyệt đối.',
  FILE_NOT_FOUND: 'Không tìm thấy file.',
  FILE_TOO_LARGE: 'File quá lớn.',
  FILE_READ_FAILED: 'Không đọc được file (quyền truy cập?).',
  FILE_REQUIRED: 'Thiếu file (đường dẫn tuyệt đối): {detail}.',
  WINDOWS_POWERSHELL_REQUIRED: 'verify-result.ps1 cần Windows PowerShell.',
  JAVA_HOME_JDK21_REQUIRED: 'JavaHome phải là thư mục JDK21 (có bin/).',
  FORMAT_PDF_CMS_XML_REQUIRED: 'Format phải là PDF, CMS hoặc XML.',
  ARTIFACT_ENCODING_OR_SHA256_MISMATCH: 'Artifact không khớp SHA256 trong response — không ghi file.',
  PDF_ARTIFACT_PROFILE_MISMATCH: 'Artifact PDF/profile không khớp — không ghi file.',
  NOT_A_PDF_FILE: 'File không bắt đầu bằng %PDF-.',
  XML_SIGNED_INFO_REQUIRES_SDK_CONTEXT: 'XML HASH cần SignedInfo/context thật từ SDK — không tự tạo.',
  NO_OPERATOR_RESPONSE_YET: 'Chưa có kết quả operator nào trong environment này.',
  NO_SAVED_RESULT_YET: 'Chưa lưu kết quả nào ở Bước 6.',
  NO_SELECTED_SESSION: 'Chưa chọn phiên.',
};

// Agent public error codes → next action (QUICK-START §5).
const ERROR_GUIDE = {
  UNAUTHENTICATED: 'Caller thiếu/không hợp lệ. Operator sửa access bằng workflow thật; giữ nguyên phiên, không đổi tenant để lấy kết quả.',
  FORBIDDEN: 'Caller hết hạn/revoked hoặc không có quyền. Operator sửa access bằng workflow thật; giữ nguyên phiên. Nếu đây là ca K (caller hết hạn) thì đây là từ chối đúng kỳ vọng — ghi NEGATIVE_PASS, không phải signing PASS.',
  AUTHORIZATION_FAILED: 'Như 401/403: operator xử lý access; không đổi tenant/caller để né.',
  CAPABILITY_NOT_READY: 'Operator xem exact activation/profile/cohort/capability. Không retry tự động.',
  DEPENDENCY_UNAVAILABLE: 'Xem owner code/runtime và đối soát trước; chỉ retry đúng request khi dependency đã phục hồi. Recovery không phải quyền tự ký lại.',
  TIMEOUT: 'Kết quả có thể chưa rõ: 07 STATUS (nếu đã có signing_id) hoặc 10 RETRY original START. Không NEW.',
  RATE_LIMITED: 'Chờ rồi gửi lại đúng request (RETRY_SAME_REQUEST).',
  CONTINUATION_EXPIRED: 'Continuation hết hạn: 07 STATUS phiên gốc. Approval đã claim/hết hạn không được tự làm mới.',
  SESSION_EXPIRED: 'Phiên hết hạn: đọc STATUS/RESULT phiên gốc; không tạo START mới để thay thế.',
  CONFLICT: 'Cùng key nhưng intent/command khác. Không đổi intent; nghiệp vụ khác thì NEW case/run/key có chủ đích.',
  POLICY_DENIED: 'Policy hiện hành từ chối intent. Operator kiểm policy; không đổi intent để né.',
  CERTIFICATE_INELIGIBLE: 'Certificate không đủ điều kiện cho intent này — kiểm với owner credential.',
  CERTIFICATE_TRUST_FAILED: 'Certificate không qua trust/revocation — kiểm chain/CRL với owner.',
  INPUT_UNSUPPORTED: 'Capability hiện tại không hỗ trợ tổ hợp input/profile/output này.',
  INVALID_REQUEST: 'Request bị Agent từ chối do không hợp lệ.',
  PAYLOAD_TOO_LARGE: 'Input vượt giới hạn inline của runtime.',
  RESULT_UNAVAILABLE: 'Kết quả chưa có/không còn: đọc 07 STATUS.',
  DATA_EXPIRED: 'Dữ liệu kết quả đã hết thời hạn lưu giữ.',
  SIGNATURE_INVALID: 'Chữ ký không hợp lệ theo kiểm tra của owner.',
  ARTIFACT_INVALID: 'Artifact không hợp lệ theo kiểm tra của owner.',
  INTERNAL_ERROR: 'Lỗi nội bộ: đối soát với owner trước khi thao tác tiếp.',
};

const RECOVERY_TABLE = [
  ['Mất response START, chưa biết signing_id', '10 RETRY original START, cùng key/body đã khóa. Không NEW, không đổi intent', 'recovery'],
  ['Mất response CONTINUE/dispatch', '07 STATUS cùng signing_id; nếu cần replay thì 11 REPLAY CONTINUE/CANCEL dùng nguyên command cũ', 'send'],
  ['401/403, caller hết hạn/revoked', 'Operator sửa access bằng workflow thật. Giữ nguyên phiên; không đổi tenant để lấy kết quả', 'vault'],
  ['422 CAPABILITY_NOT_READY', 'Operator xem exact activation/profile/cohort/capability. Không retry tự động', 'preflight'],
  ['503 DEPENDENCY_UNAVAILABLE', 'Xem owner code/runtime và đối soát trước; chỉ retry đúng request khi dependency đã phục hồi', 'preflight'],
  ['Continuation hết hạn', 'STATUS phiên gốc; SDK chỉ refresh lựa chọn chưa claim khi owner fence còn khớp', 'send'],
  ['Sai option/tenant/session', 'Dừng; chọn đúng phiên và options hiện hành. Không sửa opaque token', 'session'],
];

const CONTRACT_CASES = [
  ['A', 'First START', 'Manual 03 START, khóa body/key trước HTTP'],
  ['B', 'Exact START replay', '10 RETRY START, nguyên private raw; không sinh key tại Send'],
  ['C', 'Same key changed intent', 'Bị chặn live; chỉ harness journal/facade kiểm conflict'],
  ['D', 'Independent key', 'NEW với case/run khác, không dùng để cứu response mất'],
  ['E', 'Processed CONTINUE replay', '11 REPLAY exact stored command; ordinal 1-based, trống = lastMutation'],
  ['F', 'Lost START response', 'Chưa có signing_id: chỉ exact START replay; không tự retry'],
  ['G', 'Lost CONTINUE/dispatch', 'STATUS phiên gốc trước; exact replay khi phù hợp'],
  ['H', 'Repeated STATUS', 'Không key mới; tôn trọng poll delay, không auto loop'],
  ['I', 'Repeated RESULT', 'Signing_id gốc; digest/profile/certificate ổn định; verify độc lập'],
  ['J', 'Cancellation phases', 'PROCESSING chưa phải CANCELLED; không đảo committed result'],
  ['K', 'Expired/revoked caller', 'Policy hiện hành kiểm cả replay/read; không token giả, không đổi caller/tenant'],
  ['L', 'Stale/cross-tenant choice', 'Option/fence/namespace sai bị từ chối'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const badge = (status, label) => status == null || status === '' ? '' : `<span class="badge b-${String(status).replace(/[^A-Za-z_]/g, '')}">${esc(label ?? status)}</span>`;
const fmtTime = iso => (iso ? new Date(iso).toLocaleString('vi-VN', { hour12: false }) : '—');
const short = (s, n = 12) => (s ? String(s).slice(0, n) + (String(s).length > n ? '…' : '') : '—');
const jsonBlock = x => `<pre class="json">${esc(JSON.stringify(x, null, 2))}</pre>`;
const dis = () => (S.pending ? 'disabled' : '');

function explain(code, detail) {
  const key = Object.keys(REFUSALS).find(k => code === k || String(code).startsWith(k + ' '));
  const text = key ? REFUSALS[key] : '';
  return text.replace('{detail}', detail == null ? '' : String(detail));
}

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = 'toast'), 4500);
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function api(path, { json, raw, text } = {}) {
  const headers = { 'X-UAT-Workbench': '1' };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    headers['Content-Type'] = 'application/octet-stream';
    body = raw;
  }
  const res = await fetch(path, { method: body !== undefined ? 'POST' : 'GET', headers, body });
  if (text) return res.text();
  const data = await res.json().catch(() => ({ ok: false, error: 'BAD_RESPONSE' }));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

function applyState(st) {
  S.st = st;
  S.pollUntil = st.selected?.pollWaitMs ? Date.now() + st.selected.pollWaitMs : 0;
}

async function loadState() {
  applyState(await api('/api/state?env=' + S.env));
}

async function busy(fn) {
  if (S.pending) return;
  S.pending = true;
  render();
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    S.pending = false;
    render();
  }
}

// Bound inputs. Secrets typed here are cleared right after they are sent to the local server.
function inputField(key, label, { type = 'text', placeholder = '', def = '', hint = '', mono = false } = {}) {
  const val = S.form[key] ?? def ?? '';
  return `<label class="f"><span>${esc(label)}</span><input type="${type}" data-f="${esc(key)}" value="${esc(val)}" placeholder="${esc(placeholder)}" class="${mono ? 'mono' : ''}" autocomplete="off" spellcheck="false">${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</label>`;
}
function selectField(key, label, options, def) {
  const val = S.form[key] ?? def;
  return `<label class="f"><span>${esc(label)}</span><select data-f="${esc(key)}" data-rerender="1">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function textareaField(key, label, placeholder = '') {
  return `<label class="f"><span>${esc(label)}</span><textarea data-f="${esc(key)}" placeholder="${esc(placeholder)}" spellcheck="false">${esc(S.form[key] ?? '')}</textarea></label>`;
}
function checkField(key, label) {
  return `<label class="check"><input type="checkbox" data-f="${esc(key)}" ${S.form[key] ? 'checked' : ''}><span>${esc(label)}</span></label>`;
}
function onceField(op, ref) {
  const code = ref + ':' + op;
  return `${inputField('once.' + op, 'send_once', { placeholder: code, mono: true })}<div class="small muted">Gõ chính xác <span class="once">${esc(code)}</span> — mỗi lần Send tiêu thụ một lần.</div>`;
}
function testsList(tests) {
  if (!tests?.length) return '';
  return `<ul class="tests">${tests.map(t => `<li class="${t.pass ? 'ok' : 'ko'}">${esc(t.name)}${t.detail ? ` <span class="muted small">(${esc(t.detail)})</span>` : ''}</li>`).join('')}</ul>`;
}
function transportNote(t, { session = true } = {}) {
  const advice = t.tls
    ? 'TLS bị từ chối. Sửa trust: chạy website bằng npm start (--use-system-ca), kiểm certificate localhost trong Windows. Không tắt verify, không dùng Ignore SSL.'
    : t.code === 'ECONNREFUSED'
      ? 'Không có tiến trình lắng nghe tại origin. Kiểm Agent/control plane đang chạy.'
      : session
        ? 'Không nhận được response — kết quả CHƯA RÕ. Chưa có signing_id: chỉ 10 RETRY original START. Đã có: 07 STATUS trước. Không NEW, không đổi intent.'
        : 'Không nhận được response.';
  return `<div class="note bad"><b>Lỗi transport ${esc(t.code)}</b> — ${esc(t.message || '')}<br>${esc(advice)}</div>`;
}
function stepper(state) {
  const idx = SESSION_STATES.indexOf(state);
  return `<div class="stepper">${SESSION_STATES.map((x, i) => `<span class="${x === state ? 'on' : i < idx && !(x === 'COMPLETED' && state === 'CANCELLED') ? 'done' : ''}">${x}</span>`).join('')}</div>`;
}
function gatesTable(pre) {
  const rows = [];
  for (const [k, g] of Object.entries(pre.transport || {})) rows.push(['transport', k, g]);
  for (const [owner, o] of Object.entries(pre.owners || {})) for (const [k, g] of Object.entries(o.gates || {})) rows.push([owner, k, g]);
  return `<div class="table-wrap"><table><thead><tr><th>Owner</th><th>Gate</th><th>Trạng thái thực thi</th><th>Vì sao / bước xử lý / bằng chứng</th></tr></thead><tbody>${rows
    .map(([owner, key, g]) => `<tr><td>${esc(owner)}</td><td class="mono">${esc(key)}</td><td>${badge(g.status)}</td><td><code>${esc(g.code)}</code>${gateEvidence(g, owner, key)}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

function gateEvidence(g, owner, key) {
  const names = { configuration: 'Cấu hình trước START', intent: 'Intent', certificate: 'Chứng thư', dispatch: 'Trước dispatch' };
  let help = '';
  if (g.code === 'SELECTED_CERTIFICATE_AND_INTENT_REQUIRED') help = 'Chưa có giao dịch/chứng thư được chọn trong phép đọc này. Dùng 01b để xem bằng chứng của giao dịch đã có; không tạo START chỉ để làm xanh bảng.';
  else if (g.code === 'PUBLISHED_POLICY_NOT_CURRENT') help = 'Policy đã publish không còn hiệu lực/không khớp scope hiện tại. Operator kiểm tra thời hạn và publish qua workflow policy hợp lệ; không sửa expiry trong DB.';
  else if (g.code === 'CONFIGURED_SCOPE_CONSISTENT_PROVIDER_ACCEPTANCE_UNPROVEN') help = 'Cấu hình endpoint/credential đã khớp, nhưng chưa có bằng chứng Provider chấp nhận credential. Đọc được Vault không chứng minh điều này; giữ nguyên xác nhận owner đã có.';
  else if (g.code === 'WORKLOAD_VAULT_RESOLUTION_FAILED') help = 'Workload không đăng nhập/đọc Vault được. Secret-store operator kiểm tra AppRole/SecretID hiện tại; không thay API key hoặc tráo reference.';
  else if (g.code === 'INTENT_TERMINAL_EVIDENCE_HISTORICAL') help = 'Giao dịch đã kết thúc. Các lớp bên dưới là bằng chứng lịch sử, không phải quyền hiện tại; không replay hoặc mở lại phiên.';
  if (owner === 'signing' && key === 'signing_use_authority') help += ' Quyền cho hành động chỉ được xác minh khi composition/approval hợp lệ ngay trước dispatch; không phải PASS trước START.';
  const layers = Object.entries(g.layers || {}).map(([name, layer]) => `<div class="mt8"><b>${esc(names[name] || name)}</b>: ${badge(layer.status)} <code>${esc(layer.code)}</code>${layer.current != null ? ` · current=${esc(layer.current)}` : ''}${layer.checkedAt ? ` · kiểm ${fmtTime(layer.checkedAt)}` : ''}${layer.validUntil ? ` · đến ${fmtTime(layer.validUntil)}` : ''}</div>`).join('');
  return `${help ? `<p class="small">${esc(help)}</p>` : ''}${layers}${g.enforcement ? `<div class="small muted mt8">Điểm thực thi: ${esc(typeof g.enforcement === 'string' ? g.enforcement : JSON.stringify(g.enforcement))}</div>` : ''}`;
}

function deferredGateHelp(pre) {
  const definitions = [
    ['tenant', 'current_policy_allow', 'RUNTIME_INTENT_AND_CURRENT_POLICY_CHECK_REQUIRED', 'Request này chỉ đọc cấu hình, chưa có intent và tài liệu cụ thể để đánh giá.', 'Platform chạy policy engine trên intent thực tế, kiểm tra đúng Method/Provider/policy/quota trước dispatch.'],
    ['signing', 'signer_key_ownership', 'EXACT_SELECTED_CREDENTIAL_OWNER_WORKFLOW_REQUIRED', 'Endpoint metadata chưa resolve issuer binding của certificate đang chọn.', 'Platform ghi nhận /eid-personal/check hoàn tất qua issuer workflow, đối chiếu exact certificate/SPKI/signer và scope hiện tại.'],
    ['signing', 'signing_use_authority', 'EXACT_SELECTED_CREDENTIAL_OWNER_WORKFLOW_REQUIRED', 'Endpoint này chưa chạy phép kiểm quyền dùng khóa cho một hành động cụ thể.', 'Workflow runtime đối chiếu signer-intent, issuer binding và trust hiện hành; operator thực hiện consent NFC/AA/camera thật khi được yêu cầu.'],
    ['signing', 'trust_revocation', 'EXACT_SELECTED_CREDENTIAL_OWNER_WORKFLOW_REQUIRED', 'Endpoint metadata chưa chạy validator trên certificate đã chọn.', 'Platform dùng source/trust policy đúng scope để kiểm tra chain, key usage và CRL/OCSP theo policy. Kết quả offline cần được nối vào workflow thật.'],
    ['signing', 'provider_credential_scope', 'EXACT_SELECTED_CREDENTIAL_OWNER_WORKFLOW_REQUIRED', 'Phép kiểm theo exact credential/intent chưa được thực hiện ở endpoint này.', 'Platform đối chiếu credential, Provider, môi trường và operation tại action boundary. Đọc được secret chưa hoàn tất phép kiểm này.'],
    ['provider', 'provider_credential_scope', 'ENDPOINT_SCOPE_OWNER_EVIDENCE_NOT_EVALUATED', 'Diagnostics chưa đối chiếu hồ sơ owner với endpoint/credential revision hiện hành.', 'Platform nối hồ sơ owner hiện hữu và bằng chứng Provider đúng scope. Không nhập lại API key hoặc xác nhận lại chỉ để đổi nhãn.'],
  ];
  const pending = definitions.filter(([owner, gate, code]) => {
    const value = pre.owners?.[owner]?.gates?.[gate];
    return value?.status === 'NOT_CHECKED' && value.code === code;
  });
  if (!pending.length) return '';
  return `<section class="note warn" id="preflight-required-checks">
    <b>${pending.length} phép kiểm chưa được endpoint metadata thực hiện</b>
    <p>Các code bên dưới là trạng thái được backend trả cố định cho phép kiểm chưa chạy. Bấm lại 01 không làm chúng PASS. Việc nối diagnostics và xử lý source/trust thuộc Platform; các phép kiểm theo giao dịch chạy trong workflow thực tế. Verdict và security gate được giữ nguyên.</p>
    <div class="table-wrap"><table><thead><tr><th>Gate</th><th>Vì sao chưa kiểm</th><th>Điều kiện để kiểm và PASS</th></tr></thead><tbody>${pending.map(([owner, gate, , why, next]) => `<tr><td><code>${esc(owner)}.${esc(gate)}</code></td><td>${esc(why)}</td><td>${esc(next)}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function localDispatchHelp() {
  const raw = S.out.operator.HEALTH_LOCAL_CONNECTION?.response;
  const value = raw?.data || raw, v = S.st.vars;
  if (S.env !== 'LOCAL' || value?.schemaVersion !== 'LocalPlatformConnection/v1'
      || value.tenantId !== v.tenant_id || value.bindingRef !== v.installation_binding
      || value.environment !== v.installation_environment || value.dispatchConfigured !== false
      || !value.blockerCodes?.includes('DISPATCH_DISABLED')) return '';
  return `<div class="note warn" id="local-dispatch-diagnostics"><b>Local chưa mở dispatch: DISPATCH_DISABLED</b><p>Kết nối và authentication đã được kiểm riêng. Gate dispatch trong bảng 01 thuộc Signing-service; Local còn có cấu hình AllowDispatch độc lập. Chỉ mở Local sau khi certificate/source/trust và quyền dùng khóa đúng scope đã đủ. Nút preflight không thay đổi cấu hình này.</p></div>`;
}

// ---------------------------------------------------------------------------
// Shared panels
// ---------------------------------------------------------------------------
function renderTop() {
  const st = S.st, sel = st?.selected?.summary, v = st?.vault || {};
  const dot = (on, label) => `<span><span class="dot ${on ? 'on' : ''}"></span>${label}</span>`;
  return `<div class="title">VNeCA Unified Agent v2 — UAT thủ công<small>Gửi từng bước bằng tay · không Runner · không auto-retry/poll/approve</small></div>
  <div class="group">Agent <div class="seg"><button data-act="env" data-env="LOCAL" class="${S.env === 'LOCAL' ? 'on' : ''}">Local</button><button data-act="env" data-env="SERVER" class="${S.env === 'SERVER' ? 'on' : ''}">Server</button></div></div>
  <div class="group">Cấu hình trước START ${badge(st?.preflight?.status || 'NOT_CHECKED')}</div>
  <div class="group">Phiên ${sel ? esc(sel.caseId + ' / ' + sel.runId) + ' ' + badge(sel.state) : '<span class="muted">chưa chọn</span>'}</div>
  <div class="group">${dot(v[st?.vars?.caller_vault_key]?.present, 'caller')} ${dot(v['vneca-signing-identity']?.present, 'identity')} ${dot(v['vneca-operator-jwt']?.present, 'operator')}</div>`;
}

function renderNav() {
  return PAGES.map(([id, label]) => (id === 'uat' ? '<div class="sep"></div>' : '') + `<button data-act="go" data-page="${id}" class="${S.page === id ? 'on' : ''}">${esc(label)}</button>`).join('');
}

function sessionPanel() {
  const sel = S.st.selected;
  if (!sel) return '<div class="card"><h3>Phiên đang chọn</h3><p class="muted">Chưa chọn phiên. Dùng 00.1 NEW hoặc 00.2 SELECT ở Bước 3.</p></div>';
  const s = sel.summary;
  const lastEv = s.events.at(-1);
  return `<div class="card">
    <div class="card-head"><h3>Phiên đang chọn — 00.3 VIEW</h3>${badge(s.state)} ${s.closed ? badge('NOT_CHECKED', 'CLOSED') : ''}</div>
    ${stepper(s.state)}
    <div class="next">Tiếp theo: ${esc(NEXT_VI[s.next] || s.next)} <span class="muted small">(${esc(s.next)})</span></div>
    ${sel.pendingMutation ? `<div class="note warn">Mutation chưa rõ kết quả <span class="mono">${esc(short(sel.pendingMutation, 20))}</span>. Đọc 07 STATUS hoặc 11 REPLAY đúng command cũ; không chọn lại/new key.</div>` : ''}
    <div class="kv">
      <div>case / run</div><div>${esc(s.caseId)} / ${esc(s.runId)}</div>
      <div>sessionRef</div><div class="mono">${esc(s.sessionRef)}</div>
      <div>startKey</div><div class="mono">${esc(s.startKey)}</div>
      <div>signing_id</div><div class="mono">${esc(s.signingId || '— (chưa admission)')}</div>
      <div>Method yêu cầu / chọn</div><div>${esc(s.methodRequested || '—')} / ${esc(s.methodSelected || '—')}</div>
      <div>Provider kỳ vọng</div><div class="mono">${esc(s.providerExpectedByRegistry || '—')} <span class="muted small">(observed ${esc(s.providerObserved)})</span></div>
      <div>Agent · tenant</div><div class="mono">${esc(s.context.agentKind)} · ${esc(s.context.tenant)}</div>
      <div>binding · environment</div><div>${esc(s.context.binding)} · ${esc(s.context.environment)}</div>
      <div>Input digest</div><div class="mono">${esc(s.inputDigest ? s.inputDigest.hex || s.inputDigest.value : '—')}</div>
      <div>Sự kiện cuối</div><div>${lastEv ? `${esc(lastEv.command)} → HTTP ${esc(lastEv.http)} ${badge(lastEv.status)} ${esc(lastEv.errorCode || '')}` : '—'}</div>
      <div>Crypto · Cardinality</div><div>${badge(s.cryptographicVerification)} ${badge(s.cardinality)}</div>
    </div>
    <details><summary>Commands (${s.commands.length}) và events (${s.events.length})</summary>
      ${commandsTable(s, false)}
      ${s.events.length ? `<div class="table-wrap"><table><thead><tr><th>Lúc</th><th>Command</th><th>HTTP</th><th>Status</th><th>Lỗi / recovery</th><th>request_id</th></tr></thead><tbody>${s.events
        .map(e => `<tr><td class="nowrap">${fmtTime(e.at)}</td><td>${esc(e.command)}</td><td>${esc(e.http)}</td><td>${badge(e.status)}</td><td class="small">${esc(e.errorCode || '')} ${esc(e.recovery || '')}${e.actionType ? ' ' + esc(e.actionType) + ' (' + e.optionCount + ')' : ''}</td><td class="mono small">${esc(short(e.responseRequestId, 18))}</td></tr>`)
        .join('')}</tbody></table></div>` : ''}
    </details>
    <div class="actions">
      <button class="btn small" data-act="wb" data-op="VIEW" ${dis()}>00.3 VIEW</button>
      <button class="btn small" data-act="wb" data-op="EXPORT" ${dis()}>00.4 EXPORT redacted</button>
      <button class="btn small danger" data-act="closeSession" ${dis()}>00.5 CLOSE</button>
    </div>
  </div>`;
}

function commandsTable(s, selectable) {
  if (!s.commands.length) return '<p class="muted small">Chưa có command.</p>';
  const cur = S.form['replay.ordinal'] ?? '';
  return `<div class="table-wrap"><table><thead><tr>${selectable ? '<th></th>' : ''}<th>#</th><th>Command</th><th>ref</th><th>Replay</th><th>Lúc</th></tr></thead><tbody>${s.commands
    .map((c, i) => {
      const replayable = ['CONTINUE', 'CANCEL'].includes(c.command);
      return `<tr class="${selectable && String(i + 1) === String(cur) ? 'sel' : ''}">${selectable ? `<td>${replayable ? `<button class="btn small" data-act="setForm" data-k="replay.ordinal" data-v="${i + 1}">Chọn</button>` : ''}</td>` : ''}<td>${i + 1}</td><td>${esc(c.command)}</td><td class="mono small">${esc(short(c.ref, 18))}</td><td>${c.replay ? 'có' : ''}</td><td class="nowrap small">${fmtTime(c.at)}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}

function responsePanel() {
  const op = S.out.op;
  const last = S.st.selected?.lastResponse;
  let html = '';
  if (op && !op.sent) {
    html += `<div class="card"><div class="card-head"><h3>Thao tác gần nhất</h3><span class="muted small">${esc(op.op)} · ${fmtTime(op.at)}</span></div>
      ${op.refused ? `<div class="note bad"><b>NOT SENT: ${esc(op.refused)}</b><br>${esc(explain(op.refused, op.detail))}</div>` : `<div class="note ok">${esc(op.message || 'Xong (thao tác local, không gửi HTTP).')}</div>`}
    </div>`;
  }
  if (!last) return html + '<div class="card"><h3>Phản hồi HTTP gần nhất</h3><p class="muted">Chưa có HTTP response cho phiên này trong lần chạy server hiện tại.</p></div>';
  const r = last.reply || {};
  const err = r.error;
  return html + `<div class="card">
    <div class="card-head"><h3>Phản hồi HTTP gần nhất</h3><span class="muted small">${esc(last.op)} · ${fmtTime(last.at)}</span>${last.http != null ? badge(last.http >= 200 && last.http < 300 ? 'PASS' : 'FAIL', 'HTTP ' + last.http) : ''} ${badge(r.status)}</div>
    ${last.transportError ? transportNote(last.transportError) : ''}
    ${(last.notes || []).map(n => `<div class="note warn small">${esc(n)}</div>`).join('')}
    ${testsList(last.tests)}
    ${last.updateError ? `<div class="note bad">Không cập nhật phiên: <span class="mono">${esc(last.updateError)}</span>. Phiên gốc giữ nguyên; dùng recovery, không START mới.</div>` : ''}
    ${err ? `<div class="note bad"><b>${esc(err.code)}</b> — ${esc(err.message)} <span class="muted small">(recovery: ${esc(err.recovery)})</span><br>${esc(ERROR_GUIDE[err.code] || '')}</div>` : ''}
    ${last.visual ? `<div class="kv small"><div>case / run</div><div>${esc(last.visual.caseId)} / ${esc(last.visual.runId)}</div><div>Key</div><div class="mono">${esc(last.visual.key)}</div><div>Session</div><div class="mono">${esc(last.visual.signingId)}</div><div>State</div><div>${badge(last.visual.state)} ${esc(NEXT_VI[last.visual.next] || last.visual.next)}</div><div>Crypto · Cardinality</div><div>${badge('NOT_CHECKED')} ${badge('NOT_CHECKED')}</div></div>` : ''}
    <details><summary>Body response (đã che token, URL, opaque reference, bytes)</summary>${jsonBlock(last.reply)}</details>
  </div>`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
function pageOverview() {
  const m = S.meta, i = m.package.integrity, rt = m.evidence.runtime, pre = rt?.operator?.preflight;
  const bad = [...i.mismatched, ...i.missing];
  const steps = [
    ['vault', 'Nạp access một lần: caller agc_, danh tính signer, operator JWT (Vault bộ nhớ).'],
    ['preflight', 'Preflight trước START: 00 LOGIN, 01 scoped preflight, 02–05 đọc mapping/metadata/native plan.'],
    ['session', 'Tạo và khóa đúng phiên: 00.1 NEW, chọn Method/input, 02 LOCK (không HTTP).'],
    ['send', 'Send và tiếp tục: 03 START, 05/06 CONTINUE, 07 STATUS, 08 RESULT, 09 CANCEL.'],
    ['recovery', 'Khi lỗi: 10 RETRY original START, 11 REPLAY command cũ, SELECT/EXPORT/CLOSE.'],
    ['verify', 'Lưu, verify độc lập và đối soát ký/tính phí trùng.'],
  ];
  return `<div class="page-head"><h2>Tổng quan</h2><p class="muted">Website thay Postman Desktop cho bộ workbench Unified Agent v2: mỗi request chỉ gửi khi bạn bấm, theo đúng thứ tự QUICK-START-VI.md.</p></div>
  <div class="note warn"><b>Trước khi gửi giao dịch:</b> environment tenant là <b>${esc(rt?.installationEnvironment || 'production')}</b>, endpoint eIDCA của Owner là <b>${esc(rt?.providerEndpoint || '')}</b>. Provider/CA thật có thể phát sinh phí chưa xác định. Có website không đồng nghĩa Provider đã sẵn sàng ký; FAILED không bao giờ là PASS.</div>
  <div class="grid2">
    <div class="card"><h3>Gói workbench</h3><div class="kv">
      <div>Thư mục</div><div class="mono">${esc(m.package.name)}</div>
      <div>Source revision</div><div class="mono">${esc(i.sourceRevision)}</div>
      <div>Đóng gói lúc</div><div>${fmtTime(i.generatedAt)}</div>
      <div>Manifest SHA256</div><div>${badge(bad.length ? 'FAIL' : 'PASS', `${i.passed}/${i.checked} file khớp`)}</div>
      <div>PDFBox SHA512</div><div>${badge(i.verifierJar === 'PASS' ? 'PASS' : 'FAIL', i.verifierJar)}</div>
      <div>Real Provider UAT</div><div>${badge('NOT_CHECKED', i.realProviderUat)}</div>
    </div>${bad.length ? `<div class="note bad">File không khớp/thiếu: ${bad.map(esc).join(', ')}</div>` : ''}</div>
    <div class="card"><h3>Website cục bộ</h3><div class="kv">
      <div>Dữ liệu phiên</div><div class="mono">${esc(m.dataDir)}</div>
      <div>Bảo vệ thư mục</div><div>${badge(/USER_SYSTEM|0700/.test(m.protection) ? 'PASS' : 'BLOCKED_CONFIG', m.protection)}</div>
      <div>TLS trust Windows</div><div>${m.useSystemCa ? badge('PASS', '--use-system-ca') : badge('FAIL', 'chưa bật --use-system-ca')}</div>
      <div>Local Agent</div><div class="mono">${esc(m.origins.LOCAL)}</div>
      <div>Server Agent</div><div class="mono">${esc(m.origins.SERVER)}</div>
      <div>Control plane</div><div class="mono">${esc(m.origins.PLATFORM)}</div>
    </div><p class="small muted">Bí mật chỉ giữ trong bộ nhớ tiến trình server, không ghi ra file, không trả về trình duyệt. Request tới Agent không có Origin/Sec-Fetch-* (như Postman native HTTP) và luôn kiểm TLS.</p></div>
  </div>
  <div class="card"><div class="card-head"><h3>Runtime evidence trong gói</h3>${badge(pre?.overall)}<span class="muted small">snapshot ${fmtTime(rt?.at)} — chạy lại Preflight ở Bước 2 để có trạng thái hiện hành</span></div>
    <div class="kv">
      <div>Tenant</div><div class="mono">${esc(rt?.tenant)}</div>
      <div>Local Agent</div><div>PID ${esc(rt?.local?.pid)} · revision <span class="mono">${esc(short(rt?.local?.sourceRevision, 12))}</span> · binding ${esc(rt?.local?.binding)} · allowDispatch ${esc(rt?.local?.allowDispatch)}</div>
      <div>Server Agent</div><div>${esc(rt?.server?.installationForFixedTenant)}</div>
      <div>Refusal thật đầu tiên</div><div>HTTP ${esc(rt?.readOnlyPublicChecks?.localExpiredCaller?.http)} ${badge('FAILED', rt?.readOnlyPublicChecks?.localExpiredCaller?.error?.code)} ${esc(rt?.readOnlyPublicChecks?.localExpiredCaller?.error?.message)}</div>
      <div>START / challenge / authority</div><div>${esc(rt?.signingStarts)} / ${esc(rt?.providerChallengeCalls)} / ${esc(rt?.authorityChanges)} · Real Provider UAT ${badge('NOT_CHECKED', rt?.realProviderUat)}</div>
    </div>
    ${pre ? gatesTable(pre) : ''}
  </div>
  <div class="card"><h3>Ma trận Method → Provider (READINESS-MATRIX)</h3><div class="table-wrap"><table><thead><tr><th>Method</th><th>Provider</th><th>Local</th><th>Server</th><th>Thiết bị/approval</th></tr></thead><tbody>${m.methods
    .filter(x => x.code !== 'AUTO')
    .map(x => `<tr><td><b>${esc(x.code)}</b><br><span class="small muted">${esc(x.label)}</span></td><td class="mono small">${esc(x.provider)}</td><td>${badge(x.local)}<div class="small">${esc(x.localNote)}</div></td><td>${badge(x.server)}<div class="small">${esc(x.serverNote)}</div></td><td class="small">${esc(x.device)}</td></tr>`)
    .join('')}</tbody></table></div></div>
  <div class="grid2">
    <div class="card"><h3>Quy trình 6 bước</h3><ol>${steps.map(([p, t]) => `<li><a href="#${p}" data-act="go" data-page="${p}">${esc(t)}</a></li>`).join('')}</ol></div>
    <div class="card"><h3>Quy tắc an toàn</h3><ul>
      <li>Mỗi request chỉ gửi khi bấm nút; không Runner, không auto-poll/auto-retry/auto-approve.</li>
      <li>Caller phải là <code>agc_</code> từ workflow installation hợp lệ; không dùng JWT admin/portal làm customer bearer.</li>
      <li>Không tắt TLS verification; sửa nguyên nhân TLS/policy/authority.</li>
      <li>Key START chỉ sinh ở 00.1 NEW; timeout không phải lý do NEW.</li>
      <li>Mutation cần <code>send_once</code> đúng phiên + operation; PASS transport/schema/health không phải signing PASS; NOT_CHECKED không phải PASS.</li>
      <li>Không nhập PIN, OTP, dữ liệu chip, selfie vào website.</li>
      <li>Chỉ chia sẻ evidence redacted (00.4 EXPORT) và kết quả verify đã loại dữ liệu nhạy cảm.</li>
    </ul></div>
  </div>`;
}

function vaultInfo(kind, info) {
  if (!info) return '';
  if (kind === 'caller') return '<div class="small">Định dạng agc_ + 64 hex hợp lệ</div>';
  if (kind === 'jwt') {
    return `<div class="small">Hết hạn: ${fmtTime(info.expiresAt)} ${info.expired ? badge('FAIL', 'ĐÃ HẾT HẠN') : badge('PASS', 'còn hạn')}${info.username || info.subject ? ` · ${esc(info.username || info.subject)}` : ''}${info.roles?.length ? ` · ${info.roles.map(esc).join(', ')}` : ''}</div>
      ${info.tenantScoped || info.impersonation ? '<div class="note bad small">Token có tenant_id/imp — không phải platform operator access hiện hành.</div>' : ''}`;
  }
  if (kind === 'identity') {
    return `<div class="small">Trường: ${info.fields.map(esc).join(', ')}${info.nationalIdShape ? ` · national_id ${esc(info.nationalIdShape)}` : ''}</div>
      ${info.subjectRefPresent ? '' : '<div class="note warn small">Thiếu <code>subject_ref</code>: schema contract hiện hành yêu cầu trường này, LOCK sẽ bị validator từ chối. QUICK-START chỉ nêu national_id — xác nhận với owner identity field đúng của profile.</div>'}`;
  }
  if (kind === 'input') return `<div class="small">${esc(info.mode)} · ${esc(info.format)} · ${esc(info.fileName || info.digestRole || '')}${info.bytes != null ? ` · ${info.bytes} bytes` : ''}</div>${info.sha256 ? `<div class="small mono">sha256 ${esc(info.sha256)}</div>` : ''}`;
  return `<div class="small">${info.length} ký tự</div>`;
}

function vaultRow(key, meta, st) {
  const used = meta.env ? (meta.env === S.env ? badge('ACTION_REQUIRED', 'dùng cho ' + meta.env) : badge('NOT_CHECKED', meta.env)) : '';
  const status = st?.present ? `${badge('PASS', 'đã nạp')} <span class="small muted">${esc(st.source)} · ${fmtTime(st.setAt)}</span>${vaultInfo(meta.kind, st.info)}` : badge('NOT_CHECKED', 'chưa nạp');
  const clear = st?.present ? `<button class="btn small danger" data-act="vaultClear" data-key="${esc(key)}">Xoá</button>` : '';
  const fileRow = `<div class="row">${inputField('vaultPath.' + key, 'hoặc đường dẫn file tuyệt đối', { placeholder: 'C:\\...\\file.txt' })}<button class="btn small" data-act="vaultFile" data-key="${esc(key)}">Nạp từ file</button>${clear}</div>`;
  let inputs;
  if (meta.kind === 'identity') {
    inputs = `<div class="row">${inputField('id.subject_ref', 'subject_ref', { type: 'password' })}${inputField('id.national_id', 'national_id (12 chữ số)', { type: 'password' })}</div>
      <div class="actions"><button class="btn primary small" data-act="vaultIdentity">Nạp danh tính</button>${clear}</div>
      <p class="small muted">Signer thật đã xác minh. Không điền synthetic identity cho CA thật.</p>`;
  } else if (meta.kind === 'input') {
    inputs = `<p class="small muted">Tải tài liệu ở Bước 3, hoặc nạp input.json do <code>prepare-private.mjs input</code> tạo:</p>${fileRow}`;
  } else {
    inputs = `<div class="row">${inputField('vault.' + key, 'Giá trị', { type: meta.kind === 'text' ? 'text' : 'password' })}<button class="btn primary small" data-act="vaultSet" data-key="${esc(key)}">Nạp</button></div>${fileRow}`;
  }
  return `<tr><td><b>${esc(meta.label)}</b><br><code>${esc(key)}</code> ${used}</td><td>${status}</td><td class="minw">${inputs}</td></tr>`;
}

function candidatesTable() {
  if (!S.candidates) return '<p class="muted small">Chưa quét.</p>';
  if (!S.candidates.length) return '<p class="muted small">Không có file phù hợp.</p>';
  const targets = name =>
    /operator-jwt/i.test(name) ? [['vneca-operator-jwt', '→ JWT operator']]
      : /caller/i.test(name) ? [['vneca-local-eidca-caller', '→ caller Local'], ['vneca-server-caller', '→ caller Server']]
        : /^input\.json$/i.test(name) ? [['vneca-private-input', '→ tài liệu riêng']] : [];
  return `<div class="table-wrap"><table><thead><tr><th>File</th><th>Sửa lúc</th><th>Nạp vào</th></tr></thead><tbody>${S.candidates
    .map(c => `<tr><td class="mono small">${esc(c.path)}</td><td class="nowrap small">${fmtTime(c.modifiedAt)}</td><td>${targets(c.name).map(([k, l]) => `<button class="btn small" data-act="vaultFileDirect" data-key="${esc(k)}" data-path="${esc(c.path)}">${esc(l)}</button>`).join(' ') || '<span class="muted small">dán thủ công ở Bước 2/90</span>'}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

function checkedCallerExpiry(st) {
  const p = st.preflight?.json, v = st.vars;
  const owner = p?.owners?.tenant, caller = owner?.metadata?.caller;
  if (!p || p.tenantId !== v.tenant_id || p.binding !== v.installation_binding
      || p.environment !== v.installation_environment || owner?.tenantId !== v.tenant_id
      || owner.binding !== v.installation_binding || owner.environment !== v.installation_environment
      || caller?.grantId !== v.caller_grant_id
      || owner.metadata?.authenticationKey?.keyId !== v.authentication_key_id
      || owner.metadata?.profile?.revision !== v.profile_revision
      || !Number.isFinite(Date.parse(caller.expiresAt))) return null;
  return caller.expiresAt;
}

function pageVault() {
  const st = S.st, exp = checkedCallerExpiry(st);
  const expired = exp && Date.parse(exp) <= Date.now();
  return `<div class="page-head"><h2>Bước 1 · Nạp access một lần</h2><p class="muted">Tương đương Postman Local Vault (QUICK-START §1). Không đặt access vào environment/collection/shared variables.</p></div>
  <div class="note">Giá trị bí mật chỉ nằm trong bộ nhớ server cục bộ — khởi động lại server phải nạp lại. Website không hiển thị lại giá trị, chỉ metadata (định dạng, hạn JWT…). Environment hiện tại: <b>${S.env}</b>, caller slot <code>${esc(st.vars.caller_vault_key)}</code>.</div>
  ${exp ? `<div class="note ${expired ? 'bad' : 'ok'}">Caller grant <span class="mono">${esc(st.vars.caller_grant_id)}</span> hết hạn lúc <b>${fmtTime(exp)}</b>${expired ? ' — <b>ĐÃ HẾT HẠN</b>. Không nạp caller cũ để ký; operator phải cấp access mới bằng workflow installation hợp lệ (OPERATOR-GUIDE), không gia hạn quyền signing-key hoặc mở cohort cũ.' : ''}</div>` : ''}
  <div class="card"><h3>Khóa Vault</h3><div class="table-wrap"><table><thead><tr><th>Khóa</th><th>Trạng thái</th><th>Nạp</th></tr></thead><tbody>
    ${Object.entries(S.meta.vaultKeys).map(([k, meta]) => vaultRow(k, meta, st.vault[k])).join('')}
  </tbody></table></div></div>
  <div class="card"><div class="card-head"><h3>File trong thư mục bảo vệ</h3><button class="btn small" data-act="scanCandidates">Quét %LOCALAPPDATA%\\VNeCA\\Postman</button></div>
    <p class="small muted">Chỉ liệt kê tên file do prepare-private.mjs / bàn giao tạo (operator-jwt.txt, caller.txt, input.json…). Nội dung không gửi về trình duyệt.</p>
    ${candidatesTable()}</div>`;
}

function opResult(id, { hideJson = false } = {}) {
  const o = S.out.operator[id];
  if (!o) return '';
  return `<div class="mt8">
    <div class="small muted">${fmtTime(o.at)} ${o.request ? `· ${esc(o.request.method)} <span class="mono">${esc(o.request.url)}</span>` : ''}</div>
    ${o.refused ? `<div class="note bad"><b>NOT SENT: ${esc(o.refused)}</b> ${esc(explain(o.refused, o.detail))}</div>` : ''}
    ${o.transportError ? transportNote(o.transportError, { session: false }) : ''}
    ${o.http != null ? `<div>${badge(o.http >= 200 && o.http < 300 ? 'PASS' : 'FAIL', 'HTTP ' + o.http)} ${o.preflightStatus ? 'Preflight → ' + badge(o.preflightStatus) : ''} ${o.tokenStored ? badge('PASS', 'JWT đã lưu Vault') : ''}</div>` : ''}
    ${testsList(o.tests)}
    ${o.response && !hideJson ? `<details><summary>Response (đã che credential)</summary>${jsonBlock(o.response)}</details>` : ''}
  </div>`;
}

function varFields(names) {
  return `<div class="grid2 tight">${names.map(n => inputField('var.' + n, n, { def: S.st.vars[n], mono: true })).join('')}</div>
    <div class="actions"><button class="btn small" data-act="saveVars">Lưu biến</button><button class="btn small" data-act="resetVars">Khôi phục theo gói</button></div>`;
}

function gatesView(j) {
  const md = j.owners?.tenant?.metadata;
  const credential = j.owners?.signing?.gates?.provider_credential_scope;
  const provider = j.owners?.provider;
  const resolution = provider?.gates?.credential_resolution;
  const providerScope = provider?.gates?.provider_credential_scope;
  // This exact response is a placeholder in the current Signing preflight.
  // Explain its limits without changing the server verdict or admission state.
  const credentialNotice = resolution ? `<div class="note ${resolution.status === 'PASS' ? '' : 'warn'}" id="credential-runtime-diagnostics">
        <b>Credential — kết quả từ Provider runtime</b>
        <div class="kv small">
          <div>Đọc secret</div><div>${badge(resolution.status)} <code>${esc(resolution.code)}</code> · ${fmtTime(provider.checkedAt)}</div>
          <div>Provider / môi trường</div><div>${esc(provider.metadata?.providerId)} / ${esc(provider.environment)}</div>
          <div>Credential / reference</div><div>${esc(provider.metadata?.credentialId)} / <code>${esc(provider.metadata?.secretReference)}</code></div>
          <div>Revision đã kiểm</div><div>${esc(provider.flowRevision)} — lấy từ profile đã publish, không dùng biến Provider nhập tay.</div>
          <div>Phạm vi sử dụng credential</div><div>${badge(providerScope?.status)} <code>${esc(providerScope?.code)}</code></div>
          ${provider.metadata?.resolverFailure ? `<div>Lỗi resolver</div><div><code>${esc(provider.metadata.resolverFailure)}</code></div>` : ''}
        </div>
        <p>Đọc bằng Vault resolver của workload hiện tại; cache tối đa 60 giây có thể được dùng. Phép kiểm không gọi eIDCA, không cấp authority và không chứng minh eIDCA chấp nhận credential. Xác nhận owner đã cung cấp vẫn được giữ trong hồ sơ; response này chưa đối chiếu hồ sơ đó.</p>
      </div>` : credential?.status === 'NOT_CHECKED'
    && credential.code === 'EXACT_SELECTED_CREDENTIAL_OWNER_WORKFLOW_REQUIRED'
    ? `<div class="note warn" id="credential-diagnostics-gap">
        <b>provider_credential_scope: chưa nhận được kết quả credential từ Provider cho profile này.</b>
        <p>Không cần nhập lại API key, tạo credential hoặc xác nhận owner lần nữa chỉ để đổi dòng này thành PASS. Kiểm tra transport Provider và profile đã publish; giữ nguyên trạng thái cho đến khi có kết quả từ runtime.</p>
        <div class="kv small">
          <div>Đọc Vault bằng workload</div><div>Response này chưa có kết quả đọc secret từ Provider. Kết quả kiểm tra riêng cần thời điểm và scope tương ứng.</div>
          <div>Xác nhận phạm vi credential</div><div>Chưa có kết quả đối chiếu hồ sơ owner với exact Provider, credential và endpoint. Không suy từ việc đọc được Vault.</div>
          <div>eIDCA chấp nhận credential</div><div>API preflight này không gọi eIDCA. Chưa có kết quả authenticated Provider API trong response này.</div>
        </div>
        <p>Giữ nguyên verdict bên dưới. Các lỗi activation, cohort hoặc verifier là kết quả riêng cần xử lý trước khi ký.</p>
      </div>` : '';
  return `<h4>Kết quả preflight ${badge(j.overall)} <span class="muted small">checkedAt ${fmtTime(j.checkedAt)} · signingActions ${esc(j.signingActions)}</span></h4>
    <div class="note"><b>Cấu hình trước START: ${badge(j.configurationOverall || 'NOT_CHECKED')}</b><p>Đây là kết quả riêng với quyền theo intent/chứng thư/hành động. Các lớp chưa được thực thi vẫn giữ NOT_CHECKED; không suy quyền ký từ cấu hình PASS.</p>${j.context?.transactionId ? `<div>Giao dịch đang đối soát: <code>${esc(j.context.transactionId)}</code></div>` : '<div>Chưa chọn giao dịch để đọc bằng chứng intent. Dùng 01b với canonical transaction đã tồn tại.</div>'}</div>
    ${credentialNotice}
    ${deferredGateHelp(j)}
    ${gatesTable(j)}
    ${md?.caller ? `<div class="kv small mt8"><div>Caller grant</div><div class="mono">${esc(md.caller.grantId)} · hết hạn ${fmtTime(md.caller.expiresAt)} · revoked ${esc(md.caller.revoked)}</div><div>Authentication key</div><div class="mono">${esc(md.authenticationKey?.keyId)} · hết hạn ${esc(md.authenticationKey?.expiresAt)}</div><div>Profile</div><div class="mono">${esc(md.profile?.revision)} · ${esc(md.profile?.signatureProfile)} · ${esc(md.profile?.mode)}</div></div>` : ''}
    <p class="small muted">PASS transport chỉ chứng minh đọc được owner. NOT_CHECKED về ownership/use/trust/credential không phải PASS.</p>
    <details><summary>JSON preflight đầy đủ</summary>${jsonBlock(j)}</details>`;
}

function pagePreflight() {
  const st = S.st, pre = st.preflight, jwt = st.vault['vneca-operator-jwt'];
  const reads = [['ASSIGNMENTS', '02 Method / Provider assignments', 'Đối chiếu Method/environment/Provider/native pins, không đọc label hiển thị.'], ['PROVIDER_APIS', '03 Provider APIs effective metadata', 'Origin, API environment, auth mechanism, credential reference. Không export raw response.'], ['PROVIDER_FLOWS', '04 Provider flow revisions', 'Đọc native recipe đã publish; không republish cấu hình Owner.'], ['NATIVE_PLAN', '05 Native Provider plan dry-read', 'Không gọi challenge/submit, không resolve credential, không authorize signer.'], ['TRANSACTIONS', '06 Transaction list / reconciliation', 'List rỗng không chứng minh 0 key action hay 0 Billing.']];
  const writeId = S.form['w.id'] || 'PROVISION_EXISTING_AGENT';
  return `<div class="page-head"><h2>Bước 2 · Preflight trước START</h2><p class="muted">Operator collection: đăng nhập thật, đọc gate scoped. Preflight đọc không tạo transaction, challenge hay grant.</p></div>
  <div class="note ${pre.status === 'PASS' ? 'ok' : pre.status === 'BLOCKED' ? 'warn' : ''}">Cấu hình trước START ${S.env}: ${badge(pre.status)} ${pre.overall ? '· Tổng quyền theo giao dịch: ' + badge(pre.overall) : ''} ${pre.at ? '· ' + fmtTime(pre.at) : ''}<br>
    <span class="small">Cấu hình PASS cho phép bắt đầu intent. Ownership, quyền dùng khóa, trust và chính sách theo hành động được thực thi trong workflow; chưa chạy vẫn NOT_CHECKED.</span><br>
    <span class="small">Chỉ response thật của <b>01 Complete scoped preflight</b> mới đổi trạng thái này. START dùng kết quả cấu hình trước START; NOT_CHECKED của quyền theo giao dịch không đồng nghĩa cấu hình bị lỗi. Các quyền đó được kiểm tra trong workflow trước hành động tương ứng.</span></div>
  <div class="grid2">
    <div class="card"><h3>00 LOGIN — operator thật</h3>
      <p class="small">Cần username/password operator trong Vault (Bước 1), hoặc nạp sẵn <code>operator-jwt.txt</code>. JWT admin không bao giờ dùng làm customer bearer.</p>
      <div class="kv"><div>JWT operator</div><div>${jwt.present ? `${badge(jwt.info?.expired ? 'FAIL' : 'PASS', jwt.info?.expired ? 'hết hạn' : 'còn hạn')} đến ${fmtTime(jwt.info?.expiresAt)}` : badge('NOT_CHECKED', 'chưa có')}</div></div>
      <div class="actions"><button class="btn primary" data-act="op" data-id="LOGIN" ${dis()}>Gửi 00 LOGIN</button></div>
      ${opResult('LOGIN')}
    </div>
    <div class="card"><h3>Agent transport — read-only, không bearer</h3>
      <p class="small muted">HTTP 200 chỉ là transport, không phải caller/signing-use/verifier/activation PASS.</p>
      <div class="actions">
        <button class="btn" data-act="op" data-id="HEALTH_LOCAL_STATUS" ${dis()}>Local normal TLS health</button>
        <button class="btn" data-act="op" data-id="HEALTH_LOCAL_CONNECTION" ${dis()}>Local Platform connection</button>
        <button class="btn" data-act="op" data-id="HEALTH_SERVER" ${dis()}>Server health</button>
      </div>
      ${opResult('HEALTH_LOCAL_STATUS')}${opResult('HEALTH_LOCAL_CONNECTION')}${opResult('HEALTH_SERVER')}${localDispatchHelp()}
    </div>
  </div>
  <div class="card"><div class="card-head"><h3>01 Complete scoped preflight</h3><span class="muted small mono">GET /v1/admin/tenants/{tenant}/agent-preflight</span></div>
    <details><summary>Biến scope của query (exact binding/agent/key/profile/policy/grant/verifier)</summary>${varFields(PREFLIGHT_VARS)}</details>
    <div class="actions"><button class="btn primary" data-act="op" data-id="PREFLIGHT" ${dis()}>Gửi 01 Complete scoped preflight</button></div>
    ${opResult('PREFLIGHT', { hideJson: true })}
    ${pre.json ? gatesView(pre.json) : ''}
  </div>
  <div class="card" id="intent-bound-preflight"><h3>01b Intent-bound preflight — đọc giao dịch đã có</h3>
    <p>Đọc bằng chứng intent/chứng thư/dispatch đã ghi của đúng canonical transaction. Không START, không re-authorize, không thay kết quả cấu hình 01. Phiên CANCELLED/hết hạn chỉ có bằng chứng lịch sử.</p>
    ${inputField('var.canonical_transaction_id', 'canonical_transaction_id', { def: st.vars.canonical_transaction_id, placeholder: 'btx_… của giao dịch đã tồn tại', mono: true })}
    <div class="actions"><button class="btn" data-act="op" data-id="PREFLIGHT_INTENT" ${dis()}>Gửi 01b Intent-bound preflight</button></div>
    ${opResult('PREFLIGHT_INTENT', { hideJson: true })}
    ${S.out.operator.PREFLIGHT_INTENT?.ok && S.out.operator.PREFLIGHT_INTENT?.response?.schemaVersion === 'AgentOperatorPreflight/v1' ? gatesView(S.out.operator.PREFLIGHT_INTENT.response) : ''}
  </div>
  <div class="card"><h3>02–06 Đọc metadata (read-only)</h3>
    <details><summary>Biến Provider / transaction</summary>${varFields(READ_VARS)}</details>
    ${reads.map(([id, name, hint]) => `<div class="divider"><div class="row center"><button class="btn" data-act="op" data-id="${id}" ${dis()}>${esc(name)}</button><span class="small muted">${esc(hint)}</span></div>${opResult(id)}</div>`).join('')}
  </div>
  <details class="card danger"><summary><b>90 MANUAL WRITES — không Run, không phải preflight</b></summary>
    <p class="small">Chỉ khi có command/phạm vi được phép. Body là JSON owner đã review (ví dụ output của <code>prepare-private.mjs installation-command</code>, có PoP). Activation/cohort, signing-use, verifier authority là workflow CLI/owner — không có request giả ở đây.</p>
    ${selectField('w.id', 'Request ghi', [['PROVISION_EXISTING_AGENT', 'PROVISION_EXISTING_AGENT — POST …/agent-installations'], ['PUBLISH_NATIVE_BINDING', 'PUBLISH_NATIVE_BINDING — POST …/native-bindings/{flow}:publish'], ['PUBLISH_COPY_PROFILE', 'PUBLISH_COPY_PROFILE — POST …/agent-copy-profiles']], writeId)}
    ${textareaField('w.json', 'operator_prepared_json (không lưu ra đĩa)', '{ "command": { … }, "proofBase64": "…" }')}
    ${inputField('w.once', 'operator_once — gõ đúng tên request', { placeholder: writeId, mono: true })}
    ${checkField('w.reviewed', 'Owner đã review exact scope/parent/window/diff và cho phép gửi request ghi này')}
    <div class="actions"><button class="btn send" data-act="opWrite" ${dis()}>Gửi ${esc(writeId)}</button></div>
    ${opResult(writeId)}
  </details>`;
}

function methodCard(x, current) {
  const status = S.env === 'LOCAL' ? x.local : x.server;
  return `<button type="button" class="method ${x.code === current ? 'on' : ''}" data-act="setForm" data-k="lock.method" data-v="${esc(x.code)}"><b>${esc(x.code)}</b><span class="small">${esc(x.label)}</span><div class="small">${S.env === 'LOCAL' ? 'Local' : 'Server'}: ${status === '—' ? '—' : badge(status)}</div></button>`;
}

function lockCard() {
  const sel = S.st.selected, s = sel?.summary, v = S.st.vars, m = S.meta;
  const method = S.form['lock.method'] ?? (s?.methodRequested || v.method_code || 'CCCD_NFC');
  const source = S.form['lock.source'] ?? 'sample';
  const sampleKey = S.form['lock.sample'] ?? 'PDF';
  const sm = m.samples[sampleKey];
  const priv = S.st.vault['vneca-private-input'];
  const identity = S.st.vault['vneca-signing-identity'];
  const mx = m.methods.find(x => x.code === method);
  const privPreset = priv?.info ? (priv.info.mode === 'HASH' ? 'HASH_CMS' : priv.info.format) : null;
  const combo = source === 'private' ? m.samples[privPreset] : sm;
  return `<div class="card ${s && s.state !== 'NEW' ? 'locked' : ''}"><div class="card-head"><h3>02 LOCK original intent — không HTTP</h3>${s && s.state !== 'NEW' ? badge('LOCKED', 'phiên đã khóa') : ''}</div>
    ${!s ? '<p class="muted">Tạo hoặc chọn phiên trước.</p>' : s.state !== 'NEW' ? '<p class="small muted">Phiên đã khóa: sửa biến sau LOCK không đổi phiên (LOCK lại sẽ bị từ chối INTENT_ALREADY_LOCKED). Nghiệp vụ khác → NEW case/run khác.</p>' : ''}
    <h4>Method (folder)</h4>
    <div class="methods">${m.methods.map(x => methodCard(x, method)).join('')}</div>
    ${mx ? `<p class="small muted">${esc(mx.guide)}${S.env === 'SERVER' && !mx.serverAllowed ? ' <b>Server từ chối Method này (UNSUPPORTED_SERVER_HARDWARE).</b>' : ''}</p>` : ''}
    <h4>Input</h4>
    <div class="actions mt0">
      <button class="btn small ${source === 'sample' ? 'primary' : ''}" data-act="setForm" data-k="lock.source" data-v="sample">Mẫu không nhạy cảm</button>
      <button class="btn small ${source === 'private' ? 'primary' : ''}" data-act="setForm" data-k="lock.source" data-v="private">Tài liệu riêng (Vault)</button>
    </div>
    ${source === 'sample'
      ? `${selectField('lock.sample', 'Mẫu (tổ hợp theo samples/inputs.json)', Object.entries(m.samples).map(([k, x]) => [k, `${k} — ${x.mode}/${x.format} → ${x.profile} / ${x.output}`]), sampleKey)}
         <div class="small muted">${esc(sm?.fileName || 'HASH của sample.pdf')} ${sm?.bytes != null ? `· ${sm.bytes} bytes · sha256 <span class="mono">${esc(short(sm.sha256, 16))}</span>` : ''}</div>`
      : `<div>${priv?.present ? `${badge('PASS', 'đã nạp')} ${vaultInfo('input', priv.info)}` : badge('NOT_CHECKED', 'chưa nạp tài liệu riêng')}</div>
         <div class="row"><label class="f"><span>File</span><input type="file" id="privFile"></label>${selectField('up.format', 'Định dạng', [['PDF', 'PDF'], ['XML', 'XML'], ['BINARY', 'BINARY']], 'PDF')}${selectField('up.mode', 'Mode', [['FILE', 'FILE (gửi bytes)'], ['HASH', 'HASH (CMS DOCUMENT_DIGEST)']], 'FILE')}</div>
         <div class="actions"><button class="btn small" data-act="upload" ${dis()}>Nạp tài liệu vào Vault</button></div>
         <p class="small muted">Tài liệu chỉ nằm trong bộ nhớ server cho tới LOCK; sau LOCK được đóng băng trong state riêng có ACL. Không đưa tài liệu thật vào environment export.</p>`}
    <div class="kv mt8"><div>signature_profile</div><div>${esc(combo?.profile || '—')}</div><div>output</div><div>${esc(combo?.output || '—')}</div></div>
    <h4>Chọn certificate (tuỳ chọn)</h4>
    ${inputField('lock.cert', 'certificate_reference', { def: v.certificate_reference, hint: 'Chỉ là selector; Platform/Provider vẫn phải xác lập authorization.' })}
    <h4>Danh tính</h4>
    <div>${identity.present ? `${badge('PASS', 'đã nạp')} ${vaultInfo('identity', identity.info)}` : `${badge('NOT_CHECKED', 'chưa nạp')} <a href="#vault" data-act="go" data-page="vault">Nạp ở Bước 1</a>`}</div>
    <div class="actions"><button class="btn primary" data-act="lock" ${s && !S.pending ? '' : 'disabled'}>02 LOCK original intent</button></div>
  </div>`;
}

function pageSession() {
  const st = S.st, sel = st.selected, v = st.vars;
  return `<div class="page-head"><h2>Bước 3 · Tạo và khóa đúng phiên</h2><p class="muted">00.x và 02 LOCK là thao tác local, không gửi HTTP. Registry không giữ tài liệu/danh tính/continuation/bearer.</p></div>
  <div class="cols"><div>
    <div class="card"><h3>00.1 NEW — case/run/key mới</h3>
      <div class="row">${inputField('new.case', 'case_id', { def: v.case_id, placeholder: 'CCCD-PDF' })}${inputField('new.run', 'run_id', { def: v.run_id, placeholder: 'lan-001' })}</div>
      <details><summary>Tuỳ chọn: idempotency key tự đặt</summary>${inputField('new.key', 'new_start_key (trống = tự sinh start-<uuid>)', { mono: true })}</details>
      <p class="small muted">Key chỉ sinh ở đây. Đừng bấm NEW để xử lý timeout — dùng 07 STATUS / 10 RETRY.</p>
      <div class="actions"><button class="btn primary" data-act="init" ${dis()}>00.1 NEW</button></div>
    </div>
    <div class="card"><h3>00.2 SELECT — phiên đã có (${esc(S.env)})</h3>
      <div class="row">${inputField('sel.case', 'case_id', { def: v.case_id })}${inputField('sel.run', 'run_id', { def: v.run_id })}<button class="btn" data-act="selectCaseRun" ${dis()}>00.2 SELECT</button></div>
      ${st.sessions.length ? `<div class="table-wrap"><table><thead><tr><th>case / run</th><th>ref</th><th>State</th><th>Method</th><th>signing_id</th><th>Tạo lúc</th><th></th></tr></thead><tbody>${st.sessions
        .map(x => `<tr class="${sel?.summary.sessionRef === x.id ? 'sel' : ''}"><td>${esc(x.caseId)} / ${esc(x.runId)}</td><td class="mono small nowrap">${esc(x.ref)}</td><td>${badge(x.state)}${x.closed ? ' ' + badge('NOT_CHECKED', 'CLOSED') : ''}${x.lastError ? ' ' + badge('FAILED', x.lastError) : ''}</td><td>${esc(x.method || '—')}</td><td class="mono small nowrap">${esc(short(x.signingId, 14))}</td><td class="nowrap small">${fmtTime(x.createdAt)}</td><td><button class="btn small" data-act="selectId" data-id="${esc(x.id)}" ${dis()}>Chọn</button></td></tr>`)
        .join('')}</tbody></table></div>` : '<p class="muted small">Chưa có phiên nào trong environment này.</p>'}
    </div>
    ${lockCard()}
  </div><div>${sessionPanel()}${responsePanel()}</div></div>`;
}

function pageSend() {
  const st = S.st, sel = st.selected, s = sel?.summary, a = sel?.actionDisplay;
  const ref = s ? s.sessionRef.slice(0, 12) : '';
  const method = S.meta.methods.find(x => x.code === (s?.methodSelected || s?.methodRequested));
  const contExpired = a?.continuationExpiresAt && Date.parse(a.continuationExpiresAt) <= Date.now();
  const left = s ? `<div class="card"><div class="card-head"><h3>03 START — manual Send</h3>${badge(st.preflight.status)}</div>
      ${st.preflight.status === 'NOT_CHECKED' ? '<div class="note bad">Preflight NOT_CHECKED — START sẽ bị từ chối. Chạy 01 Complete scoped preflight ở Bước 2.</div>' : st.preflight.status !== 'PASS' ? '<div class="note warn">Preflight BLOCKED: START chỉ để chẩn đoán lỗi thật; refusal vẫn FAILED, không bao giờ là signing PASS.</div>' : ''}
      ${onceField('START', ref)}
      <div class="actions"><button class="btn send" data-act="mut" data-op="START" ${dis()}>03 START</button></div>
      <p class="small muted">Không dùng START để kiểm tra thiết bị, credential hoặc phí khi chưa được phép tạo giao dịch. Mất response → 10 RETRY ở Bước 5, không NEW.</p>
    </div>
    <div class="card"><div class="card-head"><h3>04 Action hiện tại</h3>${a ? badge('ACTION_REQUIRED', a.type) : ''}</div>
      ${a ? `<p>${esc(a.prompt || '')}</p>
        <div class="kv small"><div>Continuation hết hạn</div><div>${fmtTime(a.continuationExpiresAt)} ${contExpired ? badge('FAIL', 'đã hết hạn') : ''}</div><div>poll_after_ms</div><div>${esc(a.pollAfterMs ?? '—')}</div></div>
        ${method ? `<div class="note small">${esc(method.guide)}</div>` : ''}
        ${a.options.length ? `<h4>Options — chỉ số 1-based của response hiện tại</h4><div class="options">${a.options
          .map(o => `<div class="option ${String(S.form['choice.index']) === String(o.index) ? 'on' : ''}" data-act="setForm" data-k="choice.index" data-v="${o.index}"><span class="idx">${o.index}</span><span>${esc(o.label)}</span>${o.method ? ' ' + badge('LOCKED', o.method) : ''}</div>`)
          .join('')}</div>` : '<p class="muted small">Action không có option.</p>'}
        ${inputField('choice.index', 'selected_option_index', { type: 'number', placeholder: '1' })}
        ${onceField('CHOICE', ref)}
        <div class="actions"><button class="btn send" data-act="mut" data-op="CHOICE" ${dis()}>05 CONTINUE — Method / CA / certificate / device</button></div>
        <p class="small muted">DEVICE_INTERACTION (NFC/USB): 05 tiếp tục ceremony thật trên Local; reader/camera/PIN vẫn ở SDK. Không tự chọn option đầu, không copy opaque reference từ phiên khác.</p>
        ${a.hostedApproval ? `<h4>Hosted approval (USER_AUTHORIZATION)</h4>
          <div class="note small">Hoàn tất phê duyệt thật trên UI tin cậy; không dán OTP/PIN vào website. Hết hạn ${fmtTime(a.hostedApproval.expiresAt)}.</div>
          <div class="actions"><button class="btn" data-act="openApproval">Mở UI phê duyệt</button></div>
          ${checkField('interaction.done', 'Tôi đã hoàn tất phê duyệt thật trên UI/app tin cậy (interaction_completed=YES)')}
          ${onceField('INTERACTION', ref)}
          <div class="actions"><button class="btn send" data-act="mut" data-op="INTERACTION" ${dis()}>06 CONTINUE — sau approval thật</button></div>` : ''}`
        : `<p class="muted">Chưa có action (state ${esc(s.state)}). Đọc response ở cột phải; ACTION_REQUIRED sẽ hiện options tại đây.</p>`}
    </div>
    <div class="card"><h3>07 STATUS · 08 RESULT — phiên gốc</h3>
      <p class="small muted">Không có idempotency key. Tôn trọng poll_after_ms; website không tự poll. ACK/PROCESSING không phải ký xong.</p>
      <div class="small">Poll: <span data-countdown></span></div>
      <div class="actions"><button class="btn primary" data-act="mut" data-op="STATUS" ${dis()}>07 STATUS</button><button class="btn primary" data-act="mut" data-op="RESULT" ${dis()}>08 RESULT</button></div>
      ${s.resultSummary ? `<h4>Result summary (ổn định giữa các lần RESULT)</h4><div class="kv small"><div>kind / scope</div><div>${esc(s.resultSummary.kind)} / ${esc(s.resultSummary.verification_scope)}</div><div>format / profile</div><div>${esc(s.resultSummary.format || '—')} / ${esc(s.resultSummary.signature_profile)}</div><div>artifact digest</div><div class="mono">${esc(s.resultSummary.artifactDigest?.value || '—')}</div><div>certificate sha256</div><div class="mono">${esc(s.resultSummary.certificate_sha256 || '—')}</div></div>` : ''}
      ${sel.completedInMemory ? '<div class="note ok">Đã có RESULT COMPLETED — sang <a href="#verify" data-act="go" data-page="verify">Bước 6</a> để lưu và verify độc lập.</div>' : ''}
    </div>
    <div class="card"><h3>09 CANCEL — workflow gốc</h3>
      <p class="small muted">Dùng handle hiện hành; STATUS có thể cấp handle CANCEL-only ${sel.cancelOnlyHandle ? badge('PASS', 'đang có') : ''}. PROCESSING là đang chờ hủy, chỉ CANCELLED mới là đã hủy. Hủy sau commit không xóa chữ ký hoặc phí.</p>
      ${onceField('CANCEL', ref)}
      <div class="actions"><button class="btn danger" data-act="mut" data-op="CANCEL" ${dis()}>09 CANCEL</button></div>
    </div>` : '<div class="card"><p>Chưa chọn phiên — sang <a href="#session" data-act="go" data-page="session">Bước 3</a>.</p></div>';
  return `<div class="page-head"><h2>Bước 4 · Send và tiếp tục từng bước</h2><p class="muted">Mỗi mutation cần <code>send_once = ${esc(ref || '<12 ký tự đầu phiên>')}:&lt;OPERATION&gt;</code>, tiêu thụ một lần. Đây là chống bấm nhầm, không phải authorization/approval.</p></div>
  <div class="note warn">Environment <b>${esc(st.vars.installation_environment)}</b> theo cấu hình tenant; endpoint eIDCA Owner <b>${esc(S.meta.evidence.runtime?.providerEndpoint || '')}</b>. Nhãn TEST của Docker không đổi môi trường Provider. Provider/CA thật có thể phát sinh phí. Không Send nếu chưa được quyền thực hiện giao dịch.</div>
  <div class="cols"><div>${left}</div><div>${sessionPanel()}${responsePanel()}</div></div>`;
}

function pageRecovery() {
  const sel = S.st.selected, s = sel?.summary, ref = s ? s.sessionRef.slice(0, 12) : '';
  return `<div class="page-head"><h2>Bước 5 · Khi lỗi, bấm gì?</h2><p class="muted">Recovery giữ nguyên phiên gốc: không NEW, không đổi intent, không sửa opaque token.</p></div>
  <div class="card"><h3>Tình huống → thao tác (QUICK-START §5)</h3><div class="table-wrap"><table><thead><tr><th>Tình huống</th><th>Thao tác tiếp theo</th><th></th></tr></thead><tbody>${RECOVERY_TABLE.map(([a, b, p]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td><button class="btn small" data-act="go" data-page="${p}">Đi tới</button></td></tr>`).join('')}</tbody></table></div></div>
  <div class="cols"><div>
    ${s ? `<div class="card"><h3>10 RETRY original START — exact frozen body</h3>
      <p class="small muted">Cùng key/body đã khóa, X-VNeCA-Request-Id mới. Khi chưa có signing_id và kết quả chưa rõ, đây là cách duy nhất phục hồi START. Lỗi cấu hình/authority cần operator sửa trước.</p>
      ${onceField('RETRY_START', ref)}
      <div class="actions"><button class="btn send" data-act="mut" data-op="RETRY_START" ${dis()}>10 RETRY original START</button></div>
    </div>
    <div class="card"><h3>11 REPLAY CONTINUE/CANCEL — exact stored command</h3>
      <p class="small muted">Đọc 07 STATUS trước nếu effect chưa rõ. Chọn command CONTINUE/CANCEL cũ (ordinal 1-based); để trống = lastMutation. Gửi nguyên key/body/continuation cũ, không dựng lại theo option mới.</p>
      ${commandsTable(s, true)}
      <div class="row">${inputField('replay.ordinal', 'replay_command_ordinal (trống = lastMutation)', { type: 'number' })}</div>
      ${onceField('RETRY_MUTATION', ref)}
      <div class="actions"><button class="btn send" data-act="mut" data-op="RETRY_MUTATION" ${dis()}>11 REPLAY CONTINUE/CANCEL</button></div>
    </div>` : '<div class="card"><p>Chưa chọn phiên — sang <a href="#session" data-act="go" data-page="session">Bước 3</a>.</p></div>'}
    <div class="card"><h3>C — changed intent with same START key</h3>
      <p class="small">NEVER SENT live. Fault/expired grant/cross-tenant/changed intent không bơm vào Provider ký thật. Kiểm bằng harness trong thư mục gói:</p>
      <pre class="code">cd "${esc(S.meta.package.dir)}"
npm ci --ignore-scripts --no-audit --no-fund
npm test</pre>
      <div class="actions"><button class="btn" data-act="wb" data-op="NEGATIVE_CHANGED_START" ${dis()}>Thử C trên website (phải bị từ chối)</button></div>
    </div>
  </div><div>${sessionPanel()}${responsePanel()}</div></div>
  <div class="card"><h3>Contract recovery A–L (CONTRACT-RECOVERY.md)</h3><div class="table-wrap"><table><thead><tr><th>Ca</th><th>Tên</th><th>Thao tác / mức bằng chứng</th></tr></thead><tbody>${CONTRACT_CASES.map(([k, n, d]) => `<tr><td><b>${k}</b></td><td>${esc(n)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function psQuote(p) {
  return "'" + String(p ?? '').replace(/'/g, "''") + "'";
}

function pageVerify() {
  const st = S.st, sel = st.selected, saved = st.lastSaved;
  const art = saved?.files.find(f => f.role === 'ARTIFACT_DIGEST_MATCHES');
  const orig = saved?.files.find(f => f.role === 'ORIGINAL_FROZEN_INPUT');
  const mat = saved?.files.find(f => f.role === 'SIGNING_MATERIAL_NOT_A_DOCUMENT');
  const fmtDef = art?.format === 'PDF' ? 'PDF' : art?.format === 'XML' ? 'XML' : art ? 'CMS' : 'PDF';
  const f = k => S.form['vr.' + k];
  const val = {
    format: f('format') ?? fmtDef, artifact: f('artifact') ?? art?.path ?? '', original: f('original') ?? orig?.path ?? '',
    leaf: f('leaf') ?? '', roots: f('roots') ?? '', inter: f('inter') ?? '', crls: f('crls') ?? '', java: f('java') ?? '',
  };
  const cmd = `./verify-result.ps1 -Format ${val.format} -Artifact ${psQuote(val.artifact)} -Original ${psQuote(val.original)} -Leaf ${psQuote(val.leaf)} -TrustedRoots ${psQuote(val.roots)} -Intermediates ${psQuote(val.inter)} -Crls ${psQuote(val.crls)}${val.java ? ' -JavaHome ' + psQuote(val.java) : ''}`;
  const vr = S.out.verify, vm = S.out.material;
  return `<div class="page-head"><h2>Bước 6 · Lưu, verify và kiểm tra ký/tính phí trùng</h2><p class="muted">Schema/digest PASS chưa chứng minh chữ ký đúng hay không ký trùng. Evidence chưa có kiểm chứng độc lập crypto/cardinality giữ NOT_CHECKED.</p></div>
  <div class="card"><h3>Lưu RESULT vào thư mục bảo vệ</h3>
    <p class="small muted">Tương đương <code>save-result.mjs</code>: chỉ ghi file mới, kiểm SHA256 theo response, SIGNING_MATERIAL giữ JSON; kèm bytes gốc đã khóa để làm -Original. Không commit/chia sẻ raw response.</p>
    <div>${sel?.completedInMemory ? badge('PASS', 'có RESULT COMPLETED trong bộ nhớ') : badge('NOT_CHECKED', 'chưa có RESULT COMPLETED — bấm 08 RESULT ở Bước 4')}</div>
    <div class="actions"><button class="btn primary" data-act="saveResult" ${dis()}>Lưu kết quả</button></div>
    ${saved ? `<div class="note ${saved.kind === 'ARTIFACT' ? 'ok' : ''}">${badge(saved.status)} → <span class="mono">${esc(saved.dir)}</span><br><span class="small">Crypto: ${esc(saved.cryptographicVerification)}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Vai trò</th><th>File</th><th>Bytes</th><th>SHA256</th></tr></thead><tbody>${saved.files.map(x => `<tr><td class="small">${esc(x.role)}</td><td class="mono small">${esc(x.path)}</td><td>${x.bytes}</td><td class="mono small">${esc(x.sha256)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div>
  <div class="card"><h3>Verify độc lập — verify-result.ps1 (JDK21 + PDFBox/BC)</h3>
    <p class="small muted">Cần chain/CRL đã được chấp nhận riêng (current full CRL cho mỗi issuer). Không dùng TEST root thay CA thật. PDF giới hạn một chữ ký PAdES-B-B.</p>
    <div class="grid2 tight">
      ${selectField('vr.format', 'Format', [['PDF', 'PDF'], ['CMS', 'CMS'], ['XML', 'XML']], val.format)}
      ${inputField('vr.java', 'JavaHome (JDK21, trống = JAVA_HOME)', { def: val.java, placeholder: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21…' })}
      ${inputField('vr.artifact', 'Artifact', { def: val.artifact, mono: true })}
      ${inputField('vr.original', 'Original', { def: val.original, mono: true })}
      ${inputField('vr.leaf', 'Leaf (PEM)', { def: val.leaf, mono: true })}
      ${inputField('vr.roots', 'TrustedRoots (PEM)', { def: val.roots, mono: true })}
      ${inputField('vr.inter', 'Intermediates (PEM)', { def: val.inter, mono: true })}
      ${inputField('vr.crls', 'Crls (PEM, current full CRL)', { def: val.crls, mono: true })}
    </div>
    <div class="actions"><button class="btn primary" data-act="verify" ${dis()}>Chạy verify-result.ps1</button></div>
    <details><summary>Lệnh PowerShell tương đương (chạy trong thư mục gói)</summary><pre class="code">${esc(cmd)}</pre></details>
    ${vr ? (vr.refused ? `<div class="note bad"><b>NOT RUN: ${esc(vr.refused)}</b> ${esc(explain(vr.refused, vr.detail))}</div>` : `<div class="note ${vr.status === 'PASS' ? 'ok' : 'bad'}">Kết quả: ${badge(vr.status)} (exit ${esc(vr.exitCode)}) ${vr.status === 'PASS' ? '' : '— không đánh dấu cryptography PASS'}</div>${vr.verdict ? jsonBlock(vr.verdict) : ''}<details><summary>Output</summary><pre class="code">${esc(vr.output)}</pre></details>`) : ''}
  </div>
  <div class="card"><h3>SIGNING_MATERIAL — verify-material.mjs</h3>
    <p class="small muted">Chỉ verify raw signature + signing-input digest/certificate. RAW_SIGNATURE_PASS không phải PDF/CMS/XML artifact PASS; assembly/PKIX vẫn NOT_CHECKED.</p>
    <div class="grid2 tight">${inputField('vm.material', 'material.json', { def: S.form['vm.material'] ?? mat?.path ?? '', mono: true })}${inputField('vm.original', 'File gốc', { def: S.form['vm.original'] ?? '', mono: true, hint: 'Bytes gốc mà document_digest được tính (HASH_CMS mẫu: samples/sample.pdf).' })}</div>
    <div class="actions"><button class="btn" data-act="verifyMaterial" ${dis()}>Chạy verify-material.mjs</button></div>
    ${vm ? (vm.refused ? `<div class="note bad"><b>NOT RUN: ${esc(vm.refused)}</b> ${esc(explain(vm.refused, vm.detail))}</div>` : `<div class="note ${vm.status === 'RAW_SIGNATURE_PASS' ? 'ok' : 'bad'}">Kết quả: ${badge(vm.status)} (exit ${esc(vm.exitCode)})</div>${vm.verdict ? jsonBlock(vm.verdict) : ''}<details><summary>Output</summary><pre class="code">${esc(vm.output)}</pre></details>`) : ''}
  </div>
  <div class="card"><h3>Đối soát ký/tính phí trùng — chỉ operator</h3>
    <p class="small">Operator dùng <code>collect-cardinality.mjs</code> (quyền Docker/DB read-only của stack TEST đã xác minh) hoặc telemetry/receipt CA hợp lệ, đúng tenant/canonical root. So sánh snapshot trước/sau từng replay; không cộng số toàn hệ thống. Customer không chạy helper này.</p>
    ${inputField('card.root', 'canonical root (từ 06 Transaction list / owner)', { mono: true })}
    <pre class="code">cd "${esc(S.meta.package.dir)}"
node collect-cardinality.mjs ${esc(S.st.vars.tenant_id)} ${esc(S.form['card.root'] || '<canonical-root>')}</pre>
  </div>`;
}

function pageUat() {
  const m = S.meta, data = S.uat || { cases: {} };
  const counts = {};
  for (const g of m.uat.groups) for (const c of g.cases) {
    const st = data.cases[c.id]?.status || 'NOT_EXECUTED';
    counts[st] = (counts[st] || 0) + 1;
  }
  const kindLabel = { positive: 'luồng chính', negative: 'từ chối kỳ vọng', harness: 'chỉ harness', operator: 'operator' };
  return `<div class="page-head"><h2>Kịch bản UAT thủ công</h2><p class="muted">Ghi kết quả từng ca sau khi thao tác thật. Website không tự đánh PASS. NEGATIVE_PASS = từ chối đúng kỳ vọng, không phải signing PASS.</p></div>
  <div class="card"><div class="row">
    <label class="f"><span>Người test</span><input type="text" data-uat-tester value="${esc(data.tester || '')}" placeholder="Họ tên / đơn vị"></label>
    <button class="btn primary" data-act="uatReport">Xuất báo cáo Markdown</button>
    <button class="btn" data-act="uatJson">Tải JSON kết quả</button>
  </div>
  <div class="counters mt8">${Object.entries(counts).map(([k, n]) => badge(k, `${k}: ${n}`)).join(' ')}</div></div>
  ${m.uat.groups.map(g => `<div class="card"><div class="card-head"><h3>${esc(g.title)}</h3><span class="muted small">${esc(g.ref)}</span></div>
    ${g.cases.map(c => {
      const r = data.cases[c.id] || {};
      const status = r.status || 'NOT_EXECUTED';
      return `<details class="case" data-case="${esc(c.id)}" ${S.openCases.has(c.id) ? 'open' : ''}>
        <summary><span class="id">${esc(c.id)}</span><span class="t">${esc(c.title)}</span>${badge('NOT_CHECKED', kindLabel[c.kind] || c.kind)} ${badge(status)}</summary>
        <div class="body">
          <ol>${c.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
          <p><b>Kỳ vọng:</b> ${esc(c.expected)}</p>
          ${c.current ? `<div class="note warn small"><b>Thực trạng runtime:</b> ${esc(c.current)}</div>` : ''}
          <div class="row">
            <label class="f w220"><span>Kết quả</span><select data-uat-status="${esc(c.id)}">${m.uat.statuses.map(x => `<option ${x === status ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <button class="btn small" data-act="go" data-page="${esc(c.page)}">Đi tới bước</button>
          </div>
          <label class="f"><span>Ghi chú (không dán token/CCCD/tài liệu)</span><textarea data-uat-notes="${esc(c.id)}" class="short">${esc(r.notes || '')}</textarea></label>
          <div class="actions">
            <span class="small muted">Gắn bằng chứng (đã redact):</span>
            <button class="btn small" data-act="uatAttach" data-case="${esc(c.id)}" data-source="session">Phản hồi phiên gần nhất</button>
            <button class="btn small" data-act="uatAttach" data-case="${esc(c.id)}" data-source="operator">Kết quả operator gần nhất</button>
            <button class="btn small" data-act="uatAttach" data-case="${esc(c.id)}" data-source="saved">Kết quả lưu (Bước 6)</button>
          </div>
          ${(r.evidence || []).length ? `<div class="table-wrap"><table><thead><tr><th>Gắn lúc</th><th>Nguồn</th><th>Thao tác</th><th>HTTP</th><th>Kết quả</th><th>Chi tiết</th></tr></thead><tbody>${r.evidence
            .map(e => `<tr><td class="nowrap small">${fmtTime(e.attachedAt)}</td><td>${esc(e.source)} · ${esc(e.env)}</td><td>${esc(e.op || '')}</td><td>${esc(e.http ?? '')}</td><td>${e.refused ? badge('FAIL', e.refused) : badge(e.status)}</td><td class="small mono">${esc([e.caseId && e.caseId + '/' + e.runId, e.sessionRef, e.errorCode, e.requestId && 'req ' + e.requestId, e.transport, ...(e.tests || []), ...(e.files || [])].filter(Boolean).join(' · '))}</td></tr>`)
            .join('')}</tbody></table></div>` : ''}
        </div>
      </details>`;
    }).join('')}
  </div>`).join('')}`;
}

function pageLog() {
  return `<div class="page-head"><h2>Nhật ký thao tác</h2><p class="muted">Chỉ metadata (đã redact) của lần chạy server hiện tại; không chứa token, tài liệu, danh tính.</p></div>
  <div class="card"><div class="actions mt0"><button class="btn small" data-act="refreshLog">Làm mới</button></div>
  ${S.log.length ? `<div class="table-wrap"><table><thead><tr><th>Lúc</th><th>Env</th><th>Thao tác</th><th>Phiên</th><th>Gửi HTTP</th><th>HTTP</th><th>Kết quả</th></tr></thead><tbody>${S.log
    .map(e => `<tr><td class="nowrap small">${fmtTime(e.at)}</td><td>${esc(e.env || '')}</td><td>${esc(e.op)}</td><td class="small">${esc(e.caseId ? e.caseId + '/' + e.runId : '')} <span class="mono">${esc(e.sessionRef || '')}</span></td><td>${e.sent ? 'có' : 'không'}</td><td>${esc(e.http ?? '')}</td><td>${e.refused ? badge('FAIL', 'NOT SENT ' + e.refused) : ''} ${e.transport ? badge('FAIL', e.transport) : ''} ${badge(e.replyStatus)} ${esc(e.errorCode || '')} ${!e.refused && !e.replyStatus && e.state ? badge(e.state) : ''}</td></tr>`)
    .join('')}</tbody></table></div>` : '<p class="muted">Chưa có thao tác.</p>'}</div>`;
}

function pageDocs() {
  return `<div class="page-head"><h2>Tài liệu gói workbench</h2><p class="muted">Đọc trực tiếp từ thư mục gói đã kiểm checksum.</p></div>
  <div class="tabs">${S.meta.docs.map(d => `<button data-act="openDoc" data-doc="${esc(d)}" class="${S.docName === d ? 'on' : ''}">${esc(d)}</button>`).join('')}</div>
  <div class="card doc">${S.docText ? renderMarkdown(S.docText) : '<p class="muted">Đang tải…</p>'}</div>`;
}

const PAGE_RENDER = { overview: pageOverview, vault: pageVault, preflight: pagePreflight, session: pageSession, send: pageSend, recovery: pageRecovery, verify: pageVerify, uat: pageUat, log: pageLog, docs: pageDocs };

function render() {
  if (!S.meta || !S.st) return;
  $('#topbar').innerHTML = renderTop();
  $('#nav').innerHTML = renderNav();
  $('#main').innerHTML = (PAGE_RENDER[S.page] || pageOverview)();
  tickCountdown();
}

function tickCountdown() {
  const left = Math.max(0, S.pollUntil - Date.now());
  for (const el of document.querySelectorAll('[data-countdown]')) {
    el.textContent = left > 0 ? `chờ ${Math.ceil(left / 1000)} giây theo poll_after_ms (gửi sớm sẽ bị từ chối WAIT_SERVER_POLL_DELAY)` : 'có thể gửi — website không tự poll';
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function wb(op, params = {}) {
  await busy(async () => {
    const out = await api('/api/wb', { json: { env: S.env, op, params } });
    if (out.state) applyState(out.state);
    S.out.op = { op, at: new Date().toISOString(), sent: out.sent, refused: out.refused, detail: out.detail, message: out.message };
    if (out.refused) toast(`${op}: NOT SENT — ${out.refused}`, true);
    else if (out.transportError) toast(`${op}: lỗi transport ${out.transportError.code} — kết quả chưa rõ`, true);
    else if (out.sent) toast(`${op}: HTTP ${out.http}${out.reply?.status ? ' · ' + out.reply.status : ''}`, !out.ok);
    else toast(out.message || `${op}: xong`);
    if (out.export) {
      const s = out.export;
      download(`wb-evidence-${s.caseId}-${s.runId}-${new Date().toISOString().replace(/[:.]/g, '')}.json`, JSON.stringify(out.export, null, 2));
    }
    // send_once is consumed by every attempt, like env.unset('send_once') in the Postman script.
    if (out.sent || ['START', 'RETRY_START', 'CHOICE', 'INTERACTION', 'CANCEL', 'RETRY_MUTATION'].includes(op)) {
      for (const k of Object.keys(S.form)) if (k.startsWith('once.')) delete S.form[k];
      delete S.form['interaction.done'];
    }
  });
}

async function operatorSend(id, params = {}) {
  await busy(async () => {
    await saveVarEdits();
    const out = await api('/api/operator', { json: { env: S.env, id, params } });
    if (out.state) applyState(out.state);
    S.out.operator[id] = { ...out, at: new Date().toISOString() };
    if (out.refused) toast(`${out.name || id}: NOT SENT — ${out.refused}`, true);
    else if (out.transportError) toast(`${out.name}: lỗi transport ${out.transportError.code}`, true);
    else toast(`${out.name}: HTTP ${out.http}${out.preflightStatus ? ' · preflight ' + out.preflightStatus : ''}`, !out.ok);
  });
}

async function saveVarEdits() {
  const changes = {};
  for (const [k, v] of Object.entries(S.form)) {
    if (k.startsWith('var.') && v !== S.st.vars[k.slice(4)]) changes[k.slice(4)] = v;
  }
  if (!Object.keys(changes).length) return false;
  const res = await api('/api/env', { json: { env: S.env, changes } });
  if (res.refused) throw new Error(res.refused);
  applyState(res);
  for (const k of Object.keys(S.form)) if (k.startsWith('var.')) delete S.form[k];
  return true;
}

async function vaultCall(body, okMsg) {
  await busy(async () => {
    const res = await api('/api/vault', { json: body });
    if (res.refused) {
      toast(`Vault: ${res.refused} — ${explain(res.refused, res.detail)}`, true);
      return;
    }
    S.st.vault = res.vault;
    toast(okMsg);
  });
}

const ACTIONS = {
  go: el => {
    location.hash = el.dataset.page;
  },
  env: async el => {
    S.env = el.dataset.env;
    localStorage.setItem('uat.env', S.env);
    S.out = { operator: {}, op: null, verify: null, material: null };
    for (const k of Object.keys(S.form)) if (/^(var|new|sel|once|choice|replay|lock)\./.test(k)) delete S.form[k];
    await busy(loadState);
  },
  setForm: el => {
    S.form[el.dataset.k] = el.dataset.v;
    render();
  },
  vaultSet: el => {
    const key = el.dataset.key, value = S.form['vault.' + key];
    delete S.form['vault.' + key];
    return vaultCall({ action: 'set', key, value }, 'Đã nạp ' + key);
  },
  vaultFile: el => {
    const key = el.dataset.key;
    return vaultCall({ action: 'file', key, path: S.form['vaultPath.' + key] || '' }, 'Đã nạp ' + key + ' từ file');
  },
  vaultFileDirect: el => vaultCall({ action: 'file', key: el.dataset.key, path: el.dataset.path }, 'Đã nạp ' + el.dataset.key + ' từ file'),
  vaultClear: el => vaultCall({ action: 'clear', key: el.dataset.key }, 'Đã xoá ' + el.dataset.key),
  vaultIdentity: () => {
    const body = { action: 'identity', subjectRef: S.form['id.subject_ref'] || '', nationalId: S.form['id.national_id'] || '' };
    delete S.form['id.subject_ref'];
    delete S.form['id.national_id'];
    return vaultCall(body, 'Đã nạp danh tính signer');
  },
  scanCandidates: () => busy(async () => {
    S.candidates = await api('/api/vault/candidates');
  }),
  saveVars: () => busy(async () => {
    toast((await saveVarEdits()) ? 'Đã lưu biến' : 'Không có thay đổi');
  }),
  resetVars: () => busy(async () => {
    applyState(await api('/api/env', { json: { env: S.env, reset: true } }));
    for (const k of Object.keys(S.form)) if (k.startsWith('var.')) delete S.form[k];
    toast('Đã khôi phục biến theo environment của gói');
  }),
  op: el => operatorSend(el.dataset.id),
  opWrite: () => {
    const id = S.form['w.id'] || 'PROVISION_EXISTING_AGENT';
    const params = { operatorOnce: S.form['w.once'] || '', preparedJson: S.form['w.json'] || '', ownerReviewed: !!S.form['w.reviewed'] };
    delete S.form['w.once'];
    delete S.form['w.reviewed'];
    return operatorSend(id, params);
  },
  init: () => wb('INIT', { caseId: S.form['new.case'] ?? S.st.vars.case_id, runId: S.form['new.run'] ?? S.st.vars.run_id, newStartKey: S.form['new.key'] || '' }).then(() => {
    delete S.form['new.key'];
  }),
  selectCaseRun: () => wb('SELECT', { caseId: S.form['sel.case'] ?? S.st.vars.case_id, runId: S.form['sel.run'] ?? S.st.vars.run_id }),
  selectId: el => wb('SELECT', { selectSessionId: el.dataset.id }),
  lock: () => {
    const s = S.st.selected?.summary;
    return wb('LOCK', {
      method: S.form['lock.method'] ?? (s?.methodRequested || S.st.vars.method_code),
      inputSource: S.form['lock.source'] ?? 'sample',
      sampleKey: S.form['lock.sample'] ?? 'PDF',
      certificateReference: S.form['lock.cert'] ?? S.st.vars.certificate_reference,
    });
  },
  upload: () => busy(async () => {
    const file = $('#privFile')?.files?.[0];
    if (!file) {
      toast('Chọn file trước', true);
      return;
    }
    const q = new URLSearchParams({ format: S.form['up.format'] || 'PDF', mode: S.form['up.mode'] || 'FILE', name: file.name });
    const res = await api('/api/input/upload?' + q, { raw: await file.arrayBuffer() });
    if (res.refused) {
      toast(`NOT LOADED: ${res.refused} — ${explain(res.refused)}`, true);
      return;
    }
    S.st.vault = res.vault;
    S.form['lock.source'] = 'private';
    const limit = res.inlineLimitBytes;
    toast(limit && file.size > limit ? `Đã nạp, nhưng ${file.size} bytes vượt giới hạn inline mặc định ${limit} bytes — runtime có thể từ chối` : 'Đã nạp tài liệu vào Vault');
  }),
  mut: el => {
    const op = el.dataset.op, f = S.form;
    const params = { sendOnce: f['once.' + op] || '' };
    if (op === 'CHOICE') params.selectedOptionIndex = f['choice.index'] ?? '';
    if (op === 'INTERACTION') params.interactionCompleted = !!f['interaction.done'];
    if (op === 'RETRY_MUTATION') params.replayCommandOrdinal = f['replay.ordinal'] ?? '';
    return wb(op, params);
  },
  wb: el => wb(el.dataset.op),
  closeSession: () => {
    if (confirm('00.5 CLOSE chỉ đóng sổ local, giữ lịch sử, KHÔNG gửi CANCEL. Tiếp tục?')) return wb('CLOSE');
  },
  openApproval: () => busy(async () => {
    const res = await api('/api/wb/approval-url', { json: { env: S.env } });
    if (res.refused) {
      toast(`${res.refused} — ${explain(res.refused)}`, true);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }),
  saveResult: () => busy(async () => {
    const res = await api('/api/result/save', { json: { env: S.env } });
    if (res.refused) {
      toast(`NOT SAVED: ${res.refused} — ${explain(res.refused)}`, true);
      return;
    }
    S.st.lastSaved = res;
    for (const k of Object.keys(S.form)) if (/^(vr|vm)\.(artifact|original|material|format)$/.test(k)) delete S.form[k];
    toast('Đã lưu: ' + res.status);
  }),
  verify: () => busy(async () => {
    const f = k => S.form['vr.' + k];
    const saved = S.st.lastSaved;
    const art = saved?.files.find(x => x.role === 'ARTIFACT_DIGEST_MATCHES'), orig = saved?.files.find(x => x.role === 'ORIGINAL_FROZEN_INPUT');
    const body = { env: S.env, format: f('format') ?? (art?.format === 'PDF' ? 'PDF' : art?.format === 'XML' ? 'XML' : art ? 'CMS' : 'PDF'), artifact: f('artifact') ?? art?.path ?? '', original: f('original') ?? orig?.path ?? '', leaf: f('leaf') ?? '', trustedRoots: f('roots') ?? '', intermediates: f('inter') ?? '', crls: f('crls') ?? '', javaHome: f('java') ?? '' };
    toast('Đang chạy verifier độc lập… (có thể mất 1–2 phút)');
    S.out.verify = await api('/api/result/verify', { json: body });
  }),
  verifyMaterial: () => busy(async () => {
    const mat = S.st.lastSaved?.files.find(x => x.role === 'SIGNING_MATERIAL_NOT_A_DOCUMENT');
    S.out.material = await api('/api/result/verify-material', { json: { env: S.env, material: S.form['vm.material'] ?? mat?.path ?? '', original: S.form['vm.original'] ?? '' } });
  }),
  uatAttach: el => busy(async () => {
    const res = await api('/api/uat/attach', { json: { env: S.env, caseId: el.dataset.case, source: el.dataset.source } });
    if (res.refused) {
      toast(`${res.refused} — ${explain(res.refused)}`, true);
      return;
    }
    S.uat = res;
    S.openCases.add(el.dataset.case);
    toast('Đã gắn bằng chứng vào ' + el.dataset.case);
  }),
  uatReport: async () => {
    download('uat-report-' + new Date().toISOString().slice(0, 10) + '.md', await api('/api/uat/report', { text: true }), 'text/markdown');
  },
  uatJson: () => download('uat-results-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(S.uat, null, 2)),
  refreshLog: () => busy(async () => {
    S.log = await api('/api/log');
  }),
  openDoc: el => busy(async () => {
    S.docName = el.dataset.doc;
    S.docText = '';
    if (S.page !== 'docs') location.hash = 'docs';
    S.docText = (await api('/api/doc?name=' + encodeURIComponent(S.docName))).text;
  }),
};

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  e.preventDefault();
  const fn = ACTIONS[el.dataset.act];
  if (fn) await fn(el);
});

document.addEventListener('input', e => {
  const k = e.target.dataset?.f;
  if (!k) return;
  S.form[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (e.target.dataset.rerender) render();
});

document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.dataset.uatStatus) {
      S.uat = await api('/api/uat', { json: { caseId: t.dataset.uatStatus, status: t.value } });
      S.openCases.add(t.dataset.uatStatus);
      render();
    } else if (t.dataset.uatNotes) {
      S.uat = await api('/api/uat', { json: { caseId: t.dataset.uatNotes, notes: t.value } });
    } else if ('uatTester' in t.dataset) {
      S.uat = await api('/api/uat', { json: { tester: t.value } });
    }
  } catch (err) {
    toast(err.message, true);
  }
});

// <details> toggle does not bubble; capture it to keep UAT cases open across re-renders.
document.addEventListener('toggle', e => {
  const id = e.target.dataset?.case;
  if (!id) return;
  if (e.target.open) S.openCases.add(id);
  else S.openCases.delete(id);
}, true);

window.addEventListener('hashchange', async () => {
  S.page = location.hash.slice(1) || 'overview';
  if (S.page === 'log') S.log = await api('/api/log').catch(() => S.log);
  if (S.page === 'docs' && !S.docText) S.docText = (await api('/api/doc?name=' + encodeURIComponent(S.docName)).catch(() => ({ text: '' }))).text;
  render();
  window.scrollTo(0, 0);
  $('#main').focus({ preventScroll: true });
});

setInterval(tickCountdown, 1000);

(async () => {
  try {
    [S.meta, S.uat] = await Promise.all([api('/api/meta'), api('/api/uat')]);
    await loadState();
    if (S.page === 'docs') S.docText = (await api('/api/doc?name=' + encodeURIComponent(S.docName))).text;
    if (S.page === 'log') S.log = await api('/api/log');
    render();
  } catch (e) {
    $('#main').innerHTML = `<div class="note bad">Không tải được dữ liệu từ server cục bộ: ${esc(e.message)}</div>`;
  }
})();
