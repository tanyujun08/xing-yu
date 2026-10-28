import { beforeEach, afterEach, expect, test, vi } from 'vitest';
const extras = vi.hoisted(() => ({ cabinets: vi.fn(), reserveCabinet: vi.fn(), cancelCabinet: vi.fn(), queryCabinet: vi.fn(), earning: vi.fn() }));
const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, supply: vi.fn(), quote: vi.fn(), get: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), pendingPreparation: vi.fn(), lookup: vi.fn(), cabinetEntry: vi.fn(), pendingPickup: vi.fn(), pickupTask: vi.fn(), rememberPickupTask: vi.fn(), forgetPickupTask: vi.fn(), pickup: vi.fn(), openCabinet: vi.fn(), pickupCredential: vi.fn(), task: vi.fn(), contract: vi.fn(), income: vi.fn(), earnings: vi.fn(), list: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem, accountApi: { sessionIdentity: () => m.owner }, findOwnAddress: vi.fn().mockResolvedValue({ address_id: 'address-1', contact_name: '收件人', phone: '13800000000', province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail: '测试地址' }), couponApi: { list: vi.fn().mockReturnValue({ promise: Promise.resolve({ items: [], page: { has_more: false, next_cursor: null } }) }) } }));
vi.mock('../miniprogram/shared/api/supply-api', () => ({ supplyApi: { get: m.supply } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: { ...m, ...extras } }));
type Harness = {
    data: Record<string, unknown>;
    setData(p: Record<string, unknown>): void;
    [key: string]: unknown;
};
let definition: Harness;
let page: Harness | undefined;
const result = (value: unknown, etag = '"obj:1"') => ({ promise: Promise.resolve({ value, etag }), abort: vi.fn() });
const action = (action_code: string, allowed = true) => ({ action_code, allowed, display_reason: allowed ? null : '服务端阻断' });
const tick = async () => { for (let n = 0; n < 14; n++)
    await Promise.resolve(); };
const fees = { rent_gross_fen: '1000', rent_discount_fen: '0', deposit_due_fen: '10000', initial_due_fen: '11000' };
function order() { return { order: { order_id: 'o1', order_no: 'N1', viewer_role: 'TENANT', asset: { asset_id: 'a1', title: '相机' }, stage: 'PREPARING', display_status: '待签约', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z', blockers: [], allowed_actions: [action('CONFIRM_ORDER', false)] }, contract_id: 'c1', delivery: { method: 'CABINET', recipient: null }, fees, hold_expires_at: '2026-10-06T00:30:00Z', payment_due_at: null }; }
function checkoutContract(signed = false) { return { contract_id: 'c1', order_id: 'o1', status: signed ? 'SUCCEEDED' : 'PENDING', expires_at: '2026-10-07T00:30:00Z', tenant_signature: { account_id: 'tenant', status: signed ? 'SUCCEEDED' : 'PENDING', signed_at: signed ? '2026-10-06T00:00:00Z' : null }, final_artifact: signed ? { artifact_id: 'artifact-1', document_sha256: 'a'.repeat(64), document_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'page-1', sha256: 'b'.repeat(64), url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: .1, y: .5, w: .4, h: .1 }] } : null }; }
function call(name: string, ...args: unknown[]) { return (page![name] as (...v: unknown[]) => unknown).apply(page, args); }
async function mount(route: string, options: Record<string, string> = {}) { vi.stubGlobal('Page', (v: Harness) => definition = v); await import('../miniprogram/pages/' + route + '/index.ts'); page = { ...definition, data: structuredClone(definition.data), setData(p) { for (const [key, value] of Object.entries(p)) { const indexed = /^items\[(\d+)\]$/.exec(key); if (indexed) (this.data['items'] as unknown[])[Number(indexed[1])] = value; else this.data[key] = value; } } }; if (typeof page['onLoad'] === 'function')
    call('onLoad', options); call('onShow'); await tick(); }
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T00:00:00Z')); vi.resetModules(); vi.clearAllMocks(); page = undefined; m.owner = 'tenant'; m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'CABINET', pickup_location: { cabinet_id: 'cabinet-1', name: '冻结取件柜', address: { province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail_address: '科苑路一号大厅' } },  display_name: '相机', media: [], rental_mode: 'DAY' }), abort: vi.fn() }); m.quote.mockReturnValue(result({ fees, terms_hash: 'a'.repeat(64), blockers: [] })); m.get.mockReturnValue(result(order())); m.prepare.mockReturnValue(result(order())); m.confirm.mockReturnValue(result(order())); m.pendingPreparation.mockReturnValue(null); m.pendingPickup.mockReturnValue(null); m.pickupTask.mockReturnValue(null); m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose: 'PICKUP', status: 'VERIFYING', allowed_actions: [action('QUERY_CABINET')], blockers: [], door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', observed_at: null })); m.cabinetEntry.mockReturnValue(result({ name: '测试柜', address: '场所', pickup_enabled: true })); m.pickup.mockReturnValue(result({ task_id: 't1', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET')], blockers: [] })); m.openCabinet.mockReturnValue(result({ task_id: 't1', status: 'UNKNOWN' })); m.lookup.mockReturnValue(result({ state: 'UNKNOWN', result: null, retry_same_request: false })); m.pickupCredential.mockReturnValue(result({ pickup_code: '001234', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z' })); m.income.mockReturnValue(result({ booked_income_fen: '24000', estimated_income_fen: '1000', estimated_order_count: 2 })); m.earnings.mockReturnValue(result({ items: [], has_more: false, next_cursor: null })); m.list.mockReturnValue(result({ items: [], has_more: false, next_cursor: null })); vi.stubGlobal('wx', { navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), stopPullDownRefresh: vi.fn(), setClipboardData: vi.fn(), showToast: vi.fn() }); });
afterEach(() => { if (page && typeof page['onUnload'] === 'function')
    call('onUnload'); vi.unstubAllGlobals(); vi.useRealTimers(); });
beforeEach(() => { m.contract.mockReturnValue(result(checkoutContract())); });
function setTerm() { Object.assign(page!.data, { startDate: '2026-10-06', endDate: '2026-10-07' }); }
test('checkout explicitly quotes fixed cabinet selection before preparing frozen terms', async () => { await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next'); expect(page!.data['step']).toBe(2); expect(m.prepare).not.toHaveBeenCalled(); expect(m.quote).toHaveBeenCalledWith({ asset_id: 'a1', rental_start_at: '2026-10-05T16:00:00.000Z', rental_end_at: '2026-10-06T16:00:00.000Z', delivery_method: 'CABINET', address_id: null, coupon_id: null }); await call('next'); expect(m.prepare).toHaveBeenCalledWith(expect.objectContaining({ accepted_terms_hash: 'a'.repeat(64) })); expect(m.confirm).not.toHaveBeenCalled(); });
test.each([
    ['LESSOR', 'TENANT', '寄出运费出租方承担', '寄回运费承租人承担'],
    ['TENANT', 'LESSOR', '寄出运费承租人承担', '寄回运费出租方承担'],
])('checkout discloses the actual quote freight pair %s/%s before any preparation', async (outbound, returning, outboundText, returnText) => {
    await mount('confirm', { deviceId: 'a1' }); setTerm();
    page!.setData({ method: 'EXPRESS', addressId: 'address-1' });
    m.quote.mockReturnValue(result({ fees, terms_hash: 'a'.repeat(64), blockers: [], requirements: { outbound_freight_payer: outbound, return_freight_payer: returning } }));
    await call('refreshQuote');
    expect(page!.data).toMatchObject({ outboundFreight: outboundText, returnFreight: returnText, canPrepare: true });
    expect(m.prepare).not.toHaveBeenCalled();
});
test('reviewed quote prepares once and opens the matching unsigned contract without confirming or paying', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('refreshQuote');
    m.contract.mockReturnValue(result(checkoutContract()));
    expect(m.prepare).not.toHaveBeenCalled(); await call('next');
    expect(m.prepare).toHaveBeenCalledTimes(1);
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/contract/index?orderId=o1' }));
    expect(m.confirm).not.toHaveBeenCalled();
});
async function changedQuote() {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next');
    m.prepare.mockReturnValue({ promise: Promise.reject(Object.assign(new Error('报价变化'), { code: 'QUOTE_CHANGED' })), abort: vi.fn() });
    m.quote.mockReturnValue(result({ fees: { ...fees, rent_gross_fen: '2000', initial_due_fen: '12000' }, terms_hash: 'b'.repeat(64), blockers: [] }));
    await call('next');
}
test('changed quotation compares old and new fees and requires explicit review before another preparation', async () => {
    await changedQuote();
    expect(page!.data).toMatchObject({ step: 1, frozen: false, total: '¥120.00', canPrepare: false, errorOpen: false, quoteChange: { latestKnown: true, rows: [
        { label: '原租金', value: '¥10.00' }, { label: '最新租金', value: '¥20.00' }, { label: '租赁押金', value: '¥100.00（不变）' },
        { label: '原应付', value: '¥110.00' }, { label: '最新应付', value: '¥120.00' },
    ] } });
    await call('next'); expect(m.prepare).toHaveBeenCalledTimes(1);
    call('openTermSheet'); call('openVoucherSheet'); call('openAddressBook'); expect(page!.data).toMatchObject({ termSheetOpen: false, voucherSheetOpen: false }); expect(wx.navigateTo).not.toHaveBeenCalled();
    await call('recheckChangedQuote'); expect(page!.data).toMatchObject({ quoteChange: null, step: 1, startDate: '2026-10-06', endDate: '2026-10-07' }); expect(m.prepare).toHaveBeenCalledTimes(1);
    m.prepare.mockReturnValue(result(order())); await call('next'); expect(m.prepare).toHaveBeenCalledTimes(2);
    expect(m.prepare).toHaveBeenLastCalledWith(expect.objectContaining({ accepted_terms_hash: 'b'.repeat(64) })); expect(m.confirm).not.toHaveBeenCalled();
});
test('failed changed quote read preserves old values and retry cannot silently create an order', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next');
    m.prepare.mockReturnValue({ promise: Promise.reject(Object.assign(new Error('变化'), { code: 'QUOTE_CHANGED' })) });
    m.quote.mockReturnValue({ promise: Promise.reject(new Error('报价暂不可用')) }); await call('next');
    expect(page!.data).toMatchObject({ canPrepare: false, quoteChange: { latestKnown: false }, errorText: '报价暂不可用', errorOpen: false });
    await call('recheckChangedQuote'); await call('next'); expect(m.prepare).toHaveBeenCalledTimes(1); expect(page!.data['quoteChange']).not.toBeNull();
});
test('changed quotation recalculates deposit and coupon and retains the selected receiving address', async () => {
    m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'PERSONAL', display_name: '相机', media: [], rental_mode: 'DAY' }) });
    await mount('confirm', { deviceId: 'a1' }); setTerm(); Object.assign(page!.data, { addressId: 'address-1', couponId: 'coupon-1' }); await call('next');
    m.prepare.mockReturnValue({ promise: Promise.reject(Object.assign(new Error('变化'), { code: 'QUOTE_CHANGED' })) });
    m.quote.mockReturnValue(result({ fees: { ...fees, rent_discount_fen: '500', deposit_due_fen: '9000', initial_due_fen: '9500' }, terms_hash: 'b'.repeat(64), blockers: [] })); await call('next');
    expect(page!.data).toMatchObject({ addressId: 'address-1', couponId: 'coupon-1', quoteChange: { rows: expect.arrayContaining([
        expect.objectContaining({ label: '最新租赁押金', value: '¥90.00' }), expect.objectContaining({ label: '最新优惠抵扣', value: '¥5.00' }),
    ]) } });
    await call('recheckChangedQuote'); expect(m.quote).toHaveBeenLastCalledWith(expect.objectContaining({ address_id: 'address-1', coupon_id: 'coupon-1' })); expect(m.prepare).toHaveBeenCalledTimes(1);
});
test('same account returning to quote change must still review; another account gets no old comparison', async () => {
    await changedQuote(); call('onHide'); expect(page!.data['quoteChange']).toBeNull(); call('onShow'); await tick();
    expect(page!.data).toMatchObject({ quoteChange: { latestKnown: true }, canPrepare: false }); await call('next'); expect(m.prepare).toHaveBeenCalledTimes(1);
    call('onHide'); m.owner = 'different'; call('onShow'); await tick(); expect(page!.data).toMatchObject({ quoteChange: null, startDate: '', endDate: '', addressId: '' });
});
test('quote change arriving while hidden is retained for the original owner and never rendered while hidden', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next'); let reject!: (error: unknown) => void;
    m.prepare.mockReturnValue({ promise: new Promise((_resolve, fail) => reject = fail) }); const pending = call('next'); await tick(); call('onHide');
    reject(Object.assign(new Error('变化'), { code: 'QUOTE_CHANGED' })); await pending; expect(page!.data['quoteChange']).toBeNull();
    call('onShow'); await tick(); expect(page!.data).toMatchObject({ quoteChange: { latestKnown: true }, canPrepare: false }); await call('next'); expect(m.prepare).toHaveBeenCalledTimes(1);
});
test.each(['hide', 'owner'])('a late quote recheck after %s cannot unlock preparation', async change => {
    await changedQuote(); let resolve!: (value: unknown) => void; m.quote.mockReturnValue({ promise: new Promise(done => resolve = done) });
    const pending = call('recheckChangedQuote'); await tick(); if (change === 'hide') call('onHide'); else m.owner = 'different';
    resolve({ value: { fees, terms_hash: 'c'.repeat(64), blockers: [] } }); await pending; await call('next'); expect(m.prepare).toHaveBeenCalledTimes(1); expect(page!.data['quoteChange']).toBeNull();
});
test('returning from quote change opens only the original device', async () => {
    await changedQuote(); const redirect = vi.fn(); Object.assign(wx, { redirectTo: redirect }); call('returnToDevice'); call('returnToDevice');
    expect(redirect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/detail/index?id=a1' })); expect(m.prepare).toHaveBeenCalledTimes(1);
});
test('personal checkout fixes EXPRESS and requires own receiving address before quote', async () => { m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'PERSONAL', display_name: '相机', media: [], rental_mode: 'DAY' }) }); await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next'); expect(page!.data['method']).toBe('EXPRESS'); expect(page!.data['errorText']).toContain('收货地址'); expect(m.quote).not.toHaveBeenCalled(); });
test('missing dates cannot silently substitute a rental interval', async () => { await mount('confirm', { deviceId: 'a1' }); await call('next'); expect(m.quote).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled(); expect(page!.data['errorText']).toContain('开始日期和归还日期'); });

test('calendar disables historical dates and reset/cancel only change sheet drafts', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next');
    const previous = { startDate: page!.data['startDate'], endDate: page!.data['endDate'], total: page!.data['total'] };
    call('openTermSheet');
    call('chooseCalendarDate', { currentTarget: { dataset: { date: '2026-10-05' } } });
    expect(page!.data['formStartDate']).toBe('2026-10-06');
    call('resetPricingDates'); expect(page!.data['formStartDate']).toBe('');
    call('closeTermSheet'); expect(page!.data).toMatchObject(previous);
    expect(m.quote).toHaveBeenCalledOnce();
});
test('minimum date range errors use feedback dialog and never call quote', async () => {
    await mount('confirm', { deviceId: 'a1' }); page!.data['minimumDays'] = 3; call('openTermSheet');
    for (const date of ['2026-10-06', '2026-10-08']) call('chooseCalendarDate', { currentTarget: { dataset: { date } } });
    await call('applyTermSheet');
    expect(page!.data).toMatchObject({ errorOpen: true, termSheetOpen: true, startDate: '', total: '—' });
    expect(page!.data['errorText']).toContain('至少租用 3 天'); expect(m.quote).not.toHaveBeenCalled();
});
test('official checkout discloses the authoritative cabinet and full region before preparation', async () => {
    await mount('confirm', { deviceId: 'a1' });
    expect(page!.data['pickupLocation']).toBe('冻结取件柜 广东省 深圳市 南山区 科苑路一号大厅');
    expect(m.prepare).not.toHaveBeenCalled();
});
test('official checkout without a verified pickup location cannot proceed from a region alone', async () => {
    m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'CABINET', pickup_location: null, region: { province_name: '广东省' }, display_name: '相机', media: [] }) });
    await mount('confirm', { deviceId: 'a1' });
    expect(page!.data).toMatchObject({ loaded: false, pickupLocation: '', errorText: expect.stringContaining('取件地点') });
    await call('next'); expect(m.prepare).not.toHaveBeenCalled(); expect(m.quote).not.toHaveBeenCalled();
});
test('open-ended supply availability keeps today and future calendar dates selectable', async () => {
    m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'CABINET', pickup_location: { cabinet_id: 'cabinet-1', name: '冻结取件柜', address: { province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail_address: '科苑路一号大厅' } },  display_name: '相机', media: [], minimum_units: '3', rental_mode: 'DAY', available_from: '2026-10-01T00:00:00Z', available_until: '9999-12-31T23:59:59Z' }) });
    await mount('confirm', { deviceId: 'a1' }); call('openTermSheet');
    expect(page!.data['latestDate']).toBe('9999-12-31');
    call('chooseCalendarDate', { currentTarget: { dataset: { date: '2026-10-05' } } });
    expect(page!.data['formStartDate']).toBe('');
    for (const date of ['2026-10-06', '2026-10-09']) call('chooseCalendarDate', { currentTarget: { dataset: { date } } });
    await call('applyTermSheet');
    expect(page!.data).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-09', termSheetOpen: false });
    expect(m.quote).toHaveBeenCalledOnce();
});
test('failed or cancelled calendar requote preserves accepted dates and fees', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('next'); call('openTermSheet');
    for (const date of ['2026-10-08', '2026-10-11']) call('chooseCalendarDate', { currentTarget: { dataset: { date } } });
    m.quote.mockReturnValue({ promise: Promise.reject(new Error('暂时不可用')), abort: vi.fn() });
    await call('applyTermSheet'); expect(page!.data).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-07', total: '¥110.00', errorOpen: true });
    let resolve!: (value: unknown) => void; m.quote.mockReturnValue({ promise: new Promise(done => resolve = done), abort: vi.fn() });
    const pending = call('applyTermSheet'); await tick(); call('closeTermSheet');
    resolve({ value: { fees: { ...fees, initial_due_fen: '20000' }, terms_hash: 'b'.repeat(64), blockers: [] } }); await pending;
    expect(page!.data).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-07', total: '¥110.00', termSheetOpen: false, canPrepare: true });
});
test('frozen order cannot be confirmed when server requires contract or identity', async () => { await mount('confirm', { orderId: 'o1' }); await call('next'); expect(page!.data).toMatchObject({ frozen: true, canConfirm: false }); expect(m.confirm).not.toHaveBeenCalled(); });
test.each(['AWAITING_PAYMENT', 'ACTIVE', 'COMPLETED', 'CLOSED'])('checkout for existing %s returns to the original order without another confirmation or preparation', async stage => {
    const value = { ...order(), payment_due_at: '2026-10-06T00:10:00Z' }; value.order.stage = stage; m.get.mockReturnValue(result(value));
    await mount('confirm', { orderId: 'o1' });
    expect(page!.data).toMatchObject({ frozenNeedsConfirmation: false, frozenActionText: stage === 'AWAITING_PAYMENT' ? '查看原订单付款状态' : '查看原订单状态' });
    expect(page!.data['deadlineText']).toBe(stage === 'AWAITING_PAYMENT' ? '2026-10-06 08:10' : '');
    await call('next');
    expect(m.confirm).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled();
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-detail/index?id=o1' }));
});
test('unknown preparation queries its original key and never creates a replacement', async () => { m.pendingPreparation.mockReturnValue({ key: 'original-key', body: {} }); await mount('confirm', { deviceId: 'a1' }); expect(m.lookup).toHaveBeenCalledWith('B02', 'original-key'); await call('next'); expect(m.prepare).not.toHaveBeenCalled(); expect(page!.data['errorText']).toContain('原准备请求'); });
test('cabinet entry rejects an order locator and only accepts signed scene shape', async () => { await mount('cabinet-code', { orderId: 'o1', scene: 'forged' }); expect(m.cabinetEntry).not.toHaveBeenCalled(); expect(m.pickupCredential).not.toHaveBeenCalled(); expect(page!.data['loaded']).toBe(false); });
test('six digits keep the leading zero and dispatch only on manual submit', async () => { await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); expect(m.pickup).not.toHaveBeenCalled(); await call('submitCredential'); expect(m.pickup).toHaveBeenCalledWith('cab_12345678901234567890', '001234'); expect(m.openCabinet).toHaveBeenCalledWith('t1', '001234', '"obj:1"'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ feedbackVisible: true, monitoring: true }); expect(m.task).toHaveBeenCalledWith('t1'); expect(m.pickupCredential).not.toHaveBeenCalled(); });
test('UNKNOWN pickup task is queried through its locator without another open command', async () => { m.pickup.mockReturnValue(result({ task_id: 't1', status: 'UNKNOWN', allowed_actions: [action('QUERY_CABINET')], blockers: [] })); await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential'); expect(m.openCabinet).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ feedbackVisible: true, monitoring: true }); expect(m.task).toHaveBeenCalledWith('t1'); });
test('early pickup rereads only the authorized original order and displays its frozen Beijing start without reopening', async () => {
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    m.pickup.mockImplementation(() => ({ promise: Promise.reject(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '当前状态不能执行', request_id: 'early', details: { resource_type: 'rental_order', resource_id: 'o1', reason_code: 'RENTAL_NOT_STARTED' } })), abort: vi.fn() }));
    const original = order(); original.order.rental_start_at = '2026-10-06T16:00:00Z'; m.get.mockReturnValue(result(original));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential');
    expect(m.get).toHaveBeenCalledExactlyOnceWith('o1'); expect(page!.data['errorText']).toContain('2026-10-07'); expect(page!.data['errorText']).not.toContain('00:00'); expect(page!.data['errorText']).toContain('不能提前开柜');
    expect(page!.data).toMatchObject({ busy: false, taskId: '', credentialInput: '001234' });
    expect(m.pickup).toHaveBeenCalledOnce(); expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickupCredential).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test.each(['onHide', 'account'])('early pickup order response is discarded after %s without another command', async (boundary) => {
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    m.pickup.mockImplementation(() => ({ promise: Promise.reject(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '不能提前取件', request_id: 'early', details: { resource_type: 'rental_order', resource_id: 'o1', reason_code: 'RENTAL_NOT_STARTED' } })), abort: vi.fn() }));
    let resolve!: (value: unknown) => void; m.get.mockReturnValue({ promise: new Promise(done => resolve = done), abort: vi.fn() });
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); const pending = call('submitCredential'); await tick(); expect(m.get).toHaveBeenCalledOnce();
    if (boundary === 'onHide') call('onHide'); else m.owner = 'other';
    const before = structuredClone(page!.data); const original = order(); original.order.rental_start_at = '2026-10-06T02:00:00Z'; resolve({ value: original, etag: '"obj:2"' }); await pending;
    if (boundary === 'onHide') expect(page!.data).toEqual(before);
    else { expect(page!.data).toMatchObject({ busy: false, credentialInput: '', taskId: '', loggedIn: false }); expect(page!.data['errorText']).toContain('登录'); }
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickup).toHaveBeenCalledOnce();
});
test('redacted early pickup conflict cannot be used to enumerate an order', async () => {
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    m.pickup.mockImplementation(() => ({ promise: Promise.reject(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '当前状态不能执行', request_id: 'early', details: { resource_type: 'rental_order', resource_id: 'redacted', reason_code: 'RENTAL_NOT_STARTED' } })), abort: vi.fn() }));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential');
    expect(m.get).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ busy: false, errorText: '当前状态不能执行' });
});
test.each([
    ['PICKUP', 'SUCCEEDED', 'TARGET_ABSENT', 'NOT_OBSERVED', '格口为空', '已完成'],
    ['RETURN', 'SUCCEEDED', 'TARGET_PRESENT', 'MATCH', '已检测到设备', '已完成'],
    ['RETURN', 'VERIFYING', 'UNKNOWN', 'NOT_OBSERVED', '待核实', '正在核验'],
])('cabinet result %s/%s renders only authoritative RFID occupancy facts', async (purpose, status, occupancy, rfid, expectedOccupancy, expectedStatus) => {
    m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose, status, door_status: 'CLOSED', occupancy_result: occupancy, rfid_result: rfid, observed_at: '2026-10-06T01:00:00Z', confirmed_at: status === 'SUCCEEDED' ? '2026-10-06T01:00:00Z' : null, allowed_actions: [], blockers: [] }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data).toMatchObject({ occupancy: expectedOccupancy, status: expectedStatus, door: '已关门' });
    expect(page!.data).not.toHaveProperty('power');
    expect(m.openCabinet).not.toHaveBeenCalled();
    if (status !== 'SUCCEEDED') { expect(page!.data['copy']).toContain('等待核验结果'); expect(page!.data['copy']).not.toContain('归还成功'); }
    else if (purpose === 'PICKUP') { expect(page!.data['copy']).toContain('取件完成'); expect(page!.data['copy']).not.toContain('退押'); }
    else { expect(page!.data['copy']).toContain('归还设备'); expect(page!.data['copy']).toContain('官方审核'); }
});
test.each([
    ['PICKUP', 'CANCELLED', '取件结果', '未开柜任务已取消', '取件任务已取消'],
    ['RETURN', 'CANCELLED', '归还进度', '未开柜任务已取消', '归还任务已取消'],
    ['PICKUP', 'FAILED_CONFIRMED', '取件结果', '本次操作未完成', '取件未完成'],
    ['RETURN', 'FAILED_CONFIRMED', '归还进度', '本次操作未完成', '归还未完成'],
])('terminal cabinet %s/%s offers order or customer service without instructing another physical operation', async (purpose, status, title, expectedStatus, description) => {
    m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose, status, door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', rfid_result: 'NOT_OBSERVED', observed_at: null, confirmed_at: null, allowed_actions: [action('OPEN_CABINET', false), action('CANCEL_CABINET', false), action('QUERY_CABINET', false)], blockers: [] }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data).toMatchObject({ title, status: expectedStatus, door: '待核实', rfid: '编号待核实', occupancy: '待核实', canQuery: false });
    expect(page!.data['copy']).toContain(description);
    expect(page!.data['copy']).toContain('返回订单');
    expect(page!.data['copy']).toContain('联系客服');
    expect(page!.data['copy']).not.toMatch(/请取放|关门|再查询|已确认/);
    await call('query'); await call('refresh'); call('goDetail');
    expect(m.task).toHaveBeenCalledTimes(2); expect(m.task).toHaveBeenLastCalledWith('t1');
    expect(extras.queryCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-detail/index?id=o1' }));
});
test.each([
    ['PICKUP', 'CANCELLED'], ['RETURN', 'CANCELLED'],
    ['PICKUP', 'FAILED_CONFIRMED'], ['RETURN', 'FAILED_CONFIRMED'],
    ['PICKUP', 'SUCCEEDED'], ['RETURN', 'SUCCEEDED'],
    ['PICKUP', 'UNKNOWN'], ['RETURN', 'UNKNOWN'],
])('cabinet %s/%s preserves the server blocker before its local state description', async (purpose, status) => {
    m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose, status, door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', rfid_result: 'NOT_OBSERVED', observed_at: null, confirmed_at: null, allowed_actions: [], blockers: [{ code: 'ORIGINAL_TASK_REVIEW', message: '官方正在核实原任务，请联系客服。' }] }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data['copy']).toBe('官方正在核实原任务，请联系客服。');
    expect(page!.data['canQuery']).toBe(false);
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.queryCabinet).not.toHaveBeenCalled();
});
test.each(['PICKUP', 'RETURN'])('UNKNOWN %s keeps the original physical verification guidance and original query permission', async purpose => {
    m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose, status: 'UNKNOWN', door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', rfid_result: 'NOT_OBSERVED', observed_at: null, confirmed_at: null, allowed_actions: [action('QUERY_CABINET')], blockers: [] }));
    extras.queryCabinet.mockReturnValue(result({ task_id: 't1' }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data).toMatchObject({ status: '结果待核实', canQuery: true, copy: purpose === 'PICKUP' ? '正在自动核实柜机状态；门开或请求受理不代表已经完成。请取出设备并关门，结果将自动更新。' : '门开或请求受理不代表已经完成；请取放设备并关门，再查询原任务。' });
    await call('query');
    expect(extras.queryCabinet).toHaveBeenCalledExactlyOnceWith('t1', '"obj:1"');
    expect(m.openCabinet).not.toHaveBeenCalled();
});
test('pending cabinet pickup cannot be replaced while lookup is unknown', async () => { m.pendingPickup.mockReturnValue({ key: 'original-key' }); await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential'); expect(m.lookup).toHaveBeenCalledWith('K10', 'original-key'); expect(m.pickup).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled(); });
test.each(['onHide', 'onUnload'])('%s invalidates queued checkout and pickup actions without unhandled errors', async (lifecycle) => { await mount('confirm', { deviceId: 'a1' }); setTerm(); const pending = call('next'); call(lifecycle); await pending; await call('next'); expect(m.prepare).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled(); });

test('wallet distinguishes booked and estimated and exposes no withdrawal command', async () => { await mount('wallet'); expect(page!.data).toMatchObject({ booked: '¥240.00', estimated: '¥10.00', estimatedCount: 2 }); expect(page!['openWithdrawal']).toBeUndefined(); expect(page!['submitWithdrawal']).toBeUndefined(); });
test.each([['rent', 'TENANT', '我租的设备'], ['lend', 'LESSOR', '我出租的设备']])('device entry %s reads the corresponding role and accepts an optional asset filter', async (mode, role, title) => { await mount('device-orders', { mode, assetId: 'a1' }); expect(page!.data['title']).toBe(title); expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ role, asset_id: 'a1' })); call('openOrder', { currentTarget: { dataset: { id: 'foreign' } } }); expect(wx.navigateTo).not.toHaveBeenCalled(); });

test('same-account login and identity return preserves explicit term address and one coupon before a fresh quote', async () => {
    m.supply.mockReturnValue({ promise: Promise.resolve({ supply_type: 'PERSONAL', display_name: '相机', media: [], rental_mode: 'DAY' }) });
    await mount('confirm', { deviceId: 'a1' }); setTerm();
    Object.assign(page!.data, { addressId: 'address-1', couponId: 'coupon-1' });
    await call('refreshQuote');
    call('onHide'); m.owner = null; call('onShow'); await tick(); call('onHide');
    m.owner = 'tenant'; call('onShow'); await tick();
    expect(page!.data).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-07', addressId: 'address-1', couponId: 'coupon-1', method: 'EXPRESS' });
    expect(m.quote).toHaveBeenLastCalledWith(expect.objectContaining({ address_id: 'address-1', coupon_id: 'coupon-1', delivery_method: 'EXPRESS' }));
    expect(m.prepare).not.toHaveBeenCalled();
    call('onHide'); m.owner = 'another-account'; call('onShow'); await tick();
    expect(page!.data).toMatchObject({ addressId: '', couponId: '', startDate: '' });
});

test('quote failure keeps the previous coupon and amounts and a closed sheet rejects its late quotation', async () => {
    await mount('confirm', { deviceId: 'a1' }); setTerm(); await call('refreshQuote');
    const previous = page!.data['total'];
    m.quote.mockReturnValueOnce({ promise: Promise.reject(new Error('报价失败')), abort: vi.fn() });
    await call('refreshQuote', 'new-coupon');
    expect(page!.data).toMatchObject({ couponId: '', total: previous });
    expect(page!.data['errorText']).toContain('报价失败');
    let finish!: (v: unknown) => void;
    m.quote.mockReturnValueOnce({ promise: new Promise(resolve => finish = resolve), abort: vi.fn() });
    call('openVoucherSheet'); call('chooseVoucher', { currentTarget: { dataset: { id: 'late-coupon' } } }); await tick(); call('closeVoucherSheet');
    finish({ value: { fees: { ...fees, initial_due_fen: '1' }, terms_hash: 'c'.repeat(64), blockers: [] }, etag: '' }); await tick();
    expect(page!.data).toMatchObject({ couponId: '', total: previous, voucherSheetOpen: false, busy: false });
    m.quote.mockReturnValue(result({ fees: { ...fees, deposit_due_fen: '0', initial_due_fen: '1000' }, terms_hash: 'd'.repeat(64), blockers: [] }));
    await call('refreshQuote', 'single-waiver'); expect(page!.data).toMatchObject({ couponId: 'single-waiver', deposit: '¥0.00' });
    await call('refreshQuote', ''); expect(m.quote).toHaveBeenLastCalledWith(expect.objectContaining({ coupon_id: null }));
});

test('frozen term controls ignore stale picker events and 412 preserves the frozen draft without automatic confirmation', async () => {
    const frozen = order(); frozen.order.allowed_actions = [action('CONFIRM_ORDER')];
    m.contract.mockReturnValue(result(checkoutContract(true)));
    m.get.mockReturnValue(result(frozen));
    await mount('confirm', { orderId: 'o1' });
    const before = structuredClone(page!.data);
    call('chooseCalendarDate', { currentTarget: { dataset: { date: '2028-01-01' } } });
    call('applyTermSheet');
    expect(page!.data['startDate']).toBe(before['startDate']);
    m.confirm.mockImplementationOnce(() => ({ promise: Promise.reject(Object.assign(new Error('版本已更新'), { statusCode: 412 })), abort: vi.fn() }));
    await call('next');
    expect(m.confirm).toHaveBeenCalledTimes(1); expect(m.get).toHaveBeenCalledTimes(2);
    expect(page!.data).toMatchObject({ frozen: true, busy: false });
    expect(page!.data['errorText']).toContain('已保留本次选择');
});

test('reentering the cabinet code page clears typed digits and accepted original pickup only navigates to its task', async () => {
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    call('inputCredential', { detail: { value: '001234' } }); call('onHide');
    m.pendingPickup.mockReturnValue({ key: 'original-key' });
    m.lookup.mockReturnValue(result({ state: 'ACCEPTED', result: { resource_type: 'CABINET_TASK', resource_id: 'original-task' }, retry_same_request: false }));
    call('onShow'); await tick();
    expect(page!.data['credentialInput']).toBe('');
    expect(m.lookup).toHaveBeenCalledWith('K10', 'original-key');
    expect(m.pickup).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickupCredential).not.toHaveBeenCalled();
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.task).toHaveBeenCalledWith('original-task');
});

test('NOT_FOUND original pickup does not dispatch without newly entered digits', async () => {
    m.pendingPickup.mockReturnValue({ key: 'original-key' });
    m.lookup.mockReturnValue(result({ state: 'NOT_FOUND', result: null, retry_same_request: true }));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    await call('submitCredential'); expect(m.pickup).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
    call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential');
    expect(m.pickup).toHaveBeenCalledTimes(1); expect(m.openCabinet).toHaveBeenCalledTimes(1);
});
test('paid official order can view its six digit code before any cabinet task and revoked access clears it', async () => {
    const value = { ...order(), bill: { initial_payment: null, supplement: null, refund_summary: { latest_refund: null }, assessment: null }, latest_cabinet_tasks: [], pickup: { name:'本单租赁柜',address:'场所',compartment_no:'01' } };
    value.order.rental_start_at = '2026-10-06T02:00:00Z';
    value.order.allowed_actions = [action('READ_PICKUP_CODE')]; m.get.mockReturnValue(result(value));
    m.pickupCredential.mockReturnValue(result({ order_id: 'o1', pickup_code: '001234' }));
    await mount('order-detail',{orderId:'o1'});
    expect(page!.data).toMatchObject({loaded:true,pickupCode:'001234',pickupCompartment:'01',pickupStart:'2026-10-06'});expect(m.pickupCredential).toHaveBeenCalledWith('o1');
    expect(wx.navigateTo).not.toHaveBeenCalled();await call('copyCode');expect(wx.setClipboardData).toHaveBeenCalledWith({data:'001234'});
    expect(m.pickup).not.toHaveBeenCalled();expect(m.openCabinet).not.toHaveBeenCalled();expect(m.task).not.toHaveBeenCalled();
    value.order.allowed_actions=[action('READ_PICKUP_CODE',false)];m.get.mockReturnValue(result(value));await call('refreshStatus');await call('copyCode');
    expect(page!.data).toMatchObject({loaded:true,pickupVisible:false,pickupCode:''});expect(wx.setClipboardData).toHaveBeenCalledTimes(1);expect(m.pickupCredential).toHaveBeenCalledTimes(1);
});

test('account switch discards a late pickup lookup and never exposes the previous task', async () => {
    let finish!: (value: unknown) => void;
    m.pendingPickup.mockReturnValue({ key: 'old-key' });
    m.lookup.mockReturnValue({ promise: new Promise(resolve => finish = resolve), abort: vi.fn() });
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    call('onHide'); m.owner = 'other-account'; m.pendingPickup.mockReturnValue(null); m.pickupTask.mockReturnValue(null); call('onShow');
    finish({ value: { state: 'ACCEPTED', result: { resource_type: 'CABINET_TASK', resource_id: 'private-task' } }, etag: '' }); await tick();
    expect(page!.data['taskId']).toBe(''); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
});

// Handwritten contract read/write lifecycle coverage is in contract-signature-page.test.ts.

function cabinetOrder(tasks: unknown[] = [], select = true) { return { ...order(), latest_cabinet_tasks: tasks, requirements: { return_instructions: '照片视频可稍后补充' }, order: { ...order().order, stage: 'ACTIVE', allowed_actions: [action('SELECT_COMPARTMENT', select)] } }; }
function task(status = 'UNKNOWN', purpose = 'RETURN') { return { task_id: 'original-task', order_id: 'o1', cabinet_id: 'cabinet-1', compartment_id: 'slot-1', purpose, status, door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', rfid_result: 'NOT_OBSERVED', observed_at: null, confirmed_at: null, blockers: [], allowed_actions: [action('QUERY_CABINET'), action('OPEN_CABINET', status === 'RESERVED'), action('CANCEL_CABINET', status === 'RESERVED')] }; }
function availableCabinets() { return { items: [{ cabinet_id: 'cabinet-1', name: '租赁柜', address: '场所', connectivity_status: 'ONLINE', compartments: [{ compartment_id: 'slot-1', compartment_no: '01', available: true, blockers: [] }] }], next_cursor: null, blockers: [] }; }
beforeEach(() => { for (const fn of Object.values(extras)) fn.mockReset(); extras.cabinets.mockReturnValue(result({ items: [], next_cursor: null, blockers: [] })); extras.reserveCabinet.mockReturnValue(result(task('RESERVED'))); extras.cancelCabinet.mockReturnValue(result(task('CANCELLED'))); extras.queryCabinet.mockReturnValue(result({ state: 'ACCEPTED' })); });
test('empty return cabinet options allow read refresh and distinguish transport error before showing available slots', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    expect(page!.data).toMatchObject({ loaded: true, canSelect: true, optionsLoaded: true, optionsFailed: false, hasAvailableCompartment: false });
    extras.cabinets.mockReturnValueOnce({ promise: Promise.reject(new Error('网络读取失败')), abort: vi.fn() }); await call('refresh');
    expect(page!.data).toMatchObject({ optionsLoaded: false, optionsFailed: true, errorText: '网络读取失败' });
    extras.cabinets.mockReturnValue(result(availableCabinets())); await call('refresh');
    expect(page!.data).toMatchObject({ optionsLoaded: true, optionsFailed: false, hasAvailableCompartment: true });
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
});
test('unknown return reservation blocks changing slots until authoritative refresh and never opens automatically', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    extras.reserveCabinet.mockReturnValue({ promise: Promise.reject(new Error('请求结果待核实')), abort: vi.fn() });
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' }); const slot = { currentTarget: { dataset: { compartment: 'slot-1' } } };
    await Promise.all([call('reserve', slot), call('reserve', slot)]);
    expect(extras.reserveCabinet).toHaveBeenCalledTimes(1); expect(page!.data).toMatchObject({ canSelect: false, canOpen: false });
    await call('reserve', slot); expect(extras.reserveCabinet).toHaveBeenCalledTimes(1);
    m.get.mockReturnValue(result(cabinetOrder([task()], false))); m.task.mockReturnValue(result(task())); await call('refresh');
    await call('taskAction', { currentTarget: { dataset: { action: 'open' } } });
    await call('taskAction', { currentTarget: { dataset: { action: 'cancel' } } });
    await mount('cabinet-return', { orderId: 'o1' }); await call('query');
    expect(extras.queryCabinet).toHaveBeenCalledWith('original-task', '"obj:1"'); expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.cancelCabinet).not.toHaveBeenCalled();
});
test('changing a reserved return compartment requires explicit cancellation and does not create another task on reentry', async () => {
    const reserved = task('RESERVED'); m.get.mockReturnValue(result(cabinetOrder([reserved], false))); m.task.mockReturnValue(result(reserved));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' }); call('onHide'); call('onShow'); await tick();
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
    m.get.mockReturnValue(result(cabinetOrder([], true))); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await call('taskAction', { currentTarget: { dataset: { action: 'cancel' } } });
    expect(extras.cancelCabinet).toHaveBeenCalledWith('original-task', '"obj:1"'); expect(page!.data['canSelect']).toBe(true);
    expect(extras.reserveCabinet).not.toHaveBeenCalled();
    call('goMaterials'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/return-submit/index?orderId=o1'}));
});
test.each(['CANCELLED', 'FAILED_CONFIRMED', 'SUCCEEDED'] as const)('return terminal %s has readable status and cannot query or instruct physical placement', async status => {
    const terminal = { ...task(status), purpose: 'RETURN', allowed_actions: [], blockers: [] };
    m.get.mockReturnValue(result(cabinetOrder([terminal], false))); m.task.mockReturnValue(result(terminal));
    await mount('cabinet-return', { orderId: 'o1' });
    expect(page!.data['taskStatusLabel']).not.toBe(status); expect(page!.data['taskCopy']).not.toMatch(/请取放|请放入|再查询原任务/);
    expect(page!.data).toMatchObject({ canQuery: false, canSelect: false, canResumeReservation: false }); await call('query');
    expect(extras.queryCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
    if (status === 'SUCCEEDED') expect(page!.data['taskCopy']).toContain('退押仍需官方审核');
});
test('return failed task retains the server blocker rather than replacing it with generic guidance', async () => {
    const terminal = { ...task('FAILED_CONFIRMED'), purpose: 'RETURN', allowed_actions: [], blockers: [{ message: '请携带本单设备联系现场人员' }] };
    m.get.mockReturnValue(result(cabinetOrder([terminal], false))); m.task.mockReturnValue(result(terminal));
    await mount('cabinet-return', { orderId: 'o1' }); expect(page!.data['taskCopy']).toBe('请携带本单设备联系现场人员');
});
test('return cabinet reservation proceeds with incomplete materials and preserves the original order and selected slot', async () => {
    const value=cabinetOrder();Object.assign(value,{return_id:'return-1'});m.get.mockReturnValue(result(value));extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinet-detail',{mode:'return',orderId:'o1',id:'cabinet-1'});await call('reserve',{currentTarget:{dataset:{compartment:'slot-1'}}});
    expect(extras.reserveCabinet).toHaveBeenCalledWith('o1','cabinet-1','slot-1','"obj:1"');expect(m.openCabinet).not.toHaveBeenCalled();
});

test('return cabinet list only reads authorized choices and selecting a cabinet navigates without reservation or opening', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinets', { mode: 'return', orderId: 'o1' });
    expect(page!.data).toMatchObject({ returnMode: true, canSelect: true, selectedCabinetId: '' });
    call('openCabinet', { currentTarget: { dataset: { id: 'foreign' } } }); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('openCabinet', { currentTarget: { dataset: { id: 'cabinet-1' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-detail/index?mode=return&orderId=o1&id=cabinet-1' }));
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
});

test('selecting a return slot changes selection only, explicit confirmation reserves and opens once', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    call('selectCompartment', { currentTarget: { dataset: { compartment: 'foreign-slot' } } });
    expect(page!.data['selectedCompartment']).toBe('');
    call('selectCompartment', { currentTarget: { dataset: { compartment: 'slot-1' } } });
    expect(page!.data['selectedCompartment']).toBe('slot-1');
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
    const reserved = { ...task('RESERVED'), cabinet_name: '租赁柜', compartment_no: '01' };
    extras.reserveCabinet.mockImplementation(() => { m.get.mockReturnValue(result(cabinetOrder([reserved], false))); m.task.mockReturnValue(result(reserved)); return result(reserved); });
    await Promise.all([call('confirmSelected'), call('confirmSelected')]);
    expect(extras.reserveCabinet).toHaveBeenCalledExactlyOnceWith('o1', 'cabinet-1', 'slot-1', '"obj:1"');
    expect(m.openCabinet).toHaveBeenCalledExactlyOnceWith('original-task', null, '"obj:1"');
});

test.each(['failed-reservation', 'hidden-after-reservation', 'account-changed'])('combined confirmation never opens after %s', async boundary => {
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    call('selectCompartment', { currentTarget: { dataset: { compartment: 'slot-1' } } });
    const reserved=task('RESERVED');
    extras.reserveCabinet.mockImplementation(() => {
        if (boundary === 'failed-reservation') return {promise:Promise.reject(new Error('预留未确认')),abort:vi.fn()};
        m.get.mockReturnValue(result(cabinetOrder([reserved],false))); m.task.mockReturnValue(result(reserved));
        if (boundary === 'account-changed') m.owner='another-account'; else call('onHide');
        return result(reserved);
    });
    await call('confirmSelected');
    expect(extras.reserveCabinet).toHaveBeenCalledOnce(); expect(m.openCabinet).not.toHaveBeenCalled();
});

test('return slot reservation reads task ETag and only a separate explicit open reaches the result page', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    const reserved = task('RESERVED'); m.get.mockReturnValue(result(cabinetOrder([reserved], false))); m.task.mockReturnValue(result(reserved, '"TASK:original-task:7"'));
    await call('reserve', { currentTarget: { dataset: { compartment: 'slot-1' } } });
    expect(m.task).toHaveBeenCalledWith('original-task'); expect(m.openCabinet).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ canOpen: true, canSelect: false, busy: false });
    const unknown = task(); m.get.mockReturnValue(result(cabinetOrder([unknown], false))); m.task.mockReturnValue(result(unknown));
    await Promise.all([call('taskAction', { currentTarget: { dataset: { action: 'open' } } }), call('taskAction', { currentTarget: { dataset: { action: 'open' } } })]);
    expect(m.openCabinet).toHaveBeenCalledTimes(1); expect(m.openCabinet).toHaveBeenCalledWith('original-task', null, '"TASK:original-task:7"');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-return/index?orderId=o1' }));
    expect(page!.data).toMatchObject({ canOpen: false, canSelect: false, busy: false });
});

test('return slot empty state preserves the order when choosing another cabinet and never reserves on navigation', async () => {
    m.get.mockReturnValue(result(cabinetOrder())); vi.stubGlobal('wx', { ...wx, redirectTo: vi.fn() });
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    expect(page!.data).toMatchObject({ optionsLoaded: true, hasAvailableCompartment: false });
    call('chooseAnotherCabinet'); expect(wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinets/index?mode=return&orderId=o1' }));
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
});

test('UNKNOWN return task blocks selection in both original routes and result view never opens or cancels', async () => {
    const unknown = task(); m.get.mockReturnValue(result(cabinetOrder([unknown], true))); m.task.mockReturnValue(result(unknown));
    await mount('cabinets', { mode: 'return', orderId: 'o1' }); expect(page!.data['canSelect']).toBe(false); expect(extras.cabinets).not.toHaveBeenCalled();
    call('openCabinet', { currentTarget: { dataset: { id: 'cabinet-1' } } }); expect(wx.navigateTo).not.toHaveBeenCalled();
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    expect(page!.data).toMatchObject({ canSelect: false, canOpen: false, canCancel: false });
    await mount('cabinet-return', { orderId: 'o1' });
    expect(page!['reserve']).toBeUndefined(); expect(page!['taskAction']).toBeUndefined(); call('goSelection');
    await Promise.all([call('query'), call('query')]);
    expect(extras.queryCabinet).toHaveBeenCalledTimes(1); expect(extras.queryCabinet).toHaveBeenCalledWith('original-task', '"obj:1"');
    expect(extras.reserveCabinet).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.cancelCabinet).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('return routes reject personal delivery and late account-switched or hidden option responses', async () => {
    m.get.mockReturnValue(result({ ...cabinetOrder(), delivery: { method: 'EXPRESS' } }));
    await mount('cabinets', { mode: 'return', orderId: 'o1' }); expect(page!.data['errorText']).toContain('快递'); expect(extras.cabinets).not.toHaveBeenCalled();
    m.get.mockReturnValue(result(cabinetOrder())); let finish!: (value: unknown) => void;
    extras.cabinets.mockReturnValue({ promise: new Promise(resolve => finish = resolve), abort: vi.fn() });
    call('onHide'); call('onShow'); await tick(); m.owner = 'other';
    finish({ value: availableCabinets(), etag: '' }); await tick();
    expect(page!.data['canSelect']).toBe(false); expect(page!.data['cabinets']).toEqual([]);
    call('onHide'); expect(page!.data['activeCabinet']).toBeNull();
});

test('return reservation version conflict reads current facts and never retries the write or opens another slot', async () => {
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    m.get.mockReturnValue(result(cabinetOrder())); extras.cabinets.mockReturnValue(result(availableCabinets()));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    extras.reserveCabinet.mockReturnValue({ promise: Promise.reject(new ApiProblem(412, { code: 'VERSION_CONFLICT', message: '格口状态已变化，请重新查询', request_id: 'test' })), abort: vi.fn() });
    await call('reserve', { currentTarget: { dataset: { compartment: 'slot-1' } } });
    expect(m.get).toHaveBeenCalledTimes(2); expect(extras.reserveCabinet).toHaveBeenCalledTimes(1); expect(m.openCabinet).not.toHaveBeenCalled();
    expect(page!.data).toMatchObject({ canSelect: false, busy: false, errorText: '格口状态已变化，请重新查询' });
});

test('return selected cabinet is found only in current authorized option pages and another slot cannot be forged', async () => {
    m.get.mockReturnValue(result(cabinetOrder()));
    extras.cabinets.mockReturnValueOnce(result({ items: [], next_cursor: 'page-2', blockers: [] })).mockReturnValueOnce(result(availableCabinets()));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    expect(extras.cabinets).toHaveBeenNthCalledWith(2, 'o1', 'page-2');
    await call('reserve', { currentTarget: { dataset: { compartment: 'foreign-slot' } } }); expect(extras.reserveCabinet).not.toHaveBeenCalled();
    expect(page!.data['compartments']).toEqual([{ id: 'slot-1', name: '01', available: true, reason: '' }]);
});

test('late return opening after hide cannot navigate and a foreign task cannot enable another cabinet command', async () => {
    const reserved = task('RESERVED'); m.get.mockReturnValue(result(cabinetOrder([reserved], false))); m.task.mockReturnValue(result(reserved));
    await mount('cabinet-detail', { mode: 'return', orderId: 'o1', id: 'cabinet-1' });
    let finish!: (value: unknown) => void; m.openCabinet.mockReturnValue({ promise: new Promise(resolve => finish = resolve), abort: vi.fn() });
    const pending = call('taskAction', { currentTarget: { dataset: { action: 'open' } } }); await tick(); call('onHide');
    finish({ value: task(), etag: '"obj:2"' }); await pending;
    expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ loaded: false, busy: false, canOpen: false, taskId: '' });
    m.task.mockReturnValue(result({ ...reserved, order_id: 'foreign-order' })); call('onShow'); await tick();
    expect(page!.data['errorText']).toContain('当前订单不一致'); expect(page!.data['canOpen']).toBe(false); expect(m.openCabinet).toHaveBeenCalledTimes(1);
});
test('cabinet result repeated refresh reentry and explicit query only operate on the original task', async () => {
    m.task.mockReturnValue(result(task('UNKNOWN', 'PICKUP'))); await mount('cabinet-open', { taskId: 'original-task' });
    await call('refresh'); call('onHide'); call('onShow'); await tick();
    await Promise.all([call('query'), call('query')]);
    expect(extras.queryCabinet).toHaveBeenCalledTimes(1); expect(extras.queryCabinet).toHaveBeenCalledWith('original-task','"obj:1"');
    expect(m.task.mock.calls.every(row => row[0] === 'original-task')).toBe(true); expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickup).not.toHaveBeenCalled();
});
function earning(id: string) { return { earning_id:id,order_id:'o1',order_no:'N1',asset_title:'相机',beneficiary_fen:'24000',posted_at:'2026-10-08T01:00:00Z',rent_fen:'10000',overtime_fen:'1000',loss_fen:'13000',subsidy_fen:'0',platform_fen:'0' }; }
test('wallet paginates by earning ID including duplicate page rows and opens only the listed income and its order', async () => {
    m.earnings.mockReturnValueOnce(result({items:[earning('e1')],has_more:true,next_cursor:'page-2'})); await mount('wallet');
    m.earnings.mockReturnValue(result({items:[earning('e1'),earning('e2'),earning('e2')],has_more:false,next_cursor:null})); await Promise.all([call('loadMore'),call('loadMore')]);
    expect((page!.data['items'] as {id:string}[]).map(row=>row.id)).toEqual(['e1','e2']);
    await call('openIncome',{currentTarget:{dataset:{id:'foreign'}}});expect(extras.earning).not.toHaveBeenCalled();
    extras.earning.mockReturnValue(result(earning('e2')));await call('openIncome',{currentTarget:{dataset:{id:'e2'}}});call('openOrder');
    expect(extras.earning).toHaveBeenCalledWith('e2');expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/order-detail/index?id=o1'}));
    expect((page!.data['detailRows'] as {label:string,value:string}[]).find(row=>row.label==='本次入账收益')?.value).toBe('¥240.00');
});
test('closing an income sheet invalidates the pending detail without reopening or permitting stale order navigation', async () => {
    m.earnings.mockReturnValueOnce(result({items:[earning('e1')],has_more:false,next_cursor:null}));await mount('wallet');
    let finish!:(v:unknown)=>void;extras.earning.mockReturnValue({promise:new Promise(resolve=>finish=resolve),abort:vi.fn()});
    const pending=call('openIncome',{currentTarget:{dataset:{id:'e1'}}});await tick();call('closeDetail');finish({value:earning('e1'),etag:''});await pending;call('openOrder');
    expect(page!.data).toMatchObject({detailOpen:false,busy:false});expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('wallet empty loading and failure remain separate and explicit retry restores the same income source', async () => {
    let finish!:(v:unknown)=>void;m.income.mockReturnValueOnce({promise:new Promise(resolve=>finish=resolve),abort:vi.fn()});await mount('wallet');
    expect(page!.data['loading']).toBe(true);expect(page!.data['items']).toEqual([]);
    finish({value:{booked_income_fen:'0',estimated_income_fen:'0',estimated_order_count:0},etag:''});await tick();
    expect(page!.data).toMatchObject({loading:false,booked:'¥0.00',estimated:'¥0.00',errorText:''});
    m.income.mockReturnValueOnce({promise:Promise.reject(new Error('收益读取失败')),abort:vi.fn()});await call('refresh');expect(page!.data['errorText']).toBe('收益读取失败');expect(page!.data['booked']).toBe('¥0.00');
    await call('refresh');expect(page!.data).toMatchObject({errorText:'',booked:'¥240.00'});
});
test.each(['PREPARING','AWAITING_PAYMENT'])('frozen %s checkout keeps server deadline and all commercial selectors read only', async (stage) => {
    const value={...order(),hold_expires_at:'2026-10-06T07:30:00Z',payment_due_at:'2026-10-06T07:39:00Z'};value.order.stage=stage;
    value.order.allowed_actions=[action('CONFIRM_ORDER',stage==='PREPARING')];m.get.mockReturnValue(result(value));await mount('confirm',{orderId:'o1'});
    expect(page!.data).toMatchObject({frozen:true,step:2,deadlineText:stage==='PREPARING'?'2026-10-06 15:30':'2026-10-06 15:39'});
    call('openTermSheet');call('openVoucherSheet');call('openAddressBook');expect(page!.data['termSheetOpen']).toBe(false);expect(page!.data['voucherSheetOpen']).toBe(false);expect(wx.navigateTo).not.toHaveBeenCalled();expect(m.quote).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled();
    if(stage==='AWAITING_PAYMENT'){await call('next');expect(m.confirm).not.toHaveBeenCalled();}
});
test.each(['DAY','HOUR'])('%s rental selects calendar dates and sends only the selected single coupon', async mode => {
    m.supply.mockReturnValue({promise:Promise.resolve({supply_type:'CABINET', pickup_location: { cabinet_id: 'cabinet-1', name: '冻结取件柜', address: { province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail_address: '科苑路一号大厅' } }, display_name:'相机',media:[],rental_mode:mode})});await mount('confirm',{deviceId:'a1'});
    await call('next');expect(m.quote).not.toHaveBeenCalled();setTerm();
    await call('refreshQuote','single-coupon');expect(m.quote).toHaveBeenLastCalledWith({asset_id:'a1',rental_start_at:'2026-10-05T16:00:00.000Z',rental_end_at:'2026-10-06T16:00:00.000Z',delivery_method:'CABINET',address_id:null,coupon_id:'single-coupon'});
    expect(page!.data['termText']).toBe('2026-10-06 至 2026-10-07');
});
test('pickup recovery 01 normal paid pickup dispatches one original opening', async () => {
  await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
  call('inputCredential', { detail: { value: '001234' } });
  await call('submitCredential');
  expect(m.pickup).toHaveBeenCalledExactlyOnceWith('cab_12345678901234567890', '001234');
  expect(m.openCabinet).toHaveBeenCalledExactlyOnceWith('t1', '001234', '"obj:1"');
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ feedbackVisible: true, monitoring: true }); expect(m.task).toHaveBeenCalledWith('t1');
});

test('pickup recovery 02 UNKNOWN original request remains query-only', async () => {
  m.pendingPickup.mockReturnValue({ key: 'original-key' });
  m.lookup.mockReturnValue(result({ state: 'UNKNOWN', result: null, retry_same_request: false }));
  await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
  call('inputCredential', { detail: { value: '001234' } });
  await call('submitCredential');
  expect(m.pickup).not.toHaveBeenCalled();
  expect(m.openCabinet).not.toHaveBeenCalled();
});

test('pickup recovery 03 confirmed non-dispatched RESERVED task can resume after fresh read and explicit credential submission', async () => {
  const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
  m.openCabinet.mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(412, { code: 'VERSION_CONFLICT', message: '版本已更新', request_id: 'audit-reserved' })), abort: vi.fn() });
  await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
  call('inputCredential', { detail: { value: '001234' } });
  await call('submitCredential');
  m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose: 'PICKUP', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET'), action('CANCEL_CABINET'), action('QUERY_CABINET', false)], blockers: [] }, '"obj:2"'));
  call('onHide'); call('onShow'); await tick();
  expect(m.task).toHaveBeenCalledWith('t1');
  call('inputCredential', { detail: { value: '001234' } });
  await call('submitCredential');
  expect(m.pickup).toHaveBeenCalledTimes(1);
  expect(m.openCabinet, 'explicit retry of the same task must remain possible after server confirms RESERVED').toHaveBeenCalledTimes(2);
});

test('pickup recovery 04 confirmed terminal pickup releases the page for a different paid order code', async () => {
  await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
  call('inputCredential', { detail: { value: '001234' } });
  await call('submitCredential');
  m.task.mockReturnValue(result({ task_id: 't1', order_id: 'o1', purpose: 'PICKUP', status: 'SUCCEEDED', allowed_actions: [], blockers: [] }, '"obj:5"'));
  call('onHide'); call('onShow'); await tick();
  expect(m.task).toHaveBeenCalledWith('t1');
  m.pickup.mockReturnValue(result({ task_id: 't2', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET')], blockers: [] }));
  call('inputCredential', { detail: { value: '005678' } });
  await call('submitCredential');
  expect(m.pickup, 'terminal t1 must not pin all later pickup attempts in this page').toHaveBeenCalledTimes(2);
  expect(m.pickup).toHaveBeenLastCalledWith('cab_12345678901234567890', '005678');
});

test('a new scanned page restores RESERVED from its own persisted locator without opening automatically', async () => {
    m.pickupTask.mockReturnValue('t1');
    m.task.mockReturnValue(result({ task_id: 't1', purpose: 'PICKUP', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET'), action('CANCEL_CABINET')], blockers: [] }));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    expect(page!.data).toMatchObject({ taskId: 't1', canResume: true, canCancel: true, credentialInput: '' });
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickup).not.toHaveBeenCalled();
});
test.each(['UNKNOWN', 'EXECUTING', 'VERIFYING'])('restored %s cannot open or cancel even if the UI receives stale action events', async status => {
    m.pickupTask.mockReturnValue('t1');
    m.task.mockReturnValue(result({ task_id: 't1', purpose: 'PICKUP', status, allowed_actions: [action('QUERY_CABINET')], blockers: [] }));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential'); await call('cancelReservation');
    expect(page!.data).toMatchObject({ taskId: 't1', canResume: false, canCancel: false });
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.cancelCabinet).not.toHaveBeenCalled(); expect(m.pickup).not.toHaveBeenCalled();
});
test('cancel refreshes the original task version and only releases the page after a terminal read', async () => {
    m.pickupTask.mockReturnValue('t1');
    const reserved = { task_id: 't1', purpose: 'PICKUP', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET'), action('CANCEL_CABINET')], blockers: [] };
    m.task.mockReturnValue(result(reserved));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    m.task.mockReturnValueOnce(result(reserved, '"TASK:t1:2"')).mockReturnValue(result({ ...reserved, status: 'CANCELLED', allowed_actions: [] }));
    extras.cancelCabinet.mockReturnValue(result({ status: 'CANCELLED' })); await call('cancelReservation');
    expect(extras.cancelCabinet).toHaveBeenCalledExactlyOnceWith('t1', '"TASK:t1:2"');
    expect(page!.data).toMatchObject({ taskId: '', canResume: false, canCancel: false });
    expect(m.forgetPickupTask).toHaveBeenCalledWith('cab_12345678901234567890', 't1'); expect(m.openCabinet).not.toHaveBeenCalled();
});
test('a restored locator for a different cabinet cannot be opened', async () => {
    m.pickupTask.mockReturnValue('t1'); m.cabinetEntry.mockReturnValue(result({ cabinet_id: 'cab1', name: '柜一', pickup_enabled: true }));
    m.task.mockReturnValue(result({ task_id: 't1', cabinet_id: 'cab2', purpose: 'PICKUP', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET')], blockers: [] }));
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' });
    expect(page!.data['errorText']).toContain('不匹配'); expect(page!.data['canResume']).toBe(false);
    call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential'); expect(m.openCabinet).not.toHaveBeenCalled();
});

test('definitive wrong code opens shared feedback and acknowledgement allows a new six-digit input', async () => {
    const { ApiProblem } = await import('../miniprogram/shared/api/account-api');
    m.pickup.mockReturnValue({ promise: Promise.reject(new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: '不可用', request_id: 'wrong', details: { reason_code: 'PICKUP_UNAVAILABLE' } })), abort: vi.fn() });
    await mount('cabinet-code', { scene: 'cab_12345678901234567890' }); call('inputCredential', { detail: { value: '000001' } }); await call('submitCredential');
    expect(page!.data).toMatchObject({ credentialErrorOpen: true, credentialInput: '000001', errorText: '' });
    await call('submitCredential'); expect(m.pickup).toHaveBeenCalledTimes(1);
    call('acknowledgeFeedback'); expect(page!.data).toMatchObject({ credentialErrorOpen: false, credentialInput: '' });
    m.pickup.mockReturnValue(result({ task_id: 't1', status: 'RESERVED', allowed_actions: [action('OPEN_CABINET')], blockers: [] }));
    call('inputCredential', { detail: { value: '000002' } }); await call('submitCredential'); expect(m.pickup).toHaveBeenCalledTimes(2);
});
test.each(['UNKNOWN', 'VERIFYING', 'EXECUTING', 'RESERVED', 'FAILED_CONFIRMED', 'SUCCEEDED'])('result dialog reflects authoritative %s without opening a cabinet', async status => {
    m.task.mockReturnValue(result({ ...task(status, 'PICKUP'), task_id: 't1' }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data['feedbackVisible']).toBe(true);
    expect(page!.data['feedbackTone']).toBe(status === 'SUCCEEDED' ? 'success' : status === 'FAILED_CONFIRMED' ? 'error' : status === 'UNKNOWN' ? 'warning' : 'pending');
    if (status !== 'SUCCEEDED') expect(page!.data['feedbackTitle']).not.toContain('已完成');
    call('dismissFeedback'); await call('refresh'); expect(page!.data['feedbackVisible']).toBe(false);
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.pickup).not.toHaveBeenCalled();
});
test('open door with the original item still present asks for removal and closing, without claiming success', async () => {
    m.task.mockReturnValue(result({ ...task('VERIFYING', 'PICKUP'), task_id: 't1', door_status: 'OPEN', occupancy_result: 'TARGET_PRESENT', rfid_result: 'MATCH', observed_at: '2026-10-06T00:00:01Z' }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data).toMatchObject({ feedbackTone: 'pending', door: '已开门', rfid: '编号一致' });
    expect(page!.data['feedbackContent']).toContain('取出设备并关好柜门');
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.queryCabinet).not.toHaveBeenCalled();
});
test('confirmed pickup with an empty slot describes the device as removed, not awaiting identification', async () => {
    m.task.mockReturnValue(result({ ...task('SUCCEEDED', 'PICKUP'), task_id: 't1', door_status: 'CLOSED', occupancy_result: 'TARGET_ABSENT', rfid_result: 'NOT_OBSERVED', allowed_actions: [] }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data).toMatchObject({ feedbackTitle: '取件完成', rfid: '设备已取出', occupancy: '格口为空', canQuery: false });
});
test('an unconfirmed empty slot cannot be described as a completed pickup', async () => {
    m.task.mockReturnValue(result({ ...task('VERIFYING', 'PICKUP'), task_id: 't1', occupancy_result: 'TARGET_ABSENT' }));
    await mount('cabinet-open', { taskId: 't1' });
    expect(page!.data['rfid']).toBe('编号待核实'); expect(page!.data['feedbackTone']).toBe('pending');
});
test('acknowledging a confirmed pickup success opens only its original order', async () => {
    m.task.mockReturnValue(result({ ...task('SUCCEEDED','PICKUP'), task_id:'t1' }));
    await mount('cabinet-open', { taskId:'t1' }); call('confirmFeedback');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/order-detail/index?id=o1'}));
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(extras.queryCabinet).not.toHaveBeenCalled();
});
