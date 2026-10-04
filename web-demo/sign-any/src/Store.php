<?php

declare(strict_types=1);

/**
 * Lưu trạng thái giả lập của MockPlatform trong một file JSON, có khoá file (flock)
 * để nhiều request PHP cùng lúc không ghi đè nhau.
 *
 * Mọi thao tác đọc/ghi đều đi qua update() để bảo đảm tuần tự.
 */
final class Store
{
    private static string $file = '';

    public static function init(string $dir): void
    {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        self::$file = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . 'store.json';
        if (!is_file(self::$file)) {
            @file_put_contents(self::$file, '{}');
        }
    }

    public static function path(): string
    {
        return self::$file;
    }

    public static function isWritable(): bool
    {
        return self::$file !== '' && is_file(self::$file) && is_writable(self::$file);
    }

    /**
     * Đọc -> biến đổi -> ghi atomically (trong một lock độc quyền).
     *
     * @param  callable(array &$state): mixed $mutator
     * @return mixed Kết quả do $mutator trả về.
     */
    public static function update(callable $mutator): mixed
    {
        $handle = fopen(self::$file, 'c+');
        if ($handle === false) {
            throw new RuntimeException('Không mở được file store giả lập.');
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Không khoá được file store giả lập.');
            }
            $raw = stream_get_contents($handle);
            $state = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
            if (!is_array($state)) {
                $state = [];
            }

            $result = $mutator($state);

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            fflush($handle);

            return $result;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public static function reset(): void
    {
        if (self::$file !== '') {
            @file_put_contents(self::$file, '{}');
        }
    }
}
