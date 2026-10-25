// Manual UAT cases derived from the workbench package docs. Results are recorded by the
// tester only; nothing here marks a case PASS automatically.

export const RESULT_STATUSES = Object.freeze([
  'NOT_EXECUTED', 'PASS', 'NEGATIVE_PASS', 'FAIL',
  'BLOCKED_CONFIG', 'BLOCKED_AUTHORITY', 'BLOCKED_OPERATOR', 'UNSUPPORTED', 'NOT_CHECKED',
]);

export const UAT_GROUPS = Object.freeze([
  {
    id: 'G1', title: '1. Chuẩn bị và nạp access', ref: 'QUICK-START §1',
    cases: [
      {
        id: 'UAT-01', title: 'Toàn vẹn gói workbench', page: 'overview', kind: 'positive',
        steps: ['Mở trang Tổng quan.', 'Đọc kết quả kiểm tra PACKAGE-MANIFEST.json (SHA256 từng file, SHA512 PDFBox).'],
        expected: 'Tất cả file khớp checksum, PDFBox jar PASS. Không có file lạ thay thế script/collection.',
      },
      {
        id: 'UAT-02', title: 'Nạp caller access đúng loại (agc_…)', page: 'vault', kind: 'positive',
        steps: ['Chọn environment Local hoặc Server.', 'Nạp caller vào khóa vneca-local-eidca-caller / vneca-server-caller từ connection artifact hợp lệ.', 'Thử nạp JWT portal/admin vào khóa caller.'],
        expected: 'Caller agc_ + 64 hex được chấp nhận; JWT bị từ chối (JWT_IS_NOT_AGENT_CALLER_ACCESS). Giá trị không bao giờ hiển thị lại.',
        current: 'Caller Local cũ hết hạn 25/10/2026 22:04:09 (Asia/Saigon); chưa có caller mới. Server chưa có caller cho tenant.',
      },
      {
        id: 'UAT-03', title: 'Nạp danh tính signer đã xác minh', page: 'vault', kind: 'positive',
        steps: ['Nhập subject_ref / national_id của signer thật đã xác minh (không dùng synthetic identity cho CA thật).', 'Xuất evidence của một phiên sau đó.'],
        expected: 'Danh tính chỉ nằm trong Vault/khóa phiên; không xuất hiện trong evidence redacted hay environment.',
        current: 'Contract hiện yêu cầu identity.subject_ref; QUICK-START ghi national_id. Thiếu subject_ref thì LOCK bị validator từ chối.',
      },
      {
        id: 'UAT-04', title: 'TLS chuẩn tới Local Agent', page: 'preflight', kind: 'positive',
        steps: ['Bấm “Local normal TLS health”.', 'Nếu lỗi TLS: sửa trust Windows/chạy với --use-system-ca, không tắt verify.'],
        expected: 'HTTP 200 qua TLS có kiểm chứng. Đây chỉ là transport, không phải caller/signing PASS.',
      },
    ],
  },
  {
    id: 'G2', title: '2. Preflight trước START', ref: 'QUICK-START §2 · OPERATOR-GUIDE',
    cases: [
      {
        id: 'UAT-05', title: '00 LOGIN operator thật', page: 'preflight', kind: 'operator',
        steps: ['Nạp username/password operator vào Vault (hoặc nạp operator-jwt.txt từ thư mục bảo vệ).', 'Bấm 00 LOGIN.'],
        expected: 'HTTP 201, JWT lưu trong Vault operator, không dùng làm customer bearer.',
        current: 'Access operator bàn giao hết hạn 26/10/2026 01:18:40 (Asia/Saigon).',
      },
      {
        id: 'UAT-06', title: '01 Complete scoped preflight', page: 'preflight', kind: 'operator',
        steps: ['Bấm 01 Complete scoped preflight.', 'Ghi lại overall và từng gate tenant/signing/transport.'],
        expected: 'HTTP 200, schema AgentOperatorPreflight/v1. Gate phân biệt PASS/BLOCKED_*/NOT_CHECKED; NOT_CHECKED không phải PASS. Trạng thái preflight của website cập nhật PASS hoặc BLOCKED.',
        current: 'Snapshot 25/10: overall BLOCKED_AUTHORITY (key/registration/caller hết hạn; manifest/cohort BLOCKED_CONFIG; verifier BLOCKED_AUTHORITY).',
      },
      {
        id: 'UAT-07', title: '02 Method / Provider assignments', page: 'preflight', kind: 'operator',
        steps: ['Bấm 02.', 'Đối chiếu Method → Provider chính thức với ma trận readiness.'],
        expected: 'CCCD_NFC→prv_eidca_hash, VNEID→prv_ca2_vneid, APP_CA_REMOTE_SIGNING→prv_esign_ca2, USB_TOKEN→prv_7a161b93…; FPT_RS_V dự phòng không thành Provider thứ hai của VNEID.',
      },
      {
        id: 'UAT-08', title: '03/04 Provider APIs và flow revisions', page: 'preflight', kind: 'operator',
        steps: ['Bấm 03 và 04.', 'Đọc origin, API environment, auth mechanism, credential reference, revision/hash thật.'],
        expected: 'Đọc được metadata thật; không đổi endpoint/credential; không export raw response.',
      },
      {
        id: 'UAT-09', title: '05 Native Provider plan dry-read', page: 'preflight', kind: 'operator',
        steps: ['Bấm 05.'],
        expected: 'planReady=true, contract NativeEidcaHashAction/v1, providerCalls=0, credentialReads=0, signingAuthority NOT_EVALUATED.',
      },
      {
        id: 'UAT-10', title: 'Agent transport (Local status/connection, Server health)', page: 'preflight', kind: 'positive',
        steps: ['Bấm ba request Agent transport.'],
        expected: 'HTTP 200 chỉ chứng minh transport; connection có thể lỗi khi access hết hạn — đọc preflight scoped.',
      },
    ],
  },
  {
    id: 'G3', title: '3. Tạo và khóa đúng phiên', ref: 'QUICK-START §3',
    cases: [
      {
        id: 'UAT-11', title: '00.1 NEW tạo case/run/key; NEW trùng bị từ chối', page: 'session', kind: 'positive',
        steps: ['Đặt case_id=CCCD-PDF, run_id=lan-001, bấm 00.1 NEW.', 'Bấm NEW lần nữa với cùng case/run.'],
        expected: 'Lần 1 tạo phiên NEW với startKey mới. Lần 2 bị từ chối SESSION_ALREADY_EXISTS_SELECT_IT.',
      },
      {
        id: 'UAT-12', title: '02 LOCK original intent — không HTTP', page: 'session', kind: 'positive',
        steps: ['Chọn Method, input mẫu PDF (PADES_B_B/ARTIFACT), bấm 02 LOCK.', 'Đổi biến rồi LOCK lại.'],
        expected: 'Phiên sang LOCKED, không có HTTP. LOCK lần 2 bị từ chối INTENT_ALREADY_LOCKED; intent đã khóa không đổi.',
      },
      {
        id: 'UAT-13', title: '00.3 VIEW / 00.2 SELECT — đang ở phiên nào', page: 'session', kind: 'positive',
        steps: ['Bấm 00.3 VIEW, đọc case/run, startKey, sessionRef, signingId, state, next.', 'Chọn lại bằng 00.2 SELECT theo case/run hoặc session id.'],
        expected: 'Tóm tắt đúng phiên; không có signing_id toàn cục dùng chung giữa các case.',
      },
      {
        id: 'UAT-14', title: 'Server từ chối phần cứng client (NFC/USB)', page: 'session', kind: 'negative',
        steps: ['Chọn environment Server, NEW một phiên.', 'LOCK với Method CCCD_NFC hoặc USB_TOKEN.'],
        expected: 'Bị từ chối UNSUPPORTED_SERVER_HARDWARE, không có HTTP.',
      },
      {
        id: 'UAT-15', title: 'Input XML/BINARY/HASH đúng tổ hợp ma trận', page: 'session', kind: 'positive',
        steps: ['LOCK phiên riêng cho XML (XMLDSIG_RSA_SHA256/ARTIFACT), BINARY (CMS_DETACHED/ARTIFACT), HASH_CMS (CMS_DETACHED/SIGNING_MATERIAL).'],
        expected: 'Website tự áp tổ hợp profile/output theo samples/inputs.json; không chỉ đổi đuôi file.',
      },
    ],
  },
  {
    id: 'G4', title: '4. Send và tiếp tục theo Method', ref: 'QUICK-START §4 · READINESS-MATRIX',
    cases: [
      {
        id: 'UAT-16', title: 'START bị chặn khi preflight NOT_CHECKED', page: 'send', kind: 'negative',
        steps: ['Chưa chạy 01 preflight (trạng thái NOT_CHECKED).', 'Nhập send_once đúng rồi bấm 03 START.'],
        expected: 'Bị từ chối OPERATOR_PREFLIGHT_REQUIRED_SEE_MATRIX, không có HTTP.',
      },
      {
        id: 'UAT-17', title: 'send_once sai/thiếu không gửi được mutation', page: 'send', kind: 'negative',
        steps: ['Nhập send_once sai (ví dụ sai operation) và bấm 03 START.'],
        expected: 'Bị từ chối MANUAL_SEND_ONCE_REQUIRED kèm mã đúng; không có HTTP.',
      },
      {
        id: 'UAT-18', title: 'CCCD_NFC (Local, HN212)', page: 'send', kind: 'positive',
        steps: ['START đã được phép.', 'ACTION_REQUIRED/DEVICE_INTERACTION: chọn option theo chỉ số 1-based của response hiện tại, 05 CONTINUE.', 'Đặt CCCD vào HN212, consent trên Local SDK (không nhập dữ liệu chip/AA/selfie vào website).', '07 STATUS sau poll delay; COMPLETED → 08 RESULT.'],
        expected: 'Phiên đi đúng trạng thái; RESULT có artifact digest khớp; FAILED không bao giờ là PASS.',
        current: 'BLOCKED_AUTHORITY: key/registration/caller hết hạn; manifest/cohort/verifier chưa có.',
      },
      {
        id: 'UAT-19', title: 'USB_TOKEN (Local, PIN trên UI tin cậy)', page: 'send', kind: 'positive',
        steps: ['Cắm token đúng certificate.', 'START → CONTINUE; nhập PIN trong UI/SDK tin cậy, không nhập PIN vào website.', 'STATUS → RESULT.'],
        expected: 'Ký thành công với certificate đã chọn; PIN không đi qua website.',
        current: 'BLOCKED_CONFIG: USB connector disabled, profile cố định CCCD_NFC.',
      },
      {
        id: 'UAT-20', title: 'VNEID (approval trên app)', page: 'send', kind: 'positive',
        steps: ['START với Method VNEID.', 'Xác nhận giao dịch trên ứng dụng VNeID theo action; không mở thêm START khi app chậm.', 'STATUS → RESULT.'],
        expected: 'Phê duyệt thật trên app; phiên hoàn tất trên đúng signing_id.',
        current: 'BLOCKED_CONFIG: installation FIXED_V1 CCCD_NFC, chưa có route/profile VNEID.',
      },
      {
        id: 'UAT-21', title: 'APP_CA_REMOTE_SIGNING (eSIGN, chọn CA nếu được offer)', page: 'send', kind: 'positive',
        steps: ['START với Method eSIGN.', 'Nếu SELECT_CA: chọn CA theo chỉ số option hiện tại, 05 CONTINUE.', 'Hoàn tất approval trên app/hosted UI → 06 CONTINUE nếu USER_AUTHORIZATION.'],
        expected: 'Chỉ eSIGN có thể yêu cầu chọn CA; không có SELECT_PROVIDER.',
        current: 'BLOCKED_CONFIG: chưa có native route/profile eSIGN.',
      },
      {
        id: 'UAT-22', title: 'AUTO — chưa chọn Method', page: 'send', kind: 'positive',
        steps: ['LOCK với AUTO (không gửi method_code).', 'START → SELECT_METHOD: chọn chỉ số option, 05 CONTINUE.'],
        expected: 'Provider do Platform resolve; Method chọn được ghi vào phiên.',
      },
      {
        id: 'UAT-23', title: 'Hosted approval (USER_AUTHORIZATION)', page: 'send', kind: 'positive',
        steps: ['Khi action có hosted approval: bấm “Mở UI phê duyệt”, hoàn tất thật.', 'Tích “đã hoàn tất”, nhập send_once …:INTERACTION, bấm 06 CONTINUE.'],
        expected: 'Website không tạo approval; chỉ gửi completion reference của phiên hiện tại.',
      },
      {
        id: 'UAT-24', title: '09 CANCEL', page: 'send', kind: 'positive',
        steps: ['Trên phiên đang ACTION_REQUIRED/PROCESSING, nhập send_once …:CANCEL, bấm 09 CANCEL.', 'Đọc STATUS.'],
        expected: 'PROCESSING là đang chờ hủy, chỉ CANCELLED mới là đã hủy. Hủy sau commit không xóa chữ ký/phí.',
      },
    ],
  },
  {
    id: 'G5', title: '5. Lỗi và recovery (A–L)', ref: 'QUICK-START §5 · CONTRACT-RECOVERY',
    cases: [
      { id: 'UAT-A', title: 'A — First START', page: 'send', kind: 'positive', steps: ['03 START thủ công.'], expected: 'Body/key khóa trước HTTP; command lưu trước khi gửi.' },
      { id: 'UAT-B', title: 'B — Exact START replay', page: 'recovery', kind: 'positive', steps: ['Bấm 10 RETRY original START (send_once …:RETRY_START).'], expected: 'Cùng key/body, X-VNeCA-Request-Id mới; không sinh key tại Send.' },
      { id: 'UAT-C', title: 'C — Same key, changed intent', page: 'recovery', kind: 'harness', steps: ['Không gửi live. Trong thư mục gói: npm ci --ignore-scripts, rồi npm test.', 'Thử nút “C changed intent” trên website.'], expected: 'Website từ chối HARNESS_CASE_ONLY_NO_LIVE_FAULT_INJECTION; harness journal/facade báo CONFLICT đúng.' },
      { id: 'UAT-D', title: 'D — Independent key', page: 'session', kind: 'positive', steps: ['NEW với case/run khác.'], expected: 'Phiên mới, key mới; không dùng để cứu response mất.' },
      { id: 'UAT-E', title: 'E — Processed CONTINUE replay', page: 'recovery', kind: 'positive', steps: ['Chọn replay_command_ordinal trong danh sách commands (để trống = lastMutation).', 'Bấm 11 REPLAY (send_once …:RETRY_MUTATION).'], expected: 'Gửi lại đúng command cũ (key/body/token cũ), không dựng lại theo option mới.' },
      { id: 'UAT-F', title: 'F — Lost START response', page: 'recovery', kind: 'positive', steps: ['Khi START timeout/mất response và chưa có signing_id: chỉ dùng 10 RETRY original START.'], expected: 'Không NEW, không đổi intent; không suy FAILED network là chưa admission.' },
      { id: 'UAT-G', title: 'G — Lost CONTINUE/dispatch', page: 'recovery', kind: 'positive', steps: ['07 STATUS cùng signing_id trước.', 'Nếu cần: 11 REPLAY command cũ.'], expected: 'STATUS không ghi đè pending CONTINUE bằng handle cancel-only.' },
      { id: 'UAT-H', title: 'H — Repeated STATUS', page: 'send', kind: 'positive', steps: ['Bấm 07 STATUS liên tiếp trước khi hết poll_after_ms.'], expected: 'Website từ chối WAIT_SERVER_POLL_DELAY; không có key mới, không auto-poll.' },
      { id: 'UAT-I', title: 'I — Repeated RESULT', page: 'send', kind: 'positive', steps: ['Bấm 08 RESULT hai lần.'], expected: 'Digest/format/profile/certificate ổn định; nếu khác → COMMITTED_RESULT_CHANGED.' },
      { id: 'UAT-J', title: 'J — Cancellation phases', page: 'send', kind: 'positive', steps: ['CANCEL ở các pha trước effect/pending/terminal (harness hoặc phiên thật được phép).'], expected: 'PROCESSING chưa phải CANCELLED; không đảo committed result.' },
      {
        id: 'UAT-K', title: 'K — Expired/revoked caller', page: 'send', kind: 'negative',
        steps: ['Dùng caller đã hết hạn (đúng thực trạng hiện tại) và gửi một request thật đã được phép quan sát lỗi.'],
        expected: 'HTTP 403 FORBIDDEN “Local Agent caller registration is inactive”; ghi NEGATIVE_PASS, không phải signing PASS. Không đổi tenant/caller để né.',
        current: 'Đây là refusal thật đầu tiên đã quan sát (403 FORBIDDEN).',
      },
      { id: 'UAT-L', title: 'L — Stale/cross-tenant choice', page: 'send', kind: 'negative', steps: ['Chọn option index ngoài phạm vi, hoặc continuation đã hết hạn.'], expected: 'Bị từ chối (EXPLICIT_CURRENT_OPTION_INDEX_REQUIRED / CONTINUATION_EXPIRED_READ_ORIGINAL_SESSION); không sửa opaque token.' },
    ],
  },
  {
    id: 'G6', title: '6. Lưu, verify và đối soát', ref: 'QUICK-START §6 · VERIFY-RESULT',
    cases: [
      { id: 'UAT-25', title: 'Lưu RESULT vào thư mục bảo vệ', page: 'verify', kind: 'positive', steps: ['Sau 08 RESULT COMPLETED, bấm “Lưu kết quả”.'], expected: 'Ghi file mới (không ghi đè), SHA256 artifact khớp response; SIGNING_MATERIAL giữ dạng JSON.' },
      { id: 'UAT-26', title: 'Verify độc lập PDF/CMS/XML', page: 'verify', kind: 'positive', steps: ['Nhập Leaf/Roots/Intermediates/CRLs đã được chấp nhận và JavaHome JDK21.', 'Chạy verify-result.ps1.'], expected: 'status PASS từ verifier độc lập; mọi lỗi giữ FAIL/NOT_CHECKED. Không dùng TEST root thay CA thật.' },
      { id: 'UAT-27', title: 'SIGNING_MATERIAL — verify raw signature', page: 'verify', kind: 'positive', steps: ['Chạy verify-material.mjs với material.json và file gốc.'], expected: 'RAW_SIGNATURE_PASS nhưng assembly/PKIX vẫn NOT_CHECKED; không gọi là PDF/CMS/XML PASS.' },
      { id: 'UAT-28', title: 'Đối soát ký/tính phí trùng (operator)', page: 'verify', kind: 'operator', steps: ['Operator chạy collect-cardinality.mjs <tenant> <canonical-root> trước/sau từng replay.'], expected: 'root/attempt/committed result/usage/quantity khớp một giao dịch; không cộng số toàn hệ thống.' },
      { id: 'UAT-29', title: '00.4 EXPORT redacted và 00.5 CLOSE', page: 'recovery', kind: 'positive', steps: ['Bấm 00.4 EXPORT, lưu file evidence mới.', 'Bấm 00.5 CLOSE.'], expected: 'Evidence không chứa tài liệu/danh tính/continuation/URL/token. CLOSE chỉ đóng sổ local, không gửi CANCEL; bị chặn nếu còn mutation chưa rõ.' },
    ],
  },
]);

export const ALL_CASES = UAT_GROUPS.flatMap(g => g.cases.map(c => ({ ...c, group: g.id })));

export function createUatStore(store) {
  const name = 'uat-results.json';
  const load = () => store.readJson(name, { tester: '', updatedAt: null, cases: {} });
  return {
    get: load,
    update({ caseId, status, notes, tester }) {
      const data = load();
      if (tester !== undefined) data.tester = String(tester).slice(0, 120);
      if (caseId) {
        if (!ALL_CASES.some(c => c.id === caseId)) throw new Error('UNKNOWN_CASE');
        const entry = data.cases[caseId] || { status: 'NOT_EXECUTED', notes: '', evidence: [] };
        if (status !== undefined) {
          if (!RESULT_STATUSES.includes(status)) throw new Error('UNKNOWN_STATUS');
          entry.status = status;
        }
        if (notes !== undefined) entry.notes = String(notes).slice(0, 4000);
        entry.updatedAt = new Date().toISOString();
        data.cases[caseId] = entry;
      }
      data.updatedAt = new Date().toISOString();
      store.writeJson(name, data);
      return data;
    },
    attach(caseId, evidence) {
      const data = load();
      if (!ALL_CASES.some(c => c.id === caseId)) throw new Error('UNKNOWN_CASE');
      const entry = data.cases[caseId] || { status: 'NOT_EXECUTED', notes: '', evidence: [] };
      entry.evidence = [...(entry.evidence || []), { ...evidence, attachedAt: new Date().toISOString() }].slice(-20);
      data.cases[caseId] = entry;
      data.updatedAt = new Date().toISOString();
      store.writeJson(name, data);
      return data;
    },
  };
}

export function renderReport(data, meta) {
  const counts = Object.fromEntries(RESULT_STATUSES.map(s => [s, 0]));
  for (const c of ALL_CASES) counts[data.cases[c.id]?.status || 'NOT_EXECUTED']++;
  const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines = [
    '# Báo cáo UAT thủ công — VNeCA Unified Agent v2',
    '',
    `- Người test: ${data.tester || '(chưa ghi)'}`,
    `- Xuất lúc: ${new Date().toISOString()}`,
    `- Gói workbench: ${meta.packageName} (source ${meta.sourceRevision})`,
    `- Runtime evidence snapshot: ${meta.runtimeAt || 'n/a'}`,
    '',
    'Tổng hợp: ' + RESULT_STATUSES.filter(s => counts[s]).map(s => `${s}=${counts[s]}`).join(', '),
    '',
    '> NEGATIVE_PASS là từ chối đúng kỳ vọng, không phải signing PASS. Schema/digest PASS không chứng minh ký đúng, không chứng minh không ký/tính phí trùng.',
    '',
  ];
  for (const g of UAT_GROUPS) {
    lines.push(`## ${g.title} (${g.ref})`, '', '| ID | Ca kiểm thử | Kết quả | Ghi chú | Bằng chứng |', '|---|---|---|---|---|');
    for (const c of g.cases) {
      const r = data.cases[c.id] || {};
      const ev = (r.evidence || []).map(e => [e.op, e.http, e.refused || e.status, e.errorCode, e.requestId && 'req=' + e.requestId, e.sessionRef && 'session=' + e.sessionRef].filter(x => x != null && x !== '').join(' ')).join('; ');
      lines.push(`| ${c.id} | ${esc(c.title)} | ${r.status || 'NOT_EXECUTED'} | ${esc(r.notes)} | ${esc(ev)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
