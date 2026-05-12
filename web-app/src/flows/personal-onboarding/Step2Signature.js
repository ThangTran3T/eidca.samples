/**
 * Step2Signature.js — STEP 2: Gửi Signature + NFC data + Selfie
 *
 * Gọi API: POST /ca/api/eid-personal/signature
 *
 * Dữ liệu cần có từ bước trước và từ thiết bị:
 *   - state.transactionCode  — từ STEP 1
 *   - state.tokenChallenge   — từ STEP 1
 *   - state.challenge        — từ STEP 1, dùng để ký AA trên chip thẻ
 *   - state.rawData          — { sod, dg1, dg2, dg13, dg15 } từ NFC (id:4)
 *   - state.signature        — aa_signature từ chip thẻ (id:7)
 *   - state.selfieBase64     — Ảnh selfie từ webcam
 *
 * Output lưu vào state:
 *   - token_signature   (dùng cho STEP 3)
 *   - interval          (ms, dùng để poll STEP 3)
 */

import { renderCodePanels } from "../../ui/CodePanel.js";
import { personalSendSignature } from "../../api/eidcaClient.js";

export class Step2Signature {
  constructor(container, { state, socket, onDone }) {
    this._container = container;
    this._state = state;
    this._socket = socket;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
    this._aaWaiting = false;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card disabled";
    this._el.id = "step-2-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">2</div>
        <div class="step-card-title">
          <h3>Xác thực NFC + Selfie</h3>
          <p>POST /ca/api/eid-personal/signature — Gửi dữ liệu thẻ, ảnh và chữ ký</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s2-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <!-- Checklist dữ liệu cần thu thập -->
        <div class="notice info" id="s2-notice">
          ⏳ Đang chờ hoàn thành STEP 1...
        </div>

        <!-- Checklist items -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          <div class="device-row" style="background:var(--bg-card-2);border-radius:8px;padding:10px 14px;">
            <span id="chk-nfc">⬜</span>
            <div class="device-info">
              <div class="device-name">Dữ liệu NFC (DG1, DG2, SOD...)</div>
              <div class="device-sub">Đọc từ đầu đọc thẻ CCCD</div>
            </div>
          </div>
          <div class="device-row" style="background:var(--bg-card-2);border-radius:8px;padding:10px 14px;">
            <span id="chk-aa">⬜</span>
            <div class="device-info">
              <div class="device-name">Chữ ký AA (Active Authentication)</div>
              <div class="device-sub">Ký challenge trên chip thẻ</div>
            </div>
          </div>
          <div class="device-row" style="background:var(--bg-card-2);border-radius:8px;padding:10px 14px;">
            <span id="chk-selfie">⬜</span>
            <div class="device-info">
              <div class="device-name">Ảnh selfie từ webcam</div>
              <div class="device-sub">Chụp tự động từ webcam</div>
            </div>
          </div>
        </div>

        <!-- Nút thủ công (nếu cần) -->
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary btn-sm" id="s2-btn-aa" disabled>
            🔑 Ký AA thủ công
          </button>
          <button class="btn btn-secondary btn-sm" id="s2-btn-selfie" disabled>
            📷 Chụp Selfie
          </button>
          <button class="btn btn-primary" id="s2-btn-send" disabled>
            Gửi Xác thực
          </button>
        </div>

        <!-- Code Panels: Request | Response -->
        <div id="s2-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    this._codePanels = renderCodePanels(
      this._el.querySelector("#s2-code-container"),
      { requestTitle: "POST /ca/api/eid-personal/signature" }
    );

    // Gắn sự kiện nút
    this._el.querySelector("#s2-btn-aa").addEventListener("click", () => this._triggerAA());
    this._el.querySelector("#s2-btn-selfie").addEventListener("click", () => this._captureSelfie());
    this._el.querySelector("#s2-btn-send").addEventListener("click", () => this._run());
  }

  /**
   * Kích hoạt bước này (sau khi STEP 1 hoàn thành).
   * Tự động ký AA và chụp selfie nếu thiết bị đã sẵn sàng.
   */
  activate() {
    this._el.className = "step-card active";

    const notice = this._el.querySelector("#s2-notice");
    notice.textContent = "✅ STEP 1 hoàn thành. Đang thu thập dữ liệu thiết bị...";
    notice.className = "notice success";

    // Cập nhật badge
    const badge = this._el.querySelector("#s2-badge");
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";

    // Bật nút thủ công
    this._el.querySelector("#s2-btn-aa").disabled = false;
    this._el.querySelector("#s2-btn-selfie").disabled = false;

    // Đăng ký nhận AA response từ socket.on
    this._socket.on.aaResponse = (event) => {
      if (event.id === 7) {
        this._state.signature = event.data.aa_signature;
        this._el.querySelector("#chk-aa").textContent = "✅";
        this._tryAutoSend();
      }
    };

    // Nếu đã có dữ liệu NFC từ STEP trước → tự động ký AA
    if (this._state.rawData) {
      this._el.querySelector("#chk-nfc").textContent = "✅";
      this._triggerAA();
    }

    // Nếu webcam đang stream → chụp selfie
    if (this._state.selfieBase64) {
      this._el.querySelector("#chk-selfie").textContent = "✅";
    }
  }

  /** Gọi socket để ký challenge bằng chip thẻ (Active Authentication) */
  _triggerAA() {
    if (!this._state.challenge) return;
    this._aaWaiting = true;
    this._socket.sendAA(this._state.challenge);
  }

  /** Chụp frame ảnh từ webcam */
  _captureSelfie() {
    // Lấy frame hiện tại từ DevicePanel (qua state)
    const frame = this._state.getCurrentFrame?.() || this._state.selfieBase64;
    if (frame) {
      this._state.selfieBase64 = frame;
      this._el.querySelector("#chk-selfie").textContent = "✅";
      this._tryAutoSend();
    } else {
      alert("Webcam chưa có ảnh. Vui lòng kiểm tra kết nối webcam.");
    }
  }

  /** Nếu đủ 3 điều kiện → tự động bật nút gửi */
  _tryAutoSend() {
    const hasNfc    = !!this._state.rawData;
    const hasAA     = !!this._state.signature;
    const hasSelfie = !!this._state.selfieBase64;

    if (hasNfc && hasAA && hasSelfie) {
      this._el.querySelector("#s2-btn-send").disabled = false;
      this._updateRequestPanel();
    }
  }

  /** Cập nhật request panel với dữ liệu thực tế */
  _updateRequestPanel() {
    const { transactionCode, tokenChallenge, rawData, selfieBase64, signature, partnerCode } = this._state;
    this._codePanels.setRequest({
      code: partnerCode,
      transaction_code: transactionCode,
      token_challenge: tokenChallenge,
      raw_data: {
        sod:  rawData?.sod  || "...",
        dg1:  rawData?.dg1  || "...",
        dg2:  rawData?.dg2  || "...",
        dg13: rawData?.dg13 || "...",
        dg15: rawData?.dg15 || "...",
      },
      info: {
        ip_address:           "192.168.1.x",
        machine_name:         navigator.userAgent.split(" ")[0],
        machine_type:         "Desktop",
        operating_system:     navigator.platform,
        version:              "1.0",
        serial_device:        this._state.deviceInfo?.serial_device || "SN-DEMO",
        permanent_city:       "HN",
        permanent_district:   "Hà Nội",
        phone:                this._state.phone || "",
        email:                this._state.email || "",
        image:                selfieBase64 ? selfieBase64.substring(0, 40) + "..." : "...",
        hand_sig_image_base64:"...",
      },
      signature: signature || "...",
    });
  }

  /** Thực thi STEP 2 */
  async _run() {
    const btn   = this._el.querySelector("#s2-btn-send");
    const badge = this._el.querySelector("#s2-badge");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang gửi...`;
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang gửi";
    this._codePanels.setLoading();

    const { transactionCode, tokenChallenge, rawData, selfieBase64, signature, deviceInfo, partnerCode } = this._state;

    try {
      // ── Gọi API ──────────────────────────────────────────────────────────
      // personalSendSignature() → POST /ca/api/eid-personal/signature
      const data = await personalSendSignature({
        transactionCode,
        tokenChallenge,
        rawData: {
          sod:  rawData.sod,
          dg1:  rawData.dg1,
          dg2:  rawData.dg2,
          dg13: rawData.dg13,
          dg15: rawData.dg15,
        },
        info: {
          ip_address:           "192.168.1.x",
          machine_name:         navigator.userAgent.split(" ")[0],
          machine_type:         "Desktop",
          operating_system:     navigator.platform,
          version:              "1.0",
          serial_device:        deviceInfo?.serial_device || "SN-DEMO",
          permanent_city:       "HN",
          permanent_district:   "Hà Nội",
          phone:                this._state.phone || "",
          email:                this._state.email || "",
          image:                selfieBase64,
          hand_sig_image_base64: "",
        },
        signature,
      });
      // data = { transaction_code, status, interval, expired_at, token_signature }

      // Lưu vào state để STEP 3 dùng
      this._state.tokenSignature = data.token_signature;
      this._state.interval       = parseInt(data.interval) || 3000;

      this._codePanels.setResponse({ success: true, error: null, data }, "success");

      badge.className = "step-status-badge badge-done";
      badge.textContent = "Hoàn thành";
      this._el.className = "step-card done";
      btn.innerHTML = "✓ Đã gửi";

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

  /** Cập nhật từ DevicePanel khi NFC data ready */
  setRawData(rawData) {
    this._state.rawData = rawData;
    this._el.querySelector("#chk-nfc").textContent = "✅";
    this._tryAutoSend();
  }

  /** Cập nhật selfie từ DevicePanel */
  setSelfie(base64) {
    this._state.selfieBase64 = base64;
    this._el.querySelector("#chk-selfie").textContent = "✅";
    this._tryAutoSend();
  }
}
