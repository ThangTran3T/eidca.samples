<?php

declare(strict_types=1);

/**
 * HttpPlatform — gọi thẳng API Gateway thật (mode = live) qua cURL.
 *
 * Không thay đổi gì ở phía gọi: cùng một request (method + path + body + headers)
 * được chuyển nguyên vẹn tới {platform_url}{path}.
 */
final class HttpPlatform implements Platform
{
    /** @param array<string,mixed> $config */
    public function __construct(private array $config)
    {
    }

    /**
     * @param  array<string,string>     $headers
     * @param  array<string,mixed>|null $body
     * @return array{http_status:int, body:array<string,mixed>}
     */
    public function send(string $method, string $path, ?array $body, array $headers): array
    {
        if (!extension_loaded('curl')) {
            throw new ApiException(500, 'CURL_MISSING', 'Thiếu ext-curl: không thể chạy mode = live.');
        }

        $base = rtrim((string) ($this->config['platform_url'] ?? ''), '/');
        if ($base === '') {
            throw new ApiException(500, 'PLATFORM_URL_MISSING', 'Chưa cấu hình platform_url cho mode = live.');
        }
        $url = $base . '/' . ltrim($path, '/');

        $headerLines = [];
        foreach ($headers as $name => $value) {
            $name = strtolower($name);
            if ($name === 'host' || $name === 'content-length') {
                continue;
            }
            $headerLines[] = $name . ': ' . $value;
        }
        if ($body !== null) {
            if (!in_array('content-type: application/json', array_map('strtolower', $headerLines), true)) {
                $headerLines[] = 'content-type: application/json';
            }
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => false,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_TIMEOUT => (int) ($this->config['request_timeout'] ?? 30),
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $raw = curl_exec($ch);
        if ($raw === false) {
            $message = curl_error($ch);
            curl_close($ch);
            throw new ApiException(502, 'UPSTREAM_UNREACHABLE', 'Không gọi được nền tảng: ' . $message);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            $decoded = ['success' => false, 'error' => ['code' => 'INVALID_UPSTREAM_RESPONSE', 'message' => 'Nền tảng trả về không phải JSON.']];
        }

        return ['http_status' => $status, 'body' => $decoded];
    }
}
