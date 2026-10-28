import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoyaltyDetailDrawer, LoyaltyDetailFields } from './LoyaltyDetailDrawer';
const fixture = vi.hoisted(() => ({ detail: vi.fn(), permissions: ['ops.members.read'] }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ loyaltyManagement: fixture }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'operator-A', roles: ['ops.super_admin'], scopes: [{ type: 'PLATFORM', id: 'platform' }], permissions: fixture.permissions }) }));
beforeEach(() => { vi.resetAllMocks(); fixture.permissions = ['ops.members.read']; }); afterEach(cleanup);
it('opens an exact detail GET from a refreshable URL and follows issued snapshot links', async () => {
  fixture.detail.mockResolvedValue({ coupon_id: 'coupon/A', account_id: 'member-A', rights_snapshot: { kind: 'GUARD_DISCOUNT', currency: 'CNY', insurance_discount_fen: '3000' }, source_grant_id: 'grant-A' });
  render(<MemoryRouter initialEntries={['/settings/coupons?coupon_id=other&detail_kind=coupon&detail_id=coupon%2FA']}><QueryClientProvider client={new QueryClient()}><LoyaltyDetailDrawer /></QueryClientProvider></MemoryRouter>);
  await screen.findByText('保障费用抵扣 30.00 元'); expect(fixture.detail).toHaveBeenCalledExactlyOnceWith('coupon', 'coupon/A', expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'grant-A' })); await waitFor(() => expect(fixture.detail).toHaveBeenLastCalledWith('grant', 'grant-A', expect.any(AbortSignal)));
});
it('shows NO_WIN spend but excludes every reward and inventory link', () => {
  const open = vi.fn(); render(<LoyaltyDetailFields data={{ result_kind: 'NO_WIN', state: 'COMPLETED', draw_id: 'draw-A', cost_pink_units: '2', pink_spend_entry_id: 'spend-A', coupon_id: null, grant_id: null, pink_reward_entry_id: null, inventory_movement_id: null, prize_snapshot: null, prize_code: null }} onOpen={open} />);
  expect(screen.getByText('谢谢参与')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'spend-A' })).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'draw-A' })).toHaveAttribute('href', '/settings/lottery-prizes?tab=attempts&draw_id=draw-A');
  for (const label of ['奖品', '中奖时奖品权益', '优惠券编号', '粉钻奖励', '库存变更', '发奖编号']) expect(screen.queryByText(label)).not.toBeInTheDocument();
});
it('does not issue exact reads with missing permission or malformed duplicate IDs', () => {
  fixture.permissions = []; render(<MemoryRouter initialEntries={['/settings/coupons?detail_kind=coupon&detail_id=coupon-A']}><QueryClientProvider client={new QueryClient()}><LoyaltyDetailDrawer /></QueryClientProvider></MemoryRouter>);
  expect(screen.getByText('当前账号没有读取该详情的超级管理员权限。')).toBeInTheDocument(); expect(fixture.detail).not.toHaveBeenCalled();
  cleanup(); fixture.permissions = ['ops.members.read']; render(<MemoryRouter initialEntries={['/settings/coupons?detail_kind=coupon&detail_id=coupon-A&detail_id=coupon-B']}><QueryClientProvider client={new QueryClient()}><LoyaltyDetailDrawer /></QueryClientProvider></MemoryRouter>);
  expect(screen.getByText('记录类型或精确编号无效，请重新打开记录。')).toBeInTheDocument(); expect(fixture.detail).not.toHaveBeenCalled();
});
it('requires the business-record permission for an exact inventory movement', async () => {
  const mountMovement = () => render(<MemoryRouter initialEntries={['/settings/lottery-prizes?detail_kind=inventory-movement&detail_id=movement-A']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoyaltyDetailDrawer /></QueryClientProvider></MemoryRouter>);
  fixture.permissions = ['ops.system_config.read'];
  mountMovement();
  expect(screen.getByText('当前账号没有读取该详情的超级管理员权限。')).toBeInTheDocument();
  expect(fixture.detail).not.toHaveBeenCalled();
  cleanup();
  fixture.permissions = ['ops.members.read'];
  fixture.detail.mockResolvedValue({ movement_id: 'movement-A', action: 'TOTAL_ADJUSTED' });
  mountMovement();
  await waitFor(() => expect(fixture.detail).toHaveBeenCalledExactlyOnceWith('inventory-movement', 'movement-A', expect.any(AbortSignal)));
});
