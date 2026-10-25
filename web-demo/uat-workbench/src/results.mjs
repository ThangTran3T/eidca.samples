import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { Refusal } from './workbench.mjs';

const EXT = { PDF: '.pdf', XML: '.xml', CMS: '.cms', BINARY: '.bin' };
const sha256 = b => crypto.createHash('sha256').update(b).digest();

// Same rules as save-result.mjs: new files only (wx), digest checked, never overwrite,
// SIGNING_MATERIAL stays JSON. Also writes the exact frozen original bytes for verification.
export function saveCompletedResult({ session, priv, raw }, store) {
  const reply = JSON.parse(raw), result = reply.result;
  if (reply.api_version !== '2.0' || reply.status !== 'COMPLETED' || !result) throw new Refusal('NO_COMPLETED_ACCEPTED_RESULT');
  const dir = store.newOutputDir(session.caseId + '-' + session.runId);
  const files = [];
  const write = (name, bytes, extra = {}) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
    files.push({ role: extra.role, path: file, bytes: bytes.length, sha256: sha256(Buffer.from(bytes)).toString('hex'), ...extra });
  };
  write('response.json', raw, { role: 'RAW_RESPONSE_PROTECTED' });

  if (result.kind === 'SIGNING_MATERIAL') {
    write('material.json', JSON.stringify(reply, null, 2) + '\n', { role: 'SIGNING_MATERIAL_NOT_A_DOCUMENT' });
  } else {
    if (result.kind !== 'ARTIFACT' || result.verification_scope !== 'ARTIFACT' || result.artifact_digest?.algorithm !== 'SHA-256' || typeof result.content_base64 !== 'string') throw new Refusal('INVALID_ARTIFACT_RESULT');
    const bytes = Buffer.from(result.content_base64, 'base64');
    if (bytes.toString('base64') !== result.content_base64 || sha256(bytes).toString('base64') !== result.artifact_digest.value) throw new Refusal('ARTIFACT_ENCODING_OR_SHA256_MISMATCH');
    if (result.format === 'PDF' && (result.signature_profile !== 'PADES_B_B' || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))) throw new Refusal('PDF_ARTIFACT_PROFILE_MISMATCH');
    write('signed' + (EXT[result.format] || '.bin'), bytes, { role: 'ARTIFACT_DIGEST_MATCHES', format: result.format });
  }

  const input = JSON.parse(priv.startRaw).input;
  if (input.mode === 'FILE') {
    write('original' + (EXT[input.format] || '.bin'), Buffer.from(input.content_base64, 'base64'), { role: 'ORIGINAL_FROZEN_INPUT', format: input.format });
  }
  return {
    status: result.kind === 'SIGNING_MATERIAL' ? 'MATERIAL_SAVED_NOT_A_DOCUMENT' : 'ARTIFACT_SAVED_DIGEST_MATCHES',
    dir,
    files,
    kind: result.kind,
    format: result.format || null,
    certificateSha256: result.certificate_sha256,
    cryptographicVerification: 'NOT_PERFORMED_BY_THIS_HELPER',
  };
}

function runProcess(command, args, { cwd, timeoutMs }) {
  return new Promise(resolve => {
    const child = cp.spawn(command, args, { cwd, windowsHide: true, shell: false });
    let out = '';
    const take = d => { if (out.length < 200000) out += d.toString(); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', e => { clearTimeout(timer); resolve({ exitCode: -1, output: String(e.message) }); });
    child.on('close', code => { clearTimeout(timer); resolve({ exitCode: code, output: out }); });
  });
}

function requireFile(p, name) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || !fs.statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Refusal('FILE_REQUIRED', name);
  return p;
}

// Runs the package's independent verifier (JDK21 + pinned PDFBox/BC). The website only
// reports its JSON verdict; a non-PASS stays FAIL / NOT_CHECKED.
export async function runIndependentVerify(pkgDir, p) {
  if (process.platform !== 'win32') throw new Refusal('WINDOWS_POWERSHELL_REQUIRED');
  if (!['PDF', 'CMS', 'XML'].includes(p.format)) throw new Refusal('FORMAT_PDF_CMS_XML_REQUIRED');
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(pkgDir, 'verify-result.ps1'),
    '-Format', p.format,
    '-Artifact', requireFile(p.artifact, 'Artifact'),
    '-Original', requireFile(p.original, 'Original'),
    '-Leaf', requireFile(p.leaf, 'Leaf'),
    '-TrustedRoots', requireFile(p.trustedRoots, 'TrustedRoots'),
    '-Intermediates', requireFile(p.intermediates, 'Intermediates'),
    '-Crls', requireFile(p.crls, 'Crls')];
  if (p.javaHome) {
    if (!path.isAbsolute(p.javaHome) || !fs.existsSync(path.join(p.javaHome, 'bin'))) throw new Refusal('JAVA_HOME_JDK21_REQUIRED');
    args.push('-JavaHome', p.javaHome);
  }
  const r = await runProcess('powershell.exe', args, { cwd: pkgDir, timeoutMs: 5 * 60000 });
  const line = r.output.split(/\r?\n/).filter(l => /^\{"status"/.test(l.trim())).pop();
  let verdict = null;
  try { verdict = line ? JSON.parse(line) : null; } catch { verdict = null; }
  return { exitCode: r.exitCode, status: r.exitCode === 0 && verdict?.status === 'PASS' ? 'PASS' : 'FAIL', verdict, output: r.output.slice(-8000) };
}

export async function runVerifyMaterial(pkgDir, p) {
  const args = [path.join(pkgDir, 'verify-material.mjs'), requireFile(p.material, 'material.json'), requireFile(p.original, 'Original')];
  const r = await runProcess(process.execPath, args, { cwd: pkgDir, timeoutMs: 60000 });
  const line = r.output.split(/\r?\n/).filter(l => /^\{"status"/.test(l.trim())).pop();
  let verdict = null;
  try { verdict = line ? JSON.parse(line) : null; } catch { verdict = null; }
  return { exitCode: r.exitCode, status: r.exitCode === 0 && verdict?.status === 'RAW_SIGNATURE_PASS' ? 'RAW_SIGNATURE_PASS' : 'FAIL', verdict, output: r.output.slice(-8000) };
}
