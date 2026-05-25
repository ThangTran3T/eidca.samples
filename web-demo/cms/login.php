<?php
/**
 * EIDCA CMS – Trang đăng nhập
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

// Nếu đã đăng nhập thì redirect
if (isLoggedIn()) {
    header('Location: ' . _base() . '/dashboard.html');
    exit;
}

$error = '';

// Lấy URL redirect sau đăng nhập (chỉ chấp nhận đường dẫn local, không full URL ngoài)
function safeNext(string $url): string {
    $default = _base() . '/dashboard.html';
    // Nếu rỗng → dùng default
    if ($url === '') return $default;
    // Nếu là URL tuyệt đối (có scheme) → chỉ giữ lại nếu cùng host
    if (preg_match('#^https?://#i', $url)) {
        $host = parse_url($url, PHP_URL_HOST);
        if ($host !== ($_SERVER['HTTP_HOST'] ?? '')) return $default;
    }
    // Không cho phép //domain (protocol-relative)
    if (strpos($url, '//') === 0) return $default;
    return $url;
}

// Khi GET: lấy từ query string; khi POST: lấy từ hidden field
$next = safeNext(trim(
    $_SERVER['REQUEST_METHOD'] === 'POST'
        ? ($_POST['next'] ?? '')
        : ($_GET['next']  ?? '')
));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) {
        $error = 'Yêu cầu không hợp lệ, hãy thử lại.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        if (doLogin($username, $password)) {
            // Ghi log sau khi session đã có user
            try { logActivity('login'); } catch (\Exception $ex) { /* bỏ qua nếu DB lỗi */ }
            header('Location: ' . $next);
            exit;
        } else {
            $error = 'Tên đăng nhập hoặc mật khẩu không đúng.';
        }
    }
}
?><!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Đăng nhập – EIDCA CMS</title>
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
  background:radial-gradient(circle,rgba(124,58,237,.15) 0%,transparent 70%);
  top:-200px;right:-200px;animation:floatBlob 8s ease-in-out infinite alternate;
}
.auth-bg-dots::after {
  content:'';position:absolute;width:400px;height:400px;
  background:radial-gradient(circle,rgba(79,70,229,.12) 0%,transparent 70%);
  bottom:-100px;left:-100px;animation:floatBlob 6s ease-in-out 2s infinite alternate;
}
@keyframes floatBlob { from{transform:translate(0,0)} to{transform:translate(30px,20px)} }
.show-pw {
  position:absolute;right:12px;top:50%;transform:translateY(-50%);
  background:none;border:none;cursor:pointer;color:#475569;
  display:flex;align-items:center;padding:4px;
}
.show-pw:hover { color:#a78bfa; }
.pw-wrap { position:relative; }
.pw-wrap .form-control { padding-right: 40px; }
</style>
</head>
<body class="auth-page">
<div class="auth-bg-dots"></div>
<div class="auth-box">
  <div class="auth-logo">
    <div class="auth-logo-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2.5L15 9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <div class="auth-brand">EIDCA</div>
      <div class="auth-sub">CMS Portal</div>
    </div>
  </div>

  <h2 class="auth-title">Đăng nhập</h2>
  <p class="auth-desc">Nhập thông tin tài khoản để truy cập hệ thống.</p>

  <?php if ($error): ?>
  <div class="auth-error">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="display:inline;vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <?= e($error) ?>
  </div>
  <?php endif; ?>

  <form class="auth-form" method="POST" autocomplete="on" id="loginForm">
    <?= csrfField() ?>
    <input type="hidden" name="next" value="<?= e($next) ?>"/>
    
    <div class="form-group">
      <label for="username">Tên đăng nhập hoặc Email</label>
      <input type="text" id="username" name="username" class="form-control"
             placeholder="admin hoặc admin@eidca.local"
             value="<?= e($_POST['username'] ?? '') ?>"
             autocomplete="username" required autofocus/>
    </div>

    <div class="form-group">
      <label for="password">Mật khẩu</label>
      <div class="pw-wrap">
        <input type="password" id="password" name="password" class="form-control"
               placeholder="••••••••" autocomplete="current-password" required/>
        <button type="button" class="show-pw" onclick="togglePw(this)" aria-label="Hiện/ẩn mật khẩu">
          <svg id="eyeIcon" width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
        </button>
      </div>
    </div>

    <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;margin-top:.5rem" id="submitBtn">
      <svg viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Đăng nhập
    </button>
  </form>

  <?php if (ALLOW_SELF_REGISTER): ?>
  <p class="auth-link">Chưa có tài khoản? <a href="<?= _base() ?>/register.html">Đăng ký ngay</a></p>
  <?php endif; ?>
</div>

<script src="<?= _base() ?>/assets/cms.js"></script>
<script>
function togglePw(btn) {
  const inp = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  } else {
    inp.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>';
  }
}
document.getElementById('loginForm').addEventListener('submit', () => {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang đăng nhập…';
});
</script>
</body>
</html>
