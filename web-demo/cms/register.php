<?php
/**
 * EIDCA CMS – Trang đăng ký tài khoản
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

if (!ALLOW_SELF_REGISTER) {
    header('Location: ' . _base() . '/login.html');
    exit;
}
if (isLoggedIn()) {
    header('Location: ' . _base() . '/dashboard.html');
    exit;
}

$error   = '';
$success = '';
$posted  = ['username' => '', 'email' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) {
        $error = 'Yêu cầu không hợp lệ, hãy thử lại.';
    } else {
        $posted['username'] = trim($_POST['username'] ?? '');
        $posted['email']    = trim($_POST['email']    ?? '');
        $password           = $_POST['password']      ?? '';
        $confirm            = $_POST['confirm']       ?? '';

        if ($password !== $confirm) {
            $error = 'Mật khẩu xác nhận không khớp.';
        } else {
            $result = doRegister($posted['username'], $posted['email'], $password);
            if ($result['ok']) {
                logActivity('register_account', ['username' => $posted['username'], 'email' => $posted['email']]);
                $success = $result['msg'];
            } else {
                $error = $result['msg'];
            }
        }
    }
}
?><!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Đăng ký – EIDCA CMS</title>
<meta name="robots" content="noindex,nofollow"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="<?= _base() ?>/assets/cms.css"/>
<style>
.auth-bg-dots {
  position:fixed;inset:0;overflow:hidden;pointer-events:none;
}
.auth-bg-dots::before {
  content:'';position:absolute;width:600px;height:600px;
  background:radial-gradient(circle,rgba(79,70,229,.15) 0%,transparent 70%);
  top:-200px;left:-200px;animation:floatBlob 8s ease-in-out infinite alternate;
}
.auth-bg-dots::after {
  content:'';position:absolute;width:400px;height:400px;
  background:radial-gradient(circle,rgba(13,148,136,.1) 0%,transparent 70%);
  bottom:-100px;right:-100px;animation:floatBlob 6s ease-in-out 2s infinite alternate;
}
@keyframes floatBlob { from{transform:translate(0,0)} to{transform:translate(25px,15px)} }
.auth-box-wide { max-width:480px; }
.pw-strength { height:4px; border-radius:2px; margin-top:6px; transition:all .3s; background:var(--border); overflow:hidden; }
.pw-strength-fill { height:100%; border-radius:2px; transition:width .3s, background .3s; }
</style>
</head>
<body class="auth-page">
<div class="auth-bg-dots"></div>
<div class="auth-box auth-box-wide">
  <div class="auth-logo">
    <div class="auth-logo-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2.5L15 9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <div class="auth-brand">EIDCA</div>
      <div class="auth-sub">CMS Portal</div>
    </div>
  </div>

  <h2 class="auth-title">Tạo tài khoản</h2>
  <p class="auth-desc">Đăng ký để sử dụng các công cụ demo EIDCA và lưu cấu hình của bạn.</p>

  <?php if ($error): ?>
  <div class="auth-error"><?= e($error) ?></div>
  <?php endif; ?>
  <?php if ($success): ?>
  <div style="background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.25);color:#86efac;padding:12px 16px;border-radius:10px;font-size:13px;margin-bottom:1rem;">
    ✅ <?= e($success) ?><br/>
    <a href="<?= _base() ?>/login.html" style="color:#4ade80;font-weight:600;text-decoration:none;">→ Đến trang đăng nhập</a>
  </div>
  <?php endif; ?>

  <?php if (!$success): ?>
  <form class="auth-form" method="POST" id="regForm">
    <?= csrfField() ?>

    <div class="form-group">
      <label for="username">Tên đăng nhập <span style="color:#f87171">*</span></label>
      <input type="text" id="username" name="username" class="form-control"
             placeholder="Tối thiểu 3 ký tự, không dấu"
             value="<?= e($posted['username']) ?>"
             autocomplete="username" minlength="3" maxlength="40" required autofocus/>
    </div>

    <div class="form-group">
      <label for="email">Email <span style="color:#f87171">*</span></label>
      <input type="email" id="email" name="email" class="form-control"
             placeholder="name@example.com"
             value="<?= e($posted['email']) ?>"
             autocomplete="email" required/>
    </div>

    <div class="form-group">
      <label for="password">Mật khẩu <span style="color:#f87171">*</span></label>
      <input type="password" id="password" name="password" class="form-control"
             placeholder="Tối thiểu 6 ký tự" minlength="6" required
             autocomplete="new-password" oninput="checkStrength(this.value)"/>
      <div class="pw-strength"><div class="pw-strength-fill" id="pwFill"></div></div>
    </div>

    <div class="form-group">
      <label for="confirm">Xác nhận mật khẩu <span style="color:#f87171">*</span></label>
      <input type="password" id="confirm" name="confirm" class="form-control"
             placeholder="Nhập lại mật khẩu" required autocomplete="new-password"/>
    </div>

    <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;margin-top:.5rem">
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Tạo tài khoản
    </button>
  </form>
  <?php endif; ?>

  <p class="auth-link">Đã có tài khoản? <a href="<?= _base() ?>/login.html">Đăng nhập</a></p>
</div>

<script src="<?= _base() ?>/assets/cms.js"></script>
<script>
function checkStrength(pw) {
  const fill = document.getElementById('pwFill');
  if (!fill) return;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const colors = ['','#dc2626','#f97316','#eab308','#22c55e','#16a34a'];
  fill.style.width = (score * 20) + '%';
  fill.style.background = colors[score] || '#475569';
}
</script>
</body>
</html>
