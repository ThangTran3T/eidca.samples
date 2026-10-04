<?php

declare(strict_types=1);

final class CmsVerifier
{
    private const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';
    private const MESSAGE_DIGEST_OID = '1.2.840.113549.1.9.4';
    private const SIGNING_TIME_OID = '1.2.840.113549.1.9.5';
    private const TIMESTAMP_TOKEN_OID = '1.2.840.113549.1.9.16.2.14';

    public static function trimDer(string $data): string
    {
        $root = Asn1::parse($data);
        return $root['raw'];
    }

    public static function verify(string $cmsDer, string $signedBytes): array
    {
        if (!function_exists('openssl_verify')) {
            throw new RuntimeException('PHP extension ext-openssl is required for PDF verification.');
        }

        $contentInfo = Asn1::parse($cmsDer);
        self::expect($contentInfo, Asn1::CLASS_UNIVERSAL, 16, 'CMS ContentInfo');
        $contentType = isset($contentInfo['children'][0]) ? Asn1::oid($contentInfo['children'][0]) : null;
        if ($contentType !== self::SIGNED_DATA_OID) {
            throw new RuntimeException("CMS content type '{$contentType}' is not SignedData.");
        }

        $wrapper = $contentInfo['children'][1] ?? null;
        $signedData = is_array($wrapper) ? ($wrapper['children'][0] ?? null) : null;
        if (!is_array($signedData)) throw new RuntimeException('CMS SignedData content is missing.');
        self::expect($signedData, Asn1::CLASS_UNIVERSAL, 16, 'CMS SignedData');

        $certificates = [];
        $signerInfos = null;
        foreach (array_slice($signedData['children'], 3) as $child) {
            if ($child['class'] === Asn1::CLASS_CONTEXT && $child['tag'] === 0) {
                foreach ($child['children'] as $certificateNode) {
                    if ($certificateNode['class'] === Asn1::CLASS_UNIVERSAL && $certificateNode['tag'] === 16) {
                        $certificates[] = $certificateNode['raw'];
                    }
                }
            }
            if ($child['class'] === Asn1::CLASS_UNIVERSAL && $child['tag'] === 17) {
                $signerInfos = $child;
            }
        }
        if (!is_array($signerInfos)) throw new RuntimeException('CMS SignerInfos set is missing.');

        $signers = [];
        foreach ($signerInfos['children'] as $index => $signerInfo) {
            $signers[] = self::verifySigner($signerInfo, $certificates, $signedBytes, $index + 1);
        }
        $valid = $signers !== [] && !in_array(false, array_column($signers, 'valid'), true);

        return [
            'valid' => $valid,
            'content_type' => $contentType,
            'signer_count' => count($signers),
            'certificate_count' => count($certificates),
            'signers' => $signers,
        ];
    }

    private static function verifySigner(array $signerInfo, array $certificates, string $signedBytes, int $index): array
    {
        self::expect($signerInfo, Asn1::CLASS_UNIVERSAL, 16, 'CMS SignerInfo');
        $children = $signerInfo['children'];
        if (count($children) < 5) throw new RuntimeException('CMS SignerInfo is incomplete.');

        $cursor = 2;
        $digestAlgorithm = self::algorithmOid($children[$cursor++] ?? null);
        $signedAttrs = null;
        if (($children[$cursor]['class'] ?? null) === Asn1::CLASS_CONTEXT && ($children[$cursor]['tag'] ?? null) === 0) {
            $signedAttrs = $children[$cursor++];
        }
        $signatureAlgorithm = self::algorithmOid($children[$cursor++] ?? null);
        $signatureNode = $children[$cursor++] ?? null;
        if (!is_array($signatureNode) || $signatureNode['class'] !== Asn1::CLASS_UNIVERSAL || $signatureNode['tag'] !== 4) {
            throw new RuntimeException('CMS signature OCTET STRING is missing.');
        }
        $unsignedAttrs = (($children[$cursor]['class'] ?? null) === Asn1::CLASS_CONTEXT && ($children[$cursor]['tag'] ?? null) === 1)
            ? $children[$cursor]
            : null;

        $hashName = $digestAlgorithm !== null ? Utils::digestName($digestAlgorithm) : null;
        $opensslAlgorithm = ($signatureAlgorithm !== null && $digestAlgorithm !== null)
            ? Utils::opensslAlgorithm($signatureAlgorithm, $digestAlgorithm)
            : null;
        if ($hashName === null || $opensslAlgorithm === null) {
            throw new RuntimeException("Unsupported CMS digest/signature algorithm '{$digestAlgorithm}'/'{$signatureAlgorithm}'.");
        }

        $digestValid = true;
        $dataToVerify = $signedBytes;
        $signingTime = null;
        if (is_array($signedAttrs)) {
            $storedDigest = self::attributeOctets($signedAttrs, self::MESSAGE_DIGEST_OID);
            $actualDigest = hash($hashName, $signedBytes, true);
            $digestValid = is_string($storedDigest) && hash_equals($storedDigest, $actualDigest);
            $signingTime = self::attributeTime($signedAttrs, self::SIGNING_TIME_OID);
            // SignedAttrs is encoded as [0] IMPLICIT in SignerInfo, but RFC 5652
            // requires signature verification over the DER SET OF encoding.
            $dataToVerify = chr(0x31) . substr($signedAttrs['raw'], 1);
        }

        $signatureValid = false;
        $signerCertificate = $certificates[0] ?? null;
        foreach ($certificates as $certificate) {
            $publicKey = openssl_pkey_get_public(Utils::derToPem($certificate));
            if ($publicKey === false) continue;
            if (openssl_verify($dataToVerify, $signatureNode['content'], $publicKey, $opensslAlgorithm) === 1) {
                $signatureValid = true;
                $signerCertificate = $certificate;
                break;
            }
        }

        $valid = $signatureValid && $digestValid;
        $message = !$digestValid
            ? 'CMS messageDigest does not match the PDF ByteRange.'
            : ($signatureValid ? 'CMS signer signature is valid.' : 'CMS signer signature is invalid.');

        return [
            'index' => $index,
            'valid' => $valid,
            'message' => $message,
            'signing_time' => $signingTime,
            'digest_algorithm' => Utils::algorithmName($digestAlgorithm),
            'signature_algorithm' => Utils::algorithmName($signatureAlgorithm),
            'certificate' => is_string($signerCertificate) ? Certificate::describe($signerCertificate) : null,
            'timestamp' => [
                'present' => is_array($unsignedAttrs) && self::hasAttribute($unsignedAttrs, self::TIMESTAMP_TOKEN_OID),
                'valid' => null,
                'status' => is_array($unsignedAttrs) && self::hasAttribute($unsignedAttrs, self::TIMESTAMP_TOKEN_OID)
                    ? 'NOT_EVALUATED'
                    : 'NOT_PRESENT',
            ],
        ];
    }

    private static function algorithmOid(?array $node): ?string
    {
        if (!is_array($node) || $node['class'] !== Asn1::CLASS_UNIVERSAL || $node['tag'] !== 16) return null;
        return Asn1::firstOid($node);
    }

    private static function hasAttribute(array $attributes, string $oid): bool
    {
        return self::findAttribute($attributes, $oid) !== null;
    }

    private static function attributeOctets(array $attributes, string $oid): ?string
    {
        $attribute = self::findAttribute($attributes, $oid);
        $value = $attribute['children'][1]['children'][0] ?? null;
        return is_array($value) && $value['class'] === Asn1::CLASS_UNIVERSAL && $value['tag'] === 4
            ? $value['content']
            : null;
    }

    private static function attributeTime(array $attributes, string $oid): ?string
    {
        $attribute = self::findAttribute($attributes, $oid);
        $value = $attribute['children'][1]['children'][0] ?? null;
        return is_array($value) ? Asn1::time($value) : null;
    }

    private static function findAttribute(array $attributes, string $oid): ?array
    {
        foreach ($attributes['children'] as $attribute) {
            if ($attribute['class'] !== Asn1::CLASS_UNIVERSAL || $attribute['tag'] !== 16) continue;
            $typeNode = $attribute['children'][0] ?? null;
            if (is_array($typeNode) && Asn1::oid($typeNode) === $oid) return $attribute;
        }
        return null;
    }

    private static function expect(array $node, int $class, int $tag, string $name): void
    {
        if ($node['class'] !== $class || $node['tag'] !== $tag) {
            throw new RuntimeException("{$name} has an unexpected ASN.1 type.");
        }
    }
}
