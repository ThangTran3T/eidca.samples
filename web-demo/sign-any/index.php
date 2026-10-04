<?php

declare(strict_types=1);

require_once __DIR__ . '/src/bootstrap.php';

$config = app_config();
$defaults = app_defaults();
$mode = (string) ($config['mode'] ?? 'mock');
$bootstrap = [
    'mode' => $mode,
    'platformUrl' => (string) ($config['platform_url'] ?? ''),
    'brokerPageBase' => (string) ($config['broker_page_base'] ?? ''),
    'stepId' => (string) ($config['broker_step_id'] ?? 'broker_selection'),
    'completeSeconds' => (int) ($config['mock_complete_seconds'] ?? 6),
    'defaults' => $defaults,
    'providers' => array_values((array) ($config['mock_providers'] ?? [])),
];
$bootstrapJson = json_encode(
    $bootstrap,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);
?>
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Demo luồng ký số Universal Broker với provider = ANY trên nền tảng VNeCA">
    <title>VNeCA · Universal Broker (provider = ANY)</title>
    <link rel="stylesheet" href="assets/styles.css">
    <script id="bootstrap" type="application/json"><?= $bootstrapJson ?></script>
    <script src="assets/app.js" type="module"></script>
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <div class="brand">V</div>
        <div>
          <p class="eyebrow">VNeCA · UNIVERSAL BROKER</p>
          <h1>Ký số với provider = ANY</h1>
          <p class="subtitle">
            Walkthrough đầy đủ luồng <code>provider = ANY</code>: nền tảng không biết trước CA,
            người ký tự chọn nhà cung cấp trên portal <code>/broker</code>, rồi nền tảng resume bước
            <code>broker_selection</code> để chạy phiên ký.
          </p>
          <p class="mode-line">
            Chế độ:
            <span id="mode-badge" class="mode-badge <?= $mode === 'live' ? 'live' : 'mock' ?>"><?= htmlspecialchars($mode, ENT_QUOTES) ?></span>
            <span class="muted">Gateway: <code id="gateway-url"><?= htmlspecialchars((string) ($bootstrap['platformUrl']), ENT_QUOTES) ?></code></span>
          </p>
        </div>
      </header>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">00 · LUỒNG</p><h2>Các bước của Universal Broker</h2></div>
          <button id="auto-run" class="secondary" type="button">Tự động chạy 0.1 → 3.2</button>
        </div>
        <ol class="flow" id="flow">
          <li class="flow-item" data-step="token"><span class="flow-index">0.1</span><strong>Auth</strong><small>client_credentials → access_token</small></li>
          <li class="flow-item" data-step="create"><span class="flow-index">1.1</span><strong>Tạo giao dịch</strong><small>provider = ANY, không có method_code</small></li>
          <li class="flow-item" data-step="get"><span class="flow-index">1.2</span><strong>Đọc trạng thái</strong><small>CLIENT_ACTION_REQUIRED + REDIRECT_BROKER</small></li>
          <li class="flow-item" data-step="open"><span class="flow-index">2.1</span><strong>Mở phiên broker</strong><small>resume_token → session_token</small></li>
          <li class="flow-item" data-step="resume"><span class="flow-index">2.2</span><strong>Chọn CA</strong><small>METHOD_SELECTED → RUNNING</small></li>
          <li class="flow-item" data-step="poll"><span class="flow-index">3.2</span><strong>Poll</strong><small>WAITING_CLIENT → COMPLETED</small></li>
        </ol>
        <p class="flow-note">
          Nhánh phụ: <code>2.3 :revoke</code> (người dùng rời portal trước khi chọn CA) và
          <code>3.1 client-steps/broker_selection:resume</code> (đường S2S dùng
          <code>resume_token</code> một lần).
        </p>
      </section>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">01 · THAM SỐ</p><h2>Cấu hình gửi lên nền tảng</h2></div>
          <button id="reset-form" class="secondary" type="button">Khôi phục mặc định</button>
        </div>
        <div class="form-grid" id="params">
          <label>tenant_id<input data-field="tenant_id" type="text"></label>
          <label>client_id<input data-field="client_id" type="text"></label>
          <label>client_secret<input data-field="client_secret" type="text"></label>
          <label>scope<input data-field="scope" type="text"></label>
          <label>integration_key<input data-field="integration_key" type="text"></label>
          <label>business_category<input data-field="business_category" type="text"></label>
          <label>identity.user_id<input data-field="user_id" type="text"></label>
          <label>signing.document_name<input data-field="document_name" type="text"></label>
          <label class="wide">signing.document_hash (Base64)<input data-field="document_hash" type="text"></label>
          <label>idempotency_key<input data-field="idempotency_key" type="text"></label>
          <label>device_fingerprint<input data-field="device_fingerprint" type="text"></label>
          <label>environment<input data-field="environment" type="text"></label>
          <label>channel<input data-field="channel" type="text"></label>
          <label>flow_code<input data-field="flow_code" type="text"></label>
          <label class="wide">
            method_code (test âm: flow ANY không nhận ở 1.1)
            <input data-field="method_code" type="text" placeholder="để trống = đúng luật ANY">
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">02 · ĐIỀU KHIỂN</p><h2>Chạy từng bước</h2></div>
          <span id="busy-badge" class="busy hidden">đang gọi API…</span>
        </div>
        <div class="actions">
          <button data-step="token" type="button">0.1 · Lấy access_token</button>
          <button data-step="create" type="button">1.1 · Tạo giao dịch</button>
          <button data-step="get" type="button">1.2 · Đọc trạng thái</button>
          <button data-step="open" type="button">2.1 · Mở phiên broker</button>
          <button data-step="resume" type="button">2.2 · Người ký chọn CA</button>
          <button data-step="revoke" class="danger" type="button">2.3 · Huỷ phiên broker</button>
          <button data-step="s2s" type="button">3.1 · S2S resume client-step</button>
          <button data-step="poll" type="button">3.2 · Đọc trạng thái cuối</button>
        </div>
        <p id="request-error" class="error hidden" role="alert"></p>
      </section>

      <section id="broker-portal" class="panel portal hidden">
        <div class="panel-title">
          <div>
            <p class="eyebrow">MÔ PHỎNG · /broker</p>
            <h2>Portal của người ký (enduser-portal)</h2>
          </div>
          <span id="portal-session" class="mono muted"></span>
        </div>
        <p class="portal-copy">
          Đây là trang mà <code>client_instruction.url</code> trỏ tới. Người ký chọn một nhà cung cấp
          chứng thư số; portal gọi <code>2.2 POST /v1/broker/sessions/{session_id}:resume</code>
          với <code>session_token</code> làm Bearer.
        </p>
        <div class="providers" id="providers"></div>
        <div class="actions">
          <button data-step="resume" class="primary" type="button">Chọn CA &amp; bắt đầu ký</button>
          <button data-step="revoke" class="danger" type="button">Rời trang (revoke)</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">03 · BIẾN PHIÊN</p><h2>Giá trị trích ra như test-script Postman</h2></div>
          <button id="clear-log" class="secondary" type="button">Xoá nhật ký &amp; state</button>
        </div>
        <div class="state-grid" id="state"></div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">04 · NHẬT KÝ HTTP</p><h2>Request / Response từng bước</h2></div>
          <span id="log-count" class="muted">0</span>
        </div>
        <div id="log" class="log"><p class="empty">Chưa có request nào. Bấm một bước ở mục 02 để bắt đầu.</p></div>
      </section>

      <footer>
        <span>BFF: <code>POST api/bff.php</code> · Health: <code>GET api/health.php</code></span>
        <span>mode = mock chạy hoàn toàn trong PHP; mode = live chuyển tiếp tới <code>platform_url</code>.</span>
      </footer>
    </main>
  </body>
</html>

