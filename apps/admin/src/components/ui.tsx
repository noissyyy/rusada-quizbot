import { clsx } from 'clsx';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/* ---------- icons (24px, 1.8 stroke) ---------- */
const P = {
  dashboard: <><rect x="4" y="4" width="7" height="9" rx="2" /><rect x="13" y="4" width="7" height="5" rx="2" /><rect x="13" y="11" width="7" height="9" rx="2" /><rect x="4" y="15" width="7" height="5" rx="2" /></>,
  bank: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3M9 8h5" /></>,
  tests: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  books: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /><path d="M9 7h6" /></>,
  topics: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  live: <><circle cx="12" cy="12" r="2.5" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></>,
  groups: <><circle cx="9" cy="8.5" r="3.3" /><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.6" /><path d="M16 14.2c2.4-.3 4 1.2 4.6 3.8" /></>,
  users: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.6 3.8-5.8 7.5-5.8s6.7 2.2 7.5 5.8" /></>,
  results: <path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" />,
  import: <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" /></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M5 20h14" /></>,
  upload: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 20h14" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  drag: <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  chevron: <path d="m10 6 6 6-6 6" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  send: <path d="M20 4 3.5 10.6l6.4 2.5L20 4zm0 0-6.9 16-3.2-6.9" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
  eye: <><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
} as const;
export type IconName = keyof typeof P;
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{P[name]}</svg>;
}

/* ---------- controls ---------- */
type Tone = 'primary' | 'soft' | 'ghost' | 'danger' | 'dark';
export function Button({ tone = 'primary', icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; icon?: IconName }) {
  return (
    <button type="button" {...rest} className={clsx('inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[14px] px-4 text-[14px] font-bold transition-opacity disabled:opacity-45',
      tone === 'primary' && 'bg-primary text-white shadow-[0_8px_18px_rgba(106,61,240,.28)]',
      tone === 'soft' && 'bg-primary-50 text-primary',
      tone === 'ghost' && 'border border-line bg-surface text-ink',
      tone === 'danger' && 'bg-error-50 text-error-ink',
      tone === 'dark' && 'bg-ink text-white', className)}>
      {icon && <Icon name={icon} size={18} />}{children}
    </button>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={clsx('rounded-[22px] bg-surface p-5 shadow-[0_1px_2px_rgba(26,21,48,.05),0_6px_18px_rgba(26,21,48,.07)]', className)}>
      {(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-[18px] font-bold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function PageHeader({ title, sub, children, crumbs }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; crumbs?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <div className="min-w-[260px] flex-1">
        {crumbs && <div className="mb-1 text-[13px] font-semibold text-muted">{crumbs}</div>}
        <h1 className="font-display text-[30px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-[14px] text-muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

const pillTone = {
  published: 'bg-success-50 text-success-ink', draft: 'bg-track text-ink-2', archived: 'bg-warning-50 text-warning-ink',
  live: 'bg-brand text-white', ok: 'bg-success-50 text-success-ink', bad: 'bg-error-50 text-error-ink', info: 'bg-primary-50 text-primary', neutral: 'bg-track text-ink-2',
} as const;
export function Pill({ tone, children }: { tone: keyof typeof pillTone; children: ReactNode }) {
  return <span className={clsx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-bold', pillTone[tone])}>{children}</span>;
}
export const statusLabel: Record<string, [keyof typeof pillTone, string]> = {
  published: ['published', '● Опубликован'], draft: ['draft', '○ Черновик'], archived: ['archived', '▢ Архив'],
  finished: ['ok', 'Завершён'], timed_out: ['archived', 'Время вышло'], abandoned: ['bad', 'Брошен'], in_progress: ['info', 'В процессе'],
};
export const diffLabel: Record<string, string> = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
export const modeLabel: Record<string, string> = { individual: 'Личный', group: 'Группа', live: 'Эфир' };

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-bold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="text-[12px] text-muted">{hint}</span>}
      {error && <span className="text-[12px] font-semibold text-error-ink">{error}</span>}
    </label>
  );
}
const ctl = 'h-11 rounded-[12px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-50';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(ctl, p.className)} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(ctl, 'pr-8', p.className)}>{children}</select>;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(ctl, 'h-auto min-h-[88px] py-2.5 leading-5', p.className)} />;

/** Number field that lets you clear and retype freely; the value is clamped and applied on blur / Enter. */
export function NumberInput({ value, min, max, onCommit, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> & { value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const n = Math.round(Number(text));
    const v = Number.isFinite(n) && text.trim() !== '' ? Math.min(max, Math.max(min, n)) : value;
    setText(String(v));
    if (v !== value) onCommit(v);
  };
  return <Input {...rest} type="number" inputMode="numeric" min={min} max={max} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[14px] font-semibold">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-track')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[14px] bg-track p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={clsx('h-9 rounded-[10px] px-3.5 text-[13px] font-bold', value === v ? 'bg-surface text-ink shadow' : 'text-muted')}>{l}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label="Закрыть" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div role="dialog" aria-modal aria-label={typeof title === 'string' ? title : undefined} className={clsx('relative max-h-[90vh] w-full overflow-auto rounded-[24px] bg-surface p-6 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-[20px] font-bold">{title}</h2><button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-canvas"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ img = 'E02', title, children }: { img?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <img src={`/3d/rq-3d-${img}.webp`} alt="" className="size-28 object-contain" />
      <p className="text-[15px] font-bold">{title}</p>
      {children && <div className="max-w-md text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[16px] bg-error-50 px-4 py-3 text-[14px] font-semibold text-error-ink">
      <span className="flex-1">{error.message}</span>
      {onRetry && <Button tone="ghost" onClick={onRetry}>Повторить</Button>}
    </div>
  );
}

export function Spinner({ label = 'Загрузка' }: { label?: string }) {
  return <div role="status" aria-label={label} className="flex justify-center py-10"><span className="size-8 animate-spin rounded-full border-4 border-primary-50 border-t-primary" /></div>;
}

/** Table with the admin look: muted header, row dividers. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead><tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-line px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-muted">{h}</th>)}</tr></thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-3">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Initials({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const ini = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return <span className={clsx('inline-grid shrink-0 place-items-center rounded-full bg-primary-50 font-extrabold text-primary', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>{ini}</span>;
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
      <span>Показано {total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} из {total.toLocaleString('ru-RU')}</span>
      <div className="flex gap-1.5">
        <Button tone="ghost" className="!h-9 !px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</Button>
        <span className="grid h-9 min-w-9 place-items-center rounded-[10px] bg-primary-50 px-2 font-bold text-primary">{page}</span>
        <Button tone="ghost" className="!h-9 !px-3" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</Button>
      </div>
    </div>
  );
}
