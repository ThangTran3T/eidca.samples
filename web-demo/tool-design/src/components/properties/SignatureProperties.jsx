import { useMemo } from 'react';
import { SlidersHorizontal, Type, CalendarClock, Palette, Settings2, Copy, Trash2, Lock, Maximize2 } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { SIGNATURE_TYPES, DATE_FORMATS, TIME_FORMATS, TIME_ZONES, signingDateParts, extractVariables, variableLabel, buildVariableContext, dataForMode, VARIABLE_KEYS } from '../../engines/template-engine/index.js';
import { FONT_FAMILIES } from '../../engines/rendering-engine/fonts.js';
import { PROFILES } from '../../engines/compliance-engine/index.js';
import { designSizeForRect, rectSizeForDesign, pointsToMm, clampRectToPage } from '../../engines/coordinate-engine/index.js';
import { Section, TextField, NumberField, SelectField, ColorField, Switch, SliderField, Grid2, Segmented, Button, Callout } from '../ui/index.jsx';
import { LayersList } from './LayersList.jsx';
import { ImageSlots } from './ImageControls.jsx';
import { useT } from '../../i18n/index.js';

const mm = (v) => `${(Math.round(pointsToMm(v) * 10) / 10).toLocaleString('vi-VN')} mm`;

export function SignatureProperties({ sig }) {
  const t = useT();
  const st = useEditor.getState;
  const doc = useEditor((s) => s.doc);
  const displayMode = useEditor((s) => s.displayMode);
  const runtimeData = useEditor((s) => s.runtimeData);
  const geom = st().geometry(sig.page);
  const tpl = sig.template;
  const design = designSizeForRect(geom, sig.rect, sig.rotation);
  const texts = tpl.elements.filter((e) => e.type === 'text');
  const k = (field) => `${sig.id}:${field}`;

  const setRect = (patch) => st().setSignatureRect(sig.id, clampRectToPage(geom, { ...sig.rect, ...patch }), { key: k('rect') });
  const setDesign = (patch) => {
    const size = rectSizeForDesign(geom, { ...design, ...patch }, sig.rotation);
    // typed sizes keep lLx/lLy (the PDF lower-left corner) fixed, matching the VNeCA fields
    setRect({ ...sig.rect, ...size });
  };
  const updateTpl = (patch, key) => st().updateTemplate(sig.id, patch, { key: key ? k(key) : undefined });
  const updateStyle = (group, patch, key) => updateTpl((tp) => ({ style: { ...tp.style, [group]: typeof tp.style[group] === 'object' ? { ...tp.style[group], ...patch } : patch } }), key);
  const bulkText = (patch) => updateTpl((tp) => ({ elements: tp.elements.map((e) => (e.type === 'text' ? { ...e, text: { ...e.text, ...patch } } : e)) }));
  const common = (field) => {
    const vals = [...new Set(texts.map((e) => e.text[field]))];
    return vals.length === 1 ? vals[0] : undefined;
  };

  const dt = tpl.dateTime;
  const preview = signingDateParts(dataForMode(tpl, displayMode === 'runtime' ? 'runtime' : 'sample', runtimeData).signing?.timestamp, dt);

  const usedVars = useMemo(() => {
    const set = new Set();
    for (const e of tpl.elements) {
      if (e.type === 'text') extractVariables(e.text.content).forEach((v) => set.add(v));
      if (e.type === 'qr') extractVariables(e.qr.content).forEach((v) => set.add(v));
      if (e.condition?.variable) set.add(e.condition.variable);
    }
    return [...set];
  }, [tpl.elements]);
  const ctx = buildVariableContext(dataForMode(tpl, displayMode === 'runtime' ? 'runtime' : 'sample', runtimeData), dt);

  return (
    <div data-testid="signature-properties">
      <Section title={t('props.general')} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} testId="section-general">
        <TextField label="Tên chữ ký (trên tài liệu)" value={sig.name} onChange={(v) => st().updateSignature(sig.id, { name: v }, { key: k('name') })} testId="sig-name" />
        <TextField label="Tên mẫu" value={tpl.name} onChange={(v) => updateTpl({ name: v }, 'tplname')} testId="tpl-name" />
        <SelectField label="Loại chữ ký" value={tpl.signatureType} onChange={(v) => updateTpl({ signatureType: v })} options={Object.entries(SIGNATURE_TYPES).map(([value, label]) => ({ value, label }))} testId="sig-type" />
        <SelectField
          label="Hồ sơ tuân thủ"
          value={tpl.complianceProfile ?? ''}
          onChange={(v) => updateTpl({ complianceProfile: v || null })}
          options={[{ value: '', label: 'Không — Chế độ tùy chỉnh (Custom Mode)' }, ...Object.entries(PROFILES).map(([value, p]) => ({ value, label: `${p.short}: ${p.label}` }))]}
          testId="sig-profile"
        />
        <Grid2>
          <NumberField label="Rộng" unit="pt" value={design.width} min={4} step={1} onCommit={(v) => setDesign({ width: v })} testId="sig-width" hint={mm(design.width)} />
          <NumberField label="Cao" unit="pt" value={design.height} min={4} step={1} onCommit={(v) => setDesign({ height: v })} testId="sig-height" hint={mm(design.height)} />
          <NumberField label="X (lLx)" unit="pt" value={sig.rect.x} step={1} onCommit={(v) => setRect({ x: v })} testId="sig-x" disabled={sig.locked} />
          <NumberField label="Y (lLy)" unit="pt" value={sig.rect.y} step={1} onCommit={(v) => setRect({ y: v })} testId="sig-y" disabled={sig.locked} />
        </Grid2>
        <p className="-mt-1 text-[11px] text-[var(--text-subtle)]">Tọa độ PDF tính từ góc dưới-trái trang (điểm, 1 pt = 1/72 inch). Không đổi khi phóng to/thu nhỏ.</p>
        <Grid2>
          <SelectField
            label="Trang"
            value={String(sig.page)}
            onChange={(v) => st().setSignaturePage(sig.id, Number(v))}
            options={Array.from({ length: Math.max(doc?.pages.length ?? 1, sig.page) }, (_, i) => ({ value: String(i + 1), label: `Trang ${i + 1}` }))}
            testId="sig-page"
          />
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-[var(--text-muted)]">Xoay nội dung</span>
            <Segmented value={sig.rotation} onChange={(v) => st().setSignatureRotation(sig.id, v)} options={[0, 90, 180, 270].map((r) => ({ value: r, label: `${r}°` }))} testId="sig-rotation" />
          </div>
        </Grid2>
        <SliderField label="Độ mờ (opacity)" value={sig.opacity ?? 1} onChange={(v) => st().updateSignature(sig.id, { opacity: v }, { key: k('opacity') })} testId="sig-opacity" />
        <Switch label="Hiển thị chữ ký" description="Tắt = sign_visibility: hidden" checked={sig.visible !== false} onChange={(v) => st().updateSignature(sig.id, { visible: v })} testId="sig-visible" />
        <Switch label="Khóa vị trí" checked={!!sig.locked} onChange={(v) => st().updateSignature(sig.id, { locked: v })} testId="sig-locked" />
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => st().duplicateSignature(sig.id)}>
            <Copy className="h-3.5 w-3.5" /> Nhân bản
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => st().removeSignature(sig.id)} data-testid="sig-delete">
            <Trash2 className="h-3.5 w-3.5" /> Xóa
          </Button>
        </div>
      </Section>

      <Section title={`${t('props.text')} — tất cả phần tử chữ`} icon={<Type className="h-3.5 w-3.5" />} defaultOpen={false}>
        {texts.length === 0 ? (
          <p className="text-[12px] text-[var(--text-subtle)]">Mẫu chưa có phần tử chữ. Thêm ở thẻ “Phần tử”.</p>
        ) : (
          <>
            <p className="text-[11.5px] text-[var(--text-subtle)]">Áp dụng cho {texts.length} phần tử chữ. Chọn từng phần tử (nhấp đúp) để chỉnh nội dung.</p>
            <Grid2>
              <SelectField label="Phông chữ" value={common('fontFamily') ?? ''} onChange={(v) => bulkText({ fontFamily: v })} options={[{ value: '', label: '— Khác nhau —', disabled: true }, ...Object.keys(FONT_FAMILIES).map((f) => ({ value: f, label: f }))]} />
              <NumberField label="Cỡ chữ" unit="pt" value={common('fontSize') ?? NaN} min={2} max={200} step={0.5} onCommit={(v) => bulkText({ fontSize: v })} />
            </Grid2>
            <ColorField label="Màu chữ" value={common('color') ?? '#000000'} onChange={(v) => bulkText({ color: v })} />
          </>
        )}
      </Section>

      <Section title={t('props.datetime')} icon={<CalendarClock className="h-3.5 w-3.5" />} defaultOpen={false} testId="section-datetime">
        <SelectField label="Định dạng ngày" value={dt.dateFormat} onChange={(v) => updateTpl({ dateTime: { ...dt, dateFormat: v } })} options={Object.entries(DATE_FORMATS).map(([value, ex]) => ({ value, label: `${value} — ${ex}` }))} testId="date-format" />
        <SelectField label="Định dạng giờ" value={dt.timeFormat} disabled={dt.dateFormat === 'ISO8601'} onChange={(v) => updateTpl({ dateTime: { ...dt, timeFormat: v } })} options={Object.entries(TIME_FORMATS).map(([value, ex]) => ({ value, label: `${value} — ${ex}` }))} hint={dt.dateFormat === 'ISO8601' ? 'ISO 8601 đã gồm giờ và múi giờ.' : undefined} />
        <SelectField label="Múi giờ" value={dt.timeZone} onChange={(v) => updateTpl({ dateTime: { ...dt, timeZone: v } })} options={Object.entries(TIME_ZONES).map(([value, label]) => ({ value, label }))} testId="time-zone" />
        <Switch label="Hiển thị ngày" checked={dt.showDate} onChange={(v) => updateTpl({ dateTime: { ...dt, showDate: v } })} />
        <Switch label="Hiển thị giờ" checked={dt.showTime} onChange={(v) => updateTpl({ dateTime: { ...dt, showTime: v } })} />
        <div className="rounded-md bg-[var(--panel-2)] px-2.5 py-2 font-mono text-[11.5px]" data-testid="datetime-preview">
          {'{{signing.datetime}}'} → {preview.datetime || '(trống)'}
        </div>
      </Section>

      <Section title={t('props.appearance')} icon={<Palette className="h-3.5 w-3.5" />} defaultOpen={false} testId="section-appearance">
        <Grid2>
          <NumberField label="Viền" unit="pt" value={tpl.style.border.width} min={0} max={20} step={0.25} onCommit={(v) => updateStyle('border', { width: v })} testId="border-width" />
          <NumberField label="Bo góc" unit="pt" value={tpl.style.border.radius} min={0} max={100} step={1} onCommit={(v) => updateStyle('border', { radius: v })} />
        </Grid2>
        <Grid2>
          <ColorField label="Màu viền" value={tpl.style.border.color} onChange={(v) => updateStyle('border', { color: v }, 'bcolor')} />
          <SelectField label="Kiểu viền" value={tpl.style.border.style} onChange={(v) => updateStyle('border', { style: v })} options={[{ value: 'solid', label: 'Liền' }, { value: 'dashed', label: 'Nét đứt' }]} />
        </Grid2>
        <Grid2>
          <ColorField label="Màu nền" value={tpl.style.background.color} onChange={(v) => updateStyle('background', { color: v }, 'bg')} />
          <SliderField label="Độ đậm nền" value={tpl.style.background.opacity} onChange={(v) => updateStyle('background', { opacity: v }, 'bgop')} />
        </Grid2>
        <NumberField label="Lề trong (padding)" unit="pt" value={tpl.style.padding} min={0} max={100} step={1} onCommit={(v) => updateStyle('padding', v)} hint="Dùng làm vùng an toàn khi bắt dính và khi căn phần tử vào lề." />
        <Button
          size="sm"
          onClick={() => {
            const p = tpl.style.padding;
            updateTpl((tp) => ({
              elements: tp.elements.map((e) => {
                const w = Math.min(e.width, tp.size.width - 2 * p);
                const h = Math.min(e.height, tp.size.height - 2 * p);
                return { ...e, width: w, height: h, x: Math.min(Math.max(e.x, p), tp.size.width - p - w), y: Math.min(Math.max(e.y, p), tp.size.height - p - h) };
              }),
            }));
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Căn tất cả phần tử vào lề
        </Button>
        <SliderField label="Độ mờ hình ảnh" value={tpl.style.imageOpacity} onChange={(v) => updateStyle('imageOpacity', v, 'imgop')} testId="image-opacity" />
        <ImageSlots sig={sig} />
      </Section>

      <Section title={t('props.advanced')} icon={<Settings2 className="h-3.5 w-3.5" />} defaultOpen={false} testId="section-advanced">
        <div>
          <div className="mb-1.5 text-[11.5px] font-medium text-[var(--text-muted)]">Ràng buộc biến đang dùng</div>
          {usedVars.length === 0 ? (
            <p className="text-[11.5px] text-[var(--text-subtle)]">Mẫu không dùng biến động.</p>
          ) : (
            <table className="w-full text-[11.5px]" data-testid="variables-table">
              <tbody>
                {usedVars.map((v) => (
                  <tr key={v} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1 pr-2 font-mono text-brand-700 dark:text-brand-300">{`{{${v}}}`}</td>
                    <td className="py-1 text-[var(--text-muted)]">{VARIABLE_KEYS.has(v) ? ctx[v] || <em>(trống)</em> : <span className="text-rose-600">Biến không hợp lệ — sẽ hiện nguyên văn</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {usedVars.length > 0 && <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Giá trị theo {displayMode === 'runtime' ? 'dữ liệu thực tế' : 'dữ liệu mẫu của mẫu'}.</p>}
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">{usedVars.filter((v) => VARIABLE_KEYS.has(v)).map(variableLabel).join(' · ')}</div>
        </div>
        <Callout tone="neutral" icon={<Lock className="h-3.5 w-3.5" />}>
          Khóa vị trí, khóa tỉ lệ và điều kiện hiển thị được đặt cho từng phần tử — chọn phần tử trong danh sách lớp bên dưới.
        </Callout>
        <LayersList sig={sig} />
      </Section>
    </div>
  );
}
