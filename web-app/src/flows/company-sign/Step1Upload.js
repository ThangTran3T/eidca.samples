/**
 * Step1Upload.js — STEP 1: Upload tài liệu & lấy doc_challenge (Cá nhân thuộc Tổ chức)
 *
 * Gọi API: POST /ca/api/sign-company/challenge  (multipart/form-data)
 *
 * Khác với cá nhân thông thường:
 *   - Có thêm tham số `company_id` trong FormData
 *   - Endpoint: /ca/api/sign-company/challenge (thay vì /ca/api/sign/challenge)
 *   - Response trả về field `challenge` thay vì `doc_challenge` trong mỗi doc
 *
 * Tái sử dụng toàn bộ UI (PDF preview, sign_props) từ personal-sign/Step1Upload,
 * override mount() để thêm company selector và override _run() để gọi đúng endpoint.
 */

// Danh sách tổ chức mẫu — dùng chung với company-onboarding
const DEMO_COMPANIES = [
  { id: 1001, name: "CÔNG TY TNHH CÔNG NGHỆ ABC",          tax: "0123456789" },
  { id: 1002, name: "CÔNG TY CỔ PHẦN XYZ VIỆT NAM",         tax: "0987654321" },
  { id: 2001, name: "NGÂN HÀNG TMCP DEMO BANK",             tax: "0112233445" },
  { id: 3005, name: "TẬP ĐOÀN BẢO HIỂM AN KHANG",           tax: "0556677889" },
];

import { Step1Upload as PersonalStep1Upload } from "../personal-sign/Step1Upload.js";
import { signCompanyGetChallenge } from "../../api/eidcaClient.js";

export class Step1Upload extends PersonalStep1Upload {
  constructor(container, { state, onDone }) {
    super(container, { state, onDone });
  }

  /**
   * Override mount() để:
   *  1. Cập nhật tiêu đề endpoint
   *  2. Thêm phần chọn Tổ chức (dropdown + thẻ tên công ty)
   *  3. Cập nhật notice
   */
  mount() {
    super.mount();

    // 1. Cập nhật tiêu đề endpoint trong step-card-title
    const title = this._el.querySelector(".step-card-title p");
    if (title) {
      title.textContent = "POST /ca/api/sign-company/challenge — Tải tài liệu lên để lấy challenge ký (Tổ chức)";
    }

    // 2. Cập nhật title trong CodePanel
    const cpReqTitle = this._el.querySelector(".code-panel-title.request");
    if (cpReqTitle) {
      cpReqTitle.textContent = "▶ POST /ca/api/sign-company/challenge  (multipart/form-data)";
    }

    // 3. Thêm phần chọn Tổ chức sau form CCCD
    const cccdGroup = this._el.querySelector(".form-group");
    if (cccdGroup) {
      const companyGroup = document.createElement("div");
      companyGroup.className = "form-group";
      companyGroup.style.marginTop = "10px";
      companyGroup.innerHTML = `
        <label class="form-label">
          Tổ chức
          <span><code>company_id</code> sẽ được gửi kèm theo request</span>
        </label>

        <!-- Dropdown chọn tên công ty -->
        <select class="form-input" id="s1-company-select" style="margin-bottom:8px;">
          <option value="">— Chọn tổ chức từ danh sách —</option>
          ${DEMO_COMPANIES.map(c =>
            `<option value="${c.id}">${c.name}</option>`
          ).join('')}
          <option value="__manual__">✏️ Nhập ID thủ công...</option>
        </select>

        <!-- Thẻ hiển thị thông tin công ty đã chọn -->
        <div id="s1-company-card" style="
          background:var(--color-primary-dim);border:1px solid var(--border);
          border-radius:var(--radius-md);padding:10px 14px;
          display:flex;align-items:center;gap:12px;
        ">
          <span style="font-size:1.2rem;">🏢</span>
          <div style="flex:1;min-width:0;">
            <div id="s1-company-name" style="font-weight:700;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Chưa chọn tổ chức</div>
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
            style="max-width:240px;"
          />
        </div>
      `;
      cccdGroup.after(companyGroup);

      // Gắn sự kiện dropdown
      const selectEl   = companyGroup.querySelector("#s1-company-select");
      const manualWrap = companyGroup.querySelector("#s1-manual-wrap");
      const manualInp  = companyGroup.querySelector("#s1-company-id");
      const card       = companyGroup.querySelector("#s1-company-card");
      const nameEl     = companyGroup.querySelector("#s1-company-name");
      const idEl       = companyGroup.querySelector("#s1-company-id-display");

      const syncCard = () => {
        const cid  = this._state.companyId;
        const comp = DEMO_COMPANIES.find(c => c.id === cid);
        if (comp) {
          nameEl.textContent = comp.name;
          idEl.textContent   = String(comp.id);
          card.style.borderColor = "var(--color-primary)";
        } else if (cid) {
          nameEl.textContent = "Tổ chức ID: " + cid;
          idEl.textContent   = String(cid);
          card.style.borderColor = "var(--border)";
        } else {
          nameEl.textContent = "Chưa chọn tổ chức";
          idEl.textContent   = "—";
          card.style.borderColor = "var(--border)";
        }
      };

      selectEl.addEventListener("change", () => {
        const val = selectEl.value;
        if (val === "__manual__") {
          manualWrap.style.display = "block";
          card.style.display = "none";
          this._state.companyId = parseInt(manualInp?.value) || null;
        } else if (val) {
          manualWrap.style.display = "none";
          card.style.display = "flex";
          this._state.companyId = parseInt(val);
          syncCard();
        } else {
          manualWrap.style.display = "none";
          card.style.display = "flex";
          this._state.companyId = null;
          syncCard();
        }
      });

      manualInp?.addEventListener("input", (e) => {
        this._state.companyId = parseInt(e.target.value) || null;
      });
    }

    // 4. Cập nhật notice
    const notice = this._el.querySelector(".notice.info");
    if (notice) {
      notice.innerHTML = `
        💡 Chọn file PDF/PNG/JPG cần ký số và chọn <strong>Tổ chức</strong>.
        API sẽ trả về <code>challenge</code> dùng để ký trên chip thẻ CCCD ở bước tiếp theo.<br>
        <span style="font-size:0.75rem;color:var(--text-muted);">
          🏢 Endpoint: <code>/ca/api/sign-company/challenge</code> — Thêm <code>company_id</code> so với luồng cá nhân
        </span>
      `;
    }
  }

  /**
   * Override _run() để gọi đúng endpoint sign-company/challenge và thêm company_id
   */
  async _run() {
    const idNumber  = this._el.querySelector("#s1-cccd").value.trim();
    const companyId = this._state.companyId;

    if (!idNumber || idNumber.length !== 12) {
      alert("Vui lòng nhập đúng 12 chữ số CCCD.");
      return;
    }
    if (!companyId) {
      alert("Vui lòng chọn Tổ chức.");
      return;
    }
    if (!this._selectedFile && !this._state.isMock) {
      alert("Vui lòng chọn file cần ký.");
      return;
    }

    this._state.idNumber  = idNumber;
    this._state.companyId = companyId;

    const btn   = this._el.querySelector("#s1-btn-upload");
    const badge = this._el.querySelector("#s1-badge");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang upload...`;
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";
    this._codePanels.setLoading();

    try {
      // ── Tạo FormData ──────────────────────────────────────────────────────
      // signCompanyGetChallenge() → POST /ca/api/sign-company/challenge
      // Thêm company_id so với luồng cá nhân
      const formData = new FormData();

      const filesToUpload = this._files.length ? this._files : [
        new File(["%PDF-1.4 MOCK_DOCUMENT_CONTENT"], "tai-lieu-to-chuc-mau.pdf", { type: "application/pdf" })
      ];
      filesToUpload.forEach(f => formData.append("documents", f));
      formData.append("id_number",     idNumber);
      formData.append("company_id",    String(companyId));   // Thêm company_id
      formData.append("sign_props",    JSON.stringify(this._getSignProps()));
      formData.append("security_level","LEVEL_2");

      const data = await signCompanyGetChallenge(formData);
      // data = { transaction_code, token_sign, docs[{doc_id, doc_name, challenge}] }
      // Normalize field `challenge` → `doc_challenge` để tương thích với Step2Signature
      if (data.docs) {
        data.docs = data.docs.map(doc => ({
          ...doc,
          doc_challenge: doc.doc_challenge || doc.challenge || "",
        }));
      }

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
