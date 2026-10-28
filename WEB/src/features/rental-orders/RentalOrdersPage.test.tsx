import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RentalOrdersPage } from './RentalOrdersPage';
import { RentalLookup } from './RentalShared';
const fixture = vi.hoisted(() => ({ accountId: 'order-reader', permissions: ['ops.orders.read'], list: vi.fn(), members: vi.fn(), assets: vi.fn(), merchants: vi.fn() }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: fixture.accountId, permissions: fixture.permissions }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: { list: fixture.list, members: fixture.members, assets: fixture.assets, merchants: fixture.merchants } }) }));
vi.mock('./RentalOrderDetail', () => ({ RentalOrderDetail: ({ id }: { id: string }) => <p>授权详情对象 {id}</p> }));
const clients: QueryClient[] = [];

it('blocks reversed URL date ranges and refresh without losing input, then queries only the corrected half-open interval', async () => {
  show('/orders/rental?asset_id=original-asset&cursor=old-cursor&created_from=2026-10-08T00:00:00Z&created_before=2026-10-07T00:00:00Z');
  const start = screen.getByLabelText('创建自（含）'); const end = screen.getByLabelText('创建至（不含）');
  expect(start).toHaveValue('2026-10-08 08:00'); expect(end).toHaveValue('2026-10-07 08:00');
  expect(screen.getByRole('alert')).toHaveTextContent('创建至必须晚于创建自'); expect(start).toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(screen.getByRole('button', { name: '刷新' })); expect(fixture.list).not.toHaveBeenCalled();
  fireEvent.change(end, { target: { value: '2026-10-09 08:00' } }); fireEvent.keyDown(end, { key: 'Enter' });
  await waitFor(() => expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ asset_id: 'original-asset', created_from: '2026-10-08T00:00:00Z', created_before: '2026-10-09T00:00:00.000Z', limit: 20 }, expect.any(AbortSignal)));
  expect(start).toHaveValue('2026-10-08 08:00'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not query after a valid interval is edited to an equal or reversed end', async () => {
  show('/orders/rental?created_from=2026-10-08T00:00:00Z&created_before=2026-10-09T00:00:00Z');
  await screen.findByRole('button', { name: 'RO-ORIGINAL' });
  fireEvent.change(screen.getByLabelText('创建至（不含）'), { target: { value: '2026-10-08 08:00' } }); fireEvent.keyDown(screen.getByLabelText('创建至（不含）'), { key: 'Enter' });
  expect(screen.getByRole('button', { name: '刷新' })).toBeDisabled(); expect(fixture.list).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText('创建至（不含）'), { target: { value: '' } }); fireEvent.keyDown(screen.getByLabelText('创建至（不含）'), { key: 'Enter' });
  await waitFor(() => expect(fixture.list).toHaveBeenLastCalledWith({ created_from: '2026-10-08T00:00:00Z', limit: 20 }, expect.any(AbortSignal)));
});

it('hydrates date filters from the URL and clears the displayed interval together with the query on reset', async () => {
  show('/orders/rental?created_from=2026-10-06T00%3A30%3A00.000Z&created_before=2026-10-07T00%3A30%3A00.000Z');
  await screen.findByRole('button', { name: 'RO-ORIGINAL' });
  const fields = [screen.getByLabelText('创建自（含）'), screen.getByLabelText('创建至（不含）')];
  expect(fields[0]).toHaveValue('2026-10-06 08:30'); expect(fields[1]).toHaveValue('2026-10-07 08:30');
  fireEvent.mouseDown(fields[0]!);
  expect(fields[0]).toHaveValue('2026-10-06 08:30');
  fireEvent.input(fields[0]!, { target: { value: '2026-10-06 09:30' } });
  expect(fields[0]).toHaveValue('2026-10-06 09:30');
  fireEvent.keyDown(fields[0]!, { key: 'Enter' });
  await waitFor(() => expect(fixture.list).toHaveBeenLastCalledWith(expect.objectContaining({ created_from: '2026-10-06T01:30:00.000Z' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '重置' }));
  await waitFor(() => expect(fixture.list).toHaveBeenLastCalledWith({ limit: 20 }, expect.any(AbortSignal)));
  expect(fields[0]).toHaveValue(''); expect(fields[1]).toHaveValue('');
});
beforeEach(() => { vi.resetAllMocks(); fixture.accountId = 'order-reader'; fixture.members.mockResolvedValue({ items: [], page: { next_cursor: null } }); fixture.assets.mockResolvedValue({ items: [], page: { next_cursor: null } }); fixture.merchants.mockResolvedValue({ items: [], page: { next_cursor: null } }); fixture.permissions = ['ops.orders.read']; fixture.list.mockResolvedValue({ items: [{ order_id: 'original-order', order_no: 'RO-ORIGINAL', asset: { title: '原资产快照' }, participants: { tenant_account_id: 'tenant', lessor_id: 'lessor' }, supply_channel: 'PERSONAL', display_status: '待补缴', physical_status: 'RECEIVED', review_status: 'FINAL', initial_due_fen: '60000', initial_payer_total_fen: null, created_at: '2026-10-06T00:00:00Z', has_exception: false, exception_codes: [] }], next_cursor: null }); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });
function show(path = '/orders/rental?display_status_code=AWAITING_SUPPLEMENT') { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); const element = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><RentalOrdersPage /></MemoryRouter></QueryClientProvider>; const view = render(element()); return { ...view, refreshSession: () => view.rerender(element()) }; }

it('validates the order search and supports trimmed Enter and repeated search without losing status filters', async () => {
  show('/orders/rental?display_status_code=AWAITING_SUPPLEMENT&cursor=old');
  await screen.findByRole('button', { name: 'RO-ORIGINAL' });
  const input = screen.getByRole('textbox', { name: '完整订单号' });
  fireEvent.change(input, { target: { value: '订单?' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveAttribute('aria-invalid', 'true'); expect(fixture.list).toHaveBeenCalledOnce();
  fireEvent.change(input, { target: { value: ' RO-FILTER ' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(fixture.list).toHaveBeenCalledOnce();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(fixture.list).toHaveBeenCalledTimes(2));
  expect(fixture.list).toHaveBeenLastCalledWith({ order_no: 'RO-FILTER', display_status_code: 'AWAITING_SUPPLEMENT', limit: 20 }, expect.any(AbortSignal));
  await waitFor(() => expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  await waitFor(() => expect(fixture.list).toHaveBeenCalledTimes(3));
});

it('reads the awaiting-supplement view and opens only the selected original order with no write controls', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'RO-ORIGINAL' }));
  expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ display_status_code: 'AWAITING_SUPPLEMENT', limit: 20 }, expect.any(AbortSignal));
  expect(screen.getByText('授权详情对象 original-order')).toBeInTheDocument(); expect(screen.getByText('原资产快照')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '已收回' })).toBeInTheDocument(); expect(screen.getByRole('cell', { name: '已核定' })).toBeInTheDocument();
  expect(screen.queryByRole('cell', { name: 'RECEIVED' })).not.toBeInTheDocument(); expect(screen.queryByRole('cell', { name: 'FINAL' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /强制完成|线下补缴|修改金额|已发货|拒单|灭失结算/ })).not.toBeInTheDocument();
});

it('renders exception messages in the original list cell without translating codes or replacing unmatched reasons', async () => {
  const codes = ['PAYMENT_VERIFICATION_REQUIRED', 'CUSTOM_VERIFICATION', 'FUTURE_EXCEPTION'];
  fixture.list.mockResolvedValue({ items: [{ order_id: 'exception-order', order_no: 'RO-EXCEPTION', asset: { title: '原资产' }, participants: { tenant_account_id: 'tenant', lessor_id: 'lessor' }, supply_channel: 'PERSONAL', display_status: '结算确认中', physical_status: 'RECEIVED', review_status: 'FINAL', initial_due_fen: '60000', initial_payer_total_fen: null, created_at: '2026-10-06T00:00:00Z', has_exception: true, exception_codes: codes, blockers: [{ code: 'PAYMENT_VERIFICATION_REQUIRED', field: null, message: '  ' }, { code: 'CUSTOM_VERIFICATION', field: null, message: '服务端要求核实原交易' }, { code: 'OTHER_CODE', field: null, message: '不能套用的其他原因' }] }], next_cursor: null });
  show('/orders/rental?has_exception=true'); await screen.findByRole('button', { name: 'RO-EXCEPTION' });
  expect(screen.getByRole('cell', { name: '结算确认中 异常：支付结果待核实、服务端要求核实原交易、订单异常待核实（FUTURE_EXCEPTION）' })).toBeInTheDocument();
  expect(screen.queryByText('不能套用的其他原因')).not.toBeInTheDocument();
  expect(codes).toEqual(['PAYMENT_VERIFICATION_REQUIRED', 'CUSTOM_VERIFICATION', 'FUTURE_EXCEPTION']);
  expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ has_exception: 'true', limit: 20 }, expect.any(AbortSignal));
});

it.each([['ops.finance.read'], ['ops.cabinets.read'], ['ops.returns.review']])('does not read or open a crafted order locator with only %s', (permission) => {
  fixture.permissions = [permission]; show('/orders/rental?order_id=foreign-order');
  expect(fixture.list).not.toHaveBeenCalled(); expect(screen.queryByText(/授权详情对象/)).not.toBeInTheDocument();
});

it('removes cached order rows and detail when order read permission is revoked', async () => {
  const view = show(); fireEvent.click(await screen.findByRole('button', { name: 'RO-ORIGINAL' })); fixture.permissions = []; view.refreshSession();
  expect(screen.queryByRole('button', { name: 'RO-ORIGINAL' })).not.toBeInTheDocument(); expect(screen.queryByText(/授权详情对象/)).not.toBeInTheDocument();
});

it('removes a failed order retry when read permission is revoked and makes no further list request', async () => {
  fixture.list.mockRejectedValue(new Error('订单读取暂不可用'));
  const view = show(); await screen.findByRole('button', { name: '重新读取' });
  fixture.permissions = []; view.refreshSession();
  expect(screen.queryByRole('button', { name: '重新读取' })).not.toBeInTheDocument();
  const refresh = screen.getByRole('button', { name: '刷新' }); expect(refresh).toBeDisabled(); fireEvent.click(refresh);
  expect(fixture.list).toHaveBeenCalledOnce();
});

it('keeps real physical and review filters without an inspection filter or invented total', async () => {
  show('/orders/rental?physical_status=RECEIVED&review_status=FINAL'); await screen.findByRole('button', { name: 'RO-ORIGINAL' });
  expect(screen.getAllByText('实物状态').length).toBeGreaterThan(0);
  expect(screen.getAllByText('审核状态').length).toBeGreaterThan(0);
  expect(screen.queryByText(/实检状态|检查结果筛选|月结批次|结算批次|当前筛选共|共\s*1\s*条|共\s*1\s*笔/)).not.toBeInTheDocument();
  expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ physical_status: 'RECEIVED', review_status: 'FINAL', limit: 20 }, expect.any(AbortSignal));
  expect(screen.queryByRole('button', { name: /付款登记|生成结算单|月结/ })).not.toBeInTheDocument();
});


it('offers a named native close button and restores the original order focus and filtered context', async () => {
  show('/orders/rental?display_status_code=AWAITING_SUPPLEMENT&cursor=original-cursor');
  const trigger = await screen.findByRole('button', { name: 'RO-ORIGINAL' }); trigger.focus(); fireEvent.click(trigger);
  const close = await screen.findByRole('button', { name: '关闭租赁订单详情' });
  expect(close.tagName).toBe('BUTTON'); expect(close).toHaveAttribute('type', 'button'); expect(close.tabIndex).toBe(0);
  close.focus(); expect(close).toHaveFocus(); fireEvent.click(close);
  await waitFor(() => expect(screen.queryByText('授权详情对象 original-order')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ display_status_code: 'AWAITING_SUPPLEMENT', cursor: 'original-cursor', limit: 20 }, expect.any(AbortSignal));
});

function showLookup(kind: 'account' | 'asset' | 'merchant' = 'asset', value = 'asset-original') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  const change = vi.fn();
  const element = () => <QueryClientProvider client={client}><RentalLookup kind={kind} value={value} change={change} /></QueryClientProvider>;
  const view = render(element());
  return { ...view, change, refreshSession: () => view.rerender(element()) };
}
function assetLookupPage(label: string, id = 'asset-original') { return { items: [{ display_name: label, asset_id: id }], page: { next_cursor: null } }; }
function deferredLookup<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it.each([
  ['account', '参与用户', 'ops.members.read', 'members'],
  ['asset', '资产', 'ops.assets.read', 'assets'],
  ['merchant', '商家', 'ops.merchants.read', 'merchants'],
] as const)('names the %s lookup controls and distinguishes an authorized empty result', async (kind, label, permission, method) => {
  fixture.permissions = [permission]; const view = showLookup(kind, '');
  expect(screen.getByRole('textbox', { name: `搜索${label}` })).toBeEnabled();
  await screen.findByText(`暂无符合条件的${label}，请调整搜索条件。`);
  expect(screen.getByRole('textbox', { name: `选择${label}` })).toBeEnabled();
  expect(fixture[method]).toHaveBeenCalledExactlyOnceWith('', '', expect.any(AbortSignal));
  expect(view.change).not.toHaveBeenCalled(); expect(fixture.list).not.toHaveBeenCalled();
});

it('uses the same trimmed lookup search for Enter and the button, and refreshes an unchanged search without submitting a selection', async () => {
  fixture.permissions = ['ops.assets.read']; const view = showLookup();
  await screen.findByText('暂无符合条件的资产，请调整搜索条件。');
  const input = screen.getByRole('textbox', { name: '搜索资产' });
  fireEvent.change(input, { target: { value: '  相机  ' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(fixture.assets).toHaveBeenCalledOnce();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(fixture.assets).toHaveBeenCalledTimes(2));
  expect(fixture.assets).toHaveBeenLastCalledWith('相机', '', expect.any(AbortSignal));
  await waitFor(() => expect(screen.getByRole('button', { name: '搜索资产' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '搜索资产' }));
  await waitFor(() => expect(fixture.assets).toHaveBeenCalledTimes(3));
  expect(fixture.assets).toHaveBeenLastCalledWith('相机', '', expect.any(AbortSignal));
  expect(view.change).not.toHaveBeenCalled();
});

it('hides stale lookup labels while loading and after failure, retains the original ID, and retries the same query explicitly', async () => {
  const pending = deferredLookup<ReturnType<typeof assetLookupPage>>();
  fixture.permissions = ['ops.assets.read'];
  fixture.assets.mockResolvedValueOnce(assetLookupPage('旧资产')).mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(assetLookupPage('已重读资产'));
  const view = showLookup();
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('旧资产 · asset-original'));
  fireEvent.click(screen.getByRole('button', { name: '搜索资产' }));
  await screen.findByText('正在读取资产选项…');
  expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('asset-original');
  expect(screen.getByRole('textbox', { name: '选择资产' })).toBeDisabled();
  await act(async () => { pending.reject(new Error('lookup unavailable')); });
  await screen.findByText('资产选项读取失败，请重试。');
  expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('asset-original');
  expect(screen.queryByDisplayValue('旧资产 · asset-original')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新读取资产' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('已重读资产 · asset-original'));
  expect(fixture.assets).toHaveBeenLastCalledWith('', '', expect.any(AbortSignal));
  expect(view.change).not.toHaveBeenCalled();
});

it('disables the whole lookup immediately on permission loss and does not reveal cached or late options when permission changes', async () => {
  const pending = deferredLookup<ReturnType<typeof assetLookupPage>>();
  fixture.permissions = ['ops.assets.read']; fixture.assets.mockResolvedValueOnce(assetLookupPage('原权限资产')).mockImplementationOnce(() => pending.promise);
  const view = showLookup();
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('原权限资产 · asset-original'));
  fireEvent.click(screen.getByRole('button', { name: '搜索资产' })); await screen.findByText('正在读取资产选项…');
  fixture.permissions = []; view.refreshSession();
  expect(screen.getByRole('textbox', { name: '搜索资产' })).toBeDisabled(); expect(screen.getByRole('textbox', { name: '选择资产' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '搜索资产' })).toBeDisabled(); expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('asset-original');
  await act(async () => { pending.resolve(assetLookupPage('迟到资产')); });
  expect(screen.queryByDisplayValue('迟到资产 · asset-original')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('原权限资产 · asset-original')).not.toBeInTheDocument();
  fixture.assets.mockResolvedValue(assetLookupPage('新权限资产')); fixture.permissions = ['ops.assets.read']; view.refreshSession();
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('新权限资产 · asset-original'));
  expect(view.change).not.toHaveBeenCalled();
});

it('isolates an account change from a pending lookup response and resets local search text', async () => {
  const oldRead = deferredLookup<ReturnType<typeof assetLookupPage>>(); const newRead = deferredLookup<ReturnType<typeof assetLookupPage>>();
  fixture.permissions = ['ops.assets.read']; fixture.assets.mockImplementationOnce(() => oldRead.promise).mockImplementationOnce(() => newRead.promise);
  const view = showLookup(); await waitFor(() => expect(fixture.assets).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole('textbox', { name: '搜索资产' }), { target: { value: '旧账号草稿' } });
  fixture.accountId = 'new-order-reader'; view.refreshSession();
  await waitFor(() => expect(fixture.assets).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('textbox', { name: '搜索资产' })).toHaveValue('');
  await act(async () => { oldRead.resolve(assetLookupPage('旧账号迟到资产')); });
  expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('asset-original');
  expect(screen.queryByDisplayValue('旧账号迟到资产 · asset-original')).not.toBeInTheDocument();
  await act(async () => { newRead.resolve(assetLookupPage('新账号资产')); });
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toHaveValue('新账号资产 · asset-original'));
  expect(view.change).not.toHaveBeenCalled();
});

it('changes the original filter only after selecting a current authorized lookup option', async () => {
  fixture.permissions = ['ops.assets.read']; fixture.assets.mockResolvedValue(assetLookupPage('可选资产', 'asset-choice'));
  const view = showLookup('asset', '');
  await waitFor(() => expect(screen.getByRole('textbox', { name: '选择资产' })).toBeEnabled());
  expect(view.change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('textbox', { name: '选择资产' }));
  fireEvent.click(await screen.findByText('可选资产 · asset-choice'));
  expect(view.change).toHaveBeenCalledExactlyOnceWith('asset-choice'); expect(fixture.list).not.toHaveBeenCalled();
});
