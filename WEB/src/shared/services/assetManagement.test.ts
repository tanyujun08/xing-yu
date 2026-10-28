import { describe, expect, it, vi } from 'vitest';
import type { ApiClient, RequestOptions } from '../api/client';
import { createAssetManagement } from './assetManagement';
import { formatFenExact } from '../format/money';

describe('official asset controlled editing', () => {
  const input = { assetId: 'edit-asset', expectedVersion: '7', displayName: '更新相机', condition: '良好', defectDescription: '', accessoryDescription: '电池', rentalType: 'HOUR' as const, unitPriceFen: 1000, minimumUnits: 1, depositFen: 20000, referenceValueFen: 50000, changeReason: '修正租赁信息', command: { intentId: 'edit-intent', idempotencyKey: 'edit-original-request' } };
  const original = { asset_id: 'edit-asset', asset_no: 'CAM-1', product_id: 'product-1', lessor_id: 'platform-1', supply_type: 'CABINET', identifier_type: 'PLATFORM_TAG', normalized_identifier: 'TAG-1', current_revision_id: 'old', latest_revision_id: 'old', latest_review_status: 'APPROVED', availability_status: 'AVAILABLE', publish_status: 'ONLINE', version: '7' };
  const revision = { revision_id: 'old', asset_id: 'edit-asset', revision_no: '1', display_name: '原相机', condition: '良好', defect_description: '', accessories_text: '', rental_unit: 'DAY', unit_price_fen: '1000', deposit_fen: '20000', minimum_units: '1', reference_value_fen: '50000', description: '保留描述', available_from: '2026-10-01T00:00:00Z', available_until: '9999-12-31T00:00:00Z', timezone: 'Asia/Shanghai', media: [{ material_id: 'original-photo', role: 'COVER', sort_order: 0 }], delivery_options: [] };
  it('preserves original media and availability, binds CAS, and retries the same body after a lost response', async () => {
    let posted = 0;
    const request = vi.fn(async (options: RequestOptions<unknown>) => {
      if (options.method === 'POST') { posted++; if (posted === 1) throw new Error('response lost'); return { assets: [{ asset_id: 'edit-asset', revision_id: 'new', state: { version: '8' } }] }; }
      if (options.path.endsWith('/edit-details')) return { asset_id: 'edit-asset', revision_id: 'old', asset_version: '7', purpose: 'PLATFORM_ASSET_EDIT', expires_at: '2099-01-01T00:00:00Z', publication_location: null, delivery_locations: [] };
      if (options.path.includes('/platform-publication-context')) return { official_lessor: { lessor_id: 'platform-1' }, product_id: 'product-1', rental_unit: 'HOUR', rule_version_id: 'current-price', eligibility_rule_version_id: 'current-eligibility' };
      return posted ? { asset: { ...original, version: '8', publish_status: 'OFFLINE', latest_revision_id: 'new' }, latest_revision: { ...revision, revision_id: 'new', revision_no: '2' } } : { asset: original, latest_revision: revision };
    });
    const gateway = createAssetManagement({ request } as ApiClient);
    await expect(gateway.update(input)).rejects.toThrow('response lost');
    await expect(gateway.update({ ...input, unitPriceFen: 1100 })).rejects.toThrow('原编辑请求待确认');
    await expect(gateway.update(input)).resolves.toMatchObject({ latestRevisionId: 'new', version: '8', publishStatus: 'OFFLINE' });
    const posts = request.mock.calls.map(([options]) => options).filter(options => options.method === 'POST');
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
    expect(posts[0]).toMatchObject({ path: '/v1/ops/assets/edit-asset/revisions', aggregateVersion: '"v7"', idempotencyKey: 'edit-original-request', body: { unit_price_fen: '1000', rental_unit: 'HOUR', minimum_units: '1', description: '保留描述', media: revision.media, available_from: revision.available_from, available_until: revision.available_until, delivery_options: [] } });
    // The API accepts an omitted publication_location for cabinet assets, not JSON null.
    expect(posts[0]?.body).not.toHaveProperty('publication_location');
    expect(request.mock.calls.filter(([options]) => options.path.endsWith('/edit-details'))).toHaveLength(1);
  });
  it('rejects stale or personal assets before reading private data or submitting', async () => {
    const request = vi.fn(async () => ({ asset: { ...original, version: '9' }, latest_revision: revision }));
    const gateway = createAssetManagement({ request } as ApiClient);
    await expect(gateway.update(input)).rejects.toThrow('资产版本已变化');
    request.mockResolvedValueOnce({ asset: { ...original, supply_type: 'PERSONAL' }, latest_revision: revision });
    await expect(gateway.update(input)).rejects.toThrow('仅能编辑');
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('asset stocking API boundary', () => {
  it('validates hexadecimal RFID and sends uppercase without stripping leading zeros', async () => {
    const asset = { asset_id: 'asset-1', asset_no: 'ASSET-1', product_id: 'product-1', lessor_id: 'lessor-1', lessor_name: '官方', supply_type: 'CABINET', identifier_type: 'PLATFORM_TAG', normalized_identifier: 'TAG-1', display_name: '相机', latest_review_status: 'APPROVED', publish_status: 'OFFLINE', availability_status: 'AVAILABLE', created_at: '2026-09-23T01:00:00Z', updated_at: '2026-09-23T01:00:00Z', version: '2', rfid_code: '0037D715' };
    const request = vi.fn(async (input: RequestOptions<unknown>) => input.method === 'PATCH' ? { asset_id: asset.asset_id, rfid_code: asset.rfid_code, version: '2' } : { asset, current_revision: null, latest_revision: null });
    const api = createAssetManagement({ request } as ApiClient);
    await expect(api.updateRFID!('asset-1', '1', '0037G715', 'rfid-hex-intent-key')).rejects.toThrow('十六进制');
    await expect(api.updateRFID!('asset-1', '1', '00000000', 'rfid-zero-intent-key')).rejects.toThrow('空位标记，不可绑定');
    expect(request).not.toHaveBeenCalled();
    await expect(api.updateRFID!('asset-1', '1', '0037d715', 'rfid-hex-intent-key')).resolves.toMatchObject({ rfidCode: '0037D715' });
    expect(request.mock.calls[0]?.[0]).toMatchObject({ method: 'PATCH', body: { rfid_code: '0037D715' } });
  });
  it('retains both placement identities without treating internal compartment ID as boxNo', async () => {
    const asset = { asset_id: 'asset-1', asset_no: 'ASSET-1', product_id: 'product-1', lessor_id: 'lessor-1', lessor_name: '官方', supply_type: 'CABINET', identifier_type: 'MANUFACTURER_SERIAL', normalized_identifier: 'SERIAL-1', display_name: '相机', latest_review_status: 'APPROVED', publish_status: 'OFFLINE', availability_status: 'AVAILABLE', created_at: '2026-09-23T01:00:00Z', updated_at: '2026-09-23T01:00:00Z', version: '1' };
    const request = vi.fn(async (input: RequestOptions<unknown>) => input.path === '/v1/ops/assets?page_size=100'
      ? { items: [asset], page: { has_more: false } }
      : { asset, current_revision: null, latest_revision: null, placement: { placement_id: 'placement-1', version: '6', location_kind: 'CABINET', cabinet_id: 'cabinet-1', compartment_id: 'internal-slot-9' } });
    const api = createAssetManagement({ request } as ApiClient);
    await expect(api.list()).resolves.toEqual([expect.objectContaining({ cabinetId: 'cabinet-1', boxId: 'internal-slot-9', placement: expect.objectContaining({ placement_id: 'placement-1', version: '6' }) })]);
  });

});

describe('official cabinet publication boundary', () => {
  it('exposes approved entry and placement blocker without an official manual review request', async () => {
    const asset = { asset_id: 'asset-official', asset_no: 'OFFICIAL-1', product_id: 'product-1', lessor_id: 'lessor-platform', lessor_name: '官方', supply_type: 'CABINET', identifier_type: 'PLATFORM_TAG', normalized_identifier: 'TAG-1', current_revision_id: 'revision-1', latest_revision_id: 'revision-1', display_name: '相机', latest_review_status: 'APPROVED', publish_status: 'OFFLINE', availability_status: 'AVAILABLE', created_at: '2026-09-23T01:00:00Z', updated_at: '2026-09-23T01:00:00Z', version: '1' };
    const revision = { revision_id: 'revision-1', asset_id: asset.asset_id, revision_no: '1', display_name: '相机', condition: '全新', defect_description: '', accessories_text: '', rental_unit: 'DAY', unit_price_fen: '29900', deposit_fen: '500000', minimum_units: '3', reference_value_fen: '1699900', currency: 'CNY', submitted_at: '2026-09-23T01:00:00Z', review_status: 'APPROVED', review_reason: 'Authorized official asset entry', media: [] };
    const request = vi.fn(async (input: RequestOptions<unknown>) => {
      if (input.path === '/v1/ops/assets?page_size=100') return { items: [asset], page: { has_more: false } };
      if (input.path === '/v1/ops/assets/asset-official') return { asset, current_revision: revision, latest_revision: revision, publication_blockers: ['CABINET_PLACEMENT_REQUIRED'], allowed_actions: [{ code: 'PUBLISH', enabled: false, blocked_reasons: ['CABINET_PLACEMENT_REQUIRED'] }] };
      throw new Error(`unexpected request ${input.path}`);
    });
    const api = createAssetManagement({ request } as ApiClient);
    const [view] = await api.list();
    expect(view).toMatchObject({ reviewStatus: 'APPROVED', publicationBlockers: ['CABINET_PLACEMENT_REQUIRED'] });
    expect(view!.allowedActions?.find((action) => action.code === 'PUBLISH')).toMatchObject({ enabled: false });
    await expect(api.review({ assetId: asset.asset_id, expectedRevisionId: 'revision-1', decision: 'APPROVE', reviewRemark: '无需审核' })).rejects.toThrow('待审核版本已变化');
    expect(request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false);
  });
});

describe('personal publication review boundary', () => {
  it('shows and decides the same latest pending revision without changing publisher prices', async () => {
    const asset = { asset_id: 'asset-personal', asset_no: 'PERSONAL-1', product_id: 'product-1', lessor_id: 'lessor-personal', lessor_name: '发布人', supply_type: 'PERSONAL', identifier_type: 'MANUFACTURER_SERIAL', normalized_identifier: 'SERIAL-1', current_revision_id: 'rev-old', latest_revision_id: 'rev-new', display_name: '相机', latest_review_status: 'PENDING', publish_status: 'OFFLINE', availability_status: 'AVAILABLE', created_at: '2026-09-23T01:00:00Z', updated_at: '2026-09-23T01:00:00Z', version: '7' };
    const old = { revision_id: 'rev-old', asset_id: asset.asset_id, revision_no: '1', display_name: '旧价格相机', condition: '九成新', defect_description: '', accessories_text: '', rental_unit: 'DAY', unit_price_fen: '100', deposit_fen: '1000', minimum_units: '1', reference_value_fen: '10000', currency: 'CNY', submitted_at: '2026-09-23T01:00:00Z', review_status: 'APPROVED', review_reason: null, media: [] };
    const latest = { ...old, revision_id: 'rev-new', revision_no: '2', display_name: '新价格相机', unit_price_fen: '250', deposit_fen: '2000', review_status: 'PENDING' };
    let approved = false;
    const request = vi.fn(async (input: RequestOptions<unknown>) => {
      if (input.path === '/v1/ops/assets?page_size=100') return { items: [asset], page: { has_more: false } };
      if (input.path === '/v1/ops/assets/asset-personal') return { asset: { ...asset, latest_review_status: approved ? 'APPROVED' : 'PENDING' }, current_revision: old, latest_revision: { ...latest, review_status: approved ? 'APPROVED' : 'PENDING' } };
      if (input.path === '/v1/ops/assets/asset-personal/revisions/rev-new/decisions') { approved = true; return {}; }
      throw new Error(`unexpected request ${input.path}`);
    });
    const api = createAssetManagement({ request } as ApiClient);
    const [view] = await api.list();
    expect(view).toMatchObject({ latestRevisionId: 'rev-new', displayName: '新价格相机', unitPriceFen: 250, depositFen: 2000, reviewStatus: 'PENDING' });
    await expect(api.review({ assetId: asset.asset_id, expectedRevisionId: 'rev-old', decision: 'APPROVE', reviewRemark: '确认' })).rejects.toThrow('待审核版本已变化');
    expect(request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false);
    const result = await api.review({ assetId: asset.asset_id, expectedRevisionId: 'rev-new', decision: 'APPROVE', reviewRemark: '核对最新资料和价格' });
    expect(result).toMatchObject({ latestRevisionId: 'rev-new', unitPriceFen: 250, depositFen: 2000, reviewStatus: 'APPROVED' });
    expect(request.mock.calls.find(([input]) => input.method === 'POST')?.[0]).toMatchObject({ path: '/v1/ops/assets/asset-personal/revisions/rev-new/decisions', aggregateVersion: '"v7"', body: { decision: 'APPROVE', reason: '核对最新资料和价格' } });
    await expect(api.setPublishStatus({ assetId: asset.asset_id, publishStatus: 'ONLINE' })).rejects.toThrow('不能手动上架');
  });

  it('reads private address only for the same latest pending revision with If-Match', async () => {
    const asset = { asset_id: 'asset-personal', supply_type: 'PERSONAL', latest_revision_id: 'rev-new', version: '7' };
    const latest = { revision_id: 'rev-new', review_status: 'PENDING' };
    const request = vi.fn(async (input: RequestOptions<unknown>) => {
      if (input.path === '/v1/ops/assets/asset-personal') return { asset, latest_revision: latest };
      if (input.path === '/v1/ops/assets/asset-personal/revisions/rev-new/private-details') return {
        asset_id: 'asset-personal', revision_id: 'rev-new', asset_version: '7', purpose: 'ASSET_REVIEW', expires_at: '2099-01-01T00:00:00Z',
        publication_location: { province_name: '广东省', city_name: '深圳市', district_name: '南山区', detail_address: '测试路1号', recipient_name: '测试用户', phone_country_code: '+86', phone: '13800000000' },
        delivery_locations: [{ method: 'EXPRESS', address: { detail_address: '测试路1号' } }],
      };
      throw new Error(`unexpected request ${input.path}`);
    });
    const api = createAssetManagement({ request } as ApiClient);
    await expect(api.readPrivateReviewDetails!('asset-personal', 'rev-old')).rejects.toThrow('仅能展开最新待审核');
    expect(request).toHaveBeenCalledTimes(1);
    await expect(api.readPrivateReviewDetails!('asset-personal', 'rev-new')).resolves.toMatchObject({
      revisionId: 'rev-new', publicationAddress: { detailAddress: '测试路1号', phone: '+8613800000000' }, deliveryMethods: [{ method: 'EXPRESS' }],
    });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/assets/asset-personal/revisions/rev-new/private-details', aggregateVersion: '"v7"' }));
  });
  it('shows a personal submission without a selected delivery address', async () => {
    const asset = { asset_id: 'asset-personal', supply_type: 'PERSONAL', latest_revision_id: 'rev-new', version: '7' };
    const request = vi.fn(async (input: RequestOptions<unknown>) => input.path.endsWith('/private-details') ? {
      asset_id: 'asset-personal', revision_id: 'rev-new', asset_version: '7', purpose: 'ASSET_REVIEW', expires_at: '2099-01-01T00:00:00Z',
      publication_location: null, publication_position: { latitude: '22.500000', longitude: '114.000000', coordinate_system: 'GCJ02', source: 'WECHAT_CLIENT' },
      delivery_locations: [{ method: 'EXPRESS', address: null }],
    } : { asset, latest_revision: { revision_id: 'rev-new', review_status: 'PENDING' } });
    await expect(createAssetManagement({ request } as ApiClient).readPrivateReviewDetails!('asset-personal', 'rev-new')).resolves.toMatchObject({
      publicationAddress: null, publicationPosition: { latitude: '22.500000', longitude: '114.000000' }, deliveryMethods: [{ method: 'EXPRESS', detailAddress: null }],
    });
  });
  it('keeps personal latest price integer strings exact above JavaScript safe integer range', async () => {
    const asset = { asset_id: 'asset-large', asset_no: 'PERSONAL-LARGE', product_id: 'product-1', lessor_id: 'lessor-personal', lessor_name: '发布人', supply_type: 'PERSONAL', identifier_type: 'MANUFACTURER_SERIAL', normalized_identifier: 'SERIAL-LARGE', current_revision_id: null, latest_revision_id: 'rev-large', display_name: '相机', latest_review_status: 'PENDING', publish_status: 'OFFLINE', availability_status: 'AVAILABLE', created_at: '2026-09-23T01:00:00Z', updated_at: '2026-09-23T01:00:00Z', version: '1' };
    const latest = { revision_id: 'rev-large', asset_id: 'asset-large', revision_no: '1', display_name: '大额相机', condition: '良好', defect_description: '', accessories_text: '', rental_unit: 'DAY', unit_price_fen: '9007199254740993', deposit_fen: '9007199254740993', minimum_units: '1', reference_value_fen: '9007199254740993', currency: 'CNY', submitted_at: '2026-09-23T01:00:00Z', review_status: 'PENDING', review_reason: null, media: [] };
    const request = vi.fn(async (input: RequestOptions<unknown>) => input.path === '/v1/ops/assets?page_size=100' ? { items: [asset], page: { has_more: false } } : { asset, current_revision: null, latest_revision: latest });
    const [view] = await createAssetManagement({ request } as ApiClient).list();
    expect(view?.unitPriceFenRaw).toBe('9007199254740993');
    expect(formatFenExact(view!.unitPriceFenRaw ?? view!.unitPriceFen)).toBe('¥90071992547409.93');
    expect(formatFenExact(view!.depositFenRaw ?? view!.depositFen)).toBe('¥90071992547409.93');
  });
});
