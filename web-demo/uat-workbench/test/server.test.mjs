import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DEFAULT_PACKAGE_BASE } from '../src/config.mjs';
import { findPackageDir, loadPackage } from '../src/package-loader.mjs';
import { createStore } from '../src/store.mjs';
import { createVault } from '../src/vault.mjs';
import { startServer } from '../src/server.mjs';

const pkg = loadPackage(process.env.UAT_PACKAGE_DIR || findPackageDir(DEFAULT_PACKAGE_BASE));

function request(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { Host: `127.0.0.1:${port}`, ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('local server: host/origin/header guards, CSP, secrets never returned', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uatwb-srv-'));
  const vault = createVault();
  const sent = [];
  const server = await startServer({ pkg, store: createStore(dir, { protect: false }), vault, send: async (url, o) => { sent.push(url); throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' }); }, port: 0 });
  t.after(() => {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const { port } = server.address();
  const H = { 'X-UAT-Workbench': '1' };

  const page = await request(port);
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);

  assert.equal((await request(port, { path: '/api/meta', headers: { ...H, Host: 'attacker.example:' + port } })).status, 421);
  assert.equal((await request(port, { path: '/api/meta' })).status, 403);
  assert.equal((await request(port, { path: '/api/meta', headers: { ...H, Origin: 'http://evil.example' } })).status, 403);
  assert.equal((await request(port, { method: 'POST', path: '/api/vault', headers: { ...H, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);

  const secret = 'agc_' + 'b'.repeat(64);
  const set = await request(port, { method: 'POST', path: '/api/vault', headers: { ...H, 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` }, body: JSON.stringify({ action: 'set', key: 'vneca-local-eidca-caller', value: secret }) });
  assert.equal(set.status, 200);
  assert.ok(!set.text.includes(secret));
  const state = await request(port, { path: '/api/state?env=LOCAL', headers: H });
  assert.equal(JSON.parse(state.text).vault['vneca-local-eidca-caller'].present, true);
  assert.ok(!state.text.includes(secret));

  // Operator health goes through the injected native transport and reports the transport error.
  const health = await request(port, { method: 'POST', path: '/api/operator', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ env: 'LOCAL', id: 'HEALTH_LOCAL_STATUS' }) });
  assert.equal(JSON.parse(health.text).transportError.code, 'ECONNREFUSED');
  assert.deepEqual(sent, ['https://localhost:17889/api/status']);

  const doc = await request(port, { path: '/api/doc?name=../PACKAGE-MANIFEST.json', headers: H });
  assert.equal(doc.status, 404);
});
