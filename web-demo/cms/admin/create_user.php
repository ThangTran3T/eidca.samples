<?php
/**
 * EIDCA CMS – Admin: Tạo tài khoản User mới
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/layout.php';

requireAdmin();

$errors  = [];
$posted  = ['username' => '', 'email' => '', 'role' => 'user', 'nfc_url' => '', 'cam_url' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) {
        $errors[] = 'Yêu cầu không hợp lệ, hãy thử lại.';
    } else {
        $posted['username'] = trim($_POST['username'] ?? '');
        $posted['email']    = trim($_POST['email']    ?? '');
        $posted['role']     = in_array($_POST['role'] ?? '', ['admin', 'user'], true) ? $_POST['role'] : 'user';
        $posted['nfc_url']  = trim($_POST['nfc_url']  ?? '');
        $posted['cam_url']  = trim($_POST['cam_url']  ?? '');
        $password           = $_POST['password']      ?? '';
        $confirm            = $_POST['confirm']        ?? '';

        // Validate
        if (strlen($posted['username']) < 3 || strlen($posted['username']) > 40) {
            $errors[] = 'Tên đăng nhập phải từ 3–40 ký tự.';
        }
        if (!filter_var($posted['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Email không hợp lệ.';
        }
        if (strlen($password) < 6) {
            $errors[] = 'Mật khẩu phải ít nhất 6 ký tự.';
        }
        if ($password !== $confirm) {
            $errors[] = 'Mật khẩu xác nhận không khớp.';
        }
        if ($posted['nfc_url'] && !filter_var($posted['nfc_url'], FILTER_VALIDATE_URL)) {
            $errors[] = 'NFC Socket URL không hợp lệ.';
        }
        if ($posted['cam_url'] && !filter_var($posted['cam_url'], FILTER_VALIDATE_URL)) {
            $errors[] = 'Webcam Socket URL không hợp lệ.';
        }

        if (empty($errors)) {
            // Check trùng
            $exist = DB::row(
                'SELECT id FROM users WHERE username=? OR email=? LIMIT 1',
                [$posted['username'], $posted['email']]
            );
            if ($exist) {
                $errors[] = 'Tên đăng nhập hoặc email đã tồn tại trong hệ thống.';
            } else {
                $hash   = password_hash($password, PASSWORD_BCRYPT);
                $apiKey = 'ek_' . bin2hex(random_bytes(20));
                DB::insert(
                    'INSERT INTO users (username, email, password_hash, role, api_key,
                                       nfc_url, cam_url, is_active, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())',
                    [
                        $posted['username'],
                        $posted['email'],
                        $hash,
                        $posted['role'],
                        $apiKey,
                        $posted['nfc_url'] ?: null,
                        $posted['cam_url'] ?: null,
                    ]
                );
                logActivity('admin_create_user', [
                    'username' => $posted['username'],
                    'email'    => $posted['email'],
                    'role'     => $posted['role'],
                ]);
                redirect(_base() . '/admin/users.html', 'Tài khoản <strong>' . e($posted['username']) . '</strong> đã được tạo thành công.', 'success');
            }
        }
    }
}

layoutHeader('Tạo tài khoản mới', 'admin_users');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Tạo tài khoản mới</h1>
    <p>Admin tạo tài khoản và cấu hình sẵn cho người dùng.</p>
  </div>
  <a href="<?= _base() ?>/admin/users.html" class="btn btn-secondary btn-sm">
    <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Quay lại danh sách
  </a>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-danger" style="margin-bottom:1.5rem">
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  <div>
    <?php foreach ($errors as $err): ?>
    <div><?= e($err) ?></div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<form method="POST" id="createUserForm">
  <?= csrfField() ?>

  <!-- Thông tin tài khoản -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/></svg>
        Thông tin tài khoản
      </h2>
    </div>
    <div class="card-body">
      <div class="form-row">
        <div class="form-group">
          <label>Tên đăng nhập <span class="req">*</span></label>
          <input type="text" name="username" class="form-control"
                 placeholder="vd: nguyen.van.a"
                 value="<?= e($posted['username']) ?>"
                 minlength="3" maxlength="40" required autofocus/>
          <div class="form-hint">3–40 ký tự, không dấu, không khoảng trắng.</div>
        </div>
        <div class="form-group">
          <label>Email <span class="req">*</span></label>
          <input type="email" name="email" class="form-control"
                 placeholder="user@example.com"
                 value="<?= e($posted['email']) ?>" required/>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Mật khẩu <span class="req">*</span></label>
          <input type="password" name="password" class="form-control"
                 placeholder="Tối thiểu 6 ký tự" minlength="6" required
                 autocomplete="new-password" id="pwField" oninput="checkStrength(this.value)"/>
          <div class="pw-strength"><div class="pw-strength-fill" id="pwFill"></div></div>
        </div>
        <div class="form-group">
          <label>Xác nhận mật khẩu <span class="req">*</span></label>
          <input type="password" name="confirm" class="form-control"
                 placeholder="Nhập lại mật khẩu" required
                 autocomplete="new-password" id="pwConfirm"/>
        </div>
      </div>

      <div class="form-group" style="max-width:240px">
        <label>Vai trò</label>
        <select name="role" class="form-control">
          <option value="user"  <?= $posted['role']==='user'  ? 'selected' : '' ?>>👤 User</option>
          <option value="admin" <?= $posted['role']==='admin' ? 'selected' : '' ?>>⚡ Admin</option>
        </select>
        <div class="form-hint">Admin có toàn quyền quản trị hệ thống.</div>
      </div>
    </div>
  </div>

  <!-- Cấu hình thiết bị (tùy chọn) -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" stroke-width="1.8"/></svg>
        Cấu hình kết nối thiết bị <span style="font-size:12px;font-weight:400;color:var(--text-3)">(tùy chọn)</span>
      </h2>
    </div>
    <div class="card-body">
      <p style="font-size:13.5px;color:var(--text-3);margin-bottom:1.25rem;line-height:1.6">
        Nếu để trống, hệ thống sẽ dùng URL mặc định. User có thể tự thay đổi sau trong phần Cài đặt.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label>NFC Socket URL</label>
          <input type="url" name="nfc_url" class="form-control"
                 placeholder="<?= e(DEFAULT_NFC_URL) ?>"
                 value="<?= e($posted['nfc_url']) ?>"/>
        </div>
        <div class="form-group">
          <label>Webcam Socket URL</label>
          <input type="url" name="cam_url" class="form-control"
                 placeholder="<?= e(DEFAULT_CAM_URL) ?>"
                 value="<?= e($posted['cam_url']) ?>"/>
        </div>
      </div>
    </div>
  </div>

  <div class="btn-row">
    <a href="<?= _base() ?>/admin/users.html" class="btn btn-secondary">Hủy</a>
    <button type="submit" class="btn btn-primary" id="submitBtn">
      <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.8"/></svg>
      Tạo tài khoản
    </button>
  </div>
</form>

<?php layoutFooter(); ?>
<script>
// Password strength meter
function checkStrength(pw) {
  var fill = document.getElementById('pwFill');
  if (!fill) return;
  var score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  var colors = ['','#dc2626','#f97316','#eab308','#22c55e','#16a34a'];
  fill.style.width   = (score * 20) + '%';
  fill.style.background = colors[score] || '#475569';
}

// Loading state on submit
document.getElementById('createUserForm').addEventListener('submit', function() {
  var btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang tạo…';
});
</script>
