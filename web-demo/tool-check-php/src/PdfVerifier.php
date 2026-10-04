<?php

declare(strict_types=1);

final class PdfVerifier
{
    public static function verify(string $pdf): array
    {
        $entries = self::extractSignatures($pdf);
        if ($entries === []) {
            return [
                'format' => 'PDF', 'status' => 'UNSIGNED', 'valid' => false,
                'integrity_valid' => false, 'signature_count' => 0, 'signatures' => [],
                'warnings' => ['No PDF signature ByteRange was found.'],
            ];
        }

        $signatures = [];
        foreach ($entries as $index => $entry) {
            $signatures[] = self::verifyEntry($entry, strlen($pdf), $index + 1);
        }
        $latest = null;
        foreach ($signatures as $signature) {
            if ($latest === null || $signature['signed_revision_length'] > $latest['signed_revision_length']) $latest = $signature;
        }
        $integrityValid = ($latest['valid'] ?? false) && ($latest['covers_current_file'] ?? false);
        $allValid = !in_array(false, array_column($signatures, 'valid'), true);
        $certificateWarning = false;
        foreach ($signatures as $signature) {
            foreach ($signature['cms']['signers'] ?? [] as $signer) {
                if (($signer['certificate']['valid_at_check_time'] ?? null) === false) $certificateWarning = true;
            }
        }

        return [
            'format' => 'PDF',
            'status' => $integrityValid ? ($certificateWarning ? 'VALID_WITH_WARNINGS' : 'VALID') : 'INVALID',
            'valid' => $integrityValid,
            'integrity_valid' => $integrityValid,
            'all_signatures_valid' => $allValid,
            'signature_count' => count($signatures),
            'signatures' => $signatures,
            'warnings' => ['Certificate chain trust, OCSP, CRL and timestamp validity are not evaluated.'],
        ];
    }

    private static function extractSignatures(string $pdf): array
    {
        $pattern = '/\/ByteRange\s*\[\s*(\d+)\s*[ ,]+\s*(\d+)\s*[ ,]+\s*(\d+)\s*[ ,]+\s*(\d+)\s*\]/';
        preg_match_all($pattern, $pdf, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $entries = [];

        foreach ($matches as $match) {
            $range = array_map(static fn(array $capture): int => (int) $capture[0], array_slice($match, 1, 4));
            [$firstStart, $firstLength, $secondStart, $secondLength] = $range;
            $firstEnd = $firstStart + $firstLength;
            $revisionEnd = $secondStart + $secondLength;
            $validRange = $firstStart === 0 && $firstLength >= 0 && $secondStart > $firstEnd
                && $secondLength >= 0 && $revisionEnd <= strlen($pdf);
            $nearbyStart = max(0, $match[0][1] - 2048);
            $nearby = substr($pdf, $nearbyStart, 4096);
            preg_match('/\/SubFilter\s*\/([^\s\/>]+)/', $nearby, $subFilterMatch);
            $base = ['byteRange' => $range, 'revisionEnd' => $revisionEnd, 'subFilter' => $subFilterMatch[1] ?? null];

            if (!$validRange) {
                $entries[] = $base + ['error' => 'PDF ByteRange is invalid or outside the file.'];
                continue;
            }

            try {
                $cms = self::extractCms(substr($pdf, $firstEnd, $secondStart - $firstEnd));
                $signedBytes = substr($pdf, $firstStart, $firstLength) . substr($pdf, $secondStart, $secondLength);
                $entries[] = $base + ['cms' => $cms, 'signedBytes' => $signedBytes];
            } catch (Throwable $error) {
                $entries[] = $base + ['error' => $error->getMessage()];
            }
        }
        return $entries;
    }

    private static function extractCms(string $gap): string
    {
        $open = strpos($gap, '<');
        if ($open !== false) $gap = substr($gap, $open + 1);
        $close = strrpos($gap, '>');
        if ($close !== false) $gap = substr($gap, 0, $close);
        $hex = preg_replace('/\s+/', '', $gap) ?? '';
        if ($hex === '' || strlen($hex) % 2 !== 0 || !ctype_xdigit($hex)) {
            throw new RuntimeException('PDF signature /Contents is not valid hexadecimal data.');
        }
        $binary = hex2bin($hex);
        if ($binary === false) throw new RuntimeException('Cannot decode PDF signature /Contents.');
        return CmsVerifier::trimDer($binary);
    }

    private static function verifyEntry(array $entry, int $fileLength, int $index): array
    {
        $base = [
            'index' => $index,
            'byte_range' => $entry['byteRange'],
            'signed_revision_length' => $entry['revisionEnd'],
            'covers_current_file' => $entry['revisionEnd'] === $fileLength,
            'trailing_bytes' => max(0, $fileLength - $entry['revisionEnd']),
            'sub_filter' => $entry['subFilter'],
        ];
        if (isset($entry['error'])) {
            return $base + [
                'valid' => false, 'error_code' => 'PDF_SIGNATURE_EXTRACTION_FAILED',
                'message' => $entry['error'], 'cms' => null, 'warnings' => [],
            ];
        }

        try {
            $cms = CmsVerifier::verify($entry['cms'], $entry['signedBytes']);
            $warnings = ['Certificate chain trust, OCSP, CRL and timestamp validity were not evaluated.'];
            if (!$base['covers_current_file']) $warnings[] = 'A later PDF incremental revision exists after this signature.';
            foreach ($cms['signers'] as $signer) {
                if (($signer['certificate']['valid_at_check_time'] ?? null) === false) {
                    $warnings[] = 'At least one signing certificate is not valid at the current check time.';
                }
            }
            return $base + [
                'valid' => $cms['valid'],
                'error_code' => $cms['valid'] ? null : 'PDF_CMS_SIGNATURE_INVALID',
                'message' => $cms['valid'] ? 'PDF ByteRange and CMS signature are valid.' : 'PDF CMS signature is invalid.',
                'cms' => $cms,
                'warnings' => $warnings,
            ];
        } catch (Throwable $error) {
            return $base + [
                'valid' => false, 'error_code' => 'PDF_CMS_VERIFICATION_FAILED',
                'message' => $error->getMessage(), 'cms' => null, 'warnings' => [],
            ];
        }
    }
}
