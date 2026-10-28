import { returnEvidenceFixture } from './returnEvidenceFixture';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RentalOrder, RentalReturn, Versioned } from '../../shared/services/rentalOrders';
import { RentalReviewPanel } from './RentalReviewPanel';

const { gateway } = vi.hoisted(() => ({ gateway: { returns: vi.fn(), reviews: vi.fn(), receipt: vi.fn(), preview: vi.fn() } }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: gateway }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'review-admin', permissions: ['ops.orders.read', 'ops.returns.receive'] }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

const serverMillis = Date.parse('2026-10-06T00:00:00Z');
function show(clock = true, reviews: unknown[] = [], returnChanges: Partial<RentalReturn> = {}, orderActions: RentalOrder['order']['allowed_actions'] = []) {
  const serverClock = clock ? { serverMillis, observedMonotonicMillis: 100 } : null;
  const returned = { data: { method: 'EXPRESS', version: '2', material_status: 'COMPLETE', receipt_source: 'OFFICIAL', ...returnEvidenceFixture(), blockers: [], receipt_history: [], received_at: null, allowed_actions: [{ action_code: 'CONFIRM_RECEIPT', allowed: true }], ...returnChanges } as unknown as RentalReturn, etag: '"RETURN:return:2"', serverClock };
  gateway.returns.mockResolvedValue(returned);
  gateway.reviews.mockResolvedValue({ items: reviews, next_cursor: null });
  gateway.receipt.mockResolvedValue(returned);
  const order: Versioned<RentalOrder> = { data: { order: { order_id: 'receipt-order', stage: 'ACTIVE', version: '3', allowed_actions: orderActions }, return_id: 'return', bill: { finalized: false }, delivery: { delivered_at: '2026-10-05T23:00:00Z' } } as unknown as RentalOrder, etag: '"ORDER:order:3"', serverClock };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><RentalReviewPanel order={order} refresh={vi.fn().mockResolvedValue(undefined)} /></QueryClientProvider>);
}

it('permits a later actual receipt while keeping future and pre-delivery inputs blocked', async () => {
  let monotonic = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
  show();
  const input = await screen.findByLabelText('实际收回时间');
  const submit = () => screen.getByText('确认实际收回').closest('[type="button"]');
  fireEvent.change(input, { target: { value: '2026-10-06 08:01' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit()).toHaveAttribute('disabled');
  monotonic += 120000;
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-01T00:00:00Z'));
  fireEvent.change(input, { target: { value: '2026-10-06 08:03' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit()).toHaveAttribute('disabled');
  fireEvent.change(input, { target: { value: '2026-10-06 06:59' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit()).toHaveAttribute('disabled');
  fireEvent.change(input, { target: { value: '2026-10-06 08:02' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByRole('button', { name: '确认实际收回' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '确认实际收回' }));
  await waitFor(() => expect(gateway.receipt).toHaveBeenCalledOnce());
  expect(gateway.receipt).toHaveBeenCalledWith('receipt-order', { received_at: '2026-10-06T00:02:00.000Z', note: null }, '"RETURN:return:2"', expect.any(String));
});

it('keeps receipt submission blocked and asks for refresh without a server clock', async () => {
  show(false);
  const input = await screen.findByLabelText('实际收回时间');
  fireEvent.change(input, { target: { value: '2026-10-06 07:30' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('确认实际收回').closest('[type="button"]')).toHaveAttribute('disabled');
  expect(screen.getByText(/未取得服务器时间/)).toBeInTheDocument();
  expect(gateway.receipt).not.toHaveBeenCalled();
});

it('blocks actual receipt for an unresolved original cabinet task and exposes its existing recovery entry', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const message = '原归还柜机任务尚未安全结束，请在原任务重新核验，或确认空柜后释放占用，再确认实际收货（任务：original-task）';
  const action = { action_code: 'CONFIRM_RECEIPT' as const, allowed: false, reason_code: 'RETURN_CABINET_TASK_UNRESOLVED', display_reason: message, target: 'original-task', required_version: '9' };
  show(true, [], {
    method: 'CABINET', blockers: [{ code: 'RETURN_CABINET_TASK_UNRESOLVED', field: 'original-task', message }], allowed_actions: [action],
    cabinet_task: { task_id: 'original-task', version: '9', status: 'ANOMALY', cabinet_name: '测试柜', compartment_no: '8', verification_requested_at: '2026-10-06T00:00:00Z', door_status: 'CLOSED', rfid_result: 'MISMATCH', allowed_actions: [{ action_code: 'RECHECK_RETURN', allowed: true, reason_code: null, display_reason: null, target: 'original-task', required_version: '9' }] } as RentalReturn['cabinet_task'],
  }, [{ ...action, allowed: true }]);
  const input = await screen.findByLabelText('实际收回时间');
  fireEvent.change(input, { target: { value: '2026-10-06 07:30' } }); fireEvent.keyDown(input, { key: 'Enter' });
  const receive = screen.getByRole('button', { name: '确认实际收回' });
  expect(receive).toBeDisabled(); expect(screen.getByText(message)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重新核验原格口' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '核实空格后释放' })).not.toBeInTheDocument();
  fireEvent.click(receive); expect(gateway.receipt).not.toHaveBeenCalled();
});

it('renders each historical loss item own evidence including unavailable materials', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(100);
  show(true, [{ review_id: 'review-history', decision: 'APPROVE_FINAL', created_at: '2026-10-06T00:00:00Z', review_no: 1, actor_account_id: 'reviewer', allocation: {}, assessment: { evidence: [], loss_items: [{ description: '外壳损伤', confirmed_fen: '20000', evidence: [{ material_id: 'loss-photo', kind: 'PHOTO', availability: 'READY', media: { url: 'https://media.example.test/loss.webp' } }, { material_id: 'lost-photo', kind: 'PHOTO', availability: 'UNAVAILABLE', media: null }] }] } }]);
  const disclosure = await screen.findByRole('button', { name: /最终核定/ });
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('归还材料', { selector: 'dt' }).nextElementSibling).toHaveTextContent('材料完整');
  expect(screen.getByText('收回来源 / 操作人', { selector: 'dt' }).nextElementSibling).toHaveTextContent('官方人员 / —');
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  const image = screen.getByAltText('订单凭证');
  expect(image).toHaveAttribute('src', 'https://media.example.test/loss.webp');
  expect(image.closest('a')).toHaveAttribute('href', 'https://media.example.test/loss.webp');
  expect(screen.getByText('材料 lost-photo 暂不可用')).toBeInTheDocument();
});
