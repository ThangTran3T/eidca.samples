import { useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, Button, TextAreaField, Segmented, Callout } from '../../ui/index.jsx';
import { importJsonText } from '../../../features/export/export-actions.js';
import { MAX_JSON_BYTES } from '../../../features/export/designer-io.js';

const KIND_LABEL = { designer: 'Designer JSON', template: 'Tệp mẫu chữ ký', legacy: 'VNeCA sign_props (legacy)', unknown: 'Không xác định' };

export function ImportDialog({ open, onOpenChange }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('add');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const run = async (content) => {
    setBusy(true);
    try {
      setReport(await importJsonText(content, { replace: mode === 'replace' }));
    } catch (err) {
      setReport({ kind: 'unknown', ok: false, imported: 0, warnings: [], errors: [err.message] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setReport(null);
          setText('');
        }
      }}
      title="Nhập JSON"
      description="Hỗ trợ Designer JSON, tệp mẫu chữ ký và VNeCA sign_props (object, mảng, chuỗi multipart hoặc payload có trường sign_props)."
      testId="import-dialog"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button variant="primary" disabled={!text.trim() || busy} onClick={() => run(text)} data-testid="import-run">
            Nhập nội dung đã dán
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5" /> Chọn tệp .json
          </Button>
          <Segmented
            label="Cách nhập"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: 'Thêm vào tài liệu' },
              { value: 'replace', label: 'Thay thế tất cả' },
            ]}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > MAX_JSON_BYTES) return setReport({ kind: 'unknown', ok: false, imported: 0, warnings: [], errors: ['Tệp quá lớn (tối đa 25 MB).'] });
              run(await f.text());
            }}
          />
        </div>
        <TextAreaField label="Hoặc dán JSON" rows={7} mono value={text} onChange={setText} testId="import-text" />
        {report && (
          <div className="flex flex-col gap-2" data-testid="import-report">
            <Callout tone={report.ok ? 'success' : 'danger'} icon={report.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} title={report.ok ? `Đã nhập ${report.imported} mục (${KIND_LABEL[report.kind]})` : 'Không nhập được'}>
              {report.errors.length > 0 && (
                <ul className="ml-4 list-disc">
                  {report.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </Callout>
            {report.warnings.length > 0 && (
              <Callout tone="warning" icon={<AlertTriangle className="h-4 w-4" />} title="Lưu ý">
                <ul className="ml-4 list-disc">
                  {report.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </Callout>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
