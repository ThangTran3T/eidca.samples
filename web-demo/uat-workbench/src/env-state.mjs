import { AGENT_ORIGINS, ENV_KINDS, PLATFORM_ORIGIN } from './config.mjs';

// Non-secret variables the tester may edit (same names as the Postman environments).
export const EDITABLE_VARS = Object.freeze([
  'case_id', 'run_id', 'new_start_key', 'method_code', 'certificate_reference',
  'installation_binding', 'installation_environment', 'running_revision', 'agent_artifact_sha256',
  'agent_id', 'agent_version', 'authentication_key_id', 'profile_revision', 'policy_revision',
  'caller_grant_id', 'policy_hash', 'verifier_artifact', 'verifier_revision', 'finalization_mode',
  'owner_signature_profile', 'operator_flow_id', 'operator_provider_id', 'operator_provider_revision',
  'operator_provider_hash', 'canonical_transaction_id',
]);

// Values the website keeps out of the generic variable editor: endpoints are pinned,
// secrets live in the vault and preflight status only changes from a real preflight response.
const DROPPED = new Set(['wb_sessions', 'wb_export_redacted', 'send_once', 'operator_once', 'operator_prepared_json',
  'selected_option_index', 'replay_command_ordinal', 'interaction_completed', 'select_session_id', 'input_vault_key',
  'sample_input_json', 'operator_preflight_json', 'operator_preflight_status', 'selected_session']);

export function createEnvState(pkg, store) {
  const fileName = kind => 'env-' + kind + '.json';
  const load = kind => store.readJson(fileName(kind), { overrides: {}, selected_session: '', preflight: null });

  function vars(kind) {
    if (!ENV_KINDS.includes(kind)) throw new Error('UNKNOWN_ENVIRONMENT');
    const saved = load(kind);
    const base = Object.fromEntries(Object.entries(pkg.environments[kind]).filter(([k]) => !DROPPED.has(k)));
    return {
      ...base,
      ...saved.overrides,
      agent_kind: kind,
      agent_origin: AGENT_ORIGINS[kind],
      platform_origin: PLATFORM_ORIGIN,
      selected_session: saved.selected_session || '',
      operator_preflight_status: saved.preflight?.status || 'NOT_CHECKED',
    };
  }

  return {
    vars,
    preflight(kind) {
      return load(kind).preflight;
    },
    update(kind, changes) {
      const saved = load(kind);
      for (const [k, v] of Object.entries(changes || {})) {
        if (!EDITABLE_VARS.includes(k)) throw new Error('VARIABLE_NOT_EDITABLE ' + k);
        if (typeof v !== 'string' || v.length > 512) throw new Error('INVALID_VARIABLE_VALUE ' + k);
        if (k === 'installation_environment' && !['sandbox', 'production'].includes(v)) throw new Error('INVALID_VARIABLE_VALUE ' + k);
        saved.overrides[k] = v;
      }
      store.writeJson(fileName(kind), saved);
      return vars(kind);
    },
    reset(kind) {
      const saved = load(kind);
      saved.overrides = {};
      store.writeJson(fileName(kind), saved);
      return vars(kind);
    },
    select(kind, sessionId) {
      const saved = load(kind);
      saved.selected_session = sessionId;
      store.writeJson(fileName(kind), saved);
    },
    setPreflight(kind, preflight) {
      const saved = load(kind);
      saved.preflight = preflight;
      store.writeJson(fileName(kind), saved);
    },
  };
}
