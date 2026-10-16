import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Type, Image, QrCode, Square, Minus } from 'lucide-react';
import { useEditor } from '../../stores/editor-store.js';
import { ROLES } from '../../engines/template-engine/index.js';
import { IconButton } from '../ui/index.jsx';

const TYPE_ICON = { text: Type, image: Image, qr: QrCode, rect: Square, line: Minus };

/** Layer list, top-most first (later elements draw on top). */
export function LayersList({ sig }) {
  const selection = useEditor((s) => s.selection);
  const st = useEditor.getState;
  const els = [...sig.template.elements].reverse();
  return (
    <div data-testid="layers">
      <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-[var(--text-muted)]">
        <span>Lớp (trên cùng → dưới cùng)</span>
        <span className="text-[var(--text-subtle)]">{els.length}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {els.map((el, i) => {
          const Icon = TYPE_ICON[el.type] ?? Type;
          const active = selection.signatureId === sig.id && selection.elementId === el.id;
          const label = el.name || ROLES[el.role] || el.type;
          return (
            <li key={el.id} className={`group flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] ${active ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100' : 'hover:bg-[var(--panel-2)]'}`} data-testid={`layer-${el.id}`}>
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]" />
              <button type="button" className={`min-w-0 flex-1 truncate text-left ${el.visible === false ? 'opacity-50' : ''}`} onClick={() => st().select(sig.id, el.id)}>
                {label}
                {el.condition && <span className="ml-1 text-[10px] text-amber-600">(có điều kiện)</span>}
              </button>
              <div className="flex opacity-60 group-hover:opacity-100">
                <IconButton label="Lên một lớp" className="h-5 w-5" disabled={i === 0} onClick={() => st().reorderElement(sig.id, el.id, 'up')}>
                  <ChevronUp className="h-3 w-3" />
                </IconButton>
                <IconButton label="Xuống một lớp" className="h-5 w-5" disabled={i === els.length - 1} onClick={() => st().reorderElement(sig.id, el.id, 'down')}>
                  <ChevronDown className="h-3 w-3" />
                </IconButton>
                <IconButton label="Lên trên cùng" className="h-5 w-5" disabled={i === 0} onClick={() => st().reorderElement(sig.id, el.id, 'top')}>
                  <ChevronsUp className="h-3 w-3" />
                </IconButton>
                <IconButton label="Xuống dưới cùng" className="h-5 w-5" disabled={i === els.length - 1} onClick={() => st().reorderElement(sig.id, el.id, 'bottom')}>
                  <ChevronsDown className="h-3 w-3" />
                </IconButton>
                <IconButton label={el.visible === false ? 'Hiện' : 'Ẩn'} className="h-5 w-5" onClick={() => st().updateElement(sig.id, el.id, { visible: el.visible === false })}>
                  {el.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </IconButton>
                <IconButton label={el.locked ? 'Mở khóa' : 'Khóa'} className="h-5 w-5" onClick={() => st().updateElement(sig.id, el.id, { locked: !el.locked })}>
                  {el.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
