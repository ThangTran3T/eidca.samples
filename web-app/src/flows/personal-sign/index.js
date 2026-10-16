/**
 * index.js — Luồng Ký số Cá nhân
 * Route: /personal-sign
 *
 * Điều phối 3 bước:
 *   STEP 1: Step1Upload    — Upload tài liệu → lấy doc_challenge
 *   STEP 2: Step2Signature — Ký AA + gửi selfie → xác nhận ký
 *   STEP 3: Step3Download  — Download file PDF đã ký
 *
 * State dùng chung:
 *   idNumber, partnerCode,
 *   transactionCode, tokenSign,
 *   docs[{doc_id, doc_name, doc_challenge}],
 *   aaSignature, selfieBase64,
 *   signedDocs[{doc_id, doc_name, ca_signature, sign_at}],
 *   tokenSigned
 */

import { Step1Upload }     from "./Step1Upload.js";
import { Step2Signature }  from "./Step2Signature.js";
import { Step3Download }   from "./Step3Download.js";

export function mountPersonalSign(container, { socket, modeConfig, getFrame, pauseWebcam, resumeWebcam }) {
  container.innerHTML = "";

  // ── Shared state ──────────────────────────────────────────────────────────
  const state = {
    partnerCode: modeConfig.partnerCode,
    idNumber:    "",

    // STEP 1 output
    transactionCode: "",
    tokenSign:       "",
    docs:            [],       // [{doc_id, doc_name, doc_challenge}]
    selectedFile:    null,

    // STEP 2 output
    aaSignature:  "",
    selfieBase64: "",
    signedDocs:   [],          // [{doc_id, doc_name, ca_signature, sign_at, doc_hash}]
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
    <div class="flow-title">Ký số Cá nhân</div>
    <div class="flow-desc">
      Minh họa luồng ký tài liệu PDF/PNG sử dụng Chứng thư số cá nhân eIDCA.
      Challenge ký được lấy từ <code>doc_challenge</code> và ký trực tiếp trên chip thẻ CCCD.
    </div>
    <div class="flow-tags">
      <span class="flow-tag method-post">POST /sign/challenge</span>
      <span class="flow-tag method-post">POST /sign/signature</span>
      <span class="flow-tag method-get">GET /sign/download/{doc-id}</span>
      <span class="flow-tag">3 bước</span>
      <span class="flow-tag">${modeConfig.isMock ? "🟡 Mock Mode" : "🟢 Live Mode"}</span>
    </div>
  `;
  container.appendChild(hero);

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
  // Lưu ý: chain với callbacks đã có của DevicePanel

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
