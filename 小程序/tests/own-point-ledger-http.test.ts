import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { pointUnits } from '../miniprogram/shared/presentation/api-point-ledger';

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
    account_id: target, account: { point_kind: 'GROWTH', total_earned_points: '9007199254740993', available_points: '9007199254740993', reserved_points: '0', latest_sequence: '2' },
    items: empty ? [] : [{ entry_id: id, point_kind: 'GROWTH', account_sequence: '2', action: 'REVERSE', available_delta: '-10', reserved_delta: '0', earned_delta: '-10', available_after: '9007199254740993', reserved_after: '0', occurred_at: '2026-09-12T04:05:06Z' }],
    statistics: { timezone: 'Asia/Shanghai', day_start: '2026-09-11T16:00:00Z', week_start: '2026-09-06T16:00:00Z', today_earned_delta: '13', week_earned_delta: '-10' },
    as_of_at: '2026-09-12T05:00:00Z', page: { page_size: 20, has_more: hasMore, next_cursor: hasMore ? 'signed&cursor' : null },
  };
}
function deliver(wire: Wire, data: unknown = response()) {
  wire.success({ statusCode: status, data: status === 200 ? data : { code: status === 401 ? 'TOKEN_EXPIRED' : 'DEPENDENCY_UNAVAILABLE', message: '读取失败', request_id: 'point-http' }, header: {}, cookies: [] });
}
beforeAll(async () => {
  vi.stubGlobal('Page', (value: PageHarness) => { definition = value; });
  await import('../miniprogram/pages/star-ledger/index');
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
  expect(wires[0]?.url).toContain('/v1/me/point-entries?point_kind=GROWTH&page_size=20');
  expect(wires[0]?.header.Authorization).toBe('Bearer token-owner-a');
  expect(wires[0]?.url).not.toContain('account_id');
  expect(page.data).toMatchObject({ starBalance: '900719925474099.3', today: '+1.3', week: '−1', loggedIn: true });
  expect(rows()[0]).toMatchObject({ amount: '−1', detail: '2026-09-12 12:05' });
  call('openLevelRights'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/level-rights/index' }));
  navigateTo.mockClear(); call('openTasks'); expect(navigateTo).not.toHaveBeenCalled(); expect(showToast).toHaveBeenCalled();
});
test('guest sends no private request and offers login', async () => {
  owner = null; await call('onShow'); expect(wires).toHaveLength(0); expect(rows()).toEqual([]); expect(page.data.starBalance).toBe('—');
  call('openLevelRights'); expect(navigateTo).not.toHaveBeenCalled();
  call('openLogin'); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index?source=star-ledger' }));
});
test('empty ledger is not an API failure', async () => {
  empty = true; await call('onShow'); expect(page.data.listState).toEqual({ phase: 'empty' }); expect(page.data.starBalance).toBe('900719925474099.3');
});
test('initial failure stays an error and retry reads HTTP without Mock fallback', async () => {
  status = 503; await call('onShow'); expect(page.data.listState).toMatchObject({ phase: 'initial-error' }); expect(rows()).toEqual([]); expect(page.data.starBalance).toBe('—');
  status = 200; await call('retryInitial'); expect(rows()).toHaveLength(1); expect(wires).toHaveLength(2);
});
test('refresh failure retains only already loaded owner rows', async () => {
  await call('onShow'); status = 503; await call('onPullDownRefresh');
  expect(rows()).toHaveLength(1); expect(page.data.listState).toEqual({ phase: 'ready', incremental: 'refresh-error' });
});
test('401 clears private balance and rows', async () => {
  await call('onShow'); status = 401; await call('onPullDownRefresh');
  expect(owner).toBeNull(); expect(page.data.loggedIn).toBe(false); expect(page.data.starBalance).toBe('—'); expect(rows()).toEqual([]);
  call('openLevelRights'); expect(navigateTo).not.toHaveBeenCalled();
});
test('foreign response fails closed', async () => {
  responseOwner = 'owner-b'; await call('onShow'); expect(page.data.listState).toMatchObject({ phase: 'initial-error' }); expect(rows()).toEqual([]); expect(page.data.starBalance).toBe('—');
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
  deliver(wires[0]!); await pending; expect(rows()).toEqual([]); expect(page.data.starBalance).toBe('—');
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
  expect(page.data.loggedIn).toBe(false); expect(rows()).toEqual([]); expect(page.data.starBalance).toBe('—');
});
test('GROWTH and PINK preserve different integer scales and int64 boundaries', () => {
  expect(pointUnits('9007199254740993', 'PINK')).toBe('9007199254740993');
  expect(pointUnits('9007199254740993', 'GROWTH')).toBe('900719925474099.3');
  expect(pointUnits('-9223372036854775808', 'GROWTH', true)).toBe('−922337203685477580.8');
  expect(pointUnits('0', 'GROWTH', true)).toBe('0');
  for (const value of ['1.1', '-0', '01', '9223372036854775808', '-9223372036854775809']) expect(() => pointUnits(value, 'PINK')).toThrow();
});
