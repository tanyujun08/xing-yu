import { useId, type ReactNode } from 'react';
import { Card } from 'tdesign-react';
import './AdminListPanel.css';

export interface AdminListPanelProps {
  title: ReactNode;
  count?: number;
  countLabel?: string;
  description?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  pagination?: ReactNode;
  children: ReactNode;
  className?: string;
  density?: 'business' | 'media' | 'log';
}

export function AdminListPanel({
  title,
  count,
  countLabel = '条',
  description,
  actions,
  filters,
  pagination,
  children,
  className,
  density = 'business',
}: AdminListPanelProps) {
  const headingId = useId();
  const cardClasses = ['data-card', 'admin-list-panel', 'xy-admin-list', `xy-admin-list--${density}`, className].filter(Boolean).join(' ');

  return (
    <section className="admin-list-stack" aria-labelledby={headingId}>
      {filters === undefined ? null : (
        <div className="admin-list-panel__filter-surface">
          {filters}
        </div>
      )}
      <Card
        className={cardClasses}
        header={(
          <div className="admin-list-panel__header">
            <div className="admin-list-panel__heading-copy">
              <div className="admin-list-panel__title-row">
                <h2 id={headingId}>{title}</h2>
                {count === undefined ? null : (
                  <span className="admin-list-panel__count" aria-label={`共 ${count} ${countLabel}`}>
                    {count} {countLabel}
                  </span>
                )}
              </div>
              {description === undefined ? null : <div className="admin-list-panel__description">{description}</div>}
            </div>
            {actions === undefined ? null : <div className="admin-list-panel__actions">{actions}</div>}
          </div>
        )}
      >
        <div className="admin-list-panel__content">{children}</div>
        {pagination === undefined ? null : <div className="admin-list-panel__pagination">{pagination}</div>}
      </Card>
    </section>
  );
}
