import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { paginateListRows, useListParams } from './useListParams';

afterEach(cleanup);

function Probe() {
  const location = useLocation();
  const list = useListParams({ defaultPageSize: 20 });

  return (
    <div>
      <span data-testid="state">{`${list.page}|${list.pageSize}|${list.get('keyword')}|${location.search}`}</span>
      <button type="button" onClick={() => list.setFilters({ keyword: '相机' })}>筛选</button>
      <button type="button" onClick={() => list.update({ page: 3, pageSize: 50 })}>分页</button>
      <button type="button" onClick={list.resetFilters}>重置</button>
    </div>
  );
}

describe('useListParams', () => {
  it('reads URL state and resets the page when a filter changes', () => {
    render(<MemoryRouter initialEntries={['/?keyword=镜头&page=4&pageSize=20']}><Probe /></MemoryRouter>);

    expect(screen.getByTestId('state')).toHaveTextContent('4|20|镜头|?keyword=镜头&page=4&pageSize=20');
    fireEvent.click(screen.getByRole('button', { name: '筛选' }));
    expect(screen.getByTestId('state')).toHaveTextContent('1|20|相机|?keyword=%E7%9B%B8%E6%9C%BA&pageSize=20');
  });

  it('keeps a non-default page size when filters are reset', () => {
    render(<MemoryRouter initialEntries={['/?keyword=镜头&page=2']}><Probe /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: '分页' }));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(screen.getByTestId('state')).toHaveTextContent('1|50||?pageSize=50');
  });

  it('falls back when URL pagination values are outside the supported contract', () => {
    render(<MemoryRouter initialEntries={['/?page=999&pageSize=999999']}><Probe /></MemoryRouter>);

    expect(screen.getByTestId('state')).toHaveTextContent('999|20||?page=999&pageSize=999999');
    expect(paginateListRows(['a', 'b', 'c'], 999, 20)).toEqual({
      current: 1,
      pageSize: 20,
      total: 3,
      rows: ['a', 'b', 'c'],
    });
  });
});
