<?php
/**
 * EIDCA CMS – Wrapper: Demo Đăng ký Chứng thư số
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
<title>Đăng ký Chữ ký số – EIDCA</title>
<meta name="description" content="Đăng ký chữ ký số cá nhân EIDCA an toàn, nhanh chóng. Sử dụng CCCD gắn chip và xác thực khuôn mặt để cấp chứng thư số trong vài phút."/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<!-- Socket.IO CDN (dùng cho kết nối thiết bị thật; bỏ qua nếu không online) -->
<script>window._sioLoaded=false;</script>
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js" crossorigin="anonymous" onload="window._sioLoaded=true" onerror="console.warn('[EIDCA] socket.io CDN unavailable – real device mode disabled')"></script>
<!-- CMS Integration: load eidcaLogEvent helper -->
<script src="<?= $base ?>/assets/cms.js" onerror="console.info('[EIDCA] CMS js not loaded – log disabled')"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
:root {
  --primary:#0057B8; --primary-dark:#003f8a; --primary-light:#e8f0fb; --primary-mid:#c2d8f7;
  --accent:#00A878; --accent-light:#e0f7f2;
  --warn:#E07B00; --warn-light:#fff3e0;
  --danger:#D32F2F; --danger-light:#ffebee;
  --success:#1B7A47; --success-light:#e8f5ee;
  --bg:#F5F7FA; --surface:#ffffff; --surface-alt:#F0F4F9;
  --border:#DDE3EC; --border-strong:#B0BDD0;
  --text:#0F1923; --text-2:#3D4F65; --text-3:#7A8EA8; --text-inv:#ffffff;
  --r-sm:6px; --r-md:10px; --r-lg:16px; --r-xl:24px;
  --shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);
  --shadow-md:0 4px 12px rgba(0,0,0,.10),0 2px 4px rgba(0,0,0,.06);
}
body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; -webkit-font-smoothing:antialiased; }

/* Nav */
.topnav { background:var(--surface); border-bottom:1px solid var(--border); padding:0 2rem; display:flex; align-items:center; justify-content:space-between; height:60px; position:sticky; top:0; z-index:100; box-shadow:var(--shadow-sm); }
.nav-brand { display:flex; align-items:center; gap:10px; text-decoration:none; }
.nav-logo { width:34px; height:34px; background:var(--primary); border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; }
.nav-logo svg { width:18px; height:18px; }
.nav-title { font-size:15px; font-weight:700; color:var(--primary); letter-spacing:-.3px; }
.nav-title span { color:var(--text-3); font-weight:400; margin-left:4px; font-size:13px; }
.nav-right { display:flex; align-items:center; gap:12px; }
.nav-secure { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--accent); font-weight:500; }
.nav-secure svg { width:14px; height:14px; }
/* Device status pill in nav */
.device-pill { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; padding:5px 10px; border-radius:20px; border:1.5px solid var(--border); cursor:pointer; background:var(--surface); transition:all .2s; }
.device-pill:hover { border-color:var(--primary-mid); background:var(--primary-light); }
.device-pill .dot { width:8px; height:8px; border-radius:50%; background:var(--border-strong); flex-shrink:0; transition:background .3s; }
.device-pill .dot.connecting { background:var(--warn); animation:blink .8s step-end infinite; }
.device-pill .dot.connected { background:var(--accent); }
.device-pill .dot.error { background:var(--danger); }
@keyframes blink { 50% { opacity:0; } }

/* Layout */
.page-wrap { max-width:820px; margin:0 auto; padding:2.5rem 1.5rem 4rem; }

/* Hero */
.page-hero { text-align:center; margin-bottom:2.5rem; }
.badge-top { display:inline-flex; align-items:center; gap:6px; background:var(--primary-light); color:var(--primary); font-size:12px; font-weight:600; padding:5px 12px; border-radius:20px; margin-bottom:1rem; letter-spacing:.02em; }
.page-hero h1 { font-size:28px; font-weight:700; color:var(--text); margin-bottom:.5rem; letter-spacing:-.5px; line-height:1.2; }
.page-hero p { font-size:15px; color:var(--text-2); max-width:520px; margin:0 auto; line-height:1.6; }

/* Trust bar */
.trust-bar { display:flex; align-items:center; justify-content:center; gap:2rem; margin-bottom:2.5rem; flex-wrap:wrap; }
.trust-item { display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--text-3); font-weight:500; }
.trust-item svg { width:15px; height:15px; color:var(--accent); flex-shrink:0; }

/* Stepper */
.stepper { display:flex; align-items:flex-start; justify-content:center; margin-bottom:2rem; position:relative; }
.stepper::before { content:''; position:absolute; top:18px; left:calc(50% - 130px); right:calc(50% - 130px); height:2px; background:var(--border); z-index:0; }
.stepper-item { display:flex; flex-direction:column; align-items:center; gap:8px; width:120px; position:relative; z-index:1; }
.stepper-line { flex:1; margin-top:18px; max-width:80px; align-self:flex-start; height:2px; background:var(--border); transition:background .4s; }
.stepper-line.done { background:var(--primary); }
.step-circle { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; border:2px solid var(--border); background:var(--surface); color:var(--text-3); transition:all .3s ease; position:relative; z-index:1; }
.step-circle.active { border-color:var(--primary); background:var(--primary); color:var(--text-inv); box-shadow:0 0 0 4px var(--primary-light); }
.step-circle.done { border-color:var(--primary); background:var(--primary); color:var(--text-inv); }
.step-circle.done svg { width:16px; height:16px; }
.step-label { font-size:11px; font-weight:500; color:var(--text-3); text-align:center; line-height:1.3; }
.step-label.active { color:var(--primary); font-weight:600; }
.step-label.done { color:var(--primary); }

/* Card */
.main-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-xl); box-shadow:var(--shadow-md); overflow:hidden; }
.card-header { padding:1.75rem 2rem 1.25rem; border-bottom:1px solid var(--border); background:linear-gradient(135deg,var(--primary-light) 0%,#f5f9ff 100%); }
.card-header-inner { display:flex; align-items:center; gap:14px; }
.card-icon { width:48px; height:48px; border-radius:var(--r-md); background:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(0,87,184,.25); }
.card-icon svg { width:24px; height:24px; }
.card-header h2 { font-size:17px; font-weight:700; color:var(--text); margin-bottom:3px; letter-spacing:-.3px; }
.card-header p { font-size:13px; color:var(--text-2); line-height:1.4; }
.card-body { padding:2rem; }

/* Form */
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.form-group { display:flex; flex-direction:column; gap:6px; margin-bottom:1.25rem; }
.form-group.full { grid-column:1/-1; }
label { font-size:13px; font-weight:600; color:var(--text-2); }
label .req { color:var(--danger); margin-left:2px; }
.field-hint { font-size:11.5px; color:var(--text-3); margin-top:2px; }
input[type="text"],input[type="tel"],input[type="email"],input[type="date"],select {
  width:100%; padding:10px 13px; font-size:14px; font-family:'Inter',sans-serif;
  border:1.5px solid var(--border); border-radius:var(--r-md); background:var(--surface);
  color:var(--text); transition:border-color .15s,box-shadow .15s; appearance:none; -webkit-appearance:none;
}
input:focus,select:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px rgba(0,87,184,.12); }
input.error { border-color:var(--danger); }
input.filled { border-color:var(--accent); background:#f6fef9; }
.error-msg { font-size:11.5px; color:var(--danger); display:none; }
.error-msg.show { display:block; }
/* auto-fill badge */
.autofill-badge { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; color:var(--accent); background:var(--accent-light); padding:2px 7px; border-radius:20px; }

/* Section sep */
.section-sep { display:flex; align-items:center; gap:.75rem; margin:1.5rem 0; }
.section-sep span { font-size:12px; font-weight:600; color:var(--text-3); white-space:nowrap; letter-spacing:.05em; text-transform:uppercase; }
.sep-line { flex:1; height:1px; background:var(--border); }

/* ── Device panel (NFC reader box) ── */
.device-panel {
  border:1.5px solid var(--border); border-radius:var(--r-lg); overflow:hidden;
  margin-bottom:1.25rem; background:var(--surface);
}
.device-panel-header {
  padding:12px 16px; background:var(--surface-alt);
  border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between;
}
.device-panel-title { font-size:13px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:8px; }
.device-panel-title svg { width:16px; height:16px; color:var(--primary); }
.device-panel-body { padding:1.25rem 1.5rem; }
.device-status-badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; }
.dsb-idle    { background:var(--surface-alt); color:var(--text-3); }
.dsb-scan    { background:var(--primary-light); color:var(--primary); }
.dsb-ok      { background:var(--success-light); color:var(--success); }
.dsb-error   { background:var(--danger-light); color:var(--danger); }

/* Card reader status display */
.reader-status {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:1.5rem; gap:12px; min-height:140px; text-align:center;
}
.reader-anim {
  width:80px; height:80px; border-radius:var(--r-lg);
  background:var(--primary-light); display:flex; align-items:center; justify-content:center;
  position:relative;
}
.reader-anim svg { width:36px; height:36px; }
.reader-anim.scanning::before {
  content:''; position:absolute; inset:-4px; border-radius:calc(var(--r-lg)+4px);
  border:2.5px solid var(--primary); animation:scanPulse 1.5s ease-out infinite;
}
.reader-anim.scanning::after {
  content:''; position:absolute; inset:-4px; border-radius:calc(var(--r-lg)+4px);
  border:2.5px solid var(--primary); animation:scanPulse 1.5s ease-out .6s infinite;
}
@keyframes scanPulse { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(1.35);opacity:0} }
.reader-anim.ok  { background:var(--accent-light); }
.reader-anim.err { background:var(--danger-light); }
.reader-status-text { font-size:14px; font-weight:600; color:var(--text); }
.reader-status-sub  { font-size:12.5px; color:var(--text-2); line-height:1.5; }

/* CCCD preview card */
.cccd-preview {
  display:grid; grid-template-columns:80px 1fr; gap:1rem;
  background:linear-gradient(135deg,#0f2a50 0%,#0057B8 60%,#1a73e8 100%);
  border-radius:var(--r-md); padding:1rem 1.25rem; color:#fff;
  margin-top:1rem; position:relative; overflow:hidden;
}
.cccd-preview::after {
  content:''; position:absolute; top:-30px; right:-30px;
  width:120px; height:120px; border-radius:50%;
  background:rgba(255,255,255,.06); pointer-events:none;
}
.cccd-photo {
  width:76px; height:96px; border-radius:var(--r-sm);
  background:rgba(255,255,255,.15); border:2px solid rgba(255,255,255,.3);
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.cccd-photo img { width:100%; height:100%; object-fit:cover; border-radius:calc(var(--r-sm)-1px); }
.cccd-photo svg { width:32px; height:32px; opacity:.5; }
.cccd-info { display:flex; flex-direction:column; gap:5px; justify-content:center; }
.cccd-info-row { }
.cccd-info-label { opacity:.65; font-weight:500; font-size:10px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:1px; }
.cccd-info-value { font-weight:600; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cccd-id-number { font-size:17px; font-weight:700; letter-spacing:2px; margin-bottom:6px; font-family:'SF Mono','Fira Code',monospace; }
.cccd-chip-badge {
  position:absolute; bottom:10px; right:14px;
  font-size:9.5px; font-weight:700; color:rgba(255,255,255,.6);
  letter-spacing:.08em; text-transform:uppercase;
}

/* Webcam / selfie */
.webcam-container {
  border:1.5px solid var(--border); border-radius:var(--r-lg); overflow:hidden;
  background:#111; position:relative; aspect-ratio:4/3;
}
.webcam-container canvas,
.webcam-container img  { width:100%; height:100%; object-fit:cover; display:block; }
/* Face guide oval */
.face-guide {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-53%);
  width:38%; padding-bottom:48%;
  border-radius:50%; border:2.5px dashed rgba(255,255,255,.65);
  pointer-events:none; box-shadow:0 0 0 2000px rgba(0,0,0,.35);
}
/* Scan line animation inside face guide */
.face-scan-line {
  position:absolute; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,rgba(0,200,150,.8),transparent);
  animation:faceScan 2s ease-in-out infinite;
  pointer-events:none;
}
@keyframes faceScan {
  0%   { top:20%; opacity:0; }
  10%  { opacity:1; }
  90%  { opacity:1; }
  100% { top:80%; opacity:0; }
}
.webcam-captured { position:relative; }
.webcam-captured .capture-badge {
  position:absolute; top:10px; right:10px;
  background:var(--accent); color:#fff; font-size:11px; font-weight:700;
  padding:4px 10px; border-radius:20px; display:flex; align-items:center; gap:4px;
}
/* Face score bar */
.face-score-bar {
  margin-top:.75rem; padding:10px 14px;
  background:var(--success-light); border-radius:var(--r-md);
  border:1px solid #a7d7bb;
  display:flex; align-items:center; gap:10px;
}
.score-track { flex:1; height:6px; background:rgba(27,122,71,.15); border-radius:3px; overflow:hidden; }
.score-fill  { height:100%; border-radius:3px; background:var(--accent); transition:width 1s ease; }

/* Selfie area */
.selfie-area { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.selfie-guide-box {
  background:var(--surface-alt); border:1px solid var(--border);
  border-radius:var(--r-lg); padding:1.25rem;
}
.selfie-guide-box h4 { font-size:13px; font-weight:600; color:var(--text); margin-bottom:.75rem; }
.selfie-guide-box ul { padding-left:1.1rem; display:flex; flex-direction:column; gap:7px; }
.selfie-guide-box li { font-size:12.5px; color:var(--text-2); line-height:1.4; }

/* Alerts */
.alert { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:var(--r-md); font-size:13px; line-height:1.5; margin-bottom:1.25rem; animation:fadeSlide .3s ease; }
.alert svg { width:16px; height:16px; flex-shrink:0; margin-top:1px; }
.alert-info { background:var(--primary-light); color:var(--primary-dark); border:1px solid var(--primary-mid); }
.alert-success { background:var(--success-light); color:var(--success); border:1px solid #a7d7bb; }
.alert-warn { background:var(--warn-light); color:var(--warn); border:1px solid #fcd59e; }
.alert-danger { background:var(--danger-light); color:var(--danger); border:1px solid #fbb9b9; }
@keyframes fadeSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

/* Checklist */
.checklist { display:flex; flex-direction:column; gap:10px; margin-bottom:1.5rem; }
.check-item { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:var(--r-md); background:var(--surface-alt); border:1px solid var(--border); font-size:13.5px; font-weight:500; color:var(--text); transition:all .2s; }
.check-item.pending { opacity:.55; }
.check-item.active { border-color:var(--primary); background:var(--primary-light); }
.check-item.ok { border-color:var(--accent); background:var(--accent-light); }
.check-item.fail { border-color:var(--danger); background:var(--danger-light); }
.check-dot { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:var(--border); }
.check-dot.ok-dot { background:var(--accent); }
.check-dot.fail-dot { background:var(--danger); }
.check-dot.spin-dot { background:var(--primary); }
.check-dot svg { width:12px; height:12px; }

/* Result */
.result-card { border:2px solid var(--accent); border-radius:var(--r-xl); overflow:hidden; animation:fadeSlide .4s ease; }
.result-header { background:linear-gradient(135deg,var(--accent) 0%,#007a56 100%); padding:2rem; text-align:center; color:#fff; }
.result-seal { width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; border:3px solid rgba(255,255,255,.5); }
.result-seal svg { width:36px; height:36px; }
.result-header h2 { font-size:22px; font-weight:700; margin-bottom:6px; }
.result-header p { font-size:13px; opacity:.85; }
.result-body { background:var(--surface); padding:1.75rem 2rem; }
.cert-table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
.cert-table tr { border-bottom:1px solid var(--border); }
.cert-table tr:last-child { border-bottom:none; }
.cert-table th { text-align:left; padding:10px 0; font-size:12px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; width:40%; }
.cert-table td { padding:10px 0; font-size:13.5px; font-weight:500; color:var(--text); }
.badge-valid { display:inline-flex; align-items:center; gap:5px; background:var(--success-light); color:var(--success); font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; }

/* Buttons */
.btn-row { display:flex; gap:10px; margin-top:2rem; align-items:center; justify-content:flex-end; }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:11px 22px; font-size:14px; font-weight:600; font-family:'Inter',sans-serif; border-radius:var(--r-md); cursor:pointer; border:1.5px solid transparent; transition:all .15s ease; letter-spacing:-.1px; }
.btn:active { transform:scale(.97); }
.btn-primary { background:var(--primary); color:#fff; border-color:var(--primary); box-shadow:0 2px 8px rgba(0,87,184,.3); }
.btn-primary:hover { background:var(--primary-dark); }
.btn-primary:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
.btn-secondary { background:var(--surface); color:var(--text-2); border-color:var(--border); }
.btn-secondary:hover { background:var(--surface-alt); border-color:var(--border-strong); }
.btn-outline-primary { background:var(--surface); color:var(--primary); border-color:var(--primary); }
.btn-outline-primary:hover { background:var(--primary-light); }
.btn-success { background:var(--accent); color:#fff; border-color:var(--accent); }
.btn-success:hover { background:#008560; }
.btn svg { width:16px; height:16px; }

/* Spinner */
.spin { display:inline-block; width:16px; height:16px; border:2.5px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }
.spin.dark { border-color:rgba(0,87,184,.15); border-top-color:var(--primary); }
@keyframes spin { to { transform:rotate(360deg) } }

/* Req grid */
.req-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; margin-top:1rem; }
.req-item { display:flex; align-items:center; gap:10px; padding:12px; border-radius:var(--r-md); background:var(--surface-alt); border:1px solid var(--border); font-size:13px; font-weight:500; color:var(--text); }
.req-icon { width:36px; height:36px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; background:var(--primary-light); flex-shrink:0; }
.req-icon svg { width:18px; height:18px; color:var(--primary); }

/* Device status bar */
#deviceStatusBar { margin-bottom:1.25rem; }
#deviceStatusBar:empty { display:none; }
.dbar-inner { border:1.5px solid var(--primary-mid); border-radius:var(--r-lg); background:var(--primary-light); padding:14px 16px; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
.dbar-title { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:var(--primary-dark); white-space:nowrap; flex-shrink:0; }
.dbar-items { display:flex; align-items:center; gap:1.25rem; flex:1; flex-wrap:wrap; }
.dbar-item { display:flex; align-items:center; gap:8px; }
.dbar-dot { width:10px; height:10px; border-radius:50%; background:var(--border-strong); flex-shrink:0; }
.dbar-dot.dbar-ok { background:var(--accent); }
.dbar-dot.dbar-fail { background:var(--danger); }
.dbar-dot.dbar-blink { background:var(--warn); animation:blink .7s step-end infinite; }
@keyframes blink { 50% { opacity:0; } }
.dbar-item-label { font-size:11.5px; font-weight:600; color:var(--text-2); line-height:1.2; }
.dbar-item-desc { font-size:10.5px; color:var(--text-3); line-height:1.2; margin-top:1px; }
.dbar-retry { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:5px 11px; background:var(--surface); border:1.5px solid var(--primary-mid); border-radius:var(--r-sm); cursor:pointer; color:var(--primary); font-family:'Inter',sans-serif; flex-shrink:0; white-space:nowrap; }
.dbar-retry:hover { background:var(--primary-light); border-color:var(--primary); }

/* Mode toggle */
.mode-toggle { display:flex; gap:4px; background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r-md); padding:3px; margin-bottom:1.25rem; }
.mode-btn { flex:1; padding:6px 10px; font-size:12px; font-weight:600; border:none; border-radius:calc(var(--r-md)-2px); cursor:pointer; transition:all .15s; background:transparent; color:var(--text-3); font-family:'Inter',sans-serif; }
.mode-btn.active { background:var(--surface); color:var(--primary); box-shadow:var(--shadow-sm); }

/* Footer */
.page-footer { text-align:center; margin-top:2.5rem; font-size:12px; color:var(--text-3); }
.page-footer a { color:var(--primary); text-decoration:none; }
.page-footer a:hover { text-decoration:underline; }
.footer-logos { display:flex; align-items:center; justify-content:center; gap:2rem; margin-bottom:.75rem; flex-wrap:wrap; }
.gov-logo { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-3); font-weight:500; }
.gov-seal { width:28px; height:28px; border-radius:50%; background:var(--surface-alt); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; }
.gov-seal svg { width:14px; height:14px; }

@media(max-width:600px) {
  .topnav { padding:0 1rem; } .device-pill span { display:none; }
  .page-wrap { padding:1.5rem 1rem 3rem; }
  .page-hero h1 { font-size:22px; }
  .card-header,.card-body { padding:1.25rem; }
  .form-row,.selfie-area,.req-grid { grid-template-columns:1fr; }
  .cccd-preview { grid-template-columns:1fr; }
  .btn-row { flex-direction:column; }
  .btn-row .btn { width:100%; }
  .trust-bar { gap:1rem; }
  .stepper::before { display:none; }
}
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


<!-- ── Top Navigation ── -->
<nav class="topnav" role="navigation" aria-label="Điều hướng chính">
  <a class="nav-brand" href="#" aria-label="EIDCA - Trang chủ">
    <div class="nav-logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2.5 2.5L15 9.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div><span class="nav-title">EIDCA <span>Chứng thư số</span></span></div>
  </a>
  <div class="nav-right">
    <button class="device-pill" id="devicePill" onclick="toggleDeviceMode()" title="Nhấn để chuyển chế độ thiết bị">
      <span class="dot" id="deviceDot"></span>
      <span id="devicePillLabel">Demo Mode</span>
    </button>
    <div class="nav-secure" aria-label="Kết nối bảo mật">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Kết nối an toàn
    </div>
  </div>
</nav>

<main class="page-wrap" role="main">
  <div class="page-hero">
    <div class="badge-top" role="note">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Được cấp phép bởi Bộ Thông tin &amp; Truyền thông
    </div>
    <h1>Đăng ký Chữ ký số Cá nhân</h1>
    <p>Cấp chứng thư số điện tử pháp lý trong vài phút — sử dụng CCCD gắn chip và xác thực khuôn mặt.</p>
  </div>

  <div class="trust-bar" role="list">
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>Bảo mật TLS 1.3</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Xác thực 2 lớp</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>Chuẩn ICAO 9303</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8"/></svg>Lưu trữ trên HSM</div>
  </div>

  <div class="stepper" id="stepper" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" aria-label="Tiến trình đăng ký"></div>

  <!-- Device Status Bar: hiển khi dùng thiết bị thật -->
  <div id="deviceStatusBar"></div>

  <div class="main-card" id="wizardCard"></div>

  <footer class="page-footer" role="contentinfo">
    <div class="footer-logos">
      <div class="gov-logo"><div class="gov-seal"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>Bộ Công an · Cục Cảnh sát QLHC</div>
      <div class="gov-logo"><div class="gov-seal"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M8 8h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>Bộ TT&amp;TT · Cục chứng thực số</div>
    </div>
    <p>Bằng cách tiếp tục, bạn đồng ý với <a href="#">Điều khoản sử dụng</a> và <a href="#">Chính sách bảo mật</a> của EIDCA. © 2026 EIDCA.</p>
  </footer>
</main>

<script>
// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SOCKET  (tương thích interface với socketClient thật)
// ═══════════════════════════════════════════════════════════════════════════════
const MOCK_DEVICE_INFO = { version:'1.1', serial_nfc:'00123000012', serial_device:'0022300111', date:new Date().toISOString() };

const MOCK_PERSONAL_INFO = {
  id:2, message:'read card successfully!',
  data:{
    idCode:'001087012345', oldIdCode:'123456789', personName:'NGUYỄN VĂN AN',
    dateOfBirth:'15051990', gender:'Nam', nationality:'Việt Nam', race:'Kinh',
    religion:'Không', originPlace:'Hà Nội',
    residencePlace:'Số 1, Phố Huế, Hai Bà Trưng, Hà Nội',
    personalIdentification:'Sẹo nhỏ dưới mắt trái',
    issueDate:'20032021', expiryDate:'15052030',
    fatherName:'Nguyễn Văn B', motherName:'Trần Thị C', wifeName:'',
    qr:'001087012345|123456789|Nguyễn Văn An|15051990|Nam|Hà Nội|20032021',
  }
};
const MOCK_AVATAR_DATA = {
  id:4, data:{ img_data: null,  // null = sẽ dùng avatar placeholder từ canvas
    dg1:'YTExMTExMTExMTExMTExMTExMTExMTE=', dg2:'aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U=',
    dg13:'ZGcxM0RhdGFFeHRlbmRlZEluZm9ybWF=', dg14:'ZGcxNERhdGFCYXNlNjQ=',
    dg15:'ZGcxNVJTQVB1YmxpY0tleURhdGFCYXM=', sod:'TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=',
  }
};
const MOCK_DS_CERT = {
  id:5, data:{ CA:'1', AA:{ aa_signature:'' },
    PA:{ hash_dg1:'aGFzaF9kZzE=', hash_dg2:'aGFzaF9kZzI=', hash_dg13:'aGFzaF9kZzEz',
         hash_dg14:'aGFzaF9kZzE0', hash_dg15:'aGFzaF9kZzE1',
         cert:'MIIFaDCCBBCgAwIBAgIQ...', sod:'TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=' }
  }
};

// ─── Canvas-based Mock Webcam ─────────────────────────────────────────────
// Thay thế PLACEHOLDER_IMG: vẽ trực tiếp lên <canvas id="mockCamCanvas">
let _mockCamRaf = null;  // requestAnimationFrame ID
let _mockCamActive = false;
let _mockScanY = 0;
let _mockScanDir = 1;

function startMockCanvas() {
  _mockCamActive = true;
  _drawMockFrame();
}
function stopMockCanvas() {
  _mockCamActive = false;
  if (_mockCamRaf) { cancelAnimationFrame(_mockCamRaf); _mockCamRaf = null; }
}
function _drawMockFrame() {
  if (!_mockCamActive) return;
  const canvas = document.getElementById('mockCamCanvas');
  if (!canvas) { _mockCamRaf = requestAnimationFrame(_drawMockFrame); return; }
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');

  // Background gradient (dark studio)
  const bg = ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,W*0.7);
  bg.addColorStop(0,'#1a1a2e'); bg.addColorStop(1,'#0a0a14');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Subtle noise texture
  for(let i=0;i<60;i++){
    ctx.fillStyle=`rgba(255,255,255,${Math.random()*0.02})`;
    ctx.fillRect(Math.random()*W,Math.random()*H,1,1);
  }

  // Face oval guide
  const cx=W/2, cy=H*0.47, rx=W*0.19, ry=H*0.30;
  // Outer dark overlay (vignette effect)
  const vgn = ctx.createRadialGradient(cx,cy,Math.max(rx,ry)*0.6,cx,cy,W*0.8);
  vgn.addColorStop(0,'rgba(0,0,0,0)'); vgn.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=vgn; ctx.fillRect(0,0,W,H);

  // Dashed oval border (face guide)
  ctx.save();
  ctx.setLineDash([8,5]);
  ctx.strokeStyle='rgba(0,168,120,0.8)';
  ctx.lineWidth=2.5;
  ctx.beginPath();
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.stroke();
  // Corner tick marks
  ctx.setLineDash([]);
  ctx.strokeStyle='rgba(0,168,120,1)';
  ctx.lineWidth=3;
  const tL=10;
  [[cx-rx,cy-ry*0.3,0,-tL,tL,0],[cx+rx,cy-ry*0.3,0,-tL,-tL,0],
   [cx-rx,cy+ry*0.3,0,tL,tL,0],[cx+rx,cy+ry*0.3,0,tL,-tL,0]].forEach(([x,y,dx1,dy1,dx2,dy2])=>{
    ctx.beginPath(); ctx.moveTo(x+dx1,y+dy1); ctx.lineTo(x,y); ctx.lineTo(x+dx2,y+dy2); ctx.stroke();
  });
  ctx.restore();

  // Scanning line inside oval
  _mockScanY += _mockScanDir * 1.2;
  if (_mockScanY > ry*0.8)  _mockScanDir = -1;
  if (_mockScanY < -ry*0.8) _mockScanDir =  1;
  const sy = cy + _mockScanY;
  // Clip to oval
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx,cy,rx-2,ry-2,0,0,Math.PI*2); ctx.clip();
  const scanGrad = ctx.createLinearGradient(cx-rx,sy,cx+rx,sy);
  scanGrad.addColorStop(0,'rgba(0,168,120,0)');
  scanGrad.addColorStop(0.4,'rgba(0,168,120,0.7)');
  scanGrad.addColorStop(0.5,'rgba(0,255,180,0.9)');
  scanGrad.addColorStop(0.6,'rgba(0,168,120,0.7)');
  scanGrad.addColorStop(1,'rgba(0,168,120,0)');
  ctx.fillStyle=scanGrad;
  ctx.fillRect(cx-rx,sy-1.5,rx*2,3);
  ctx.restore();

  // Status text
  ctx.font='bold 11px Inter,sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.textAlign='center';
  ctx.fillText('DEMO MODE · LIVE', W/2, H-10);

  // Corner timestamp
  ctx.font='10px monospace';
  ctx.fillStyle='rgba(255,255,255,0.3)';
  ctx.textAlign='left';
  ctx.fillText(new Date().toLocaleTimeString('vi-VN'), 8, H-8);

  _mockCamRaf = requestAnimationFrame(_drawMockFrame);
}

// Capture a frame from mock canvas as base64
function captureMockFrame() {
  const canvas = document.getElementById('mockCamCanvas');
  if (!canvas) return null;
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

function createMockSocket() {
  let _nfcOk=false, _camOk=false, _timers=[];
  const on = {
    nfcConnect:()=>{}, nfcDisconnect:()=>{}, deviceInfo:()=>{},
    personalInfo:()=>{}, avatarImage:()=>{}, dsCert:()=>{},
    cardError:()=>{}, aaResponse:()=>{},
    camConnect:()=>{}, camDisconnect:()=>{}, webcamFrame:()=>{},
  };
  function _startCam(){
    _camOk=true; on.camConnect();
    // Canvas animation started by afterRender when canvas element exists
    startMockCanvas();
  }
  function _stopCam(){ stopMockCanvas(); _camOk=false; on.camDisconnect(); }
  function _readCard(){
    _timers.push(setTimeout(()=>{
      on.personalInfo(MOCK_PERSONAL_INFO);
      _timers.push(setTimeout(()=>{
        on.avatarImage(MOCK_AVATAR_DATA);
        _timers.push(setTimeout(()=>on.dsCert(MOCK_DS_CERT),400));
      },600));
    },900));
  }
  return {
    on,
    connect(){
      _timers.push(setTimeout(()=>{ _nfcOk=true; on.nfcConnect(); on.deviceInfo(MOCK_DEVICE_INFO); _readCard(); },700));
      _timers.push(setTimeout(_startCam, 800));
    },
    disconnect(){ _nfcOk=false; _timers.forEach(clearTimeout); _timers=[]; _stopCam(); on.nfcDisconnect(); },
    pauseCam(){ _stopCam(); },
    resumeCam(){ if(!_camOk) _startCam(); },
    sendAA(challenge){ setTimeout(()=>on.aaResponse({id:7,data:{aa_signature:btoa('MOCK_AA_SIG_'+Date.now()),aa_challege:challenge}}),500); },
    simulateCardRead(){ _readCard(); },
    get isNfcConnected(){ return _nfcOk; },
    get isCamConnected(){ return _camOk; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL SOCKET (SocketIO — thiết bị vật lý)
// ═══════════════════════════════════════════════════════════════════════════════
function createRealSocket() {
  const NFC_URL = 'https://192.168.5.1:8000';
  const CAM_URL = 'https://192.168.5.1:9000';
  let nfcSock=null, camSock=null;
  const _clientId = 'web_' + Date.now();
  const on = {
    nfcConnect:()=>{}, nfcDisconnect:()=>{}, deviceInfo:()=>{},
    personalInfo:()=>{}, avatarImage:()=>{}, dsCert:()=>{},
    cardError:()=>{}, aaResponse:()=>{},
    camConnect:()=>{}, camDisconnect:()=>{}, webcamFrame:()=>{},
  };
  function _connectNfc(){
    // Check if io is available (socket.io CDN loaded)
    if (typeof io === 'undefined') { console.warn('[Socket] socket.io not loaded'); return; }
    nfcSock = io(NFC_URL,{ transports:['websocket'], rejectUnauthorized:false, reconnection:true, reconnectionAttempts:5, reconnectionDelay:2000 });
    nfcSock.on('connect', ()=>on.nfcConnect());
    nfcSock.on('disconnect', ()=>on.nfcDisconnect());
    nfcSock.on('/info', d=>on.deviceInfo(d));
    nfcSock.on('/event', d=>{
      switch(d.id){ case 2:on.personalInfo(d);break; case 4:on.avatarImage(d);break; case 5:on.dsCert(d);break; case 3:on.cardError(d);break; case 7:on.aaResponse(d);break; }
    });
  }
  function _connectCam(){
    if (typeof io === 'undefined') return;
    camSock = io(CAM_URL,{ transports:['websocket'], rejectUnauthorized:false, reconnection:true, reconnectionAttempts:5, reconnectionDelay:2000 });
    camSock.on('connect', ()=>on.camConnect());
    camSock.on('disconnect', ()=>on.camDisconnect());
    camSock.on('/image', d=>on.webcamFrame(d));
  }
  return {
    on,
    connect(){ _connectNfc(); _connectCam(); },
    disconnect(){ nfcSock?.disconnect(); camSock?.disconnect(); },
    pauseCam(){ camSock?.disconnect(); },
    resumeCam(){ if(!camSock){ _connectCam(); } else if(camSock.disconnected){ camSock.connect(); } },
    sendAA(ch){ if(nfcSock?.connected) nfcSock.emit('/get_aa',{clientId:_clientId,challenge:ch}); },
    sendReRead(info){ if(nfcSock?.connected) nfcSock.emit('/input_data',{...info,clientId:_clientId}); },
    get isNfcConnected(){ return nfcSock?.connected??false; },
    get isCamConnected(){ return camSock?.connected??false; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════════════════════════════
const S = {
  // wizard
  step: 0,           // 0=intro,1=info,2=verify,3=processing,4=done,5=error
  useMock: true,     // true=mock socket, false=real socket
  socket: null,

  // device states
  nfcStatus: 'idle', // idle|connecting|connected|scanning|ok|error
  camStatus: 'idle',
  deviceInfo: null,

  // card data (from NFC reader)
  cardData: null,    // personalInfo event data
  cardPhoto: null,   // base64 ảnh từ avatarImage
  rawNfc: null,      // dg1/dg2/dg13/dg15/sod
  dsCert: null,      // DS_CERT data

  // selfie (from webcam)
  selfieCapture: null,  // base64 ảnh chụp
  isCapturing: false,
  webcamLastFrame: null,

  // form
  userData: { fullName:'', idNumber:'', dateOfBirth:'', phone:'', email:'', expiryDate:'' },
  autoFilledFields: new Set(),

  // processing
  verifyChecks: [],
  certInfo: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET SETUP & HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
function setupSocket() {
  if (S.socket) S.socket.disconnect();
  S.socket = S.useMock ? createMockSocket() : createRealSocket();

  S.socket.on.nfcConnect = () => {
    S.nfcStatus = 'connected';
    updateDevicePill();
    renderDeviceBar();       // update bar on any step
    if (S.step === 2) render();
  };
  S.socket.on.nfcDisconnect = () => {
    S.nfcStatus = 'idle';
    updateDevicePill();
    renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.deviceInfo = (info) => {
    S.deviceInfo = info;
    S.nfcStatus = 'scanning';
    updateDevicePill();
    renderDeviceBar();
    if (S.step === 2) render();
  };

  // id:2 — thông tin text từ CCCD chip
  S.socket.on.personalInfo = (evt) => {
    S.cardData = evt.data;
    S.nfcStatus = 'ok';
    _autoFill();
    updateDevicePill();
    renderDeviceBar();
    // Nếu đang ở bước 1: highlight các field đã tự điền
    if (S.step === 1) render();
    if (S.step === 2) render();
  };

  // id:4 — ảnh + raw NFC data
  S.socket.on.avatarImage = (evt) => {
    S.cardPhoto = evt.data.img_data || null;
    S.rawNfc = { dg1:evt.data.dg1, dg2:evt.data.dg2, dg13:evt.data.dg13, dg14:evt.data.dg14, dg15:evt.data.dg15, sod:evt.data.sod };
    if (S.step === 2) render();
  };

  // id:5 — DS_CERT
  S.socket.on.dsCert = (evt) => {
    S.dsCert = evt.data;
    if (S.step === 2) render();
  };

  // id:3 — lỗi đọc thẻ
  S.socket.on.cardError = (evt) => {
    S.nfcStatus = 'error';
    console.warn('[NFC] Card error:', evt.message);
    updateDevicePill();
    renderDeviceBar();
    if (S.step === 2) render();
  };

  // Webcam: nhận frame ảnh liên tục
  S.socket.on.camConnect = () => {
    S.camStatus = 'connected';
    renderDeviceBar();
    if (S.step === 2) {
      render();
      _renderWebcamFrame();
    }
  };
  S.socket.on.camDisconnect = () => {
    S.camStatus = 'idle';
    renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.webcamFrame = (frame) => {
    S.webcamLastFrame = frame.data;
    if (S.step === 2 && !S.selfieCapture) _renderWebcamFrame();
  };
}

function _autoFill() {
  const d = S.cardData;
  if (!d) return;
  // Parse dateOfBirth: supports 'ddmmyyyy', 'dd/mm/yyyy', 'd/m/yyyy'
  // Returns 'yyyy-mm-dd' (for <input type="date">)
  function parseDateForInput(s) {
    if (!s) return '';
    s = s.trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const dd = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
    } else if (s.length === 8) {
      return `${s.slice(4,8)}-${s.slice(2,4)}-${s.slice(0,2)}`;
    }
    return '';
  }
  const map = {
    fullName:    d.personName || '',
    idNumber:    d.idCode || '',
    dateOfBirth: parseDateForInput(d.dateOfBirth),
    expiryDate:  parseDateForInput(d.expiryDate),
  };
  S.autoFilledFields.clear();
  for (const [k,v] of Object.entries(map)) {
    if (v) { S.userData[k] = v; S.autoFilledFields.add(k); }
  }
}

// ─── Webcam frame renderer (real device: img src; mock: canvas) ─────────────
function _renderWebcamFrame() {
  if (S.useMock) {
    // Mock mode: canvas is drawn directly by _drawMockFrame RAF loop
    // Restart canvas if it got reset by a render()
    if (_mockCamActive) _drawMockFrame();
  } else {
    const img = document.getElementById('webcamFrame');
    if (img && S.webcamLastFrame) {
      img.src = 'data:image/jpeg;base64,' + S.webcamLastFrame;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE MODE TOGGLE & STATUS BAR
// ═══════════════════════════════════════════════════════════════════════════════
function toggleDeviceMode() {
  S.useMock = !S.useMock;
  // Reset device states
  S.nfcStatus = 'idle'; S.camStatus = 'idle';
  S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
  S.selfieCapture = null; S.webcamLastFrame = null; S.faceScore = 0;
  stopMockCanvas();
  if (S.socket) { S.socket.disconnect(); S.socket = null; }

  if (!S.useMock) {
    // Chế độ thiết bị thật: kết nối ngay lập tức
    S.nfcStatus = 'connecting';
    setupSocket();
    S.socket.connect();
  }

  updateDevicePill();
  render();   // re-render bất kể bước nào để hiển DeviceBar
}

// ─── Device Status Bar (hiển thị trên mọi bước khi dùng thiết bị thật) ────────
/**
 * renderDeviceBar() – gọi từ socket events để cập nhật bar mà không render toàn trang
 */
function renderDeviceBar() {
  const bar = document.getElementById('deviceStatusBar');
  if (!bar) return;
  bar.innerHTML = _deviceBarHTML();
}

function _deviceBarHTML() {
  if (S.useMock) return ''; // Ẩn trong demo mode

  // NFC status
  const nfcSt = S.nfcStatus;
  const nfcItems = [
    { label:'Kết nối NFC', done: nfcSt !== 'idle' && nfcSt !== 'connecting' && nfcSt !== 'error',
      active: nfcSt === 'connecting', fail: nfcSt === 'error',
      desc: nfcSt === 'connecting' ? 'Đang kết nối 192.168.5.1:8000…' :
            nfcSt === 'connected'  ? 'Thiết bị đã sẵn sàng' :
            nfcSt === 'scanning'   ? 'Chờ đặt thẻ CCCD…' :
            nfcSt === 'ok'         ? `Đọc thẻ thành công (${S.cardData?.personName||''})` :
            nfcSt === 'error'      ? 'Không thể kết nối đầu đọc' : 'Chưa kết nối' },
    { label:'Thiết bị NFC', done: !!S.deviceInfo, active: nfcSt === 'connected',
      desc: S.deviceInfo ? `S/N ${S.deviceInfo.serial_nfc} · v${S.deviceInfo.version}` : 'Chưa nhận thông tin' },
    { label:'Webcam', done: S.camStatus === 'connected', active: S.camStatus !== 'idle' && S.camStatus !== 'connected',
      desc: S.camStatus === 'connected' ? 'Camera đang phát' : 'Đang kết nối 192.168.5.1:9000…' },
  ];

  function dotCls(item) {
    if (item.fail) return 'dbar-dot dbar-fail';
    if (item.done) return 'dbar-dot dbar-ok';
    if (item.active) return 'dbar-dot dbar-blink';
    return 'dbar-dot';
  }

  return `<div class="dbar-inner">
    <div class="dbar-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Trạng thái thiết bị
    </div>
    <div class="dbar-items">
      ${nfcItems.map(item=>`
      <div class="dbar-item">
        <div class="${dotCls(item)}"></div>
        <div>
          <div class="dbar-item-label">${item.label}</div>
          <div class="dbar-item-desc">${item.desc}</div>
        </div>
      </div>`).join('')}
    </div>
    ${nfcSt === 'error' ? `<button class="dbar-retry" onclick="retryDeviceConnect()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Thử kết nối lại
    </button>` : ''}
  </div>`;
}

function retryDeviceConnect() {
  if (S.useMock) return;
  if (S.socket) { S.socket.disconnect(); S.socket = null; }
  S.nfcStatus = 'connecting'; S.camStatus = 'idle';
  setupSocket();
  S.socket.connect();
  updateDevicePill();
  renderDeviceBar();
}

function updateDevicePill() {
  const dot = document.getElementById('deviceDot');
  const label = document.getElementById('devicePillLabel');
  if (!dot || !label) return;
  if (S.useMock) {
    dot.className = 'dot'; label.textContent = 'Demo Mode';
  } else {
    if (S.nfcStatus === 'ok') {
      dot.className = 'dot connected'; label.textContent = 'Thẻ đã đọc';
    } else if (S.nfcStatus === 'scanning' || S.nfcStatus === 'connected') {
      dot.className = 'dot connected'; label.textContent = 'Thiết bị sẵn sàng';
    } else if (S.nfcStatus === 'connecting') {
      dot.className = 'dot connecting'; label.textContent = 'Đang kết nối…';
    } else if (S.nfcStatus === 'error') {
      dot.className = 'dot error'; label.textContent = 'Lỗi kết nối';
    } else {
      dot.className = 'dot'; label.textContent = 'Thiết bị thật';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS = [
  { label:'Thông tin\ncá nhân' },
  { label:'Xác thực\nCCCD + Selfie' },
  { label:'Nhận chứng\nthư số' },
];

function render() {
  renderStepper();
  const card = document.getElementById('wizardCard');
  if (!card) return;
  if      (S.step === 0) card.innerHTML = renderIntro();
  else if (S.step === 1) card.innerHTML = renderInfoForm();
  else if (S.step === 2) card.innerHTML = renderVerify();
  else if (S.step === 3) card.innerHTML = renderProcessing();
  else if (S.step === 4) card.innerHTML = renderDone();
  else                   card.innerHTML = renderError();
  afterRender();
}

function renderStepper() {
  const el = document.getElementById('stepper');
  if (!el) return;
  const cur = Math.max(0, Math.min(2, S.step - 1));
  el.innerHTML = STEPS.map((s,i) => {
    const done = (S.step === 4 && i <= 2) || (i < cur);
    const active = i === cur && S.step >= 1 && S.step <= 3;
    return `
    <div class="stepper-item" aria-current="${active?'step':'false'}">
      <div class="step-circle ${done?'done':active?'active':''}">
        ${done ? `<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : (i+1)}
      </div>
      <div class="step-label ${done?'done':active?'active':''}">${s.label.replace('\n','<br/>')}</div>
    </div>
    ${i < STEPS.length-1 ? `<div class="stepper-line ${done?'done':''}"></div>` : ''}`;
  }).join('');
}

// ── Intro ──────────────────────────────────────────────────────────────────
function renderIntro() {
  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/><path d="M9 12l2.5 2.5L15 9.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div><h2>Bắt đầu đăng ký Chữ ký số</h2><p>Hoàn thành trong 3 bước — khoảng 5 phút</p></div>
  </div>
</div>
<div class="card-body">
  ${S.useMock ? `<div class="alert alert-info" role="note">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    <div>Đang chạy <strong>Demo Mode</strong> — dữ liệu giả lập. Nhấn nút <strong>Demo Mode</strong> trên thanh điều hướng để kết nối thiết bị thật (<code>192.168.5.1:8000</code>).</div>
  </div>` : `<div class="alert alert-success" role="note">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <div>Đang kết nối <strong>thiết bị thật</strong> — đầu đọc CCCD và webcam tại <code>192.168.5.1</code>.</div>
  </div>`}

  <div class="section-sep"><div class="sep-line"></div><span>Chuẩn bị</span><div class="sep-line"></div></div>
  <div class="req-grid">
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div style="font-weight:600;font-size:13px">CCCD gắn chip</div><div style="font-size:11.5px;color:var(--text-3)">Căn cước công dân còn hiệu lực</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.5"/></svg></div><div><div style="font-weight:600;font-size:13px">Webcam / Camera</div><div style="font-size:11.5px;color:var(--text-3)">Chụp ảnh xác thực khuôn mặt</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600;font-size:13px">Đầu đọc NFC</div><div style="font-size:11.5px;color:var(--text-3)">Thiết bị 3TE4/HN212 đã kết nối</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" stroke-width="1.8"/></svg></div><div><div style="font-weight:600;font-size:13px">Số điện thoại VN</div><div style="font-size:11.5px;color:var(--text-3)">Nhận thông báo và OTP</div></div></div>
  </div>

  <div class="section-sep" style="margin-top:1.75rem"><div class="sep-line"></div><span>Quy trình</span><div class="sep-line"></div></div>
  <div class="checklist">
    <div class="check-item"><div class="check-dot" style="background:var(--primary-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 1 — Nhập thông tin cá nhân</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Thông tin tự động điền từ chip CCCD khi đặt thẻ vào đầu đọc</div></div></div>
    <div class="check-item"><div class="check-dot" style="background:var(--primary-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 2 — Đọc chip CCCD &amp; Selfie</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Đặt CCCD vào đầu đọc và chụp ảnh xác thực qua webcam</div></div></div>
    <div class="check-item"><div class="check-dot" style="background:var(--primary-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 3 — Nhận Chứng thư số</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Hệ thống cấp CTS tự động, có hiệu lực ngay lập tức</div></div></div>
  </div>

  <div class="btn-row">
    <button class="btn btn-primary" onclick="goStep(1)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Bắt đầu đăng ký
    </button>
  </div>
</div>`;
}

// ── Info Form ──────────────────────────────────────────────────────────────
function renderInfoForm() {
  const u = S.userData;
  const af = S.autoFilledFields;

  function fieldClass(k) { return af.has(k) ? 'filled' : ''; }
  function afBadge(k) {
    return af.has(k) ? `<span class="autofill-badge"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>Đọc từ CCCD</span>` : '';
  }

  const hasAutofill = af.size > 0;
  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="white" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="white" stroke-width="1.8"/></svg></div>
    <div><h2>Thông tin cá nhân</h2><p>${hasAutofill ? 'Dữ liệu đã được điền tự động từ chip CCCD — vui lòng kiểm tra lại' : 'Nhập chính xác theo thông tin trên CCCD của bạn'}</p></div>
  </div>
</div>
<div class="card-body">
  ${hasAutofill ? `<div class="alert alert-success" role="status">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <div>Đã tự động điền <strong>${af.size} trường</strong> từ chip CCCD. Kiểm tra và bổ sung các thông tin còn thiếu.</div>
  </div>` : `<div class="alert alert-warn">
    <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    Thông tin phải khớp chính xác với CCCD. Đặt thẻ vào đầu đọc ở bước tiếp theo để tự động điền.
  </div>`}

  <form id="infoForm" novalidate>
    <div class="form-row">
      <div class="form-group">
        <label for="fullName">Họ và tên <span class="req">*</span> ${afBadge('fullName')}</label>
        <input type="text" id="fullName" placeholder="VD: NGUYỄN VĂN AN" value="${u.fullName}" class="${fieldClass('fullName')}"
          style="text-transform:uppercase" oninput="S.userData.fullName=this.value.toUpperCase();this.value=S.userData.fullName" required/>
        <div class="error-msg" id="err-fullName">Vui lòng nhập họ và tên</div>
      </div>
      <div class="form-group">
        <label for="idNumber">Số CCCD <span class="req">*</span> ${afBadge('idNumber')}</label>
        <input type="text" id="idNumber" placeholder="12 chữ số" maxlength="12" value="${u.idNumber}" class="${fieldClass('idNumber')}"
          oninput="S.userData.idNumber=this.value.replace(/\\D/g,'')" required/>
        <div class="error-msg" id="err-idNumber">Số CCCD phải đủ 12 chữ số</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="dateOfBirth">Ngày sinh <span class="req">*</span> ${afBadge('dateOfBirth')}</label>
        <input type="date" id="dateOfBirth" value="${u.dateOfBirth}" class="${fieldClass('dateOfBirth')}"
          max="${new Date().toISOString().split('T')[0]}" onchange="S.userData.dateOfBirth=this.value" required/>
        <div class="error-msg" id="err-dateOfBirth">Vui lòng chọn ngày sinh</div>
      </div>
      <div class="form-group">
        <label for="expiryDate">Ngày hết hạn (expiryDate) <span class="req">*</span> ${afBadge('expiryDate')}</label>
        <input type="date" id="expiryDate" value="${u.expiryDate}" class="${fieldClass('expiryDate')}"
          onchange="S.userData.expiryDate=this.value" required/>
        <div class="error-msg" id="err-expiryDate">Vui lòng chọn ngày hết hạn</div>
      </div>
    </div>
    <div class="section-sep"><div class="sep-line"></div><span>Thông tin liên lạc</span><div class="sep-line"></div></div>
    <div class="form-row">
      <div class="form-group">
        <label for="phone">Số điện thoại <span class="req">*</span></label>
        <input type="tel" id="phone" placeholder="VD: 0901234567" value="${u.phone}" maxlength="11"
          oninput="S.userData.phone=this.value.replace(/\\D/g,'')" required/>
        <div class="field-hint">Nhận thông báo và link Public CA</div>
        <div class="error-msg" id="err-phone">Số điện thoại không hợp lệ</div>
      </div>
      <div class="form-group">
        <label for="email">Email <span class="req">*</span></label>
        <input type="email" id="email" placeholder="VD: ten@email.com" value="${u.email}"
          onchange="S.userData.email=this.value" required/>
        <div class="field-hint">Nhận chứng thư số và thông tin tài khoản</div>
        <div class="error-msg" id="err-email">Email không hợp lệ</div>
      </div>
    </div>
  </form>

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="goStep(0)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Quay lại
    </button>
    <button class="btn btn-primary" onclick="submitInfoForm()">
      Tiếp theo <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</div>`;
}

// ── Verify (CCCD reader + Webcam selfie) ──────────────────────────────────
function renderVerify() {
  const nfcOk = !!S.cardData;
  const selfieOk = !!S.selfieCapture;
  const nfcSt = S.nfcStatus;

  // NFC reader panel HTML
  let nfcBody = '';
  if (nfcSt === 'idle' || nfcSt === 'connecting') {
    nfcBody = `<div class="reader-status">
      <div class="reader-anim"><svg viewBox="0 0 24 24" fill="none" style="color:var(--text-3)"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
      <div class="reader-status-text">Đang khởi tạo đầu đọc…</div>
      <div class="reader-status-sub"><span class="spin dark"></span></div>
    </div>`;
  } else if (nfcSt === 'scanning') {
    nfcBody = `<div class="reader-status">
      <div class="reader-anim scanning" style="background:var(--primary-light)">
        <svg viewBox="0 0 24 24" fill="none" style="color:var(--primary)"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </div>
      <div class="reader-status-text">Đặt CCCD vào đầu đọc</div>
      <div class="reader-status-sub">Giữ thẻ phẳng và cố định cho đến khi nghe tiếng bíp</div>
    </div>`;
  } else if (nfcSt === 'ok' && S.cardData) {
    const d = S.cardData;
    // Format display date: ddmmyyyy or yyyy-mm-dd or dd/mm/yyyy -> dd/mm/yyyy
    function formatDisplayDate(s) {
      if (!s) return '—';
      s = s.trim();
      if (s.includes('/')) return s; // already dd/mm/yyyy
      if (s.includes('-')) {
        const pts = s.split('-');
        if (pts.length === 3 && pts[0].length === 4) return `${pts[2]}/${pts[1]}/${pts[0]}`;
      }
      if (s.length === 8) return `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4,8)}`;
      return s;
    }

    nfcBody = `
    <div class="alert alert-success" style="margin-bottom:.75rem">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div>Đọc chip thành công! Dữ liệu đã được xác thực với CSDL Bộ Công an.
        ${S.rawNfc ? ' · Dữ liệu NFC raw (DG1/DG2/DG15/SOD) đã thu thập.' : ''}
        ${S.dsCert ? ' · DS_CERT đã xác thực.' : ''}
      </div>
    </div>
    <div class="cccd-preview">
      <div class="cccd-photo">
        ${S.cardPhoto
          ? `<img src="data:image/jpeg;base64,${S.cardPhoto}" alt="Ảnh CCCD"/>`
          : `<svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="white" stroke-width="1.5"/><circle cx="12" cy="7" r="4" stroke="white" stroke-width="1.5"/></svg>`
        }
      </div>
      <div class="cccd-info">
        <div class="cccd-id-number">${d.idCode||'—'}</div>
        <div class="cccd-info-row"><div class="cccd-info-label">Họ tên</div><div class="cccd-info-value">${d.personName||'—'}</div></div>
        <div class="cccd-info-row"><div class="cccd-info-label">Ngày sinh</div><div class="cccd-info-value">${formatDisplayDate(d.dateOfBirth)}</div></div>
        <div class="cccd-info-row"><div class="cccd-info-label">Giới tính / Quốc tịch</div><div class="cccd-info-value">${d.gender||'—'} · ${d.nationality||'—'}</div></div>
        <div class="cccd-info-row"><div class="cccd-info-label">Hết hạn</div><div class="cccd-info-value">${formatDisplayDate(d.expiryDate)}</div></div>
      </div>
    </div>
    <div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px" onclick="reReadCard()">
        <svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Đọc lại thẻ
      </button>
    </div>`;
  } else if (nfcSt === 'error') {
    nfcBody = `<div class="reader-status">
      <div class="reader-anim err"><svg viewBox="0 0 24 24" fill="none" style="color:var(--danger)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
      <div class="reader-status-text" style="color:var(--danger)">Đọc thẻ thất bại</div>
      <div class="reader-status-sub">Kiểm tra thẻ CCCD và thử lại</div>
      <button class="btn btn-secondary" style="margin-top:8px;font-size:12px" onclick="reReadCard()">Thử lại</button>
    </div>`;
  }

  // Webcam panel
  const camReady = S.useMock ? (S.camStatus === 'connected') : (S.camStatus === 'connected' && !!S.webcamLastFrame);
  let camBody = '';
  if (!selfieOk) {
    if (camReady) {
      camBody = `
      <div class="webcam-container" id="webcamBox">
        ${ S.useMock
          ? `<canvas id="mockCamCanvas" width="480" height="360" style="width:100%;height:100%;display:block"></canvas>`
          : `<img id="webcamFrame" src="" alt="Webcam live" style="display:block"/>`
        }
        <div class="face-guide" aria-hidden="true"></div>
        <div class="face-scan-line" aria-hidden="true"></div>
      </div>
      <div style="margin-top:.75rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="captureSelfie()" id="btnCapture" style="flex:1;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="white" stroke-width="2"/><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" stroke-width="1.8"/></svg>
          Chụp ảnh Selfie
        </button>
      </div>`;
    } else {
      camBody = `
      <div class="webcam-container" style="min-height:200px;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;color:rgba(255,255,255,.6)">
          <div class="spin" style="width:28px;height:28px;border-width:3px;margin:0 auto 10px"></div>
          <div style="font-size:13px">Đang khởi tạo camera…</div>
        </div>
      </div>`;
    }
  } else {
    const faceScore = S.faceScore || Math.floor(Math.random()*10+88); // 88-97%
    S.faceScore = faceScore;
    camBody = `
    <div class="webcam-container webcam-captured">
      <img src="data:image/jpeg;base64,${S.selfieCapture}" alt="Ảnh selfie đã chụp" style="display:block"/>
      <div class="capture-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
        Đã chụp
      </div>
    </div>
    <div class="face-score-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:var(--success)">
        <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--success);margin-bottom:4px">Chất lượng ảnh: ${faceScore}%</div>
        <div class="score-track"><div class="score-fill" style="width:${faceScore}%"></div></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--success)">${faceScore >= 85 ? '✓ Đạt' : '⚠ Thấp'}</div>
    </div>
    <div style="margin-top:.5rem">
      <button class="btn btn-secondary" onclick="resetSelfie()" style="font-size:12px;padding:6px 12px">
        <svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Chụp lại
      </button>
    </div>`;
  }

  const canSubmit = nfcOk && selfieOk;

  // NFC badge class
  function nfcBadgeCls() {
    if (nfcOk) return 'device-status-badge dsb-ok';
    if (nfcSt === 'scanning' || nfcSt === 'connected') return 'device-status-badge dsb-scan';
    if (nfcSt === 'error') return 'device-status-badge dsb-error';
    return 'device-status-badge dsb-idle';
  }
  function nfcBadgeLabel() {
    if (nfcOk) return '✓ Đọc xong';
    if (nfcSt === 'scanning') return '⬤ Chờ thẻ…';
    if (nfcSt === 'connected') return '⬤ Sẵn sàng';
    if (nfcSt === 'error') return '✗ Lỗi đọc';
    return '◌ Đang kết nối';
  }
  function camBadgeCls()  { return selfieOk ? 'device-status-badge dsb-ok' : camReady ? 'device-status-badge dsb-scan' : 'device-status-badge dsb-idle'; }
  function camBadgeLabel(){ return selfieOk ? '✓ Đã chụp' : camReady ? '⬤ Live' : '◌ Khởi động'; }

  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/></svg></div>
    <div><h2>Xác thực danh tính</h2><p>Đặt CCCD vào đầu đọc và chụp ảnh selfie qua webcam</p></div>
  </div>
</div>
<div class="card-body">

  <div class="mode-toggle">
    <button class="mode-btn ${!S.useMock?'active':''}" onclick="${S.useMock?'toggleDeviceMode()':''}" ${!S.useMock?'disabled':''}>🔌 Thiết bị thật</button>
    <button class="mode-btn ${S.useMock?'active':''}" onclick="${!S.useMock?'toggleDeviceMode()':''}" ${S.useMock?'disabled':''}>🎭 Demo Mode</button>
  </div>

  <!-- NFC Reader panel -->
  <div class="device-panel">
    <div class="device-panel-header">
      <div class="device-panel-title">
        <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Đầu đọc CCCD (NFC)
      </div>
      <span class="${nfcBadgeCls()}">${nfcBadgeLabel()}</span>
    </div>
    <div class="device-panel-body">${nfcBody}</div>
  </div>

  <!-- Selfie / Webcam panel -->
  <div class="device-panel">
    <div class="device-panel-header">
      <div class="device-panel-title">
        <svg viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.5"/></svg>
        Webcam — Xác thực khuôn mặt
      </div>
      <span class="${camBadgeCls()}">${camBadgeLabel()}</span>
    </div>
    <div class="device-panel-body">
      <div class="selfie-area">
        <div>${camBody}</div>
        <div class="selfie-guide-box">
          <h4>Hướng dẫn chụp ảnh</h4>
          <ul>
            <li>Nhìn thẳng vào camera, không nghiêng đầu</li>
            <li>Chụp ở nơi đủ ánh sáng, không ngược sáng</li>
            <li>Không đeo kính râm, không đội mũ</li>
            <li>Khuôn mặt phải rõ và chiếm phần lớn khung hình</li>
            <li>Đặt khuôn mặt vào vòng tròn hướng dẫn</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  ${canSubmit ? `<div class="alert alert-success" role="status">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <div><strong>Xác thực đầy đủ!</strong> Dữ liệu chip CCCD và ảnh sinh trắc học đã sẵn sàng. Nhấn <strong>Hoàn tất</strong> để tiến hành cấp Chứng thư số.</div>
  </div>` : `<div class="alert alert-info" role="note">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    <div>Cần hoàn thành <strong>cả 2 bước</strong> — Đọc chip CCCD và chụp Selfie — trước khi tiếp tục.</div>
  </div>`}

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="goStep(1)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Quay lại
    </button>
    <button class="btn btn-primary" onclick="submitVerify()" ${canSubmit?'':'disabled'}>
      Hoàn tất xác thực
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</div>`;
}

// ── Processing ─────────────────────────────────────────────────────────────
function renderProcessing() {
  const checkDef = [
    'Xác thực chip CCCD với Cơ sở dữ liệu quốc gia',
    'Đối chiếu sinh trắc học khuôn mặt (Face matching)',
    'Kiểm tra thông tin đăng ký cư trú',
    'Tạo cặp khóa bất đối xứng RSA-2048 (HSM)',
    'Cấp Chứng thư số trên hệ thống Public CA',
  ];
  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon" style="background:var(--warn)">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
    <div><h2>Đang xử lý hồ sơ</h2><p>Hệ thống đang xác thực và cấp chứng thư số — vui lòng không tắt trang</p></div>
  </div>
</div>
<div class="card-body">
  <div class="alert alert-warn" role="status" aria-live="polite">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    Vui lòng <strong>không tắt trang</strong> hoặc thoát khỏi ứng dụng trong quá trình xử lý.
  </div>
  <div class="checklist" id="processingList" aria-live="polite">
    ${checkDef.map((label,i)=>{
      const c = S.verifyChecks[i] || 'pending';
      const cls = c==='ok'?'ok':c==='active'?'active':c==='fail'?'fail':'pending';
      const dotCls = c==='ok'?'ok-dot':c==='fail'?'fail-dot':c==='active'?'spin-dot':'';
      const icon = c==='ok'
        ? `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : c==='fail'
        ? `<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`
        : c==='active'
        ? `<span class="spin" style="width:12px;height:12px;border-width:2px"></span>`
        : `<span style="width:7px;height:7px;border-radius:50%;background:var(--border-strong);display:block"></span>`;
      return `<div class="check-item ${cls}"><div class="check-dot ${dotCls}">${icon}</div><span>${label}</span></div>`;
    }).join('')}
  </div>
</div>`;
}

// ── Done ───────────────────────────────────────────────────────────────────
function renderDone() {
  const c = S.certInfo;
  return `
<div class="result-card">
  <div class="result-header">
    <div class="result-seal">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/><path d="M9 12l2.5 2.5L15 9.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2>Đăng ký thành công!</h2>
    <p>Chứng thư số cá nhân đã được cấp và có hiệu lực ngay.</p>
  </div>
  <div class="result-body">
    <div class="alert alert-success" role="status">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div>Link kích hoạt và thông tin CTS đã gửi đến <strong>${S.userData.email}</strong> và <strong>${S.userData.phone}</strong>.</div>
    </div>
    <div class="section-sep" style="margin-top:.5rem"><div class="sep-line"></div><span>Thông tin Chứng thư số</span><div class="sep-line"></div></div>
    <table class="cert-table">
      <tr><th>Chủ thể</th><td><strong>${c.fullName}</strong></td></tr>
      <tr><th>Số serial</th><td style="font-family:monospace;font-size:13px;letter-spacing:.02em">${c.serial}</td></tr>
      <tr><th>Nhà cấp phát</th><td>${c.issuer}</td></tr>
      <tr><th>Ngày cấp</th><td>${c.issuedAt}</td></tr>
      <tr><th>Hết hạn</th><td>${c.expiresAt}</td></tr>
      <tr><th>Mức bảo mật</th><td>Level 2 — Chứng thư công cộng</td></tr>
      <tr><th>Thuật toán</th><td>RSA-2048 · SHA256withRSA</td></tr>
      <tr><th>Trạng thái</th><td><span class="badge-valid"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Đang hoạt động</span></td></tr>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <button class="btn btn-outline-primary" onclick="downloadCert()" style="justify-content:center">
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Tải Chứng thư số
      </button>
      <button class="btn btn-success" onclick="goStep(0)" style="justify-content:center">
        <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        Đăng ký mới
      </button>
    </div>
  </div>
</div>`;
}

// ── Error ──────────────────────────────────────────────────────────────────
function renderError() {
  return `
<div class="card-header" style="background:linear-gradient(135deg,var(--danger-light),#fff5f5)">
  <div class="card-header-inner">
    <div class="card-icon" style="background:var(--danger)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="white" stroke-width="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
    <div><h2>Không thể hoàn tất đăng ký</h2><p>Đã xảy ra lỗi trong quá trình xác thực</p></div>
  </div>
</div>
<div class="card-body">
  <div class="alert alert-danger" role="alert">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    <div><strong>Xác thực sinh trắc học không khớp.</strong> Khuôn mặt trong ảnh selfie không khớp với dữ liệu chip CCCD. Vui lòng thử lại hoặc liên hệ hỗ trợ <strong>1800-9999</strong>.</div>
  </div>
  <div style="background:var(--surface-alt);border-radius:var(--r-md);padding:1.25rem;margin-bottom:1.25rem">
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:.5rem">Các bước khắc phục:</div>
    <ul style="padding-left:1.25rem;display:flex;flex-direction:column;gap:8px">
      <li style="font-size:13px;color:var(--text-2)">Đảm bảo khuôn mặt được chiếu sáng đều</li>
      <li style="font-size:13px;color:var(--text-2)">Nhìn thẳng vào camera, không nghiêng đầu</li>
      <li style="font-size:13px;color:var(--text-2)">Tháo kính mắt nếu đang đeo</li>
    </ul>
  </div>
  <div class="btn-row" style="justify-content:center;gap:1rem">
    <button class="btn btn-secondary" onclick="retryVerify()">
      <svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Thử lại
    </button>
    <button class="btn btn-primary" onclick="goStep(0)">Đăng ký lại từ đầu</button>
  </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function goStep(n) {
  const prev = S.step;
  S.step = n;
  if (n === 0) {
    // Reset hoàn toàn
    S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
    S.selfieCapture = null; S.webcamLastFrame = null; S.faceScore = 0;
    S.nfcStatus = 'idle'; S.camStatus = 'idle';
    S.verifyChecks = []; S.certInfo = null;
    S.autoFilledFields = new Set();
    S.userData = { fullName:'', idNumber:'', dateOfBirth:'', phone:'', email:'', expiryDate:'' };
    stopMockCanvas();
    if (S.socket) { S.socket.disconnect(); S.socket = null; }
  }
  if (n === 2 && prev !== 2) {
    if (S.socket && !S.useMock && S.nfcStatus !== 'idle' && S.nfcStatus !== 'error') {
      // Real mode: socket đã kết nối từ trước (toggleDeviceMode) → chỉ resume webcam
      S.socket.resumeCam();
    } else {
      // Mock mode hoặc chưa có socket → khởi tạo mới
      if (!S.socket) {
        setupSocket();
        S.socket.connect();
      }
      if (S.useMock) S.nfcStatus = 'connecting';
    }
  }
  if (n !== 2 && prev === 2 && S.socket) {
    S.socket.pauseCam();
  }
  window.scrollTo({ top:0, behavior:'smooth' });
  render();
  updateDevicePill();
}

function validateInfoForm() {
  let ok = true;
  const rules = [
    { id:'fullName',    check:v=>v.trim().length>=3,          err:'err-fullName' },
    { id:'idNumber',    check:v=>/^\d{12}$/.test(v),          err:'err-idNumber' },
    { id:'dateOfBirth', check:v=>!!v,                          err:'err-dateOfBirth' },
    { id:'expiryDate',  check:v=>!!v,                          err:'err-expiryDate' },
    { id:'phone',       check:v=>/^0\d{9,10}$/.test(v),       err:'err-phone' },
    { id:'email',       check:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), err:'err-email' },
  ];
  rules.forEach(({id,check,err})=>{
    const inp = document.getElementById(id);
    const errEl = document.getElementById(err);
    if (!inp||!errEl) return;
    const valid = check(inp.value);
    inp.classList.toggle('error',!valid);
    errEl.classList.toggle('show',!valid);
    if (!valid) ok = false;
  });
  return ok;
}

function submitInfoForm() {
  // Sync values from DOM
  const ids = ['fullName','idNumber','dateOfBirth','expiryDate','phone','email'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) S.userData[id]=el.value; });
  if (S.userData.fullName) S.userData.fullName = S.userData.fullName.toUpperCase();
  if (validateInfoForm()) goStep(2);
}

function captureSelfie() {
  let frameData;
  if (S.useMock) {
    // Mock mode: capture current canvas frame
    frameData = captureMockFrame();
  } else {
    frameData = S.webcamLastFrame;
  }
  if (!frameData) return;
  S.selfieCapture = frameData;
  S.faceScore = 0; // will be set fresh in render
  // Stop webcam updates after capture
  if (S.socket) S.socket.pauseCam();
  if (S.useMock) stopMockCanvas();
  render();
}

function resetSelfie() {
  S.selfieCapture = null;
  S.faceScore = 0;
  if (S.socket) S.socket.resumeCam();
  if (S.useMock) startMockCanvas();
  render();
}

function reReadCard() {
  if (!S.socket) return;
  const d = S.cardData;
  if (d && !S.useMock) {
    // Real device: send /input_data to re-read
    let expStr = '';
    if (d.expiryDate) expStr = d.expiryDate;
    else if (d.dateOfBirth) {
      if (d.dateOfBirth.includes('/')) {
        const pts = d.dateOfBirth.split('/');
        expStr = `${pts[0].padStart(2,'0')}${pts[1].padStart(2,'0')}2099`;
      } else if (d.dateOfBirth.length === 8) {
        expStr = d.dateOfBirth.slice(0,4) + '2099';
      }
    }
    let dobStr = d.dateOfBirth || '';
    if (dobStr.includes('/')) {
       const pts = dobStr.split('/');
       dobStr = `${pts[0].padStart(2,'0')}${pts[1].padStart(2,'0')}${pts[2]}`;
    }
    
    S.socket.sendReRead({ idCode:d.idCode, dateOfBirth:dobStr, expiryDate:expStr });
  } else if (S.useMock) {
    S.socket.simulateCardRead();
  }
  S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
  S.nfcStatus = 'scanning';
  render();
}

async function submitVerify() {
  goStep(3);
  S.verifyChecks = Array(5).fill('pending');
  render();

  const timings = [900, 1300, 1000, 1700, 1100];
  for (let i=0; i<timings.length; i++) {
    S.verifyChecks[i] = 'active';
    render();
    await delay(timings[i]);

    // Simulate face mismatch failure (5% chance in demo)
    if (i===1 && S.useMock && Math.random()<0.05) {
      S.verifyChecks[i] = 'fail'; render();
      await delay(700); goStep(5); return;
    }
    S.verifyChecks[i] = 'ok';
    render();
    await delay(150);
  }
  await delay(500);
  const now = new Date();
  const exp = new Date(now); exp.setFullYear(exp.getFullYear()+1);
  S.certInfo = {
    fullName: S.userData.fullName,
    serial: 'VNECC-' + Math.random().toString(36).substr(2,8).toUpperCase(),
    issuer: 'EIDCA Public CA — Trung tâm Chứng thư số Quốc gia',
    issuedAt: now.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}),
    expiresAt: exp.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}),
  };
  goStep(4);
}

function retryVerify() {
  S.selfieCapture = null;
  S.verifyChecks = [];
  S.step = 2;
  if (S.socket) S.socket.resumeCam();
  render();
}

function downloadCert() {
  if (!S.certInfo) return;
  const lines = [
    '-----BEGIN CERTIFICATE INFO-----',
    `Subject: CN=${S.certInfo.fullName}, C=VN`,
    `Serial: ${S.certInfo.serial}`,
    `Issuer: ${S.certInfo.issuer}`,
    `Not Before: ${S.certInfo.issuedAt}`,
    `Not After: ${S.certInfo.expiresAt}`,
    `Algorithm: SHA256withRSA · RSA-2048`,
    `Security Level: LEVEL_2`,
    '-----END CERTIFICATE INFO-----',
    '',
    '[Demo file — không có giá trị pháp lý]',
    `Generated: ${new Date().toISOString()}`,
  ];
  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EIDCA_CTS_${S.certInfo.fullName.replace(/\s/g,'_')}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
}

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

function afterRender() {
  // ARIA update
  const stpr = document.getElementById('stepper');
  if (stpr) stpr.setAttribute('aria-valuenow', Math.max(1,Math.min(3,S.step)));
  updateDevicePill();
  renderDeviceBar(); // cập nhật device bar mọi lần render

  if (S.step === 2) {
    if (S.useMock && S.camStatus === 'connected' && !S.selfieCapture) {
      requestAnimationFrame(() => {
        if (document.getElementById('mockCamCanvas')) {
          _mockCamActive = true;
          _drawMockFrame();
        }
      });
    } else if (!S.useMock && S.webcamLastFrame && !S.selfieCapture) {
      requestAnimationFrame(_renderWebcamFrame);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════════
render();

// ── CMS Log Integration ──────────────────────────────────────────────────────
// Tự động ghi log đăng ký CTS vào EIDCA CMS khi hoàn thành bước Done
(function() {
  const _origRender = render;
  let _logged = false;
  window.render = function() {
    _origRender();
    if (S.step === 4 && !_logged && S.certInfo) {
      _logged = true;
      if (typeof window.eidcaLogEvent === 'function') {
        window.eidcaLogEvent('register_cert', {
          personName: S.cardData?.personName || '',
          idCode:     S.cardData?.idCode     || '',
          email:      S.userData?.email      || '',
          phone:      S.userData?.phone      || '',
        });
      }
    }
  };
})();
</script>
</body>
</html>

