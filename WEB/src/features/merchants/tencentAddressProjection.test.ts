import { describe, expect, test } from 'vitest';
import { normalizeTencentGeocoderResponse } from './tencentAddressProjection';
import type { OperatingAddress } from '../../shared/services';
const old: OperatingAddress = { province: '旧省', city: '旧市', district: '旧区', provinceCode: 'old', cityCode: 'old', districtCode: 'old', detailAddress: '旧路', fullAddress: '旧地址', poiName: '旧地点', latitude: 22.5, longitude: 114, confirmationStatus: 'TENCENT_CONFIRMED' };
describe('Tencent reverse address identity', () => {
  test('carries provider adcode and clears stale region identity and POI', () => {
    const result = normalizeTencentGeocoderResponse({ result: { address: '广东省深圳市福田区公共路', address_component: { province: '广东省', city: '深圳市', district: '福田区', street: '公共路' }, ad_info: { adcode: '440304' } } }, old);
    expect(result).toMatchObject({ provinceCode: '', cityCode: '', districtCode: '440304', poiName: null, detailAddress: '公共路' });
  });
  test('does not use old administrative names when reverse lookup omits them', () => {
    expect(() => normalizeTencentGeocoderResponse({ result: { address_component: {} } }, old)).toThrow('完整行政区划');
  });
});
