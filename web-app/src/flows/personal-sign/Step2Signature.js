/**
 * Step2Signature.js — STEP 2: Gửi Selfie + Signature để xác nhận ký
 *
 * Gọi API: POST /ca/api/sign/signature
 *
 * Khác với luồng đăng ký (personal-onboarding):
 *  - Challenge để ký AA lấy từ docs[].doc_challenge (mỗi tài liệu 1 challenge)
 *  - Không cần gửi raw NFC data (sod, dg1, dg2...)
 *  - Chỉ cần: selfie + doc_signs[{doc_id, signature}]
 *
 * Input từ state:
 *   - transactionCode  — từ STEP 1
 *   - tokenSign        — từ STEP 1
 *   - docs[]           — [{doc_id, doc_name, doc_challenge}] từ STEP 1
 *
 * Output lưu vào state:
 *   - signedDocs[]     — [{doc_id, doc_name, ca_signature, sign_at}]
 *   - tokenSigned      — token để download
 */

import { renderCodePanels }  from "../../ui/CodePanel.js";
import { signSendSignature } from "../../api/eidcaClient.js";

export class Step2Signature {
  constructor(container, { state, socket, onDone }) {
    this._container = container;
    this._state = state;
    this._socket = socket;
    this._onDone = onDone;
    this._el = null;
    this._codePanels = null;
    // Map doc_id → signature (hỗ trợ nhiều tài liệu)
    this._docSignatures = {};
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "step-card disabled";
    this._el.id = "step-2-card";
    this._el.innerHTML = `
      <div class="step-card-header">
        <div class="step-num">2</div>
        <div class="step-card-title">
          <h3>Xác nhận Ký số</h3>
          <p>POST /ca/api/sign/signature — Ký challenge + gửi selfie để xác nhận</p>
        </div>
        <span class="step-status-badge badge-waiting" id="s2-badge">Đang chờ</span>
      </div>

      <div class="step-card-body">
        <div class="notice info" id="s2-notice">
          ⏳ Đang chờ hoàn thành STEP 1...
        </div>

        <!-- Danh sách tài liệu cần ký -->
        <div id="s2-docs-list" style="margin-bottom:14px;display:none;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
            TÀI LIỆU CẦN KÝ
          </div>
          <div id="s2-docs-items"></div>
        </div>

        <!-- Checklist -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          <div class="device-row" style="background:var(--bg-card-2);border-radius:8px;padding:10px 14px;">
            <span id="chk-aa">⬜</span>
            <div class="device-info">
              <div class="device-name">Chữ ký AA (Active Authentication)</div>
              <div class="device-sub">Ký doc_challenge trên chip thẻ CCCD</div>
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

        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary btn-sm" id="s2-btn-aa" disabled>
            🔑 Ký AA thủ công
          </button>
          <button class="btn btn-secondary btn-sm" id="s2-btn-selfie" disabled>
            📷 Chụp Selfie
          </button>
          <button class="btn btn-primary" id="s2-btn-send" disabled>
            ✍️ Xác nhận Ký
          </button>
        </div>

        <div id="s2-code-container"></div>
      </div>
    `;

    this._container.appendChild(this._el);

    this._codePanels = renderCodePanels(
      this._el.querySelector("#s2-code-container"),
      { requestTitle: "POST /ca/api/sign/signature" }
    );

    this._el.querySelector("#s2-btn-aa").addEventListener("click",     () => this._triggerAA());
    this._el.querySelector("#s2-btn-selfie").addEventListener("click", () => this._captureSelfie());
    this._el.querySelector("#s2-btn-send").addEventListener("click",   () => this._run());
  }

  /** Kích hoạt sau STEP 1 */
  activate() {
    this._el.className = "step-card active";
    const badge = this._el.querySelector("#s2-badge");
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang xử lý";

    const notice = this._el.querySelector("#s2-notice");
    notice.textContent = "✅ STEP 1 hoàn thành. Đặt thẻ CCCD vào đầu đọc để ký challenge.";
    notice.className = "notice success";

    // Hiển thị danh sách tài liệu
    this._renderDocsList();

    // Bật nút thủ công
    this._el.querySelector("#s2-btn-aa").disabled     = false;
    this._el.querySelector("#s2-btn-selfie").disabled = false;

    // Đăng ký nhận AA response từ socket
    this._socket.on.aaResponse = (event) => {
      if (event.id !== 7) return;
      const aaSignature = event.data.aa_signature;

      // Gán signature cho tất cả docs (1 challenge → 1 signature chung)
      this._state.docs?.forEach((doc) => {
        this._docSignatures[doc.doc_id] = aaSignature;
      });

      this._state.aaSignature = aaSignature;
      this._el.querySelector("#chk-aa").textContent = "✅";
      this._updateDocsList();
      this._tryAutoSend();
    };

    // Nếu đã có selfie từ socket webcam → check ngay
    if (this._state.selfieBase64) {
      this._el.querySelector("#chk-selfie").textContent = "✅";
    }

    // Tự động ký AA nếu thẻ đã đặt
    this._triggerAA();
  }

  /** Render danh sách tài liệu cần ký */
  _renderDocsList() {
    const docs = this._state.docs || [];
    if (!docs.length) return;

    const list    = this._el.querySelector("#s2-docs-list");
    const itemsEl = this._el.querySelector("#s2-docs-items");
    list.style.display = "block";

    itemsEl.innerHTML = docs.map((doc) => `
      <div class="device-row" id="doc-row-${doc.doc_id}"
        style="background:var(--bg-card-2);border-radius:8px;padding:10px 14px;margin-bottom:6px;">
        <span>📄</span>
        <div class="device-info">
          <div class="device-name">${doc.doc_name}</div>
          <div class="device-sub mono" style="font-size:0.68rem;">
            doc_id: ${doc.doc_id}
          </div>
          <div class="device-sub mono" style="font-size:0.65rem;margin-top:2px;">
            doc_challenge: ${(doc.doc_challenge || "").substring(0, 40)}...
          </div>
        </div>
        <span id="doc-sig-${doc.doc_id}" style="font-size:0.8rem;">⬜</span>
      </div>
    `).join("");
  }

  /** Cập nhật trạng thái ký từng tài liệu */
  _updateDocsList() {
    this._state.docs?.forEach((doc) => {
      const el = this._el.querySelector(`#doc-sig-${doc.doc_id}`);
      if (el && this._docSignatures[doc.doc_id]) {
        el.textContent = "✅";
      }
    });
  }

  /** Ký doc_challenge bằng chip thẻ CCCD (Active Authentication) */
  _triggerAA() {
    // Dùng doc_challenge của tài liệu đầu tiên làm challenge
    const challenge = this._state.docs?.[0]?.doc_challenge;
    if (!challenge) {
      alert("Chưa có doc_challenge từ STEP 1.");
      return;
    }
    this._socket.sendAA(challenge);
  }

  _captureSelfie() {
    const frame = this._state.getCurrentFrame?.();
    if (frame) {
      this._state.selfieBase64 = frame;
      this._el.querySelector("#chk-selfie").textContent = "✅";
      this._tryAutoSend();
    } else {
      alert("Webcam chưa có ảnh. Vui lòng kiểm tra kết nối.");
    }
  }

  _tryAutoSend() {
    const allDocsSignedl = this._state.docs?.every((d) => this._docSignatures[d.doc_id]);
    const hasSelfie      = !!this._state.selfieBase64;
    if (allDocsSignedl && hasSelfie) {
      this._el.querySelector("#s2-btn-send").disabled = false;
      this._updateRequestPanel();
    }
  }

  _updateRequestPanel() {
    const { transactionCode, tokenSign, selfieBase64, docs, partnerCode } = this._state;
    this._codePanels.setRequest({
      code:             partnerCode,
      transaction_code: transactionCode,
      token_sign:       tokenSign,
      info: {
        image: selfieBase64 ? selfieBase64.substring(0, 40) + "..." : "...",
      },
      doc_signs: (docs || []).map((doc) => ({
        doc_id:    doc.doc_id,
        signature: this._docSignatures[doc.doc_id]
          ? this._docSignatures[doc.doc_id].substring(0, 30) + "..."
          : "...",
      })),
    });
  }

  /** Thực thi STEP 2 */
  async _run() {
    const btn   = this._el.querySelector("#s2-btn-send");
    const badge = this._el.querySelector("#s2-badge");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Đang gửi...`;
    badge.className = "step-status-badge badge-processing";
    badge.textContent = "Đang ký";
    this._codePanels.setLoading();

    const { transactionCode, tokenSign, selfieBase64, docs } = this._state;

    try {
      // ── Gọi API ──────────────────────────────────────────────────────────
      // signSendSignature() → POST /ca/api/sign/signature
      const data = await signSendSignature({
        transactionCode,
        tokenSign,
        selfieBase64,
        docSigns: (docs || []).map((doc) => ({
          doc_id:    doc.doc_id,
          signature: this._docSignatures[doc.doc_id] || "",
        })),
      });
      // data = { status, token, interval, expired_at, signed_docs[] }

      // Lưu vào state để STEP 3 download
      this._state.signedDocs  = data.signed_docs;
      this._state.tokenSigned = data.token;

      this._codePanels.setResponse({ success: true, error: null, data }, "success");

      badge.className = "step-status-badge badge-done";
      badge.textContent = "Đã ký";
      this._el.className = "step-card done";
      btn.innerHTML = "✓ Đã xác nhận";

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

  setSelfie(base64) {
    this._state.selfieBase64 = base64;
    this._el.querySelector("#chk-selfie").textContent = "✅";
    this._tryAutoSend();
  }
}
