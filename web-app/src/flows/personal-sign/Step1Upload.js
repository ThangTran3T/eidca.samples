/**
 * Step1Upload.js — STEP 1: Upload tài liệu & lấy doc_challenge
 *
 * Gọi API: POST /ca/api/sign/challenge  (multipart/form-data)
 *
 * Input:
 *   - documents   (File — PDF, tối đa 10MB)
 *   - id_number   (Số CCCD — từ NFC hoặc nhập tay)
 *   - sign_props  (JSON Array stringify — vị trí & hình thức chữ ký trên PDF)
 *                 Xem chi tiết cấu trúc tại docs/api-reference.md § sign_props
 *   - security_level = "LEVEL_2"
 *
 * Output lưu vào state:
 *   - transactionCode  → dùng suốt các bước tiếp theo
 *   - tokenSign        → dùng ở STEP 2 + STEP 3
 *   - docs[]           → [{doc_id, doc_name, doc_challenge}]
 *   - selectedFile     → File object để hiển thị preview
 */

import { renderCodePanels } from "../../ui/CodePanel.js";
import { signGetChallenge }  from "../../api/eidcaClient.js";

export class Step1Upload {
  constructor(container, { state, onDone }) {
    this._container = container;
    this._state = state;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
    this._selectedFile = null;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card active";
    this._el.id = "step-1-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">1</div>
        <div class="step-card-title">
          <h3>Upload Tài liệu</h3>
          <p>POST /ca/api/sign/challenge — Tải tài liệu lên để lấy challenge ký</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s1-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <div class="notice info">
          💡 Chọn file PDF/PNG/JPG cần ký số. API sẽ trả về <code>doc_challenge</code>
          dùng để ký trên chip thẻ CCCD ở bước tiếp theo.
        </div>

        <!-- File drop zone -->
        <div class="file-dropzone" id="s1-dropzone">
          <div class="dropzone-icon">📄</div>
          <div class="dropzone-label">Kéo thả file vào đây hoặc</div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-top:6px;">
            Chọn file
            <input type="file" id="s1-file" accept=".pdf"
              style="display:none;" />
          </label>
          <div class="dropzone-hint">PDF — Tối đa 10MB</div>
          <div class="file-selected hidden" id="s1-file-info">
            <span class="file-icon">📎</span>
            <span id="s1-file-name">—</span>
            <span id="s1-file-size" class="text-muted text-sm">—</span>
          </div>
        </div>

        <!-- Số CCCD -->
        <div class="form-group" style="margin-top:14px;">
          <label class="form-label" for="s1-cccd">
            Số CCCD người ký
            <span>(12 chữ số — tự điền từ đầu đọc NFC)</span>
          </label>
          <input class="form-input" id="s1-cccd" type="text" maxlength="12"
            placeholder="001087012345" value="${this._state.idNumber || ""}" />
        </div>

        <!-- sign_props — Tùy chỉnh vị trí & hình thức chữ ký -->
        <!-- Tham chiếu: docs/api-reference.md § sign_props -->
        <details style="margin-bottom:14px;">
          <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;">
            ⚙️ Tùy chỉnh chữ ký (sign_props)
          </summary>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">

            <!-- Vị trí trên trang -->
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Vị trí</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Trang</label>
                <input class="form-input" id="sp-page"   type="number" value="1" min="1"/>
              </div>
              <div class="form-group">
                <label class="form-label">lLx (X)</label>
                <input class="form-input" id="sp-llx"    type="number" value="65"/>
              </div>
              <div class="form-group">
                <label class="form-label">lLy (Y)</label>
                <input class="form-input" id="sp-lly"    type="number" value="320"/>
              </div>
              <div class="form-group">
                <label class="form-label">Rộng</label>
                <input class="form-input" id="sp-width"  type="number" value="260"/>
              </div>
              <div class="form-group">
                <label class="form-label">Cao</label>
                <input class="form-input" id="sp-height" type="number" value="90"/>
              </div>
            </div>

            <!-- Nội dung hiển thị -->
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Nội dung</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Lý do ký (reason)</label>
                <input class="form-input" id="sp-reason"  type="text" value="Ký hợp đồng điện tử"/>
              </div>
              <div class="form-group">
                <label class="form-label">Địa điểm (location)</label>
                <input class="form-input" id="sp-location" type="text" value="Hà Nội"/>
              </div>
              <div class="form-group">
                <label class="form-label">Nhãn địa điểm (location_label)</label>
                <input class="form-input" id="sp-location-label" type="text" value="Tại: Phòng giao dịch"/>
              </div>
              <div class="form-group">
                <label class="form-label">Thông tin liên hệ (contact)</label>
                <input class="form-input" id="sp-contact" type="text" value="Giám đốc"/>
              </div>
              <div class="form-group">
                <label class="form-label">Nhãn ngày ký (date_label)</label>
                <input class="form-input" id="sp-date-label" type="text" value="Ngày ký"/>
              </div>
              <div class="form-group">
                <label class="form-label">Màu chữ (text_color)</label>
                <input class="form-input" id="sp-color" type="color" value="#0000ff" style="height:38px;padding:4px;"/>
              </div>
            </div>

            <!-- Hiển thị -->
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Hiển thị</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              <div class="form-group">
                <label class="form-label">Cỡ chữ (font_size)</label>
                <input class="form-input" id="sp-fontsize" type="number" value="11" min="6" max="20"/>
              </div>
              <div class="form-group">
                <label class="form-label">Hiển thị ô ký</label>
                <select class="form-input" id="sp-visibility">
                  <option value="shown">shown — hiển thị</option>
                  <option value="hidden">hidden — ẩn</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Bố cục (template)</label>
                <select class="form-input" id="sp-template">
                  <option value="right">right — logo phải</option>
                  <option value="left">left — logo trái</option>
                  <option value="text_only">text_only — không dùng logo</option>
                </select>
              </div>
            </div>
          </div>
        </details>

        <button class="btn btn-primary" id="s1-btn-upload" disabled>
          📤 Upload & Lấy Challenge
        </button>

        <!-- Code panels: hiển thị form fields vì multipart không có body JSON -->
        <div id="s1-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    // Code panels — request sẽ là form fields, response là JSON
    this._codePanels = renderCodePanels(
      this._el.querySelector("#s1-code-container"),
      { requestTitle: "POST /ca/api/sign/challenge  (multipart/form-data)" }
    );

    // Hiển thị request mẫu
    this._updateRequestPanel();

    // Sự kiện chọn file
    const fileInput = this._el.querySelector("#s1-file");
    const dropzone  = this._el.querySelector("#s1-dropzone");

    fileInput.addEventListener("change", (e) => {
      if (e.target.files[0]) this._onFileSelected(e.target.files[0]);
    });

    // Drag & drop
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) this._onFileSelected(file);
    });

    // Input CCCD — bật nút upload khi đủ 12 số (mock mode không cần file)
    const cccdInput = this._el.querySelector("#s1-cccd");
    cccdInput.addEventListener("input", () => {
      this._updateRequestPanel();
      const val = cccdInput.value.trim();
      // Bật nút khi: có file HOẶC đang ở mock mode (tạo dummy file)
      if (val.length === 12) {
        this._el.querySelector("#s1-btn-upload").disabled = false;
      }
    });

    // Nếu CCCD đã được điền sẵn (từ NFC) → bật nút ngay
    if (cccdInput.value.length === 12) {
      this._el.querySelector("#s1-btn-upload").disabled = false;
    }

    // Cập nhật payload khi thay đổi sign_props
    const signPropsContainer = this._el.querySelector("details");
    if (signPropsContainer) {
      signPropsContainer.addEventListener("input", () => this._updateRequestPanel());
      signPropsContainer.addEventListener("change", () => this._updateRequestPanel());
    }

    // Nút upload
    this._el.querySelector("#s1-btn-upload").addEventListener("click", () => this._run());
  }

  /** Gọi khi có file được chọn */
  _onFileSelected(file) {
    this._selectedFile = file;
    this._state.selectedFile = file;

    const info     = this._el.querySelector("#s1-file-info");
    const nameEl   = this._el.querySelector("#s1-file-name");
    const sizeEl   = this._el.querySelector("#s1-file-size");
    const dropzone = this._el.querySelector("#s1-dropzone");

    nameEl.textContent = file.name;
    sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    info.classList.remove("hidden");
    dropzone.classList.add("has-file");

    this._el.querySelector("#s1-btn-upload").disabled = false;
    this._updateRequestPanel();
  }

  /**
   * Lấy sign_props từ form và trả về đúng cấu trúc API yêu cầu.
   * sign_props là JSON Array stringify — mỗi phần tử = 1 vị trí chữ ký.
   * Tham chiếu: docs/api-reference.md § sign_props
   */
  _getSignProps() {
    const q = (id) => this._el.querySelector(id);
    return [{
      page:            parseInt(q("#sp-page")?.value)     || 1,
      lLx:             parseInt(q("#sp-llx")?.value)      || 65,
      lLy:             parseInt(q("#sp-lly")?.value)      || 320,
      width:           parseInt(q("#sp-width")?.value)    || 260,
      height:          parseInt(q("#sp-height")?.value)   || 90,
      template:        q("#sp-template")?.value           || "right",
      show_info:       ["reason", "location", "contact", "name", "org", "date"],
      location:        q("#sp-location")?.value           || "Hà Nội",
      location_label:  q("#sp-location-label")?.value    || "Tại: Phòng giao dịch",
      reason:          q("#sp-reason")?.value             || "Ký hợp đồng điện tử",
      reason_label:    "",
      contact:         q("#sp-contact")?.value            || "Giám đốc",
      contact_label:   "",
      date_label:      q("#sp-date-label")?.value         || "Ngày ký",
      text_color:      q("#sp-color")?.value              || "#0000ff",
      font_size:       parseInt(q("#sp-fontsize")?.value) || 11,
      sign_visibility: q("#sp-visibility")?.value         || "shown",
      watermark_pos:   "center",
      watermark_img_b64: "",
      hand_sig_img_b64:  "",
    }];
  }

  /** Hiển thị các form fields sẽ được gửi (dưới dạng JSON tương đương để dễ đọc) */
  _updateRequestPanel() {
    const idNumber  = this._el?.querySelector("#s1-cccd")?.value || "...";
    const signProps = this._getSignProps();
    this._codePanels.setRequest({
      "// Content-Type":  "multipart/form-data",
      "// Header":        "x-api-key + code (Partner Code)",
      "documents":        this._selectedFile?.name || "<chọn file PDF>",
      "id_number":        idNumber,
      // sign_props là JSON.stringify(array) khi gửi FormData
      "sign_props":       signProps,
      "security_level":   "LEVEL_2",
    });
  }

  /** Tự điền CCCD từ NFC data */
  setIdFromCard(idNumber) {
    const inp = this._el?.querySelector("#s1-cccd");
    if (inp) inp.value = idNumber;
    this._state.idNumber = idNumber;
    this._updateRequestPanel();
    // Bật nút upload ngay khi có CCCD từ NFC
    if (idNumber?.length === 12) {
      this._el?.querySelector("#s1-btn-upload")?.removeAttribute("disabled");
    }
  }

  /** Thực thi STEP 1 */
  async _run() {
    const idNumber = this._el.querySelector("#s1-cccd").value.trim();
    if (!idNumber || idNumber.length !== 12) {
      alert("Vui lòng nhập đúng 12 chữ số CCCD.");
      return;
    }
    if (!this._selectedFile && !this._state.isMock) {
      alert("Vui lòng chọn file cần ký.");
      return;
    }

    this._state.idNumber = idNumber;

    const btn   = this._el.querySelector("#s1-btn-upload");
    const badge = this._el.querySelector("#s1-badge");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang upload...`;
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";
    this._codePanels.setLoading();

    try {
      // ── Tạo FormData ──────────────────────────────────────────────────────
      // signGetChallenge() → POST /ca/api/sign/challenge (multipart/form-data)
      const formData = new FormData();

      // Mock mode: dùng file dummy nếu không có file thật
      const fileToUpload = this._selectedFile || new File(
        ["%PDF-1.4 MOCK_DOCUMENT_CONTENT"],
        "tai-lieu-mau.pdf",
        { type: "application/pdf" }
      );
      formData.append("documents",     fileToUpload);
      formData.append("id_number",     idNumber);
      // sign_props: JSON.stringify(array) theo đúng cấu trúc API
      formData.append("sign_props",    JSON.stringify(this._getSignProps()));
      formData.append("security_level","LEVEL_2");

      const data = await signGetChallenge(formData);
      // data = { transaction_code, token_sign, docs[{doc_id, doc_name, doc_challenge}] }

      // Lưu vào state
      this._state.transactionCode = data.transaction_code;
      this._state.tokenSign       = data.token_sign;
      this._state.docs            = data.docs;

      this._codePanels.setResponse({ success: true, error: null, data }, "success");

      badge.className = "step-status-badge badge-done";
      badge.textContent = "Hoàn thành";
      this._el.className = "step-card done";
      btn.innerHTML = "✓ Đã upload";

      this._onDone(this._state);

    } catch (err) {
      this._codePanels.setResponse(
        { success: false, error: { code: "ERROR", message: err.message }, data: null },
        "error"
      );
      badge.className = "step-status-badge badge-error";
      badge.textContent = "Lỗi";
      btn.disabled = false;
      btn.textContent = "Thử lại";
    }
  }
}
