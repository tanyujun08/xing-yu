import { validPaymentAmounts } from './rental-payment-mode';
import type { RentalFeeOrder } from '../model/rental-fees';
import { rentalActionAllowed, rentalMoney } from './rental-order';

const minor = (value: string | null | undefined) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null;

/** Only the server's observed full-order refund identifies a nonfulfillment case. */
export function rentalOrderNonfulfillment(value: RentalFeeOrder) {
    const o = value.order, r = value.bill.refund_summary.latest_refund, p = value.bill.initial_payment;
    if (o.viewer_role !== 'TENANT' || o.stage !== 'ACTIVE' || o.physical_status !== 'NOT_DELIVERED' || value.return_id || value.delivery.delivered_at
        || !r || r.purpose !== 'OBSERVED_NONFULFILLMENT' || !r.refund_id || r.order_id !== o.order_id || r.currency !== 'CNY'
        || !/^[1-9][0-9]*$/.test(r.amount_fen) || value.bill.refund_summary.obligation_fen !== p?.channel_amount_fen || !p) return null;
    if (!p.payment_id || p.order_id !== o.order_id || p.purpose !== 'INITIAL' || p.status !== 'SUCCEEDED'
        || p.currency !== 'CNY' || p.payment_id !== r.original_payment_id || !validPaymentAmounts(p, value.fees.initial_due_fen)) return null;
    const amount = minor(p.amount_fen), cash = minor(p.payer_total_fen), orderCash = minor(o.initial_payer_total_fen);
    const knownCash = cash !== null && amount !== null && cash <= amount && (o.initial_payer_total_fen == null || orderCash === cash);
    return {
        code: 'K2', knownCash, paid: knownCash ? rentalMoney(p.payer_total_fen) : '现金金额待核实',
        canQuery: rentalActionAllowed(o.allowed_actions, 'QUERY_REFUND') && rentalActionAllowed(r.allowed_actions, 'QUERY_REFUND'),
    };
}
