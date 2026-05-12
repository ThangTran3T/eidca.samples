/**
 * main.js — Entry point của eIDCA Web Demo
 *
 * Khởi tạo:
 *  1. Import CSS design system
 *  2. Tạo socket (mock hoặc real) theo mode config
 *  3. Render layout: header + nav + sidebar + main content
 *  4. Client-side router: map route → flow
 *  5. Kết nối socket
 */

import "./app.css";
import { ModeToggle }               from "./ui/ModeToggle.js";
import { DevicePanel }              from "./ui/DevicePanel.js";
import { createMockSocket }         from "./socket/mockSocket.js";
import { createRealSocket }         from "./socket/socketClient.js";
import { mountPersonalOnboarding }  from "./flows/personal-onboarding/index.js";
import { mountPersonalSign }        from "./flows/personal-sign/index.js";

// ─── Routes ──────────────────────────────────────────────────────────────────
// Thêm luồng mới vào đây
const ROUTES = [
  {
    path: "/personal-onboarding",
    label: "Đăng ký CTS Cá nhân",
    badge: "3 bước",
    mount: mountPersonalOnboarding,
    available: true,
  },
  {
    path: "/personal-sign",
    label: "Ký số Cá nhân",
    badge: "3 bước",
    mount: mountPersonalSign,
    available: true,
  },
  {
    path: "/personal-company-onboarding",
    label: "Đăng ký CTS Tổ chức",
    badge: "3 bước",
    mount: null,
    available: false,
  },
  {
    path: "/personal-company-sign",
    label: "Ký số Tổ chức",
    badge: "3 bước",
    mount: null,
    available: false,
  },
];

// ─── App State ────────────────────────────────────────────────────────────────
let socket = null;
let devicePanel = null;
let modeToggle = null;
let currentRoute = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
function bootstrap() {
  const appEl = document.getElementById("app");

  // 1. Render HTML shell
  appEl.innerHTML = `
    <!-- Header -->
    <header class="app-header">
      <div class="logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="url(#grad)"/>
          <path d="M8 14l4 4 8-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="28" y2="28">
              <stop stop-color="#6366f1"/><stop offset="1" stop-color="#7c3aed"/>
            </linearGradient>
          </defs>
        </svg>
        eIDCA Web Demo
        <span class="logo-badge">SAMPLE CODE</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted)">
        Tài liệu tham khảo tích hợp cho đối tác
      </div>
    </header>

    <!-- Nav tabs -->
    <nav class="app-nav" id="app-nav"></nav>

    <!-- Body: sidebar + main -->
    <div class="app-body">
      <aside class="sidebar" id="sidebar"></aside>
      <main class="main-content" id="main-content">
        <div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:12px;color:var(--text-muted);">
          <div style="font-size:2rem">🔐</div>
          <div>Chọn một luồng từ menu trên để bắt đầu</div>
        </div>
      </main>
    </div>
  `;

  const navEl     = document.getElementById("app-nav");
  const sidebarEl = document.getElementById("sidebar");
  const mainEl    = document.getElementById("main-content");

  // 2. Mount ModeToggle vào sidebar
  modeToggle = new ModeToggle(sidebarEl, (newConfig) => {
    // Khi thay đổi mode → tạo lại socket và reload route
    _reconnectSocket(newConfig);
    devicePanel?.setMode(newConfig.isMock);
    if (currentRoute) _navigateTo(currentRoute, mainEl, newConfig);
  });
  modeToggle.mount();

  // 3. Tạo socket ban đầu
  const initConfig = modeToggle.getConfig();
  socket = _createSocket(initConfig);

  // 4. Mount DevicePanel vào sidebar (sau ModeToggle)
  devicePanel = new DevicePanel(sidebarEl, socket);
  devicePanel.mount();
  devicePanel.setMode(initConfig.isMock);

  // 5. Render nav tabs
  ROUTES.forEach((route) => {
    const link = document.createElement("div");
    link.className = `nav-link${route.available ? "" : " coming-soon"}`;
    link.dataset.path = route.path;
    link.innerHTML = `
      ${route.label}
      <span class="nav-badge">${route.badge}</span>
      ${!route.available ? '<span style="font-size:0.65rem;color:var(--text-muted)">(Sắp có)</span>' : ""}
    `;
    if (route.available) {
      link.addEventListener("click", () => {
        currentRoute = route.path;
        _navigateTo(route.path, mainEl, modeToggle.getConfig());
        _setActiveNav(navEl, route.path);
      });
    }
    navEl.appendChild(link);
  });

  // 6. Kết nối socket
  socket.connect();

  // 7. Navigate tới route mặc định
  const initialPath = "/personal-onboarding";
  currentRoute = initialPath;
  _navigateTo(initialPath, mainEl, initConfig);
  _setActiveNav(navEl, initialPath);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _createSocket(config) {
  return config.isMock ? createMockSocket() : createRealSocket();
}

function _reconnectSocket(config) {
  if (socket) socket.disconnect();
  socket = _createSocket(config);
  // Gán lại callbacks của DevicePanel vào socket mới
  if (devicePanel) devicePanel.updateSocket(socket);
  socket.connect();
}

function _navigateTo(path, mainEl, config) {
  const route = ROUTES.find((r) => r.path === path);
  if (!route?.mount) return;

  // Mount flow vào main content
  route.mount(mainEl, {
    socket,
    modeConfig: config,
    getFrame: () => devicePanel?.getCurrentFrame(),
    pauseWebcam: () => devicePanel?.pauseWebcam(),
    resumeWebcam: () => devicePanel?.resumeWebcam(),
  });
}

function _setActiveNav(navEl, path) {
  navEl.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.path === path);
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
bootstrap();
