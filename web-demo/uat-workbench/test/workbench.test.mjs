import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_PACKAGE_BASE } from '../src/config.mjs';
import { findPackageDir, loadPackage } from '../src/package-loader.mjs';
import { createStore } from '../src/store.mjs';
import { createVault } from '../src/vault.mjs';
import { createEnvState } from '../src/env-state.mjs';
import { createWorkbenchService } from '../src/workbench.mjs';
import { saveCompletedResult } from '../src/results.mjs';
import { TransportError } from '../src/native-http.mjs';

const pkgDir = process.env.UAT_PACKAGE_DIR || findPackageDir(DEFAULT_PACKAGE_BASE);
const pkg = loadPackage(pkgDir);

const CALLER = 'agc_' + 'a'.repeat(64);
const T0 = Date.parse('2026-10-26T03:00:00.000Z');
const iso = ms => new Date(ms).toISOString();
const b64sha = buf => crypto.createHash('sha256').update(buf).digest('base64');

// Controlled Agent stand-in: records every request and replies with queued contract-valid bodies.
function fakeAgent() {
  const calls = [], queue = [];
  const send = async (url, opts) => {
    calls.push({ url, ...opts, body: opts.body });
    const next = queue.shift();
    if (!next) throw new Error('No queued reply');
    if (next instanceof Error) throw next;
    return { status: next.status, headers: {}, text: typeof next.body === 'string' ? next.body : JSON.stringify(next.body) };
  };
  return { calls, queue, send };
}

const tempDirs = [];
test.after(() => tempDirs.forEach(d => fs.rmSync(d, { recursive: true, force: true })));

function setup({ env = 'LOCAL' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uatwb-test-'));
  tempDirs.push(dir);
  const store = createStore(dir, { protect: false });
  const vault = createVault();
  const envState = createEnvState(pkg, store);
  const agent = fakeAgent();
  let clock = T0;
  let n = 0;
  const wb = createWorkbenchService({ pkg, store, vault, envState, send: agent.send, now: () => clock, uuid: () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0') });
  vault.set('vneca-signing-identity', JSON.stringify({ subject_ref: 'CONTROLLED_PRIVATE_SUBJECT', national_id: '001099000001' }), 'test');
  vault.set(env === 'LOCAL' ? 'vneca-local-eidca-caller' : 'vneca-server-caller', CALLER, 'test');
  return { dir, store, vault, envState, agent, wb, env, tick: ms => (clock += ms), now: () => clock };
}

async function lockedSession(t, { method = 'CCCD_NFC', sampleKey = 'PDF', caseId = 'CCCD-PDF', runId = 'lan-001' } = {}) {
  const init = await t.wb.run(t.env, 'INIT', { caseId, runId });
  assert.equal(init.ok, true, JSON.stringify(init));
  const lock = await t.wb.run(t.env, 'LOCK', { method, inputSource: 'sample', sampleKey });
  assert.equal(lock.ok, true, JSON.stringify(lock));
  return lock.view.summary;
}

const actionReply = (t, signingId = 'sig_controlled_0001') => ({
  status: 200,
  body: {
    api_version: '2.0', request_id: 'req-' + crypto.randomUUID(), signing_id: signingId, status: 'ACTION_REQUIRED',
    action: { type: 'SELECT_CERTIFICATE', prompt: 'Choose certificate', options: [{ reference: 'opt_private_reference_0001', label: 'Cert A' }, { reference: 'opt_private_reference_0002', label: 'Cert B' }] },
    continuation: { token: 'T'.repeat(40), expires_at: iso(t.now() + 240000), poll_after_ms: 1000 },
  },
});
const processingReply = t => ({
  status: 202,
  body: { api_version: '2.0', request_id: 'req-' + crypto.randomUUID(), signing_id: 'sig_controlled_0001', status: 'PROCESSING', message: 'Processing', continuation: { token: 'P'.repeat(40), expires_at: iso(t.now() + 240000), poll_after_ms: 2000 } },
});
const artifactBytes = Buffer.from('%PDF-1.7\n% controlled signed fixture\n%%EOF\n');
const completedReply = () => ({
  status: 200,
  body: {
    api_version: '2.0', request_id: 'req-' + crypto.randomUUID(), signing_id: 'sig_controlled_0001', status: 'COMPLETED',
    result: { kind: 'ARTIFACT', verification_scope: 'ARTIFACT', format: 'PDF', signature_profile: 'PADES_B_B', file_name: 'signed.pdf', media_type: 'application/pdf', content_base64: artifactBytes.toString('base64'), artifact_digest: { algorithm: 'SHA-256', value: b64sha(artifactBytes) }, certificate_sha256: 'c'.repeat(64) },
  },
});
const forbiddenReply = () => ({ status: 403, body: { api_version: '2.0', request_id: 'req-forbidden-0001', status: 'FAILED', error: { code: 'FORBIDDEN', message: 'The Local Agent caller registration is inactive.', recovery: 'NONE' } } });

test('package integrity is verified and the shipping validator is loaded', () => {
  assert.equal(pkg.integrity.criticalOk, true);
  assert.equal(pkg.integrity.passed, pkg.integrity.checked);
  assert.equal(typeof pkg.wire.validateRequest, 'function');
  assert.equal(pkg.wireTypes.publicErrorHttpStatus.FORBIDDEN, 403);
});

test('NEW refuses a duplicate case/run; LOCK freezes intent without HTTP and refuses a second LOCK', async () => {
  const t = setup();
  await lockedSession(t);
  assert.equal(t.agent.calls.length, 0);
  const dup = await t.wb.run(t.env, 'INIT', { caseId: 'CCCD-PDF', runId: 'lan-001' });
  assert.equal(dup.refused, 'SESSION_ALREADY_EXISTS_SELECT_IT');
  const again = await t.wb.run(t.env, 'LOCK', { method: 'CCCD_NFC', inputSource: 'sample', sampleKey: 'XML' });
  assert.equal(again.refused, 'INTENT_ALREADY_LOCKED');
});

test('START is refused while preflight is NOT_CHECKED and without the exact send_once', async () => {
  const t = setup();
  const s = await lockedSession(t);
  const ref = s.sessionRef.slice(0, 12);
  assert.equal((await t.wb.run(t.env, 'START', { sendOnce: ref + ':START' })).refused, 'OPERATOR_PREFLIGHT_REQUIRED_SEE_MATRIX');
  t.envState.setPreflight(t.env, { status: 'BLOCKED', overall: 'BLOCKED_AUTHORITY', at: iso(T0) });
  const wrong = await t.wb.run(t.env, 'START', { sendOnce: ref + ':CHOICE' });
  assert.equal(wrong.refused, 'MANUAL_SEND_ONCE_REQUIRED');
  assert.equal(wrong.detail, ref + ':START');
  assert.equal(t.agent.calls.length, 0);
});

test('full manual flow: START → CHOICE → STATUS (poll delay) → RESULT, frozen body and native headers', async () => {
  const t = setup();
  const s = await lockedSession(t);
  const ref = s.sessionRef.slice(0, 12);
  t.envState.setPreflight(t.env, { status: 'BLOCKED', overall: 'BLOCKED_AUTHORITY', at: iso(T0) });

  t.agent.queue.push(actionReply(t));
  const start = await t.wb.run(t.env, 'START', { sendOnce: ref + ':START' });
  assert.equal(start.ok, true, JSON.stringify(start));
  assert.match(start.notes[0], /diagnosis only/);
  const call = t.agent.calls[0];
  assert.equal(call.url, 'https://localhost:17889/api/sign-document');
  assert.equal(call.headers.Authorization, 'Bearer ' + CALLER);
  assert.ok(call.headers['X-VNeCA-Request-Id']);
  assert.ok(!Object.keys(call.headers).some(h => /^(origin|sec-fetch-)/i.test(h)));
  const body = JSON.parse(call.body);
  assert.equal(body.idempotency_key, s.startKey);
  assert.equal(body.identity.subject_ref, 'CONTROLLED_PRIVATE_SUBJECT');
  assert.equal(body.selection.method_code, 'CCCD_NFC');
  assert.equal(start.view.summary.state, 'ACTION_REQUIRED');
  assert.deepEqual(start.view.actionDisplay.options.map(o => o.index), [1, 2]);
  // Opaque handles never reach the browser.
  assert.ok(!JSON.stringify(start).includes('opt_private_reference_0001'));
  assert.ok(!JSON.stringify(start).includes('T'.repeat(40)));

  assert.equal((await t.wb.run(t.env, 'CHOICE', { sendOnce: ref + ':CHOICE', selectedOptionIndex: '9' })).refused, 'EXPLICIT_CURRENT_OPTION_INDEX_REQUIRED');
  t.agent.queue.push(processingReply(t));
  const choice = await t.wb.run(t.env, 'CHOICE', { sendOnce: ref + ':CHOICE', selectedOptionIndex: '2' });
  assert.equal(choice.ok, true, JSON.stringify(choice));
  const choiceBody = JSON.parse(t.agent.calls[1].body);
  assert.equal(choiceBody.reply.option_reference, 'opt_private_reference_0002');
  assert.equal(choiceBody.continuation_token, 'T'.repeat(40));
  assert.equal(choice.view.summary.state, 'PROCESSING');

  const early = await t.wb.run(t.env, 'STATUS', {});
  assert.equal(early.refused, 'WAIT_SERVER_POLL_DELAY');
  t.tick(2500);
  t.agent.queue.push(completedReply());
  const status = await t.wb.run(t.env, 'STATUS', {});
  assert.equal(status.ok, true, JSON.stringify(status));
  assert.equal(JSON.parse(t.agent.calls[2].body).idempotency_key, undefined);
  assert.equal(status.view.summary.state, 'COMPLETED');

  // RESULT is also a read: the PROCESSING poll delay still applies, exactly as in customer-pre.js.
  assert.equal((await t.wb.run(t.env, 'RESULT', {})).refused, 'WAIT_SERVER_POLL_DELAY');
  t.tick(2500);
  t.agent.queue.push(completedReply());
  const result = await t.wb.run(t.env, 'RESULT', {});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.view.summary.resultSummary.artifactDigest.value, b64sha(artifactBytes));
  assert.equal(result.view.completedInMemory, true);

  const saved = saveCompletedResult(t.wb.completed(t.env), t.store);
  const artifact = saved.files.find(f => f.role === 'ARTIFACT_DIGEST_MATCHES');
  assert.deepEqual(fs.readFileSync(artifact.path), artifactBytes);
  const original = saved.files.find(f => f.role === 'ORIGINAL_FROZEN_INPUT');
  assert.equal(original.sha256, crypto.createHash('sha256').update(Buffer.from(pkg.samples.PDF.input.content_base64, 'base64')).digest('hex'));

  const exp = await t.wb.run(t.env, 'EXPORT', {});
  const text = JSON.stringify(exp.export);
  for (const secret of ['CONTROLLED_PRIVATE_SUBJECT', '001099000001', 'opt_private_reference', 'T'.repeat(40), 'content_base64', CALLER]) assert.ok(!text.includes(secret), secret);
});

test('RETRY_START replays the exact frozen body with a new transport nonce', async () => {
  const t = setup();
  const s = await lockedSession(t);
  const ref = s.sessionRef.slice(0, 12);
  t.envState.setPreflight(t.env, { status: 'PASS', overall: 'PASS', at: iso(T0) });
  t.agent.queue.push(new TransportError('TIMEOUT', 'No response'));
  const lost = await t.wb.run(t.env, 'START', { sendOnce: ref + ':START' });
  assert.equal(lost.sent, true);
  assert.equal(lost.transportError.code, 'TIMEOUT');
  assert.equal(lost.view.summary.commands.length, 1, 'command persisted before HTTP');
  t.agent.queue.push(actionReply(t));
  const retry = await t.wb.run(t.env, 'RETRY_START', { sendOnce: ref + ':RETRY_START' });
  assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(t.agent.calls[1].body, t.agent.calls[0].body);
  assert.notEqual(t.agent.calls[1].headers['X-VNeCA-Request-Id'], t.agent.calls[0].headers['X-VNeCA-Request-Id']);
});

test('expired caller 403 is recorded as a contract-matching business refusal; session not advanced', async () => {
  const t = setup();
  const s = await lockedSession(t);
  t.envState.setPreflight(t.env, { status: 'BLOCKED', overall: 'BLOCKED_AUTHORITY', at: iso(T0) });
  t.agent.queue.push(forbiddenReply());
  const out = await t.wb.run(t.env, 'START', { sendOnce: s.sessionRef.slice(0, 12) + ':START' });
  assert.equal(out.ok, false);
  assert.equal(out.tests[0].pass, true, 'HTTP 403 matches contract for FORBIDDEN');
  assert.equal(out.tests.at(-1).pass, false, 'business refusal is never PASS');
  assert.equal(out.view.summary.state, 'LOCKED');
  assert.equal(out.view.summary.events.at(-1).errorCode, 'FORBIDDEN');
});

test('HTTP status that contradicts the contract does not update the session', async () => {
  const t = setup();
  const s = await lockedSession(t);
  t.envState.setPreflight(t.env, { status: 'PASS', overall: 'PASS', at: iso(T0) });
  t.agent.queue.push({ ...forbiddenReply(), status: 200 });
  const out = await t.wb.run(t.env, 'START', { sendOnce: s.sessionRef.slice(0, 12) + ':START' });
  assert.equal(out.ok, false);
  assert.equal(out.updateError, 'Response HTTP mismatch');
  assert.equal(out.view.summary.events.length, 0);
});

test('Server Agent refuses client hardware methods at LOCK; harness-only case C is never sent', async () => {
  const t = setup({ env: 'SERVER' });
  await t.wb.run('SERVER', 'INIT', { caseId: 'usb-server', runId: 'run-1' });
  assert.equal((await t.wb.run('SERVER', 'LOCK', { method: 'USB_TOKEN', inputSource: 'sample', sampleKey: 'PDF' })).refused, 'UNSUPPORTED_SERVER_HARDWARE');
  await t.wb.run('SERVER', 'LOCK', { method: 'VNEID', inputSource: 'sample', sampleKey: 'PDF' });
  assert.equal((await t.wb.run('SERVER', 'NEGATIVE_CHANGED_START', {})).refused, 'HARNESS_CASE_ONLY_NO_LIVE_FAULT_INJECTION');
  assert.equal(t.agent.calls.length, 0);
});

test('LOCK without subject_ref is refused by the shipping contract validator', async () => {
  const t = setup();
  t.vault.set('vneca-signing-identity', JSON.stringify({ national_id: '001099000001' }), 'test');
  await t.wb.run(t.env, 'INIT', { caseId: 'no-subject', runId: 'run-1' });
  const out = await t.wb.run(t.env, 'LOCK', { method: 'CCCD_NFC', inputSource: 'sample', sampleKey: 'PDF' });
  assert.equal(out.refused, 'CONTRACT_REQUEST_INVALID');
  assert.equal(out.detail, 'identity.subject_ref');
});

test('vault refuses a JWT in the Agent caller slot and never reports secret values', () => {
  const vault = createVault();
  assert.throws(() => vault.set('vneca-local-eidca-caller', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig', 'x'), /JWT_IS_NOT_AGENT_CALLER_ACCESS/);
  vault.set('vneca-local-eidca-caller', CALLER, 'x');
  assert.ok(!JSON.stringify(vault.status()).includes(CALLER));
});
