/**
 * ModeToggle.js
 * Toggle chuyển đổi giữa Mock Mode và Live Mode.
 *
 * - Mock Mode: Gọi mock server tại http://localhost:3001, dùng mock socket.
 * - Live Mode: Nhập API URL, API Key, Partner Code thật.
 * Config được lưu vào localStorage để persist qua reload.
 *
 * Cách dùng:
 *   import { ModeToggle } from '../ui/ModeToggle.js';
 *   const toggle = new ModeToggle(container, (config) => {
 *     // config: { isMock, apiUrl, apiKey, partnerCode }
 *     // Gọi lại khi user thay đổi mode
 *   });
 *   toggle.mount();
 *   const config = toggle.getConfig(); // Lấy config hiện tại
 */

const STORAGE_KEY = "eidca_demo_config";

const DEFAULTS = {
  isMock: true,
  apiUrl: "http://localhost:3001",
  apiKey: "MOCK_API_KEY_DEMO",
  partnerCode: "PARTNER_DEMO_001",
};

export class ModeToggle {
  constructor(container, onChange) {
    this._container = container;
    this._onChange = onChange || (() => {});
    this._config = this._loadConfig();
    this._el = null;
  }

  _loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  _saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
  }

  mount() {
    this._el = document.createElement("div");
    this._el.className = "mode-toggle-bar";
    this._render();
    this._container.appendChild(this._el);
  }

  _render() {
    const { isMock, apiUrl, apiKey, partnerCode } = this._config;
    this._el.innerHTML = `
      <div class="label">Chế độ chạy</div>

      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" id="mode-chk" ${isMock ? "" : "checked"} />
          <span class="slider"></span>
        </label>
        <span class="mode-label ${isMock ? "mock" : "live"}">
          ${isMock ? "🟡 MOCK" : "🟢 LIVE"}
        </span>
      </div>

      <!-- Mock info -->
      <div class="mode-info" id="mock-info" ${isMock ? "" : 'style="display:none"'}>
        API: <code>${DEFAULTS.apiUrl}</code><br/>
        Key: <code>${DEFAULTS.apiKey}</code><br/>
        <span style="color:var(--color-warning);font-size:0.72rem;margin-top:4px;display:block">
          ⚡ Chạy: <code>npm run mock</code> để khởi động mock server
        </span>
      </div>

      <!-- Live config form -->
      <div class="live-config" id="live-config" ${isMock ? 'style="display:none"' : ""}>
        <div>
          <div class="field-label">API Base URL</div>
          <input id="cfg-url" type="text" value="${apiUrl}" placeholder="https://api.eidca.vn" />
        </div>
        <div>
          <div class="field-label">API Key (x-api-key)</div>
          <input id="cfg-key" type="text" value="${apiKey}" placeholder="your_api_key_here" />
        </div>
        <div>
          <div class="field-label">Partner Code</div>
          <input id="cfg-code" type="text" value="${partnerCode}" placeholder="PARTNER_001" />
        </div>
      </div>
    `;

    // Toggle handler
    const chk = this._el.querySelector("#mode-chk");
    chk.addEventListener("change", () => {
      this._config.isMock = !chk.checked;
      this._saveConfig();
      this._render();
      this._onChange(this.getConfig());
    });

    // Live config inputs
    const bindInput = (id, key) => {
      const inp = this._el.querySelector(`#${id}`);
      if (!inp) return;
      inp.addEventListener("change", () => {
        this._config[key] = inp.value.trim();
        this._saveConfig();
        this._onChange(this.getConfig());
      });
    };
    bindInput("cfg-url",  "apiUrl");
    bindInput("cfg-key",  "apiKey");
    bindInput("cfg-code", "partnerCode");
  }

  /** Trả về config hiện tại */
  getConfig() {
    return { ...this._config };
  }
}
