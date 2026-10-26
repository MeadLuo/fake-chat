import { useId, type ReactNode } from 'react';

export function Page({ title, intro, children, aside }: { title: string; intro?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={`page ${aside ? 'page-split' : ''}`}>
      <div className="page-main">
        <header className="page-head">
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </header>
        {children}
      </div>
      {aside && <aside className="page-aside">{aside}</aside>}
    </div>
  );
}

export function Group({ title, note, children, actions }: { title: string; note?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="group">
      <div className="group-head">
        <div>
          <h2>{title}</h2>
          {note && <p className="note">{note}</p>}
        </div>
        {actions && <div className="group-actions">{actions}</div>}
      </div>
      <div className="group-body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`field ${wide ? 'field-wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">{children(id)}</div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id} className="toggle-label">{label}</label>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <button id={id} role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export function Slider({ id, value, min, max, step = 1, onChange, format }: {
  id?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        style={{ '--pct': pct + '%' } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{format ? format(value) : value}</output>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} title={o.title}
          className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select id={id} className="input" value={value} onChange={e => onChange(e.target.value as T)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ColorInput({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="color">
      <input id={id} type="color" value={value} onChange={e => onChange(e.target.value)} />
      <span style={{ background: value }} />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

export function Status({ tone, children, title }: { tone: 'off' | 'good' | 'busy' | 'bad'; children: ReactNode; title?: string }) {
  return <span className={`status status-${tone}`} title={title}><i />{children}</span>;
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'bad' | 'good'; children: ReactNode; action?: ReactNode }) {
  return <div className={`notice notice-${tone}`}><div>{children}</div>{action}</div>;
}
