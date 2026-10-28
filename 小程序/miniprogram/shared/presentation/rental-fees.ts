import type { RentalFeeAssessment, RentalFeeOrder } from '../model/rental-fees';
import { beijingTime, rentalDepositSettlementVisible, rentalMoney } from './rental-order';
import { publicMedia } from './material-media';
import { rentalOrderCash } from './rental-order-completion';

export function finalRentalAssessment(value: RentalFeeOrder): RentalFeeAssessment | null {
  const assessment = value.bill.assessment;
  return rentalDepositSettlementVisible(value) && assessment?.decision === 'APPROVE_FINAL'
    && assessment.review_id === value.bill.review_id ? assessment : null;
}
function minor(value: string | null): bigint | null {
  return value !== null && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : null;
}
function duration(seconds: number): string {
  if (seconds === 0) return '无宽限';
  return seconds % 86400 === 0 ? `${seconds / 86400}天` : seconds % 3600 === 0 ? `${seconds / 3600}小时` : seconds % 60 === 0 ? `${seconds / 60}分钟` : `${seconds}秒`;
}
function proofs(items: RentalFeeAssessment['evidence'], prefix: string) {
  return items.map((item, index) => {
    const media = item.availability === 'READY' && item.material_id === item.media?.material_id ? publicMedia(item.media) : null;
    const available = !!media && (item.kind === 'VIDEO' ? item.media?.role === 'VIDEO' : item.media?.role !== 'VIDEO');
    return { key: `${prefix}-${index}`, materialId: item.material_id, kind: item.kind, available,
      url: available ? media!.url : '', poster: available ? media!.poster : '' };
  });
}
export function rentalFeeView(value: RentalFeeOrder) {
  const assessment = finalRentalAssessment(value);
  if (!assessment) return null;
  const basis = assessment.overtime_basis;
  const overtime = minor(value.bill.overtime_fen), loss = minor(value.bill.loss_fen);
  const lossItems = assessment.loss_items.map((item, index) => ({ key: 'loss-' + index, description: item.description,
    amount: rentalMoney(item.confirmed_fen), evidence: proofs(item.evidence, 'loss-' + index) }));
  const shown = new Set(lossItems.flatMap(item => item.evidence.map(proof => proof.materialId)));
  const cash = rentalOrderCash(value);
  return { orderId: value.order.order_id, orderNo: value.order.order_no, reviewId: assessment.review_id,
    reviewNo: assessment.review_no, createdAt: beijingTime(assessment.created_at),
    returnDeadline: beijingTime(basis.end_at), receivedAt: basis.cutoff_source === 'RECEIVED' ? beijingTime(basis.cutoff_at) : '待核实',
    unit: duration(basis.unit_seconds), grace: duration(basis.grace_seconds),
    units: basis.billable_units ?? '待核实', unitPrice: rentalMoney(basis.unit_price_fen),
    rounding: basis.rounding === 'CEIL_UNIT' ? '不足一个计费单位，按一个单位计' : '待核实',
    overtime: rentalMoney(value.bill.overtime_fen), loss: rentalMoney(value.bill.loss_fen),
    total: rentalMoney(overtime === null || loss === null ? null : (overtime + loss).toString()),
    deducted: rentalMoney(value.bill.deducted_fen), refundDue: rentalMoney(value.bill.refund_due_fen),
    supplement: rentalMoney(value.bill.supplement_due_fen), hasSupplement: value.bill.supplement_due_fen !== null && value.bill.supplement_due_fen !== '0',
    cashExpense: cash?.expenseFen != null ? rentalMoney(cash.expenseFen) : '', adjustment: assessment.adjustment_reason ?? '', lossItems,
    evidence: proofs(assessment.evidence.filter(item => !shown.has(item.material_id)), 'review'),
  };
}
