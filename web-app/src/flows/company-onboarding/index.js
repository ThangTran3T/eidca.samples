/**
 * index.js — Luồng Đăng ký CTS Cá nhân thuộc Tổ chức
 * Route: /personal-company-onboarding
 *
 * Điều phối 3 bước:
 *   STEP 1: Step1Challenge  — Lấy challenge (kèm company_id)
 *   STEP 2: Step2Signature  — Gửi NFC data + AA signature + selfie
 *   STEP 3: Step3Check      — Poll đến khi CTS được cấp
 *
 * Khác với cá nhân thông thường:
 *   - STEP 1 có thêm tham số `company_id`
 *   - STEP 2 gọi /eid-company/signature (payload gọn hơn, không có device info)
 *   - STEP 3 gọi /eid-company/check
 *
 * State dùng chung:
 *   idNumber, companyId, partnerCode,
 *   transactionCode, tokenChallenge,
 *   rawData, signature, selfieBase64,
 *   tokenSignature, interval, certInfo
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
export function mountCompanyOnboarding(container, { socket, modeConfig, getFrame, pauseWebcam, resumeWebcam }) {
  container.innerHTML = ""; // Xóa nội dung cũ

  // ── Shared state ─────────────────────────────────────────────────────────
  const state = {
    // Config
    partnerCode: modeConfig.partnerCode,

    // STEP 1 input
    idNumber:  "",
    companyId: 1,    // ID tổ chức trong hệ thống eIDCA

    // STEP 1 output
    transactionCode: "",
    tokenChallenge:  "",
    // Lưu ý: eid-company/challenge không trả về trường `challenge` riêng

    // STEP 2 — NFC data (từ socket event id:4)
    rawData:   null,   // { sod, dg1, dg2, dg13, dg15 }
    signature: "",     // aa_signature từ chip (event id:7)
    selfieBase64: "",  // Ảnh webcam

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
    <div class="flow-title">Đăng ký CTS Cá nhân thuộc Tổ chức</div>
    <div class="flow-desc">
      Minh họa luồng tích hợp eIDCA để cấp chữ ký số <strong>cá nhân gắn với tổ chức</strong>.
      Tương tự luồng cá nhân nhưng có thêm <code>company_id</code> ở STEP 1 và dùng endpoint riêng.
    </div>
    <div class="flow-tags">
      <span class="flow-tag" style="background:rgba(124,58,237,0.15);color:#a78bfa;border-color:rgba(124,58,237,0.3);">🏢 Tổ chức</span>
      <span class="flow-tag method-post">POST /eid-company/challenge</span>
      <span class="flow-tag method-post">POST /eid-company/signature</span>
      <span class="flow-tag method-post">POST /eid-company/check</span>
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
      📊 So sánh với luồng Cá nhân thông thường
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <div style="font-weight:600;color:var(--color-primary);margin-bottom:4px;">CTS Cá nhân</div>
        <div style="color:var(--text-muted);line-height:1.6;">
          POST /eid-personal/challenge<br>
          POST /eid-personal/signature<br>
          POST /eid-personal/check<br>
          <span style="font-size:0.7rem;">Payload Step 2: đầy đủ device info</span>
        </div>
      </div>
      <div>
        <div style="font-weight:600;color:#a78bfa;margin-bottom:4px;">CTS Cá nhân thuộc Tổ chức</div>
        <div style="color:var(--text-muted);line-height:1.6;">
          POST /eid-company/challenge <span style="color:#a78bfa;">+ company_id</span><br>
          POST /eid-company/signature<br>
          POST /eid-company/check<br>
          <span style="font-size:0.7rem;color:#a78bfa;">Payload Step 2: chỉ phone, email, image</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(diffCard);

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

      const frame = getFrame?.();
      if (frame) state.selfieBase64 = frame;

      step2.activate();

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

  const _prevPersonalInfo = socket.on.personalInfo;
  const _prevAvatarImage  = socket.on.avatarImage;
  const _prevDeviceInfo   = socket.on.deviceInfo;

  // Khi đọc NFC thành công (id:2) → lấy idNumber điền STEP 1
  socket.on.personalInfo = (event) => {
    _prevPersonalInfo(event);
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
    _prevWebcamFrame(frameData);
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
