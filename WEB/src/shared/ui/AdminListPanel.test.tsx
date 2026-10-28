import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminListPanel } from './AdminListPanel';
import { ListFilterBar, ListFilterField } from './ListFilterBar';

describe('AdminListPanel', () => {
  it('keeps the standard filter surface separate from the list card', () => {
    const { container } = render(
      <AdminListPanel
        title="标准列表"
        count={2}
        filters={(
          <ListFilterBar ariaLabel="标准筛选">
            <ListFilterField label="关键词"><input aria-label="关键词" /></ListFilterField>
          </ListFilterBar>
        )}
      >
        <div>列表内容</div>
      </AdminListPanel>,
    );

    const stack = container.querySelector<HTMLElement>('.admin-list-stack');
    const filterSurface = container.querySelector<HTMLElement>('.admin-list-panel__filter-surface');
    const listCard = container.querySelector<HTMLElement>('.admin-list-panel');

    expect(stack).toContainElement(filterSurface);
    expect(stack).toContainElement(listCard);
    expect(filterSurface?.nextElementSibling).toBe(listCard);
    expect(listCard?.querySelector('.list-filter-bar')).toBeNull();
    expect(screen.getByRole('heading', { name: '标准列表', level: 2 })).toBeVisible();
    expect(screen.getByRole('search', { name: '标准筛选' })).toBeVisible();
  });

  it('keeps density on the shared list card', () => {
    const { container } = render(
      <AdminListPanel title="媒体列表" density="media">
        <div>媒体内容</div>
      </AdminListPanel>,
    );

    expect(container.querySelector('.admin-list-panel')).toHaveClass('xy-admin-list--media');
  });
});
