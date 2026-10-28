import type { ReactNode } from 'react';

export interface ListFilterBarProps {
  ariaLabel?: string;
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface ListFilterFieldProps {
  label: ReactNode;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}

export function ListFilterField({ label, children, wide = false, className }: ListFilterFieldProps) {
  const classes = ['list-filter-field', wide ? 'list-filter-field--wide' : '', className].filter(Boolean).join(' ');

  return (
    <label className={classes}>
      <span className="list-filter-field__label">{label}</span>
      <span className="list-filter-field__control">{children}</span>
    </label>
  );
}

export function ListFilterBar({
  ariaLabel = '列表筛选',
  summary,
  actions,
  children,
  className,
}: ListFilterBarProps) {
  const classes = ['list-filter-bar', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="search" aria-label={ariaLabel}>
      <div className="list-filter-bar__fields">{children}</div>
      {summary === undefined && actions === undefined ? null : (
        <div className="list-filter-bar__meta">
          {summary === undefined ? null : <span className="list-filter-bar__summary" aria-live="polite">{summary}</span>}
          {actions === undefined ? null : <div className="list-filter-bar__actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}
