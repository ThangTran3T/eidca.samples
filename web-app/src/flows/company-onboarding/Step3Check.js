/**
 * Step3Check.js — STEP 3: Kiểm tra trạng thái cấp CTS (Polling) — Cá nhân thuộc Tổ chức
 *
 * Gọi API: POST /ca/api/eid-company/check (lặp lại mỗi interval ms)
 *
 * Tương tự Step3Check của cá nhân, chỉ khác endpoint.
 *
 * Input từ state:
 *   - transactionCode  — từ STEP 1/2
 *   - tokenSignature   — từ STEP 2
 *   - interval         — ms (mặc định 3000ms)
 *
 * Logic poll:
 *   - status = "processing" → tiếp tục poll
 *   - status = "completed"  → dừng, hiển thị thông tin CTS
 *   - status = "failed"     → dừng, hiển thị lỗi
 */

import { renderCodePanels } from "../../ui/CodePanel.js";
import { companyCheckStatus } from "../../api/eidcaClient.js";

export class Step3Check {
  constructor(container, { state, onDone }) {
    this._container = container;
    this._state = state;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
    this._pollTimer = null;
    this._pollCount = 0;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card disabled";
    this._el.id = "step-3-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">3</div>
        <div class="step-card-title">
          <h3>Chờ cấp Chứng thư số</h3>
          <p>POST /ca/api/eid-company/check — Kiểm tra trạng thái định kỳ</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s3-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <!-- Poll progress -->
        <div class="poll-progress hidden" id="poll-progress">
          <div class="poll-label">
            <span>Đang xử lý cấp CTS tổ chức...</span>
            <span id="poll-count">Poll #0</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="poll-bar"></div>
          </div>
          <div class="text-muted text-sm" id="poll-interval-label" style="margin-top:6px;">
            Kiểm tra lại mỗi <span id="poll-interval-val">5</span>s
          </div>
        </div>

        <!-- Kết quả CTS -->
        <div id="cts-result-section" class="hidden"></div>

        <!-- Nút dừng poll -->
        <div style="margin-bottom:16px;">
          <button class="btn btn-ghost btn-sm hidden" id="s3-btn-stop">
            ⏹ Dừng kiểm tra
          </button>
        </div>

        <!-- Code Panels -->
        <div id="s3-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    this._codePanels = renderCodePanels(
      this._el.querySelector("#s3-code-container"),
      { requestTitle: "POST /ca/api/eid-company/check" }
    );

    this._el.querySelector("#s3-btn-stop").addEventListener("click", () => this._stopPoll());
  }

  /** Kích hoạt polling (sau khi STEP 2 hoàn thành) */
  activate() {
    this._el.className = "step-card active";
    const badge = this._el.querySelector("#s3-badge");
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";

    this._el.querySelector("#poll-progress").classList.remove("hidden");
    this._el.querySelector("#s3-btn-stop").classList.remove("hidden");

    const intervalSec = 5;
    this._el.querySelector("#poll-interval-val").textContent = intervalSec;

    this._startPoll();
  }

  _startPoll() {
    this._poll(); // Gọi ngay lần đầu
    this._pollTimer = setInterval(() => this._poll(), 5000);
  }

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  /** Một lần poll /check */
  async _poll() {
    if (this._pollCount >= 100) {
      this._stopPoll();
      const badge = this._el.querySelector("#s3-badge");
      badge.className = "step-status-badge badge-error";
      badge.textContent = "Thử lại";
      badge.style.cursor = "pointer";

      badge.onclick = () => {
        badge.onclick = null;
        badge.style.cursor = "";
        badge.className = "step-status-badge badge-processing";
        badge.textContent = "Đang xử lý";
        this._pollCount = 0;
        this._startPoll();
      };

      this._el.querySelector("#poll-count").textContent = `Vượt quá giới hạn (100 lần)`;
      this._codePanels.setResponse(
        { success: false, error: { code: "TIMEOUT", message: "Quá thời gian chờ cấp CTS. Vui lòng thử lại." }, data: null },
        "error"
      );
      return;
    }

    this._pollCount++;
    this._el.querySelector("#poll-count").textContent = `Poll #${this._pollCount}`;

    const requestBody = {
      code:            this._state.partnerCode,
      transaction_code: this._state.transactionCode,
      token_signature:  this._state.tokenSignature,
    };

    this._codePanels.setRequest(requestBody);
    this._codePanels.setLoading();

    try {
      // ── Gọi API ──────────────────────────────────────────────────────────
      // companyCheckStatus() → POST /ca/api/eid-company/check
      const data = await companyCheckStatus(
        this._state.transactionCode,
        this._state.tokenSignature
      );
      // data = { status, cert_info? }

      const response = { success: true, error: null, data };

      if (data.status === "completed") {
        this._stopPoll();
        this._codePanels.setResponse(response, "success");
        this._showCTSResult(data.cert_info);

        const badge = this._el.querySelector("#s3-badge");
        badge.className = "step-status-badge badge-done";
        badge.textContent = "Hoàn thành";
        this._el.className = "step-card done";
        this._el.querySelector("#poll-progress").classList.add("hidden");
        this._el.querySelector("#s3-btn-stop").classList.add("hidden");

        this._state.certInfo = data.cert_info;
        this._onDone?.(this._state);

      } else if (data.status === "failed") {
        this._stopPoll();
        this._codePanels.setResponse(response, "error");

        const badge = this._el.querySelector("#s3-badge");
        badge.className = "step-status-badge badge-error";
        badge.textContent = "Thất bại";
        this._el.className = "step-card error";

        const section = this._el.querySelector("#cts-result-section");
        section.classList.remove("hidden");
        section.innerHTML = `
          <div class="notice error">
            ❌ Cấp CTS thất bại. Vui lòng thử lại từ đầu.
          </div>
        `;

      } else {
        // Processing — tiếp tục poll
        this._codePanels.setResponse(response, "processing");
      }

    } catch (err) {
      this._codePanels.setResponse(
        { success: false, error: { code: "ERROR", message: err.message }, data: null },
        "error"
      );
      // Không dừng poll khi lỗi mạng tạm thời
    }
  }

  /** Render thông tin CTS khi completed */
  _showCTSResult(certInfo) {
    const section = this._el.querySelector("#cts-result-section");
    section.classList.remove("hidden");
    section.innerHTML = `
      <div class="cts-result">
        <div class="cts-header">
          <div class="cts-icon">🎉</div>
          <div>
            <div class="cts-title">Đăng ký Chứng thư số Tổ chức thành công!</div>
            <div class="cts-sub">CTS cá nhân thuộc tổ chức đã được cấp và kích hoạt</div>
          </div>
        </div>
        <div class="cts-fields">
          <div class="cts-field">
            <div class="field-key">Số seri CTS</div>
            <div class="field-value">${certInfo?.serial_number || "—"}</div>
          </div>
          <div class="cts-field">
            <div class="field-key">Số CCCD</div>
            <div class="field-value">${certInfo?.id_number || "—"}</div>
          </div>
          <div class="cts-field">
            <div class="field-key">Họ tên</div>
            <div class="field-value">${certInfo?.full_name || "—"}</div>
          </div>
          <div class="cts-field">
            <div class="field-key">Email</div>
            <div class="field-value">${certInfo?.email || "—"}</div>
          </div>
          <div class="cts-field">
            <div class="field-key">Ngày cấp</div>
            <div class="field-value">${certInfo?.date_issue || "—"}</div>
          </div>
          <div class="cts-field">
            <div class="field-key">Hết hạn</div>
            <div class="field-value">${certInfo?.date_expire || "—"}</div>
          </div>
        </div>
      </div>
    `;
  }
}
