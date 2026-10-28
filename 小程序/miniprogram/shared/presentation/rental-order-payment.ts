import { validPaymentAmounts, testPaymentNote } from './rental-payment-mode';
import type { RentalFeeOrder } from '../model/rental-fees';
import { beijingTime, rentalMoney } from './rental-order';

const clocks = new WeakMap<object, { server: number; observed: number }>();
function observedMillis() { return Date.now(); }
export function anchorOrderPaymentClock(value: { server_time: string }, observed = observedMillis()) {
    clocks.set(value, { server: Date.parse(value.server_time), observed });
}
export function orderPaymentNow(value: object, observed = observedMillis()) {
    const clock = clocks.get(value);
    const elapsed = clock ? observed - clock.observed : NaN;
    return clock && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 30000 ? clock.server + elapsed : NaN;
}

type Action = { action_code: string; allowed: boolean };
type Payment = NonNullable<RentalFeeOrder['bill']['initial_payment']>;
type Order = {
    order: { payment_mode: string; order_id: string; stage: string; viewer_role: string; allowed_actions: readonly Action[] };
    payment_due_at: string | null; fees: { initial_due_fen: string };
    bill: { initial_payment: Payment | null; supplement: { supplement_id: string; status: string; amount_fen: string; active_payment: Payment | null; paid_payment: Payment | null } | null; supplement_due_fen: string | null };
};
const allows = (actions: readonly Action[], code: string) => actions.some(action => action.action_code === code && action.allowed);
export const paymentDeadlineValid = (deadline: string | null, now = Date.now()) => !!deadline && Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) > now;
export function originalOrderPayment(value: Order, purpose: 'INITIAL' | 'SUPPLEMENT') {
    return (purpose === 'INITIAL' ? value.bill.initial_payment : value.bill.supplement?.status === 'PAID' ? value.bill.supplement.paid_payment : value.bill.supplement?.active_payment) ?? undefined;
}
/** Bounded current references for actions; never a complete transaction history. */
export function currentOrderPayments(value: Order) {
    const refs = [value.bill.initial_payment, value.bill.supplement?.active_payment, value.bill.supplement?.paid_payment];
    return refs.filter((p, index): p is Payment => !!p && refs.findIndex(ref => ref?.payment_id === p.payment_id) === index);
}
export function assertOrderPayment(payment: Payment, value: Order, purpose: 'INITIAL' | 'SUPPLEMENT', expectedId?: string) {
    const due = purpose === 'INITIAL' ? value.fees.initial_due_fen : value.bill.supplement?.amount_fen;
    if (!payment.payment_id || expectedId && payment.payment_id !== expectedId || payment.order_id !== value.order.order_id || payment.purpose !== purpose
        || (value.bill.initial_payment && payment.payment_mode !== value.bill.initial_payment.payment_mode) || payment.currency !== 'CNY' || !/^[1-9][0-9]*$/.test(payment.amount_fen) || !validPaymentAmounts(payment, due)
        || (purpose === 'INITIAL' ? payment.supplement_id !== null || payment.generation !== 0 : payment.supplement_id !== value.bill.supplement?.supplement_id || payment.generation < 1)) {
        throw new Error('支付记录与本单或支付用途不匹配，请查询原订单');
    }
}
export function paymentCanInvoke(payment: Payment, now = Date.now()) {
    return ['CREATED', 'PROCESSING'].includes(payment.status) && paymentDeadlineValid(payment.expires_at, now) && allows(payment.allowed_actions, 'INVOKE_PAYMENT');
}
export function rentalOrderPayment(value: Order, now = orderPaymentNow(value)) {
    if (value.order.viewer_role !== 'TENANT' || value.order.stage !== 'AWAITING_PAYMENT') return null;
    let payment: Payment | undefined;
    let valid = true;
    try { payment = originalOrderPayment(value, 'INITIAL'); if (payment) assertOrderPayment(payment, value, 'INITIAL'); } catch { valid = false; }
    const withinDeadline = paymentDeadlineValid(value.payment_due_at, now);
    const canPay = valid && withinDeadline && allows(value.order.allowed_actions, 'PAY_INITIAL') && (!payment || paymentCanInvoke(payment, now));
    const verified = !!payment?.last_verified_at && Number.isFinite(Date.parse(payment.last_verified_at));
    const kind = canPay ? payment && verified ? 'retry' : 'ready' : 'checking';
    const terminalUnpaid = valid && !!payment && ['CLOSED_UNPAID', 'FAILED_CONFIRMED'].includes(payment.status);
    return {
        kind, canPay, canCancel: valid && (canPay || terminalUnpaid) && allows(value.order.allowed_actions, 'CANCEL_UNPAID'),
        canQuery: valid && !!payment && allows(payment.allowed_actions, 'QUERY_PAYMENT') && allows(value.order.allowed_actions, 'QUERY_PAYMENT'),
        title: kind === 'retry' ? '尚未完成支付' : kind === 'ready' ? '待支付' : terminalUnpaid ? '支付未完成，订单待核实' : '支付结果确认中',
        amount: rentalMoney(payment && valid ? payment.amount_fen : value.fees.initial_due_fen),
        deadline: beijingTime(payment?.expires_at && Date.parse(payment.expires_at) < Date.parse(value.payment_due_at ?? '') ? payment.expires_at : value.payment_due_at),
        created: beijingTime(payment?.created_at), verified: payment?.last_verified_at ? beijingTime(payment.last_verified_at) : '尚未查询',
        note: valid && payment?.payment_mode === 'FIXED_10_FEN' ? testPaymentNote : !valid ? '支付记录待核实，请刷新原订单或联系客服。'
            : kind === 'retry' ? '已确认未扣款，可继续原支付。'
                : kind === 'ready' ? '请在支付期限内完成支付。'
                    : terminalUnpaid ? '原支付未完成，请刷新订单确认关闭状态。'
                        : payment?.status === 'SUCCEEDED' ? '支付已成功，正在确认订单状态，请勿重复支付。'
                            : !withinDeadline ? '支付期限已到，请查询原支付与订单结果。'
                                : '可能已扣款，请先查询原支付结果，避免重复操作。',
        primaryLabel: kind === 'retry' ? '继续原支付' : kind === 'ready' ? '支付 ' + rentalMoney(payment && valid ? payment.channel_amount_fen : value.fees.initial_due_fen) : '查询支付结果',
    };
}
