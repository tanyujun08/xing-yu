import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CouponsSettingsPage, LotteryPrizesSettingsPage } from './LoyaltyManagementPages';
import { couponDraft, couponTypes, lotteryDraft, prizeCodes } from './loyaltyPolicies';
import { CouponPolicyFields, LotteryPolicyFields } from './LoyaltyPolicyFields';
import type { CouponsPolicy, LotteryPolicy, LoyaltyEffectiveResult, LoyaltyEffectiveConfig, LotteryInventory } from '../../shared/services/loyaltyManagement';
import { LoyaltySaveIntentStore } from './loyaltySaveIntent';
import { isLoyaltySaveRequest } from './loyaltyPolicies';
import { ApiProblem } from '../../shared/services/testing/problemFixture';
import { IntegratedLoyaltySettingsPage } from './IntegratedLoyaltySettingsPage';

const fixture = vi.hoisted(() => ({ effective: vi.fn(), save: vi.fn(), inventory: vi.fn(), sources: vi.fn(), versions: vi.fn(), sourceVersions: vi.fn(), detail: vi.fn(), permissions: ['ops.system_config.read', 'ops.business_config.publish', 'ops.members.read', 'ops.audit.read'], roles: ['ops.super_admin'], scopes: [{ type: 'PLATFORM', id: 'platform' }] }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ loyaltyManagement: fixture, businessConfig: { effective: fixture.sources, versions: fixture.sourceVersions } }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'operator-A', permissions: fixture.permissions, roles: fixture.roles, scopes: fixture.scopes }) }));
const policy: CouponsPolicy = { coupons: couponTypes.map((coupon_type) => ({ coupon_type, enabled: true, insurance_discount_fen: coupon_type === 'GUARD_DISCOUNT' ? '3000' : null })) };
const pool: LotteryPolicy = { pool_code: 'MAIN', enabled: false, cost_pink_units: '2', no_win_probability_bps: 10000, prizes: prizeCodes.map((prize_code) => ({ prize_code, enabled: false, probability_bps: 0, total_qty: '10', pink_reward_units: prize_code === 'PINK' ? '3' : null })) };
function stock(): LotteryInventory[] { return prizeCodes.map((prize_code) => ({ prize_code, total_qty: '10', issued_qty: '0', remaining_qty: '10', version: '1' })); }
function effective(value = policy, epoch = '7'): LoyaltyEffectiveResult { return { current: { config_key: 'benefits.coupons', config_version_id: `config-${epoch}`, effective_epoch: epoch, value, saved_by: 'operator-A', effective_at: '2026-10-01T00:00:00Z' }, inventory: null, as_of_at: '2026-10-01T00:00:00Z' }; }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); fixture.roles = ['ops.super_admin']; fixture.permissions = ['ops.system_config.read', 'ops.business_config.publish', 'ops.members.read', 'ops.audit.read'];
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: { ...effective().current, config_key: 'benefits.lottery', value: pool }, inventory: stock(), as_of_at: '2026-10-01T00:00:00Z' }));
  fixture.versions.mockResolvedValue({ items: [], page: { next_cursor: null } }); fixture.sourceVersions.mockResolvedValue({ items: [], page: { page_size: 20, has_more: false } });
  fixture.sources.mockResolvedValue([]); fixture.inventory.mockResolvedValue({ items: prizeCodes.map((prize_code) => ({ prize_code, total_qty: '10', issued_qty: '0', remaining_qty: '10', version: '1' })), as_of_at: '2026-10-01T00:00:00Z' });
});
afterEach(cleanup);
function mount(lottery = false, entry = lottery ? '/settings/lottery-prizes' : '/settings/coupons') { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}>{lottery ? <LotteryPrizesSettingsPage /> : <CouponsSettingsPage />}</QueryClientProvider></MemoryRouter>); }
it('shows actual current values without inputs until edit and retains invalid raw text without sending', async () => {
  mount(); await screen.findByText('30.00 元'); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '编辑配置' }));
  const amount = screen.getByLabelText('保障费用抵扣金额（元）'); fireEvent.change(amount, { target: { value: '30.123' } }); fireEvent.blur(amount);
  expect(amount).toHaveValue('30.123'); fireEvent.click(screen.getByRole('button', { name: '保存并生效' }));
  expect(fixture.save).not.toHaveBeenCalled(); expect(screen.queryByText('确认保存并生效')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '取消编辑' })); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('distinguishes an unconfigured policy from a failed read and cannot configure a failed read', async () => {
  fixture.effective.mockRejectedValue(new Error('读取失败')); mount();
  await screen.findByText('生效配置读取失败：读取失败'); expect(screen.getByRole('button', { name: '配置' })).toBeDisabled(); expect(screen.queryByText('尚未配置。填写完整配置并保存后生效。')).not.toBeInTheDocument();
  cleanup(); fixture.effective.mockImplementation((key: string) => Promise.resolve({ current: null, inventory: key === 'benefits.lottery' ? stock().map((row) => ({ ...row, total_qty: '0', remaining_qty: '0', version: '0' })) : null, as_of_at: '2026-10-01T00:00:00Z' })); mount();
  await screen.findByText('尚未配置。填写完整配置并保存后生效。'); await waitFor(() => expect(screen.getByRole('button', { name: '配置' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '配置' })); expect(screen.getByLabelText('保障费用抵扣金额（元）')).toHaveValue('');
});
it('restores the persisted original body and key after reload and never submits a newer effective value', async () => {
  const body = { base_effective_epoch: '5', value: { coupons: policy.coupons.map((row) => ({ ...row, insurance_discount_fen: row.coupon_type === 'GUARD_DISCOUNT' ? '2500' : null })) }, reason: '原配置金额调整' };
  const store = new LoyaltySaveIntentStore(localStorage, isLoyaltySaveRequest, () => 'original-key-12345678'); store.begin('operator-A', 'benefits.coupons', body);
  fixture.save.mockImplementation(async (_key: string, original: typeof body) => ({ config_version_id: 'config-saved', effective_epoch: '8', effective_at: '2026-10-01T00:00:00Z', saved_by: 'operator-A', current: { ...effective().current, value: original.value }, inventory: null, replayed: true, operation_event_id: 'event-A' }));
  mount(); const recovery = await screen.findByRole('region', { name: '恢复原保存请求' }).catch(() => screen.getByLabelText('恢复原保存请求'));
  expect(within(recovery).getByText('25.00 元')).toBeInTheDocument(); expect(within(recovery).getByText('5')).toBeInTheDocument(); expect(within(recovery).getByText('原保存原因：原配置金额调整')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复原保存' })); await waitFor(() => expect(fixture.save).toHaveBeenCalledExactlyOnceWith('benefits.coupons', body, 'original-key-12345678'));
  await screen.findByText('保存已确认；另一位管理员随后更新了配置，页面展示最新生效值。'); expect(store.read('operator-A', 'benefits.coupons')).toBeNull();
});
it('rejects a permissions-only operator before any config or detail request', () => {
  fixture.roles = ['ops.operations']; mount(false, '/settings/coupons?detail_kind=coupon&detail_id=coupon-A');
  expect(screen.getByText('仅当前平台超级管理员且具有配置读取权限的账号可访问。')).toBeInTheDocument(); expect(fixture.effective).not.toHaveBeenCalled(); expect(fixture.detail).not.toHaveBeenCalled();
});
it('keeps a different draft blocked after an unknown save and recovers the original intent visibly', async () => {
  fixture.save.mockRejectedValueOnce(new Error('网络结果未知')).mockImplementationOnce(async (_key: string, body: { value: CouponsPolicy }) => ({ config_version_id: 'config-saved', effective_epoch: '8', effective_at: '2026-10-01T00:00:00Z', saved_by: 'operator-A', current: { ...effective().current, value: body.value }, inventory: null, replayed: true, operation_event_id: 'event-A' }));
  mount(); await screen.findByText('30.00 元'); await waitFor(() => expect(screen.getByRole('button', { name: '编辑配置' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '编辑配置' }));
  fireEvent.change(screen.getByLabelText('保障费用抵扣金额（元）'), { target: { value: '35.00' } }); fireEvent.click(screen.getByRole('button', { name: '保存并生效' }));
  fireEvent.change(screen.getByPlaceholderText('填写本次调整原因（3～256 个字符）'), { target: { value: '调整保障抵扣金额' } }); fireEvent.click(screen.getByRole('button', { name: '确认保存并生效' }));
  await screen.findByRole('button', { name: '恢复原保存' }); await waitFor(() => expect(screen.queryByRole('button', { name: '确认保存并生效' })).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('保障费用抵扣金额（元）'), { target: { value: '99.00' } });
  expect(screen.getByRole('status')).toHaveTextContent('草稿已保留'); expect(screen.getByRole('button', { name: '保存并生效' })).toBeDisabled();
  const recovery = screen.getByLabelText('恢复原保存请求'); expect(within(recovery).getByText('35.00 元')).toBeInTheDocument(); expect(within(recovery).getByText('原保存原因：调整保障抵扣金额')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '恢复原保存' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '恢复原保存' })); await waitFor(() => expect(fixture.save).toHaveBeenCalledTimes(2)); expect(fixture.save.mock.calls[0]).toEqual(fixture.save.mock.calls[1]); expect(screen.getByLabelText('保障费用抵扣金额（元）')).toHaveValue('99.00');
});
it('reads NO_WIN as a separate probability and offers no inventory or rights inputs for it', async () => {
  mount(true); await screen.findByText('谢谢参与概率'); fireEvent.click(screen.getByRole('button', { name: '编辑配置' }));
  const thanks = screen.getByRole('heading', { name: '谢谢参与' }).parentElement!;
  expect(within(thanks).getAllByRole('textbox')).toHaveLength(1); expect(within(thanks).getByText('库存：— · 权益：—')).toBeInTheDocument(); expect(within(thanks).getByText('正常消耗本次粉钻，不发奖励。')).toBeInTheDocument();
});
it('keeps local input and requires an explicit rebase after a newer effective epoch is read', async () => {
  mount(); await screen.findByText('30.00 元'); fireEvent.click(screen.getByRole('button', { name: '编辑配置' }));
  const amount = screen.getByLabelText('保障费用抵扣金额（元）'); fireEvent.change(amount, { target: { value: '31.00' } });
  const newer = structuredClone(policy); newer.coupons[3]!.insurance_discount_fen = '4000'; fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective(newer, '8') : { current: { ...effective().current as LoyaltyEffectiveConfig, config_key: 'benefits.lottery', value: pool }, inventory: stock(), as_of_at: '2026-10-01T00:00:00Z' }));
  fireEvent.click(screen.getByRole('button', { name: '刷新最新配置' })); await screen.findByText('另一位管理员已更新配置，草稿已保留。请核对以下差异，再选择基于最新配置继续编辑。');
  expect(amount).toHaveValue('31.00'); expect(screen.getByRole('button', { name: '保存并生效' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '基于最新配置继续编辑' })); expect(amount).toHaveValue('31.00'); expect(screen.getByRole('button', { name: '保存并生效' })).toBeEnabled(); expect(fixture.save).not.toHaveBeenCalled();
});
it('uses only the inventory snapshot from the effective response and identifies exhausted enabled prizes', async () => {
  const enabled: LotteryPolicy = { ...pool, enabled: true, no_win_probability_bps: 9000, prizes: pool.prizes.map((row) => row.prize_code === 'PINK' ? { ...row, enabled: true, probability_bps: 1000 } : row) };
  const snapshot = stock().map((row) => ({ ...row, issued_qty: row.prize_code === 'PINK' ? '10' : '0', remaining_qty: row.prize_code === 'PINK' ? '0' : '10', version: '9' }));
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: { ...effective().current as LoyaltyEffectiveConfig, config_key: 'benefits.lottery', value: enabled }, inventory: snapshot, as_of_at: '2026-10-01T00:00:00Z' }));
  mount(true); await screen.findByText('库存暂停：粉钻已无剩余份数，当前奖池不能继续抽奖。');
  const table = screen.getByRole('table', { name: '服务端最新奖品库存' }); const row = within(table).getByRole('row', { name: '粉钻 10 10 0 9' }); expect(row).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新最新配置' })); await waitFor(() => expect(fixture.effective).toHaveBeenCalledTimes(4)); expect(fixture.inventory).not.toHaveBeenCalled();
});
it.each(['missing', 'duplicate'] as const)('blocks configured editing when the same-response inventory is %s', async (shape) => {
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: { ...effective().current as LoyaltyEffectiveConfig, config_key: 'benefits.lottery', value: pool }, inventory: shape === 'missing' ? null : stock().map((row) => ({ ...row, prize_code: 'PINK' })), as_of_at: '2026-10-01T00:00:00Z' }));
  mount(true); await screen.findByText('生效配置读取失败：生效配置同响应库存结构无法核对，请重试读取。');
  expect(screen.getByRole('button', { name: '配置' })).toBeDisabled(); expect(fixture.save).not.toHaveBeenCalled(); expect(fixture.inventory).not.toHaveBeenCalled();
});
it('configures a new lottery using only the initial stock actually returned in the same response', async () => {
  const initial = stock().map((row) => ({ ...row, total_qty: '0', remaining_qty: '0', version: '0' }));
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: null, inventory: initial, as_of_at: '2026-10-01T00:00:00Z' }));
  fixture.save.mockImplementation(async (_key: string, body: { value: LotteryPolicy }) => ({ config_version_id: 'initial-lottery', effective_epoch: '1', effective_at: '2026-10-01T00:00:00Z', saved_by: 'operator-A', current: { config_key: 'benefits.lottery', config_version_id: 'initial-lottery', effective_epoch: '1', effective_at: '2026-10-01T00:00:00Z', saved_by: 'operator-A', value: body.value }, inventory: initial, replayed: false, operation_event_id: 'initial-event' }));
  mount(true); await screen.findByText('尚未配置。填写完整配置并保存后生效。'); await waitFor(() => expect(screen.getByRole('button', { name: '配置' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '配置' }));
  fireEvent.change(screen.getByLabelText('每次抽奖消耗粉钻（整数）'), { target: { value: '2' } }); fireEvent.change(screen.getByLabelText('谢谢参与概率（%）'), { target: { value: '100' } });
  screen.getAllByLabelText('中奖概率（%）').forEach((input) => fireEvent.change(input, { target: { value: '0' } })); screen.getAllByLabelText('累计总份数').forEach((input) => fireEvent.change(input, { target: { value: '10' } })); fireEvent.change(screen.getByLabelText('每份粉钻奖励（整数）'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并生效' })); fireEvent.change(screen.getByPlaceholderText('填写本次调整原因（3～256 个字符）'), { target: { value: '首次配置主奖池' } }); fireEvent.click(screen.getByRole('button', { name: '确认保存并生效' }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledOnce()); expect(fixture.save.mock.calls[0]![0]).toBe('benefits.lottery'); expect(fixture.save.mock.calls[0]![1]).toMatchObject({ base_effective_epoch: '0', value: pool, reason: '首次配置主奖池' }); expect(fixture.inventory).not.toHaveBeenCalled();
});
it('blocks initial editing when the lottery response has no real inventory snapshot', async () => {
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: null, inventory: null, as_of_at: '2026-10-01T00:00:00Z' }));
  mount(true); await screen.findByText('生效配置读取失败：生效配置同响应库存结构无法核对，请重试读取。');
  expect(screen.getByRole('button', { name: '配置' })).toBeDisabled(); expect(fixture.inventory).not.toHaveBeenCalled(); expect(fixture.save).not.toHaveBeenCalled();
});
it('maps control error aliases while retaining the displayed raw coupon and lottery inputs', () => {
  const change = vi.fn(); render(<CouponPolicyFields draft={couponDraft(policy)} change={change} disabled={false} submitted={false} errors={{ 'coupons.3.insurance_discount_fen': '金额控件拒绝' }} />);
  const amount = screen.getByLabelText('保障费用抵扣金额（元）'); expect(amount).toHaveValue('30.00'); expect(within(amount.closest('.loyalty-text-field') as HTMLElement).getByRole('alert')).toHaveTextContent('金额控件拒绝'); expect(change).not.toHaveBeenCalled(); cleanup();
  const errors = { enabled: '奖池启用字段拒绝', 'prizes.4.enabled': '奖品启用字段拒绝', 'prizes.4.total_qty': '奖品总量字段拒绝', 'prizes.4.probability_bps': '奖品概率字段拒绝', 'prizes.4.pink_reward_units': '粉钻奖励字段拒绝', no_win_probability_bps: '未中奖概率字段拒绝', cost_pink_units: '粉钻成本字段拒绝' };
  render(<LotteryPolicyFields draft={lotteryDraft(pool)} change={change} inventory={stock()} coupons={null} disabled={false} submitted={false} errors={errors} />);
  for (const message of Object.values(errors)) expect(screen.getByText(message)).toBeInTheDocument();
  expect(screen.getByLabelText('每次抽奖消耗粉钻（整数）')).toHaveValue('2'); expect(screen.getByLabelText('每份粉钻奖励（整数）')).toHaveValue('3'); expect(screen.getByLabelText('谢谢参与概率（%）')).toHaveValue('100.00'); expect(change).not.toHaveBeenCalled();
});
it.each([
  { total_qty: '0', issued_qty: '1', remaining_qty: '0' },
  { remaining_qty: '9' },
  { issued_qty: '01' },
  { total_qty: '9223372036854775808' },
  { version: '0' },
  { version: '-1' },
])('blocks editing for an inconsistent configured stock row %j', async (invalid) => {
  const inventory = stock().map((row, index) => index === 0 ? { ...row, ...invalid } : row);
  fixture.effective.mockImplementation((key: string) => Promise.resolve(key === 'benefits.coupons' ? effective() : { current: { ...effective().current as LoyaltyEffectiveConfig, config_key: 'benefits.lottery', value: pool }, inventory, as_of_at: '2026-10-01T00:00:00Z' }));
  mount(true); await screen.findByText('生效配置读取失败：生效配置同响应库存结构无法核对，请重试读取。');
  expect(screen.getByRole('button', { name: '配置' })).toBeDisabled(); expect(fixture.inventory).not.toHaveBeenCalled(); expect(fixture.save).not.toHaveBeenCalled();
});

const conflictSources = [
  { field: 'value.coupons[1].enabled', coupon_type: 'PUBLISH_ONCE', source_kind: 'LOTTERY', source_config_key: 'benefits.lottery', source_config_version_id: 'lottery-frozen' },
  { field: 'value.coupons[1].enabled', coupon_type: 'PUBLISH_ONCE', source_kind: 'CHECK_IN', source_config_key: 'benefits.check_in', source_config_version_id: 'check-in-frozen' },
  { field: 'value.coupons[1].enabled', coupon_type: 'PUBLISH_ONCE', source_kind: 'PROGRESS', source_config_key: 'benefits.catalog', source_config_version_id: 'catalog-frozen' },
  { field: 'value.coupons[1].enabled', coupon_type: 'PUBLISH_ONCE', source_kind: 'REDEMPTION', source_config_key: 'benefits.catalog', source_config_version_id: 'catalog-frozen' },
] as const;
async function rejectCouponSource() {
  fixture.save.mockRejectedValue(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '启用来源冲突', request_id: 'source-conflict-request', details: { resource_type: 'system_config', resource_id: 'benefits.coupons', config_conflicts: conflictSources } }));
  mount(); await screen.findByText('30.00 元'); await waitFor(() => expect(screen.getByRole('button', { name: '编辑配置' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '编辑配置' }));
  const card = screen.getByRole('heading', { name: '发布券' }).closest('section'); if (card === null) throw new Error('券控件缺失');
  fireEvent.click(within(card).getByRole('switch'));
  fireEvent.change(screen.getByLabelText('保障费用抵扣金额（元）'), { target: { value: '35.00' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并生效' }));
  fireEvent.change(screen.getByPlaceholderText('填写本次调整原因（3～256 个字符）'), { target: { value: '停用发布券并核对来源' } });
  fireEvent.click(screen.getByRole('button', { name: '确认保存并生效' }));
  await screen.findByRole('table', { name: '本次拒绝的配置来源' });
}
it('shows exact backend source facts without a front-end dependency guess and preserves the failed draft', async () => {
  fixture.sources.mockResolvedValue([{ config_key: 'benefits.check_in', value: { daily_rewards: [{ kind: 'COUPON', coupon_type: 'PUBLISH_ONCE' }] } }]);
  await rejectCouponSource();
  expect(fixture.sources).not.toHaveBeenCalled(); expect(fixture.save).toHaveBeenCalledOnce();
  expect(fixture.save.mock.calls[0]![1].value.coupons[1].enabled).toBe(false); expect(screen.getByLabelText('保障费用抵扣金额（元）')).toHaveValue('35.00');
  expect(screen.queryByRole('button', { name: '恢复原保存' })).not.toBeInTheDocument(); expect(screen.getByText(/source-conflict-request/)).toBeInTheDocument();
  const table = screen.getByRole('table', { name: '本次拒绝的配置来源' });
  for (const conflict of conflictSources) expect(within(table).getByRole('row', { name: new RegExp(conflict.source_kind + '.*' + conflict.source_config_version_id) })).toHaveTextContent(conflict.field);
  expect(screen.getByRole('link', { name: '打开抽奖配置' })).toHaveAttribute('href', '/settings/lottery-prizes?tab=current');
  expect(screen.getByRole('link', { name: '打开签到配置' })).toHaveAttribute('href', '/settings/loyalty?tab=daily-sign-in');
  expect(screen.getByRole('link', { name: '打开签到配置' })).toHaveAttribute('target', '_blank');
  for (const kind of ['PROGRESS', 'REDEMPTION']) expect(within(table).getByRole('row', { name: new RegExp(kind + '.*catalog-frozen') }).querySelector('a')).toBeNull();
});
it('reads the exact frozen catalog version across pages without substituting latest configuration or writing', async () => {
  fixture.sourceVersions.mockResolvedValueOnce({ items: [{ config_key: 'benefits.catalog', config_version_id: 'catalog-latest', value: { marker: 'latest-not-frozen' } }], page: { page_size: 20, has_more: true, next_cursor: 'catalog-page-2' } })
    .mockResolvedValueOnce({ items: [{ config_key: 'benefits.catalog', config_version_id: 'catalog-frozen', content_hash: 'frozen-hash', reason: '冻结来源原因', value: { marker: 'frozen-reward' } }], page: { page_size: 20, has_more: false } });
  await rejectCouponSource(); fireEvent.click(screen.getByRole('button', { name: '查看冻结版本 PROGRESS catalog-frozen' }));
  await screen.findByText(/"marker": "frozen-reward"/);
  expect(fixture.sourceVersions.mock.calls.map((call) => call.slice(0, 2))).toEqual([['benefits.catalog', ''], ['benefits.catalog', 'catalog-page-2']]);
  expect(fixture.sourceVersions.mock.calls.every((call) => call[2] instanceof AbortSignal)).toBe(true);
  expect(screen.queryByText(/latest-not-frozen/)).not.toBeInTheDocument(); expect(screen.getByLabelText('保障费用抵扣金额（元）')).toHaveValue('35.00'); expect(fixture.save).toHaveBeenCalledOnce();
});
it('uses the existing lottery versions reader for a frozen lottery source', async () => {
  fixture.versions.mockResolvedValueOnce({ items: [{ config_key: 'benefits.lottery', config_version_id: 'lottery-latest', reason: '当前抽奖版本', content_hash: 'latest-hash', value: pool }], page: { next_cursor: 'lottery-page-2' } })
    .mockResolvedValueOnce({ items: [{ config_key: 'benefits.lottery', config_version_id: 'lottery-frozen', reason: '原抽奖版本', content_hash: 'lottery-hash', value: pool }], page: { next_cursor: null } });
  await rejectCouponSource(); fireEvent.click(screen.getByRole('button', { name: '查看冻结版本 LOTTERY lottery-frozen' }));
  await screen.findByText('原抽奖版本'); expect(fixture.versions.mock.calls.map((call) => call.slice(0, 2))).toEqual([['benefits.lottery', ''], ['benefits.lottery', 'lottery-page-2']]); expect(fixture.versions.mock.calls.every((call) => call[2] instanceof AbortSignal)).toBe(true); expect(fixture.sourceVersions).not.toHaveBeenCalled(); expect(fixture.save).toHaveBeenCalledOnce();
});
it.each(['missing', 'failed', 'wrong-key', 'cursor-loop', 'duplicate-version'] as const)('makes a %s frozen source read explicit without changing draft or saving', async (mode) => {
  if (mode === 'failed') fixture.sourceVersions.mockRejectedValue(new ApiProblem(403, { code: 'PERMISSION_DENIED', message: '无权', request_id: 'source-read-denied' }));
  else if (mode === 'wrong-key') fixture.sourceVersions.mockResolvedValue({ items: [{ config_key: 'benefits.check_in', config_version_id: 'catalog-frozen' }], page: { page_size: 20, has_more: false } });
  else if (mode === 'cursor-loop') fixture.sourceVersions.mockResolvedValue({ items: [], page: { page_size: 20, has_more: true, next_cursor: 'same-cursor' } });
  else if (mode === 'duplicate-version') fixture.sourceVersions.mockResolvedValue({ items: [{ config_key: 'benefits.catalog', config_version_id: 'catalog-latest' }, { config_key: 'benefits.catalog', config_version_id: 'catalog-latest' }], page: { page_size: 20, has_more: false } });
  await rejectCouponSource(); fireEvent.click(screen.getByRole('button', { name: '查看冻结版本 PROGRESS catalog-frozen' }));
  await screen.findByText(mode === 'missing' ? '未找到服务端指定的冻结版本；不会以当前版本替代。' : /来源冻结版本读取失败：/);
  expect(fixture.sourceVersions).toHaveBeenCalledTimes(mode === 'cursor-loop' ? 2 : 1); expect(fixture.save).toHaveBeenCalledOnce(); expect(screen.getByLabelText('保障费用抵扣金额（元）')).toHaveValue('35.00');
});
it('does not request a frozen version when current source read permission is absent', async () => {
  await rejectCouponSource(); fixture.permissions = ['ops.business_config.publish'];
  fireEvent.click(screen.getByRole('button', { name: '查看冻结版本 PROGRESS catalog-frozen' }));
  await screen.findByText('当前账号没有来源版本读取权限；未请求该版本。'); expect(fixture.sourceVersions).not.toHaveBeenCalled(); expect(fixture.save).toHaveBeenCalledOnce();
});
function CurrentSourceLocation() { const location = useLocation(); return <output aria-label="当前来源地址">{location.search}</output>; }
it('opens the existing daily sign-in tab from the source URL and preserves other URL parameters', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<MemoryRouter initialEntries={['/settings/loyalty?tab=daily-sign-in&from=source-conflict']}><QueryClientProvider client={client}><IntegratedLoyaltySettingsPage /><CurrentSourceLocation /></QueryClientProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('tab', { name: '每日签到' })).toHaveAttribute('aria-selected', 'true'));
  await screen.findByText('每日首次签到奖励'); expect(fixture.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: '连续签到' })); await waitFor(() => expect(screen.getByRole('tab', { name: '连续签到' })).toHaveAttribute('aria-selected', 'true')); expect(fixture.save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('当前来源地址')).toHaveTextContent('tab=streak'); expect(screen.getByLabelText('当前来源地址')).toHaveTextContent('from=source-conflict');
});
