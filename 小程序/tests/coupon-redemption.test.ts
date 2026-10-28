// Current powder-mall API behavior; no local coupon issuance or order engine.
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { resetFixture } from '../miniprogram/shared/fixture';
import { readMockState, writeMockState } from '../miniprogram/shared/fixture/mock-store';

const mallApi = vi.hoisted(() => ({ owner: 'account-a' as string | null, summary: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../miniprogram/shared/api/account-api')>();
  return {
    ...original,
    accountApi: { ...original.accountApi, sessionIdentity: () => mallApi.owner },
    benefitApi: { ...original.benefitApi, summary: mallApi.summary },
  };
});

interface PageHarness {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  [key: string]: unknown;
}
const definitions: Record<string, PageHarness> = {};
const host = { showToast: vi.fn(), showModal: vi.fn(), navigateTo: vi.fn(), redirectTo: vi.fn(), navigateBack: vi.fn(), getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ top: 26, height: 32, bottom: 58 }) };
beforeAll(async () => {
  vi.stubGlobal('wx', host);
  for (const name of ['powder-mall']) {
    vi.stubGlobal('Page', (definition: PageHarness) => { definitions[name] = definition; });
    if (name === 'powder-mall') await import('../miniprogram/pages/powder-mall/index');
  }
});
beforeEach(() => {
  resetFixture();
  vi.clearAllMocks();
  mallApi.owner = 'account-a';
  mallApi.summary.mockReset().mockReturnValue({
    abort: vi.fn(),
    promise: Promise.resolve({ profile: { account_id: 'account-a', available_pink_units: '9007199254740993' }, entitlements: [] }),
  });
  const state = readMockState();
  state.diamondBalances[state.currentAccountId] = 30_000;
  writeMockState(state);
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

function page(name: string): PageHarness {
  const definition = definitions[name]!;
  return { ...definition, data: structuredClone(definition.data), getTabBar: () => undefined, setData(patch) { Object.assign(this.data, patch); } };
}
function call(target: PageHarness, method: string, ...args: unknown[]): unknown {
  return (target[method] as (...args: unknown[]) => unknown).apply(target, args);
}
test('production mall projects the current API PINK string without mutating Mock coupon state', async () => {
  const before = readMockState();
  const mall = page('powder-mall');
  await call(mall, 'onShow');
  expect(mallApi.summary).toHaveBeenCalledTimes(1);
  expect(mall.data).toMatchObject({ loggedIn: true, balance: '9007199254740993' });
  expect(readMockState()).toEqual(before);
  call(mall, 'onUnload');
});

test('production mall fails closed for guests, foreign accounts and unavailable API responses', async () => {
  mallApi.owner = null;
  const guest = page('powder-mall');
  await call(guest, 'onShow');
  expect(mallApi.summary).not.toHaveBeenCalled();
  expect(guest.data).toMatchObject({ loggedIn: false, balance: '—' });
  call(guest, 'onUnload');

  mallApi.owner = 'account-a';
  mallApi.summary.mockReturnValueOnce({ abort: vi.fn(), promise: Promise.resolve({ profile: { account_id: 'account-b', available_pink_units: '77' }, entitlements: [] }) });
  const foreign = page('powder-mall');
  await call(foreign, 'onShow');
  expect(foreign.data).toMatchObject({ balance: '—', errorText: '账户响应不一致' });
  call(foreign, 'onUnload');

  mallApi.summary.mockReturnValueOnce({ abort: vi.fn(), promise: Promise.reject(new Error('权益接口不可用')) });
  const unavailable = page('powder-mall');
  await call(unavailable, 'onShow');
  expect(unavailable.data).toMatchObject({ balance: '—', errorText: '权益接口不可用' });
  call(unavailable, 'onUnload');
});

test('production mall leaves redemption and lottery unimplemented without issuing or debiting', async () => {
  const before = readMockState();
  const mall = page('powder-mall');
  await call(mall, 'onShow');
  await call(mall, 'redeem', { currentTarget: { dataset: { couponId: 'rental-10' } } });
  await call(mall, 'goLottery');
  expect(host.showToast).toHaveBeenCalledTimes(2);
  expect(host.showToast).toHaveBeenNthCalledWith(1, { title: '接口暂未接入', icon: 'none' });
  expect(host.showToast).toHaveBeenNthCalledWith(2, { title: '接口暂未接入', icon: 'none' });
  expect(readMockState()).toEqual(before);
  call(mall, 'onUnload');
});
