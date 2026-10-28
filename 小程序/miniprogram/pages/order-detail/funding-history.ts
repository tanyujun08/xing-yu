import type { RentalFeeOrder } from '../../shared/model/rental-fees';
import { beijingTime, rentalMoney } from '../../shared/presentation/rental-order';

export const emptyFundingHistory = () => ({ fundingHistoryOpen: false, fundingHistoryKind: 'payment' as 'payment' | 'refund', fundingHistoryBusy: false, fundingHistoryError: '', fundingHistoryNext: '', fundingHistoryCursor: '', fundingHistoryPrevious: [] as string[], fundingHistoryRows: [] as ReturnType<typeof fundingHistoryRow>[] });
export function fundingHistoryRow(v: NonNullable<RentalFeeOrder['bill']['initial_payment']> | NonNullable<RentalFeeOrder['bill']['refund_summary']['latest_refund']>) {
  const states: Record<string, string> = { CREATED: '待处理', PROCESSING: '处理中', SUCCEEDED: '已成功', UNKNOWN: '结果待核实', CLOSED_UNPAID: '已关闭未支付', FAILED_CONFIRMED: '未成功' };
  if ('payment_id' in v) return { id: v.payment_id, title: v.purpose === 'INITIAL' ? '首付' : `补缴 · 第${v.generation}次`, status: states[v.status] ?? '待核实', amount: rentalMoney(v.amount_fen), cash: rentalMoney(v.payer_total_fen), time: beijingTime(v.paid_at ?? v.created_at) };
  return { id: v.refund_id, title: v.purpose === 'DEPOSIT' ? '退押金' : v.purpose === 'EXCESS_PAYMENT' ? '重复收款退款' : '未履约退款', status: states[v.status] ?? '待核实', amount: rentalMoney(v.amount_fen), cash: rentalMoney(v.payer_refund_fen), time: beijingTime(v.refunded_at) };
}
