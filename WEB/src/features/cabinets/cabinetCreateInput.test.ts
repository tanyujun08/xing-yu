import { describe, expect, it } from 'vitest';
import { cabinetCreateInput } from './cabinetCreateInput';

describe('cabinet create contract', () => {
  it('submits only merchant ownership and cabinet fields', () => {
    const payload = cabinetCreateInput({ device: '12345', name: ' 测试柜 ', description: '', count: 3, reason: ' 创建测试柜 ', merchantId: 'synthetic-merchant' });
    expect(payload).toEqual({ provider_device_id: '12345', cabinet_name: '测试柜', description: null, compartment_count: 3, reason: '创建测试柜', merchant_id: 'synthetic-merchant' });
    expect(payload).not.toHaveProperty('deployment_site_address');
    expect(payload).not.toHaveProperty('deployment_site_name');
    expect(payload).not.toHaveProperty('address');
  });
  it('does not fabricate merchant ownership', () => {
    expect(() => cabinetCreateInput({ device: '12345', name: '测试柜', description: '', count: 3, reason: '创建测试柜', merchantId: '' })).toThrow();
  });
});
