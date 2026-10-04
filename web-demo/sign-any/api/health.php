<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$mode = (string) (app_config()['mode'] ?? 'mock');
$needsCurl = $mode === 'live';

echo json_encode([
    'status' => (!$needsCurl || extension_loaded('curl')) ? 'UP' : 'DEGRADED',
    'service' => 'vneca-sign-any',
    'version' => '1.0.0',
    'php_version' => PHP_VERSION,
    'mode' => $mode,
    'platform_url' => (string) (app_config()['platform_url'] ?? ''),
    'extensions' => ['json' => extension_loaded('json'), 'curl' => extension_loaded('curl')],
    'runtime_store' => [
        'path' => Store::path(),
        'writable' => Store::isWritable(),
    ],
    'notes' => $needsCurl
        ? 'mode = live: mọi request được chuyển tới platform_url qua cURL.'
        : 'mode = mock: MockPlatform giả lập contract ngay trong PHP, không cần credential thật.',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
