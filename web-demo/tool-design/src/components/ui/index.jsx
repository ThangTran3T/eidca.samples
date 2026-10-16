/**
 * Small accessible UI kit in the spirit of shadcn/ui: Radix primitives for
 * dialogs, menus, tabs and tooltips; native inputs styled with Tailwind.
 */
import { forwardRef, useEffect, useId, useState } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

export const cn = clsx;

// ─── Buttons ────────────────────────────────────────────────────────────────
const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary: 'bg-[var(--panel)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--panel-2)]',
  ghost: 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/60',
};
const SIZES = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-8 px-3 text-[13px] gap-2', lg: 'h-10 px-4 text-sm gap-2' };

export const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors select-none disabled:opacity-45 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ label, shortcut, active, className, children, tooltipSide = 'bottom', ...props }, ref) {
  const btn = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
});

// ─── Tooltip ────────────────────────────────────────────────────────────────
export function TooltipProvider({ children }) {
  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  );
}

export function Tooltip({ content, shortcut, side = 'bottom', children }) {
  if (!content) return children;
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-[100] rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg animate-fade-in dark:bg-slate-100 dark:text-slate-900">
          {content}
          {shortcut && <kbd className="ml-2 rounded bg-white/15 px-1 font-mono text-[10px] dark:bg-black/10">{shortcut}</kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

// ─── Form fields ────────────────────────────────────────────────────────────
const inputBase =
  'w-full h-7 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2 text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50';

export function Field({ label, hint, htmlFor, children, className, inline }) {
  return (
    <div className={cn(inline ? 'flex items-center justify-between gap-3' : 'flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[11.5px] font-medium text-[var(--text-muted)]">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] leading-snug text-[var(--text-subtle)]">{hint}</p>}
    </div>
  );
}

/** Text input that commits on change (callers decide coalescing). */
export function TextField({ label, value, onChange, hint, placeholder, disabled, className, testId, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <input id={id} data-testid={testId} className={inputBase} value={value ?? ''} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, hint, rows = 3, disabled, testId, mono }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        data-testid={testId}
        rows={rows}
        disabled={disabled}
        className={cn(inputBase, 'h-auto py-1.5 leading-snug resize-y', mono && 'font-mono text-[11.5px]')}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </Field>
  );
}

/**
 * Numeric input with unit suffix. Keeps a local draft while typing and
 * commits on Enter/blur; ArrowUp/Down step (Shift ×10).
 */
export function NumberField({ label, value, onCommit, step = 1, min, max, unit, decimals = 2, disabled, testId, className, hint }) {
  const id = useId();
  const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 10 ** decimals) / 10 ** decimals) : '');
  const [draft, setDraft] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const clamp = (v) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (raw) => {
    const v = Number(String(raw).replace(',', '.'));
    if (Number.isFinite(v)) {
      const c = clamp(v);
      if (c !== value) onCommit(c);
      setDraft(fmt(c));
    } else setDraft(fmt(value));
  };
  return (
    <Field label={label} htmlFor={id} className={className} hint={hint}>
      <div className="relative">
        <input
          id={id}
          data-testid={testId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          className={cn(inputBase, unit && 'pr-7', 'tabular-nums')}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            commit(e.target.value);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value);
            if (e.key === 'Escape') setDraft(fmt(value));
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              const base = Number(String(draft).replace(',', '.'));
              const next = clamp((Number.isFinite(base) ? base : value) + delta);
              setDraft(fmt(next));
              onCommit(Math.round(next * 10 ** decimals) / 10 ** decimals);
            }
          }}
        />
        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-[var(--text-subtle)]">{unit}</span>}
      </div>
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, disabled, testId, className, hint }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className} hint={hint}>
      <div className="relative">
        <select id={id} data-testid={testId} disabled={disabled} className={cn(inputBase, 'appearance-none pr-7')} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
      </div>
    </Field>
  );
}

export function ColorField({ label, value, onChange, disabled, testId }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-1.5">
        <input type="color" aria-label={label} disabled={disabled} className="h-7 w-8 shrink-0 cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          id={id}
          data-testid={testId}
          disabled={disabled}
          className={cn(inputBase, 'font-mono uppercase')}
          value={draft}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </Field>
  );
}

export function Switch({ checked, onChange, label, disabled, testId, description }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <label htmlFor={id} className="text-[12px] text-[var(--text)] leading-tight pt-0.5">
        {label}
        {description && <span className="block text-[11px] text-[var(--text-subtle)]">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-[18px] w-8 shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-brand-600' : 'bg-[var(--border-strong)]')}
      >
        <span className={cn('absolute left-0 top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[16px]' : 'translate-x-[2px]')} />
      </button>
    </div>
  );
}

export function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.01, format = (v) => `${Math.round(v * 100)}%`, testId, disabled }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input id={id} data-testid={testId} disabled={disabled} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer accent-brand-600" />
        <span className="w-10 text-right text-[11px] tabular-nums text-[var(--text-muted)]">{format(value)}</span>
      </div>
    </Field>
  );
}

export function Segmented({ value, onChange, options, label, size = 'sm', testId }) {
  return (
    <div role="radiogroup" aria-label={label} data-testid={testId} className="inline-flex rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors',
            size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-xs',
            value === o.value ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────
export function Section({ title, icon, children, defaultOpen = true, actions, testId }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[var(--border)]" data-testid={testId}>
      <div className="flex items-center">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
          {icon}
          {title}
        </button>
        {actions && <div className="pr-3">{actions}</div>}
      </div>
      {open && <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>}
    </section>
  );
}

export function Grid2({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200',
};
export function Badge({ tone = 'neutral', children, className, ...props }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none', BADGE_TONES[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function Kbd({ children }) {
  return <kbd className="rounded border border-[var(--border-strong)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-muted)]">{children}</kbd>;
}

export function Callout({ tone = 'neutral', icon, title, children, className, testId }) {
  const tones = {
    neutral: 'border-[var(--border)] bg-[var(--panel-2)]',
    warning: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200',
    danger: 'border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200',
    info: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800/60 dark:bg-brand-950/40 dark:text-brand-100',
    success: 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  };
  return (
    <div role="note" data-testid={testId} className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] leading-snug', tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ─── Dialog ─────────────────────────────────────────────────────────────────
export function Dialog({ open, onOpenChange, title, description, children, footer, width = 'max-w-2xl', testId }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] animate-fade-in" />
        <RDialog.Content
          data-testid={testId}
          className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl animate-fade-in', width)}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <RDialog.Title className="text-[15px] font-semibold">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <button type="button" aria-label="Đóng" className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]">
                <X className="h-4 w-4" />
              </button>
            </RDialog.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

// ─── Dropdown menu ──────────────────────────────────────────────────────────
export const Menu = RMenu.Root;
export const MenuTrigger = RMenu.Trigger;
export function MenuContent({ children, align = 'start' }) {
  return (
    <RMenu.Portal>
      <RMenu.Content align={align} sideOffset={6} className="z-[60] min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 shadow-xl animate-fade-in">
        {children}
      </RMenu.Content>
    </RMenu.Portal>
  );
}
export function MenuItem({ icon, children, shortcut, onSelect, disabled, danger, testId }) {
  return (
    <RMenu.Item
      data-testid={testId}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--panel-2)]',
        danger ? 'text-rose-600' : 'text-[var(--text)]'
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center text-[var(--text-muted)]">{icon}</span>
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[10.5px] text-[var(--text-subtle)]">{shortcut}</span>}
    </RMenu.Item>
  );
}
export function MenuSeparator() {
  return <RMenu.Separator className="my-1 h-px bg-[var(--border)]" />;
}
export function MenuLabel({ children }) {
  return <RMenu.Label className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{children}</RMenu.Label>;
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
export const Tabs = RTabs.Root;
export const TabsContent = RTabs.Content;
export function TabsList({ children, className }) {
  return <RTabs.List className={cn('flex shrink-0 border-b border-[var(--border)] px-2', className)}>{children}</RTabs.List>;
}
export function TabsTrigger({ value, children, testId }) {
  return (
    <RTabs.Trigger
      value={value}
      data-testid={testId}
      className="relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-[12px] font-medium text-[var(--text-muted)] outline-none hover:text-[var(--text)] data-[state=active]:text-[var(--text)] data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-brand-600"
    >
      {children}
    </RTabs.Trigger>
  );
}

export function EmptyState({ icon, title, children, actions, testId }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">{icon}</div>}
      <div className="text-[13.5px] font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-xs text-[12px] text-[var(--text-muted)]">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return <span role="status" aria-label="Đang tải" className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}
