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

    if ($action === 'clear_sign_props') {
        DB::exec('UPDATE users SET sign_props=NULL WHERE id=?', [$uid]);
        logActivity('sign_props_clear');
        redirect('settings.html', 'Mẫu chữ ký đã được xóa.', 'success');
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

        // Handle sign_props file upload
        $signPropsValue = null; // null = keep existing
        $hasUpload = isset($_FILES['sign_props_file']) && $_FILES['sign_props_file']['error'] !== UPLOAD_ERR_NO_FILE;
        if ($hasUpload) {
            $file = $_FILES['sign_props_file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                redirect('settings.html', 'Lỗi khi upload file mẫu chữ ký.', 'error');
            }
            // Check extension & MIME
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext !== 'json') {
                redirect('settings.html', 'File mẫu chữ ký phải có đuôi .json.', 'error');
            }
            if ($file['size'] > 512 * 1024) { // 512 KB limit
                redirect('settings.html', 'File JSON quá lớn (tối đa 512 KB).', 'error');
            }
            $raw = file_get_contents($file['tmp_name']);
            $decoded = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                redirect('settings.html', 'File JSON không hợp lệ: ' . json_last_error_msg(), 'error');
            }
            if (!is_array($decoded)) {
                redirect('settings.html', 'Nội dung JSON phải là object.', 'error');
            }
            // Minify + wrap in array + encode with unicode escaping
            $minified = json_encode([$decoded], JSON_UNESCAPED_SLASHES);
            // Re-encode to escape unicode (\uXXXX) and escape inner quotes
            $escaped = json_encode($minified, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            // Strip outer string quotes, we store the raw escaped content
            $signPropsValue = trim($escaped, '"');
            logActivity('sign_props_upload', ['filename' => $file['name']]);
        }

        DB::exec('UPDATE users SET nfc_url=?, cam_url=?, partner_code=?, eidca_api_key=?, eidca_api_url=? WHERE id=?', [
            $nfcUrl ?: null, $camUrl ?: null, $partnerCode ?: null, $eidcaApiKey ?: null, $eidcaApiUrl ?: 'https://api.eidca.vn', $uid
        ]);

        // Update sign_props only if a new file was uploaded
        if ($signPropsValue !== null) {
            DB::exec('UPDATE users SET sign_props=? WHERE id=?', [$signPropsValue, $uid]);
        }

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

<form method="POST" enctype="multipart/form-data">
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

  <!-- Sign Props / Mẫu chữ ký card -->
  <div class="card">
    <div class="card-header">
      <h2>
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Mẫu chữ ký (Sign Props)
      </h2>
    </div>
    <div class="card-body">
      <p style="font-size:13.5px;color:var(--text-3);margin-bottom:1.5rem;line-height:1.6">
        Upload file JSON mẫu chữ ký. Hệ thống sẽ tự động convert sang định dạng JSON string escaped để sử dụng trong API ký số.
      </p>

      <?php if (!empty($row['sign_props'])): ?>
      <!-- Existing sign props -->
      <div class="alert alert-info" style="margin-bottom:1.5rem;align-items:flex-start;gap:10px">
        <svg viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:2px"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" stroke-width="1.8"/></svg>
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:4px">Đã có mẫu chữ ký. Upload file mới sẽ ghi đè lên mẫu hiện tại.</div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
          <span>Sign Props String (escaped)</span>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn-copy"
                    onclick="copySignProps(this)" id="btnCopySignProps">
              📋 Copy
            </button>
          </div>
        </label>
        <textarea id="signPropsOutput" class="form-control td-mono" rows="4"
                  readonly style="font-size:11px;line-height:1.6;resize:vertical;word-break:break-all"><?= e($row['sign_props']) ?></textarea>
        <div class="form-hint">Đây là chuỗi sử dụng trực tiếp cho tham số <code>sign_props</code> trong API.</div>
      </div>
      <?php endif; ?>

      <!-- Upload zone -->
      <div id="dropZone" class="sign-props-drop-zone"
           onclick="document.getElementById('signPropsFile').click()"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="handleSignPropsDrop(event)">
        <div class="drop-icon">
          <svg viewBox="0 0 24 24" fill="none" width="32" height="32"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="drop-text">Kéo thả file JSON vào đây hoặc <span class="drop-link">chọn file</span></div>
        <div class="drop-hint">Chấp nhận: .json • Tối đa 512 KB</div>
        <div id="dropFileName" class="drop-filename" style="display:none"></div>
      </div>
      <input type="file" name="sign_props_file" id="signPropsFile" accept=".json,application/json"
             style="display:none" onchange="handleSignPropsFile(this)">

      <?php if (!empty($row['sign_props'])): ?>
      <!-- Delete form -->
      <div style="margin-top:1rem">
        <form method="POST" style="display:inline"
              onsubmit="return confirm('Xóa mẫu chữ ký hiện tại?')">
          <?= csrfField() ?>
          <input type="hidden" name="action" value="clear_sign_props"/>
          <button type="submit" class="btn btn-danger btn-sm">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Xóa mẫu chữ ký
          </button>
        </form>
      </div>
      <?php endif; ?>
    </div>
  </div>


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

<style>
/* ── Sign Props Drop Zone ─────────────────────────────────────────────── */
.sign-props-drop-zone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: border-color .2s, background .2s;
  background: var(--bg-2);
  position: relative;
}
.sign-props-drop-zone:hover,
.sign-props-drop-zone.drag-over {
  border-color: var(--violet);
  background: rgba(109,40,217,.05);
}
.sign-props-drop-zone.drag-over {
  border-style: solid;
}
.sign-props-drop-zone.has-file {
  border-color: #10b981;
  background: rgba(16,185,129,.05);
}
.drop-icon {
  color: var(--text-3);
  margin-bottom: .75rem;
  transition: color .2s;
}
.sign-props-drop-zone:hover .drop-icon,
.sign-props-drop-zone.drag-over .drop-icon {
  color: var(--violet);
}
.sign-props-drop-zone.has-file .drop-icon { color: #10b981; }
.drop-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  margin-bottom: .3rem;
}
.drop-link {
  color: var(--violet);
  text-decoration: underline;
  cursor: pointer;
}
.drop-hint {
  font-size: 12px;
  color: var(--text-3);
}
.drop-filename {
  margin-top: .75rem;
  padding: .4rem .9rem;
  background: rgba(16,185,129,.12);
  color: #10b981;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>

<script>
function handleSignPropsFile(input) {
  const file = input.files[0];
  if (!file) return;
  const zone = document.getElementById('dropZone');
  const label = document.getElementById('dropFileName');
  zone.classList.add('has-file');
  label.style.display = 'inline-flex';
  label.textContent = '✅ ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
}

function handleSignPropsDrop(event) {
  event.preventDefault();
  const zone = document.getElementById('dropZone');
  zone.classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json')) {
    alert('Chỉ chấp nhận file .json');
    return;
  }
  const input = document.getElementById('signPropsFile');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  handleSignPropsFile(input);
}

function copySignProps(btn) {
  const ta = document.getElementById('signPropsOutput');
  if (!ta) return;
  navigator.clipboard.writeText(ta.value).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✅ Đã copy!';
    btn.style.background = 'rgba(16,185,129,.15)';
    btn.style.color = '#10b981';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}
</script>

<?php layoutFooter(); ?>
