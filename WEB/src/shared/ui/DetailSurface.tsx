import type { ReactNode } from 'react';
import './detail-surface.css';

export function DetailSurface({
  title,
  description,
  actions,
  children,
  className = '',
  variant = 'surface',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'surface' | 'section';
}) {
  return (
    <section className={`detail-surface detail-surface--${variant} ${className}`.trim()}>
      <header className="detail-surface__header">
        <div className="detail-surface__heading">
          <h2>{title}</h2>
          {description === undefined ? null : <p>{description}</p>}
        </div>
        {actions === undefined ? null : <div className="detail-surface__actions">{actions}</div>}
      </header>
      <div className="detail-surface__body">{children}</div>
    </section>
  );
}

export function DetailDefinitionList({
  children,
  columns = 2,
  className = '',
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return <dl className={`detail-definition-list detail-definition-list--${columns} ${className}`.trim()}>{children}</dl>;
}

export function DetailPageSummary({
  media,
  eyebrow,
  title,
  description,
  statuses,
  trace,
  metric,
  actions,
  className = '',
}: {
  media?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  statuses?: ReactNode;
  trace?: ReactNode;
  metric?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`detail-page-summary ${className}`.trim()}>
      {media === undefined ? null : <div className="detail-page-summary__media">{media}</div>}
      <div className="detail-page-summary__main">
        {eyebrow === undefined ? null : <div className="detail-page-summary__eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description === undefined ? null : <p>{description}</p>}
        {statuses === undefined ? null : <div className="detail-page-summary__statuses">{statuses}</div>}
        {trace === undefined ? null : <div className="detail-page-summary__trace">{trace}</div>}
      </div>
      {metric === undefined ? null : <div className="detail-page-summary__metric">{metric}</div>}
      {actions === undefined ? null : <div className="detail-page-summary__actions">{actions}</div>}
    </header>
  );
}

export function DetailTraceRail({
  items,
}: {
  items: readonly { label: ReactNode; value: ReactNode; mono?: boolean }[];
}) {
  return (
    <dl className="detail-trace-rail">
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.label}</dt>
          <dd className={item.mono === true ? 'mono-value' : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailEmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`detail-empty-state ${className}`.trim()}>{children}</div>;
}
