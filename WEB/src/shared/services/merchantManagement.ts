import { randomId } from '../randomId';
import type { components } from '../api/generated/schema';
import type { ApiClient } from '../api/client';
import type { CreateMerchantInput, Merchant, MerchantGateway, ServiceRequestContext } from './contracts';

type ApiMerchant = components['schemas']['Merchant'];
type View = components['schemas']['MerchantView'];
type Regions = components['schemas']['AdministrativeRegionChildren'];
const base = '/v1/ops/merchants';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
const contextOptions = (context?: ServiceRequestContext) => context?.signal === undefined ? {} : { signal: context.signal };

export function merchantProjection(value: ApiMerchant | View): Merchant {
  const profile = value.business_profile;
  // Missing historical details are displayed as incomplete, never as demo data.
  const province = profile?.province_name ?? '', city = profile?.city_name ?? '', district = profile?.district_name ?? '';
  return {
    id: value.merchant_id, name: value.name, contactName: value.contact_name, phoneDial: value.phone_dial,
    photoMaterialIds: 'photo_material_ids' in value ? value.photo_material_ids : [],
    coverMaterialId: 'cover_material_id' in value ? value.cover_material_id : null,
    responsibleLessorId: value.responsible_lessor_id, version: value.version,
    status: value.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    archivedAt: value.status === 'ARCHIVED' ? value.updated_at : null, archivedBy: null, archiveReason: value.archive_reason,
    shareBps: profile?.share_basis_points ?? Number.NaN, settlementCycle: 'MONTHLY', settlementAccount: profile?.settlement_account ?? '',
    businessHours: profile?.business_hours ?? null,
    ...('allowed_actions' in value ? { allowedActions: value.allowed_actions } : {}),
    ...('cabinet_count' in value ? { cabinetCount: value.cabinet_count } : {}),
    operatingAddress: {
      datasetId: profile?.address.dataset_id ?? '', provinceId: profile?.address.province_id ?? '', cityId: profile?.address.city_id ?? '', districtId: profile?.address.district_id ?? '',
      provinceCode: '', cityCode: '', districtCode: '',
      province, city, district, detailAddress: profile?.address.detail_address ?? '', poiName: profile?.poi_name ?? null,
      fullAddress: profile === null ? '' : `${province}${city}${district}${profile.address.detail_address}`,
      longitude: profile?.address.location == null ? Number.NaN : Number(profile.address.location.longitude),
      latitude: profile?.address.location == null ? Number.NaN : Number(profile.address.location.latitude),
      confirmationStatus: profile?.address.location?.source === 'MAP_PICK' ? 'TENCENT_CONFIRMED' : 'LEGACY_UNVERIFIED',
    }, createdAt: value.created_at, updatedAt: value.updated_at,
  };
}

export function createMerchantManagement(client: ApiClient): MerchantGateway {
  function validatePhotos(ids: readonly string[]) {
    if (ids.length > 9 || new Set(ids).size !== ids.length || ids.some((id) => id.trim() === '' || id.length > 64)) throw new Error('商家图片最多 9 张，必须使用不重复的原素材 ID');
  }
  async function readSavedPhotos(id: string, ids: readonly string[]): Promise<Merchant> {
    const result = await get(id);
    if (result.id !== id || JSON.stringify(result.photoMaterialIds) !== JSON.stringify(ids) || result.coverMaterialId !== (ids[0] ?? null)) throw new Error('商家图片保存回读与原素材顺序或首图封面不一致，请查询当前商家');
    return result;
  }
  async function resolveAddress(input: CreateMerchantInput) {
    const a = input.operatingAddress;
    if (a.confirmationStatus !== 'TENCENT_CONFIRMED' || !Number.isFinite(a.longitude) || !Number.isFinite(a.latitude)) throw new Error('请通过腾讯地图确认经营地址');
    const root = await client.request<Regions>({ path: '/v1/regions' });
    if (!a.datasetId || root.dataset_id !== a.datasetId || !a.provinceId || !a.cityId || !a.districtId) throw new Error('请按当前生效区划重新选择省市区');
    let parent = '';
    for (const [id, name] of [[a.provinceId, a.province], [a.cityId, a.city], [a.districtId, a.district]]) {
      const query = new URLSearchParams();
      query.set('dataset_id', root.dataset_id);
      if (parent) query.set('parent_id', parent);
      const response = parent ? await client.request<Regions>({ path: `/v1/regions?${query}` }) : root;
      const match = response.items.find((node) => node.region_id === id && node.name === name);
      if (!match) throw new Error('所选省市区与当前生效数据不一致，请重新选择');
      parent = match.region_id;
    }
    return { dataset_id: root.dataset_id, province_id: a.provinceId, city_id: a.cityId, district_id: a.districtId, detail_address: a.detailAddress,
      contact_name: input.contactName, phone_dial: input.phoneDial!, location: { latitude: a.latitude.toFixed(6), longitude: a.longitude.toFixed(6), coordinate_system: 'GCJ02' as const, source: 'MAP_PICK' as const } };
  }
  async function body(input: CreateMerchantInput) {
    validatePhotos(input.photoMaterialIds ?? []);
    if (!input.phoneDial) throw new Error('请填写联系电话');
    return { name: input.name, contact_name: input.contactName, phone_dial: input.phoneDial, photo_material_ids: [...(input.photoMaterialIds ?? [])],
      business_profile: { address: await resolveAddress(input), poi_name: input.operatingAddress.poiName ?? '', share_basis_points: Math.round(input.sharePercent * 100), settlement_cycle: 'MONTHLY' as const, settlement_account: input.settlementAccount } };
  }
  const get = async (id: string, context?: ServiceRequestContext) => merchantProjection(await client.request<View>({ path: path(id), ...contextOptions(context) }));
  const transition = async (id: string, action: string, reason: string, key: string, version?: string) => {
    if (!version) throw new Error('缺少商家版本，请刷新后重试');
    return merchantProjection(await client.request<ApiMerchant, { reason: string }>({ path: `${path(id)}/${action}`, method: 'POST', body: { reason }, aggregateVersion: `"v${version}"`, idempotencyKey: key }));
  };
  return {
    listRegions: async (datasetId = '', parentId = '', context?: ServiceRequestContext) => {
      const query = new URLSearchParams();
      if (datasetId) query.set('dataset_id', datasetId);
      if (parentId) query.set('parent_id', parentId);
      const response = await client.request<Regions>({ path: `/v1/regions${query.size ? `?${query}` : ''}`, ...contextOptions(context) });
      return { datasetId: response.dataset_id, items: response.items.map((item) => ({ id: item.region_id, parentId: item.parent_id, code: item.node_code, name: item.name, level: item.level, codeKind: item.code_kind, isVirtual: item.is_virtual })) };
    },
    list: async () => { throw new Error('请使用商家分页查询'); }, getById: get,
    search: async (filter, context) => {
      const query = new URLSearchParams({ page_size: String(filter.pageSize) });
      for (const key of ['name', 'address', 'region', 'status', 'cursor'] as const) if (filter[key]) query.set(key, filter[key]);
      const response = await client.request<components['schemas']['MerchantPage']>({ path: `${base}?${query}`, ...contextOptions(context) });
      return { items: response.items.map(merchantProjection), hasMore: response.page.has_more, nextCursor: response.page.next_cursor ?? null };
    },
    create: async (input) => {
      const result = await client.request<ApiMerchant, components['schemas']['MerchantInput']>({ path: base, method: 'POST', body: await body(input), idempotencyKey: input.command?.idempotencyKey ?? randomId() });
      return readSavedPhotos(result.merchant_id, input.photoMaterialIds ?? []);
    },
    update: async (input) => {
      if (!input.command?.expectedVersion) throw new Error('缺少商家版本，请刷新后重试');
      await client.request<ApiMerchant, components['schemas']['MerchantPatch']>({ path: path(input.merchantId), method: 'PATCH', body: { ...await body(input), reason: '后台编辑商家' }, idempotencyKey: input.command.idempotencyKey, aggregateVersion: `"v${input.command.expectedVersion}"` });
      return readSavedPhotos(input.merchantId, input.photoMaterialIds ?? []);
    },
    updatePhotos: async (merchantId, expectedVersion, photoMaterialIds, idempotencyKey) => {
      validatePhotos(photoMaterialIds);
      await client.request<ApiMerchant, components['schemas']['MerchantPatch']>({ path: path(merchantId), method: 'PATCH', body: { photo_material_ids: [...photoMaterialIds], reason: '后台更新商家图片' }, aggregateVersion: `"v${expectedVersion}"`, idempotencyKey });
      return readSavedPhotos(merchantId, photoMaterialIds);
    },
    archive: (input) => transition(input.id, 'archive', input.reason, input.command!.idempotencyKey, input.command?.expectedVersion),
    restore: (input) => transition(input.id, 'restore', input.reason ?? '后台恢复商家', input.command!.idempotencyKey, input.command?.expectedVersion),
    changeStatus: (merchant, action, command) => transition(merchant.id, action, action === 'activate' ? '后台启用商家' : '后台停用商家', command.idempotencyKey, merchant.version),
  };
}
