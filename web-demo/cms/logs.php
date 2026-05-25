<?php
/**
 * EIDCA CMS – Lịch sử hoạt động (User: log của mình)
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/layout.php';

requireLogin();
$user = currentUser();
$uid  = $user['id'];

// Pagination & filter
$page    = max(1, (int)($_GET['p']      ?? 1));
$perPage = 20;
$offset  = ($page - 1) * $perPage;
$type    = $_GET['type']   ?? '';
$search  = trim($_GET['q'] ?? '');

// Build WHERE (user only sees own logs)
$where  = 'WHERE l.user_id = ?';
$params = [$uid];

if ($type) { $where .= ' AND l.action_type = ?'; $params[] = $type; }

// Count
$total = DB::row("SELECT COUNT(*) c FROM activity_logs l $where", $params)['c'] ?? 0;
$pages = (int)ceil($total / $perPage);

// Fetch
$params[] = $perPage; $params[] = $offset;
$logs = DB::rows(
    "SELECT l.* FROM activity_logs l $where ORDER BY l.created_at DESC LIMIT ? OFFSET ?",
    $params
);

$actionTypes = DB::rows(
    "SELECT DISTINCT action_type FROM activity_logs WHERE user_id=? ORDER BY action_type",
    [$uid]
);

layoutHeader('Lịch sử hoạt động', 'logs');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Lịch sử hoạt động</h1>
    <p>Tất cả các thao tác trên tài khoản của bạn.</p>
  </div>
  <div style="font-size:13.5px;color:var(--text-3)">
    <?= number_format($total) ?> bản ghi
  </div>
</div>

<!-- Filter -->
<div class="card" style="margin-bottom:0">
  <form method="GET" style="display:contents">
    <div class="filter-bar">
      <input type="text" name="q" class="form-control" placeholder="🔍 Tìm kiếm nhanh…" value="<?= e($search) ?>" id="logSearch"/>
      <select name="type" class="form-control">
        <option value="">Tất cả loại</option>
        <?php foreach ($actionTypes as $at):
          [$lbl] = actionLabel($at['action_type']); ?>
        <option value="<?= e($at['action_type']) ?>" <?= $type===$at['action_type'] ? 'selected' : '' ?>>
          <?= $lbl ?>
        </option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn btn-secondary btn-sm">Lọc</button>
      <?php if ($type || $search): ?>
      <a href="logs.html" class="btn btn-secondary btn-sm">✕ Xóa bộ lọc</a>
      <?php endif; ?>
    </div>
  </form>

  <div class="table-wrap">
    <?php if (empty($logs)): ?>
    <div class="card-body">
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>Không có bản ghi nào</h3>
        <p>Thực hiện đăng ký hoặc ký số để tạo log.</p>
      </div>
    </div>
    <?php else: ?>
    <table>
      <thead><tr>
        <th>Hành động</th>
        <th>Thông tin kèm</th>
        <th>IP</th>
        <th>Thời gian</th>
      </tr></thead>
      <tbody>
        <?php foreach ($logs as $log):
          [$label, $cls] = actionLabel($log['action_type']);
          $payload = $log['payload_json'] ? json_decode($log['payload_json'], true) : [];
          // Build searchable text for client-side filter
          $searchText = $log['action_type'] . ' ' . ($log['ip'] ?? '') . ' ' . json_encode($payload);
        ?>
        <tr data-searchable="<?= e($searchText) ?>">
          <td><span class="badge <?= $cls ?>"><?= $label ?></span></td>
          <td style="max-width:320px">
            <?php if ($payload): ?>
            <div style="font-size:12px;color:var(--text-3);line-height:1.6">
              <?php foreach ($payload as $k => $v): ?>
              <span style="font-weight:600"><?= e($k) ?>:</span>
              <?= e(is_array($v) ? json_encode($v) : (string)$v) ?> &nbsp;
              <?php endforeach; ?>
            </div>
            <?php else: ?>
            <span style="color:var(--text-3);font-size:12px">—</span>
            <?php endif; ?>
          </td>
          <td class="td-mono" style="font-size:12px"><?= e($log['ip'] ?? '—') ?></td>
          <td style="font-size:12.5px;color:var(--text-3);white-space:nowrap"><?= fmtDate($log['created_at']) ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>
  </div>

  <?php if ($pages > 1): ?>
  <div style="padding:1rem 1.5rem;border-top:1px solid var(--border)">
    <div class="pagination">
      <a href="?<?= http_build_query(['p'=>max(1,$page-1),'type'=>$type,'q'=>$search]) ?>"
         class="page-link <?= $page<=1 ? 'disabled' : '' ?>">← Trước</a>
      <?php for ($i=max(1,$page-2); $i<=min($pages,$page+2); $i++): ?>
      <a href="?<?= http_build_query(['p'=>$i,'type'=>$type,'q'=>$search]) ?>"
         class="page-link <?= $i===$page ? 'active' : '' ?>"><?= $i ?></a>
      <?php endfor; ?>
      <a href="?<?= http_build_query(['p'=>min($pages,$page+1),'type'=>$type,'q'=>$search]) ?>"
         class="page-link <?= $page>=$pages ? 'disabled' : '' ?>">Tiếp →</a>
      <span style="font-size:12.5px;color:var(--text-3);margin-left:.5rem">Trang <?= $page ?>/<?= $pages ?></span>
    </div>
  </div>
  <?php endif; ?>
</div>

<?php layoutFooter(); ?>
