import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RentalFundingHistory } from './RentalFundingHistory';
import { ApiProblem } from '../../shared/services/testing/problemFixture';

const { gateway, session } = vi.hoisted(() => ({
  gateway: { paymentHistory: vi.fn(), refundHistory: vi.fn(), verifyExternalRefund: vi.fn() },
  session: { accountId: 'synthetic-admin', permissions: ['ops.orders.read', 'ops.refunds.recover'] },
}));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: gateway }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => session }));
const clients: QueryClient[] = [];
beforeEach(() => {
  session.accountId = 'synthetic-admin'; session.permissions = ['ops.orders.read', 'ops.refunds.recover'];
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  gateway.paymentHistory.mockResolvedValue({ items: [{ payment_id: 'payment-1', purpose: 'INITIAL', status: 'SUCCEEDED', amount_fen: '60000', payer_total_fen: null, out_trade_no: 'original-trade', created_at: '2026-10-10T00:00:00Z', expires_at: '2026-10-10T00:05:00Z' }], has_more: true, next_cursor: 'cursor-1' });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.resetAllMocks(); vi.restoreAllMocks(); });
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><RentalFundingHistory key={session.accountId + ':order-1'} id="order-1" /></QueryClientProvider>);
}
async function select() {
  fireEvent.click(screen.getByRole('button', { name: '查看历史' }));
  fireEvent.click(await screen.findByRole('button', { name: '核验此支付的商户平台退款' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'external-refund-1' } });
  fireEvent.click(screen.getByRole('button', { name: '查询核验' }));
}
it('loads history on demand and follows the server cursor', async () => {
  show(); expect(gateway.paymentHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '查看历史' })); await screen.findByText('original-trade');
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(gateway.paymentHistory).toHaveBeenLastCalledWith('order-1', 'cursor-1', expect.any(AbortSignal)));
});
it.each([
  new TypeError('network'),
  ...['IDEMPOTENCY_IN_PROGRESS', 'IDEMPOTENCY_PENDING', 'UNKNOWN'].map(code => new ApiProblem(409, { code, message: '核验中', request_id: 'synthetic' })),
])('retains exact original verification after an unknown response %#', async error => {
  gateway.verifyExternalRefund.mockRejectedValueOnce(error).mockResolvedValueOnce({});
  show(); await select(); await screen.findByText(/提交结果待核实/);
  expect(screen.getByRole('textbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '查询核验' })); await screen.findByText(/核验任务已提交/);
  expect(gateway.verifyExternalRefund.mock.calls[1]).toEqual(gateway.verifyExternalRefund.mock.calls[0]);
});
it('allows correcting a definitive invalid refund number', async () => {
  gateway.verifyExternalRefund.mockRejectedValue(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '原退款单号无效', request_id: 'synthetic' }));
  show(); await select(); await screen.findByText('原退款单号无效');
  expect(screen.getByRole('textbox')).not.toBeDisabled();
});
