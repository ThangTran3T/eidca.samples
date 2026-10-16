/**
 * Step1Challenge.js — STEP 1: Lấy Challenge
 *
 * Gọi API: POST /ca/api/eid-personal/challenge
 *
 * Input:
 *   - id_number (Số CCCD 12 chữ số) — tự điền từ dữ liệu NFC hoặc nhập tay
 *   - code (Partner code — từ config)
 *
 * Output lưu vào state:
 *   - transaction_code
 *   - challenge (Base64, dùng để ký AA)
 *   - token_challenge (JWT, gửi lại ở STEP 2)
 */

import { renderCodePanels } from "../../ui/CodePanel.js";
import { personalGetChallenge } from "../../api/eidcaClient.js";

export class Step1Challenge {
  /**
   * @param {HTMLElement} container - Nơi render bước này
   * @param {object} opts
   * @param {object} opts.state     - State dùng chung của flow
   * @param {function} opts.onDone  - Callback khi bước hoàn thành (nhận state)
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
          <p>POST /ca/api/eid-personal/challenge — Nhập CCCD để lấy mã thử thách</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s1-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <!-- Hướng dẫn -->
        <div class="notice info">
          💡 Nhập số CCCD (12 chữ số). Khi đầu đọc hoạt động, số CCCD sẽ tự động điền
          từ dữ liệu NFC của thẻ.
        </div>

        <!-- Form nhập CCCD -->
        <div class="form-group">
          <label class="form-label" for="s1-cccd">
            Số Căn cước công dân
            <span>(12 chữ số)</span>
          </label>
          <div style="display:flex;gap:8px;">
            <input
              class="form-input"
              id="s1-cccd"
              type="text"
              maxlength="12"
              placeholder="001087012345"
              value="${this._state.idNumber || ""}"
            />
            <button class="btn btn-secondary" id="s1-btn-get" title="Lấy Challenge">
              Lấy Challenge
            </button>
          </div>
        </div>

        <!-- Code Panels: Request | Response -->
        <div id="s1-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    // Render code panels
    this._codePanels = renderCodePanels(
      this._el.querySelector("#s1-code-container"),
      { requestTitle: "POST /ca/api/eid-personal/challenge" }
    );

    // Hiển thị request mẫu ngay
    this._updateRequestPanel(this._state.idNumber || "001087012345");

    // Gắn sự kiện
    const btn  = this._el.querySelector("#s1-btn-get");
    const inp  = this._el.querySelector("#s1-cccd");
    inp.addEventListener("input", () => this._updateRequestPanel(inp.value));
    btn.addEventListener("click", () => this._run());
  }

  /** Cập nhật panel hiển thị request JSON theo input */
  _updateRequestPanel(idNumber) {
    this._codePanels.setRequest({
      code: this._state.partnerCode,
      id_number: idNumber || "...",
    });
  }

  /** Tự điền idNumber từ NFC data (gọi từ flow khi có card) */
  setIdFromCard(idNumber) {
    const inp = this._el?.querySelector("#s1-cccd");
    if (inp) inp.value = idNumber;
    this._state.idNumber = idNumber;
    this._updateRequestPanel(idNumber);
  }

  /** Thực thi STEP 1 */
  async _run() {
    const idNumber = this._el.querySelector("#s1-cccd").value.trim();
    if (!idNumber || idNumber.length !== 12) {
      alert("Vui lòng nhập đúng 12 chữ số CCCD.");
      return;
    }

    this._state.idNumber = idNumber;

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
      // personalGetChallenge() → POST /ca/api/eid-personal/challenge
      // Hàm này được định nghĩa trong src/api/eidcaClient.js
      const data = await personalGetChallenge(idNumber);
      // data = { transaction_code, challenge, token_challenge }

      // Lưu vào state để dùng ở bước tiếp theo
      this._state.transactionCode  = data.transaction_code;
      this._state.challenge         = data.challenge;
      this._state.tokenChallenge    = data.token_challenge;

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
