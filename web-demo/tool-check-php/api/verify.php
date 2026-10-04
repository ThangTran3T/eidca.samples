<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

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
    $allowed = (string) (tool_config()['cors_origin'] ?? '*');
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

function upload_error_message(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Uploaded file exceeds the configured size limit.',
        UPLOAD_ERR_PARTIAL => 'File upload was incomplete.',
        UPLOAD_ERR_NO_TMP_DIR => 'PHP upload temporary directory is unavailable.',
        UPLOAD_ERR_CANT_WRITE => 'PHP cannot write the uploaded file.',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the upload.',
        default => 'File upload failed.',
    };
}

apply_cors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') send_json(204, []);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST, OPTIONS');
    send_json(405, ['success' => false, 'error' => ['code' => 'METHOD_NOT_ALLOWED', 'message' => 'Use POST for this endpoint.']]);
}

try {
    $maxBytes = (int) round((float) (tool_config()['max_file_size_mb'] ?? 50) * 1024 * 1024);
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > (int) ceil($maxBytes * 1.4) + 1048576) {
        throw new ApiException(413, 'FILE_TOO_LARGE', 'Request exceeds the configured file size limit.');
    }

    $contents = null;
    $fileName = '';
    if (isset($_FILES['file']) && is_array($_FILES['file'])) {
        $upload = $_FILES['file'];
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) throw new ApiException(400, 'UPLOAD_FAILED', upload_error_message($error));
        $tmpName = (string) ($upload['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new ApiException(400, 'UPLOAD_FAILED', 'Uploaded file is not a valid HTTP upload.');
        }
        $contents = file_get_contents($tmpName);
        if ($contents === false) throw new ApiException(400, 'UPLOAD_FAILED', 'Cannot read uploaded file.');
        $fileName = basename((string) ($upload['name'] ?? ''));
    } else {
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        $payload = $_POST;
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input');
            $payload = json_decode($raw === false ? '' : $raw, true);
            if (!is_array($payload)) throw new ApiException(400, 'INVALID_JSON', 'Request body is not valid JSON.');
        }
        $contents = Utils::decodeBase64($payload['file_base64'] ?? null);
        $fileName = basename((string) ($payload['file_name'] ?? $payload['fileName'] ?? ''));
    }

    if ($contents === '') throw new ApiException(400, 'EMPTY_FILE', 'The supplied file is empty.');
    if (strlen($contents) > $maxBytes) throw new ApiException(413, 'FILE_TOO_LARGE', 'File exceeds the configured size limit.');
    send_json(200, verify_document($contents, $fileName));
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
