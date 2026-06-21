import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình cổng
const PROXY_PORT  = parseInt(process.env.PROXY_PORT  || "23458"); // Cổng proxy này lắng nghe
const AGENT_PORT  = parseInt(process.env.AGENT_PORT  || "23456"); // Cổng của eIDCA LocalAgent
const AGENT_HOST  = process.env.AGENT_HOST || "127.0.0.1";
const WEB_PORT    = parseInt(process.env.WEB_PORT || "5000");     // Cổng của Web Server chứa index.html
const TIMEOUT_MS  = 120_000; // 120s – chờ ký USB Token/NFC

// CORS Headers đầy đủ (bao gồm PNA)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":          "*",
  "Access-Control-Allow-Methods":         "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":         "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Private-Network": "true",   // Header cho Chrome PNA
  "Access-Control-Max-Age":               "86400",
};

// 1. Khởi động Proxy Server
const proxyServer = http.createServer((req, res) => {
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

proxyServer.listen(PROXY_PORT, "127.0.0.1", () => {
  console.log(`[Proxy] eIDCA PNA Proxy đang chạy tại: http://127.0.0.1:${PROXY_PORT}`);
});

// 2. Khởi động Web Server để phục vụ index.html
const webServer = http.createServer((req, res) => {
  // Chuẩn hóa và làm sạch path để tránh directory traversal
  let safeUrl = req.url.split('?')[0];
  if (safeUrl === '/') safeUrl = '/index.html';
  
  const filePath = path.join(__dirname, safeUrl);

  // Đảm bảo request không cố truy cập ngoài thư mục web-demo/sign
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Access Denied');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không tìm thấy file');
      return;
    }
    let contentType = 'text/html';
    if (filePath.endsWith('.js')) contentType = 'application/javascript';
    else if (filePath.endsWith('.css')) contentType = 'text/css';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

webServer.listen(WEB_PORT, "127.0.0.1", () => {
  console.log(`\n======================================================`);
  console.log(`  eIDCA Web Demo Sign đã khởi động thành công!`);
  console.log(`  Mở trình duyệt tại: http://127.0.0.1:${WEB_PORT}`);
  console.log(`======================================================\n`);
});
