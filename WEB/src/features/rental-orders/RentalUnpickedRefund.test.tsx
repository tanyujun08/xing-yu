import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RentalUnpickedRefund } from './RentalUnpickedRefund';
import type { RentalOrder, Versioned } from '../../shared/services/rentalOrders';

const { gateway, session } = vi.hoisted(() => ({ gateway: { refundUnpicked: vi.fn() }, session: { permissions: ['ops.refunds.create'] } }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: gateway }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => session }));
beforeEach(() => { session.permissions = ['ops.refunds.create']; gateway.refundUnpicked.mockResolvedValue({ state: 'ACCEPTED' }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function order(allowed = true): Versioned<RentalOrder> {
  return { etag: '"order-1-7"', serverClock: null, data: { order: {
    order_id: 'order-1', order_no: 'TEST-ORDER', version: '7', payment_mode: 'FIXED_10_FEN', initial_paid_fen: '10',
    allowed_actions: [{ action_code: 'REFUND_UNPICKED', allowed, display_reason: allowed ? null : '订单已取件，不能退款', reason_code: allowed ? null : 'UNPICKED_REFUND_NOT_ALLOWED', target: 'order-1', required_version: '7' }],
  } } as RentalOrder };
}
it('shows a disabled button with the server reason when pickup makes refund ineligible', () => {
  render(<RentalUnpickedRefund order={order(false)} fresh refresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: '全额退款' })).toBeDisabled();
  expect(screen.getByText('订单已取件，不能退款')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '全额退款' }));
  expect(gateway.refundUnpicked).not.toHaveBeenCalled();
});
it('fails closed for missing permission, stale reads or a mismatched action version', () => {
  session.permissions = [];
  const view = render(<RentalUnpickedRefund order={order()} fresh refresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: '全额退款' })).toBeDisabled();
  session.permissions = ['ops.refunds.create'];
  view.rerender(<RentalUnpickedRefund order={order()} fresh={false} refresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: '全额退款' })).toBeDisabled();
  const changed = order(); changed.data.order.version = '8';
  view.rerender(<RentalUnpickedRefund order={changed} fresh refresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: '全额退款' })).toBeDisabled();
});
it('requires confirmation, submits only once and distinguishes acceptance from success', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<RentalUnpickedRefund order={order()} fresh refresh={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: '全额退款' }));
  expect(gateway.refundUnpicked).not.toHaveBeenCalled();
  expect(screen.getByText(/实际退款按原微信支付的 0.10 元/)).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: '确认发起退款' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(gateway.refundUnpicked).toHaveBeenCalledOnce();
  expect(gateway.refundUnpicked).toHaveBeenCalledWith('order-1', '"order-1-7"', expect.any(String));
  expect(screen.getByText(/退款申请已受理，正在等待微信确认/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '全额退款' })).toBeDisabled();
});
it('retains the original idempotency key and ETag after an unknown response', async () => {
  gateway.refundUnpicked.mockRejectedValue(new Error('timeout'));
  render(<RentalUnpickedRefund order={order()} fresh refresh={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole('button', { name: '全额退款' }));
  fireEvent.click(screen.getByRole('button', { name: '确认发起退款' }));
  await screen.findByText(/退款请求结果尚未确认/);
  await waitFor(() => expect(screen.getByRole('button', { name: '全额退款' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '全额退款' }));
  fireEvent.click(screen.getByRole('button', { name: '确认发起退款' }));
  await waitFor(() => expect(gateway.refundUnpicked).toHaveBeenCalledTimes(2));
  expect(gateway.refundUnpicked.mock.calls[0]).toEqual(gateway.refundUnpicked.mock.calls[1]);
});
