import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListPagination } from './ListPagination';

afterEach(cleanup);

describe('ListPagination', () => {
  it('exposes keyboard-operable page and page-size controls', async () => {
    const onChange = vi.fn();
    render(<ListPagination current={2} pageSize={10} total={48} onChange={onChange} ariaLabel="订单分页" />);

    expect(screen.getByRole('navigation', { name: '订单分页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 2 页' })).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(screen.getByRole('button', { name: '下一页' }), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(3, 10);

    fireEvent.click(screen.getByRole('combobox', { name: '每页' }));
    fireEvent.click(await screen.findByText(/20\s*条\/页/));
    expect(onChange).toHaveBeenLastCalledWith(1, 20);
  });
});
