import crypto from 'node:crypto';
import { AGENT_ORIGINS } from './config.mjs';

// Server-side port of customer-pre.js / customer-post.js from the workbench package.
// Session bookkeeping itself is the package's session-state.cjs (createWorkbench), unchanged.

export class Refusal extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail ?? null;
  }
}
const refuse = (code, detail) => { throw new Refusal(code, detail); };

export const OPS = Object.freeze(['INIT', 'SELECT', 'LOCK', 'VIEW', 'EXPORT', 'CLOSE', 'NEGATIVE_CHANGED_START', 'START', 'RETRY_START', 'CHOICE', 'INTERACTION', 'CANCEL', 'RETRY_MUTATION', 'STATUS', 'RESULT']);
export const MUTATIONS = Object.freeze(['START', 'RETRY_START', 'CHOICE', 'INTERACTION', 'CANCEL', 'RETRY_MUTATION']);
export const METHOD_CODES = Object.freeze(['CCCD_NFC', 'VNEID', 'APP_CA_REMOTE_SIGNING', 'USB_TOKEN', 'AUTO']);

const PREFLIGHT_NOTE = 'Known preflight blockers: this manual START is diagnosis only; any refusal stays FAILED, never signing PASS.';
const SECRET_KEYS = /^(token|continuation_token|url|reference|option_reference|completion_reference|content_base64|signature_value|certificate_chain_base64|authorization|access_token|identity|national_id|subject_ref)$/i;

function base64Bytes(s) {
  return typeof s === 'string' ? Buffer.from(s, 'base64').length : 0;
}

// Display copy of a response: opaque handles, capability URLs and payload bytes are masked.
// The raw reply stays server-side (private store / memory) exactly as Postman keeps it in Vault.
export function redact(value) {
  const walk = (x, key) => {
    if (Array.isArray(x)) {
      if (/^certificate_chain_base64$/i.test(key || '')) return x.map(c => `«certificate ${base64Bytes(c)} bytes»`);
      if (key === 'options') return x.map((o, i) => ({ index: i + 1, ...walk(o) }));
      return x.map(v => walk(v));
    }
    if (x && typeof x === 'object') {
      return Object.fromEntries(Object.entries(x).map(([k, v]) => {
        if (SECRET_KEYS.test(k) && typeof v === 'string') {
          if (/base64|signature_value/i.test(k)) return [k, `«${base64Bytes(v)} bytes»`];
          if (/^url$/i.test(k)) return [k, '«capability URL — dùng nút “Mở UI phê duyệt”»'];
          return [k, '«đã ẩn»'];
        }
        return [k, walk(v, k)];
      }));
    }
    return x;
  };
  return walk(value);
}

export function createWorkbenchService({ pkg, store, vault, envState, send, now = () => Date.now(), uuid = () => crypto.randomUUID(), onEvent = () => {} }) {
  const sha = buf => crypto.createHash('sha256').update(buf).digest();
  const WB = pkg.createWorkbench(x => sha(Buffer.from(x, 'utf8')).toString('hex'), now, uuid);
  const { wire, wireTypes } = pkg;
  const memory = new Map(); // sessionId -> { last, completedRaw }
  let busy = false;

  const regName = kind => 'sessions-' + kind + '.json';
  const registry = kind => WB.registry(store.readText(regName(kind)) || '');
  const saveRegistry = (kind, r) => store.writeText(regName(kind), JSON.stringify(r));
  const mem = id => memory.get(id) || memory.set(id, {}).get(id);

  function context(v) {
    return { agentKind: v.agent_kind, origin: v.agent_origin, tenant: v.tenant_id, binding: v.installation_binding, environment: v.installation_environment, callerRef: v.caller_vault_key, runtimeRevision: v.running_revision || 'NOT_CHECKED', runtimeArtifact: v.agent_artifact_sha256 || 'NOT_CHECKED' };
  }

  function loadPrivate(s) {
    const raw = store.readPrivate(s.id);
    if (!raw) refuse('PRIVATE_SESSION_STATE_MISSING');
    const p = JSON.parse(raw);
    WB.privateState(s, p);
    return p;
  }

  function pollWaitMs(s, p) {
    const poll = p?.current?.continuation?.poll_after_ms;
    if (!poll || !s.last?.at) return 0;
    return Math.max(0, poll - (now() - Date.parse(s.last.at)));
  }

  function nextStep(s) {
    return s.closed ? 'Evidence retained; STATUS/RESULT still allowed'
      : s.pendingMutation ? 'STATUS first, or explicit exact mutation replay'
      : s.last?.errorCode ? (s.last.recovery === 'RETRY_SAME_REQUEST' ? 'Retry original request only after checking dependency/state' : 'Operator must resolve refusal; no automatic retry')
      : s.state === 'NEW' ? '02 Lock intent'
      : s.state === 'LOCKED' ? '03 START (after full Operator preflight)'
      : s.state === 'ACTION_REQUIRED' ? 'Read action; select current option index or complete real interaction'
      : s.state === 'PROCESSING' ? 'STATUS after poll delay'
      : s.state === 'COMPLETED' ? 'RESULT; independent verification and Operator cardinality'
      : 'Read evidence / original session';
  }

  // Equivalent of wbView(): wb_selected_summary + wb_action_display.
  function view(s, p) {
    const summary = WB.evidence(s);
    summary.startKey = s.startKey;
    summary.next = nextStep(s);
    const a = p?.current?.action;
    const actionDisplay = a ? {
      type: a.type,
      prompt: a.prompt,
      options: (a.options || []).map((o, i) => ({ index: i + 1, label: o.label, method: o.method_code || '' })),
      hostedApproval: a.interaction ? { message: 'Complete real approval in trusted UI; never paste OTP/PIN here', expiresAt: a.interaction.expires_at } : null,
      continuationExpiresAt: p.current.continuation?.expires_at || null,
      pollAfterMs: p.current.continuation?.poll_after_ms || null,
    } : null;
    return {
      summary,
      actionDisplay,
      pollWaitMs: pollWaitMs(s, p),
      pendingMutation: s.pendingMutation || null,
      cancelOnlyHandle: !!p?.readRecovery?.continuation,
      currentContinuationExpiresAt: p?.current?.continuation?.expires_at || null,
      locked: !!s.intentDigest,
      lastResponse: memory.get(s.id)?.last || null,
      completedInMemory: !!memory.get(s.id)?.completedRaw,
    };
  }

  function sessionsList(kind) {
    const r = registry(kind);
    return Object.values(r.sessions)
      .map(s => ({ id: s.id, ref: s.id.slice(0, 12), caseId: s.caseId, runId: s.runId, state: s.state, closed: s.closed, signingId: s.signingId, method: s.method || null, createdAt: s.createdAt, lastStatus: s.last?.status || null, lastError: s.last?.errorCode || null }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function selectedView(kind) {
    const v = envState.vars(kind);
    if (!v.selected_session) return null;
    try {
      const r = registry(kind);
      const s = WB.selected(r, v.selected_session, context(v));
      let p = null;
      if (s.intentDigest) {
        try { p = loadPrivate(s); } catch { p = null; }
      }
      return view(s, p);
    } catch {
      return null;
    }
  }

  async function execute(kind, op, params) {
    const v = envState.vars(kind);
    const c = context(v);
    if (AGENT_ORIGINS[c.agentKind] !== c.origin) refuse('WRONG_AGENT_ORIGIN');
    const r = registry(kind);

    if (op === 'INIT') {
      const caseId = params.caseId ?? v.case_id, runId = params.runId ?? v.run_id;
      const s = WB.init(r, c, caseId, runId, params.newStartKey || 'start-' + uuid());
      saveRegistry(kind, r);
      envState.select(kind, s.id);
      envState.update(kind, { case_id: caseId, run_id: runId });
      return { view: view(s, null), message: 'Đã tạo phiên mới. Key START chỉ sinh ở bước này.' };
    }
    if (op === 'SELECT') {
      let id = params.selectSessionId;
      if (!id) {
        const caseId = params.caseId ?? v.case_id, runId = params.runId ?? v.run_id;
        const matches = Object.values(r.sessions).filter(s => s.caseId === caseId && s.runId === runId && s.contextHash === WB.contextHash(c));
        if (matches.length !== 1) refuse('SELECT_EXACT_EXISTING_SESSION');
        id = matches[0].id;
      }
      const s = WB.selected(r, id, c);
      envState.select(kind, s.id);
      envState.update(kind, { case_id: s.caseId, run_id: s.runId });
      return { view: view(s, s.intentDigest ? loadPrivate(s) : null), message: 'Đã chọn phiên ' + s.caseId + ' / ' + s.runId };
    }

    if (!v.selected_session) refuse('NO_SELECTED_SESSION_USE_NEW_OR_SELECT');
    const s = WB.selected(r, v.selected_session, c);
    const folderMethod = params.method || null;
    if (folderMethod && !METHOD_CODES.includes(folderMethod)) refuse('UNKNOWN_METHOD');
    if (folderMethod && s.requestedMethod && s.requestedMethod !== folderMethod) refuse('FOLDER_METHOD_DOES_NOT_MATCH_SELECTED_SESSION');

    if (op === 'LOCK') {
      let input, preset;
      if (params.inputSource === 'private') {
        const raw = vault.get('vneca-private-input');
        if (!raw) refuse('PRIVATE_INPUT_NOT_IN_VAULT');
        input = JSON.parse(raw);
        preset = input.mode === 'FILE' ? input.format : 'HASH_CMS';
        if (input.mode === 'HASH' && (input.format !== 'CMS' || input.digest_role !== 'DOCUMENT_DIGEST')) refuse('INPUT_COMBINATION_NOT_IN_MATRIX');
      } else {
        preset = params.sampleKey || 'PDF';
        if (!pkg.samples[preset]) refuse('UNKNOWN_SAMPLE_INPUT');
        input = structuredClone(pkg.samples[preset].input);
      }
      const combo = pkg.samples[preset];
      if (!combo) refuse('INPUT_COMBINATION_NOT_IN_MATRIX');
      const identityRaw = vault.get(v.identity_vault_key);
      if (!identityRaw) refuse('SIGNING_IDENTITY_NOT_IN_VAULT');
      const identity = JSON.parse(identityRaw);
      const method = folderMethod || v.method_code;
      const body = {
        api_version: '2.0', command: 'START', idempotency_key: s.startKey, input,
        signature_profile: combo.signature_profile, output: combo.output, identity,
        selection: { ...(method && method !== 'AUTO' ? { method_code: method } : {}), strategy: 'ASK_IF_AMBIGUOUS', use_saved_preference: false },
        interaction: { mode: c.agentKind === 'LOCAL' ? 'SDK_UI' : 'HEADLESS', wait_timeout_ms: 1000 },
      };
      const certificateReference = params.certificateReference ?? v.certificate_reference;
      if (certificateReference) body.selection.certificate_reference = certificateReference;
      try {
        wire.validateRequest(JSON.stringify(body));
      } catch {
        refuse('CONTRACT_REQUEST_INVALID', identity.subject_ref ? null : 'identity.subject_ref');
      }
      const p = WB.lock(s, body);
      s.inputDigest = body.input.mode === 'FILE'
        ? { algorithm: 'SHA-256', hex: sha(Buffer.from(body.input.content_base64, 'base64')).toString('hex') }
        : body.input.document_digest;
      store.writePrivate(s.id, JSON.stringify(p));
      saveRegistry(kind, r);
      envState.update(kind, { method_code: method, certificate_reference: certificateReference || '' });
      return { view: view(s, p), message: 'Đã khóa intent (không gửi HTTP). Sửa biến sau LOCK không đổi phiên.' };
    }

    // A NEW session has no private state yet; Postman fails generically here, the website just shows it.
    if (!s.intentDigest) {
      if (op === 'VIEW') return { view: view(s, null) };
      if (op === 'EXPORT') return { view: view(s, null), export: WB.evidence(s) };
      if (op === 'CLOSE') {
        WB.close(s);
        saveRegistry(kind, r);
        return { view: view(s, null), message: 'Đã đóng sổ local.' };
      }
      refuse('LOCK_INTENT_FIRST');
    }
    const p = loadPrivate(s);

    if (['VIEW', 'EXPORT', 'CLOSE'].includes(op)) {
      if (op === 'CLOSE') {
        if (p.pendingMutation && !['COMPLETED', 'CANCELLED'].includes(s.state)) refuse('PRIVATE_PENDING_MUTATION_RECONCILE_FIRST');
        WB.close(s);
        saveRegistry(kind, r);
      }
      return { view: view(s, p), ...(op === 'EXPORT' ? { export: WB.evidence(s) } : {}), ...(op === 'CLOSE' ? { message: 'Đã đóng sổ local, giữ lịch sử. Không gửi CANCEL.' } : {}) };
    }
    if (op === 'NEGATIVE_CHANGED_START') refuse('HARNESS_CASE_ONLY_NO_LIVE_FAULT_INJECTION');

    const notes = [];
    const mutation = MUTATIONS.includes(op);
    if (mutation) {
      const expected = s.id.slice(0, 12) + ':' + op;
      if (params.sendOnce !== expected) refuse('MANUAL_SEND_ONCE_REQUIRED', expected);
      if (op === 'START' && v.operator_preflight_status === 'NOT_CHECKED') refuse('OPERATOR_PREFLIGHT_REQUIRED_SEE_MATRIX');
      if (op === 'START' && v.operator_preflight_status !== 'PASS') notes.push(PREFLIGHT_NOTE);
      if (op === 'INTERACTION' && params.interactionCompleted !== true) refuse('COMPLETE_REAL_APPROVAL_FIRST');
    } else {
      const wait = pollWaitMs(s, p);
      if (wait > 0) refuse('WAIT_SERVER_POLL_DELAY', wait);
    }
    const sent = WB.prepare(s, p, op, Number(params.selectedOptionIndex), op === 'INTERACTION' ? p.current?.action?.interaction?.completion_reference : undefined, Number(params.replayCommandOrdinal) || undefined);
    try {
      wire.validateRequest(sent.raw);
    } catch {
      refuse('CONTRACT_REQUEST_INVALID');
    }
    const bearer = vault.get(c.callerRef);
    if (!/^agc_[0-9a-f]{64}$/.test(bearer || '')) refuse('CURRENT_AGENT_CALLER_ACCESS_REQUIRED_NOT_ADMIN_OR_BROWSER_TOKEN');
    const nonce = uuid();
    const wbSent = { ref: sent.ref, command: sent.command, sessionId: s.id, nonce, runtimeRevision: c.runtimeRevision, runtimeArtifact: c.runtimeArtifact };
    // Persist exact command before HTTP. A transport failure cannot manufacture a fresh key/body.
    store.writePrivate(s.id, JSON.stringify(p));
    saveRegistry(kind, r);

    let res;
    try {
      res = await send(c.origin + '/api/sign-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bearer, 'X-VNeCA-Request-Id': nonce },
        body: sent.raw,
      });
    } catch (e) {
      const transportError = { code: e.code || 'TRANSPORT_ERROR', tls: !!e.tls, message: e.message };
      mem(s.id).last = { at: new Date(now()).toISOString(), op, sent: true, transportError, tests: [], notes };
      return { sent: true, transportError, notes, view: view(s, p) };
    }
    return processResponse(kind, c, wbSent, op, res, notes);
  }

  // Port of customer-post.js. On any check failure the session is not advanced.
  function processResponse(kind, c, wbSent, op, res, notes) {
    const r = registry(kind);
    const s = WB.selected(r, wbSent.sessionId, c);
    const p = loadPrivate(s);
    const tests = [];
    let reply = null, display = null, updateError = null;
    try {
      display = redact(JSON.parse(res.text));
    } catch {
      display = { nonJsonBody: res.text.slice(0, 2000) };
    }
    try {
      reply = wire.validateResponse(res.text);
      const expected = reply.status === 'FAILED' ? wireTypes.publicErrorHttpStatus[reply.error.code] : reply.status === 'PROCESSING' ? 202 : 200;
      tests.push({ name: 'HTTP/envelope match contract; this is not signing/crypto PASS', pass: res.status === expected, detail: `HTTP ${res.status}, contract ${expected}` });
      if (res.status !== expected) throw new Error('Response HTTP mismatch');
      if (reply.result) {
        const x = reply.result;
        if (x.kind !== s.output || x.signature_profile !== s.signatureProfile) throw new Error('Result differs from locked output/profile');
        if (x.kind === 'ARTIFACT' && sha(Buffer.from(x.content_base64, 'base64')).toString('base64') !== x.artifact_digest.value) throw new Error('Returned bytes do not match artifact digest');
        if (x.kind === 'SIGNING_MATERIAL' && sha(Buffer.from(x.signing_input.content_base64, 'base64')).toString('base64') !== x.signing_input.digest.value) throw new Error('Signing input digest mismatch');
      }
      WB.record(s, p, wbSent, reply, res.status, wbSent.nonce);
      store.writePrivate(s.id, JSON.stringify(p));
      saveRegistry(kind, r);
      tests.push({ name: 'Current response is recorded; business status remains explicit', pass: s.last.status === reply.status });
      tests.push({ name: 'Business command has no refusal (schema PASS is separate)', pass: reply.status !== 'FAILED' });
      if (reply.status === 'COMPLETED') mem(s.id).completedRaw = res.text;
    } catch (e) {
      updateError = /^[A-Za-z0-9_ :.,/-]+$/.test(e.message) ? e.message : 'CONTRACT_VALIDATION_FAILED';
      tests.push({ name: 'Session update failed; retain original request and use recovery', pass: false, detail: 'Contract/Vault/session/digest check failed. Original session retained. No new START.' });
    }
    const v = view(s, p);
    const last = {
      at: new Date(now()).toISOString(), op, sent: true, http: res.status, tests, reply: display, updateError, notes,
      visual: { caseId: s.caseId, runId: s.runId, key: s.startKey, signingId: s.signingId || 'Not admitted', state: s.state, next: v.summary.next, crypto: 'NOT_CHECKED', cardinality: 'NOT_CHECKED' },
    };
    mem(s.id).last = last;
    v.lastResponse = last;
    v.completedInMemory = !!memory.get(s.id)?.completedRaw;
    return { sent: true, http: res.status, tests, reply: display, updateError, notes, view: v };
  }

  return {
    WB,
    sessionsList,
    selectedView,
    async run(kind, op, params = {}) {
      if (!OPS.includes(op)) return { ok: false, op, refused: 'UNKNOWN_WORKBENCH_OPERATION', sent: false };
      if (busy) return { ok: false, op, refused: 'BUSY_ANOTHER_REQUEST_IN_FLIGHT', sent: false };
      busy = true;
      let out;
      try {
        const r = await execute(kind, op, params);
        out = { ok: !r.transportError && (!r.tests || r.tests.every(t => t.pass)), op, sent: false, ...r };
      } catch (e) {
        const code = e instanceof Refusal ? e.code : /^[A-Z0-9_ :.-]+$/.test(e.message) ? e.message : 'PRIVATE_VAULT_OR_SESSION_VALIDATION_FAILED';
        out = { ok: false, op, sent: false, refused: code, detail: e instanceof Refusal ? e.detail : null, view: selectedView(kind) };
      } finally {
        busy = false;
      }
      const s = out.view?.summary;
      onEvent({ env: kind, op, sessionRef: s?.sessionRef?.slice(0, 12) || null, caseId: s?.caseId || null, runId: s?.runId || null, sent: out.sent, http: out.http ?? null, state: s?.state || null, replyStatus: out.reply?.status || null, errorCode: out.reply?.error?.code || null, refused: out.refused || null, transport: out.transportError?.code || null });
      return out;
    },
    // Opens only on explicit tester click; the capability URL is never part of state payloads.
    approvalUrl(kind) {
      const v = envState.vars(kind);
      const s = WB.selected(registry(kind), v.selected_session, context(v));
      const p = loadPrivate(s);
      const i = p.current?.action?.type === 'USER_AUTHORIZATION' ? p.current.action.interaction : null;
      if (!i) refuse('NO_CURRENT_HOSTED_APPROVAL');
      if (Date.parse(i.expires_at) <= now()) refuse('HOSTED_APPROVAL_EXPIRED_READ_ORIGINAL_SESSION');
      return i.url;
    },
    completed(kind) {
      const v = envState.vars(kind);
      const s = WB.selected(registry(kind), v.selected_session, context(v));
      const raw = memory.get(s.id)?.completedRaw;
      if (!raw) refuse('NO_COMPLETED_RESULT_IN_MEMORY_SEND_08_RESULT');
      return { session: s, priv: loadPrivate(s), raw };
    },
  };
}
