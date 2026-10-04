<?php

declare(strict_types=1);

/**
 * MockPlatform — giả lập đúng contract của "Universal Broker (provider = ANY)"
 * theo collection web-demo/sign-any/universal-broker.postman_collection.json.
 *
 * Trạng thái (giao dịch, phiên broker, token) lưu trong runtime/store.json qua Store.
 */
final class MockPlatform implements Platform
{
    /** @param array<string,mixed> $config */
    public function __construct(private array $config)
    {
    }

    /**
     * @param  array<string,string>     $headers
     * @param  array<string,mixed>|null $body
     * @return array{http_status:int, body:array<string,mixed>}
     */
    public function send(string $method, string $path, ?array $body, array $headers): array
    {
        $path = '/' . ltrim($path, '/');
        if (($pos = strpos($path, '?')) !== false) {
            $path = substr($path, 0, $pos);
        }
        $body ??= [];
        $headers = array_change_key_case($headers, CASE_LOWER);

        if ($method === 'POST' && $path === '/v1/auth/oauth/token') {
            return $this->oauthToken($body);
        }
        if ($method === 'POST' && $path === '/v1/integration/signing-transactions') {
            return $this->createTransaction($body, $headers);
        }
        if ($method === 'GET' && preg_match('#^/v1/integration/signing-transactions/([^/]+)$#', $path, $m) === 1) {
            return $this->getTransaction($m[1], $headers);
        }
        if ($method === 'POST' && $path === '/v1/broker/sessions') {
            return $this->brokerOpen($body);
        }
        if ($method === 'POST' && preg_match('#^/v1/broker/sessions/([^/:]+):resume$#', $path, $m) === 1) {
            return $this->brokerResume($m[1], $body, $headers);
        }
        if ($method === 'POST' && preg_match('#^/v1/broker/sessions/([^/:]+):revoke$#', $path, $m) === 1) {
            return $this->brokerRevoke($m[1], $body, $headers);
        }
        if ($method === 'POST' && preg_match('#^/v1/integration/signing-transactions/([^/]+)/client-steps/([^/:]+):resume$#', $path, $m) === 1) {
            return $this->clientStepResume($m[1], $m[2], $body, $headers);
        }

        return $this->fail(404, 'ENDPOINT_NOT_FOUND', "Mock chưa hỗ trợ {$method} {$path}.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers dùng chung
    // ─────────────────────────────────────────────────────────────────────────

    /** @param array<string,mixed> $data */
    private function ok(array $data): array
    {
        return ['http_status' => 200, 'body' => ['success' => true, 'data' => $data]];
    }

    private function fail(int $status, string $code, string $message): array
    {
        return [
            'http_status' => $status,
            'body' => ['success' => false, 'error' => ['code' => $code, 'message' => $message]],
        ];
    }

    /** @param array<string,string> $headers */
    private function bearer(array $headers): string
    {
        $auth = (string) ($headers['authorization'] ?? '');
        if (stripos($auth, 'bearer ') === 0) {
            return trim(substr($auth, 7));
        }
        return '';
    }

    private function tokenValid(string $token): bool
    {
        if ($token === '') {
            return false;
        }
        return (bool) Store::update(static function (array &$state) use ($token): bool {
            return isset($state['tokens'][$token]);
        });
    }

    private function sessionToken(string $transactionId, string $sessionId): string
    {
        return 'bst_' . hash('sha256', $sessionId . '|' . $transactionId);
    }

    /** @param array<string,mixed> $tx */
    private function brokerUrl(array $tx): string
    {
        $base = rtrim((string) ($this->config['broker_page_base'] ?? 'https://portal.vneca.vn/broker'), '/');
        return $base . '?tenant_id=' . rawurlencode((string) $tx['tenant_id'])
            . '&transaction_id=' . rawurlencode((string) $tx['transaction_id'])
            . '&resume_token=' . rawurlencode((string) $tx['broker_challenge']);
    }

    private function providerNextUrl(string $methodCode): string
    {
        $base = rtrim((string) ($this->config['provider_page_base'] ?? 'https://ca.vneca.vn/redirect'), '/');
        return $base . '?method_code=' . rawurlencode($methodCode);
    }

    /**
     * Vòng đời giao dịch sau khi đã chọn CA: RUNNING -> WAITING_CLIENT -> COMPLETED.
     *
     * @param  array<string,mixed> $tx
     * @return array{0:string,1:string} [runtime_status, transaction_status]
     */
    private function statusOf(array $tx): array
    {
        if ($tx['selected_at'] === null) {
            return ['WAITING_CLIENT', 'CLIENT_ACTION_REQUIRED'];
        }
        $elapsed = time() - (int) $tx['selected_at'];
        $done = (int) ($this->config['mock_complete_seconds'] ?? 6);
        if ($elapsed >= $done) {
            return ['COMPLETED', 'COMPLETED'];
        }
        if ($elapsed >= 2) {
            return ['WAITING_CLIENT', 'METHOD_SELECTED'];
        }
        return ['RUNNING', 'METHOD_SELECTED'];
    }

    /**
     * Hình dạng giao dịch trả về cho 1.1 (create) và 1.2 / 3.2 (get).
     *
     * @param  array<string,mixed> $tx
     * @return array<string,mixed>
     */
    private function transactionPresentation(array $tx): array
    {
        [$runtime, $txStatus] = $this->statusOf($tx);
        $started = $tx['selected_at'] !== null;
        $stepId = (string) ($this->config['broker_step_id'] ?? 'broker_selection');
        $brokerUrl = $this->brokerUrl($tx);

        $step = [
            'step_name' => (string) ($this->config['broker_step_name'] ?? 'UNIVERSAL_BROKER'),
            'step_execution_id' => $stepId,
            'status' => $started ? 'COMPLETED' : 'WAITING_CLIENT',
            'client_output' => [
                'broker_url' => $brokerUrl,
                'resume_token' => (string) $tx['s2s_resume_token'],
            ],
        ];

        $data = [
            'transaction_id' => (string) $tx['transaction_id'],
            'status' => $runtime,
            'runtime_status' => $runtime,
            'transaction_status' => $txStatus,
            'steps' => [$step],
            'method_code' => $tx['method_code'],
            'provider_id' => $tx['provider_id'],
            // CHỈ khi chưa có phiên chạy provider mới trả chỉ dẫn REDIRECT_BROKER.
            'client_instruction' => $started ? null : [
                'type' => 'REDIRECT_BROKER',
                'url' => $brokerUrl,
                'resume_token' => (string) $tx['s2s_resume_token'],
                'step_execution_id' => $stepId,
                'purpose' => 'broker_redirect',
            ],
        ];

        if ($started) {
            $data['signed_at'] = gmdate('Y-m-d\TH:i:s\Z', (int) $tx['selected_at']);
        }

        return $data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 0.1 — Auth (OAuth2 client_credentials)
    // ─────────────────────────────────────────────────────────────────────────

    /** @param array<string,mixed> $body */
    private function oauthToken(array $body): array
    {
        $grant = (string) ($body['grant_type'] ?? '');
        $clientId = (string) ($body['client_id'] ?? '');
        $secret = (string) ($body['client_secret'] ?? '');
        $scope = (string) ($body['scope'] ?? '');

        if ($grant !== 'client_credentials') {
            return $this->fail(400, 'UNSUPPORTED_GRANT_TYPE', 'Chỉ hỗ trợ grant_type = client_credentials.');
        }
        if ($clientId === '' || $secret === '') {
            return $this->fail(401, 'INVALID_CLIENT', 'Thiếu client_id hoặc client_secret.');
        }
        $missing = array_values(array_filter(
            ['signing:create', 'signing:read', 'signing:resume'],
            static fn (string $s): bool => !str_contains($scope, $s),
        ));
        if ($missing !== []) {
            return $this->fail(403, 'INSUFFICIENT_SCOPE', 'Scope thiếu: ' . implode(', ', $missing) . '.');
        }

        $token = 'at_' . bin2hex(random_bytes(16));
        Store::update(static function (array &$state) use ($token, $clientId, $scope): void {
            $state['tokens'][$token] = [
                'client_id' => $clientId,
                'scope' => $scope,
                'issued_at' => time(),
            ];
        });

        return $this->ok([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'scope' => $scope,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1.1 — Tạo giao dịch Universal Broker (provider = ANY, KHÔNG kèm method_code)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string,mixed>  $body
     * @param  array<string,string> $headers
     */
    private function createTransaction(array $body, array $headers): array
    {
        if (!$this->tokenValid($this->bearer($headers))) {
            return $this->fail(401, 'INVALID_TOKEN', 'access_token thiếu hoặc không hợp lệ.');
        }

        $tenantId = (string) ($body['tenant_id'] ?? ($headers['x-tenant-id'] ?? ''));
        if ($tenantId === '') {
            return $this->fail(400, 'TENANT_REQUIRED', 'Thiếu tenant_id.');
        }
        $integrationKey = (string) ($body['integration_key'] ?? '');
        if ($integrationKey === '') {
            return $this->fail(400, 'INTEGRATION_KEY_REQUIRED', 'Thiếu integration_key.');
        }

        // business_category: flow ANY bắt buộc khai và phải KHỚP profile đã publish.
        $category = $body['business_category'] ?? null;
        if ($category === null || $category === '') {
            return $this->fail(400, 'BUSINESS_CATEGORY_REQUIRED', 'Flow ANY bắt buộc khai business_category.');
        }
        if (!(bool) ($this->config['flow_declares_business_category'] ?? true)) {
            return $this->fail(400, 'BUSINESS_CATEGORY_NOT_DECLARED', 'Flow không khai business_category.');
        }
        if ((string) $category !== (string) ($this->config['flow_business_category'] ?? '')) {
            return $this->fail(400, 'BUSINESS_CATEGORY_MISMATCH', 'business_category không khớp flow đã publish.');
        }

        $idempotencyKey = (string) ($body['idempotency_key'] ?? ($headers['idempotency-key'] ?? ''));
        if ($idempotencyKey === '') {
            return $this->fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu idempotency_key (body hoặc header).');
        }

        $documentHash = (string) ($body['signing']['document_hash'] ?? '');
        if ($documentHash === '') {
            return $this->fail(400, 'DOCUMENT_HASH_REQUIRED', 'Thiếu signing.document_hash.');
        }

        // ĐIỂM KHÁC BIỆT của flow ANY: không nhận method_code ở bước tạo giao dịch.
        if (!empty($body['method_code']) || !empty($body['signing_method']) || !empty($body['signing']['method_code'])) {
            return $this->fail(400, 'METHOD_NOT_ALLOWED_FOR_ANY', 'Flow ANY không nhận method_code ở bước tạo giao dịch.');
        }

        return Store::update(function (array &$state) use ($body, $tenantId, $integrationKey, $idempotencyKey, $documentHash, $category): array {
            $existingId = $state['idempotency'][$tenantId][$idempotencyKey] ?? null;
            if ($existingId !== null && isset($state['transactions'][$existingId])) {
                $existing = &$state['transactions'][$existingId];
                if ((string) $existing['document_hash'] !== $documentHash) {
                    return $this->fail(409, 'DOCUMENT_HASH_MISMATCH', 'Cùng idempotency_key nhưng digest khác.');
                }
                // Gửi lại cùng khoá: nhận lại đúng giao dịch đó, xoay challenge mới.
                $existing['broker_challenge'] = 'brc_' . bin2hex(random_bytes(12));
                $data = $this->transactionPresentation($existing);
                $data['replayed'] = true;
                return $this->ok($data);
            }

            $txId = 'ist_' . bin2hex(random_bytes(16));
            $state['transactions'][$txId] = [
                'transaction_id' => $txId,
                'tenant_id' => $tenantId,
                'integration_key' => $integrationKey,
                'business_category' => (string) $category,
                'idempotency_key' => $idempotencyKey,
                'reference_id' => $body['reference_id'] ?? $idempotencyKey,
                'identity' => $body['identity'] ?? [],
                'document_name' => (string) ($body['signing']['document_name'] ?? ''),
                'document_hash' => $documentHash,
                'broker_challenge' => 'brc_' . bin2hex(random_bytes(12)),
                's2s_resume_token' => 'rst_' . bin2hex(random_bytes(12)),
                's2s_resume_used' => false,
                'method_code' => null,
                'provider_id' => null,
                'environment' => null,
                'channel' => null,
                'flow_code' => null,
                'selected_at' => null,
                'created_at' => time(),
                'sessions' => [],
            ];
            $state['idempotency'][$tenantId][$idempotencyKey] = $txId;

            $data = $this->transactionPresentation($state['transactions'][$txId]);
            $data['replayed'] = false;
            return $this->ok($data);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1.2 / 3.2 — Đọc trạng thái (GET)
    // ─────────────────────────────────────────────────────────────────────────

    /** @param array<string,string> $headers */
    private function getTransaction(string $transactionId, array $headers): array
    {
        if (!$this->tokenValid($this->bearer($headers))) {
            return $this->fail(401, 'INVALID_TOKEN', 'access_token thiếu hoặc không hợp lệ.');
        }

        return Store::update(function (array &$state) use ($transactionId): array {
            if (!isset($state['transactions'][$transactionId])) {
                return $this->fail(404, 'TRANSACTION_NOT_FOUND', 'Không tìm thấy giao dịch.');
            }
            $tx = &$state['transactions'][$transactionId];
            if ($tx['selected_at'] === null) {
                // Chưa có phiên chạy provider: trả lại hình dạng bước broker, resume_token MỚI.
                $tx['broker_challenge'] = 'brc_' . bin2hex(random_bytes(12));
            }
            return $this->ok($this->transactionPresentation($tx));
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2.1 — Người dùng cuối mở phiên broker (ẩn danh, đổi challenge lấy phiên)
    // ─────────────────────────────────────────────────────────────────────────

    /** @param array<string,mixed> $body */
    private function brokerOpen(array $body): array
    {
        $tenantId = (string) ($body['tenant_id'] ?? '');
        $txId = (string) ($body['transaction_id'] ?? '');
        $challenge = (string) ($body['resume_token'] ?? '');
        $device = (string) ($body['device_fingerprint'] ?? '');

        if ($tenantId === '' || $txId === '' || $challenge === '') {
            return $this->fail(400, 'INVALID_REQUEST', 'Thiếu tenant_id / transaction_id / resume_token.');
        }
        if ($device === '') {
            return $this->fail(400, 'DEVICE_FINGERPRINT_REQUIRED', 'Thiếu device_fingerprint.');
        }

        return Store::update(function (array &$state) use ($tenantId, $txId, $challenge, $device): array {
            if (!isset($state['transactions'][$txId])) {
                return $this->fail(404, 'RESUME_TOKEN_NOT_FOUND', 'Challenge không khớp giao dịch nào.');
            }
            $tx = &$state['transactions'][$txId];
            if ((string) $tx['tenant_id'] !== $tenantId || (string) $tx['broker_challenge'] !== $challenge) {
                return $this->fail(404, 'RESUME_TOKEN_NOT_FOUND', 'Challenge không khớp tenant/giao dịch/bước.');
            }
            if ($tx['selected_at'] !== null) {
                return $this->fail(409, 'BROKER_NOT_WAITING', 'Giao dịch không ở trạng thái CLIENT_ACTION_REQUIRED.');
            }

            // Luật "một phiên sống cho mỗi giao dịch".
            foreach ($tx['sessions'] as $sid => $sess) {
                if ($sess['status'] === 'ISSUED') {
                    if ($sess['device_fingerprint'] !== $device) {
                        return $this->fail(409, 'BROKER_SESSION_ALREADY_ISSUED', 'Link đã mở ở thiết bị khác.');
                    }
                    return $this->ok($this->sessionPresentation($txId, $tx, (string) $sid, $sess));
                }
            }

            $sid = 'bs_' . bin2hex(random_bytes(12));
            $state['transactions'][$txId]['sessions'][$sid] = [
                'session_id' => $sid,
                'status' => 'ISSUED',
                'device_fingerprint' => $device,
                'created_at' => time(),
                'selected' => null,
            ];
            $state['session_index'][$sid] = $txId;

            return $this->ok($this->sessionPresentation($txId, $state['transactions'][$txId], $sid, $state['transactions'][$txId]['sessions'][$sid]));
        });
    }

    /**
     * Hình dạng phiên broker trả về cho 2.1.
     *
     * @param array<string,mixed> $tx
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private function sessionPresentation(string $txId, array $tx, string $sid, array $session): array
    {
        return [
            'status' => 'BROKER_SESSION_' . $session['status'],
            'session_id' => $sid,
            'session_token' => $this->sessionToken($txId, $sid),
            'transaction_id' => $txId,
            'expires_in' => 900,
            'providers' => array_values((array) ($this->config['mock_providers'] ?? [])),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2.2 — Người dùng cuối chọn CA (thẩm quyền là session_token Bearer)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string,mixed>  $body
     * @param  array<string,string> $headers
     */
    private function brokerResume(string $sessionId, array $body, array $headers): array
    {
        $token = $this->bearer($headers);
        $device = (string) ($body['device_fingerprint'] ?? '');
        $result = (array) ($body['client_result'] ?? []);
        $method = (string) ($result['method_code'] ?? '');

        if ($method === '') {
            return $this->fail(400, 'INVALID_BROKER_SELECTION', 'Thiếu client_result.method_code.');
        }

        return Store::update(function (array &$state) use ($sessionId, $token, $device, $result, $method): array {
            $txId = $state['session_index'][$sessionId] ?? null;
            if ($txId === null || !isset($state['transactions'][$txId]['sessions'][$sessionId])) {
                return $this->fail(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên broker.');
            }
            $tx = &$state['transactions'][$txId];
            $session = &$tx['sessions'][$sessionId];

            if ($token === '' || $token !== $this->sessionToken($txId, $sessionId)) {
                return $this->fail(401, 'INVALID_SESSION_TOKEN', 'session_token không hợp lệ.');
            }
            if ($session['status'] === 'REVOKED') {
                return $this->fail(401, 'BROKER_SESSION_REVOKED', 'Phiên đã bị thu hồi.');
            }
            if ($device === '' || $device !== $session['device_fingerprint']) {
                return $this->fail(401, 'DEVICE_MISMATCH', 'Thiết bị không khớp phiên.');
            }

            $providerId = (string) ($result['provider_id'] ?? '');

            // Chọn lại CÙNG CA -> 200 idempotent + broker_session.replayed = true.
            if ($session['status'] === 'USED') {
                $previous = (array) ($session['selected'] ?? []);
                if (($previous['method_code'] ?? null) === $method && ($previous['provider_id'] ?? null) === $providerId) {
                    return $this->brokerSelectionResponse($tx, $method, true);
                }
                return $this->fail(409, 'BROKER_SESSION_ALREADY_USED', 'Phiên đã chọn CA khác trước đó.');
            }

            // Ghi nhận lựa chọn và bắt đầu phiên chạy provider.
            $session['status'] = 'USED';
            $session['selected'] = [
                'method_code' => $method,
                'provider_id' => $providerId,
                'environment' => (string) ($result['environment'] ?? ''),
                'channel' => (string) ($result['channel'] ?? ''),
                'flow_code' => (string) ($result['flow_code'] ?? ''),
                'selected_at' => time(),
            ];
            $tx['method_code'] = $session['selected']['method_code'];
            $tx['provider_id'] = $session['selected']['provider_id'];
            $tx['environment'] = $session['selected']['environment'];
            $tx['channel'] = $session['selected']['channel'];
            $tx['flow_code'] = $session['selected']['flow_code'];
            $tx['selected_at'] = time();

            return $this->brokerSelectionResponse($tx, $method, false);
        });
    }

    /**
     * @param array<string,mixed> $tx
     * @return array{http_status:int, body:array<string,mixed>}
     */
    private function brokerSelectionResponse(array $tx, string $method, bool $replayed): array
    {
        $nextUrl = $this->providerNextUrl($method);
        return [
            'http_status' => 200,
            'body' => [
                'success' => true,
                'data' => [
                    'status' => 'PROVIDER_EXECUTION_STARTED',
                    'method_code' => $method,
                    'provider_id' => $tx['provider_id'] ?? null,
                    'client_instruction' => [
                        'type' => 'REDIRECT_PROVIDER',
                        'url' => $nextUrl,
                    ],
                ],
                'broker_session' => ['replayed' => $replayed],
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2.3 — Huỷ phiên broker (người dùng rời trang, chưa chọn CA)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string,mixed>  $body
     * @param  array<string,string> $headers
     */
    private function brokerRevoke(string $sessionId, array $body, array $headers): array
    {
        $token = $this->bearer($headers);
        $device = (string) ($body['device_fingerprint'] ?? '');

        return Store::update(function (array &$state) use ($sessionId, $token, $device): array {
            $txId = $state['session_index'][$sessionId] ?? null;
            if ($txId === null || !isset($state['transactions'][$txId]['sessions'][$sessionId])) {
                return $this->fail(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên broker.');
            }
            $session = &$state['transactions'][$txId]['sessions'][$sessionId];

            if ($token === '' || $token !== $this->sessionToken($txId, $sessionId)) {
                return $this->fail(401, 'INVALID_SESSION_TOKEN', 'session_token không hợp lệ.');
            }
            if ($device === '' || $device !== $session['device_fingerprint']) {
                return $this->fail(401, 'DEVICE_MISMATCH', 'Thiết bị không khớp phiên.');
            }
            // Phiên đã revoke thì :resume sau đó trả 401 và không chạm signing runtime.
            $session['status'] = 'REVOKED';
            $session['revoked_at'] = time();

            return $this->ok(['status' => 'BROKER_SESSION_REVOKED', 'session_id' => $sessionId]);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3.1 — Đường S2S: resume bước broker_selection bằng token dùng MỘT LẦN
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string,mixed>  $body
     * @param  array<string,string> $headers
     */
    private function clientStepResume(string $transactionId, string $stepId, array $body, array $headers): array
    {
        if (!$this->tokenValid($this->bearer($headers))) {
            return $this->fail(401, 'INVALID_TOKEN', 'access_token thiếu hoặc không hợp lệ.');
        }
        $expectedStep = (string) ($this->config['broker_step_id'] ?? 'broker_selection');
        if ($stepId !== $expectedStep) {
            return $this->fail(409, 'CLIENT_STEP_MISMATCH', "Sai tên bước: {$stepId} (phải là {$expectedStep}).");
        }

        $resumeToken = (string) ($body['resume_token'] ?? '');
        $result = (array) ($body['client_result'] ?? []);
        $method = (string) ($result['method_code'] ?? '');
        if ($method === '') {
            return $this->fail(400, 'INVALID_BROKER_SELECTION', 'Thiếu client_result.method_code.');
        }

        return Store::update(function (array &$state) use ($transactionId, $resumeToken, $result, $method): array {
            if (!isset($state['transactions'][$transactionId])) {
                return $this->fail(404, 'TRANSACTION_NOT_FOUND', 'Không tìm thấy giao dịch.');
            }
            $tx = &$state['transactions'][$transactionId];

            // Token chỉ dùng được MỘT lần: gửi lần hai -> 409 RESUME_TOKEN_USED.
            if (!empty($tx['s2s_resume_used'])) {
                return $this->fail(409, 'RESUME_TOKEN_USED', 'resume_token đã bị tiêu (dùng một lần).');
            }
            if ($tx['selected_at'] !== null) {
                return $this->fail(409, 'BROKER_NOT_WAITING', 'Giao dịch đã thoát bước broker.');
            }
            if ($resumeToken === '' || $resumeToken !== (string) $tx['s2s_resume_token']) {
                return $this->fail(401, 'RESUME_TOKEN_INVALID', 'resume_token không hợp lệ.');
            }

            $tx['s2s_resume_used'] = true;
            $tx['method_code'] = $method;
            $tx['provider_id'] = (string) ($result['provider_id'] ?? '');
            $tx['environment'] = (string) ($result['environment'] ?? '');
            $tx['channel'] = (string) ($result['channel'] ?? '');
            $tx['flow_code'] = (string) ($result['flow_code'] ?? '');
            $tx['selected_at'] = time();

            return $this->ok([
                'status' => 'PROVIDER_EXECUTION_STARTED',
                'transaction_id' => $transactionId,
                'method_code' => $tx['method_code'],
                'provider_id' => $tx['provider_id'],
                'client_instruction' => [
                    'type' => 'REDIRECT_PROVIDER',
                    'url' => $this->providerNextUrl($method),
                ],
            ]);
        });
    }
}
