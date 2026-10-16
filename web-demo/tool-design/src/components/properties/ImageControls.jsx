import { useState } from 'react';
import { Upload, Eraser, Plus, AlertTriangle } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { processImage, removeWhiteBackground, IMAGE_ACCEPT } from '../../services/image-service.js';
import { openFilePicker } from '../../stores/ui-store.js';
import { ELEMENT_CATALOG, ROLES } from '../../engines/template-engine/index.js';
import { Button, Badge, Callout, Spinner } from '../ui/index.jsx';

const COLOR_LABEL = { red: 'đỏ', blue: 'xanh', black: 'đen', green: 'xanh lá', other: 'khác', none: '—' };

export function useImageUpload(sigId, elId) {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      useEditor.getState().updateElement(sigId, elId, { image: { src: r.src, naturalWidth: r.naturalWidth, naturalHeight: r.naturalHeight, analysis: r.analysis, fileName: r.fileName ?? '', isSpecimen: false } });
    } catch (err) {
      useEditor.getState().toast(err.message ?? String(err), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    upload: () => openFilePicker(IMAGE_ACCEPT, (f) => run(() => processImage(f))),
    uploadFile: (f) => run(() => processImage(f)),
    removeBackground: (src) => run(() => removeWhiteBackground(src)),
  };
}

export function ImageAnalysis({ image }) {
  const a = image.analysis;
  if (!image.src) return null;
  return (
    <div className="flex flex-wrap gap-1" data-testid="image-analysis">
      <Badge tone={image.src.startsWith('data:image/png') ? 'success' : 'warning'}>{image.src.startsWith('data:image/png') ? 'PNG' : 'JPEG'}</Badge>
      {a && <Badge tone={a.cornersTransparent ? 'success' : 'warning'}>{a.cornersTransparent ? 'Nền trong suốt' : 'Nền không trong suốt'}</Badge>}
      {a && <Badge tone="neutral">Màu chủ đạo: {COLOR_LABEL[a.dominantColor] ?? a.dominantColor}</Badge>}
      {image.naturalWidth > 0 && (
        <Badge tone="neutral">
          {image.naturalWidth}×{image.naturalHeight}px
        </Badge>
      )}
    </div>
  );
}

/** Quick slots for hand-signature / seal / logo on the signature level (Appearance section). */
export function ImageSlots({ sig }) {
  const roles = ['hand-signature', 'seal', 'logo'];
  return (
    <div className="flex flex-col gap-2" data-testid="image-slots">
      <div className="text-[11.5px] font-medium text-[var(--text-muted)]">Ảnh chữ ký, con dấu, logo</div>
      {roles.map((role) => (
        <ImageSlot key={role} sig={sig} role={role} />
      ))}
    </div>
  );
}

function ImageSlot({ sig, role }) {
  const el = sig.template.elements.find((e) => e.type === 'image' && e.role === role);
  const st = useEditor.getState;
  const up = useImageUpload(sig.id, el?.id);
  if (!el) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="justify-start"
        onClick={() => {
          const item = ELEMENT_CATALOG.find((c) => c.key === role);
          const e = item.make(sig.template.size);
          e.width = Math.min(e.width, sig.template.size.width);
          e.height = Math.min(e.height, sig.template.size.height);
          st().addElement(sig.id, e);
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Thêm {ROLES[role].toLowerCase()}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] p-1.5">
      <button type="button" onClick={() => st().select(sig.id, el.id)} className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-[var(--panel-2)]" style={{ backgroundImage: 'repeating-conic-gradient(#eef0f4 0% 25%, #fff 0% 50%)', backgroundSize: '8px 8px' }} aria-label={`Chọn ${ROLES[role]}`}>
        {el.image.src ? <img src={el.image.src} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-[var(--text-subtle)]">trống</span>}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px]">{ROLES[role]}</div>
        {el.image.isSpecimen && <div className="text-[10.5px] text-amber-600">Ảnh MẪU — hãy thay ảnh thật</div>}
      </div>
      <Button size="sm" onClick={up.upload} disabled={up.busy} data-testid={`slot-upload-${role}`}>
        {up.busy ? <Spinner className="h-3 w-3" /> : <Upload className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function ImageElementControls({ sig, el }) {
  const up = useImageUpload(sig.id, el.id);
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] p-2"
        style={{ backgroundImage: 'repeating-conic-gradient(#eef0f4 0% 25%, #fff 0% 50%)', backgroundSize: '12px 12px' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) up.uploadFile(f);
        }}
      >
        {el.image.src ? <img src={el.image.src} alt={el.name} className="max-h-full max-w-full object-contain" /> : <span className="text-[11.5px] text-[var(--text-subtle)]">Kéo thả ảnh vào đây</span>}
      </div>
      <ImageAnalysis image={el.image} />
      {el.image.isSpecimen && (
        <Callout tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
          Đây là ảnh MẪU của công cụ, không có giá trị. Hãy tải ảnh {ROLES[el.role]?.toLowerCase()} thật.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={up.upload} disabled={up.busy} data-testid="image-upload">
          {up.busy ? <Spinner className="h-3 w-3" /> : <Upload className="h-3.5 w-3.5" />} {el.image.src ? 'Thay ảnh' : 'Tải ảnh lên'}
        </Button>
        {el.image.src && (
          <Button size="sm" onClick={() => up.removeBackground(el.image.src)} disabled={up.busy} title="Biến điểm ảnh gần trắng thành trong suốt (ảnh quét)">
            <Eraser className="h-3.5 w-3.5" /> Xóa nền trắng
          </Button>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-subtle)]">PNG, JPEG, WebP, GIF hoặc SVG (SVG được làm sạch và chuyển sang PNG). Tối đa 10 MB. Ảnh chỉ xử lý trong trình duyệt.</p>
    </div>
  );
}
