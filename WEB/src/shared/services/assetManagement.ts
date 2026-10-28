import { randomId } from '../randomId';
import type { ApiClient } from '../api/client';
import type { components } from '../api/generated/schema';
import type {
  Asset, AssetGateway, AssetIdentifierType, AssetPrivateReviewDetails, AssetRentalTermsRevision, CreateOfficialAssetBatchInput, LessorProfile, ServiceRequestContext,
} from './contracts';

interface ApiAsset {
  asset_id: string; asset_no: string; product_id: string; product_name: string; lessor_id: string; lessor_name: string;
  supply_type: 'PERSONAL' | 'STORE' | 'CABINET'; identifier_type: AssetIdentifierType; normalized_identifier: string; rfid_code?: string | null;
  current_revision_id: string | null; latest_revision_id: string | null; display_name: string; latest_review_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  publish_status: 'ONLINE' | 'OFFLINE'; availability_status: 'AVAILABLE' | 'RESERVED' | 'IN_USE' | 'INSPECTION' | 'FROZEN' | 'RETIRED';
  created_at: string; updated_at: string; version: string;
}
interface ApiMedia { material_id: string; role: 'COVER' | 'IMAGE' | 'VIDEO' | 'OWNERSHIP' | 'DEFECT'; sort_order: number }
interface ApiRevision {
  revision_id: string; asset_id: string; revision_no: string; display_name: string; condition: string; defect_description: string; accessories_text: string;
  rental_unit: 'DAY' | 'HOUR'; unit_price_fen: string; deposit_fen: string; minimum_units: string; reference_value_fen: string; currency: 'CNY';
  submitted_at: string; review_status: 'PENDING' | 'APPROVED' | 'REJECTED'; review_reason: string | null; media?: ApiMedia[]; publication_region?: unknown;
  description?: string; available_from?: string; available_until?: string; timezone?: string;
  rule_version_id?: string; eligibility_rule_version_id?: string;
  delivery_options?: Array<{ option_id: string; method: string; outbound_fee_payer: string; return_fee_payer: string; instruction: string | null; meeting_time_text: string | null }>;
}
interface ApiDossier { asset: ApiAsset; current_revision: ApiRevision | null; latest_revision: ApiRevision | null; publication_blockers?: string[]; allowed_actions?: Array<{code:string;enabled:boolean;blocked_reasons:string[]}>; placement?: components['schemas']['OpsAssetPlacement'] | null }
interface ApiPrivateAddress { province_name:string;city_name:string;district_name:string;detail_address:string;recipient_name:string;phone_country_code:string;phone:string }
interface ApiPrivateDetails {asset_id:string;revision_id:string;asset_version:string;purpose:'ASSET_REVIEW';expires_at:string;publication_location:ApiPrivateAddress|null;publication_position:{latitude:string;longitude:string;coordinate_system:'GCJ02';source:'WECHAT_CLIENT'}|null;delivery_locations:Array<{method:string;address:ApiPrivateAddress|null}>}
interface CursorPage<T> { items: T[]; page: { has_more: boolean; next_cursor?: string | null } }
interface PlatformContext {
  official_lessor: { lessor_id: string; display_name: string };
  product_id: string; rental_unit: 'DAY' | 'HOUR'; rule_version_id: string; eligibility_rule_version_id: string;
  read_at: string; available_from: string; available_until: string; availability_policy: 'OPEN_ENDED';
}
interface PlatformReceipt { assets: Array<{ asset_id: string; revision_id: string; asset_no: string; state: { version: string } }> }
const base = '/v1/ops/assets';
const requestOptions = (context?: ServiceRequestContext) => context?.signal === undefined ? {} : { signal: context.signal };
const integer = (value: string, field: string) => {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(`${field} 回读无效`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${field} 超出前端安全整数范围`);
  return parsed;
};
const projectedMoney = (value: string, field: string, personal: boolean) => {
  if (!/^(0|[1-9]\d*)$/.test(value) || BigInt(value) > 9223372036854775807n) throw new Error(`${field} 回读无效`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) && !personal) throw new Error(`${field} 超出前端安全整数范围`);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
};

async function collect<T>(load: (cursor: string) => Promise<CursorPage<T>>): Promise<T[]> {
  const result: T[] = [];
  let cursor = '';
  do {
    const page = await load(cursor);
    result.push(...page.items);
    cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
    if (page.page.has_more && cursor === '') throw new Error('服务端资产分页游标缺失');
  } while (cursor !== '');
  return result;
}

function availability(value: ApiAsset['availability_status']): Asset['availabilityStatus'] {
  if (value === 'IN_USE') return 'RENTING';
  if (value === 'INSPECTION') return 'RETURN_PENDING';
  return value;
}
function project(dossier: ApiDossier): Asset {
  const { asset } = dossier;
  const revision = dossier.latest_revision ?? dossier.current_revision;
  if (asset.supply_type === 'PERSONAL' && asset.latest_revision_id && revision?.revision_id !== asset.latest_revision_id) throw new Error('个人资产最新审核版本缺失或不一致');
  const media = revision?.media ?? [];
  const images = media.filter((entry) => entry.role === 'COVER' || entry.role === 'IMAGE').sort((a, b) => a.sort_order - b.sort_order);
  const review = asset.latest_review_status ?? (asset.supply_type === 'PERSONAL' ? 'PENDING' : 'NOT_REQUIRED');
  return {
    id: asset.asset_id, assetNo: asset.asset_no, productId: asset.product_id, displayName: revision?.display_name ?? asset.display_name,
    supplyMode: asset.supply_type === 'PERSONAL' ? 'C2C' : 'OFFICIAL', lessorId: asset.lessor_id,
    identifierType: asset.identifier_type, identifierValue: asset.normalized_identifier, identifierNormalizedValue: asset.normalized_identifier, rfidCode: asset.rfid_code ?? null, version: asset.version,
    condition: revision?.condition ?? '', defectDescription: revision?.defect_description ?? '', accessoryDescription: revision?.accessories_text ?? '',
    rentalType: revision?.rental_unit ?? 'DAY', unitPriceFen: revision ? projectedMoney(revision.unit_price_fen, '租金', asset.supply_type === 'PERSONAL') : 0,
    ...(asset.supply_type === 'PERSONAL' && revision ? { unitPriceFenRaw: revision.unit_price_fen } : {}),
    minimumUnits: revision ? integer(revision.minimum_units, '最低租期') : 1, depositFen: revision ? projectedMoney(revision.deposit_fen, '押金', asset.supply_type === 'PERSONAL') : 0,
    ...(asset.supply_type === 'PERSONAL' && revision ? { depositFenRaw: revision.deposit_fen } : {}),
    referenceValueFen: revision ? projectedMoney(revision.reference_value_fen, '商品价值', asset.supply_type === 'PERSONAL') : 0,
    ...(asset.supply_type === 'PERSONAL' && revision ? { referenceValueFenRaw: revision.reference_value_fen } : {}), currency: 'CNY',
    termsRevision: revision ? integer(revision.revision_no, '条件版本') : 1, latestRevisionId: asset.latest_revision_id,
    publicationBlockers: dossier.publication_blockers ?? [], allowedActions: (dossier.allowed_actions ?? []).map((action) => ({ code: action.code, enabled: action.enabled, blockedReasons: action.blocked_reasons })),
    reviewBlockedReasons: (dossier.allowed_actions ?? []).filter((action) => action.code === 'APPROVE' || action.code === 'REJECT').flatMap((action) => action.enabled ? [] : action.blocked_reasons),
    termsEffectiveAt: revision?.submitted_at ?? asset.created_at,
    coverMediaId: images[0]?.material_id ?? null, imageMediaIds: images.map((entry) => entry.material_id),
    videoMediaIds: media.filter((entry) => entry.role === 'VIDEO').sort((a, b) => a.sort_order - b.sort_order).map((entry) => entry.material_id),
    mediaSource: 'ASSET_ACTUAL', publishLocationSnapshot: null,
    reviewStatus: review, publishStatus: asset.publish_status, availabilityStatus: availability(asset.availability_status),
    boxId: dossier.placement?.location_kind === 'CABINET' ? dossier.placement.compartment_id ?? null : null,
    cabinetId: dossier.placement?.location_kind === 'CABINET' ? dossier.placement.cabinet_id ?? null : null,
    placement: dossier.placement ?? null,
    creationBatchId: null, reviewRemark: revision?.review_reason ?? null,
    createdAt: asset.created_at, updatedAt: asset.updated_at,
  };
}

function revisionBody(input: CreateOfficialAssetBatchInput, context: PlatformContext) {
  const images = [...(input.imageMediaIds ?? [])];
  const cover = input.coverMediaId ?? images[0];
  if (!cover) throw new Error('官方资产至少需要 1 张真实设备图片');
  const orderedImages = [cover, ...images.filter((id) => id !== cover)];
  if (orderedImages.length > 6 || (input.videoMediaIds?.length ?? 0) > 2) throw new Error('资产最多 6 张图片和 2 个视频');
  return {
    product_id: input.productId, display_name: input.displayName, condition: input.condition,
    defect_description: input.defectDescription, accessories_text: input.accessoryDescription, description: '',
    rental_unit: input.rentalType, unit_price_fen: String(input.unitPriceFen), deposit_fen: String(input.depositFen), minimum_units: String(input.minimumUnits), reference_value_fen: String(input.referenceValueFen),
    available_from: context.available_from, available_until: context.available_until, timezone: 'Asia/Shanghai',
    media: [
      ...orderedImages.map((material_id, index) => ({ material_id, role: index === 0 ? 'COVER' as const : 'IMAGE' as const, sort_order: index })),
      ...(input.videoMediaIds ?? []).map((material_id, sort_order) => ({ material_id, role: 'VIDEO' as const, sort_order })),
    ],
    delivery_options: [], rule_version_id: context.rule_version_id, eligibility_rule_version_id: context.eligibility_rule_version_id,
  };
}

export function createAssetManagement(client: ApiClient): AssetGateway {
  const editRequests = new Map<string, { signature: string; version: string; body: Record<string, unknown> }>();
  const loadRaw = (context?: ServiceRequestContext) => collect<ApiAsset>((cursor) => client.request<CursorPage<ApiAsset>>({ path: `${base}?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ...requestOptions(context) }));
  const getDossier = (id: string, context?: ServiceRequestContext) => client.request<ApiDossier>({ path: `${base}/${encodeURIComponent(id)}`, ...requestOptions(context) });
  const list = async (context?: ServiceRequestContext) => Promise.all((await loadRaw(context)).map((item) => getDossier(item.asset_id, context).then(project)));
  const reload = async (id: string) => project(await getDossier(id));
  return {
    list,
    listLessors: async (context) => {
      const seen = new Map<string, LessorProfile>();
      for (const item of await loadRaw(context)) seen.set(item.lessor_id, { id: item.lessor_id, lessorKind: item.supply_type === 'PERSONAL' ? 'PERSONAL' : 'PLATFORM', businessMode: item.supply_type === 'PERSONAL' ? 'C2C' : 'B2C', displayName: item.lessor_name, merchantId: null, userId: null, status: 'ACTIVE', createdAt: item.created_at, updatedAt: item.updated_at });
      return [...seen.values()];
    },
    listTerms: async (assetId, context) => (await collect<ApiRevision>((cursor) => client.request<CursorPage<ApiRevision>>({ path: `${base}/${encodeURIComponent(assetId)}/revisions?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ...requestOptions(context) }))).map((revision): AssetRentalTermsRevision => ({
      id: revision.revision_id, assetId: revision.asset_id, revision: integer(revision.revision_no, '条件版本'), rentalType: revision.rental_unit,
      unitPriceFen: projectedMoney(revision.unit_price_fen, '租金', true), unitPriceFenRaw: revision.unit_price_fen,
      minimumUnits: integer(revision.minimum_units, '最低租期'), depositFen: projectedMoney(revision.deposit_fen, '押金', true), depositFenRaw: revision.deposit_fen,
      referenceValueFen: projectedMoney(revision.reference_value_fen, '商品价值', true), referenceValueFenRaw: revision.reference_value_fen,
      currency: 'CNY', effectiveAt: revision.submitted_at, changedBy: '服务端审计', changeReason: revision.review_reason ?? '资产条件版本',
    })),
    createOfficialBatch: async (input) => {
      const context = await client.request<PlatformContext>({ path: `${base}/platform-publication-context?product_id=${encodeURIComponent(input.productId)}&rental_unit=${input.rentalType}` });
      if (context.product_id !== input.productId || context.rental_unit !== input.rentalType || context.availability_policy !== 'OPEN_ENDED' || !context.official_lessor?.lessor_id) throw new Error('官方资产发布上下文不完整');
      const receipt = await client.request<PlatformReceipt, Record<string, unknown>>({ path: `${base}/platform-batches`, method: 'POST', idempotencyKey: randomId(), body: {
        product_id: input.productId, supply_type: 'CABINET',
        identifiers: input.identifiers.map((entry) => { if (entry.rfidCode !== undefined && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(entry.rfidCode)) throw new Error('RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定'); return { identifier_type: entry.identifierType, ...(entry.identifierValue === undefined ? {} : { identifier: entry.identifierValue }), ...(entry.rfidCode === undefined ? {} : { rfid_code: entry.rfidCode.toUpperCase() }) }; }), revision: revisionBody(input, context),
      } });
      if (receipt.assets.length !== input.identifiers.length) throw new Error('资产创建回执数量与请求不符，请刷新核对，不要重复提交');
      return Promise.all(receipt.assets.map((asset) => reload(asset.asset_id)));
    },
    updateRFID: async (assetId, expectedVersion, rfidCode, idempotencyKey) => {
      if (rfidCode !== null && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(rfidCode)) throw new Error('RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定');
      rfidCode = rfidCode?.toUpperCase() ?? null;
      const receipt = await client.request<{ asset_id: string; rfid_code: string | null; version: string }, { rfid_code: string | null }>({ path: `${base}/${encodeURIComponent(assetId)}/rfid`, method: 'PATCH', aggregateVersion: `"v${expectedVersion}"`, idempotencyKey, body: { rfid_code: rfidCode } });
      if (receipt.asset_id !== assetId || receipt.rfid_code !== rfidCode) throw new Error('RFID 回读与请求不一致，请刷新核对');
      const asset = await reload(assetId);
      if (asset.rfidCode !== rfidCode || asset.version !== receipt.version) throw new Error('资产回读尚未确认 RFID 更新，请刷新核对');
      return asset;
    },
    update: async (input) => {
      const idempotencyKey = input.command?.idempotencyKey ?? randomId();
      const signature = JSON.stringify(input);
      let request = editRequests.get(idempotencyKey);
      if (request && request.signature !== signature) throw new Error('原编辑请求待确认，请保留原内容重试或刷新核对');
      if (!request) {
        const dossier = await getDossier(input.assetId), asset = dossier.asset, revision = dossier.latest_revision;
        if (asset.supply_type === 'PERSONAL' || asset.availability_status === 'RETIRED') throw new Error('仅能编辑未退役的官方资产');
        if (!revision || revision.revision_id !== asset.latest_revision_id || input.expectedVersion !== asset.version) throw new Error('资产版本已变化，请刷新后重新编辑');
        for (const amount of [input.unitPriceFen, input.minimumUnits, input.depositFen, input.referenceValueFen]) if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('金额和租期必须是有效整数');
        if (input.unitPriceFen < 1 || input.minimumUnits < 1 || input.referenceValueFen < 1 || !input.changeReason.trim()) throw new Error('请填写完整租赁条件及修改原因');
        const details = await client.request<components['schemas']['OpsPlatformAssetEditDetails']>({ path: `${base}/${encodeURIComponent(input.assetId)}/revisions/${encodeURIComponent(revision.revision_id)}/edit-details`, aggregateVersion: `"v${asset.version}"` });
        if (details.asset_id !== input.assetId || details.revision_id !== revision.revision_id || details.asset_version !== asset.version || details.purpose !== 'PLATFORM_ASSET_EDIT' || !Number.isFinite(Date.parse(details.expires_at)) || Date.parse(details.expires_at) <= Date.now()) throw new Error('受控编辑上下文已失效，请重新读取资产');
        const context = await client.request<PlatformContext>({ path: `${base}/platform-publication-context?product_id=${encodeURIComponent(asset.product_id)}&rental_unit=${input.rentalType}` });
        if (context.product_id !== asset.product_id || context.rental_unit !== input.rentalType || context.official_lessor?.lessor_id !== asset.lessor_id || !revision.available_from || !revision.available_until || !revision.timezone) throw new Error('官方资产编辑上下文不完整');
        const address = details.publication_location;
        const location = address ? { dataset_id: address.dataset_id, province_id: address.province_id, city_id: address.city_id, district_id: address.district_id, detail_address: address.detail_address, recipient_name: address.recipient_name, phone_country_code: address.phone_country_code, phone: address.phone, location: address.location } : null;
        const body = { product_id: asset.product_id, display_name: input.displayName, condition: input.condition, defect_description: input.defectDescription, accessories_text: input.accessoryDescription, description: revision.description ?? '', rental_unit: input.rentalType,
          unit_price_fen: String(input.unitPriceFen), deposit_fen: String(input.depositFen), minimum_units: String(input.minimumUnits), reference_value_fen: String(input.referenceValueFen), available_from: revision.available_from, available_until: revision.available_until, timezone: revision.timezone,
          media: revision.media ?? [], delivery_options: (revision.delivery_options ?? []).map(option => ({ method: option.method, outbound_fee_payer: option.outbound_fee_payer, return_fee_payer: option.return_fee_payer, source_option_id: option.option_id, ...(option.instruction === null ? {} : { instruction: option.instruction }), ...(option.meeting_time_text === null ? {} : { meeting_time_text: option.meeting_time_text }) })),
          ...(location ? { publication_location: location } : {}), rule_version_id: context.rule_version_id, eligibility_rule_version_id: context.eligibility_rule_version_id, reason: input.changeReason.trim() };
        request = { signature, version: asset.version, body };
        if (editRequests.size >= 32) throw new Error('待确认编辑请求过多，请刷新并核对资产记录');
        editRequests.set(idempotencyKey, request);
      }
      const receipt = await client.request<PlatformReceipt, Record<string, unknown>>({ path: `${base}/${encodeURIComponent(input.assetId)}/revisions`, method: 'POST', aggregateVersion: `"v${request.version}"`, idempotencyKey, body: request.body });
      const recorded = receipt.assets[0];
      if (receipt.assets.length !== 1 || recorded?.asset_id !== input.assetId || !recorded.revision_id) throw new Error('资产编辑回执不匹配，请刷新核对');
      const result = await reload(input.assetId);
      if (result.latestRevisionId !== recorded.revision_id || result.version !== recorded.state.version || result.publishStatus !== 'OFFLINE') throw new Error('资产编辑结果尚未确认，请刷新核对，不要重复创建版本');
      editRequests.delete(idempotencyKey);
      return result;
    },
    review: async (input) => {
      const dossier = await getDossier(input.assetId);
      const revision = dossier.latest_revision;
      if (dossier.asset.supply_type !== 'PERSONAL' || !revision || dossier.asset.latest_revision_id !== revision.revision_id || revision.review_status !== 'PENDING' || input.expectedRevisionId !== revision.revision_id) throw new Error('待审核版本已变化，请刷新后重新核对。');
      const action=(dossier.allowed_actions??[]).find((candidate)=>candidate.code===(input.decision==='APPROVE'?'APPROVE':'REJECT'));
      if(action&&!action.enabled)throw new Error(`当前审核动作受阻：${action.blocked_reasons.join('、')}`);
      const reason=input.reviewRemark.trim();if(!reason)throw new Error('请填写审核原因。');
      await client.request({ path: `${base}/${encodeURIComponent(input.assetId)}/revisions/${encodeURIComponent(revision.revision_id)}/decisions`, method: 'POST', aggregateVersion: `"v${dossier.asset.version}"`, idempotencyKey: input.command?.idempotencyKey ?? randomId(), body: { decision: input.decision === 'APPROVE' ? 'APPROVE' : 'REJECT', reason } });
      const result=await reload(input.assetId);if(result.latestRevisionId!==revision.revision_id||result.reviewStatus!==(input.decision==='APPROVE'?'APPROVED':'REJECTED'))throw new Error('审核回读与本次决策不一致，请刷新核对，不要重复提交。');
      return result;
    },
    readPrivateReviewDetails: async (assetId, expectedRevisionId):Promise<AssetPrivateReviewDetails> => {
      const dossier=await getDossier(assetId);
      if(dossier.asset.supply_type!=='PERSONAL'||dossier.asset.latest_revision_id!==expectedRevisionId||dossier.latest_revision?.revision_id!==expectedRevisionId||dossier.latest_revision.review_status!=='PENDING')throw new Error('仅能展开最新待审核个人资产的私密地址。');
      const value=await client.request<ApiPrivateDetails>({path:`${base}/${encodeURIComponent(assetId)}/revisions/${encodeURIComponent(expectedRevisionId)}/private-details`,aggregateVersion:`"v${dossier.asset.version}"`});
      if(value.asset_id!==assetId||value.revision_id!==expectedRevisionId||value.asset_version!==dossier.asset.version||value.purpose!=='ASSET_REVIEW'||!Number.isFinite(Date.parse(value.expires_at))||Date.parse(value.expires_at)<=Date.now())throw new Error('私密地址回读与审核版本不一致或已过期。');
      const address=value.publication_location;
      return {assetId,revisionId:expectedRevisionId,expiresAt:value.expires_at,publicationAddress:address?{provinceName:address.province_name,cityName:address.city_name,districtName:address.district_name,detailAddress:address.detail_address,recipientName:address.recipient_name,phone:address.phone_country_code+address.phone}:null,publicationPosition:value.publication_position?{latitude:value.publication_position.latitude,longitude:value.publication_position.longitude,source:value.publication_position.source}:null,deliveryMethods:value.delivery_locations.map(item=>({method:item.method,detailAddress:item.address?.detail_address??null}))};
    },
    setPublishStatus: async (input) => {
      const dossier = await getDossier(input.assetId);
      if(dossier.asset.supply_type==='PERSONAL')throw new Error('个人资产上架状态由审核与发布守卫决定，后台不能手动上架。');
      await client.request({ path: `${base}/${encodeURIComponent(input.assetId)}/${input.publishStatus === 'ONLINE' ? 'publish' : 'unpublish'}`, method: 'POST', aggregateVersion: `"v${input.expectedVersion ?? dossier.asset.version}"`, idempotencyKey: input.command?.idempotencyKey ?? randomId(), body: { reason: input.publishStatus === 'ONLINE' ? '后台上架资产' : '后台下架资产' } });
      return reload(input.assetId);
    },
  };
}
