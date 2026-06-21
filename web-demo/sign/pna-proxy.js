/**
 * pna-proxy.js  –  Private Network Access Proxy cho eIDCA LocalAgent
 *
 * Vấn đề: eIDCA.LocalAgent chạy tại 127.0.0.1:23456 nhưng THIẾU header
 *   Access-Control-Allow-Private-Network: true
 * → Chrome chặn request từ các trang public (sign.vneca.vn).
 *
 * Giải pháp: Chạy proxy nhỏ này tại cùng port 23456 (hoặc port khác),
 * proxy sẽ forward request tới LocalAgent và thêm đúng CORS headers.
 *
 * Cách dùng:
 *   1. Tắt eIDCA.LocalAgent (hoặc đổi port LocalAgent sang 23457)
 *   2. node pna-proxy.js
 *   3. Proxy chạy tại 127.0.0.1:23456, forward sang 127.0.0.1:23457
 *
 * HOẶC (không cần tắt LocalAgent):
 *   node pna-proxy.js --agent-port=23456 --proxy-port=23458
 *   Rồi trong sign demo đổi URL thành http://127.0.0.1:23458/api/sign-document
 */

import http from "http";

// ── Cấu hình ──────────────────────────────────────────────────
const PROXY_PORT  = parseInt(process.env.PROXY_PORT  || "23458"); // Port proxy này lắng nghe
const AGENT_PORT  = parseInt(process.env.AGENT_PORT  || "23456"); // Port của eIDCA LocalAgent
const AGENT_HOST  = process.env.AGENT_HOST || "127.0.0.1";
const TIMEOUT_MS  = 120_000; // 120s – chờ ký USB Token/NFC

// ── CORS Headers đầy đủ (bao gồm PNA) ───────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":          "*",
  "Access-Control-Allow-Methods":         "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":         "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Private-Network": "true",   // ← Key header cho Chrome PNA
  "Access-Control-Max-Age":               "86400",
};

// ── Proxy Server ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Thêm CORS vào mọi response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight OPTIONS → trả 204 ngay không cần forward
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Forward request tới LocalAgent
  const options = {
    hostname: AGENT_HOST,
    port:     AGENT_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `${AGENT_HOST}:${AGENT_PORT}` },
    timeout:  TIMEOUT_MS,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Copy status + headers từ LocalAgent, giữ CORS headers của mình
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      ...CORS_HEADERS, // Override để đảm bảo PNA header luôn có
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[Proxy] Lỗi kết nối tới LocalAgent: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json", ...CORS_HEADERS });
    }
    res.end(JSON.stringify({
      status:  "ERROR",
      message: `Không kết nối được eIDCA LocalAgent tại ${AGENT_HOST}:${AGENT_PORT}: ${err.message}`,
    }));
  });

  proxyReq.setTimeout(TIMEOUT_MS, () => {
    proxyReq.destroy();
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, "127.0.0.1", () => {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         eIDCA PNA Proxy – đã khởi động                  ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Proxy URL  : http://127.0.0.1:${PROXY_PORT}                    ║`);
  console.log(`║  Forward to : http://${AGENT_HOST}:${AGENT_PORT}                    ║`);
  console.log("║  Header PNA : Access-Control-Allow-Private-Network: true ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n➡  Trong sign demo, đặt URL thành:`);
  console.log(`   http://127.0.0.1:${PROXY_PORT}/api/sign-document\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PROXY_PORT} đã bị chiếm. Thử port khác:`);
    console.error(`   PROXY_PORT=23459 node pna-proxy.js`);
  } else {
    console.error("❌ Server error:", err.message);
  }
  process.exit(1);
});
