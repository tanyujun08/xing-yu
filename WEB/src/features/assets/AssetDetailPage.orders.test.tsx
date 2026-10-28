import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RentalAsset } from '../../shared/services/contracts';
import { AssetDetailPage } from './AssetDetailPage';
import { RentalOrdersPage } from '../rental-orders/RentalOrdersPage';

const fx = vi.hoisted(() => ({ permissions: ['ops.orders.read'], list: vi.fn(), assets: vi.fn() }));
vi.mock('../../shared/access/session', async (original) => ({ ...await original<object>(), useSession: () => ({ accountId: 'ops-asset-reader', permissions: fx.permissions, hasPermission: (p: string) => fx.permissions.includes(p) }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ assets: { list: fx.assets, listLessors: async () => [], listTerms: async () => [] }, catalog: { listProducts: async () => [] }, rentalOrders: { list: fx.list } }) }));
vi.mock('../../shared/ui/MediaThumbnail', () => ({ MediaThumbnail: () => null }));
vi.mock('./AssetStockingDrawer', () => ({ AssetStockingDrawer: () => null }));
vi.mock('./AssetCabinetRemovalDrawer', () => ({ AssetCabinetRemovalDrawer: () => null }));
vi.mock('../../shared/ui/AdminFormDrawer', () => ({ AdminFormDrawer: () => null }));

const asset: RentalAsset = { id: 'asset/original', assetNo: 'AS-ORIGINAL', productId: 'product', displayName: '原资产', supplyMode: 'C2C', lessorId: 'lessor', identifierType: 'MANUFACTURER_SERIAL', identifierValue: 'SERIAL-1', identifierNormalizedValue: 'SERIAL-1', condition: '良好', defectDescription: '', accessoryDescription: '', rentalType: 'DAY', unitPriceFen: 1000, minimumUnits: 1, depositFen: 50000, referenceValueFen: 100000, currency: 'CNY', termsRevision: 1, termsEffectiveAt: '2026-10-01T00:00:00Z', coverMediaId: null, imageMediaIds: [], videoMediaIds: [], mediaSource: 'ASSET_ACTUAL', publishLocationSnapshot: null, reviewStatus: 'APPROVED', publishStatus: 'OFFLINE', availabilityStatus: 'AVAILABLE', boxId: null, creationBatchId: null, reviewRemark: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); fx.permissions = ['ops.orders.read']; fx.assets.mockResolvedValue([asset]); fx.list.mockResolvedValue({ items: [], next_cursor: null }); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/assets/asset%2Foriginal']}><Routes><Route path="/assets/:assetId" element={<AssetDetailPage />} /><Route path="/orders/rental" element={<RentalOrdersPage />} /></Routes></MemoryRouter></QueryClientProvider>); }

it('opens actual rental orders using only the selected asset ID and lets Q02 authorize the filtered read', async () => {
  show(); fireEvent.click(await screen.findByRole('tab', { name: '关联订单' }));
  const link = await screen.findByRole('link', { name: '查看该资产的租赁订单' }); expect(link).toHaveAttribute('href', '/orders/rental?asset_id=asset%2Foriginal');
  expect(fx.list).not.toHaveBeenCalled(); fireEvent.click(link);
  await waitFor(() => expect(fx.list).toHaveBeenCalledExactlyOnceWith({ asset_id: 'asset/original', limit: 20 }, expect.any(AbortSignal)));
  expect(screen.queryByText(/本轮订单闭环尚未接通/)).not.toBeInTheDocument();
});

it('does not offer an asset order locator without order read permission', async () => {
  fx.permissions = []; show(); fireEvent.click(await screen.findByRole('tab', { name: '关联订单' }));
  await screen.findByText('当前角色没有订单读取权限。'); expect(screen.queryByRole('link', { name: '查看该资产的租赁订单' })).not.toBeInTheDocument(); expect(fx.list).not.toHaveBeenCalled();
});

it('describes the official asset taken by the renter as in use rather than awaiting placement', async () => {
  fx.assets.mockResolvedValue([{ ...asset, supplyMode: 'OFFICIAL', availabilityStatus: 'RENTING', boxId: null }]);
  show(); await screen.findByRole('heading', { name: '原资产' });
  expect(screen.getAllByText('租客使用中')).toHaveLength(2);
  expect(screen.queryByText(/待投放/)).not.toBeInTheDocument();
});

it('keeps the placement prompt for an available official asset that has not been stocked', async () => {
  fx.assets.mockResolvedValue([{ ...asset, supplyMode: 'OFFICIAL', availabilityStatus: 'AVAILABLE', boxId: null }]);
  show(); await screen.findByRole('heading', { name: '原资产' });
  expect(screen.getAllByText('待投放')).toHaveLength(2);
  expect(screen.queryByText('租客使用中')).not.toBeInTheDocument();
});

