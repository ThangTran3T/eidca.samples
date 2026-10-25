import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';

// Same protection as prepare-private.mjs: current Windows user + SYSTEM only, no inheritance.
export function protectDirectory(dir) {
  if (process.platform !== 'win32') {
    fs.chmodSync(dir, 0o700);
    return 'POSIX_0700';
  }
  // Absolute System32 paths: a POSIX whoami earlier on PATH (Git Bash) would not understand /user.
  const system32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  try {
    const sid = cp.execFileSync(path.join(system32, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-5-[0-9-]+/)?.[0];
    if (!sid) return 'ACL_FAILED_NO_SID';
    cp.execFileSync(path.join(system32, 'icacls.exe'), [dir, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'], { stdio: 'ignore', windowsHide: true });
    return 'WINDOWS_ACL_USER_SYSTEM';
  } catch {
    return 'ACL_FAILED';
  }
}

export function createStore(dataDir, { protect = true } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const protection = protect ? protectDirectory(dataDir) : 'NOT_APPLIED';
  const privateDir = path.join(dataDir, 'private');
  fs.mkdirSync(privateDir, { recursive: true });

  const file = name => {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Invalid store name');
    return path.join(dataDir, name);
  };

  // Write-then-rename so a crash never leaves a half-written registry or frozen request.
  function writeAtomic(target, text) {
    const tmp = target + '.' + crypto.randomUUID() + '.tmp';
    fs.writeFileSync(tmp, text, { mode: 0o600 });
    fs.renameSync(tmp, target);
  }

  return {
    dataDir,
    protection,
    readText(name) {
      const f = file(name);
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    },
    writeText(name, text) {
      writeAtomic(file(name), text);
    },
    readJson(name, fallback) {
      const text = this.readText(name);
      return text == null ? fallback : JSON.parse(text);
    },
    writeJson(name, value) {
      writeAtomic(file(name), JSON.stringify(value, null, 2));
    },
    // Equivalent of the Postman Local Vault entry vneca-wb-session-<id>: frozen START body,
    // stored commands and current action handles. Never exported.
    readPrivate(sessionId) {
      if (!/^[a-f0-9]{64}$/.test(sessionId)) throw new Error('Invalid session id');
      const f = path.join(privateDir, sessionId + '.json');
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    },
    writePrivate(sessionId, text) {
      if (!/^[a-f0-9]{64}$/.test(sessionId)) throw new Error('Invalid session id');
      writeAtomic(path.join(privateDir, sessionId + '.json'), text);
    },
    newOutputDir(label) {
      const safe = String(label).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 80);
      const dir = path.join(dataDir, 'results', safe + '-' + new Date().toISOString().replace(/[:.]/g, '') + '-' + crypto.randomBytes(3).toString('hex'));
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },
  };
}
