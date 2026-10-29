import { readDiscoveryCity } from '../../shared/api/supply-api';
import { orderUnreadLifecycle } from '../../shared/api/rental-api';
import { designAssets } from '../../shared/design/assets';
import { supplyApi, type RentalSupply, type SupplyFilter } from '../../shared/api/supply-api';
import { accountApi } from '../../shared/api/account-api';
import { supplyCard, publicSupplyGallery } from '../../shared/presentation/api-supply';
import { publicPhoto } from '../../shared/presentation/material-media';
import { storeApi, cabinetApi, type PublicCabinet } from '../../shared/api/supply-api';
import { businessHoursText, navigableLocation } from '../../shared/presentation/store-details';
import { openSupplyLocation } from '../../shared/presentation/supply-location';
import { discoveryApi, type DiscoverySupply } from '../../shared/api/supply-api';
import { readNavigationMetrics } from '../../shared/presentation/navigation-metrics';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { openLoginLegal, runLoginSheet } from '../../shared/interaction/login-sheet-host';
const sources = ['全部', '柜机', '门店', '个人'];
const sourceCodes: Record<string, RentalSupply['supply_type'] | undefined> = { 全部: undefined, 柜机: 'CABINET', 门店: 'STORE', 个人: 'PERSONAL' };
const storeEpochs = new WeakMap<object, number>();
const cabinetEpochs = new WeakMap<object, number>();
type HomeStore = { id: string; name: string; media: string; location: string; address: string; hours: string; phone: string; deviceCount: number; deviceCountText: string; meta: string; latitude?: number; longitude?: number };
type HomeCabinet = { id: string; name: string; address: string; pickupScene: string; latitude?: number; longitude?: number; devices: ReturnType<typeof supplyCard>[] };
function matchKeyword(devices: ReturnType<typeof supplyCard>[], keyword: string) { const text = keyword.trim().toLowerCase(); return text ? devices.filter(item => item.name.toLowerCase().includes(text) || item.location.toLowerCase().includes(text)) : devices; }
function cabinetCard(cabinet: PublicCabinet, covers: Map<string, string>, width: number, fontSize: number): HomeCabinet {
  const latitude = Number(cabinet.address.location?.latitude), longitude = Number(cabinet.address.location?.longitude);
  return { id: cabinet.cabinet_id, name: cabinet.name, pickupScene: cabinet.pickup_scene ?? '',
    address: [cabinet.address.district_name, cabinet.address.detail_address, cabinet.deployment_site_name].filter(Boolean).join(' · '),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) && cabinet.address.location ? { latitude, longitude } : {}),
    devices: cabinet.supplies.map(supply => supplyCard(supply, width, fontSize, covers.get(supply.asset_id) ?? '')) };
}
const states = new WeakMap<object, { epoch: number; owner: string; visible: boolean; active?: { abort: () => void }; entries: (RentalSupply | DiscoverySupply)[]; covers: Map<string, string>; navigation: ReturnType<typeof createNavigateOnce> }>();
function state(page: object) { let value = states.get(page); if (!value) { value = { epoch: 0, owner: '', visible: true, entries: [], covers: new Map<string, string>(), navigation: createNavigateOnce() }; states.set(page, value); } return value; }
Page({
    data: { icons: designAssets, statusBarHeight: 0, navigationHeight: 44, windowWidth: 430, fontSizeSetting: 16, region: '', regionShort: '全部城市', stores: [] as HomeStore[], storeCount: 0, cabinet: null as HomeCabinet | null, cabinetCount: 0, keyword: '', devices: [] as ReturnType<typeof supplyCard>[], visibleDevices: [] as ReturnType<typeof supplyCard>[], categoryFilterOptions: [{ value: '全部', label: '推荐' }] as { value: string; label: string }[], supplyFilterOptions: sources.map(value => ({ value, label: value })), selectedCategory: '全部', selectedSupply: '全部', loading: false, errorText: '', nextCursor: '', hasMore: false, loggedIn: false },
  onLoad() { const nav = readNavigationMetrics(); this.setData({ ...readDisplayWindowMetrics(), statusBarHeight: nav.statusBarHeight, navigationHeight: nav.totalHeight }); },
  onResize(event: { size: { windowWidth: number } }) { this.setData({ ...readDisplayWindowMetrics(), windowWidth: event.size.windowWidth }); this.refreshDevices(); },
  refreshDevices() { const devices = state(this).entries.map(item => supplyCard(item, this.data.windowWidth, this.data.fontSizeSetting, state(this).covers.get(item.asset_id) ?? '')); this.setData({ devices, visibleDevices: matchKeyword(devices, this.data.keyword) }); void this.loadDeviceCovers(); },
  async loadDeviceCovers() {
    const s = state(this);
    for (const entry of s.entries) {
      if (s.covers.has(entry.asset_id)) continue;
      const url=publicSupplyGallery(entry)[0]?.src;if(url)s.covers.set(entry.asset_id,url);
    }
    if(s.visible){const devices=s.entries.map(item=>supplyCard(item,this.data.windowWidth,this.data.fontSizeSetting,s.covers.get(item.asset_id)??''));this.setData({devices,visibleDevices:matchKeyword(devices,this.data.keyword)});}
  },
  onShow() { this.getTabBar()?.setData({ selected: 0 }); state(this).visible = true; orderUnreadLifecycle.show(this); void this.loadSupplies(false); },
  onHide() { orderUnreadLifecycle.hide(this); const s = state(this); s.visible = false; ++s.epoch; storeEpochs.set(this, (storeEpochs.get(this) ?? 0) + 1); s.active?.abort(); s.entries = []; s.covers.clear(); cabinetEpochs.set(this, (cabinetEpochs.get(this) ?? 0) + 1); this.setData({ stores: [], storeCount: 0, cabinet: null, cabinetCount: 0, devices: [], visibleDevices: [], loading: false, hasMore: false, nextCursor: '' }); },
  onUnload() { this.onHide(); state(this).navigation.dispose(); states.delete(this); },
  async loadSupplies(append = false) {
    const s = state(this), owner = accountApi.sessionIdentity() ?? ''; s.active?.abort(); const epoch = ++s.epoch; s.owner = owner;
    if (!append) { s.entries = []; s.covers.clear(); this.setData({ devices: [], visibleDevices: [], nextCursor: '', hasMore: false }); }
    this.setData({ loggedIn: !!owner, errorText: '', loading: true });
    const city = readDiscoveryCity(); this.setData({ region: city?.name ?? '', regionShort: city?.name ?? '全部城市' }); if (!append) { void this.loadStores(); void this.loadCabinets(); } const filter: SupplyFilter & { category_id?: string } = {}; if (city) filter.city_id = city.cityId; const source = sourceCodes[this.data.selectedSupply]; if (source) filter.supply_type = source; if (this.data.selectedCategory !== '全部') filter.category_id = this.data.selectedCategory; if (append && this.data.nextCursor) filter.cursor = this.data.nextCursor;
    const handle = owner ? supplyApi.list(filter) : discoveryApi.listSupplies(filter); s.active = handle;
    try { const page = await handle.promise; if (!s.visible || epoch !== s.epoch) return; if ((accountApi.sessionIdentity() ?? '') !== owner) { s.entries = []; this.setData({ devices: [], visibleDevices: [], loggedIn: false, hasMore: false, nextCursor: '', errorText: '登录状态已变化，请重新读取。' }); return; }
      if (append && page.page.has_more && page.page.next_cursor === filter.cursor) throw new Error('分页位置未前进，请刷新。');
      const ids = new Set(s.entries.map(item => item.asset_id)); s.entries = append ? [...s.entries, ...page.items.filter(item => !ids.has(item.asset_id))] : page.items;
      const categories = (page.facets?.categories ?? []).map(item => ({ value: item.category_id, label: item.name }));
      this.setData({ hasMore: page.page.has_more, nextCursor: page.page.next_cursor ?? '', categoryFilterOptions: [{ value: '全部', label: '推荐' }, ...categories] }); this.refreshDevices();
    } catch (error) { if (s.visible && epoch === s.epoch) { if ((accountApi.sessionIdentity() ?? '') !== owner) { s.entries = []; this.setData({ devices: [], visibleDevices: [], loggedIn: false, hasMore: false, nextCursor: '' }); } this.setData({ errorText: error instanceof Error ? error.message : '设备读取失败，请重试。' }); } }
    finally { if (s.visible && epoch === s.epoch) this.setData({ loading: false }); }
  },
  retrySupplies() { void this.loadSupplies(false); },
  loadMore() { if (!this.data.loading && this.data.hasMore) void this.loadSupplies(true); },
  onReachBottom() { this.loadMore(); },
  openLogin() { (this.selectComponent('#login-sheet') as unknown as { open(): void } | null)?.open(); },
  isLoginHostActive() { return states.has(this) && state(this).visible; },
  onWechatLogin() { void runLoginSheet(this, () => accountApi.login(), () => this.onLoginSuccess()); },
  onPhoneLogin(event: WechatMiniprogram.CustomEvent<{ phoneCode: string }>) { void runLoginSheet(this, () => accountApi.phoneLogin(event.detail.phoneCode), () => this.onLoginSuccess()); },
  onLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>) { openLoginLegal(event); },
  onLoginSuccess() { void this.loadSupplies(false); void this.loadStores(); },
  openCheckIn() { state(this).navigation.navigateOnce('check-in', callbacks => wx.navigateTo({ url: '/pages/check-in/index', ...callbacks })); },
  openRegion() { state(this).navigation.navigateOnce('region', callbacks => wx.navigateTo({ url: '/pages/region/index', ...callbacks })); },
  openCabinets() { this.setData({ selectedSupply: '柜机' }); void this.loadSupplies(false); },
  async loadStores() {
    const s = state(this), owner = accountApi.sessionIdentity() ?? '';
    const epoch = (storeEpochs.get(this) ?? 0) + 1; storeEpochs.set(this, epoch);
    this.setData({ stores: [] });
    const city = readDiscoveryCity(); const handle = owner ? storeApi.list(city ? { city_id: city.cityId } : {}) : discoveryApi.listStores(city ? { city_id: city.cityId } : {});
    try {
      const page = await handle.promise; if (!s.visible || epoch !== storeEpochs.get(this) || (accountApi.sessionIdentity() ?? '') !== owner) return;
      const stores: HomeStore[] = (Array.isArray(page?.items) ? page.items : []).filter(store => !!store && !!store.store_id && store.status === 'ACTIVE').map(store => {
        const deviceCount = (Array.isArray(store.supplies) ? store.supplies : []).length;
        const hours = businessHoursText(store.business_hours);
        const base = { id: store.store_id, name: store.name, media: publicPhoto(store.cover ?? undefined), hours, deviceCount, deviceCountText: deviceCount ? `${deviceCount} 台` : '查看门店', meta: [hours, deviceCount ? `${deviceCount} 台设备` : ''].filter(Boolean).join(' · ') };
        if ('region' in store) return { ...base, location: [store.region.city_name, store.region.district_name].filter(Boolean).join(''), address: [store.region.district_name, store.public_address].filter(Boolean).join(' '), phone: store.public_phone ?? '' };
        return { ...base, location: [store.address?.city_name, store.address?.district_name].filter(Boolean).join(''), address: [store.address?.district_name, store.address?.detail_address].filter(Boolean).join(' '), phone: store.address?.phone_dial ?? '', ...(navigableLocation(store.address?.location) ?? {}) };
      });
      this.setData({ stores, storeCount: stores.length });
    } catch { if (s.visible && epoch === storeEpochs.get(this) && (accountApi.sessionIdentity() ?? '') === owner) this.setData({ stores: [], storeCount: 0 }); }
  },
  async loadCabinets() {
    const s = state(this), epoch = (cabinetEpochs.get(this) ?? 0) + 1; cabinetEpochs.set(this, epoch);
    const city = readDiscoveryCity();
    try {
      const page = await cabinetApi.list(city ? { city_id: city.cityId } : {}).promise; if (!s.visible || epoch !== cabinetEpochs.get(this)) return;
      const items = (Array.isArray(page?.items) ? page.items : []).filter(cabinet => !!cabinet && cabinet.status === 'ACTIVE');
      const first = items[0]; if (!first) { this.setData({ cabinet: null, cabinetCount: 0 }); return; }
      const covers = new Map<string, string>(); for (const supply of first.supplies) { const url = publicSupplyGallery(supply)[0]?.src; if (url) covers.set(supply.asset_id, url); }
      this.setData({ cabinet: cabinetCard(first, covers, this.data.windowWidth, this.data.fontSizeSetting), cabinetCount: items.length });
    } catch { if (s.visible && epoch === cabinetEpochs.get(this)) this.setData({ cabinet: null, cabinetCount: 0 }); }
  },
  openCabinetList() { state(this).navigation.navigateOnce('cabinets', callbacks => wx.navigateTo({ url: '/pages/cabinets/index', ...callbacks })); },
  openCabinetDetail() { const id = this.data.cabinet?.id; if (id) state(this).navigation.navigateOnce('cabinet:' + id, callbacks => wx.navigateTo({ url: '/pages/cabinet-detail/index?id=' + encodeURIComponent(id), ...callbacks })); },
  openCabinetDevice(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id'] ?? ''); if (id && this.data.cabinet?.devices.some(item => item.id === id)) state(this).navigation.navigateOnce('cabinet-supply:' + id, callbacks => wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(id) + '&source=cabinet', ...callbacks })); },
  pickupWithCode() { const scene = this.data.cabinet?.pickupScene ?? ''; if (!/^cab_[A-Za-z0-9]{20}$/.test(scene)) { wx.showToast({ title: '当前柜机取件入口暂不可用，请刷新', icon: 'none' }); return; } state(this).navigation.navigateOnce('cabinet-pickup', callbacks => wx.navigateTo({ url: '/pages/cabinet-code/index?scene=' + encodeURIComponent(scene), ...callbacks })); },
  navigateCabinet() { const cabinet = this.data.cabinet; if (cabinet) openSupplyLocation(cabinet); },
  navigateStore(event: WechatMiniprogram.TouchEvent) { const store = this.data.stores.find(item => item.id === event.currentTarget.dataset['id']); if (store) openSupplyLocation(store); },
  callStore(event: WechatMiniprogram.TouchEvent) { const phoneNumber = (this.data.stores.find(item => item.id === event.currentTarget.dataset['id'])?.phone ?? '').trim(); if (!phoneNumber) { wx.showToast({ title: '联系电话待完善', icon: 'none' }); return; } wx.makePhoneCall({ phoneNumber, fail: (error) => { if (!error.errMsg.includes('cancel')) wx.showToast({ title: '暂时无法拨打', icon: 'none' }); } }); },
  onSearchInput(event: WechatMiniprogram.Input) { const keyword = event.detail.value; this.setData({ keyword, visibleDevices: matchKeyword(this.data.devices, keyword) }); },
  clearSearch() { this.setData({ keyword: '', visibleDevices: this.data.devices }); },
  openStores() { state(this).navigation.navigateOnce('stores', callbacks => wx.navigateTo({ url: '/pages/stores/index', ...callbacks })); },
  openStore(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id'] ?? ''); if (!id) return; state(this).navigation.navigateOnce('store:' + id, callbacks => wx.navigateTo({ url: '/pages/store-detail/index?id=' + encodeURIComponent(id), ...callbacks })); },
  openPublish() { wx.showToast({ title: '发布入口正在接入', icon: 'none' }); },
  openDevice(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id'] ?? ''); const s = state(this); if (!s.visible || (accountApi.sessionIdentity() ?? '') !== s.owner || !s.entries.some(item => item.asset_id === id)) return; s.navigation.navigateOnce('supply:' + id, callbacks => wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(id), ...callbacks })); },
  selectCategory(event: WechatMiniprogram.TouchEvent) { const selectedCategory = String(event.currentTarget.dataset['category'] ?? ''); if (!this.data.categoryFilterOptions.some(item => item.value === selectedCategory)) return; this.setData({ selectedCategory }); void this.loadSupplies(false); },
  selectSupply(event: WechatMiniprogram.TouchEvent) { const selectedSupply = String(event.currentTarget.dataset['supply'] ?? ''); if (!sources.includes(selectedSupply)) return; this.setData({ selectedSupply }); void this.loadSupplies(false); },
  resetDeviceFilters() { this.setData({ selectedCategory: '全部', selectedSupply: '全部', keyword: '' }); void this.loadSupplies(false); },
});
