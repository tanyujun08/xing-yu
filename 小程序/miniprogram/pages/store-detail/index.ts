import { demoWx } from '../../preview/platform';
import { designAssets } from '../../shared/design/assets';
import { readDisplayWindowMetrics } from '../../shared/presentation/window-metrics';
import { storeApi, type PublicStore, type RentalSupply } from '../../shared/api/supply-api';
import { discoveryApi, type DiscoveryStore, type DiscoverySupply } from '../../shared/api/supply-api';
import { publicSupplyGallery } from '../../shared/presentation/api-supply';
import { publicPhoto } from '../../shared/presentation/material-media';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { businessHoursText, navigableLocation } from '../../shared/presentation/store-details';

// The page renders the public store projection only: no fixture store and no fixture device.
function storeView(store: PublicStore | DiscoveryStore) {
  if ('region' in store) return {
    id: store.store_id, name: store.name, distance: '', serviceCopy: '',
    hours: businessHoursText(store.business_hours), location: null,
    phone: store.public_phone,
    address: [store.region.city_name, store.region.district_name, store.public_address].filter(Boolean).join(' '),
    deviceIds: store.supplies.map(supply => supply.asset_id),
  };
  return {
    id: store.store_id,
    name: store.name,
    distance: '',
    serviceCopy: '',
    hours: businessHoursText(store.business_hours),
    location: navigableLocation(store.address?.location),
    phone: store.address?.phone_dial ?? '',
    address: [store.address?.city_name, store.address?.district_name, store.address?.detail_address].filter(Boolean).join(' '),
    deviceIds: (Array.isArray(store.supplies) ? store.supplies : []).map((supply) => supply.asset_id),
  };
}

const detailStates = new WeakMap<object, { epoch: number; visible: boolean; id: string; owner: string; covers: Map<string, string> }>();

function detailState(page: object) {
  const current = detailStates.get(page);
  if (current) return current;
  const created = { epoch: 0, visible: true, id: '', owner: '', covers: new Map<string, string>() };
  detailStates.set(page, created);
  return created;
}

// Minor-unit strings are formatted here: the shared discovery template renders
// priceValue and depositValue verbatim, so a raw fen count would read as a wrong
// price (3000 instead of 30.00).
function deviceView(supply: RentalSupply | DiscoverySupply, coverUrl: string) {
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

Page({
  onResize() { this.setData({ largeType: readDisplayWindowMetrics().fontSizeSetting > 20 }); },
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    heroImages: [] as { id: string; src: string }[],
    heroCurrent: 0,
    largeType: readDisplayWindowMetrics().fontSizeSetting > 20,
    missing: false,
    loading: false,
    errorText: '',
    store: null as ReturnType<typeof storeView> | null,
    devices: [] as never[],
    deviceCount: 0,
    heroImage: '',
  },

  onHeroChange(event: WechatMiniprogram.CustomEvent<{ current: number }>) { this.setData({ heroCurrent: event.detail.current }); },

  async loadStore(id: string) {
    const state = detailState(this);
    const epoch = ++state.epoch;
    state.id = id;
    const owner = accountApi.sessionIdentity() ?? ''; state.owner = owner;
    state.covers.clear();
    this.setData({ store: null, heroImages: [], heroCurrent: 0, devices: [], deviceCount: 0, missing: false, loading: true, errorText: '' });
    try {
      const store = owner ? await storeApi.detail(id).promise : await discoveryApi.getStore(id).promise;
      if (!state.visible || epoch !== state.epoch || owner !== (accountApi.sessionIdentity() ?? '')) return;
      if (!store || store.store_id !== id) { this.setData({ missing: true }); return; }
      const supplies = Array.isArray(store.supplies) ? store.supplies : [];
      for(const supply of supplies){const url=publicSupplyGallery(supply)[0]?.src;if(url)state.covers.set(supply.asset_id,url)}
      const devices = supplies.map((supply) => deviceView(supply, state.covers.get(supply.asset_id) ?? ''));
      this.setData({ missing: false, store: storeView(store), devices: devices as never[], deviceCount: devices.length,
        heroImages: 'region' in store ? publicSupplyGallery(store).map((media,index)=>({id:String(index),src:media.src})) : store.photos.flatMap(photo=>{const url=publicPhoto(photo);return url?[{id:photo.material_id,src:url}]:[]}) });
      if (!('region' in store)) { void this.loadSupplyCovers(id, store.supplies, epoch); void this.loadStorePhotos(store, epoch); }
    } catch (error) {
      if (state.visible && epoch === state.epoch) this.setData({ missing: error instanceof ApiProblem && error.statusCode === 404, errorText: error instanceof ApiProblem && error.statusCode === 404 ? '' : error instanceof Error ? error.message : '门店读取失败，请重试。', store: null, devices: [], deviceCount: 0 });
    } finally {
      if (state.visible && epoch === state.epoch) {
        if (owner !== (accountApi.sessionIdentity() ?? '')) this.setData({ store: null, devices: [], deviceCount: 0, errorText: '登录状态已变化，请重新读取。' });
        this.setData({ loading: false });
      }
    }
  },

  async loadStorePhotos(store: PublicStore, epoch: number) {
    const state = detailState(this), images: { id: string; src: string }[] = [];
    for (const photo of store.photos) {
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '')) return;
      const url=publicPhoto(photo);if(url)images.push({id:photo.material_id,src:url});
    }
    this.setData({heroImages:images});
  },

  async loadSupplyCovers(storeId: string, supplies: RentalSupply[], epoch: number) {
    const state = detailState(this);
    for (const supply of supplies) {
      if (state.covers.has(supply.asset_id)) continue;
      if (!state.visible || epoch !== state.epoch || state.owner !== (accountApi.sessionIdentity() ?? '') || !this.data.store || this.data.store.id !== storeId) return;
      const url=publicSupplyGallery(supply)[0]?.src;if(url)state.covers.set(supply.asset_id,url);
    }
    this.setData({devices:supplies.map(item=>deviceView(item,state.covers.get(item.asset_id)??'')) as never[]});
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = String(options.id ?? '').trim();
    if (!id) { this.setData({ missing: true }); return; }
    detailState(this).id = id;
  },

  onShow() {
    detailState(this).visible = true;
    this.setData({ largeType: readDisplayWindowMetrics().fontSizeSetting > 20 });
    const id = detailState(this).id;
    if (id) void this.loadStore(id);
  },

  onHide() { const state = detailState(this); state.visible = false; ++state.epoch; state.covers.clear(); this.setData({ store: null, heroImages: [], devices: [], deviceCount: 0, loading: false }); },
  retryStore() { const id = detailState(this).id; if (id) void this.loadStore(id); },

  onUnload() { this.onHide(); detailStates.delete(this); },

  openDevice(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (id) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}&source=store` });
  },

  showAddress() {
    const store = this.data.store;
    if (!store?.location) { wx.showToast({ title: '门店导航位置暂未提供', icon: 'none' }); return; }
    demoWx.openLocation({ ...store.location, name: store.name, address: store.address, fail: () => wx.showToast({ title: '无法打开地图，请稍后重试', icon: 'none' }) });
  },
  showContact() {
    const phoneNumber = (this.data.store?.phone ?? '').trim();
    if (!phoneNumber) { wx.showToast({ title: '联系电话待完善', icon: 'none' }); return; }
    demoWx.makePhoneCall({ phoneNumber, fail: (error) => { if (!error.errMsg.includes('cancel')) wx.showToast({ title: '暂时无法拨打', icon: 'none' }); } });
  },
  goBack() { wx.navigateBack(); },
});
