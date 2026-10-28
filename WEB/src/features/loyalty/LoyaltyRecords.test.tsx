import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoyaltyRecords } from './LoyaltyRecords';
const fixture = vi.hoisted(() => ({ lotteryAttempts: vi.fn(), movements: vi.fn(), permissions: ['ops.members.read'] }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ loyaltyManagement: fixture }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'operator-A', roles: ['ops.super_admin'], scopes: [{ type: 'PLATFORM', id: 'platform' }], permissions: fixture.permissions }) }));
beforeEach(() => { vi.resetAllMocks(); fixture.permissions = ['ops.members.read']; fixture.lotteryAttempts.mockResolvedValue({ items: [], page: { next_cursor: 'signed-next+A' }, as_of_at: '2026-10-01T00:00:00Z' }); }); afterEach(cleanup);
function URL() { return <output aria-label="当前查询URL">{useLocation().search}</output>; }
function mount(entry = '/settings/lottery-prizes?tab=attempts') { render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoyaltyRecords kind="attempts" configKey="benefits.lottery" /><URL /></QueryClientProvider></MemoryRouter>); }
it('queries only submitted inputs, resets cursor on filtering and restores previous server cursor', async () => {
  mount(); await waitFor(() => expect(fixture.lotteryAttempts).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: '查询' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('账号编号'), { target: { value: 'member-A' } }); expect(fixture.lotteryAttempts).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '查询' })); await waitFor(() => expect(fixture.lotteryAttempts).toHaveBeenLastCalledWith({ account_id: 'member-A' }, expect.any(AbortSignal)));
  await waitFor(() => expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '下一页' })); await waitFor(() => expect(fixture.lotteryAttempts).toHaveBeenLastCalledWith({ account_id: 'member-A', cursor: 'signed-next+A' }, expect.any(AbortSignal)));
  expect(screen.getByLabelText('当前查询URL')).toHaveTextContent('_previous_cursor='); await waitFor(() => expect(screen.getByRole('button', { name: '上一页' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '上一页' }));
  await waitFor(() => expect(screen.getByLabelText('当前查询URL')).not.toHaveTextContent('cursor='));
  await waitFor(() => expect(screen.getByRole('button', { name: '查询' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('账号编号'), { target: { value: 'with whitespace' } }); fireEvent.click(screen.getByRole('button', { name: '查询' })); expect(screen.getByText('账号编号格式无效，请填写完整精确编号。')).toBeInTheDocument();
});
it('retains filter URL on exact detail open and shows a NO_WIN row with no reward links', async () => {
  fixture.lotteryAttempts.mockResolvedValue({ items: [{ account_id: 'member-A', attempt_id: 'attempt-A', draw_id: 'draw-A', state: 'COMPLETED', result_kind: 'NO_WIN', cost_pink_units: '2', prize_code: null, coupon_id: null, pink_reward_entry_id: null, pink_spend_entry_id: 'spend-A', inventory_movement_id: null, reason_code: null, received_at: '2026-10-01T00:00:00Z' }], page: { next_cursor: null }, as_of_at: '2026-10-01T00:00:00Z' });
  mount('/settings/lottery-prizes?tab=attempts&draw_id=draw-A&result_kind=NO_WIN'); await screen.findByText('实际消耗 2 粉钻', { exact: false });
  expect(screen.getAllByText('谢谢参与').length).toBeGreaterThan(0); expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  for (const label of ['中奖优惠券', '粉钻奖励', '库存变更']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'attempt-A' })); expect(screen.getByLabelText('当前查询URL')).toHaveTextContent('draw_id=draw-A'); expect(screen.getByLabelText('当前查询URL')).toHaveTextContent('detail_kind=lottery-attempt'); expect(screen.getByLabelText('当前查询URL')).toHaveTextContent('detail_id=attempt-A');
});
it('blocks malformed URL filters before reading records', () => {
  mount('/settings/lottery-prizes?tab=attempts&from=2026-02-30T00%3A00&account_id=member-A'); expect(screen.getByRole('alert')).toHaveTextContent('时间'); expect(fixture.lotteryAttempts).not.toHaveBeenCalled();
});
it('uses the business-record permission for inventory movements', async () => {
  const mountMovements = () => render(<MemoryRouter initialEntries={['/settings/lottery-prizes?tab=movements']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoyaltyRecords kind="movements" configKey="benefits.lottery" /></QueryClientProvider></MemoryRouter>);
  fixture.permissions = ['ops.system_config.read'];
  mountMovements();
  expect(screen.getByText('当前账号没有库存变更记录的读取权限。')).toBeInTheDocument();
  expect(fixture.movements).not.toHaveBeenCalled();
  cleanup();
  fixture.permissions = ['ops.members.read'];
  fixture.movements.mockResolvedValue({ items: [], page: { next_cursor: null }, as_of_at: '2026-10-01T00:00:00Z' });
  mountMovements();
  await waitFor(() => expect(fixture.movements).toHaveBeenCalledExactlyOnceWith({}, expect.any(AbortSignal)));
});
