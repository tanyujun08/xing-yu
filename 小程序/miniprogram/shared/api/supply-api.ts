import type { components } from '../../../types/api/schema';
import { request, type RequestHandle } from './request';
import { publicMedia, publicPhoto } from '../presentation/material-media';
export { discoveryApi, type DiscoveryStore, type DiscoveryStoreSummary, type DiscoverySupply } from './discovery-api';
export { publicationApi, type PublicationEligibility } from './publication-api';
export type RentalSupply = components['schemas']['RentalSupply'];
export type BusinessHours = components['schemas']['BusinessHours'];
export type SupplyPage = components['schemas']['RentalSupplyPage'];
export type SupplyFilter = { city_id?: string; category_id?: string; supply_type?: RentalSupply['supply_type']; query?: string; cursor?: string };
function checked<T>(handle: RequestHandle<T>, check: (value: T) => void): RequestHandle<T> { return { abort: handle.abort, promise: handle.promise.then(value => { check(value); return value; }) }; }
function validate(value: RentalSupply) {
  if (!value || typeof value.asset_id !== 'string' || !value.asset_id || typeof value.asset_revision_id !== 'string' || !value.asset_revision_id || value.currency !== 'CNY' || !['DAY', 'HOUR'].includes(value.rental_mode) || !['CABINET', 'STORE', 'PERSONAL'].includes(value.supply_type) || typeof value.display_name !== 'string' || !Array.isArray(value.allowed_actions) || !Array.isArray(value.delivery_methods)) throw new Error('设备信息读取不完整，请刷新。');
  for (const amount of [value.unit_price_fen, value.deposit_fen, value.minimum_units, value.reference_value_fen]) if (typeof amount !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(amount)) throw new Error('设备金额读取失败，请刷新。');
  if(!Array.isArray(value.media)||value.media.some(media=>!publicMedia(media)))throw new Error('设备公开媒体读取不完整，请刷新。');
}
export const supplyApi = {
  list: (filter: SupplyFilter = {}) => {
    const query = Object.entries({ ...filter, page_size: '20' }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))).join('&');
    return checked(request<SupplyPage>({ path: '/v1/rental-supplies?' + query }), page => {
      if (!page || !Array.isArray(page.items) || !page.page || typeof page.page.has_more !== 'boolean' || (page.page.has_more && !page.page.next_cursor)) throw new Error('设备列表分页读取失败。');
      page.items.forEach(validate);
      if (new Set(page.items.map(item => item.asset_id)).size !== page.items.length) throw new Error('设备列表存在重复记录，请刷新。');
    });
  },
  get: (id: string) => checked(request<RentalSupply>({ path: '/v1/rental-supplies/' + encodeURIComponent(id) }), value => { validate(value); if (value.asset_id !== id) throw new Error('设备回读不匹配，请刷新。'); }),
};

// Public store discovery (M06). Read-only projection: the contract returns no distance, so the
// caller must not invent one; device count comes from the store's own supply projection.
export type PublicStore = components['schemas']['PublicRentalStore'];

function validateStore(store: PublicStore): void {
  if (!store || !store.store_id || typeof store.name !== 'string' || !store.address || !Array.isArray(store.supplies)||!Array.isArray(store.photos)||store.photos.some(photo=>!publicPhoto(photo))||(store.cover!==null&&!publicPhoto(store.cover))) throw new Error('门店信息读取不完整，请重试。');
  store.supplies.forEach(validate);
}
export const storeApi = {
  list: (filter: { city_id?: string; cursor?: string } = {}) => {
    const query = Object.entries({ ...filter, page_size: '20' }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))).join('&');
    return checked(request<{ items: PublicStore[]; page: { has_more: boolean; next_cursor?: string | null } }>({ path: '/v1/rental-stores?' + query }), result => {
      if (!result || !Array.isArray(result.items) || !result.page || typeof result.page.has_more !== 'boolean' || (result.page.has_more && (!result.page.next_cursor || result.page.next_cursor === filter.cursor))) throw new Error('门店分页读取失败，请刷新。');
      result.items.forEach(validateStore);
      if (new Set(result.items.map(item => item.store_id)).size !== result.items.length) throw new Error('门店列表存在重复记录，请刷新。');
    });
  },
  detail: (storeId: string) => checked(request<PublicStore>({ path: '/v1/rental-stores/' + encodeURIComponent(storeId) }), store => {
    validateStore(store);
    if (store.store_id !== storeId) throw new Error('门店回读不匹配，请重试。');
  }),
};

// Public cabinet discovery (M05). Same read-only projection shape as a store: the contract
// returns no distance and no compartment identity, so the caller must not invent either.
export type PublicCabinet = components['schemas']['PublicRentalCabinet'];
function validateCabinet(cabinet: PublicCabinet): void {
  if (!cabinet || !cabinet.cabinet_id || typeof cabinet.name !== 'string' || cabinet.status !== 'ACTIVE' || !cabinet.address || !Array.isArray(cabinet.supplies) || typeof cabinet.version!=='string'||!/^[1-9][0-9]{0,19}$/.test(cabinet.version)) throw new Error('柜机信息读取不完整，请重试。');
  cabinet.supplies.forEach(validate);
}
export const cabinetApi = {
  byScene: (scene: string) => checked(request<PublicCabinet>({ path: '/v1/rental-cabinets/by-scene?scene=' + encodeURIComponent(scene) }), validateCabinet),
  list: (filter: { city_id?: string; cursor?: string } = {}) => {
    const query = Object.entries({ ...filter, page_size: '20' }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))).join('&');
    return checked(request<{ items: PublicCabinet[]; page: { has_more: boolean; next_cursor?: string | null } }>({ path: '/v1/rental-cabinets?' + query }), result => {
      if (!result || !Array.isArray(result.items) || !result.page || typeof result.page.has_more !== 'boolean' || (result.page.has_more && (!result.page.next_cursor || result.page.next_cursor === filter.cursor))) throw new Error('柜机分页读取失败，请刷新。');
      result.items.forEach(validateCabinet);
      if (new Set(result.items.map(item => item.cabinet_id)).size !== result.items.length) throw new Error('柜机列表存在重复记录，请刷新。');
    });
  },
  detail: (cabinetId: string) => checked(request<PublicCabinet>({ path: '/v1/rental-cabinets/' + encodeURIComponent(cabinetId) }), cabinet => {
    validateCabinet(cabinet);
    if (cabinet.cabinet_id !== cabinetId) throw new Error('柜机回读不匹配，请重试。');
  }),
};
export { loadDiscoveryRegions, type DiscoveryRegion } from './discovery-regions';
export { readDiscoveryCity, selectDiscoveryCity } from '../session/discovery-city';
