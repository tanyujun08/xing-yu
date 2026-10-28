import { useLayoutEffect, useRef } from 'react';
import { Pagination } from 'tdesign-react';

export interface ListPaginationProps {
  current: number;
  pageSize: number;
  total: number;
  onChange: (current: number, pageSize: number) => void;
  pageSizeOptions?: number[];
  ariaLabel?: string;
}

export function ListPagination({
  current,
  pageSize,
  total,
  onChange,
  pageSizeOptions = [10, 20, 50],
  ariaLabel = '列表分页',
}: ListPaginationProps) {
  const root = useRef<HTMLElement>(null);
  const safeCurrent = Math.min(Math.max(1, current), Math.max(1, Math.ceil(total / pageSize)));
  // TDesign 1.18.2 renders clickable div/li controls. Retain keyboard and
  // screen-reader behavior while the library owns pagination rendering.
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const sync = () => {
      container.querySelectorAll<HTMLElement>('.t-pagination__number, .t-pagination__btn').forEach((item) => {
        const disabled = item.classList.contains('t-is-disabled');
        item.setAttribute('role', 'button');
        item.tabIndex = disabled ? -1 : 0;
        item.setAttribute('aria-disabled', String(disabled));
        const previous = item.classList.contains('t-pagination__btn-prev');
        const next = item.classList.contains('t-pagination__btn-next');
        const more = item.classList.contains('t-pagination__number--more');
        item.setAttribute('aria-label', previous ? '上一页' : next ? '下一页' : more ? '更多页码' : `第 ${item.textContent?.trim()} 页`);
        if (item.classList.contains('t-is-current')) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      const select = container.querySelector<HTMLInputElement>('.t-select input');
      if (select) { select.setAttribute('aria-label', '每页'); select.setAttribute('role', 'combobox'); }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [safeCurrent, pageSize, total]);

  return (
    <nav ref={root} className="list-pagination" aria-label={ariaLabel} onKeyDown={(event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('.t-pagination__number, .t-pagination__btn')) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (event.target.getAttribute('aria-disabled') !== 'true') event.target.click(); }
    }}>
      <Pagination current={safeCurrent} pageSize={pageSize} total={total} pageSizeOptions={pageSizeOptions}
        showJumper={false} onChange={(page) => onChange(page.pageSize === pageSize ? page.current : 1, page.pageSize)} />
    </nav>
  );
}
