<?php
/**
 * EIDCA CMS – Install (Chạy 1 lần để tạo bảng MySQL)
 * Truy cập: http://yoursite.com/cms/install.php
 * SAU KHI CHẠY XONG → XÓA HOẶC ĐỔI TÊN FILE NÀY!
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/db.php';

$errors = [];
$done   = [];

function run(string $label, string $sql): void {
    global $errors, $done;
    try {
        DB::get()->exec($sql);
        $done[] = "✅ $label";
    } catch (PDOException $e) {
        $errors[] = "❌ $label: " . $e->getMessage();
    }
}

// ── Create tables ──────────────────────────────────────────────────────────────

run('Bảng users', "
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(40) NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','user') NOT NULL DEFAULT 'user',
    api_key       VARCHAR(60) NOT NULL UNIQUE,
    nfc_url       VARCHAR(255) DEFAULT NULL,
    cam_url       VARCHAR(255) DEFAULT NULL,
    partner_code  VARCHAR(255) DEFAULT NULL,
    eidca_api_key VARCHAR(255) DEFAULT NULL,
    eidca_api_url VARCHAR(255) DEFAULT 'https://api.eidca.vn',
    sign_props    TEXT DEFAULT NULL,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    last_login    DATETIME DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// Check and add missing columns if upgrading from older version
try {
    $db = DB::get();
    
    // Add partner_code
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'partner_code'")->fetchAll();
    if (empty($cols)) {
        $db->exec("ALTER TABLE users ADD COLUMN partner_code VARCHAR(255) DEFAULT NULL AFTER cam_url");
        $done[] = "Nâng cấp: Thêm cột partner_code thành công.";
    }

    // Add eidca_api_key
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'eidca_api_key'")->fetchAll();
    if (empty($cols)) {
        $db->exec("ALTER TABLE users ADD COLUMN eidca_api_key VARCHAR(255) DEFAULT NULL AFTER partner_code");
        $done[] = "Nâng cấp: Thêm cột eidca_api_key thành công.";
    }

    // Add eidca_api_url
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'eidca_api_url'")->fetchAll();
    if (empty($cols)) {
        $db->exec("ALTER TABLE users ADD COLUMN eidca_api_url VARCHAR(255) DEFAULT 'https://api.eidca.vn' AFTER eidca_api_key");
        $done[] = "Nâng cấp: Thêm cột eidca_api_url thành công.";
    }

    // Add sign_props
    $cols = $db->query("SHOW COLUMNS FROM users LIKE 'sign_props'")->fetchAll();
    if (empty($cols)) {
        $db->exec("ALTER TABLE users ADD COLUMN sign_props TEXT DEFAULT NULL AFTER eidca_api_url");
        $done[] = "Nâng cấp: Thêm cột sign_props thành công.";
    }
} catch (PDOException $e) {
    $errors[] = "Lỗi khi nâng cấp cấu trúc bảng users: " . $e->getMessage();
}


run('Bảng activity_logs', "
CREATE TABLE IF NOT EXISTS activity_logs (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED DEFAULT NULL,
    action_type VARCHAR(60) NOT NULL,
    payload_json TEXT DEFAULT NULL,
    ip          VARCHAR(60) DEFAULT NULL,
    user_agent  VARCHAR(500) DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user   (user_id),
    INDEX idx_action (action_type),
    INDEX idx_time   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ── Seed admin account ─────────────────────────────────────────────────────────
$admin = DB::row("SELECT id FROM users WHERE username='admin' LIMIT 1");
if (!$admin) {
    $hash   = password_hash('Admin@2026', PASSWORD_BCRYPT);
    $apiKey = 'ek_' . bin2hex(random_bytes(20));
    run('Tạo tài khoản admin mặc định', "
    INSERT INTO users (username,email,password_hash,role,api_key,is_active,created_at)
    VALUES ('admin','admin@eidca.local','$hash','admin','$apiKey',1,NOW())
    ");
    $done[] = "🔑 Admin API Key: $apiKey";
} else {
    $done[] = "ℹ️ Tài khoản admin đã tồn tại, bỏ qua seed.";
}

?><!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>EIDCA CMS – Install</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem;max-width:600px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:2rem}
.logo-icon{width:44px;height:44px;background:linear-gradient(135deg,#6d28d9,#4f46e5);border-radius:10px;display:flex;align-items:center;justify-content:center}
h1{font-size:22px;font-weight:700;color:#f1f5f9}
.sub{font-size:13px;color:#64748b;margin-top:4px}
.result{margin-top:1.5rem;display:flex;flex-direction:column;gap:8px}
.result-item{padding:10px 14px;border-radius:8px;font-size:13.5px;font-family:monospace}
.ok{background:#14532d;color:#86efac;border:1px solid #166534}
.err{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}
.warn{background:#1c1917;color:#d4d4aa;border:1px solid #44403c}
.actions{margin-top:2rem;display:flex;gap:10px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;text-decoration:none;border:none;font-family:'Inter',sans-serif;transition:opacity .15s}
.btn-primary{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff}
.btn-danger{background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b}
.btn:hover{opacity:.85}
.notice{margin-top:1.5rem;padding:12px 16px;background:#1c2b3a;border:1px solid #1e4070;border-radius:8px;font-size:13px;color:#93c5fd;line-height:1.6}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2.5L15 9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <h1>EIDCA CMS – Cài đặt</h1>
      <div class="sub">Khởi tạo cơ sở dữ liệu MySQL</div>
    </div>
  </div>

  <div class="result">
    <?php foreach ($done as $msg): ?>
    <div class="result-item ok"><?= htmlspecialchars($msg) ?></div>
    <?php endforeach; ?>
    <?php foreach ($errors as $msg): ?>
    <div class="result-item err"><?= htmlspecialchars($msg) ?></div>
    <?php endforeach; ?>
  </div>

  <?php if (empty($errors)): ?>
  <div class="notice">
    ✅ Cài đặt hoàn tất!<br/>
    📌 Tài khoản mặc định: <strong>admin</strong> / <strong>Admin@2026</strong><br/>
    ⚠️ <strong>Hãy xóa hoặc đổi tên file <code>install.php</code> ngay sau khi cài đặt!</strong>
  </div>
  <div class="actions">
    <a href="login.html" class="btn btn-primary">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Đến trang đăng nhập
    </a>
  </div>
  <?php else: ?>
  <div class="notice" style="border-color:#7f1d1d;color:#fca5a5;background:#1a0a0a">
    ❌ Có lỗi xảy ra. Kiểm tra lại thông tin trong <code>config.php</code> và đảm bảo database <strong><?= htmlspecialchars(DB_NAME) ?></strong> đã tồn tại.
  </div>
  <?php endif; ?>
</div>
</body>
</html>
