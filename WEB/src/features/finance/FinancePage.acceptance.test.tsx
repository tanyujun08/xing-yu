import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiProblem } from '../../shared/services/testing/problemFixture';
import type { components } from '../../shared/services/rentalOrders';
import { FinancePage } from './FinancePage';
const fixture = vi.hoisted(() => ({ session: { accountId: 'finance', permissions: ['ops.finance.read', 'ops.payments.recover', 'ops.refunds.recover'] }, gateway: { payments: vi.fn(), refunds: vi.fn(), reconcilePayment: vi.fn(), reconcileRefund: vi.fn(), earnings: vi.fn(), earning: vi.fn(), exportIncome: vi.fn() } }));
vi.mock('../../shared/access/session', () => ({ useSession: () => fixture.session }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: fixture.gateway }) }));
type Payment = components['schemas']['OpsPaymentView'];
function payment(id: string, purpose: 'INITIAL' | 'SUPPLEMENT'): Payment { return { payment_mode: 'NORMAL', business_amount_fen: '20000', channel_amount_fen: '20000', supplement_id: purpose === 'SUPPLEMENT' ? 'supplement-bill' : null, generation: purpose === 'SUPPLEMENT' ? 1 : 0, payment_id: id, purpose, order_id: 'order', status: 'UNKNOWN', amount_fen: '20000', payer_total_fen: null, last_verified_at: null, allowed_actions: [{ action_code: 'QUERY_PAYMENT', allowed: true, reason_code: null, display_reason: null, required_version: null, target: id }], blockers: [], channel_status: 'NOTPAY', mchid: 'merchant', config_version_id: 'config', out_trade_no: id + '-original-trade', currency: 'CNY', expires_at: '2026-10-06T01:00:00Z', paid_at: null, version: '1', channel_transaction_id: null, last_error_code: null, created_at: '2026-10-06T00:00:00Z' }; }
let rows: Payment[];
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); fixture.session = { accountId: 'finance', permissions: ['ops.finance.read', 'ops.payments.recover', 'ops.refunds.recover'] }; rows = [payment('initial-id', 'INITIAL'), payment('supplement-id', 'SUPPLEMENT')]; fixture.gateway.payments.mockImplementation(async () => ({ items: rows, next_cursor: null })); fixture.gateway.reconcilePayment.mockResolvedValue({ accepted: true }); fixture.gateway.earnings.mockResolvedValue({ items: [], next_cursor: null }); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });
function LocationObserver() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="finance-location">{location.pathname + location.search}</output><button type="button" onClick={() => navigate(-1)}>测试返回上一查询</button></>; }
function show(path = '/finance?tab=payments') { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); const element = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><FinancePage /><LocationObserver /></MemoryRouter></QueryClientProvider>; const view = render(element()); return { ...view, client, refreshSession: () => view.rerender(element()) }; }
const fact = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling;

it('immediately hides cached earnings and disables export when finance read permission is revoked', async () => {
  fixture.gateway.earnings.mockResolvedValue({ items: [{ earning_id: 'private-income', beneficiary_kind: 'MERCHANT', merchant_id: 'merchant-original', merchant_name: '原商家', account_id: null, order_id: 'month-order', order_no: 'RO-M', beneficiary_fen: '25000', posted_at: '2026-10-06T00:00:00Z' }], next_cursor: null, summary: { count: 1, beneficiary_fen: '25000', as_of: '2026-10-06T00:00:00Z' } });
  const view = show('/finance?tab=earnings&beneficiary_kind=MERCHANT&period_month=2026-10');
  await screen.findByRole('button', { name: 'private-income' });
  const button = screen.getByRole('button', { name: '导出当月商家流水 CSV' }); expect(button).toBeEnabled();
  expect(screen.getByText(/当前筛选共 1 笔/)).toBeInTheDocument();
  fixture.session.permissions = []; view.refreshSession();
  expect(screen.queryByRole('button', { name: 'private-income' })).not.toBeInTheDocument();
  expect(screen.queryByText(/当前筛选共 1 笔/)).not.toBeInTheDocument();
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(fixture.gateway.exportIncome).not.toHaveBeenCalled();
  expect(fixture.gateway.earnings).toHaveBeenCalledOnce();
});

it('validates and trims the funds order search, resets pagination, preserves filters and allows an explicit repeat search', async () => {
  show('/finance?tab=payments&purpose=SUPPLEMENT&status=UNKNOWN&cursor=old');
  await screen.findByRole('button', { name: 'supplement-id' });
  const input = screen.getByRole('textbox', { name: '完整订单号' });
  fireEvent.change(input, { target: { value: '订单?' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveAttribute('aria-invalid', 'true'); expect(fixture.gateway.payments).toHaveBeenCalledOnce();
  fireEvent.change(input, { target: { value: ' RO-FILTER ' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(fixture.gateway.payments).toHaveBeenCalledOnce();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(fixture.gateway.payments).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.payments).toHaveBeenLastCalledWith({ order_no: 'RO-FILTER', purpose: 'SUPPLEMENT', status: 'UNKNOWN', cursor: '', limit: 20 }, expect.any(AbortSignal));
  expect(input).toHaveAttribute('aria-invalid', 'false');
  await waitFor(() => expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  await waitFor(() => expect(fixture.gateway.payments).toHaveBeenCalledTimes(3));
  expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled(); expect(fixture.gateway.reconcileRefund).not.toHaveBeenCalled();
});

it('does not treat mixed or personal-only rows as a successful merchant export query', async () => {
  fixture.gateway.earnings.mockResolvedValue({ items: [{ earning_id: 'personal-only', beneficiary_kind: 'PERSONAL', account_id: 'lessor', beneficiary_display_name: '出租方', order_id: 'order', order_no: 'RO-P', beneficiary_fen: '1000', posted_at: '2026-10-06T00:00:00Z' }], next_cursor: null });
  show('/finance?tab=earnings&period_month=2026-10'); await screen.findByText('出租方 · lessor');
  expect(screen.getByText('请选择商家收益类型，并清除个人或订单筛选后导出。')).toBeInTheDocument();
  const button = screen.getByRole('button', { name: '导出当月商家流水 CSV' }); expect(button).toBeDisabled(); fireEvent.click(button);
  expect(fixture.gateway.exportIncome).not.toHaveBeenCalled();
});

it('allows a reader to close after recovery permission is lost while preserving the unresolved original query for explicit recovery', async () => {
  fixture.gateway.reconcilePayment.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: '查单结果未知', request_id: 'original-timeout' })).mockResolvedValueOnce({ accepted: true });
  const view = show(); const trigger = await screen.findByRole('button', { name: 'supplement-id' }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' })); await screen.findByRole('button', { name: '恢复原核查请求' });
  fixture.session.permissions = ['ops.finance.read']; view.refreshSession();
  expect(screen.queryByRole('button', { name: '恢复原核查请求' })).not.toBeInTheDocument();
  const close = screen.getByRole('button', { name: '关闭资金记录详情' }); expect(close).toBeEnabled(); fireEvent.click(close);
  await waitFor(() => expect(close.closest('.t-drawer')).not.toHaveClass('t-drawer--open')); await waitFor(() => expect(trigger).toHaveFocus());
  expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce(); fireEvent.click(trigger);
  await screen.findByText('记录编号', { selector: 'dt' }); expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce();
  fixture.session.permissions = ['ops.finance.read', 'ops.payments.recover']; view.refreshSession();
  fireEvent.click(screen.getByRole('button', { name: '恢复原核查请求' }));
  await waitFor(() => expect(fixture.gateway.reconcilePayment).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.reconcilePayment.mock.calls[0]).toEqual(fixture.gateway.reconcilePayment.mock.calls[1]);
});

it('labels refund business state and purpose while preserving channel diagnostics and original filter and query values', async () => {
  fixture.gateway.refunds.mockResolvedValue({ items: [{ refund_id: 'failed-original-refund', purpose: 'DEPOSIT', order_id: 'original-order', status: 'FAILED_CONFIRMED', amount_fen: '24000', payer_refund_fen: null, last_verified_at: null, allowed_actions: [{ action_code: 'QUERY_REFUND', allowed: true }], blockers: [], channel_status: 'ABNORMAL', last_error_code: 'ABNORMAL', mchid: 'merchant', config_version_id: 'config', out_refund_no: 'original-out-refund', channel_refund_id: null }], next_cursor: null });
  fixture.gateway.reconcileRefund.mockResolvedValue({ accepted: true });
  show('/finance?tab=refunds&purpose=DEPOSIT&status=FAILED_CONFIRMED');
  const trigger = await screen.findByRole('button', { name: 'failed-original-refund' });
  expect(screen.getByRole('cell', { name: '退押' })).toBeInTheDocument(); expect(screen.getByRole('cell', { name: '退款失败' })).toBeInTheDocument();
  expect(fixture.gateway.refunds).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'DEPOSIT', status: 'FAILED_CONFIRMED' }), expect.any(AbortSignal));
  fireEvent.click(trigger); expect(fact('状态')).toHaveTextContent('退款失败'); expect(fact('渠道状态')).toHaveTextContent('ABNORMAL'); expect(fact('错误码')).toHaveTextContent('ABNORMAL');
  fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' }));
  await waitFor(() => expect(fixture.gateway.reconcileRefund).toHaveBeenCalledExactlyOnceWith('failed-original-refund', expect.any(String)));
  expect(fact('状态')).toHaveTextContent('退款失败'); expect(fact('微信实际金额')).toHaveTextContent('待确认');
  expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled();
});

it('keeps the rendered month and merchant export bound to the URL after browser back', async () => {
  fixture.gateway.earnings.mockResolvedValue({ items: [{ earning_id: 'month-row', beneficiary_kind: 'MERCHANT', merchant_id: 'merchant-original', merchant_name: '原商家', account_id: null, order_id: 'month-order', order_no: 'RO-M', beneficiary_fen: '25000', posted_at: '2026-10-06T00:00:00Z' }], next_cursor: null });
  fixture.gateway.exportIncome.mockResolvedValue(new Blob(['order_no\nRO-M'], { type: 'text/csv' }));
  URL.createObjectURL = vi.fn().mockReturnValue('blob:original-month'); URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  show('/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=merchant-original&period_month=2026-09');
  await screen.findByText('原商家 · merchant-original');
  const month = screen.getByRole('textbox', { name: '入账自然月' });
  expect(month).toHaveValue('2026-09');
  fireEvent.change(month, { target: { value: '2026-10' } }); fireEvent.keyDown(month, { key: 'Enter' });
  await waitFor(() => expect(fixture.gateway.earnings).toHaveBeenLastCalledWith(expect.objectContaining({ period_month: '2026-10' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '测试返回上一查询' }));
  await waitFor(() => expect(month).toHaveValue('2026-09'));
  expect(screen.getByTestId('finance-location')).toHaveTextContent('period_month=2026-09');
  await waitFor(() => expect(screen.getByRole('button', { name: '导出当月商家流水 CSV' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '导出当月商家流水 CSV' }));
  await waitFor(() => expect(fixture.gateway.exportIncome).toHaveBeenCalledExactlyOnceWith('2026-09', 'merchant-original'));
});

it.each(['loading', 'failed', 'empty'] as const)('blocks export while the current merchant-month query is %s', async (state) => {
  if (state === 'loading') fixture.gateway.earnings.mockReturnValue(new Promise(() => undefined));
  if (state === 'failed') fixture.gateway.earnings.mockRejectedValue(new ApiProblem(503, { code: 'DEPENDENCY_UNAVAILABLE', message: '流水查询失败', request_id: 'list-failed' }));
  show('/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=merchant-original&period_month=2026-10');
  if (state === 'failed') await screen.findByText('当前筛选查询失败，请先重试。');
  if (state === 'empty') await screen.findByText('当前筛选没有可导出的流水。');
  const button = screen.getByRole('button', { name: '导出当月商家流水 CSV' }); expect(button).toBeDisabled(); fireEvent.click(button);
  expect(fixture.gateway.exportIncome).not.toHaveBeenCalled();
});

it('does not export stale rows for a newly selected month and retains the selected query after export failure', async () => {
  fixture.gateway.earnings.mockResolvedValueOnce({ items: [{ earning_id: 'previous-month', beneficiary_kind: 'MERCHANT', merchant_id: 'merchant-original', merchant_name: '原商家', account_id: null, order_id: 'month-order', order_no: 'RO-M', beneficiary_fen: '25000', posted_at: '2026-09-06T00:00:00Z' }], next_cursor: null }).mockReturnValueOnce(new Promise(() => undefined));
  fixture.gateway.exportIncome.mockRejectedValue(new ApiProblem(503, { code: 'DEPENDENCY_UNAVAILABLE', message: '导出暂不可用', request_id: 'csv-failed' }));
  show('/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=merchant-original&period_month=2026-09');
  await screen.findByText('原商家 · merchant-original');
  const button = screen.getByRole('button', { name: '导出当月商家流水 CSV' });
  fireEvent.click(button); await screen.findByText(/结果尚未确认/);
  expect(screen.getByTestId('finance-location')).toHaveTextContent('period_month=2026-09'); await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox', { name: '入账自然月' }), { target: { value: '2026-10' } }); fireEvent.keyDown(screen.getByRole('textbox', { name: '入账自然月' }), { key: 'Enter' });
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(fixture.gateway.exportIncome).toHaveBeenCalledExactlyOnceWith('2026-09', 'merchant-original');
});

it('queries a successful payment with unknown cash only when its current API action allows it and stops once cash is known zero', async () => {
  rows = [{ ...payment('paid-cash-unknown', 'INITIAL'), status: 'SUCCEEDED', payer_total_fen: null }];
  show(); fireEvent.click(await screen.findByRole('button', { name: 'paid-cash-unknown' }));
  expect(fact('状态')).toHaveTextContent('支付成功'); expect(fact('微信实际金额')).toHaveTextContent('待确认');
  const query = screen.getByRole('button', { name: '核查原交易结果' }); expect(query).toBeEnabled(); fireEvent.click(query);
  await waitFor(() => expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce());
  rows = rows.map((row) => ({ ...row, payer_total_fen: '0', allowed_actions: row.allowed_actions.map((action) => ({ ...action, allowed: false })) }));
  await waitFor(() => expect(query).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await waitFor(() => expect(fact('微信实际金额')).toHaveTextContent('0.00'));
  expect(query).toBeDisabled(); fireEvent.click(query); expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce();
});

it.each(['initial-id', 'supplement-id'])('queries only original %s and treats acceptance as pending rather than payment success', async (id) => {
  show(); fireEvent.click(await screen.findByRole('button', { name: id }));
  expect(fact('状态')).toHaveTextContent('支付结果待确认'); expect(fact('结算金额')).toHaveTextContent('200.00'); expect(fact('微信实际金额')).toHaveTextContent('待确认');
  fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' })); await screen.findByText('已请求核查原交易，请刷新查看渠道确认结果。');
  expect(fixture.gateway.reconcilePayment).toHaveBeenCalledExactlyOnceWith(id, expect.any(String));
  expect(fixture.gateway.payments).toHaveBeenCalledTimes(2); expect(fact('记录编号')).toHaveTextContent(id); expect(fact('状态')).toHaveTextContent('支付结果待确认');
  expect(screen.queryByText(/付款成功|已到账|发起支付|再次支付|灭失结算/)).not.toBeInTheDocument();
});

it('rereads O01 after an unknown result and explicitly reuses the same original query intent', async () => {
  fixture.gateway.reconcilePayment.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: '查单结果未知', request_id: 'query-timeout' })).mockResolvedValueOnce({ accepted: true });
  show(); fireEvent.click(await screen.findByRole('button', { name: 'supplement-id' })); fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' }));
  await screen.findByRole('button', { name: '恢复原核查请求' }); expect(fact('状态')).toHaveTextContent('支付结果待确认'); expect(fact('结算金额')).toHaveTextContent('200.00');
  expect(screen.getByRole('button', { name: 'initial-id' })).toBeDisabled();
  const close = screen.getByRole('button', { name: '关闭资金记录详情' }); expect(close).toBeDisabled(); fireEvent.click(close);
  expect(fact('记录编号')).toHaveTextContent('supplement-id');
  fireEvent.click(screen.getByRole('button', { name: '刷新' })); await waitFor(() => expect(fixture.gateway.payments).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '恢复原核查请求' })); await waitFor(() => expect(fixture.gateway.reconcilePayment).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.reconcilePayment.mock.calls[0]).toEqual(fixture.gateway.reconcilePayment.mock.calls[1]);
  await waitFor(() => expect(screen.getByRole('button', { name: '关闭资金记录详情' })).toBeEnabled());
  expect(fact('状态')).toHaveTextContent('支付结果待确认');
});

it.each(['payments', 'refunds'] as const)('%s drawer has a named native close button and restores its trigger without changing filter context or financial state', async (tab) => {
  const id = (tab === 'payments' ? 'payment-' : 'refund-').padEnd(64, 'A');
  rows = [payment(id, 'INITIAL')];
  fixture.gateway.refunds.mockResolvedValue({ items: [{ refund_id: id, purpose: 'DEPOSIT', order_id: 'order', status: 'UNKNOWN', amount_fen: '20000', payer_refund_fen: null, last_verified_at: null, allowed_actions: [], blockers: [], channel_status: null, mchid: 'merchant', config_version_id: 'config', out_refund_no: 'original-refund', channel_refund_id: null, last_error_code: null }], next_cursor: null });
  const path = `/finance?tab=${tab}&order_no=ORIGINAL-ORDER&status=UNKNOWN&cursor=original-cursor`;
  show(path); const trigger = await screen.findByRole('button', { name: id });
  expect(trigger).toHaveTextContent(id); expect(trigger).toHaveAttribute('title', id); expect(trigger).toHaveStyle({ maxWidth: '100%', height: 'var(--td-comp-size-m)' });
  expect(screen.getByText(id)).toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  expect(screen.getByRole('link', { name: 'order' })).toHaveAttribute('href', '/orders/rental?order_id=order');
  trigger.focus(); fireEvent.click(trigger);
  expect(fact('记录编号')).toHaveTextContent(id);
  expect(fact('状态')).toHaveTextContent(tab === 'payments' ? '支付结果待确认' : '退款结果待确认'); expect(fact('微信实际金额')).toHaveTextContent('待确认');
  const close = screen.getByRole('button', { name: '关闭资金记录详情' });
  expect(close.tagName).toBe('BUTTON'); expect(close).toHaveAttribute('type', 'button'); expect(close.tabIndex).toBe(0);
  close.focus(); expect(close).toHaveFocus(); fireEvent.click(close);
  await waitFor(() => expect(screen.queryByText('记录编号', { selector: 'dt' })).not.toBeInTheDocument());
  expect(close.closest('.t-drawer')).not.toHaveClass('t-drawer--open');
  await waitFor(() => expect(trigger).toHaveFocus()); expect(screen.getByTestId('finance-location')).toHaveTextContent(path);
  expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled(); expect(fixture.gateway.reconcileRefund).not.toHaveBeenCalled();
  const reader = tab === 'payments' ? fixture.gateway.payments : fixture.gateway.refunds;
  expect(reader).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ order_no: 'ORIGINAL-ORDER', status: 'UNKNOWN', cursor: 'original-cursor' }), expect.any(AbortSignal));
});

it('earning drawer closes through its named native button and returns to the original row while retaining the month and cursor', async () => {
  const id = 'earning-'.padEnd(64, 'A');
  const row = { earning_id: id, order_id: 'order-original', order_no: 'ORIGINAL-ORDER', beneficiary_kind: 'PERSONAL', account_id: 'original-lessor', beneficiary_display_name: null, merchant_id: null, merchant_name: null, asset_title: '成交资产', beneficiary_fen: '8000', posted_at: '2026-10-06T00:00:00Z' };
  fixture.gateway.earnings.mockResolvedValue({ items: [row], next_cursor: null });
  fixture.gateway.earning.mockResolvedValue({ ...row, rent_fen: '10000', overtime_fen: '0', loss_fen: '0', subsidy_fen: '0', platform_fen: '2000' });
  const path = '/finance?tab=earnings&beneficiary_kind=PERSONAL&period_month=2026-10&cursor=original-cursor';
  show(path); const trigger = await screen.findByRole('button', { name: id });
  expect(trigger).toHaveTextContent(id); expect(trigger).toHaveAttribute('title', id); expect(trigger).toHaveStyle({ maxWidth: '100%', height: 'var(--td-comp-size-m)' });
  expect(screen.getByText(id)).toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  expect(screen.getByRole('link', { name: 'ORIGINAL-ORDER' })).toHaveAttribute('href', '/orders/rental?order_id=order-original');
  trigger.focus(); fireEvent.click(trigger);
  await waitFor(() => expect(fact('受益方收益')).toHaveTextContent('80.00'));
  const close = screen.getByRole('button', { name: '关闭收益明细' });
  expect(close.tagName).toBe('BUTTON'); expect(close).toHaveAttribute('type', 'button'); expect(close.tabIndex).toBe(0);
  close.focus(); expect(close).toHaveFocus(); fireEvent.click(close);
  await waitFor(() => expect(screen.queryByText('受益方收益', { selector: 'dt' })).not.toBeInTheDocument());
  expect(close.closest('.t-drawer')).not.toHaveClass('t-drawer--open');
  await waitFor(() => expect(trigger).toHaveFocus()); expect(screen.getByTestId('finance-location')).toHaveTextContent(path);
  expect(fixture.gateway.earning).toHaveBeenCalledExactlyOnceWith(id, expect.any(AbortSignal));
  expect(fixture.gateway.exportIncome).not.toHaveBeenCalled(); expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled(); expect(fixture.gateway.reconcileRefund).not.toHaveBeenCalled();
});

it('uses refreshed allowed_actions instead of the stale row selected before revocation', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'initial-id' }));
  rows = rows.map((row) => ({ ...row, allowed_actions: [{ ...row.allowed_actions[0]!, allowed: false }] }));
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '核查原交易结果' })).toBeDisabled());
  expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled();
});

it('preserves UNKNOWN and amount after API 403 and hides recovery after the role is revoked', async () => {
  fixture.gateway.reconcilePayment.mockRejectedValue(new ApiProblem(403, { code: 'PERMISSION_DENIED', message: '已撤销查询权限', request_id: 'denied' }));
  const view = show(); fireEvent.click(await screen.findByRole('button', { name: 'initial-id' })); fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' }));
  await screen.findByText(/已撤销查询权限|没有.*权限/); expect(fact('状态')).toHaveTextContent('支付结果待确认'); expect(fact('结算金额')).toHaveTextContent('200.00'); expect(fixture.gateway.reconcilePayment).toHaveBeenCalledOnce();
  fixture.session.permissions = ['ops.finance.read']; view.refreshSession();
  expect(screen.queryByRole('button', { name: '核查原交易结果' })).not.toBeInTheDocument();
});

it('does not expose a recovery action to a finance reader without recovery permission', async () => {
  fixture.session.permissions = ['ops.finance.read']; show(); fireEvent.click(await screen.findByRole('button', { name: 'initial-id' }));
  expect(screen.queryByRole('button', { name: '核查原交易结果' })).not.toBeInTheDocument(); expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled();
});

it('lists separate personal beneficiaries with stable IDs and explicit missing-name placeholders', async () => {
  const earning = (id: string, account: string, name: string | null) => ({ earning_id: id, order_id: 'order-' + id, order_no: 'RO-' + id, beneficiary_kind: 'PERSONAL', account_id: account, beneficiary_display_name: name, merchant_id: null, merchant_name: null, asset_title: '设备快照', beneficiary_fen: '8000', posted_at: '2026-10-06T00:00:00Z' });
  fixture.gateway.earnings.mockResolvedValue({ items: [earning('earning-a', 'lessor-a', '同名出租方'), earning('earning-b', 'lessor-b', null)], next_cursor: null });
  fixture.gateway.earning.mockResolvedValue({ ...earning('earning-b', 'lessor-b', null), rent_fen: '10000', overtime_fen: '0', loss_fen: '0', subsidy_fen: '0', platform_fen: '2000' });
  show('/finance?tab=earnings&beneficiary_kind=PERSONAL');
  await screen.findByText('同名出租方 · lessor-a'); expect(screen.getByText('显示名不可用 · lessor-b')).toBeInTheDocument();
  expect(fixture.gateway.earnings).toHaveBeenCalledWith(expect.objectContaining({ account_id: '', beneficiary_kind: 'PERSONAL' }), expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'earning-b' })); await waitFor(() => expect(fact('受益方')).toHaveTextContent('lessor-b'));
  expect(fact('受益方收益')).toHaveTextContent('80.00'); for (const link of screen.getAllByRole('link', { name: 'RO-earning-b' })) expect(link).toHaveAttribute('href', '/orders/rental?order_id=order-earning-b');
  expect(screen.queryByText(/付款登记|提现申请|联系客服|备用渠道准入/)).not.toBeInTheDocument();
});

it('reads merchant identity from its earning row without inventing a personal beneficiary', async () => {
  fixture.gateway.earnings.mockResolvedValue({ items: [{ earning_id: 'merchant-earning', beneficiary_kind: 'MERCHANT', merchant_id: 'merchant-original', merchant_name: '原商家', account_id: null, order_id: 'merchant-order', order_no: 'RO-M', beneficiary_fen: '25000', posted_at: '2026-10-06T00:00:00Z' }], next_cursor: null });
  show('/finance?tab=earnings'); await screen.findByText('原商家 · merchant-original'); expect(screen.queryByText(/lessor|显示名不可用/)).not.toBeInTheDocument();
});

it('does not request a crafted earning detail without finance permission', () => {
  fixture.session.permissions = ['ops.orders.read']; show('/finance?tab=earnings&earning_id=foreign-earning');
  expect(fixture.gateway.earnings).not.toHaveBeenCalled(); expect(fixture.gateway.earning).not.toHaveBeenCalled();
});

it('refreshes a current nickname without changing the original earning, account, order or amount', async () => {
  const row = { earning_id: 'stable-earning', order_id: 'stable-order', order_no: 'STABLE-RO', beneficiary_kind: 'PERSONAL', account_id: 'stable-account', beneficiary_display_name: '原昵称', merchant_id: null, merchant_name: null, asset_title: '成交资产', beneficiary_fen: '8000', posted_at: '2026-10-06T00:00:00Z' };
  fixture.gateway.earnings.mockResolvedValueOnce({ items: [row], next_cursor: null }).mockResolvedValue({ items: [{ ...row, beneficiary_display_name: '新昵称' }], next_cursor: null });
  show('/finance?tab=earnings&beneficiary_kind=PERSONAL'); await screen.findByText('原昵称 · stable-account'); fireEvent.click(screen.getByRole('button', { name: '刷新' })); await screen.findByText('新昵称 · stable-account');
  expect(screen.getByRole('button', { name: 'stable-earning' })).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'STABLE-RO' })).toHaveAttribute('href', '/orders/rental?order_id=stable-order'); expect(screen.getByText('¥80.00')).toBeInTheDocument();
});

it('exports only the selected merchant month CSV without inspection, fabricated totals or settlement batches', async () => {
  fixture.gateway.earnings.mockResolvedValue({ items: [{ earning_id: 'posted-merchant', beneficiary_kind: 'MERCHANT', merchant_id: 'merchant-original', merchant_name: '原商家', account_id: null, order_id: 'merchant-order', order_no: 'RO-M', beneficiary_fen: '25000', posted_at: '2026-10-06T00:00:00Z' }], next_cursor: null });
  const csv = new Blob(['order_no,beneficiary_fen\nRO-M,25000'], { type: 'text/csv' });
  fixture.gateway.exportIncome.mockResolvedValue(csv);
  URL.createObjectURL = vi.fn().mockReturnValue('blob:merchant-month'); URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('merchant-income-2026-10.csv'); expect(this.href).toBe('blob:merchant-month');
  });
  show('/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=merchant-original&period_month=2026-10');
  await screen.findByText('原商家 · merchant-original');
  expect(screen.getByRole('button', { name: 'posted-merchant' })).toBeInTheDocument();
  expect(screen.queryByText(/实检状态|月结批次|结算批次|预计收益|当前筛选共|共\s*1\s*条|共\s*1\s*笔/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /付款登记|提现|生成结算单|发起打款|强制完成/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '导出当月商家流水 CSV' }));
  await waitFor(() => expect(fixture.gateway.exportIncome).toHaveBeenCalledExactlyOnceWith('2026-10', 'merchant-original'));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(URL.createObjectURL).toHaveBeenCalledExactlyOnceWith(csv); expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:merchant-month');
  expect(fixture.gateway.reconcilePayment).not.toHaveBeenCalled(); expect(fixture.gateway.reconcileRefund).not.toHaveBeenCalled();
});
