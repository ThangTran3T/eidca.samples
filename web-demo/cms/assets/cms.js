/* EIDCA CMS – Client-side JS */

// ── Sidebar toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Auto-dismiss flash after 5s ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const flash = document.getElementById('flashMsg');
  if (flash) setTimeout(() => flash.remove(), 5000);
});

// ── Copy to clipboard ─────────────────────────────────────────────────────────
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Đã copy';
    btn.style.color = 'var(--teal)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const id = 'toast_' + Date.now();
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb', warn: '#d97706' };
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:12px 20px;border-radius:10px;
    background:${colors[type]||colors.info};color:#fff;
    font-family:'Inter',sans-serif;font-size:13.5px;font-weight:600;
    box-shadow:0 4px 20px rgba(0,0,0,.25);
    animation:fadeIn .25s ease;
    max-width:320px;line-height:1.4;
  `;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function confirmAction(msg, url) {
  if (confirm(msg)) window.location.href = url;
}

// ── Log filter (client-side quick filter) ─────────────────────────────────────
function initLogFilter() {
  const input = document.getElementById('logSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll('tbody tr[data-searchable]').forEach(tr => {
      tr.style.display = tr.dataset.searchable.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}
document.addEventListener('DOMContentLoaded', initLogFilter);

// ── API: ghi log từ demo pages ────────────────────────────────────────────────
/**
 * Gọi từ demo HTML để ghi log vào CMS
 * @param {string} actionType - 'register_cert' | 'sign_doc' | 'dkcn'
 * @param {object} payload    - dữ liệu kèm theo (idCode, personName, docName, v.v.)
 */
window.eidcaLogEvent = function(actionType, payload = {}) {
  const apiBase = window.EIDCA_CMS_BASE || '../cms';
  fetch(apiBase + '/api/log_event.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   // gửi session cookie
    body: JSON.stringify({ action: actionType, payload })
  }).catch(() => {}); // silent fail – không làm gián đoạn demo
};

// ── Reset API key với confirm ─────────────────────────────────────────────────
function resetApiKey() {
  if (!confirm('Bạn có chắc muốn tạo lại API Key?\nKey cũ sẽ bị vô hiệu hóa ngay lập tức.')) return;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '';
  const csrf = document.querySelector('input[name="csrf"]');
  if (csrf) form.appendChild(csrf.cloneNode());
  const act = document.createElement('input');
  act.type = 'hidden'; act.name = 'action'; act.value = 'reset_api_key';
  form.appendChild(act);
  document.body.appendChild(form);
  form.submit();
}
