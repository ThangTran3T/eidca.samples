/**
 * Step1Challenge.js — STEP 1: Lấy Challenge (CTS Cá nhân thuộc Tổ chức)
 *
 * Gọi API: POST /ca/api/eid-company/challenge
 *
 * Khác với cá nhân thông thường:
 *   - Có thêm trường `company_id` (ID tổ chức trong hệ thống eIDCA)
 *
 * Input:
 *   - id_number  (Số CCCD 12 chữ số) — tự điền từ dữ liệu NFC hoặc nhập tay
 *   - company_id (Int) — chọn từ danh sách hoặc nhập thủ công
 *   - code       (Partner code — từ config)
 *
 * Output lưu vào state:
 *   - transaction_code
 *   - token_challenge (JWT, gửi lại ở STEP 2)
 *
 * Lưu ý: response eid-company/challenge không trả về `challenge` riêng như eid-personal —
 * challenge được embed trong token_challenge.
 */

// ─── Danh sách tổ chức mẫu (thay bằng API thật khi production) ───────────────
// Trong thực tế, partner tự quản lý danh sách này và lấy company_id từ eIDCA.
const DEMO_COMPANIES = [
  { id: 1001, name: "CÔNG TY TNHH CÔNG NGHỆ ABC",          tax: "0123456789" },
  { id: 1002, name: "CÔNG TY CỔ PHẦN XYZ VIỆT NAM",         tax: "0987654321" },
  { id: 2001, name: "NGÂN HÀNG TMCP DEMO BANK",             tax: "0112233445" },
  { id: 3005, name: "TẬP ĐOÀN BẢO HIỂM AN KHANG",           tax: "0556677889" },
];

import { renderCodePanels } from "../../ui/CodePanel.js";
import { companyGetChallenge } from "../../api/eidcaClient.js";

export class Step1Challenge {
  /**
   * @param {HTMLElement} container
   * @param {object} opts
   * @param {object} opts.state    - State dùng chung của flow
   * @param {function} opts.onDone - Callback khi bước hoàn thành
   */
  constructor(container, { state, onDone }) {
    this._container = container;
    this._state = state;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card active";
    this._el.id = "step-1-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">1</div>
        <div class="step-card-title">
          <h3>Lấy Challenge</h3>
          <p>POST /ca/api/eid-company/challenge — Nhập CCCD + ID Tổ chức để lấy mã thử thách</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s1-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <!-- Hướng dẫn -->
        <div class="notice info">
          💡 Nhập số CCCD (12 chữ số) và <strong>ID Tổ chức</strong>. Khi đầu đọc hoạt động,
          số CCCD sẽ tự động điền từ dữ liệu NFC của thẻ.<br>
          Luồng này dùng cho cá nhân ký với tư cách đại diện <strong>Tổ chức</strong>.
        </div>

        <!-- Thẻ thông tin tổ chức -->
        <div style="background:var(--color-primary-dim);border:1px solid var(--color-primary);
          border-radius:var(--radius-md);padding:10px 14px;margin-bottom:16px;
          display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.4rem;">🏢</span>
          <div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--color-primary);">CTS Cá nhân thuộc Tổ chức</div>
            <div style="font-size:0.72rem;color:var(--text-secondary);">
              Endpoint: <code>/ca/api/eid-company/challenge</code> — Thêm tham số <code>company_id</code>
            </div>
          </div>
        </div>

        <!-- Form nhập liệu -->
        <div class="form-group">
          <label class="form-label" for="s1-cccd">
            Số Căn cước công dân
            <span>(12 chữ số)</span>
          </label>
          <input
            class="form-input"
            id="s1-cccd"
            type="text"
            maxlength="12"
            placeholder="001087012345"
            value="${this._state.idNumber || ""}"
          />
        </div>

        <!-- Chọn Tổ chức -->
        <div class="form-group">
          <label class="form-label">
            Tổ chức
            <span><code>company_id</code> sẽ được gửi kèm theo request</span>
          </label>

          <!-- Dropdown chọn tên công ty -->
          <select class="form-input" id="s1-company-select" style="margin-bottom:8px;">
            <option value="">— Chọn tổ chức từ danh sách —</option>
            ${DEMO_COMPANIES.map(c =>
              `<option value="${c.id}" ${(this._state.companyId === c.id) ? 'selected' : ''}>
                ${c.name}
              </option>`
            ).join('')}
            <option value="__manual__">✏️ Nhập ID thủ công...</option>
          </select>

          <!-- Thẻ hiển thị thông tin công ty đã chọn -->
          <div id="s1-company-card" style="
            background:var(--color-primary-dim);border:1px solid var(--color-primary);
            border-radius:var(--radius-md);padding:10px 14px;
            display:flex;align-items:center;gap:12px;
          ">
            <span style="font-size:1.2rem;">🏢</span>
            <div style="flex:1;min-width:0;">
              <div id="s1-company-name" style="font-weight:700;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">—</div>
              <div style="display:flex;gap:8px;margin-top:3px;align-items:center;">
                <span style="font-size:0.72rem;color:var(--text-muted);">company_id:</span>
                <code id="s1-company-id-display" style="font-size:0.82rem;color:var(--color-primary);font-weight:700;">—</code>
              </div>
            </div>
          </div>

          <!-- Input nhập thủ công (ẩn mặc định) -->
          <div id="s1-manual-wrap" style="display:none;margin-top:8px;">
            <label style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;display:block;">Nhập company_id thủ công:</label>
            <input
              class="form-input"
              id="s1-company-id"
              type="number"
              placeholder="Nhập ID số nguyên"
              value="${this._state.companyId || ''}"
              style="max-width:240px;"
            />
          </div>
        </div>

        <button class="btn btn-secondary" id="s1-btn-get" title="Lấy Challenge">
          Lấy Challenge
        </button>

        <!-- Code Panels: Request | Response -->
        <div id="s1-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    // Render code panels
    this._codePanels = renderCodePanels(
      this._el.querySelector("#s1-code-container"),
      { requestTitle: "POST /ca/api/eid-company/challenge" }
    );

    // Hiển thị request mẫu ngay
    this._updateRequestPanel();

    // Gắn sự kiện
    const btn        = this._el.querySelector("#s1-btn-get");
    const inp        = this._el.querySelector("#s1-cccd");
    const selectEl   = this._el.querySelector("#s1-company-select");
    const manualWrap = this._el.querySelector("#s1-manual-wrap");
    const manualInp  = this._el.querySelector("#s1-company-id");

    // Khởi tạo hiển thị công ty mặc định
    this._syncCompanyCard();

    inp.addEventListener("input", () => this._updateRequestPanel());

    // Khi chọn công ty từ dropdown
    selectEl.addEventListener("change", () => {
      const val = selectEl.value;
      if (val === "__manual__") {
        // Hiện ô nhập thủ công
        manualWrap.style.display = "block";
        this._el.querySelector("#s1-company-card").style.display = "none";
        this._state.companyId = parseInt(manualInp?.value) || null;
      } else if (val) {
        manualWrap.style.display = "none";
        this._el.querySelector("#s1-company-card").style.display = "flex";
        this._state.companyId = parseInt(val);
        this._syncCompanyCard();
      } else {
        manualWrap.style.display = "none";
        this._el.querySelector("#s1-company-card").style.display = "flex";
        this._state.companyId = null;
        this._syncCompanyCard();
      }
      this._updateRequestPanel();
    });

    // Khi nhập thủ công
    manualInp?.addEventListener("input", () => {
      this._state.companyId = parseInt(manualInp.value) || null;
      this._updateRequestPanel();
    });

    btn.addEventListener("click", () => this._run());
  }

  /**
   * Đồng bộ thẻ hiển thị tên + ID công ty.
   * Tìm trong DEMO_COMPANIES theo companyId hiện tại.
   */
  _syncCompanyCard() {
    const nameEl = this._el?.querySelector("#s1-company-name");
    const idEl   = this._el?.querySelector("#s1-company-id-display");
    const card   = this._el?.querySelector("#s1-company-card");
    if (!nameEl || !idEl) return;

    const cid  = this._state.companyId;
    const comp = DEMO_COMPANIES.find(c => c.id === cid);

    if (comp) {
      nameEl.textContent = comp.name;
      idEl.textContent   = String(comp.id);
      if (card) card.style.borderColor = "var(--color-primary)";
    } else if (cid) {
      nameEl.textContent = "Tổ chức ID: " + cid + " (không có trong danh sách mẫu)";
      idEl.textContent   = String(cid);
      if (card) card.style.borderColor = "var(--border)";
    } else {
      nameEl.textContent = "Chưa chọn tổ chức";
      idEl.textContent   = "—";
      if (card) card.style.borderColor = "var(--border)";
    }
  }

  /** Cập nhật panel hiển thị request JSON theo input */
  _updateRequestPanel() {
    const inp = this._el?.querySelector("#s1-cccd");
    this._codePanels.setRequest({
      code:       this._state.partnerCode,
      id_number:  inp?.value || "...",
      company_id: this._state.companyId || "...",
    });
  }

  /** Tự điền idNumber từ NFC data (gọi từ flow khi có card) */
  setIdFromCard(idNumber) {
    const inp = this._el?.querySelector("#s1-cccd");
    if (inp) inp.value = idNumber;
    this._state.idNumber = idNumber;
    this._updateRequestPanel();
  }

  /** Thực thi STEP 1 */
  async _run() {
    const idNumber  = this._el.querySelector("#s1-cccd").value.trim();
    const companyId = this._state.companyId;

    if (!idNumber || idNumber.length !== 12) {
      alert("Vui lòng nhập đúng 12 chữ số CCCD.");
      return;
    }
    if (!companyId) {
      alert("Vui lòng chọn hoặc nhập ID Tổ chức.");
      return;
    }

    this._state.idNumber  = idNumber;
    this._state.companyId = companyId;

    // Cập nhật UI: đang xử lý
    const btn   = this._el.querySelector("#s1-btn-get");
    const badge = this._el.querySelector("#s1-badge");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang gửi...`;
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";
    this._codePanels.setLoading();

    try {
      // ── Gọi API ──────────────────────────────────────────────────────────
      // companyGetChallenge() → POST /ca/api/eid-company/challenge
      // Thêm company_id so với luồng cá nhân thông thường
      const data = await companyGetChallenge(idNumber, companyId);
      // data = { transaction_code, token_challenge }
      // Lưu ý: không có trường `challenge` riêng — được embed trong token_challenge

      this._state.transactionCode = data.transaction_code;
      this._state.tokenChallenge  = data.token_challenge;
      // challenge được lấy từ socket khi ký AA (không cần lưu riêng từ API này)

      // Hiển thị response
      this._codePanels.setResponse(
        { success: true, error: null, data },
        "success"
      );

      // Cập nhật badge thành công
      badge.className = "step-status-badge badge-done";
      badge.textContent = "Hoàn thành";
      this._el.className = "step-card done";
      btn.innerHTML = "✓ Đã lấy Challenge";

      // Thông báo cho flow chuyển sang bước 2
      this._onDone(this._state);

    } catch (err) {
      // Hiển thị lỗi
      this._codePanels.setResponse(
        { success: false, error: { code: "ERROR", message: err.message }, data: null },
        "error"
      );
      badge.className = "step-status-badge badge-error";
      badge.textContent = "Lỗi";
      this._el.className = "step-card error";
      btn.disabled = false;
      btn.textContent = "Thử lại";
    }
  }
}
