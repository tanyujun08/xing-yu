import type { components } from '../../../types/api/schema';
import { request, type RequestHandle } from './request';
import { publicMedia } from '../presentation/material-media';

export type DiscoverySupply = components['schemas']['DiscoverySupply'];
export type DiscoverySupplyPage = components['schemas']['DiscoverySupplyPage'];
export type DiscoveryStoreSummary = components['schemas']['DiscoveryStoreSummary'];
export type DiscoveryStore = components['schemas']['DiscoveryStore'];
export type DiscoveryStorePage = components['schemas']['DiscoveryStorePage'];
export type DiscoverySupplyFilter = {
  city_id?: string;
  category_id?: string;
  supply_type?: DiscoverySupply['supply_type'];
  query?: string;
  cursor?: string;
};

function checked<T>(handle: RequestHandle<T>, validate: (value: T) => void): RequestHandle<T> {
  return { abort: handle.abort, promise: handle.promise.then(value => { validate(value); return value; }) };
}

function queryString(filter: Record<string, string | undefined>): string {
  return Object.entries({ ...filter, page_size: '20' })
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))).join('&');
}

function validMedia(media: DiscoverySupply['media'][number]): boolean {
  return publicMedia(media)!==null;
}

function validateSupply(value: DiscoverySupply): void {
  if (!value || !value.asset_id || !value.display_name || value.currency !== 'CNY'
    || !['PERSONAL', 'STORE', 'CABINET'].includes(value.supply_type)
    || !['DAY', 'HOUR'].includes(value.rental_mode)
    || !value.category?.category_id || !value.region?.city_id || !value.region?.city_name
    || !['AVAILABLE', 'UNAVAILABLE'].includes(value.availability_status)
    || !Array.isArray(value.media) || !value.media.every(validMedia)) {
    throw new Error('公开设备资料读取不完整，请刷新。');
  }
  for (const amount of [value.unit_price_fen, value.deposit_fen]) {
    if (typeof amount !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(amount)) {
      throw new Error('公开设备金额读取失败，请刷新。');
    }
  }
}

function validatePage(page: { page: { has_more: boolean; next_cursor?: string }; items: { [key: string]: unknown }[] }, cursor?: string): void {
  if (!page || !Array.isArray(page.items) || !page.page || typeof page.page.has_more !== 'boolean'
    || (page.page.has_more && (!page.page.next_cursor || page.page.next_cursor === cursor))) {
    throw new Error('公开列表分页读取失败，请刷新。');
  }
}

function validateStoreSummary(store: DiscoveryStoreSummary): void {
  if (!store || !store.store_id || !store.name || store.status !== 'ACTIVE'
    || !store.region?.city_id || !store.region?.city_name || (store.cover && !validMedia(store.cover))) {
    throw new Error('公开门店资料读取不完整，请刷新。');
  }
}

export const discoveryApi = {
  listSupplies: (filter: DiscoverySupplyFilter = {}) => checked(
    request<DiscoverySupplyPage>({ path: '/v1/discovery/rental-supplies?' + queryString(filter) }),
    page => {
      validatePage(page, filter.cursor);
      page.items.forEach(validateSupply);
      if (!page.facets || !Array.isArray(page.facets.categories)
        || !page.filters || page.filters.city_id !== (filter.city_id ?? '')
        || page.filters.category_id !== (filter.category_id ?? '')
        || page.filters.supply_type !== (filter.supply_type ?? '')
        || page.filters.query !== (filter.query ?? '')) {
        throw new Error('公开设备筛选结果不匹配，请刷新。');
      }
      if (new Set(page.items.map(item => item.asset_id)).size !== page.items.length) throw new Error('公开设备列表存在重复记录，请刷新。');
    }),
  getSupply: (id: string) => checked(
    request<DiscoverySupply>({ path: '/v1/discovery/rental-supplies/' + encodeURIComponent(id) }),
    value => { validateSupply(value); if (value.asset_id !== id) throw new Error('公开设备回读不匹配，请刷新。'); }),
  listStores: (filter: { city_id?: string; cursor?: string } = {}) => checked(
    request<DiscoveryStorePage>({ path: '/v1/discovery/stores?' + queryString(filter) }),
    page => {
      validatePage(page, filter.cursor);
      page.items.forEach(validateStoreSummary);
      if (!page.filters || page.filters.city_id !== (filter.city_id ?? '')) throw new Error('公开门店筛选结果不匹配，请刷新。');
      if (new Set(page.items.map(item => item.store_id)).size !== page.items.length) throw new Error('公开门店列表存在重复记录，请刷新。');
    }),
  getStore: (id: string) => checked(
    request<DiscoveryStore>({ path: '/v1/discovery/stores/' + encodeURIComponent(id) }),
    value => {
      validateStoreSummary(value);
      if (value.store_id !== id || !Array.isArray(value.supplies) || !Array.isArray(value.media)
        || !value.media.every(validMedia) || !value.supplies.every(value => { try { validateSupply(value); return true; } catch { return false; } })) {
        throw new Error('公开门店详情读取不完整，请刷新。');
      }
    }),
};
