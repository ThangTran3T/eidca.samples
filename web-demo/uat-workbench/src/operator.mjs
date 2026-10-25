import { AGENT_ORIGINS, PLATFORM_ORIGIN } from './config.mjs';

// Operator metadata (revisions, hashes, credential references) is what the operator must read,
// so only values that act as credentials are masked in the browser view.
const CREDENTIAL_KEY = /(access_token|refresh_token|id_token|password|secret|api[_-]?key|private[_-]?key|sealedCallerCredential|^token$)/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, CREDENTIAL_KEY.test(k) && typeof v === 'string' ? '«đã ẩn»' : redact(v)]));
  }
  return value;
}

const enc = encodeURIComponent;
const qs = obj => Object.entries(obj).map(([k, v]) => enc(k) + '=' + enc(v ?? '')).join('&');

// Requests of Operator-Setup-Preflight.postman_collection.json, same paths and names.
export const OPERATOR_REQUESTS = Object.freeze({
  LOGIN: { name: '00 LOGIN — credentials from Local Vault', mode: 'LOGIN', method: 'POST', path: () => '/v1/auth/login' },
  PREFLIGHT: {
    name: '01 Complete scoped preflight', mode: 'READ', method: 'GET',
    path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/agent-preflight?` + qs({
      binding: v.installation_binding, environment: v.installation_environment, agent: v.agent_id, agentVersion: v.agent_version,
      key: v.authentication_key_id, profile: v.profile_revision, policy: v.policy_revision, grant: v.caller_grant_id,
      policyHash: v.policy_hash, artifact: v.verifier_artifact, mode: v.finalization_mode, signatureProfile: v.owner_signature_profile,
      verifierRevision: v.verifier_revision,
    }),
  },
  ASSIGNMENTS: { name: '02 Method / Provider assignments', mode: 'READ', method: 'GET', path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/method-providers` },
  PROVIDER_APIS: { name: '03 Provider APIs effective metadata', mode: 'READ', method: 'GET', path: v => `/v1/admin/providers/${enc(v.operator_provider_id)}/apis` },
  PROVIDER_FLOWS: { name: '04 Provider flow revisions', mode: 'READ', method: 'GET', path: v => `/v1/admin/providers/${enc(v.operator_provider_id)}/flows` },
  NATIVE_PLAN: {
    name: '05 Native Provider plan dry-read', mode: 'READ', method: 'GET',
    path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/native-provider-readiness?` + qs({ provider: v.operator_provider_id, environment: v.installation_environment, revision: v.operator_provider_revision, hash: v.operator_provider_hash }),
  },
  TRANSACTIONS: {
    name: '06 Transaction list / reconciliation evidence', mode: 'READ', method: 'GET',
    path: v => '/v1/admin/transactions?' + qs({ tenantId: v.tenant_id, transactionId: v.canonical_transaction_id, limit: '25' }),
  },
  HEALTH_LOCAL_STATUS: { name: 'Local normal TLS health', mode: 'HEALTH', method: 'GET', url: AGENT_ORIGINS.LOCAL + '/api/status' },
  HEALTH_LOCAL_CONNECTION: { name: 'Local configured Platform connection — no signing action', mode: 'HEALTH', method: 'GET', url: AGENT_ORIGINS.LOCAL + '/api/connection/platform' },
  HEALTH_SERVER: { name: 'Server current health — not a tenant installation', mode: 'HEALTH', method: 'GET', url: AGENT_ORIGINS.SERVER + '/health' },
  PROVISION_EXISTING_AGENT: { name: 'PROVISION_EXISTING_AGENT', mode: 'WRITE', method: 'POST', path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/agent-installations` },
  PUBLISH_NATIVE_BINDING: { name: 'PUBLISH_NATIVE_BINDING', mode: 'WRITE', method: 'POST', path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/native-bindings/${enc(v.operator_flow_id)}:publish` },
  PUBLISH_COPY_PROFILE: { name: 'PUBLISH_COPY_PROFILE', mode: 'WRITE', method: 'POST', path: v => `/v1/admin/tenants/${enc(v.tenant_id)}/agent-copy-profiles` },
});

export function createOperatorService({ vault, envState, send }) {
  let busy = false;

  async function execute(kind, id, params) {
    const def = OPERATOR_REQUESTS[id];
    if (!def) return { refused: 'UNKNOWN_OPERATOR_REQUEST' };
    const v = envState.vars(kind);
    const headers = { 'Content-Type': 'application/json' };
    let url, body = null;

    if (def.mode === 'HEALTH') {
      url = def.url; // No admin/customer bearer is forwarded to Agent read endpoints.
      delete headers['Content-Type'];
    } else {
      if (v.platform_origin !== PLATFORM_ORIGIN) return { refused: 'WRONG_MEASURED_TEST_CONTROL_PLANE' };
      url = PLATFORM_ORIGIN + def.path(v);
      if (def.mode === 'LOGIN') {
        const username = vault.get('vneca-operator-username'), password = vault.get('vneca-operator-password');
        if (!username || !password) return { refused: 'OPERATOR_CREDENTIALS_NOT_IN_VAULT' };
        body = JSON.stringify({ username, password });
      } else {
        if (def.mode === 'WRITE') {
          if (params.operatorOnce !== def.name) return { refused: 'EXACT_MANUAL_OPERATOR_ONCE_REQUIRED', detail: def.name };
          if (params.ownerReviewed !== true) return { refused: 'OWNER_REVIEWED_SCOPE_CONFIRMATION_REQUIRED' };
          let prepared;
          try { prepared = JSON.parse(params.preparedJson || ''); } catch { prepared = null; }
          if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) return { refused: 'REAL_WORKFLOW_PREPARED_JSON_POP_REQUIRED' };
          body = JSON.stringify(prepared);
          headers['X-Reason-Code'] = 'MANUAL_OPERATOR_UNIFIED_WORKBENCH';
        }
        const token = vault.get('vneca-operator-jwt');
        if (!token) return { refused: 'REAL_OPERATOR_LOGIN_REQUIRED' };
        headers.Authorization = 'Bearer ' + token;
      }
    }

    let res;
    try {
      res = await send(url, { method: def.method, headers, body, timeoutMs: 30000, maxBytes: 16 * 1024 * 1024 });
    } catch (e) {
      return { sent: true, request: { method: def.method, url }, transportError: { code: e.code || 'TRANSPORT_ERROR', tls: !!e.tls, message: e.message } };
    }
    let json = null;
    try { json = JSON.parse(res.text); } catch { json = null; }
    const tests = [];
    const out = { sent: true, request: { method: def.method, url }, http: res.status, tests };

    if (def.mode === 'LOGIN') {
      tests.push({ name: 'Real operator login HTTP201', pass: res.status === 201 });
      const token = json?.data?.access_token;
      if (res.status === 201 && token) {
        vault.set('vneca-operator-jwt', token, 'login:' + new Date().toISOString());
        out.tokenStored = true;
      } else if (res.status === 201) {
        tests.push({ name: 'Operator token remains private', pass: false, detail: 'Login/Vault failed' });
      }
      out.response = json ? redact(json) : { nonJsonBody: res.text.slice(0, 2000) };
      return out;
    }
    if (def.mode === 'HEALTH') {
      tests.push({ name: 'Read-only transport HTTP succeeded, not signing PASS', pass: res.status === 200 });
      out.response = json ? redact(json) : { nonJsonBody: res.text.slice(0, 2000) };
      return out;
    }
    tests.push({ name: 'Operator HTTP request succeeded; not signing PASS', pass: res.status >= 200 && res.status <= 299 });
    if (res.status === 200 && json?.schemaVersion === 'AgentOperatorPreflight/v1') {
      // Only a real scoped preflight response moves the START gate; health never does.
      envState.setPreflight(kind, { status: json.overall === 'PASS' ? 'PASS' : 'BLOCKED', overall: json.overall, at: new Date().toISOString(), json });
      out.preflightStatus = json.overall === 'PASS' ? 'PASS' : 'BLOCKED';
    }
    out.response = json ? redact(json) : { nonJsonBody: res.text.slice(0, 2000) };
    return out;
  }

  return {
    async run(kind, id, params = {}) {
      if (busy) return { ok: false, refused: 'BUSY_ANOTHER_REQUEST_IN_FLIGHT', sent: false };
      busy = true;
      try {
        const r = await execute(kind, id, params);
        return { id, name: OPERATOR_REQUESTS[id]?.name, ok: !r.refused && !r.transportError && (r.tests || []).every(t => t.pass), sent: false, ...r };
      } finally {
        busy = false;
      }
    },
  };
}
