<?php
/**
 * EIDCA CMS – Shared HTML layout (header + sidebar + footer)
 * Usage: layoutHeader($title); ... content ... layoutFooter();
 */

function layoutHeader(string $title = 'Dashboard', string $activePage = ''): void {
    $user  = currentUser();
    $flash = flash();
    ?><!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title><?= e($title) ?> – EIDCA CMS</title>
<meta name="robots" content="noindex,nofollow"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="<?= _base() ?>/assets/cms.css"/>
</head>
<body>

<!-- ── Sidebar ── -->
<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2.5L15 9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <div class="sidebar-brand">EIDCA</div>
      <div class="sidebar-sub">CMS Portal</div>
    </div>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-section-label">Tổng quan</div>
    <a href="<?= _base() ?>/dashboard.html" class="nav-item <?= $activePage==='dashboard' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>
      Dashboard
    </a>

    <div class="nav-section-label">Công cụ Demo</div>
    <a href="<?= _base() ?>/demo_register.html" class="nav-item <?= $activePage==='demo_register' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>
      Đăng ký Chứng thư số
    </a>
    <a href="<?= _base() ?>/demo_signing.html" class="nav-item <?= $activePage==='demo_signing' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Ký số Tài liệu
    </a>
    <a href="<?= _base() ?>/demo_dkcn.html" class="nav-item <?= $activePage==='demo_dkcn' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      ĐK Chứng nhận
    </a>

    <div class="nav-section-label">Tài khoản</div>
    <a href="<?= _base() ?>/logs.html" class="nav-item <?= $activePage==='logs' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Lịch sử hoạt động
    </a>
    <a href="<?= _base() ?>/settings.html" class="nav-item <?= $activePage==='settings' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.8"/></svg>
      Cấu hình & API Key
    </a>

    <?php if (isAdmin()): ?>
    <div class="nav-section-label">Quản trị</div>
    <a href="<?= _base() ?>/admin/users.html" class="nav-item <?= $activePage==='admin_users' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Quản lý Users
    </a>
    <a href="<?= _base() ?>/admin/create_user.html" class="nav-item <?= $activePage==='admin_create_user' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Tạo User mới
    </a>
    <a href="<?= _base() ?>/admin/logs_all.html" class="nav-item <?= $activePage==='admin_logs' ? 'active' : '' ?>">
      <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Tất cả Log
    </a>
    <?php endif; ?>
  </nav>

  <div class="sidebar-footer">
    <div class="user-card">
      <div class="user-avatar"><?= strtoupper(mb_substr($user['username'] ?? 'U', 0, 1)) ?></div>
      <div class="user-info">
        <div class="user-name"><?= e($user['username'] ?? '') ?></div>
        <div class="user-role"><?= $user['role'] === 'admin' ? '⚡ Admin' : '👤 User' ?></div>
      </div>
    </div>
    <a href="<?= _base() ?>/logout.html" class="btn-logout" title="Đăng xuất">
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>
</aside>

<!-- ── Overlay (mobile) ── -->
<div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>

<!-- ── Main wrapper ── -->
<div class="main-wrapper">
  <!-- Topbar -->
  <header class="topbar">
    <button class="hamburger" id="hamburger" onclick="toggleSidebar()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <div class="topbar-title"><?= e($title) ?></div>
    <div class="topbar-right">
      <span class="topbar-user"><?= e($user['username'] ?? '') ?></span>
    </div>
  </header>

  <!-- Flash message -->
  <?php if ($flash): ?>
  <div class="flash flash-<?= e($flash['type']) ?>" id="flashMsg">
    <?= e($flash['msg']) ?>
    <button onclick="this.parentElement.remove()" class="flash-close">&times;</button>
  </div>
  <?php endif; ?>

  <!-- Page content -->
  <main class="content">
<?php
}

function layoutFooter(): void {
?>
  </main><!-- /content -->
</div><!-- /main-wrapper -->

<script src="<?= _base() ?>/assets/cms.js"></script>
</body>
</html>
<?php
}
