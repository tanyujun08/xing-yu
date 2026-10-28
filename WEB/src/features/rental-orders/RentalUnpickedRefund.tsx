import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { randomId } from '../../shared/randomId';
import { rentalFailure, rentalRefundVerificationRejected, type RentalOrder, type Versioned } from '../../shared/services/rentalOrders';
import { rentalMoney } from './RentalShared';

export function RentalUnpickedRefund({ order, fresh, refresh }: { order: Versioned<RentalOrder>; fresh: boolean; refresh: () => Promise<unknown> }) {
  const session = useSession(), gateway = useAdminServices().rentalOrders;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [accepted, setAccepted] = useState(false);
  const mounted = useRef(true), inFlight = useRef(false);
  const intent = useRef<{ key: string; etag: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const action = order.data.order.allowed_actions.find(item => item.action_code === 'REFUND_UNPICKED');
  const permission = session.permissions.includes('ops.refunds.create');
  const allowed = !accepted && permission && fresh && !!gateway && !!order.etag && action?.allowed === true && action.required_version === order.data.order.version && action.target === order.data.order.order_id;
  const reason = accepted ? '退款申请已受理，请查看原退款记录' : !permission ? '当前账号没有发起退款权限' : !fresh ? '正在核对最新订单状态' : action?.display_reason || '当前订单不满足退款条件';
  async function submit() {
    if (!allowed || inFlight.current || !gateway) return;
    inFlight.current = true; setBusy(true); setNotice('');
    intent.current ??= { key: randomId(), etag: order.etag };
    try {
      await gateway.refundUnpicked(order.data.order.order_id, intent.current.etag, intent.current.key);
      if (!mounted.current) return;
      setAccepted(true); setOpen(false); setNotice('退款申请已受理，正在等待微信确认。退款成功后订单关闭，原路退回实际支付款项。');
    } catch (error) {
      if (!mounted.current) return;
      if (rentalRefundVerificationRejected(error)) {
        intent.current = null; setOpen(false); setNotice(rentalFailure(error));
      } else {
        setOpen(false); setNotice('退款请求结果尚未确认，请刷新订单和原退款记录；再次发起将复用原请求，不会创建新的退款意图。');
      }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
    // A failed readback must not turn an accepted refund into a new intent.
    try { await refresh(); } catch { /* The original refund remains authoritative. */ }
  }
  return <section aria-label="未取件退款">
    <Button tag="button" theme="danger" variant="outline" disabled={!allowed || busy} loading={busy} onClick={() => setOpen(true)}>全额退款</Button>
    {!allowed ? <p>{reason}</p> : <p>仅未取件的官方订单可退；租金与押金按原支付渠道全额退回。</p>}
    {notice ? <Alert theme="info" message={notice} /> : null}
    <Dialog visible={open} header="确认全额退款" confirmBtn={{ content: '确认发起退款', disabled: !allowed || busy, loading: busy }} cancelBtn={{ content: '取消', disabled: busy }} closeOnOverlayClick={false} onConfirm={() => void submit()} onClose={() => { if (!busy) setOpen(false); }}>
      <p>将为订单 {order.data.order.order_no} 原路退回全部已收租金与押金，原支付结算金额为 {rentalMoney(order.data.order.initial_paid_fen)}。</p>
      {order.data.order.payment_mode === 'FIXED_10_FEN' ? <p>本单为测试支付，实际退款按原微信支付的 0.10 元处理，业务标价不作为真实退款金额。</p> : null}
      <p>提交后将停止取件；微信确认退款成功后关闭订单并释放资产。</p>
    </Dialog>
  </section>;
}
