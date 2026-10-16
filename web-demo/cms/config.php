<?php
/**
 * EIDCA CMS – Database Configuration
 * !! Điền thông tin kết nối MySQL của bạn vào đây !!
 */

define('DB_HOST',   'localhost');   // hostname MySQL
define('DB_PORT',   '3306');        // port (mặc định 3306)
define('DB_NAME',   'eidca_cms');   // tên database
define('DB_USER',   'eidca_user');  // username MySQL
define('DB_PASS',   'your_password_here'); // password MySQL
define('DB_CHARSET','utf8mb4');

// ── App Config ────────────────────────────────────────────────────────────────
define('APP_NAME',    'EIDCA CMS');
define('APP_VERSION', '1.0.0');

/**
 * CMS_BASE_PATH: Đường dẫn URL đến thư mục chứa CMS (KHÔNG có dấu / cuối)
 * Ví dụ:
 *   - Nếu deploy tại dev.eidca.vn/cms/   → define('CMS_BASE_PATH', '/cms');
 *   - Nếu deploy tại dev.eidca.vn/       → define('CMS_BASE_PATH', '');
 *   - Nếu deploy tại dev.eidca.vn/web-demo/cms/ → define('CMS_BASE_PATH', '/web-demo/cms');
 * Để trống để tự động phát hiện (có thể sai trên một số shared hosting)
 */
define('CMS_BASE_PATH', '');   // ← Điền vào nếu auto-detect bị sai

// Session: thời gian sống cookie (giây). 604800 = 7 ngày
define('SESSION_LIFETIME', 604800);

// ── Security ──────────────────────────────────────────────────────────────────
// Khóa bí mật cho CSRF token – thay bằng chuỗi ngẫu nhiên dài ít nhất 32 ký tự
define('SECRET_KEY', 'CHANGE_ME_TO_RANDOM_SECRET_32CHARS!!');

// Cho phép user tự đăng ký tài khoản (true/false)
define('ALLOW_SELF_REGISTER', true);

// Default NFC socket URL mặc định khi user chưa tự cấu hình
define('DEFAULT_NFC_URL', 'https://192.168.5.1:8000');
define('DEFAULT_CAM_URL', 'https://192.168.5.1:9000');
