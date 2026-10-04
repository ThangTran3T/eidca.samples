<?php

declare(strict_types=1);

/**
 * Trừu tượng hoá nền tảng VNeCA: nhận một request HTTP (method + path + body + headers)
 * và trả về [http_status, body].
 *
 * - MockPlatform: giả lập contract của nền tảng ngay trong PHP (không cần mạng).
 * - HttpPlatform: gọi API Gateway thật qua cURL (mode = live).
 */
interface Platform
{
    /**
     * @param  array<string,string>      $headers
     * @param  array<string,mixed>|null  $body
     * @return array{http_status:int, body:array<string,mixed>}
     */
    public function send(string $method, string $path, ?array $body, array $headers): array;
}
