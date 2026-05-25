<?php
/**
 * EIDCA CMS – API endpoint: Trả về config của user hiện tại
 * GET /cms/api/get_config.php
 * Auth: Session cookie hoặc ?api_key=... hoặc Header X-Api-Key
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, X-Api-Key');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../config.php';

// Resolve user
$row = null;

if (isLoggedIn()) {
    $row = DB::row('SELECT * FROM users WHERE id=? LIMIT 1', [currentUser()['id']]);
}

if (!$row) {
    $apiKey = '';
    $auth   = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($auth, 'Bearer ')) $apiKey = substr($auth, 7);
    if (!$apiKey) $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? ($_GET['api_key'] ?? '');
    if ($apiKey) {
        $row = DB::row('SELECT * FROM users WHERE api_key=? AND is_active=1 LIMIT 1', [$apiKey]);
    }
}

if (!$row) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'msg' => 'Unauthorized']);
    exit;
}

echo json_encode([
    'ok'            => true,
    'nfc_url'       => $row['nfc_url'] ?: DEFAULT_NFC_URL,
    'cam_url'       => $row['cam_url'] ?: DEFAULT_CAM_URL,
    'api_key'       => $row['api_key'],
    'partner_code'  => $row['partner_code'] ?? '',
    'eidca_api_key' => $row['eidca_api_key'] ?? '',
    'eidca_api_url' => $row['eidca_api_url'] ?: 'https://api.eidca.vn',
    'user'          => ['id' => $row['id'], 'username' => $row['username'], 'role' => $row['role']],
], JSON_UNESCAPED_UNICODE);
