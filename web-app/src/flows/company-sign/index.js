/**
 * index.js — Luồng Ký số Cá nhân thuộc Tổ chức
 * Route: /personal-company-sign
 *
 * Điều phối 3 bước:
 *   STEP 1: Step1Upload    — Upload tài liệu + company_id → lấy challenge
 *   STEP 2: Step2Signature — Ký AA + gửi selfie → xác nhận ký
 *   STEP 3: Step3Download  — Download file PDF đã ký (dùng chung endpoint)
 *
 * Khác với cá nhân thông thường:
 *   - STEP 1 có thêm tham số `company_id` và dùng endpoint /sign-company/challenge
 *   - STEP 2 dùng endpoint /sign-company/signature
 *   - STEP 3 dùng chung /sign/download/{doc-id} (không đổi)
 *
 * State dùng chung:
 *   idNumber, companyId, partnerCode,
 *   transactionCode, tokenSign,
 *   docs[{doc_id, doc_name, doc_challenge}],
 *   aaSignature, selfieBase64,
 *   signedDocs[{doc_id, doc_name, ca_signature, sign_at}],
 *   tokenSigned
 */

import { Step1Upload }    from "./Step1Upload.js";
import { Step2Signature } from "./Step2Signature.js";
import { Step3Download }  from "../personal-sign/Step3Download.js"; // Dùng chung

export function mountCompanySign(container, { socket, modeConfig, getFrame, pauseWebcam, resumeWebcam }) {
  container.innerHTML = "";

  // ── Shared state ──────────────────────────────────────────────────────────
  const state = {
    partnerCode: modeConfig.partnerCode,
    idNumber:    "",
    companyId:   1,      // ID tổ chức — nhập thủ công

    // STEP 1 output
    transactionCode: "",
    tokenSign:       "",
    docs:            [],  // [{doc_id, doc_name, doc_challenge}]
    selectedFile:    null,

    // STEP 2 output
    aaSignature:  "",
    selfieBase64: "",
    signedDocs:   [],     // [{doc_id, doc_name, ca_signature, sign_at, doc_hash}]
    tokenSigned:  "",

    // Helpers
    isMock:          modeConfig.isMock,
    getCurrentFrame: getFrame || (() => null),
    pauseWebcam:     pauseWebcam || (() => {}),
    resumeWebcam:    resumeWebcam || (() => {}),
  };

  // ── Hero ─────────────────────────────────────────────────────────────────
  const hero = document.createElement("div");
  hero.className = "flow-hero";
  hero.innerHTML = `
    <div class="flow-title">Ký số Cá nhân thuộc Tổ chức</div>
    <div class="flow-desc">
      Minh họa luồng ký tài liệu sử dụng Chứng thư số cá nhân <strong>gắn với tổ chức</strong>.
      Thêm tham số <code>company_id</code> và dùng endpoint <code>/sign-company/</code> riêng biệt.
      Download file đã ký dùng chung endpoint <code>/sign/download/</code>.
    </div>
    <div class="flow-tags">
      <span class="flow-tag" style="background:rgba(124,58,237,0.15);color:#a78bfa;border-color:rgba(124,58,237,0.3);">🏢 Tổ chức</span>
      <span class="flow-tag method-post">POST /sign-company/challenge</span>
      <span class="flow-tag method-post">POST /sign-company/signature</span>
      <span class="flow-tag method-get">GET /sign/download/{doc-id}</span>
      <span class="flow-tag">3 bước</span>
      <span class="flow-tag">${modeConfig.isMock ? "🟡 Mock Mode" : "🟢 Live Mode"}</span>
    </div>
  `;
  container.appendChild(hero);

  // ── Bảng so sánh với luồng cá nhân ─────────────────────────────────────
  const diffCard = document.createElement("div");
  diffCard.style.cssText = `
    background:var(--bg-card-2);border:1px solid var(--border);border-radius:var(--radius-md);
    padding:14px 18px;margin-bottom:20px;font-size:0.8rem;
  `;
  diffCard.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;color:var(--text-secondary);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;">
      📊 So sánh với luồng Ký số Cá nhân thông thường
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <div style="font-weight:600;color:var(--color-primary);margin-bottom:4px;">Ký số Cá nhân</div>
        <div style="color:var(--text-muted);line-height:1.6;">
          POST /sign/challenge<br>
          POST /sign/signature<br>
          GET /sign/download/{doc-id}
        </div>
      </div>
      <div>
        <div style="font-weight:600;color:#a78bfa;margin-bottom:4px;">Ký số Cá nhân thuộc Tổ chức</div>
        <div style="color:var(--text-muted);line-height:1.6;">
          POST /sign-company/challenge <span style="color:#a78bfa;">+ company_id</span><br>
          POST /sign-company/signature<br>
          GET /sign/download/{doc-id} <span style="color:var(--color-success);">✓ dùng chung</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(diffCard);

  // ── Stepper ───────────────────────────────────────────────────────────────
  const stepper = document.createElement("div");
  stepper.className = "step-indicator";
  stepper.innerHTML = `
    <div class="step-item active" id="si-1">
      <div class="step-circle">1</div>
      <div class="step-label">Upload Tài liệu</div>
    </div>
    <div class="step-item" id="si-2">
      <div class="step-circle">2</div>
      <div class="step-label">Ký số</div>
    </div>
    <div class="step-item" id="si-3">
      <div class="step-circle">3</div>
      <div class="step-label">Download</div>
    </div>
  `;
  container.appendChild(stepper);

  function advanceStepper(stepDone) {
    stepper.querySelectorAll(".step-item").forEach((s, i) => {
      if (i < stepDone)       s.className = "step-item done";
      else if (i === stepDone) s.className = "step-item active";
      else                    s.className = "step-item";
    });
  }

  // ── Mount 3 bước ─────────────────────────────────────────────────────────

  const step1 = new Step1Upload(container, {
    state,
    onDone: () => {
      advanceStepper(1);
      const frame = getFrame?.();
      if (frame) state.selfieBase64 = frame;
      step2.activate();
      if (frame) step2.setSelfie(frame);
    },
  });

  const step2 = new Step2Signature(container, {
    state,
    socket,
    onDone: () => {
      advanceStepper(2);
      step3.activate();
    },
  });

  const step3 = new Step3Download(container, { state });

  step1.mount();
  step2.mount();
  step3.mount();

  // ── Lắng nghe socket events ───────────────────────────────────────────────
  const _prevPersonalInfo = socket.on.personalInfo;
  socket.on.personalInfo = (event) => {
    _prevPersonalInfo(event);
    const idNumber = event.data?.idCode;
    if (idNumber) {
      state.idNumber = idNumber;
      step1.setIdFromCard(idNumber);
    }
  };

  // Webcam: chụp selfie tự động
  let _selfieSet = false;
  const _prevWebcamFrame = socket.on.webcamFrame;
  socket.on.webcamFrame = (frameData) => {
    _prevWebcamFrame(frameData);
    if (!_selfieSet && frameData.data) {
      _selfieSet = true;
      state.selfieBase64 = frameData.data;
      step2.setSelfie(frameData.data);
    }
  };

  // Lưu deviceInfo
  const _prevDeviceInfo = socket.on.deviceInfo;
  socket.on.deviceInfo = (info) => {
    _prevDeviceInfo(info);
    state.deviceInfo = info;
  };
}
