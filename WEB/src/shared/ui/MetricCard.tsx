import type { ReactNode } from 'react';
import { Card } from 'tdesign-react';

export interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: 'indigo' | 'mint' | 'amber' | 'violet';
}

export function MetricCard({ label, value, hint, icon, tone = 'indigo' }: MetricCardProps) {
  return (
    <Card className={`metric-card metric-card--${tone}`} bordered={false}>
      <div className="metric-card-topline">
        <span>{label}</span>
        <span className="metric-card-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </Card>
  );
}
