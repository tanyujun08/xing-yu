import type { ReactNode } from 'react';

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="admin-form-section">
      {title === undefined ? null : (
        <div className="admin-form-section__heading">
          <h3>{title}</h3>
          {description === undefined ? null : <p>{description}</p>}
        </div>
      )}
      <div className="admin-form-section__body">{children}</div>
    </section>
  );
}
