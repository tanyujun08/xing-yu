import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Merchant } from '../../shared/services/contracts';
import { MerchantDetailPage } from './MerchantDetailPage';
import { FinancePage } from '../finance/FinancePage';

const fx = vi.hoisted(() => ({ permissions: ['ops.finance.read'], get: vi.fn(), earnings: vi.fn(), exportIncome: vi.fn() }));
vi.mock('../../shared/access/session', async (original) => ({ ...await original<object>(), useSession: () => ({ accountId: 'ops-merchant-reader', permissions: fx.permissions, hasPermission: (p: string) => fx.permissions.includes(p) }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ merchants: { search: async () => [], getById: fx.get }, rentalOrders: { earnings: fx.earnings, exportIncome: fx.exportIncome } }) }));
vi.mock('../../shared/ui/AdminFormDrawer', () => ({ AdminFormDrawer: () => null }));

const merchant: Merchant = { id: 'merchant/original', name: '原成交商家', status: 'INACTIVE', shareBps: 2500, settlementCycle: 'MONTHLY', settlementAccount: '', contactName: '原联系人', archivedAt: null, archivedBy: null, archiveReason: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', operatingAddress: { provinceCode: '', cityCode: '', districtCode: '', province: '', city: '', district: '', poiName: null, detailAddress: '合成地址', fullAddress: '合成地址', longitude: 113, latitude: 23, confirmationStatus: 'TENCENT_CONFIRMED' } };
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); fx.permissions = ['ops.finance.read']; fx.get.mockResolvedValue(merchant); fx.earnings.mockResolvedValue({ items: [], next_cursor: null }); vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T16:01:00Z')); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/merchants/merchant%2Foriginal']}><Routes><Route path="/merchants/:merchantId" element={<MerchantDetailPage />} /><Route path="/finance" element={<FinancePage />} /></Routes></MemoryRouter></QueryClientProvider>); }

it('keeps an inactive merchant original ID and Beijing month when entering its actual income query', async () => {
  show(); const link = await screen.findByRole('link', { name: '查看该商家收益流水' });
  expect(link).toHaveAttribute('href', '/finance?tab=earnings&beneficiary_kind=MERCHANT&merchant_id=merchant%2Foriginal&period_month=2026-11');
  expect(fx.earnings).not.toHaveBeenCalled(); fireEvent.click(link);
  await waitFor(() => expect(fx.earnings).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ beneficiary_kind: 'MERCHANT', merchant_id: 'merchant/original', period_month: '2026-11' }), expect.any(AbortSignal)));
  expect(fx.exportIncome).not.toHaveBeenCalled();
});

it('does not expose the merchant income entry without finance read permission', async () => {
  fx.permissions = []; show(); await screen.findByText('原成交商家'); expect(screen.queryByRole('link', { name: '查看该商家收益流水' })).not.toBeInTheDocument(); expect(fx.earnings).not.toHaveBeenCalled();
});
