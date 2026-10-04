<?php

declare(strict_types=1);

require_once __DIR__ . '/ApiException.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/Asn1.php';
require_once __DIR__ . '/Certificate.php';
require_once __DIR__ . '/CmsVerifier.php';
require_once __DIR__ . '/XmlVerifier.php';
require_once __DIR__ . '/PdfVerifier.php';

function tool_config(): array
{
    static $config;
    if (!is_array($config)) $config = require dirname(__DIR__) . '/config.php';
    return $config;
}

function verify_document(string $contents, string $fileName = ''): array
{
    $type = Utils::detectType($contents, $fileName);
    $verification = $type === 'PDF' ? PdfVerifier::verify($contents) : XmlVerifier::verify($contents);
    return [
        'success' => true,
        'checked_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'file' => Utils::describeFile($contents, $fileName, $type),
        'verification' => $verification,
    ];
}
