<?php

declare(strict_types=1);

/**
 * Cấu hình cho demo "Universal Broker (provider = ANY)".
 *
 * mode = 'mock'  -> dùng MockPlatform (PHP) giả lập đúng contract của nền tảng,
 *                   demo chạy độc lập, không cần credential thật.
 * mode = 'live'  -> gọi thẳng API Gateway thật qua cURL (platform_url).
 */
return [
    'mode' => 'live',

    // API Gateway (Kong) của nền tảng — dùng cho cả mock (để hiển thị URL) và live.
    // Local: http://localhost:8009
    'platform_url' => 'http://localhost:8009',

    // Thời gian chờ mỗi request cURL (giây) khi mode = live.
    'request_timeout' => 30,

    // CORS cho api/*.php khi frontend và API khác origin. '*' hoặc danh sách cách nhau bởi dấu phẩy.
    'cors_origin' => '*',

    // Nơi lưu trạng thái giả lập của MockPlatform (JSON).
    'runtime_dir' => __DIR__ . '/runtime',

    // ── Chỉ dùng cho MockPlatform ──────────────────────────────────────────────

    // Trang /broker của enduser-portal; nền tảng trả URL này trong client_instruction.
    'broker_page_base' => 'http://localhost:3002/broker', //https://portal.vneca.vn/broker
    // Trang nhà cung cấp CA mà enduser-portal chuyển tới sau khi người ký chọn CA.
    'provider_page_base' => 'https://ca.vneca.vn/redirect',

    // Tên bước broker bắt buộc của flow ANY.
    'broker_step_name' => 'UNIVERSAL_BROKER',
    'broker_step_id' => 'broker_selection',

    // Flow đã publish khai business_category nào và có khai hay không (để test BR-*).
    'flow_declares_business_category' => true,
    'flow_business_category' => 'medical_record',

    // Sau khi chọn CA bao nhiêu giây thì provider chạy xong (mô phỏng vòng đời).
    'mock_complete_seconds' => 6,

    // Danh sách CA × phương thức trả về ở 2.1 (mỗi entry = một lựa chọn cho người ký).
    // Đặt thành [] để mô phỏng tình huống tenant chưa gán CA (providers rỗng).
    'mock_providers' => [
        [
            'provider_id' => 'CA_VNEID',
            'provider_name' => 'VNeID CA',
            'method_code' => 'VNEID',
            'environment' => 'production',
            'channel' => 'web',
            'priority' => 1,
        ],
        [
            'provider_id' => 'CA_CCCD_NFC',
            'provider_name' => 'eIDCA CCCD/NFC',
            'method_code' => 'CCCD_NFC',
            'environment' => 'production',
            'channel' => 'web',
            'priority' => 2,
        ],
        [
            'provider_id' => 'CA_USB_TOKEN',
            'provider_name' => 'eIDCA USB Token',
            'method_code' => 'USB_TOKEN',
            'environment' => 'production',
            'channel' => 'web',
            'priority' => 3,
        ],
        [
            'provider_id' => 'CA_SMART_CARD',
            'provider_name' => 'eIDCA Smart Card',
            'method_code' => 'SMART_CARD',
            'environment' => 'production',
            'channel' => 'web',
            'priority' => 4,
        ],
    ],

    // ── Giá trị mặc định điền sẵn trên form demo ───────────────────────────────
    'defaults' => [
        'tenant_id' => 'ten_040ae30a-27b3-4bcb-929c-36b84275f59d',
        'client_id' => 'cred_c5ab61ec36c4',
        'client_secret' => '6AJPAUMQg8XZ1NvqBvaXui3Nl934WowG1NZHRyqCYXk',
        'scope' => 'signing:create signing:read signing:resume',
        'integration_key' => 'hop-dong-ly-nhan',
        'business_category' => 'general_contract',
        'user_id' => '034080001405',
        'document_name' => 'benh-an.pdf',
        // SHA-256 (Base64) canonical OD-1 — mặc định là digest của tài liệu rỗng.
        // Tên khóa phải trùng data-field của form (index.php) và field API: document_hash.
        'document_hash' => '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
        'idempotency_key' => 'broker_benh_an_2026',
        'device_fingerprint' => 'demo-device-a',
        'environment' => 'production',
        'channel' => 'web',
        'flow_code' => 'default',
    ],
];
