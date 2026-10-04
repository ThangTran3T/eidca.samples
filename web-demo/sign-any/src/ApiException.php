<?php

declare(strict_types=1);

/**
 * Lỗi nghiệp vụ của tầng BFF (khác với lỗi trả về từ nền tảng, vốn nằm trong body.response).
 */
final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly int $httpStatus,
        public readonly string $errorCode,
        string $message,
    ) {
        parent::__construct($message);
    }
}
