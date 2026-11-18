import { useId, useState } from 'react';

export function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/60',
    secondary: 'bg-white text-ink ring-1 ring-line hover:bg-canvas disabled:text-muted',
    ghost: 'text-brand-700 hover:bg-brand-50',
  };
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function TextField({ label, error, hint, className = '', type = 'text', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`block min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none transition-colors placeholder:text-muted/70 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${
            error ? 'border-rose-400' : 'border-line'
          } ${isPassword ? 'pr-20' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-brand-700"
            aria-pressed={visible}
          >
            {visible ? 'Sembunyi' : 'Lihat'}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'bg-rose-50 text-rose-800 ring-rose-200',
    success: 'bg-brand-50 text-brand-800 ring-brand-200',
    info: 'bg-sky-50 text-sky-900 ring-sky-200',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm ring-1 ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ small = false, label }) {
  const size = small ? 'size-4 border-2' : 'size-8 border-[3px]';
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <span className={`${size} animate-spin rounded-full border-current border-r-transparent opacity-70`} aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`rounded-xl bg-white ring-1 ring-line ${className}`} {...props}>
      {children}
    </section>
  );
}

export function ScoreBar({ value, className = 'bg-brand-600' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
