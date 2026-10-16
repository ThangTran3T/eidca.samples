import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, CircleDashed, Scale, ChevronDown, Quote, UserCheck, Info } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { evaluateCompliance, OVERALL, RULE_STATUS, PROFILES } from '../../engines/compliance-engine/index.js';
import { Badge, Callout, SelectField, cn } from '../ui/index.jsx';

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  fail: <XCircle className="h-4 w-4 text-rose-600" />,
  manual: <HelpCircle className="h-4 w-4 text-amber-600" />,
  'not-evaluated': <CircleDashed className="h-4 w-4 text-slate-400" />,
};
const KIND_LABEL = { auto: 'Tự động', heuristic: 'Tự động (diễn giải)', manual: 'Thủ công' };

export function useCompliance(sig) {
  const signatures = useEditor((s) => s.signatures);
  const pageText = useEditor((s) => s.pageText);
  const displayMode = useEditor((s) => s.displayMode);
  const runtimeData = useEditor((s) => s.runtimeData);
  const doc = useEditor((s) => s.doc);
  return useMemo(() => {
    if (!sig) return null;
    const st = useEditor.getState();
    const geoms = doc ? st.pageGeoms() : {};
    return evaluateCompliance({
      template: sig.template,
      signature: doc ? sig : null,
      geom: doc ? geoms[sig.page] : null,
      documentSignatures: signatures,
      pageGeoms: geoms,
      pageText,
      mode: displayMode,
      runtimeData,
    });
  }, [sig, signatures, pageText, displayMode, runtimeData, doc]);
}

export function ComplianceBadge({ report, testId, compact = false }) {
  if (!report) return null;
  const o = OVERALL[report.overall];
  const custom = !report.profile || report.overall === 'non-compliant';
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" data-testid={testId}>
      <Badge tone={o.tone} data-overall={report.overall}>
        {o.label}
      </Badge>
      {custom && !compact && <Badge tone="neutral">Custom Mode</Badge>}
    </span>
  );
}

function RuleRow({ r, sig }) {
  const [open, setOpen] = useState(r.status === 'fail' || r.status === 'manual');
  const att = sig.template.complianceAttestations?.[r.ruleId];
  const canAttest = r.kind === 'manual' && (r.status === 'manual' || r.attested);
  const setAttestation = (confirmed, note = att?.note ?? '') =>
    useEditor.getState().updateTemplate(sig.id, (t) => {
      const next = { ...(t.complianceAttestations ?? {}) };
      if (confirmed) next[r.ruleId] = { confirmed: true, note, at: new Date().toISOString() };
      else delete next[r.ruleId];
      return { complianceAttestations: next };
    });
  return (
    <li className="border-b border-[var(--border)] last:border-0" data-testid={`rule-${r.ruleId}`} data-status={r.status}>
      <button type="button" className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--panel-2)]" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mt-0.5">{STATUS_ICON[r.status]}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium leading-snug">{r.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-[var(--text-subtle)]">
            <span className="font-mono">{r.displayId}</span>·<span>{RULE_STATUS[r.status]}</span>·<span>{r.severity === 'error' ? 'Bắt buộc' : 'Cảnh báo'}</span>·<span>{KIND_LABEL[r.kind]}</span>
            {r.attested && <Badge tone="success">Đã xác nhận</Badge>}
          </span>
        </span>
        <ChevronDown className={cn('mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)] transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3 pl-9 text-[12px]">
          <div className={cn('rounded-md px-2.5 py-1.5', r.status === 'fail' ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-[var(--panel-2)]')}>
            {r.message}
            {r.measured && <div className="mt-0.5 font-mono text-[11px] opacity-80">{r.measured}</div>}
          </div>
          <p className="leading-snug text-[var(--text-muted)]">{r.explanation}</p>
          <div className="rounded-md border border-[var(--border)] px-2.5 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
              <Quote className="h-3 w-3" /> {r.legalRef.document} — {r.legalRef.location}
            </div>
            <blockquote className="text-[11.5px] italic leading-snug text-[var(--text-muted)]">“{r.legalRef.quote}”</blockquote>
          </div>
          <div className="text-[10.5px] text-[var(--text-subtle)]">
            Áp dụng cho: {r.documentType} · Người ký: {r.signerType}
          </div>
          {canAttest && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2 dark:border-amber-800/50 dark:bg-amber-950/30">
              <label className="flex items-center gap-2 text-[12px] font-medium">
                <input type="checkbox" className="accent-brand-600" checked={!!att?.confirmed} onChange={(e) => setAttestation(e.target.checked)} data-testid={`attest-${r.ruleId}`} />
                <UserCheck className="h-3.5 w-3.5" /> Tôi xác nhận đã kiểm tra thủ công
              </label>
              {att?.confirmed && (
                <input
                  className="mt-1.5 h-7 w-full rounded border border-[var(--border-strong)] bg-[var(--panel)] px-2 text-[12px]"
                  placeholder="Ghi chú (người kiểm tra, căn cứ…)"
                  value={att.note}
                  onChange={(e) => setAttestation(true, e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function CompliancePanel({ sig }) {
  const report = useCompliance(sig);
  const doc = useEditor((s) => s.doc);
  if (!sig) return null;
  const st = useEditor.getState;
  const o = OVERALL[report.overall];
  const groups = ['fail', 'manual', 'not-evaluated', 'pass'];
  const sorted = [...report.results].sort((a, b) => groups.indexOf(a.status) - groups.indexOf(b.status));

  return (
    <div className="flex flex-col" data-testid="compliance-panel">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Scale className="h-4 w-4 text-brand-600" /> Nghị định 30/2020/NĐ-CP
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          Kết quả: <ComplianceBadge report={report} testId="compliance-overall" />
        </div>
        <SelectField
          label="Hồ sơ tuân thủ"
          value={sig.template.complianceProfile ?? ''}
          onChange={(v) => st().updateTemplate(sig.id, { complianceProfile: v || null })}
          options={[{ value: '', label: 'Không áp dụng (Custom Mode)' }, ...Object.entries(PROFILES).map(([value, p]) => ({ value, label: `${p.short}: ${p.label}` }))]}
          testId="compliance-profile"
        />
        {!report.profile ? (
          <Callout tone="neutral" icon={<Info className="h-4 w-4" />} title="Chế độ tùy chỉnh (Custom Mode)">
            Mẫu không gắn hồ sơ tuân thủ nên không được đánh giá theo Nghị định 30. Bạn có thể tùy biến tự do; mẫu sẽ không được ghi nhận là tuân thủ.
          </Callout>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                ['pass', 'Đạt', 'text-emerald-600'],
                ['fail', 'Không đạt', 'text-rose-600'],
                ['manual', 'Thủ công', 'text-amber-600'],
                ['not-evaluated', 'Chưa đánh giá', 'text-slate-500'],
              ].map(([key, label, color]) => (
                <div key={key} className="rounded-md bg-[var(--panel-2)] py-1.5">
                  <div className={cn('text-[15px] font-semibold tabular-nums', color)}>{report.counts[key]}</div>
                  <div className="text-[10px] text-[var(--text-subtle)]">{label}</div>
                </div>
              ))}
            </div>
            {report.overall === 'compliant' && (
              <Callout tone="success" icon={<CheckCircle2 className="h-4 w-4" />} testId="compliant-callout">
                Tất cả {report.counts.total} quy tắc áp dụng đã được đánh giá và đạt. Kết quả chỉ xét <em>hình thức hiển thị</em>; giá trị pháp lý phụ thuộc vào chữ ký số hợp lệ và thẩm quyền người ký.
              </Callout>
            )}
            {report.overall === 'non-compliant' && (
              <Callout tone="danger" icon={<XCircle className="h-4 w-4" />} title="Không tuân thủ — đang ở Custom Mode">
                Mẫu vẫn dùng được nhưng không đáp ứng các quy tắc bắt buộc bên dưới.
              </Callout>
            )}
            {report.overall === 'warning' && (
              <Callout tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
                Chưa thể kết luận tuân thủ: còn quy tắc cảnh báo, cần xác nhận thủ công hoặc chưa đủ dữ liệu{!doc ? ' (mở PDF để đánh giá vị trí)' : ''}.
              </Callout>
            )}
          </>
        )}
      </div>
      {report.profile && (
        <ul data-testid="rule-list">
          {sorted.map((r) => (
            <RuleRow key={r.ruleId} r={r} sig={sig} />
          ))}
        </ul>
      )}
    </div>
  );
}
