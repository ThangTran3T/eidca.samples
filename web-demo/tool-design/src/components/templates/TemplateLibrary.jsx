import { useEffect, useMemo, useState } from 'react';
import { Search, MoreVertical, Plus, Replace, Download, Trash2, Scale } from 'lucide-react';
import { useEditor, selectSelectedSignature } from '../../stores/editor-store.js';
import { TEMPLATE_CATEGORIES } from '../../engines/template-engine/index.js';
import { PROFILES } from '../../engines/compliance-engine/index.js';
import { LIBRARY_ORDER } from '../../features/templates/library.js';
import { renderThumbnail } from '../../features/templates/bootstrap.js';
import { placeTemplate } from '../../features/templates/actions.js';
import { exportTemplateJson } from '../../features/export/export-actions.js';
import { TEMPLATE_DRAG_TYPE } from '../pdf/PdfViewer.jsx';
import { Badge, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '../ui/index.jsx';
import { useT } from '../../i18n/index.js';

const thumbCache = new Map();

function Thumbnail({ template }) {
  const key = `${template.id}|${template.updatedAt ?? ''}`;
  const [src, setSrc] = useState(thumbCache.get(key) ?? null);
  useEffect(() => {
    if (thumbCache.has(key)) return setSrc(thumbCache.get(key));
    let alive = true;
    renderThumbnail(template)
      .then((url) => {
        thumbCache.set(key, url);
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, template]);
  return (
    <div className="flex h-[68px] items-center justify-center rounded-md border border-[var(--border)] bg-white p-1.5 dark:border-[var(--border-strong)]" style={{ backgroundImage: 'repeating-conic-gradient(#f4f5f8 0% 25%, #ffffff 0% 50%)', backgroundSize: '12px 12px' }}>
      {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" draggable={false} /> : <div className="h-full w-full animate-pulse rounded bg-slate-100" />}
    </div>
  );
}

function TemplateCard({ template, custom }) {
  const t = useT();
  const selected = useEditor(selectSelectedSignature);
  const profile = template.complianceProfile ? PROFILES[template.complianceProfile] : null;
  const add = () => placeTemplate(template);
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid={`template-${template.id}`}
      onDragStart={(e) => {
        e.dataTransfer.setData(TEMPLATE_DRAG_TYPE, template.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={add}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          add();
        }
      }}
      className="group relative cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 transition hover:border-brand-300 hover:shadow-md focus-visible:border-brand-500"
      title={template.description}
    >
      <Thumbnail template={template} />
      <div className="mt-1.5 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium leading-tight">{template.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {profile ? (
              <Badge tone="brand">
                <Scale className="h-2.5 w-2.5" /> {profile.short}
              </Badge>
            ) : (
              <Badge>Tùy chỉnh</Badge>
            )}
            <span className="text-[10.5px] text-[var(--text-subtle)] tabular-nums">
              {Math.round(template.size.width)}×{Math.round(template.size.height)} pt
            </span>
          </div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label="Tùy chọn mẫu" className="rounded p-0.5 text-[var(--text-subtle)] opacity-0 hover:bg-[var(--panel-2)] group-hover:opacity-100 focus:opacity-100" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={add}>
              {t('sidebar.addToPage')}
            </MenuItem>
            <MenuItem icon={<Replace className="h-4 w-4" />} disabled={!selected} onSelect={() => useEditor.getState().applyTemplate(selected.id, template)}>
              {t('sidebar.applyToSelected')}
            </MenuItem>
            <MenuItem icon={<Download className="h-4 w-4" />} onSelect={() => exportTemplateJson(template)}>
              Tải tệp mẫu .json
            </MenuItem>
            {custom && (
              <>
                <MenuSeparator />
                <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => useEditor.getState().deleteCustomTemplate(template.id)}>
                  Xóa khỏi “Mẫu của tôi”
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

export function TemplateLibrary() {
  const t = useT();
  const library = useEditor((s) => s.library);
  const custom = useEditor((s) => s.customTemplates);
  const [q, setQ] = useState('');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const groups = useMemo(() => {
    const match = (tpl) => !q || norm(`${tpl.name} ${tpl.description}`).includes(norm(q));
    return LIBRARY_ORDER.map((cat) => ({ cat, items: library.filter((x) => x.category === cat && match(x)) })).filter((g) => g.items.length);
  }, [library, q]);
  const customFiltered = custom.filter((tpl) => !q || norm(tpl.name).includes(norm(q)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('sidebar.search')}
            aria-label={t('sidebar.search')}
            className="h-8 w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel-2)] pl-7 pr-2 text-[12.5px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            data-testid="template-search"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">{t('sidebar.dragHint')}</p>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4" data-testid="template-library">
        {groups.map(({ cat, items }) => (
          <div key={cat} className="mb-4">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{TEMPLATE_CATEGORIES[cat]}</div>
            <div className="grid grid-cols-1 gap-2">
              {items.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          </div>
        ))}
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{t('sidebar.custom')}</div>
        {customFiltered.length ? (
          <div className="grid grid-cols-1 gap-2">
            {customFiltered.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} custom />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-3 text-[11.5px] text-[var(--text-subtle)]">{t('sidebar.noCustom')}</p>
        )}
      </div>
    </div>
  );
}
