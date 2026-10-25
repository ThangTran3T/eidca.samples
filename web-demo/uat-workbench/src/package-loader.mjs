import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PACKAGE_PREFIX } from './config.mjs';

const require = createRequire(import.meta.url);

// Files whose code or data drive requests. A mismatch here means the website would
// no longer behave like the reviewed package, so loading is refused.
const CRITICAL_FILES = [
  'session-state.cjs',
  'Customer-Signing.postman_collection.json',
  'Operator-Setup-Preflight.postman_collection.json',
  'Local.postman_environment.json',
  'Server.postman_environment.json',
  'samples/inputs.json',
];

export const DOC_FILES = [
  'QUICK-START-VI.md',
  'READINESS-MATRIX.md',
  'CONTRACT-RECOVERY.md',
  'OPERATOR-GUIDE.md',
  'VERIFY-RESULT.md',
  'README.md',
];

export function findPackageDir(base) {
  if (!fs.existsSync(base)) return null;
  const candidates = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith(PACKAGE_PREFIX))
    .map(d => path.join(base, d.name))
    .filter(dir => fs.existsSync(path.join(dir, 'PACKAGE-MANIFEST.json')))
    .map(dir => ({ dir, at: Date.parse(readJson(dir, 'PACKAGE-MANIFEST.json').generatedAt) || 0 }))
    .sort((a, b) => b.at - a.at);
  return candidates[0]?.dir ?? null;
}

function readJson(dir, rel) {
  return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8').replace(/^﻿/, ''));
}

function digest(algorithm, file) {
  return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex');
}

export function verifyManifest(dir) {
  const manifest = readJson(dir, 'PACKAGE-MANIFEST.json');
  const passed = [], mismatched = [], missing = [];
  for (const f of manifest.files) {
    const file = path.join(dir, f.path);
    if (!fs.existsSync(file)) missing.push(f.path);
    else if (digest('sha256', file) !== f.sha256) mismatched.push(f.path);
    else passed.push(f.path);
  }
  const jar = path.join(dir, manifest.verifier.path);
  const verifierJar = !fs.existsSync(jar) ? 'MISSING' : digest('sha512', jar) === manifest.verifier.sha512 ? 'PASS' : 'MISMATCH';
  return {
    schemaVersion: manifest.schemaVersion,
    sourceRevision: manifest.sourceRevision,
    generatedAt: manifest.generatedAt,
    realProviderUat: manifest.realProviderUat,
    checked: manifest.files.length,
    passed: passed.length,
    mismatched,
    missing,
    verifierJar,
    criticalOk: CRITICAL_FILES.every(f => passed.includes(f)),
  };
}

// The collection embeds the shipping contract validator (contract.generated.js + Contract.js),
// built from sdk/server-agent. Extract exactly that block instead of re-implementing the schema.
function loadWire(dir) {
  const collection = readJson(dir, 'Customer-Signing.postman_collection.json');
  const pre = collection.event.find(e => e.listen === 'prerequest').script.exec.join('\n');
  const start = pre.indexOf('const __wireTypes=');
  const end = pre.indexOf('/* Pure session bookkeeping');
  if (start < 0 || end < start) throw new Error('Contract validator block not found in Customer collection');
  const fn = vm.runInThisContext(`(function(){${pre.slice(start, end)}\nreturn {__wire,__wireTypes};})`, {
    filename: 'Customer-Signing.postman_collection.json#contract',
  });
  const { __wire, __wireTypes } = fn();
  for (const name of ['validateRequest', 'validateResponse']) {
    if (typeof __wire[name] !== 'function') throw new Error('Contract validator missing ' + name);
  }
  return { wire: __wire, wireTypes: __wireTypes };
}

function environmentValues(dir, file) {
  const env = readJson(dir, file);
  return Object.fromEntries(env.values.map(v => [v.key, String(v.value ?? '')]));
}

export function loadPackage(dir, { allowModified = false } = {}) {
  if (!dir || !fs.existsSync(path.join(dir, 'PACKAGE-MANIFEST.json'))) {
    throw new Error('Workbench package not found. Set UAT_PACKAGE_DIR to the extracted VNeCA-Unified-Agent-v2-Workbench-* folder.');
  }
  const integrity = verifyManifest(dir);
  if (!integrity.criticalOk && !allowModified) {
    throw new Error('Package integrity check failed for critical files: ' + [...integrity.mismatched, ...integrity.missing].join(', '));
  }
  const { createWorkbench } = require(path.join(dir, 'session-state.cjs'));
  const { wire, wireTypes } = loadWire(dir);
  const optionalJson = rel => (fs.existsSync(path.join(dir, rel)) ? readJson(dir, rel) : null);
  return {
    dir,
    integrity,
    createWorkbench,
    wire,
    wireTypes,
    environments: {
      LOCAL: environmentValues(dir, 'Local.postman_environment.json'),
      SERVER: environmentValues(dir, 'Server.postman_environment.json'),
    },
    samples: readJson(dir, 'samples/inputs.json'),
    sampleFiles: { PDF: 'samples/sample.pdf', XML: 'samples/sample.xml', BINARY: 'samples/sample.bin', HASH_CMS: 'samples/sample.pdf' },
    evidence: {
      runtime: optionalJson('evidence/runtime-preflight.json'),
      tests: optionalJson('evidence/test-results.json'),
      providerMapping: optionalJson('evidence/provider-mapping-metadata.json'),
    },
    readDoc(name) {
      if (!DOC_FILES.includes(name)) return null;
      return fs.readFileSync(path.join(dir, name), 'utf8');
    },
  };
}
