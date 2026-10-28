import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { RentalFeeOrder } from '../miniprogram/shared/model/rental-fees';
import { rentalFeeView } from '../miniprogram/shared/presentation/rental-fees';
import { PUBLIC_MATERIAL_ORIGIN } from '../miniprogram/shared/presentation/material-media';

function fixture(): RentalFeeOrder {
  // The wire fixture supplies every field consumed by this read-only page.
  return {
    order: { order_id: 'order-1', order_no: 'N1', stage: 'ACTIVE', physical_status: 'RECEIVED', review_status: 'FINAL' },
    fees: { initial_due_fen: '100000' },
    bill: { finalized: true, review_id: 'review-1', overtime_fen: '6000', loss_fen: '20000', deducted_fen: '26000', refund_due_fen: '24000', supplement_due_fen: '0',
      initial_payment: { payment_id: 'initial-1', supplement_id: null, generation: 0, order_id: 'order-1', purpose: 'INITIAL', status: 'SUCCEEDED', payment_mode: 'NORMAL', business_amount_fen: '100000', channel_amount_fen: '100000', amount_fen: '100000', currency: 'CNY', payer_total_fen: '99000' }, supplement: null, refund_summary: { obligation_fen: '24000', refunded_fen: '0', pending_fen: '24000', open_obligation_count: 1, latest_refund: null }, funds_summary: { gross_received_fen: '100000', refunded_fen: '0', net_received_fen: '100000', payer_total_fen: '99000', payer_refund_fen: null, payer_net_fen: null, excess_received_fen: '0', currency: 'CNY' },
      assessment: { review_id: 'review-1', review_no: '3', decision: 'APPROVE_FINAL', created_at: '2026-10-09T06:00:00Z', adjustment_reason: null,
        overtime_basis: { end_at: '2026-10-07T16:00:00Z', cutoff_at: '2026-10-08T04:00:00Z', cutoff_source: 'RECEIVED', unit_seconds: 7200, grace_seconds: 300, billable_units: '6', unit_price_fen: '1000', rounding: 'CEIL_UNIT' },
        loss_items: [{ description: '镜头外壳划痕', confirmed_fen: '20000', evidence_ids: ['photo-1'], evidence: [{ material_id: 'photo-1', kind: 'PHOTO', availability: 'READY', media: { material_id: 'photo-1', role: 'IMAGE', sort_order: 0, url: PUBLIC_MATERIAL_ORIGIN + '/fixture/photo.png', mime_type: 'image/png', size_bytes: 512, metadata: null, poster: null } }] }], evidence: [],
      },
    },
  } as unknown as RentalFeeOrder;
}
type Harness = { data: { loaded: boolean; fees: ReturnType<typeof rentalFeeView>; errorText: string; unavailable: boolean }; setData(value: Record<string, unknown>): void; [key: string]: unknown };
type Wire = { url: string; method: string; success(value: { statusCode: number; data: unknown; header: Record<string, string> }): void; fail(value: { errMsg: string }): void };
let definition: Harness, page: Harness, owner: string | null, order: RentalFeeOrder;
let route: (options: Wire) => void;
const calls: Wire[] = [], preview = vi.fn(), back = vi.fn(), redirect = vi.fn();
function call(name: string, ...args: unknown[]) { return (page[name] as (...values: unknown[]) => unknown).apply(page, args); }
function ok(options: Wire, data: unknown, statusCode = 200) { options.success({ statusCode, data, header: { ETag: '"order-1:7"' } }); }
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/order-fees/index'); });
beforeEach(() => {
  owner = 'tenant'; order = fixture(); calls.length = 0; preview.mockReset(); back.mockReset(); redirect.mockReset();
  route = options => ok(options, order);
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/order-detail/index', options: { id: 'order-1' } }, { route: 'pages/order-fees/index' }]);
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' && owner ? { accountId: owner, accessToken: 'fixture-token', refreshToken: 'r', expiresAt: Date.now() + 60_000 } : null,
    setStorageSync: vi.fn(), removeStorageSync: () => { owner = null; },
    request: (options: Wire) => { calls.push(options); route(options); return { abort: vi.fn() }; },
    previewImage: preview, previewMedia: preview, navigateBack: back, redirectTo: redirect, switchTab: vi.fn(),
  });
  preview.mockImplementation((options: { success(): void }) => options.success());
  page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
  call('onLoad', { orderId: 'order-1' });
});
afterEach(() => { call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());

test('reads one original order and projects frozen hours, grace and evidence without money commands', async () => {
  await call('onShow');
  expect(calls).toHaveLength(1); expect(calls[0]).toMatchObject({ method: 'GET', url: 'http://127.0.0.1:8081/v1/me/rental-orders/order-1' });
  expect(page.data.fees).toMatchObject({ unit: '2小时', units: '6', grace: '5分钟', returnDeadline: '2026-10-08 00:00', receivedAt: '2026-10-08 12:00', total: '¥260.00', refundDue: '¥240.00', cashExpense: '' });
  await call('previewProof', { currentTarget: { dataset: { key: 'loss-0-0', review: 'review-1' } } });
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ current: PUBLIC_MATERIAL_ORIGIN + '/fixture/photo.png' }));
  expect(calls).toHaveLength(1); call('returnToOrder'); expect(back).toHaveBeenCalledOnce(); expect(redirect).not.toHaveBeenCalled();
});
test.each(['AWAITING_PAYMENT', 'PREPARING'])('unpaid/preparing stage %s cannot reveal any settlement fields', async stage => {
  order.order.stage = stage as RentalFeeOrder['order']['stage']; await call('onShow'); expect(page.data).toMatchObject({ unavailable: true, fees: null });
});
test.each(['IN_USE', 'RETURN_IN_TRANSIT'])('unreturned physical state %s cannot reveal deposit settlement', async status => {
  order.order.physical_status = status as RentalFeeOrder['order']['physical_status']; await call('onShow'); expect(page.data.fees).toBeNull();
});
test('unfinalized or mismatched review never becomes final just because a query string opens the page', async () => {
  order.bill.assessment!.decision = 'REVIEW_PENDING'; await call('onShow'); expect(page.data.fees).toBeNull();
  order.bill.assessment!.decision = 'APPROVE_FINAL'; order.bill.review_id = 'different'; await call('refresh'); expect(page.data.fees).toBeNull();
});
test('huge fen sums preserve exact integer precision and missing values stay unknown', () => {
  order.bill.overtime_fen = '9007199254740993'; order.bill.loss_fen = '2';
  expect(rentalFeeView(order)!.total).toBe('¥90071992547409.95');
  order.bill.loss_fen = null; expect(rentalFeeView(order)!.total).toBe('待核实');
});
test('cash expense uses the complete server aggregate and withholds an unresolved amount', () => {
  order.order.stage = 'COMPLETED';
  Object.assign(order.bill.refund_summary, { open_obligation_count: 0, pending_fen: '0', refunded_fen: '24000' });
  Object.assign(order.bill.funds_summary, { refunded_fen: '24000', net_received_fen: '76000', payer_refund_fen: '23500', payer_net_fen: '75500' });
  expect(rentalFeeView(order)!.cashExpense).toBe('¥755.00');
  order.bill.funds_summary.payer_net_fen = null;
  expect(rentalFeeView(order)!.cashExpense).toBe('');
  order.bill.funds_summary.payer_net_fen = '75500'; order.bill.refund_summary.open_obligation_count = 1;
  expect(rentalFeeView(order)!.cashExpense).toBe('');
});
test('page never reconstructs total cash from the bounded payment references', () => {
  order.order.stage = 'COMPLETED';
  Object.assign(order.bill.refund_summary, { open_obligation_count: 0, pending_fen: '0' });
  order.bill.funds_summary.payer_net_fen = '74500';
  expect(rentalFeeView(order)!.cashExpense).toBe('¥745.00');
  order.bill.initial_payment!.order_id = 'foreign';
  expect(rentalFeeView(order)!.cashExpense).toBe('');
});
test('wrong material identity and missing evidence remain unavailable and cannot open unrelated images', async () => {
  order.bill.assessment!.loss_items[0]!.evidence[0]!.media!.material_id = 'wrong'; await call('onShow');
  expect(page.data.fees!.lossItems[0]!.evidence[0]!.available).toBe(false);
  await call('previewProof', { currentTarget: { dataset: { key: 'loss-0-0', review: 'review-1' } } }); expect(preview).not.toHaveBeenCalled();
});
test('a delayed response from the hidden prior account cannot repopulate the current page', async () => {
  let old!: Wire; route = options => { old = options; }; const read = call('onShow');
  await vi.waitFor(() => expect(calls).toHaveLength(1)); call('onHide'); owner = 'lessor';
  route = options => ok(options, { code: 'NOT_FOUND', message: '无访问权限', request_id: 'fixture' }, 404); await call('onShow');
  ok(old, order); await read; expect(page.data.fees).toBeNull(); expect(page.data.loaded).toBe(false);
});
test('401 and a mismatched order clear fee and media projections', async () => {
  await call('onShow'); route = options => ok(options, { code: 'AUTH_REQUIRED', message: '请登录', request_id: 'fixture' }, 401);
  await call('refresh'); expect(page.data.fees).toBeNull(); expect(page.data.loaded).toBe(false);
  owner = 'tenant'; route = options => ok(options, { ...order, order: { ...order.order, order_id: 'other' } });
  await call('onShow'); expect(page.data.fees).toBeNull(); expect(page.data.errorText).toContain('本单不匹配');
});
