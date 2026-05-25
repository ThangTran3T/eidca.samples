<?php
/**
 * EIDCA CMS – Cấu hình API Key & Socket URLs
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/layout.php';

requireLogin();
$user = currentUser();
$uid  = $user['id'];

// ── Handle POST ───────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) redirect('settings.html', 'Yêu cầu không hợp lệ.', 'error');

    $action = $_POST['action'] ?? 'update_settings';

    if ($action === 'reset_api_key') {
        $newKey = 'ek_' . bin2hex(random_bytes(20));
        DB::exec('UPDATE users SET api_key=? WHERE id=?', [$newKey, $uid]);
        logActivity('api_key_reset');
        refreshSession();
        redirect('settings.html', 'API Key đã được tạo lại thành công.', 'success');
    }

    if ($action === 'update_settings') {
        $nfcUrl      = trim($_POST['nfc_url']  ?? '');
        $camUrl      = trim($_POST['cam_url']  ?? '');
        $partnerCode = trim($_POST['partner_code'] ?? '');
        $eidcaApiKey = trim($_POST['eidca_api_key'] ?? '');
        $eidcaApiUrl = trim($_POST['eidca_api_url'] ?? '');
        $newPw       = $_POST['new_password']  ?? '';
        $confirm     = $_POST['confirm_pw']    ?? '';

        // Validate URLs
        foreach (['nfc_url' => $nfcUrl, 'cam_url' => $camUrl] as $field => $val) {
            if ($val && !filter_var($val, FILTER_VALIDATE_URL)) {
                redirect('settings.html', "URL không hợp lệ: $field", 'error');
            }
        }
        if ($eidcaApiUrl && !filter_var($eidcaApiUrl, FILTER_VALIDATE_URL)) {
            redirect('settings.html', "API URL Nhà cung cấp không hợp lệ.", 'error');
        }

        DB::exec('UPDATE users SET nfc_url=?, cam_url=?, partner_code=?, eidca_api_key=?, eidca_api_url=? WHERE id=?', [
            $nfcUrl ?: null, $camUrl ?: null, $partnerCode ?: null, $eidcaApiKey ?: null, $eidcaApiUrl ?: 'https://api.eidca.vn', $uid
        ]);

        // Change password?
        if ($newPw !== '') {
            if (strlen($newPw) < 6) {
                redirect('settings.html', 'Mật khẩu mới phải ít nhất 6 ký tự.', 'error');
            }
            if ($newPw !== $confirm) {
                redirect('settings.html', 'Mật khẩu xác nhận không khớp.', 'error');
            }
            $hash = password_hash($newPw, PASSWORD_BCRYPT);
            DB::exec('UPDATE users SET password_hash=? WHERE id=?', [$hash, $uid]);
        }

        logActivity('settings_update', [
            'nfc_url' => $nfcUrl,
            'cam_url' => $camUrl,
            'partner_code' => $partnerCode,
            'eidca_api_url' => $eidcaApiUrl,
            'pw_changed' => $newPw !== ''
        ]);
        refreshSession();
        redirect('settings.html', 'Cài đặt đã được lưu thành công.', 'success');
    }
}

// Reload fresh from DB
$row = DB::row('SELECT * FROM users WHERE id=? LIMIT 1', [$uid]);

layoutHeader('Cấu hình & API Key', 'settings');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Cấu hình & API Key</h1>
    <p>Quản lý API Key và cài đặt kết nối thiết bị của bạn.</p>
  </div>
</div>

<form method="POST">
  <?= csrfField() ?>
  <input type="hidden" name="action" value="update_settings"/>

  <!-- API Key card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        API Key
      </h2>
    </div>
    <div class="card-body">
      <div class="alert alert-info" style="margin-bottom:1.5rem">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <div>API Key được sử dụng để xác thực khi ghi log từ các trang demo. Tuyệt đối <strong>không chia sẻ</strong> API Key với người khác.</div>
      </div>

      <div class="form-group">
        <label>API Key của bạn</label>
        <div class="input-group">
          <input type="text" class="form-control td-mono" id="apiKeyField"
                 value="<?= e($row['api_key']) ?>" readonly/>
          <button type="button" class="btn-copy"
                  onclick="copyToClipboard(document.getElementById('apiKeyField').value, this)">
            📋 Copy
          </button>
        </div>
        <div class="form-hint">Tạo lại sẽ vô hiệu hóa key cũ ngay lập tức.</div>
      </div>

      <button type="button" class="btn btn-danger btn-sm" onclick="resetApiKey()">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M1 4v6h6M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Tạo lại API Key
      </button>
      <input type="hidden" name="csrf" id="_csrfHidden" value="<?= csrfToken() ?>"/>
    </div>
  </div>

  <!-- Socket config card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" stroke-width="1.8"/></svg>
        Cài đặt kết nối thiết bị
      </h2>
    </div>
    <div class="card-body">
      <p style="font-size:13.5px;color:var(--text-3);margin-bottom:1.5rem;line-height:1.6">
        Cấu hình URL kết nối đến thiết bị NFC reader và Webcam. Nếu để trống, hệ thống sẽ sử dụng URL mặc định.
      </p>

      <div class="form-row">
        <div class="form-group">
          <label>NFC Socket URL</label>
          <input type="url" name="nfc_url" class="form-control"
                 placeholder="<?= e(DEFAULT_NFC_URL) ?>"
                 value="<?= e($row['nfc_url'] ?? '') ?>"/>
          <div class="form-hint">Địa chỉ WebSocket server đọc CCCD (VD: https://192.168.5.1:8000)</div>
        </div>
        <div class="form-group">
          <label>Webcam Socket URL</label>
          <input type="url" name="cam_url" class="form-control"
                 placeholder="<?= e(DEFAULT_CAM_URL) ?>"
                 value="<?= e($row['cam_url'] ?? '') ?>"/>
          <div class="form-hint">Địa chỉ WebSocket server Webcam (VD: https://192.168.5.1:9000)</div>
        </div>
      </div>

      <!-- Code snippet -->
      <div style="margin-top:1rem">
        <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:.75rem">
          📋 Snippet tích hợp vào trang demo:
        </div>
        <div class="code-block">
          <span class="cmt">// Dán vào &lt;head&gt; của trang demo</span><br/>
          <span class="kw">const</span> <span class="var">NFC_URL</span> = <span class="str">'<?= e($row['nfc_url'] ?: DEFAULT_NFC_URL) ?>'</span>;<br/>
          <span class="kw">const</span> <span class="var">CAM_URL</span> = <span class="str">'<?= e($row['cam_url'] ?: DEFAULT_CAM_URL) ?>'</span>;<br/>
          <span class="kw">const</span> <span class="var">EIDCA_API_KEY</span> = <span class="str">'<?= e($row['api_key']) ?>'</span>;
        </div>
      </div>
    </div>
  </div>

  <!-- Provider API config card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Cấu hình API Nhà cung cấp eIDCA (Provider API)
      </h2>
    </div>
    <div class="card-body">
      <p style="font-size:13.5px;color:var(--text-3);margin-bottom:1.5rem;line-height:1.6">
        Thông tin kết nối API thực tế của đơn vị đối tác, dùng để gọi trực tiếp các dịch vụ đăng ký và ký số của eIDCA.
      </p>

      <div class="form-row">
        <div class="form-group">
          <label>Mã đối tác (Partner Code)</label>
          <input type="text" name="partner_code" class="form-control td-mono"
                 placeholder="Ví dụ: PARTNER_DEMO_001"
                 value="<?= e($row['partner_code'] ?? '') ?>"/>
          <div class="form-hint">Mã đối tác/Sub-partner do eIDCA cấp.</div>
        </div>
        <div class="form-group">
          <label>API Key (Nhà cung cấp)</label>
          <input type="password" name="eidca_api_key" class="form-control td-mono"
                 placeholder="API Key kết nối eIDCA..."
                 value="<?= e($row['eidca_api_key'] ?? '') ?>"/>
          <div class="form-hint">Khóa bảo mật kết nối API thực tế của eIDCA.</div>
        </div>
      </div>

      <div class="form-group">
        <label>API Base URL (eIDCA URL)</label>
        <input type="url" name="eidca_api_url" class="form-control td-mono"
               placeholder="https://api.eidca.vn"
               value="<?= e($row['eidca_api_url'] ?? 'https://api.eidca.vn') ?>"/>
        <div class="form-hint">Đường dẫn cơ sở gọi API nhà cung cấp eIDCA (mặc định: https://api.eidca.vn).</div>
      </div>
    </div>
  </div>

  <!-- Change password card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Đổi mật khẩu
      </h2>
    </div>
    <div class="card-body">
      <div class="form-row">
        <div class="form-group">
          <label>Mật khẩu mới</label>
          <input type="password" name="new_password" class="form-control"
                 placeholder="Để trống nếu không đổi" autocomplete="new-password" minlength="6"/>
          <div class="form-hint">Tối thiểu 6 ký tự.</div>
        </div>
        <div class="form-group">
          <label>Xác nhận mật khẩu mới</label>
          <input type="password" name="confirm_pw" class="form-control"
                 placeholder="Nhập lại mật khẩu mới" autocomplete="new-password"/>
        </div>
      </div>
    </div>
  </div>

  <!-- Account info card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/></svg>
        Thông tin tài khoản
      </h2>
    </div>
    <div class="card-body">
      <table class="cert-table" style="width:auto;min-width:300px">
        <tr><th style="padding:8px 20px 8px 0;font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Tên đăng nhập</th>
            <td style="padding:8px 0"><?= e($row['username']) ?></td></tr>
        <tr><th>Email</th><td><?= e($row['email']) ?></td></tr>
        <tr><th>Vai trò</th><td>
          <span class="badge <?= $row['role']==='admin' ? 'badge-violet' : 'badge-blue' ?>">
            <?= $row['role'] === 'admin' ? '⚡ Admin' : '👤 User' ?>
          </span>
        </td></tr>
        <tr><th>Đăng nhập lần cuối</th><td><?= fmtDate($row['last_login']) ?></td></tr>
        <tr><th>Ngày tạo</th><td><?= fmtDate($row['created_at']) ?></td></tr>
      </table>
    </div>
  </div>

  <div class="btn-row">
    <a href="dashboard.html" class="btn btn-secondary">Hủy</a>
    <button type="submit" class="btn btn-primary">
      <svg viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.8"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Lưu cài đặt
    </button>
  </div>
</form>

<?php layoutFooter(); ?>
