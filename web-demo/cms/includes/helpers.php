<?php
/**
 * EIDCA CMS – Helper utilities
 * Tương thích PHP 7.4+
 */

/** Escape HTML */
function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Format datetime Việt Nam */
function fmtDate(?string $dt, bool $withTime = true): string {
    if (!$dt) return '—';
    try {
        $d = new DateTime($dt);
        return $withTime
            ? $d->format('d/m/Y H:i:s')
            : $d->format('d/m/Y');
    } catch (\Exception $e) {
        return $dt;
    }
}

/** Truncate chuỗi */
function truncate(string $s, int $len = 60): string {
    return mb_strlen($s) > $len ? mb_substr($s, 0, $len) . '…' : $s;
}

/**
 * Nhãn loại action – PHP 7.4 compatible (dùng switch thay match)
 */
function actionLabel(string $type): array {
    switch ($type) {
        case 'register_cert':    return ['Đăng ký CTS',        'badge-blue'];
        case 'sign_doc':         return ['Ký số',               'badge-violet'];
        case 'dkcn':             return ['ĐK chứng nhận',       'badge-teal'];
        case 'login':            return ['Đăng nhập',           'badge-gray'];
        case 'logout':           return ['Đăng xuất',           'badge-gray'];
        case 'register_account': return ['Đăng ký tài khoản',  'badge-green'];
        case 'settings_update':  return ['Cập nhật cấu hình',  'badge-warn'];
        case 'api_key_reset':    return ['Reset API Key',       'badge-danger'];
        case 'admin_toggle_user': return ['Admin: Toggle User', 'badge-warn'];
        case 'admin_role_change': return ['Admin: Đổi role',   'badge-warn'];
        case 'admin_reset_api_key': return ['Admin: Reset Key','badge-danger'];
        case 'admin_delete_user': return ['Admin: Xóa user',   'badge-danger'];
        default:                 return [e($type),              'badge-gray'];
    }
}

/** Ghi activity log */
function logActivity(string $actionType, array $payload = []): void {
    $user  = currentUser();
    $uid   = $user['id'] ?? null;
    $ip    = isset($_SERVER['HTTP_X_FORWARDED_FOR'])
           ? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]
           : ($_SERVER['REMOTE_ADDR'] ?? '');
    $ua    = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400);
    DB::insert(
        'INSERT INTO activity_logs (user_id, action_type, payload_json, ip, user_agent, created_at)
         VALUES (?,?,?,?,?,NOW())',
        [$uid, $actionType, json_encode($payload, JSON_UNESCAPED_UNICODE), $ip, $ua]
    );
}

/** Redirect với flash message – PHP 7.4 dùng void thay never */
function redirect(string $url, string $msg = '', string $type = 'success'): void {
    if ($msg) {
        $_SESSION['flash'] = ['type' => $type, 'msg' => $msg];
    }
    header('Location: ' . $url);
    exit;
}

/** Lấy & xóa flash message */
function flash(): ?array {
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}

/** JSON response helper – void thay never */
function jsonResponse(bool $ok, string $msg, array $data = []): void {
    header('Content-Type: application/json; charset=utf-8');
    // Dùng array_merge thay spread operator để tương thích PHP 7.4
    echo json_encode(array_merge(['ok' => $ok, 'msg' => $msg], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

/** Xây dựng URL với query string */
function buildUrl(string $path, array $params = []): string {
    return $path . ($params ? '?' . http_build_query($params) : '');
}
