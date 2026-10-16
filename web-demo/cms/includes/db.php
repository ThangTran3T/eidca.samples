<?php
/**
 * EIDCA CMS – Database Singleton (MySQL via PDO)
 */

require_once __DIR__ . '/../config.php';

class DB {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        if (self::$pdo === null) {
            $dsn = 'mysql:host=' . DB_HOST
                 . ';port=' . DB_PORT
                 . ';dbname=' . DB_NAME
                 . ';charset=' . DB_CHARSET;
            try {
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            } catch (PDOException $e) {
                // Tránh lộ thông tin kết nối ra ngoài
                http_response_code(500);
                die('<h2 style="font-family:sans-serif;color:#c00">Lỗi kết nối cơ sở dữ liệu.</h2><p style="font-family:sans-serif">Vui lòng kiểm tra <code>cms/config.php</code>.<br><small>' . htmlspecialchars($e->getMessage()) . '</small></p>');
            }
        }
        return self::$pdo;
    }

    // ── Helper shortcuts ──────────────────────────────────────────────────────

    /** Chạy query với params, trả về PDOStatement */
    public static function query(string $sql, array $params = []): PDOStatement {
        $st = self::get()->prepare($sql);
        $st->execute($params);
        return $st;
    }

    /** Lấy 1 dòng */
    public static function row(string $sql, array $params = []): ?array {
        $r = self::query($sql, $params)->fetch();
        return $r ?: null;
    }

    /** Lấy nhiều dòng */
    public static function rows(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    /** Insert, trả về last insert ID */
    public static function insert(string $sql, array $params = []): int {
        self::query($sql, $params);
        return (int) self::get()->lastInsertId();
    }

    /** Đếm số dòng ảnh hưởng */
    public static function exec(string $sql, array $params = []): int {
        return self::query($sql, $params)->rowCount();
    }
}
