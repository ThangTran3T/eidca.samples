import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const samplesDirectory = resolve(testDirectory, '..', '..', '..', 'samples');
let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolveReady, reject) => {
    server.once('listening', resolveReady);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolveClosed, reject) => server.close((error) => error ? reject(error) : resolveClosed()));
});

test('serves the frontend and health endpoint', async () => {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).status, 'UP');

  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /Kiểm tra chữ ký số/);
});

test('verifies a valid PDF uploaded as multipart/form-data', async () => {
  const pdf = await readFile(resolve(samplesDirectory, 'any-provider', 'signed_dung.pdf'));
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'signed_dung.pdf');

  const response = await fetch(`${baseUrl}/api/verify`, { method: 'POST', body: form });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.file.type, 'PDF');
  assert.equal(body.verification.status, 'VALID');
  assert.equal(body.verification.valid, true);
});

test('verifies a valid XML signature supplied as file_base64', async () => {
  const xml = await readFile(resolve(samplesDirectory, 'bkavca-tenant', 'signed_xml-test.xml'));
  const response = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file_base64: xml.toString('base64'), file_name: 'signed_xml-test.xml' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.file.type, 'XML');
  assert.equal(body.verification.status, 'VALID');
  assert.equal(body.verification.valid, true);
});

test('reports a modified signed PDF as invalid', async () => {
  const pdf = await readFile(resolve(samplesDirectory, 'any-provider', 'signed_sai.pdf'));
  const response = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file_base64: pdf.toString('base64'), file_name: 'signed_sai.pdf' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.verification.status, 'INVALID');
  assert.equal(body.verification.valid, false);
});

test('rejects a request without file data using a JSON error', async () => {
  const response = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FILE_REQUIRED');
});
