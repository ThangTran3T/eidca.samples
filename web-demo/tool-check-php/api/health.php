<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo json_encode([
    'status' => extension_loaded('dom') && extension_loaded('openssl') ? 'UP' : 'DEGRADED',
    'service' => 'vneca-tool-check-php',
    'version' => '1.0.0',
    'php_version' => PHP_VERSION,
    'extensions' => ['dom' => extension_loaded('dom'), 'openssl' => extension_loaded('openssl')],
], JSON_UNESCAPED_SLASHES);
