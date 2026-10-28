import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const m = vi.hoisted(() => ({ owner: 'lessor' as string | null, income: vi.fn(), earnings: vi.fn(), earning: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: m }));
type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown };
let page: Harness;
const handle = (value: unknown) => ({ promise: Promise.resolve({ value, etag: '"income:1"' }), abort: vi.fn() });
const row = (id = 'earning-1') => ({ earning_id: id, order_id: 'order-1', order_no: 'N1', asset_title: '测试相机', beneficiary_fen: '27800', rent_fen: '20000', overtime_fen: '6000', loss_fen: '2000', subsidy_fen: '0', platform_fen: '200', posted_at: '2026-10-07T00:00:00Z' });
const summary = () => ({ booked_income_fen: '27800', estimated_income_fen: '1000', estimated_order_count: 1 });
const list = (id = 'earning-1') => ({ items: [row(id)], next_cursor: 'next', has_more: true });
function deferred() { let resolve!: (value: unknown) => void, reject!: (error: unknown) => void; return { promise: new Promise<unknown>((done, fail) => { resolve = done; reject = fail; }), resolve, reject, abort: vi.fn() }; }
function call(name: string, ...args: unknown[]) { return (page[name] as (...args: unknown[]) => unknown).apply(page, args); }
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const openDetail = () => call('openIncome', { currentTarget: { dataset: { id: 'earning-1' } } });
async function mount(query: Record<string, string> = {}) { let definition!: Harness; vi.stubGlobal('Page', (value: Harness) => definition = value); await import('../miniprogram/pages/wallet/index'); page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; call('onLoad', query); call('onShow'); await tick(); }
const cleared = { loading: false, busy: false, booked: '—', estimated: '—', estimatedCount: 0, items: [], cursor: null, hasMore: false, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] };
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); m.owner = 'lessor'; m.income.mockReturnValue(handle(summary())); m.earnings.mockReturnValue(handle(list())); m.earning.mockReturnValue(handle(row())); vi.stubGlobal('wx', { navigateTo: vi.fn(), stopPullDownRefresh: vi.fn() }); });
afterEach(() => { if (page?.['onUnload']) call('onUnload'); vi.unstubAllGlobals(); });

test.each(['summary', 'list', 'pagination', 'detail'] as const)('wallet %s 401 ends loading and removes private projections without replay', async part => {
    await mount(); await openDetail(); const pending = deferred();
    if (part === 'summary') m.income.mockReturnValueOnce(pending); else if (part === 'detail') m.earning.mockReturnValueOnce(pending); else m.earnings.mockReturnValueOnce(pending);
    const reading = part === 'detail' ? openDetail() : call(part === 'pagination' ? 'loadMore' : 'refresh'); await tick();
    m.owner = null; pending.reject(Object.assign(new Error('登录失效'), { statusCode: 401 })); await reading;
    expect(page.data).toMatchObject(cleared); expect(page.data['errorText']).toContain('登录');
    const counts = [m.income.mock.calls.length, m.earnings.mock.calls.length, m.earning.mock.calls.length];
    await call('refresh'); await call('loadMore'); await openDetail(); call('openOrder');
    expect([m.income.mock.calls.length, m.earnings.mock.calls.length, m.earning.mock.calls.length]).toEqual(counts); expect(wx.navigateTo).not.toHaveBeenCalled();
    m.owner = 'lessor'; call('onShow'); await tick(); expect(page.data['items']).toHaveLength(1); expect(page.data['loading']).toBe(false);
});

test('wallet initially signed out shows a login prompt and makes no income requests', async () => {
    m.owner = null; await mount(); expect(page.data).toMatchObject(cleared); expect(page.data['errorText']).toContain('登录'); expect(m.income).not.toHaveBeenCalled(); expect(m.earnings).not.toHaveBeenCalled();
});

test.each(['refresh', 'pagination', 'detail'] as const)('wallet %s success after an account changes cannot expose prior income', async part => {
    await mount(); await openDetail(); const pending = deferred();
    if (part === 'refresh') m.income.mockReturnValueOnce(pending); else if (part === 'pagination') m.earnings.mockReturnValueOnce(pending); else m.earning.mockReturnValueOnce(pending);
    const reading = part === 'detail' ? openDetail() : call(part === 'pagination' ? 'loadMore' : 'refresh'); m.owner = 'other';
    pending.resolve({ value: part === 'refresh' ? summary() : part === 'pagination' ? list('old') : row(), etag: '"income:1"' }); await reading;
    expect(page.data).toMatchObject(cleared); expect(page.data['errorText']).toContain('登录');
});

test.each(['pagination', 'detail'] as const)('wallet hide/show releases %s busy and ignores the old response', async part => {
    await mount(); const pending = deferred(); (part === 'pagination' ? m.earnings : m.earning).mockReturnValueOnce(pending);
    const reading = part === 'detail' ? openDetail() : call('loadMore'); await tick(); expect(page.data['busy']).toBe(true);
    call('onHide'); expect(page.data).toMatchObject(cleared); call('onShow'); await tick(); const current = structuredClone(page.data);
    pending.reject(new Error('old failure')); await reading; expect(page.data).toEqual(current); expect(page.data['busy']).toBe(false);
});

test.each(['pagination', 'detail'] as const)('wallet refresh supersedes pending %s without retaining busy or late private results', async part => {
    await mount(); const pending = deferred(); (part === 'pagination' ? m.earnings : m.earning).mockReturnValueOnce(pending);
    const reading = part === 'detail' ? openDetail() : call('loadMore'); await tick(); await call('refresh');
    expect(page.data).toMatchObject({ busy: false, loading: false, detailOpen: false }); const current = structuredClone(page.data);
    pending.resolve({ value: part === 'pagination' ? list('old') : row('old'), etag: '"income:1"' }); await reading; expect(page.data).toEqual(current);
});

test('wallet hides prior account amounts immediately while the next account loads', async () => {
    await mount(); await openDetail(); const pending = deferred(); m.income.mockReturnValueOnce(pending); m.owner = 'other'; call('onShow');
    expect(page.data).toMatchObject({ ...cleared, loading: true }); pending.resolve({ value: summary(), etag: '"income:2"' }); await tick(); expect(page.data['items']).toHaveLength(1);
});

test('wallet old refresh failure cannot clear a newer account or its pending loading', async () => {
    await mount(); const old = deferred(), latest = deferred(); m.income.mockReturnValueOnce(old); const reading = call('refresh');
    m.owner = 'other'; m.income.mockReturnValueOnce(latest); call('onShow'); const current = structuredClone(page.data);
    old.reject(new Error('old failure')); await reading; expect(page.data).toEqual(current); expect(page.data['loading']).toBe(true);
    latest.resolve({ value: summary(), etag: '"income:2"' }); await tick(); expect(page.data['loading']).toBe(false);
});

test('wallet old same-owner refresh cannot stop the newer refresh loading', async () => {
    await mount(); const old = deferred(), latest = deferred(); m.income.mockReturnValueOnce(old); const reading = call('refresh');
    m.income.mockReturnValueOnce(latest); const newer = call('refresh'); const current = structuredClone(page.data);
    old.reject(new Error('old failure')); await reading; expect(page.data).toEqual(current); expect(page.data['loading']).toBe(true);
    latest.resolve({ value: summary(), etag: '"income:2"' }); await newer; expect(page.data['loading']).toBe(false);
});

test('wallet a superseded read that really expires the current session clears the newer private projection', async () => {
    await mount(); const old = deferred(); m.income.mockReturnValueOnce(old); const reading = call('refresh');
    await call('refresh'); await openDetail(); expect(page.data['detailOpen']).toBe(true);
    m.owner = null; old.reject(new Error('登录失效')); await reading;
    expect(page.data).toMatchObject(cleared); expect(page.data['errorText']).toContain('登录');
});

test('wallet a closed detail does not reopen on its late response and releases busy', async () => {
    await mount(); const pending = deferred(); m.earning.mockReturnValueOnce(pending); const reading = openDetail(); await tick(); expect(page.data['busy']).toBe(true); call('closeDetail');
    pending.resolve({ value: row(), etag: '"income:1"' }); await reading; expect(page.data).toMatchObject({ busy: false, detailOpen: false });
});

test('wallet ordinary network failure retains same-account summary and permits a read retry', async () => {
    await mount(); const oldBooked = page.data['booked']; m.income.mockReturnValueOnce({ promise: Promise.reject(new Error('网络异常')), abort: vi.fn() }); await call('refresh');
    expect(page.data).toMatchObject({ loading: false, booked: oldBooked, errorText: '网络异常' }); expect(page.data['items']).toHaveLength(1);
    await call('refresh'); expect(page.data).toMatchObject({ loading: false, errorText: '' });
});

test('order entry reads its exact earning even outside the first wallet page', async () => {
  m.earning.mockReturnValue(handle(row('deep-earning'))); await mount({ earningId: 'deep-earning', orderId: 'order-1' });
  expect(m.earning).toHaveBeenCalledExactlyOnceWith('deep-earning'); expect(page.data).toMatchObject({ detailOpen: true, detailOrderId: 'order-1' });
  call('closeDetail'); await call('refresh'); expect(m.earning).toHaveBeenCalledTimes(1); expect(page.data['detailOpen']).toBe(false);
});
test.each([{ earning_id: 'foreign' }, { order_id: 'foreign' }])('wallet rejects wrong earning linkage %j', async patch => {
  m.earning.mockReturnValue(handle({ ...row(), ...patch })); await mount({ earningId: 'earning-1', orderId: 'order-1' });
  expect(page.data).toMatchObject({ detailOpen: false, detailRows: [] }); expect(page.data['errorText']).toContain('不匹配');
});
test('account changes clear a deep link and never reopen previous account earnings', async () => {
  await mount({ earningId: 'earning-1', orderId: 'order-1' }); call('onHide'); m.owner = 'other'; call('onShow'); await tick();
  expect(m.earning).toHaveBeenCalledTimes(1); expect(page.data['detailOpen']).toBe(false);
});
