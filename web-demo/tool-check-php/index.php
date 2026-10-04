<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Kiểm tra chữ ký số XMLDSig và PDF/CMS bằng PHP">
    <title>VNeCA Signature Check PHP</title>
    <link rel="stylesheet" href="assets/styles.css">
    <script src="assets/app.js" type="module"></script>
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <div class="brand">V</div>
        <div>
          <p class="eyebrow">VNeCA · PHP EDITION</p>
          <h1>Kiểm tra chữ ký số</h1>
          <p class="subtitle">Xác minh XMLDSig và chữ ký CMS/PAdES trong PDF trực tiếp trên hosting PHP.</p>
        </div>
      </header>

      <section class="panel">
        <div class="panel-title">
          <div><p class="eyebrow">01 · TÀI LIỆU</p><h2>Chọn PDF hoặc XML</h2></div>
          <span class="privacy">Không lưu file</span>
        </div>
        <label class="drop-zone" id="drop-zone" for="file-input" tabindex="0">
          <input id="file-input" type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml">
          <span class="upload-icon">↑</span>
          <strong>Kéo thả file vào đây</strong>
          <span>hoặc bấm để chọn · tối đa 50 MB</span>
        </label>
        <div class="selection hidden" id="selection">
          <span class="file-type" id="file-type">XML</span>
          <span class="file-info"><strong id="file-name"></strong><small id="file-size"></small></span>
          <button id="clear-button" class="secondary" type="button">Đổi file</button>
        </div>
        <button id="verify-button" class="primary" type="button" disabled>
          <span id="button-label">Kiểm tra chữ ký</span><span id="spinner" class="spinner hidden"></span>
        </button>
        <p id="request-error" class="error hidden" role="alert"></p>
      </section>

      <section id="results" class="results hidden" aria-live="polite">
        <header id="summary" class="summary">
          <span id="status-icon" class="status-icon"></span>
          <div><p class="eyebrow">02 · KẾT QUẢ</p><h2 id="status-title"></h2><p id="status-copy"></p></div>
          <span id="status-badge" class="badge"></span>
        </header>
        <div id="metadata" class="metadata"></div>
        <div id="signature-list" class="signature-list"></div>
        <details><summary>Xem JSON đầy đủ</summary><pre id="raw-json"></pre></details>
      </section>

      <footer>
        <span>API: <code>POST api/verify.php</code></span>
        <span>Chuỗi CA, OCSP, CRL và timestamp chưa được đánh giá.</span>
      </footer>
    </main>
  </body>
</html>
