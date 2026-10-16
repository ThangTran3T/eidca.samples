/**
 * Step2Signature.js — STEP 2: Gửi Selfie + Signature để xác nhận ký (Cá nhân thuộc Tổ chức)
 *
 * Gọi API: POST /ca/api/sign-company/signature
 *
 * Tương tự personal-sign/Step2Signature nhưng:
 *   - Gọi signCompanySendSignature() thay vì signSendSignature()
 *   - Endpoint: /ca/api/sign-company/signature
 *
 * Tái sử dụng toàn bộ UI từ personal-sign/Step2Signature và override _run().
 */

import { Step2Signature as PersonalStep2Signature } from "../personal-sign/Step2Signature.js";
import { signCompanySendSignature } from "../../api/eidcaClient.js";

export class Step2Signature extends PersonalStep2Signature {
  /**
   * Override mount() để cập nhật endpoint label
   */
  mount() {
    super.mount();

    // Cập nhật tiêu đề endpoint trong step-card-title
    const title = this._el.querySelector(".step-card-title p");
    if (title) {
      title.textContent = "POST /ca/api/sign-company/signature — Ký challenge + gửi selfie (Tổ chức)";
    }

    // Cập nhật title trong CodePanel
    const cpReqTitle = this._el.querySelector(".code-panel-title.request");
    if (cpReqTitle) {
      cpReqTitle.textContent = "▶ POST /ca/api/sign-company/signature";
    }
  }

  /**
   * Override _run() để gọi đúng endpoint sign-company/signature
   */
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
      // signCompanySendSignature() → POST /ca/api/sign-company/signature
      // Payload tương tự luồng cá nhân
      const data = await signCompanySendSignature({
        transaction_code: transactionCode,
        token_sign:       tokenSign,
        info:             { image: selfieBase64 },
        doc_signs: (docs || []).map((doc) => ({
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
}
