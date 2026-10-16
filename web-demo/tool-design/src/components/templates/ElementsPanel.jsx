import {
  Type,
  UserRound,
  Briefcase,
  IdCard,
  Building2,
  CalendarDays,
  Clock,
  MessageSquareText,
  MapPin,
  Landmark,
  Hash,
  PenLine,
  Stamp,
  Image,
  QrCode,
  Square,
  Minus,
  Wallpaper,
  MousePointerClick,
} from 'lucide-react';
import { useEditor, selectSelectedSignature } from '../../stores/editor-store.js';
import { ELEMENT_CATALOG } from '../../engines/template-engine/index.js';
import { EmptyState } from '../ui/index.jsx';
import { useT } from '../../i18n/index.js';

const ICONS = { Type, UserRound, Briefcase, IdCard, Building2, CalendarDays, Clock, MessageSquareText, MapPin, Landmark, Hash, PenLine, Stamp, Image, QrCode, Square, Minus, Wallpaper };

const GROUPS = [
  ['Chữ và thông tin', ['text', 'signer-name', 'signer-title', 'organization', 'subject', 'signing-date', 'signing-time', 'reason', 'location', 'issuer', 'serial']],
  ['Hình ảnh', ['hand-signature', 'seal', 'logo', 'background', 'qr']],
  ['Hình khối', ['rect', 'line']],
];

export function ElementsPanel() {
  const t = useT();
  const sig = useEditor(selectSelectedSignature);
  const add = (item) => {
    const el = item.make(sig.template.size);
    if (item.key !== 'background') {
      // centre the new element in the box, clamped inside it
      el.width = Math.min(el.width, sig.template.size.width);
      el.height = Math.min(el.height, sig.template.size.height);
      el.x = (sig.template.size.width - el.width) / 2;
      el.y = (sig.template.size.height - el.height) / 2;
    }
    const st = useEditor.getState();
    st.addElement(sig.id, el);
    if (item.key === 'background') st.reorderElement(sig.id, el.id, 'bottom');
  };
  if (!sig) {
    return (
      <EmptyState icon={<MousePointerClick className="h-5 w-5" />} title={t('sidebar.elements')} testId="elements-empty">
        {t('sidebar.elementsHint')}
      </EmptyState>
    );
  }
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="elements-panel">
      <div className="mb-3 rounded-md bg-[var(--panel-2)] px-2.5 py-2 text-[11.5px] text-[var(--text-muted)]">
        Thêm vào: <span className="font-medium text-[var(--text)]">{sig.name}</span>
      </div>
      {GROUPS.map(([label, keys]) => (
        <div key={label} className="mb-4">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{label}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {keys.map((k) => {
              const item = ELEMENT_CATALOG.find((c) => c.key === k);
              const Icon = ICONS[item.icon] ?? Type;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => add(item)}
                  data-testid={`add-element-${k}`}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-2 text-left text-[11.5px] leading-tight transition hover:border-brand-300 hover:bg-brand-50/40 dark:hover:bg-brand-900/20"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
