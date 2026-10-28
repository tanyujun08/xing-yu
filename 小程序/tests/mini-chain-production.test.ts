import { beforeAll, beforeEach, afterAll, expect, test, vi } from 'vitest';
import { businessHoursText, navigableLocation } from '../miniprogram/shared/presentation/store-details';
import { currentAllowances } from '../miniprogram/shared/presentation/member-allowances';
import { retireLegacyStorage } from '../miniprogram/shared/session/retire-legacy-storage';
import { ApiProblem } from '../miniprogram/shared/api/problem';

const api = vi.hoisted(() => ({ owner: 'account-a' as string | null, city: null as null | { cityId: string; name: string }, list: vi.fn(), detail: vi.fn(), guestList: vi.fn(), guestDetail: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ accountApi: { sessionIdentity: () => api.owner }, ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem }));
vi.mock('../miniprogram/shared/api/supply-api', () => ({ readDiscoveryCity: () => api.city, storeApi: { list: api.list, detail: api.detail }, discoveryApi: { listStores: api.guestList, getStore: api.guestDetail } }));
interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
const pages: Record<string, Harness> = {}; let loadingPage = '';
beforeAll(async () => {
  vi.stubGlobal('wx', { getWindowInfo: () => ({ windowWidth: 390 }), getAppBaseInfo: () => ({ fontSizeSetting: 16 }) });
  vi.stubGlobal('Page', (value: Harness) => { pages[loadingPage] = value; });
  loadingPage = 'stores'; await import('../miniprogram/pages/stores/index');
  loadingPage = 'detail'; await import('../miniprogram/pages/store-detail/index');
});
beforeEach(() => { api.owner = 'account-a'; api.city = null; api.list.mockReset(); api.detail.mockReset(); api.guestList.mockReset(); api.guestDetail.mockReset(); vi.stubGlobal('wx', { removeStorageSync: vi.fn(), openLocation: vi.fn(), makePhoneCall: vi.fn(), showToast: vi.fn(), getWindowInfo: () => ({ windowWidth: 390 }), getAppBaseInfo: () => ({ fontSizeSetting: 16 }) }); });
afterAll(() => vi.unstubAllGlobals());
function page(name: string) { const original = pages[name]!; return { ...original, data: structuredClone(original.data), setData(patch: Record<string, unknown>) { Object.assign(this.data, patch); } } as Harness; }
function call(p: Harness, method: string, ...args: unknown[]) { return (p[method] as (...values: unknown[]) => unknown).apply(p, args); }
function store(id: string) { return { store_id: id, name: id, status: 'ACTIVE', address: { city_name: '城市', detail_address: '地址' }, supplies: [], version: '1',photos:[],cover:null,photo_material_ids:[] }; }
function response(items: ReturnType<typeof store>[], cursor = '') { return { abort: vi.fn(), promise: Promise.resolve({ items, page: { has_more: !!cursor, next_cursor: cursor } }) }; }

test('guest lists and opens approved stores through anonymous projections', async () => {
  api.owner = null;
  const summary = { store_id: 'guest-store', name: '公开门店', status: 'ACTIVE', region: { city_id: 'city-1', city_name: '深圳市', district_id: 'district-1', district_name: '南山区' }, cover: null };
  api.guestList.mockReturnValue({ abort: vi.fn(), promise: Promise.resolve({ items: [summary], page: { has_more: false } }) });
  const listPage = page('stores');
  await call(listPage, 'loadStores');
  expect(api.list).not.toHaveBeenCalled();
  expect(api.guestList).toHaveBeenCalledWith({});
  expect(listPage.data.stores).toMatchObject([{ id: 'guest-store', addressLabel: '深圳市 南山区', previewCopy: '进入门店查看可租设备' }]);
  const supply = { asset_id: 'asset-1', display_name: '相机', category: { category_id: 'category-1', name: '相机' }, supply_type: 'STORE', rental_mode: 'DAY', currency: 'CNY', unit_price_fen: '3000', deposit_fen: '5000', condition: 'GOOD', description: '公开说明', availability_status: 'AVAILABLE', region: summary.region, media: [] };
  api.guestDetail.mockReturnValue({ abort: vi.fn(), promise: Promise.resolve({ ...summary, business_hours: null, public_address: '营业地址', public_phone: '0755-12345678', supplies: [supply], media: [] }) });
  const detailPage = page('detail');
  await call(detailPage, 'loadStore', 'guest-store');
  expect(api.detail).not.toHaveBeenCalled();
  expect(detailPage.data.store).toMatchObject({ id: 'guest-store', phone: '0755-12345678', address: '深圳市 南山区 营业地址' });
  expect(detailPage.data.devices).toMatchObject([{ id: 'asset-1', priceValue: '30.00' }]);
  call(detailPage, 'showContact');
  expect(wx.makePhoneCall).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: '0755-12345678' }));
});

test('store transport failure remains an error, never a successful empty list', async () => {
  const p = page('stores'); api.list.mockReturnValue({ abort: vi.fn(), promise: Promise.reject(new Error('网络失败')) });
  await call(p, 'loadStores'); expect(p.data).toMatchObject({ stores: [], errorText: '网络失败', loading: false });
});
test('store pagination supports empty intermediate pages and prevents cursor cycles', async () => {
  const p = page('stores'); api.list.mockReturnValueOnce(response([], 'next-a')).mockReturnValueOnce(response([store('one')], 'next-b')).mockReturnValueOnce(response([store('one'), store('two')], 'next-a'));
  await call(p, 'loadStores'); expect(p.data).toMatchObject({ stores: [], hasMore: true });
  await call(p, 'loadStores', true); expect(api.list).toHaveBeenLastCalledWith({ cursor: 'next-a' });
  expect((p.data.stores as { id: string }[]).map(item => item.id)).toEqual(['one']);
  await call(p, 'loadStores', true); expect(p.data.errorText).toContain('分页未前进');
});
test('old city and foreign-account results cannot repaint stores', async () => {
  const p = page('stores'); let resolveOld!: (value: unknown) => void;
  api.list.mockReturnValueOnce({ abort: vi.fn(), promise: new Promise(resolve => { resolveOld = resolve; }) }).mockReturnValueOnce(response([store('new-city')]));
  const old = call(p, 'loadStores'); api.city = { cityId: 'new', name: '新城市' }; await call(p, 'loadStores');
  resolveOld({ items: [store('old-city')], page: { has_more: false } }); await old;
  expect((p.data.stores as { id: string }[]).map(item => item.id)).toEqual(['new-city']);
  call(p, 'onHide'); expect(p.data.stores).toEqual([]);
  const q = page('stores'); let resolveForeign!: (value: unknown) => void;
  api.list.mockReturnValue({ abort: vi.fn(), promise: new Promise(resolve => { resolveForeign = resolve; }) });
  const pending = call(q, 'loadStores'); api.owner = 'account-b'; resolveForeign({ items: [store('private')], page: { has_more: false } }); await pending;
  expect(q.data.stores).toEqual([]); expect(q.data.errorText).toContain('登录状态');
});
test('store details distinguish 404 from network failure', async () => {
  const p = page('detail'); api.detail.mockReturnValueOnce({ promise: Promise.reject(new Error('网络失败')) }).mockReturnValueOnce({ promise: Promise.reject(new ApiProblem(404, { code: 'NOT_FOUND', message: 'missing', request_id: 'r' })) });
  await call(p, 'loadStore', 'one'); expect(p.data).toMatchObject({ missing: false, errorText: '网络失败', store: null });
  await call(p, 'loadStore', 'one'); expect(p.data).toMatchObject({ missing: true, errorText: '' });
  expect(p.data.heroImages).toEqual([]);
});
test('store detail clears identity-bound data and rejects hidden responses', async () => {
  const p = page('detail'); let finish!: (value: unknown) => void;
  api.detail.mockReturnValue({ promise: new Promise(resolve => { finish = resolve; }) });
  const pending = call(p, 'loadStore', 'one'); call(p, 'onHide'); finish(store('one')); await pending;
  expect(p.data.store).toBeNull(); expect(p.data.devices).toEqual([]);
});

test('store contact and navigation use the latest merchant profile without requiring business hours', async () => {
  const p = page('detail');
  const profile = { ...store('merchant-one'), name: '合成商家', business_hours: null, address: { city_name: '深圳市', district_name: '南山区', detail_address: '合成地址 12 号', phone_dial: '13800000000', location: { latitude: '22.500000', longitude: '114.100000', coordinate_system: 'GCJ02', source: 'MAP_PICK' } } };
  api.detail.mockReturnValueOnce({ promise: Promise.resolve(profile) });
  await call(p, 'loadStore', 'merchant-one');
  expect(wx.makePhoneCall).not.toHaveBeenCalled();
  expect(wx.openLocation).not.toHaveBeenCalled();
  expect(p.data.store).toMatchObject({ id: 'merchant-one', phone: '13800000000', hours: '' });
  call(p, 'showContact'); call(p, 'showAddress');
  expect(wx.makePhoneCall).toHaveBeenLastCalledWith(expect.objectContaining({ phoneNumber: '13800000000' }));
  expect(wx.openLocation).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 22.5, longitude: 114.1, name: '合成商家', address: '深圳市 南山区 合成地址 12 号' }));
  api.detail.mockReturnValueOnce({ promise: Promise.resolve({ ...profile, address: { ...profile.address, phone_dial: '13900000000', location: { ...profile.address.location, latitude: '22.600000' } } }) });
  await call(p, 'loadStore', 'merchant-one'); call(p, 'showContact'); call(p, 'showAddress');
  expect(wx.makePhoneCall).toHaveBeenLastCalledWith(expect.objectContaining({ phoneNumber: '13900000000' }));
  expect(wx.openLocation).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 22.6 }));
});

test('missing store phone or unverified coordinates do not invoke device capabilities', async () => {
  const p = page('detail'); api.detail.mockReturnValue({ promise: Promise.resolve(store('one')) });
  await call(p, 'loadStore', 'one'); call(p, 'showContact'); call(p, 'showAddress');
  expect(wx.makePhoneCall).not.toHaveBeenCalled(); expect(wx.openLocation).not.toHaveBeenCalled();
  expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '联系电话待完善' }));
  expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '门店导航位置暂未提供' }));
});
test('store hours are server-derived and only bounded GCJ02 coordinates navigate', () => {
  const week = Array.from({ length: 7 }, (_, index) => ({ day: index + 1, closed: false, intervals: [{ start: '09:00', end: '18:00' }] }));
  expect(businessHoursText({ week })).toBe('每天 09:00–18:00');
  expect(businessHoursText({ week: week.map(day => day.day > 5 ? { ...day, closed: true, intervals: [] } : day) })).toBe('周一至周五 09:00–18:00；周六至周日 休息');
  expect(businessHoursText({ week: [{ day: 1, closed: false, intervals: [{ start: '09:00', end: '18:00' }] }, { day: 2, closed: true, intervals: [] }] })).toBe('周一 09:00–18:00；周二 休息');
  expect(navigableLocation({ latitude: '22.5', longitude: '114.1', coordinate_system: 'GCJ02' })).toEqual({ latitude: 22.5, longitude: 114.1 });
  for (const [latitude, system] of [['91', 'GCJ02'], ['', 'GCJ02'], ['22.5', 'WGS84']]) expect(navigableLocation({ latitude: latitude!, longitude: '114', coordinate_system: system! })).toBeNull();
});
test('monthly counts preserve integer strings and use the server as-of cycle', () => {
  const summary = { as_of_at: '2026-09-20T00:00:00Z', allowances: [{ allowance_id: 'a', cycle_key: '2026-09', cycle_start: '2026-09-01T00:00:00Z', cycle_end: '2026-10-01T00:00:00Z', granted_count: '9007199254740993', available_count: '9007199254740990', consumed_count: '2', reserved_count: '1', revoked_count: '0' }] };
  expect(currentAllowances(summary as Parameters<typeof currentAllowances>[0])[0]).toMatchObject({ available: '9007199254740990', consumed: '2' });
  expect(currentAllowances({ ...summary, as_of_at: '2026-10-01T00:00:00Z' } as Parameters<typeof currentAllowances>[0])).toEqual([]);
  expect(() => currentAllowances({} as Parameters<typeof currentAllowances>[0])).toThrow('不完整');
});
test('retired synthetic caches are deleted by exact key without touching real sessions', () => {
  retireLegacyStorage(); const removed = vi.mocked(wx.removeStorageSync).mock.calls.map(call => call[0]);
  expect(removed).toContain('xingyu.session.v1'); expect(removed).toContain('xingyu:rental:1.0.0.11');
  expect(removed).not.toContain('xingyu.api-session.v1'); expect(removed).not.toContain('xingyu.discovery-city.v1');
});
