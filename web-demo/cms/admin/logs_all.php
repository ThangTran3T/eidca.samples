<?php
/**
 * EIDCA CMS – Admin: Xem TẤT CẢ log (tất cả users)
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/layout.php';

requireAdmin();

$page    = max(1, (int)($_GET['p']      ?? 1));
$perPage = 30;
$type    = $_GET['type']   ?? '';
$uid_f   = (int)($_GET['uid']    ?? 0);
$date_f  = $_GET['date']   ?? '';
$search  = trim($_GET['q'] ?? '');

$where  = 'WHERE 1';
$params = [];
if ($type)   { $where .= ' AND l.action_type=?'; $params[] = $type; }
if ($uid_f)  { $where .= ' AND l.user_id=?';     $params[] = $uid_f; }
if ($date_f) { $where .= ' AND DATE(l.created_at)=?'; $params[] = $date_f; }

$total = DB::row("SELECT COUNT(*) c FROM activity_logs l $where", $params)['c'] ?? 0;
$pages = (int)ceil($total / $perPage);
$params[] = $perPage; $params[] = ($page-1)*$perPage;

$logs = DB::rows(
    "SELECT l.*, u.username FROM activity_logs l
     LEFT JOIN users u ON u.id=l.user_id
     $where ORDER BY l.created_at DESC LIMIT ? OFFSET ?",
    $params
);

$actionTypes = DB::rows("SELECT DISTINCT action_type FROM activity_logs ORDER BY action_type");
$users = DB::rows("SELECT id, username FROM users ORDER BY username");

layoutHeader('Tất cả Log', 'admin_logs');
?>

<div class="page-header">
  <div class="page-header-left">
    <h1>Log toàn hệ thống</h1>
    <p><?= number_format($total) ?> bản ghi tổng cộng.</p>
  </div>
</div>

<div class="card">
  <form method="GET" style="display:contents">
    <div class="filter-bar">
      <input type="text" name="q" class="form-control" id="logSearch"
             placeholder="🔍 Tìm nhanh…" value="<?= e($search) ?>"/>
      <select name="type" class="form-control">
        <option value="">Tất cả loại</option>
        <?php foreach ($actionTypes as $at):
          [$lbl] = actionLabel($at['action_type']); ?>
        <option value="<?= e($at['action_type']) ?>" <?= $type===$at['action_type']?'selected':'' ?>>
          <?= $lbl ?>
        </option>
        <?php endforeach; ?>
      </select>
      <select name="uid" class="form-control">
        <option value="">Tất cả users</option>
        <?php foreach ($users as $u): ?>
        <option value="<?= $u['id'] ?>" <?= $uid_f===$u['id']?'selected':'' ?>><?= e($u['username']) ?></option>
        <?php endforeach; ?>
      </select>
      <input type="date" name="date" class="form-control" value="<?= e($date_f) ?>" style="max-width:160px"/>
      <button type="submit" class="btn btn-secondary btn-sm">Lọc</button>
      <?php if ($type||$uid_f||$date_f||$search): ?>
      <a href="logs_all.html" class="btn btn-secondary btn-sm">✕ Xóa</a>
      <?php endif; ?>
    </div>
  </form>

  <div class="table-wrap">
    <?php if (empty($logs)): ?>
    <div class="card-body">
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>Không có bản ghi</h3>
      </div>
    </div>
    <?php else: ?>
    <table>
      <thead><tr>
        <th>ID</th>
        <th>User</th>
        <th>Hành động</th>
        <th>Payload</th>
        <th>IP</th>
        <th>Thời gian</th>
      </tr></thead>
      <tbody>
        <?php foreach ($logs as $log):
          [$label, $cls] = actionLabel($log['action_type']);
          $payload = $log['payload_json'] ? json_decode($log['payload_json'], true) : [];
          $searchText = ($log['username']??'') . ' ' . $log['action_type'] . ' ' . ($log['ip']??'');
        ?>
        <tr data-searchable="<?= e($searchText) ?>">
          <td class="td-mono" style="font-size:11.5px;color:var(--text-3)">#<?= $log['id'] ?></td>
          <td>
            <?php if ($log['user_id']): ?>
            <a href="?uid=<?= $log['user_id'] ?>" style="color:var(--accent);font-weight:600;text-decoration:none;font-size:13px">
              <?= e($log['username'] ?? '#'.$log['user_id']) ?>
            </a>
            <?php else: ?>
            <span style="color:var(--text-3);font-size:12px">—</span>
            <?php endif; ?>
          </td>
          <td><span class="badge <?= $cls ?>"><?= $label ?></span></td>
          <td style="max-width:280px">
            <?php if ($payload): ?>
            <div style="font-size:11.5px;color:var(--text-3);line-height:1.6">
              <?php foreach ($payload as $k => $v): ?>
              <span style="font-weight:600;color:var(--text-2)"><?= e($k) ?>:</span>
              <?= e(truncate((string)$v, 50)) ?> &nbsp;
              <?php endforeach; ?>
            </div>
            <?php else: ?>—<?php endif; ?>
          </td>
          <td class="td-mono" style="font-size:11.5px"><?= e($log['ip'] ?? '—') ?></td>
          <td style="font-size:12px;color:var(--text-3);white-space:nowrap"><?= fmtDate($log['created_at']) ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>
  </div>

  <?php if ($pages > 1): ?>
  <div style="padding:1rem 1.5rem;border-top:1px solid var(--border)">
    <div class="pagination">
      <a href="?<?= http_build_query(['p'=>max(1,$page-1),'type'=>$type,'uid'=>$uid_f,'date'=>$date_f,'q'=>$search]) ?>"
         class="page-link <?= $page<=1?'disabled':'' ?>">← Trước</a>
      <?php for ($i=max(1,$page-2); $i<=min($pages,$page+2); $i++): ?>
      <a href="?<?= http_build_query(['p'=>$i,'type'=>$type,'uid'=>$uid_f,'date'=>$date_f,'q'=>$search]) ?>"
         class="page-link <?= $i===$page?'active':'' ?>"><?= $i ?></a>
      <?php endfor; ?>
      <a href="?<?= http_build_query(['p'=>min($pages,$page+1),'type'=>$type,'uid'=>$uid_f,'date'=>$date_f,'q'=>$search]) ?>"
         class="page-link <?= $page>=$pages?'disabled':'' ?>">Tiếp →</a>
      <span style="font-size:12px;color:var(--text-3);margin-left:.5rem">Trang <?= $page ?>/<?= $pages ?></span>
    </div>
  </div>
  <?php endif; ?>
</div>

<?php layoutFooter(); ?>
