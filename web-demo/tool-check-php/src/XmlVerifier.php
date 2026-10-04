<?php

declare(strict_types=1);

final class XmlVerifier
{
    private const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
    private const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    private const C14N_COMMENTS = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments';
    private const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    private const EXC_C14N_COMMENTS = 'http://www.w3.org/2001/10/xml-exc-c14n#WithComments';
    private const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
    private const XPATH = 'http://www.w3.org/TR/1999/REC-xpath-19991116';

    public static function verify(string $xml): array
    {
        if (!class_exists(DOMDocument::class)) {
            throw new RuntimeException('PHP extension ext-dom is required for XML verification.');
        }
        if (!function_exists('openssl_verify')) {
            throw new RuntimeException('PHP extension ext-openssl is required for XML verification.');
        }

        $xml = preg_replace('/^\xEF\xBB\xBF/', '', $xml) ?? $xml;
        [$document, $parserWarnings] = self::load($xml);
        $xpath = self::xpath($document);
        $signatureNodes = $xpath->query('//ds:Signature');
        if ($signatureNodes === false || $signatureNodes->length === 0) {
            return [
                'format' => 'XML', 'status' => 'UNSIGNED', 'valid' => false,
                'integrity_valid' => false, 'signature_count' => 0, 'signatures' => [],
                'warnings' => ['No XMLDSig Signature element was found.'],
                'parser_warnings' => $parserWarnings,
            ];
        }

        $signatures = [];
        foreach ($signatureNodes as $index => $signatureNode) {
            if ($signatureNode instanceof DOMElement) {
                $signatures[] = self::verifySignature($document, $signatureNode, $index + 1);
            }
        }

        $valid = count($signatures) > 0 && !in_array(false, array_column($signatures, 'valid'), true);
        $certificateWarning = false;
        foreach ($signatures as $signature) {
            foreach ($signature['certificates'] ?? [] as $certificate) {
                if (($certificate['valid_at_check_time'] ?? null) === false) $certificateWarning = true;
            }
        }

        return [
            'format' => 'XML',
            'status' => $valid ? ($certificateWarning ? 'VALID_WITH_WARNINGS' : 'VALID') : 'INVALID',
            'valid' => $valid,
            'integrity_valid' => $valid,
            'signature_count' => count($signatures),
            'signatures' => $signatures,
            'warnings' => ['Certificate chain trust, OCSP and CRL checks are not performed.'],
            'parser_warnings' => $parserWarnings,
        ];
    }

    private static function verifySignature(DOMDocument $document, DOMElement $signatureNode, int $index): array
    {
        $xpath = self::xpath($document);
        $warnings = [];
        $references = [];
        $certificates = [];
        $signatureMethod = self::attribute($xpath, './ds:SignedInfo/ds:SignatureMethod', 'Algorithm', $signatureNode);
        $canonicalizationMethod = self::attribute($xpath, './ds:SignedInfo/ds:CanonicalizationMethod', 'Algorithm', $signatureNode);

        try {
            $certificateNodes = $xpath->query('.//ds:X509Certificate', $signatureNode);
            if ($certificateNodes !== false) {
                foreach ($certificateNodes as $certificateNode) {
                    $der = base64_decode(preg_replace('/\s+/', '', $certificateNode->textContent) ?? '', true);
                    if ($der !== false && $der !== '') $certificates[] = $der;
                }
            }
            if ($certificates === []) throw new RuntimeException('Signature does not contain an X509Certificate.');

            $referenceNodes = $xpath->query('./ds:SignedInfo/ds:Reference', $signatureNode);
            if ($referenceNodes === false || $referenceNodes->length === 0) {
                throw new RuntimeException('SignedInfo does not contain a Reference.');
            }
            $allReferencesValid = true;
            foreach ($referenceNodes as $referenceNode) {
                if (!$referenceNode instanceof DOMElement) continue;
                $reference = self::verifyReference($document, $signatureNode, $referenceNode, $index);
                $references[] = $reference;
                if (!$reference['valid']) $allReferencesValid = false;
                if ($reference['external_reference']) {
                    $warnings[] = 'Signature contains an external reference; remote content is not resolved.';
                }
            }

            $signedInfo = $xpath->query('./ds:SignedInfo', $signatureNode)?->item(0);
            $signatureValueNode = $xpath->query('./ds:SignatureValue', $signatureNode)?->item(0);
            if (!$signedInfo instanceof DOMElement || !$signatureValueNode instanceof DOMElement) {
                throw new RuntimeException('SignedInfo or SignatureValue is missing.');
            }

            $canonicalSignedInfo = self::canonicalize($signedInfo, $canonicalizationMethod);
            $signatureValue = base64_decode(preg_replace('/\s+/', '', $signatureValueNode->textContent) ?? '', true);
            if ($signatureValue === false) throw new RuntimeException('SignatureValue is not valid Base64.');
            $algorithm = self::xmlSignatureAlgorithm($signatureMethod);
            if ($algorithm === null) throw new RuntimeException("Unsupported XML signature algorithm '{$signatureMethod}'.");

            $pem = Utils::derToPem($certificates[0]);
            $publicKey = openssl_pkey_get_public($pem);
            if ($publicKey === false) throw new RuntimeException('Cannot read the public key from X509Certificate.');
            $signatureValid = openssl_verify($canonicalSignedInfo, $signatureValue, $publicKey, $algorithm) === 1;
            $valid = $signatureValid && $allReferencesValid;
            $message = $valid
                ? 'XML signature and referenced digests are valid.'
                : (!$signatureValid ? 'XML SignatureValue is invalid.' : 'At least one XML reference digest is invalid.');
        } catch (Throwable $error) {
            $valid = false;
            $message = $error->getMessage();
        }

        $certificateDetails = array_map(static fn(string $der): array => Certificate::describe($der), $certificates);
        foreach ($certificateDetails as $certificate) {
            if (($certificate['valid_at_check_time'] ?? null) === false) {
                $warnings[] = 'At least one signing certificate is not valid at the current check time.';
            }
        }
        $warnings[] = 'Certificate chain trust and revocation status were not evaluated.';

        return [
            'index' => $index,
            'valid' => $valid,
            'error_code' => $valid ? null : 'XML_SIGNATURE_INVALID',
            'message' => $message,
            'signing_time' => self::signingTime($signatureNode),
            'signature_method' => $signatureMethod,
            'canonicalization_method' => $canonicalizationMethod,
            'references' => $references,
            'certificates' => $certificateDetails,
            'warnings' => array_values(array_unique($warnings)),
        ];
    }

    private static function verifyReference(
        DOMDocument $document,
        DOMElement $signatureNode,
        DOMElement $referenceNode,
        int $signatureIndex
    ): array {
        $xpath = self::xpath($document);
        $uri = $referenceNode->getAttribute('URI');
        $external = $uri !== '' && !str_starts_with($uri, '#');
        $digestMethod = self::attribute($xpath, './ds:DigestMethod', 'Algorithm', $referenceNode);
        $storedDigest = trim((string) ($xpath->query('./ds:DigestValue', $referenceNode)?->item(0)?->textContent ?? ''));
        $transformNodes = $xpath->query('./ds:Transforms/ds:Transform', $referenceNode);
        $transforms = [];
        if ($transformNodes !== false) {
            foreach ($transformNodes as $transformNode) {
                if ($transformNode instanceof DOMElement) $transforms[] = $transformNode->getAttribute('Algorithm');
            }
        }

        $base = [
            'uri' => $uri,
            'digest_method' => $digestMethod,
            'digest_value' => $storedDigest,
            'transforms' => $transforms,
            'target' => null,
            'target_count' => null,
            'external_reference' => $external,
        ];
        if ($external) return $base + ['valid' => false, 'message' => 'External XML references are not supported.'];

        [$clone, $target, $targetCount] = self::cloneAndResolveTarget($document, $uri);
        $base['target_count'] = $targetCount;
        $base['target'] = $target?->nodeName;
        if (!$target instanceof DOMElement || $targetCount !== 1) {
            return $base + ['valid' => false, 'message' => 'Reference target does not resolve to exactly one element.'];
        }

        $canonicalization = self::C14N;
        foreach ($transforms as $position => $transform) {
            if ($transform === self::ENVELOPED) {
                self::removeSignatureFromClone($clone, $signatureNode->getAttribute('Id'), $signatureIndex);
            } elseif ($transform === self::XPATH) {
                $transformNode = $transformNodes?->item($position);
                $expression = trim((string) ($transformNode?->textContent ?? ''));
                if (!self::isSimpleSignatureExclusionXpath($expression)) {
                    return $base + ['valid' => false, 'message' => 'This XML XPath transform is not supported.'];
                }
                self::removeSignatureFromClone($clone, $signatureNode->getAttribute('Id'), $signatureIndex);
            } elseif (in_array($transform, [self::C14N, self::C14N_COMMENTS, self::EXC_C14N, self::EXC_C14N_COMMENTS], true)) {
                $canonicalization = $transform;
            } else {
                return $base + ['valid' => false, 'message' => "Unsupported XML transform '{$transform}'."];
            }
        }

        $target = self::resolveTarget($clone, $uri)[0];
        if (!$target instanceof DOMElement) return $base + ['valid' => false, 'message' => 'Reference target disappeared after transforms.'];
        $canonical = self::canonicalize($target, $canonicalization);
        $hashName = self::xmlDigestName($digestMethod);
        if ($hashName === null) return $base + ['valid' => false, 'message' => "Unsupported XML digest algorithm '{$digestMethod}'."];
        $actualDigest = base64_encode(hash($hashName, $canonical, true));
        $valid = hash_equals($storedDigest, $actualDigest);

        return $base + [
            'valid' => $valid,
            'actual_digest_value' => $actualDigest,
            'message' => $valid ? 'Reference digest is valid.' : 'Reference digest does not match the document.',
        ];
    }

    private static function load(string $xml): array
    {
        $previous = libxml_use_internal_errors(true);
        libxml_clear_errors();
        $document = new DOMDocument();
        $document->preserveWhiteSpace = true;
        $document->formatOutput = false;
        $loaded = $document->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT);
        $errors = array_map(static fn(LibXMLError $error): array => [
            'level' => $error->level,
            'line' => $error->line,
            'column' => $error->column,
            'message' => trim($error->message),
        ], libxml_get_errors());
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (!$loaded || !$document->documentElement) throw new ApiException(422, 'INVALID_XML', 'The XML document is malformed.');
        return [$document, $errors];
    }

    private static function xpath(DOMDocument $document): DOMXPath
    {
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('ds', self::DSIG_NS);
        return $xpath;
    }

    private static function attribute(DOMXPath $xpath, string $query, string $attribute, DOMNode $context): ?string
    {
        $node = $xpath->query($query, $context)?->item(0);
        return $node instanceof DOMElement ? ($node->getAttribute($attribute) ?: null) : null;
    }

    private static function canonicalize(DOMNode $node, ?string $algorithm): string
    {
        $exclusive = in_array($algorithm, [self::EXC_C14N, self::EXC_C14N_COMMENTS], true);
        $comments = in_array($algorithm, [self::C14N_COMMENTS, self::EXC_C14N_COMMENTS], true);
        if (!in_array($algorithm, [self::C14N, self::C14N_COMMENTS, self::EXC_C14N, self::EXC_C14N_COMMENTS], true)) {
            throw new RuntimeException("Unsupported canonicalization algorithm '{$algorithm}'.");
        }
        $canonical = $node->C14N($exclusive, $comments);
        if ($canonical === false) throw new RuntimeException('XML canonicalization failed.');
        return $canonical;
    }

    private static function cloneAndResolveTarget(DOMDocument $document, string $uri): array
    {
        $clone = new DOMDocument();
        $clone->preserveWhiteSpace = true;
        $serialized = $document->saveXML();
        if ($serialized === false || !$clone->loadXML($serialized, LIBXML_NONET | LIBXML_COMPACT)) {
            throw new RuntimeException('Cannot clone XML document for reference verification.');
        }
        [$target, $count] = self::resolveTarget($clone, $uri);
        return [$clone, $target, $count];
    }

    private static function resolveTarget(DOMDocument $document, string $uri): array
    {
        if ($uri === '') return [$document->documentElement, $document->documentElement ? 1 : 0];
        if (!str_starts_with($uri, '#')) return [null, null];
        $id = substr($uri, 1);
        $matches = [];
        foreach ($document->getElementsByTagName('*') as $element) {
            if (!$element instanceof DOMElement) continue;
            foreach (['Id', 'ID', 'id'] as $name) {
                if ($element->getAttribute($name) === $id) {
                    $matches[] = $element;
                    break;
                }
            }
        }
        return [$matches[0] ?? null, count($matches)];
    }

    private static function removeSignatureFromClone(DOMDocument $clone, string $signatureId, int $signatureIndex): void
    {
        $nodes = self::xpath($clone)->query('//ds:Signature');
        if ($nodes === false) return;
        $candidate = null;
        foreach ($nodes as $node) {
            if ($node instanceof DOMElement && $signatureId !== '' && $node->getAttribute('Id') === $signatureId) {
                $candidate = $node;
                break;
            }
        }
        $candidate ??= $nodes->item($signatureIndex - 1);
        if ($candidate instanceof DOMNode && $candidate->parentNode) $candidate->parentNode->removeChild($candidate);
    }

    private static function isSimpleSignatureExclusionXpath(string $expression): bool
    {
        $normalized = preg_replace('/\s+/', '', $expression) ?? '';
        return str_starts_with($normalized, 'not(ancestor-or-self::') && str_contains($normalized, 'Signature');
    }

    private static function xmlDigestName(?string $algorithm): ?string
    {
        return match ($algorithm) {
            'http://www.w3.org/2000/09/xmldsig#sha1' => 'sha1',
            'http://www.w3.org/2001/04/xmlenc#sha256' => 'sha256',
            'http://www.w3.org/2001/04/xmldsig-more#sha384' => 'sha384',
            'http://www.w3.org/2001/04/xmlenc#sha512' => 'sha512',
            default => null,
        };
    }

    private static function xmlSignatureAlgorithm(?string $algorithm): int|string|null
    {
        return match ($algorithm) {
            'http://www.w3.org/2000/09/xmldsig#rsa-sha1' => OPENSSL_ALGO_SHA1,
            'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' => OPENSSL_ALGO_SHA256,
            'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384' => OPENSSL_ALGO_SHA384,
            'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512' => OPENSSL_ALGO_SHA512,
            default => null,
        };
    }

    private static function signingTime(DOMElement $signatureNode): ?string
    {
        foreach ($signatureNode->getElementsByTagName('*') as $node) {
            if ($node->localName !== 'SigningTime') continue;
            try {
                return (new DateTimeImmutable(trim($node->textContent)))->format('Y-m-d\TH:i:sP');
            } catch (Throwable) {
                return trim($node->textContent) ?: null;
            }
        }
        return null;
    }
}
