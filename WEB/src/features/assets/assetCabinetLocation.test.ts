import { expect, test, vi } from 'vitest';
import type { CabinetManagementGateway } from '../../shared/services/cabinetManagement';
import type { Asset } from '../../shared/services/contracts';
import { readAssetCabinetDirectory, readAssetCabinetLocation } from './assetCabinetLocation';

test('current placement resolves cabinet name and boxNo from real cabinet records', async () => {
  const get = vi.fn().mockResolvedValue({ cabinet_id: 'cabinet-1', cabinet_name: '商家一号柜', deployment_site_address: '门店经营地址' });
  const compartments = vi.fn().mockResolvedValue({ items: [{ cabinet_id: 'cabinet-1', compartment_id: 'internal-slot-9', compartment_no: 3 }] });
  const signal = new AbortController().signal;
  await expect(readAssetCabinetLocation({ get, compartments } as unknown as CabinetManagementGateway, 'cabinet-1', 'internal-slot-9', signal)).resolves.toEqual({ address: '门店经营地址', cabinetBox: '商家一号柜 · 3 号格口' });
  expect(get).toHaveBeenCalledWith('cabinet-1', { signal });
  expect(compartments).toHaveBeenCalledWith('cabinet-1', { signal });
});

test('a missing or mismatched compartment cannot be displayed as boxNo', async () => {
  const get = vi.fn().mockResolvedValue({ cabinet_id: 'cabinet-1', cabinet_name: '商家一号柜' });
  const compartments = vi.fn().mockResolvedValue({ items: [{ cabinet_id: 'other', compartment_id: 'internal-slot-9', compartment_no: 3 }] });
  await expect(readAssetCabinetLocation({ get, compartments } as unknown as CabinetManagementGateway, 'cabinet-1', 'internal-slot-9')).rejects.toThrow('不一致');
});

test('list location lookup reads all cabinet pages and one slot set per occupied cabinet', async () => {
  const list = vi.fn().mockImplementation(async ({ cursor }: { cursor: string }) => cursor === ''
    ? { items: [{ cabinet_id: 'cabinet-1', cabinet_name: '一号柜', deployment_site_address: '门店地址' }], page: { has_more: true, next_cursor: 'next' } }
    : { items: [{ cabinet_id: 'cabinet-2', cabinet_name: '二号柜', deployment_site_address: '另一门店' }], page: { has_more: false } });
  const compartments = vi.fn().mockResolvedValue({ items: [
    { cabinet_id: 'cabinet-1', compartment_id: 'internal-a', compartment_no: 2 },
    { cabinet_id: 'cabinet-1', compartment_id: 'internal-b', compartment_no: 5 },
  ] });
  const assets = [
    { id: 'asset-a', supplyMode: 'OFFICIAL', cabinetId: 'cabinet-1', boxId: 'internal-a' },
    { id: 'asset-b', supplyMode: 'OFFICIAL', cabinetId: 'cabinet-1', boxId: 'internal-b' },
  ] as Asset[];
  const value = await readAssetCabinetDirectory({ list, compartments } as unknown as CabinetManagementGateway, assets);
  expect(value.cabinets).toEqual([{ id: 'cabinet-1', name: '一号柜' }, { id: 'cabinet-2', name: '二号柜' }]);
  expect(value.locations).toEqual({
    'asset-a': { address: '门店地址', cabinetBox: '一号柜 · 2 号格口' },
    'asset-b': { address: '门店地址', cabinetBox: '一号柜 · 5 号格口' },
  });
  expect(list).toHaveBeenCalledTimes(2);
  expect(compartments).toHaveBeenCalledTimes(1);
});

test('list location lookup refuses an occupied asset without a trustworthy cabinet', async () => {
  const list = vi.fn().mockResolvedValue({ items: [], page: { has_more: false } });
  await expect(readAssetCabinetDirectory({ list } as unknown as CabinetManagementGateway, [{ id: 'asset-a', supplyMode: 'OFFICIAL', cabinetId: null, boxId: 'internal-a' } as Asset])).rejects.toThrow('不可读取');
});
