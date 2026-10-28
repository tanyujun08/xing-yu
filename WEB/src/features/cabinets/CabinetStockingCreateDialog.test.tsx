import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CabinetStockingCreateDialog } from './CabinetStockingCreateDialog';
import { ApiProblem } from '../../shared/services/testing/problemFixture';
import type { CabinetManagementGateway, CabinetPlacementReceipt, ManagedCabinet } from '../../shared/services/cabinetManagement';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cabinet = { cabinet_id: 'cab_test', provider_device_id: '481427234', cabinet_name: '南山租赁柜', lifecycle_status: 'ACTIVE', connectivity_status: 'OFFLINE', occupancy_summary: { available: 1 }, version: 3 } as ManagedCabinet;
const receipt = { asset_id: 'asset_1', state: { publish_status: 'OFFLINE' }, credential: { kind: 'PICKUP', status: 'DORMANT' } } as CabinetPlacementReceipt;
function show(placeAsset: ReturnType<typeof vi.fn>) {
  const gateway = {
    stockingOptions: vi.fn().mockResolvedValue({ cabinet_readiness: { eligible: true, reason_code: 'READY' },
      assets: { items: [{ asset_id: 'asset_1', asset_no: 'A001', display_name: '相机', version: '7', eligible: true, reason_code: 'READY' }], page: { has_more: false, next_cursor: null } },
      slots: [{ compartment_id: 'slot_1', compartment_no: 1, eligible: true, reason_code: 'READY', door_status: 'OPEN' }] }),
    placeAsset, queryDoor: vi.fn(), openOne: vi.fn(),
  } as unknown as CabinetManagementGateway;
  const onPlaced=vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CabinetStockingCreateDialog cabinet={cabinet} gateway={gateway} accountId="admin" onClose={vi.fn()} onPlaced={onPlaced} /></QueryClientProvider>);
  return { gateway, onPlaced };
}
async function choose() { fireEvent.click(await screen.findByRole('button', { name: /相机.*A001/ })); fireEvent.click(await screen.findByRole('button', { name: /BOX 01.*可用/ })); }
describe('direct cabinet placement', () => {
  it('records actual placement without a physical query and leaves manual publication separate', async () => {
    const place=vi.fn().mockResolvedValue(receipt), {gateway,onPlaced}=show(place);
    await choose();
    const submit=screen.getByRole('button',{name:'确认入柜'});
    await waitFor(()=>expect(submit).toBeEnabled()); fireEvent.click(submit);
    await waitFor(()=>expect(onPlaced).toHaveBeenCalledWith(receipt));
    expect(place).toHaveBeenCalledExactlyOnceWith('asset_1','7','cab_test','slot_1','后台资产入柜',expect.any(String));
    expect(gateway.queryDoor).not.toHaveBeenCalled(); expect(gateway.openOne).not.toHaveBeenCalled();
    expect(screen.getByText(/资产仍未上架，需另行点击上架/)).toBeInTheDocument();
    expect(screen.queryByText(/待开柜|确认关门|创建预占/)).not.toBeInTheDocument();
  });
  it('keeps the exact original placement request after an uncertain response', async () => {
    const place=vi.fn().mockRejectedValueOnce(new Error('transport loss')).mockResolvedValueOnce(receipt);
    show(place); await choose(); fireEvent.click(screen.getByRole('button',{name:'确认入柜'}));
    await waitFor(() => expect(screen.getByRole('button', { name: '刷新候选' })).toBeDisabled());
    fireEvent.click(await screen.findByRole('button',{name:'用原请求核对'}));
    await waitFor(()=>expect(place).toHaveBeenCalledTimes(2)); expect(place.mock.calls[1]).toEqual(place.mock.calls[0]);
  });
  it('refreshes a definite conflict without resubmitting or clearing the selection', async () => {
    const conflict = new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: 'conflict', request_id: 'synthetic', details: { resource_type: 'ASSET_ORDER_OR_FULFILLMENT_OCCUPIED' } });
    const place = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce(receipt);
    const { gateway, onPlaced } = show(place);
    await choose();
    fireEvent.click(screen.getByRole('button', { name: '确认入柜' }));
    await screen.findByText(/资产、格口或柜机存在占用/);
    await waitFor(() => expect(gateway.stockingOptions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: '刷新候选' })).toBeEnabled());
    expect(screen.getByRole('button', { name: /相机.*A001/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /BOX 01.*可用/ })).toHaveAttribute('aria-pressed', 'true');
    expect(place).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '刷新候选' }));
    await waitFor(() => expect(gateway.stockingOptions).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: '确认入柜' })).toBeEnabled());
    expect(place).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '确认入柜' }));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith(receipt));
    expect(place.mock.calls[1]?.slice(0, 5)).toEqual(place.mock.calls[0]?.slice(0, 5));
    expect(place.mock.calls[1]?.[5]).not.toBe(place.mock.calls[0]?.[5]);
    expect(gateway.queryDoor).not.toHaveBeenCalled();
    expect(gateway.openOne).not.toHaveBeenCalled();
  });
});
