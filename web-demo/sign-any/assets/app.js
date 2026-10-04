// Bộ điều khiển luồng Universal Broker (provider = ANY).
// Mọi bước đều đi qua POST api/bff.php để có thể hoán đổi mock/live ở phía PHP.

const boot = JSON.parse(document.getElementById('bootstrap').textContent);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  accessToken: '',
  transactionId: '',
  brokerUrl: '',
  brokerChallenge: '',
  s2sToken: '',
  sessionId: '',
  sessionToken: '',
  providers: [],
  selected: null,
  lastStatus: '',
  lastTransactionStatus: '',
  signedAt: '',
};

// ───────────────────────────────────────────────────────────────────────────
// Tiện ích
// ───────────────────────────────────────────────────────────────────────────

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function mask(value) {
  const text = String(value ?? '');
  if (!text) return '—';
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}…${text.slice(-6)} (${text.length} ký tự)`;
}

function params() {
  const out = {};
  $$('#params [data-field]').forEach((input) => { out[input.dataset.field] = input.value.trim(); });
  return out;
}

function fillForm() {
  $$('#params [data-field]').forEach((input) => {
    input.value = boot.defaults[input.dataset.field] ?? '';
  });
}

function queryFromUrl(url, key) {
  try {
    return new URL(url).searchParams.get(key) || '';
  } catch {
    return '';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gọi BFF
// ───────────────────────────────────────────────────────────────────────────

async function callBff(action, payload) {
  const response = await fetch('api/bff.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`BFF trả về không phải JSON (HTTP ${response.status}).`);
  }
  if (!response.ok || data.error) {
    throw new Error(data.error ? `${data.error.code}: ${data.error.message}` : `HTTP ${response.status}`);
  }
  return data;
}

// ───────────────────────────────────────────────────────────────────────────
// Trạng thái phiên + nhật ký
// ───────────────────────────────────────────────────────────────────────────

const STATE_FIELDS = [
  ['Chế độ', () => boot.mode],
  ['Gateway', () => boot.platformUrl],
  ['access_token', () => mask(state.accessToken)],
  ['transaction_id', () => state.transactionId || '—'],
  ['broker_url', () => state.brokerUrl || '—'],
  ['broker_challenge (từ url)', () => mask(state.brokerChallenge)],
  ['resume_token (S2S, dùng 1 lần)', () => mask(state.s2sToken)],
  ['session_id', () => state.sessionId || '—'],
  ['session_token', () => mask(state.sessionToken)],
  ['Số CA khả dụng', () => String(state.providers.length)],
  ['CA đang chọn', () => state.selected ? `${state.selected.provider_name} (${state.selected.method_code})` : '—'],
  ['status', () => state.lastStatus || '—'],
  ['transaction_status', () => state.lastTransactionStatus || '—'],
  ['signed_at', () => state.signedAt || '—'],
];

function renderState() {
  const grid = $('#state');
  grid.replaceChildren(...STATE_FIELDS.map(([label, getter]) => {
    const box = element('div', 'state-item');
    box.append(element('span', '', label), element('strong', 'mono', String(getter())));
    return box;
  }));
  $('#portal-session').textContent = state.sessionId ? `session_id: ${state.sessionId}` : '';
}

function renderProviders() {
  const host = $('#providers');
  host.replaceChildren();
  if (!state.providers.length) {
    host.append(element('p', 'empty', 'Tenant chưa được gán nhà cung cấp CA nào (providers rỗng).'));
    state.selected = null;
    renderState();
    return;
  }
  if (!state.selected || !state.providers.some((p) => p.provider_id === state.selected.provider_id)) {
    state.selected = state.providers[0];
  }
  state.providers.forEach((provider, index) => {
    const card = element('label', 'provider');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'provider';
    radio.value = String(index);
    radio.checked = state.selected.provider_id === provider.provider_id;
    radio.addEventListener('change', () => { state.selected = provider; renderState(); });
    const copy = element('span', 'provider-copy');
    copy.append(
      element('strong', '', provider.provider_name || provider.provider_id),
      element('small', '', `${provider.provider_id} · method_code=${provider.method_code} · ${provider.environment || ''}/${provider.channel || ''}`),
    );
    card.append(radio, copy);
    host.append(card);
  });
  renderState();
}

let logCount = 0;

function logEntry(envelope) {
  const ok = envelope.response.http_status < 400 && envelope.success;
  const card = element('article', `log-entry ${ok ? 'ok' : 'fail'}`);
  const header = element('header', 'log-header');
  header.append(
    element('span', 'method', envelope.request.method),
    element('strong', '', envelope.step),
    element('span', `status-chip ${ok ? 'ok' : 'fail'}`, String(envelope.response.http_status)),
    element('span', 'muted', `${envelope.duration_ms} ms · ${envelope.mode}`),
  );
  card.append(header);
  card.append(element('div', 'log-url mono', envelope.request.url));

  const requestBox = element('details', 'log-block');
  requestBox.append(element('summary', '', 'Request'), element('pre', '', JSON.stringify(envelope.request, null, 2)));
  card.append(requestBox);

  const responseBox = element('details', 'log-block');
  responseBox.open = true;
  responseBox.append(element('summary', '', 'Response'), element('pre', '', JSON.stringify(envelope.response.body, null, 2)));
  card.append(responseBox);

  const list = $('#log');
  if (list.querySelector('.empty')) list.replaceChildren();
  list.prepend(card);
  logCount += 1;
  $('#log-count').textContent = String(logCount);
  return card;
}

function setFlow(step, status) {
  const item = document.querySelector(`.flow-item[data-step="${step}"]`);
  if (!item) return;
  item.classList.remove('done', 'fail', 'active');
  if (status) item.classList.add(status);
}

function showError(message) {
  const box = $('#request-error');
  box.textContent = message;
  box.classList.remove('hidden');
}

function clearError() {
  $('#request-error').classList.add('hidden');
}

// ───────────────────────────────────────────────────────────────────────────
// Áp kết quả trích xuất vào state (giống test-script trong collection)
// ───────────────────────────────────────────────────────────────────────────

function absorb(envelope) {
  const derived = envelope.derived || {};
  if (derived.access_token) state.accessToken = derived.access_token;
  if (derived.transaction_id) state.transactionId = derived.transaction_id;
  if (derived.broker_url) {
    state.brokerUrl = derived.broker_url;
    // Mỗi lần nền tảng trả broker_url mới (1.1 create, 1.1 replay, 1.2 GET) thì challenge
    // cũng mới. Luôn dùng challenge của response GẦN NHẤT — giống script cấp collection của
    // Postman ghi đè broker_url/broker_challenge sau mọi request; nếu không 2.1 sẽ trả
    // 404 RESUME_TOKEN_NOT_FOUND.
    const challenge = derived.broker_challenge || queryFromUrl(derived.broker_url, 'resume_token');
    if (challenge) state.brokerChallenge = challenge;
  }
  if (derived.resume_token) state.s2sToken = derived.resume_token;
  if (derived.session_id) state.sessionId = derived.session_id;
  if (derived.session_token) state.sessionToken = derived.session_token;
  if (Array.isArray(derived.providers) && derived.providers.length) state.providers = derived.providers;
  if (derived.status) state.lastStatus = derived.status;
  if (derived.transaction_status) state.lastTransactionStatus = derived.transaction_status;
  if (derived.signed_at) state.signedAt = derived.signed_at;
  renderState();
}

function selectedProvider() {
  const checked = document.querySelector('input[name="provider"]:checked');
  if (checked && state.providers[Number(checked.value)]) return state.providers[Number(checked.value)];
  return state.selected ?? state.providers[0] ?? null;
}

function setBusy(busy) {
  $('#busy-badge').classList.toggle('hidden', !busy);
  $$('.actions button[data-step]').forEach((button) => { button.disabled = busy; });
  $('#auto-run').disabled = busy;
  $('#broker-portal').setAttribute('aria-busy', busy ? 'true' : 'false');
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ───────────────────────────────────────────────────────────────────────────
// Các bước
// ───────────────────────────────────────────────────────────────────────────

const ACTION_OF = {
  token: 'token', create: 'create', get: 'get', poll: 'get', open: 'broker_open',
  resume: 'broker_resume', revoke: 'broker_revoke', s2s: 'client_step_resume',
};

const FLOW_OF = {
  token: 'token', create: 'create', get: 'get', poll: 'poll', open: 'open',
  resume: 'resume', s2s: 'resume', revoke: 'open',
};

function buildPayload(step) {
  const form = params();
  const provider = selectedProvider();
  const flow = {
    environment: provider?.environment ?? form.environment,
    channel: provider?.channel ?? form.channel,
    flow_code: form.flow_code,
    method_code: provider?.method_code ?? form.method_code,
    provider_id: provider?.provider_id ?? '',
  };

  switch (step) {
    case 'token':
      return { client_id: form.client_id, client_secret: form.client_secret, scope: form.scope };
    case 'create':
      return {
        access_token: state.accessToken,
        tenant_id: form.tenant_id,
        integration_key: form.integration_key,
        business_category: form.business_category,
        user_id: form.user_id,
        document_name: form.document_name,
        document_hash: form.document_hash,
        idempotency_key: form.idempotency_key,
        method_code: form.method_code,
      };
    case 'get':
    case 'poll':
      return { access_token: state.accessToken, transaction_id: state.transactionId };
    case 'open':
      return {
        tenant_id: form.tenant_id,
        transaction_id: state.transactionId,
        resume_token: state.brokerChallenge,
        device_fingerprint: form.device_fingerprint,
      };
    case 'resume':
      return {
        session_id: state.sessionId,
        session_token: state.sessionToken,
        device_fingerprint: form.device_fingerprint,
        ...flow,
      };
    case 'revoke':
      return {
        session_id: state.sessionId,
        session_token: state.sessionToken,
        device_fingerprint: form.device_fingerprint,
      };
    case 's2s':
      return {
        access_token: state.accessToken,
        transaction_id: state.transactionId,
        step_id: boot.stepId,
        resume_token: state.s2sToken,
        ...flow,
      };
    default:
      return null;
  }
}

const PREREQUISITE = {
  token: () => {
    const form = params();
    return (form.client_id && form.client_secret && form.scope)
      ? ''
      : 'Nhập client_id/client_secret/scope ở mục 01.';
  },
  create: () => (state.accessToken ? '' : 'Chạy 0.1 để có access_token trước.'),
  get: () => (state.accessToken && state.transactionId ? '' : 'Cần access_token (0.1) và transaction_id (1.1).'),
  poll: () => (state.accessToken && state.transactionId ? '' : 'Cần access_token (0.1) và transaction_id (1.1).'),
  open: () => (state.transactionId && state.brokerChallenge ? '' : 'Cần transaction_id và broker resume_token từ 1.1/1.2.'),
  resume: () => (state.sessionToken ? '' : 'Chạy 2.1 để có session_token trước.'),
  revoke: () => (state.sessionToken ? '' : 'Chạy 2.1 để có session_token trước.'),
  s2s: () => (state.accessToken && state.transactionId && state.s2sToken ? '' : 'Cần access_token, transaction_id và resume_token (S2S) từ 1.1.'),
};

async function runStep(step) {
  const payload = buildPayload(step);
  if (!payload) return false;

  const blocker = (PREREQUISITE[step] || (() => ''))();
  if (blocker) {
    setFlow(FLOW_OF[step], 'fail');
    showError(blocker);
    return false;
  }

  clearError();
  setBusy(true);
  setFlow(FLOW_OF[step], 'active');

  try {
    const envelope = await callBff(ACTION_OF[step], payload);
    logEntry(envelope);
    absorb(envelope);

    const ok = envelope.response.http_status < 400 && envelope.success;
    setFlow(FLOW_OF[step], ok ? 'done' : 'fail');
    if (!ok) {
      const error = envelope.response.body?.error ?? {};
      showError(`${envelope.response.http_status} ${error.code ?? ''} — ${error.message ?? 'Yêu cầu thất bại.'}`);
      return false;
    }

    if (step === 'open') {
      $('#broker-portal').classList.remove('hidden');
      renderProviders();
    }
    if (step === 'revoke') {
      $('#broker-portal').classList.add('hidden');
      state.sessionId = '';
      state.sessionToken = '';
      renderState();
    }
    if (step === 'resume' || step === 's2s') {
      $('#broker-portal').classList.add('hidden');
    }
    return true;
  } catch (error) {
    setFlow(FLOW_OF[step], 'fail');
    showError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    setBusy(false);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Chạy tự động toàn bộ luồng
// ───────────────────────────────────────────────────────────────────────────

async function autoRun() {
  const sequence = ['token', 'create', 'get', 'open', 'resume'];
  for (const step of sequence) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await runStep(step);
    if (!ok) return;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await runStep('poll');
    if (!ok) return;
    if (state.lastStatus === 'COMPLETED') return;
    // eslint-disable-next-line no-await-in-loop
    await wait(1000);
  }
  showError('Hết số lần poll mà giao dịch chưa COMPLETED.');
}

function resetDemo() {
  logCount = 0;
  $('#log-count').textContent = '0';
  $('#log').replaceChildren(element('p', 'empty', 'Chưa có request nào. Bấm một bước ở mục 02 để bắt đầu.'));
  Object.assign(state, {
    accessToken: '', transactionId: '', brokerUrl: '', brokerChallenge: '',
    s2sToken: '', sessionId: '', sessionToken: '', providers: [], selected: null,
    lastStatus: '', lastTransactionStatus: '', signedAt: '',
  });
  $$('.flow-item').forEach((item) => item.classList.remove('done', 'fail', 'active'));
  $('#broker-portal').classList.add('hidden');
  clearError();
  renderState();
}

// ───────────────────────────────────────────────────────────────────────────
// Khởi tạo
// ───────────────────────────────────────────────────────────────────────────

$$('button[data-step]').forEach((button) => {
  button.addEventListener('click', () => { void runStep(button.dataset.step); });
});
$('#auto-run').addEventListener('click', () => { void autoRun(); });
$('#reset-form').addEventListener('click', fillForm);
$('#clear-log').addEventListener('click', resetDemo);

fillForm();
renderState();
