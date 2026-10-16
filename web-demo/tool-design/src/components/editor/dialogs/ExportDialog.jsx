import { useMemo, useState } from 'react';
import { Copy, Download, FileJson, AlertTriangle, Info, Check } from 'lucide-react';
import { useEditor } from '../../../stores/editor-store.js';
import { Dialog, Button, Tabs, TabsList, TabsTrigger, TabsContent, Switch, Segmented, Callout, Badge } from '../../ui/index.jsx';
import { buildLegacyExport, exportDesignerJson, downloadText, slug } from '../../../features/export/export-actions.js';
import { getAdapter } from '../../../adapters/index.js';

export function ExportDialog({ open, onOpenChange, initialTab = 'legacy' }) {
  const signatures = useEditor((s) => s.signatures);
  const docName = useEditor((s) => s.doc?.name);
  const [tab, setTab] = useState(initialTab);
  const [integer, setInteger] = useState(true);
  const [variant, setVariant] = useState('pretty');
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const adapter = getAdapter('vneca-legacy');

  const legacy = useMemo(() => (open && signatures.length ? buildLegacyExport({ integerCoordinates: integer }) : null), [open, signatures, integer]);
  const text = legacy ? adapter.serialize(legacy.payload, variant) : '';
  const grouped = useMemo(() => {
    const m = new Map();
    for (const w of legacy?.warnings ?? []) {
      const k = w.signatureName ?? w.signatureId;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(w);
    }
    return [...m.entries()];
  }, [legacy]);
  const warnCount = legacy?.warnings.length ?? 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      useEditor.getState().toast('Trình duyệt không cho phép sao chép — hãy tải tệp.', 'warning');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setAcknowledged(false);
      }}
      title="Xuất JSON"
      description="Designer JSON giữ toàn bộ thiết kế; VNeCA sign_props là cấu hình vị trí/hình thức gửi cho dịch vụ ký."
      width="max-w-3xl"
      testId="export-dialog"
    >
      {!signatures.length ? (
        <Callout tone="warning">Chưa có chữ ký nào để xuất.</Callout>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="-mx-5 -mt-4 mb-4 px-3">
            <TabsTrigger value="legacy" testId="tab-legacy">
              VNeCA sign_props {warnCount > 0 && <Badge tone="warning">{warnCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="designer" testId="tab-designer">
              Designer JSON
            </TabsTrigger>
          </TabsList>
          <TabsContent value="legacy" className="flex flex-col gap-3">
            <Callout tone="info" icon={<Info className="h-4 w-4" />}>
              Định dạng legacy chỉ chứa vùng chữ ký (<code>page, lLx, lLy, width, height</code> theo điểm PDF, gốc dưới-trái), bố cục <code>template</code>, danh sách <code>show_info</code>, một màu chữ, một cỡ chữ và tối đa hai ảnh. Hệ thống ký VNeCA tự dàn trang
              phần hiển thị — kết quả có thể khác bản thiết kế.
            </Callout>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-64">
                <Switch label="Làm tròn tọa độ tới số nguyên" checked={integer} onChange={setInteger} testId="legacy-integer" />
              </div>
              <Segmented
                label="Kiểu dữ liệu"
                value={variant}
                onChange={setVariant}
                options={[
                  { value: 'pretty', label: 'JSON body' },
                  { value: 'compact', label: 'Rút gọn' },
                  { value: 'multipart', label: 'Chuỗi multipart', title: 'sign_props là chuỗi JSON khi gửi multipart/form-data' },
                ]}
              />
            </div>
            {warnCount > 0 && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30" data-testid="legacy-warnings">
                <div className="flex items-center gap-2 border-b border-amber-200/70 px-3 py-2 text-[12.5px] font-semibold text-amber-900 dark:border-amber-800/50 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> {warnCount} tính năng không được schema legacy hỗ trợ — sẽ không xuất hiện hoặc hiển thị khác khi ký
                </div>
                <div className="scroll-thin max-h-48 overflow-y-auto px-3 py-2">
                  {grouped.map(([name, list]) => (
                    <div key={name} className="mb-2">
                      <div className="text-[11.5px] font-semibold text-amber-900 dark:text-amber-200">{name}</div>
                      <ul className="ml-4 list-disc text-[12px] text-amber-900/90 dark:text-amber-100/80">
                        {list.map((w, i) => (
                          <li key={i}>
                            {w.message} <span className="font-mono text-[10px] opacity-60">[{w.code}]</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 border-t border-amber-200/70 px-3 py-2 text-[12px] dark:border-amber-800/50">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} data-testid="legacy-ack" className="accent-brand-600" />
                  Tôi đã hiểu các phần không được hỗ trợ.
                </label>
              </div>
            )}
            <pre className="scroll-thin max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 font-mono text-[11.5px] leading-relaxed" data-testid="legacy-json">
              {text.length > 60000 ? `${text.slice(0, 60000)}\n… (rút gọn khi hiển thị; tệp tải xuống đầy đủ)` : text}
            </pre>
            <div className="flex justify-end gap-2">
              <Button onClick={copy} disabled={warnCount > 0 && !acknowledged}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Sao chép
              </Button>
              <Button
                variant="primary"
                disabled={warnCount > 0 && !acknowledged}
                data-testid="download-legacy"
                onClick={() => downloadText(variant === 'multipart' ? text : adapter.serialize(legacy.payload, variant), adapter.fileName(slug(docName?.replace(/\.pdf$/i, '') || 'tai-lieu')))}
              >
                <Download className="h-3.5 w-3.5" /> Tải sign_props.json
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="designer" className="flex flex-col gap-3">
            <Callout tone="success" icon={<FileJson className="h-4 w-4" />}>
              Designer JSON chứa đầy đủ thông tin từng phần tử, ảnh (data URL), ràng buộc biến và hồ sơ tuân thủ — nhập lại sẽ dựng lại chính xác thiết kế. Tệp <strong>không</strong> chứa nội dung PDF.
            </Callout>
            <div className="text-[12.5px] text-[var(--text-muted)]">
              {signatures.length} chữ ký · {signatures.reduce((n, s) => n + s.template.elements.length, 0)} phần tử
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={exportDesignerJson} data-testid="download-designer">
                <Download className="h-3.5 w-3.5" /> Tải Designer JSON
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Dialog>
  );
}
