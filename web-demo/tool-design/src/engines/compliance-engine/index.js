/**
 * Compliance engine. Evaluates the rules of a template's compliance profile
 * and aggregates them. A template is "compliant" ONLY if every applicable rule
 * was evaluated and passed (manual rules pass only with a human attestation).
 */
import { rulesForProfile, RULES } from './rules.js';
import { PROFILES } from './legal-references.js';
import { dataForMode } from '../template-engine/index.js';

export { RULES, rulesForProfile } from './rules.js';
export { PROFILES, REFS, DECREE } from './legal-references.js';
export { analyzePixels, classifyInk } from './image-analysis.js';

export const OVERALL = {
  compliant: { label: 'Tuân thủ', tone: 'success' },
  warning: { label: 'Cảnh báo', tone: 'warning' },
  'non-compliant': { label: 'Không tuân thủ', tone: 'danger' },
  'not-evaluated': { label: 'Chưa đánh giá', tone: 'neutral' },
};

export const RULE_STATUS = {
  pass: 'Đạt',
  fail: 'Không đạt',
  manual: 'Cần xác nhận thủ công',
  'not-evaluated': 'Chưa đánh giá',
};

/**
 * @param {object} input
 * @param {object} input.template
 * @param {object} [input.signature]           placement {id,page,rect,rotation,visible}
 * @param {object} [input.geom]                page geometry of signature.page
 * @param {object[]} [input.documentSignatures]
 * @param {Record<number,object>} [input.pageGeoms]
 * @param {Record<number,{str,x,y,width,height}[]>} [input.pageText]
 * @param {'sample'|'runtime'|'placeholder'} [input.mode]
 * @param {object} [input.runtimeData]
 */
export function evaluateCompliance(input) {
  const { template } = input;
  const profile = template.complianceProfile;
  if (!profile || !PROFILES[profile]) {
    return { profile: null, overall: 'not-evaluated', customMode: true, results: [], counts: countResults([]) };
  }
  const mode = input.mode === 'runtime' ? 'runtime' : 'sample';
  const ctx = { ...input, data: dataForMode(template, mode, input.runtimeData) };
  const attestations = template.complianceAttestations ?? {};
  const results = rulesForProfile(profile).map((rule) => {
    let r;
    try {
      r = rule.evaluate(ctx);
    } catch (err) {
      r = { status: 'not-evaluated', message: `Lỗi khi đánh giá: ${err.message}` };
    }
    const att = attestations[rule.id];
    if (r.status === 'manual' && att?.confirmed) {
      r = { ...r, status: 'pass', attested: true, message: `${r.message} — Đã xác nhận thủ công${att.note ? `: ${att.note}` : ''}.` };
    }
    return {
      ruleId: rule.id,
      displayId: rule.baseId ?? rule.id,
      title: rule.title,
      severity: rule.severity,
      kind: rule.kind,
      legalRef: rule.legalRef,
      explanation: rule.explanation,
      documentType: PROFILES[profile].documentType,
      signerType: PROFILES[profile].signerType,
      ...r,
    };
  });
  const overall = aggregate(results);
  return { profile, overall, customMode: overall === 'non-compliant', results, counts: countResults(results) };
}

export function aggregate(results) {
  if (!results.length) return 'not-evaluated';
  if (results.some((r) => r.status === 'fail' && r.severity === 'error')) return 'non-compliant';
  if (results.every((r) => r.status === 'pass')) return 'compliant';
  return 'warning';
}

function countResults(results) {
  const c = { pass: 0, fail: 0, manual: 0, 'not-evaluated': 0, total: results.length };
  for (const r of results) c[r.status]++;
  return c;
}

export function ruleById(id) {
  return RULES.find((r) => r.id === id);
}
