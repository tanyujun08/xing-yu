import { designAssets } from '../../shared/design/assets';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { readDiscoveryCity, storeApi, type PublicStore, type RentalSupply } from '../../shared/api/supply-api';
import { discoveryApi, type DiscoveryStoreSummary } from '../../shared/api/supply-api';
import { publicSupplyGallery } from '../../shared/presentation/api-supply';
import { publicPhoto } from '../../shared/presentation/material-media';
import { accountApi } from '../../shared/api/account-api';
import { openLoginLegal, runLoginSheet } from '../../shared/interaction/login-sheet-host';
import { businessHoursText, isOpenNow } from '../../shared/presentation/store-details';
import { openSupplyLocation } from '../../shared/presentation/supply-location';
import { distanceFrom, pointOf, readAuthorizedPoint, type Point } from '../../shared/presentation/nearby';

function cityName(value: string): string {
  const cityEnd = value.indexOf('市');
  return cityEnd >= 0 ? value.slice(0, cityEnd + 1) : value;
}

type ShelfSlot = { id: string; name: string; image: string; priceValue: string; priceUnit: string; priceFen: number; cheapest: boolean };

type StoreListView = {
  id: string;
  name: string;
  district: string;
  addressLabel: string;
  statusLabel: string;
  hoursLabel: string;
  distance: string;
  meters: number;
  gallery: string[];
  cover: string;
  rows: { id: string; items: ShelfSlot[] }[];
  fromPrice: string;
  total: number;
  hasMoreDevices: boolean;
  canNavigate: boolean;
  empty: boolean;
  summaryOnly: boolean;
};

const SHELF_LIMIT = 6;

const coverStates = new WeakMap<object, Map<string, string>>();
type StoreState = { origin: Point | null; epoch: number; visible: boolean; owner: string; pinned: string; items: (PublicStore | DiscoveryStoreSummary)[]; cursors: Set<string>; active?: { abort: () => void } };
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
  const created: StoreState = { origin: null, epoch: 0, visible: true, owner: '', pinned: '', items: [], cursors: new Set() };
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

function shelfRows(all: ShelfSlot[]): { id: string; items: ShelfSlot[] }[] {
  const shown = all.slice(0, SHELF_LIMIT), rows: { id: string; items: ShelfSlot[] }[] = [];
  for (let at = 0; at < shown.length; at += 3) rows.push({ id: 'row' + at, items: shown.slice(at, at + 3) });
  return rows;
}

// Only the public store projection is rendered here: no fixture store or device. Distance exists only
// when the user already allowed location; opening status is computed from the published hours.
function storeView(store: PublicStore | DiscoveryStoreSummary, coverMap: Map<string, string>, origin: Point | null): StoreListView {
  if (!('address' in store)) return {
    id: store.store_id, name: store.name, district: store.region.district_name ?? '',
    addressLabel: [store.region.city_name, store.region.district_name].filter(Boolean).join(' '),
    statusLabel: '', hoursLabel: '营业时间未填写', distance: '', meters: Number.POSITIVE_INFINITY,
    gallery: store.cover ? [store.cover.url] : [], cover: store.cover?.url ?? '', rows: [], fromPrice: '', total: 0, hasMoreDevices: false, canNavigate: false, empty: false, summaryOnly: true,
  };
  const supplies = Array.isArray(store.supplies) ? store.supplies : [];
  const all: ShelfSlot[] = supplies.map((supply) => {
    const view = deviceView(supply, coverMap.get(supply.asset_id) ?? '');
    return { id: view.id, name: view.name, image: view.displayImage, priceValue: view.priceValue.replace(/\.00$/, ''), priceUnit: view.priceUnit, priceFen: Number(supply.unit_price_fen) || 0, cheapest: false };
  }).sort((x, y) => x.priceFen - y.priceFen);
  if (all[0]) all[0].cheapest = true;
  const hours = businessHoursText(store.business_hours);
  const distance = distanceFrom(origin, store.address?.location);
  const gallery = [publicPhoto(store.cover ?? undefined), ...(store.photo_material_ids ?? []).map(id => coverMap.get('photo:' + id) ?? '')].filter(Boolean);
  return {
    id: store.store_id,
    name: store.name,
    district: store.address?.district_name ?? '',
    addressLabel: [store.address?.district_name, store.address?.detail_address].filter(Boolean).join(' '),
    statusLabel: hours ? (isOpenNow(store.business_hours) ? '营业中' : '未营业') : '',
    hoursLabel: hours || '营业时间未填写',
    distance: distance?.label ?? '',
    meters: distance?.meters ?? Number.POSITIVE_INFINITY,
    gallery, cover: gallery[0] ?? '',
    rows: shelfRows(all),
    fromPrice: all[0]?.priceValue ?? '',
    total: all.length,
    hasMoreDevices: all.length > SHELF_LIMIT,
    canNavigate: !!pointOf(store.address?.location),
    empty: all.length === 0,
    summaryOnly: false,
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
    districts: [] as { label: string; count: number }[],
    activeDistrict: '',
    expandedId: '',
    sortedByDistance: false,
    shownCount: 0,
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
    if (!append) { state.items = []; state.cursors.clear(); covers(this).clear(); this.setData({ stores: [], districts: [], hasMore: false, nextCursor: '' }); }
    this.setData({ region: city?.name ?? '', regionCity: city?.name ? cityName(city.name) : '全部城市', regionShort: city?.name ?? '全部城市', loading: true, errorText: '' });
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
      this.setData({ hasMore: page.page.has_more, nextCursor: cursor });
      this.render();
      if (!state.origin) void this.refreshOrigin(epoch);
      if (owner) {
        const authenticated = items.filter((store): store is PublicStore => 'address' in store);
        void this.loadSupplyCovers(authenticated.flatMap(store => store.supplies), authenticated, epoch);
        void this.loadStorePhotos(authenticated, epoch);
      }
    } catch (error) { if (state.visible && epoch === state.epoch) this.setData({ errorText: error instanceof Error ? error.message : '门店读取失败，请重试。' }); }
    finally {
      if (state.visible && epoch === state.epoch) {
        if (owner !== (accountApi.sessionIdentity() ?? '')) { state.items = []; covers(this).clear(); this.setData({ stores: [], districts: [], hasMore: false, nextCursor: '', errorText: '登录状态已变化，请重新读取。' }); }
        this.setData({ loading: false });
      }
    }
  },

  async refreshOrigin(epoch: number) {
    const state = pageState(this);
    const origin = await readAuthorizedPoint();
    if (!origin || !state.visible || epoch !== state.epoch) return;
    state.origin = origin;
    this.render();
  },

  render() {
    const state = pageState(this), coverMap = covers(this);
    const views = state.items.map((store) => storeView(store, coverMap, state.origin));
    const counts = new Map<string, number>();
    for (const view of views) if (view.district) counts.set(view.district, (counts.get(view.district) ?? 0) + 1);
    const districts = [...counts.entries()].map(([label, count]) => ({ label, count }));
    const active = districts.some((item) => item.label === this.data.activeDistrict) ? this.data.activeDistrict : '';
    const shown = views.filter((view) => !active || view.district === active);
    const byDistance = !!state.origin && shown.some((view) => !!view.distance);
    const stores = byDistance ? [...shown].sort((x, y) => x.meters - y.meters) : shown;
    const expandedId = stores.some((store) => store.id === state.pinned) ? state.pinned : (stores[0]?.id ?? '');
    this.setData({ stores, districts, activeDistrict: active, expandedId, sortedByDistance: byDistance, shownCount: stores.length });
  },

  expandStore(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (!id) return;
    pageState(this).pinned = id;
    this.setData({ expandedId: id });
  },

  chooseDistrict(event: WechatMiniprogram.TouchEvent) {
    this.setData({ activeDistrict: String(event.currentTarget.dataset['district'] ?? '') });
    this.render();
  },

  navigateToStore(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const item = pageState(this).items.find((store): store is PublicStore => store.store_id === id && 'address' in store);
    const point = pointOf(item?.address?.location);
    if (!item || !point) return;
    openSupplyLocation({ name: item.name, address: [item.address.city_name, item.address.district_name, item.address.detail_address].filter(Boolean).join(''), ...point });
  },

  async loadStorePhotos(items: PublicStore[], epoch: number) {
    const state = pageState(this), coverMap = covers(this);
    for (const store of items) {
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '')) return;
      for(const photo of store.photos){const url=publicPhoto(photo);if(url)coverMap.set('photo:'+photo.material_id,url)}
    }
    this.render();
  },

  async loadSupplyCovers(supplies: RentalSupply[], items: PublicStore[], epoch: number) {
    const state = pageState(this);
    const coverMap = covers(this);
    for (const supply of supplies) {
      if (coverMap.has(supply.asset_id)) continue;
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '')) return;
      const url=publicSupplyGallery(supply)[0]?.src;if(url)coverMap.set(supply.asset_id,url);
    }
    if (!state.visible || epoch !== state.epoch) return;
    void items;
    this.render();
  },

  onShow() { const state = pageState(this); state.visible = true; this.refreshType(); void this.loadStores(); },

  onHide() { const state = pageState(this); state.visible = false; ++state.epoch; state.active?.abort(); state.items = []; covers(this).clear(); this.setData({ stores: [], districts: [], loading: false, hasMore: false, nextCursor: '' }); },

  onUnload() { this.onHide(); pageStates.delete(this); coverStates.delete(this); },

  chooseRegion() { wx.navigateTo({ url: `/pages/region/index?region=${encodeURIComponent(this.data.region)}` }); },

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
