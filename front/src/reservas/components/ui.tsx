import type { ReactNode } from 'react';
import { initials } from '../format';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <div className={`avatar avatar--${size}`} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

export function ScreenHeader({
  onBack,
  backLabel = 'Volver',
  step,
  title,
}: {
  onBack?: () => void;
  backLabel?: string;
  step?: string;
  title: string;
}) {
  return (
    <header className="screen-header">
      {onBack && (
        <button type="button" className="back-link" onClick={onBack}>
          <span aria-hidden="true">‹</span> {backLabel}
        </button>
      )}
      {step && <p className="r-eyebrow">{step}</p>}
      <h1>{title}</h1>
    </header>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottom-bar">{children}</div>;
}

export function Alert({
  tone = 'error',
  title,
  children,
}: {
  tone?: 'error' | 'info';
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`r-alert r-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
