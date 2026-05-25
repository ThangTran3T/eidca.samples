<?php
/**
 * EIDCA CMS – Wrapper: Demo Ký số Tài liệu
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
<title>Ký số Tài liệu – EIDCA</title>
<meta name="description" content="Ký số tài liệu điện tử cá nhân EIDCA an toàn, pháp lý. Sử dụng CCCD gắn chip và chứng thư số để ký tài liệu trong vài giây."/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<script>window._sioLoaded=false;</script>
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js" crossorigin="anonymous" onload="window._sioLoaded=true" onerror="console.warn('[EIDCA] socket.io CDN unavailable')"></script>
<!-- CMS Integration: load eidcaLogEvent helper -->
<script src="<?= $base ?>/assets/cms.js" onerror="console.info('[EIDCA] CMS js not loaded – log disabled')"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
:root {
  --primary:#0057B8; --primary-dark:#003f8a; --primary-light:#e8f0fb; --primary-mid:#c2d8f7;
  --accent:#00A878; --accent-light:#e0f7f2;
  --violet:#7C3AED; --violet-light:#ede9fe; --violet-mid:#c4b5fd;
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
.nav-logo { width:34px; height:34px; background:var(--violet); border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; }
.nav-logo svg { width:18px; height:18px; }
.nav-title { font-size:15px; font-weight:700; color:var(--violet); letter-spacing:-.3px; }
.nav-title span { color:var(--text-3); font-weight:400; margin-left:4px; font-size:13px; }
.nav-right { display:flex; align-items:center; gap:12px; }
.nav-secure { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--accent); font-weight:500; }
.nav-secure svg { width:14px; height:14px; }
.device-pill { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; padding:5px 10px; border-radius:20px; border:1.5px solid var(--border); cursor:pointer; background:var(--surface); transition:all .2s; }
.device-pill:hover { border-color:var(--violet-mid); background:var(--violet-light); }
.device-pill .dot { width:8px; height:8px; border-radius:50%; background:var(--border-strong); flex-shrink:0; transition:background .3s; }
.device-pill .dot.connecting { background:var(--warn); animation:blink .8s step-end infinite; }
.device-pill .dot.connected { background:var(--accent); }
.device-pill .dot.error { background:var(--danger); }
@keyframes blink { 50% { opacity:0; } }

/* Layout */
.page-wrap { max-width:820px; margin:0 auto; padding:2.5rem 1.5rem 4rem; }

/* Hero */
.page-hero { text-align:center; margin-bottom:2.5rem; }
.badge-top { display:inline-flex; align-items:center; gap:6px; background:var(--violet-light); color:var(--violet); font-size:12px; font-weight:600; padding:5px 12px; border-radius:20px; margin-bottom:1rem; letter-spacing:.02em; }
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
.stepper-line.done { background:var(--violet); }
.step-circle { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; border:2px solid var(--border); background:var(--surface); color:var(--text-3); transition:all .3s ease; position:relative; z-index:1; }
.step-circle.active { border-color:var(--violet); background:var(--violet); color:var(--text-inv); box-shadow:0 0 0 4px var(--violet-light); }
.step-circle.done { border-color:var(--violet); background:var(--violet); color:var(--text-inv); }
.step-circle.done svg { width:16px; height:16px; }
.step-label { font-size:11px; font-weight:500; color:var(--text-3); text-align:center; line-height:1.3; }
.step-label.active { color:var(--violet); font-weight:600; }
.step-label.done { color:var(--violet); }

/* Card */
.main-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-xl); box-shadow:var(--shadow-md); overflow:hidden; }
.card-header { padding:1.75rem 2rem 1.25rem; border-bottom:1px solid var(--border); background:linear-gradient(135deg,var(--violet-light) 0%,#f8f5ff 100%); }
.card-header-inner { display:flex; align-items:center; gap:14px; }
.card-icon { width:48px; height:48px; border-radius:var(--r-md); background:var(--violet); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(124,58,237,.25); }
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
input[type="text"],input[type="tel"],input[type="email"],input[type="date"],input[type="password"],select,textarea {
  width:100%; padding:10px 13px; font-size:14px; font-family:'Inter',sans-serif;
  border:1.5px solid var(--border); border-radius:var(--r-md); background:var(--surface);
  color:var(--text); transition:border-color .15s,box-shadow .15s; appearance:none; -webkit-appearance:none;
}
textarea { resize:vertical; min-height:80px; }
input:focus,select:focus,textarea:focus { outline:none; border-color:var(--violet); box-shadow:0 0 0 3px rgba(124,58,237,.12); }
input.error,select.error,textarea.error { border-color:var(--danger); }
input.filled { border-color:var(--accent); background:#f6fef9; }
.error-msg { font-size:11.5px; color:var(--danger); display:none; }
.error-msg.show { display:block; }
.autofill-badge { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; color:var(--accent); background:var(--accent-light); padding:2px 7px; border-radius:20px; }

/* File drop zone */
.drop-zone {
  border:2px dashed var(--border-strong); border-radius:var(--r-lg);
  background:var(--surface-alt); transition:all .2s;
  cursor:pointer; text-align:center; padding:2.5rem 1.5rem;
  position:relative;
}
.drop-zone:hover, .drop-zone.dragover {
  border-color:var(--violet); background:var(--violet-light);
}
.drop-zone input[type="file"] {
  position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;
}
.drop-icon { width:56px; height:56px; border-radius:var(--r-lg); background:var(--violet-light); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; }
.drop-icon svg { width:28px; height:28px; color:var(--violet); }
.drop-title { font-size:15px; font-weight:600; color:var(--text); margin-bottom:4px; }
.drop-sub { font-size:12.5px; color:var(--text-3); }
.drop-types { display:inline-flex; gap:6px; margin-top:.75rem; flex-wrap:wrap; justify-content:center; }
.drop-type-badge { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:4px; background:var(--surface); border:1px solid var(--border); color:var(--text-3); }

/* File preview card */
.file-preview {
  display:flex; align-items:center; gap:12px;
  background:linear-gradient(135deg,var(--violet-light),#f8f5ff);
  border:1.5px solid var(--violet-mid); border-radius:var(--r-md);
  padding:14px 16px;
}
.file-icon-box { width:44px; height:44px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.file-icon-box.pdf { background:#fde8e8; }
.file-icon-box.docx { background:#dbeafe; }
.file-icon-box.other { background:var(--surface-alt); }
.file-icon-box svg { width:22px; height:22px; }
.file-info { flex:1; min-width:0; }
.file-name { font-size:13.5px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.file-meta { font-size:11.5px; color:var(--text-3); margin-top:2px; }
.file-remove { width:28px; height:28px; border-radius:50%; border:none; background:rgba(0,0,0,.06); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .15s; }
.file-remove:hover { background:var(--danger-light); }
.file-remove svg { width:14px; height:14px; color:var(--text-3); }

/* PIN Input */
.pin-container { display:flex; gap:10px; justify-content:center; margin:1rem 0; }
.pin-digit {
  width:50px; height:60px; border:2px solid var(--border); border-radius:var(--r-md);
  font-size:22px; font-weight:700; text-align:center; color:var(--text);
  font-family:'Inter',sans-serif; background:var(--surface); transition:all .15s;
  -webkit-text-security:disc; text-security:disc;
}
.pin-digit:focus { border-color:var(--violet); box-shadow:0 0 0 3px rgba(124,58,237,.15); outline:none; }
.pin-digit.filled { border-color:var(--violet); background:var(--violet-light); }
.pin-digit.error { border-color:var(--danger); }

/* CCCD preview card (same as register) */
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
.cccd-chip-badge { position:absolute; bottom:10px; right:14px; font-size:9.5px; font-weight:700; color:rgba(255,255,255,.6); letter-spacing:.08em; text-transform:uppercase; }

/* Signed document result */
.signed-doc-card {
  border:2px solid var(--violet); border-radius:var(--r-xl); overflow:hidden;
  background:var(--surface); animation:fadeSlide .4s ease;
}
.signed-doc-header {
  background:linear-gradient(135deg,var(--violet) 0%,#5b21b6 100%);
  padding:2rem; text-align:center; color:#fff;
}
.signed-seal { width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; border:3px solid rgba(255,255,255,.5); }
.signed-seal svg { width:36px; height:36px; }

/* Section sep */
.section-sep { display:flex; align-items:center; gap:.75rem; margin:1.5rem 0; }
.section-sep span { font-size:12px; font-weight:600; color:var(--text-3); white-space:nowrap; letter-spacing:.05em; text-transform:uppercase; }
.sep-line { flex:1; height:1px; background:var(--border); }

/* Device panel */
.device-panel { border:1.5px solid var(--border); border-radius:var(--r-lg); overflow:hidden; margin-bottom:1.25rem; background:var(--surface); }
.device-panel-header { padding:12px 16px; background:var(--surface-alt); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
.device-panel-title { font-size:13px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:8px; }
.device-panel-title svg { width:16px; height:16px; color:var(--violet); }
.device-panel-body { padding:1.25rem 1.5rem; }
.device-status-badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; }
.dsb-idle  { background:var(--surface-alt); color:var(--text-3); }
.dsb-scan  { background:var(--violet-light); color:var(--violet); }
.dsb-ok    { background:var(--success-light); color:var(--success); }
.dsb-error { background:var(--danger-light); color:var(--danger); }

/* Reader status */
.reader-status { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.5rem; gap:12px; min-height:140px; text-align:center; }
.reader-anim { width:80px; height:80px; border-radius:var(--r-lg); background:var(--violet-light); display:flex; align-items:center; justify-content:center; position:relative; }
.reader-anim svg { width:36px; height:36px; }
.reader-anim.scanning::before { content:''; position:absolute; inset:-4px; border-radius:calc(var(--r-lg)+4px); border:2.5px solid var(--violet); animation:scanPulse 1.5s ease-out infinite; }
.reader-anim.scanning::after  { content:''; position:absolute; inset:-4px; border-radius:calc(var(--r-lg)+4px); border:2.5px solid var(--violet); animation:scanPulse 1.5s ease-out .6s infinite; }
@keyframes scanPulse { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(1.35);opacity:0} }
.reader-anim.ok  { background:var(--accent-light); }
.reader-anim.err { background:var(--danger-light); }
.reader-status-text { font-size:14px; font-weight:600; color:var(--text); }
.reader-status-sub  { font-size:12.5px; color:var(--text-2); line-height:1.5; }

/* Alerts */
.alert { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:var(--r-md); font-size:13px; line-height:1.5; margin-bottom:1.25rem; animation:fadeSlide .3s ease; }
.alert svg { width:16px; height:16px; flex-shrink:0; margin-top:1px; }
.alert-info { background:var(--violet-light); color:#4c1d95; border:1px solid var(--violet-mid); }
.alert-success { background:var(--success-light); color:var(--success); border:1px solid #a7d7bb; }
.alert-warn { background:var(--warn-light); color:var(--warn); border:1px solid #fcd59e; }
.alert-danger { background:var(--danger-light); color:var(--danger); border:1px solid #fbb9b9; }
@keyframes fadeSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

/* Checklist */
.checklist { display:flex; flex-direction:column; gap:10px; margin-bottom:1.5rem; }
.check-item { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:var(--r-md); background:var(--surface-alt); border:1px solid var(--border); font-size:13.5px; font-weight:500; color:var(--text); transition:all .2s; }
.check-item.pending { opacity:.55; }
.check-item.active { border-color:var(--violet); background:var(--violet-light); }
.check-item.ok { border-color:var(--accent); background:var(--accent-light); }
.check-item.fail { border-color:var(--danger); background:var(--danger-light); }
.check-dot { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:var(--border); }
.check-dot.ok-dot { background:var(--accent); }
.check-dot.fail-dot { background:var(--danger); }
.check-dot.spin-dot { background:var(--violet); }
.check-dot svg { width:12px; height:12px; }

/* Cert / Sig table */
.cert-table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
.cert-table tr { border-bottom:1px solid var(--border); }
.cert-table tr:last-child { border-bottom:none; }
.cert-table th { text-align:left; padding:10px 0; font-size:12px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; width:40%; }
.cert-table td { padding:10px 0; font-size:13.5px; font-weight:500; color:var(--text); }
.badge-valid { display:inline-flex; align-items:center; gap:5px; background:var(--success-light); color:var(--success); font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; }
.badge-violet { display:inline-flex; align-items:center; gap:5px; background:var(--violet-light); color:var(--violet); font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; }

/* Buttons */
.btn-row { display:flex; gap:10px; margin-top:2rem; align-items:center; justify-content:flex-end; }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:11px 22px; font-size:14px; font-weight:600; font-family:'Inter',sans-serif; border-radius:var(--r-md); cursor:pointer; border:1.5px solid transparent; transition:all .15s ease; letter-spacing:-.1px; }
.btn:active { transform:scale(.97); }
.btn-primary { background:var(--violet); color:#fff; border-color:var(--violet); box-shadow:0 2px 8px rgba(124,58,237,.3); }
.btn-primary:hover { background:#6d28d9; }
.btn-primary:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
.btn-secondary { background:var(--surface); color:var(--text-2); border-color:var(--border); }
.btn-secondary:hover { background:var(--surface-alt); border-color:var(--border-strong); }
.btn-outline-primary { background:var(--surface); color:var(--violet); border-color:var(--violet); }
.btn-outline-primary:hover { background:var(--violet-light); }
.btn-success { background:var(--accent); color:#fff; border-color:var(--accent); }
.btn-success:hover { background:#008560; }
.btn svg { width:16px; height:16px; }

/* Spinner */
.spin { display:inline-block; width:16px; height:16px; border:2.5px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }
.spin.dark { border-color:rgba(124,58,237,.15); border-top-color:var(--violet); }
@keyframes spin { to { transform:rotate(360deg) } }

/* Req grid */
.req-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; margin-top:1rem; }
.req-item { display:flex; align-items:center; gap:10px; padding:12px; border-radius:var(--r-md); background:var(--surface-alt); border:1px solid var(--border); font-size:13px; font-weight:500; color:var(--text); }
.req-icon { width:36px; height:36px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; background:var(--violet-light); flex-shrink:0; }
.req-icon svg { width:18px; height:18px; color:var(--violet); }

/* Device status bar */
#deviceStatusBar { margin-bottom:1.25rem; }
#deviceStatusBar:empty { display:none; }
.dbar-inner { border:1.5px solid var(--violet-mid); border-radius:var(--r-lg); background:var(--violet-light); padding:14px 16px; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
.dbar-title { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#4c1d95; white-space:nowrap; flex-shrink:0; }
.dbar-items { display:flex; align-items:center; gap:1.25rem; flex:1; flex-wrap:wrap; }
.dbar-item { display:flex; align-items:center; gap:8px; }
.dbar-dot { width:10px; height:10px; border-radius:50%; background:var(--border-strong); flex-shrink:0; }
.dbar-dot.dbar-ok { background:var(--accent); }
.dbar-dot.dbar-fail { background:var(--danger); }
.dbar-dot.dbar-blink { background:var(--warn); animation:blink .7s step-end infinite; }
.dbar-item-label { font-size:11.5px; font-weight:600; color:var(--text-2); line-height:1.2; }
.dbar-item-desc { font-size:10.5px; color:var(--text-3); line-height:1.2; margin-top:1px; }
.dbar-retry { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:5px 11px; background:var(--surface); border:1.5px solid var(--violet-mid); border-radius:var(--r-sm); cursor:pointer; color:var(--violet); font-family:'Inter',sans-serif; flex-shrink:0; white-space:nowrap; }
.dbar-retry:hover { background:var(--violet-light); border-color:var(--violet); }

/* Mode toggle */
.mode-toggle { display:flex; gap:4px; background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r-md); padding:3px; margin-bottom:1.25rem; }
.mode-btn { flex:1; padding:6px 10px; font-size:12px; font-weight:600; border:none; border-radius:calc(var(--r-md)-2px); cursor:pointer; transition:all .15s; background:transparent; color:var(--text-3); font-family:'Inter',sans-serif; }
.mode-btn.active { background:var(--surface); color:var(--violet); box-shadow:var(--shadow-sm); }

/* Signature visual */
.sig-visual {
  display:flex; align-items:center; justify-content:center;
  border:2px dashed var(--violet-mid); border-radius:var(--r-lg);
  background:var(--violet-light); padding:1.5rem; gap:16px;
  margin-top:1rem; flex-wrap:wrap;
}
.sig-visual-icon { width:56px; height:56px; background:var(--violet); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sig-visual-icon svg { width:28px; height:28px; }
.sig-visual-text { text-align:left; }
.sig-visual-text .sig-name { font-size:15px; font-weight:700; color:var(--violet); }
.sig-visual-text .sig-meta { font-size:11.5px; color:var(--text-3); margin-top:3px; }
.sig-visual-text .sig-reason { font-size:12px; color:var(--text-2); margin-top:2px; font-style:italic; }

/* Footer */
.page-footer { text-align:center; margin-top:2.5rem; font-size:12px; color:var(--text-3); }
.page-footer a { color:var(--violet); text-decoration:none; }
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
  .form-row,.req-grid { grid-template-columns:1fr; }
  .cccd-preview { grid-template-columns:1fr; }
  .btn-row { flex-direction:column; }
  .btn-row .btn { width:100%; }
  .trust-bar { gap:1rem; }
  .stepper::before { display:none; }
  .pin-container { gap:6px; }
  .pin-digit { width:42px; height:54px; font-size:18px; }
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
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2.5L15 9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div><span class="nav-title">EIDCA <span>Ký số điện tử</span></span></div>
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
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      Ký số có giá trị pháp lý theo Luật Giao dịch Điện tử
    </div>
    <h1>Ký số Tài liệu Điện tử Cá nhân</h1>
    <p>Ký số tài liệu bằng Chứng thư số EIDCA và CCCD gắn chip — pháp lý, an toàn, hoàn tất trong vài giây.</p>
  </div>

  <div class="trust-bar" role="list">
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>Pháp lý theo Luật ĐT 2023</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>RSA-2048 + SHA-256</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>CAdES/PAdES chuẩn ETSI</div>
    <div class="trust-item" role="listitem"><svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8"/></svg>Private key trên HSM</div>
  </div>

  <div class="stepper" id="stepper" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" aria-label="Tiến trình ký số"></div>

  <!-- Device Status Bar -->
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
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════
const MOCK_DEVICE_INFO = { version:'1.1', serial_nfc:'00123000012', serial_device:'0022300111', date:new Date().toISOString() };

const MOCK_PERSONAL_INFO = {
  id:2, message:'read card successfully!',
  data:{
    idCode:'001087012345', oldIdCode:'123456789', personName:'NGUYỄN VĂN AN',
    dateOfBirth:'15051990', gender:'Nam', nationality:'Việt Nam',
    residencePlace:'Số 1, Phố Huế, Hai Bà Trưng, Hà Nội',
    issueDate:'20032021', expiryDate:'15052030',
    qr:'001087012345|123456789|Nguyễn Văn An|15051990|Nam|Hà Nội|20032021',
  }
};
const MOCK_AVATAR_DATA = {
  id:4, data:{ img_data:null,
    dg1:'YTExMTExMTExMTExMTExMTExMTExMTE=', dg2:'aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U=',
    dg15:'ZGcxNVJTQVB1YmxpY0tleURhdGFCYXM=', sod:'TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=',
  }
};
const MOCK_DS_CERT = {
  id:5, data:{ CA:'1',
    AA:{ aa_signature:'' },
    PA:{ cert:'MIIFaDCCBBCgAwIBAgIQ...', sod:'TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=' }
  }
};

// ─── Mock Socket ──────────────────────────────────────────────────────────────
function createMockSocket() {
  let _nfcOk=false, _timers=[];
  const on = {
    nfcConnect:()=>{}, nfcDisconnect:()=>{}, deviceInfo:()=>{},
    personalInfo:()=>{}, avatarImage:()=>{}, dsCert:()=>{},
    cardError:()=>{}, aaResponse:()=>{},
  };
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
    },
    disconnect(){ _nfcOk=false; _timers.forEach(clearTimeout); _timers=[]; on.nfcDisconnect(); },
    sendAA(challenge){ setTimeout(()=>on.aaResponse({id:7,data:{aa_signature:btoa('MOCK_AA_SIG_'+Date.now()),aa_challege:challenge}}),500); },
    simulateCardRead(){ _readCard(); },
    get isNfcConnected(){ return _nfcOk; },
  };
}

// ─── Real Socket ──────────────────────────────────────────────────────────────
function createRealSocket() {
  const NFC_URL = 'https://192.168.5.1:8000';
  let nfcSock=null;
  const _clientId = 'web_' + Date.now();
  const on = {
    nfcConnect:()=>{}, nfcDisconnect:()=>{}, deviceInfo:()=>{},
    personalInfo:()=>{}, avatarImage:()=>{}, dsCert:()=>{},
    cardError:()=>{}, aaResponse:()=>{},
  };
  function _connectNfc(){
    if (typeof io === 'undefined') { console.warn('[Socket] socket.io not loaded'); return; }
    nfcSock = io(NFC_URL,{ transports:['websocket'], rejectUnauthorized:false, reconnection:true, reconnectionAttempts:5, reconnectionDelay:2000 });
    nfcSock.on('connect', ()=>on.nfcConnect());
    nfcSock.on('disconnect', ()=>on.nfcDisconnect());
    nfcSock.on('/info', d=>on.deviceInfo(d));
    nfcSock.on('/event', d=>{
      switch(d.id){ case 2:on.personalInfo(d);break; case 4:on.avatarImage(d);break; case 5:on.dsCert(d);break; case 3:on.cardError(d);break; case 7:on.aaResponse(d);break; }
    });
  }
  return {
    on,
    connect(){ _connectNfc(); },
    disconnect(){ nfcSock?.disconnect(); },
    sendAA(ch){ if(nfcSock?.connected) nfcSock.emit('/get_aa',{clientId:_clientId,challenge:ch}); },
    sendReRead(info){ if(nfcSock?.connected) nfcSock.emit('/input_data',{...info,clientId:_clientId}); },
    get isNfcConnected(){ return nfcSock?.connected??false; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════════════════════════════
const S = {
  // wizard
  step: 0,           // 0=intro, 1=doc, 2=auth, 3=signing, 4=done, 5=error
  useMock: true,
  socket: null,

  // device states
  nfcStatus: 'idle', // idle|connecting|connected|scanning|ok|error
  deviceInfo: null,

  // card data
  cardData: null,
  cardPhoto: null,
  rawNfc: null,
  dsCert: null,

  // document to sign
  docFile: null,       // File object
  docName: '',
  docSize: 0,
  docType: '',         // 'pdf'|'docx'|'other'

  // sign options
  signOptions: {
    reason: '',
    location: 'Hà Nội, Việt Nam',
    signatureType: 'PAdES',  // PAdES | CAdES
    includeTimestamp: true,
  },

  // PIN
  pin: '',
  pinVerified: false,

  // result
  signResult: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET SETUP & HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
function setupSocket() {
  if (S.socket) S.socket.disconnect();
  S.socket = S.useMock ? createMockSocket() : createRealSocket();

  S.socket.on.nfcConnect = () => {
    S.nfcStatus = 'connected';
    updateDevicePill(); renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.nfcDisconnect = () => {
    S.nfcStatus = 'idle';
    updateDevicePill(); renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.deviceInfo = (info) => {
    S.deviceInfo = info;
    S.nfcStatus = 'scanning';
    updateDevicePill(); renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.personalInfo = (evt) => {
    S.cardData = evt.data;
    S.nfcStatus = 'ok';
    updateDevicePill(); renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.avatarImage = (evt) => {
    S.cardPhoto = evt.data.img_data || null;
    S.rawNfc = { dg1:evt.data.dg1, dg2:evt.data.dg2, dg15:evt.data.dg15, sod:evt.data.sod };
    if (S.step === 2) render();
  };
  S.socket.on.dsCert = (evt) => {
    S.dsCert = evt.data;
    if (S.step === 2) render();
  };
  S.socket.on.cardError = (evt) => {
    S.nfcStatus = 'error';
    console.warn('[NFC] Card error:', evt);
    updateDevicePill(); renderDeviceBar();
    if (S.step === 2) render();
  };
  S.socket.on.aaResponse = (evt) => {
    // AA verified — proceed to signing
    if (S.step === 2) {
      S.pinVerified = true;
      render();
    }
  };
}

// ─── Device Bar ───────────────────────────────────────────────────────────────
function renderDeviceBar() {
  const bar = document.getElementById('deviceStatusBar');
  if (!bar) return;
  bar.innerHTML = _deviceBarHTML();
}
function _deviceBarHTML() {
  if (S.useMock) return '';
  const nfcSt = S.nfcStatus;
  const items = [
    { label:'Kết nối NFC',
      done: nfcSt !== 'idle' && nfcSt !== 'connecting' && nfcSt !== 'error',
      active: nfcSt === 'connecting', fail: nfcSt === 'error',
      desc: nfcSt === 'connecting' ? 'Đang kết nối 192.168.5.1:8000…' :
            nfcSt === 'connected'  ? 'Thiết bị đã sẵn sàng' :
            nfcSt === 'scanning'   ? 'Chờ đặt thẻ CCCD…' :
            nfcSt === 'ok'         ? `Đọc thẻ OK (${S.cardData?.personName||''})` :
            nfcSt === 'error'      ? 'Không thể kết nối đầu đọc' : 'Chưa kết nối' },
    { label:'Thiết bị NFC', done:!!S.deviceInfo, active:nfcSt==='connected',
      desc: S.deviceInfo ? `S/N ${S.deviceInfo.serial_nfc} · v${S.deviceInfo.version}` : 'Chưa nhận thông tin' },
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
      ${items.map(item=>`
      <div class="dbar-item">
        <div class="${dotCls(item)}"></div>
        <div>
          <div class="dbar-item-label">${item.label}</div>
          <div class="dbar-item-desc">${item.desc}</div>
        </div>
      </div>`).join('')}
    </div>
    ${nfcSt==='error' ? `<button class="dbar-retry" onclick="retryDeviceConnect()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Thử kết nối lại
    </button>` : ''}
  </div>`;
}
function retryDeviceConnect() {
  if (S.useMock) return;
  if (S.socket) { S.socket.disconnect(); S.socket = null; }
  S.nfcStatus = 'connecting';
  setupSocket(); S.socket.connect();
  updateDevicePill(); renderDeviceBar();
}
function toggleDeviceMode() {
  S.useMock = !S.useMock;
  S.nfcStatus = 'idle'; S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
  S.pin = ''; S.pinVerified = false;
  if (S.socket) { S.socket.disconnect(); S.socket = null; }
  if (!S.useMock) { S.nfcStatus = 'connecting'; setupSocket(); S.socket.connect(); }
  updateDevicePill(); render();
}
function updateDevicePill() {
  const dot = document.getElementById('deviceDot');
  const label = document.getElementById('devicePillLabel');
  if (!dot || !label) return;
  if (S.useMock) {
    dot.className = 'dot'; label.textContent = 'Demo Mode';
  } else {
    if (S.nfcStatus === 'ok') { dot.className = 'dot connected'; label.textContent = 'Thẻ đã đọc'; }
    else if (S.nfcStatus === 'scanning' || S.nfcStatus === 'connected') { dot.className = 'dot connected'; label.textContent = 'Thiết bị sẵn sàng'; }
    else if (S.nfcStatus === 'connecting') { dot.className = 'dot connecting'; label.textContent = 'Đang kết nối…'; }
    else if (S.nfcStatus === 'error') { dot.className = 'dot error'; label.textContent = 'Lỗi kết nối'; }
    else { dot.className = 'dot'; label.textContent = 'Thiết bị thật'; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS = [
  { label:'Chọn\ntài liệu' },
  { label:'Xác thực\nCCCD + PIN' },
  { label:'Nhận tài liệu\nđã ký' },
];

function render() {
  renderStepper();
  const card = document.getElementById('wizardCard');
  if (!card) return;
  if      (S.step === 0) card.innerHTML = renderIntro();
  else if (S.step === 1) card.innerHTML = renderDoc();
  else if (S.step === 2) card.innerHTML = renderAuth();
  else if (S.step === 3) card.innerHTML = renderSigning();
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

// ── Intro ─────────────────────────────────────────────────────────────────────
function renderIntro() {
  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg></div>
    <div><h2>Ký số Tài liệu Điện tử</h2><p>Hoàn thành trong 3 bước — khoảng 1 phút</p></div>
  </div>
</div>
<div class="card-body">
  ${S.useMock ? `<div class="alert alert-info" role="note">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    <div>Đang chạy <strong>Demo Mode</strong> — tài liệu và chữ ký được giả lập. Nhấn <strong>Demo Mode</strong> trên nav để kết nối thiết bị thật (<code>192.168.5.1:8000</code>).</div>
  </div>` : `<div class="alert alert-success" role="note">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <div>Đang kết nối <strong>thiết bị thật</strong> — đầu đọc CCCD tại <code>192.168.5.1</code>.</div>
  </div>`}

  <div class="section-sep"><div class="sep-line"></div><span>Yêu cầu</span><div class="sep-line"></div></div>
  <div class="req-grid">
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div><div><div style="font-weight:600;font-size:13px">Tài liệu cần ký</div><div style="font-size:11.5px;color:var(--text-3)">PDF, DOCX hoặc định dạng khác</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div style="font-weight:600;font-size:13px">CCCD gắn chip</div><div style="font-size:11.5px;color:var(--text-3)">Xác thực danh tính người ký</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg></div><div><div style="font-weight:600;font-size:13px">PIN Chứng thư số</div><div style="font-size:11.5px;color:var(--text-3)">Mã PIN 6 chữ số để ký</div></div></div>
    <div class="req-item"><div class="req-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg></div><div><div style="font-weight:600;font-size:13px">Chứng thư số còn hạn</div><div style="font-size:11.5px;color:var(--text-3)">CTS EIDCA còn hiệu lực</div></div></div>
  </div>

  <div class="section-sep" style="margin-top:1.75rem"><div class="sep-line"></div><span>Quy trình</span><div class="sep-line"></div></div>
  <div class="checklist">
    <div class="check-item"><div class="check-dot" style="background:var(--violet-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 1 — Chọn tài liệu &amp; thông số ký</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Upload file và điền thông tin chữ ký (lý do, vị trí)</div></div></div>
    <div class="check-item"><div class="check-dot" style="background:var(--violet-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 2 — Xác thực CCCD &amp; nhập PIN</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Đặt CCCD vào đầu đọc, nhập PIN để uỷ quyền ký</div></div></div>
    <div class="check-item"><div class="check-dot" style="background:var(--violet-light)"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="var(--violet)" stroke-width="2" stroke-linecap="round"/></svg></div><div><div style="font-weight:600">Bước 3 — Tải tài liệu đã ký</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">Tải xuống file đã đính chữ ký số hợp lệ</div></div></div>
  </div>

  <div class="btn-row">
    <button class="btn btn-primary" onclick="goStep(1)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Bắt đầu ký số
    </button>
  </div>
</div>`;
}

// ── Step 1: Chọn tài liệu & thông số ký ───────────────────────────────────────
function renderDoc() {
  const o = S.signOptions;
  const hasFile = !!S.docFile;

  function fileIconHTML() {
    if (S.docType === 'pdf') return `<div class="file-icon-box pdf"><svg viewBox="0 0 24 24" fill="none" style="color:#D32F2F"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/><path d="M9 15h1.5a1 1 0 000-2H9v4m4-4h2m-2 2h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>`;
    if (S.docType === 'docx') return `<div class="file-icon-box docx"><svg viewBox="0 0 24 24" fill="none" style="color:#1B4FD8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/><path d="M9 13l1.5 4 1.5-3 1.5 3L15 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    return `<div class="file-icon-box other"><svg viewBox="0 0 24 24" fill="none" style="color:var(--text-3)"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/></svg></div>`;
  }

  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg></div>
    <div><h2>Chọn tài liệu &amp; Thông số ký</h2><p>Upload tài liệu cần ký và điền thông tin chữ ký điện tử</p></div>
  </div>
</div>
<div class="card-body">

  <!-- Drop zone / File preview -->
  ${hasFile ? `
  <div class="file-preview">
    ${fileIconHTML()}
    <div class="file-info">
      <div class="file-name">${S.docName}</div>
      <div class="file-meta">${formatFileSize(S.docSize)} · ${S.docType.toUpperCase()}</div>
    </div>
    <button class="file-remove" onclick="removeDoc()" title="Xoá tài liệu" aria-label="Xoá tài liệu">
      <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  </div>` : `
  <div class="drop-zone" id="dropZone" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
    <input type="file" id="docInput" accept=".pdf,.doc,.docx,.xlsx,.xls,.txt" onchange="handleFileSelect(event)" aria-label="Chọn tài liệu cần ký"/>
    <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
    <div class="drop-title">Kéo thả hoặc nhấn để chọn tài liệu</div>
    <div class="drop-sub">Hỗ trợ nhiều định dạng, tối đa 50MB</div>
    <div class="drop-types">
      <span class="drop-type-badge">PDF</span>
      <span class="drop-type-badge">DOCX</span>
      <span class="drop-type-badge">XLSX</span>
      <span class="drop-type-badge">TXT</span>
    </div>
  </div>`}

  <div id="err-docFile" class="error-msg" style="margin-top:6px">Vui lòng chọn tài liệu cần ký</div>

  <div class="section-sep" style="margin-top:1.5rem"><div class="sep-line"></div><span>Thông tin chữ ký</span><div class="sep-line"></div></div>

  <div class="form-row">
    <div class="form-group">
      <label for="signReason">Lý do ký <span class="req">*</span></label>
      <input type="text" id="signReason" placeholder="VD: Phê duyệt hợp đồng" value="${escapeHtml(o.reason)}"
        oninput="S.signOptions.reason=this.value" required/>
      <div class="error-msg" id="err-signReason">Vui lòng nhập lý do ký</div>
    </div>
    <div class="form-group">
      <label for="signLocation">Địa điểm ký</label>
      <input type="text" id="signLocation" placeholder="VD: Hà Nội, Việt Nam" value="${escapeHtml(o.location)}"
        oninput="S.signOptions.location=this.value"/>
    </div>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="signType">Loại chữ ký số</label>
      <select id="signType" onchange="S.signOptions.signatureType=this.value">
        <option value="PAdES" ${o.signatureType==='PAdES'?'selected':''}>PAdES (PDF Advanced Electronic Signature)</option>
        <option value="CAdES" ${o.signatureType==='CAdES'?'selected':''}>CAdES (CMS Advanced Electronic Signature)</option>
        <option value="XAdES" ${o.signatureType==='XAdES'?'selected':''}>XAdES (XML Advanced Electronic Signature)</option>
      </select>
      <div class="field-hint">PAdES khuyến nghị cho tài liệu PDF</div>
    </div>
    <div class="form-group" style="justify-content:flex-end">
      <label style="margin-bottom:10px">Tuỳ chọn</label>
      <label style="display:flex;align-items:center;gap:8px;font-weight:500;cursor:pointer">
        <input type="checkbox" id="chkTimestamp" ${o.includeTimestamp?'checked':''} onchange="S.signOptions.includeTimestamp=this.checked"
          style="width:16px;height:16px;accent-color:var(--violet)"/>
        Đính kèm Timestamp (RFC 3161)
      </label>
    </div>
  </div>

  <!-- Signature visual preview -->
  ${o.reason ? `
  <div class="sig-visual" id="sigVisual">
    <div class="sig-visual-icon">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/><path d="M9 12l2 2.5L15 9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
    <div class="sig-visual-text">
      <div class="sig-name">EIDCA Digital Signature</div>
      <div class="sig-meta">${o.signatureType} · ${o.includeTimestamp?'Có Timestamp':'Không Timestamp'}</div>
      <div class="sig-reason">Lý do: ${escapeHtml(o.reason)}${o.location ? ' · ' + escapeHtml(o.location) : ''}</div>
    </div>
  </div>` : ''}

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="goStep(0)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Quay lại
    </button>
    <button class="btn btn-primary" onclick="submitDoc()">
      Tiếp theo
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</div>`;
}

// ── Step 2: Xác thực CCCD + PIN ───────────────────────────────────────────────
function renderAuth() {
  const nfcSt = S.nfcStatus;
  const cardOk = !!S.cardData;
  const pinOk = S.pin.length === 6;
  const canSign = cardOk && pinOk;

  // NFC reader panel
  let nfcBody = '';
  if (nfcSt === 'idle' || nfcSt === 'connecting') {
    nfcBody = `<div class="reader-status">
      <div class="reader-anim"><svg viewBox="0 0 24 24" fill="none" style="color:var(--text-3)"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
      <div class="reader-status-text">Đang khởi tạo đầu đọc…</div>
      <div class="reader-status-sub"><span class="spin dark"></span></div>
    </div>`;
  } else if (nfcSt === 'scanning') {
    nfcBody = `<div class="reader-status">
      <div class="reader-anim scanning" style="background:var(--violet-light)">
        <svg viewBox="0 0 24 24" fill="none" style="color:var(--violet)"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h2m4 0h4M7 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </div>
      <div class="reader-status-text">Đặt CCCD vào đầu đọc</div>
      <div class="reader-status-sub">Giữ thẻ phẳng và cố định cho đến khi nghe tiếng bíp</div>
    </div>`;
  } else if (nfcSt === 'ok' && S.cardData) {
    const d = S.cardData;
    function fmtDate(s) {
      if (!s) return '—'; s = s.trim();
      if (s.includes('/')) return s;
      if (s.length === 8) return `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4,8)}`;
      return s;
    }
    nfcBody = `
    <div class="alert alert-success" style="margin-bottom:.75rem">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div>Đọc chip thành công! Danh tính người ký đã được xác thực.</div>
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
        <div class="cccd-info-row"><div class="cccd-info-label">Ngày sinh</div><div class="cccd-info-value">${fmtDate(d.dateOfBirth)}</div></div>
        <div class="cccd-info-row"><div class="cccd-info-label">Hết hạn</div><div class="cccd-info-value">${fmtDate(d.expiryDate)}</div></div>
      </div>
      <div class="cccd-chip-badge">CCCD · Chip NFC</div>
    </div>
    <div style="margin-top:.75rem">
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

  // NFC badge
  function nfcBadgeCls() {
    if (cardOk) return 'device-status-badge dsb-ok';
    if (nfcSt === 'scanning' || nfcSt === 'connected') return 'device-status-badge dsb-scan';
    if (nfcSt === 'error') return 'device-status-badge dsb-error';
    return 'device-status-badge dsb-idle';
  }
  function nfcBadgeLabel() {
    if (cardOk) return '✓ Đọc xong';
    if (nfcSt === 'scanning') return '⬤ Chờ thẻ…';
    if (nfcSt === 'connected') return '⬤ Sẵn sàng';
    if (nfcSt === 'error') return '✗ Lỗi đọc';
    return '◌ Đang kết nối';
  }

  // Build PIN dots for display
  const pinDisplay = Array.from({length:6},(_,i)=>`<input
    type="password"
    id="pinDigit${i}"
    class="pin-digit${S.pin.length>i?' filled':''}"
    maxlength="1"
    inputmode="numeric"
    pattern="[0-9]"
    value="${S.pin[i]||''}"
    onkeydown="handlePinKey(event,${i})"
    oninput="handlePinInput(event,${i})"
    autocomplete="off"
    aria-label="Chữ số PIN thứ ${i+1}"/>`).join('');

  const pinBadgeCls = pinOk ? 'device-status-badge dsb-ok' : 'device-status-badge dsb-idle';
  const pinBadgeLabel = pinOk ? '✓ Đủ 6 chữ số' : `◌ ${S.pin.length}/6 chữ số`;

  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="white" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="white" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="white"/></svg></div>
    <div><h2>Xác thực CCCD &amp; Nhập PIN</h2><p>Đặt CCCD vào đầu đọc và nhập PIN để uỷ quyền ký tài liệu</p></div>
  </div>
</div>
<div class="card-body">

  <div class="mode-toggle">
    <button class="mode-btn ${!S.useMock?'active':''}" onclick="${S.useMock?'toggleDeviceMode()':''}" ${!S.useMock?'disabled':''}>🔌 Thiết bị thật</button>
    <button class="mode-btn ${S.useMock?'active':''}" onclick="${!S.useMock?'toggleDeviceMode()':''}" ${S.useMock?'disabled':''}>🎭 Demo Mode</button>
  </div>

  <!-- NFC Reader -->
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

  <!-- PIN Panel -->
  <div class="device-panel">
    <div class="device-panel-header">
      <div class="device-panel-title">
        <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
        PIN Chứng thư số
      </div>
      <span class="${pinBadgeCls}">${pinBadgeLabel}</span>
    </div>
    <div class="device-panel-body">
      <p style="font-size:13px;color:var(--text-2);margin-bottom:.75rem;text-align:center">Nhập mã PIN 6 chữ số của Chứng thư số EIDCA để uỷ quyền ký</p>
      <div class="pin-container" role="group" aria-label="Nhập mã PIN 6 chữ số">
        ${pinDisplay}
      </div>
      ${S.pin.length === 6 ? `<p style="text-align:center;font-size:12px;color:var(--success);font-weight:600;margin-top:.5rem">✓ PIN đã nhập đủ</p>` : ''}
      <div style="text-align:center;margin-top:.75rem">
        <button class="btn btn-secondary" style="font-size:12px;padding:5px 14px" onclick="clearPin()">
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Xoá PIN
        </button>
      </div>
      ${S.useMock ? `<p style="text-align:center;font-size:11px;color:var(--text-3);margin-top:.5rem">Demo: nhập bất kỳ 6 chữ số (VD: 123456)</p>` : ''}
    </div>
  </div>

  <!-- Signing summary -->
  <div class="alert alert-info" style="margin-bottom:1rem">
    <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/></svg>
    <div>
      <strong>Tài liệu:</strong> ${escapeHtml(S.docName)} (${formatFileSize(S.docSize)}) ·
      <strong>Loại chữ ký:</strong> ${S.signOptions.signatureType} ·
      <strong>Lý do:</strong> ${escapeHtml(S.signOptions.reason)}
    </div>
  </div>

  ${canSign ? `<div class="alert alert-success" role="status">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <div><strong>Sẵn sàng ký!</strong> Danh tính đã xác thực và PIN đã nhập. Nhấn <strong>Ký tài liệu</strong> để tiến hành.</div>
  </div>` : `<div class="alert alert-warn">
    <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    Cần <strong>đọc chip CCCD</strong> và <strong>nhập đủ PIN 6 chữ số</strong> trước khi ký.
  </div>`}

  <div class="btn-row">
    <button class="btn btn-secondary" onclick="goStep(1)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Quay lại
    </button>
    <button class="btn btn-primary" onclick="submitSign()" ${canSign?'':'disabled'}>
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/><path d="M9 12l2 2.5L15 9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
      Ký tài liệu
    </button>
  </div>
</div>`;
}

// ── Step 3: Signing (Processing) ──────────────────────────────────────────────
function renderSigning() {
  const checkDef = [
    'Xác thực tính toàn vẹn tài liệu (hash SHA-256)',
    'Kiểm tra Chứng thư số còn hiệu lực (OCSP/CRL)',
    'Tạo chữ ký số bằng private key trên HSM',
    'Đính Timestamp từ TSA (RFC 3161)',
    'Nhúng chữ ký vào tài liệu (' + S.signOptions.signatureType + ')',
  ];
  return `
<div class="card-header">
  <div class="card-header-inner">
    <div class="card-icon" style="background:var(--warn)">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
    <div><h2>Đang ký số tài liệu</h2><p>Hệ thống đang tạo chữ ký số — vui lòng không tắt trang</p></div>
  </div>
</div>
<div class="card-body">
  <div class="alert alert-warn" role="status" aria-live="polite">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    Vui lòng <strong>không tắt trang</strong> và giữ nguyên thẻ CCCD trong đầu đọc.
  </div>
  <div class="checklist" id="signingList" aria-live="polite">
    ${checkDef.map((label,i)=>{
      const c = S.signingChecks[i] || 'pending';
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

// ── Step 4: Done ──────────────────────────────────────────────────────────────
function renderDone() {
  const r = S.signResult;
  return `
<div class="signed-doc-card">
  <div class="signed-doc-header">
    <div class="signed-seal">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="white" stroke-width="1.8"/><path d="M9 12l2 2.5L15 9" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
    </div>
    <h2>Ký số thành công!</h2>
    <p>Tài liệu đã được ký số và có giá trị pháp lý theo quy định.</p>
  </div>
  <div style="background:var(--surface);padding:1.75rem 2rem">
    <div class="alert alert-success" role="status">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div>Tài liệu <strong>${escapeHtml(S.docName)}</strong> đã được ký bởi <strong>${r.signerName}</strong>.</div>
    </div>
    <div class="section-sep" style="margin-top:.5rem"><div class="sep-line"></div><span>Thông tin Chữ ký số</span><div class="sep-line"></div></div>
    <table class="cert-table">
      <tr><th>Người ký</th><td><strong>${r.signerName}</strong></td></tr>
      <tr><th>Số CCCD</th><td style="font-family:monospace">${r.signerIdCode}</td></tr>
      <tr><th>Tài liệu</th><td>${escapeHtml(S.docName)}</td></tr>
      <tr><th>Hash (SHA-256)</th><td style="font-family:monospace;font-size:11.5px;word-break:break-all">${r.docHash}</td></tr>
      <tr><th>Loại chữ ký</th><td><span class="badge-violet">${S.signOptions.signatureType}</span></td></tr>
      <tr><th>Lý do</th><td>${escapeHtml(S.signOptions.reason)}</td></tr>
      <tr><th>Thời gian ký</th><td>${r.signedAt}</td></tr>
      <tr><th>Serial CTS</th><td style="font-family:monospace;font-size:13px">${r.certSerial}</td></tr>
      <tr><th>Timestamp</th><td>${S.signOptions.includeTimestamp ? `<span class="badge-valid">✓ RFC 3161</span>` : '—'}</td></tr>
      <tr><th>Trạng thái</th><td><span class="badge-valid"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Hợp lệ</span></td></tr>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <button class="btn btn-outline-primary" onclick="downloadSignedDoc()" style="justify-content:center">
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Tải tài liệu đã ký
      </button>
      <button class="btn btn-success" onclick="goStep(0)" style="justify-content:center">
        <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        Ký tài liệu khác
      </button>
    </div>
  </div>
</div>`;
}

// ── Step 5: Error ──────────────────────────────────────────────────────────────
function renderError() {
  return `
<div class="card-header" style="background:linear-gradient(135deg,var(--danger-light),#fff5f5)">
  <div class="card-header-inner">
    <div class="card-icon" style="background:var(--danger)">
      <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="white" stroke-width="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
    </div>
    <div><h2>Ký số thất bại</h2><p>Đã xảy ra lỗi trong quá trình ký tài liệu</p></div>
  </div>
</div>
<div class="card-body">
  <div class="alert alert-danger" role="alert">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
    <div><strong>Ký số thất bại.</strong> PIN không đúng hoặc Chứng thư số đã hết hạn. Vui lòng thử lại hoặc liên hệ <strong>1800-9999</strong>.</div>
  </div>
  <div class="btn-row" style="justify-content:center;gap:1rem">
    <button class="btn btn-secondary" onclick="retrySign()">
      <svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Thử lại
    </button>
    <button class="btn btn-primary" onclick="goStep(0)">Ký tài liệu mới</button>
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
    S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
    S.nfcStatus = 'idle'; S.pin = ''; S.pinVerified = false;
    S.docFile = null; S.docName = ''; S.docSize = 0; S.docType = '';
    S.signOptions = { reason:'', location:'Hà Nội, Việt Nam', signatureType:'PAdES', includeTimestamp:true };
    S.signResult = null; S.signingChecks = [];
    if (S.socket) { S.socket.disconnect(); S.socket = null; }
  }
  if (n === 2 && prev !== 2) {
    if (!S.socket) { setupSocket(); S.socket.connect(); }
    if (S.useMock) S.nfcStatus = 'connecting';
  }
  if (n !== 2 && prev === 2 && S.socket) { /* nothing special */ }
  window.scrollTo({ top:0, behavior:'smooth' });
  render();
  updateDevicePill();
}

// ─── File handling ────────────────────────────────────────────────────────────
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setDocFile(file);
}
function handleDragOver(event) {
  event.preventDefault();
  document.getElementById('dropZone')?.classList.add('dragover');
}
function handleDragLeave(event) {
  document.getElementById('dropZone')?.classList.remove('dragover');
}
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('dropZone')?.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) setDocFile(file);
}
function setDocFile(file) {
  S.docFile = file;
  S.docName = file.name;
  S.docSize = file.size;
  const ext = file.name.split('.').pop().toLowerCase();
  S.docType = ext === 'pdf' ? 'pdf' : (ext === 'docx' || ext === 'doc') ? 'docx' : 'other';
  render();
}
function removeDoc() {
  S.docFile = null; S.docName = ''; S.docSize = 0; S.docType = '';
  render();
}

// ─── Document form submit ─────────────────────────────────────────────────────
function submitDoc() {
  let ok = true;
  const errDoc = document.getElementById('err-docFile');
  const errReason = document.getElementById('err-signReason');
  if (!S.docFile) {
    if (errDoc) errDoc.classList.add('show'); ok = false;
  } else {
    if (errDoc) errDoc.classList.remove('show');
  }
  // Sync reason from DOM
  const reasonEl = document.getElementById('signReason');
  if (reasonEl) S.signOptions.reason = reasonEl.value.trim();
  if (!S.signOptions.reason) {
    if (errReason) errReason.classList.add('show'); ok = false;
  } else {
    if (errReason) errReason.classList.remove('show');
  }
  const locEl = document.getElementById('signLocation');
  if (locEl) S.signOptions.location = locEl.value;
  const typeEl = document.getElementById('signType');
  if (typeEl) S.signOptions.signatureType = typeEl.value;
  const tsEl = document.getElementById('chkTimestamp');
  if (tsEl) S.signOptions.includeTimestamp = tsEl.checked;
  if (ok) goStep(2);
}

// ─── CCCD re-read ─────────────────────────────────────────────────────────────
function reReadCard() {
  if (!S.socket) return;
  if (S.useMock) {
    S.socket.simulateCardRead();
  } else {
    const d = S.cardData;
    if (d) S.socket.sendReRead({ idCode:d.idCode, dateOfBirth:d.dateOfBirth||'', expiryDate:d.expiryDate||'' });
  }
  S.cardData = null; S.cardPhoto = null; S.rawNfc = null; S.dsCert = null;
  S.nfcStatus = 'scanning';
  render();
}

// ─── PIN handling ─────────────────────────────────────────────────────────────
function handlePinInput(event, idx) {
  const val = event.target.value.replace(/\D/g,'');
  event.target.value = val.slice(-1); // keep last char only
  const digits = Array.from({length:6}, (_,i) => {
    const el = document.getElementById(`pinDigit${i}`);
    return el ? el.value : '';
  });
  S.pin = digits.join('');
  // Auto-advance
  if (val && idx < 5) {
    document.getElementById(`pinDigit${idx+1}`)?.focus();
  }
  // Update badges without full re-render for smoothness
  _updatePinBadge();
  if (S.pin.length === 6) render();
}
function handlePinKey(event, idx) {
  if (event.key === 'Backspace') {
    const el = document.getElementById(`pinDigit${idx}`);
    if (el && el.value === '' && idx > 0) {
      document.getElementById(`pinDigit${idx-1}`)?.focus();
    }
  }
}
function clearPin() {
  S.pin = '';
  for (let i=0;i<6;i++) {
    const el = document.getElementById(`pinDigit${i}`);
    if (el) { el.value = ''; el.classList.remove('filled','error'); }
  }
  document.getElementById('pinDigit0')?.focus();
  _updatePinBadge();
}
function _updatePinBadge() {
  // Lightweight badge update without full re-render
  const pinOk = S.pin.length === 6;
  const badge = document.querySelector('.device-panel:nth-child(3) .device-status-badge');
  if (badge) {
    badge.className = `device-status-badge ${pinOk?'dsb-ok':'dsb-idle'}`;
    badge.textContent = pinOk ? '✓ Đủ 6 chữ số' : `◌ ${S.pin.length}/6 chữ số`;
  }
  // Update btn state
  const cardOk = !!S.cardData;
  const btn = document.querySelector('.btn-primary[onclick="submitSign()"]');
  if (btn) btn.disabled = !(cardOk && pinOk);
}

// ─── Sign submit ──────────────────────────────────────────────────────────────
async function submitSign() {
  if (!S.cardData || S.pin.length !== 6) return;
  goStep(3);
  S.signingChecks = Array(5).fill('pending');
  render();
  const timings = [700, 900, 1400, 800, 600];
  for (let i=0; i<timings.length; i++) {
    S.signingChecks[i] = 'active';
    _updateCheckList();
    await delay(timings[i]);

    // Simulate PIN error in demo (5% chance)
    if (i===2 && S.useMock && Math.random() < 0.05) {
      S.signingChecks[i] = 'fail';
      _updateCheckList();
      await delay(700);
      goStep(5); return;
    }
    S.signingChecks[i] = 'ok';
    _updateCheckList();
  }

  // Build sign result
  const now = new Date();
  const d = S.cardData;
  const hashMock = Array.from({length:64},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
  S.signResult = {
    signerName: d.personName || 'NGUYỄN VĂN AN',
    signerIdCode: d.idCode || '—',
    docHash: hashMock,
    certSerial: 'VNECC-' + Math.random().toString(36).substr(2,8).toUpperCase(),
    signedAt: now.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}),
  };
  goStep(4);
}

function _updateCheckList() {
  const list = document.getElementById('signingList');
  if (!list) return;
  const checkDef = [
    'Xác thực tính toàn vẹn tài liệu (hash SHA-256)',
    'Kiểm tra Chứng thư số còn hiệu lực (OCSP/CRL)',
    'Tạo chữ ký số bằng private key trên HSM',
    'Đính Timestamp từ TSA (RFC 3161)',
    'Nhúng chữ ký vào tài liệu (' + S.signOptions.signatureType + ')',
  ];
  list.innerHTML = checkDef.map((label,i)=>{
    const c = S.signingChecks[i] || 'pending';
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
  }).join('');
}

function retrySign() {
  S.pin = ''; S.pinVerified = false; S.signingChecks = [];
  goStep(2);
}

function downloadSignedDoc() {
  if (!S.signResult) return;
  const r = S.signResult;
  const lines = [
    '-----BEGIN SIGNED DOCUMENT INFO-----',
    `File: ${S.docName}`,
    `Signer: CN=${r.signerName}, C=VN`,
    `CCCD: ${r.signerIdCode}`,
    `Serial: ${r.certSerial}`,
    `Signature Type: ${S.signOptions.signatureType}`,
    `Reason: ${S.signOptions.reason}`,
    `Location: ${S.signOptions.location}`,
    `Signed At: ${r.signedAt}`,
    `Doc Hash (SHA-256): ${r.docHash}`,
    `Timestamp: ${S.signOptions.includeTimestamp ? 'Yes (RFC 3161)' : 'No'}`,
    `Issuer: EIDCA Public CA — Trung tâm Chứng thư số Quốc gia`,
    '-----END SIGNED DOCUMENT INFO-----',
    '',
    '[Demo file — không có giá trị pháp lý]',
    `Generated: ${new Date().toISOString()}`,
  ];
  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SIGNED_${S.docName.replace(/\.[^.]+$/,'')}_EIDCA.txt`;
  a.click(); URL.revokeObjectURL(a.href);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

function afterRender() {
  const stpr = document.getElementById('stepper');
  if (stpr) stpr.setAttribute('aria-valuenow', Math.max(1,Math.min(3,S.step)));
  updateDevicePill();
  renderDeviceBar();
  // Focus first PIN digit when on auth step
  if (S.step === 2) {
    requestAnimationFrame(()=>{
      if (!S.cardData) return; // focus PIN only after card is read
      const firstEmpty = Array.from({length:6},(_,i)=>document.getElementById(`pinDigit${i}`)).find(el=>el&&el.value==='');
      if (firstEmpty) firstEmpty.focus();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════════
S.signingChecks = [];
render();

// ── CMS Log Integration ──────────────────────────────────────────────────────
// Tự động ghi log ký số vào EIDCA CMS khi hoàn thành bước Done
(function() {
  const _origRender = render;
  let _logged = false;
  window.render = function() {
    _origRender();
    if (S.step === 4 && !_logged && S.signResult) {
      _logged = true;
      if (typeof window.eidcaLogEvent === 'function') {
        window.eidcaLogEvent('sign_doc', {
          personName: S.cardData?.personName || '',
          idCode:     S.cardData?.idCode     || '',
          docName:    S.docName              || '',
          signType:   S.signOptions?.signatureType || '',
        });
      }
    }
  };
})();
</script>
</body>
</html>

