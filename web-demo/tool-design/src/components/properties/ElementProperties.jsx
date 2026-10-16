import { ArrowLeft, Move, Type, Image as ImageIcon, QrCode, Square, Settings2, Copy, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Braces, AlertTriangle } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { ROLES, VARIABLES, CONDITION_OPERATORS, unknownVariables, resolveTemplate } from '../../engines/template-engine/index.js';
import { FONT_FAMILIES } from '../../engines/rendering-engine/fonts.js';
import { pointsToMm } from '../../engines/coordinate-engine/index.js';
import { fontRegistry } from '../../services/font-service.js';
import { Section, TextField, TextAreaField, NumberField, SelectField, ColorField, Switch, SliderField, Grid2, Segmented, Button, Badge, Callout, Menu, MenuTrigger, MenuContent, MenuItem } from '../ui/index.jsx';
import { ImageElementControls } from './ImageControls.jsx';

const TYPE_LABEL = { text: 'Văn bản', image: 'Hình ảnh', qr: 'Mã QR', rect: 'Hình chữ nhật', line: 'Đường kẻ' };
const ROLE_OPTIONS = {
  text: ['text', 'signer-name', 'signer-title', 'organization', 'subject', 'signing-date', 'signing-time', 'signing-datetime', 'reason', 'location', 'contact', 'issuer', 'serial', 'copy-info', 'document-number'],
  image: ['hand-signature', 'seal', 'logo', 'background'],
  qr: ['qr'],
  rect: ['shape'],
  line: ['line'],
};

function VariableMenu({ onInsert }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" variant="subtle" data-testid="insert-variable">
          <Braces className="h-3.5 w-3.5" /> Chèn biến
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        <div className="scroll-thin max-h-72 overflow-y-auto">
          {VARIABLES.map((v) => (
            <MenuItem key={v.key} onSelect={() => onInsert(`{{${v.key}}}`)} testId={`var-${v.key}`}>
              <span className="font-mono text-[11px] text-brand-700 dark:text-brand-300">{`{{${v.key}}}`}</span>
              <span className="ml-2 text-[var(--text-subtle)]">{v.label}</span>
            </MenuItem>
          ))}
        </div>
      </MenuContent>
    </Menu>
  );
}

export function ElementProperties({ sig, el }) {
  const st = useEditor.getState;
  const displayMode = useEditor((s) => s.displayMode);
  const runtimeData = useEditor((s) => s.runtimeData);
  const k = (f) => `${el.id}:${f}`;
  const up = (patch, key) => st().updateElement(sig.id, el.id, patch, { key: key ? k(key) : undefined });
  const upText = (patch, key) => up({ text: patch }, key);
  const item = el.type === 'text' ? resolveTemplate({ ...sig.template, elements: [el] }, { mode: displayMode, runtimeData, measure: fontRegistry.measure }).items[0] : null;
  const unknown = el.type === 'text' ? unknownVariables(el.text.content) : el.type === 'qr' ? unknownVariables(el.qr.content) : [];

  return (
    <div data-testid="element-properties">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <button type="button" onClick={() => st().select(sig.id, null)} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]" data-testid="back-to-signature">
          <ArrowLeft className="h-3.5 w-3.5" /> {sig.name}
        </button>
        <span className="text-[var(--text-subtle)]">/</span>
        <Badge tone="brand">{TYPE_LABEL[el.type]}</Badge>
      </div>

      <Section title="Phần tử" icon={<Move className="h-3.5 w-3.5" />} testId="section-element">
        <TextField label="Tên" value={el.name} onChange={(v) => up({ name: v }, 'name')} testId="el-name" />
        <SelectField label="Vai trò (dùng cho xuất legacy và kiểm tra tuân thủ)" value={el.role} onChange={(v) => up({ role: v })} options={ROLE_OPTIONS[el.type].map((r) => ({ value: r, label: ROLES[r] }))} testId="el-role" />
        <Grid2>
          <NumberField label="X" unit="pt" value={el.x} step={1} onCommit={(v) => up({ x: v })} disabled={el.locked} testId="el-x" />
          <NumberField label="Y" unit="pt" value={el.y} step={1} onCommit={(v) => up({ y: v })} disabled={el.locked} testId="el-y" />
          <NumberField
            label="Rộng"
            unit="pt"
            value={el.width}
            min={1}
            step={1}
            onCommit={(v) => up(el.lockAspectRatio && el.width ? { width: v, height: (el.height * v) / el.width } : { width: v })}
            disabled={el.locked}
            testId="el-width"
          />
          <NumberField
            label="Cao"
            unit="pt"
            value={el.height}
            min={0}
            step={1}
            onCommit={(v) => up(el.lockAspectRatio && el.height ? { height: v, width: (el.width * v) / el.height } : { height: v })}
            disabled={el.locked}
            testId="el-height"
          />
          <NumberField label="Xoay" unit="°" value={el.rotation} min={-360} max={360} step={1} onCommit={(v) => up({ rotation: v })} disabled={el.locked} />
          <SliderField label="Độ mờ" value={el.opacity} onChange={(v) => up({ opacity: v }, 'opacity')} />
        </Grid2>
        <p className="-mt-1 text-[11px] text-[var(--text-subtle)]">Tọa độ trong khung chữ ký, gốc trên-trái. {Math.round(pointsToMm(el.width) * 10) / 10} × {Math.round(pointsToMm(el.height) * 10) / 10} mm.</p>
        <Switch label="Hiển thị" checked={el.visible !== false} onChange={(v) => up({ visible: v })} testId="el-visible" />
        <Switch label="Khóa vị trí" checked={!!el.locked} onChange={(v) => up({ locked: v })} testId="el-locked" />
        <Switch label="Khóa tỉ lệ" checked={!!el.lockAspectRatio} onChange={(v) => up({ lockAspectRatio: v })} testId="el-lock-ratio" />
        <Grid2>
          <SelectField
            label="Ràng buộc ngang"
            value={el.constraints.horizontal}
            onChange={(v) => up({ constraints: { ...el.constraints, horizontal: v } })}
            options={[
              { value: 'left', label: 'Bám trái' },
              { value: 'right', label: 'Bám phải' },
              { value: 'center', label: 'Giữa' },
              { value: 'stretch', label: 'Co giãn' },
              { value: 'scale', label: 'Theo tỉ lệ' },
            ]}
          />
          <SelectField
            label="Ràng buộc dọc"
            value={el.constraints.vertical}
            onChange={(v) => up({ constraints: { ...el.constraints, vertical: v } })}
            options={[
              { value: 'top', label: 'Bám trên' },
              { value: 'bottom', label: 'Bám dưới' },
              { value: 'center', label: 'Giữa' },
              { value: 'stretch', label: 'Co giãn' },
              { value: 'scale', label: 'Theo tỉ lệ' },
            ]}
          />
        </Grid2>
      </Section>

      {el.type === 'text' && (
        <Section title="Văn bản" icon={<Type className="h-3.5 w-3.5" />} testId="section-text">
          <div className="flex items-end justify-between">
            <span className="text-[11.5px] font-medium text-[var(--text-muted)]">Nội dung</span>
            <VariableMenu onInsert={(v) => upText({ content: `${el.text.content}${el.text.content && !el.text.content.endsWith(' ') && !el.text.content.endsWith('\n') ? ' ' : ''}${v}` })} />
          </div>
          <TextAreaField value={el.text.content} onChange={(v) => upText({ content: v }, 'content')} rows={4} mono testId="el-content" />
          {unknown.length > 0 && (
            <Callout tone="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
              Biến không hợp lệ: {unknown.map((u) => `{{${u}}}`).join(', ')} — sẽ hiển thị nguyên văn.
            </Callout>
          )}
          {item?.text.overflow && (
            <Callout tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />} testId="text-overflow">
              Nội dung vượt quá khung phần tử và sẽ bị cắt ở mép khung chữ ký.
            </Callout>
          )}
          <Grid2>
            <SelectField label="Phông chữ" value={el.text.fontFamily} onChange={(v) => upText({ fontFamily: v })} options={Object.entries(FONT_FAMILIES).map(([v, f]) => ({ value: v, label: f.label }))} testId="el-font" />
            <NumberField label="Cỡ chữ" unit="pt" value={el.text.fontSize} min={2} max={200} step={0.5} onCommit={(v) => upText({ fontSize: v })} testId="el-font-size" />
          </Grid2>
          <p className="-mt-1 text-[11px] text-[var(--text-subtle)]">Xem trước bằng {FONT_FAMILIES[el.text.fontFamily]?.substitute} (tương thích số đo, đủ dấu tiếng Việt).</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={el.text.fontWeight === 'bold' ? 'subtle' : 'secondary'} aria-pressed={el.text.fontWeight === 'bold'} onClick={() => upText({ fontWeight: el.text.fontWeight === 'bold' ? 'normal' : 'bold' })} data-testid="el-bold" aria-label="Đậm">
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={el.text.fontStyle === 'italic' ? 'subtle' : 'secondary'} aria-pressed={el.text.fontStyle === 'italic'} onClick={() => upText({ fontStyle: el.text.fontStyle === 'italic' ? 'normal' : 'italic' })} data-testid="el-italic" aria-label="Nghiêng">
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Segmented
              label="Căn lề"
              value={el.text.align}
              onChange={(v) => upText({ align: v })}
              testId="el-align"
              options={[
                { value: 'left', label: '', icon: <AlignLeft className="h-3.5 w-3.5" />, title: 'Trái' },
                { value: 'center', label: '', icon: <AlignCenter className="h-3.5 w-3.5" />, title: 'Giữa' },
                { value: 'right', label: '', icon: <AlignRight className="h-3.5 w-3.5" />, title: 'Phải' },
              ]}
            />
          </div>
          <Grid2>
            <ColorField label="Màu chữ" value={el.text.color} onChange={(v) => upText({ color: v }, 'color')} testId="el-color" />
            <SelectField label="Căn dọc" value={el.text.verticalAlign} onChange={(v) => upText({ verticalAlign: v })} options={[{ value: 'top', label: 'Trên' }, { value: 'middle', label: 'Giữa' }, { value: 'bottom', label: 'Dưới' }]} />
            <NumberField label="Giãn dòng" value={el.text.lineHeight} min={0.8} max={4} step={0.05} onCommit={(v) => upText({ lineHeight: v })} testId="el-line-height" />
            <SelectField label="Chữ hoa/thường" value={el.text.textTransform} onChange={(v) => upText({ textTransform: v })} options={[{ value: 'none', label: 'Giữ nguyên' }, { value: 'uppercase', label: 'IN HOA' }, { value: 'lowercase', label: 'in thường' }]} />
          </Grid2>
          <Switch label="Tự xuống dòng" checked={el.text.wrap} onChange={(v) => upText({ wrap: v })} testId="el-wrap" />
          <Switch label="Ẩn dòng có biến trống" description="Ví dụ bỏ dòng “Lý do: …” khi không có lý do" checked={el.text.hideEmptyLines} onChange={(v) => upText({ hideEmptyLines: v })} />
        </Section>
      )}

      {el.type === 'image' && (
        <Section title="Hình ảnh" icon={<ImageIcon className="h-3.5 w-3.5" />} testId="section-image">
          <ImageElementControls sig={sig} el={el} />
          <SelectField label="Cách hiển thị" value={el.image.fit} onChange={(v) => up({ image: { fit: v } })} options={[{ value: 'contain', label: 'Vừa khung (giữ tỉ lệ)' }, { value: 'cover', label: 'Phủ kín (cắt phần thừa)' }, { value: 'stretch', label: 'Kéo giãn' }]} />
          {el.role === 'seal' && (
            <NumberField
              label="Kích thước thật của con dấu"
              unit="mm"
              value={el.image.physicalSizeMm ?? NaN}
              min={0}
              max={200}
              step={0.5}
              onCommit={(v) => up({ image: { physicalSizeMm: v || null } })}
              testId="seal-size"
              hint="Đường kính (dấu tròn) hoặc cạnh dài nhất. Dùng cho quy tắc “kích thước bằng kích thước thực tế của dấu”."
            />
          )}
        </Section>
      )}

      {el.type === 'qr' && (
        <Section title="Mã QR" icon={<QrCode className="h-3.5 w-3.5" />} testId="section-qr">
          <div className="flex items-end justify-between">
            <span className="text-[11.5px] font-medium text-[var(--text-muted)]">Nội dung mã hóa</span>
            <VariableMenu onInsert={(v) => up({ qr: { content: `${el.qr.content}${v}` } })} />
          </div>
          <TextAreaField value={el.qr.content} onChange={(v) => up({ qr: { content: v } }, 'qr')} rows={2} mono />
          <Grid2>
            <ColorField label="Màu mã" value={el.qr.color} onChange={(v) => up({ qr: { color: v } }, 'qrc')} />
            <ColorField label="Màu nền" value={el.qr.background} onChange={(v) => up({ qr: { background: v } }, 'qrb')} />
          </Grid2>
          <Switch label="Nền trong suốt" checked={el.qr.transparentBackground} onChange={(v) => up({ qr: { transparentBackground: v } })} />
          <SelectField label="Mức sửa lỗi" value={el.qr.errorCorrection} onChange={(v) => up({ qr: { errorCorrection: v } })} options={['L', 'M', 'Q', 'H'].map((x) => ({ value: x, label: x }))} />
        </Section>
      )}

      {el.type === 'rect' && (
        <Section title="Hình chữ nhật" icon={<Square className="h-3.5 w-3.5" />}>
          <Grid2>
            <ColorField label="Màu nền" value={el.shape.fill} onChange={(v) => up({ shape: { fill: v } }, 'fill')} />
            <SliderField label="Độ đậm nền" value={el.shape.fillOpacity} onChange={(v) => up({ shape: { fillOpacity: v } }, 'fop')} />
            <ColorField label="Màu viền" value={el.shape.stroke} onChange={(v) => up({ shape: { stroke: v } }, 'stroke')} />
            <NumberField label="Độ dày viền" unit="pt" value={el.shape.strokeWidth} min={0} max={20} step={0.25} onCommit={(v) => up({ shape: { strokeWidth: v } })} />
            <NumberField label="Bo góc" unit="pt" value={el.shape.radius} min={0} max={200} step={1} onCommit={(v) => up({ shape: { radius: v } })} />
          </Grid2>
          <Switch label="Nét đứt" checked={el.shape.dashed} onChange={(v) => up({ shape: { dashed: v } })} />
        </Section>
      )}

      {el.type === 'line' && (
        <Section title="Đường kẻ" icon={<Square className="h-3.5 w-3.5" />}>
          <Grid2>
            <ColorField label="Màu" value={el.line.stroke} onChange={(v) => up({ line: { stroke: v } }, 'ls')} />
            <NumberField label="Độ dày" unit="pt" value={el.line.strokeWidth} min={0.1} max={20} step={0.25} onCommit={(v) => up({ line: { strokeWidth: v } })} />
          </Grid2>
          <Switch label="Nét đứt" checked={el.line.dashed} onChange={(v) => up({ line: { dashed: v } })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => up({ height: 0, width: Math.max(el.width, el.height) })}>
              Ngang
            </Button>
            <Button size="sm" onClick={() => up({ width: 0, height: Math.max(el.width, el.height) })}>
              Dọc
            </Button>
          </div>
        </Section>
      )}

      <Section title="Nâng cao" icon={<Settings2 className="h-3.5 w-3.5" />} defaultOpen={!!el.condition} testId="section-el-advanced">
        <Switch label="Hiển thị có điều kiện" checked={!!el.condition} onChange={(v) => up({ condition: v ? { variable: 'signing.reason', operator: 'notEmpty', value: '' } : null })} testId="el-condition" />
        {el.condition && (
          <>
            <SelectField label="Khi biến" value={el.condition.variable} onChange={(v) => up({ condition: { ...el.condition, variable: v } })} options={VARIABLES.map((v) => ({ value: v.key, label: `{{${v.key}}} — ${v.label}` }))} testId="cond-variable" />
            <Grid2>
              <SelectField label="Điều kiện" value={el.condition.operator} onChange={(v) => up({ condition: { ...el.condition, operator: v } })} options={Object.entries(CONDITION_OPERATORS).map(([value, label]) => ({ value, label }))} testId="cond-operator" />
              {['equals', 'notEquals', 'contains'].includes(el.condition.operator) && <TextField label="Giá trị" value={el.condition.value ?? ''} onChange={(v) => up({ condition: { ...el.condition, value: v } }, 'cond')} />}
            </Grid2>
            <p className="text-[11px] text-[var(--text-subtle)]">Áp dụng ở chế độ “Dữ liệu mẫu/thực tế” và khi kết xuất. Ở chế độ “Biến” phần tử luôn hiện để chỉnh sửa.</p>
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => st().reorderElement(sig.id, el.id, 'top')}>
            Lên trên cùng
          </Button>
          <Button size="sm" onClick={() => st().reorderElement(sig.id, el.id, 'bottom')}>
            Xuống dưới cùng
          </Button>
          <Button size="sm" onClick={() => st().duplicateElement(sig.id, el.id)}>
            <Copy className="h-3.5 w-3.5" /> Nhân bản
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => st().removeElement(sig.id, el.id)} data-testid="el-delete">
            <Trash2 className="h-3.5 w-3.5" /> Xóa
          </Button>
        </div>
      </Section>
    </div>
  );
}
