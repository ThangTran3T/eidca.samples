/**
 * Step3Download.js — STEP 3: Download tài liệu đã ký
 *
 * Gọi API: GET /ca/api/sign/download/{doc-id}
 *
 * Headers cần truyền:
 *   - x-api-key
 *   - code           (Partner Code)
 *   - transaction_code
 *   - token_sign     (từ STEP 2 — data.token)
 *
 * Response: Binary (PDF/file đã ký) → trigger browser download
 *
 * Input từ state:
 *   - signedDocs[]    → [{doc_id, doc_name, ca_signature, sign_at, doc_hash}]
 *   - transactionCode
 *   - tokenSigned     (data.token từ STEP 2)
 *   - tokenSign       (từ STEP 1)
 */

import { renderCodePanels }   from "../../ui/CodePanel.js";
import { downloadSignedDoc }  from "../../api/eidcaClient.js";

export class Step3Download {
  constructor(container, { state }) {
    this._container = container;
    this._state = state;
    this._el = null;
    this._codePanels = null;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card disabled";
    this._el.id = "step-3-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">3</div>
        <div class="step-card-title">
          <h3>Download Tài liệu đã ký</h3>
          <p>GET /ca/api/sign/download/{doc-id} — Tải file PDF đã có chữ ký số</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s3-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <div class="notice info" id="s3-notice">
          ⏳ Đang chờ hoàn thành STEP 2...
        </div>

        <!-- Danh sách tài liệu đã ký sẵn sàng download -->
        <div id="s3-docs-section" class="hidden"></div>

        <div id="s3-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    this._codePanels = renderCodePanels(
      this._el.querySelector("#s3-code-container"),
      { requestTitle: "GET /ca/api/sign/download/{doc-id}" }
    );
  }

  /** Kích hoạt sau STEP 2 */
  activate() {
    this._el.className = "step-card active";
    const badge = this._el.querySelector("#s3-badge");
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Sẵn sàng";

    const notice = this._el.querySelector("#s3-notice");
    notice.textContent = "✅ Ký thành công! Nhấn Download để tải file đã ký về.";
    notice.className = "notice success";

    this._renderDocsList();
    this._showRequestInfo();
  }

  /** Render danh sách signed_docs với nút download cho từng file */
  _renderDocsList() {
    const signedDocs = this._state.signedDocs || [];
    const section    = this._el.querySelector("#s3-docs-section");
    section.classList.remove("hidden");

    if (!signedDocs.length) {
      section.innerHTML = `<div class="notice warning">Không có tài liệu đã ký.</div>`;
      return;
    }

    section.innerHTML = `
      <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">
        TÀI LIỆU ĐÃ KÝ — ${signedDocs.length} file
      </div>
      ${signedDocs.map((doc) => `
        <div class="signed-doc-row" id="sdr-${doc.doc_id}"
          style="background:var(--bg-card-2);border:1px solid rgba(52,211,153,0.2);
            border-radius:10px;padding:14px 16px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <span style="font-size:1.4rem;">📄</span>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.9rem;">${doc.doc_name}</div>
              <div class="mono" style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">
                ${doc.doc_id}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="dl-btn-${doc.doc_id}"
              onclick="">
              ⬇️ Download
            </button>
          </div>

          <!-- Meta thông tin chữ ký -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div class="cts-field">
              <div class="field-key">Thời điểm ký</div>
              <div class="field-value" style="font-size:0.75rem;">${doc.sign_at || "—"}</div>
            </div>
            <div class="cts-field">
              <div class="field-key">Hết hạn</div>
              <div class="field-value" style="font-size:0.75rem;">${doc.expire_at || "—"}</div>
            </div>
            <div class="cts-field" style="grid-column:1/-1;">
              <div class="field-key">Hash SHA256</div>
              <div class="field-value mono" style="font-size:0.65rem;word-break:break-all;">
                ${doc.doc_hash || "—"}
              </div>
            </div>
          </div>

          <!-- Trạng thái download -->
          <div id="dl-status-${doc.doc_id}" class="hidden" style="margin-top:8px;"></div>
        </div>
      `).join("")}
    `;

    // Gắn sự kiện download cho từng tài liệu
    signedDocs.forEach((doc) => {
      const btn = this._el.querySelector(`#dl-btn-${doc.doc_id}`);
      btn?.addEventListener("click", () => this._download(doc));
    });
  }

  /** Hiển thị request info (GET với headers) */
  _showRequestInfo() {
    const firstDoc = this._state.signedDocs?.[0];
    this._codePanels.setRequest({
      "// Method":       "GET",
      "// URL":          `/ca/api/sign/download/${firstDoc?.doc_id || "{doc-id}"}`,
      "// Headers": {
        "Content-Type":     "application/json",
        "x-api-key":        "***",
        "code":             this._state.partnerCode,
        "transaction_code": this._state.transactionCode,
        "token_sign":       this._state.tokenSigned || this._state.tokenSign,
        "os-type":          "Web",
      },
    });
  }

  /** Download một tài liệu đã ký */
  async _download(doc) {
    const btn      = this._el.querySelector(`#dl-btn-${doc.doc_id}`);
    const statusEl = this._el.querySelector(`#dl-status-${doc.doc_id}`);
    const badge    = this._el.querySelector("#s3-badge");

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang tải...`;

    try {
      // ── Gọi API ──────────────────────────────────────────────────────────
      // downloadSignedDoc() → GET /ca/api/sign/download/{doc-id}
      // Trả về Blob (binary PDF)
      const blob = await downloadSignedDoc(
        doc.doc_id,
        this._state.transactionCode,
        this._state.tokenSigned || this._state.tokenSign
      );

      // Hiển thị response info
      this._codePanels.setResponse({
        "// Status":        "200 OK",
        "// Content-Type":  "application/pdf",
        "// Body":          `Binary PDF (${(blob.size / 1024).toFixed(1)} KB)`,
        "// doc_id":        doc.doc_id,
      }, "success");

      // Trigger browser download
      const url      = URL.createObjectURL(blob);
      const link     = document.createElement("a");
      link.href      = url;
      link.download  = `signed_${doc.doc_name}`;
      link.click();
      URL.revokeObjectURL(url);

      btn.innerHTML = "✓ Đã tải";
      btn.className = "btn btn-secondary btn-sm";

      // Hiển thị kích thước file
      statusEl.classList.remove("hidden");
      statusEl.innerHTML = `
        <div class="notice success" style="margin:0;padding:8px 12px;">
          ✅ Đã tải về: <strong>signed_${doc.doc_name}</strong>
          (${(blob.size / 1024).toFixed(1)} KB)
        </div>
      `;

      badge.className = "step-status-badge badge-done";
      badge.textContent = "Hoàn thành";
      this._el.className = "step-card done";

    } catch (err) {
      this._codePanels.setResponse(
        { success: false, error: { code: "ERROR", message: err.message }, data: null },
        "error"
      );
      btn.disabled = false;
      btn.textContent = "⬇️ Thử lại";

      statusEl.classList.remove("hidden");
      statusEl.innerHTML = `
        <div class="notice error" style="margin:0;padding:8px 12px;">
          ❌ Lỗi tải file: ${err.message}
        </div>
      `;
    }
  }
}
