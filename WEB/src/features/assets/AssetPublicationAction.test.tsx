import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Asset } from '../../shared/services';
import { AssetPublicationAction } from './AssetPublicationAction';

const { setPublishStatus } = vi.hoisted(() => ({ setPublishStatus: vi.fn() }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ assets: { setPublishStatus } }) }));
vi.mock('../../shared/query/adminQueryKeys', () => ({ useAdminQueryKeys: () => ({ domain: (name: string) => ['admin', name] }) }));
vi.mock('tdesign-react', async (original) => ({ ...await original<typeof import('tdesign-react')>(), MessagePlugin: { success: vi.fn().mockResolvedValue(null), error: vi.fn().mockResolvedValue(null) } }));
const asset = { id: 'asset-1', version: '7', supplyMode: 'OFFICIAL', publishStatus: 'OFFLINE', allowedActions: [{ code: 'PUBLISH', enabled: true, blockedReasons: [] }] } as unknown as Asset;
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(initialAsset: Asset = asset) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AssetPublicationAction asset={initialAsset} /></QueryClientProvider>);
  return { ...view, refresh: (next: Asset) => view.rerender(<QueryClientProvider client={client}><AssetPublicationAction asset={next} /></QueryClientProvider>) };
}
describe('manual official publication', () => {
  it('waits for a distinct administrator click after placement and respects server blockers', async () => {
    setPublishStatus.mockResolvedValue(asset);
    const view = show({ ...asset, allowedActions: [{ code: 'PUBLISH', enabled: false, blockedReasons: ['CABINET_PLACEMENT_REQUIRED'] }] });
    expect(screen.getByRole('button', { name: '上架' })).toBeDisabled();
    expect(setPublishStatus).not.toHaveBeenCalled();
    view.refresh(asset);
    fireEvent.click(screen.getByRole('button', { name: '上架' }));
    await waitFor(() => expect(setPublishStatus).toHaveBeenCalledOnce());
    expect(setPublishStatus).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1', expectedVersion: '7', publishStatus: 'ONLINE', command: expect.objectContaining({ idempotencyKey: expect.any(String) }) }));
  });
  it('replays the original publication intent even if the refreshed asset has changed', async () => {
    setPublishStatus.mockRejectedValueOnce(new Error('synthetic response loss')).mockResolvedValueOnce(asset);
    const view = show(); fireEvent.click(screen.getByRole('button', { name: '上架' }));
    await screen.findByRole('button', { name: '核对上架' });
    view.refresh({ ...asset, version: '8', publishStatus: 'ONLINE', allowedActions: [{ code: 'UNPUBLISH', enabled: true, blockedReasons: [] }] });
    fireEvent.click(screen.getByRole('button', { name: '核对上架' }));
    await waitFor(() => expect(setPublishStatus).toHaveBeenCalledTimes(2));
    expect(setPublishStatus.mock.calls[1]).toEqual(setPublishStatus.mock.calls[0]);
  });
  it('does not expose manual publication for personal assets', () => {
    show({ ...asset, supplyMode: 'C2C' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(setPublishStatus).not.toHaveBeenCalled();
  });
});
