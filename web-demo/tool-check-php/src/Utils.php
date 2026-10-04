<?php

declare(strict_types=1);

final class Utils
{
    public static function decodeBase64(mixed $value): string
    {
        if (!is_string($value) || trim($value) === '') {
            throw new ApiException(400, 'FILE_REQUIRED', "Field 'file' or 'file_base64' is required.");
        }

        $normalized = preg_replace('/^data:[^;,]+;base64,/i', '', trim($value));
        $normalized = preg_replace('/\s+/', '', $normalized ?? '');
        if ($normalized === '' || strlen($normalized) % 4 !== 0 || !preg_match('/^[A-Za-z0-9+\/]*={0,2}$/', $normalized)) {
            throw new ApiException(400, 'INVALID_BASE64', "Field 'file_base64' is not valid Base64.");
        }

        $decoded = base64_decode($normalized, true);
        if ($decoded === false) {
            throw new ApiException(400, 'INVALID_BASE64', "Field 'file_base64' is not valid Base64.");
        }
        return $decoded;
    }

    public static function detectType(string $contents, string $fileName = ''): string
    {
        if (str_starts_with($contents, '%PDF-')) {
            return 'PDF';
        }

        $head = substr($contents, 0, 1024);
        $head = preg_replace('/^\xEF\xBB\xBF/', '', $head) ?? $head;
        if (str_starts_with(ltrim($head), '<')) {
            return 'XML';
        }

        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if ($extension === 'pdf') return 'PDF';
        if ($extension === 'xml') return 'XML';
        throw new ApiException(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and XML files are supported.');
    }

    public static function describeFile(string $contents, string $fileName, string $type): array
    {
        return [
            'name' => $fileName !== '' ? basename($fileName) : 'document.' . strtolower($type),
            'type' => $type,
            'mime_type' => $type === 'PDF' ? 'application/pdf' : 'application/xml',
            'size' => strlen($contents),
            'sha256' => hash('sha256', $contents),
        ];
    }

    public static function derToPem(string $der, string $label = 'CERTIFICATE'): string
    {
        return "-----BEGIN {$label}-----\n"
            . chunk_split(base64_encode($der), 64, "\n")
            . "-----END {$label}-----\n";
    }

    public static function algorithmName(?string $oid): ?array
    {
        if ($oid === null) return null;
        $names = [
            '1.3.14.3.2.26' => 'SHA-1',
            '2.16.840.1.101.3.4.2.1' => 'SHA-256',
            '2.16.840.1.101.3.4.2.2' => 'SHA-384',
            '2.16.840.1.101.3.4.2.3' => 'SHA-512',
            '1.2.840.113549.1.1.1' => 'RSA',
            '1.2.840.113549.1.1.5' => 'SHA1withRSA',
            '1.2.840.113549.1.1.11' => 'SHA256withRSA',
            '1.2.840.113549.1.1.12' => 'SHA384withRSA',
            '1.2.840.113549.1.1.13' => 'SHA512withRSA',
            '1.2.840.10045.4.3.2' => 'ECDSAwithSHA256',
            '1.2.840.10045.4.3.3' => 'ECDSAwithSHA384',
            '1.2.840.10045.4.3.4' => 'ECDSAwithSHA512',
        ];
        return ['oid' => $oid, 'name' => $names[$oid] ?? 'UNKNOWN'];
    }

    public static function digestName(string $oid): ?string
    {
        return match ($oid) {
            '1.3.14.3.2.26' => 'sha1',
            '2.16.840.1.101.3.4.2.1' => 'sha256',
            '2.16.840.1.101.3.4.2.2' => 'sha384',
            '2.16.840.1.101.3.4.2.3' => 'sha512',
            default => null,
        };
    }

    public static function opensslAlgorithm(string $signatureOid, string $digestOid): int|string|null
    {
        return match ($signatureOid) {
            '1.2.840.113549.1.1.5' => OPENSSL_ALGO_SHA1,
            '1.2.840.113549.1.1.11', '1.2.840.10045.4.3.2' => OPENSSL_ALGO_SHA256,
            '1.2.840.113549.1.1.12', '1.2.840.10045.4.3.3' => OPENSSL_ALGO_SHA384,
            '1.2.840.113549.1.1.13', '1.2.840.10045.4.3.4' => OPENSSL_ALGO_SHA512,
            '1.2.840.113549.1.1.1' => match ($digestOid) {
                '1.3.14.3.2.26' => OPENSSL_ALGO_SHA1,
                '2.16.840.1.101.3.4.2.1' => OPENSSL_ALGO_SHA256,
                '2.16.840.1.101.3.4.2.2' => OPENSSL_ALGO_SHA384,
                '2.16.840.1.101.3.4.2.3' => OPENSSL_ALGO_SHA512,
                default => null,
            },
            default => null,
        };
    }

    public static function isoDate(int|false|null $timestamp): ?string
    {
        return is_int($timestamp) ? gmdate('Y-m-d\TH:i:s\Z', $timestamp) : null;
    }
}
