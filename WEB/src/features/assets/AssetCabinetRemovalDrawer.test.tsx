import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Asset } from '../../shared/services';
import { AssetCabinetRemovalDrawer } from './AssetCabinetRemovalDrawer';

const { endAssetPlacement, queryDoor, openOne, setPublishStatus } = vi.hoisted(() => ({ endAssetPlacement: vi.fn(), queryDoor: vi.fn(), openOne: vi.fn(), setPublishStatus: vi.fn() }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ cabinetManagement: { endAssetPlacement, queryDoor, openOne }, assets: { setPublishStatus } }) }));
vi.mock('../../shared/query/adminQueryKeys', () => ({ useAdminQueryKeys: () => ({ domain: (name: string) => ['admin', name] }) }));
const asset = { id: 'asset-1', assetNo: 'A001', displayName: '相机', version: '19', supplyMode: 'OFFICIAL', publishStatus: 'OFFLINE', availabilityStatus: 'AVAILABLE', placement: { placement_id: 'placement-1', location_kind: 'CABINET', version: '6' } } as unknown as Asset;
const receipt = { asset_id: 'asset-1', state: { publish_status: 'OFFLINE' }, placement: { status: 'ENDED' } };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(initialAsset: Asset = asset) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), onRemoved = vi.fn(), onCancel = vi.fn();
  const body = (value: Asset) => <QueryClientProvider client={client}><AssetCabinetRemovalDrawer asset={value} locationLabel="南山租赁柜 · BOX 01" onRemoved={onRemoved} onCancel={onCancel} /></QueryClientProvider>;
  const view = render(body(initialAsset)); return { onRemoved, onCancel, refresh: (next: Asset) => view.rerender(body(next)) };
}
describe('direct cabinet removal', () => {
  it('confirms actual removal with placement version and has no physical dependency or publication', async () => {
    endAssetPlacement.mockResolvedValue(receipt); const { onRemoved } = show();
    expect(screen.getByText(/撤销对应取件码并释放格口/)).toBeInTheDocument();
    expect(endAssetPlacement).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认出柜' }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith(receipt));
    expect(endAssetPlacement).toHaveBeenCalledExactlyOnceWith('placement-1', '6', { reason: '后台资产出柜' }, expect.any(String));
    expect(queryDoor).not.toHaveBeenCalled(); expect(openOne).not.toHaveBeenCalled(); expect(setPublishStatus).not.toHaveBeenCalled();
  });
  it('freezes and checks the same removal request after response loss', async () => {
    endAssetPlacement.mockRejectedValueOnce(new Error('synthetic response loss')).mockResolvedValueOnce(receipt);
    const { refresh } = show(); fireEvent.click(screen.getByRole('button', { name: '确认出柜' }));
    await screen.findByRole('button', { name: '用原请求核对' });
    expect(screen.getByPlaceholderText('请输入出柜原因')).toBeDisabled();
    refresh({ ...asset, version: '20', placement: { ...asset.placement!, version: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '用原请求核对' }));
    await waitFor(() => expect(endAssetPlacement).toHaveBeenCalledTimes(2));
    expect(endAssetPlacement.mock.calls[1]).toEqual(endAssetPlacement.mock.calls[0]);
  });
  it('does not remove an online asset', async () => {
    show({ ...asset, publishStatus: 'ONLINE' }); fireEvent.click(screen.getByRole('button', { name: '确认出柜' }));
    await screen.findByText('请先下架资产，并确认资产可用后再出柜');
    expect(endAssetPlacement).not.toHaveBeenCalled();
  });

  it('does not remove an unavailable asset', async () => {
    show({ ...asset, availabilityStatus: 'FROZEN' });
    fireEvent.click(screen.getByRole('button', { name: '确认出柜' }));
    await screen.findByText('请先下架资产，并确认资产可用后再出柜');
    expect(endAssetPlacement).not.toHaveBeenCalled();
  });
  it.each(['placement_id', 'version'] as const)('does not remove without the original placement %s', async (field) => {
    show({ ...asset, placement: { ...asset.placement!, [field]: '' } });
    fireEvent.click(screen.getByRole('button', { name: '确认出柜' }));
    await screen.findByText('当前在柜记录不可核实，请刷新资产后重试');
    expect(endAssetPlacement).not.toHaveBeenCalled();
  });
});
