import { validPaymentAmounts, testPaymentNote } from './rental-payment-mode';
import type { RentalFeeOrder } from '../model/rental-fees';
import { beijingTime, rentalDepositSettlementVisible, rentalMoney } from './rental-order';

function minor(value: string | null | undefined): bigint | null {
    return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null;
}
function nonfulfillment(value: RentalFeeOrder) {
    return value.order.stage === 'CLOSED' && value.close_reason === 'EXTERNAL_NONFULFILLMENT' && value.order.physical_status === 'NOT_DELIVERED'
        && value.bill.refund_summary.latest_refund?.purpose === 'OBSERVED_NONFULFILLMENT' && value.bill.refund_summary.open_obligation_count === 0;
}
/** Cash components are never inferred from face value, a client callback or an incomplete payment list. */
export function rentalOrderCash(value: RentalFeeOrder) {
    const closed = nonfulfillment(value), b = value.bill;
    if (!closed && (value.order.stage !== 'COMPLETED' || !rentalDepositSettlementVisible(value))) return null;
    const summary = b.funds_summary;
    const initial = value.fees.initial_due_fen === '0' ? '0' : b.initial_payment?.payer_total_fen ?? null;
    const supplement = b.supplement ? b.supplement.paid_payment?.payer_total_fen ?? null : '0';
    const p = b.initial_payment, sp = b.supplement?.paid_payment, latest = b.refund_summary.latest_refund;
    const initialVerified = value.fees.initial_due_fen === '0' ? p === null : !!p && p.order_id === value.order.order_id && p.purpose === 'INITIAL' && p.status === 'SUCCEEDED' && validPaymentAmounts(p, value.fees.initial_due_fen);
    const supplementVerified = !closed && minor(b.supplement_due_fen) !== 0n ? !!b.supplement && b.supplement.status === 'PAID' && !!sp && sp.order_id === value.order.order_id && sp.supplement_id === b.supplement.supplement_id && sp.status === 'SUCCEEDED' && validPaymentAmounts(sp, b.supplement.amount_fen) : !b.supplement;
    const verified = initialVerified && supplementVerified && (!latest || latest.order_id === value.order.order_id)
        && summary.currency === 'CNY' && b.refund_summary.open_obligation_count === 0 && b.refund_summary.pending_fen === '0';
    return { transactionsVerified: verified, initialFen: initial, supplementFen: supplement,
        refundFen: summary.payer_refund_fen, expenseFen: verified ? summary.payer_net_fen : null };
}

export function rentalOrderCompletion(value: RentalFeeOrder) {
    const o = value.order, b = value.bill, closed = nonfulfillment(value);
    if (o.viewer_role !== 'TENANT' || o.has_exception || !closed && (o.stage !== 'COMPLETED' || !rentalDepositSettlementVisible(value))) return null;
    const cash = rentalOrderCash(value);
    if (!cash) return null;
    const refundDue = minor(b.refund_due_fen), supplementDue = minor(b.supplement_due_fen);
    const code = closed ? 'H5' : refundDue !== null && refundDue > 0n ? 'G3' : supplementDue !== null && supplementDue > 0n ? 'H4' : 'G4';
    const rent = minor(value.fees.rent_gross_fen), discount = minor(value.fees.rent_discount_fen);
    const overtime = minor(b.overtime_fen), loss = minor(b.loss_fen), deducted = minor(b.deducted_fen);
    const known = cash.expenseFen !== null;
    const cashRows = [{ label: value.fees.initial_due_fen === '0' ? '首次支付' : '首次微信实付', value: value.fees.initial_due_fen === '0' && cash.initialFen === '0' ? '无需现金支付' : rentalMoney(cash.initialFen) }];
    if (code === 'H4') cashRows.push({ label: '补缴微信实付', value: rentalMoney(cash.supplementFen) });
    if (code === 'G3' || closed) cashRows.push({ label: !cash.transactionsVerified ? '原退款现金' : closed ? '原路已退款' : '押金已退', value: rentalMoney(cash.refundFen) });
    if (code === 'G3') cashRows.push({ label: '退款时间', value: b.refund_summary.latest_refund?.status === 'SUCCEEDED' && b.refund_summary.latest_refund.order_id === o.order_id ? beijingTime(b.refund_summary.latest_refund.refunded_at) : '待核实' });
    return {
        code, closed, known, transactionsVerified: cash.transactionsVerified,
        title: !cash.transactionsVerified ? '结算记录待核实' : closed ? '已退款，订单关闭' : '订单已完成',
        note: cash.transactionsVerified && o.payment_mode === 'FIXED_10_FEN' ? testPaymentNote : !cash.transactionsVerified ? '原交易记录尚未核实，请刷新订单或联系客服。'
            : closed ? '关闭原因：无法履约；设备未交付。本次交易已关闭。' : '设备已收回，感谢使用本服务。',
        amountLabel: closed ? '本单净支付' : '最终花费', amount: known ? rentalMoney(cash.expenseFen) : '',
        cashNote: known ? '' : '现金分项尚未核实，暂不展示合计。请刷新原订单或联系客服。',
        supply: o.supply_channel === 'PERSONAL' ? '个人设备' : '官方设备', cashRows,
        feeRows: closed ? [] : [
            { label: discount !== null && discount > 0n ? '租金（优惠后）' : '租金', value: rentalMoney(rent !== null && discount !== null && rent >= discount ? (rent - discount).toString() : null) },
            { label: '逾期费', value: rentalMoney(b.overtime_fen) }, { label: '损失费用', value: rentalMoney(b.loss_fen) },
        ],
        deductionNote: o.payment_mode === 'FIXED_10_FEN' ? '费用抵扣为测试业务覆盖，实际收退仅以上方微信资金为准。' : closed || code === 'G3' ? '' : code === 'G4'
            ? overtime !== null && loss !== null && deducted !== null && overtime + loss === deducted && known
                ? `归还费用 ${rentalMoney(deducted.toString())} 已由押金抵扣，已结清。` : '归还费用与资金结清情况待核实。'
            : deducted !== null ? `归还费用中的 ${rentalMoney(deducted.toString())} 已由押金抵扣。` : '押金抵扣金额待核实。',
        returnId: closed ? '' : value.return_id ?? '',
    };
}
