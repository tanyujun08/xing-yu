import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header-block">
      <div className="page-header-copy">
        {eyebrow === undefined ? null : <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description === undefined ? null : <p>{description}</p>}
      </div>
      {actions === undefined ? null : <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
