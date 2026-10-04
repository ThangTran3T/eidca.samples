<?php

declare(strict_types=1);

final class Asn1
{
    public const CLASS_UNIVERSAL = 0;
    public const CLASS_CONTEXT = 2;

    public static function parse(string $data): array
    {
        $offset = 0;
        $node = self::read($data, $offset, strlen($data));
        return $node;
    }

    public static function read(string $data, int &$offset, ?int $limit = null): array
    {
        $limit ??= strlen($data);
        $start = $offset;
        if ($offset >= $limit) throw new RuntimeException('Unexpected end of ASN.1 data.');

        $first = ord($data[$offset++]);
        $class = $first >> 6;
        $constructed = ($first & 0x20) !== 0;
        $tag = $first & 0x1f;
        if ($tag === 0x1f) {
            $tag = 0;
            do {
                if ($offset >= $limit) throw new RuntimeException('Truncated ASN.1 tag.');
                $byte = ord($data[$offset++]);
                $tag = ($tag << 7) | ($byte & 0x7f);
            } while (($byte & 0x80) !== 0);
        }

        if ($offset >= $limit) throw new RuntimeException('Missing ASN.1 length.');
        $lengthByte = ord($data[$offset++]);
        if (($lengthByte & 0x80) === 0) {
            $length = $lengthByte;
        } else {
            $count = $lengthByte & 0x7f;
            if ($count === 0 || $count > 6 || $offset + $count > $limit) {
                throw new RuntimeException('Invalid or unsupported ASN.1 length.');
            }
            $length = 0;
            for ($index = 0; $index < $count; $index++) {
                $length = ($length << 8) | ord($data[$offset++]);
            }
        }

        $contentStart = $offset;
        $end = $contentStart + $length;
        if ($end > $limit) throw new RuntimeException('Truncated ASN.1 value.');
        $children = [];
        if ($constructed) {
            while ($offset < $end) {
                $children[] = self::read($data, $offset, $end);
            }
            if ($offset !== $end) throw new RuntimeException('Invalid ASN.1 child length.');
        } else {
            $offset = $end;
        }

        return [
            'class' => $class,
            'constructed' => $constructed,
            'tag' => $tag,
            'start' => $start,
            'content_start' => $contentStart,
            'length' => $length,
            'end' => $end,
            'raw' => substr($data, $start, $end - $start),
            'content' => substr($data, $contentStart, $length),
            'children' => $children,
        ];
    }

    public static function oid(array $node): string
    {
        if ($node['class'] !== self::CLASS_UNIVERSAL || $node['tag'] !== 6 || $node['content'] === '') {
            throw new RuntimeException('ASN.1 value is not an OID.');
        }
        $bytes = array_values(unpack('C*', $node['content']));
        $first = array_shift($bytes);
        $firstArc = min(2, intdiv($first, 40));
        $arcs = [$firstArc, $first - ($firstArc * 40)];
        $value = 0;
        foreach ($bytes as $byte) {
            $value = ($value << 7) | ($byte & 0x7f);
            if (($byte & 0x80) === 0) {
                $arcs[] = $value;
                $value = 0;
            }
        }
        return implode('.', $arcs);
    }

    public static function firstOid(array $sequence): ?string
    {
        $node = $sequence['children'][0] ?? null;
        return is_array($node) && $node['class'] === self::CLASS_UNIVERSAL && $node['tag'] === 6
            ? self::oid($node)
            : null;
    }

    public static function time(array $node): ?string
    {
        if ($node['class'] !== self::CLASS_UNIVERSAL || !in_array($node['tag'], [23, 24], true)) return null;
        $format = $node['tag'] === 23 ? 'ymdHis\Z' : 'YmdHis\Z';
        $date = DateTimeImmutable::createFromFormat($format, $node['content'], new DateTimeZone('UTC'));
        return $date === false ? null : $date->format('Y-m-d\TH:i:s\Z');
    }
}
