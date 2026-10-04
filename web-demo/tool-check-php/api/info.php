<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo json_encode([
    'service' => 'vneca-tool-check-php',
    'endpoint' => 'POST api/verify.php',
    'accepted_content_types' => ['multipart/form-data', 'application/json'],
    'fields' => [
        'multipart' => ['file' => 'PDF or XML file'],
        'json' => ['file_base64' => 'Base64-encoded PDF or XML', 'file_name' => 'Optional file name'],
    ],
    'max_file_size_mb' => tool_config()['max_file_size_mb'] ?? 50,
    'requirements' => ['PHP >= 8.1', 'ext-dom', 'ext-openssl'],
    'trust_validation' => 'Certificate chain, OCSP and CRL validation are not enabled.',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
