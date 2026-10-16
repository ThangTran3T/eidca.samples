<?php
/**
 * EIDCA CMS – API endpoint: Ghi log sự kiện từ demo pages
 * POST /cms/api/log_event.php
 * Body JSON: { "action": "register_cert"|"sign_doc"|"dkcn", "payload": {...} }
 * Auth: Session cookie hoặc Bearer <api_key>
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo '{"ok":false,"msg":"Method Not Allowed"}'; exit; }

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

// ── Resolve user: session hoặc API Key ────────────────────────────────────────
$userId = null;

// 1. Session (nếu đang login trên browser)
if (isLoggedIn()) {
    $userId = currentUser()['id'];
}

// 2. Bearer token / X-Api-Key header
if (!$userId) {
    $apiKey = '';
    $auth   = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($auth, 'Bearer ')) {
        $apiKey = substr($auth, 7);
    }
    if (!$apiKey) {
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? ($_GET['api_key'] ?? '');
    }
    if ($apiKey) {
        $row = DB::row('SELECT id FROM users WHERE api_key=? AND is_active=1 LIMIT 1', [$apiKey]);
        if ($row) $userId = $row['id'];
    }
}

if (!$userId) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'msg' => 'Unauthorized – cần đăng nhập hoặc cung cấp API Key hợp lệ.']);
    exit;
}

// ── Parse body ────────────────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);
if (!$body || !isset($body['action'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'msg' => 'Body JSON không hợp lệ. Cần field "action".']);
    exit;
}

$allowed = ['register_cert', 'sign_doc', 'dkcn', 'custom'];
$action  = $body['action'];
if (!in_array($action, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'msg' => 'Loại action không được phép: ' . $action]);
    exit;
}

$payload = $body['payload'] ?? [];
if (!is_array($payload)) $payload = [];

// Sanitize payload: chỉ giữ chuỗi/số, loại bỏ giá trị quá dài
$clean = [];
foreach ($payload as $k => $v) {
    if (is_scalar($v)) {
        $clean[substr((string)$k, 0, 50)] = mb_substr((string)$v, 0, 500);
    }
}

// ── Insert log ────────────────────────────────────────────────────────────────
$ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0];
$ua = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400);

DB::insert(
    'INSERT INTO activity_logs (user_id, action_type, payload_json, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())',
    [$userId, $action, json_encode($clean, JSON_UNESCAPED_UNICODE), $ip, $ua]
);

echo json_encode(['ok' => true, 'msg' => 'Log đã được ghi thành công.']);
