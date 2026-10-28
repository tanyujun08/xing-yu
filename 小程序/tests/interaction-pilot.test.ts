import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetFixture } from '../miniprogram/shared/fixture';
import { readMockState } from '../miniprogram/shared/fixture/mock-store';

const mallApi = vi.hoisted(() => ({ owner: 'account-a' as string | null, summary: vi.fn() }));


vi.mock('../miniprogram/shared/api/account-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../miniprogram/shared/api/account-api')>();
  return {
    ...original,
    accountApi: { ...original.accountApi, sessionIdentity: () => mallApi.owner },
    benefitApi: { ...original.benefitApi, summary: mallApi.summary },
  };
});

type PilotPageName = 'powder-mall' | 'withdrawal' | 'profile-edit' | 'cabinet-return';

interface PageDefinition {
  data: Record<string, unknown>;
  [key: string]: unknown;
}

interface PageHarness extends PageDefinition {
  setData(patch: Record<string, unknown>, callback?: () => void): void;
}

interface NavigationOptions {
  success?: () => void;
  fail?: (error: unknown) => void;
  complete?: () => void;
}



const definitions = new Map<PilotPageName, PageDefinition>();
let previousPage: typeof Page | undefined;

const wxSpies = {
  showToast: vi.fn(),
  showModal: vi.fn(),
  showActionSheet: vi.fn(),
  scanCode: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  navigateBack: vi.fn(),
  previewImage: vi.fn(),
  enableAlertBeforeUnload: vi.fn(),
  disableAlertBeforeUnload: vi.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(count = 6): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function makePage(name: PilotPageName, data: Record<string, unknown> = {}): PageHarness {
  const definition = definitions.get(name);
  if (!definition) throw new Error(`${name} page was not registered`);
  return {
    ...definition,
    data: { ...structuredClone(definition.data), ...data },
    setData(this: PageHarness, patch: Record<string, unknown>, callback?: () => void) {
      Object.assign(this.data, patch);
      callback?.();
    },
  };
}

function invoke<TResult>(page: PageHarness, name: string, ...args: unknown[]): TResult {
  const candidate = page[name];
  if (typeof candidate !== 'function') throw new Error(`${name} is not a page method`);
  return candidate.apply(page, args) as TResult;
}

function touch(dataset: Record<string, unknown>): WechatMiniprogram.TouchEvent {
  return { currentTarget: { dataset } } as unknown as WechatMiniprogram.TouchEvent;
}

function readPageFile(page: PilotPageName, extension: 'ts' | 'wxml'): string {
  return readFileSync(new URL(`../miniprogram/pages/${page}/index.${extension}`, import.meta.url), 'utf8');
}

beforeAll(async () => {
  const globalWithPage = globalThis as typeof globalThis & { Page?: typeof Page };
  previousPage = globalWithPage.Page;
  let currentPage: PilotPageName | null = null;
  globalWithPage.Page = ((options: object) => {
    if (!currentPage) throw new Error('Unexpected page registration');
    definitions.set(currentPage, options as PageDefinition);
  }) as typeof Page;

  currentPage = 'powder-mall';
  await import('../miniprogram/pages/powder-mall/index');
  currentPage = 'withdrawal';
  await import('../miniprogram/pages/withdrawal/index');
  currentPage = 'profile-edit';
  await import('../miniprogram/pages/profile-edit/index');
  currentPage = 'cabinet-return';
  await import('../miniprogram/pages/cabinet-return/index');
  currentPage = null;
});

afterAll(() => {
  const globalWithPage = globalThis as typeof globalThis & { Page?: typeof Page };
  if (previousPage) globalWithPage.Page = previousPage;
  else delete globalWithPage.Page;
});

beforeEach(() => {
  resetFixture();
  mallApi.owner = 'account-a';
  mallApi.summary.mockReset().mockReturnValue({
    abort: vi.fn(),
    promise: Promise.resolve({ profile: { account_id: 'account-a', available_pink_units: '9007199254740993' }, entitlements: [] }),
  });
  for (const spy of Object.values(wxSpies)) spy.mockReset();
  const globalWithWx = globalThis as typeof globalThis & { wx?: WechatMiniprogram.Wx };
  globalWithWx.wx = wxSpies as unknown as WechatMiniprogram.Wx;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('M2C pilot structure', () => {
  test('uses the shared lifecycle, stable list identities and guarded host navigation', () => {
    for (const page of ['powder-mall', 'withdrawal', 'profile-edit', 'cabinet-return'] as const) {
      const source = readPageFile(page, 'ts');
      const wxml = readPageFile(page, 'wxml');
      expect(wxml.trimStart().startsWith('<page-meta root-font-size="system" />')).toBe(true);
      if (page === 'powder-mall') {
        expect(source).toContain('createBenefitPage');
        expect(source).toContain('navigateBenefitPage');
        expect(source).toContain('accountApi.sessionIdentity');
        expect(source).toContain('benefitApi.summary');
        expect(source).not.toContain('mockApi');
        expect(source).not.toContain('redeemCoupon');
        continue;
      }
      if (page === 'cabinet-return') {
        expect(source).toContain('createReturnCabinetState');
        expect(source).not.toContain('mockApi');
        continue;
      }
      expect(source).toContain('createOperationScope');
      if (page === 'profile-edit') expect(source).toContain('accountApi.newIntent');
      else expect(source).not.toContain('createIntentKeyRegistry');
      expect(source).toContain('createNavigateOnce');
      expect(source).toMatch(/onUnload\(\).*scope\.dispose\(\).*navigation\.dispose\(\)/s);
      expect(source).toContain('.navigation.navigateOnce(');
    }

    const mallWxml = readPageFile('powder-mall', 'wxml');
    const returnSource = readPageFile('cabinet-return', 'ts');
    const returnWxml = readPageFile('cabinet-return', 'wxml');
    expect(mallWxml).toContain('wx:for="{{mallProducts}}" wx:key="id"');
    expect(mallWxml).not.toContain('wx:key="*this"');
    expect(returnSource).toContain('readReturnCabinetContext(rentalOrderApi');
    expect(returnSource).toContain('/pages/cabinets/index?mode=return&orderId=');
    expect(returnWxml).toContain('bindtap="resumeReservation"');
    expect(returnWxml).not.toContain('bindtap="reserve"');
    expect(returnWxml).not.toContain('wx:key="*this"');

  });
});

describe('M2C value-operation pilots', () => {

  test('keeps repeated mall redemption and lottery taps read only while their APIs are unavailable', async () => {
    const before = readMockState();
    const page = makePage('powder-mall');
    await invoke<Promise<void>>(page, 'onShow');

    const redemptionResults = Array.from({ length: 10 }, () => invoke<void>(page, 'redeem', touch({ productId: 'rental-10' })));
    const lotteryResults = Array.from({ length: 10 }, () => invoke<void>(page, 'goLottery'));

    expect(redemptionResults).toEqual(Array.from({ length: 10 }, () => undefined));
    expect(lotteryResults).toEqual(Array.from({ length: 10 }, () => undefined));
    expect(wxSpies.showToast).toHaveBeenCalledTimes(20);
    for (const [options] of wxSpies.showToast.mock.calls) {
      expect(options).toEqual({ title: '接口暂未接入', icon: 'none' });
    }
    expect(page.data).toMatchObject({ loggedIn: true, balance: '9007199254740993' });
    expect(readMockState()).toEqual(before);
    invoke<void>(page, 'onUnload');
  });

  test('discards a late mall summary after the account changes and loads only the new owner', async () => {
    const first = deferred<{ profile: { account_id: string; available_pink_units: string }; entitlements: never[] }>();
    mallApi.summary.mockReturnValueOnce({ abort: vi.fn(), promise: first.promise });
    const page = makePage('powder-mall');
    const firstLoad = invoke<Promise<void>>(page, 'onShow');
    await flushMicrotasks();

    mallApi.owner = 'account-b';
    first.resolve({ profile: { account_id: 'account-a', available_pink_units: '111' }, entitlements: [] });
    await firstLoad;
    expect(page.data).toMatchObject({ loggedIn: false, balance: '—', loading: false, errorText: '请登录后查看账户权益' });

    mallApi.summary.mockReturnValueOnce({
      abort: vi.fn(),
      promise: Promise.resolve({ profile: { account_id: 'account-b', available_pink_units: '222' }, entitlements: [] }),
    });
    await invoke<Promise<void>>(page, 'onShow');
    expect(page.data).toMatchObject({ loggedIn: true, balance: '222', loading: false, errorText: '' });
    invoke<void>(page, 'onUnload');
  });

  test('ignores a late mall summary after hide and starts a fresh visible request', async () => {
    const first = deferred<{ profile: { account_id: string; available_pink_units: string }; entitlements: never[] }>();
    mallApi.summary.mockReturnValueOnce({ abort: vi.fn(), promise: first.promise });
    const page = makePage('powder-mall');
    const firstLoad = invoke<Promise<void>>(page, 'onShow');
    await flushMicrotasks();
    invoke<void>(page, 'onHide');

    first.resolve({ profile: { account_id: 'account-a', available_pink_units: 'private-late-value' }, entitlements: [] });
    await firstLoad;
    expect(page.data).toMatchObject({ loggedIn: false, balance: '—' });

    mallApi.summary.mockReturnValueOnce({
      abort: vi.fn(),
      promise: Promise.resolve({ profile: { account_id: 'account-a', available_pink_units: '333' }, entitlements: [] }),
    });
    await invoke<Promise<void>>(page, 'onShow');
    expect(mallApi.summary).toHaveBeenCalledTimes(2);
    expect(page.data).toMatchObject({ loggedIn: true, balance: '333', loading: false, errorText: '' });
    invoke<void>(page, 'onUnload');
  });

  test('aborts an in-flight mall summary on unload and ignores its late result', async () => {
    const pending = deferred<{ profile: { account_id: string; available_pink_units: string }; entitlements: never[] }>();
    const abort = vi.fn();
    mallApi.summary.mockReturnValueOnce({ abort, promise: pending.promise });
    const page = makePage('powder-mall');
    const operation = invoke<Promise<void>>(page, 'onShow');
    await flushMicrotasks();
    invoke<void>(page, 'onUnload');
    const dataAtUnload = structuredClone(page.data);

    expect(abort).toHaveBeenCalledTimes(1);
    pending.resolve({ profile: { account_id: 'account-a', available_pink_units: 'late-after-unload' }, entitlements: [] });
    await operation;
    expect(page.data).toEqual(dataAtUnload);
    expect(wxSpies.showToast).not.toHaveBeenCalled();
    expect(wxSpies.navigateTo).not.toHaveBeenCalled();
  });
});

describe('M2C host callback lifecycle', () => {
  test('uses the authorized mall navigation lock and blocks navigation while hidden or unloaded', async () => {
    const page = makePage('powder-mall');
    await invoke<Promise<void>>(page, 'onShow');
    Array.from({ length: 10 }, () => invoke<void>(page, 'goLedger'));
    expect(wxSpies.navigateTo).toHaveBeenCalledTimes(1);
    expect(wxSpies.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/powder-ledger/index' }));
    (wxSpies.navigateTo.mock.calls[0]?.[0] as NavigationOptions).complete?.();

    invoke<void>(page, 'goCheckIn');
    expect(wxSpies.navigateTo).toHaveBeenCalledTimes(2);
    expect(wxSpies.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/check-in/index' }));
    (wxSpies.navigateTo.mock.calls[1]?.[0] as NavigationOptions).complete?.();

    invoke<void>(page, 'onHide');
    invoke<void>(page, 'goCoupons');
    expect(wxSpies.navigateTo).toHaveBeenCalledTimes(2);

    await invoke<Promise<void>>(page, 'onShow');
    invoke<void>(page, 'goCoupons');
    expect(wxSpies.navigateTo).toHaveBeenCalledTimes(3);
    expect(wxSpies.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/coupons/index' }));
    invoke<void>(page, 'onUnload');
    invoke<void>(page, 'goLedger');
    expect(wxSpies.navigateTo).toHaveBeenCalledTimes(3);
  });
});
