<?php
/**
 * EIDCA CMS – Dashboard
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/layout.php';

requireLogin();
$user = currentUser();
$uid  = $user['id'];

// ── Stats ─────────────────────────────────────────────────────────────────────
// $whereClause: dùng cho query chưa có WHERE
// $andClause:   dùng cho query đã có WHERE sẵn
$whereClause = isAdmin() ? '' : 'WHERE user_id = ' . (int)$uid;
$andClause   = isAdmin() ? '' : 'AND user_id = ' . (int)$uid;

$totalReg = DB::row("SELECT COUNT(*) c FROM activity_logs WHERE action_type='register_cert' $andClause")['c'] ?? 0;
$totalSig = DB::row("SELECT COUNT(*) c FROM activity_logs WHERE action_type='sign_doc' $andClause")['c'] ?? 0;
$totalDk  = DB::row("SELECT COUNT(*) c FROM activity_logs WHERE action_type='dkcn' $andClause")['c'] ?? 0;
$totalAll = DB::row("SELECT COUNT(*) c FROM activity_logs $whereClause")['c'] ?? 0;

// Users count (admin only)
$totalUsers = isAdmin() ? (DB::row("SELECT COUNT(*) c FROM users")['c'] ?? 0) : null;

// Recent logs (last 10)
$recentSql = isAdmin()
    ? "SELECT l.*, u.username FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 10"
    : "SELECT l.*, ? as username FROM activity_logs l WHERE l.user_id=? ORDER BY l.created_at DESC LIMIT 10";
$recentParams = isAdmin() ? [] : [$user['username'], $uid];
$recentLogs = DB::rows($recentSql, $recentParams);

layoutHeader('Dashboard', 'dashboard');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Chào, <?= e($user['username']) ?> 👋</h1>
    <p>Tổng quan hệ thống EIDCA CMS – <?= date('d/m/Y') ?></p>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;">
    <a href="<?= _base() ?>/demo_register.html" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>
      Demo Đăng ký
    </a>
    <a href="<?= _base() ?>/demo_signing.html" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Demo Ký số
    </a>
  </div>
</div>

<!-- Stats -->
<div class="stats-grid">
  <div class="stat-card violet">
    <div class="stat-icon violet">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <div class="stat-value"><?= number_format($totalReg) ?></div>
    <div class="stat-label">Đăng ký Chứng thư số</div>
  </div>
  <div class="stat-card blue">
    <div class="stat-icon blue">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </div>
    <div class="stat-value"><?= number_format($totalSig) ?></div>
    <div class="stat-label">Ký số tài liệu</div>
  </div>
  <div class="stat-card teal">
    <div class="stat-icon teal">
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </div>
    <div class="stat-value"><?= number_format($totalDk) ?></div>
    <div class="stat-label">Đăng ký Chứng nhận</div>
  </div>
  <?php if (isAdmin()): ?>
  <div class="stat-card warn">
    <div class="stat-icon warn">
      <svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <div class="stat-value"><?= number_format($totalUsers) ?></div>
    <div class="stat-label">Tổng số Users</div>
  </div>
  <?php else: ?>
  <div class="stat-card warn">
    <div class="stat-icon warn">
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <div class="stat-value"><?= number_format($totalAll) ?></div>
    <div class="stat-label">Tổng hoạt động</div>
  </div>
  <?php endif; ?>
</div>

<!-- Quick links -->
<div class="card" style="margin-bottom:1.5rem">
  <div class="card-header">
    <h2>
      <svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Công cụ Demo
    </h2>
  </div>
  <div class="card-body">
    <div class="tool-grid">
      <a href="<?= _base() ?>/demo_register.html" class="tool-tile">
        <div class="tool-tile-icon violet">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.75 9.75 8 11 4.25-1.25 8-5.75 8-11V7l-8-4z" stroke="currentColor" stroke-width="1.8"/></svg>
        </div>
        <div>
          <h3>Đăng ký Chứng thư số</h3>
          <p>Đăng ký CTS cá nhân bằng CCCD gắn chip và xác thực khuôn mặt.</p>
        </div>
        <div class="tool-tile-arrow">→</div>
      </a>
      <a href="<?= _base() ?>/demo_signing.html" class="tool-tile">
        <div class="tool-tile-icon blue">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </div>
        <div>
          <h3>Ký số Tài liệu</h3>
          <p>Ký số PDF, DOCX bằng PIN chứng thư số EIDCA – PAdES/CAdES chuẩn ETSI.</p>
        </div>
        <div class="tool-tile-arrow">→</div>
      </a>
      <a href="settings.html" class="tool-tile">
        <div class="tool-tile-icon" style="background:rgba(217,119,6,.12);color:#d97706">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.8"/></svg>
        </div>
        <div>
          <h3>Cấu hình API Key</h3>
          <p>Quản lý API Key, Socket URL, Webcam URL riêng của bạn.</p>
        </div>
        <div class="tool-tile-arrow">→</div>
      </a>
    </div>
  </div>
</div>

<!-- Recent logs -->
<div class="card">
  <div class="card-header">
    <h2>
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" stroke="currentColor" stroke-width="1.8"/></svg>
      Hoạt động gần đây
    </h2>
    <a href="logs.html" class="btn btn-secondary btn-sm">Xem tất cả</a>
  </div>
  <?php if (empty($recentLogs)): ?>
  <div class="card-body">
    <div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8"/></svg></div>
      <h3>Chưa có hoạt động nào</h3>
      <p>Các thao tác đăng ký và ký số sẽ xuất hiện ở đây.</p>
    </div>
  </div>
  <?php else: ?>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <?php if (isAdmin()): ?><th>User</th><?php endif; ?>
        <th>Hành động</th>
        <th>IP</th>
        <th>Thời gian</th>
      </tr></thead>
      <tbody>
        <?php foreach ($recentLogs as $log):
          [$label, $cls] = actionLabel($log['action_type']);
        ?>
        <tr>
          <?php if (isAdmin()): ?><td class="td-mono"><?= e($log['username'] ?? '—') ?></td><?php endif; ?>
          <td><span class="badge <?= $cls ?>"><?= $label ?></span></td>
          <td class="td-mono" style="font-size:12px"><?= e($log['ip'] ?? '—') ?></td>
          <td style="font-size:12.5px;color:var(--text-3)"><?= fmtDate($log['created_at']) ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>

<?php layoutFooter(); ?>
