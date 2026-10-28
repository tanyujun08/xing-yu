import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoRuntime } from '../mock/runtime';
import { createMockAdminServices } from './createDemoServices';
import { MockBehaviorController } from '../mock/scenario';

describe('createMockAdminServices', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem('xingyu-admin.mock-session.v1', JSON.stringify({
      status: 'authenticated',
      accountId: 'mock-operations-001',
      displayName: '周运营',
      role: 'OPERATIONS',
      loginMethod: 'PHONE',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
  });

  it('injects the current actor inside the Mock adapter', async () => {
    const createProduct = vi.fn(async () => ({ id: 'product-1' }));
    const services = createMockAdminServices({ createProduct } as unknown as DemoRuntime);
    await services.catalog.createProduct({
      name: '相机',
      brandId: 'sony',
      brand: 'Sony',
      model: 'A7 IV',
      category: '相机',
      description: '',
      tags: [],
    });
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'mock-operations-001' }));
  });

  it('routes merchant photo and single RFID edits to their bounded Demo commands', async () => {
    const updateMerchantPhotos = vi.fn(async () => ({ id: 'merchant-1' }));
    const updateAssetRFID = vi.fn(async () => ({ id: 'asset-1' }));
    const services = createMockAdminServices({ updateMerchantPhotos, updateAssetRFID } as unknown as DemoRuntime);
    await services.merchants.updatePhotos!('merchant-1', '2', ['photo-b', 'photo-a'], 'merchant-photos-key');
    await services.assets.updateRFID!('asset-1', '3', '00128473', 'asset-rfid-key');
    expect(updateMerchantPhotos).toHaveBeenCalledWith('merchant-1', '2', ['photo-b', 'photo-a'], 'mock-operations-001');
    expect(updateAssetRFID).toHaveBeenCalledWith('asset-1', '3', '00128473', 'mock-operations-001');
  });

  it('honors an already-aborted query before touching the runtime', async () => {
    const listProducts = vi.fn(async () => []);
    const services = createMockAdminServices({ listProducts } as unknown as DemoRuntime);
    const controller = new AbortController();
    controller.abort();
    await expect(services.catalog.listProducts({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('exposes read/query-only contract purchase commands and injects the current actor', async () => {
    const queryContractPurchasePayment = vi.fn(async () => ({ id: 'cp-1' }));
    const listContractCreditLedger = vi.fn(async () => []);
    const services = createMockAdminServices({
      queryContractPurchasePayment,
      listContractCreditLedger,
    } as unknown as DemoRuntime);

    expect(services).not.toHaveProperty('contractPurchaseOrders');
    expect(services).not.toHaveProperty('rentalOrders');
    expect(queryContractPurchasePayment).not.toHaveBeenCalled();
    expect(listContractCreditLedger).not.toHaveBeenCalled();
  });

  it('injects deterministic service faults but never blocks session audit recording', async () => {
    const listProducts = vi.fn(async () => []);
    const recordLoginAttempt = vi.fn(async () => ({ id: 'audit-login' }));
    const behavior = new MockBehaviorController();
    behavior.configure({ latencyMs: 0, fault: 'FORBIDDEN', faultMode: 'PERSISTENT' });
    const services = createMockAdminServices({ listProducts, recordLoginAttempt } as unknown as DemoRuntime, behavior);

    await expect(services.catalog.listProducts()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await services.sessionAudit.recordLoginAttempt({
      accountId: 'mock-operations-001', displayName: '周运营', role: 'OPERATIONS',
      loginMethod: 'PHONE', source: 'Mock Web', status: 'FAILED', failureReason: '无权限',
    });
    expect(recordLoginAttempt).toHaveBeenCalledOnce();
  });
});
