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

// PDF.js CDN (lazy-load khi cần)
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";
let _pdfLib = null;
async function getPdfLib() {
  if (_pdfLib) return _pdfLib;
  const mod = await import(PDFJS_CDN);
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  _pdfLib = mod;
  return mod;
}

export class Step1Upload {
  constructor(container, { state, onDone }) {
    this._container = container;
    this._state = state;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
    this._selectedFile = null;
    this._files = [];           // Danh sách file được chọn
    this._activeFileIdx = 0;   // File đang xem preview
    this._pdfDoc = null;       // PDF.js document object
    this._currentPage = 1;
    this._totalPages = 1;
    this._handSigBase64 = "";
    this._watermarkBase64 = "";
    this._isDrawing = false;
    this._lastX = 0;
    this._lastY = 0;
    // Drag-drop placement
    this._pdfViewport = null;
    this._sigBox = { x: 65, y: 320, w: 260, h: 90 };
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
          <div class="dropzone-label">Kéo thả 1 hoặc nhiều file vào đây hoặc</div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-top:6px;">
            Chọn file
            <input type="file" id="s1-file" accept=".pdf" multiple
              style="display:none;" />
          </label>
          <div class="dropzone-hint">PDF — Tối đa 10MB mỗi file</div>
        </div>
        <!-- Danh sách file đã chọn -->
        <div id="s1-file-list" style="display:none;margin-top:10px;display:flex;flex-direction:column;gap:6px;"></div>

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

            <!-- PDF Preview + Drag-drop placement -->
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Vị trí chữ ký</div>
            <div id="sp-pdf-preview-wrap" style="
              position:relative;border:1px solid var(--border);border-radius:var(--radius-md);
              background:var(--bg-card-2);overflow:hidden;min-height:80px;
              display:flex;align-items:center;justify-content:center;
            ">
              <div id="sp-pdf-placeholder" style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.78rem;">
                📄 Chọn file PDF để xem preview và kéo thả vị trí chữ ký
              </div>
              <!-- Điều hướng trang -->
              <div id="sp-page-nav" style="display:none;position:absolute;top:8px;left:50%;transform:translateX(-50%);
                z-index:10;background:rgba(0,0,0,0.7);border-radius:20px;padding:4px 12px;
                display:flex;align-items:center;gap:8px;backdrop-filter:blur(4px);">
                <button id="sp-prev-page" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0 4px;">‹</button>
                <span id="sp-page-indicator" style="font-size:0.75rem;color:#e2e8f0;white-space:nowrap;">Trang 1 / 1</span>
                <button id="sp-next-page" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0 4px;">›</button>
              </div>
              <canvas id="sp-pdf-canvas" style="display:none;max-width:100%;display:block;"></canvas>
              <!-- Hộp chữ ký kéo thả -->
              <div id="sp-sig-box" style="
                display:none;position:absolute;
                border:2px solid #6366f1;
                cursor:move;box-sizing:border-box;border-radius:4px;
                user-select:none;touch-action:none;overflow:hidden;
              ">
                <!-- Preview nội dung chữ ký -->
                <div id="sp-sig-preview" style="
                  position:absolute;inset:0;pointer-events:none;
                  background:transparent;font-family:Arial,sans-serif;
                  overflow:hidden;
                "></div>
                <!-- Tọa độ -->
                <span id="sp-sig-box-coords" style="
                  position:absolute;bottom:2px;right:4px;
                  font-size:0.5rem;color:rgba(99,102,241,0.8);
                  pointer-events:none;z-index:2;
                "></span>
                <!-- Resize handle -->
                <div id="sp-sig-resize" style="
                  position:absolute;right:-5px;bottom:-5px;
                  width:14px;height:14px;background:#6366f1;
                  border-radius:3px;cursor:se-resize;
                  border:2px solid #fff;z-index:3;
                "></div>
              </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:-4px;">
              💡 Kéo hộp chữ ký để di chuyển • Kéo góc phải-dưới để thay đổi kích thước
            </div>

            <!-- Vị trí trên trang (số) — đồng bộ với drag-drop -->
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
                <input class="form-input" id="sp-color" type="color" value="#ff0033" style="height:38px;padding:4px;"/>
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

            <!-- show_info toggles -->
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-top:4px;">Thành phần hiển thị (show_info)</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;" id="sp-show-info-group">
              ${["reason","location","contact","name","org","date"].map(k => `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;
                  padding:5px 12px;border-radius:20px;border:1px solid var(--border);
                  background:var(--bg-card-2);font-size:0.75rem;color:var(--text-secondary);
                  transition:all 0.15s;user-select:none;" class="sp-show-info-label">
                  <input type="checkbox" class="sp-show-info" value="${k}" checked
                    style="accent-color:var(--color-primary);width:13px;height:13px;cursor:pointer;"/>
                  ${k}
                </label>
              `).join("")}
            </div>

            <!-- Chữ ký tay -->
            <div id="sp-handsig-section" style="margin-top:4px;">
              <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;">
                Chữ ký tay (hand_sig_img_b64) <span style="color:var(--color-primary);font-size:0.65rem;font-weight:400;">— Chỉ áp dụng với template right/left</span>
              </div>
              <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px;">
                <canvas id="sp-sig-canvas"
                  width="300" height="300"
                  style="display:block;width:100%;aspect-ratio:1/1;cursor:crosshair;
                    border-radius:6px;background:transparent;touch-action:none;"
                ></canvas>
                <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
                  <button type="button" id="sp-sig-clear" class="btn btn-secondary btn-sm">🗑 Xóa</button>
                  <span id="sp-sig-status" style="font-size:0.72rem;color:var(--text-muted);">Chưa vẽ</span>
                </div>
              </div>
            </div>

            <!-- Watermark -->
            <div style="margin-top:4px;">
              <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;">Watermark (watermark_img_b64)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Vị trí watermark</label>
                  <select class="form-input" id="sp-watermark-pos">
                    <option value="center">center</option>
                    <option value="top-left">top-left</option>
                    <option value="top-right">top-right</option>
                    <option value="bottom-left">bottom-left</option>
                    <option value="bottom-right">bottom-right</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Ảnh watermark</label>
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                    padding:8px 14px;background:var(--bg-input);border:1px solid var(--border);
                    border-radius:var(--radius-md);font-size:0.78rem;color:var(--text-secondary);
                    transition:border-color 0.2s;" id="sp-watermark-label">
                    🖼 Chọn ảnh
                    <input type="file" id="sp-watermark-file" accept="image/*" style="display:none;"/>
                  </label>
                </div>
              </div>
              <div id="sp-watermark-preview" style="display:none;margin-top:8px;padding:8px;
                background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);
                display:flex;align-items:center;gap:10px;">
                <img id="sp-watermark-img" style="height:48px;border-radius:4px;object-fit:contain;background:#fff;padding:2px;"/>
                <div style="flex:1;">
                  <div id="sp-watermark-name" style="font-size:0.75rem;font-weight:600;"></div>
                  <button type="button" id="sp-watermark-clear" class="btn btn-ghost btn-sm" style="margin-top:4px;padding:4px 10px;">✕ Xóa</button>
                </div>
              </div>
            </div>

          </div>
        </details>

        <!-- Template save/load bar -->
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;
          background:var(--bg-card-2);border:1px solid var(--border);
          border-radius:var(--radius-md);margin-bottom:14px;flex-wrap:wrap;">
          <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;flex:1;">&#128230; Mẫu chữ ký (sign_props)</span>
          <button type="button" id="sp-tpl-save" class="btn btn-secondary btn-sm" style="gap:5px;">
            &#128190; Lưu mẫu
          </button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;gap:5px;">
            &#128194; Tải mẫu
            <input type="file" id="sp-tpl-load" accept=".json" style="display:none;"/>
          </label>
          <span id="sp-tpl-status" style="font-size:0.72rem;color:var(--text-muted);"></span>
        </div>

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
      if (e.target.files.length) this._onFilesSelected([...e.target.files]);
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
      const files = [...e.dataTransfer.files].filter(f => f.type === "application/pdf");
      if (files.length) this._onFilesSelected(files);
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

    // Cập nhật payload + sig preview khi thay đổi sign_props
    const signPropsContainer = this._el.querySelector("details");
    if (signPropsContainer) {
      signPropsContainer.addEventListener("input",  () => { this._updateRequestPanel(); this._renderSigPreview(); });
      signPropsContainer.addEventListener("change", () => { this._updateRequestPanel(); this._renderSigPreview(); });
    }

    // Template change → ẩn/hiện canvas chữ ký tay
    const templateSel = this._el.querySelector("#sp-template");
    templateSel?.addEventListener("change", () => this._onTemplateChange());
    this._onTemplateChange();

    // Canvas vẽ chữ ký tay
    this._initSignatureCanvas();

    // Watermark file
    this._el.querySelector("#sp-watermark-file")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this._watermarkBase64 = ev.target.result.split(",")[1];
        const preview = this._el.querySelector("#sp-watermark-preview");
        const img     = this._el.querySelector("#sp-watermark-img");
        const name    = this._el.querySelector("#sp-watermark-name");
        if (preview) preview.style.display = "flex";
        if (img)  img.src = ev.target.result;
        if (name) name.textContent = file.name;
        this._updateRequestPanel();
        this._renderSigPreview();
      };
      reader.readAsDataURL(file);
    });

    // Xóa watermark
    this._el.querySelector("#sp-watermark-clear")?.addEventListener("click", () => {
      this._watermarkBase64 = "";
      const preview = this._el.querySelector("#sp-watermark-preview");
      const fileInp = this._el.querySelector("#sp-watermark-file");
      if (preview) preview.style.display = "none";
      if (fileInp) fileInp.value = "";
      this._updateRequestPanel();
      this._renderSigPreview();
    });

    // Template save/load
    this._el.querySelector("#sp-tpl-save")?.addEventListener("click", () => this._saveTemplate());
    this._el.querySelector("#sp-tpl-load")?.addEventListener("change", (e) => {
      if (e.target.files[0]) this._loadTemplate(e.target.files[0]);
    });

    // Nút upload
    this._el.querySelector("#s1-btn-upload").addEventListener("click", () => this._run());
  }

  /** Gọi khi có nhiều file được chọn */
  _onFilesSelected(newFiles) {
    // Merge, loại trùng tên
    newFiles.forEach(f => {
      if (!this._files.find(x => x.name === f.name)) this._files.push(f);
    });
    this._selectedFile = this._files[0] || null;
    this._state.selectedFile = this._selectedFile;
    this._activeFileIdx = 0;

    this._renderFileList();
    this._el.querySelector("#s1-btn-upload").disabled = !this._files.length;
    this._el.querySelector("#s1-dropzone").classList.toggle("has-file", this._files.length > 0);
    this._updateRequestPanel();

    const details = this._el.querySelector("details");
    if (details && !details.open) details.open = true;
    if (this._files[0]?.type === "application/pdf") this._renderPdfPreview(this._files[0]);
  }

  /** Render danh sách file đã chọn */
  _renderFileList() {
    const listEl = this._el.querySelector("#s1-file-list");
    if (!listEl) return;
    listEl.style.display = this._files.length ? "flex" : "none";
    listEl.innerHTML = this._files.map((f, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
        background:${ i === this._activeFileIdx ? 'var(--color-primary-dim)' : 'var(--bg-card-2)'};
        border:1px solid ${ i === this._activeFileIdx ? 'var(--color-primary)' : 'var(--border)'};
        border-radius:var(--radius-md);cursor:pointer;transition:all 0.15s;"
        data-file-idx="${i}">
        <span>📄</span>
        <span style="flex:1;font-size:0.78rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
        <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0;">${(f.size/1024).toFixed(0)} KB</span>
        <button data-remove="${i}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:0 2px;">✕</button>
      </div>
    `).join("");

    listEl.querySelectorAll("[data-file-idx]").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.dataset.remove !== undefined) return;
        const idx = parseInt(row.dataset.fileIdx);
        this._activeFileIdx = idx;
        this._renderFileList();
        if (this._files[idx]?.type === "application/pdf") this._renderPdfPreview(this._files[idx]);
      });
    });
    listEl.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.remove);
        this._files.splice(idx, 1);
        this._activeFileIdx = Math.min(this._activeFileIdx, this._files.length - 1);
        this._selectedFile = this._files[0] || null;
        this._renderFileList();
        this._updateRequestPanel();
        this._el.querySelector("#s1-btn-upload").disabled = !this._files.length;
        if (!this._files.length) {
          this._el.querySelector("#s1-dropzone").classList.remove("has-file");
          const c = this._el.querySelector("#sp-pdf-canvas"); if (c) c.style.display="none";
          const b = this._el.querySelector("#sp-sig-box");    if (b) b.style.display="none";
          const n = this._el.querySelector("#sp-page-nav");   if (n) n.style.display="none";
          const p = this._el.querySelector("#sp-pdf-placeholder"); if (p) p.style.display="";
        } else if (this._files[this._activeFileIdx]) {
          this._renderPdfPreview(this._files[this._activeFileIdx]);
        }
      });
    });
  }

  /**
   * Lấy sign_props từ form và trả về đúng cấu trúc API yêu cầu.
   * sign_props là JSON Array stringify — mỗi phần tử = 1 vị trí chữ ký.
   * Tham chiếu: docs/api-reference.md § sign_props
   */
  _getSignProps() {
    const q = (id) => this._el.querySelector(id);
    // Thu thập show_info từ các checkbox được check
    const showInfoChecked = [...this._el.querySelectorAll(".sp-show-info:checked")]
      .map(cb => cb.value);
    const template = q("#sp-template")?.value || "right";
    return [{
      page:            parseInt(q("#sp-page")?.value)     || 1,
      lLx:             parseInt(q("#sp-llx")?.value)      || 65,
      lLy:             parseInt(q("#sp-lly")?.value)      || 320,
      width:           parseInt(q("#sp-width")?.value)    || 260,
      height:          parseInt(q("#sp-height")?.value)   || 90,
      template,
      show_info:       showInfoChecked,
      location:        q("#sp-location")?.value           || "Hà Nội",
      location_label:  q("#sp-location-label")?.value    || "Tại: Phòng giao dịch",
      reason:          q("#sp-reason")?.value             || "Ký hợp đồng điện tử",
      reason_label:    "",
      contact:         q("#sp-contact")?.value            || "Giám đốc",
      contact_label:   "",
      date_label:      q("#sp-date-label")?.value         || "Ngày ký",
      text_color:      q("#sp-color")?.value              || "#ff0033",
      font_size:       parseInt(q("#sp-fontsize")?.value) || 11,
      sign_visibility: q("#sp-visibility")?.value         || "shown",
      watermark_pos:   q("#sp-watermark-pos")?.value      || "center",
      watermark_img_b64: this._watermarkBase64 || "",
      hand_sig_img_b64:  (template === "right" || template === "left")
        ? (this._handSigBase64 || "") : "",
    }];
  }

  // ─── Visual Signature Preview ────────────────────────────────────

  /** Render n\u1ed9i dung tr\u1ef1c quan b\u00ean trong h\u1ed9p ch\u1eef k\u00fd */
  _renderSigPreview() {
    const preview = this._el?.querySelector("#sp-sig-preview");
    if (!preview) return;
    const q = (id) => this._el?.querySelector(id)?.value || "";
    const show  = [...this._el.querySelectorAll(".sp-show-info:checked")].map(c => c.value);
    const tpl   = q("#sp-template") || "right";
    const color = q("#sp-color")    || "#ff0033";
    const fs    = parseFloat(q("#sp-fontsize")) || 11;
    const boxW  = parseFloat(this._el.querySelector("#sp-sig-box")?.style.width)  || 260;
    const boxH  = parseFloat(this._el.querySelector("#sp-sig-box")?.style.height) || 90;
    const scale = Math.min(boxW / 260, boxH / 90);
    const fsPx  = Math.max(5, Math.round(fs * scale * 0.82)) + "px";
    const pad   = Math.max(2, Math.round(4 * scale)) + "px";

    const fields = {
      name:     "Nguy\u1ec5n V\u0103n A",
      org:      "C\u00f4ng ty TNHH ABC",
      reason:   q("#sp-reason"),
      location: q("#sp-location-label") || q("#sp-location"),
      contact:  q("#sp-contact"),
      date:     q("#sp-date-label") + ": " + new Date().toISOString().replace("Z", "+00:00").replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}).*/, "$1T$2" + (() => { const o = -new Date().getTimezoneOffset(); const s = o >= 0 ? "+" : "-"; const h = String(Math.floor(Math.abs(o)/60)).padStart(2,"0"); const m = String(Math.abs(o)%60).padStart(2,"0"); return s+h+":"+m; })()),
    };

    const lines = show
      .filter(k => fields[k])
      .map(k => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;color:${color};">${fields[k]}</div>`)
      .join("");

    const logoSize = Math.round(boxH * 0.72);
    // Logo: hiển thị hand_sig nếu có, ngược lại placeholder
    const logoHtml = tpl !== "text_only"
      ? (this._handSigBase64
        ? `<img src="data:image/png;base64,${this._handSigBase64}" style="height:100%;max-width:45%;object-fit:contain;flex-shrink:0;">`
        : `<div style="flex-shrink:0;width:${Math.round(boxH*0.7)}px;height:${Math.round(boxH*0.7)}px;display:flex;align-items:center;justify-content:center;">
             <svg viewBox="0 0 100 100" style="width:80%;height:80%;" xmlns="http://www.w3.org/2000/svg">
               <polyline points="10,55 38,80 90,20" fill="none" stroke="#407F3E" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>`)
      : "";
    // Watermark: phủ toàn bộ box mờ
    const watermarkHtml = this._watermarkBase64
      ? `<img src="data:image/png;base64,${this._watermarkBase64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0.18;pointer-events:none;">`
      : "";
    const textBlock = `<div style="flex:1;overflow:hidden;font-size:${fsPx};">${lines || '<span style="color:#aaa;font-size:9px;">Ch\u01b0a c\u00f3 n\u1ed9i dung</span>'}</div>`;

    preview.style.cssText = `position:absolute;inset:0;pointer-events:none;background:transparent;
      font-family:Arial,sans-serif;overflow:hidden;display:flex;align-items:center;
      padding:${pad};gap:${pad};`;
    preview.innerHTML = (tpl === "left"
      ? logoHtml + textBlock
      : tpl === "right"
        ? textBlock + logoHtml
        : textBlock)
      + watermarkHtml;
  }

  // ─── Template Save / Load ────────────────────────────────────────

  /** Export sign_props hi\u1ec7n t\u1ea1i th\u00e0nh file JSON */
  _saveTemplate() {
    const props = this._getSignProps()[0];
    // Luôn lưu cả 2 ảnh bất kể template đang chọn
    const tpl = {
      ...props,
      watermark_img_b64: this._watermarkBase64 || "",
      hand_sig_img_b64:  this._handSigBase64   || "",
    };
    const blob  = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = "sign_props_template_" + Date.now() + ".json"; a.click();
    URL.revokeObjectURL(url);
    const st = this._el?.querySelector("#sp-tpl-status");
    if (st) { st.textContent = "✅ Đã lưu!"; setTimeout(() => st.textContent = "", 2000); }
  }

  /** \u0110\u1ecdc file JSON template v\u00e0 \u0111i\u1ec1n v\u00e0o form */
  _loadTemplate(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const tpl = JSON.parse(ev.target.result);
        const set = (id, v) => { const el = this._el?.querySelector(id); if (el && v !== undefined) el.value = v; };
        set("#sp-page",           tpl.page);
        set("#sp-llx",            tpl.lLx);
        set("#sp-lly",            tpl.lLy);
        set("#sp-width",          tpl.width);
        set("#sp-height",         tpl.height);
        set("#sp-template",       tpl.template);
        set("#sp-reason",         tpl.reason);
        set("#sp-location",       tpl.location);
        set("#sp-location-label", tpl.location_label);
        set("#sp-contact",        tpl.contact);
        set("#sp-date-label",     tpl.date_label);
        set("#sp-color",          tpl.text_color);
        set("#sp-fontsize",       tpl.font_size);
        set("#sp-visibility",     tpl.sign_visibility);
        set("#sp-watermark-pos",  tpl.watermark_pos);
        if (Array.isArray(tpl.show_info)) {
          this._el?.querySelectorAll(".sp-show-info").forEach(cb => {
            cb.checked = tpl.show_info.includes(cb.value);
          });
        }
        this._sigBox = { x: tpl.lLx || 65, y: tpl.lLy || 320, w: tpl.width || 260, h: tpl.height || 90 };
        if (this._pdfViewport) this._showSigBox();
        this._onTemplateChange();

        // Restore watermark
        if (tpl.watermark_img_b64) {
          this._watermarkBase64 = tpl.watermark_img_b64;
          const src     = "data:image/png;base64," + tpl.watermark_img_b64;
          const preview = this._el?.querySelector("#sp-watermark-preview");
          const img     = this._el?.querySelector("#sp-watermark-img");
          const name    = this._el?.querySelector("#sp-watermark-name");
          if (preview) preview.style.display = "flex";
          if (img)     img.src = src;
          if (name)    name.textContent = "(tải từ mẫu)";
        } else {
          this._watermarkBase64 = "";
        }

        // Restore hand signature vào canvas
        if (tpl.hand_sig_img_b64) {
          this._handSigBase64 = tpl.hand_sig_img_b64;
          const canvas = this._el?.querySelector("#sp-sig-canvas");
          if (canvas) {
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = "data:image/png;base64," + tpl.hand_sig_img_b64;
            const status = this._el?.querySelector("#sp-sig-status");
            if (status) { status.textContent = "✅ Đã vẽ"; status.style.color = "var(--color-success)"; }
          }
        } else {
          this._handSigBase64 = "";
        }

        this._updateRequestPanel();
        this._renderSigPreview();
        const st = this._el?.querySelector("#sp-tpl-status");
        if (st) { st.textContent = "✅ Đã tải: " + file.name; setTimeout(() => st.textContent = "", 3000); }
        const inp = this._el?.querySelector("#sp-tpl-load"); if (inp) inp.value = "";
      } catch {
        const st = this._el?.querySelector("#sp-tpl-status");
        if (st) st.textContent = "\u26a0\ufe0f File kh\u00f4ng h\u1ee3p l\u1ec7";
      }
    };
    reader.readAsText(file);
  }

  // ─── PDF Preview + Drag-drop placement ─────────────────────────

  /** Render PDF preview với hỗ trợ nhiều trang */
  async _renderPdfPreview(file) {
    const wrap        = this._el.querySelector("#sp-pdf-preview-wrap");
    const placeholder = this._el.querySelector("#sp-pdf-placeholder");
    const canvas      = this._el.querySelector("#sp-pdf-canvas");
    const sigBox      = this._el.querySelector("#sp-sig-box");
    const pageNav     = this._el.querySelector("#sp-page-nav");
    if (!wrap || !canvas) return;

    placeholder.style.display = "none";
    canvas.style.display = "none";
    if (sigBox)   sigBox.style.display = "none";
    if (pageNav)  pageNav.style.display = "none";

    try {
      const pdfjsLib = await getPdfLib();
      const arrayBuf = await file.arrayBuffer();
      this._pdfDoc     = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      this._totalPages = this._pdfDoc.numPages;
      this._currentPage = 1;
      await this._renderPage(this._currentPage);
      this._initSigBoxDrag();
      this._updatePageNav();
    } catch (e) {
      placeholder.style.display = "";
      placeholder.textContent = "⚠️ Không thể render PDF. Vẫn có thể nhập tọa độ thủ công.";
    }
  }

  /** Render một trang cụ thể */
  async _renderPage(pageNum) {
    if (!this._pdfDoc) return;
    const wrap   = this._el.querySelector("#sp-pdf-preview-wrap");
    const canvas = this._el.querySelector("#sp-pdf-canvas");
    if (!wrap || !canvas) return;

    const page  = await this._pdfDoc.getPage(pageNum);
    const maxW  = Math.min(wrap.clientWidth || 680, 700);
    const rawVp = page.getViewport({ scale: 1 });
    const scale = maxW / rawVp.width;
    const vp    = page.getViewport({ scale });

    this._pdfViewport = vp;
    canvas.width  = vp.width;
    canvas.height = vp.height;
    canvas.style.display = "block";
    wrap.style.height = `${vp.height}px`;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    // Đồng bộ input Trang
    const pageInp = this._el.querySelector("#sp-page");
    if (pageInp) pageInp.value = pageNum;
    this._sigBox.page = pageNum;

    this._showSigBox();
  }

  /** Cập nhật thanh điều hướng trang */
  _updatePageNav() {
    const nav = this._el.querySelector("#sp-page-nav");
    const ind = this._el.querySelector("#sp-page-indicator");
    const prev = this._el.querySelector("#sp-prev-page");
    const next = this._el.querySelector("#sp-next-page");
    if (!nav) return;
    const show = this._totalPages > 1;
    nav.style.display = show ? "flex" : "none";
    if (ind)  ind.textContent  = `Trang ${this._currentPage} / ${this._totalPages}`;
    if (prev) prev.style.opacity = this._currentPage <= 1 ? "0.3" : "1";
    if (next) next.style.opacity = this._currentPage >= this._totalPages ? "0.3" : "1";

    // Gán sự kiện (chỉ gán 1 lần)
    if (!nav._navBound) {
      nav._navBound = true;
      prev?.addEventListener("click", async () => {
        if (this._currentPage > 1) {
          this._currentPage--;
          await this._renderPage(this._currentPage);
          this._updatePageNav();
        }
      });
      next?.addEventListener("click", async () => {
        if (this._currentPage < this._totalPages) {
          this._currentPage++;
          await this._renderPage(this._currentPage);
          this._updatePageNav();
        }
      });
    }
  }

  /** Hiển thị sig box tại vị trí hiện tại trong _sigBox (PDF coords) */
  _showSigBox() {
    const sigBox = this._el?.querySelector("#sp-sig-box");
    const canvas = this._el?.querySelector("#sp-pdf-canvas");
    if (!sigBox || !canvas || !this._pdfViewport) return;

    const rect = this._pdfToScreen(this._sigBox.x, this._sigBox.y, this._sigBox.w, this._sigBox.h);
    sigBox.style.left   = rect.left   + "px";
    sigBox.style.top    = rect.top    + "px";
    sigBox.style.width  = rect.width  + "px";
    sigBox.style.height = rect.height + "px";
    sigBox.style.display = "block";
    this._updateSigBoxLabel();
  }

  /** PDF (lLx, lLy = bottom-left origin) → screen pixels (top-left origin) */
  _pdfToScreen(lLx, lLy, w, h) {
    const vp    = this._pdfViewport;
    const scale = vp.scale;
    // PDF Y: 0 = bottom, screen Y: 0 = top
    const screenLeft   = lLx * scale;
    const screenBottom = lLy * scale;
    const screenH      = h   * scale;
    const screenW      = w   * scale;
    const screenTop    = vp.height - screenBottom - screenH;
    return { left: screenLeft, top: screenTop, width: screenW, height: screenH };
  }

  /** screen pixels (top-left) → PDF coords (bottom-left) */
  _screenToPdf(screenLeft, screenTop, screenW, screenH) {
    const vp    = this._pdfViewport;
    const scale = vp.scale;
    const lLx   = Math.round(screenLeft / scale);
    const lLy   = Math.round((vp.height - screenTop - screenH) / scale);
    const w     = Math.round(screenW / scale);
    const h     = Math.round(screenH / scale);
    return { lLx, lLy, w, h };
  }

  /** Cập nhật label tọa độ bên trong box */
  _updateSigBoxLabel() {
    const el = this._el?.querySelector("#sp-sig-box-coords");
    if (el) el.textContent = `x:${this._sigBox.x} y:${this._sigBox.y} ${this._sigBox.w}×${this._sigBox.h}pt`;
  }

  /** Đồng bộ _sigBox → form inputs */
  _syncBoxToInputs() {
    const q = (id) => this._el?.querySelector(id);
    if (q("#sp-llx"))    q("#sp-llx").value    = this._sigBox.x;
    if (q("#sp-lly"))    q("#sp-lly").value    = this._sigBox.y;
    if (q("#sp-width"))  q("#sp-width").value  = this._sigBox.w;
    if (q("#sp-height")) q("#sp-height").value = this._sigBox.h;
    this._updateRequestPanel();
  }

  /** Đồng bộ form inputs → _sigBox (khi user gõ tay) */
  _syncInputsToBox() {
    const q = (id) => parseInt(this._el?.querySelector(id)?.value) || 0;
    this._sigBox.x = q("#sp-llx");
    this._sigBox.y = q("#sp-lly");
    this._sigBox.w = q("#sp-width");
    this._sigBox.h = q("#sp-height");
    if (this._pdfViewport) this._showSigBox();
  }

  /** Khởi tạo drag-move + drag-resize cho sig box */
  _initSigBoxDrag() {
    const box    = this._el?.querySelector("#sp-sig-box");
    const resize = this._el?.querySelector("#sp-sig-resize");
    const canvas = this._el?.querySelector("#sp-pdf-canvas");
    if (!box || !canvas) return;

    // Lắng nghe thay đổi tay từ inputs
    ["#sp-llx","#sp-lly","#sp-width","#sp-height"].forEach(id => {
      this._el?.querySelector(id)?.addEventListener("input", () => this._syncInputsToBox());
    });

    let mode = null; // "move" | "resize"
    let startX, startY, origLeft, origTop, origW, origH;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const onStart = (e, m) => {
      e.preventDefault();
      e.stopPropagation();
      mode   = m;
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      origLeft = parseFloat(box.style.left)  || 0;
      origTop  = parseFloat(box.style.top)   || 0;
      origW    = parseFloat(box.style.width) || 100;
      origH    = parseFloat(box.style.height)|| 40;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onEnd);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend",  onEnd);
    };

    const onMove = (e) => {
      if (!mode) return;
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX;
      const dy = pt.clientY - startY;
      const vp = this._pdfViewport;
      const maxX = vp.width;
      const maxY = vp.height;
      const MIN_SIZE = 20;

      if (mode === "move") {
        const newL = clamp(origLeft + dx, 0, maxX - origW);
        const newT = clamp(origTop  + dy, 0, maxY - origH);
        box.style.left = newL + "px";
        box.style.top  = newT + "px";
        const pdf = this._screenToPdf(newL, newT, origW, origH);
        Object.assign(this._sigBox, { x: pdf.lLx, y: pdf.lLy, w: pdf.w, h: pdf.h });
      } else if (mode === "resize") {
        const newW = clamp(origW + dx, MIN_SIZE, maxX - origLeft);
        const newH = clamp(origH + dy, MIN_SIZE, maxY - origTop);
        box.style.width  = newW + "px";
        box.style.height = newH + "px";
        const pdf = this._screenToPdf(origLeft, origTop, newW, newH);
        Object.assign(this._sigBox, { x: pdf.lLx, y: pdf.lLy, w: pdf.w, h: pdf.h });
      }
      this._updateSigBoxLabel();
      this._syncBoxToInputs();
    };

    const onEnd = () => {
      mode = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onEnd);
    };

    box.addEventListener("mousedown",  (e) => onStart(e, "move"));
    box.addEventListener("touchstart", (e) => onStart(e, "move"), { passive: false });
    resize.addEventListener("mousedown",  (e) => onStart(e, "resize"));
    resize.addEventListener("touchstart", (e) => onStart(e, "resize"), { passive: false });
  }

  /** Ẩn/hiện canvas chữ ký tay theo template */
  _onTemplateChange() {
    const template = this._el?.querySelector("#sp-template")?.value;
    const section  = this._el?.querySelector("#sp-handsig-section");
    if (!section) return;
    const show = template === "right" || template === "left";
    section.style.opacity = show ? "1" : "0.35";
    section.style.pointerEvents = show ? "" : "none";
    const canvas = this._el?.querySelector("#sp-sig-canvas");
    if (canvas) canvas.style.cursor = show ? "crosshair" : "not-allowed";
  }

  /** Khởi tạo canvas vẽ chữ ký tay */
  /**
   * Auto-crop canvas: quét pixel, t\u00ecm bounding box v\u00f9ng \u0111\u01b0\u1ee3c v\u1ebd,
   * thêm padding nhỏ rồi export PNG base64 \u0111\u00e3 crop.
   */
  _cropCanvas(canvas, padding = 8) {
    const ctx  = canvas.getContext("2d");
    const w    = canvas.width;
    const h    = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx   = (y * w + x) * 4;
        const alpha = data[idx + 3];
        // Coi là pixel \u0111\u01b0\u1ee3c vẽ nếu không trong suốt VÀ không phải trắng thuần
        const isWhite = data[idx] > 240 && data[idx+1] > 240 && data[idx+2] > 240;
        if (alpha > 10 && !isWhite) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixel = true;
        }
      }
    }

    // Không có pixel nào → trả về rỗng
    if (!hasPixel) return "";

    // Áp padding, clamp vào canvas
    minX = Math.max(0,   minX - padding);
    minY = Math.max(0,   minY - padding);
    maxX = Math.min(w-1, maxX + padding);
    maxY = Math.min(h-1, maxY + padding);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const tmp    = document.createElement("canvas");
    tmp.width    = cropW;
    tmp.height   = cropH;
    const tmpCtx = tmp.getContext("2d");
    // Nền trắng
    // Nền trong suốt — không fillRect trắng
    tmpCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    return tmp.toDataURL("image/png").split(",")[1];
  }

  /** Khởi tạo canvas vẽ chữ ký tay */
  _initSignatureCanvas() {
    const canvas = this._el?.querySelector("#sp-sig-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0040ff";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
    };

    const startDraw = (e) => {
      e.preventDefault();
      this._isDrawing = true;
      [this._lastX, this._lastY] = getPos(e);
    };
    const draw = (e) => {
      e.preventDefault();
      if (!this._isDrawing) return;
      const [x, y] = getPos(e);
      ctx.beginPath();
      ctx.moveTo(this._lastX, this._lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      [this._lastX, this._lastY] = [x, y];
    };
    const endDraw = (e) => {
      e.preventDefault();
      if (!this._isDrawing) return;
      this._isDrawing = false;
      // Auto-crop: t\u00ecm vùng bounding box ch\u1ee9a pixel \u0111\u01b0\u1ee3c v\u1ebd
      this._handSigBase64 = this._cropCanvas(canvas);
      const status = this._el?.querySelector("#sp-sig-status");
      if (status) {
        status.textContent = "✅ Đã vẽ";
        status.style.color = "var(--color-success)";
      }
      this._updateRequestPanel();
      this._renderSigPreview();
    };

    // Mouse
    canvas.addEventListener("mousedown",  startDraw);
    canvas.addEventListener("mousemove",  draw);
    canvas.addEventListener("mouseup",    endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    // Touch
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove",  draw,      { passive: false });
    canvas.addEventListener("touchend",   endDraw,   { passive: false });

    // Nút xóa
    this._el?.querySelector("#sp-sig-clear")?.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this._handSigBase64 = "";
      const status = this._el?.querySelector("#sp-sig-status");
      if (status) {
        status.textContent = "Chưa vẽ";
        status.style.color = "var(--text-muted)";
      }
      this._updateRequestPanel();
      this._renderSigPreview();
    });
  }

  /** Hiển thị các form fields sẽ được gửi (dưới dạng JSON tương đương để dễ đọc) */
  _updateRequestPanel() {
    const idNumber  = this._el?.querySelector("#s1-cccd")?.value || "...";
    const signProps = this._getSignProps();
    const fileNames = this._files.length
      ? this._files.map(f => f.name)
      : ["<chọn file PDF>"];
    this._codePanels.setRequest({
      "// Content-Type":  "multipart/form-data",
      "// Header":        "x-api-key + code (Partner Code)",
      "documents":        fileNames.length === 1 ? fileNames[0] : fileNames,
      "id_number":        idNumber,
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
      const filesToUpload = this._files.length ? this._files : [
        new File(["%PDF-1.4 MOCK_DOCUMENT_CONTENT"], "tai-lieu-mau.pdf", { type: "application/pdf" })
      ];
      // Gửi nhiều file — API nhận documents[] dạng multiple
      filesToUpload.forEach(f => formData.append("documents", f));
      formData.append("id_number",     idNumber);
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
