import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { components, RentalOrder, Versioned } from '../../shared/services/rentalOrders';
import { RentalOrderDetail } from './RentalOrderDetail';
import { FinancePage } from '../finance/FinancePage';

const { gateway, session } = vi.hoisted(() => ({
  gateway: { detail: vi.fn(), contract: vi.fn(), tasks: vi.fn(), payments: vi.fn(), refunds: vi.fn(), reconcilePayment: vi.fn(), reconcileRefund: vi.fn() },
  session: { accountId: 'review-admin', permissions: ['ops.orders.read', 'ops.finance.read', 'ops.payments.recover'] },
}));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: gateway }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => session }));
vi.mock('./RentalReviewPanel', () => ({ RentalReviewPanel: () => null }));

const clients: QueryClient[] = [];
it.each([
  ['CREATED', '退款已创建'], ['PROCESSING', '退款处理中'], ['UNKNOWN', '退款结果待确认'],
  ['FAILED_CONFIRMED', '退款失败'], ['SUCCEEDED', '退款成功'],
] as const)('renders the original %s refund facts without adding a refund command', async (status, label) => {
  session.permissions = ['ops.orders.read'];
  const refund: components['schemas']['RefundView'] = { payment_mode: 'NORMAL', business_amount_fen: '24000', channel_amount_fen: '24000', obligation_id: 'refund-duty', original_payment_id: 'initial-payment', excess_component_fen: '0', refund_id: 'original-refund', order_id: 'order-1', purpose: 'DEPOSIT', status, amount_fen: '24000', payer_refund_fen: null, deposit_component_fen: '24000', rent_component_fen: '0', refunded_at: status === 'SUCCEEDED' ? '2026-10-06T08:00:00Z' : null, last_verified_at: '2026-10-06T08:01:00Z', version: '2', currency: 'CNY', allowed_actions: [], blockers: status === 'FAILED_CONFIRMED' ? [{ code: 'REFUND_FAILED', field: null, message: '原退款明确失败，待官方处理' }] : [] };
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', null, (data) => ({ ...data, bill: { ...data.bill, refund_summary: { ...data.bill.refund_summary, latest_refund: refund }, refund_due_fen: '24000', deposit_refunded_fen: status === 'SUCCEEDED' ? '24000' : '0' } }));
  await screen.findByText(label);
  expect(fact('原退款编号')).toHaveTextContent('original-refund');
  expect(fact('退款结算金额')).toHaveTextContent('240.00'); expect(fact('微信实际退款')).toHaveTextContent('待确认');
  expect(fact('退款成功时间')).toHaveTextContent(status === 'SUCCEEDED' ? '2026年10月6日 16:00:00' : '—');
  if (status === 'FAILED_CONFIRMED') expect(screen.getByText('原退款明确失败，待官方处理')).toBeInTheDocument();
  expect(gateway.refunds).not.toHaveBeenCalled(); expect(gateway.reconcileRefund).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /再次退款|发起退款|退押/ })).not.toBeInTheDocument();
});

it('keeps an absent refund explicitly absent without inventing a status, amount or timestamp', async () => {
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', null, (data) => ({ ...data, bill: { ...data.bill, refund_summary: { ...data.bill.refund_summary, latest_refund: null } } }));
  await screen.findByText('暂无退款记录');
  for (const label of ['原退款编号', '退款结算金额', '微信实际退款', '退款成功时间', '退款最近核验']) expect(screen.queryByText(label, { selector: 'dt' })).not.toBeInTheDocument();
  expect(gateway.refunds).not.toHaveBeenCalled(); expect(gateway.reconcileRefund).not.toHaveBeenCalled();
});
beforeEach(() => {
  session.permissions = ['ops.orders.read', 'ops.finance.read', 'ops.payments.recover'];
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); vi.resetAllMocks(); vi.restoreAllMocks(); });

type Payment = components['schemas']['PaymentView'];
function payment(status: Payment['status'] = 'UNKNOWN'): Payment {
  return { payment_mode: 'NORMAL', business_amount_fen: '20000', channel_amount_fen: '20000', supplement_id: 'supplement-bill', generation: 1, payment_id: 'original-supplement', order_id: 'order-1', purpose: 'SUPPLEMENT', status, amount_fen: '20000', payer_total_fen: null, currency: 'CNY', expires_at: '2026-10-06T16:00:00Z', paid_at: status === 'SUCCEEDED' ? '2026-10-06T15:59:00Z' : null, last_verified_at: '2026-10-06T15:58:00Z', created_at: '2026-10-06T15:50:00Z', version: '2', allowed_actions: [], blockers: [] };
}
function opsPayment(row: Payment): components['schemas']['OpsPaymentView'] {
  return { ...row, mchid: 'synthetic-merchant', config_version_id: 'config-1', out_trade_no: 'original-trade', channel_transaction_id: row.status === 'SUCCEEDED' ? 'original-provider-transaction' : null, channel_status: row.status === 'SUCCEEDED' ? 'SUCCESS' : null, last_error_code: null, allowed_actions: [{ action_code: 'QUERY_PAYMENT', allowed: row.status === 'UNKNOWN', reason_code: null, display_reason: null, target: row.payment_id, required_version: null }] };
}
function show(row?: Payment, finalized = true, due: string | null = '20000', location = '/orders/rental', supply: 'PERSONAL' | 'OFFICIAL_CABINET' = 'PERSONAL', couponStatus: RentalOrder['coupon_status'] = null, transform: (data: RentalOrder) => RentalOrder = (data) => data) {
  const data = {
    order: { allowed_actions: [], version: '1', payment_mode: 'NORMAL', supply_channel: supply, order_id: 'order-1', order_no: 'RO-TEST-001', display_status: '待补缴', asset: { asset_id: 'asset-1', title: '合成设备' }, participants: { tenant_account_id: 'tenant', tenant_display_name: null, lessor_id: supply === 'PERSONAL' ? 'lessor' : null, lessor_display_name: null }, rental_start_at: '2026-10-05T00:00:00Z', rental_end_at: '2026-10-06T00:00:00Z', physical_status: 'RECEIVED', review_status: finalized ? 'FINAL' : 'PENDING', initial_paid_fen: '60000', initial_payer_total_fen: null, blockers: [], has_exception: false, exception_codes: [] },
    merchant_id: null, completed_at: null, closed_at: null, earning_id: null, coupon_status: couponStatus,
    fees: { rent_gross_fen: '10000', rent_discount_fen: '0', deposit_list_fen: '50000', deposit_waived_fen: '0', initial_due_fen: '60000' },
    bill: { payment_mode: 'NORMAL', finalized, deposit_received_fen: '50000', overtime_fen: finalized ? '6000' : null, loss_fen: finalized ? '64000' : null, deducted_fen: finalized ? '50000' : '0', refund_due_fen: finalized ? '0' : null, supplement_due_fen: due, deposit_refunded_fen: '0', initial_payment: { ...payment('SUCCEEDED'), supplement_id: null, generation: 0, payment_id: 'initial-payment', purpose: 'INITIAL' }, supplement: due && due !== '0' ? { supplement_id: 'supplement-bill', amount_fen: due, status: row?.status === 'SUCCEEDED' ? 'PAID' : 'UNPAID', active_payment: row ?? null, paid_payment: row?.status === 'SUCCEEDED' ? row : null } : null, refund_summary: { obligation_fen: '0', refunded_fen: '0', pending_fen: '0', open_obligation_count: 0, latest_refund: null }, funds_summary: { gross_received_fen: '60000', refunded_fen: '0', net_received_fen: '60000', payer_net_fen: null } },
    asset_snapshot: { description: '成交快照', condition_description: '合成测试', physical_identifier_display: null, accessories: [], media: [] },
    requirements: { return_instructions: '归还拍照录像', pickup_instructions: '', policy_version_id: 'policy-1' },
    delivery: { method: 'EXPRESS', carrier: null, tracking_no: null, shipped_at: null, delivered_at: null },
  } as unknown as RentalOrder;
  gateway.detail.mockResolvedValue({ data: transform(data), etag: '"ORDER:b3JkZXItMQ:3"', serverClock: null } satisfies Versioned<RentalOrder>);
  gateway.payments.mockResolvedValue({ items: row ? [opsPayment(row)] : [], has_more: false, next_cursor: null });
  gateway.reconcilePayment.mockResolvedValue(row ? opsPayment(row) : undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[location]}><Routes><Route path="/orders/rental" element={<RentalOrderDetail id="order-1" />} /><Route path="/finance" element={<FinancePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
function fact(label: string) { return screen.getByText(label, { selector: 'dt' }).nextElementSibling; }

it('prefers the original matching blocker message for an exception and keeps an unknown code visible without changing order facts', async () => {
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', null, (data) => ({ ...data, order: { ...data.order, has_exception: true, exception_codes: ['PAYMENT_VERIFICATION_REQUIRED', 'FUTURE_EXCEPTION'], blockers: [{ code: 'PAYMENT_VERIFICATION_REQUIRED', field: null, message: '原支付现金金额正在核验' }, { code: 'FUTURE_EXCEPTION', field: null, message: '' }] } }));
  await screen.findByText('订单异常：原支付现金金额正在核验、订单异常待核实（FUTURE_EXCEPTION）。无法处理的情况由官方人员在线下酌情处理。');
  expect(screen.queryByText(/订单异常：支付结果待核实/)).not.toBeInTheDocument();
  expect(fact('实物状态')).toHaveTextContent('已收回'); expect(fact('审核状态')).toHaveTextContent('已核定');
  expect(fact('订单结清金额')).toHaveTextContent('600.00'); expect(fact('微信实付')).toHaveTextContent('待确认');
  expect(gateway.reconcilePayment).not.toHaveBeenCalled(); expect(gateway.reconcileRefund).not.toHaveBeenCalled();
});

it('labels cabinet facts by their field meaning and retains an unrecognized order code without inventing a known state', async () => {
  gateway.tasks.mockResolvedValue({ items: [{ task_id: 'original-task', purpose: 'RETURN', status: 'RESERVED', cabinet_id: 'original-cabinet', compartment_id: 'original-slot', door_status: 'CLOSED', rfid_result: 'MATCH', occupancy_result: 'TARGET_PRESENT', observed_at: null, confirmed_at: null, blockers: [] }], next_cursor: null });
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', null, (data) => ({ ...data, order: { ...data.order, physical_status: 'FUTURE_PHYSICAL' as RentalOrder['order']['physical_status'] } }));
  await screen.findByText('未知状态（FUTURE_PHYSICAL）');
  fireEvent.click(screen.getByRole('button', { name: '查看原取还任务' })); await screen.findByText('归还任务 original-task');
  expect(fact('执行状态')).toHaveTextContent('已预留'); expect(fact('门态')).toHaveTextContent('门已关闭'); expect(fact('RFID / 占用')).toHaveTextContent('匹配 / 本单设备在格');
  expect(gateway.tasks).toHaveBeenCalledExactlyOnceWith('order-1', expect.any(AbortSignal));
  expect(gateway.reconcilePayment).not.toHaveBeenCalled(); expect(gateway.reconcileRefund).not.toHaveBeenCalled();
});

it.each([
  { finalized: true, due: '20000', state: '尚未发起' },
  { finalized: true, due: '0', state: '无需补缴' },
  { finalized: false, due: null, state: '待最终核定' },
])('keeps absent supplement records read-only: $state', async ({ finalized, due, state }) => {
  show(undefined, finalized, due);
  await screen.findByText(state);
  expect(fact('补缴状态')).toHaveTextContent(state);
  expect(fact('补缴记录')).toHaveTextContent('—');
  expect(fact('补缴支付截止')).toHaveTextContent('—');
  expect(screen.queryByRole('link', { name: /查看原补缴记录/ })).not.toBeInTheDocument();
  expect(gateway.payments).not.toHaveBeenCalled();
  expect(gateway.reconcilePayment).not.toHaveBeenCalled();
});

it.each([['UNKNOWN', '支付结果待确认'], ['SUCCEEDED', '支付成功']] as const)('links only the original %s supplement and never queries automatically', async (status, label) => {
  show(payment(status));
  const link = await screen.findByRole('link', { name: '查看原补缴记录 original-supplement' });
  const target = new URL(link.getAttribute('href')!, 'https://admin.example.test');
  expect(Object.fromEntries(target.searchParams)).toEqual({ tab: 'payments', order_no: 'RO-TEST-001', purpose: 'SUPPLEMENT', payment_id: 'original-supplement' });
  expect(fact('补缴状态')).toHaveTextContent(label);
  expect(fact('实物状态')).toHaveTextContent('已收回'); expect(fact('审核状态')).toHaveTextContent('已核定');
  expect(fact('补缴支付截止')).toHaveTextContent('2026年10月7日 00:00:00');
  expect(gateway.payments).not.toHaveBeenCalled();
  fireEvent.click(link);
  await screen.findByText('资金记录详情');
  await waitFor(() => expect(gateway.payments).toHaveBeenCalledWith(expect.objectContaining({ order_no: 'RO-TEST-001', purpose: 'SUPPLEMENT' }), expect.any(AbortSignal)));
  expect(gateway.reconcilePayment).not.toHaveBeenCalled();
  expect(fact('记录编号')).toHaveTextContent('original-supplement');
  if (status === 'UNKNOWN') {
    fireEvent.click(screen.getByRole('button', { name: '核查原交易结果' }));
    await waitFor(() => expect(gateway.reconcilePayment).toHaveBeenCalledOnce());
    expect(gateway.reconcilePayment).toHaveBeenCalledWith('original-supplement', expect.any(String));
  } else {
    const disabled = screen.getByText('核查原交易结果').closest('[type="button"]');
    expect(disabled).toHaveAttribute('disabled');
    fireEvent.click(disabled!);
    expect(gateway.reconcilePayment).not.toHaveBeenCalled();
  }
});

it('does not expose finance navigation or request O01 without finance read permission', async () => {
  session.permissions = ['ops.orders.read'];
  show(payment());
  await screen.findByText('original-supplement');
  expect(screen.queryByRole('link', { name: /查看原补缴记录/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '查看原支付、退款及核查结果' })).not.toBeInTheDocument();
  expect(gateway.payments).not.toHaveBeenCalled();
  expect(gateway.reconcilePayment).not.toHaveBeenCalled();
});

it('does not fabricate an OPS record if O01 no longer returns the linked payment', async () => {
  show(payment());
  gateway.payments.mockResolvedValue({ items: [], has_more: false, next_cursor: null });
  fireEvent.click(await screen.findByRole('link', { name: '查看原补缴记录 original-supplement' }));
  await screen.findByText('原补缴记录未出现在当前授权查询中，请刷新核对。');
  expect(screen.queryByRole('button', { name: '核查原交易结果' })).not.toBeInTheDocument();
  expect(gateway.reconcilePayment).not.toHaveBeenCalled();
});

it('does not read or query a crafted finance locator without finance permission', async () => {
  session.permissions = ['ops.orders.read'];
  show(payment(), true, '20000', '/finance?tab=payments&order_no=RO-TEST-001&purpose=SUPPLEMENT&payment_id=original-supplement');
  await waitFor(() => expect(screen.getByRole('search', { name: '资金筛选' })).toBeInTheDocument());
  expect(gateway.detail).not.toHaveBeenCalled();
  expect(gateway.payments).not.toHaveBeenCalled();
  expect(gateway.reconcilePayment).not.toHaveBeenCalled();
  expect(screen.queryByText('original-supplement')).not.toBeInTheDocument();
});

it('keeps an official platform order distinct from personal supply without inventing a lessor', async () => {
  show(undefined, true, '0', '/orders/rental', 'OFFICIAL_CABINET'); await screen.findByText('平台供给');
  expect(fact('商家')).toHaveTextContent('平台供给'); expect(fact('出租方')).toHaveTextContent('—'); expect(screen.queryByText('个人出租')).not.toBeInTheDocument();
});

it('does not read an order deep link with finance-only permission', async () => {
  session.permissions = ['ops.finance.read']; show(); await screen.findByText('当前账号没有订单读取权限'); expect(gateway.detail).not.toHaveBeenCalled();
});

it('shows the frozen signed OSS artifact and tenant facts without offering signing as OPS', async () => {
  gateway.contract.mockResolvedValue({ contract_id: 'original-contract', template_version_id: 'agreement-v1', status: 'SUCCEEDED', quota_state: 'RESTORED', quota_valid_until: '2026-11-06T08:00:00Z', expires_at: '2026-10-06T01:00:00Z', agreement_text: '冻结协议全文\n本单租赁责任', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), lessor_signature: { name: '合成出租方', mode: 'DEFAULT_SIGNED', source: 'USER_CONFIRMED_LOCAL_DEFAULT', signed_at: null, material_id: null, presignature_id: null }, tenant_signature: { name: '合成承租人', account_id: 'tenant-original', status: 'SUCCEEDED', signed_at: '2026-10-06T00:00:00Z' }, final_artifact: { artifact_id: 'original-artifact', document_material_id: 'original-pdf', document_sha256: 'c'.repeat(64), document_url: 'https://media.example.test/original-contract.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'original-page', sha256: 'd'.repeat(64), url: 'https://media.example.test/original-page.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.1 }], renderer_version: 'fixture' }, blockers: [] });
  show(); fireEvent.click(await screen.findByRole('button', { name: '查看合同与次数' })); await screen.findByText('冻结协议全文 本单租赁责任');
  expect(fact('协议摘要')).toHaveTextContent('a'.repeat(64)); expect(fact('订单条款摘要')).toHaveTextContent('b'.repeat(64)); expect(fact('签署截止')).toHaveTextContent('2026年10月6日 09:00:00');
  expect(fact('承租人签署')).toHaveTextContent('合成承租人 · 已签署'); expect(fact('承租人签署时间')).toHaveTextContent('2026年10月6日 08:00:00');
  expect(fact('合同次数状态')).toHaveTextContent('已恢复'); expect(fact('合同次数原有效期')).toHaveTextContent('2026年11月6日 16:00:00');
  expect(screen.getByRole('link', { name: '查看已签署合同 PDF' })).toHaveAttribute('href', 'https://media.example.test/original-contract.pdf'); expect(fact('成品摘要')).toHaveTextContent('c'.repeat(64)); expect(screen.queryByRole('button', { name: /同意协议|签署/ })).not.toBeInTheDocument();
});

it('does not replace a missing original quota expiry with the agreement consent deadline', async () => {
  gateway.contract.mockResolvedValue({ contract_id: 'original-contract', template_version_id: 'agreement-v1', status: 'PENDING', quota_state: 'NOT_APPLICABLE', quota_valid_until: null, expires_at: '2026-10-06T01:00:00Z', agreement_text: '冻结协议全文', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), lessor_signature: { name: '合成出租方', mode: 'DEFAULT_SIGNED', source: 'USER_CONFIRMED_LOCAL_DEFAULT', signed_at: null, material_id: null, presignature_id: null }, tenant_signature: { name: '合成承租人', account_id: 'tenant-original', status: 'PENDING', signed_at: null }, final_artifact: null, blockers: [] });
  show(); fireEvent.click(await screen.findByRole('button', { name: '查看合同与次数' })); await screen.findByText('冻结协议全文');
  expect(fact('合同次数原有效期')).toHaveTextContent('不适用或长期有效'); expect(fact('合同次数原有效期')).not.toHaveTextContent('2026'); expect(fact('出租方签署')).toHaveTextContent('默认已签署');
});

it.each([
  { state: null, label: '未使用优惠券' },
  { state: 'RESERVED', label: '已预占' },
  { state: 'CONSUMED', label: '已使用' },
  { state: 'RELEASED', label: '已释放' },
  { state: 'RESTORED', label: '已恢复' },
] as const)('projects the original coupon $state state without inventing an expiry', async ({ state, label }) => {
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', state);
  await screen.findByText(label);
  expect(fact('优惠券状态')).toHaveTextContent(label);
  expect(screen.queryByText(/优惠券.*有效期|券到期|券截止/)).not.toBeInTheDocument();
  expect(gateway.reconcileRefund).not.toHaveBeenCalled();
});

it.each([['PROCESSING', '支付处理中'], ['FAILED_CONFIRMED', '支付失败'], ['CLOSED_UNPAID', '未支付关闭'], ['SUCCEEDED', '支付成功']] as const)('keeps the same 200 yuan responsibility and original ID for supplement %s', async (status, label) => {
  show(payment(status));
  await screen.findByText(label);
  expect(fact('应补缴')).toHaveTextContent('200.00');
  expect(fact('补缴记录')).toHaveTextContent('original-supplement');
  expect(screen.getByRole('link', { name: /查看原补缴记录/ })).toHaveAttribute('href', '/finance?tab=payments&order_no=RO-TEST-001&purpose=SUPPLEMENT&payment_id=original-supplement');
  expect(gateway.payments).not.toHaveBeenCalled(); expect(gateway.reconcilePayment).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /支付|创建补缴|新补缴/ })).not.toBeInTheDocument();
});

it('uses the trusted zero-cash close reason and restored rights without inventing a refund', async () => {
  gateway.contract.mockResolvedValue({ contract_id: 'zero-contract', template_version_id: 'original-template', status: 'SUCCEEDED', quota_state: 'RESTORED', quota_valid_until: '2026-11-06T08:00:00Z', expires_at: '2026-10-06T01:00:00Z', agreement_text: '原冻结协议', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), lessor_signature: { name: '合成出租方', mode: 'DEFAULT_SIGNED', source: 'USER_CONFIRMED_LOCAL_DEFAULT', signed_at: null, material_id: null, presignature_id: null }, tenant_signature: { name: '合成承租人', account_id: 'tenant-original', status: 'SUCCEEDED', signed_at: '2026-10-06T00:00:00Z' }, final_artifact: { artifact_id: 'original-artifact', document_material_id: 'original-pdf', document_sha256: 'c'.repeat(64), document_url: 'https://media.example.test/original-contract.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'original-page', sha256: 'd'.repeat(64), url: 'https://media.example.test/original-page.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.1 }], renderer_version: 'fixture' }, blockers: [] });
  show(undefined, false, null, '/orders/rental', 'PERSONAL', 'RESTORED', (data) => ({ ...data, closed_at: '2026-10-06T08:00:00Z', order: { ...data.order, stage: 'CLOSED', display_status: '租期结束未交付，订单已关闭', initial_paid_fen: '0', initial_payer_total_fen: '0' }, fees: { ...data.fees, initial_due_fen: '0' }, bill: { ...data.bill, initial_payment: null, supplement: null, deposit_received_fen: '0', deposit_refunded_fen: '0', refund_due_fen: null } }));
  await screen.findByText('RO-TEST-001 · 租期结束未交付，订单已关闭');
  fireEvent.click(screen.getByRole('button', { name: '查看合同与次数' })); await screen.findByText('原冻结协议');
  expect(fact('合同次数状态')).toHaveTextContent('已恢复'); expect(fact('合同次数原有效期')).toHaveTextContent('2026年11月6日 16:00:00');
  expect(fact('优惠券状态')).toHaveTextContent('已恢复'); expect(fact('初始应付')).toHaveTextContent('0.00'); expect(fact('应退押金')).toHaveTextContent('待确认');
  expect(screen.queryByText(/退款成功|退款时间|优惠券.*有效期/)).not.toBeInTheDocument(); expect(gateway.reconcileRefund).not.toHaveBeenCalled();
});

it('separates test business deposit coverage from ten-fen channel receipts and no earnings', async () => {
  show(undefined, true, '0', '/orders/rental', 'PERSONAL', null, data => ({ ...data,
    order: { ...data.order, payment_mode: 'FIXED_10_FEN', initial_paid_fen: '10', initial_payer_total_fen: '10' },
    bill: { ...data.bill, payment_mode: 'FIXED_10_FEN', funds_summary: { ...data.bill.funds_summary, gross_received_fen: '10', net_received_fen: '10', payer_net_fen: '10' } },
  }));
  await screen.findByText('测试订单不生成收益');
  expect(fact('测试业务押金覆盖')).toHaveTextContent('500.00');
  expect(fact('渠道订单实收')).toHaveTextContent('0.10');
  expect(fact('累计收款')).toHaveTextContent('0.10');
  expect(screen.queryByText('已收押金', { selector: 'dt' })).not.toBeInTheDocument();
});
