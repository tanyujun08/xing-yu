import { describe, expect, it } from 'vitest';
import { createDemoRuntime } from '.';

describe('Mock lifecycle', () => {
  it('enforces parent, reference and permission guards for merchant and cabinet lifecycle', () => {
    const runtime = createDemoRuntime();
    expect(() => runtime.setCabinetStatus({ cabinetRecordId: 'cabinet_seed_001', status: 'INACTIVE', actorId: 'mock-super-admin' })).toThrow('不能禁用或归档');

    const merchant = runtime.createMerchant({
      name: '无引用测试商家', contactName: '测试', sharePercent: 20, settlementAccount: '测试银行 6222020202021000',
      operatingAddress: { provinceCode: '440000', cityCode: '440300', districtCode: '440306', province: '广东省', city: '深圳市', district: '宝安区', poiName: null, detailAddress: '测试路 1 号', fullAddress: '广东省深圳市宝安区测试路 1 号', longitude: 113.9, latitude: 22.6, confirmationStatus: 'MANUAL_DEMO' },
      actorId: 'mock-super-admin',
    });
    const cabinet = runtime.createCabinet({ merchantId: merchant.id, cabinetId: 'CAB-LIFECYCLE-001', name: '测试柜', boxCount: 1, actorId: 'mock-super-admin' });
    expect(() => runtime.updateCabinet({ cabinetRecordId: cabinet.id, name: '越权', description: '', capabilities: cabinet.capabilities, actorId: 'mock-finance-001' })).toThrow('没有执行此操作的权限');
    expect(runtime.setCabinetStatus({ cabinetRecordId: cabinet.id, status: 'INACTIVE', actorId: 'mock-super-admin' }).status).toBe('INACTIVE');
    expect(runtime.archiveCabinet({ id: cabinet.id, reason: '测试归档', actorId: 'mock-super-admin' }).archivedAt).not.toBeNull();
    expect(runtime.archiveMerchant({ id: merchant.id, reason: '测试归档', actorId: 'mock-super-admin' }).archivedAt).not.toBeNull();
  });

  it('prevents self-disable and preserves at least one effective super administrator', () => {
    const runtime = createDemoRuntime();
    expect(() => runtime.setAdminStatus({ adminId: 'mock-super-admin', status: 'DISABLED', actorId: 'mock-super-admin' })).toThrow('不能禁用自己');
    const second = runtime.createAdmin({ displayName: '备用超管', mobile: '13800009999', role: 'SUPER_ADMIN', status: 'ACTIVE', actorId: 'mock-super-admin' });
    expect(runtime.setAdminStatus({ adminId: 'mock-super-admin', status: 'DISABLED', actorId: second.id }).status).toBe('DISABLED');
    expect(() => runtime.setAdminStatus({ adminId: second.id, status: 'DISABLED', actorId: 'mock-operations-001' })).toThrow('没有执行此操作的权限');
  });
});
