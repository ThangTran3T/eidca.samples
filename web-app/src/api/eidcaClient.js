/**
 * web-app/src/api/eidcaClient.js
 * HTTP client gọi eIDCA API.
 *
 * ─── Mock Mode ───────────────────────────────────────────────────────────────
 * BASE_URL = http://localhost:3001  (mock-server.js)
 * Chạy mock server: npm run mock  (hoặc node ../mock/mock-server.js)
 *
 * ─── Live Mode ───────────────────────────────────────────────────────────────
 * BASE_URL = https://api.eidca.vn  (eIDCA production)
 * Cần API Key và Partner Code từ eIDCA cấp
 *
 * ─── Đổi mode ────────────────────────────────────────────────────────────────
 * Dùng hàm setClientConfig() hoặc để tự đọc từ localStorage (ModeToggle).
 */

// ─── Config (đọc từ localStorage → ModeToggle lưu vào đây) ──────────────────

const STORAGE_KEY = "eidca_demo_config";

function _getConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const config = saved ? JSON.parse(saved) : {};
    const isMock = config.isMock !== false; // default: mock
    return {
      // Mock mode: dùng path tương đối "" để Vite proxy chuyển tiếp sang localhost:3001
      // Live mode: dùng URL tuyệt đối từ config người dùng nhập
      baseUrl:     isMock ? ""                           : (config.apiUrl     || "https://api.eidca.vn"),
      apiKey:      isMock ? "MOCK_API_KEY_DEMO"          : (config.apiKey     || ""),
      partnerCode: isMock ? "PARTNER_DEMO_001"           : (config.partnerCode || ""),
    };
  } catch {
    return { baseUrl: "", apiKey: "MOCK_API_KEY_DEMO", partnerCode: "PARTNER_DEMO_001" };
  }
}

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

/**
 * Gọi HTTP request tới eIDCA API (hoặc mock server).
 * Tự động lấy config mới nhất mỗi lần gọi (hỗ trợ đổi mode runtime).
 */
async function request(method, path, { body, headers = {} } = {}) {
  const { baseUrl, apiKey } = _getConfig();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type":   "application/json",
      "Accept":         "*/*",
      "Accept-Encoding":"gzip, deflate, br",
      "x-api-key":      apiKey,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }

  return json;
}

// ─── FLOW 1 — CTS Cá nhân: Đăng ký ─────────────────────────────────────────

/**
 * STEP 1: Lấy challenge để bắt đầu đăng ký CTS cá nhân.
 *
 * Endpoint: POST /ca/api/eid-personal/challenge
 *
 * @param {string} idNumber - Số CCCD/CC 12 số (lấy từ đầu đọc NFC)
 * @returns {Promise<{transaction_code, challenge, token_challenge}>}
 */
export async function personalGetChallenge(idNumber) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-personal/challenge", {
    body: {
      code:      partnerCode,  // Mã partner do eIDCA cấp
      id_number: idNumber,     // Số CCCD 12 chữ số
    },
  });
  return res.data;
}

/**
 * STEP 2: Gửi NFC data, selfie và AA signature để đăng ký CTS.
 *
 * Endpoint: POST /ca/api/eid-personal/signature
 *
 * @param {object} params
 * @param {string} params.transactionCode - Từ STEP 1 (data.transaction_code)
 * @param {string} params.tokenChallenge  - Từ STEP 1 (data.token_challenge)
 * @param {object} params.rawData         - { sod, dg1, dg2, dg13, dg15 } Base64 từ NFC (event id:4)
 * @param {object} params.info            - Thông tin thiết bị + liên hệ + ảnh selfie
 * @param {string} params.signature       - aa_signature từ chip thẻ (event id:7)
 * @returns {Promise<{transaction_code, status, interval, expired_at, token_signature}>}
 */
export async function personalSendSignature({ transactionCode, tokenChallenge, rawData, info, signature }) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-personal/signature", {
    body: {
      code:             partnerCode,
      transaction_code: transactionCode,  // Từ STEP 1
      token_challenge:  tokenChallenge,   // JWT từ STEP 1
      raw_data: {
        sod:  rawData.sod,   // Base64 SOD ICAO container
        dg1:  rawData.dg1,   // Base64 DG1 (thông tin cơ bản)
        dg2:  rawData.dg2,   // Base64 DG2 (ảnh chân dung chip)
        dg13: rawData.dg13,  // Base64 DG13 (thông tin mở rộng)
        dg15: rawData.dg15,  // Base64 DG15 (RSA Public Key)
      },
      info,         // ip_address, machine_name, phone, email, image (selfie), ...
      signature,    // aa_signature từ Active Authentication trên chip thẻ
    },
  });
  return res.data;
}

/**
 * STEP 3: Kiểm tra trạng thái cấp CTS.
 * Gọi lặp lại (poll) mỗi interval ms cho đến khi status = "completed" hoặc "failed".
 *
 * Endpoint: POST /ca/api/eid-personal/check
 *
 * @param {string} transactionCode - Từ STEP 1
 * @param {string} tokenSignature  - Từ STEP 2 (data.token_signature)
 * @returns {Promise<{status, cert_info?}>}
 *   - status: "processing" | "completed" | "failed"
 *   - cert_info: { serial_number, id_number, full_name, date_issue, date_expire, ... }
 */
export async function personalCheckStatus(transactionCode, tokenSignature) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-personal/check", {
    body: {
      code:             partnerCode,
      transaction_code: transactionCode,   // Từ STEP 1/2
      token_signature:  tokenSignature,    // Từ STEP 2
    },
  });
  return res.data;
}

// ─── FLOW 2 — CTS Cá nhân: Ký văn bản ──────────────────────────────────────

/**
 * STEP 1: Upload tài liệu để bắt đầu luồng ký.
 *
 * Endpoint: POST /ca/api/sign/challenge (multipart/form-data)
 *
 * @param {FormData} formData - Chứa: documents (File), id_number, sign_props, security_level
 * @returns {Promise<{transaction_code, token_sign, docs[]}>}
 */
export async function signGetChallenge(formData) {
  const { baseUrl, apiKey, partnerCode } = _getConfig();
  const url = `${baseUrl}/ca/api/sign/challenge`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "code":      partnerCode,
      // Không set Content-Type — browser tự set multipart boundary
    },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}

/**
 * STEP 2: Gửi selfie + doc signatures để xác nhận ký.
 *
 * Endpoint: POST /ca/api/sign/signature
 *
 * @param {object} params
 * @param {string} params.transactionCode
 * @param {string} params.tokenSign       - Từ STEP 1
 * @param {string} params.selfieBase64    - Ảnh selfie Base64
 * @param {Array}  params.docSigns        - [{ doc_id, signature }]
 * @returns {Promise<{status, signed_docs[], token}>}
 */
export async function signSendSignature({ transactionCode, tokenSign, selfieBase64, docSigns }) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/sign/signature", {
    body: {
      code:             partnerCode,
      transaction_code: transactionCode,
      token_sign:       tokenSign,
      info:             { image: selfieBase64 },
      doc_signs:        docSigns, // [{ doc_id, signature }]
    },
  });
  return res.data;
}

/**
 * STEP 3: Download tài liệu đã ký.
 *
 * Endpoint: GET /ca/api/sign/download/{doc-id}
 *
 * @param {string} docId
 * @param {string} transactionCode
 * @param {string} tokenSign - Từ STEP 2
 * @returns {Promise<Blob>} PDF blob để download
 */
export async function downloadSignedDoc(docId, transactionCode, tokenSign) {
  const { baseUrl, apiKey, partnerCode } = _getConfig();
  const url = `${baseUrl}/ca/api/sign/download/${docId}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type":    "application/json",
      "x-api-key":       apiKey,
      "code":            partnerCode,
      "transaction-code":transactionCode,
      "token-sign":      tokenSign,
      "os-type":         "Web",
    },
  });
  if (!res.ok) {
    let errorMsg = `Download failed: HTTP ${res.status}`;
    try {
      const text = await res.text();
      errorMsg += ` - ${text}`;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return res.blob();
}

// ─── FLOW 3 — CTS Cá nhân Tổ chức: Đăng ký ──────────────────────────────────

/**
 * STEP 1: Lấy challenge để đăng ký CTS cá nhân thuộc tổ chức.
 *
 * Endpoint: POST /ca/api/eid-company/challenge
 *
 * @param {string} idNumber   - Số CCCD 12 số
 * @param {number} companyId  - ID tổ chức trong hệ thống eIDCA
 */
export async function companyGetChallenge(idNumber, companyId) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-company/challenge", {
    body: { code: partnerCode, id_number: idNumber, company_id: companyId },
  });
  return res.data;
}

/**
 * STEP 2: Gửi NFC data + signature để đăng ký CTS tổ chức.
 *
 * Endpoint: POST /ca/api/eid-company/signature
 */
export async function companySendSignature({ transactionCode, tokenChallenge, rawData, info, signature }) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-company/signature", {
    body: { code: partnerCode, transaction_code: transactionCode, token_challenge: tokenChallenge, raw_data: rawData, info, signature },
  });
  return res.data;
}

/**
 * STEP 3: Kiểm tra trạng thái cấp CTS tổ chức.
 *
 * Endpoint: POST /ca/api/eid-company/check
 */
export async function companyCheckStatus(transactionCode, tokenSignature) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/eid-company/check", {
    body: { code: partnerCode, transaction_code: transactionCode, token_signature: tokenSignature },
  });
  return res.data;
}

// ─── FLOW 4 — CTS Cá nhân TT: Ký văn bản ───────────────────────────────────

/** STEP 1: Upload doc ký — Endpoint: POST /ca/api/sign-company/challenge */
export async function signCompanyGetChallenge(formData) {
  const { baseUrl, apiKey, partnerCode } = _getConfig();
  const url = `${baseUrl}/ca/api/sign-company/challenge`;
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": apiKey, "code": partnerCode }, body: formData });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}

/** STEP 2: Xác nhận ký — Endpoint: POST /ca/api/sign-company/signature */
export async function signCompanySendSignature(params) {
  const { partnerCode } = _getConfig();
  const res = await request("POST", "/ca/api/sign-company/signature", {
    body: { code: partnerCode, ...params },
  });
  return res.data;
}
