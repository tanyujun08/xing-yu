import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
interface Harness { data: Record<string, unknown>; setData(p: Record<string, unknown>): void; [key: string]: unknown }
interface Wire { url: string; method: string; header: Record<string, string>; success: (response: unknown) => void }
const definitions: Record<string, Harness> = {};
let target: Harness;
let owner: string | null;
let couponCount: number;
let failure: number;
const requests: Wire[] = [];
const navigateTo = vi.fn((options: { complete?: () => void }) => options.complete?.());
const navigateBack = vi.fn((options: { complete?: () => void }) => options.complete?.());
const showToast = vi.fn();
const showModal = vi.fn();
beforeAll(async () => {
  for (const name of ['profile', 'membership']) {
    vi.stubGlobal('Page', (p: Harness) => { definitions[name] = p; });
    if (name === 'profile') await import('../miniprogram/pages/profile/index');
    else await import('../miniprogram/pages/membership/index');
  }
});
beforeEach(() => {
  owner = 'real-owner'; couponCount = 1; failure = 0; requests.length = 0;
  navigateTo.mockClear(); navigateBack.mockClear(); showToast.mockClear(); showModal.mockClear();
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60000 } : null,
    removeStorageSync: () => { owner = null; }, navigateTo, navigateBack, showToast, showModal, switchTab: vi.fn(),
    request: (wire: Wire) => {
      requests.push(wire);
      if (wire.url.includes('/v1/me/rental-conversations?')) {
        wire.success({ statusCode: failure || 200, data: failure ? { code: 'DEPENDENCY_UNAVAILABLE', message: '会话读取失败', request_id: 'unread' } : { items: [], next_cursor: null, has_more: false, total_unread_count: '2', as_of_at: '2026-10-09T12:00:00Z' }, header: {} });
        return { abort: vi.fn() };
      }
      let data: unknown = wire.url.endsWith('/v1/me/profile') ? { account_id: owner, display_name: 'API昵称', avatar_material_id: null } : wire.url.endsWith('/v1/me/benefits') ? { profile: { account_id: owner, available_pink_units: '9007199254740993', total_growth_units: '123', level_code: 'L2' }, entitlements: [] } : wire.url.endsWith('/v1/me/check-in-rule') ? { rule_version_id: 'published-v2', policy: { schema_version: 2, timezone: 'Asia/Shanghai', daily_rewards: [{ kind: 'PINK', units: '20' }, { kind: 'GROWTH', units: '50' }], first_rewards: [], milestones: [] } } : wire.url.endsWith('/v1/me/identity') ? { overall_status: 'REAL_NAME_VERIFIED', real_name: { status: 'VERIFIED', can_create_verification: false }, face: { status: 'NOT_VERIFIED', can_create_verification: true } } : { items: Array.from({ length: couponCount }, () => ({ account_id: owner, status: 'AVAILABLE' })), page: { has_more: false, next_cursor: null } };
      if (failure) data = { code: failure === 401 ? 'TOKEN_EXPIRED' : 'DEPENDENCY_UNAVAILABLE', message: '服务读取失败', request_id: 'http-test' };
      wire.success({ statusCode: failure || 200, data, header: {}, cookies: [] }); return { abort: vi.fn() };
    },
  });
});
afterEach(() => { if (target) call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());
function page(name: string) { const definition = definitions[name]!; target = { ...definition, data: structuredClone(definition.data), getTabBar: () => undefined, setData(p) { Object.assign(this.data, p); } }; }
function call(name: string, ...args: unknown[]) { return (target[name] as (...p: unknown[]) => unknown).apply(target, args); }
function assets() { return target.data.assetItems as { value: string }[]; }
test('current profile uses first-party HTTP data and refreshes coupon counts without Mock', async () => {
  page('profile'); await call('onShow');
  expect(requests).toHaveLength(5); expect(requests.every(r => r.header.Authorization === 'Bearer token-real-owner')).toBe(true);
  expect(requests.find(r => r.url.includes('/v1/me/rental-conversations?'))).toMatchObject({ method: 'GET', url: 'http://127.0.0.1:8081/v1/me/rental-conversations?context_kind=ORDER&limit=20' });
  expect(target.data.localProfile).toEqual({ name: 'API昵称', avatarPath: '' });
  expect(target.data.identityText).toBe('实名信息已填写');
  expect(target.data.identityRegistered).toBe(true);
  expect(assets()[0]?.value).toBe('9007199254740993'); expect(assets()[3]?.value).toBe('1 张');
  couponCount = 2; await call('onShow'); expect(assets()[3]?.value).toBe('2 张');
  call('openMember'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/membership/index', complete: expect.any(Function) }));
});
test('current profile guest and API failure do not restore old Mock balances', async () => {
  page('profile'); await call('onShow'); expect(target.data.identityRegistered).toBe(true);
  failure = 503; await call('onShow'); expect(target.data.identityRegistered).toBe(false); expect(assets()[3]?.value).toBe('—'); expect(target.data.errorText).toBeTruthy();
  owner = null; requests.length = 0; await call('onShow'); expect(target.data.identityRegistered).toBe(false); expect(requests).toHaveLength(0); expect(assets()[3]?.value).toBe('请登录');
  call('openMember'); expect(navigateTo).not.toHaveBeenCalled(); expect(showModal).toHaveBeenCalled();
});
test('current membership reads integer server values and guards unavailable routes', async () => {
  page('membership'); await call('onShow'); expect(requests[0]?.url).toContain('/v1/me/benefits');
  expect(requests.some(r => r.url.endsWith('/v1/me/check-in-rule'))).toBe(true);
  expect(target.data).toMatchObject({ level: 'L2', diamonds: '9007199254740993', starPoints: '12.3', dailyCheckInReward: '+20 粉钻 · +5 星光' });
  call('openCheckIn'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/check-in/index' }));
  call('goBack'); expect(navigateBack).toHaveBeenCalledOnce();
  navigateTo.mockClear(); call('openStarDetails'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/star-ledger/index' }));
  call('openBalanceDetails'); expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/powder-ledger/index' }));
  navigateTo.mockClear(); call('openShop'); call('copyInvite'); expect(navigateTo).not.toHaveBeenCalled(); expect(showToast).toHaveBeenCalledTimes(2);
});
test('membership hides private values on logout and does not navigate as guest', async () => {
  page('membership'); await call('onShow'); owner = null; requests.length = 0; await call('onShow');
  expect(target.data.loggedIn).toBe(false); expect(target.data.diamonds).toBe('—'); expect(target.data.dailyCheckInReward).toBe('—'); expect(requests).toHaveLength(0);
  call('openCheckIn'); expect(navigateTo).not.toHaveBeenCalled();
});
test.each(['profile', 'membership'])('%s clears authenticated UI when HTTP 401 revokes the session', async (name) => {
  page(name); failure = 401; await call('onShow');
  expect(owner).toBeNull(); expect(target.data.loggedIn).toBe(false);
  if (name === 'membership') { expect(target.data.loading).toBe(false); call('openCheckIn'); expect(navigateTo).not.toHaveBeenCalled(); }
  else expect(target.data.localProfile).toEqual({ name: '', avatarPath: '' });
});
test('profile keeps deposit help separate from the real PINK ledger', async () => {
  page('profile'); await call('onShow');
  const items = target.data.assetItems as { label: string; route: string }[];
  expect(items.find(item => item.label === '粉钻')?.route).toBe('/pages/powder-ledger/index');
  expect(items.find(item => item.label === '免押服务')?.route).toBe('/pages/no-deposit/index?from=profile');
  call('openItem', { currentTarget: { dataset: { route: '/pages/powder-ledger/index' } } });
  expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/powder-ledger/index' }));
});
