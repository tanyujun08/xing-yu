import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContractPurchaseDetailDrawer } from './ContractPurchaseDetailDrawer';
import { RentalOrdersPage } from '../rental-orders/RentalOrdersPage';
import { ContractPurchaseOrdersPage } from './ContractPurchaseOrdersPage';
import type { components } from '../../shared/services/rentalOrders';

const fixture = vi.hoisted(() => ({ permissions: ['ops.orders.read', 'ops.members.read'], gateway: { purchases: vi.fn(), purchase: vi.fn(), movements: vi.fn(), members: vi.fn(), list: vi.fn(), detail: vi.fn(), contract: vi.fn(), tasks: vi.fn() } }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'ops-purchase-reader', permissions: fixture.permissions }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: fixture.gateway }) }));
vi.mock('../rental-orders/RentalReviewPanel', () => ({ RentalReviewPanel: () => null }));
const clients: QueryClient[] = [];
const selectedOrderBill = {
  payment_mode: 'NORMAL', finalized: false, review_id: null, deposit_received_fen: '0', overtime_fen: null, loss_fen: null,
  deducted_fen: '0', refund_due_fen: null, supplement_due_fen: null, deposit_refunded_fen: '0',
  initial_payment: null, supplement: null, assessment: null, currency: 'CNY',
  refund_summary: { obligation_fen: '0', refunded_fen: '0', pending_fen: '0', open_obligation_count: 0, latest_refund: null },
  funds_summary: { gross_received_fen: '10000', refunded_fen: '0', net_received_fen: '10000', payer_total_fen: null, payer_refund_fen: null, payer_net_fen: null, excess_received_fen: '0', currency: 'CNY' },
} satisfies components['schemas']['BillView'];
const selectedOrderContract = {
  contract_id: 'rental-two-contract', order_id: 'rental-two', template_version_id: 'original-template',
  document_template: { template_version_id: 'original-template', source_docx_sha256: 'e'.repeat(64) },
  status: 'SUCCEEDED', quota_state: 'CONSUMED', quota_valid_until: null,
  expires_at: '2026-10-06T00:30:00Z', version: '2', allowed_actions: [], blockers: [],
  agreement_text: '第二笔订单冻结协议', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64),
  lessor_signature: { name: '合成出租方', mode: 'DEFAULT_SIGNED', source: 'USER_CONFIRMED_LOCAL_DEFAULT', signed_at: null, material_id: null, presignature_id: null },
  tenant_signature: { name: '合成承租人', account_id: 'tenant', status: 'SUCCEEDED', signed_at: '2026-10-06T00:10:00Z' },
  current_attempt: null,
  final_artifact: {
    artifact_id: 'rental-two-artifact', document_material_id: 'rental-two-pdf', document_sha256: 'c'.repeat(64),
    document_url: 'https://media.example.test/rental-two.pdf', page_count: 1,
    pages: [{ page_no: 1, material_id: 'rental-two-page', sha256: 'd'.repeat(64), url: 'https://media.example.test/rental-two.png' }],
    anchor_snapshot_json: [{ role: 'TENANT_MAIN', page_no: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.1 }], renderer_version: 'fixture',
  },
} satisfies components['schemas']['ContractView'];
beforeEach(() => {
  vi.resetAllMocks(); fixture.permissions = ['ops.orders.read', 'ops.members.read'];
  fixture.gateway.purchase.mockResolvedValue({ purchase_id: 'purchase-original', purchase_no: 'PURCHASE-NO', buyer_id: 'original-buyer', name: '合同次数', quantity: 2, cost_unit: 'PINK_POINT', total_cost: '100', consideration_status: 'PAID', grant_status: 'GRANTED', rule_version_id: 'original-rule', created_at: '2026-10-06T00:00:00Z', granted_at: '2026-10-06T00:00:00Z', lot: { lot_id: 'quota-original', granted_quantity: 2, available_quantity: 0, reserved_quantity: 0, consumed_quantity: 2, expired_quantity: 0, revoked_quantity: 0, valid_until: null } });
  fixture.gateway.movements.mockResolvedValue({ items: [{ movement_id: 'movement-original', action: 'CONSUME', quantity: 1, occurred_at: '2026-10-06T01:00:00Z', available_before_qty: 1, available_after_qty: 0, reversal_of: null, lot_id: 'quota-original' }], page: { next_cursor: null } });
  fixture.gateway.members.mockResolvedValue({ items: [], page: { next_cursor: null } });
  const rows = ['rental-one', 'rental-two'].map((id) => ({ order_id: id, order_no: 'RO-' + id, asset: { asset_id: 'asset', title: '成交资产' }, participants: { tenant_account_id: 'tenant', lessor_id: 'lessor', lessor_account_id: 'original-buyer' }, supply_channel: 'PERSONAL', display_status: '租赁中', physical_status: 'IN_USE', review_status: 'NOT_STARTED', initial_due_fen: '10000', initial_paid_fen: '10000', initial_payer_total_fen: null, created_at: '2026-10-06T00:00:00Z', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z', has_exception: false, exception_codes: [], blockers: [] }));
  fixture.gateway.list.mockResolvedValue({ items: rows, next_cursor: null });
  fixture.gateway.detail.mockResolvedValue({ etag: '"ORDER:cmVudGFsLXR3bw:1"', serverClock: null, data: { order: { ...rows[1], version: '1', allowed_actions: [] }, merchant_id: null, completed_at: null, closed_at: null, coupon_status: null, fees: { rent_gross_fen: '10000', rent_discount_fen: '0', deposit_list_fen: '0', deposit_waived_fen: '0', initial_due_fen: '10000' }, bill: selectedOrderBill, asset_snapshot: { description: '冻结资产说明', accessories: [], media: [], physical_identifier_display: null }, requirements: { policy_version_id: 'policy-original', return_instructions: '拍摄归还凭证' }, delivery: { method: 'EXPRESS' } } });
  fixture.gateway.contract.mockResolvedValue(selectedOrderContract);
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/purchase']}><Routes><Route path="/purchase" element={<ContractPurchaseDetailDrawer id="purchase-original" onClose={() => {}} />} /><Route path="/orders/rental" element={<RentalOrdersPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it('locates rental agreements by buyer then selected order without substituting purchase lot or movement IDs', async () => {
  show(); const link = await screen.findByRole('link', { name: /查看该用户参与的租赁订单/ });
  expect(link).toHaveAttribute('href', '/orders/rental?account_id=original-buyer'); await screen.findByText(/movement-original/);
  expect(fixture.gateway.movements).toHaveBeenCalledWith('original-buyer', 'purchase-original', '', expect.any(AbortSignal));
  fireEvent.click(link);
  // Keep role/name assertions within the relevant content instead of repeatedly
  // computing accessible names for every filter and control on the full page.
  const orderTable = await screen.findByRole('table');
  const orderButton = await within(orderTable).findByRole('button', { name: 'RO-rental-two' });
  expect(fixture.gateway.list).toHaveBeenCalledWith({ account_id: 'original-buyer', limit: 20 }, expect.any(AbortSignal));
  expect(fixture.gateway.detail).not.toHaveBeenCalled(); expect(fixture.gateway.contract).not.toHaveBeenCalled();
  fireEvent.click(orderButton);
  const contractSection = (await screen.findByText('交付与合同', { selector: 'h2' })).closest('section');
  expect(contractSection).not.toBeNull();
  const contractButton = within(contractSection!).getByRole('button', { name: '查看合同与次数' });
  expect(fixture.gateway.detail).toHaveBeenCalledExactlyOnceWith('rental-two', expect.any(AbortSignal));
  fireEvent.click(contractButton); await screen.findByText('第二笔订单冻结协议');
  expect(fixture.gateway.contract).toHaveBeenCalledExactlyOnceWith('rental-two', expect.any(AbortSignal));
  expect(screen.getByText('合成出租方 · 默认已签署')).toBeInTheDocument();
  expect(screen.getByText('合成承租人 · 已签署')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看已签署合同 PDF' })).toHaveAttribute('href', selectedOrderContract.final_artifact.document_url);
});

it('renders purchase business labels in list and detail while retaining original API filter values', async () => {
  fixture.permissions = ['ops.finance.read', 'ops.members.read'];
  const original = { purchase_id: 'purchase-original', purchase_no: 'PURCHASE-NO', buyer_id: 'original-buyer', kind: 'CONTRACT', quantity: '2', cost_unit: 'PINK_POINT', total_cost: '100', consideration_status: 'PAID', grant_status: 'GRANTED', rule_version_id: 'original-rule', created_at: '2026-10-06T00:00:00Z', granted_at: '2026-10-06T00:00:00Z' };
  fixture.gateway.purchases.mockResolvedValue({ items: [original], page: { next_cursor: null } }); fixture.gateway.purchase.mockResolvedValue(original);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/orders/contract-purchases?consideration_status=PAID&grant_status=GRANTED']}><ContractPurchaseOrdersPage /></MemoryRouter></QueryClientProvider>);
  const row = await screen.findByRole('button', { name: 'PURCHASE-NO' });
  expect(screen.getByRole('cell', { name: '合同次数' })).toBeInTheDocument(); expect(screen.getByRole('cell', { name: '已支付' })).toBeInTheDocument(); expect(screen.getByRole('cell', { name: '已发放' })).toBeInTheDocument();
  expect(fixture.gateway.purchases).toHaveBeenCalledWith(expect.objectContaining({ consideration_status: 'PAID', grant_status: 'GRANTED', kind: 'CONTRACT' }), expect.any(AbortSignal));
  fireEvent.click(row); await screen.findByText('消费 · 1 次');
  expect(screen.getByText('支付状态', { selector: 'dt' }).nextElementSibling).toHaveTextContent('已支付');
  expect(screen.getByText('权益状态', { selector: 'dt' }).nextElementSibling).toHaveTextContent('已发放');
  expect(fixture.gateway.purchase).toHaveBeenCalledExactlyOnceWith('purchase-original', expect.any(AbortSignal));
});

it('keeps purchase facts but does not offer a rental locator without order-read permission', async () => {
  fixture.permissions = ['ops.members.read']; show(); await waitFor(() => expect(screen.getByText('PURCHASE-NO', { selector: 'dd' })).toBeInTheDocument());
  expect(screen.queryByRole('link', { name: /查看该用户参与的租赁订单/ })).not.toBeInTheDocument();
  expect(fixture.gateway.list).not.toHaveBeenCalled(); expect(fixture.gateway.detail).not.toHaveBeenCalled(); expect(fixture.gateway.contract).not.toHaveBeenCalled();
});
