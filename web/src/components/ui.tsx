import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-10 pt-9 pb-6">
      <div>
        <div className="label-mono text-fg-3">{kicker}</div>
        <h1 className="display mt-2 text-[40px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-fg text-ink-0 hover:bg-white active:translate-y-px',
  secondary: 'border border-line-strong bg-ink-2 text-fg hover:bg-ink-3 hover:border-fg-3',
  ghost: 'text-fg-2 hover:bg-ink-2 hover:text-fg',
  danger: 'text-total hover:bg-total/10',
};

export function Button({ variant = 'secondary', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold transition-all duration-200 ease-[var(--ease-out-expo)] disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-ink-0 px-1.5 py-px font-mono text-[11px] text-fg-3">{children}</kbd>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="silver-ring relative grid size-24 place-items-center rounded-full p-[6px] opacity-80">
        <div className="size-full rounded-full bg-ink-0" />
        <span className="absolute right-3 top-2 size-3.5 rounded-full bg-coral" />
      </div>
      <h2 className="display mt-6 text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-fg-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block">
    <span className="label-mono text-fg-3">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-[12px] text-fg-3">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full rounded-lg border border-line-strong bg-ink-0 px-3 py-2.5 text-[15px] text-fg placeholder:text-fg-3 transition-colors focus:border-fg-2 focus:outline-none';
