<?php
/**
 * EIDCA CMS – Authentication & Session helpers
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

// Khởi tạo session một lần duy nhất
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_lifetime', SESSION_LIFETIME);
    ini_set('session.gc_maxlifetime',  SESSION_LIFETIME);
    session_name('EIDCA_SESS');
    session_start();
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Trả về user hiện tại từ session, hoặc null nếu chưa đăng nhập */
function currentUser(): ?array {
    return $_SESSION['user'] ?? null;
}

/** Kiểm tra đã đăng nhập chưa */
function isLoggedIn(): bool {
    return isset($_SESSION['user']);
}

/** Kiểm tra có phải admin không */
function isAdmin(): bool {
    return ($_SESSION['user']['role'] ?? '') === 'admin';
}

/** Redirect nếu chưa đăng nhập */
function requireLogin(string $redirect = ''): void {
    if (!isLoggedIn()) {
        $back = $redirect ?: _currentUrl();
        header('Location: ' . _base() . '/login.php?next=' . urlencode($back));
        exit;
    }
}

/** Redirect nếu không phải admin */
function requireAdmin(): void {
    requireLogin();
    if (!isAdmin()) {
        header('Location: ' . _base() . '/dashboard.php?err=forbidden');
        exit;
    }
}

/** Đăng nhập: kiểm tra credentials, tạo session */
function doLogin(string $username, string $password): bool {
    $user = DB::row(
        'SELECT * FROM users WHERE (username=? OR email=?) AND is_active=1 LIMIT 1',
        [$username, $username]
    );
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return false;
    }
    // Cập nhật last_login
    DB::exec('UPDATE users SET last_login=NOW() WHERE id=?', [$user['id']]);
    // Ghi session
    $_SESSION['user'] = [
        'id'       => $user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
        'role'     => $user['role'],
        'api_key'  => $user['api_key'],
        'nfc_url'  => $user['nfc_url'] ?: DEFAULT_NFC_URL,
        'cam_url'  => $user['cam_url'] ?: DEFAULT_CAM_URL,
        'partner_code'  => $user['partner_code'],
        'eidca_api_key' => $user['eidca_api_key'],
        'eidca_api_url' => $user['eidca_api_url'] ?: 'https://api.eidca.vn',
    ];
    return true;
}

/** Đăng xuất */
function doLogout(): void {
    $_SESSION = [];
    session_destroy();
    header('Location: ' . _base() . '/login.php');
    exit;
}

/** Đăng ký tài khoản mới */
function doRegister(string $username, string $email, string $password): array {
    // Validate
    if (strlen($username) < 3 || strlen($username) > 40) {
        return ['ok' => false, 'msg' => 'Tên đăng nhập phải từ 3–40 ký tự.'];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'msg' => 'Email không hợp lệ.'];
    }
    if (strlen($password) < 6) {
        return ['ok' => false, 'msg' => 'Mật khẩu ít nhất 6 ký tự.'];
    }
    // Check trùng
    $exist = DB::row('SELECT id FROM users WHERE username=? OR email=? LIMIT 1', [$username, $email]);
    if ($exist) {
        return ['ok' => false, 'msg' => 'Tên đăng nhập hoặc email đã tồn tại.'];
    }
    $hash   = password_hash($password, PASSWORD_BCRYPT);
    $apiKey = _generateApiKey();
    DB::insert(
        'INSERT INTO users (username,email,password_hash,role,api_key,is_active,created_at)
         VALUES (?,?,?,\'user\',?,1,NOW())',
        [$username, $email, $hash, $apiKey]
    );
    return ['ok' => true, 'msg' => 'Đăng ký thành công! Hãy đăng nhập.'];
}

/** Reload thông tin user trong session từ DB */
function refreshSession(): void {
    $u = currentUser();
    if (!$u) return;
    $row = DB::row('SELECT * FROM users WHERE id=? LIMIT 1', [$u['id']]);
    if (!$row) return;
    $_SESSION['user'] = [
        'id'       => $row['id'],
        'username' => $row['username'],
        'email'    => $row['email'],
        'role'     => $row['role'],
        'api_key'  => $row['api_key'],
        'nfc_url'  => $row['nfc_url'] ?: DEFAULT_NFC_URL,
        'cam_url'  => $row['cam_url'] ?: DEFAULT_CAM_URL,
        'partner_code'  => $row['partner_code'],
        'eidca_api_key' => $row['eidca_api_key'],
        'eidca_api_url' => $row['eidca_api_url'] ?: 'https://api.eidca.vn',
    ];
}

// ── CSRF ──────────────────────────────────────────────────────────────────────

function csrfToken(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function csrfField(): string {
    return '<input type="hidden" name="csrf" value="' . htmlspecialchars(csrfToken()) . '">';
}

function verifyCsrf(): bool {
    $token = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    return hash_equals(csrfToken(), $token);
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Trả về URL path đến thư mục cms/ (luôn đúng dù gọi từ admin/ hay không)
 *
 * Ưu tiên:
 *  1. Hằng CMS_BASE_PATH trong config.php (chắc chắn nhất, user tự điền)
 *  2. DOCUMENT_ROOT so sánh với __DIR__ (tự động, đúng trên hầu hết host)
 *  3. Fallback: tính từ SCRIPT_NAME (có thể sai khi ở subdirectory)
 */
function _base(): string {
    // ── 1. Dùng giá trị cấu hình thủ công nếu đã điền ──────────────────────
    if (defined('CMS_BASE_PATH') && CMS_BASE_PATH !== '') {
        return rtrim(CMS_BASE_PATH, '/');
    }

    // ── 2. Tự tính từ filesystem ─────────────────────────────────────────────
    // auth.php luôn ở cms/includes/auth.php → dirname(__DIR__) = cms root
    $cmsDir  = str_replace('\\', '/', dirname(__DIR__));
    $docRoot = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? ''), '/');

    if ($docRoot !== '' && strpos($cmsDir, $docRoot) === 0) {
        return rtrim(substr($cmsDir, strlen($docRoot)), '/');
    }

    // ── 3. Fallback từ SCRIPT_NAME ───────────────────────────────────────────
    $script    = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $scriptDir = rtrim(dirname($script), '/');

    // Nếu script nằm trong admin/ hoặc api/ thì lên 1 cấp
    foreach (['/admin', '/api'] as $sub) {
        if (substr($scriptDir, -strlen($sub)) === $sub) {
            return rtrim(dirname($scriptDir), '/');
        }
    }

    return $scriptDir;
}

/**
 * Trả về URL path đến thư mục cha của cms/ (chứa các file .html demo)
 */
function _demoBase(): string {
    $base = _base();
    return rtrim(dirname($base), '/');
}

function _currentUrl(): string {
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '/');
}

function _generateApiKey(): string {
    return 'ek_' . bin2hex(random_bytes(20));
}
