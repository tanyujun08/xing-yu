import type { components } from '../../../types/api/schema';
import {
 locatePublicationCreateIntent, locatePublicationSubmitIntent, locatePublicationUpdateIntent,
 preparePublicationCreateIntent, preparePublicationSubmitIntent, preparePublicationUpdateIntent,
 publicationVersion, readPublicationCreateIntent, readPublicationSubmitIntent, readPublicationUpdateIntent,
 releasePublicationCreateIntent, releasePublicationSubmitIntent, releasePublicationUpdateIntent, releaseRejectedPublicationUpdateIntent,
 type PublicationUpdateIntent,
} from '../session/publication-intent';
import { preparePublicationAddressIntent, readPublicationAddressIntent, releasePublicationAddressIntent, type PublicationAddressIntent } from '../session/publication-address-intent';
import { request, type MaterialUploadOptions } from './request';
import { materialUploadApi } from './material-upload';
import { publicMedia } from '../presentation/material-media';
import type { PublicMaterialMedia } from '../model/material-media';
export { runMaterialUpload } from './material-upload';

type Schema = components['schemas'];
export type AssetDraft = Schema['OwnAssetDraft'];
export type AssetDraftInput = Schema['AssetDraftInput'];
export type DraftReceipt = Schema['PreparationReceipt'];
export type AssetSubmissionReceipt = Schema['AssetSubmissionReceipt'];
export type PublicationEligibility = Schema['OwnPublicationEligibility'];
export type OwnAssetPublicationContext = Schema['OwnAssetPublicationContext'];
export type { PublicationAddressIntent };
type Data = Record<string, unknown>;

const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function record(value: unknown): value is Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function closed(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Data {
  if (!record(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every(key => has(value, key)) && Object.keys(value).every(key => allowed.has(key));
}
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[!-~]{1,64}$/.test(value);
const text = (value: unknown, minimum: number, maximum: number): value is string => typeof value === 'string'
  && Array.from(value).length >= minimum && Array.from(value).length <= maximum;
const decimal = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value)
  && (value.length < 20 || value <= '18446744073709551615');
const greaterVersion = (left: string, right: string) => left.length > right.length || (left.length === right.length && left > right);
function dateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthDays[month - 1]!;
}
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === 'string' && values.includes(value as T);

function validPoint(value: unknown): boolean {
  if (!closed(value, ['latitude', 'longitude', 'coordinate_system', 'source'])) return false;
  return typeof value.latitude === 'string' && /^-?(?:(?:[0-9]|[1-8][0-9])\.[0-9]{6}|90\.000000)$/.test(value.latitude)
    && typeof value.longitude === 'string' && /^-?(?:(?:[0-9]|[1-9][0-9]|1[0-7][0-9])\.[0-9]{6}|180\.000000)$/.test(value.longitude)
    && value.coordinate_system === 'GCJ02' && value.source === 'MAP_PICK';
}
function validPublicationLocation(value: unknown): boolean {
  const fields = ['dataset_id', 'province_id', 'city_id', 'district_id', 'detail_address', 'recipient_name', 'phone_country_code', 'phone'] as const;
  if (!closed(value, fields, ['location'])) return false;
  return [value.dataset_id, value.province_id, value.city_id, value.district_id].every(opaque)
    && text(value.detail_address, 1, 256) && text(value.recipient_name, 1, 64)
    && value.phone_country_code === '+86' && typeof value.phone === 'string' && /^1[3-9][0-9]{9}$/.test(value.phone)
    && (!has(value, 'location') || validPoint(value.location));
}
function validPublicationPosition(value: unknown): boolean {
  if (!closed(value, ['latitude', 'longitude', 'coordinate_system', 'source'])) return false;
  return typeof value.latitude === 'string' && /^-?(?:(?:[0-9]|[1-8][0-9])\.[0-9]{6}|90\.000000)$/.test(value.latitude)
    && typeof value.longitude === 'string' && /^-?(?:(?:[0-9]|[1-9][0-9]|1[0-7][0-9])\.[0-9]{6}|180\.000000)$/.test(value.longitude)
    && value.coordinate_system === 'GCJ02' && value.source === 'WECHAT_CLIENT';
}
function validMedia(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 20 && value.every(item => closed(item, ['material_id', 'role', 'sort_order'])
    && opaque(item.material_id) && oneOf(item.role, ['COVER', 'IMAGE', 'VIDEO', 'OWNERSHIP', 'DEFECT'] as const)
    && Number.isInteger(item.sort_order) && Number(item.sort_order) >= 0 && Number(item.sort_order) <= 99);
}
function validDeliveries(value: unknown): boolean {
  const optional = ['outbound_fee_payer', 'return_fee_payer', 'source_address_id', 'meeting_location', 'meeting_time_text', 'instruction'] as const;
  return Array.isArray(value) && value.length <= 3 && value.every(item => {
    if (!closed(item, ['method'], optional) || !oneOf(item.method, ['EXPRESS', 'RUNNER', 'MEET'] as const)) return false;
    if (has(item, 'outbound_fee_payer') && !oneOf(item.outbound_fee_payer, ['TENANT', 'LESSOR'] as const)) return false;
    if (has(item, 'return_fee_payer') && !oneOf(item.return_fee_payer, ['TENANT', 'LESSOR'] as const)) return false;
    if (has(item, 'source_address_id') && !opaque(item.source_address_id)) return false;
    if (has(item, 'meeting_location') && !validPoint(item.meeting_location)) return false;
    if (has(item, 'meeting_time_text') && !text(item.meeting_time_text, 0, 128)) return false;
    return !has(item, 'instruction') || text(item.instruction, 0, 1000);
  });
}
function validAsset(value: unknown): value is AssetDraftInput {
  const fields = [
    'product_id', 'display_name', 'condition', 'defect_description', 'accessories_text', 'description', 'identifier_type', 'identifier_value',
    'rental_unit', 'unit_price_fen', 'deposit_fen', 'minimum_units', 'reference_value_fen', 'available_from', 'available_until', 'timezone',
    'publication_location', 'publication_position', 'media', 'delivery_options', 'rule_version_id', 'eligibility_rule_version_id',
  ] as const;
  if (!closed(value, [], fields)) return false;
  const checks: Array<[string, (candidate: unknown) => boolean]> = [
    ['product_id', opaque], ['display_name', candidate => text(candidate, 1, 128)],
    ['condition', candidate => text(candidate, 1, 128)],
    ['defect_description', candidate => text(candidate, 0, 2000)], ['accessories_text', candidate => text(candidate, 0, 2000)],
    ['description', candidate => text(candidate, 0, 4000)],
    ['identifier_type', candidate => oneOf(candidate, ['IMEI', 'MANUFACTURER_SERIAL', 'PLATFORM_TAG'] as const)],
    ['identifier_value', candidate => text(candidate, 1, 128)], ['rental_unit', candidate => oneOf(candidate, ['HOUR', 'DAY'] as const)],
    ['unit_price_fen', decimal], ['deposit_fen', decimal], ['minimum_units', decimal], ['reference_value_fen', decimal],
    ['available_from', dateTime], ['available_until', dateTime], ['timezone', candidate => candidate === 'Asia/Shanghai'],
    ['publication_location', validPublicationLocation], ['publication_position', validPublicationPosition], ['media', validMedia], ['delivery_options', validDeliveries],
    ['rule_version_id', opaque], ['eligibility_rule_version_id', opaque],
  ];
  return checks.every(([key, validate]) => !has(value, key) || validate(value[key]));
}

export function validateOwnAssetDraft(value: unknown, expectedID: string): AssetDraft {
  const required = ['draft_id', 'status', 'version', 'asset', 'origin_kind', 'base_version'] as const;
  if (!closed(value, required, ['asset_id', 'committed_revision_id']) || !opaque(value.draft_id) || value.draft_id !== expectedID
    || !oneOf(value.status, ['EDITING', 'SUBMITTED', 'ARCHIVED'] as const) || !publicationVersion(value.version) || !validAsset(value.asset)
    || !oneOf(value.origin_kind, ['CREATE', 'EDIT'] as const)
    || (has(value, 'asset_id') && value.asset_id !== null && !opaque(value.asset_id))
    || (has(value, 'committed_revision_id') && value.committed_revision_id !== null && !opaque(value.committed_revision_id))
    || (value.origin_kind === 'CREATE' ? value.base_version !== null : !publicationVersion(value.base_version))) {
    throw new Error('草稿回读结构无效或与当前请求不一致，请重新核实。');
  }
  return value as AssetDraft;
}
export function validateCreateDraftReceipt(value: unknown): DraftReceipt {
  if (!closed(value, ['kind', 'id', 'status', 'version']) || value.kind !== 'DRAFT' || value.status !== 'EDITING'
    || !opaque(value.id) || !publicationVersion(value.version)) throw new Error('新建草稿回执无效，请重试原请求。');
  return value as DraftReceipt;
}
export function validateEditDraftReceipt(value: unknown, assetId: string, assetVersion: string): DraftReceipt & { asset_id: string; asset_version: string } {
  if (!closed(value, ['kind', 'id', 'status', 'version', 'asset_id', 'asset_version'])
    || value.kind !== 'DRAFT' || value.status !== 'EDITING' || !opaque(value.id)
    || !publicationVersion(value.version) || value.asset_id !== assetId || value.asset_version !== assetVersion) {
    throw new Error('编辑草稿回执与当前资产不一致，请先刷新资产状态。');
  }
  return value as DraftReceipt & { asset_id: string; asset_version: string };
}
export function validateSubmitDraftReceipt(value: unknown, expectedID: string): AssetSubmissionReceipt {
  if (!closed(value, ['kind', 'id', 'status', 'version', 'asset_id', 'revision_id'], ['asset_version']) || value.kind !== 'DRAFT' || value.status !== 'SUBMITTED'
    || value.id !== expectedID || !publicationVersion(value.version) || !opaque(value.asset_id) || !opaque(value.revision_id)
    || (has(value, 'asset_version') && !publicationVersion(value.asset_version))) {
    throw new Error('提交审核回执无效，请重试原请求。');
  }
  return value as AssetSubmissionReceipt;
}
export function validateUpdateDraftReceipt(value: unknown, expectedID: string, previousVersion: string): DraftReceipt {
  if (!closed(value, ['kind', 'id', 'status', 'version']) || value.kind !== 'DRAFT' || value.status !== 'EDITING'
    || value.id !== expectedID || !publicationVersion(value.version) || !publicationVersion(previousVersion)
    || !greaterVersion(value.version as string, previousVersion)) {
    throw new Error('保存草稿回执无效，请重试原请求。');
  }
  return value as DraftReceipt;
}

function validatedUpdateIntent(intent: PublicationUpdateIntent | null): PublicationUpdateIntent | null {
  if (intent && !validAsset(intent.body.asset)) throw new Error('原保存草稿请求内容无效，请先核实草稿。');
  return intent;
}

function pathID(id: string): string {
  if (!opaque(id)) throw new Error('草稿标识无效');
  return encodeURIComponent(id);
}
function versionTag(version: string): string {
  if (!publicationVersion(version)) throw new Error('草稿版本无效');
  return '"v' + version + '"';
}
export type CatalogProduct = Schema['OwnCatalogProduct'];
export type CatalogProductPage = Schema['OwnCatalogProductPage'];
export type CatalogCategory = Schema['OwnCatalogCategory'];
export type CatalogCategoryList = Schema['OwnCatalogCategoryList'];
export type CatalogProductQuery = { query?: string; brandId?: string; categoryId?: string; cursor?: string; pageSize?: number };

function validCatalogMedia(value: unknown): boolean {
  return closed(value, ['material_id', 'role', 'mime_type', 'size_bytes', 'sort_order', 'url', 'metadata', 'poster'])
    && opaque(value.material_id) && oneOf(value.role, ['COVER', 'IMAGE', 'VIDEO'] as const)
    && typeof value.mime_type === 'string' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(value.mime_type)
    && Number.isInteger(value.size_bytes) && Number(value.size_bytes) >= 1
    && Number.isInteger(value.sort_order) && Number(value.sort_order) >= 0 && Number(value.sort_order) <= 19
    && publicMedia(value as PublicMaterialMedia)!==null;
}
function validCatalogProduct(value: unknown): value is CatalogProduct {
  if (!closed(value, ['product_id', 'name', 'model', 'description', 'brand_id', 'brand_name', 'category_id', 'category_name', 'tags', 'media', 'updated_at'])) return false;
  return opaque(value.product_id) && text(value.name, 1, 128) && text(value.model, 1, 128) && text(value.description, 1, 2000)
    && opaque(value.brand_id) && text(value.brand_name, 1, 80) && opaque(value.category_id) && text(value.category_name, 1, 80)
    && Array.isArray(value.tags) && value.tags.length <= 20 && value.tags.every(tag => text(tag, 1, 32))
    && Array.isArray(value.media) && value.media.length <= 20 && value.media.every(validCatalogMedia)
    && dateTime(value.updated_at);
}
export function validateCatalogProduct(value: unknown): CatalogProduct {
  if (!validCatalogProduct(value)) throw new Error('商品投影无效，请刷新后重试');
  return value;
}
export function validateCatalogProductPage(value: unknown): CatalogProductPage {
  if (!closed(value, ['items', 'page'])) throw new Error('商品列表无效，请刷新后重试');
  const page = value.page;
  if (!closed(page, ['page_size', 'has_more'], ['next_cursor'])
    || !Number.isInteger(page.page_size) || Number(page.page_size) < 1 || Number(page.page_size) > 100
    || typeof page.has_more !== 'boolean'
    || (has(page, 'next_cursor') && !text(page.next_cursor, 1, 4096))
    || !Array.isArray(value.items) || value.items.length > 100 || !value.items.every(validCatalogProduct)) {
    throw new Error('商品列表无效，请刷新后重试');
  }
  return value as CatalogProductPage;
}
export function validateCatalogCategoryList(value: unknown): CatalogCategoryList {
  if (!closed(value, ['items']) || !Array.isArray(value.items)
    || !value.items.every(item => closed(item, ['category_id', 'name']) && opaque(item.category_id) && text(item.name, 1, 80))
    || new Set(value.items.map(item => item.category_id)).size !== value.items.length) {
    throw new Error('设备类型列表无效，请刷新后重试');
  }
  return value as CatalogCategoryList;
}
function catalogQueryPath(query: CatalogProductQuery): string {
  const params: string[] = [];
  const push = (key: string, value: string | number | undefined) => { if (value !== undefined && value !== '') params.push(key + '=' + encodeURIComponent(String(value))); };
  push('query', query.query);
  push('brand_id', query.brandId);
  push('category_id', query.categoryId);
  push('cursor', query.cursor);
  push('page_size', query.pageSize);
  return '/v1/me/catalog/products' + (params.length === 0 ? '' : '?' + params.join('&'));
}
function validatePublicationEligibility(value: unknown): PublicationEligibility {
  const fields = ['eligible', 'blocking_reasons', 'eligibility_rule_version_id', 'agreement_rule_version_id',
    'membership_rule_version_id', 'minimum_level_code', 'current_level_code', 'identity_check_kind', 'identity_check_id',
    'publish_quota_available', 'publish_quota_account_as_of_at', 'publish_quota_expiry_pending',
    'agreements', 'assets', 'requirements', 'as_of_at'] as const;
  if (!closed(value, fields) || typeof value.eligible !== 'boolean' || !Array.isArray(value.blocking_reasons)
    || !value.blocking_reasons.every(opaque) || new Set(value.blocking_reasons).size !== value.blocking_reasons.length
    || value.eligible !== (value.blocking_reasons.length === 0)
    || !opaque(value.eligibility_rule_version_id) || !opaque(value.agreement_rule_version_id)
    || !(value.membership_rule_version_id === null || opaque(value.membership_rule_version_id))
    || !(value.minimum_level_code === null || opaque(value.minimum_level_code))
    || !(value.current_level_code === null || opaque(value.current_level_code))
    || !(value.identity_check_kind === null || oneOf(value.identity_check_kind, ['REAL_NAME', 'FACE'] as const))
    || !(value.identity_check_id === null || opaque(value.identity_check_id))
    || !Array.isArray(value.requirements) || !value.requirements.every((requirement: unknown) => closed(requirement,
      ['code', 'status', 'required', 'current_value', 'required_value', 'action'])
      && opaque(requirement.code) && oneOf(requirement.status, ['SATISFIED', 'BLOCKED', 'NOT_REQUIRED'] as const)
      && typeof requirement.required === 'boolean' && (requirement.action === null || opaque(requirement.action))
      && (requirement.current_value === null || typeof requirement.current_value === 'string')
      && (requirement.required_value === null || typeof requirement.required_value === 'string'))
    || !Array.isArray(value.agreements) || !value.agreements.every((agreement: unknown) => closed(agreement,
      ['document_version_id', 'kind', 'title', 'accepted']) && opaque(agreement.document_version_id)
      && opaque(agreement.kind) && text(agreement.title, 1, 256) && typeof agreement.accepted === 'boolean')
    || !closed(value.assets, ['total_count', 'online_count', 'editable_draft_count'])
    || !decimal(value.assets.total_count) || !decimal(value.assets.online_count) || !decimal(value.assets.editable_draft_count)
    || !decimal(value.publish_quota_available) || typeof value.publish_quota_expiry_pending !== 'boolean'
    || !dateTime(value.publish_quota_account_as_of_at) || !dateTime(value.as_of_at)) {
    throw new Error('发布资格响应无效，请稍后重新读取。');
  }
  return value as unknown as PublicationEligibility;
}
/** Caller retains the original intent across unknown outcomes. No automatic write retry. */
function validateOwnAssetPublicationContext(value:unknown,productID:string):OwnAssetPublicationContext {
 if(!closed(value,['product_id','rental_unit','rule_version_id','eligibility_rule_version_id','read_at','pricing_guidance'])
  ||value.product_id!==productID||value.rental_unit!=='DAY'||!opaque(value.rule_version_id)||!opaque(value.eligibility_rule_version_id)||!dateTime(value.read_at))throw new Error('本人发布规则响应无效，请刷新后重试。');
 const guidance=value.pricing_guidance;
 if(guidance!==null&&(!closed(guidance,['min_unit_price_fen','max_unit_price_fen','recommended_unit_price_fen'])
  ||![guidance.min_unit_price_fen,guidance.max_unit_price_fen].every(item=>typeof item==='string'&&/^[1-9][0-9]{0,18}$/.test(item))
  ||guidance.recommended_unit_price_fen!==null&&!(typeof guidance.recommended_unit_price_fen==='string'&&/^[1-9][0-9]{0,18}$/.test(guidance.recommended_unit_price_fen))))throw new Error('本人发布价格建议响应无效，请刷新后重试。');
 return value as OwnAssetPublicationContext;
}

export const publicationApi = {
  validVersion: publicationVersion,
  validateDraft: validateOwnAssetDraft,
  validateCreateReceipt: validateCreateDraftReceipt,
  validateEditReceipt: validateEditDraftReceipt,
  validateUpdateReceipt: validateUpdateDraftReceipt,
  validateSubmitReceipt: validateSubmitDraftReceipt,
  readCreateIntent: readPublicationCreateIntent,
  prepareCreateIntent: preparePublicationCreateIntent,
  locateCreateIntent: locatePublicationCreateIntent,
  releaseCreateIntent: releasePublicationCreateIntent,
  readUpdateIntent: (owner: string, draftId: string) => validatedUpdateIntent(readPublicationUpdateIntent(owner, draftId)),
  prepareUpdateIntent: (owner: string, draftId: string, version: string, asset: AssetDraftInput) => {
    if (!validAsset(asset)) throw new Error('草稿修改内容无效，请重新读取。');
    return validatedUpdateIntent(preparePublicationUpdateIntent(owner, draftId, version, asset))!;
  },
  locateUpdateIntent: (intent: PublicationUpdateIntent, resultVersion: string) => validatedUpdateIntent(locatePublicationUpdateIntent(intent, resultVersion))!,
  releaseUpdateIntent: releasePublicationUpdateIntent,
  releaseRejectedUpdateIntent: releaseRejectedPublicationUpdateIntent,
  readSubmitIntent: readPublicationSubmitIntent,
  prepareSubmitIntent: preparePublicationSubmitIntent,
  locateSubmitIntent: locatePublicationSubmitIntent,
  releaseSubmitIntent: releasePublicationSubmitIntent,
  readAddressIntent: readPublicationAddressIntent,
  prepareAddressIntent: preparePublicationAddressIntent,
  releaseAddressIntent: releasePublicationAddressIntent,
  eligibility: () => {
    const handle = request<unknown>({ path: '/v1/me/publication-eligibility' });
    return { abort: handle.abort, promise: handle.promise.then(validatePublicationEligibility) };
  },
  publicationContext: (productID:string) => {
    if(!opaque(productID))throw new Error('商品标识无效');
    const handle=request<unknown>({path:'/v1/me/asset-publication-context?product_id='+encodeURIComponent(productID)+'&rental_unit=DAY'});
    return {abort:handle.abort,promise:handle.promise.then(value=>validateOwnAssetPublicationContext(value,productID))};
  },
  uploadAssetMedia: (filePath:string,kind:'image'|'video',intent:string,options?:MaterialUploadOptions) => materialUploadApi.upload(filePath,kind==='image'?'RENTAL_ASSET_IMAGE':'RENTAL_ASSET_VIDEO',intent,options),
  material: materialUploadApi.get,
  draft: (id: string) => request<AssetDraft>({ path: '/v1/me/asset-drafts/' + pathID(id) }),
  createDraft: (asset: AssetDraftInput, intent: string) =>
    request<DraftReceipt, Schema['SaveAssetDraft']>({ path: '/v1/me/asset-drafts', method: 'POST', body: { asset }, idempotencyKey: intent }),
  editDraft: (assetID: string, assetVersion: string, intent: string) =>
    request<DraftReceipt, Record<string, never>>({ path: '/v1/me/assets/' + pathID(assetID) + '/drafts', method: 'POST', body: {}, aggregateVersion: versionTag(assetVersion), idempotencyKey: intent }),
  updateDraft: (id: string, version: string, asset: AssetDraftInput, intent: string) =>
    request<DraftReceipt, Schema['SaveAssetDraft']>({ path: '/v1/me/asset-drafts/' + pathID(id) + '/updates', method: 'POST', body: { asset }, aggregateVersion: versionTag(version), idempotencyKey: intent }),
  submitDraft: (id: string, version: string, intent: string) =>
    request<AssetSubmissionReceipt, Record<string, never>>({ path: '/v1/me/asset-drafts/' + pathID(id) + '/submissions', method: 'POST', body: {}, aggregateVersion: versionTag(version), idempotencyKey: intent }),
  /** ACTIVE standard products and their permanent public media projection. */
  catalogCategories: () => {
    const handle = request<unknown>({ path: '/v1/me/catalog/categories' });
    return { abort: handle.abort, promise: handle.promise.then(validateCatalogCategoryList) };
  },
  catalogProducts: (query: CatalogProductQuery = {}) => {
    const handle = request<unknown>({ path: catalogQueryPath(query) });
    return { abort: handle.abort, promise: handle.promise.then(validateCatalogProductPage) };
  },
  catalogProduct: (id: string) => {
    const handle = request<unknown>({ path: '/v1/me/catalog/products/' + pathID(id) });
    return { abort: handle.abort, promise: handle.promise.then(validateCatalogProduct) };
  },
};
