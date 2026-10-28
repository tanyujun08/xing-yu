import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import type { components } from '../api/generated/schema';
import type { CreateMerchantInput } from './contracts';
import { createMerchantManagement, merchantProjection } from './merchantManagement';

const merchant: components['schemas']['Merchant'] = {
  merchant_id: 'merchant-fixture', name: '合成商家', contact_name: '联系人', phone_dial: '13800000000',
  responsible_lessor_id: 'platform-fixture', status: 'ACTIVE', version: '2', archive_reason: null,
  created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', business_profile: null,
  photo_material_ids: [], cover_material_id: null,
  photos: [], cover: null,
};
const input: CreateMerchantInput = {
  name: merchant.name, contactName: merchant.contact_name, phoneDial: merchant.phone_dial, sharePercent: 25,
  settlementAccount: '合成银行 6222020202020202', command: { intentId: 'merchant-save', idempotencyKey: 'merchant-save-fixture' },
  operatingAddress: { datasetId: 'current-dataset', provinceId: 'province', cityId: 'city', districtId: 'district', provinceCode: '440000', cityCode: '440300', districtCode: '440305', province: '广东省', city: '深圳市', district: '南山区', detailAddress: '合成街道 12 号', fullAddress: '广东省深圳市南山区合成街道 12 号', poiName: '合成地点', longitude: 114.1, latitude: 22.5, confirmationStatus: 'TENCENT_CONFIRMED' },
};
function regionResponses(request: ReturnType<typeof vi.fn<ApiClient['request']>>) {
  for (const [name, id] of [['广东省', 'province'], ['深圳市', 'city'], ['南山区', 'district']]) request.mockResolvedValueOnce({ dataset_id: 'current-dataset', items: [{ name, region_id: id }] });
  return request;
}

describe('merchant management uses the shared merchant profile', () => {
  it('submits baseline fields and phone with server region IDs, without responsibility or invented hours', async () => {
    const request = regionResponses(vi.fn<ApiClient['request']>()).mockResolvedValue(merchant);
    const result = await createMerchantManagement({ request } as ApiClient).create(input);
    expect(result.phoneDial).toBe('13800000000');
    expect(request).toHaveBeenNthCalledWith(4, { path: '/v1/ops/merchants', method: 'POST', idempotencyKey: 'merchant-save-fixture', body: {
      name: merchant.name, contact_name: merchant.contact_name, phone_dial: '13800000000', photo_material_ids: [],
      business_profile: { poi_name: '合成地点', share_basis_points: 2500, settlement_cycle: 'MONTHLY', settlement_account: '合成银行 6222020202020202', address: {
        dataset_id: 'current-dataset', province_id: 'province', city_id: 'city', district_id: 'district', detail_address: '合成街道 12 号', contact_name: merchant.contact_name, phone_dial: '13800000000', location: { latitude: '22.500000', longitude: '114.100000', coordinate_system: 'GCJ02', source: 'MAP_PICK' },
      } },
    } });
    expect(request.mock.calls.map(([options]) => options.path)).not.toContain('/v1/ops/platform-lessors');
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/merchants/merchant-fixture' });
  });
  it('updates phone and address together with version and retry identity, without automatic write retry', async () => {
    const request = regionResponses(vi.fn<ApiClient['request']>()).mockRejectedValueOnce(new Error('版本冲突'));
    const api = createMerchantManagement({ request } as ApiClient);
    await expect(api.update({ ...input, merchantId: merchant.merchant_id, phoneDial: '13900000000', command: { intentId: 'update-fixture', idempotencyKey: 'update-fixture', expectedVersion: '2' } })).rejects.toThrow('版本冲突');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'PATCH', aggregateVersion: '"v2"', idempotencyKey: 'update-fixture', body: expect.objectContaining({ phone_dial: '13900000000', business_profile: expect.objectContaining({ address: expect.objectContaining({ phone_dial: '13900000000' }) }) }) }));
    expect(request.mock.calls.filter(([options]) => options.method === 'PATCH')).toHaveLength(1);
  });
  it('rejects missing phone and manual coordinates before creating a merchant', async () => {
    const request = vi.fn(); const api = createMerchantManagement({ request } as ApiClient);
    await expect(api.create({ ...input, phoneDial: '' })).rejects.toThrow('联系电话');
    await expect(api.create({ ...input, operatingAddress: { ...input.operatingAddress, confirmationStatus: 'MANUAL_DEMO' } })).rejects.toThrow('腾讯地图');
    expect(request).not.toHaveBeenCalled();
  });
  it('requires an older merchant address to be reselected from the current published dataset', async () => {
    const request = vi.fn<ApiClient['request']>().mockResolvedValueOnce({ dataset_id: 'new-published-dataset', items: [] });
    const api = createMerchantManagement({ request } as ApiClient);
    await expect(api.update({ ...input, merchantId: merchant.merchant_id, command: { ...input.command!, expectedVersion: '2' } })).rejects.toThrow('重新选择省市区');
    expect(request.mock.calls.map(([options]) => options.method)).not.toContain('PATCH');
  });
  it('rejects a region label that does not match the selected server node', async () => {
    const request = vi.fn<ApiClient['request']>().mockResolvedValueOnce({ dataset_id: 'current-dataset', items: [{ region_id: 'province', name: '其他省' }] });
    await expect(createMerchantManagement({ request } as ApiClient).create(input)).rejects.toThrow('与当前生效数据不一致');
    expect(request.mock.calls.map(([options]) => options.method)).not.toContain('POST');
  });
  it('preserves backend disable state and missing profile instead of fabricating address/account', () => {
    const result = merchantProjection({ ...merchant, status: 'INACTIVE' });
    expect(result.status).toBe('INACTIVE'); expect(result.operatingAddress.fullAddress).toBe('');
    expect(result.settlementAccount).toBe(''); expect(result.businessHours).toBeNull();
  });
  it('saves nine original photo IDs in order and verifies the first cover in a real GET contract', async () => {
    const ids = Array.from({ length: 9 }, (_, index) => 'photo-' + index);
    const saved = { ...merchant, photo_material_ids: ids, cover_material_id: ids[0]! };
    const request = vi.fn().mockResolvedValue(saved);
    const result = await createMerchantManagement({ request } as ApiClient).updatePhotos!(merchant.merchant_id, '2', ids, 'photo-original-key');
    expect(request).toHaveBeenNthCalledWith(1, { path: '/v1/ops/merchants/merchant-fixture', method: 'PATCH', aggregateVersion: '"v2"', idempotencyKey: 'photo-original-key', body: { photo_material_ids: ids, reason: '后台更新商家图片' } });
    expect(request).toHaveBeenNthCalledWith(2, { path: '/v1/ops/merchants/merchant-fixture' });
    expect(result.photoMaterialIds).toEqual(ids); expect(result.coverMaterialId).toBe(ids[0]);
  });
  it('rejects duplicate/tenth IDs before save and keeps a mismatched readback unresolved without another PATCH', async () => {
    const request = vi.fn().mockResolvedValue({ ...merchant, photo_material_ids: ['b', 'a'], cover_material_id: 'b' });
    const api = createMerchantManagement({ request } as ApiClient);
    await expect(api.updatePhotos!(merchant.merchant_id, '2', ['a', 'a'], 'key')).rejects.toThrow('不重复');
    await expect(api.updatePhotos!(merchant.merchant_id, '2', Array.from({ length: 10 }, (_, i) => 'photo-' + i), 'key')).rejects.toThrow('9 张');
    expect(request).not.toHaveBeenCalled();
    await expect(api.updatePhotos!(merchant.merchant_id, '2', ['a', 'b'], 'original-photo-key')).rejects.toThrow('保存回读');
    expect(request.mock.calls.filter(([options]) => options.method === 'PATCH')).toHaveLength(1);
    expect(request.mock.calls.filter(([options]) => options.method === undefined)).toHaveLength(1);
  });
});
