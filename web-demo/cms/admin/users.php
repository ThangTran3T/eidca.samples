<?php
/**
 * EIDCA CMS – Admin: Quản lý Users
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/layout.php';

requireAdmin();

// ── Handle POST actions ───────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) redirect('users.html', 'CSRF invalid.', 'error');

    $action = $_POST['action'] ?? '';
    $tid    = (int)($_POST['user_id'] ?? 0);  // target user id
    $me     = currentUser()['id'];

    if ($tid <= 0) redirect(_base() . '/admin/users.html', 'User ID không hợp lệ.', 'error');
    if ($tid === $me && in_array($action, ['toggle_active', 'delete'], true)) {
        redirect(_base() . '/admin/users.html', 'Không thể thực hiện thao tác này với chính mình.', 'error');
    }

    // PHP 7.4 compatible – dùng if/elseif thay match()
    if ($action === 'toggle_active') {
        DB::exec('UPDATE users SET is_active = 1 - is_active WHERE id=?', [$tid]);
        logActivity('admin_toggle_user', ['target_id' => $tid]);
    } elseif ($action === 'toggle_role') {
        $cur = DB::row('SELECT role FROM users WHERE id=?', [$tid])['role'] ?? 'user';
        $new = $cur === 'admin' ? 'user' : 'admin';
        DB::exec('UPDATE users SET role=? WHERE id=?', [$new, $tid]);
        logActivity('admin_role_change', ['target_id' => $tid, 'new_role' => $new]);
    } elseif ($action === 'reset_api_key') {
        $k = 'ek_' . bin2hex(random_bytes(20));
        DB::exec('UPDATE users SET api_key=? WHERE id=?', [$k, $tid]);
        logActivity('admin_reset_api_key', ['target_id' => $tid]);
    } elseif ($action === 'delete') {
        DB::exec('DELETE FROM activity_logs WHERE user_id=?', [$tid]);
        DB::exec('DELETE FROM users WHERE id=?', [$tid]);
        logActivity('admin_delete_user', ['target_id' => $tid]);
    }

    redirect(_base() . '/admin/users.html', 'Thao tác thành công.', 'success');
}

// ── Fetch users ───────────────────────────────────────────────────────────────
$search = trim($_GET['q'] ?? '');
$role   = $_GET['role']   ?? '';
$status = $_GET['status'] ?? '';
$page   = max(1, (int)($_GET['p'] ?? 1));
$perPage = 25;

$where  = 'WHERE 1';
$params = [];
if ($search) { $where .= ' AND (username LIKE ? OR email LIKE ?)'; $params[] = "%$search%"; $params[] = "%$search%"; }
if ($role)   { $where .= ' AND role=?';      $params[] = $role; }
if ($status !== '') { $where .= ' AND is_active=?'; $params[] = (int)$status; }

$total  = DB::row("SELECT COUNT(*) c FROM users $where", $params)['c'] ?? 0;
$pages  = (int)ceil($total / $perPage);
$params[] = $perPage; $params[] = ($page-1)*$perPage;
$users  = DB::rows("SELECT * FROM users $where ORDER BY created_at DESC LIMIT ? OFFSET ?", $params);

// Log counts per user
$logCounts = [];
foreach (DB::rows("SELECT user_id, COUNT(*) c FROM activity_logs GROUP BY user_id") as $r) {
    $logCounts[$r['user_id']] = $r['c'];
}

layoutHeader('Quản lý Users', 'admin_users');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Quản lý Users</h1>
    <p>Tổng cộng <?= number_format($total) ?> tài khoản.</p>
  </div>
  <a href="<?= _base() ?>/admin/create_user.html" class="btn btn-primary btn-sm">
    <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    Tạo User mới
  </a>
</div>

<div class="card">
  <form method="GET" style="display:contents">
    <div class="filter-bar">
      <input type="text" name="q" class="form-control" placeholder="🔍 Tìm username / email…"
             value="<?= e($search) ?>"/>
      <select name="role" class="form-control">
        <option value="">Tất cả vai trò</option>
        <option value="admin" <?= $role==='admin'?'selected':'' ?>>Admin</option>
        <option value="user"  <?= $role==='user'?'selected':'' ?>>User</option>
      </select>
      <select name="status" class="form-control">
        <option value="">Tất cả trạng thái</option>
        <option value="1" <?= $status==='1'?'selected':'' ?>>Đang hoạt động</option>
        <option value="0" <?= $status==='0'?'selected':'' ?>>Bị khóa</option>
      </select>
      <button type="submit" class="btn btn-secondary btn-sm">Lọc</button>
      <?php if ($search||$role||$status!==''): ?>
      <a href="users.html" class="btn btn-secondary btn-sm">✕ Xóa</a>
      <?php endif; ?>
    </div>
  </form>

  <div class="table-wrap">
    <?php if (empty($users)): ?>
    <div class="card-body">
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>Không tìm thấy user nào</h3>
      </div>
    </div>
    <?php else: ?>
    <table>
      <thead><tr>
        <th>ID</th>
        <th>Username</th>
        <th>Email</th>
        <th>Vai trò</th>
        <th>Trạng thái</th>
        <th>Log</th>
        <th>Ngày tạo</th>
        <th>Thao tác</th>
      </tr></thead>
      <tbody>
        <?php foreach ($users as $u):
          $isMe = $u['id'] === currentUser()['id'];
        ?>
        <tr>
          <td class="td-mono" style="font-size:12px">#<?= $u['id'] ?></td>
          <td>
            <div style="font-weight:600"><?= e($u['username']) ?></div>
            <?php if ($isMe): ?>
            <div style="font-size:11px;color:var(--accent)">← bạn</div>
            <?php endif; ?>
          </td>
          <td style="font-size:13px;color:var(--text-3)"><?= e($u['email']) ?></td>
          <td>
            <span class="badge <?= $u['role']==='admin' ? 'badge-violet' : 'badge-blue' ?>">
              <?= $u['role'] === 'admin' ? '⚡ Admin' : '👤 User' ?>
            </span>
          </td>
          <td>
            <span class="badge <?= $u['is_active'] ? 'badge-green' : 'badge-danger' ?>">
              <?= $u['is_active'] ? '✓ Active' : '✕ Locked' ?>
            </span>
          </td>
          <td style="font-size:13px"><?= number_format($logCounts[$u['id']] ?? 0) ?></td>
          <td style="font-size:12px;color:var(--text-3)"><?= fmtDate($u['created_at'], false) ?></td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <?php if (!$isMe): ?>
              <!-- Toggle active -->
              <form method="POST" style="display:contents">
                <?= csrfField() ?>
                <input type="hidden" name="action"  value="toggle_active"/>
                <input type="hidden" name="user_id" value="<?= $u['id'] ?>"/>
                <button class="btn btn-xs <?= $u['is_active'] ? 'btn-danger' : 'btn-secondary' ?>"
                        title="<?= $u['is_active'] ? 'Khóa' : 'Mở khóa' ?>"
                        onclick="return confirm('<?= $u['is_active'] ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?' ?>')">
                  <?= $u['is_active'] ? '🔒' : '🔓' ?>
                </button>
              </form>

              <!-- Toggle role -->
              <form method="POST" style="display:contents">
                <?= csrfField() ?>
                <input type="hidden" name="action"  value="toggle_role"/>
                <input type="hidden" name="user_id" value="<?= $u['id'] ?>"/>
                <button class="btn btn-xs btn-secondary"
                        title="Đổi vai trò"
                        onclick="return confirm('Đổi vai trò tài khoản #<?= $u['id'] ?> thành <?= $u['role']==='admin'?'User':'Admin' ?>?')">
                  <?= $u['role']==='admin' ? '👤' : '⚡' ?>
                </button>
              </form>

              <!-- Reset API key -->
              <form method="POST" style="display:contents">
                <?= csrfField() ?>
                <input type="hidden" name="action"  value="reset_api_key"/>
                <input type="hidden" name="user_id" value="<?= $u['id'] ?>"/>
                <button class="btn btn-xs btn-secondary" title="Reset API Key"
                        onclick="return confirm('Reset API Key của #<?= $u['id'] ?>?')">🔑</button>
              </form>

              <!-- Delete -->
              <form method="POST" style="display:contents">
                <?= csrfField() ?>
                <input type="hidden" name="action"  value="delete"/>
                <input type="hidden" name="user_id" value="<?= $u['id'] ?>"/>
                <button class="btn btn-xs btn-danger" title="Xóa user"
                        onclick="return confirm('XÓA toàn bộ tài khoản và log của #<?= $u['id'] ?>?\nHành động này KHÔNG THỂ hoàn tác!')">🗑</button>
              </form>
              <?php else: ?>
              <span style="font-size:12px;color:var(--text-3)">—</span>
              <?php endif; ?>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>
  </div>

  <?php if ($pages > 1): ?>
  <div style="padding:1rem 1.5rem;border-top:1px solid var(--border)">
    <div class="pagination">
      <a href="?<?= http_build_query(['p'=>max(1,$page-1),'q'=>$search,'role'=>$role,'status'=>$status]) ?>"
         class="page-link <?= $page<=1?'disabled':'' ?>">← Trước</a>
      <?php for ($i=max(1,$page-2); $i<=min($pages,$page+2); $i++): ?>
      <a href="?<?= http_build_query(['p'=>$i,'q'=>$search,'role'=>$role,'status'=>$status]) ?>"
         class="page-link <?= $i===$page?'active':'' ?>"><?= $i ?></a>
      <?php endfor; ?>
      <a href="?<?= http_build_query(['p'=>min($pages,$page+1),'q'=>$search,'role'=>$role,'status'=>$status]) ?>"
         class="page-link <?= $page>=$pages?'disabled':'' ?>">Tiếp →</a>
    </div>
  </div>
  <?php endif; ?>
</div>

<?php layoutFooter(); ?>
