import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AdminRouteLink } from './AdminRouteLink';

afterEach(cleanup);
function Location() { const location = useLocation(); return <output aria-label="当前路径">{location.pathname + location.search}</output>; }

it('keeps a real href and navigates through the router with a TDesign link', () => {
  render(<MemoryRouter><AdminRouteLink to="/orders/rental?asset_id=original">查看原订单</AdminRouteLink><Location /></MemoryRouter>);
  const link = screen.getByRole('link', { name: '查看原订单' });
  expect(link).toHaveClass('t-link'); expect(link).toHaveAttribute('href', '/orders/rental?asset_id=original');
  fireEvent.click(link);
  expect(screen.getByLabelText('当前路径')).toHaveTextContent('/orders/rental?asset_id=original');
});

it('honors a caller that cancels navigation', () => {
  render(<MemoryRouter><AdminRouteLink to="/orders" onClick={(e) => e.preventDefault()}>保留当前页面</AdminRouteLink><Location /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link'));
  expect(screen.getByLabelText('当前路径')).toHaveTextContent(/^\/$/);
});

it.each([{ ctrlKey: true, target: '_self' }, { ctrlKey: false, target: '_blank' }])('leaves modifier/new-tab navigation to the browser: %j', ({ ctrlKey, target }) => {
  render(<MemoryRouter><AdminRouteLink to="/orders" target={target}>新页面</AdminRouteLink><Location /></MemoryRouter>);
  let cancelledByComponent = true;
  const observe = (event: MouseEvent) => { cancelledByComponent = event.defaultPrevented; event.preventDefault(); };
  document.addEventListener('click', observe, { once: true });
  fireEvent.click(screen.getByRole('link'), { ctrlKey });
  expect(cancelledByComponent).toBe(false);
  expect(screen.getByLabelText('当前路径')).toHaveTextContent(/^\/$/);
});
