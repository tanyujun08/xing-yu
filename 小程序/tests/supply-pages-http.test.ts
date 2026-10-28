import { readDiscoveryCity, selectDiscoveryCity } from '../miniprogram/shared/session/discovery-city';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { RentalSupply } from '../miniprogram/shared/api/supply-api';
interface Harness { data: Record<string, unknown>; setData(p: Record<string, unknown>): void; [key: string]: unknown }
interface Wire { url: string; header: Record<string, string>; success: (response: unknown) => void; fail: (error: { errMsg: string }) => void }
const definitions: Record<string, Harness> = {}; let target: Harness; let wires: Wire[]; let owner: string | null;
const navigateTo = vi.fn(), abort = vi.fn(), openSheet = vi.fn();
const item = { pickup_location: null, asset_id: 'asset-1', asset_revision_id: 'revision-1', product_id: 'product', display_name: '真实相机', condition: '良好', description: '已审核说明', defect_description: '', accessories_text: '镜头', supply_type: 'PERSONAL', rental_mode: 'DAY', currency: 'CNY', unit_price_fen: '9007199254740993', deposit_fen: '12300', reference_value_fen: '99999999999999999', minimum_units: '1', available_from: '2026-09-01T00:00:00Z', available_until: '2027-09-01T00:00:00Z', version: '3', region: { dataset_id: 'dataset', province_id: 'province', city_id: 'city', district_id: 'district', province_name: '广东省', city_name: '深圳市', district_name: '南山区' }, media: [], delivery_methods: ['EXPRESS'], allowed_actions: [{ code: 'QUOTE', enabled: true, blocked_reasons: [] }] } satisfies RentalSupply;
const guestItem = { asset_id: 'asset-1', display_name: '真实相机', category: { category_id: 'category-1', name: '相机' }, supply_type: 'PERSONAL', rental_mode: 'DAY', currency: 'CNY', unit_price_fen: '9007199254740993', deposit_fen: '12300', condition: '良好', description: '已审核说明', availability_status: 'AVAILABLE', region: { city_id: 'city', city_name: '深圳市', district_id: 'district', district_name: '南山区' }, media: [] };
test('cabinet location is visible and navigable before ordering, and cleared on hide', async () => {
  page('detail'); const pending = call('refreshSupply');
  respond(supplyWire(), { ...item, supply_type: 'CABINET', pickup_location: { cabinet_id: 'cab-1', name: '百家湖租赁柜', address: { province_name: '江苏省', city_name: '南京市', district_name: '江宁区', detail_address: '兴湖街', location: null } } });
  await pending;
  expect(target.data.device).toMatchObject({ location: '百家湖租赁柜', address: '江苏省南京市江宁区兴湖街' });
  call('openStores'); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-detail/index?id=cab-1' }));
  navigateTo.mockClear(); call('onHide'); call('openStores'); expect(navigateTo).not.toHaveBeenCalled();
});
beforeAll(async () => { let name = 'home'; vi.stubGlobal('Page', (definition: Harness) => { definitions[name] = definition; }); await import('../miniprogram/pages/home/index'); name = 'detail'; await import('../miniprogram/pages/detail/index'); name = 'region'; await import('../miniprogram/pages/region/index'); });
beforeEach(() => { selectDiscoveryCity(null); owner = 'viewer'; wires = []; navigateTo.mockClear(); abort.mockClear(); openSheet.mockClear(); vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: () => owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60000 } : null, removeStorageSync: () => { owner = null; }, request: (wire: Wire) => { wires.push(wire); return { abort }; }, navigateTo, showToast: vi.fn(), navigateBack: vi.fn(), getWindowInfo: () => ({ windowWidth: 430, windowHeight: 932, statusBarHeight: 44 }), getAppBaseInfo: () => ({ fontSizeSetting: 16 }), getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32 }) }); });
afterEach(() => { if (target) call('onUnload'); });
function page(name: string) { const definition = definitions[name]!; target = { ...definition, data: structuredClone(definition.data), getTabBar: () => undefined, selectComponent: () => ({ open: openSheet }), setData(p) { Object.assign(this.data, p); } }; if (name === 'detail') call('onLoad', { id: 'asset-1' }); }
function call(name: string, ...args: unknown[]) { return (target[name] as (...p: unknown[]) => unknown).apply(target, args); }
const answered = new Set<Wire>();
function respond(wire: Wire, data: unknown, statusCode = 200) { answered.add(wire); wire.success({ statusCode, data, header: {}, cookies: [] }); }
function pendingWires() { return wires.filter(wire => !answered.has(wire)); }
function isSideWire(wire: Wire) { return wire.url.includes('/v1/rental-stores') || wire.url.includes('/v1/discovery/stores') || wire.url.includes('/download-authorizations'); }
// The discovery home also loads the public store projection and, for a returned device, its
// short-lived media grant. Those side calls are answered with an explicit empty/denied result
// so the assertions below still address the supply request they were written for.
function drainSideCalls() {
  for (const wire of pendingWires()) {
    if (wire.url.includes('/v1/rental-stores?')) respond(wire, { items: [], page: { page_size: 20, has_more: false } });
    else if (wire.url.includes('/v1/discovery/stores?')) respond(wire, { items: [], page: { page_size: 20, has_more: false }, filters: { city_id: '' } });
    else if (wire.url.includes('/v1/rental-stores/')) respond(wire, { store_id: 'store', name: '门店', status: 'ACTIVE', address: { province_name: '', city_name: '', district_name: '', detail_address: '' }, supplies: [], version: '1' });
    else if (wire.url.includes('/download-authorizations')) respond(wire, { code: 'PERMISSION_DENIED', message: '无权限', request_id: 'r' }, 403);
  }
}
function supplyWire() { const wire = pendingWires().find(candidate => !isSideWire(candidate)); if (!wire) throw new Error('no pending supply request'); return wire; }
function list(items: RentalSupply[] = [item], next = '') { return { items, page: { page_size: 20, has_more: !!next, ...(next ? { next_cursor: next } : {}) } }; }

test('home uses HTTP integer strings, no fabricated images, and only navigates a returned device', async () => { page('home'); const pending = call('loadSupplies', false); drainSideCalls(); const supply = supplyWire(); expect(supply.header.Authorization).toBe('Bearer token-viewer'); respond(supply, list()); await pending; const cards = target.data.visibleDevices as Record<string, string>[]; expect(cards[0]).toMatchObject({ id: 'asset-1', homePrice: '90071992547409.93', deposit: '123.00', homeImage: '', homeLayout: 'long-amount' }); call('openDevice', { currentTarget: { dataset: { id: 'foreign' } } }); expect(navigateTo).not.toHaveBeenCalled(); call('openDevice', { currentTarget: { dataset: { id: 'asset-1' } } }); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/detail/index?id=asset-1' })); });
test('empty filtered pages keep server cursor and continue to the next page', async () => { page('home'); let pending = call('loadSupplies', false); drainSideCalls(); respond(supplyWire(), list([], 'opaque-cursor')); await pending; expect(target.data.hasMore).toBe(true); pending = call('loadSupplies', true); const next = supplyWire(); expect(next.url).toContain('cursor=opaque-cursor'); respond(next, list()); await pending; expect(target.data.hasMore).toBe(false); expect(target.data.visibleDevices).toHaveLength(1); });
test.each(['home', 'detail'])('%s rejects late responses after account changes', async name => { page(name); const pending = call(name === 'home' ? 'loadSupplies' : 'refreshSupply'); if (name === 'home') drainSideCalls(); owner = 'new-owner'; respond(supplyWire(), name === 'home' ? list() : item); await pending; expect(target.data.loggedIn).toBe(false); expect(target.data.loading).toBe(false); expect(name === 'home' ? target.data.visibleDevices : target.data.loaded).toEqual(name === 'home' ? [] : false); });
test.each(['home', 'detail'])('%s clears the screen on hide and ignores an old response', async name => { page(name); const pending = call(name === 'home' ? 'loadSupplies' : 'refreshSupply'); if (name === 'home') drainSideCalls(); call('onHide'); expect(abort).toHaveBeenCalled(); respond(supplyWire(), name === 'home' ? list() : item); await pending; expect(name === 'home' ? target.data.visibleDevices : target.data.loaded).toEqual(name === 'home' ? [] : false); });
test('home 503 stays empty and guest reads the anonymous API without Mock devices', async () => { page('home'); let pending = call('loadSupplies'); drainSideCalls(); respond(supplyWire(), { code: 'DEPENDENCY_UNAVAILABLE', message: '不可用', request_id: 'r' }, 503); await pending; expect(target.data.visibleDevices).toEqual([]); expect(target.data.errorText).toBeTruthy(); owner = null; wires = []; pending = call('loadSupplies'); drainSideCalls(); const guest = supplyWire(); expect(guest.url).toContain('/v1/discovery/rental-supplies?'); expect(guest.header.Authorization).toBeUndefined(); respond(guest, { items: [], page: { page_size: 20, has_more: false }, facets: { categories: [] }, filters: { city_id: '', category_id: '', supply_type: '', query: '' } }); await pending; expect(target.data.visibleDevices).toEqual([]); expect(target.data.errorText).toBe(''); });
test('guest browses a returned device and uses a real category filter', async () => { owner = null; page('home'); const pending = call('loadSupplies'); drainSideCalls(); const guest = supplyWire(); expect(guest.header.Authorization).toBeUndefined(); respond(guest, { items: [guestItem], page: { page_size: 20, has_more: false }, facets: { categories: [guestItem.category] }, filters: { city_id: '', category_id: '', supply_type: '', query: '' } }); await pending; expect((target.data.visibleDevices as { id: string }[]).map(device => device.id)).toEqual(['asset-1']); call('openDevice', { currentTarget: { dataset: { id: 'asset-1' } } }); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/detail/index?id=asset-1' })); call('selectCategory', { currentTarget: { dataset: { category: 'category-1' } } }); drainSideCalls(); const filtered = supplyWire(); expect(filtered.url).toContain('category_id=category-1'); respond(filtered, { items: [guestItem], page: { page_size: 20, has_more: false }, facets: { categories: [guestItem.category] }, filters: { city_id: '', category_id: 'category-1', supply_type: '', query: '' } }); for (let i = 0; i < 8; i++) await Promise.resolve(); expect(target.data.selectedCategory).toBe('category-1'); });
test('guest B2C private action opens the shared sheet and resumes only after current authenticated supply recheck', async () => { owner = null; page('detail'); const pending = call('refreshSupply'); const wire = wires[0]!; expect(wire.url).toContain('/v1/discovery/rental-supplies/asset-1'); expect(wire.header.Authorization).toBeUndefined(); respond(wire, {...guestItem,supply_type:'CABINET'}); await pending; expect(target.data).toMatchObject({ loaded: true, canQuote: true, rentText: '90071992547409.93', depositText: '123.00' }); call('buy'); expect(openSheet).toHaveBeenCalledTimes(1); expect(navigateTo).not.toHaveBeenCalled(); owner = 'viewer'; const resumed = call('onLoginSuccess') as Promise<void>; const authenticated = wires[1]!; expect(authenticated.header.Authorization).toBe('Bearer token-viewer'); expect(navigateTo).not.toHaveBeenCalled(); respond(authenticated, {...item,supply_type:'CABINET',delivery_methods:['CABINET']}); await resumed; expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/confirm/index?deviceId=asset-1' })); });
test('personal supply opens login and only authenticated server QUOTE allows checkout',async()=>{
 owner=null;page('detail');let pending=call('refreshSupply');respond(wires[0]!,guestItem);await pending;
 expect(target.data).toMatchObject({loaded:true,personalDisplayOnly:false,canQuote:true});call('buy');expect(openSheet).toHaveBeenCalledTimes(1);expect(navigateTo).not.toHaveBeenCalled();
 owner='viewer';pending=call('onLoginSuccess');expect(wires[1]!.header.Authorization).toBe('Bearer token-viewer');expect(navigateTo).not.toHaveBeenCalled();respond(wires[1]!,{...item,region:null});await pending;
 expect(target.data).toMatchObject({loaded:true,personalDisplayOnly:false,canQuote:true});expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/confirm/index?deviceId=asset-1'}));call('buy');expect(navigateTo).toHaveBeenCalledTimes(1);expect(wires).toHaveLength(2);
});
test('detail projects server deposit and disables self-rental without manufacturing an order', async () => { page('detail'); const pending = call('refreshSupply'); respond(wires[0]!, { ...item, allowed_actions: [{ code: 'QUOTE', enabled: false, blocked_reasons: ['OWN_SUPPLY'] }] }); await pending; expect(target.data).toMatchObject({ rentText: '90071992547409.93', depositText: '123.00', loaded: true, canQuote: false }); call('buy'); expect(navigateTo).not.toHaveBeenCalled(); expect(wires).toHaveLength(1); });
test.each(['ASSET_BUSY', 'QUOTE_DISABLED'])('detail respects server-disabled %s without manufacturing an order', async blocked => { page('detail'); const pending = call('refreshSupply'); respond(wires[0]!, { ...item, allowed_actions: [{ code: 'QUOTE', enabled: false, blocked_reasons: [blocked] }] }); await pending; expect(target.data).toMatchObject({ loaded: true, canQuote: false }); call('buy'); expect(navigateTo).not.toHaveBeenCalled(); expect(wires).toHaveLength(1); });
test('detail 404 or a wrong asset never keeps an old device visible', async () => { page('detail'); let pending = call('refreshSupply'); respond(wires[0]!, item); await pending; expect(target.data.loaded).toBe(true); pending = call('refreshSupply'); respond(wires[1]!, { ...item, asset_id: 'foreign' }); await pending; expect(target.data.loaded).toBe(false); expect(target.data.errorText).toContain('不匹配'); pending = call('refreshSupply'); respond(wires[2]!, { code: 'RESOURCE_NOT_FOUND', message: '不可发现', request_id: 'r' }, 404); await pending; expect(target.data.loaded).toBe(false); });
test('home forwards selected city and source unchanged and retains a server-approved remote express asset', async () => { page('home'); selectDiscoveryCity({datasetId:'d',cityId:'beijing',name:'北京市'}); target.data.selectedSupply='个人'; const pending=call('loadSupplies'); drainSideCalls(); const supply=supplyWire(); expect(supply.url).toContain('city_id=beijing'); expect(supply.url).toContain('supply_type=PERSONAL'); respond(supply,list([{...item,delivery_methods:['EXPRESS']}])); await pending; expect(target.data.regionShort).toBe('北京市'); expect(target.data.visibleDevices).toHaveLength(1); });
test('home unavailable entry guards never navigate to legacy Mock stores or publishing', () => { page('home'); call('openStores'); call('openPublish'); call('selectCategory',{currentTarget:{dataset:{category:'独立镜头'}}}); expect(navigateTo).toHaveBeenCalledTimes(1); expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/stores/index' })); expect(wires).toHaveLength(0); });
test('region selection accepts only a returned city ID and never a hardcoded name or URL identity',async()=>{page('region');const pending=call('onShow');respond(wires[0]!,{dataset_id:'d',items:[{region_id:'p',name:'广东省',level:'PROVINCE'}]});for(let i=0;i<8;i++)await Promise.resolve();respond(wires[1]!,{dataset_id:'d',items:[{region_id:'shenzhen',name:'深圳市',level:'CITY'}]});await pending;expect(target.data.cityGroups).toEqual([{letter:'S',cities:[{id:'shenzhen',name:'深圳市'}]}]);call('selectCity',{currentTarget:{dataset:{id:'forged',city:'北京市'}}});expect(readDiscoveryCity()).toBeNull();call('selectCity',{currentTarget:{dataset:{id:'shenzhen'}}});expect(readDiscoveryCity()).toEqual({datasetId:'d',cityId:'shenzhen',name:'深圳市'});});

test('signed-in cabinet supply consumes disabled QUOTE without hiding its official details or creating an order', async () => {
  page('detail'); const reading = call('refreshSupply');
  respond(wires[0]!, { ...item, supply_type: 'CABINET', delivery_methods: ['CABINET'], allowed_actions: [{ code: 'QUOTE', enabled: false, blocked_reasons: ['ASSET_BUSY'] }] });
  await reading;
  expect(target.data).toMatchObject({ loaded: true, canQuote: false, personalDisplayOnly: false, quoteBlockedText: '当前设备暂不能租赁，请刷新或联系客服', rentText: '90071992547409.93', depositText: '123.00', device: { id: item.asset_id, name: item.display_name, supplyType: 'cabinet', location: '深圳市南山区' } });
  call('buy');
  expect(navigateTo).not.toHaveBeenCalled(); expect(openSheet).not.toHaveBeenCalled(); expect(wires).toHaveLength(1);
  expect(wx.showToast).toHaveBeenCalledWith({ title: '当前设备暂不能租赁，请刷新或联系客服', icon: 'none' });
  call('onHide'); expect(target.data.quoteBlockedText).toBe('');
});
test('anonymous cabinet detail invites login without asserting command permission', async () => {
  owner = null; page('detail'); const reading = call('refreshSupply');
  expect(wires[0]!.url).toContain('/v1/discovery/rental-supplies/asset-1'); expect(wires[0]!.header.Authorization).toBeUndefined();
  respond(wires[0]!, { ...guestItem, supply_type: 'CABINET' }); await reading;
  expect(target.data).toMatchObject({ loaded: true, loggedIn: false, canQuote: true, quoteBlockedText: '', device: { id: item.asset_id, name: item.display_name, supplyType: 'cabinet' } });
  call('buy'); expect(openSheet).toHaveBeenCalledTimes(1); expect(navigateTo).not.toHaveBeenCalled(); expect(wires).toHaveLength(1);
});
test('cabinet ordering message follows the current server action and cannot remain on a later store read or failed refresh', async () => {
  page('detail'); let reading = call('refreshSupply');
  respond(wires[0]!, { ...item, supply_type: 'CABINET', allowed_actions: [{ code: 'QUOTE', enabled: false, blocked_reasons: ['ASSET_BUSY'] }] }); await reading;
  expect(target.data.quoteBlockedText).toBe('当前设备暂不能租赁，请刷新或联系客服');
  reading = call('refreshSupply'); expect(target.data.quoteBlockedText).toBe('');
  respond(wires[1]!, { ...item, supply_type: 'STORE' }); await reading;
  expect(target.data).toMatchObject({ loaded: true, canQuote: false, quoteBlockedText: '' });
  call('buy'); expect(navigateTo).not.toHaveBeenCalled(); expect(wires).toHaveLength(2);
  reading = call('refreshSupply'); respond(wires[2]!, { code: 'RESOURCE_NOT_FOUND', message: '已下架', request_id: 'r' }, 404); await reading;
  expect(target.data).toMatchObject({ loaded: false, canQuote: false, quoteBlockedText: '' });
});

test.each(['CABINET', 'PERSONAL'] as const)('authenticated %s QUOTE enters the existing checkout without lessor shipping-address fields', async supplyType => {
  page('detail'); const reading = call('refreshSupply');
  const method = supplyType === 'CABINET' ? 'CABINET' : 'EXPRESS';
  const value: RentalSupply = { ...item, supply_type: supplyType, delivery_methods: [method], region: supplyType === 'PERSONAL' ? null : item.region };
  expect(wires[0]!.url).toContain('/v1/rental-supplies/asset-1');
  expect(wires[0]!.header.Authorization).toBe('Bearer token-viewer');
  respond(wires[0]!, value); await reading;
  expect(target.data).toMatchObject({ loaded: true, canQuote: true, personalDisplayOnly: false, quoteBlockedText: '', pickupMethods: [{ id: method }], returnMethods: [{ id: method }] });
  call('buy'); call('buy');
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/confirm/index?deviceId=asset-1' }));
  expect(openSheet).not.toHaveBeenCalled();
  expect(wires).toHaveLength(1);
});

test.each([
  ['CABINET', 'OWN_SUPPLY'], ['CABINET', 'ASSET_BUSY'], ['CABINET', 'QUOTE_DISABLED'],
  ['PERSONAL', 'OWN_SUPPLY'], ['PERSONAL', 'ASSET_BUSY'], ['PERSONAL', 'QUOTE_DISABLED'],
] as const)('login rechecks %s and refuses its latest %s instead of using guest availability', async (supplyType, blocked) => {
  owner = null; page('detail'); const guestRead = call('refreshSupply');
  respond(wires[0]!, { ...guestItem, supply_type: supplyType }); await guestRead;
  expect(target.data.canQuote).toBe(true); call('buy');
  expect(openSheet).toHaveBeenCalledTimes(1); expect(navigateTo).not.toHaveBeenCalled();
  owner = 'viewer'; const loginReturn = call('onLoginSuccess');
  expect(wires[1]!.url).toContain('/v1/rental-supplies/asset-1');
  expect(wires[1]!.header.Authorization).toBe('Bearer token-viewer');
  expect(target.data.canQuote).toBe(false); call('buy'); expect(navigateTo).not.toHaveBeenCalled();
  respond(wires[1]!, { ...item, supply_type: supplyType, delivery_methods: [supplyType === 'CABINET' ? 'CABINET' : 'EXPRESS'], allowed_actions: [{ code: 'QUOTE', enabled: false, blocked_reasons: [blocked] }] });
  await loginReturn; call('buy');
  expect(target.data).toMatchObject({ loaded: true, canQuote: false, quoteBlockedText: '当前设备暂不能租赁，请刷新或联系客服' });
  expect(navigateTo).not.toHaveBeenCalled(); expect(wires).toHaveLength(2);
});
