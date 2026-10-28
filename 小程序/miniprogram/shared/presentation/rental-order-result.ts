import { beijingTime, rentalDepositSettlementVisible } from './rental-order';

type ResultOrder = {
    order: { stage: string; display_status_code: string; viewer_role: string; physical_status: string; review_status: string; asset: { asset_id: string }; initial_payer_total_fen: string | null };
    close_reason: string | null; hold_expires_at: string; closed_at: string | null; coupon_status: string | null;
    fees: { initial_due_fen: string };
    delivery: { method: string };
    bill: { finalized: boolean; refund_due_fen: string | null; deposit_refunded_fen: string; supplement_due_fen: string | null;
        initial_payment: { purpose: string; status: string; amount_fen: string } | null; supplement: { status: string } | null; refund_summary: { open_obligation_count: number } };
};
function amount(value: string | null): bigint | null {
    return value !== null && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null;
}
export function rentalOrderResult(value: ResultOrder) {
    const o = value.order, b = value.bill;
    const preparation = o.stage === 'CLOSED' && value.close_reason === 'PREPARATION_EXPIRED';
    const zeroClosed = o.stage === 'CLOSED' && value.close_reason === 'ZERO_CASH_UNDELIVERED';
    const unpaidClosed = o.stage === 'CLOSED' && ['PAYMENT_EXPIRED', 'PAYMENT_CLOSED_UNPAID', 'CANCELLED_UNPAID'].includes(value.close_reason ?? '');
    const settlement = o.stage === 'ACTIVE' && o.display_status_code === 'SETTLEMENT_CONFIRMING';
    const kind = preparation || zeroClosed || unpaidClosed ? 'closed' : settlement ? 'settlement' : '';
    const received = o.physical_status === 'RECEIVED', reviewed = o.review_status === 'FINAL';
    const due = amount(b.refund_due_fen), refunded = amount(b.deposit_refunded_fen), supplement = amount(b.supplement_due_fen);
    const supplementPaid = supplement === 0n || (supplement !== null && b.supplement?.status === 'PAID');
    const fundsSettled = rentalDepositSettlementVisible(value) && due !== null && refunded !== null && refunded >= due && supplementPaid
        && b.refund_summary.open_obligation_count === 0;
    return {
        kind, preparation, zeroClosed, unpaidClosed,
        title: preparation ? '签约准备已关闭' : zeroClosed || unpaidClosed ? '订单已关闭' : settlement ? '结算确认中' : '',
        reason: preparation ? `未在${beijingTime(value.hold_expires_at)}前完成签约并确认订单。`
            : zeroClosed ? value.delivery.method === 'CABINET' ? '超过租期仍未取件，订单已关闭。' : '超过租期仍未交付，订单已关闭。'
                : unpaidClosed ? value.close_reason === 'PAYMENT_EXPIRED' ? '关闭原因：超过支付期限' : value.close_reason === 'CANCELLED_UNPAID' ? '关闭原因：已取消未支付订单' : '关闭原因：原支付已关闭且未付款'
                    : settlement ? '正在确认订单最终状态。' : '',
        payment: !b.initial_payment && !b.supplement && (o.initial_payer_total_fen === null || o.initial_payer_total_fen === '0')
            ? preparation ? '本单未发起支付' : zeroClosed && value.fees.initial_due_fen === '0' ? '未发生付款' : unpaidClosed ? '未完成支付' : '支付情况待核实' : unpaidClosed ? '未完成支付' : '请查看原支付记录',
        coupon: value.coupon_status === 'RESTORED' ? '原优惠券已恢复，有效期不变。' : value.coupon_status === 'RELEASED' ? '优惠券预占已释放，有效期不变。' : value.coupon_status === null ? '本单未使用优惠券' : '优惠券状态待核实',
        credential: zeroClosed && value.delivery.method === 'CABINET' ? '取件凭证已失效，请勿前往取件。' : '',
        note: settlement ? fundsSettled ? '无需再次支付，请稍后查询。' : '请刷新订单状态，核实结算进度。' : '重新下单须重新核对价格、租期与条款，并签署新合同。',
        canReorder: kind === 'closed' && o.viewer_role === 'TENANT' && !!o.asset.asset_id,
        primaryLabel: preparation ? '重新核对下单' : '重新下单',
        steps: settlement ? [
            { label: received ? '设备已收回' : '收回状态待核实', done: received },
            { label: reviewed ? '材料审核完成' : '材料审核待核实', done: reviewed },
            { label: b.finalized ? '费用已核定' : '费用核定待核实', done: b.finalized },
            { label: fundsSettled ? '款项已结清' : '款项结清待核实', done: fundsSettled },
        ] : [],
    };
}
