import { useEffect, useState } from 'react';
import { useEditor, selectSelectedSignature } from '../../../stores/editor-store.js';
import { Dialog, Button, TextField, TextAreaField, Callout, Kbd, Grid2 } from '../../ui/index.jsx';
import { DEFAULT_SAMPLE_DATA, clone, COPY_FORMS } from '../../../engines/template-engine/index.js';
import { exportTemplateJson } from '../../../features/export/export-actions.js';

const FIELDS = [
  ['signer', 'name', 'Họ tên người ký'],
  ['signer', 'title', 'Chức vụ'],
  ['signer', 'organization', 'Cơ quan/tổ chức'],
  ['certificate', 'subject', 'Chủ thể chứng thư (subject)'],
  ['certificate', 'issuer', 'Tổ chức cấp chứng thư'],
  ['certificate', 'serial', 'Số hiệu chứng thư'],
  ['signing', 'timestamp', 'Thời điểm ký (ISO 8601)'],
  ['signing', 'reason', 'Lý do ký'],
  ['signing', 'location', 'Nơi ký'],
  ['document', 'name', 'Tên tài liệu'],
  ['document', 'number', 'Số, ký hiệu văn bản'],
  ['transaction', 'id', 'Mã giao dịch'],
  ['copy', 'form', `Hình thức sao (${COPY_FORMS.join(' / ')})`],
  ['copy', 'organization', 'Cơ quan sao văn bản'],
];

/** Runtime data used by the "Dữ liệu thực tế" preview mode. Kept in memory only. */
export function RuntimeDataDialog({ open, onOpenChange }) {
  const runtimeData = useEditor((s) => s.runtimeData);
  const [draft, setDraft] = useState(runtimeData);
  useEffect(() => {
    if (open) setDraft(clone(runtimeData));
  }, [open, runtimeData]);
  const set = (g, k, v) => setDraft((d) => ({ ...d, [g]: { ...(d[g] ?? {}), [k]: v } }));
  const tsInvalid = draft.signing?.timestamp && Number.isNaN(new Date(draft.signing.timestamp).getTime());
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dữ liệu xem trước (thực tế)"
      description="Dùng ở chế độ “Dữ liệu thực tế” để kiểm tra mẫu với dữ liệu thật. Dữ liệu chỉ nằm trong bộ nhớ trình duyệt, không được lưu hay gửi đi."
      testId="runtime-dialog"
      footer={
        <>
          <Button onClick={() => setDraft(clone(DEFAULT_SAMPLE_DATA))}>Điền dữ liệu mẫu</Button>
          <Button
            variant="primary"
            disabled={tsInvalid}
            data-testid="runtime-apply"
            onClick={() => {
              useEditor.getState().setRuntimeData(draft);
              useEditor.getState().setDisplayMode('runtime');
              onOpenChange(false);
            }}
          >
            Áp dụng
          </Button>
        </>
      }
    >
      <Grid2>
        {FIELDS.map(([g, k, label]) => (
          <TextField key={`${g}.${k}`} label={label} value={draft[g]?.[k] ?? ''} onChange={(v) => set(g, k, v)} testId={`rt-${g}-${k}`} hint={g === 'signing' && k === 'timestamp' ? (tsInvalid ? 'Không phải thời điểm hợp lệ.' : 'Ví dụ 2026-10-17T08:15:00+07:00') : undefined} />
        ))}
      </Grid2>
    </Dialog>
  );
}

export function SaveTemplateDialog({ open, onOpenChange }) {
  const sig = useEditor(selectSelectedSignature);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (open && sig) {
      setName(sig.template.name);
      setDescription(sig.template.description);
    }
  }, [open, sig]);
  if (!sig) return null;
  const build = () => ({ ...sig.template, name: name.trim() || sig.template.name, description, category: sig.template.complianceProfile ? 'nd30' : sig.template.category === 'nd30' ? 'custom' : sig.template.category });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lưu mẫu chữ ký"
      description="Mẫu được lưu trong trình duyệt này (localStorage) để dùng lại. Ảnh dấu/chữ ký trong mẫu cũng được lưu — chỉ lưu trên máy tin cậy."
      testId="save-template-dialog"
      footer={
        <>
          <Button onClick={() => exportTemplateJson(build())}>Tải tệp mẫu .json</Button>
          <Button
            variant="primary"
            data-testid="save-template-confirm"
            onClick={() => {
              const ok = useEditor.getState().saveCustomTemplate(build());
              useEditor.getState().toast(ok ? `Đã lưu mẫu “${build().name}”.` : 'Không lưu được: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Hãy tải tệp mẫu .json.', ok ? 'success' : 'danger');
              if (ok) onOpenChange(false);
            }}
          >
            Lưu vào “Mẫu của tôi”
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Tên mẫu" value={name} onChange={setName} testId="save-template-name" />
        <TextAreaField label="Mô tả" value={description} onChange={setDescription} rows={3} />
        {sig.template.complianceProfile && (
          <Callout tone="info">Mẫu giữ hồ sơ tuân thủ “{sig.template.complianceProfile}”. Các xác nhận thủ công đã thực hiện cũng được lưu kèm.</Callout>
        )}
      </div>
    </Dialog>
  );
}

const SHORTCUTS = [
  ['Ctrl + O', 'Mở PDF'],
  ['Ctrl + S', 'Lưu mẫu chữ ký đang chọn'],
  ['Ctrl + E', 'Xuất JSON'],
  ['Ctrl + Z', 'Hoàn tác'],
  ['Ctrl + Shift + Z / Ctrl + Y', 'Làm lại'],
  ['Ctrl + D', 'Nhân bản chữ ký / phần tử'],
  ['Delete / Backspace', 'Xóa mục đang chọn'],
  ['← ↑ → ↓', 'Di chuyển 1 pt (Shift: 10 pt)'],
  ['Enter', 'Chọn phần tử đầu tiên trong chữ ký'],
  ['Esc', 'Thoát chọn phần tử / bỏ chọn'],
  ['[  /  ]', 'Đưa phần tử xuống / lên một lớp'],
  ['Ctrl + = / Ctrl + −', 'Phóng to / thu nhỏ'],
  ['Ctrl + 0', 'Đặt lại khung nhìn (100%)'],
  ['Ctrl + cuộn chuột', 'Phóng to/thu nhỏ quanh con trỏ'],
  ['1 / 2 / 3', 'Chế độ: Mẫu / Trên PDF / PDF kết xuất'],
  ['G', 'Bật/tắt lưới'],
  ['?', 'Bảng phím tắt'],
];

export function ShortcutsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Phím tắt" width="max-w-lg" testId="shortcuts-dialog">
      <table className="w-full text-[12.5px]">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 pr-4">
                <Kbd>{k}</Kbd>
              </td>
              <td className="py-1.5 text-[var(--text-muted)]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
