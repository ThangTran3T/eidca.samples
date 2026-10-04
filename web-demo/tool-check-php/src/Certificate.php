<?php

declare(strict_types=1);

final class Certificate
{
    public static function describe(string $der): array
    {
        $pem = Utils::derToPem($der);
        $parsed = openssl_x509_parse($pem, true);
        if ($parsed === false) {
            return ['parse_error' => 'Cannot parse X.509 certificate.', 'trust_status' => 'NOT_EVALUATED'];
        }

        $publicKey = openssl_pkey_get_public($pem);
        $keyDetails = $publicKey !== false ? openssl_pkey_get_details($publicKey) : false;
        $validFrom = $parsed['validFrom_time_t'] ?? null;
        $validTo = $parsed['validTo_time_t'] ?? null;
        $now = time();

        return [
            'subject_dn' => self::dn($parsed['subject'] ?? []),
            'issuer_dn' => self::dn($parsed['issuer'] ?? []),
            'common_name' => self::value($parsed['subject'] ?? [], 'CN'),
            'organization' => self::value($parsed['subject'] ?? [], 'O'),
            'issuer_common_name' => self::value($parsed['issuer'] ?? [], 'CN'),
            'serial_number' => strtoupper((string) ($parsed['serialNumberHex'] ?? $parsed['serialNumber'] ?? '')),
            'valid_from' => Utils::isoDate(is_int($validFrom) ? $validFrom : null),
            'valid_to' => Utils::isoDate(is_int($validTo) ? $validTo : null),
            'valid_at_check_time' => is_int($validFrom) && is_int($validTo) ? $now >= $validFrom && $now <= $validTo : null,
            'fingerprint_sha256' => hash('sha256', $der),
            'public_key_type' => self::keyType($keyDetails),
            'public_key_size' => is_array($keyDetails) ? ($keyDetails['bits'] ?? null) : null,
            'is_ca' => str_contains(strtoupper((string) ($parsed['extensions']['basicConstraints'] ?? '')), 'CA:TRUE'),
            'trust_status' => 'NOT_EVALUATED',
        ];
    }

    private static function value(array $dn, string $key): ?string
    {
        $value = $dn[$key] ?? null;
        if (is_array($value)) $value = $value[0] ?? null;
        return is_scalar($value) ? (string) $value : null;
    }

    private static function dn(array $dn): string
    {
        $parts = [];
        foreach ($dn as $key => $value) {
            foreach ((array) $value as $item) $parts[] = $key . '=' . $item;
        }
        return implode(', ', $parts);
    }

    private static function keyType(array|false $details): ?string
    {
        if (!is_array($details)) return null;
        return match ($details['type'] ?? null) {
            OPENSSL_KEYTYPE_RSA => 'rsa',
            OPENSSL_KEYTYPE_EC => 'ec',
            OPENSSL_KEYTYPE_DSA => 'dsa',
            default => 'unknown',
        };
    }
}
