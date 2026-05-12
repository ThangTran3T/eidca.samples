/**
 * index.js — Luồng Đăng ký CTS Cá nhân
 * Route: /personal-onboarding
 *
 * Điều phối 3 bước:
 *   STEP 1: Step1Challenge  — Lấy challenge từ số CCCD
 *   STEP 2: Step2Signature  — Gửi NFC data + AA signature + selfie
 *   STEP 3: Step3Check      — Poll đến khi CTS được cấp
 *
 * State dùng chung giữa các bước:
 *   idNumber, partnerCode, transactionCode, challenge, tokenChallenge
 *   rawData, signature, selfieBase64, tokenSignature, interval, certInfo
 */

import { Step1Challenge } from "./Step1Challenge.js";
import { Step2Signature } from "./Step2Signature.js";
import { Step3Check }     from "./Step3Check.js";

/**
 * @param {HTMLElement} container - main-content container
 * @param {object} opts
 * @param {object} opts.socket       - mock hoặc real socket instance
 * @param {object} opts.modeConfig   - { isMock, apiUrl, apiKey, partnerCode }
 * @param {function} [opts.getFrame] - Lấy frame webcam hiện tại
 */
export function mountPersonalOnboarding(container, { socket, modeConfig, getFrame, pauseWebcam, resumeWebcam }) {
  container.innerHTML = ""; // Xóa nội dung cũ

  // ── Shared state ─────────────────────────────────────────────────────────
  // Tất cả dữ liệu được truyền qua state object này giữa các bước
  const state = {
    // Config
    partnerCode: modeConfig.partnerCode,

    // STEP 1 output
    idNumber: "",
    transactionCode: "",
    challenge: "",
    tokenChallenge: "",

    // STEP 2 — NFC data (từ socket event id:4)
    rawData: null,      // { sod, dg1, dg2, dg13, dg15 }
    signature: "",      // aa_signature từ chip (event id:7)
    selfieBase64: "",   // Ảnh webcam
    deviceInfo: null,   // Thông tin thiết bị

    // STEP 2 output
    tokenSignature: "",
    interval: 3000,

    // Webcam helper
    getCurrentFrame: getFrame || (() => null),
    pauseWebcam:     pauseWebcam || (() => {}),
    resumeWebcam:    resumeWebcam || (() => {}),
  };

  // ── Render page header ───────────────────────────────────────────────────
  const hero = document.createElement("div");
  hero.className = "flow-hero";
  hero.innerHTML = `
    <div class="flow-title">Đăng ký Chứng thư số Cá nhân</div>
    <div class="flow-desc">
      Minh họa luồng tích hợp eIDCA để cấp chữ ký số cá nhân dựa trên CCCD gắn chip.
      Mỗi bước hiển thị đầy đủ JSON request/response gửi tới eIDCA API.
    </div>
    <div class="flow-tags">
      <span class="flow-tag method-post">POST /eid-personal/challenge</span>
      <span class="flow-tag method-post">POST /eid-personal/signature</span>
      <span class="flow-tag method-post">POST /eid-personal/check</span>
      <span class="flow-tag">3 bước</span>
      <span class="flow-tag">${modeConfig.isMock ? "🟡 Mock Mode" : "🟢 Live Mode"}</span>
    </div>
  `;
  container.appendChild(hero);

  // ── Step indicator (horizontal stepper) ─────────────────────────────────
  const stepper = document.createElement("div");
  stepper.className = "step-indicator";
  stepper.id = "flow-stepper";
  stepper.innerHTML = `
    <div class="step-item active" id="si-1">
      <div class="step-circle">1</div>
      <div class="step-label">Lấy Challenge</div>
    </div>
    <div class="step-item" id="si-2">
      <div class="step-circle">2</div>
      <div class="step-label">Gửi Signature</div>
    </div>
    <div class="step-item" id="si-3">
      <div class="step-circle">3</div>
      <div class="step-label">Chờ CTS</div>
    </div>
  `;
  container.appendChild(stepper);

  // Helper cập nhật stepper
  function advanceStepper(stepDone) {
    const steps = stepper.querySelectorAll(".step-item");
    steps.forEach((s, i) => {
      if (i < stepDone)      s.className = "step-item done";
      else if (i === stepDone) s.className = "step-item active";
      else                   s.className = "step-item";
    });
  }

  // ── Tạo và mount 3 bước ─────────────────────────────────────────────────

  const step1 = new Step1Challenge(container, {
    state,
    onDone: (_state) => {
      // STEP 1 hoàn thành → kích hoạt STEP 2
      advanceStepper(1);

      // Nếu có ảnh webcam → cập nhật vào step2
      const frame = getFrame?.();
      if (frame) state.selfieBase64 = frame;

      step2.activate();

      // Nếu đã có raw NFC data (đọc thẻ trước khi bấm STEP 1) → set vào step2
      if (state.rawData) step2.setRawData(state.rawData);
      if (frame)         step2.setSelfie(frame);
    },
  });

  const step2 = new Step2Signature(container, {
    state,
    socket,
    onDone: (_state) => {
      // STEP 2 hoàn thành → kích hoạt STEP 3
      advanceStepper(2);
      step3.activate();
    },
  });

  const step3 = new Step3Check(container, {
    state,
    onDone: (_state) => {
      advanceStepper(3);
    },
  });

  step1.mount();
  step2.mount();
  step3.mount();

  // ── Lắng nghe socket events để cập nhật state & steps ────────────────────
  // Lưu ý: DevicePanel cũng dùng socket.on — flow sẽ wrap lại để chain cả 2

  const _prevPersonalInfo  = socket.on.personalInfo;  // callback của DevicePanel
  const _prevAvatarImage   = socket.on.avatarImage;
  const _prevDeviceInfo    = socket.on.deviceInfo;

  // Khi đọc NFC thành công (id:2) → lấy idNumber điền STEP 1
  socket.on.personalInfo = (event) => {
    _prevPersonalInfo(event); // Gọi DevicePanel trước
    const idNumber = event.data?.idCode;
    if (idNumber) {
      state.idNumber = idNumber;
      step1.setIdFromCard(idNumber);
    }
  };

  // Khi nhận ảnh + raw NFC (id:4) → lưu rawData cho STEP 2
  socket.on.avatarImage = (event) => {
    _prevAvatarImage(event);
    const d = event.data;
    state.rawData = { sod: d.sod, dg1: d.dg1, dg2: d.dg2, dg13: d.dg13, dg15: d.dg15 };
    step2.setRawData(state.rawData);
  };

  // Webcam: chỉ lấy 1 frame làm selfie
  let _selfieSet = false;
  const _prevWebcamFrame = socket.on.webcamFrame;
  socket.on.webcamFrame = (frameData) => {
    _prevWebcamFrame(frameData); // DevicePanel render preview
    if (!_selfieSet && frameData.data) {
      _selfieSet = true;
      state.selfieBase64 = frameData.data;
      step2.setSelfie(frameData.data);
    }
  };

  // Lưu thông tin thiết bị
  socket.on.deviceInfo = (info) => {
    _prevDeviceInfo(info);
    state.deviceInfo = info;
  };
}
