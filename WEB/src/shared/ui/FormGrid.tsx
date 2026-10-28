import type { ReactNode } from 'react';

interface FormGridProps {
  children: ReactNode;
  columns?: 1 | 2;
}

export function FormGrid({ children, columns = 2 }: FormGridProps) {
  return <div className={`admin-form-grid admin-form-grid--${columns}`}>{children}</div>;
}
