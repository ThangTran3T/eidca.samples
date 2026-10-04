<?php

declare(strict_types=1);

require_once __DIR__ . '/ApiException.php';
require_once __DIR__ . '/Store.php';
require_once __DIR__ . '/Platform.php';
require_once __DIR__ . '/MockPlatform.php';
require_once __DIR__ . '/HttpPlatform.php';

/**
 * Nạp cấu hình một lần duy nhất.
 *
 * @return array<string,mixed>
 */
function app_config(): array
{
    static $config;
    if (!is_array($config)) {
        $config = require dirname(__DIR__) . '/config.php';
        Store::init((string) ($config['runtime_dir'] ?? dirname(__DIR__) . '/runtime'));
    }
    return $config;
}

/**
 * Chọn implementation nền tảng theo config mode.
 */
function app_platform(): Platform
{
    $config = app_config();
    return ($config['mode'] ?? 'mock') === 'live'
        ? new HttpPlatform($config)
        : new MockPlatform($config);
}

/**
 * Giá trị mặc định điền sẵn cho form demo.
 *
 * @return array<string,mixed>
 */
function app_defaults(): array
{
    return (array) (app_config()['defaults'] ?? []);
}
