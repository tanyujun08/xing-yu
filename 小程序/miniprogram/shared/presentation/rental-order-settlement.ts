import { testPaymentNote } from './rental-payment-mode';
import type { RentalFeeOrder } from '../model/rental-fees';
import { beijingTime, rentalBlockers, rentalDepositSettlementVisible, rentalMoney } from './rental-order';
import { assertOrderPayment, originalOrderPayment, paymentCanInvoke, paymentDeadlineValid, orderPaymentNow } from './rental-order-payment';

type Refund = NonNullable<RentalFeeOrder['bill']['refund_summary']['latest_refund']>;
const positive = (value: string | null) => value !== null && /^[1-9][0-9]*$/.test(value);
const allows = (actions: readonly { action_code: string; allowed: boolean }[], code: string) => actions.some(action => action.action_code === code && action.allowed);

export function assertOriginalOrderRefund(refund: Refund, value: RentalFeeOrder) {
    const original = value.bill.refund_summary.latest_refund;
    if (!original || !refund.refund_id || refund.refund_id !== original.refund_id || refund.order_id !== value.order.order_id
        || refund.purpose !== original.purpose || refund.amount_fen !== original.amount_fen
        || refund.payment_mode !== original.payment_mode || refund.payment_mode !== value.order.payment_mode
        || refund.business_amount_fen !== original.business_amount_fen || refund.channel_amount_fen !== refund.amount_fen
        || !['NORMAL', 'FIXED_10_FEN'].includes(refund.payment_mode)
        || refund.currency !== 'CNY' || !positive(refund.amount_fen)
        || value.bill.initial_payment?.status !== 'SUCCEEDED' && refund.purpose !== 'EXCESS_PAYMENT'
        || refund.purpose === 'DEPOSIT' && (!rentalDepositSettlementVisible(value) || (refund.payment_mode === 'FIXED_10_FEN' ? refund.business_amount_fen !== value.bill.refund_due_fen || refund.channel_amount_fen !== refund.amount_fen || BigInt(refund.amount_fen) > 10n || value.bill.refund_summary.obligation_fen !== refund.amount_fen : value.bill.refund_summary.obligation_fen !== value.bill.refund_due_fen))) {
        throw new Error('退款记录与原订单不匹配，请刷新原订单或联系客服');
    }
}

/** Final fee presentation only; queries and payments retain their original server permissions. */
export function rentalOrderSettlement(value: RentalFeeOrder, paymentUnknown = false, now = orderPaymentNow(value)) {
    const o = value.order, b = value.bill;
    if (o.viewer_role !== 'TENANT' || o.stage !== 'ACTIVE' || o.has_exception || !rentalDepositSettlementVisible(value)) return null;
    const isRefund = positive(b.refund_due_fen) && b.supplement_due_fen === '0';
    const isSupplement = positive(b.supplement_due_fen) && b.refund_due_fen === '0';
    if (!isRefund && !isSupplement) return null;
    let valid = true;
    const refund = b.refund_summary.latest_refund;
    let payment: ReturnType<typeof originalOrderPayment>;
    try {
        if (isRefund && refund) assertOriginalOrderRefund(refund, value);
        if (isSupplement) { payment = originalOrderPayment(value, 'SUPPLEMENT'); if (payment) assertOrderPayment(payment, value, 'SUPPLEMENT'); }
    } catch { valid = false; }
    // A successful transaction still waits for the server's order settlement screen.
    if (valid && (isRefund ? b.refund_summary.open_obligation_count === 0 : b.supplement?.status === 'PAID') && !paymentUnknown) return null;
    const canPay = isSupplement && valid && !paymentUnknown && allows(o.allowed_actions, 'PAY_SUPPLEMENT') && (!payment || paymentCanInvoke(payment, now));
    const verified = !!payment?.last_verified_at && Number.isFinite(Date.parse(payment.last_verified_at));
    const expiredUnpaid = valid && !paymentUnknown && !!payment && verified && ['CLOSED_UNPAID', 'FAILED_CONFIRMED'].includes(payment.status) && !paymentDeadlineValid(payment.expires_at, now);
    const failed = isRefund ? valid && refund?.status === 'FAILED_CONFIRMED' : expiredUnpaid;
    const checking = isRefund ? !valid || refund?.status === 'UNKNOWN' : !canPay && !expiredUnpaid;
    const compact = checking || failed;
    const code = isRefund ? failed ? 'G2b' : checking ? 'G2a' : 'G1' : expiredUnpaid ? 'H3' : canPay ? 'H1' : 'H2';
    const title = isRefund ? failed ? '退押未成功' : checking ? '退押结果确认中' : '退押处理中' : expiredUnpaid ? '补缴待处理' : canPay ? '待补缴费用' : '补缴结果确认中';
    const testMode = o.payment_mode === 'FIXED_10_FEN';
    const amount = rentalMoney(testMode ? isRefund ? refund?.channel_amount_fen ?? null : payment?.channel_amount_fen ?? null : isRefund ? b.refund_due_fen : b.supplement_due_fen);
    const canQuery = valid && allows(o.allowed_actions, isRefund ? 'QUERY_REFUND' : 'QUERY_PAYMENT')
        && (isRefund ? !!refund && allows(refund.allowed_actions, 'QUERY_REFUND') : !!payment && allows(payment.allowed_actions, 'QUERY_PAYMENT'));
    const overtime = b.overtime_fen, loss = b.loss_fen;
    const total = overtime !== null && loss !== null && /^\d+$/.test(overtime) && /^\d+$/.test(loss) ? (BigInt(overtime) + BigInt(loss)).toString() : null;
    return {
        code, title, navTitle: compact && !expiredUnpaid ? isRefund ? '退押进度' : '补缴进度' : '订单详情', isRefund, compact, failed, checking, canPay, canQuery,
        paymentId: valid ? payment?.payment_id ?? '' : '', amount,
        amountLabel: testMode ? isRefund ? '渠道实际退款' : '渠道实际补缴' : isRefund ? checking ? '原应退押金' : '应退押金' : expiredUnpaid ? '待补缴' : checking ? '原补缴金额' : '本次需补缴',
        primaryLabel: failed ? '联系客服' : canPay ? '支付 ' + amount : canQuery ? isRefund ? checking ? '查询原退款' : '查询退押进度' : '查询原补缴' : '刷新订单状态',
        created: valid ? beijingTime(payment?.created_at) : '待核实', deadline: valid ? beijingTime(payment?.expires_at) : '待核实',
        verified: valid ? beijingTime(isRefund ? refund?.last_verified_at : payment?.last_verified_at) : '待核实',
        reason: isRefund && failed ? rentalBlockers(refund?.blockers ?? []) || '原退款未成功，请联系客服核实原因。' : '',
        note: valid && testMode ? testPaymentNote : !valid ? '原交易记录待核实，请刷新原订单或联系客服。'
            : isRefund ? failed ? '官方将协助处理，请保留原订单；退押责任仍有效。' : checking ? '正在核实原退款结果，暂未确认到账。设备已收回，费用已核定。' : '已完成设备回收，押金正在处理退款。退还至原支付渠道；具体结果以订单更新为准。'
                : expiredUnpaid ? '正在确认原支付已关闭，确认后可继续补缴；费用账单不会失效。' : canPay ? '已由押金抵扣部分费用，请尽快完成补缴。' : '可能已扣款，请查询原补缴结果。',
        expiredNote: expiredUnpaid ? '原支付已超过有效期，费用尚未结清。' : '',
        supply: o.supply_channel === 'PERSONAL' ? '个人设备' : '官方设备',
        rows: isRefund ? [
            { label: testMode ? '测试业务押金覆盖' : '已收押金', value: rentalMoney(b.deposit_received_fen) }, { label: '逾期费', value: rentalMoney(overtime) },
            { label: '损失费用', value: rentalMoney(loss) }, { label: '押金抵扣', value: rentalMoney(b.deducted_fen) },
        ] : [
            { label: '逾期费', value: rentalMoney(overtime) }, { label: '损失费用', value: rentalMoney(loss) },
            { label: '归还费用合计', value: rentalMoney(total) }, { label: '已由押金抵扣', value: rentalMoney(b.deducted_fen) },
        ],
    };
}
