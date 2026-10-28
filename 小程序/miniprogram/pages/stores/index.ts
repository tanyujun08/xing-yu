import { designAssets } from '../../shared/design/assets';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { listPreview } from '../../shared/presentation/list-preview';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { readDiscoveryCity, storeApi, type PublicStore, type RentalSupply } from '../../shared/api/supply-api';
import { discoveryApi, type DiscoveryStoreSummary } from '../../shared/api/supply-api';
import { publicSupplyGallery } from '../../shared/presentation/api-supply';
import { publicPhoto } from '../../shared/presentation/material-media';
import { accountApi } from '../../shared/api/account-api';
import { openLoginLegal, runLoginSheet } from '../../shared/interaction/login-sheet-host';
import { businessHoursText } from '../../shared/presentation/store-details';

function cityName(value: string): string {
  const cityEnd = value.indexOf('市');
  return cityEnd >= 0 ? value.slice(0, cityEnd + 1) : value;
}

type StoreListView = {
  id: string;
  name: string;
  addressLabel: string;
  hours: string;
  distance: string;
  gallery: string[];
  devices: never[];
  featuredDevice: never | null;
  availabilityLabel: string;
  previewCopy: string;
};

const coverStates = new WeakMap<object, Map<string, string>>();
type StoreState = { epoch: number; visible: boolean; owner: string; items: (PublicStore | DiscoveryStoreSummary)[]; cursors: Set<string>; active?: { abort: () => void } };
const pageStates = new WeakMap<object, StoreState>();

function covers(page: object): Map<string, string> {
  const current = coverStates.get(page);
  if (current) return current;
  const created = new Map<string, string>();
  coverStates.set(page, created);
  return created;
}

function pageState(page: object): StoreState {
  const current = pageStates.get(page);
  if (current) return current;
  const created: StoreState = { epoch: 0, visible: true, owner: '', items: [], cursors: new Set() };
  pageStates.set(page, created);
  return created;
}

// The public projection carries amounts as minor-unit strings; the shared
// template renders the value verbatim, so it must be formatted here and never
// passed through as a raw fen count.
function deviceView(supply: RentalSupply, coverUrl: string) {
  return {
    id: supply.asset_id,
    name: supply.display_name,
    displayImage: coverUrl,
    displayDescription: supply.description,
    displayTags: [] as string[],
    supplyType: supply.supply_type.toLowerCase(),
    location: [supply.region?.city_name, supply.region?.district_name].filter(Boolean).join(''),
    priceSymbol: '¥',
    priceValue: formatCNYMinorUnits(supply.unit_price_fen).slice(1),
    priceUnit: supply.rental_mode === 'HOUR' ? '/小时' : '/天',
    depositValue: formatCNYMinorUnits(supply.deposit_fen).slice(1),
    priceLabel: '',
    depositLabel: '',
    priceLine: '',
  };
}

// Only the public store projection is rendered here: no fixture store, no fixture device, and no
// distance (the contract returns none, so inventing one would be a lie).
function storeView(store: PublicStore | DiscoveryStoreSummary, coverMap: Map<string, string>): StoreListView {
  if ('region' in store) return {
    id: store.store_id, name: store.name,
    addressLabel: [store.region.city_name, store.region.district_name].filter(Boolean).join(' '),
    hours: '', distance: '', gallery: store.cover ? [store.cover.url] : [], devices: [] as never[],
    featuredDevice: null, availabilityLabel: '查看门店', previewCopy: '进入门店查看可租设备',
  };
  const supplies = Array.isArray(store.supplies) ? store.supplies : [];
  const devices = supplies.map((supply) => deviceView(supply, coverMap.get(supply.asset_id) ?? '')) as never[];
  return {
    id: store.store_id,
    name: store.name,
    addressLabel: [store.address?.city_name, store.address?.district_name, store.address?.detail_address].filter(Boolean).join(' '),
    hours: businessHoursText(store.business_hours),
    distance: '',
    gallery: (store.photo_material_ids ?? []).map(id => coverMap.get('photo:' + id) ?? '').filter(Boolean),
    devices: listPreview(devices, 3).items,
    featuredDevice: devices[0] ?? null,
    availabilityLabel: `${supplies.length}台设备`,
    previewCopy: '当前门店暂无可租设备',
  };
}

Page({
  refreshType() { this.setData({ largeType: readDisplayWindowMetrics().fontSizeSetting > 20 }); },
  onResize() { this.refreshType(); },
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    largeType: readDisplayWindowMetrics().fontSizeSetting > 20,
    region: '',
    regionCity: '',
    regionShort: '全部城市',
    regions: [] as {id:string;label:string}[],
    stores: [] as StoreListView[],
    loading: false,
    errorText: '',
    hasMore: false,
    nextCursor: '',
  },

  async loadStores(append = false) {
    const state = pageState(this);
    if (append && (this.data.loading || !this.data.hasMore)) return;
    state.active?.abort();
    const epoch = ++state.epoch;
    const owner = accountApi.sessionIdentity() ?? '';
    state.owner = owner;
    const city = readDiscoveryCity();
    if (!append) { state.items = []; state.cursors.clear(); covers(this).clear(); this.setData({ stores: [], hasMore: false, nextCursor: '' }); }
    this.setData({ region: city?.name ?? '', regionCity: city?.name ? cityName(city.name) : '全部城市', regionShort: city?.name ?? '全部城市', regions: [], loading: true, errorText: '' });
    try {
      const filter: { city_id?: string; cursor?: string } = city ? { city_id: city.cityId } : {};
      if (append) filter.cursor = this.data.nextCursor;
      const handle = owner ? storeApi.list(filter) : discoveryApi.listStores(filter); state.active = handle;
      const page = await handle.promise;
      if (!state.visible || epoch !== state.epoch || owner !== (accountApi.sessionIdentity() ?? '')) return;
      const cursor = page.page.next_cursor ?? '';
      if (page.page.has_more && (!cursor || state.cursors.has(cursor))) throw new Error('门店分页未前进，请刷新。');
      if (cursor) state.cursors.add(cursor);
      const items = (Array.isArray(page?.items) ? page.items : []).filter((store) => !!store && !!store.store_id && store.status === 'ACTIVE');
      const ids = new Set(state.items.map(item => item.store_id));
      state.items = append ? [...state.items, ...items.filter(item => !ids.has(item.store_id))] : items;
      const coverMap = covers(this);
      this.setData({ stores: state.items.map((store) => storeView(store, coverMap)), hasMore: page.page.has_more, nextCursor: cursor });
      if (owner) {
        const authenticated = items.filter((store): store is PublicStore => 'address' in store);
        void this.loadSupplyCovers(authenticated.flatMap(store => store.supplies), authenticated, epoch);
        void this.loadStorePhotos(authenticated, epoch);
      }
    } catch (error) { if (state.visible && epoch === state.epoch) this.setData({ errorText: error instanceof Error ? error.message : '门店读取失败，请重试。' }); }
    finally {
      if (state.visible && epoch === state.epoch) {
        if (owner !== (accountApi.sessionIdentity() ?? '')) { state.items = []; covers(this).clear(); this.setData({ stores: [], hasMore: false, nextCursor: '', errorText: '登录状态已变化，请重新读取。' }); }
        this.setData({ loading: false });
      }
    }
  },

  async loadStorePhotos(items: PublicStore[], epoch: number) {
    const state = pageState(this), coverMap = covers(this);
    for (const store of items) {
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '')) return;
      for(const photo of store.photos){const url=publicPhoto(photo);if(url)coverMap.set('photo:'+photo.material_id,url)}
    }
    this.setData({stores:state.items.map(item=>storeView(item,coverMap))});
  },

  async loadSupplyCovers(supplies: RentalSupply[], items: PublicStore[], epoch: number) {
    const state = pageState(this);
    const coverMap = covers(this);
    for (const supply of supplies) {
      if (coverMap.has(supply.asset_id)) continue;
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '')) return;
      const url=publicSupplyGallery(supply)[0]?.src;if(url)coverMap.set(supply.asset_id,url);
    }
    this.setData({stores:items.map(store=>storeView(store,coverMap))});
  },

  onShow() { const state = pageState(this); state.visible = true; this.refreshType(); void this.loadStores(); },

  onHide() { const state = pageState(this); state.visible = false; ++state.epoch; state.active?.abort(); state.items = []; covers(this).clear(); this.setData({ stores: [], loading: false, hasMore: false, nextCursor: '' }); },

  onUnload() { this.onHide(); pageStates.delete(this); coverStates.delete(this); },

  chooseRegion() { wx.navigateTo({ url: `/pages/region/index?region=${encodeURIComponent(this.data.region)}` }); },

  // The public store projection is city-scoped: it returns no district list, so the rail cannot
  // filter locally. The declared 区域 interaction therefore opens the same server-backed city
  // picker the location bar uses instead of pretending to know districts it was never given.
  selectRegion() { this.chooseRegion(); },

  openCabinets() { wx.redirectTo({ url: '/pages/cabinets/index' }); },

  refreshStores() { void this.loadStores(); },
  loadMore() { void this.loadStores(true); },
  openLogin() { (this.selectComponent('#login-sheet') as unknown as { open(): void } | null)?.open(); },
  isLoginHostActive() { return pageStates.has(this) && pageState(this).visible; },
  onWechatLogin() { void runLoginSheet(this, () => accountApi.login(), () => this.onLoginSuccess()); },
  onPhoneLogin(event: WechatMiniprogram.CustomEvent<{ phoneCode: string }>) { void runLoginSheet(this, () => accountApi.phoneLogin(event.detail.phoneCode), () => this.onLoginSuccess()); },
  onLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>) { openLoginLegal(event); },
  onLoginSuccess() { void this.loadStores(); },

  openStore(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (!id) return;
    wx.navigateTo({ url: `/pages/store-detail/index?id=${encodeURIComponent(id)}` });
  },

  openDevice(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}&source=store` });
  },

  goBack() { wx.navigateBack(); },
});
