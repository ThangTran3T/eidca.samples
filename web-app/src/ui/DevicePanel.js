/**
 * DevicePanel.js
 * Sidebar panel hiển thị:
 *  - Trạng thái kết nối NFC Reader (SocketIO)
 *  - Trạng thái kết nối Webcam (SocketIO)
 *  - Preview ảnh webcam live
 *  - Thông tin thẻ CCCD đã đọc được
 *
 * Cách dùng:
 *   const panel = new DevicePanel(containerEl, socket);
 *   panel.mount();
 *   panel.getCurrentFrame(); // → Base64 ảnh webcam hiện tại
 */

export class DevicePanel {
  constructor(container, socket) {
    this._container = container;
    this._socket = socket;
    this._el = null;
    this._lastFrame = null;
  }

  mount() {
    this._el = document.createElement("div");
    this._el.innerHTML = `
      <div class="device-panel">
        <div class="panel-header">
          <span>Thiết bị</span>
          <span id="dev-mode-badge" class="step-status-badge badge-warning">Mock</span>
        </div>

        <!-- NFC Reader -->
        <div class="device-row">
          <span class="device-icon">🔖</span>
          <div class="device-info">
            <div class="device-name">Đầu đọc NFC</div>
            <div class="device-sub" id="nfc-sub">Đang kết nối...</div>
          </div>
          <div class="status-dot connecting" id="nfc-dot"></div>
        </div>

        <!-- Webcam -->
        <div class="device-row">
          <span class="device-icon">📷</span>
          <div class="device-info">
            <div class="device-name">Webcam</div>
            <div class="device-sub" id="cam-sub">Đang kết nối...</div>
          </div>
          <div class="status-dot connecting" id="cam-dot"></div>
        </div>

        <!-- Webcam preview -->
        <div class="webcam-preview">
          <div class="webcam-placeholder" id="webcam-placeholder">
            <span style="font-size:1.5rem">📷</span>
            <span>Chưa có ảnh</span>
          </div>
          <img id="webcam-img" class="hidden" alt="Webcam frame"
            style="width:100%;border-radius:8px;object-fit:cover;aspect-ratio:4/3;" />
        </div>

        <!-- Thông tin CCCD đã đọc -->
        <div id="card-info-wrap" class="hidden card-info">
          <div class="card-name" id="card-name">—</div>
          <div class="card-id" id="card-id">—</div>
        </div>
      </div>
    `;
    this._container.appendChild(this._el);

    // Gán callbacks vào socket.on
    this._bindSocket(this._socket);
  }

  /** Gán callbacks — gọi lại khi socket được thay thế (đổi Mock/Live) */
  _bindSocket(socket) {
    this._socket = socket;

    socket.on.nfcConnect = () => {
      this._setStatus("nfc", "connected", "Đã kết nối");
    };
    socket.on.nfcDisconnect = () => {
      this._setStatus("nfc", "error", "Mất kết nối");
      this._el.querySelector("#card-info-wrap")?.classList.add("hidden");
    };
    socket.on.deviceInfo = (info) => {
      this._el.querySelector("#nfc-sub").textContent = `SN: ${info.serial_device}`;
    };
    socket.on.personalInfo = (event) => {
      const d = event.data;
      this._el.querySelector("#card-name").textContent = d.personName;
      this._el.querySelector("#card-id").textContent   = `CCCD: ${d.idCode}`;
      this._el.querySelector("#card-info-wrap").classList.remove("hidden");
    };
    socket.on.cardError = (event) => {
      this._setStatus("nfc", "error", `Lỗi: ${event.message || "Đọc thẻ thất bại"}`);
    };

    socket.on.camConnect = () => {
      this._setStatus("cam", "connected", "Đang stream");
    };
    socket.on.camDisconnect = () => {
      this._setStatus("cam", "error", "Mất kết nối");
      this._el.querySelector("#webcam-img")?.classList.add("hidden");
      this._el.querySelector("#webcam-placeholder")?.classList.remove("hidden");
    };

    // Webcam frames — update tối đa 5fps (mỗi 200ms)
    let _lastRender = 0;
    socket.on.webcamFrame = (frameData) => {
      if (!frameData?.data) return;
      this._lastFrame = frameData.data;
      const now = Date.now();
      if (now - _lastRender < 200) return;
      _lastRender = now;

      const img         = this._el.querySelector("#webcam-img");
      const placeholder = this._el.querySelector("#webcam-placeholder");
      img.src = `data:image/jpeg;base64,${frameData.data}`;
      img.classList.remove("hidden");
      placeholder?.classList.add("hidden");
    };
  }

  /** Cập nhật socket khi đổi mode */
  updateSocket(newSocket) {
    // Reset trạng thái UI
    this._setStatus("nfc", "connecting", "Đang kết nối...");
    this._setStatus("cam", "connecting", "Đang kết nối...");
    this._el.querySelector("#card-info-wrap")?.classList.add("hidden");
    this._el.querySelector("#webcam-img")?.classList.add("hidden");
    this._el.querySelector("#webcam-placeholder")?.classList.remove("hidden");
    this._lastFrame = null;
    this._bindSocket(newSocket);
  }

  _setStatus(device, state, label) {
    const dot = this._el.querySelector(`#${device}-dot`);
    const sub = this._el.querySelector(`#${device}-sub`);
    if (dot) dot.className = `status-dot ${state}`;
    if (sub) sub.textContent = label;
  }

  setMode(isMock) {
    const badge = this._el?.querySelector("#dev-mode-badge");
    if (!badge) return;
    if (isMock) {
      badge.className = "step-status-badge badge-warning";
      badge.textContent = "Mock";
    } else {
      badge.className = "step-status-badge badge-done";
      badge.textContent = "Live";
    }
  }

  getCurrentFrame() { return this._lastFrame; }
}
