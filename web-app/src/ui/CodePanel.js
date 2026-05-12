/**
 * CodePanel.js
 * Component hiển thị JSON request/response song song — như Postman.
 * Dùng lại ở tất cả các bước trong mọi luồng.
 *
 * Cách dùng:
 *   import { renderCodePanels, updateCodePanel } from '../ui/CodePanel.js';
 *
 *   // Render cặp panel vào một container
 *   const panels = renderCodePanels(container, {
 *     requestTitle: 'POST /ca/api/eid-personal/challenge',
 *     responseTitle: 'Response',
 *   });
 *
 *   // Cập nhật nội dung
 *   panels.setRequest({ code: 'PARTNER_001', id_number: '001087012345' });
 *   panels.setResponse({ success: true, data: { ... } }, 'success');
 */

/**
 * Syntax highlight JSON thành HTML.
 * @param {any} value - Dữ liệu cần highlight
 * @returns {string} HTML string
 */
export function highlightJSON(value) {
  const json = JSON.stringify(value, null, 2);
  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

/**
 * Render cặp code panel (Request | Response) vào container.
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} options.requestTitle  - Label endpoint, ví dụ "POST /ca/api/eid-personal/challenge"
 * @param {string} [options.responseTitle] - Label response (default: "Response")
 * @returns {{ setRequest, setResponse, el }}
 */
export function renderCodePanels(container, { requestTitle, responseTitle = "Response" }) {
  const el = document.createElement("div");
  el.className = "code-panels";
  el.innerHTML = `
    <!-- Panel REQUEST -->
    <div class="code-panel" id="cp-req">
      <div class="code-panel-header">
        <span class="code-panel-title request">▶ ${requestTitle}</span>
        <button class="code-copy-btn" data-target="cp-req-pre" title="Sao chép">Copy</button>
      </div>
      <pre id="cp-req-pre"><span class="json-null">// Chưa gửi request</span></pre>
    </div>

    <!-- Panel RESPONSE -->
    <div class="code-panel" id="cp-res">
      <div class="code-panel-header">
        <span class="code-panel-title response" id="cp-res-title">${responseTitle}</span>
        <button class="code-copy-btn" data-target="cp-res-pre" title="Sao chép">Copy</button>
      </div>
      <pre id="cp-res-pre"><span class="json-null">// Đang chờ response...</span></pre>
    </div>
  `;

  // Gắn vào container
  container.appendChild(el);

  // Copy button logic
  el.querySelectorAll(".code-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preEl = el.querySelector(`#${btn.dataset.target}`);
      const text = preEl?.innerText || "";
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });
  });

  const reqPre     = el.querySelector("#cp-req-pre");
  const resPre     = el.querySelector("#cp-res-pre");
  const resTitleEl = el.querySelector("#cp-res-title");

  return {
    el,

    /**
     * Cập nhật nội dung Request panel.
     * @param {object} data - JSON object
     */
    setRequest(data) {
      reqPre.innerHTML = highlightJSON(data);
    },

    /**
     * Cập nhật nội dung Response panel.
     * @param {object} data    - JSON object
     * @param {'success'|'error'|'processing'} state
     */
    setResponse(data, state = "") {
      resPre.innerHTML = highlightJSON(data);
      // Cập nhật màu title
      resTitleEl.className = `code-panel-title response ${state}`;
      const labels = { success: "✅ Response (200 OK)", error: "❌ Response (Error)", processing: "⏳ Response (Processing)" };
      resTitleEl.textContent = labels[state] || responseTitle;
    },

    /** Hiển thị trạng thái loading */
    setLoading() {
      resPre.innerHTML = `<span class="json-null">// Đang chờ response...</span>`;
      resTitleEl.className = "code-panel-title response";
      resTitleEl.textContent = responseTitle;
    },
  };
}
