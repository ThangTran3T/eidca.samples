/**
 * web-app/src/api/eidcaClient.js
 * HTTP client gọi eIDCA API (hoặc mock server khi dev).
 *
 * Đổi BASE_URL trong .env:
 *   VITE_EIDCA_API_BASE_URL=http://localhost:3001  ← mock
 *   VITE_EIDCA_API_BASE_URL=https://api.eidca.vn  ← production
 */

const BASE_URL = import.meta.env.VITE_EIDCA_API_BASE_URL || "http://localhost:3001";
const API_KEY  = import.meta.env.VITE_EIDCA_API_KEY      || "MOCK_API_KEY_DEMO";
const PARTNER_CODE = import.meta.env.VITE_EIDCA_PARTNER_CODE || "PARTNER_DEMO_001";

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

async function request(method, path, { body, headers = {} } = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok && res.status !== 200) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── FLOW 1 — CTS Cá nhân: Đăng ký ─────────────────────────────────────────

/**
 * STEP 1: Lấy challenge để bắt đầu đăng ký CTS cá nhân.
 * @param {string} idNumber - Số CCCD/CC 12 số
 * @returns {Promise<{transaction_code, challenge, token_challenge}>}
 */
export async function personalGetChallenge(idNumber) {
  const res = await request("POST", "/ca/api/eid-personal/challenge", {
    body: { code: PARTNER_CODE, id_number: idNumber },
  });
  return res.data;
}

/**
 * STEP 2: Gửi NFC data, selfie, signature để đăng ký CTS.
 * @param {object} params
 * @param {string} params.transactionCode - Từ STEP 1
 * @param {string} params.tokenChallenge  - Từ STEP 1
 * @param {object} params.rawData         - { sod, dg1, dg2, dg13, dg15 } (Base64)
 * @param {object} params.info            - { ip_address, machine_name, ..., phone, email, image }
 * @param {string} params.signature       - Signature từ token challenge
 * @returns {Promise<{transaction_code, status, token_signature, expired_at}>}
 */
export async function personalSendSignature({ transactionCode, tokenChallenge, rawData, info, signature }) {
  const res = await request("POST", "/ca/api/eid-personal/signature", {
    body: {
      code: PARTNER_CODE,
      transaction_code: transactionCode,
      token_challenge: tokenChallenge,
      raw_data: rawData,
      info,
      signature,
    },
  });
  return res.data;
}

/**
 * STEP 3: Kiểm tra trạng thái cấp CTS.
 * @param {string} transactionCode
 * @param {string} tokenSignature - Từ STEP 2
 * @returns {Promise<{status, cert_info?}>}
 */
export async function personalCheckStatus(transactionCode, tokenSignature) {
  const res = await request("POST", "/ca/api/eid-personal/check", {
    body: { code: PARTNER_CODE, transaction_code: transactionCode, token_signature: tokenSignature },
  });
  return res.data;
}

// ─── FLOW 2 — CTS Cá nhân: Ký văn bản ──────────────────────────────────────

/**
 * STEP 1: Upload tài liệu để bắt đầu luồng ký.
 * @param {FormData} formData - Chứa: documents (File), id_number, sign_props, security_level, ...
 * @returns {Promise<{transaction_code, token_sign, docs[]}>}
 */
export async function signGetChallenge(formData) {
  const url = `${BASE_URL}/ca/api/sign/challenge`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "code": PARTNER_CODE,
      // Không set Content-Type — browser tự set multipart boundary
    },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}

/**
 * STEP 2: Gửi selfie + signatures để xác nhận ký.
 * @param {object} params
 * @returns {Promise<{status, signed_docs[], token}>}
 */
export async function signSendSignature({ transactionCode, tokenSign, selfieBase64, docSigns }) {
  const res = await request("POST", "/ca/api/sign/signature", {
    body: {
      code: PARTNER_CODE,
      transaction_code: transactionCode,
      token_sign: tokenSign,
      info: { image: selfieBase64 },
      doc_signs: docSigns, // [{ doc_id, signature }]
    },
  });
  return res.data;
}

/**
 * STEP 3: Download tài liệu đã ký.
 * @param {string} docId
 * @param {string} transactionCode
 * @param {string} tokenSign - Từ STEP 2
 * @returns {Promise<Blob>} PDF blob
 */
export async function downloadSignedDoc(docId, transactionCode, tokenSign) {
  const url = `${BASE_URL}/ca/api/sign/download/${docId}`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": API_KEY,
      "code": PARTNER_CODE,
      "transaction_code": transactionCode,
      "token_sign": tokenSign,
    },
  });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return res.blob();
}

/**
 * STEP 4: Kiểm tra phiên ký còn hiệu lực không.
 * @param {string} transactionCode
 * @param {string} tokenSign
 * @returns {Promise<{remaining_time}>}
 */
export async function checkSession(transactionCode, tokenSign) {
  const res = await request("GET", "/ca/api/event/check-session", {
    headers: {
      "code": PARTNER_CODE,
      "transaction_code": transactionCode,
      "token_sign": tokenSign,
    },
  });
  return res.data;
}

// ─── FLOW 3 — CTS Cá nhân Tổ chức: Đăng ký ──────────────────────────────────

export async function companyGetChallenge(idNumber, companyId) {
  const res = await request("POST", "/ca/api/eid-company/challenge", {
    body: { code: PARTNER_CODE, id_number: idNumber, company_id: companyId },
  });
  return res.data;
}

export async function companySendSignature({ transactionCode, tokenChallenge, rawData, info, signature }) {
  const res = await request("POST", "/ca/api/eid-company/signature", {
    body: { code: PARTNER_CODE, transaction_code: transactionCode, token_challenge: tokenChallenge, raw_data: rawData, info, signature },
  });
  return res.data;
}

export async function companyCheckStatus(transactionCode, tokenSignature) {
  const res = await request("POST", "/ca/api/eid-company/check", {
    body: { code: PARTNER_CODE, transaction_code: transactionCode, token_signature: tokenSignature },
  });
  return res.data;
}

// ─── FLOW 4 — CTS Cá nhân TT: Ký văn bản ───────────────────────────────────

export async function signCompanyGetChallenge(formData) {
  const url = `${BASE_URL}/ca/api/sign-company/challenge`;
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": API_KEY, "code": PARTNER_CODE }, body: formData });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}

export async function signCompanySendSignature(params) {
  const res = await request("POST", "/ca/api/sign-company/signature", {
    body: { code: PARTNER_CODE, ...params },
  });
  return res.data;
}

// ─── FLOW 5 — QR: Đăng ký ────────────────────────────────────────────────────

/**
 * Gen QR Code để đăng ký CTS qua mobile.
 * @param {object} userInfo - { id_number, full_name, date_of_birth, date_of_issue, type }
 * @returns {Promise<{encrypted_data, session_id, url, expired_at}>}
 */
export async function qrOnboard(userInfo) {
  const res = await request("POST", "/ca/api/qr/onboard", {
    body: { code: PARTNER_CODE, ...userInfo },
  });
  return res.data;
}

/**
 * Lắng nghe event từ QR session (SSE).
 * @param {string} sessionId
 * @param {function} onEvent - Callback nhận data object
 * @returns {EventSource} - Gọi .close() khi xong
 */
export function listenQrSession(sessionId, onEvent) {
  const url = `${BASE_URL}/ca/apievent?session_id=${sessionId}`;
  const es = new EventSource(url); // Header không set được qua EventSource — cần token trong URL hoặc cookie
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data?.data?.ca_status === "completed" || data?.data?.ca_status === "failed") {
        es.close();
      }
    } catch { /* ignore */ }
  };
  es.onerror = () => es.close();
  return es;
}

// ─── FLOW 6 — QR: Ký văn bản ─────────────────────────────────────────────────

export async function qrSign(formData) {
  const url = `${BASE_URL}/ca/api/qr/sign`;
  const res = await fetch(url, { method: "POST", headers: { "x-api-key": API_KEY, "code": PARTNER_CODE }, body: formData });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}
