import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';


interface PageHarness { data: Record<string, unknown>; setData(p: Record<string, unknown>): void; [key: string]: unknown }
interface Wire { url: string; header: Record<string, string>; success(response: unknown): void }
let definition: PageHarness;
let page: PageHarness;
let owner: string | null;
let status: number;
let defer: boolean;
let responseOwner: string | undefined;
let hasMore: boolean;
let empty: boolean;
const wires: Wire[] = [];
const abort = vi.fn();
const navigateTo = vi.fn((options: { complete?: () => void }) => options.complete?.());
const showToast = vi.fn();
function response(id = 'entry-1', target = responseOwner ?? owner) {
  return {
    account_id: target, account: { point_kind: 'PINK', total_earned_points: '9007199254740993', available_points: '9007199254740993', reserved_points: '0', latest_sequence: '2' },
    items: empty ? [] : [{ entry_id: id, point_kind: 'PINK', account_sequence: '2', action: 'REVERSE', available_delta: '-10', reserved_delta: '0', earned_delta: '-10', available_after: '9007199254740993', reserved_after: '0', occurred_at: '2026-09-12T04:05:06Z' }],
    statistics: { month_start: '2026-08-31T16:00:00Z', month_increase_units: '12000000000000000170', month_decrease_units: '12000000000000000010', timezone: 'Asia/Shanghai', day_start: '2026-09-11T16:00:00Z', week_start: '2026-09-06T16:00:00Z', today_earned_delta: '13', week_earned_delta: '-10' },
    as_of_at: '2026-09-12T05:00:00Z', page: { page_size: 20, has_more: hasMore, next_cursor: hasMore ? 'signed&cursor' : null },
  };
}
function deliver(wire: Wire, data: unknown = response()) {
  wire.success({ statusCode: status, data: status === 200 ? data : { code: status === 401 ? 'TOKEN_EXPIRED' : 'DEPENDENCY_UNAVAILABLE', message: '读取失败', request_id: 'point-http' }, header: {}, cookies: [] });
}
beforeAll(async () => {
  vi.stubGlobal('Page', (value: PageHarness) => { definition = value; });
  await import('../miniprogram/pages/powder-ledger/index');
});
beforeEach(() => {
  owner = 'owner-a'; status = 200; defer = false; responseOwner = undefined; hasMore = false; empty = false;
  wires.length = 0; abort.mockClear(); navigateTo.mockClear(); showToast.mockClear();
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60000 } : null,
    removeStorageSync: () => { owner = null; }, navigateTo, navigateBack: vi.fn(), switchTab: vi.fn(), showToast, stopPullDownRefresh: vi.fn(),
    request: (wire: Wire) => { wires.push(wire); if (!defer) deliver(wire); return { abort }; },
  });
  page = { ...definition, data: structuredClone(definition.data), setData(patch) {
    for (const [key, value] of Object.entries(patch)) {
      const match = /^items\[(\d+)\]$/.exec(key);
      if (match) (this.data.items as unknown[])[Number(match[1])] = value;
      else this.data[key] = value;
    }
  } };
  call('onLoad');
});
afterEach(() => { call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());
function call(name: string) { return (page[name] as () => unknown).call(page); }
async function tick() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function rows() { return page.data.items as { id: string; amount: string; detail: string }[]; }

test('production page uses first-party owner HTTP and exact signed integer projection', async () => {
  await call('onShow');
  expect(wires[0]?.url).toContain('/v1/me/point-entries?point_kind=PINK&page_size=20');
  expect(wires[0]?.header.Authorization).toBe('Bearer token-owner-a');
  expect(wires[0]?.url).not.toContain('account_id');
  expect(page.data).toMatchObject({ balance: '9007199254740993', totalEarned: '9007199254740993', reserved: '0', loggedIn: true });
  expect(rows()[0]).toMatchObject({ amount: '−10', detail: '2026-09-12 12:05' });
  call('goCheckIn'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/check-in/index' }));
  navigateTo.mockClear(); call('goMall'); expect(navigateTo).not.toHaveBeenCalled(); expect(showToast).toHaveBeenCalled();
});
test('guest sends no private request and offers login', async () => {
  owner = null; await call('onShow'); expect(wires).toHaveLength(0); expect(rows()).toEqual([]); expect(page.data.balance).toBe('—');
  call('goCheckIn'); expect(navigateTo).not.toHaveBeenCalled();
  call('openLogin'); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index?source=powder-ledger' }));
});
test('empty ledger is not an API failure', async () => {
  empty = true; await call('onShow'); expect(page.data.listState).toEqual({ phase: 'empty' }); expect(page.data.balance).toBe('9007199254740993');
});
test('initial failure stays an error and retry reads HTTP without Mock fallback', async () => {
  status = 503; await call('onShow'); expect(page.data.listState).toMatchObject({ phase: 'initial-error' }); expect(rows()).toEqual([]); expect(page.data.balance).toBe('—');
  status = 200; await call('retryInitial'); expect(rows()).toHaveLength(1); expect(wires).toHaveLength(2);
});
test('refresh failure retains only already loaded owner rows', async () => {
  await call('onShow'); status = 503; await call('onPullDownRefresh');
  expect(rows()).toHaveLength(1); expect(page.data.listState).toEqual({ phase: 'ready', incremental: 'refresh-error' });
});
test('401 clears private balance and rows', async () => {
  await call('onShow'); status = 401; await call('onPullDownRefresh');
  expect(owner).toBeNull(); expect(page.data.loggedIn).toBe(false); expect(page.data.balance).toBe('—'); expect(rows()).toEqual([]);
  call('goCheckIn'); expect(navigateTo).not.toHaveBeenCalled();
});
test('foreign response fails closed', async () => {
  responseOwner = 'owner-b'; await call('onShow'); expect(page.data.listState).toMatchObject({ phase: 'initial-error' }); expect(rows()).toEqual([]); expect(page.data.balance).toBe('—');
});
test('cursor loads once and deduplicates repeated rows', async () => {
  hasMore = true; await call('onShow'); defer = true;
  const a = call('onReachBottom'); const b = call('onReachBottom'); await tick();
  expect(wires).toHaveLength(2); expect(wires[1]?.url).toContain('cursor=signed%26cursor');
  hasMore = false; const value = response('entry-2'); value.items.unshift(response('entry-1').items[0]!); deliver(wires[1]!, value);
  await a; await b; expect(rows().map(row => row.id)).toEqual(['entry-1', 'entry-2']); expect(page.data.listState).toEqual({ phase: 'ready', incremental: 'done' });
});
test('load-more failure keeps rows and retries the same signed cursor', async () => {
  hasMore = true; await call('onShow'); status = 503; await call('onReachBottom');
  expect(rows()).toHaveLength(1); expect(page.data.listState).toEqual({ phase: 'ready', incremental: 'load-more-error' });
  status = 200; hasMore = false; await call('retryLoadMore'); expect(wires[2]?.url).toBe(wires[1]?.url);
});
test('hidden page aborts requests and ignores late data', async () => {
  defer = true; const pending = call('onShow'); await tick(); call('onHide'); expect(abort).toHaveBeenCalled();
  deliver(wires[0]!); await pending; expect(rows()).toEqual([]); expect(page.data.balance).toBe('—');
});
test('old owner response cannot clear a newly shown owner page', async () => {
  defer = true; const old = call('onShow'); await tick();
  owner = 'owner-b'; const next = call('onShow'); await tick();
  deliver(wires[1]!, response('owner-b-entry', 'owner-b')); await next;
  deliver(wires[0]!, response('old-entry', 'owner-a')); await old;
  expect(page.data.loggedIn).toBe(true); expect(rows()[0]?.id).toBe('owner-b-entry');
});
test('owner changes while request is pending clears stale private state', async () => {
  await call('onShow'); defer = true; const next = call('onPullDownRefresh'); await tick(); owner = 'owner-b';
  deliver(wires[1]!, response('old-entry', 'owner-a')); await next;
  expect(page.data.loggedIn).toBe(false); expect(rows()).toEqual([]); expect(page.data.balance).toBe('—');
});
test('PINK consumption displays reserved debit rather than fake zero spending', async () => {
  defer = true; const pending = call('onShow'); await tick();
  const value = response(); const item = value.items[0]!;
  item.action = 'CONSUME'; item.available_delta = '0'; item.reserved_delta = '-10'; item.earned_delta = '0';
  deliver(wires[0]!, value); await pending;
  expect(rows()[0]).toMatchObject({ amount: '−10', movementText: '可用 0；预占 −10', title: '积分使用' });
});
test.each(['RESERVE', 'RELEASE'])('%s keeps separate axes and is not shown as a reward', async action => {
  defer = true; const pending = call('onShow'); await tick();
  const value = response(); const item = value.items[0]!; item.action = action; item.earned_delta = '0';
  item.available_delta = action === 'RESERVE' ? '-10' : '10'; item.reserved_delta = action === 'RESERVE' ? '10' : '-10';
  deliver(wires[0]!, value); await pending;
  expect(rows()[0]).toMatchObject({ marker: '↔', movementText: action === 'RESERVE' ? '可用 −10；预占 +10' : '可用 +10；预占 −10' });
});
test('lottery navigates to the connected page without commands; unavailable mall stays read-only', async () => {
  await call('onShow'); const before = wires.length;
  call('goLottery'); call('goMall');
  expect(wires).toHaveLength(before); expect(page.data.ledgerFilter).toBe('all'); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/lottery/index'}));
  expect(page.finishWithdrawal).toBeUndefined(); expect(page.submitCustom).toBeUndefined();
});

function filter(value: string) { return (page.setLedgerFilter as (e: unknown) => Promise<void>).call(page, { detail: { value } }); }
test('direction is queried on server with a fresh cursor and whole-month exact totals', async () => {
  hasMore = true; await call('onShow'); await call('onReachBottom');
  await filter('income');
  expect(wires[2]?.url).toContain('&direction=INCREASE'); expect(wires[2]?.url).not.toContain('&cursor=');
  expect(page.data).toMatchObject({ ledgerFilter: 'income', monthIncrease: '12000000000000000170', monthDecrease: '12000000000000000010' });
  await call('onReachBottom'); expect(wires[3]?.url).toContain('&direction=INCREASE&cursor=signed%26cursor');
  await filter('expense'); expect(wires[4]?.url).toContain('&direction=DECREASE'); expect(wires[4]?.url).not.toContain('&cursor=');
  await filter('all'); expect(wires[5]?.url).not.toContain('&direction='); expect(wires[5]?.url).not.toContain('&cursor=');
  const count = wires.length; await filter('all'); await filter('other'); expect(wires).toHaveLength(count);
});
test('new direction clears old rows, ignores late responses and retries only current filter', async () => {
  await call('onShow'); defer = true;
  const income = filter('income'); await tick(); expect(rows()).toEqual([]); expect(page.data.monthIncrease).toBe('—');
  const expense = filter('expense'); await tick(); expect(abort).toHaveBeenCalled();
  deliver(wires[2]!, response('expense-row')); await expense;
  const old = response('income-row'); old.statistics.month_increase_units = '1';
  deliver(wires[1]!, old); await income;
  expect(page.data.ledgerFilter).toBe('expense'); expect(rows()[0]?.id).toBe('expense-row');
  expect(page.data.monthIncrease).toBe('12000000000000000170');
  defer = false; status = 503; await filter('income');
  expect(rows()).toEqual([]); expect(page.data.listState).toMatchObject({ phase: 'initial-error' });
  status = 200; await call('retryInitial'); expect(wires[wires.length - 1]?.url).toContain('&direction=INCREASE');
});
test('hidden and guest filter events cannot initiate private requests', async () => {
  owner = null; await call('onShow'); await filter('income'); expect(wires).toHaveLength(0);
  owner = 'owner-a'; await call('onShow'); call('onHide'); const count = wires.length;
  await filter('expense'); expect(wires).toHaveLength(count);
});
test.each(['-1','01','1.5','9'.repeat(66)])('invalid month total %s fails without rows or balance', async invalid => {
  defer = true; const pending = call('onShow'); await tick();
  const value = response(); value.statistics.month_increase_units = invalid;
  deliver(wires[0]!, value); await pending;
  expect(rows()).toEqual([]); expect(page.data.balance).toBe('—'); expect(page.data.listState).toMatchObject({ phase: 'initial-error' });
});
test('aggregate formatting remains exact at 65 digits and GROWTH keeps its separate scale', async () => {
  const { pointTotalUnits, pointUnits } = await import('../miniprogram/shared/presentation/api-point-ledger');
  expect(pointTotalUnits('9'.repeat(65), 'PINK')).toBe('9'.repeat(65));
  expect(pointTotalUnits('12000000000000000171', 'GROWTH')).toBe('1200000000000000017.1');
  expect(pointTotalUnits('0', 'GROWTH')).toBe('0');
  expect(() => pointUnits('12000000000000000171', 'PINK')).toThrow();
});
