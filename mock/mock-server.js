/**
 * mock-server.js
 * Mock HTTP server giả lập toàn bộ eIDCA API.
 * Dùng cho: web-app (gọi fetch/axios), win-app (gọi HttpClient qua localhost).
 *
 * Chạy: node mock-server.js
 * Base URL: http://localhost:3001
 *
 * Requires: Node.js >= 18 (built-in fetch, no extra deps)
 */

import http from "http";
import * as mock from "./mock-data.js";

const PORT = 23456;   // Khớp với eIDCA service thật (sign demo dùng port này)
const ALT_PORT = 3001; // Port cũ cho web-app khác
const API_KEY = "MOCK_API_KEY_DEMO";

// Base64 PDF tối giản hợp lệ (dùng cho mock signed PDF)
const MOCK_SIGNED_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoK" +
  "PDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPJ4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUg" +
  "L1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291" +
  "cmNlcyA8PC9Gb250IDw8L0YxIDUgMCBSPj4+PgogPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCAxMDgKPj4K" +
  "c3RyZWFtCkJUCi9GMSAxOCBUZgoyMCA3NTAgVGQKKE1vY2sgU2lnbmVkIFBERiAtIGVJRENBIERlbW8pIFRqCi9G" +
  "MSAxMiBUZgoyMCA3MDAgVGQKKFRoaXMgaXMgYSBtb2NrIHNpZ25lZCBQREYgZmlsZS4pIFRqCkVUCmVuZHN0cmVh" +
  "bQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRp" +
  "Y2EKPJ4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAw" +
  "MDAwMDYyIDAwMDAwIG4gCjAwMDAwMDAxMjAgMDAwMDAgbiAKMDAwMDAwMDI3MSAwMDAwMCBuIAowMDAwMDAwNDMxID" +
  "AwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTA5CiUlRU9GCg==";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, code, transaction-code, token-sign, token_signature, os-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",  // Chrome PNA: cho phép public domain gọi localhost
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function checkApiKey(req, res) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    send(res, 401, mock.MOCK_ERROR_UNAUTHORIZED);
    return false;
  }
  return true;
}

// Giả lập delay mạng (ms)
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Đếm số lần poll /check để simulate processing → completed
const pollCount = {};

// ─── Router ───────────────────────────────────────────────────────────────────

async function router(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight – bắt buộc trả Access-Control-Allow-Private-Network: true
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  await delay(300); // giả lập latency

  // ── 0. Sign Document (điểm cuối của sign demo) ──────────────────────────
  // POST /api/sign-document
  if (method === "POST" && path === "/api/sign-document") {
    const body = await readBody(req);
    if (!body.pdf_base64 || !body.id_number) {
      return send(res, 400, { status: "ERROR", message: "Thiếu pdf_base64 hoặc id_number" });
    }
    // Giả lập thời gian xử lý (≥ 1.5s – user thấy trạng thái processing)
    await delay(1500);
    const txnId = "ist_" + Math.random().toString(36).slice(2, 18).padEnd(32, "0");
    return send(res, 200, {
      status: "SUCCESS",
      transaction_id: txnId,
      signed_pdf_base64: MOCK_SIGNED_PDF_B64,
    });
  }

  // ── 1. CTS Cá nhân ──────────────────────────────────────────────────────────

  // STEP 1: Lấy challenge
  if (method === "POST" && path === "/ca/api/eid-personal/challenge") {
    if (!checkApiKey(req, res)) return;
    const body = await readBody(req);
    if (!body.id_number || !body.code) {
      return send(res, 400, mock.MOCK_ERROR_UNKNOWN);
    }
    return send(res, 200, mock.MOCK_PERSONAL_CHALLENGE_RESPONSE);
  }

  // STEP 2: Gửi signature + NFC
  if (method === "POST" && path === "/ca/api/eid-personal/signature") {
    if (!checkApiKey(req, res)) return;
    const body = await readBody(req);
    if (!body.transaction_code || !body.token_challenge) {
      return send(res, 400, mock.MOCK_ERROR_UNKNOWN);
    }
    // Reset poll counter cho transaction này
    pollCount[body.transaction_code] = 0;
    return send(res, 200, mock.MOCK_PERSONAL_SIGNATURE_RESPONSE);
  }

  // STEP 3: Kiểm tra trạng thái CTS
  if (method === "POST" && path === "/ca/api/eid-personal/check") {
    if (!checkApiKey(req, res)) return;
    const body = await readBody(req);
    const txn = body.transaction_code || "default";
    pollCount[txn] = (pollCount[txn] || 0) + 1;
    // Sau 2 lần poll → trả completed
    if (pollCount[txn] >= 2) {
      return send(res, 200, mock.MOCK_PERSONAL_CHECK_RESPONSE_COMPLETED);
    }
    return send(res, 200, mock.MOCK_PERSONAL_CHECK_RESPONSE_PROCESSING);
  }

  // ── 2. CTS Cá nhân thuộc Tổ chức ────────────────────────────────────────────

  if (method === "POST" && path === "/ca/api/eid-company/challenge") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_COMPANY_CHALLENGE_RESPONSE);
  }

  if (method === "POST" && path === "/ca/api/eid-company/signature") {
    if (!checkApiKey(req, res)) return;
    const body = await readBody(req);
    pollCount[body.transaction_code] = 0;
    return send(res, 200, mock.MOCK_COMPANY_SIGNATURE_RESPONSE);
  }

  if (method === "POST" && path === "/ca/api/eid-company/check") {
    if (!checkApiKey(req, res)) return;
    const body = await readBody(req);
    const txn = body.transaction_code || "default";
    pollCount[txn] = (pollCount[txn] || 0) + 1;
    if (pollCount[txn] >= 2) {
      return send(res, 200, mock.MOCK_COMPANY_CHECK_RESPONSE_COMPLETED);
    }
    return send(res, 200, mock.MOCK_PERSONAL_CHECK_RESPONSE_PROCESSING);
  }

  // ── 3. Ký văn bản — Cá nhân ─────────────────────────────────────────────────

  if (method === "POST" && path === "/ca/api/sign/challenge") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_SIGN_CHALLENGE_RESPONSE);
  }

  if (method === "POST" && path === "/ca/api/sign/signature") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_SIGN_SIGNATURE_RESPONSE);
  }

  // Download file đã ký — trả về binary giả lập (PDF dummy bytes)
  if (method === "GET" && path.startsWith("/ca/api/sign/download/")) {
    if (!checkApiKey(req, res)) return;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="signed-document.pdf"',
      "Access-Control-Allow-Origin": "*",
    });
    // Trả về PDF dummy (magic bytes + "MOCK_SIGNED_PDF")
    res.end(Buffer.from("%PDF-1.4 MOCK_SIGNED_PDF_CONTENT_DEMO"));
    return;
  }

  // Check session (phiên ký)
  if (method === "GET" && path === "/ca/api/event/check-session") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_CHECK_SESSION_RESPONSE);
  }

  // ── 4. Ký văn bản — Cá nhân TT ──────────────────────────────────────────────

  if (method === "POST" && path === "/ca/api/sign-company/challenge") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_SIGN_COMPANY_CHALLENGE_RESPONSE);
  }

  if (method === "POST" && path === "/ca/api/sign-company/signature") {
    if (!checkApiKey(req, res)) return;
    // Dùng chung response với luồng cá nhân
    return send(res, 200, mock.MOCK_SIGN_SIGNATURE_RESPONSE);
  }

  // ── 5. QR Code — Đăng ký ────────────────────────────────────────────────────

  if (method === "POST" && path === "/ca/api/qr/onboard") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_QR_ONBOARD_RESPONSE);
  }

  // ── 6. QR Code — Ký văn bản ─────────────────────────────────────────────────

  if (method === "POST" && path === "/ca/api/qr/sign") {
    if (!checkApiKey(req, res)) return;
    return send(res, 200, mock.MOCK_QR_SIGN_RESPONSE);
  }

  // File download từ mobile (QR ký)
  if (method === "GET" && path.startsWith("/ca/api/file/")) {
    if (!checkApiKey(req, res)) return;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="document-to-sign.pdf"',
      "Access-Control-Allow-Origin": "*",
    });
    res.end(Buffer.from("%PDF-1.4 MOCK_DOCUMENT_TO_SIGN_CONTENT"));
    return;
  }

  // ── 7. SSE Event (QR session) ────────────────────────────────────────────────

  if (method === "GET" && path === "/ca/apievent") {
    if (!checkApiKey(req, res)) return;
    const sessionId = url.searchParams.get("session_id") || "";
    // Phân loại luồng dựa trên session_id prefix
    const isSignFlow = sessionId.startsWith("QR-SIGN");
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    // Gửi event "processing" trước, sau 2s gửi "completed"
    const processingEvent = JSON.stringify({
      success: true,
      error: null,
      data: { ca_status: "processing", result: "PENDING", transaction_code: "TXN-QR-001", token_sign: null, cert: null, doc_ids: null },
    });
    res.write(`data: ${processingEvent}\n\n`);
    setTimeout(() => {
      const completedEvent = JSON.stringify(
        isSignFlow ? mock.MOCK_QR_SIGN_SSE_EVENT : mock.MOCK_QR_ONBOARD_SSE_EVENT
      );
      res.write(`data: ${completedEvent}\n\n`);
      res.end();
    }, 2000);
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────────────────
  send(res, 404, { success: false, error: { code: "404", message: `Endpoint không tồn tại: ${method} ${path}` }, data: null });
}

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = http.createServer(router);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ eIDCA Mock Server đang chạy tại: http://127.0.0.1:${PORT}`);
  console.log(`   → Sign demo endpoint: POST http://127.0.0.1:${PORT}/api/sign-document`);
  console.log(`   x-api-key: ${API_KEY}`);
  console.log(`   Access-Control-Allow-Private-Network: true (đã bật)`);
  console.log("\n📋 Endpoints có sẵn:");
  console.log("   POST /ca/api/eid-personal/challenge");
  console.log("   POST /ca/api/eid-personal/signature");
  console.log("   POST /ca/api/eid-personal/check");
  console.log("   POST /ca/api/eid-company/challenge");
  console.log("   POST /ca/api/eid-company/signature");
  console.log("   POST /ca/api/eid-company/check");
  console.log("   POST /ca/api/sign/challenge");
  console.log("   POST /ca/api/sign/signature");
  console.log("   GET  /ca/api/sign/download/:doc-id");
  console.log("   GET  /ca/api/event/check-session");
  console.log("   POST /ca/api/sign-company/challenge");
  console.log("   POST /ca/api/sign-company/signature");
  console.log("   POST /ca/api/qr/onboard");
  console.log("   POST /ca/api/qr/sign");
  console.log("   GET  /ca/api/file/:filename");
  console.log("   GET  /ca/apievent?session_id=");
});
