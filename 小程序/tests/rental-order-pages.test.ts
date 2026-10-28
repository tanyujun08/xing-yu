import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PUBLIC_MATERIAL_ORIGIN as mediaOrigin } from '../miniprogram/shared/presentation/material-media';
const more = vi.hoisted(() => ({ earning: vi.fn(), refund: vi.fn(), queryRefund: vi.fn(), pendingShipment: vi.fn(), cancel: vi.fn(), correctShipment: vi.fn(), returnAddress: vi.fn(), task: vi.fn(), contract: vi.fn(), confirmDelivery: vi.fn(), uploadPhase: 'READY', uploadError: '' }));
const detail = vi.hoisted(() => ({ pickupCredential: vi.fn(), startReturn: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), find: vi.fn(), regions: vi.fn() }));
const mocks = vi.hoisted(() => ({ owner: 'tenant' as string | null, get: vi.fn(), payment: vi.fn(), createPayment: vi.fn(), invocation: vi.fn(), queryPayment: vi.fn(), confirm: vi.fn(), ship: vi.fn(), return: vi.fn(), returnShipment: vi.fn(), correctReturnShipment: vi.fn(), receipt: vi.fn(), uploadWait: null as Promise<unknown> | null, saveReturnEvidence: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem, accountApi: { sessionIdentity: () => mocks.owner, newIntent: () => 'material-key-00000001' }, addressApi: { list: detail.list, create: detail.create, update: detail.update }, findOwnAddress: detail.find, regionApi: { children: detail.regions }, runMaterialUpload: (intent: {
        phase: string;
        materialId: string;
    }, options: {
        onState: () => void;
    }) => { intent.phase = more.uploadPhase; intent.materialId = 'material-' + Math.random(); Object.assign(intent, { error: more.uploadError }); options.onState(); return { promise: mocks.uploadWait ?? Promise.resolve({}), abort: vi.fn() }; } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: { ...mocks, ...more, pickupCredential: detail.pickupCredential, startReturn: detail.startReturn } }));
vi.mock('../miniprogram/shared/media/local-media', () => ({ chooseAndSaveMedia: () => Promise.resolve(['fixture-local-file']) }));
type Harness = {
    data: Record<string, unknown>;
    setData(patch: Record<string, unknown>): void;
    [key: string]: unknown;
};
let definition: Harness;
let page: Harness;
const payment = vi.fn();
const reviewVideoStop = vi.fn();
const response = (value: unknown, etag = '"object:1"') => ({ promise: Promise.resolve({ value, etag }), abort: vi.fn() });
function paymentValue(patch: Record<string, unknown> = {}) {
    return { payment_mode: 'NORMAL', business_amount_fen: String(patch.amount_fen ?? '11000'), channel_amount_fen: String(patch.amount_fen ?? '11000'), supplement_id: patch.purpose === 'SUPPLEMENT' ? 'supplement-bill' : null, generation: patch.purpose === 'SUPPLEMENT' ? 1 : 0, payment_id: 'p1', order_id: 'o1', purpose: 'INITIAL', status: 'PROCESSING', amount_fen: '11000', currency: 'CNY', expires_at: '2999-10-06T07:39:00Z', created_at: '2026-10-06T07:30:00Z', last_verified_at: null, payer_total_fen: null, paid_at: null, version: '1', allowed_actions: [{ action_code: 'INVOKE_PAYMENT', allowed: true }, { action_code: 'QUERY_PAYMENT', allowed: true }], blockers: [], ...patch };
}
test.each([
    ['order', { order_id: 'another-order' }], ['purpose', { purpose: 'SUPPLEMENT' }],
    ['amount', { amount_fen: '1' }], ['currency', { currency: 'USD' }],
    ['expired', { expires_at: '2000-01-01T00:00:00Z' }], ['invalid expiry', { expires_at: 'invalid' }],
    ['unknown', { status: 'UNKNOWN' }], ['succeeded', { status: 'SUCCEEDED' }],
    ['closed', { status: 'CLOSED_UNPAID' }], ['confirmed failed', { status: 'FAILED_CONFIRMED' }],
])('payment never invokes a mismatched or ineligible record: %s', async (_label, patch) => {
    mocks.createPayment.mockReturnValue(response(paymentValue(patch as Record<string, unknown>)));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL');
    expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('an existing payment response cannot substitute another payment id', async () => {
    const value = order(); Object.assign(value.bill, paymentReferences(paymentValue())); mocks.get.mockReturnValue(response(value));
    mocks.payment.mockReturnValue(response(paymentValue({ payment_id: 'replacement' })));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL');
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test.each(['2000-01-01T00:00:00Z', 'invalid'])('expired or invalid invocation is not handed to WeChat: %s', async expires_at => {
    mocks.createPayment.mockReturnValue(response(paymentValue()));
    mocks.invocation.mockReturnValue(response({ payment_id: 'p1', app_id: 'fixture', expires_at, time_stamp: '1', nonce_str: 'n', package: 'prepay_id=x', sign_type: 'RSA', pay_sign: 'signature' }));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL'); expect(payment).not.toHaveBeenCalled();
});
test('a mismatched initial reference is rejected without selecting a replacement', async () => {
    const value = order(); Object.assign(value.bill, paymentReferences(paymentValue({ purpose: 'SUPPLEMENT' }))); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL');
    expect(mocks.payment).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('query isolates initial payment from supplement and respects server poll interval', async () => {
    const value = order(); value.order.allowed_actions = [{ action_code: 'QUERY_PAYMENT', allowed: true, display_reason: null }];
    Object.assign(value.bill, paymentReferences(paymentValue({ status: 'UNKNOWN' }), paymentValue({ payment_id: 'supplement', purpose: 'SUPPLEMENT' })));
    mocks.get.mockReturnValue(response(value)); mocks.payment.mockReturnValue(response(paymentValue({ status: 'UNKNOWN' })));
    mocks.queryPayment.mockReturnValue(response({ state: 'ACCEPTED', poll_after_seconds: 60 }));
    await load('order-detail'); await call('runAction', 'QUERY_PAYMENT'); await call('runAction', 'QUERY_PAYMENT');
    expect(mocks.payment).toHaveBeenCalledExactlyOnceWith('p1'); expect(mocks.queryPayment).toHaveBeenCalledExactlyOnceWith('p1', '"object:1"');
    expect(payment).not.toHaveBeenCalled();
});
test('query response identity mismatch cannot reconcile a different original transaction', async () => {
    const value = order(); value.order.allowed_actions = [{ action_code: 'QUERY_PAYMENT', allowed: true, display_reason: null }]; Object.assign(value.bill, paymentReferences(paymentValue()));
    mocks.get.mockReturnValue(response(value)); mocks.payment.mockReturnValue(response(paymentValue({ order_id: 'other' })));
    await load('order-detail'); await call('runAction', 'QUERY_PAYMENT'); expect(mocks.queryPayment).not.toHaveBeenCalled();
});
test('initial and supplement records can each be explicitly queried without querying the other', async () => {
    const value = order(); Object.assign(value.order, { stage: 'ACTIVE', display_status_code: 'AWAITING_SUPPLEMENT', allowed_actions: [{ action_code: 'QUERY_PAYMENT', allowed: true, target: 'p1' }] });
    Object.assign(value.bill, { supplement_due_fen: '100', ...paymentReferences(paymentValue({ status: 'SUCCEEDED' }), paymentValue({ payment_id: 'supplement', purpose: 'SUPPLEMENT', amount_fen: '100' })) });
    mocks.get.mockReturnValue(response(value)); mocks.payment.mockImplementation((id: string) => response([value.bill.initial_payment, value.bill.supplement?.active_payment].find(p => p?.payment_id === id)));
    await load('order-detail'); await call('queryPaymentRecord', { currentTarget: { dataset: { id: 'p1' } } });
    expect(mocks.queryPayment).toHaveBeenCalledExactlyOnceWith('p1', '"object:1"'); mocks.queryPayment.mockClear();
    await call('queryPaymentRecord', { currentTarget: { dataset: { id: 'supplement' } } });
    expect(mocks.queryPayment).toHaveBeenCalledExactlyOnceWith('supplement', '"object:1"'); mocks.queryPayment.mockClear();
    await call('queryPaymentRecord', { currentTarget: { dataset: { id: 'foreign' } } }); expect(mocks.queryPayment).not.toHaveBeenCalled();
    expect(payment).not.toHaveBeenCalled();
});
test('unknown payment hides pay and cancel even when order actions still advertise them', async () => {
    const value = order(); value.order.allowed_actions = ['PAY_INITIAL', 'CANCEL_UNPAID', 'QUERY_PAYMENT'].map(action_code => ({ action_code, allowed: true, display_reason: null }));
    Object.assign(value.bill, paymentReferences(paymentValue({ status: 'UNKNOWN' }))); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); expect(page.data['paymentPage']).toMatchObject({ kind: 'checking', canPay: false, canCancel: false });
    await call('handleAction', { currentTarget: { dataset: { code: 'CANCEL_UNPAID' } } });
    await call('runAction', 'CANCEL_UNPAID'); await call('runAction', 'PAY_INITIAL');
    expect(page.data['cancelDialog']).toBe(false); expect(more.cancel).not.toHaveBeenCalled(); expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('unpaid retry requires verified original prepay and a current deadline', async () => {
    const value = order(); Object.assign(value.bill, paymentReferences(paymentValue({ last_verified_at: '2026-10-06T07:31:00Z' }))); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); expect(page.data['paymentPage']).toMatchObject({ kind: 'retry', canPay: true, amount: '¥110.00', primaryLabel: '继续原支付' });
    value.payment_due_at = '2000-01-01T00:00:00Z'; await call('refreshStatus');
    expect(page.data['paymentPage']).toMatchObject({ kind: 'checking', canPay: false });
    await call('runAction', 'PAY_INITIAL'); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
    expect(page.data['resultPage']).toMatchObject({ kind: '' });
});
test('cancel confirmation continue only closes the dialog; confirmed cancel rereads original order', async () => {
    const value = order(); value.order.allowed_actions.push({ action_code: 'CANCEL_UNPAID', allowed: true, display_reason: null });
    mocks.get.mockReturnValue(response(value)); more.cancel.mockReturnValue(response({ state: 'APPLIED' }));
    await load('order-detail'); const event = { currentTarget: { dataset: { code: 'CANCEL_UNPAID' } } };
    await call('handleAction', event); expect(page.data['cancelDialog']).toBe(true); expect(more.cancel).not.toHaveBeenCalled();
    call('closeCancelDialog'); expect(page.data['cancelDialog']).toBe(false); expect(payment).not.toHaveBeenCalled();
    await call('handleAction', event); mocks.get.mockClear(); await Promise.all([call('confirmCancelOrder'), call('confirmCancelOrder')]);
    expect(more.cancel).toHaveBeenCalledExactlyOnceWith('o1', '"object:1"'); expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1');
    expect(page.data['resultPage']).toMatchObject({ kind: '' });
});
test('unknown cancellation only queries the original order before allowing another explicit action', async () => {
    const value = order(); value.order.allowed_actions.push({ action_code: 'CANCEL_UNPAID', allowed: true, display_reason: null }); mocks.get.mockReturnValue(response(value));
    more.cancel.mockImplementation(() => ({ promise: Promise.reject(new Error('网络中断，结果未知')), abort: vi.fn() }));
    await load('order-detail'); await call('runAction', 'CANCEL_UNPAID');
    expect(page.data).toMatchObject({ paymentUnknown: true, paymentPage: { kind: 'checking', canPay: false, canCancel: false } });
    await call('runAction', 'PAY_INITIAL'); await call('runAction', 'CANCEL_UNPAID');
    expect(more.cancel).toHaveBeenCalledTimes(1); expect(mocks.createPayment).not.toHaveBeenCalled();
    mocks.get.mockReturnValue(response(closedOrder('CANCELLED_UNPAID'))); mocks.get.mockClear();
    await call('paymentPrimary'); expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1');
    expect(page.data).toMatchObject({ paymentUnknown: false, resultPage: { unpaidClosed: true } }); expect(more.cancel).toHaveBeenCalledTimes(1);
});
test.each(['hide', 'account', 'read'])('cancel dialog cannot outlive original order ownership: %s', async change => {
    const value = order(); value.order.allowed_actions.push({ action_code: 'CANCEL_UNPAID', allowed: true, display_reason: null });
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'CANCEL_UNPAID' } } });
    if (change === 'hide') call('onHide');
    else if (change === 'account') mocks.owner = 'other';
    else await call('refreshStatus');
    await call('confirmCancelOrder'); expect(more.cancel).not.toHaveBeenCalled();
});
test.each([
    ['PAYMENT_EXPIRED', '超过支付期限'], ['CANCELLED_UNPAID', '已取消未支付订单'], ['PAYMENT_CLOSED_UNPAID', '原支付已关闭且未付款'],
])('unpaid close reason is read from the server: %s', async (reason, label) => {
    mocks.get.mockReturnValue(response(closedOrder(reason))); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ unpaidClosed: true, title: '订单已关闭', payment: '未完成支付', reason: '关闭原因：' + label });
    expect(page.data['paymentPage']).toBe(null); expect(page.data['depositSettlementVisible']).toBe(false); expect(page.data['refundRecordVisible']).toBe(false);
});
const ownAddress = () => ({ address_id: 'own-address', dataset_id: 'dataset-1', province_id: 'p', province_name: '广东省', city_id: 'c', city_name: '深圳市', district_id: 'd', district_name: '南山区', detail_address: '科技园1号', recipient_name: '出租人', phone_country_code: '+86', phone: '13800000000', is_default: false, location: null, status: 'ACTIVE', version: '1', allowed_actions: [{ code: 'UPDATE', enabled: true }] });
function paymentReferences(initial: object | null = null, supplement: object | null = null) {
    const normalize = (record: object | null) => record ? Object.assign(record, { payment_mode: 'NORMAL', business_amount_fen: (record as { amount_fen?: string }).amount_fen, channel_amount_fen: (record as { amount_fen?: string }).amount_fen, ...record }) as ReturnType<typeof paymentValue> : null;
    const p = normalize(initial), extra = normalize(supplement);
    return { initial_payment: p, supplement: extra ? { supplement_id: 'supplement-bill', amount_fen: extra.business_amount_fen, status: extra.status === 'SUCCEEDED' ? 'PAID' : 'UNPAID', active_payment: extra as ReturnType<typeof paymentValue> | null, paid_payment: extra.status === 'SUCCEEDED' ? extra : null } : null };
}
function refundReference(refund: object | null) {
    const r = refund as ReturnType<typeof depositRefund> | null;
    return { refund_summary: { latest_refund: r, obligation_fen: r?.amount_fen ?? '0', refunded_fen: r?.status === 'SUCCEEDED' ? r.amount_fen : '0', pending_fen: r && r.status !== 'SUCCEEDED' ? r.amount_fen : '0', open_obligation_count: r && r.status !== 'SUCCEEDED' ? 1 : 0 } };
}
const emptyFunds = () => ({ currency: 'CNY', gross_received_fen: '0', refunded_fen: '0', net_received_fen: '0', payer_total_fen: null as string | null, payer_refund_fen: null as string | null, payer_net_fen: null as string | null, excess_received_fen: '0' });
function order() { return { server_time: new Date().toISOString(), order: { payment_mode: 'NORMAL', order_id: 'o1', asset: { title: '相机', cover_media: null }, order_no: 'N1', viewer_role: 'TENANT', display_status: '待支付', display_status_code: 'AWAITING_PAYMENT', stage: 'AWAITING_PAYMENT', physical_status: 'NOT_DELIVERED', review_status: 'NONE', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z', initial_payer_total_fen: null, allowed_actions: [{ action_code: 'PAY_INITIAL', allowed: true, display_reason: null }], blockers: [], has_exception: false, exception_codes: [] }, payment_due_at: '2999-10-06T07:39:00Z', fees: { rent_gross_fen: '1000', deposit_due_fen: '10000', initial_due_fen: '11000' }, bill: { payment_mode: 'NORMAL', funds_summary: emptyFunds(), ...paymentReferences(null), ...refundReference(null), finalized: false, overtime_fen: null, loss_fen: null, refund_due_fen: null, deposit_refunded_fen: '0', supplement_due_fen: null }, delivery: { method: 'EXPRESS', recipient: null, tracking_no: null, carrier: null, delivered_at: null }, requirements: { return_instructions: '照片视频均需拍摄', media: { photo_min: 1, photo_max: 3, video_min: 1, video_max: 1 } }, return_id: 'return-1', latest_cabinet_tasks: [] }; }

function depositRefund(patch: Record<string, unknown> = {}) {
    return { payment_mode: 'NORMAL', business_amount_fen: String(patch.amount_fen ?? '24000'), channel_amount_fen: String(patch.amount_fen ?? '24000'), obligation_id: 'refund-duty', original_payment_id: 'p1', excess_component_fen: '0', refund_id: 'refund-1', order_id: 'o1', purpose: 'DEPOSIT', status: 'UNKNOWN', amount_fen: '24000', currency: 'CNY', payer_refund_fen: null,
        refunded_at: null, last_verified_at: null, blockers: [], allowed_actions: [{ action_code: 'QUERY_REFUND', allowed: true }], ...patch };
}
function settlementOrder(kind: 'refund' | 'supplement' = 'refund') {
    const value = order();
    Object.assign(value.order, { stage: 'ACTIVE', physical_status: 'RECEIVED', review_status: 'FINAL', display_status_code: kind === 'refund' ? 'REFUND_PROCESSING' : 'AWAITING_SUPPLEMENT', supply_channel: 'PERSONAL',
        allowed_actions: ['QUERY_REFUND', 'QUERY_PAYMENT', 'PAY_SUPPLEMENT'].map(action_code => ({ action_code, allowed: true, display_reason: null })) });
    Object.assign(value.bill, { finalized: true, overtime_fen: '6000', loss_fen: kind === 'refund' ? '20000' : '64000', deposit_received_fen: '50000', deducted_fen: kind === 'refund' ? '26000' : '50000',
        refund_due_fen: kind === 'refund' ? '24000' : '0', supplement_due_fen: kind === 'refund' ? '0' : '20000',
        ...paymentReferences(paymentValue({ status: 'SUCCEEDED' })), ...refundReference(kind === 'refund' ? depositRefund() : null)});
    if (kind === 'supplement') value.bill.supplement = { supplement_id: 'supplement-bill', status: 'UNPAID', amount_fen: '20000', active_payment: null, paid_payment: null };
    return value;
}
test.each([{ refund_id: 'other' }, { order_id: 'other' }, { purpose: 'OBSERVED_NONFULFILLMENT' }, { amount_fen: '1' }, { currency: 'USD' }])('refund query rejects a changed original transaction: %j', async patch => {
    mocks.get.mockReturnValue(response(settlementOrder())); more.refund.mockReturnValue(response(depositRefund(patch))); more.queryRefund.mockReturnValue(response({ state: 'ACCEPTED' }));
    await load('order-detail'); await call('runAction', 'QUERY_REFUND');
    expect(more.queryRefund).not.toHaveBeenCalled();
});
test('refund query requires permission on the original refund as well as the order', async () => {
    const value = settlementOrder(); Object.assign(value.bill, { ...refundReference(depositRefund({ allowed_actions: [] }))});
    mocks.get.mockReturnValue(response(value)); more.refund.mockReturnValue(response(depositRefund())); more.queryRefund.mockReturnValue(response({ state: 'ACCEPTED' }));
    await load('order-detail'); await call('runAction', 'QUERY_REFUND'); expect(more.queryRefund).not.toHaveBeenCalled();
});
test.each([
    ['PROCESSING', 'G1', false, false], ['UNKNOWN', 'G2a', true, false], ['FAILED_CONFIRMED', 'G2b', true, true],
])('final refund %s uses its distinct R4 state without changing the due amount', async (status, code, compact, failed) => {
    const value = settlementOrder(); Object.assign(value.bill, { ...refundReference(depositRefund({ status }))}); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); expect(page.data['settlementPage']).toMatchObject({ code, compact, failed, canPay: false, amount: '¥240.00', canQuery: true,
        rows: [{ label: '已收押金', value: '¥500.00' }, { label: '逾期费', value: '¥60.00' }, { label: '损失费用', value: '¥200.00' }, { label: '押金抵扣', value: '¥260.00' }] });
    expect(page.data['settlementPage']).not.toHaveProperty('refundCash', '¥240.00');
});
test('refund primary queries only the original verified transaction and rereads the order', async () => {
    mocks.get.mockReturnValue(response(settlementOrder())); more.refund.mockReturnValue(response(depositRefund())); more.queryRefund.mockReturnValue(response({ state: 'ACCEPTED' }));
    await load('order-detail'); mocks.get.mockClear(); await Promise.all([call('settlementPrimary'), call('settlementPrimary')]);
    expect(more.refund).toHaveBeenCalledExactlyOnceWith('refund-1'); expect(more.queryRefund).toHaveBeenCalledExactlyOnceWith('refund-1', '"object:1"');
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1'); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test.each(['AWAITING_PAYMENT', 'UNRETURNED', 'REVIEW_PENDING', 'LESSOR', 'COMPLETED', 'EXCEPTION'])('settlement layout rejects non-final or other audience state %s', async condition => {
    const value = settlementOrder();
    if (['AWAITING_PAYMENT', 'COMPLETED'].includes(condition)) value.order.stage = condition;
    else if (condition === 'UNRETURNED') value.order.physical_status = 'RETURN_IN_TRANSIT';
    else if (condition === 'REVIEW_PENDING') value.order.review_status = 'REVIEW_PENDING';
    else if (condition === 'LESSOR') value.order.viewer_role = 'LESSOR';
    else value.order.has_exception = true;
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data['settlementPage']).toBeNull();
});
test('supplement ready renders final costs and deposit as funding, not an extra expense', async () => {
    mocks.get.mockReturnValue(response(settlementOrder('supplement'))); await load('order-detail');
    expect(page.data['settlementPage']).toMatchObject({ code: 'H1', amount: '¥200.00', canPay: true,
        rows: [{ label: '逾期费', value: '¥60.00' }, { label: '损失费用', value: '¥640.00' }, { label: '归还费用合计', value: '¥700.00' }, { label: '已由押金抵扣', value: '¥500.00' }] });
});
test.each(['UNKNOWN', 'PROCESSING'])('uninvokable supplement %s exposes only original query even when the order still allows payment', async status => {
    const value = settlementOrder('supplement'); const supplement = paymentValue({ payment_id: 'supplement-1', purpose: 'SUPPLEMENT', amount_fen: '20000', status, allowed_actions: [{ action_code: 'QUERY_PAYMENT', allowed: true }] });
    Object.assign(value.bill, { ...paymentReferences(value.bill.initial_payment, supplement) }); mocks.get.mockReturnValue(response(value)); mocks.payment.mockReturnValue(response(supplement));
    await load('order-detail'); expect(page.data['settlementPage']).toMatchObject({ code: 'H2', canPay: false, canQuery: true, paymentId: 'supplement-1' });
    await call('settlementPrimary'); expect(mocks.payment).toHaveBeenCalledExactlyOnceWith('supplement-1'); expect(mocks.queryPayment).toHaveBeenCalledExactlyOnceWith('supplement-1', '"object:1"');
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('supplement expiry requires a verified unpaid terminal record; client time alone cannot prove unpaid', async () => {
    const value = settlementOrder('supplement'); const supplement = paymentValue({ payment_id: 'supplement-1', purpose: 'SUPPLEMENT', amount_fen: '20000', status: 'UNKNOWN', expires_at: '2000-01-01T00:00:00Z', last_verified_at: '2026-10-09T06:30:00Z' });
    Object.assign(value.bill, { ...paymentReferences(value.bill.initial_payment, supplement) }); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['settlementPage']).toMatchObject({ code: 'H2', canPay: false });
    supplement.status = 'CLOSED_UNPAID'; await call('refreshStatus'); expect(page.data['settlementPage']).toMatchObject({ code: 'H3', canPay: false, failed: true });
    supplement.last_verified_at = null; await call('refreshStatus'); expect(page.data['settlementPage']).toMatchObject({ code: 'H2', canPay: false });
});
test('an unknown supplement creation immediately removes payment and does not replay on repeated taps', async () => {
    mocks.get.mockReturnValue(response(settlementOrder('supplement'))); mocks.createPayment.mockReturnValue({ promise: Promise.reject(new Error('网络中断')), abort: vi.fn() });
    await load('order-detail'); await call('settlementPrimary'); expect(page.data).toMatchObject({ paymentUnknown: true, settlementPage: { code: 'H2', canPay: false } });
    await call('runAction', 'PAY_SUPPLEMENT'); expect(mocks.createPayment).toHaveBeenCalledTimes(1); expect(payment).not.toHaveBeenCalled();
});
test('settlement rejects a mismatched refund projection and clears amounts when the account changes', async () => {
    const value = settlementOrder(); Object.assign(value.bill, { ...refundReference(depositRefund({ order_id: 'foreign' }))}); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['settlementPage']).toMatchObject({ code: 'G2a', canQuery: false, canPay: false });
    mocks.owner = 'other-user'; await call('settlementPrimary'); expect(more.queryRefund).not.toHaveBeenCalled();
    call('onHide'); expect(page.data['settlementPage']).toBeNull();
});

function completedOrder(code: 'G3' | 'G4' | 'H4' | 'H5') {
    const value = settlementOrder(code === 'H4' ? 'supplement' : 'refund');
    Object.assign(value.order, { stage: code === 'H5' ? 'CLOSED' : 'COMPLETED', display_status_code: code === 'H5' ? 'CLOSED' : 'COMPLETED',
        physical_status: code === 'H5' ? 'NOT_DELIVERED' : 'RECEIVED', review_status: code === 'H5' ? 'NONE' : 'FINAL', initial_payer_total_fen: '68000',
        allowed_actions: [{ action_code: 'VIEW_CONTRACT', allowed: true, display_reason: null }] });
    Object.assign(value, { close_reason: code === 'H5' ? 'EXTERNAL_NONFULFILLMENT' : null, contract_id: 'contract-1', return_id: code === 'H5' ? null : 'return-1' });
    Object.assign(value.fees, { rent_gross_fen: '18000', rent_discount_fen: '0', deposit_due_fen: '50000', initial_due_fen: '68000' });
    Object.assign(value.bill, { ...paymentReferences(paymentValue({ status: 'SUCCEEDED', amount_fen: '68000', payer_total_fen: '68000' })),
        refund_due_fen: code === 'G3' ? '24000' : '0', deposit_refunded_fen: code === 'G3' ? '24000' : '0',
        ...refundReference(code === 'G3' || code === 'H5' ? depositRefund({ status: 'SUCCEEDED', purpose: code === 'H5' ? 'OBSERVED_NONFULFILLMENT' : 'DEPOSIT', amount_fen: code === 'H5' ? '68000' : '24000', payer_refund_fen: code === 'H5' ? '68000' : '24000', refunded_at: '2026-10-09T06:20:00Z' }) : null),
        supplement_due_fen: code === 'H4' ? '20000' : '0', loss_fen: code === 'G3' ? '20000' : code === 'H4' ? '64000' : '44000', deducted_fen: code === 'G3' ? '26000' : '50000' });
    if (code === 'H4') Object.assign(value.bill, { ...paymentReferences(value.bill.initial_payment, paymentValue({ payment_id: 'supplement-1', purpose: 'SUPPLEMENT', status: 'SUCCEEDED', amount_fen: '20000', payer_total_fen: '20000' })) });
    Object.assign(value.bill.funds_summary, { gross_received_fen: code === 'H4' ? '88000' : '68000', refunded_fen: code === 'G3' ? '24000' : code === 'H5' ? '68000' : '0', payer_total_fen: code === 'H4' ? '88000' : '68000', payer_refund_fen: code === 'G3' ? '24000' : code === 'H5' ? '68000' : '0', payer_net_fen: code === 'G3' ? '44000' : code === 'H5' ? '0' : code === 'H4' ? '88000' : '68000' });
    if (code === 'H5') Object.assign(value.bill, { finalized: false, refund_due_fen: null, supplement_due_fen: null });
    return value;
}
test.each([['G3', '¥440.00'], ['G4', '¥680.00'], ['H4', '¥880.00'], ['H5', '¥0.00']] as const)('completed result %s uses verified cash without counting deposit deductions twice', async (code, amount) => {
    mocks.get.mockReturnValue(response(completedOrder(code))); await load('order-detail');
    expect(page.data['completionPage']).toMatchObject({ code, amount, known: true, transactionsVerified: true, closed: code === 'H5', title: code === 'H5' ? '已退款，订单关闭' : '订单已完成' });
    expect(page.data['settlementPage']).toBeNull(); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('completed amount uses actual channel cash while displaying contract rent separately', async () => {
    const value = completedOrder('G3'); Object.assign(value.order, { initial_payer_total_fen: '67000' });
    Object.assign(value.bill.initial_payment!, { payer_total_fen: '67000' }); Object.assign(value.bill.refund_summary.latest_refund!, { payer_refund_fen: '23500' }); value.bill.funds_summary.payer_net_fen = '43500';
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['completionPage']).toMatchObject({ amount: '¥435.00', feeRows: [{ label: '租金', value: '¥180.00' }, { label: '逾期费', value: '¥60.00' }, { label: '损失费用', value: '¥200.00' }] });
});
test('completed order preserves its stage but withholds final cash when the successful refund cash component is unknown', async () => {
    const value = completedOrder('G3'); Object.assign(value.bill.refund_summary.latest_refund!, { payer_refund_fen: null }); value.bill.funds_summary.payer_net_fen = null; mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['completionPage']).toMatchObject({ title: '订单已完成', transactionsVerified: true, known: false, amount: '' });
    expect((page.data['completionPage'] as {cashNote:string}).cashNote).toContain('尚未核实');
});
test('missing supplement success cannot render completed funds or a final expense', async () => {
    const value = completedOrder('H4'); value.bill.supplement!.status = 'UNPAID'; value.bill.supplement!.paid_payment = null; mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['completionPage']).toMatchObject({ title: '结算记录待核实', transactionsVerified: false, known: false, amount: '' });
});
test('completion return link opens only the read-back original return and creates no business command', async () => {
    mocks.get.mockReturnValue(response(completedOrder('G3'))); await load('order-detail'); await call('openCompletedReturn');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1' }));
    expect(detail.startReturn).not.toHaveBeenCalled(); expect(mocks.saveReturnEvidence).not.toHaveBeenCalled();
    vi.mocked(wx.navigateTo).mockClear(); mocks.owner = 'other-user'; await call('openCompletedReturn'); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('unavailable original return cannot navigate through a completed-order shortcut', async () => {
    mocks.get.mockReturnValue(response(completedOrder('G3'))); mocks.return.mockReturnValue(response({ ...returnValue(null), return_id: 'other-return' }));
    await load('order-detail'); await call('openCompletedReturn'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page.data['errorText']).toContain('尚未核实');
});
test('refunded nonfulfillment keeps read-only payment records on page and browses other devices without reordering', async () => {
    mocks.get.mockReturnValue(response(completedOrder('H5'))); await load('order-detail');
    await call('toggleCompletionRecords'); expect(page.data['completionRecordsExpanded']).toBe(true); expect(wx.navigateTo).not.toHaveBeenCalled();
    await call('toggleCompletionRecords'); expect(page.data['completionRecordsExpanded']).toBe(false);
    await call('browseOtherDevices'); expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/home/index' }));
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
    call('onHide'); expect(page.data).toMatchObject({ completionPage: null, completionRecordsExpanded: false });
});
function returnValue(submitted: string | null) { return { return_id: 'return-1', order_id: 'o1', method: 'EXPRESS', address_version: '1', address: null, tracking_no: null, carrier: null, material_status: 'INCOMPLETE', submitted_at: submitted, received_at: null, evidence: [], blockers: [], allowed_actions: [{ action_code: submitted ? 'SUPPLEMENT_EVIDENCE' : 'SUBMIT_RETURN', allowed: true, display_reason: null }] }; }
function nonfulfillmentOrder() {
    const value = completedOrder('H5');
    Object.assign(value.order, { stage: 'ACTIVE', display_status_code: 'AWAITING_DELIVERY', allowed_actions: [{ action_code: 'QUERY_REFUND', allowed: true, display_reason: null }] });
    Object.assign(value, { close_reason: null, closed_at: null });
    Object.assign(value.bill.refund_summary.latest_refund!, { status: 'PROCESSING', refunded_at: null, payer_refund_fen: null });
    return value;
}
test.each(['CREATED', 'PROCESSING', 'UNKNOWN', 'FAILED_CONFIRMED', 'SUCCEEDED'])('nonfulfillment refund %s does not close an active order or expose return deductions', async status => {
    const value = nonfulfillmentOrder(); Object.assign(value.bill.refund_summary.latest_refund!, { status }); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ nonfulfillmentPage: { code: 'K2', knownCash: true, paid: '¥680.00' }, deliveryPage: null, pickupPage: null, completionPage: null, resultPage: null, depositSettlementVisible: false });
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(more.queryRefund).not.toHaveBeenCalled();
});
test.each([null, '-1', 'bad', '68001'])('unverified nonfulfillment cash %s is not replaced by face value', async cash => {
    const value = nonfulfillmentOrder(); Object.assign(value.bill.initial_payment!, { payer_total_fen: cash }); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['nonfulfillmentPage']).toMatchObject({ paid: '现金金额待核实', knownCash: false });
});
test('nonfulfillment cash comes from the verified original payment, including a channel discount', async () => {
    const value = nonfulfillmentOrder(); Object.assign(value.order, { initial_payer_total_fen: '67000' }); Object.assign(value.bill.initial_payment!, { payer_total_fen: '67000' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data['nonfulfillmentPage']).toMatchObject({ paid: '¥670.00', knownCash: true });
});
test.each(['wrong-refund-order', 'deposit', 'wrong-payment-order', 'unpaid', 'wrong-original', 'currency', 'delivered', 'lessor', 'no-refund'])('nonfulfillment rejects %s instead of inferring a case from exception text', async invalid => {
    const value = nonfulfillmentOrder();
    Object.assign(value.order, { has_exception: true, exception_codes: ['OBSERVED_NONFULFILLMENT'] });
    if (invalid === 'wrong-refund-order') Object.assign(value.bill.refund_summary.latest_refund!, { order_id: 'foreign' });
    if (invalid === 'deposit') Object.assign(value.bill.refund_summary.latest_refund!, { purpose: 'DEPOSIT' });
    if (invalid === 'partial') Object.assign(value.bill.refund_summary.latest_refund!, { amount_fen: '1' });
    if (invalid === 'wrong-payment-order') Object.assign(value.bill.initial_payment!, { order_id: 'foreign' });
    if (invalid === 'unpaid') Object.assign(value.bill.initial_payment!, { status: 'UNKNOWN' });
    if (invalid === 'wrong-original') value.bill.refund_summary.latest_refund!.original_payment_id = 'other';
    if (invalid === 'currency') Object.assign(value.bill.refund_summary.latest_refund!, { currency: 'USD' });
    if (invalid === 'delivered') Object.assign(value.order, { physical_status: 'IN_USE' });
    if (invalid === 'lessor') value.order.viewer_role = 'LESSOR';
    if (invalid === 'no-refund') Object.assign(value.bill, { ...refundReference(null)});
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data['nonfulfillmentPage']).toBeNull();
    await call('queryNonfulfillment'); expect(more.queryRefund).not.toHaveBeenCalled();
});
test('nonfulfillment queries the original refund once and displays closure only after authoritative order readback', async () => {
    const value = nonfulfillmentOrder(); mocks.get.mockReturnValue(response(value)); more.refund.mockReturnValue(response(value.bill.refund_summary.latest_refund)); more.queryRefund.mockReturnValue(response({ state: 'ACCEPTED' }));
    await load('order-detail'); mocks.get.mockReturnValue(response(completedOrder('H5'))); mocks.get.mockClear();
    await Promise.all([call('queryNonfulfillment'), call('queryNonfulfillment')]);
    expect(more.refund).toHaveBeenCalledExactlyOnceWith('refund-1'); expect(more.queryRefund).toHaveBeenCalledExactlyOnceWith('refund-1', '"object:1"');
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1'); expect(page.data['nonfulfillmentPage']).toBeNull(); expect(page.data['completionPage']).toMatchObject({ code: 'H5', transactionsVerified: true });
});
test('nonfulfillment without query permission can only reread the original order', async () => {
    const value = nonfulfillmentOrder(); Object.assign(value.bill.refund_summary.latest_refund!, { allowed_actions: [] }); mocks.get.mockReturnValue(response(value)); await load('order-detail'); mocks.get.mockClear();
    await call('queryNonfulfillment'); expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1'); expect(more.refund).not.toHaveBeenCalled(); expect(more.queryRefund).not.toHaveBeenCalled();
    expect(page.data['nonfulfillmentPage']).toMatchObject({ code: 'K2', canQuery: false });
});
test('nonfulfillment cannot query after account change and its private display clears on hide', async () => {
    mocks.get.mockReturnValue(response(nonfulfillmentOrder())); await load('order-detail'); mocks.owner = 'other'; await call('queryNonfulfillment'); expect(more.queryRefund).not.toHaveBeenCalled();
    call('onHide'); expect(page.data['nonfulfillmentPage']).toBeNull();
});

function dispatchFixture(role = 'TENANT', physical = 'RETURN_PENDING') {
    const value = personalOrder(role, physical);
    Object.assign(value, { return_id: 'return-1' });
    value.order.allowed_actions = [{ action_code: 'SAVE_RETURN_EVIDENCE', allowed: true, display_reason: null }];
    const record = { ...returnValue('2026-10-10T01:00:00Z'), shipped_at: '2026-10-10T02:00:00Z', material_status: 'COMPLETE',
        address: { region_ids: ['p', 'c', 'd'], source_id: 'lessor-address', recipient_name: '李四', country_code: '+86', phone: '13800000001', region_text: '浙江省杭州市西湖区', detail: '月光路6号2幢201室' },
        tracking_no: 'RETURN-001', carrier: '顺丰', allowed_actions: ['SHIP_RETURN', 'CORRECT_RETURN_SHIPMENT', 'CONFIRM_RECEIPT'].map(action_code => ({ action_code, allowed: true, display_reason: null })) };
    mocks.get.mockReturnValue(response(value)); mocks.return.mockReturnValue(response(record));
    return { value, record };
}

test('F1b shows complete current address and copying never confirms it', async () => {
    dispatchFixture(); await load('order-detail');
    expect(page.data).toMatchObject({ returnDispatchPage: { code: 'F1b', canReturn: true, overdue: false, title: '请按指引寄回', address: { person: '李四', phone: '+86 13800000001', region: '浙江省杭州市西湖区', detail: '月光路6号2幢201室' } }, returnAddressChecked: false, deliveryPage: null });
    call('copyReturnAddress'); expect(wx.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: '李四 +86 13800000001 浙江省杭州市西湖区 月光路6号2幢201室' }));
    await call('returnDispatchPrimary'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page.data['returnAddressChecked']).toBe(false);
});

test.each(['version', 'content'])('address %s change clears F1b acknowledgment and stops navigation', async change => {
    const { record } = dispatchFixture(); await load('order-detail'); call('toggleReturnAddress');
    if (change === 'version') record.address_version = '2'; else record.address.detail = '新的归还地址';
    await call('returnDispatchPrimary'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page.data['returnAddressChecked']).toBe(false); expect(page.data['errorText']).toContain('重新核对');
    call('toggleReturnAddress'); await call('returnDispatchPrimary'); expect(wx.navigateTo).toHaveBeenCalledOnce();
});

test('F1b rereads and transfers its exact checkbox once without creating a return', async () => {
    const { record } = dispatchFixture(); await load('order-detail'); call('toggleReturnAddress'); mocks.get.mockClear(); mocks.return.mockClear();
    await Promise.all([call('returnDispatchPrimary'), call('returnDispatchPrimary')]);
    expect(mocks.get).toHaveBeenCalledOnce(); expect(mocks.return).toHaveBeenCalledOnce(); expect(wx.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&addressVersion=1' }));
    const { returnAddressSnapshot } = await import('../miniprogram/shared/presentation/rental-return-dispatch');
    const { takeReturnAddressConfirmation } = await import('../miniprogram/shared/interaction/return-address-confirmation');
    const snapshot = returnAddressSnapshot(record);
    expect(takeReturnAddressConfirmation('tenant', 'o1', snapshot, '1')).toBe(true);
    expect(takeReturnAddressConfirmation('tenant', 'o1', snapshot, '1')).toBe(false);
    expect(detail.startReturn).not.toHaveBeenCalled(); expect(mocks.receipt).not.toHaveBeenCalled();
});

test('failed F1b navigation discards the checkbox handoff', async () => {
    const { record } = dispatchFixture(); await load('order-detail'); call('toggleReturnAddress');
    vi.mocked(wx.navigateTo).mockImplementationOnce(options => { options.fail?.({ errMsg: 'failed' }); return Promise.resolve({ errMsg: 'failed' }); });
    await call('returnDispatchPrimary');
    const { returnAddressSnapshot } = await import('../miniprogram/shared/presentation/rental-return-dispatch');
    const { takeReturnAddressConfirmation } = await import('../miniprogram/shared/interaction/return-address-confirmation');
    expect(takeReturnAddressConfirmation('tenant', 'o1', returnAddressSnapshot(record), '1')).toBe(false);
});

test.each(['hide', 'account', 'permission'])('dispatch cannot outlive original %s', async reason => {
    const { value, record } = dispatchFixture(); await load('order-detail'); call('toggleReturnAddress');
    if (reason === 'hide') call('onHide'); else if (reason === 'account') mocks.owner = 'other'; else { value.order.allowed_actions = []; record.allowed_actions = []; }
    await call('returnDispatchPrimary'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(mocks.returnShipment).not.toHaveBeenCalled();
});

test('F1c only refreshes until an actual address is supplied', async () => {
    const { record } = dispatchFixture(); mocks.return.mockReturnValue(response({ ...record, address: null, address_version: '0' }));
    await load('order-detail'); expect(page.data['returnDispatchPage']).toMatchObject({ code: 'F1c', canReturn: false, address: null });
    await call('returnDispatchPrimary'); expect(page.data['returnDispatchPage']).toMatchObject({ code: 'F1c' }); expect(wx.navigateTo).not.toHaveBeenCalled();
    mocks.return.mockReturnValue(response(record)); await call('returnDispatchPrimary');
    expect(page.data).toMatchObject({ returnDispatchPage: { code: 'F1b' }, returnAddressChecked: false }); expect(detail.startReturn).not.toHaveBeenCalled();
});
test('personal in-term return guide checks address before opening evidence and resumes after exact address acknowledgment', async () => {
    const { value, record } = dispatchFixture(); value.order.physical_status = 'IN_USE'; value.order.rental_end_at = '2999-10-10T00:00:00Z';
    value.order.allowed_actions = [{ action_code: 'SAVE_RETURN_EVIDENCE', allowed: true, display_reason: null }];
    mocks.return.mockReturnValue(response({ ...record, address: null, address_version: '0' }));
    await load('order-detail'); expect(page.data['returnDispatchPage']).toBeNull();
    await call('handleAction', { currentTarget: { dataset: { code: 'SAVE_RETURN_EVIDENCE' } } });
    expect(page.data['returnDispatchPage']).toMatchObject({ code: 'F1c', overdue: false, canReturn: false });
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(detail.startReturn).not.toHaveBeenCalled();
    mocks.return.mockReturnValue(response(record)); await call('returnDispatchPrimary');
    expect(page.data).toMatchObject({ returnDispatchPage: { code: 'F1b', overdue: false }, returnAddressChecked: false });
    call('toggleReturnAddress'); await call('returnDispatchPrimary');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&addressVersion=1' }));
    expect(value.order.physical_status).toBe('IN_USE'); expect(mocks.saveReturnEvidence).not.toHaveBeenCalled();
});

test('failed return read clears the previously visible full address and cannot navigate', async () => {
    dispatchFixture(); await load('order-detail'); call('toggleReturnAddress');
    mocks.return.mockImplementation(() => ({ promise: Promise.reject(new Error('地址读取失败')), abort: vi.fn() }));
    await call('returnDispatchPrimary'); expect(page.data).toMatchObject({ returnDispatchPage: null, returnAddress: '', returnVersion: '', returnAddressChecked: false }); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('official overdue F1e reuses the original return flow without opening a cabinet', async () => {
    const { value, record } = dispatchFixture(); Object.assign(value.order, { supply_channel: 'OFFICIAL_CABINET', physical_status: 'IN_USE', rental_end_at: '2000-01-01T00:00:00Z' });
    value.delivery.method = 'CABINET'; record.method = 'CABINET';
    await load('order-detail'); expect(page.data).toMatchObject({ returnDispatchPage: { code: 'F1e', canReturn: true, overdue: true }, returnLanding: false });
    await call('returnDispatchPrimary'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1' })); expect(detail.startReturn).not.toHaveBeenCalled();
});

test('F2 progress is read only while correction has a separate allowed entry', async () => {
    const { record } = dispatchFixture('TENANT', 'RETURN_IN_TRANSIT'); await load('order-detail');
    expect(page.data['returnDispatchPage']).toMatchObject({ code: 'F2', evidenceSaved: true, canCorrect: true }); expect(page.data['depositSettlementVisible']).toBe(false);
    await call('returnDispatchPrimary'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&mode=record' }));
    vi.mocked(wx.navigateTo).mock.calls[0]?.[0].complete?.({ errMsg: 'ok' }); vi.mocked(wx.navigateTo).mockClear();
    call('openDispatchRecord', { currentTarget: { dataset: { mode: 'correction' } } }); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&mode=correction' }));
    record.allowed_actions = []; await call('refreshStatus'); vi.mocked(wx.navigateTo).mockClear(); call('openDispatchRecord', { currentTarget: { dataset: { mode: 'correction' } } }); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('E6 primary opens the original receipt form and never records receipt itself', async () => {
    const { record } = dispatchFixture('LESSOR', 'RETURN_IN_TRANSIT'); await load('order-detail');
    expect(page.data['returnDispatchPage']).toMatchObject({ code: 'E6', canReceive: true });
    await call('returnDispatchPrimary'); expect(page.data).toMatchObject({ returnSheet: 'receipt', receiptDate: '', receiptTime: '' }); expect(mocks.receipt).not.toHaveBeenCalled();
    call('openDispatchRecord'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&mode=record' }));
    record.allowed_actions = []; await call('refreshStatus'); await call('returnDispatchPrimary'); expect(mocks.receipt).not.toHaveBeenCalled();
});

test.each(['wrong-order', 'wrong-return', 'received', 'final', 'exception'])('dispatch rejects inconsistent or ended state %s', async reason => {
    const { value, record } = dispatchFixture('TENANT', 'RETURN_IN_TRANSIT');
    if (reason === 'wrong-order') record.order_id = 'other'; else if (reason === 'wrong-return') record.return_id = 'other';
    else if (reason === 'received') mocks.return.mockReturnValue(response({ ...record, received_at: '2026-10-10T03:00:00Z' }));
    else if (reason === 'final') value.order.review_status = 'FINAL'; else value.order.has_exception = true;
    await load('order-detail'); expect(page.data['returnDispatchPage']).toBeNull(); await call('returnDispatchPrimary'); expect(wx.navigateTo).not.toHaveBeenCalled();
});
function call(name: string, ...args: unknown[]) { return (page[name] as (...v: unknown[]) => unknown).apply(page, args); }

function closedOrder(reason = 'PREPARATION_EXPIRED') {
    const value = order();
    Object.assign(value, { close_reason: reason, closed_at: '2026-10-07T01:00:00Z', hold_expires_at: '2026-10-06T00:00:00Z', coupon_status: null, contract_id: 'c1', return_id: null });
    Object.assign(value.order, { stage: 'CLOSED', display_status_code: 'CLOSED', allowed_actions: [], initial_payer_total_fen: '0' });
    Object.assign(value.order.asset, { asset_id: 'asset&new' });
    more.contract.mockReturnValue(response({ contract_id: 'c1', order_id: 'o1', quota_state: 'NOT_APPLICABLE', quota_valid_until: null }));
    return value;
}
test('preparation close comes from committed reason and reorders using only the asset', async () => {
    mocks.get.mockReturnValue(response(closedOrder())); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ kind: 'closed', preparation: true, title: '签约准备已关闭', payment: '本单未发起支付', canReorder: true });
    call('reorder'); call('reorder');
    expect(wx.navigateTo).toHaveBeenCalledTimes(1);
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/confirm/index?deviceId=asset%26new' }));
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled();
});
test.each(['PREPARING', 'ACTIVE'])('expired local times and a stale close reason do not close %s', async stage => {
    const value = closedOrder(); value.order.stage = stage; value.fees.initial_due_fen = '0';
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ kind: '', canReorder: false });
    call('reorder'); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('zero cash closure shows restored coupon only from its own status and no refund', async () => {
    const value = closedOrder('ZERO_CASH_UNDELIVERED'); value.fees.initial_due_fen = '0'; value.delivery.method = 'CABINET'; Object.assign(value, { coupon_status: 'RESTORED' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ zeroClosed: true, payment: '未发生付款', coupon: '原优惠券已恢复，有效期不变。', credential: '取件凭证已失效，请勿前往取件。' });
    expect(page.data['depositSettlementVisible']).toBe(false); expect(page.data['refundRecordVisible']).toBe(false);
    Object.assign(value, { coupon_status: 'CONSUMED' }); await call('refreshStatus');
    expect(page.data['resultPage']).toMatchObject({ coupon: '优惠券状态待核实' });
});
test.each(['hidden', 'changed-account', 'lessor', 'loading'])('reorder refuses an unavailable owner or snapshot: %s', async reason => {
    const value = closedOrder(); if(reason === 'lessor') value.order.viewer_role = 'LESSOR';
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    if(reason === 'hidden') call('onHide');
    if(reason === 'changed-account') mocks.owner = 'different';
    if(reason === 'loading') page.setData({ loading: true });
    call('reorder'); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('settlement refresh reads authoritative completion and never issues another payment', async () => {
    const value = order(); Object.assign(value, { close_reason: null, return_id: null });
    value.fees.initial_due_fen = '0';
    Object.assign(value.order, { stage: 'ACTIVE', display_status_code: 'SETTLEMENT_CONFIRMING', physical_status: 'RECEIVED', review_status: 'FINAL', allowed_actions: [] });
    Object.assign(value.bill, { finalized: true, refund_due_fen: '0', supplement_due_fen: '0' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ kind: 'settlement', title: '结算确认中', note: '无需再次支付，请稍后查询。', steps: [{ done: true }, { done: true }, { done: true }, { done: true }] });
    call('backToOrders'); expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/orders/index' }));
    Object.assign(value.order, { stage: 'COMPLETED', display_status_code: 'COMPLETED', display_status: '订单完成' });
    await call('refreshStatus'); expect(page.data['resultPage']).toMatchObject({ kind: '' }); expect(page.data['status']).toBe('订单完成');
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
});
test('settlement does not mark unknown amounts or pending payments as settled', async () => {
    const value = order(); Object.assign(value, { close_reason: null, return_id: null });
    Object.assign(value.order, { stage: 'ACTIVE', display_status_code: 'SETTLEMENT_CONFIRMING', physical_status: 'RECEIVED', review_status: 'FINAL', allowed_actions: [] });
    Object.assign(value.bill, { finalized: true }); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['resultPage']).toMatchObject({ note: '请刷新订单状态，核实结算进度。', steps: [{ done: true }, { done: true }, { done: true }, { done: false }] });
    Object.assign(value.bill, { refund_due_fen: '0', supplement_due_fen: '0', ...paymentReferences({ purpose: 'INITIAL', status: 'UNKNOWN', amount_fen: '11000' }) });
    await call('refreshStatus'); expect((page.data['resultPage'] as {steps:{done:boolean}[]}).steps[3]?.done).toBe(false);
});
test('settlement requires the original initial payment or a zero cash order', async () => {
    const value = order(); Object.assign(value, { close_reason: null, return_id: null });
    Object.assign(value.order, { stage: 'ACTIVE', display_status_code: 'SETTLEMENT_CONFIRMING', physical_status: 'RECEIVED', review_status: 'FINAL', allowed_actions: [] });
    Object.assign(value.bill, { finalized: true, refund_due_fen: '0', supplement_due_fen: '0' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect((page.data['resultPage'] as {steps:{done:boolean}[]}).steps[3]?.done).toBe(false);
    Object.assign(value.bill, { ...paymentReferences({ purpose: 'INITIAL', status: 'SUCCEEDED', amount_fen: '11000' }) });
    await call('refreshStatus'); expect((page.data['resultPage'] as {steps:{done:boolean}[]}).steps[3]?.done).toBe(true);
});
async function load(route: string) { vi.stubGlobal('Page', (v: Harness) => definition = v); await import('../miniprogram/pages/' + route + '/index.ts'); page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; call('onLoad', { id: 'o1', orderId: 'o1' }); call('onShow'); await call(route === 'order-detail' ? 'refreshStatus' : 'refresh'); }
function personalOrder(role = 'TENANT', physical = 'NOT_DELIVERED') {
    const value = order();
    Object.assign(value, { contract_id: 'contract-1', return_id: null });
    Object.assign(value.order, { supply_channel: 'PERSONAL', viewer_role: role, stage: 'ACTIVE', physical_status: physical, display_status_code: physical === 'IN_USE' ? 'IN_USE' : 'AWAITING_DELIVERY', rental_start_at: '2026-10-09T16:00:00Z', rental_end_at: '2026-10-12T16:00:00Z', allowed_actions: [] });
    Object.assign(value.requirements, { outbound_freight_payer: 'LESSOR', return_freight_payer: 'TENANT' });
    Object.assign(value.delivery, { recipient: { recipient_name: '收件人', country_code: '+86', phone: '13800000000', region_text: '浙江省杭州市拱墅区', detail: '星光路18号1幢101室' }, shipped_at: physical === 'NOT_DELIVERED' ? null : '2026-10-09T07:00:00Z', delivered_at: physical === 'IN_USE' ? '2026-10-10T02:00:00Z' : null, tracking_no: physical === 'NOT_DELIVERED' ? null : '001ABC' });
    return value;
}
test.each([['TENANT', 'NOT_DELIVERED', '等待出租方发货'], ['TENANT', 'OUTBOUND', '出租方已发货'], ['TENANT', 'IN_USE', '租赁中'], ['LESSOR', 'OUTBOUND', '已发货，等待承租人收货'], ['LESSOR', 'IN_USE', '租赁进行中']])('personal %s %s uses its own state and complete frozen details', async (role, physical, title) => {
    const value = personalOrder(role, physical); mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['deliveryPage']).toMatchObject({ title, term: '2026-10-10 至 2026-10-13 · 共3天', deadline: '2026-10-13 00:00', recipient: { person: '收件人', phone: '+86 13800000000', region: '浙江省杭州市拱墅区', detail: '星光路18号1幢101室' }, outboundFreight: '寄出运费出租方承担', returnFreight: '寄回运费承租人承担' });
    expect(page.data).toMatchObject({ returnLanding: false, depositSettlementVisible: false });
});
test.each(['TENANT', 'OFFICIAL', 'CLOSED', 'OUTBOUND'])('shipment rejects forged SHIP permission in %s context', async reason => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }];
    if (reason === 'TENANT') value.order.viewer_role = 'TENANT'; if (reason === 'OFFICIAL') Object.assign(value.order, { supply_channel: 'OFFICIAL_CABINET' });
    if (reason === 'CLOSED') value.order.stage = 'CLOSED'; if (reason === 'OUTBOUND') value.order.physical_status = 'OUTBOUND';
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } });
    Object.assign(page.data, { trackingInput: 'TRACK123', shipmentSheet: true }); await call('submitShipment'); expect(mocks.ship).not.toHaveBeenCalled();
});
test.each(['LESSOR', 'NOT_DELIVERED', 'OFFICIAL'])('confirm delivery rejects forged permission for %s', async reason => {
    const value = personalOrder('TENANT', 'OUTBOUND'); value.order.allowed_actions = [{ action_code: 'CONFIRM_DELIVERY', allowed: true, display_reason: null }];
    if (reason === 'LESSOR') value.order.viewer_role = 'LESSOR'; if (reason === 'NOT_DELIVERED') value.order.physical_status = 'NOT_DELIVERED'; if (reason === 'OFFICIAL') Object.assign(value.order, { supply_channel: 'OFFICIAL_CABINET' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); await call('runAction', 'CONFIRM_DELIVERY'); expect(more.confirmDelivery).not.toHaveBeenCalled();
});
test('successful receipt rereads this order into personal in-use without navigating to return', async () => {
    const value = personalOrder('TENANT', 'OUTBOUND'); value.order.allowed_actions = [{ action_code: 'CONFIRM_DELIVERY', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); mocks.get.mockReturnValue(response(personalOrder('TENANT', 'IN_USE')));
    await call('runAction', 'CONFIRM_DELIVERY'); expect(more.confirmDelivery).toHaveBeenCalledOnce(); expect(page.data['deliveryPage']).toMatchObject({ kind: 'using', title: '租赁中' }); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('unknown receipt only permits original order query until it is reread', async () => {
    const value = personalOrder('TENANT', 'OUTBOUND'); value.order.allowed_actions = [{ action_code: 'CONFIRM_DELIVERY', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); more.confirmDelivery.mockReturnValue({ promise: Promise.reject(new Error('网络中断')), abort: vi.fn() });
    await load('order-detail'); await call('runAction', 'CONFIRM_DELIVERY'); await call('runAction', 'CONFIRM_DELIVERY');
    expect(more.confirmDelivery).toHaveBeenCalledOnce(); expect(page.data['deliveryUnknown']).toBe(true);
    await call('refreshStatus'); expect(page.data['deliveryUnknown']).toBe(false); expect(more.confirmDelivery).toHaveBeenCalledOnce();
});
test('lessor tenant name comes from the matching signed contract, never the recipient', async () => {
    const value = personalOrder('LESSOR', 'IN_USE'); value.order.allowed_actions = [{ action_code: 'VIEW_CONTRACT', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); more.contract.mockReturnValue(response({ order_id: 'o1', contract_id: 'contract-1', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED', name: '合同承租人' } }));
    await load('order-detail'); expect(page.data['deliveryTenant']).toBe('合同承租人');
    more.contract.mockReturnValue(response({ order_id: 'foreign', contract_id: 'contract-1', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED', name: '其他人' } }));
    await call('refreshStatus'); expect(page.data['deliveryTenant']).toBe(''); expect(page.data['deliveryTenantError']).toContain('不匹配');
    call('onHide'); expect(page.data['deliveryTenant']).toBe(''); expect(page.data['deliveryPage']).toBeNull();
});
test('corrupt shipment recovery stays visible and cannot escape the click handler', async () => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value));
    await load('order-detail'); more.pendingShipment.mockImplementation(() => { throw new Error('原物流请求记录不完整，请联系客服核实'); });
    await expect(call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } })).resolves.toBeUndefined();
    expect(() => call('restoreShipment')).not.toThrow();
    expect(page.data['errorText']).toContain('原物流请求记录不完整'); expect(page.data['shipmentSheet']).toBe(false); expect(mocks.ship).not.toHaveBeenCalled();
});

test('corrupt shipment intent locks existing form without throwing again from error recovery', async () => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value));
    await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } });
    more.pendingShipment.mockImplementation(() => { throw new Error('原物流请求记录不完整，请联系客服核实'); });
    await expect(call('submitShipment')).resolves.toBeUndefined();
    expect(page.data).toMatchObject({ busy: false, shipmentPending: true, shipmentError: '原物流请求记录不完整，请联系客服核实' });
    expect(mocks.ship).not.toHaveBeenCalled(); expect(more.correctShipment).not.toHaveBeenCalled();
});

test('unknown shipment restores locked original inputs and original version after a fresh read', async () => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value));
    await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } });
    Object.assign(page.data, { trackingInput: 'ORIGINAL', carrierInput: '原快递' });
    const pending = { correction: false, body: { tracking_no: 'ORIGINAL', carrier: '原快递' }, etag: '"original:1"' };
    mocks.ship.mockImplementationOnce(() => { more.pendingShipment.mockReturnValue(pending); return { promise: Promise.reject(new Error('结果未知')), abort: vi.fn() }; });
    await call('submitShipment'); expect(page.data['shipmentPending']).toBe(true);
    call('inputShipment', { currentTarget: { dataset: { field: 'trackingInput' } }, detail: { value: 'REPLACEMENT' } }); expect(page.data['trackingInput']).toBe('ORIGINAL');
    call('onHide'); call('onShow'); await call('refreshStatus'); call('restoreShipment'); expect(page.data).toMatchObject({ trackingInput: 'ORIGINAL', carrierInput: '原快递', shipmentPending: true, shipmentSheet: true });
    mocks.ship.mockReturnValueOnce(response(value)); await call('submitShipment'); expect(mocks.ship).toHaveBeenLastCalledWith('o1', pending.body, pending.etag);
});
test('correction rejects overlong reason and preserves form after confirmed version conflict', async () => {
    const value = personalOrder('LESSOR', 'OUTBOUND'); value.order.allowed_actions = [{ action_code: 'CORRECT_SHIPMENT', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value));
    await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'CORRECT_SHIPMENT' } } }); Object.assign(page.data, { trackingInput: 'NEW', correctionReason: '字'.repeat(501) });
    await call('submitShipment'); expect(more.correctShipment).not.toHaveBeenCalled(); expect(page.data['shipmentErrorField']).toBe('correctionReason');
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    page.data['correctionReason'] = '原单号填写有误'; more.correctShipment.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(412, { code: 'VERSION_CONFLICT', message: '版本变化', request_id: 'fixture-version' })), abort: vi.fn() });
    await call('submitShipment'); expect(more.correctShipment).toHaveBeenCalledOnce(); expect(page.data).toMatchObject({ shipmentSheet: true, shipmentPending: false, trackingInput: 'NEW', correctionReason: '原单号填写有误' }); expect(page.data['shipmentError']).toContain('再次明确提交');
});
test('return address read failure never presents a missing address as confirmed', async () => {
    const value = personalOrder('LESSOR', 'IN_USE'); Object.assign(value, { return_id: 'return-1' }); mocks.get.mockReturnValue(response(value));
    mocks.return.mockReturnValue({ promise: Promise.reject(new Error('归还地址读取失败')), abort: vi.fn() });
    await load('order-detail'); expect(page.data).toMatchObject({ deliveryAddressKnown: false, deliveryAddressAction: '' });
});
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.owner = 'tenant'; mocks.uploadWait = null; mocks.returnShipment.mockReturnValue(response(returnValue(null))); mocks.correctReturnShipment.mockReturnValue(response(returnValue(null))); mocks.receipt.mockReturnValue(response(returnValue(null))); mocks.get.mockReturnValue(response(order())); mocks.createPayment.mockReturnValue(response(paymentValue())); mocks.payment.mockReturnValue(response(paymentValue({ allowed_actions: [{ action_code: 'QUERY_PAYMENT', allowed: true }] }))); mocks.invocation.mockReturnValue(response({ payment_id: 'p1', app_id: 'fixture', time_stamp: '1', nonce_str: 'n', package: 'prepay_id=x', sign_type: 'RSA', pay_sign: 'signature', expires_at: '2999-10-06T07:39:00Z' })); mocks.queryPayment.mockReturnValue(response({ state: 'ACCEPTED' })); mocks.return.mockReturnValue(response(returnValue(null))); payment.mockImplementation((o: {
    complete: () => void;
}) => o.complete()); vi.stubGlobal('wx', { nextTick: (fn: () => void) => fn(), createVideoContext: () => ({ stop: reviewVideoStop }), getAccountInfoSync: () => ({ miniProgram: { appId: 'fixture' } }), requestPayment: payment, navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), stopPullDownRefresh: vi.fn(), previewImage: vi.fn(), showModal: vi.fn() }); });
afterEach(() => { if (page && typeof page['onUnload'] === 'function')
    call('onUnload'); vi.unstubAllGlobals(); vi.useRealTimers(); });
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-09T21:00:00Z'));
    for (const mock of Object.values(detail)) mock.mockReset();
    detail.list.mockReturnValue({ promise: Promise.resolve({ items: [ownAddress()], page: { has_more: false } }), abort: vi.fn() });
    detail.find.mockResolvedValue(ownAddress());
    detail.create.mockReturnValue({ promise: Promise.resolve({ address_id: 'own-address' }), abort: vi.fn() });
    detail.update.mockReturnValue({ promise: Promise.resolve({ address_id: 'own-address' }), abort: vi.fn() });
    detail.pickupCredential.mockReturnValue(response({ order_id: 'o1', pickup_code: '001234' }));
    Object.assign(wx, { setClipboardData: vi.fn(), pageScrollTo: vi.fn(), getWindowInfo: () => ({ windowHeight: 844 }) });
});
test('payment dispatch is single flight; native completion only triggers original API query', async () => { await load('order-detail'); await Promise.all([call('runAction', 'PAY_INITIAL'), call('runAction', 'PAY_INITIAL')]); expect(mocks.createPayment).toHaveBeenCalledTimes(1); expect(payment).toHaveBeenCalledTimes(1); expect(mocks.payment).toHaveBeenCalledWith('p1'); expect(mocks.queryPayment).toHaveBeenCalledWith('p1', '"object:1"'); expect(page.data['status']).toBe('待支付'); expect(page.data['paymentNotice']).toContain('不代表未付款'); });
test('unknown original payment never creates or invokes another payment', async () => { const v = order(); Object.assign(v.bill, paymentReferences(paymentValue({ status: 'UNKNOWN' }))); mocks.get.mockReturnValue(response(v)); mocks.payment.mockReturnValue(response(paymentValue({ status: 'UNKNOWN', allowed_actions: [], blockers: [{ message: '支付结果待核实' }] }))); await load('order-detail'); await call('runAction', 'PAY_INITIAL'); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled(); expect(page.data['paymentNotice']).toContain('支付结果待核实'); });
test('initial order read failure keeps the reason and reloads only the original order', async () => {
    mocks.get.mockImplementation(() => ({ promise: Promise.reject(new Error('请求的资源不存在')), abort: vi.fn() }));
    await load('order-detail');
    expect(page.data).toMatchObject({ loaded: false, loading: false, actions: [], errorText: '请求的资源不存在' });
    mocks.get.mockClear(); await call('refreshStatus');
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('o1');
    expect(page.data).toMatchObject({ loaded: false, loading: false, actions: [], errorText: '请求的资源不存在' });
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.ship).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('failed order can return to the existing orders tab without a session or duplicate navigation', async () => {
    mocks.owner = null; await load('order-detail');
    call('backToOrders'); call('backToOrders');
    expect(wx.switchTab).toHaveBeenCalledTimes(1);
    expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/orders/index' }));
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled();
    call('onHide'); call('backToOrders'); expect(wx.switchTab).toHaveBeenCalledTimes(1);
});
test('payment result arriving after hide/account change cannot invoke wx or repaint', async () => { await load('order-detail'); let resolve!: (v: unknown) => void; mocks.createPayment.mockReturnValue({ promise: new Promise(done => resolve = done), abort: vi.fn() }); const pending = call('runAction', 'PAY_INITIAL'); await Promise.resolve(); call('onHide'); mocks.owner = 'another'; const hidden = structuredClone(page.data); resolve({ value: { payment_id: 'p1', allowed_actions: [{ action_code: 'INVOKE_PAYMENT', allowed: true }] }, etag: '"payment:1"' }); await pending; expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled(); expect(page.data).toEqual(hidden); });
test('current UI keeps original shells and removes retired alternatives; contact is native', () => { const read = (route: string) => readFileSync('miniprogram/pages/' + route + '/index.wxml', 'utf8'); for (const token of ['checkout-step', 'checkout-object', 'confirm-section', 'task-sheet'])
    expect(read('confirm')).toContain(token); for (const retired of ['会员免押', 'toggleInsurance', 'toggleGuard', 'runner', 'meet'])
    expect(read('confirm')).not.toContain(retired); for (const route of ['info', 'confirm', 'order-detail', 'return-submit', 'cabinet-code', 'cabinet-open', 'cabinet-return', 'wallet'])
    expect(read(route)).toContain('open-type="contact"'); expect(read('cabinet-code')).toContain('show-display-code="{{false}}"'); expect(read('order-detail')).not.toContain('cabinet-credential-input'); expect(read('wallet')).not.toContain('openWithdrawal'); });

function reviewEvidence(kind: 'PHOTO' | 'VIDEO', id: string) {
    const video = kind === 'VIDEO';
    return { material_id: id, kind, availability: 'READY', media: {
        material_id: id, role: video ? 'VIDEO' : 'IMAGE', sort_order: 0,
        url: mediaOrigin + '/' + id + (video ? '-playback.mp4' : '.jpg'),
        mime_type: video ? 'video/mp4' : 'image/jpeg', size_bytes: 120,
        metadata: video ? { schema_version: 1, width: 1920, height: 1080, duration_ms: 1000, video_codec: 'h264', audio_codec: null } : null,
        poster: video ? { material_id: id + '-poster', url: mediaOrigin + '/' + id + '-poster.png', width: 640, height: 360 } : null,
    } };
}
test('copy order and shipment numbers uses only the currently read original order and clears on hide', async () => {
    const value = order(); value.delivery.tracking_no = 'OUT-123' as never; const r = returnValue(null); r.tracking_no = 'RETURN-123' as never;
    mocks.get.mockReturnValue(response(value)); mocks.return.mockReturnValue(response(r)); await load('order-detail');
    call('copyOrderNumber'); call('copyTracking', { currentTarget: { dataset: { kind: 'outbound' } } }); call('copyTracking', { currentTarget: { dataset: { kind: 'return' } } });
    expect(vi.mocked(wx.setClipboardData).mock.calls.map(args => args[0].data)).toEqual(['N1', 'OUT-123', 'RETURN-123']);
    call('onHide'); call('copyOrderNumber'); call('copyTracking', { currentTarget: { dataset: { kind: 'return' } } }); expect(wx.setClipboardData).toHaveBeenCalledTimes(3);
});
test('original payment status and observation timestamps do not infer cash or dispatch payment', async () => {
    const value = order(); Object.assign(value.bill, paymentReferences({ payment_id: 'p1', purpose: 'INITIAL', status: 'UNKNOWN', amount_fen: '11000', payer_total_fen: null, created_at: '2026-10-06T01:00:00Z', last_verified_at: null }));
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['paymentRows']).toEqual([{ id: 'p1', canQuery: false, purpose: '订单支付', status: '支付结果待核实', amount: '¥110.00', cash: '待核实', created: '2026-10-06 09:00', verified: '—' }]);
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.queryPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('zero cash closure keeps server reason and reads only original contract quota without claiming a cash refund', async () => {
    const value = order(); Object.assign(value, { contract_id: 'c1', coupon_status: 'RESTORED' }); Object.assign(value.order, { stage: 'CLOSED', display_status: '租期结束未交付，订单已关闭', allowed_actions: [] });
    mocks.get.mockReturnValue(response(value)); more.contract.mockReturnValue(response({ contract_id: 'c1', order_id: 'o1', quota_state: 'RESTORED', quota_valid_until: '2026-11-01T00:00:00Z' })); await load('order-detail');
    expect(page.data).toMatchObject({ status: '租期结束未交付，订单已关闭', quotaVisible: true, quotaState: '已恢复', quotaValidUntil: '2026-11-01 08:00', couponStatus: '已恢复', refundId: '' });
    more.contract.mockReturnValue(response({ contract_id: 'foreign', order_id: 'another', quota_state: 'RESTORED', quota_valid_until: null })); await call('refreshStatus'); expect(page.data).toMatchObject({ quotaState: '待核实', quotaValidUntil: '待核实' }); expect(page.data['quotaError']).toContain('不匹配');
    expect(mocks.createPayment).not.toHaveBeenCalled();
});
test.each(['hide', 'account'] as const)('late closed quota read cannot publish restored entitlement after %s', async boundary => {
    const value = order(); Object.assign(value, { contract_id: 'c1' }); value.order.stage = 'CLOSED'; mocks.get.mockReturnValue(response(value));
    more.contract.mockReturnValue(response({ contract_id: 'c1', order_id: 'o1', quota_state: 'RESERVED', quota_valid_until: null })); await load('order-detail');
    const pending = deferredResponse(); more.contract.mockReturnValueOnce(pending); const reading = call('refreshStatus'); await vi.waitFor(() => expect(page.data['quotaState']).toBe('待核实'));
    if (boundary === 'hide') call('onHide'); else mocks.owner = 'other';
    pending.resolve({ value: { contract_id: 'c1', order_id: 'o1', quota_state: 'RESTORED', quota_valid_until: null }, etag: '' }); await reading;
    expect(page.data).toMatchObject({ loaded: false, quotaVisible: false, quotaState: '', quotaValidUntil: '' });
});
function lessorReturn(code: 'CONFIRM_RECEIPT' | 'SET_RETURN_ADDRESS' = 'CONFIRM_RECEIPT') {
    const value = order(); value.order.viewer_role = 'LESSOR'; value.order.allowed_actions = [{ action_code: code, allowed: true, display_reason: null }]; value.delivery.delivered_at = '2026-10-06T00:00:00Z' as never;
    const r = returnValue(null); r.allowed_actions = [{ action_code: code, allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); mocks.return.mockReturnValue(response(r, '"RETURN:return-1:1"'));
    return { value, r };
}
test('detail receipt sheet opens read-only, validates explicit Beijing time and keeps missing materials independent', async () => {
    lessorReturn(); await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'CONFIRM_RECEIPT' } } });
    expect(page.data).toMatchObject({ returnSheet: 'receipt', receiptDate: '', receiptTime: '', returnMaterialState: '材料待补充' }); expect(mocks.receipt).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
    await call('submitReceipt'); expect(mocks.receipt).not.toHaveBeenCalled(); expect(page.data['returnError']).toContain('完整');
    Object.assign(page.data, { receiptDate: '2026-10-05', receiptTime: '23:59' }); await call('submitReceipt'); expect(page.data['returnError']).toContain('不能早于'); expect(mocks.receipt).not.toHaveBeenCalled();
    Object.assign(page.data, { receiptDate: '2026-10-06', receiptTime: '18:30', receiptNote: '  完整收回  ' });
    const pending = deferredResponse(); mocks.receipt.mockReturnValueOnce(pending); const first = call('submitReceipt'), duplicate = call('submitReceipt');
    await vi.waitFor(() => expect(mocks.receipt).toHaveBeenCalledExactlyOnceWith('o1', { received_at: '2026-10-06T10:30:00.000Z', note: '完整收回' }, '"RETURN:return-1:1"'));
    expect(page.data['returnBusy']).toBe(true); expect(mocks.saveReturnEvidence).not.toHaveBeenCalled();
    pending.resolve({ value: {}, etag: '"RETURN:return-1:2"' }); await Promise.all([first, duplicate]); expect(page.data['returnSheet']).toBe('');
});
test('detail receipt 412 retains the draft and needs explicit resubmit with the newly read return ETag', async () => {
    const { r } = lessorReturn(); await load('order-detail'); await call('openReturnSheet', 'receipt');
    Object.assign(page.data, { receiptDate: '2026-10-06', receiptTime: '18:30', receiptNote: '保留实收说明' });
    const ApiProblem = (await import('../miniprogram/shared/api/account-api')).ApiProblem;
    mocks.receipt.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(412, { code: 'VERSION_CONFLICT', message: '归还版本更新', request_id: 'receipt' })), abort: vi.fn() });
    mocks.return.mockReturnValue(response(r, '"RETURN:return-1:2"')); await call('submitReceipt');
    expect(page.data).toMatchObject({ returnSheet: 'receipt', receiptDate: '2026-10-06', receiptTime: '18:30', receiptNote: '保留实收说明', returnPending: false }); expect(page.data['returnError']).toContain('已保留输入'); expect(mocks.receipt).toHaveBeenCalledOnce();
    await call('submitReceipt'); expect(mocks.receipt).toHaveBeenLastCalledWith('o1', { received_at: '2026-10-06T10:30:00.000Z', note: '保留实收说明' }, '"RETURN:return-1:2"');
});
test('server future-time rejection stays inline and does not silently substitute the current clock', async () => {
    lessorReturn(); await load('order-detail'); await call('openReturnSheet', 'receipt'); Object.assign(page.data, { receiptDate: '2027-01-01', receiptTime: '18:30' });
    const ApiProblem = (await import('../miniprogram/shared/api/account-api')).ApiProblem;
    mocks.receipt.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '实际收回时间不能晚于当前时间', request_id: 'future' })), abort: vi.fn() }); await call('submitReceipt');
    expect(page.data).toMatchObject({ receiptDate: '2027-01-01', receiptTime: '18:30', returnPending: false }); expect(page.data['returnError']).toContain('不能晚于'); expect(mocks.receipt).toHaveBeenCalledOnce();
});
test('unknown receipt locks the original body and a hidden or switched account cannot receive its late result', async () => {
    lessorReturn(); await load('order-detail'); await call('openReturnSheet', 'receipt'); Object.assign(page.data, { receiptDate: '2026-10-06', receiptTime: '18:30', receiptNote: '原实收' });
    mocks.receipt.mockReturnValueOnce({ promise: Promise.reject(new Error('结果未知')), abort: vi.fn() }); await call('submitReceipt'); expect(page.data['returnPending']).toBe(true);
    call('inputReturnField', { currentTarget: { dataset: { field: 'receiptNote' } }, detail: { value: '不应覆盖' } }); expect(page.data['receiptNote']).toBe('原实收');
    const pending = deferredResponse(); mocks.receipt.mockReturnValueOnce(pending); const retry = call('submitReceipt'); await vi.waitFor(() => expect(mocks.receipt).toHaveBeenCalledTimes(2));
    expect(mocks.receipt.mock.calls[1]).toEqual(mocks.receipt.mock.calls[0]); call('onHide'); mocks.owner = 'other'; const hidden = structuredClone(page.data);
    pending.resolve({ value: {}, etag: '"RETURN:return-1:2"' }); await retry; expect(page.data).toEqual(hidden);
});
test('detail address selection is read-only and binding retry reuses the saved own address without creating another', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); await call('showOwnReturnAddresses');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'foreign' } } }); expect(page.data['selectedAddressId']).toBe('');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } }); expect(page.data['addressOptions']).toEqual([expect.objectContaining({ name: '出租人', phone: '+86 13800000000', region: '广东省深圳市南山区', detail: '科技园1号' })]); expect(more.returnAddress).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new Error('绑定未知')), abort: vi.fn() }); await call('submitReturnAddress');
    expect(page.data).toMatchObject({ selectedAddressId: 'own-address', returnSheet: 'address', returnPending: true }); expect(page.data['addressNotice']).toContain('尚未应用');
    more.returnAddress.mockImplementation(() => { r.address = { source_id: 'own-address', recipient_name: '出租人', phone: '13800000000', region_text: '广东省深圳市南山区', detail: '科技园1号' } as never; r.address_version = '2'; return response(r); });
    await call('submitReturnAddress'); expect(more.returnAddress.mock.calls.map(args => args[1])).toEqual(['own-address', 'own-address']); expect(detail.create).not.toHaveBeenCalled(); expect(detail.update).not.toHaveBeenCalled(); expect(page.data).toMatchObject({ returnSheet: '', returnVersion: '2', addressNotice: '已用于本单返程地址。' });
});
test('saved address read failure prevents binding and retry reads the same selection without recreating it', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    detail.find.mockRejectedValueOnce(new Error('地址回读中断')); await call('submitReturnAddress'); expect(detail.create).not.toHaveBeenCalled(); expect(more.returnAddress).not.toHaveBeenCalled(); expect(page.data['returnPending']).toBe(false);
    more.returnAddress.mockImplementation(() => { r.address = { source_id: 'own-address', recipient_name: '出租人', phone: '13800000000', region_text: '广东省深圳市南山区', detail: '科技园1号' } as never; return response(r); });
    await call('submitReturnAddress'); expect(detail.create).not.toHaveBeenCalled(); expect(detail.find).toHaveBeenCalledTimes(2); expect(more.returnAddress).toHaveBeenCalledOnce(); expect(page.data['returnSheet']).toBe('');
});
test('opening lessor address before R01 never creates a return and invalid input never writes', async () => {
    const { value, r } = lessorReturn('SET_RETURN_ADDRESS'); value.return_id = null as never; value.order.allowed_actions = [{ action_code: 'START_RETURN', allowed: true, display_reason: null }]; detail.startReturn.mockReturnValue(response(r, '"RETURN:return-1:1"'));
    await load('order-detail'); await call('handleAction', { currentTarget: { dataset: { code: 'START_RETURN' } } }); expect(page.data['returnSheet']).toBe('address'); expect(detail.startReturn).not.toHaveBeenCalled();
    await call('submitReturnAddress'); expect(page.data['returnErrorField']).toBe('selectedAddressId'); expect(detail.startReturn).not.toHaveBeenCalled(); expect(detail.create).not.toHaveBeenCalled();
    call('closeReturnSheet'); expect(page.data['returnSheet']).toBe(''); expect(detail.startReturn).not.toHaveBeenCalled();
});
test('return address management uses the existing book and returning with a saved address only selects it', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address');
    call('manageReturnAddresses'); call('manageReturnAddresses'); expect(wx.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/addresses/index?mode=select' }));
    const navigation = vi.mocked(wx.navigateTo).mock.calls[0]![0]!; call('onHide');
    const saved = { ...ownAddress(), address_id: 'new-saved-address', recipient_name: '新收件人' }; detail.find.mockResolvedValue(saved);
    navigation.events!['addressSelected']!({ addressId: saved.address_id }); call('onShow');
    await vi.waitFor(() => expect(page.data).toMatchObject({ returnSheet: 'address', selectedAddressId: saved.address_id, role: '我的出租订单' }));
    expect(page.data['addressOptions']).toEqual(expect.arrayContaining([expect.objectContaining({ id: saved.address_id, name: '新收件人', region: '广东省深圳市南山区' })]));
    expect(detail.create).not.toHaveBeenCalled(); expect(detail.update).not.toHaveBeenCalled(); expect(more.returnAddress).not.toHaveBeenCalled();
    more.returnAddress.mockImplementation(() => { r.address = { source_id: saved.address_id } as never; return response(r); });
    await call('submitReturnAddress'); expect(more.returnAddress).toHaveBeenCalledExactlyOnceWith('o1', saved.address_id, '"RETURN:return-1:1"');
});
test('detail original address binding survives same-account hide and resumes only the saved address', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); await call('showOwnReturnAddresses'); call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new Error('应用未知')), abort: vi.fn() }); await call('submitReturnAddress'); call('onHide'); call('onShow'); await call('refreshStatus'); await call('openReturnSheet', 'address');
    expect(page.data).toMatchObject({ selectedAddressId: 'own-address', returnPending: true });
    more.returnAddress.mockImplementation(() => { r.address = { source_id: 'own-address', recipient_name: '出租人', phone: '13800000000', region_text: '广东省深圳市南山区', detail: '科技园1号' } as never; return response(r); });
    await call('submitReturnAddress'); expect(more.returnAddress.mock.calls[1]).toEqual(more.returnAddress.mock.calls[0]); expect(detail.create).not.toHaveBeenCalled();
});
test('detail return address 412 preserves selected address and rereads without automatically reapplying', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); await call('showOwnReturnAddresses'); call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    const ApiProblem = (await import('../miniprogram/shared/api/account-api')).ApiProblem;
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(412, { code: 'VERSION_CONFLICT', message: '地址版本已变', request_id: 'address' })), abort: vi.fn() }); mocks.return.mockReturnValue(response(r, '"RETURN:return-1:2"')); await call('submitReturnAddress');
    expect(page.data).toMatchObject({ selectedAddressId: 'own-address', returnSheet: 'address', returnPending: false }); expect(page.data['returnError']).toContain('已保留输入'); expect(more.returnAddress).toHaveBeenCalledOnce();
    await call('submitReturnAddress'); expect(more.returnAddress).toHaveBeenLastCalledWith('o1', 'own-address', '"RETURN:return-1:2"'); expect(detail.create).not.toHaveBeenCalled();
});
test('revoked detail return action cannot open or submit from a stale button and late address reads cannot repaint a closed sheet', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); const pending = deferredResponse(); detail.list.mockReturnValueOnce(pending);
    const reading = call('showOwnReturnAddresses'); await Promise.resolve(); call('onHide'); const hidden = structuredClone(page.data); pending.resolve({ items: [ownAddress()], page: { has_more: false } }); await reading; expect(page.data).toEqual(hidden);
    call('onShow'); await call('refreshStatus'); r.allowed_actions = []; mocks.return.mockReturnValue(response(r)); await call('openReturnSheet', 'address'); await call('submitReturnAddress'); expect(more.returnAddress).not.toHaveBeenCalled(); expect(page.data['returnSheet']).toBe('');
});
test.each(['deleted', 'changed', 'foreign-selection'])('return address %s cannot silently become the applied order address', async invalid => {
    lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    if (invalid === 'deleted') detail.find.mockResolvedValueOnce(undefined);
    if (invalid === 'changed') detail.find.mockResolvedValueOnce({ ...ownAddress(), version: '2', detail_address: '更新后的详细地址' });
    if (invalid === 'foreign-selection') page.data['selectedAddressId'] = 'unlisted-address';
    await call('submitReturnAddress'); expect(more.returnAddress).not.toHaveBeenCalled(); expect(detail.startReturn).not.toHaveBeenCalled();
    if (invalid !== 'foreign-selection') expect(page.data['selectedAddressId']).toBe('');
    if (invalid === 'changed') expect(page.data['addressOptions']).toEqual([expect.objectContaining({ detail: '更新后的详细地址' })]);
});
test('saved addresses paginate without duplicates and always expose all four address parts', async () => {
    lessorReturn('SET_RETURN_ADDRESS'); detail.list.mockReturnValueOnce({ promise: Promise.resolve({ items: [ownAddress()], page: { has_more: true, next_cursor: 'cursor-1' } }) });
    await load('order-detail'); await call('openReturnSheet', 'address'); expect(page.data['addressNext']).toBe(true);
    detail.list.mockReturnValueOnce({ promise: Promise.resolve({ items: [ownAddress(), { ...ownAddress(), address_id: 'second', recipient_name: '第二收件人' }, { ...ownAddress(), address_id: 'incomplete', district_name: '' }], page: { has_more: false } }) });
    await call('loadOwnReturnAddresses'); expect(detail.list).toHaveBeenLastCalledWith('cursor-1');
    expect(page.data).toMatchObject({ addressNext: false, addressOptions: [
        { id: 'own-address', name: '出租人', phone: '+86 13800000000', region: '广东省深圳市南山区', detail: '科技园1号' },
        { id: 'second', name: '第二收件人', phone: '+86 13800000000', region: '广东省深圳市南山区', detail: '科技园1号' },
    ] });
});
test('successful address application with failed readback resumes by reading instead of writing again', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); call('selectReturnAddress', 'own-address');
    more.returnAddress.mockReturnValueOnce(response(r)); mocks.get.mockReturnValueOnce({ promise: Promise.reject(new Error('回读中断')), abort: vi.fn() });
    await call('submitReturnAddress'); expect(more.returnAddress).toHaveBeenCalledOnce();
    await call('openReturnSheet', 'address'); expect(page.data['returnPending']).toBe(true);
    r.address = { source_id: 'own-address' } as never; await call('submitReturnAddress');
    expect(more.returnAddress).toHaveBeenCalledOnce(); expect(page.data).toMatchObject({ returnSheet: '', addressNotice: '已用于本单返程地址。' });
});
test('address application success received while hidden never causes another write on same-account recovery', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); call('selectReturnAddress', 'own-address');
    const pending = deferredResponse(); more.returnAddress.mockReturnValueOnce(pending); const command = call('submitReturnAddress'); await vi.waitFor(() => expect(more.returnAddress).toHaveBeenCalledOnce());
    call('onHide'); const hidden = structuredClone(page.data); pending.resolve({ value: r, etag: '"RETURN:return-1:2"' }); await command; expect(page.data).toEqual(hidden);
    r.address = { source_id: 'own-address' } as never; call('onShow'); await call('openReturnSheet', 'address'); await call('submitReturnAddress');
    expect(more.returnAddress).toHaveBeenCalledOnce(); expect(page.data['returnSheet']).toBe('');
});
test('unknown address application locks the selected address and prevents navigation to edit it', async () => {
    lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); call('selectReturnAddress', 'own-address');
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new Error('未知')), abort: vi.fn() }); await call('submitReturnAddress');
    call('manageReturnAddresses'); call('selectReturnAddress', 'another'); await call('showOwnReturnAddresses');
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page.data).toMatchObject({ selectedAddressId: 'own-address', returnPending: true });
});
test.each(['deleted', 'other-owner', 'cancelled'])('returning from the address book with %s has no automatic application', async scenario => {
    lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address'); call('selectReturnAddress', 'own-address'); call('manageReturnAddresses');
    const navigation = vi.mocked(wx.navigateTo).mock.calls[0]![0]!; call('onHide');
    if (scenario === 'other-owner') mocks.owner = 'other';
    if (scenario === 'deleted') detail.find.mockResolvedValueOnce(undefined);
    if (scenario !== 'cancelled') navigation.events!['addressSelected']!({ addressId: 'own-address' });
    call('onShow'); await vi.waitFor(() => expect(page.data['loaded']).toBe(true));
    if (scenario === 'cancelled') await vi.waitFor(() => expect(page.data).toMatchObject({ returnSheet: 'address', selectedAddressId: 'own-address' }));
    if (scenario === 'deleted') await vi.waitFor(() => expect(page.data['returnError']).toContain('不可用'));
    if (scenario === 'other-owner') expect(page.data).toMatchObject({ returnSheet: '', selectedAddressId: '' });
    expect(more.returnAddress).not.toHaveBeenCalled(); expect(detail.create).not.toHaveBeenCalled();
});
test('closing the address sheet while reading does not let a late list reopen it', async () => {
    lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); const pending = deferredResponse(); detail.list.mockReturnValueOnce(pending);
    const opening = call('openReturnSheet', 'address'); await vi.waitFor(() => expect(page.data['addressListBusy']).toBe(true)); call('closeReturnSheet'); const closed = structuredClone(page.data);
    pending.resolve({ items: [ownAddress()], page: { has_more: false } }); await opening; expect(page.data).toEqual(closed); expect(page.data['returnSheet']).toBe('');
});
test('actual receipt note counter follows input and cancelling never records a receipt', async () => {
    lessorReturn(); await load('order-detail'); await call('openReturnSheet', 'receipt');
    call('inputReturnField', { currentTarget: { dataset: { field: 'receiptNote' } }, detail: { value: '机身与配件已收回' } });
    expect(page.data).toMatchObject({ receiptNote: '机身与配件已收回', receiptDate: '', receiptTime: '' }); call('closeReturnSheet'); expect(mocks.receipt).not.toHaveBeenCalled();
});

function officialPickup(ready = false) {
    const value = order();
    Object.assign(value, { contract_id: 'official-contract', return_id: null, pickup: { name: '测试中心一层', address: '浙江省 杭州市 拱墅区 星光路18号1层', compartment_no: 1 } });
    Object.assign(value.order, { supply_channel: 'OFFICIAL_CABINET', stage: 'ACTIVE', display_status_code: 'AWAITING_DELIVERY', display_status: '待交付', rental_start_at: ready ? '2999-10-10T00:00:00Z' : '2000-10-10T00:00:00Z',
        allowed_actions: ['READ_PICKUP_CODE', 'VIEW_CONTRACT', ...(ready ? ['OPEN_CABINET'] : [])].map(action_code => ({ action_code, allowed: true, display_reason: null })) });
    value.delivery.method = 'CABINET'; return value;
}
test.each([false, true])('official pickup eligibility is server-bound regardless of local date (ready=%s)', async ready => {
    mocks.get.mockReturnValue(response(officialPickup(ready))); more.contract.mockReturnValue(response({ order_id: 'o1', contract_id: 'official-contract', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED' }, final_artifact: { artifact_id: 'original-artifact' } }));
    await load('order-detail'); expect(page.data['pickupPage']).toMatchObject({ ready, title: ready ? '可以取件了' : '待取件', address: '浙江省 杭州市 拱墅区 星光路18号1层' });
    expect(page.data).toMatchObject({ pickupSigned: true, depositSettlementVisible: false });
    const reads = detail.pickupCredential.mock.calls.length; call('showPickupGuide');
    expect(page.data['pickupGuideOpen']).toBe(true); expect(detail.pickupCredential).toHaveBeenCalledTimes(reads); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('dismissFeedback'); await call('handleAction', { currentTarget: { dataset: { code: 'READ_PICKUP_CODE' } } });
    expect(page.data['pickupCode']).toBe('001234');
});
test.each([{ viewer_role: 'LESSOR' }, { supply_channel: 'PERSONAL' }, { stage: 'AWAITING_PAYMENT' }, { physical_status: 'IN_USE' }, { has_exception: true }])('official pickup design rejects a mismatched role or state: %j', async patch => {
    const value = officialPickup(true); Object.assign(value.order, patch); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); expect(page.data['pickupPage']).toBeNull(); call('showPickupGuide'); expect(page.data['pickupGuideOpen']).toBe(false);
});
test('official pickup contract cannot display signed when another order or missing artifact is returned', async () => {
    mocks.get.mockReturnValue(response(officialPickup(true)));
    more.contract.mockReturnValue(response({ order_id: 'foreign', contract_id: 'official-contract', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED' }, final_artifact: {} }));
    await load('order-detail'); expect(page.data).toMatchObject({ pickupSigned: false, pickupContractError: '本单已签合同尚未核实，请刷新订单' });
    more.contract.mockReturnValue(response({ order_id: 'o1', contract_id: 'official-contract', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED' }, final_artifact: null }));
    await call('refreshStatus'); expect(page.data['pickupSigned']).toBe(false);
});
test.each(['QUERY_CABINET', 'OPEN_CABINET'])('official pickup keeps original task recovery with %s and clears the new projection on hide', async action => {
    const value = officialPickup(true); value.order.allowed_actions.push({ action_code: action, allowed: true, display_reason: null });
    value.latest_cabinet_tasks = [{ purpose: 'PICKUP', task_id: 'original-pickup', allowed_actions: [{ action_code: action, allowed: true, display_reason: null }] }] as never;
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data['pickupPage']).toMatchObject({ taskAction: action });
    await call('handleAction', { currentTarget: { dataset: { code: action } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-open/index?taskId=original-pickup' }));
    call('onHide'); expect(page.data).toMatchObject({ pickupPage: null, pickupSigned: false });
});
test('official pickup does not offer recovery when the original task denies the action', async () => {
    const value = officialPickup(true);
    value.order.allowed_actions.push({ action_code: 'QUERY_CABINET', allowed: true, display_reason: null });
    value.latest_cabinet_tasks = [{ purpose: 'PICKUP', task_id: 'original-pickup', allowed_actions: [{ action_code: 'QUERY_CABINET', allowed: false, display_reason: 'TASK_UNRESOLVED' }, { action_code: 'OPEN_CABINET', allowed: false, display_reason: 'TASK_UNRESOLVED' }] }] as never;
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data['pickupPage']).toMatchObject({ taskAction: '' });
});

test('view pickup code scrolls the current code card into view above the fixed actions', async () => {
    const value = order(); value.return_id = null as never;
    value.order.allowed_actions = [{ action_code: 'READ_PICKUP_CODE', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    await call('handleAction', { currentTarget: { dataset: { code: 'READ_PICKUP_CODE' } } });
    expect(page.data['pickupCode']).toBe('001234');
    expect(wx.pageScrollTo).toHaveBeenCalledWith({ selector: '.pickup-code', offsetTop: -253, duration: 200 });
});

test.each(['onHide', 'account'])('queued code scrolling is discarded after %s', async boundary => {
    const value = order(); value.return_id = null as never;
    value.order.allowed_actions = [{ action_code: 'READ_PICKUP_CODE', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    let pending!: () => void; wx.nextTick = (fn: () => void) => { pending = fn; };
    await call('handleAction', { currentTarget: { dataset: { code: 'READ_PICKUP_CODE' } } });
    if (boundary === 'onHide') call('onHide'); else mocks.owner = 'other';
    pending(); expect(wx.pageScrollTo).not.toHaveBeenCalled();
});

test('unreserved pickup presents cabinet guidance while an existing task resumes its own result', async () => {
    const value = order(); value.return_id = null as never; value.delivery.method = 'CABINET';
    value.order.allowed_actions = [{ action_code: 'OPEN_CABINET', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['actions']).toEqual([expect.objectContaining({ label: '取件指引' })]);
    await call('handleAction', { currentTarget: { dataset: { code: 'OPEN_CABINET' } } });
    expect(page.data).toMatchObject({ pickupGuideOpen: true, errorText: '' });
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(more.task).not.toHaveBeenCalled();
    call('dismissFeedback'); expect(page.data['pickupGuideOpen']).toBe(false);
    value.latest_cabinet_tasks = [{ purpose: 'PICKUP', task_id: 'original-pickup' }] as never;
    await call('refreshStatus'); await call('handleAction', { currentTarget: { dataset: { code: 'OPEN_CABINET' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-open/index?taskId=original-pickup' }));
});

test.each(['onHide', 'account'])('detail pickup code arriving after %s is discarded and cannot be copied', async boundary => {
    const value = order(); value.return_id = null as never; value.order.allowed_actions = [{ action_code: 'READ_PICKUP_CODE', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value)); await load('order-detail');
    const calls = detail.pickupCredential.mock.calls.length; const pending = deferredResponse(); detail.pickupCredential.mockReturnValueOnce(pending); const reading = call('refreshStatus'); await vi.waitFor(() => expect(detail.pickupCredential).toHaveBeenCalledTimes(calls + 1));
    if (boundary === 'onHide') call('onHide'); else mocks.owner = 'other'; pending.resolve({ value: { order_id: 'o1', pickup_code: '654321' }, etag: '' }); await reading; await call('copyCode');
    expect(page.data['pickupCode']).toBe(''); expect(wx.setClipboardData).not.toHaveBeenCalled();
});
test.each([
    ['AWAITING_PAYMENT', 'NOT_DELIVERED', 'NONE', false, 'CREATED'],
    ['ACTIVE', 'IN_USE', 'NONE', false, 'SUCCEEDED'],
    ['ACTIVE', 'RETURNING', 'NONE', false, 'SUCCEEDED'],
    ['ACTIVE', 'RECEIVED', 'PRELIMINARY', false, 'SUCCEEDED'],
    ['ACTIVE', 'RECEIVED', 'FINAL', false, 'SUCCEEDED'],
    ['ACTIVE', 'RECEIVED', 'FINAL', true, 'UNKNOWN'],
])('detail hides deposit settlement before the full terminal facts: %s/%s/%s/%s/%s', async (stage, physical_status, review_status, finalized, paymentStatus) => {
    const value = order(); Object.assign(value.order, { stage, physical_status, review_status });
    value.order.allowed_actions = [{ action_code: 'QUERY_REFUND', allowed: true, display_reason: null }];
    Object.assign(value.bill, { finalized, ...paymentReferences({ purpose: 'INITIAL', status: paymentStatus }), ...refundReference({ refund_id: 'not-visible', purpose: 'DEPOSIT', status: 'UNKNOWN', blockers: [], allowed_actions: [] })});
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ depositSettlementVisible: false, refundRecordVisible: false, refundId: '', refundStatus: '', actions: [] });
});
test('a closed nonfulfillment refund remains a refund record without exposing deposit settlement', async () => {
    const value = order(); Object.assign(value.order, { stage: 'CLOSED', display_status: '订单已关闭', allowed_actions: [{ action_code: 'QUERY_REFUND', allowed: true, display_reason: null }] });
    Object.assign(value.bill, { ...refundReference({ refund_id: 'cancel-refund', purpose: 'OBSERVED_NONFULFILLMENT', status: 'UNKNOWN', amount_fen: '11000', payer_refund_fen: null, refunded_at: null, blockers: [], allowed_actions: [] })});
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ depositSettlementVisible: false, refundRecordVisible: true, refundTitle: '未履约退款记录', refundId: 'cancel-refund', refundStatus: '退款结果待核实' });
    expect(page.data['actions']).toEqual([expect.objectContaining({ action_code: 'QUERY_REFUND', label: '查询退款结果' })]);
});
test.each(['ACTIVE', 'COMPLETED'])('zero cash %s still shows its finalized bill after physical receipt', async stage => {
    const value = order(); Object.assign(value.order, { stage, physical_status: 'RECEIVED', review_status: 'FINAL' });
    value.fees.initial_due_fen = '0'; value.bill.finalized = true;
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ depositSettlementVisible: true, refundRecordVisible: false });
});
test.each(['FAILED_CONFIRMED', 'UNKNOWN', 'SUCCEEDED'])('detail renders unique original refund %s without inventing a completed order or refund time', async status => {
    const value = order(); Object.assign(value.order, { stage: 'ACTIVE', physical_status: 'RECEIVED', review_status: 'FINAL', display_status: '费用已核定' });
    value.bill.finalized = true; Object.assign(value.bill, paymentReferences({ purpose: 'INITIAL', status: 'SUCCEEDED' }));
    value.bill.refund_summary.latest_refund = { refund_id: 'original-refund', purpose: 'DEPOSIT', status, amount_fen: '24000', payer_refund_fen: null, refunded_at: null, blockers: [{ message: '渠道返回待人工核实' }], allowed_actions: [] } as never;
    mocks.get.mockReturnValue(response(value)); await load('order-detail'); expect(page.data).toMatchObject({ depositSettlementVisible: true, refundRecordVisible: true, refundId: 'original-refund', refundFailed: status === 'FAILED_CONFIRMED', refundAmount: '¥240.00', refundCash: '待核实', refundAt: '—', status: '费用已核定' }); expect(page.data['refundReason']).toBe('渠道返回待人工核实'); expect(mocks.createPayment).not.toHaveBeenCalled();
});
beforeEach(() => { more.pendingShipment.mockReset().mockReturnValue(null); more.correctShipment.mockReset().mockReturnValue(response(order())); more.returnAddress.mockReset().mockReturnValue(response(returnValue(null))); more.task.mockReset(); more.confirmDelivery.mockReset().mockReturnValue(response(order())); more.uploadPhase = 'READY'; more.uploadError = ''; });
test('shipment copies only the authorized recipient and preserves text tracking with null optional carrier', async () => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{action_code:'SHIP',allowed:true,display_reason:null}];
    value.delivery.recipient = {recipient_name:'租客',phone:'13800000000',region_text:'广东省深圳市南山区',detail:'本单收件地址'} as never;
    mocks.get.mockReturnValue(response(value)); mocks.ship.mockReturnValue(response(value));
    const copy = vi.fn(); Object.assign(wx, {setClipboardData:copy}); await load('order-detail'); call('copyRecipient');
    expect(copy).toHaveBeenCalledWith(expect.objectContaining({data:'租客 13800000000 广东省深圳市南山区 本单收件地址'}));
    await call('handleAction',{currentTarget:{dataset:{code:'SHIP'}}}); Object.assign(page.data,{trackingInput:'001AbC',carrierInput:'  '});
    await call('submitShipment'); expect(mocks.ship).toHaveBeenCalledWith('o1',{tracking_no:'001AbC',carrier:null},'"object:1"');
    value.order.physical_status = 'OUTBOUND'; value.order.allowed_actions = [{action_code:'CORRECT_SHIPMENT',allowed:true,display_reason:null}];mocks.get.mockReturnValue(response(value));await call('refreshStatus');
    await call('handleAction',{currentTarget:{dataset:{code:'CORRECT_SHIPMENT'}}});Object.assign(page.data,{trackingInput:'000New',carrierInput:'',correctionReason:''});
    await call('submitShipment');expect(more.correctShipment).not.toHaveBeenCalled();expect(page.data['shipmentError']).toContain('原因');
    page.data['correctionReason']='原单号填写有误';await call('submitShipment');expect(more.correctShipment).toHaveBeenCalledWith('o1',{tracking_no:'000New',carrier:null,reason:'原单号填写有误'},'"object:1"');
    call('onHide');call('copyRecipient');expect(copy).toHaveBeenCalledTimes(1);
});
test('old hold deadline never blocks explicit existing payment and lessor never receives a payment action', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T07:35:00Z'));
    const value=order();Object.assign(value,{hold_expires_at:'2026-10-06T07:30:00Z',payment_due_at:'2026-10-06T07:39:00Z'});Object.assign(value.bill, paymentReferences(paymentValue({payment_id:'original-payment',expires_at:'2026-10-06T07:39:00Z'})));
    mocks.get.mockReturnValue(response(value));mocks.payment.mockReturnValue(response(paymentValue({payment_id:'original-payment',expires_at:'2026-10-06T07:39:00Z'})));await load('order-detail');
    expect(page.data['deadline']).toBe('2026-10-06 15:39');expect(payment).not.toHaveBeenCalled();mocks.invocation.mockReturnValue(response({payment_id:'original-payment',app_id:'fixture',time_stamp:'1',nonce_str:'n',package:'prepay_id=original',sign_type:'RSA',pay_sign:'signature',expires_at:'2026-10-06T07:38:00Z'}));await call('runAction','PAY_INITIAL');
    expect(mocks.createPayment).not.toHaveBeenCalled();expect(mocks.confirm).not.toHaveBeenCalled();expect(payment).toHaveBeenCalledTimes(1);
    value.order.viewer_role='LESSOR';value.order.allowed_actions=[{action_code:'VIEW_CONTRACT',allowed:true,display_reason:null}];mocks.get.mockReturnValue(response(value));await call('refreshStatus');await call('runAction','PAY_INITIAL');
    expect(payment).toHaveBeenCalledTimes(1);expect((page.data['actions'] as {action_code:string}[]).map(a=>a.action_code)).toEqual(['VIEW_CONTRACT']);
});
test('historical received order shows this order receipt rather than current asset availability or lessor collected cash', async () => {
    const value=order();Object.assign(value.order,{viewer_role:'LESSOR',physical_status:'RECEIVED',initial_payer_total_fen:'62000',allowed_actions:[]});mocks.get.mockReturnValue(response(value));await load('order-detail');
    expect(page.data).toMatchObject({role:'我的出租订单',physical:'实物已收回',paid:'¥620.00'});
    const markup=readFileSync('miniprogram/pages/order-detail/index.wxml','utf8');expect(markup).toContain('租客实付');expect(markup).not.toMatch(/设备当前下架|设备当前可租|出租方已收款/);
    expect(JSON.stringify(page.data)).not.toContain('已上架');
});
test.each([
    [null, '本单未使用优惠券'], ['RESERVED', '本单预占中'], ['CONSUMED', '已使用'], ['RELEASED', '预占已释放'], ['RESTORED', '已恢复'],
])('order coupon status %s displays only the server fact without extending validity', async (status, label) => {
    const value = order(); Object.assign(value, { coupon_status: status });
    Object.assign(value.order, { stage: 'CLOSED', allowed_actions: [] });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['couponStatus']).toBe(label);
    expect(page.data['couponStatus']).not.toMatch(/有效至|可重新使用|永久有效/);
    const markup = readFileSync('miniprogram/pages/order-detail/index.wxml', 'utf8');
    expect(markup).toContain('<text>本单优惠券</text>'); expect(markup).toContain('{{couponStatus}}');
    expect(mocks.createPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
    call('onHide'); expect(page.data['couponStatus']).toBe('');
});
test('late coupon state cannot return after hide or switching the account', async () => {
    await load('order-detail'); let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue({ promise: new Promise(done => resolve = done), abort: vi.fn() });
    const pending = call('refreshStatus'); call('onHide'); mocks.owner = 'another';
    resolve({ value: { ...order(), coupon_status: 'RESTORED' }, etag: '"ORDER:bzE:2"' }); await pending;
    expect(page.data['couponStatus']).toBe(''); expect(page.data['loaded']).toBe(false);
});
test('zero cash undelivered closure displays trusted status and restored coupon without fabricating a refund or refund time', async () => {
    const value = order(); Object.assign(value, { closed_at: '2026-10-07T02:00:00Z', completed_at: null, coupon_status: 'RESTORED' });
    Object.assign(value.order, { stage: 'CLOSED', display_status: '租期结束未交付，订单已关闭', display_status_code: 'CLOSED', initial_payer_total_fen: '0', allowed_actions: [] });
    Object.assign(value.fees, { rent_gross_fen: '0', deposit_due_fen: '0', initial_due_fen: '0' });
    Object.assign(value.bill, { ...paymentReferences(null), ...refundReference(null), finalized: false, refund_due_fen: null, deposit_refunded_fen: '0' });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ status: '租期结束未交付，订单已关闭', closed: '2026-10-07 10:00', completed: '—', couponStatus: '已恢复', total: '¥0.00', paid: '¥0.00', refundDue: '待核实', refunded: '¥0.00', billFinalized: false, actions: [] });
    expect(JSON.stringify(page.data)).not.toContain('退款成功'); expect(page.data).not.toHaveProperty('refundedAt'); expect(page.data).toMatchObject({ refundId: '', refundStatus: '', refundAt: '—' });
    const markup = readFileSync('miniprogram/pages/order-detail/index.wxml', 'utf8'); expect(markup).toContain('{{status}}'); expect(markup).toContain('{{closed}}'); expect(markup).toMatch(/wx:if="\{\{refundRecordVisible\}\}"[\s\S]*?渠道退款时间/);
    expect(page.data).toMatchObject({ depositSettlementVisible: false, refundRecordVisible: false });
    await call('runAction', 'QUERY_REFUND'); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(mocks.invocation).not.toHaveBeenCalled(); expect(mocks.queryPayment).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('expired original supplement remains query only and missing actual cash is never shown as zero', async () => {
    const value=order();value.order.initial_payer_total_fen=null;value.order.allowed_actions=[{action_code:'PAY_SUPPLEMENT',allowed:false,display_reason:'原补缴支付已过期，请联系客服'}] as never;Object.assign(value.bill, paymentReferences({payment_id:'supplement-original',purpose:'SUPPLEMENT',status:'CLOSED_UNPAID'}));mocks.get.mockReturnValue(response(value));await load('order-detail');
    expect(page.data['paid']).toBe('待核实');expect(payment).not.toHaveBeenCalled();expect(mocks.createPayment).not.toHaveBeenCalled();
    await call('runAction','PAY_SUPPLEMENT');expect(mocks.createPayment).not.toHaveBeenCalled();expect(mocks.invocation).not.toHaveBeenCalled();expect(payment).not.toHaveBeenCalled();
    expect((page.data['actions'] as {display_reason:string}[])[0]?.display_reason).toContain('已过期');
});
function reviewedOrder() {
    const photo = reviewEvidence('PHOTO', 'official-photo'), video = reviewEvidence('VIDEO', 'official-video');
    const value = order();
    Object.assign(value.bill, { loss_fen: '1200', assessment: {
        review_id: 'review-1', review_no: '1', decision: 'REVIEW_PENDING', rejection_reason: '请补充设备外观照片',
        adjustment_reason: null, missing_items: [{ slot_key: 'front', item_no: 1, evidence_id: null, reason: '请补充设备外观照片' }], created_at: '2026-10-08T00:00:00Z',
        loss_items: [
            { description: '镜头盖破损', confirmed_fen: '1200', evidence_ids: [photo.material_id, video.material_id], evidence: [photo, video] },
            { description: '其他损失核实中', confirmed_fen: null, evidence_ids: [], evidence: [] },
        ],
        evidence_ids: [photo.material_id, video.material_id], evidence: [photo, video],
    } });
    return value;
}
function reviewEvent(key = 'loss-0-1', epoch = page.data['reviewVideoEpoch']) {
    return { currentTarget: { dataset: { key, epoch, player: page.data['reviewPlayerVersion'] } } };
}
test('fee basis navigation only opens the current final assessment and preserves the original order ID', async () => {
    const value = reviewedOrder();
    Object.assign(value.order, { stage: 'ACTIVE', physical_status: 'RECEIVED', review_status: 'FINAL' });
    Object.assign(value.bill, { finalized: true, review_id: 'review-1', ...paymentReferences({ purpose: 'INITIAL', status: 'SUCCEEDED' }) });
    const assessment = (value.bill as unknown as { assessment: { decision: string } }).assessment;
    assessment.decision = 'APPROVE_FINAL'; mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['feeBasisVisible']).toBe(true); call('openFeeBasis');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-fees/index?orderId=o1' }));
    call('onHide'); call('openFeeBasis'); expect(wx.navigateTo).toHaveBeenCalledTimes(1);
});
test('official loss review uses only the authorized bill projection and preserves unknown amounts', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder()));
    await load('order-detail');
    expect(page.data['assessmentVisible']).toBe(true);
    expect(page.data['assessmentNotes']).toEqual([{ key: 'rejection', text: '请补充设备外观照片' }, { key: 'missingItems', text: '待补充凭证：请补充设备外观照片' }]);
    expect(page.data['lossItems']).toMatchObject([
        { description: '镜头盖破损', amount: '¥12.00', evidence: [
            { kind: 'PHOTO', available: true, url: mediaOrigin + '/official-photo.jpg' },
            { kind: 'VIDEO', available: true, url: mediaOrigin + '/official-video-playback.mp4', poster: mediaOrigin + '/official-video-poster.png' },
        ] },
        { description: '其他损失核实中', amount: '待核实' },
    ]);
    expect(page.data['reviewEvidence']).toEqual([]);
    const markup = readFileSync('miniprogram/pages/order-detail/index.wxml', 'utf8');
    expect(markup).toContain('wx:for="{{assessmentNotes}}" wx:key="key"');
    expect(markup).toContain('{{item.text}}');
    expect(markup).toContain('item.description');
    expect(markup).toContain('item.amount');
    expect(markup).toContain('src="{{reviewVideo.src}}" poster="{{reviewVideo.poster}}"');
    expect(markup).toContain('<media-state');
});
test('official loss video retry reuses its own playback and poster without another read', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder())); await load('order-detail');
    const reads = mocks.get.mock.calls.length;
    call('playReviewVideo', reviewEvent());
    const expected = { key: 'loss-0-1', src: mediaOrigin + '/official-video-playback.mp4', poster: mediaOrigin + '/official-video-poster.png' };
    expect(page.data['reviewVideo']).toEqual(expected);
    call('onReviewVideoError', reviewEvent());
    expect(page.data['reviewVideo']).toBeNull();
    expect(page.data['reviewVideoError']).toContain('重试原地址');
    call('playReviewVideo', reviewEvent());
    expect(page.data['reviewVideo']).toEqual(expected);
    expect(mocks.get).toHaveBeenCalledTimes(reads);
    expect(reviewVideoStop).toHaveBeenCalled();
});
test('official loss projection rejects unavailable, mismatched and missing-poster media without guessing a URL', async () => {
    const value = reviewedOrder();
    const bad = [reviewEvidence('PHOTO', 'unavailable'), reviewEvidence('PHOTO', 'mismatch'), reviewEvidence('VIDEO', 'no-poster')];
    bad[0]!.availability = 'UNAVAILABLE';
    bad[1]!.media.material_id = 'foreign';
    bad[2]!.media.poster = null;
    Object.assign(value.bill, { assessment: { review_id: 'r', review_no: '1', decision: 'REVIEW_PENDING', rejection_reason: null, adjustment_reason: null, missing_items: [], loss_items: [{ description: '待核实', confirmed_fen: null, evidence_ids: bad.map(item => item.material_id), evidence: bad }], evidence: [] } });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    const rows = page.data['lossItems'] as { evidence: { available: boolean; url: string; poster: string }[] }[];
    expect(rows[0]!.evidence).toHaveLength(3);
    for (const item of rows[0]!.evidence) expect(item).toMatchObject({ available: false, url: '', poster: '' });
    call('playReviewVideo', reviewEvent('loss-0-2'));
    expect(page.data['reviewVideo']).toBeNull();
});
test('hidden official review media is cleared and a late order response cannot restore it', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder())); await load('order-detail');
    call('playReviewVideo', reviewEvent());
    call('onHide');
    expect(reviewVideoStop).toHaveBeenCalled();
    expect(page.data['lossItems']).toEqual([]);
    expect(page.data['reviewEvidence']).toEqual([]);
    expect(page.data['reviewVideo']).toBeNull();
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue({ promise: new Promise(done => resolve = done), abort: vi.fn() });
    call('onShow'); const pending = call('refreshStatus');
    call('onHide');
    resolve({ value: reviewedOrder(), etag: '"order:o1:2"' }); await pending;
    expect(page.data['assessmentVisible']).toBe(false);
    expect(page.data['lossItems']).toEqual([]);
});
test('account switching stops official review video and clears its authorized media', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder())); await load('order-detail');
    call('playReviewVideo', reviewEvent()); mocks.owner = 'other-tenant';
    call('onReviewMediaActivity');
    expect(reviewVideoStop).toHaveBeenCalled();
    expect(page.data['reviewVideo']).toBeNull();
    expect(page.data['lossItems']).toEqual([]);
    call('playReviewVideo', reviewEvent());
    expect(page.data['reviewVideo']).toBeNull();
});
test('stale review player events and queued remounts cannot cross a newer read or hidden page', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder())); await load('order-detail');
    const stale = reviewEvent(); await call('refreshStatus');
    call('playReviewVideo', stale); expect(page.data['reviewVideo']).toBeNull();
    const callbacks: (() => void)[] = [];
    wx.nextTick = (callback: () => void) => { callbacks.push(callback); };
    call('playReviewVideo', reviewEvent()); call('onHide');
    callbacks.forEach(callback => callback());
    expect(page.data['reviewVideo']).toBeNull();
    expect(page.data['assessmentVisible']).toBe(false);
});

test('successful shipment refresh releases busy and permits the next visible action', async () => {
    const before = personalOrder('LESSOR');
    before.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(before));
    await load('order-detail');
    const after = personalOrder('LESSOR', 'OUTBOUND'); after.order.allowed_actions = [{ action_code: 'CORRECT_SHIPMENT', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(after));
    mocks.ship.mockReturnValue(response(after));
        await call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } });
        call('inputShipment', { currentTarget: { dataset: { field: 'trackingInput' } }, detail: { value: '001234ABC' } });
        await call('submitShipment');
        expect(mocks.ship).toHaveBeenCalledWith('o1', { tracking_no: '001234ABC', carrier: null }, '"object:1"');
    expect(page.data['busy']).toBe(false);
    await call('handleAction', { currentTarget: { dataset: { code: 'CORRECT_SHIPMENT' } } });
    expect(page.data).toMatchObject({ shipmentSheet: true, shipmentCorrection: true });
    expect(mocks.createPayment).not.toHaveBeenCalled();
    expect(payment).not.toHaveBeenCalled();
    expect(page.data['busy']).toBe(false);
});

test('detail confirm entry opens frozen checkout once without confirming or paying', async () => {
    const value = order(); value.order.stage = 'PREPARING'; value.order.allowed_actions = [{ action_code: 'CONFIRM_ORDER', allowed: true, display_reason: null }];
    Object.assign(value, { hold_expires_at: '2999-10-10T00:30:00Z', contract_id: 'c1' });
    more.contract.mockReturnValue(response(preparationSignedContract()));
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    await call('handleAction', { currentTarget: { dataset: { code: 'CONFIRM_ORDER' } } }); await call('runAction', 'CONFIRM_ORDER');
    expect(wx.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/confirm/index?orderId=o1' }));
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled(); expect(page.data['busy']).toBe(false);
});
function preparationSignedContract() {
    return { contract_id: 'c1', order_id: 'o1', expires_at: '2999-10-10T01:00:00Z', status: 'SUCCEEDED', tenant_signature: { status: 'SUCCEEDED', signed_at: '2026-10-10T00:00:00Z' }, current_attempt: null, blockers: [], final_artifact: { artifact_id: 'a1', document_sha256: 'a'.repeat(64), document_url: mediaOrigin + '/test/a.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'm1', sha256: 'b'.repeat(64), url: mediaOrigin + '/test/a.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: 0, y: 0, w: .5, h: .5 }] } };
}
test('official in-use detail preserves frozen accessories and a permission-bound original contract entry', async () => {
    const value = order(); Object.assign(value.order, { stage: 'ACTIVE', physical_status: 'IN_USE', supply_channel: 'OFFICIAL_CABINET', rental_end_at: '2999-10-10T00:00:00Z', allowed_actions: ['SAVE_RETURN_EVIDENCE', 'VIEW_CONTRACT'].map(action_code => ({ action_code, allowed: true, display_reason: null })) });
    value.delivery.method = 'CABINET'; Object.assign(value, { return_id: null, contract_id: 'c1', asset_snapshot: { accessories: [{ name: '冻结镜头', quantity: 2 }], description: '', condition_description: '', physical_identifier_display: null } });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data).toMatchObject({ returnLanding: true, viewContract: true, assetFacts: [{ label: '随附配件', value: '冻结镜头 × 2' }], depositSettlementVisible: false });
    expect(page.data['returnGuideOpen']).toBe(false);
    await call('toggleReturnPreparation'); expect(page.data['returnGuideOpen']).toBe(true);
    await call('toggleReturnPreparation'); expect(page.data['returnGuideOpen']).toBe(false);
    await call('handleAction', { currentTarget: { dataset: { code: 'VIEW_CONTRACT' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/contract/index?orderId=o1' }));
    expect(mocks.saveReturnEvidence).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
});

test.each([
    ['PERSONAL', '2026-10-10T00:00:00Z', '2026-10-13T00:00:00Z', '个人', true],
    ['OFFICIAL_CABINET', '2026-10-10T00:00:00Z', '2026-10-13T00:00:00Z', '官方', true],
    ['PERSONAL', '2026-10-10T00:00:00Z', '2026-10-13T12:00:00Z', '个人', false],
    ['PERSONAL', 'invalid', 'invalid', '个人', false],
])('payment product summary derives only actual channel and whole duration: %s %s %s', async (channel, start, end, label, wholeDays) => {
    const value = order(); Object.assign(value.order, { supply_channel: channel, rental_start_at: start, rental_end_at: end });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['paymentSummary']).toContain(label);
    if (wholeDays) expect(page.data['paymentSummary']).toContain('共3天');
    else expect(page.data['paymentSummary']).not.toContain('共');
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled();
});
test('a contract expiring while detail remains open blocks confirmation before navigation', async () => {
    const value = order(); value.order.stage = 'PREPARING'; value.order.allowed_actions = [{ action_code: 'CONFIRM_ORDER', allowed: true, display_reason: null }];
    Object.assign(value, { hold_expires_at: '2999-10-10T02:00:00Z', contract_id: 'c1' });
    more.contract.mockReturnValue(response(preparationSignedContract())); mocks.get.mockReturnValue(response(value));
    await load('order-detail'); expect(page.data['preparationPage']).toMatchObject({ canConfirm: true });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2999-10-10T01:01:00Z'));
    try {
        await call('runAction', 'CONFIRM_ORDER');
        expect(wx.navigateTo).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
        expect(page.data['preparationPage']).toMatchObject({ signed: true, expired: true, canConfirm: false });
    } finally { clock.mockRestore(); }
});
test.each(['expired', 'contract-unavailable', 'wrong-contract'])('preparing detail keeps %s safe with a single recovery task', async reason => {
    const value = order(); value.order.stage = 'PREPARING'; value.order.allowed_actions = [{ action_code: 'CONFIRM_ORDER', allowed: true, display_reason: null }];
    Object.assign(value, { hold_expires_at: reason === 'expired' ? '2020-01-01T00:00:00Z' : '2999-01-01T00:00:00Z', contract_id: 'c1' });
    const c = preparationSignedContract(); if (reason === 'wrong-contract') c.order_id = 'other';
    more.contract.mockReturnValue(reason === 'contract-unavailable' ? { promise: Promise.reject(new Error('读取失败')), abort: vi.fn() } : response(c));
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['preparationPage']).toMatchObject({ canConfirm: false, primaryCode: '' });
    expect(page.data['resultPage']).toMatchObject({ kind: '' });
    await call('runAction', 'CONFIRM_ORDER'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.createPayment).not.toHaveBeenCalled();
});
test.each(['hidden', 'changed-account', 'loading', 'lessor', 'confirmed'])('detail confirm entry rejects %s context', async reason => {
    const value = order(); value.order.stage = reason === 'confirmed' ? 'ACTIVE' : 'PREPARING'; value.order.viewer_role = reason === 'lessor' ? 'LESSOR' : 'TENANT';
    value.order.allowed_actions = [{ action_code: 'CONFIRM_ORDER', allowed: true, display_reason: null }]; mocks.get.mockReturnValue(response(value)); await load('order-detail');
    if (reason === 'hidden') call('onHide'); if (reason === 'changed-account') mocks.owner = 'other'; if (reason === 'loading') page.setData({ loading: true });
    await call('runAction', 'CONFIRM_ORDER'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
});
test('a later bill read wins without invalidating the command lifecycle lease', async () => {
    mocks.get.mockReturnValue(response(reviewedOrder())); await load('order-detail');
    let finishOld!: (value: unknown) => void, finishNew!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce({ promise: new Promise(done => finishOld = done), abort: vi.fn() });
    const oldRead = call('refreshStatus');
    mocks.get.mockReturnValueOnce({ promise: new Promise(done => finishNew = done), abort: vi.fn() });
    const newRead = call('refreshStatus');
    const latest = reviewedOrder();
    latest.order.display_status = '最新审核';
    finishNew({ value: latest, etag: '"order:latest:2"' }); await newRead;
    finishOld({ value: order(), etag: '"order:old:1"' }); await oldRead;
    expect(page.data['status']).toBe('最新审核');
    expect(page.data['assessmentVisible']).toBe(true);
    expect(page.data['loading']).toBe(false);
});

function deferredResponse() {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    return { promise: new Promise<unknown>((done, fail) => { resolve = done; reject = fail; }), resolve: (value: unknown) => resolve(value), reject: (error: unknown) => reject(error), abort: vi.fn() };
}
test.each([false, true])('detail shipment session loss after a newer read (pending=%s) still clears private state', async readingPending => {
    const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }];
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    Object.assign(page.data, { shipmentSheet: true, trackingInput: '001-original', carrierInput: '测试快递', shipmentCorrection: false });
    const shipment = deferredResponse(); mocks.ship.mockReturnValueOnce(shipment); const writing = call('submitShipment');
    await vi.waitFor(() => expect(mocks.ship).toHaveBeenCalledOnce());
    const latest = deferredResponse(); if (readingPending) mocks.get.mockReturnValueOnce(latest);
    const reading = call('refreshStatus'); if (!readingPending) await reading;
    mocks.owner = null; shipment.reject(new Error('登录失效')); await writing;
    expect(page.data).toMatchObject({ busy: false, loading: false, loaded: false, actions: [], trackingInput: '', recipient: '' }); expect(page.data['errorText']).toContain('登录');
    if (readingPending) { latest.resolve({ value, etag: '"ORDER:o1:1"' }); await reading; expect(page.data['loaded']).toBe(false); }
    expect(mocks.ship).toHaveBeenCalledOnce();
});
test('detail superseded return subread can expire the current session after a newer order has loaded', async () => {
    const value = order(); value.return_id = 'return-1'; mocks.get.mockReturnValue(response(value)); mocks.return.mockReturnValue(response(returnValue(null), '"RETURN:return-1:1"'));
    await load('order-detail'); const olderReturn = deferredResponse(); mocks.return.mockReturnValueOnce(olderReturn); const count = mocks.return.mock.calls.length;
    const older = call('refreshStatus'); await vi.waitFor(() => expect(mocks.return).toHaveBeenCalledTimes(count + 1));
    await call('refreshStatus'); expect(page.data['loaded']).toBe(true); mocks.owner = null; olderReturn.reject(new Error('登录失效')); await older;
    expect(page.data).toMatchObject({ loaded: false, loading: false, busy: false, actions: [], returnAddress: '' }); expect(page.data['errorText']).toContain('登录');
});
test.each([null, 'another-tenant'])('detail read ends loading without showing the old order when session becomes %s', async owner => {
    await load('order-detail');
    const pending = deferredResponse(); mocks.get.mockReturnValueOnce(pending);
    const reading = call('refreshStatus');
    expect(page.data['loading']).toBe(true);
    mocks.owner = owner;
    if (owner === null) {
        const { ApiProblem } = await import('../miniprogram/shared/api/problem');
        pending.reject(new ApiProblem(401, { code: 'UNAUTHORIZED', message: '登录已失效', request_id: 'expired-session' }));
    } else pending.resolve({ value: reviewedOrder(), etag: '"old-owner:1"' });
    await reading;
    expect(page.data).toMatchObject({ loading: false, loaded: false, actions: [], pickupCode: '', recipient: '', tracking: '', assessmentVisible: false });
    expect(page.data['errorText']).toContain('登录');
    const calls = mocks.get.mock.calls.length;
    await call('refreshStatus');
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    expect(page.data['loading']).toBe(false);
});
test('detail read does not repaint after a hidden page loses its session', async () => {
    await load('order-detail');
    const pending = deferredResponse(); mocks.get.mockReturnValueOnce(pending);
    const reading = call('refreshStatus'); call('onHide'); mocks.owner = null;
    const hidden = structuredClone(page.data);
    pending.reject(new Error('登录已失效')); await reading;
    expect(page.data).toEqual(hidden);
});
test('detail return read clears the already loaded order when authentication expires', async () => {
    await load('order-detail');
    const pending = deferredResponse(); mocks.return.mockReturnValueOnce(pending);
    const reading = call('refreshStatus');
    await vi.waitFor(() => expect(page.data['loaded']).toBe(true));
    mocks.owner = null; pending.reject(new Error('登录已失效')); await reading;
    expect(page.data).toMatchObject({ loading: false, loaded: false, actions: [], returnAddress: '', returnVersion: '', orderNo: '' });
    expect(page.data['errorText']).toContain('登录');
});
test('detail read from a previous account cannot clear a newer visible order', async () => {
    await load('order-detail');
    const pending = deferredResponse(); mocks.get.mockReturnValueOnce(pending);
    const reading = call('refreshStatus');
    mocks.owner = 'new-tenant'; const newer = order(); newer.order.order_no = 'NEW-OWNER';
    mocks.get.mockReturnValue(response(newer)); call('onShow'); await call('refreshStatus');
    const shown = structuredClone(page.data);
    pending.reject(new Error('old request rejected')); await reading;
    expect(page.data).toEqual(shown);
    expect(page.data).toMatchObject({ loaded: true, loading: false, orderNo: 'NEW-OWNER', errorText: '' });
});
test('detail session expiry preserves the original unknown address application', async () => {
    const { r } = lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new Error('应用结果未知')), abort: vi.fn() });
    await call('submitReturnAddress'); expect(page.data['returnPending']).toBe(true);
    const originalCall = structuredClone(more.returnAddress.mock.calls[0]);
    const pending = deferredResponse(); mocks.get.mockReturnValueOnce(pending);
    const reading = call('refreshStatus'); mocks.owner = null; pending.reject(new Error('登录已失效')); await reading;
    expect(page.data).toMatchObject({ loaded: false, returnSheet: '', addressOptions: [] });
    call('onHide'); call('onShow'); await call('refreshStatus');
    mocks.owner = 'tenant'; call('onShow'); await call('openReturnSheet', 'address');
    expect(page.data['returnPending']).toBe(true); expect(more.returnAddress).toHaveBeenCalledOnce();
    more.returnAddress.mockImplementation(() => { r.address = { source_id: 'own-address' } as never; return response(r); });
    await call('submitReturnAddress');
    expect(more.returnAddress).toHaveBeenCalledTimes(2); expect(more.returnAddress.mock.calls[1]).toEqual(originalCall);
    expect(detail.create).not.toHaveBeenCalled(); expect(detail.update).not.toHaveBeenCalled();
});
test.each(['shipment', 'receipt', 'address-apply', 'address-list', 'payment'] as const)('detail %s failure after session removal ends activity without a replacement request', async kind => {
    if (kind === 'receipt') lessorReturn();
    else if (kind.startsWith('address')) lessorReturn('SET_RETURN_ADDRESS');
    else if (kind === 'shipment') {
        const value = personalOrder('LESSOR'); value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }];
        value.order.viewer_role = 'LESSOR'; mocks.get.mockReturnValue(response(value));
    }
    await load('order-detail');
    if (kind.startsWith('address')) await call('openReturnSheet', 'address');
    const pending = deferredResponse(); let command: Promise<unknown>;
    const target = kind === 'shipment' ? mocks.ship : kind === 'receipt' ? mocks.receipt : kind === 'address-apply' ? more.returnAddress : kind === 'address-list' ? detail.list : mocks.createPayment;
    target.mockReturnValueOnce(pending);
    if (kind === 'shipment') {
        await call('handleAction', { currentTarget: { dataset: { code: 'SHIP' } } }); page.data['trackingInput'] = 'TRACK123';
        command = call('submitShipment') as Promise<unknown>;
    } else if (kind === 'receipt') {
        await call('openReturnSheet', 'receipt'); Object.assign(page.data, { receiptDate: '2026-10-06', receiptTime: '18:30' });
        command = call('submitReceipt') as Promise<unknown>;
    } else if (kind.startsWith('address')) {
        call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
        if (kind === 'address-list') detail.list.mockClear();
        command = call(kind === 'address-apply' ? 'submitReturnAddress' : 'showOwnReturnAddresses') as Promise<unknown>;
    } else command = call('runAction', 'PAY_INITIAL') as Promise<unknown>;
    await vi.waitFor(() => expect(target).toHaveBeenCalledOnce());
    mocks.owner = null;
    const { ApiProblem } = await import('../miniprogram/shared/api/problem');
    pending.reject(new ApiProblem(401, { code: 'UNAUTHORIZED', message: '登录失效', request_id: 'synthetic-401' }));
    await command;
    expect(page.data).toMatchObject({ loaded: false, busy: false, returnBusy: false, addressListBusy: false, shipmentSheet: false, returnSheet: '', actions: [] });
    expect(page.data['errorText']).toContain('登录'); expect(target).toHaveBeenCalledOnce();
    expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test.each(['shipment', 'payment'] as const)('detail %s pending across hide cannot leave the reshown order permanently busy', async kind => {
    const value = kind === 'shipment' ? personalOrder('LESSOR') : order(); if (kind === 'shipment') { value.order.viewer_role = 'LESSOR'; value.order.allowed_actions = [{ action_code: 'SHIP', allowed: true, display_reason: null }]; }
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    const pending = deferredResponse(), target = kind === 'shipment' ? mocks.ship : mocks.createPayment;
    target.mockReturnValueOnce(pending);
    page.data['trackingInput'] = 'TRACK123';
    if (kind === 'shipment') page.data['shipmentSheet'] = true;
    const command = call(kind === 'shipment' ? 'submitShipment' : 'runAction', 'PAY_INITIAL');
    await vi.waitFor(() => expect(target).toHaveBeenCalledOnce()); expect(page.data['busy']).toBe(true);
    call('onHide'); call('onShow'); await call('refreshStatus');
    expect(page.data).toMatchObject({ busy: false, loading: false, loaded: true });
    const shown = structuredClone(page.data); pending.reject(new Error('old command result unknown')); await command;
    expect(page.data).toEqual(shown); expect(target).toHaveBeenCalledOnce(); expect(payment).not.toHaveBeenCalled();
});
test('detail temporary logged-out view never restores another account unknown address request', async () => {
    lessorReturn('SET_RETURN_ADDRESS'); await load('order-detail'); await call('openReturnSheet', 'address');
    call('chooseOwnReturnAddress', { currentTarget: { dataset: { id: 'own-address' } } });
    more.returnAddress.mockReturnValueOnce({ promise: Promise.reject(new Error('unknown')), abort: vi.fn() }); await call('submitReturnAddress');
    expect(page.data['returnPending']).toBe(true);
    call('onHide'); mocks.owner = null; call('onShow'); await call('refreshStatus');
    mocks.owner = 'new-tenant'; call('onShow'); await call('openReturnSheet', 'address');
    expect(page.data).toMatchObject({ returnPending: false, selectedAddressId: '' });
    expect(detail.create).not.toHaveBeenCalled(); expect(more.returnAddress).toHaveBeenCalledOnce();
});

test('review notes keep semantic keys when adjustment and rejection text coincide', async () => {
    const value = reviewedOrder();
    const assessment = (value.bill as unknown as { assessment: { adjustment_reason: string; rejection_reason: string } }).assessment;
    assessment.adjustment_reason = assessment.rejection_reason;
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['assessmentNotes']).toEqual([
        { key: 'rejection', text: '请补充设备外观照片' },
        { key: 'adjustment', text: '请补充设备外观照片' },
        { key: 'missingItems', text: '待补充凭证：请补充设备外观照片' },
    ]);
});

function receivedReview(role = 'TENANT', review = 'PENDING') {
    const value = Object.assign(order(), { earning_id: null as string | null });
    Object.assign(value.order, { viewer_role: role, supply_channel: 'PERSONAL', stage: 'ACTIVE', physical_status: 'RECEIVED', review_status: review, display_status_code: 'RETURN_REVIEW', allowed_actions: [] });
    const slot = { slot_key: 'inspection', title: '验机视频', kind: 'VIDEO', stage: 'PRE_RETURN', instruction: '展示开机和功能', min_count: 1, max_count: 1, sort_order: 0, example: null };
    const record = { ...returnValue('2026-10-08T02:00:00Z'), received_at: '2026-10-08T04:00:00Z', receipt_source: 'LESSOR', receipt_recorded_at: '2026-10-08T04:01:00Z', material_status: review === 'MATERIAL_REQUIRED' ? 'INCOMPLETE' : 'COMPLETE', evidence_slots: [{ slot, items: [], editable: review === 'MATERIAL_REQUIRED' && role === 'TENANT', complete: review !== 'MATERIAL_REQUIRED' }], missing_items: review === 'MATERIAL_REQUIRED' ? [{ slot_key: 'inspection', item_no: 1, evidence_id: null, reason: '请补充开机视频' }] : [] };
    mocks.get.mockReturnValue(response(value)); mocks.return.mockReturnValue(response(record)); return { value, record };
}
function postedEarning(patch: Record<string, unknown> = {}) { return { earning_id: 'earning-original', order_id: 'o1', beneficiary_kind: 'PERSONAL', currency: 'CNY', posted_at: '2026-10-09T04:00:00Z', ...patch }; }

test.each([['MATERIAL_REQUIRED', 'F3'], ['PENDING', 'F4'], ['DISPUTED', 'F5']])('received tenant %s selects %s without refund amounts', async (status, code) => {
    receivedReview('TENANT', status); await load('order-detail');
    expect(page.data).toMatchObject({ returnReviewPage: { code, received: '2026-10-08 12:00', booked: false }, depositSettlementVisible: false });
    expect(JSON.stringify(page.data['returnReviewPage'])).not.toContain('¥'); expect(more.earning).not.toHaveBeenCalled();
});
test('material changes select F3 then F4 while receipt stays unchanged; stale assessment cannot keep F3', async () => {
    const { value, record } = receivedReview('TENANT', 'MATERIAL_REQUIRED'); await load('order-detail');
    call('openReviewEvidence', { currentTarget: { dataset: { mode: 'supplement' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&mode=supplement' }));
    value.order.review_status = 'PENDING'; record.material_status = 'COMPLETE'; record.missing_items = []; record.evidence_slots[0]!.complete = true;
    Object.assign(value.bill, { assessment: { decision: 'MATERIAL_REQUIRED', missing_items: [], loss_items: [], evidence: [], created_at: '2026-10-08T05:00:00Z' } });
    await call('refreshStatus'); expect(page.data['returnReviewPage']).toMatchObject({ code: 'F4', received: '2026-10-08 12:00' });
    expect(page.data['returnReviewPage']).toHaveProperty('steps', expect.arrayContaining([expect.objectContaining({ label: '材料已提交', done: true }), expect.objectContaining({ label: '官方审核中', done: false })]));
});
test('official REVIEW_PENDING displays its public reason without a made-up update time or amount', async () => {
    const { value } = receivedReview(); Object.assign(value.bill, { assessment: { decision: 'REVIEW_PENDING', rejection_reason: '镜头外壳需核实', missing_items: [], loss_items: [], evidence: [], created_at: '2026-10-09T06:00:00Z' } });
    await load('order-detail'); expect(page.data['returnReviewPage']).toMatchObject({ code: 'F5', reason: '镜头外壳需核实' });
    expect(page.data['returnReviewPage']).toHaveProperty('steps', expect.arrayContaining([expect.objectContaining({ key: 'review', detail: '2026-10-09 14:00' })]));
});
test.each(['wrong-return', 'wrong-order', 'missing-receipt', 'invalid-time', 'no-source', 'unreturned', 'unpaid'])('review presentation rejects %s', async kind => {
    const { value, record } = receivedReview();
    if (kind === 'wrong-return') record.return_id = 'other'; if (kind === 'wrong-order') record.order_id = 'other';
    if (kind === 'missing-receipt') Object.assign(record, { received_at: null }); if (kind === 'invalid-time') record.received_at = 'invalid'; if (kind === 'no-source') record.receipt_source = '';
    if (kind === 'unreturned') value.order.physical_status = 'IN_USE'; if (kind === 'unpaid') value.order.stage = 'AWAITING_PAYMENT';
    await load('order-detail'); expect(page.data['returnReviewPage']).toBeNull(); call('openReviewEvidence', { currentTarget: { dataset: { mode: 'supplement' } } }); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test.each(['MATERIAL_REQUIRED', 'PENDING', 'DISPUTED', 'FINAL'])('lessor %s stays E8 with read-only evidence and no tenant actions', async status => {
    const { value } = receivedReview('LESSOR', status); if (status === 'FINAL') value.bill.finalized = true;
    await load('order-detail'); expect(page.data['returnReviewPage']).toMatchObject({ code: 'E8', lessor: true, canSupplement: false, booked: false });
    call('openReviewEvidence', { currentTarget: { dataset: { mode: 'supplement' } } }); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('openReviewEvidence', { currentTarget: { dataset: { mode: 'record' } } }); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/return-submit/index?orderId=o1&mode=record' }));
    expect(page.data['settlementPage']).toBeNull(); expect(page.data['completionPage']).toBeNull();
});
test('completed lessor opens only the original verified earning in the existing wallet', async () => {
    const { value } = receivedReview('LESSOR', 'FINAL'); value.order.stage = 'COMPLETED'; value.earning_id = 'earning-original'; value.bill.finalized = true;
    more.earning.mockReturnValue(response(postedEarning())); await load('order-detail');
    expect(page.data['returnReviewPage']).toMatchObject({ code: 'E4', booked: true }); expect(more.earning).toHaveBeenCalledWith('earning-original');
    call('openOrderEarning'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/wallet/index?earningId=earning-original&orderId=o1' }));
});
test.each([{ earning_id: 'foreign' }, { order_id: 'foreign' }, { beneficiary_kind: 'MERCHANT' }, { currency: 'USD' }, { posted_at: null }])('completed lessor never claims or opens mismatched earning %j', async patch => {
    const { value } = receivedReview('LESSOR', 'FINAL'); value.order.stage = 'COMPLETED'; value.earning_id = 'earning-original'; value.bill.finalized = true;
    more.earning.mockReturnValue(response(postedEarning(patch))); await load('order-detail');
    expect(page.data['returnReviewPage']).toMatchObject({ code: 'E4', booked: false }); expect(page.data['earningError']).toContain('不匹配'); call('openOrderEarning'); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('completed lessor without earning ID stays honestly unverified and never reads an invented ID', async () => {
    const { value } = receivedReview('LESSOR', 'FINAL'); value.order.stage = 'COMPLETED'; value.bill.finalized = true;
    await load('order-detail'); expect(page.data['returnReviewPage']).toMatchObject({ code: 'E4', booked: false }); expect(more.earning).not.toHaveBeenCalled();
});
test('late earnings after account changes cannot repaint a private completion page', async () => {
    const { value } = receivedReview('LESSOR', 'FINAL'); value.order.stage = 'COMPLETED'; value.earning_id = 'earning-original'; value.bill.finalized = true;
    more.earning.mockReturnValue(response(postedEarning())); await load('order-detail'); const pending = deferredResponse(); more.earning.mockReturnValue(pending);
    const reading = call('refreshStatus'); await vi.waitFor(() => expect(page.data['returnReviewPage']).toMatchObject({ code: 'E4', booked: false }));
    mocks.owner = 'another'; pending.resolve(postedEarning()); await reading;
    expect(page.data).toMatchObject({ returnReviewPage: null, loaded: false, earningError: '' }); call('openOrderEarning'); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('fixed-ten payment invokes only the frozen channel amount while retaining business price', async () => {
    const original = paymentValue({ payment_mode: 'FIXED_10_FEN', business_amount_fen: '11000', channel_amount_fen: '10', amount_fen: '10' });
    mocks.createPayment.mockReturnValue(response(original));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL');
    expect(mocks.invocation).toHaveBeenCalledWith('p1', '"object:1"');
    expect(payment).toHaveBeenCalledTimes(1);
});
test.each([
    { channel_amount_fen: '11', amount_fen: '11' },
    { business_amount_fen: '1' },
    { payment_mode: 'NORMAL' },
])('fixed-ten validation rejects mismatched frozen amounts %j', async patch => {
    mocks.createPayment.mockReturnValue(response(paymentValue({ payment_mode: 'FIXED_10_FEN', business_amount_fen: '11000', channel_amount_fen: '10', amount_fen: '10', ...patch })));
    await load('order-detail'); await call('runAction', 'PAY_INITIAL');
    expect(mocks.invocation).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
test('test payment banner labels simulated business coverage separately from cash', async () => {
    const value = order(); value.order.payment_mode = 'FIXED_10_FEN'; value.bill.payment_mode = 'FIXED_10_FEN';
    Object.assign(value.bill, paymentReferences(paymentValue({ payment_mode: 'FIXED_10_FEN', business_amount_fen: '11000', channel_amount_fen: '10', amount_fen: '10' })));
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    expect(page.data['testPaymentNotice']).toContain('业务押金覆盖不代表实际收款');
});

test('pickup code displays on initial load without an extra reveal action', async () => {
    mocks.get.mockReturnValue(response(officialPickup(true)));
    await load('order-detail');
    expect(page.data).toMatchObject({ pickupVisible: true, pickupCode: '001234' });
    const template = readFileSync(new URL('../miniprogram/pages/order-detail/index.wxml', import.meta.url), 'utf8');
    expect(template).toContain('wx:if="{{pickupVisible}}" class="pickup-order-code"');
    expect(template).not.toContain('>查看取件码</button>');
    call('onHide'); expect(page.data).toMatchObject({ pickupVisible: false, pickupCode: '' });
});
test('order cabinet detail and navigation use the bound cabinet and ignore a late location result', async () => {
    const { cabinetApi } = await import('../miniprogram/shared/api/supply-api');
    const value = officialPickup(true); Object.assign(value, { pickup: { cabinet_id: 'cab-order', name: '取还柜', address: '兴湖街', compartment_no: 1 } });
    mocks.get.mockReturnValue(response(value)); await load('order-detail');
    call('openOrderCabinet'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-detail/index?id=cab-order' }));
    const openLocation = vi.fn(); Object.assign(wx, { openLocation });
    const cabinet = { cabinet_id: 'cab-order', name: '取还柜', address: { province_name: '江苏省', city_name: '南京市', district_name: '江宁区', detail_address: '兴湖街', location: { coordinate_system: 'GCJ02', latitude: '31.900000', longitude: '118.800000' } } };
    const spy = vi.spyOn(cabinetApi, 'detail').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve(cabinet) } as never);
    await call('navigateOrderCabinet'); expect(spy).toHaveBeenCalledWith('cab-order');
    expect(openLocation).toHaveBeenCalledWith(expect.objectContaining({ latitude: 31.9, longitude: 118.8, name: '取还柜' }));
    openLocation.mockClear(); let resolve!: (value: unknown) => void;
    spy.mockReturnValue({ abort: vi.fn(), promise: new Promise(r => { resolve = r; }) } as never);
    const pending = call('navigateOrderCabinet'); call('onHide'); resolve(cabinet); await pending;
    expect(openLocation).not.toHaveBeenCalled(); spy.mockRestore();
});
