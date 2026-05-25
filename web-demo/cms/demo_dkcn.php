<?php
/**
 * EIDCA CMS – Wrapper: Demo ĐK Chứng nhận
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';

requireLogin();
$user = currentUser();

$row     = DB::row('SELECT * FROM users WHERE id=? LIMIT 1', [$user['id']]);
$nfcUrl  = $row['nfc_url'] ?: DEFAULT_NFC_URL;
$camUrl  = $row['cam_url'] ?: DEFAULT_CAM_URL;
$apiKey  = $row['api_key'] ?? '';
$base = _base();
?>

<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Ký số cá nhân – EIDCA</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#ffffff;--bg2:#f6f6f4;--bg3:#ededea;
  --text:#18180e;--text2:#6b6b60;--text3:#9a9a90;
  --border:rgba(0,0,0,0.10);--border2:rgba(0,0,0,0.17);
  --green:#1a9e72;--green-bg:#e2f5ee;--green-dark:#0d6e50;
  --blue:#1769c4;--blue-bg:#e5f0fb;
  --amber:#b87215;--amber-bg:#faecd9;
  --red:#c4302b;--red-bg:#fcebeb;
  --r:8px;--rl:13px;
  --mono:'SF Mono','Fira Code','Consolas',monospace;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#1e1e1b;--bg2:#272724;--bg3:#313130;
    --text:#e8e8e0;--text2:#9a9a90;--text3:#6b6b60;
    --border:rgba(255,255,255,0.09);--border2:rgba(255,255,255,0.15);
    --green-bg:#0d3323;--blue-bg:#0d2340;--amber-bg:#2e1e00;--red-bg:#2e1010;
  }
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg2);color:var(--text);min-height:100vh;padding:0}

/* ── Layout ── */
.shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
.sidebar{background:var(--bg);border-right:0.5px solid var(--border);padding:1.5rem 1rem;display:flex;flex-direction:column;gap:4px}
.main{padding:2rem;max-width:820px}

/* ── Sidebar ── */
.logo{display:flex;align-items:center;gap:8px;margin-bottom:1.5rem;padding:0 4px}
.logo-mark{width:28px;height:28px;border-radius:6px;background:var(--green);display:flex;align-items:center;justify-content:center}
.logo-mark svg{width:16px;height:16px}
.logo-text{font-size:14px;font-weight:500;color:var(--text)}
.logo-sub{font-size:10px;color:var(--text3)}
.nav-label{font-size:10px;font-weight:500;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;padding:8px 8px 4px;margin-top:8px}
.nav-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r);font-size:13px;color:var(--text2);cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:background .12s}
.nav-item:hover{background:var(--bg2);color:var(--text)}
.nav-item.active{background:var(--green-bg);color:var(--green-dark);font-weight:500}
.nav-item svg{width:14px;height:14px;flex-shrink:0;opacity:.7}
.nav-item.active svg{opacity:1}
.sidebar-footer{margin-top:auto;padding-top:1rem;border-top:0.5px solid var(--border)}
.user-pill{display:flex;align-items:center;gap:8px}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:var(--green-dark);flex-shrink:0}
.user-info{font-size:12px}
.user-info strong{display:block;color:var(--text);font-weight:500}
.user-info span{color:var(--text3)}

/* ── Page header ── */
.page-header{margin-bottom:1.5rem}
.page-header h1{font-size:20px;font-weight:500;color:var(--text);margin-bottom:3px}
.page-header p{font-size:13px;color:var(--text2)}

/* ── Cards ── */
.card{background:var(--bg);border:0.5px solid var(--border);border-radius:var(--rl);padding:1.25rem;margin-bottom:1rem}
.card-title{font-size:14px;font-weight:500;color:var(--text);margin-bottom:2px}
.card-desc{font-size:12px;color:var(--text2);margin-bottom:1rem}

/* ── Upload zone ── */
.upload-zone{border:1.5px dashed var(--border2);border-radius:var(--r);padding:2rem;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;background:var(--bg2)}
.upload-zone:hover,.upload-zone.drag{border-color:var(--green);background:var(--green-bg)}
.upload-zone.has-file{border-color:var(--green);background:var(--green-bg)}
.upload-zone svg{width:32px;height:32px;margin:0 auto 8px;display:block;opacity:.5}
.upload-zone p{font-size:13px;color:var(--text2)}
.upload-zone small{font-size:11px;color:var(--text3)}
.file-list{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.file-item{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:0.5px solid var(--border);border-radius:var(--r)}
.file-icon{width:28px;height:28px;border-radius:5px;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.file-icon svg{width:14px;height:14px}
.file-meta{flex:1;min-width:0}
.file-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.file-size{font-size:11px;color:var(--text3)}
.file-remove{background:none;border:none;cursor:pointer;color:var(--text3);padding:2px;border-radius:4px;display:flex;align-items:center}
.file-remove:hover{color:var(--red);background:var(--red-bg)}

/* ── Sign settings ── */
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field{margin-bottom:0}
.field label{display:block;font-size:12px;color:var(--text2);margin-bottom:4px}
.field input,.field select,.field textarea{width:100%;padding:7px 9px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--r);background:var(--bg);color:var(--text);font-family:inherit}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--green)}
.field input[readonly]{background:var(--bg2);color:var(--text2)}
.field textarea{resize:vertical;min-height:60px}

/* ── Sign canvas ── */
.sig-wrap{border:0.5px solid var(--border2);border-radius:var(--r);background:var(--bg);overflow:hidden;position:relative}
.sig-wrap canvas{display:block;width:100%;height:120px;cursor:crosshair;touch-action:none}
.sig-clear{position:absolute;top:6px;right:8px;font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px}
.sig-clear:hover{background:var(--bg2);color:var(--text)}

/* ── Stepper flow ── */
.flow-steps{display:flex;flex-direction:column;gap:0}
.flow-step{display:flex;gap:12px;position:relative}
.flow-step:not(:last-child)::after{content:'';position:absolute;left:11px;top:28px;bottom:0;width:0.5px;background:var(--border2)}
.step-dot{width:24px;height:24px;border-radius:50%;border:0.5px solid var(--border2);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:var(--text3);flex-shrink:0;z-index:1;margin-top:2px}
.step-dot.active{background:var(--green-bg);border-color:var(--green);color:var(--green-dark)}
.step-dot.done{background:var(--green);border-color:var(--green);color:#fff}
.step-dot.loading{background:var(--amber-bg);border-color:var(--amber);color:var(--amber)}
.step-body{padding-bottom:1.25rem;flex:1}
.step-title{font-size:13px;font-weight:500;color:var(--text);margin-bottom:2px}
.step-detail{font-size:12px;color:var(--text2)}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:500}
.badge.g{background:var(--green-bg);color:var(--green-dark)}
.badge.b{background:var(--blue-bg);color:var(--blue)}
.badge.a{background:var(--amber-bg);color:var(--amber)}
.badge.r{background:var(--red-bg);color:var(--red)}
.badge.gray{background:var(--bg3);color:var(--text2)}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;font-size:13px;font-weight:500;border-radius:var(--r);cursor:pointer;border:0.5px solid var(--border2);background:var(--bg);color:var(--text);transition:all .12s;font-family:inherit}
.btn:hover{background:var(--bg2)}
.btn:active{transform:scale(.98)}
.btn.primary{background:var(--green);color:#fff;border-color:var(--green)}
.btn.primary:hover{background:var(--green-dark)}
.btn.danger{background:var(--red-bg);color:var(--red);border-color:var(--red-bg)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
.btn-row{display:flex;gap:8px;align-items:center;margin-top:1rem}

/* ── API Log ── */
.log-wrap{background:var(--bg3);border-radius:var(--r);padding:10px 12px;max-height:180px;overflow-y:auto;margin-top:.75rem}
.log-line{font-family:var(--mono);font-size:11px;color:var(--text2);padding:1.5px 0;white-space:pre-wrap;word-break:break-all;line-height:1.5}
.log-line.ok{color:var(--green-dark)}
.log-line.err{color:var(--red)}
.log-line.req{color:var(--blue)}
.log-line.dim{color:var(--text3)}

/* ── Result doc list ── */
.doc-result{background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--r);padding:1rem;margin-top:.75rem}
.doc-result-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border)}
.doc-result-row:last-child{border-bottom:none}

/* ── Cert panel ── */
.cert-panel{background:var(--bg2);border-radius:var(--r);padding:.75rem 1rem}
.cert-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid var(--border);font-size:12px}
.cert-row:last-child{border-bottom:none}
.cert-row span:first-child{color:var(--text2)}
.cert-row span:last-child{font-weight:500;color:var(--text);font-family:var(--mono);font-size:11px}

/* ── Loader ── */
.spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite}
.spin.dark{border-color:rgba(26,158,114,.2);border-top-color:var(--green)}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Alert ── */
.alert{padding:9px 11px;border-radius:var(--r);font-size:12px;display:flex;gap:7px;align-items:flex-start;margin-bottom:.75rem}
.alert.info{background:var(--blue-bg);color:var(--blue);border:0.5px solid rgba(23,105,196,.2)}
.alert.success{background:var(--green-bg);color:var(--green-dark);border:0.5px solid rgba(26,158,114,.2)}
.alert.warn{background:var(--amber-bg);color:var(--amber);border:0.5px solid rgba(184,114,21,.2)}

/* ── Tab bar ── */
.tabs{display:flex;gap:2px;border-bottom:0.5px solid var(--border);margin-bottom:1.25rem}
.tab{padding:7px 12px;font-size:13px;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-0.5px;transition:color .12s}
.tab.active{color:var(--green-dark);border-bottom-color:var(--green);font-weight:500}
.tab:hover{color:var(--text)}

/* ── Progress bar ── */
.prog-bar{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:1.25rem}
.prog-fill{height:100%;background:var(--green);border-radius:2px;transition:width .4s ease}

/* ── Session timer ── */
.session-bar{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--amber-bg);border-radius:var(--r);font-size:12px;color:var(--amber);margin-bottom:.75rem}
.session-bar svg{width:13px;height:13px;flex-shrink:0}

@media(max-width:640px){.shell{grid-template-columns:1fr}.sidebar{display:none}.main{padding:1rem}}
</style>

<!-- CMS Config Injection -->
<script>
window.EIDCA_CMS_BASE   = '<?= $nfcUrl ?>';
window.EIDCA_NFC_URL    = '<?= $nfcUrl ?>';
window.EIDCA_CAM_URL    = '<?= $camUrl ?>';
window.EIDCA_API_KEY    = '<?= $apiKey ?>';
window.EIDCA_CMS_LOG_URL = location.origin + '<?= $base ?>/api/log_event.php';
window.eidcaLogEvent = function(action, payload) {
  payload = payload || {};
  fetch(window.EIDCA_CMS_LOG_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json','X-Api-Key':window.EIDCA_API_KEY},
    body: JSON.stringify({action: action, payload: payload})
  }).catch(function(){});
};
</script>
</head>
<body>
<div style="position:fixed;top:10px;right:10px;z-index:99999">
    <a href="<?= $base ?>/dashboard.html" style="background:#7c3aed;color:#fff;padding:7px 14px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(124,58,237,.4)">&larr; CMS</a>
</div>

<div class="shell">

<!-- ── Sidebar ── -->
<aside class="sidebar">
  <div class="logo">
    <div class="logo-mark">
      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <div class="logo-text">EIDCA</div>
      <div class="logo-sub">Ký số cá nhân</div>
    </div>
  </div>

  <div class="nav-label">Chức năng</div>
  <button class="nav-item" onclick="setTab('dashboard')">
    <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
    Tổng quan
  </button>
  <button class="nav-item active" id="nav-sign" onclick="setTab('sign')">
    <svg viewBox="0 0 16 16" fill="none"><path d="M2.5 12L5 9.5l7-7 1.5 1.5-7 7L2.5 12z" stroke="currentColor" stroke-width="1.2"/><path d="M10.5 3l2 2" stroke="currentColor" stroke-width="1.2"/></svg>
    Ký văn bản
  </button>
  <button class="nav-item" onclick="setTab('history')">
    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    Lịch sử ký
  </button>
  <button class="nav-item" onclick="setTab('cert')">
    <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    Chứng thư số
  </button>

  <div class="nav-label">Hệ thống</div>
  <button class="nav-item" onclick="setTab('settings')">
    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.41 1.41M11.37 11.37l1.41 1.41M3.22 12.78l1.41-1.41M11.37 4.63l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    Cài đặt API
  </button>

  <div class="sidebar-footer">
    <div class="user-pill">
      <div class="avatar">NA</div>
      <div class="user-info">
        <strong>Nguyễn Văn An</strong>
        <span>079200012345</span>
      </div>
    </div>
  </div>
</aside>

<!-- ── Main ── -->
<main class="main" id="mainContent">
  <!-- rendered by JS -->
</main>
</div>

<script>
// ─── State ───────────────────────────────────────────────────────────────
const S = {
  tab: 'sign',
  apiKey: 'YOUR_API_KEY_HERE',
  baseUrl: 'https://api.eidca.vn',
  partnerCode: 'PARTNER001',
  idNumber: '079200012345',
  certInfo: {
    serial: 'VNECC-A3F7D291',
    subject: 'CN=NGUYỄN VĂN AN, UID=CCCD:079200012345, C=VN',
    issuer: 'EIDCA Public CA',
    notBefore: '01/04/2026',
    notAfter: '01/04/2027',
    email: 'nguyenvanan@email.com'
  },
  files: [],
  signProps: { page: 1, x: 100, y: 100, w: 200, h: 60, label: '' },
  sessionTimeout: 'ONE_HOUR',
  sigCanvas: null,
  sigCtx: null,
  sigDrawing: false,
  sigHasData: false,
  // Flow state
  flow: {
    step: 0, // 0=idle,1=uploading,2=got-challenge,3=signing,4=done,5=error
    transactionCode: '',
    tokenSign: '',
    docs: [],
    signedDocs: [],
    log: []
  },
  history: [
    { id:'TXN-001', name:'Hợp đồng lao động Q1.pdf', date:'10/04/2026 09:22', status:'completed', hash:'a3f7d2...9c1e' },
    { id:'TXN-002', name:'Phiếu nghiệm thu tháng 3.pdf', date:'08/04/2026 14:05', status:'completed', hash:'b8c12a...4d7f' },
    { id:'TXN-003', name:'Báo cáo tài chính.pdf', date:'05/04/2026 11:30', status:'failed', hash:'-' },
  ]
};

// ─── Logging ─────────────────────────────────────────────────────────────
function log(msg, cls='') {
  S.flow.log.push({ msg, cls, ts: new Date().toLocaleTimeString('vi-VN') });
  const el = document.getElementById('apiLog');
  if (el) {
    el.innerHTML = S.flow.log.map(l =>
      `<div class="log-line ${l.cls}">[${l.ts}] ${l.msg}</div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
  }
}

// ─── Tab router ──────────────────────────────────────────────────────────
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-'+tab)?.classList.add('active');
  render();
}

// ─── Main render ─────────────────────────────────────────────────────────
function render() {
  const m = document.getElementById('mainContent');
  if (S.tab === 'sign') m.innerHTML = renderSign();
  else if (S.tab === 'history') m.innerHTML = renderHistory();
  else if (S.tab === 'cert') m.innerHTML = renderCert();
  else if (S.tab === 'settings') m.innerHTML = renderSettings();
  else m.innerHTML = renderDashboard();
  afterRender();
}

// ─── After render hooks ───────────────────────────────────────────────────
function afterRender() {
  if (S.tab === 'sign') {
    initSignCanvas();
    initDropZone();
    restoreLog();
  }
}

function restoreLog() {
  const el = document.getElementById('apiLog');
  if (!el) return;
  el.innerHTML = S.flow.log.map(l =>
    `<div class="log-line ${l.cls}">[${l.ts}] ${l.msg}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

// ─── Sign page ───────────────────────────────────────────────────────────
function renderSign() {
  const f = S.flow;
  const progressPct = [0, 25, 50, 75, 100, 0][f.step] || 0;
  return `
<div class="page-header">
  <h1>Ký văn bản số</h1>
  <p>Luồng ký EIDCA · Phụ lục 02 · Bảo mật DG-15 Challenge-Response + eKYC</p>
</div>

<div class="prog-bar"><div class="prog-fill" style="width:${progressPct}%"></div></div>

<div style="display:grid;grid-template-columns:1fr 340px;gap:1rem;align-items:start">

<!-- Left column -->
<div>

${f.step === 0 || f.step === 1 ? `
<!-- Upload card -->
<div class="card">
  <div class="card-title">Tài liệu cần ký</div>
  <div class="card-desc">Hỗ trợ PDF, DOC, XML, PNG, JPG · Tối đa 100MB/file</div>
  <div class="upload-zone ${S.files.length ? 'has-file' : ''}" id="dropZone" onclick="triggerFileInput()">
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V8M9 11l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.2"/></svg>
    <p>${S.files.length ? S.files.length + ' file đã chọn' : 'Kéo thả file vào đây hoặc nhấn để chọn'}</p>
    <small>PNG · JPG · XML · PDF · DOC</small>
  </div>
  <input type="file" id="fileInput" style="display:none" multiple accept=".pdf,.doc,.docx,.xml,.png,.jpg,.jpeg" onchange="handleFiles(this.files)"/>
  <div class="file-list" id="fileList">${renderFileList()}</div>
</div>

<!-- Sign settings card -->
<div class="card">
  <div class="card-title">Tuỳ chỉnh chữ ký</div>
  <div class="card-desc">Vị trí và phong cách chữ ký trên tài liệu PDF</div>
  <div class="settings-grid">
    <div class="field"><label>Trang ký</label><input type="number" min="1" value="${S.signProps.page}" onchange="S.signProps.page=+this.value"/></div>
    <div class="field"><label>Phiên ký</label>
      <select onchange="S.sessionTimeout=this.value">
        <option value="ONE_HOUR" ${S.sessionTimeout==='ONE_HOUR'?'selected':''}>1 giờ</option>
        <option value="TWO_HOURS" ${S.sessionTimeout==='TWO_HOURS'?'selected':''}>2 giờ</option>
        <option value="FOUR_HOURS" ${S.sessionTimeout==='FOUR_HOURS'?'selected':''}>4 giờ</option>
        <option value="EIGHT_HOURS" ${S.sessionTimeout==='EIGHT_HOURS'?'selected':''}>8 giờ</option>
        <option value="FULL_DAY" ${S.sessionTimeout==='FULL_DAY'?'selected':''}>24 giờ</option>
      </select>
    </div>
    <div class="field"><label>Tọa độ X (px)</label><input type="number" value="${S.signProps.x}" onchange="S.signProps.x=+this.value"/></div>
    <div class="field"><label>Tọa độ Y (px)</label><input type="number" value="${S.signProps.y}" onchange="S.signProps.y=+this.value"/></div>
    <div class="field"><label>Chiều rộng (px)</label><input type="number" value="${S.signProps.w}" onchange="S.signProps.w=+this.value"/></div>
    <div class="field"><label>Chiều cao (px)</label><input type="number" value="${S.signProps.h}" onchange="S.signProps.h=+this.value"/></div>
  </div>
  <div class="field" style="margin-top:10px"><label>Nhãn chữ ký (tuỳ chọn)</label>
    <input type="text" placeholder="Ví dụ: Giám đốc ký duyệt" value="${S.signProps.label}" onchange="S.signProps.label=this.value"/>
  </div>
  <div style="margin-top:12px">
    <div class="field"><label>Chữ ký tay (vẽ bên dưới)</label></div>
    <div class="sig-wrap">
      <canvas id="sigCanvas"></canvas>
      <button class="sig-clear" onclick="clearSig()">Xoá</button>
    </div>
  </div>
</div>
` : ''}

${f.step >= 2 ? `
<!-- Flow progress card -->
<div class="card">
  <div class="card-title">Tiến trình ký số</div>
  <div class="card-desc">Luồng EIDCA · /ca/api/sign/challenge → /ca/api/sign/signature → /ca/api/sign/download</div>
  ${renderFlowSteps()}
</div>
` : ''}

${f.step === 4 ? renderSignedResult() : ''}

<!-- API log -->
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
    <span style="font-size:12px;font-weight:500;color:var(--text2)">API Request Log</span>
    <button class="btn" style="padding:3px 8px;font-size:11px" onclick="S.flow.log=[];render()">Xoá log</button>
  </div>
  <div class="log-wrap" id="apiLog"></div>
</div>

</div>

<!-- Right column: panel -->
<div>
  <!-- Cert info -->
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
      <div class="card-title" style="margin-bottom:0">Chứng thư số đang dùng</div>
      <span class="badge g">Hoạt động</span>
    </div>
    <div class="cert-panel">
      <div class="cert-row"><span>Chủ thể</span><span>NGUYỄN VĂN AN</span></div>
      <div class="cert-row"><span>CCCD</span><span>${S.certInfo.serial}</span></div>
      <div class="cert-row"><span>Issuer</span><span>${S.certInfo.issuer}</span></div>
      <div class="cert-row"><span>Hết hạn</span><span>${S.certInfo.notAfter}</span></div>
      <div class="cert-row"><span>Level</span><span>LEVEL_2 · Công cộng</span></div>
    </div>
  </div>

  <!-- Identity confirm -->
  <div class="card">
    <div class="card-title">Xác thực danh tính</div>
    <div class="card-desc">Selfie + CCCD chip required</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:.75rem">
      <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--r);padding:.75rem;text-align:center">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" style="display:block;margin:0 auto 6px;opacity:.5"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 10h2m4 0h4M7 14h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <div style="font-size:11px;color:var(--text2)">Thẻ CCCD</div>
        <span class="badge g" style="margin-top:4px">Đã xác thực</span>
      </div>
      <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--r);padding:.75rem;text-align:center;cursor:pointer" id="selfieBox" onclick="captureSelfie()">
        ${S.selfieOk
          ? `<svg width="28" height="28" fill="none" viewBox="0 0 24 24" style="display:block;margin:0 auto 6px"><circle cx="12" cy="12" r="10" fill="var(--green)"/><path d="M8 12l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><div style="font-size:11px;color:var(--text2)">Selfie</div><span class="badge g" style="margin-top:4px">Đã chụp</span>`
          : `<svg width="28" height="28" fill="none" viewBox="0 0 24 24" style="display:block;margin:0 auto 6px;opacity:.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.4"/></svg><div style="font-size:11px;color:var(--text2)">Selfie</div><span class="badge a" style="margin-top:4px">Nhấn chụp</span>`
        }
      </div>
    </div>
    ${S.selfieOk ? `
    <div class="alert success">
      <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Face matching: <strong>${S.faceScore || 91}%</strong> · Đạt yêu cầu (≥80%)
    </div>` : `
    <div class="alert warn">
      <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><path d="M8 2L2 14h12L8 2z" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="12" r=".7" fill="currentColor"/></svg>
      Cần chụp selfie trước khi ký để xác thực sinh trắc học
    </div>`}
  </div>

  <!-- Signer info -->
  <div class="card">
    <div class="card-title">Thông tin người ký</div>
    <div style="margin-top:.5rem;display:flex;flex-direction:column;gap:6px">
      <div class="field"><label>Số CCCD</label><input readonly value="${S.idNumber}"/></div>
      <div class="field"><label>Partner Code</label><input value="${S.partnerCode}" onchange="S.partnerCode=this.value"/></div>
      <div class="field"><label>API Key</label><input type="password" value="${S.apiKey}" onchange="S.apiKey=this.value"/></div>
    </div>
  </div>

  <!-- Action button -->
  <div class="btn-row" style="margin-top:0">
    ${f.step === 0 || f.step === 5 ? `
    <button class="btn primary" style="width:100%;justify-content:center" onclick="startSignFlow()" ${!S.selfieOk||!S.files.length ? 'disabled' : ''}>
      <svg width="14" height="14" fill="none" viewBox="0 0 16 16"><path d="M2.5 12L5 9.5l7-7 1.5 1.5-7 7L2.5 12z" stroke="currentColor" stroke-width="1.4"/></svg>
      Bắt đầu ký số
    </button>` : ''}
    ${f.step >= 1 && f.step < 4 ? `
    <button class="btn" style="width:100%;justify-content:center;color:var(--text2)" disabled>
      <span class="spin dark"></span> Đang xử lý...
    </button>` : ''}
    ${f.step === 4 ? `
    <button class="btn" style="width:100%;justify-content:center" onclick="resetFlow()">Ký tài liệu mới</button>` : ''}
  </div>

</div>
</div>`;
}

function renderFlowSteps() {
  const f = S.flow;
  const steps = [
    { title: 'Tải tài liệu & lấy challenge', api: 'POST /ca/api/sign/challenge', done: f.step >= 3 },
    { title: 'Xác thực sinh trắc + gửi signature', api: 'POST /ca/api/sign/signature', done: f.step >= 4 },
    { title: 'Tải tài liệu đã ký', api: 'GET /ca/api/sign/download/{doc_id}', done: f.step >= 4 },
  ];
  return `<div class="flow-steps">` + steps.map((s, i) => {
    const state = s.done ? 'done' : (f.step === i + 2 ? 'loading' : (f.step > i+1 ? 'done' : ''));
    const icon = state === 'done' ? '✓' : (state === 'loading' ? '···' : (i+1));
    return `
    <div class="flow-step">
      <div class="step-dot ${state}">${icon}</div>
      <div class="step-body">
        <div class="step-title">${s.title}</div>
        <div class="step-detail" style="font-family:var(--mono);font-size:10px">${s.api}</div>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

function renderSignedResult() {
  const f = S.flow;
  return `
  <div class="card" style="border-color:var(--green)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:.75rem">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text)">Ký số hoàn tất</div>
        <div style="font-size:11px;color:var(--text2)">Mã GD: <span style="font-family:var(--mono)">${f.transactionCode}</span></div>
      </div>
    </div>
    <div class="doc-result">
      ${f.signedDocs.map(d => `
      <div class="doc-result-row">
        <div class="file-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="var(--blue)" stroke-width="1.4"/><polyline points="14 2 14 8 20 8" stroke="var(--blue)" stroke-width="1.4"/></svg></div>
        <div style="flex:1;min-width:0">
          <div class="file-name">${d.doc_name}</div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">Hash: ${d.doc_hash} · Ký lúc: ${d.sign_at}</div>
        </div>
        <span class="badge g">Đã ký</span>
        <button class="btn" style="padding:4px 10px;font-size:11px" onclick="downloadDoc('${d.doc_id}','${d.doc_name}')">Tải xuống</button>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderFileList() {
  if (!S.files.length) return '';
  return S.files.map((f, i) => `
  <div class="file-item">
    <div class="file-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="var(--blue)" stroke-width="1.4"/><polyline points="14 2 14 8 20 8" stroke="var(--blue)" stroke-width="1.4"/></svg></div>
    <div class="file-meta">
      <div class="file-name">${f.name}</div>
      <div class="file-size">${(f.size/1024).toFixed(1)} KB · ${f.type||'application/octet-stream'}</div>
    </div>
    <button class="file-remove" onclick="removeFile(${i})">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    </button>
  </div>`).join('');
}

// ─── File handling ────────────────────────────────────────────────────────
function triggerFileInput() { document.getElementById('fileInput')?.click() }

function handleFiles(files) {
  Array.from(files).forEach(f => {
    if (f.size > 100*1024*1024) { alert('File ' + f.name + ' vượt 100MB'); return }
    if (!S.files.find(x => x.name === f.name)) S.files.push(f);
  });
  render();
}

function removeFile(i) { S.files.splice(i, 1); render() }

function initDropZone() {
  const dz = document.getElementById('dropZone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag') });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
}

// ─── Signature canvas ──────────────────────────────────────────────────
function initSignCanvas() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * devicePixelRatio;
  canvas.height = 120 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.strokeStyle = '#1a9e72';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  S.sigCanvas = canvas; S.sigCtx = ctx;

  const getPos = e => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  canvas.addEventListener('mousedown', e => { S.sigDrawing = true; ctx.beginPath(); const p=getPos(e); ctx.moveTo(p.x,p.y) });
  canvas.addEventListener('mousemove', e => { if(!S.sigDrawing) return; const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); S.sigHasData=true });
  canvas.addEventListener('mouseup', () => S.sigDrawing = false);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); S.sigDrawing=true; ctx.beginPath(); const p=getPos(e); ctx.moveTo(p.x,p.y) });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if(!S.sigDrawing) return; const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); S.sigHasData=true });
  canvas.addEventListener('touchend', () => S.sigDrawing=false);
}

function clearSig() {
  if (!S.sigCtx || !S.sigCanvas) return;
  S.sigCtx.clearRect(0, 0, S.sigCanvas.width, S.sigCanvas.height);
  S.sigHasData = false;
}

function getSigBase64() {
  if (!S.sigCanvas || !S.sigHasData) return null;
  return S.sigCanvas.toDataURL('image/png').split(',')[1];
}

// ─── Selfie ────────────────────────────────────────────────────────────
function captureSelfie() {
  const box = document.getElementById('selfieBox');
  if (box) { box.style.opacity = '.5'; box.style.pointerEvents = 'none' }
  setTimeout(() => {
    S.selfieOk = true;
    S.faceScore = Math.floor(Math.random()*12)+86;
    render();
  }, 900);
}

// ─── Sign flow ────────────────────────────────────────────────────────
function startSignFlow() {
  if (!S.files.length) { alert('Vui lòng chọn ít nhất 1 tài liệu'); return }
  if (!S.selfieOk) { alert('Vui lòng chụp ảnh selfie xác thực trước'); return }
  S.flow = { step: 1, transactionCode: '', tokenSign: '', docs: [], signedDocs: [], log: S.flow.log };
  render();
  step1_uploadChallenge();
}

async function step1_uploadChallenge() {
  log('▶ STEP 1: Upload tài liệu & lấy sign challenge', 'req');
  log(`POST ${S.baseUrl}/ca/api/sign/challenge`, 'req');
  log(`Header: x-api-key: ${S.apiKey.substr(0,8)}...`, 'dim');
  log(`Form: id_number="${S.idNumber}", code="${S.partnerCode}", security_level="LEVEL_2"`, 'dim');
  log(`       session_timeout="${S.sessionTimeout}", documents=[${S.files.map(f=>f.name).join(', ')}]`, 'dim');
  log(`       sign_props={page:${S.signProps.page}, x:${S.signProps.x}, y:${S.signProps.y}, w:${S.signProps.w}, h:${S.signProps.h}}`, 'dim');

  await delay(1400);
  const txn = 'TXN-' + Math.random().toString(36).substr(2,8).toUpperCase();
  const tokenSign = 'tks_' + Math.random().toString(36).substr(2,24);
  const docs = S.files.map(f => ({
    doc_id: 'doc_' + Math.random().toString(36).substr(2,8),
    doc_name: f.name,
    doc_type: 'file',
    doc_challenge: 'chal_' + Math.random().toString(36).substr(2,16)
  }));

  log(`Response: { success: true }`, 'ok');
  log(`  transaction_code: "${txn}"`, 'ok');
  log(`  token_sign: "${tokenSign.substr(0,18)}..."`, 'ok');
  log(`  docs: [${docs.map(d=>'"'+d.doc_id+'"').join(', ')}]`, 'ok');

  S.flow.transactionCode = txn;
  S.flow.tokenSign = tokenSign;
  S.flow.docs = docs;
  S.flow.step = 2;
  render();

  await delay(600);
  step2_sendSignature();
}

async function step2_sendSignature() {
  log('', 'dim');
  log('▶ STEP 2: Gửi sinh trắc học + signature xác nhận ký', 'req');
  log(`POST ${S.baseUrl}/ca/api/sign/signature`, 'req');
  log(`Header: x-api-key: ${S.apiKey.substr(0,8)}...`, 'dim');
  log(`Body: transaction_code="${S.flow.transactionCode}"`, 'dim');
  log(`      token_sign="${S.flow.tokenSign.substr(0,14)}..."`, 'dim');
  log(`      info.image=[selfie base64]  face_score=${S.faceScore}%`, 'dim');

  S.flow.docs.forEach(d => {
    const sig = 'sig_' + Math.random().toString(36).substr(2,32);
    log(`      doc_signs[${d.doc_id}].signature="${sig.substr(0,16)}..."`, 'dim');
  });

  S.flow.step = 3;
  render();

  await delay(1800);

  const signedDocs = S.flow.docs.map(d => ({
    doc_id: d.doc_id,
    doc_name: d.doc_name,
    ca_signature: 'casig_' + Math.random().toString(36).substr(2,40),
    sign_at: new Date().toLocaleString('vi-VN'),
    expire_at: new Date(Date.now() + 365*24*3600*1000).toLocaleDateString('vi-VN'),
    doc_hash: Math.random().toString(36).substr(2,6) + '...' + Math.random().toString(36).substr(2,4)
  }));

  log(`Response: { success: true, status: "completed" }`, 'ok');
  signedDocs.forEach(d => {
    log(`  signed_docs[${d.doc_id}]: hash="${d.doc_hash}" · ca_sig="${d.ca_signature.substr(0,14)}..."`, 'ok');
  });

  S.flow.signedDocs = signedDocs;
  S.flow.step = 4;
  render();
  step3_mockDownload();
}

async function step3_mockDownload() {
  await delay(400);
  log('', 'dim');
  log('▶ STEP 3: Tải tài liệu đã ký', 'req');
  S.flow.docs.forEach(d => {
    log(`GET ${S.baseUrl}/ca/api/sign/download/${d.doc_id}`, 'req');
  });
  await delay(800);
  log('Response: [binary PDF data] · Content-Type: application/pdf', 'ok');
  log('✔ Ký số hoàn tất thành công', 'ok');
}

function downloadDoc(docId, docName) {
  log(`GET ${S.baseUrl}/ca/api/sign/download/${docId}  → simulate download`, 'req');
  // Simulate download with a dummy blob
  const content = `%PDF-1.4 [Signed document: ${docName}]\n[EIDCA Digital Signature]\nTransaction: ${S.flow.transactionCode}\nSigned at: ${new Date().toISOString()}`;
  const blob = new Blob([content], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'signed_' + docName;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetFlow() {
  S.flow = { step: 0, transactionCode: '', tokenSign: '', docs: [], signedDocs: [], log: [] };
  S.files = [];
  S.selfieOk = false;
  render();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── History page ─────────────────────────────────────────────────────
function renderHistory() {
  return `
<div class="page-header"><h1>Lịch sử ký</h1><p>Các giao dịch ký số đã thực hiện</p></div>
<div class="card">
  <div style="display:flex;flex-direction:column;gap:0">
    <div style="display:grid;grid-template-columns:1fr 160px 130px 100px;gap:8px;padding:6px 8px;font-size:11px;font-weight:500;color:var(--text3)">
      <span>Tài liệu</span><span>Thời gian</span><span>Hash SHA256</span><span>Trạng thái</span>
    </div>
    ${S.history.map(h => `
    <div style="display:grid;grid-template-columns:1fr 160px 130px 100px;gap:8px;padding:9px 8px;border-top:0.5px solid var(--border);align-items:center;font-size:13px">
      <div>
        <div style="font-weight:500;color:var(--text)">${h.name}</div>
        <div style="font-size:11px;font-family:var(--mono);color:var(--text3)">${h.id}</div>
      </div>
      <div style="font-size:12px;color:var(--text2)">${h.date}</div>
      <div style="font-size:11px;font-family:var(--mono);color:var(--text2)">${h.hash}</div>
      <span class="badge ${h.status==='completed'?'g':'r'}">${h.status==='completed'?'Thành công':'Thất bại'}</span>
    </div>`).join('')}
  </div>
</div>`;
}

// ─── Cert page ───────────────────────────────────────────────────────
function renderCert() {
  const c = S.certInfo;
  return `
<div class="page-header"><h1>Chứng thư số của tôi</h1><p>CTS công cộng cá nhân do EIDCA cấp</p></div>
<div class="card">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem">
    <div style="width:44px;height:44px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center">
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="var(--green)" stroke-width="1.6"/></svg>
    </div>
    <div>
      <div style="font-size:15px;font-weight:500;color:var(--text)">NGUYỄN VĂN AN</div>
      <div style="font-size:12px;color:var(--text2)">Chứng thư số cá nhân · Đang hoạt động</div>
    </div>
    <span class="badge g" style="margin-left:auto">Hợp lệ</span>
  </div>
  <div class="cert-panel">
    <div class="cert-row"><span>Số serial</span><span>${c.serial}</span></div>
    <div class="cert-row"><span>Subject</span><span>${c.subject}</span></div>
    <div class="cert-row"><span>Issuer</span><span>${c.issuer}</span></div>
    <div class="cert-row"><span>Ngày cấp</span><span>${c.notBefore}</span></div>
    <div class="cert-row"><span>Ngày hết hạn</span><span>${c.notAfter}</span></div>
    <div class="cert-row"><span>Email</span><span>${c.email}</span></div>
    <div class="cert-row"><span>Security level</span><span>LEVEL_2</span></div>
    <div class="cert-row"><span>Algorithm</span><span>RSA-2048 · SHA256withRSA</span></div>
  </div>
  <div class="btn-row" style="margin-top:.75rem">
    <button class="btn" onclick="alert('Download CTS (mô phỏng)')">Tải xuống CTS</button>
    <button class="btn" onclick="alert('Xem chi tiết trên Public CA')">Xem trên Public CA</button>
  </div>
</div>`;
}

// ─── Settings page ────────────────────────────────────────────────────
function renderSettings() {
  return `
<div class="page-header"><h1>Cài đặt API</h1><p>Kết nối với hệ thống EIDCA</p></div>
<div class="card">
  <div class="card-title">Thông tin kết nối</div>
  <div class="card-desc">Thông tin được cung cấp bởi EIDCA / đơn vị đối tác (TĐL-ĐL)</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="field"><label>Base URL</label><input value="${S.baseUrl}" onchange="S.baseUrl=this.value"/></div>
    <div class="field"><label>API Key (x-api-key)</label><input type="password" value="${S.apiKey}" onchange="S.apiKey=this.value"/></div>
    <div class="field"><label>Partner / Sub-partner Code</label><input value="${S.partnerCode}" onchange="S.partnerCode=this.value"/></div>
    <div class="field"><label>Số CCCD (id_number)</label><input value="${S.idNumber}" onchange="S.idNumber=this.value"/></div>
  </div>
  <div class="alert info" style="margin-top:1rem">
    <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="5" r=".7" fill="currentColor"/></svg>
    API Key và thông tin kết nối được cung cấp sau khi hoàn tất ký hợp đồng với EIDCA (Bước 5 trong quy trình triển khai).
  </div>
  <div class="btn-row">
    <button class="btn primary" onclick="alert('Cài đặt đã được lưu')">Lưu cài đặt</button>
  </div>
</div>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────
function renderDashboard() {
  return `
<div class="page-header"><h1>Tổng quan</h1><p>EIDCA Digital Signing Platform</p></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:1rem">
  ${[['Tổng tài liệu ký','3 văn bản','g'],['CTS còn hiệu lực','355 ngày','b'],['Trạng thái CTS','Hoạt động','g']].map(([label,val,c])=>`
  <div style="background:var(--bg);border:0.5px solid var(--border);border-radius:var(--rl);padding:1rem">
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${label}</div>
    <div style="font-size:20px;font-weight:500;color:var(--text)">${val}</div>
  </div>`).join('')}
</div>
<div class="card">
  <div class="card-title">Ký nhanh</div>
  <div class="card-desc">Chọn tài liệu và ký ngay với chứng thư số đang hoạt động</div>
  <button class="btn primary" onclick="setTab('sign')">
    <svg width="14" height="14" fill="none" viewBox="0 0 16 16"><path d="M2.5 12L5 9.5l7-7 1.5 1.5-7 7L2.5 12z" stroke="currentColor" stroke-width="1.4"/></svg>
    Ký văn bản mới
  </button>
</div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────
// Fix nav active
document.querySelectorAll('.nav-item').forEach(b => {
  b.id = 'nav-' + (b.textContent.trim() === 'Ký văn bản' ? 'sign' :
    b.textContent.trim() === 'Tổng quan' ? 'dashboard' :
    b.textContent.trim() === 'Lịch sử ký' ? 'history' :
    b.textContent.trim() === 'Chứng thư số' ? 'cert' : 'settings');
});

render();
</script>
</body>
</html>

