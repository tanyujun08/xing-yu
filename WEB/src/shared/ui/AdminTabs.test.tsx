import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminTabPanel, AdminTabs } from './AdminTabs';

afterEach(cleanup);

describe('AdminTabs', () => {
  it('uses the line variant by default and keeps an accessible tablist', () => {
    const { container } = render(
      <AdminTabs value="overview">
        <AdminTabPanel value="overview" label="概览">概览内容</AdminTabPanel>
        <AdminTabPanel value="history" label="记录">记录内容</AdminTabPanel>
      </AdminTabs>,
    );

    expect(container.querySelector('.xy-admin-tabs--line')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute('aria-selected', 'true');
  });

  it('applies the self-contained surface variant', () => {
    const { container } = render(
      <AdminTabs value="rules" variant="surface">
        <AdminTabPanel value="rules" label="规则">规则内容</AdminTabPanel>
      </AdminTabs>,
    );

    expect(container.querySelector('.xy-admin-tabs--surface')).toBeInTheDocument();
    expect(screen.getByText('规则内容')).toBeVisible();
  });
});
