import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, get: vi.fn(), contract: vi.fn(), supply: vi.fn(), quote: vi.fn(), identity: vi.fn(), saveIdentity: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), pendingPreparation: vi.fn(), lookup: vi.fn(), address: vi.fn(), coupons: vi.fn(), intent: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => m.owner, identity: m.identity, saveIdentity: m.saveIdentity, newIntent: m.intent }, findOwnAddress: m.address, couponApi: { list: m.coupons } }));
vi.mock('../miniprogram/shared/api/supply-api', () => ({ supplyApi: { get: m.supply } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: m }));
type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown };
type Route = 'confirm' | 'identity';
let page: Harness;
const handle = (value: unknown) => ({ promise: Promise.resolve(value), abort: vi.fn() });
const record = (value: unknown) => handle({ value, etag: '"CONTRACT:c1:1"' });
const fees = { rent_gross_fen: '1000', deposit_due_fen: '10000', rent_discount_fen: '0', initial_due_fen: '11000' };
const order = () => ({ order: { order_id: 'o1', order_no: 'N1', viewer_role: 'TENANT', asset: { title: '相机', cover_media: null }, stage: 'PREPARING', display_status: '待签约', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z', blockers: [], allowed_actions: [] as {action_code:string;allowed:boolean}[] }, contract_id: 'c1', hold_expires_at: '2026-10-06T00:30:00Z', delivery: { method: 'CABINET', recipient: null }, fees });
const contract = (signed = false) => ({ contract_id: 'c1', order_id: 'o1', status: signed ? 'SUCCEEDED' : 'PENDING', expires_at: '2026-10-06T00:20:00Z', tenant_signature: { account_id: 'tenant', status: signed ? 'SUCCEEDED' : 'PENDING', signed_at: signed ? '2026-10-06T00:01:00Z' : null }, final_artifact: signed ? { artifact_id: 'artifact-1', document_sha256: 'a'.repeat(64), document_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture.pdf', page_count: 1, pages: [{ page_no: 1, material_id: 'page-1', sha256: 'b'.repeat(64), url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/contracts/fixture.png' }], anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: .1, y: .5, w: .4, h: .1 }] } : null });
function signedOrder() { const value = order(); value.order.allowed_actions = [{ action_code: 'CONFIRM_ORDER', allowed: true }]; m.get.mockReturnValue(record(value)); m.contract.mockReturnValue(record(contract(true))); return value; }
const status = (verified = false) => ({ real_name: { status: verified ? 'VERIFIED' : 'CREATED' } });
function deferred() { let resolve!: (value: unknown) => void, reject!: (error: unknown) => void; return { promise: new Promise<unknown>((done, fail) => { resolve = done; reject = fail; }), resolve, reject, abort: vi.fn() }; }
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function call(name: string, ...args: unknown[]) { return (page[name] as (...args: unknown[]) => unknown).apply(page, args); }
const refresh = (route: Route) => call(route === 'confirm' ? 'loadContext' : 'loadStatus');
const read = (route: Route) => route === 'confirm' ? m.get : m.identity;
async function mount(route: Route) { let definition!: Harness; vi.stubGlobal('Page', (value: Harness) => definition = value); await import('../miniprogram/pages/' + route + '/index.ts'); page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; if (page['onLoad']) call('onLoad', { orderId: 'o1', deviceId: 'a1' }); call('onShow'); await tick(); }
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T00:00:00Z')); vi.resetModules(); vi.resetAllMocks(); m.owner = 'tenant'; m.get.mockReturnValue(record(order())); m.identity.mockReturnValue(handle(status())); m.supply.mockReturnValue(handle({ supply_type: 'PERSONAL', display_name: '相机', media: [], rental_mode: 'DAY' })); m.quote.mockReturnValue(record({ fees, terms_hash: 'a'.repeat(64), blockers: [] })); m.pendingPreparation.mockReturnValue(null); m.address.mockResolvedValue({ recipient_name: '收件人', phone: '13800000000', province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail_address: '测试地址' }); m.coupons.mockReturnValue(handle({ items: [], page: { next_cursor: null } })); m.intent.mockReturnValue('original-identity-intent'); m.saveIdentity.mockReturnValue(handle({ status: 'VERIFIED', check_kind: 'REAL_NAME' })); vi.stubGlobal('wx', { navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), showToast: vi.fn() }); });
afterEach(() => { if (page?.['onUnload']) call('onUnload'); vi.unstubAllGlobals(); vi.useRealTimers(); });
beforeEach(() => { m.contract.mockReturnValue(record(contract())); });

test('signed frozen checkout presents the tenant signature, earliest deadline and original media without confirming on read', async () => {
    const value = signedOrder(); Object.assign(value.order.asset, { cover_media: { url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset.png' } });
    await mount('confirm');
    expect(page.data).toMatchObject({ loaded: true, frozenSigned: true, canConfirm: true, statusText: '合同已签署', signedAt: '2026-10-06 08:01', deadlineText: '2026-10-06 08:20', frozenActionText: '确认订单并付款', productMedia: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset.png' });
    expect(m.confirm).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled();
});
test.each(['preview', 'missing-artifact', 'wrong-contract', 'wrong-order', 'wrong-tenant', 'missing-time', 'lessor'])('checkout cannot confirm with %s signature evidence', async reason => {
    const value = signedOrder(), c = contract(true);
    if (reason === 'preview') c.status = 'PENDING';
    if (reason === 'missing-artifact') c.final_artifact = null;
    if (reason === 'wrong-contract') c.contract_id = 'c2';
    if (reason === 'wrong-order') c.order_id = 'o2';
    if (reason === 'wrong-tenant') c.tenant_signature.account_id = 'other';
    if (reason === 'missing-time') c.tenant_signature.signed_at = null;
    if (reason === 'lessor') value.order.viewer_role = 'LESSOR';
    m.contract.mockReturnValue(record(c)); await mount('confirm'); await call('next');
    expect(page.data['canConfirm']).toBe(false); expect(m.confirm).not.toHaveBeenCalled();
});
test('refresh disables stale confirm immediately and a failed contract read cannot reuse its signed state', async () => {
    signedOrder(); await mount('confirm'); const pending = deferred(); m.contract.mockReturnValueOnce(pending);
    const reading = call('loadContext'); await tick(); await call('next');
    expect(page.data).toMatchObject({ loading: true, canConfirm: false, frozenSigned: false }); expect(m.confirm).not.toHaveBeenCalled();
    pending.reject(new Error('合同读取失败')); await reading; await call('next');
    expect(page.data).toMatchObject({ loaded: false, loading: false, canConfirm: false }); expect(m.confirm).not.toHaveBeenCalled();
});
test.each(['hidden', 'changed-account', 'new-read'])('late signed contract cannot repaint across %s', async boundary => {
    signedOrder(); const pending = deferred(); m.contract.mockReturnValueOnce(pending); await mount('confirm');
    if (boundary === 'hidden') call('onHide');
    if (boundary === 'changed-account') m.owner = 'other';
    if (boundary === 'new-read') { m.contract.mockReturnValue(record(contract())); await call('loadContext'); }
    pending.resolve({ value: contract(true), etag: '"contract:1"' }); await tick(); await call('next');
    expect(page.data['canConfirm']).toBe(false); expect(page.data['frozenSigned']).toBe(false); expect(m.confirm).not.toHaveBeenCalled();
});
test('confirmation dispatches once and enters the original order only after successful confirmation and readback', async () => {
    const value = signedOrder(); await mount('confirm'); const pending = deferred(); m.confirm.mockReturnValueOnce(pending);
    const writing = call('next'), duplicate = call('next'); await tick(); expect(m.confirm).toHaveBeenCalledExactlyOnceWith('o1', '"CONTRACT:c1:1"'); expect(wx.navigateTo).not.toHaveBeenCalled();
    value.order.stage = 'AWAITING_PAYMENT'; pending.resolve({ value, etag: '"ORDER:o1:2"' }); await Promise.all([writing, duplicate]);
    expect(wx.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/order-detail/index?id=o1' }));
});
test.each(['write-unknown', 'read-failed'])('confirmation %s never navigates or automatically repeats the command', async failure => {
    const value = signedOrder(); await mount('confirm');
    if (failure === 'write-unknown') m.confirm.mockReturnValueOnce({ promise: Promise.reject(new Error('结果待核实')), abort: vi.fn() });
    else { const confirmed = structuredClone(value); confirmed.order.stage = 'AWAITING_PAYMENT'; m.confirm.mockReturnValueOnce(record(confirmed)); m.get.mockImplementationOnce(() => ({ promise: Promise.reject(new Error('读取失败')), abort: vi.fn() })); }
    await call('next'); expect(m.confirm).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
    expect(page.data).toMatchObject({ loaded: false, canConfirm: false, frozenSigned: false });
    await call('next'); expect(m.confirm).toHaveBeenCalledTimes(1);
    await call('loadContext'); expect(m.confirm).toHaveBeenCalledTimes(1);
});
test('expired local confirmation deadline queries original facts without declaring closure or sending confirm', async () => {
    signedOrder(); await mount('confirm'); vi.setSystemTime(new Date('2026-10-06T00:21:00Z')); await call('next');
    expect(m.get).toHaveBeenCalledTimes(2); expect(m.confirm).not.toHaveBeenCalled(); expect(page.data['statusText']).toBe('合同已签署');
});
test('zero-cash checkout uses a separate confirm label and never invokes payment', async () => {
    const value = signedOrder(); value.fees = { ...fees, initial_due_fen: '0', deposit_due_fen: '0', rent_discount_fen: '1000' };
    await mount('confirm'); expect(page.data).toMatchObject({ zeroCash: true, frozenActionText: '确认订单 ¥0', total: '¥0.00' });
    const confirmed = structuredClone(value); confirmed.order.stage = 'ACTIVE'; m.confirm.mockReturnValueOnce(record(confirmed)); m.get.mockReturnValueOnce(record(confirmed)); await call('next'); expect(m.confirm).toHaveBeenCalledTimes(1);
});
test.each(['expired', 'hidden', 'new-read'])('late confirmation cannot navigate across %s', async boundary => {
    const value = signedOrder(); await mount('confirm'); const pending = deferred(); m.confirm.mockReturnValueOnce(pending);
    const writing = call('next'); await tick();
    if (boundary === 'expired') m.owner = null;
    if (boundary === 'hidden') call('onHide');
    if (boundary === 'new-read') await call('loadContext');
    const confirmed = structuredClone(value); confirmed.order.stage = 'AWAITING_PAYMENT'; pending.resolve({ value: confirmed, etag: '"ORDER:o1:2"' }); await writing;
    expect(m.confirm).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
    if (boundary === 'expired') expect(page.data).toMatchObject({ loaded: false, busy: false, frozenSigned: false });
});
test('a stale order ETag refreshes the original order and requires another explicit confirmation', async () => {
    signedOrder(); await mount('confirm'); m.confirm.mockReturnValueOnce({ promise: Promise.reject(Object.assign(new Error('版本冲突'), { statusCode: 412 })), abort: vi.fn() });
    await call('next'); expect(m.get).toHaveBeenCalledTimes(2); expect(m.confirm).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
    expect(page.data).toMatchObject({ busy: false, loaded: true, errorOpen: true, canConfirm: true });
});
test('a mismatched order response cannot populate or confirm the requested route', async () => {
    const value = signedOrder(); value.order.order_id = 'o2'; await mount('confirm'); await call('next'); call('openOrder'); call('openContract');
    expect(page.data).toMatchObject({ loaded: false, canConfirm: false, frozenSigned: false }); expect(m.contract).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('changing account preserves the frozen route for server authorization instead of starting a blank checkout', async () => {
    signedOrder(); await mount('confirm'); call('onHide'); m.owner = 'other';
    m.get.mockImplementationOnce(() => ({ promise: Promise.reject(Object.assign(new Error('无权查看本订单'), { statusCode: 403 })), abort: vi.fn() }));
    call('onShow'); await tick(); await call('next');
    expect(m.get).toHaveBeenCalledTimes(2); expect(m.get).toHaveBeenLastCalledWith('o1'); expect(m.supply).not.toHaveBeenCalled();
    expect(page.data).toMatchObject({ orderId: 'o1', frozen: true, loaded: false, frozenSigned: false, canConfirm: false });
    expect(m.confirm).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled();
});

test.each(['PREPARING', 'AWAITING_PAYMENT', 'ACTIVE'])('frozen %s checkout retains the full recipient identity and address from the order', async stage => {
    const value = order(); value.order.stage = stage;
    m.get.mockReturnValue(record({ ...value, delivery: { method: 'EXPRESS', recipient: { recipient_name: '收件人甲', phone: '13800000001', region_text: '广东省深圳市南山区', detail: '测试路88号A栋1201室' } } }));
    await mount('confirm');
    expect(page.data).toMatchObject({ loaded: true, frozen: true, recipientAddress: '收件人甲 13800000001 广东省深圳市南山区测试路88号A栋1201室' });
    expect(m.address).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled();
});

test.each(['confirm', 'identity'] as const)('%s clears expired-session loading and stale private data without replaying a write', async route => {
    await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const reading = refresh(route);
    expect(page.data['loading']).toBe(true); m.owner = null; pending.reject(Object.assign(new Error('登录已失效'), { statusCode: 401 })); await reading;
    expect(page.data).toMatchObject({ loading: false, busy: false, loaded: false }); expect(page.data['errorText']).toContain('登录');
    const count = read(route).mock.calls.length; await refresh(route); expect(read(route)).toHaveBeenCalledTimes(count);
    expect(m.prepare).not.toHaveBeenCalled(); expect(m.saveIdentity).not.toHaveBeenCalled();
});
test.each(['confirm', 'identity'] as const)('%s discards account-changed success before onShow and ends its loading', async route => {
    await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const reading = refresh(route); m.owner = 'other';
    pending.resolve(route === 'identity' ? status(true) : { value: order(), etag: '"old:1"' }); await reading;
    expect(page.data).toMatchObject({ loaded: false, loading: false, busy: false }); expect(page.data['errorText']).toContain('登录');
});
test.each(['confirm', 'identity'] as const)('%s hidden read cannot repaint after its session expires', async route => {
    await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const reading = refresh(route); call('onHide'); m.owner = null;
    const hidden = structuredClone(page.data); pending.reject(new Error('过期')); await reading; expect(page.data).toEqual(hidden);
});
test.each(['confirm', 'identity'] as const)('%s previous account read cannot clear the new account shown by onShow', async route => {
    await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const reading = refresh(route); m.owner = 'other'; call('onShow'); await tick();
    const shown = structuredClone(page.data); pending.reject(new Error('旧请求失败')); await reading; expect(page.data).toEqual(shown); expect(page.data['loading']).toBe(false);
});
test.each(['confirm', 'identity'] as const)('%s older read cannot overwrite a newer same-account result or loading state', async route => {
    await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const older = refresh(route); await refresh(route);
    const shown = structuredClone(page.data); pending.reject(new Error('旧请求失败')); await older; expect(page.data).toEqual(shown);
});
for (const route of ['confirm', 'identity'] as const) {
    test.each(['expired', 'new-account', 'session-preserved'] as const)(`${route} old read after a newer completed view respects the %s session boundary`, async boundary => {
        await mount(route); const pending = deferred(); read(route).mockReturnValueOnce(pending); const older = refresh(route);
        if (boundary === 'new-account') { m.owner = 'other'; call('onShow'); await tick(); } else await refresh(route);
        if (route === 'identity') { call('inputName', { detail: { value: '当前账号姓名' } }); call('inputIdentity', { detail: { value: '11010519491231002X' } }); }
        expect(page.data['loaded']).toBe(!(route === 'confirm' && boundary === 'new-account')); const shown = structuredClone(page.data);
        if (boundary === 'expired') m.owner = null;
        pending.reject(Object.assign(new Error(boundary === 'expired' ? '登录已失效' : '原请求会话已更换'), { statusCode: boundary === 'expired' ? 401 : 0, code: boundary === 'expired' ? 'UNAUTHORIZED' : 'SESSION_CHANGED' })); await older;
        if (boundary === 'expired') {
            expect(page.data).toMatchObject({ loading: false, busy: false, loaded: false }); expect(page.data['errorText']).toContain('登录');
            if (route === 'confirm') expect(page.data).toMatchObject({ title: '', recipientAddress: '', total: '—', canConfirm: false, vouchers: [] });
            else expect(page.data).toMatchObject({ realName: '', identityNumber: '', completed: false, overallText: '—' });
        } else expect(page.data).toEqual(shown);
        expect(m.prepare).not.toHaveBeenCalled(); expect(m.saveIdentity).not.toHaveBeenCalled();
    });
}
test('checkout older quote 401 clears a newer quote while retaining explicit choices', async () => {
    await mount('confirm'); Object.assign(page.data, { orderId: '', frozen: false, method: 'EXPRESS', startDate: '2026-10-06', endDate: '2026-10-07', addressId: 'address-1', couponId: 'coupon-1' });
    const pending = deferred(); m.quote.mockReturnValueOnce(pending); const older = call('refreshQuote'); await call('refreshQuote');
    expect(page.data).toMatchObject({ canPrepare: true, total: '¥110.00' }); m.owner = null; pending.reject(Object.assign(new Error('登录已失效'), { statusCode: 401 })); await older;
    expect(page.data).toMatchObject({ loaded: false, busy: false, loading: false, canPrepare: false, total: '—', addressId: 'address-1', couponId: 'coupon-1', startDate: '2026-10-06' }); expect(m.prepare).not.toHaveBeenCalled();
});
test.each(['quote', 'vouchers', 'address'] as const)('checkout %s read expiration stops its own activity and preserves explicit selection', async part => {
    await mount('confirm'); Object.assign(page.data, { orderId: '', frozen: false, method: 'EXPRESS', startDate: '2026-10-06', endDate: '2026-10-07', addressId: 'address-1', couponId: 'coupon-1' });
    const pending = deferred(); if (part === 'quote') m.quote.mockReturnValueOnce(pending); else if (part === 'vouchers') m.coupons.mockReturnValueOnce(pending); else m.address.mockReturnValueOnce(pending.promise);
    const reading = part === 'vouchers' ? call('loadVouchers', false) : call(part === 'quote' ? 'refreshQuote' : 'loadContext'); await tick(); m.owner = null; pending.reject(new Error('登录已失效')); await reading;
    expect(page.data).toMatchObject({ loading: false, busy: false, voucherLoading: false, loaded: false, canPrepare: false, canConfirm: false, addressId: 'address-1', couponId: 'coupon-1', startDate: '2026-10-06' });
    expect(m.prepare).not.toHaveBeenCalled();
});
test('checkout lookup expiration retains the original UNKNOWN preparation and never replaces its key', async () => {
    await mount('confirm'); const original = { key: 'original-key', body: { asset_id: 'a1' } }; m.pendingPreparation.mockReturnValue(original);
    const pending = deferred(); m.lookup.mockReturnValueOnce(pending); const reading = refresh('confirm'); m.owner = null; pending.reject(new Error('登录已失效')); await reading;
    m.owner = 'tenant'; m.lookup.mockReturnValue(record({ state: 'UNKNOWN', result: null, retry_same_request: false })); call('onShow'); await tick();
    expect(m.lookup.mock.calls.map(args => args[1])).toEqual(['original-key', 'original-key']); expect(m.prepare).not.toHaveBeenCalled(); expect(page.data['loading']).toBe(false);
});
test('identity UNKNOWN save keeps its original intent across an expired status read', async () => {
    await mount('identity'); Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' });
    m.saveIdentity.mockReturnValueOnce({ promise: Promise.reject(new Error('结果未知')), abort: vi.fn() }); await call('saveIdentity');
    const pending = deferred(); m.identity.mockReturnValueOnce(pending); const reading = refresh('identity'); m.owner = null; pending.reject(new Error('登录已失效')); await reading;
    expect(page.data).toMatchObject({ loading: false, busy: false, loaded: false, realName: '', identityNumber: '' });
    call('onHide'); m.owner = 'tenant'; call('onShow'); await tick(); Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' }); await call('saveIdentity');
    expect(m.intent).toHaveBeenCalledTimes(1); expect(m.saveIdentity.mock.calls[1]).toEqual(m.saveIdentity.mock.calls[0]);
});
// Contract signature lifecycle cases use the actual SC01-SC05 flow in contract-signature-page.test.ts.

test('identity UNKNOWN intent is discarded for a different account after hide without copying its raw fields', async () => {
    await mount('identity'); m.intent.mockReturnValueOnce('tenant-key').mockReturnValueOnce('other-key');
    Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' });
    m.saveIdentity.mockReturnValueOnce({ promise: Promise.reject(new Error('结果未知')), abort: vi.fn() }); await call('saveIdentity');
    call('onHide'); m.owner = 'other'; call('onShow'); await tick();
    expect(page.data).toMatchObject({ realName: '', identityNumber: '', busy: false, loading: false });
    Object.assign(page.data, { realName: '李四', identityNumber: '11010519491231002X' }); await call('saveIdentity');
    expect(m.saveIdentity.mock.calls.map(args => args[1])).toEqual(['tenant-key', 'other-key']);
});
test('explicit preparation recovery stops after its lookup loses login and does not resend the UNKNOWN write', async () => {
    await mount('confirm'); m.pendingPreparation.mockReturnValue({ key: 'original-key', body: {} });
    const pending = deferred(); m.lookup.mockReturnValueOnce(pending); const recovering = call('restorePreparation'); await tick();
    expect(page.data['busy']).toBe(true); m.owner = null; pending.reject(new Error('登录失效')); await recovering;
    expect(page.data).toMatchObject({ busy: false, loading: false, loaded: false }); expect(m.prepare).not.toHaveBeenCalled();
    expect(m.lookup).toHaveBeenCalledExactlyOnceWith('B02', 'original-key');
});
test.each(['confirm', 'identity'] as const)('%s explicit write 401 ends busy without replay and still suppresses unauthenticated data', async route => {
    await mount(route); const pending = deferred(); let writing: unknown;
    if (route === 'confirm') { Object.assign(page.data, { step: 1, frozen: false, orderId: '', method: 'CABINET', startDate: '2026-10-06', endDate: '2026-10-07' }); await call('next'); m.prepare.mockReturnValueOnce(pending); writing = call('next'); }
    else { Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' }); m.saveIdentity.mockReturnValueOnce(pending); writing = call('saveIdentity'); }
    await tick(); expect(page.data['busy']).toBe(true); m.owner = null; pending.reject(Object.assign(new Error('登录已失效'), { statusCode: 401 })); await writing;
    expect(page.data).toMatchObject({ busy: false, loading: false, loaded: false }); expect(page.data['errorText']).toContain('登录');
    expect(route === 'confirm' ? m.prepare : m.saveIdentity).toHaveBeenCalledTimes(1);
    expect(wx.navigateBack).not.toHaveBeenCalled();
});
for (const route of ['confirm', 'identity'] as const) {
    test.each(['expired', 'session-preserved', 'new-account'] as const)(`${route} older write after a new read respects the %s session boundary`, async boundary => {
        await mount(route); const pending = deferred(); let writing: unknown;
        if (route === 'confirm') { Object.assign(page.data, { step: 1, frozen: false, orderId: '', method: 'CABINET', startDate: '2026-10-06', endDate: '2026-10-07' }); await call('next'); m.prepare.mockReturnValueOnce(pending); writing = call('next'); }
        else { Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' }); m.saveIdentity.mockReturnValueOnce(pending); writing = call('saveIdentity'); }
        await tick(); expect(page.data['busy']).toBe(true);
        if (boundary === 'new-account') { call('onHide'); m.owner = 'other'; call('onShow'); await tick(); } else await refresh(route);
        const shown = structuredClone(page.data); if (boundary === 'expired') m.owner = null;
        pending.reject(Object.assign(new Error(boundary === 'expired' ? '登录已失效' : '旧写请求无法确认'), { statusCode: boundary === 'expired' ? 401 : 0 })); await writing;
        if (boundary === 'expired') { expect(page.data).toMatchObject({ loaded: false, loading: false, busy: false }); expect(page.data['errorText']).toContain('登录'); }
        else expect(page.data).toEqual({ ...shown, busy: false });
        expect(route === 'confirm' ? m.prepare : m.saveIdentity).toHaveBeenCalledTimes(1);
        expect(wx.navigateBack).not.toHaveBeenCalled();
    });
}
test.each(['confirm', 'identity'] as const)('%s successful write finishes busy after its own fresh read', async route => {
    await mount(route);
    if (route === 'confirm') { Object.assign(page.data, { step: 1, frozen: false, orderId: '', method: 'CABINET', startDate: '2026-10-06', endDate: '2026-10-07' }); await call('next'); m.prepare.mockReturnValueOnce(record(order())); await call('next'); }
    else { Object.assign(page.data, { realName: '张三', identityNumber: '11010519491231002X' }); m.identity.mockReturnValue(handle(status(true))); await call('saveIdentity'); }
    expect(page.data).toMatchObject({ loading: false, busy: false, loaded: true, errorText: '' });
    expect(route === 'confirm' ? m.prepare : m.saveIdentity).toHaveBeenCalledTimes(1);
});
