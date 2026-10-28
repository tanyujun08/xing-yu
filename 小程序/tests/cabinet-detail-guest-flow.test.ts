import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

interface PageDefinition { data: Record<string, unknown>; [key: string]: unknown }
interface PageHarness extends PageDefinition {
  setData(patch: Record<string, unknown>, callback?: () => void): void;
}

const definitions = new Map<'cabinet-detail' | 'login', PageDefinition>();
let previousPage: typeof Page | undefined;

const publicCabinetResponse = {
  cabinet_id: 'cab_public_001',
  name: '徐汇滨江租赁柜',
  description: null,
  deployment_site_name: '每日 09:00-21:00',
  status: 'ACTIVE',
  address: {
    province_name: '上海市', city_name: '上海市', district_name: '徐汇区', detail_address: '龙腾大道100号', phone_dial: '021-55556666',
    location: { latitude: '31.183', longitude: '121.459', coordinate_system: 'GCJ02' },
  },
  store: { store_id: 'merchant_public_001', name: '徐汇滨江门店' },
  supplies: [{
    asset_id: 'asset_public_001', asset_revision_id: 'revision_public_001', currency: 'CNY', rental_mode: 'DAY', supply_type: 'CABINET',
    display_name: '索尼 A7C II', description: '标准套装', allowed_actions: [{ code: 'QUOTE', enabled: true, blocked_reasons: [] as string[] }], delivery_methods: ['CABINET'],
    unit_price_fen: '19900', deposit_fen: '300000', minimum_units: '1', reference_value_fen: '1200000',
    region: { city_name: '上海市', district_name: '徐汇区' }, media: [],
  }],
  version: '3',
};
const wxStorage = new Map<string, unknown>();

const wxSpies = {
  getAccountInfoSync: vi.fn(() => ({ miniProgram: { envVersion: 'develop' } })),
  getStorageSync: vi.fn((key: string) => wxStorage.get(key)),
  setStorageSync: vi.fn((key: string, value: unknown) => { wxStorage.set(key, value); }),
  removeStorageSync: vi.fn((key: string) => { wxStorage.delete(key); }),
  navigateBack: vi.fn((options?: { complete?: () => void }) => options?.complete?.()),
  navigateTo: vi.fn((options?: { complete?: () => void }) => options?.complete?.()),
  switchTab: vi.fn((options?: { complete?: () => void }) => options?.complete?.()),
  scanCode: vi.fn(),
  showActionSheet: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  previewImage: vi.fn(),
  request: vi.fn((options: { success: (response: unknown) => void }) => {
    options.success({ statusCode: 200, data: publicCabinetResponse, header: {} });
    return { abort: vi.fn() };
  }),
};

function makePage(name: 'cabinet-detail' | 'login'): PageHarness {
  const definition = definitions.get(name);
  if (!definition) throw new Error(`${name} page was not registered`);
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch, callback) { Object.assign(this.data, patch); callback?.(); },
  };
}

function invoke<TResult>(page: PageHarness, name: string, ...args: unknown[]): TResult {
  const method = page[name];
  if (typeof method !== 'function') throw new Error(`${name} is not a page method`);
  return method.apply(page, args) as TResult;
}

beforeAll(async () => {
  vi.stubGlobal('wx', { ...wxSpies, getSystemInfoSync: () => ({ windowWidth: 375, fontSizeSetting: 16 }) });
  const globalWithPage = globalThis as typeof globalThis & { Page?: typeof Page };
  previousPage = globalWithPage.Page;
  let current: 'cabinet-detail' | 'login' | null = null;
  globalWithPage.Page = ((definition: object) => {
    if (!current) throw new Error('Unexpected page registration');
    definitions.set(current, definition as PageDefinition);
  }) as typeof Page;
  current = 'cabinet-detail';
  await import('../miniprogram/pages/cabinet-detail/index');
  current = 'login';
  await import('../miniprogram/pages/login/index');
});

afterAll(() => {
  const globalWithPage = globalThis as typeof globalThis & { Page?: typeof Page };
  if (previousPage) globalWithPage.Page = previousPage; else delete globalWithPage.Page;
});

beforeEach(() => {
  wxStorage.clear();
  publicCabinetResponse.supplies[0]!.allowed_actions = [{ code: 'QUOTE', enabled: true, blocked_reasons: [] }];
  const globalWithWx = globalThis as typeof globalThis & { wx?: WechatMiniprogram.Wx };
  globalWithWx.wx = { ...wxSpies, getSystemInfoSync: () => ({ windowWidth: 375, fontSizeSetting: 16 }) } as unknown as WechatMiniprogram.Wx;
  for (const spy of Object.values(wxSpies)) spy.mockClear();
});

describe('cabinet detail public API boundary', () => {
  test('loads the exact public cabinet id and never enters the retired Mock command flow', async () => {
    const page = makePage('cabinet-detail');
    invoke<void>(page, 'onLoad', { id: 'cab_public_001' });
    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    expect(wxSpies.request).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/\/v1\/rental-cabinets\/cab_public_001$/),
      method: 'GET',
    }));
    expect(page.data.cabinet).toMatchObject({ id: 'cab_public_001', name: '徐汇滨江租赁柜', address: '上海市上海市徐汇区龙腾大道100号' });
    expect(page.data.devices).toEqual([expect.objectContaining({ id: 'asset_public_001', name: '索尼 A7C II', priceValue: '199.00' })]);

    expect(wxSpies.scanCode).not.toHaveBeenCalled();
    invoke<void>(page, 'onUnload');
  });

  test('uses the shared shell and exposes no B5 pickup or return action', () => {
    const markup = readFileSync(new URL('../miniprogram/pages/cabinet-detail/index.wxml', import.meta.url), 'utf8');
    const config = readFileSync(new URL('../miniprogram/pages/cabinet-detail/index.json', import.meta.url), 'utf8');
    expect(markup).toContain('<page-shell');
    expect(markup).not.toContain('secondary-text="取件" primary-text="归还"');
    expect(markup).not.toContain('cabinet-credential-input');
    expect(markup).not.toMatch(/bind(?:primary|secondary|tap)="(?:startPickup|startReturn|scanAccess|submitCredential|requestOpen|requestClose)"/);
    expect(markup).not.toMatch(/orderId|订单号|¥[0-9]/);
    expect(config).toContain('"page-shell"');
  });

  test('rejects an empty route id without falling back to the first fixture cabinet', () => {
    const page = makePage('cabinet-detail');
    invoke<void>(page, 'onLoad', {});
    expect(page.data.missing).toBe(true);
    expect(wxSpies.request).not.toHaveBeenCalled();
    invoke<void>(page, 'onUnload');
  });
});


describe('cabinet rentable inventory and pickup entry', () => {
  test('refreshing after returning hides rented assets, including cover projection and stale taps', async () => {
    const page = makePage('cabinet-detail');
    invoke<void>(page, 'onLoad', { id: 'cab_public_001' });
    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    expect(page.data.devices).toHaveLength(1);
    invoke<void>(page, 'onHide');
    expect(page.data.devices).toEqual([]);
    publicCabinetResponse.supplies[0]!.allowed_actions = [{ code: 'QUOTE', enabled: false, blocked_reasons: ['ASSET_BUSY'] }];
    invoke<void>(page, 'onShow');
    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    expect(page.data.devices).toEqual([]);
    invoke<void>(page, 'openDevice', { currentTarget: { dataset: { id: 'asset_public_001' } } });
    expect(wxSpies.navigateTo).not.toHaveBeenCalled();
    invoke<void>(page, 'onUnload');
  });

  test('opens the code entry for the displayed cabinet without scanning, and rejects stale or missing entry', async () => {
    const page = makePage('cabinet-detail');
    invoke<void>(page, 'onLoad', { id: 'cab_public_001' });
    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    invoke<void>(page, 'pickupWithCode');
    expect(wxSpies.navigateTo).not.toHaveBeenCalled();
    const cabinet = page.data.cabinet as Record<string, unknown>;
    page.setData({ cabinet: { ...cabinet, pickupScene: 'cab_12345678901234567890' } });
    invoke<void>(page, 'pickupWithCode');
    expect(wxSpies.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-code/index?scene=cab_12345678901234567890' }));
    expect(wxSpies.scanCode).not.toHaveBeenCalled();
    wxSpies.navigateTo.mockClear();
    invoke<void>(page, 'onHide');
    invoke<void>(page, 'pickupWithCode');
    expect(wxSpies.navigateTo).not.toHaveBeenCalled();
    invoke<void>(page, 'onUnload');
  });
});
