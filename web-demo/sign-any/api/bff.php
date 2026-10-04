<?php

declare(strict_types=1);

/**
 * BFF của demo "Universal Broker (provider = ANY)".
 *
 * Frontend chỉ gọi tới đây; file này dựng request tới nền tảng (MockPlatform hoặc
 * HttpPlatform), rồi trả lại cả REQUEST lẫn RESPONSE để UI hiển thị đúng như
 * test-script trong Postman collection.
 */

require_once dirname(__DIR__) . '/src/bootstrap.php';

// ─────────────────────────────────────────────────────────────────────────────
// Tiện ích
// ─────────────────────────────────────────────────────────────────────────────

/** @param array<string,mixed> $payload */
function send_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function apply_cors(): void
{
    $allowed = (string) (app_config()['cors_origin'] ?? '*');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($allowed === '*') {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origin !== '' && in_array($origin, array_map('trim', explode(',', $allowed)), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

/** @return array<string,mixed> */
function read_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiException(400, 'INVALID_JSON', 'Body không phải JSON hợp lệ.');
    }
    return $decoded;
}

/** Rút gọn giá trị nhạy cảm để hiển thị trong log. */
function mask(string $value): string
{
    $len = strlen($value);
    if ($len <= 8) {
        return $len === 0 ? '' : str_repeat('•', $len);
    }
    return substr($value, 0, 4) . str_repeat('•', 6) . substr($value, -4);
}

/** @param array<string,mixed> $source */
function str_of(array $source, string $key, string $default = ''): string
{
    $value = $source[$key] ?? $default;
    return is_scalar($value) ? (string) $value : $default;
}

/**
 * Challenge mở portal /broker = `resume_token` nằm trong `broker_url`
 * (KHÁC `derived.resume_token` — token dùng một lần cho đường S2S 3.1).
 * Đây đúng là cách script cấp collection của Postman trích biến `broker_challenge`.
 */
function challenge_of(?string $brokerUrl): ?string
{
    if ($brokerUrl === null || $brokerUrl === '') {
        return null;
    }
    $query = (string) parse_url($brokerUrl, PHP_URL_QUERY);
    if ($query === '') {
        return null;
    }
    parse_str($query, $params);
    $challenge = isset($params['resume_token']) && is_scalar($params['resume_token'])
        ? (string) $params['resume_token']
        : '';
    return $challenge === '' ? null : $challenge;
}

/** @param array<string,string> $headers */
function log_headers(array $headers): array
{
    $out = [];
    foreach ($headers as $name => $value) {
        $lower = strtolower($name);
        if ($lower === 'authorization') {
            $out[$name] = preg_match('/^Bearer\s+(.+)$/i', $value, $m) === 1
                ? 'Bearer ' . mask($m[1])
                : mask($value);
        } else {
            $out[$name] = $value;
        }
    }
    return $out;
}

/** @param array<string,mixed>|null $body */
function log_body(?array $body): ?array
{
    if ($body === null) {
        return null;
    }
    foreach (['client_secret', 'access_token', 'session_token'] as $key) {
        if (isset($body[$key]) && is_string($body[$key])) {
            $body[$key] = mask($body[$key]);
        }
    }
    return $body;
}

/**
 * Gọi nền tảng và đóng gói request/response để UI hiển thị.
 *
 * @param  array<string,string>     $headers
 * @param  array<string,mixed>|null $body
 * @return array<string,mixed>
 */
function perform(string $step, string $method, string $path, ?array $body, array $headers): array
{
    $base = rtrim((string) (app_config()['platform_url'] ?? ''), '/');
    $start = microtime(true);
    $response = app_platform()->send($method, $path, $body, $headers);
    $duration = (int) round((microtime(true) - $start) * 1000);

    return [
        'step' => $step,
        'mode' => (string) (app_config()['mode'] ?? 'mock'),
        'request' => [
            'method' => $method,
            'url' => $base . $path,
            'path' => $path,
            'headers' => log_headers($headers),
            'body' => log_body($body),
        ],
        'response' => [
            'http_status' => $response['http_status'],
            'body' => $response['body'],
        ],
        'duration_ms' => $duration,
    ];
}

/**
 * Trích các biến như test-script của collection Postman làm.
 *
 * @param  array<string,mixed> $envelope
 * @param  array<string,mixed> $derived
 * @return array<string,mixed>
 */
function with_derived(array $envelope, array $derived): array
{
    $clean = array_filter($derived, static fn ($v): bool => $v !== null && $v !== '');
    if ($clean !== []) {
        $envelope['derived'] = $clean;
    }
    $envelope['success'] = (bool) ($envelope['response']['body']['success'] ?? false);
    return $envelope;
}

// ─────────────────────────────────────────────────────────────────────────────
// Các action (ánh xạ 1-1 với request trong Postman collection)
// ─────────────────────────────────────────────────────────────────────────────

/** @param array<string,mixed> $in */
function action_token(array $in): array
{
    $defaults = app_defaults();
    $body = [
        'grant_type' => 'client_credentials',
        'client_id' => str_of($in, 'client_id', (string) ($defaults['client_id'] ?? '')),
        'client_secret' => str_of($in, 'client_secret', (string) ($defaults['client_secret'] ?? '')),
        'scope' => str_of($in, 'scope', (string) ($defaults['scope'] ?? '')),
    ];

    $env = perform('0.1 Auth', 'POST', '/v1/auth/oauth/token', $body, ['content-type' => 'application/json']);
    $data = (array) ($env['response']['body']['data'] ?? []);

    return with_derived($env, [
        'access_token' => isset($data['access_token']) ? (string) $data['access_token'] : null,
        'token_type' => isset($data['token_type']) ? (string) $data['token_type'] : null,
        'expires_in' => $data['expires_in'] ?? null,
    ]);
}

/** @param array<string,mixed> $in */
function action_create(array $in): array
{
    $tenantId = str_of($in, 'tenant_id');
    $body = [
        'tenant_id' => $tenantId,
        'integration_key' => str_of($in, 'integration_key'),
        'business_category' => str_of($in, 'business_category'),
        'reference_id' => str_of($in, 'reference_id') !== '' ? str_of($in, 'reference_id') : null,
        'idempotency_key' => str_of($in, 'idempotency_key'),
        'identity' => ['user_id' => str_of($in, 'user_id')],
        'signing' => [
            'document_name' => str_of($in, 'document_name', 'document.pdf'),
            'document_hash' => str_of($in, 'document_hash'),
            'hash_algorithm' => 'SHA-256',
            'format' => 'PAdES',
        ],
    ];
    // Tuỳ chọn gửi kèm method_code để thấy lỗi của flow ANY.
    if (str_of($in, 'method_code') !== '') {
        $body['method_code'] = str_of($in, 'method_code');
    }

    $headers = [
        'authorization' => 'Bearer ' . str_of($in, 'access_token'),
        'x-tenant-id' => $tenantId,
        'idempotency-key' => str_of($in, 'idempotency_key'),
        'content-type' => 'application/json',
    ];

    $env = perform('1.1 Tạo giao dịch (provider = ANY)', 'POST', '/v1/integration/signing-transactions', $body, $headers);
    $data = (array) ($env['response']['body']['data'] ?? []);
    $brokerUrl = isset($data['client_instruction']['url']) ? (string) $data['client_instruction']['url'] : null;

    return with_derived($env, [
        'transaction_id' => isset($data['transaction_id']) ? (string) $data['transaction_id'] : null,
        'status' => isset($data['status']) ? (string) $data['status'] : null,
        'broker_url' => $brokerUrl,
        'broker_challenge' => challenge_of($brokerUrl),
        'resume_token' => isset($data['client_instruction']['resume_token']) ? (string) $data['client_instruction']['resume_token'] : null,
        'instruction_type' => isset($data['client_instruction']['type']) ? (string) $data['client_instruction']['type'] : null,
        'idempotent_replay' => $data['replayed'] ?? null,
    ]);
}

/** @param array<string,mixed> $in */
function action_get(array $in): array
{
    $txId = str_of($in, 'transaction_id');
    $path = '/v1/integration/signing-transactions/' . rawurlencode($txId);
    $headers = [
        'authorization' => 'Bearer ' . str_of($in, 'access_token'),
        'accept' => 'application/json',
    ];

    $env = perform('1.2 / 3.2 Đọc trạng thái', 'GET', $path, null, $headers);
    $data = (array) ($env['response']['body']['data'] ?? []);
    // Mỗi lần đọc lại giao dịch, nền tảng phát challenge mới (khi còn ở bước broker):
    // UI phải dùng challenge của response GẦN NHẤT trước khi gọi 2.1 — giống script
    // cấp collection của Postman luôn ghi đè broker_url/broker_challenge.
    $brokerUrl = isset($data['client_instruction']['url']) ? (string) $data['client_instruction']['url'] : null;

    return with_derived($env, [
        'status' => isset($data['status']) ? (string) $data['status'] : null,
        'transaction_status' => isset($data['transaction_status']) ? (string) $data['transaction_status'] : null,
        'broker_url' => $brokerUrl,
        'broker_challenge' => challenge_of($brokerUrl),
        'method_code' => isset($data['method_code']) ? (string) $data['method_code'] : null,
        'provider_id' => isset($data['provider_id']) ? (string) $data['provider_id'] : null,
        'signed_at' => isset($data['signed_at']) ? (string) $data['signed_at'] : null,
        'instruction_type' => isset($data['client_instruction']['type']) ? (string) $data['client_instruction']['type'] : null,
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.x — Trang /broker (enduser-portal) thay người dùng cuối
// ─────────────────────────────────────────────────────────────────────────────

/** @param array<string,mixed> $in */
function action_broker_open(array $in): array
{
    $body = [
        'tenant_id' => str_of($in, 'tenant_id'),
        'transaction_id' => str_of($in, 'transaction_id'),
        'resume_token' => str_of($in, 'resume_token'),
        'device_fingerprint' => str_of($in, 'device_fingerprint'),
    ];

    $env = perform('2.1 Mở phiên broker (ẩn danh)', 'POST', '/v1/broker/sessions', $body, ['content-type' => 'application/json']);
    $data = (array) ($env['response']['body']['data'] ?? []);
    $providers = (array) ($data['providers'] ?? []);

    return with_derived($env, [
        'session_id' => isset($data['session_id']) ? (string) $data['session_id'] : null,
        'session_token' => isset($data['session_token']) ? (string) $data['session_token'] : null,
        'status' => isset($data['status']) ? (string) $data['status'] : null,
        'providers' => $providers === [] ? null : $providers,
    ]);
}

/** @param array<string,mixed> $in */
function action_broker_resume(array $in): array
{
    $sessionId = str_of($in, 'session_id');
    $path = '/v1/broker/sessions/' . rawurlencode($sessionId) . ':resume';
    $body = [
        'device_fingerprint' => str_of($in, 'device_fingerprint'),
        'client_result' => [
            'method_code' => str_of($in, 'method_code'),
            'provider_id' => str_of($in, 'provider_id'),
            'environment' => str_of($in, 'environment'),
            'channel' => str_of($in, 'channel'),
            'flow_code' => str_of($in, 'flow_code'),
        ],
    ];
    $headers = [
        'authorization' => 'Bearer ' . str_of($in, 'session_token'),
        'content-type' => 'application/json',
    ];

    $env = perform('2.2 Người ký chọn CA', 'POST', $path, $body, $headers);
    $data = (array) ($env['response']['body']['data'] ?? []);
    $replayed = $env['response']['body']['broker_session']['replayed'] ?? null;

    return with_derived($env, [
        'status' => isset($data['status']) ? (string) $data['status'] : null,
        'method_code' => isset($data['method_code']) ? (string) $data['method_code'] : null,
        'provider_id' => isset($data['provider_id']) ? (string) $data['provider_id'] : null,
        'provider_url' => isset($data['client_instruction']['url']) ? (string) $data['client_instruction']['url'] : null,
        'broker_session_replayed' => $replayed,
    ]);
}

/** @param array<string,mixed> $in */
function action_broker_revoke(array $in): array
{
    $sessionId = str_of($in, 'session_id');
    $path = '/v1/broker/sessions/' . rawurlencode($sessionId) . ':revoke';
    $body = ['device_fingerprint' => str_of($in, 'device_fingerprint')];
    $headers = [
        'authorization' => 'Bearer ' . str_of($in, 'session_token'),
        'content-type' => 'application/json',
    ];

    $env = perform('2.3 Huỷ phiên broker', 'POST', $path, $body, $headers);
    $data = (array) ($env['response']['body']['data'] ?? []);

    return with_derived($env, [
        'status' => isset($data['status']) ? (string) $data['status'] : null,
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.1 — Đường S2S: resume bước broker_selection (dùng resume_token một lần)
// ─────────────────────────────────────────────────────────────────────────────

/** @param array<string,mixed> $in */
function action_client_step_resume(array $in): array
{
    $txId = str_of($in, 'transaction_id');
    $stepId = str_of($in, 'step_id', (string) (app_config()['broker_step_id'] ?? 'broker_selection'));
    $path = '/v1/integration/signing-transactions/' . rawurlencode($txId)
        . '/client-steps/' . rawurlencode($stepId) . ':resume';

    $body = [
        'resume_token' => str_of($in, 'resume_token'),
        'client_result' => [
            'method_code' => str_of($in, 'method_code'),
            'provider_id' => str_of($in, 'provider_id'),
            'environment' => str_of($in, 'environment'),
            'channel' => str_of($in, 'channel'),
            'flow_code' => str_of($in, 'flow_code'),
        ],
    ];
    $headers = [
        'authorization' => 'Bearer ' . str_of($in, 'access_token'),
        'content-type' => 'application/json',
    ];

    $env = perform('3.1 S2S resume client-step', 'POST', $path, $body, $headers);
    $data = (array) ($env['response']['body']['data'] ?? []);

    return with_derived($env, [
        'status' => isset($data['status']) ? (string) $data['status'] : null,
        'transaction_id' => isset($data['transaction_id']) ? (string) $data['transaction_id'] : null,
        'method_code' => isset($data['method_code']) ? (string) $data['method_code'] : null,
        'provider_url' => isset($data['client_instruction']['url']) ? (string) $data['client_instruction']['url'] : null,
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Điều phối
// ─────────────────────────────────────────────────────────────────────────────

apply_cors();
$httpMethod = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($httpMethod === 'OPTIONS') {
    send_json(204, []);
}
if ($httpMethod !== 'POST') {
    header('Allow: POST, OPTIONS');
    send_json(405, ['success' => false, 'error' => ['code' => 'METHOD_NOT_ALLOWED', 'message' => 'Dùng POST cho endpoint này.']]);
}

try {
    $input = read_body();
    $action = str_of($input, 'action');

    $envelope = match ($action) {
        'token' => action_token($input),
        'create' => action_create($input),
        'get' => action_get($input),
        'broker_open' => action_broker_open($input),
        'broker_resume' => action_broker_resume($input),
        'broker_revoke' => action_broker_revoke($input),
        'client_step_resume' => action_client_step_resume($input),
        default => throw new ApiException(400, 'UNKNOWN_ACTION', "Action không hỗ trợ: '{$action}'."),
    };

    send_json(200, $envelope);
} catch (ApiException $error) {
    send_json($error->httpStatus, [
        'success' => false,
        'error' => ['code' => $error->errorCode, 'message' => $error->getMessage()],
    ]);
} catch (Throwable $error) {
    send_json(500, [
        'success' => false,
        'error' => ['code' => 'INTERNAL_ERROR', 'message' => $error->getMessage()],
    ]);
}
