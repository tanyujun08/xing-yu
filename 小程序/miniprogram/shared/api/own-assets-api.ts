import { request, type RequestHandle } from './request';

export interface OwnAssetAction { code: string; enabled: boolean; blocked_reasons: string[] }
export interface OwnRentalAssetItem {
  resource_kind: 'ASSET' | 'DRAFT'; resource_id: string; asset_id?: string | null; draft_id?: string | null;
  product_name: string; display_name: string; state: 'DRAFT' | 'REVIEWING' | 'REJECTED' | 'ONLINE' | 'OFFLINE' | 'OCCUPIED';
  publish_status?: 'ONLINE' | 'OFFLINE' | null; availability_status?: string | null; latest_review_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  current_revision_id?: string | null; latest_revision_id?: string | null;
  rental_unit?: 'DAY' | 'HOUR' | null; unit_price_fen?: string | null; deposit_fen?: string | null; cover_material_id?: string | null;
  delivery_methods: string[]; editable_draft_id?: string | null; allowed_actions: OwnAssetAction[]; created_at: string; updated_at: string; version: string;
}
export interface OwnRentalAssetPage { items: OwnRentalAssetItem[]; page: { page_size: number; has_more: boolean; next_cursor?: string | null } }
export interface OwnAssetRevision {
  revision_id: string; display_name: string; condition: string; defect_description: string; accessories_text: string; description: string;
  rental_unit: 'DAY' | 'HOUR'; unit_price_fen: string; deposit_fen: string; minimum_units: string; reference_value_fen: string;
  available_from: string; available_until: string; review_status: 'PENDING' | 'APPROVED' | 'REJECTED'; review_reason: string | null;
  media: { material_id: string; role: 'COVER' | 'IMAGE' | 'VIDEO' | 'OWNERSHIP' | 'DEFECT'; sort_order: number }[];
  delivery_options: { method: string; outbound_fee_payer: string; return_fee_payer: string }[];
}
export interface OwnRentalAssetDetail { item: OwnRentalAssetItem; current_revision: OwnAssetRevision | null; latest_revision: OwnAssetRevision | null; publication_blockers: string[]; as_of_at: string }

function validateItem(item: OwnRentalAssetItem): void {
  if (!item || !['ASSET', 'DRAFT'].includes(item.resource_kind) || !item.resource_id || typeof item.display_name !== 'string'
    || (item.resource_kind === 'ASSET' && !item.display_name) || !Array.isArray(item.delivery_methods)
    || !Array.isArray(item.allowed_actions) || !/^\d+$/.test(item.version)) throw new Error('本人资产列表数据不完整，请刷新。');
}
function checked(handle: RequestHandle<OwnRentalAssetPage>): RequestHandle<OwnRentalAssetPage> {
  return { abort: handle.abort, promise: handle.promise.then((page) => {
    if (!page || !Array.isArray(page.items) || !page.page || typeof page.page.has_more !== 'boolean') throw new Error('本人资产分页读取失败。');
    page.items.forEach(validateItem);
    if (new Set(page.items.map((item) => `${item.resource_kind}:${item.resource_id}`)).size !== page.items.length) throw new Error('本人资产列表存在重复记录。');
    return page;
  }) };
}
export const ownAssetsApi = {
  list: (state = '', cursor = '') => {
    const query = ['page_size=20'];
    if (state) query.push(`state=${encodeURIComponent(state)}`);
    if (cursor) query.push(`cursor=${encodeURIComponent(cursor)}`);
    return checked(request<OwnRentalAssetPage>({ path: `/v1/me/rental-assets?${query.join('&')}` }));
  },
  detail: (assetId: string): RequestHandle<OwnRentalAssetDetail> => {
    if (!assetId || assetId.includes('/')) throw new Error('本人资产编号无效。');
    const handle = request<OwnRentalAssetDetail>({ path: `/v1/me/rental-assets/${encodeURIComponent(assetId)}` });
    return { abort: handle.abort, promise: handle.promise.then((detail) => {
      if (!detail || !detail.item || detail.item.resource_kind !== 'ASSET' || detail.item.asset_id !== assetId
        || !Array.isArray(detail.publication_blockers) || !detail.as_of_at || !('latest_revision' in detail) || !('current_revision' in detail)
        || (detail.item.latest_revision_id && detail.latest_revision?.revision_id !== detail.item.latest_revision_id)
        || (detail.item.current_revision_id && detail.current_revision?.revision_id !== detail.item.current_revision_id)) throw new Error('本人资产详情与当前请求不一致。');
      validateItem(detail.item);
      return detail;
    }) };
  },
};
