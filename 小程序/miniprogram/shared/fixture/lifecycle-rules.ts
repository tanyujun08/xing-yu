import { requireNonNegativeSafeInteger } from './diamond';

export type SupplyType = 'cabinet' | 'store' | 'personal';
export type RentalMode = 'hourly' | 'daily';
export type ResultAxis = 'idle' | 'pending' | 'confirming' | 'succeeded' | 'failed';
export type ReservationAxis = 'none' | 'held' | 'occupied' | 'confirming' | 'released';
export type ApprovalAxis = 'not_required' | 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type AppealAxis = 'none' | 'available' | 'open' | 'resolved' | 'expired';
export type VoucherAxis = 'none' | 'reserved' | 'redeemed' | 'released';
export type DiamondAxis = 'none' | 'reserved' | 'consumed' | 'restored';
export type InsuranceClaimAxis = 'not_applicable' | 'not_started' | 'pending' | 'confirming' | 'succeeded' | 'failed';

export const HOUR_DEPOSIT_FEN = 50_000;
export const HOUR_REMINDER_FEN = 40_000;
export const FULL_DEPOSIT_FEN = 1_300_000;
export const DIAMOND_MAX_WAIVER_FEN = 20_000;
export const AFTER_SALES_GUARD_FEN = 4_000;
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const APPEAL_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface HourlyBillingInput {
  startedAtMs: number;
  effectiveReturnAtMs: number;
  hourlyRateFen: number;
  referenceValueFen: number;
}

export interface HourlyBillingResult {
  durationMs: number;
  billedHours: number;
  rentFen: number;
  reminderReached: boolean;
}

/** Whole elapsed hours round up once; cumulative rent for this order never exceeds its frozen product value. */
export function calculateHourlyBilling(input: HourlyBillingInput): HourlyBillingResult {
  if (!Number.isFinite(input.startedAtMs) || !Number.isFinite(input.effectiveReturnAtMs)) throw new RangeError('计费时间必须是有限数值');
  const durationMs = Math.max(0, Math.floor(input.effectiveReturnAtMs - input.startedAtMs));
  requireNonNegativeSafeInteger(durationMs, '计费时长');
  const hourlyRateFen = requireNonNegativeSafeInteger(input.hourlyRateFen, '小时租金');
  const referenceValueFen = requireNonNegativeSafeInteger(input.referenceValueFen, '冻结产品价值');
  const billedHours = durationMs === 0 ? 0 : Math.ceil(durationMs / 3_600_000);
  if (billedHours === 0 || hourlyRateFen === 0 || referenceValueFen === 0) return { durationMs, billedHours, rentFen: 0, reminderReached: false };
  const hoursBeforeCap = Math.floor(referenceValueFen / hourlyRateFen);
  const rentFen = billedHours > hoursBeforeCap ? referenceValueFen : billedHours * hourlyRateFen;
  return { durationMs, billedHours, rentFen, reminderReached: rentFen >= HOUR_REMINDER_FEN };
}

export interface DailyRentInput {
  handoverAtMs: number;
  effectiveReturnAtMs: number;
  dailyRateFen: number;
  plannedDays: number;
  minimumDays?: number;
  allowEarlyReduction?: boolean;
  rentalVoucherFen?: number;
  cashRentPaidFen?: number;
}

export interface DailyRentResult {
  actualDays: number;
  chargeableDays: number;
  grossRentFen: number;
  voucherAppliedFen: number;
  finalCashRentFen: number;
  cashRefundFen: number;
  cashSupplementFen: number;
}

export function calculateDailyRent(input: DailyRentInput): DailyRentResult {
  const durationMs = Math.max(1, input.effectiveReturnAtMs - input.handoverAtMs);
  const actualDays = Math.max(1, Math.ceil(durationMs / DAY_MS));
  const minimumDays = Math.max(1, Math.floor(input.minimumDays ?? 1));
  const plannedDays = Math.max(minimumDays, Math.floor(input.plannedDays));
  const chargeableDays = input.allowEarlyReduction === false ? plannedDays : Math.max(minimumDays, actualDays);
  const grossRentFen = chargeableDays * Math.max(0, Math.floor(input.dailyRateFen));
  const voucherAppliedFen = Math.min(grossRentFen, Math.max(0, Math.floor(input.rentalVoucherFen ?? 0)));
  const finalCashRentFen = grossRentFen - voucherAppliedFen;
  const cashRentPaidFen = Math.max(0, Math.floor(input.cashRentPaidFen ?? 0));
  return {
    actualDays,
    chargeableDays,
    grossRentFen,
    voucherAppliedFen,
    finalCashRentFen,
    cashRefundFen: Math.max(0, cashRentPaidFen - finalCashRentFen),
    cashSupplementFen: Math.max(0, finalCashRentFen - cashRentPaidFen),
  };
}

export interface DepositQuoteInput {
  mode: RentalMode;
  configuredDepositFen: number;
  fullDepositSelected: boolean;
  diamondPointsReserved: number;
  configuredDiamondPoints: number;
  configuredDiamondWaiverFen: number;
}

export interface DepositQuote {
  cashDepositFen: number;
  diamondPointsApplied: number;
  diamondWaiverFen: number;
}

export function calculateDepositQuote(input: DepositQuoteInput): DepositQuote {
  const configuredDepositFen = requireNonNegativeSafeInteger(input.configuredDepositFen, '现金押金');
  const configuredWaiverFen = Math.min(DIAMOND_MAX_WAIVER_FEN, requireNonNegativeSafeInteger(input.configuredDiamondWaiverFen, '粉钻免押额度'));
  const configuredPoints = requireNonNegativeSafeInteger(input.configuredDiamondPoints, '配置粉钻数量');
  const requestedPoints = requireNonNegativeSafeInteger(input.diamondPointsReserved, '预留粉钻数量');
  if (input.mode === 'hourly') return { cashDepositFen: HOUR_DEPOSIT_FEN, diamondPointsApplied: 0, diamondWaiverFen: 0 };
  if (input.fullDepositSelected) return { cashDepositFen: FULL_DEPOSIT_FEN, diamondPointsApplied: 0, diamondWaiverFen: 0 };
  const diamondPointsApplied = Math.min(configuredPoints, requestedPoints);
  const proportionalWaiverFen = configuredPoints === 0 ? 0 : Number((BigInt(configuredWaiverFen) * BigInt(diamondPointsApplied)) / BigInt(configuredPoints));
  const diamondWaiverFen = Math.min(configuredWaiverFen, proportionalWaiverFen);
  return {
    cashDepositFen: Math.max(0, configuredDepositFen - diamondWaiverFen),
    diamondPointsApplied,
    diamondWaiverFen,
  };
}

export interface LiabilityInput {
  actualLossFen: number;
  insuranceEligibleFen: number;
  insurancePaidFen: number;
  cashDepositHeldFen: number;
}

export interface LiabilityDistribution {
  confirmedLossFen: number;
  insuranceAppliedFen: number;
  depositDeductionFen: number;
  supplementFen: number;
  depositReturnFen: number;
  lessorCompensationFen: number;
}

export function distributeLiability(input: LiabilityInput): LiabilityDistribution {
  const confirmedLossFen = Math.max(0, Math.floor(input.actualLossFen));
  const insuranceAppliedFen = Math.min(
    confirmedLossFen,
    Math.max(0, Math.floor(input.insuranceEligibleFen)),
    Math.max(0, Math.floor(input.insurancePaidFen)),
  );
  const remainingAfterInsurance = confirmedLossFen - insuranceAppliedFen;
  const depositHeld = Math.max(0, Math.floor(input.cashDepositHeldFen));
  const depositDeductionFen = Math.min(depositHeld, remainingAfterInsurance);
  const supplementFen = Math.max(0, remainingAfterInsurance - depositDeductionFen);
  return {
    confirmedLossFen,
    insuranceAppliedFen,
    depositDeductionFen,
    supplementFen,
    depositReturnFen: Math.max(0, depositHeld - depositDeductionFen),
    lessorCompensationFen: insuranceAppliedFen + depositDeductionFen + supplementFen,
  };
}

export interface CloseAxes {
  physicalClosed: boolean;
  acceptanceClosed: boolean;
  dispute: 'none' | 'resolved' | 'open';
  appeal: AppealAxis;
  payment: ResultAxis;
  depositReturn: 'not_applicable' | 'not_started' | 'processing' | 'unknown' | ResultAxis;
  refund: 'not_applicable' | 'not_started' | 'processing' | 'unknown' | ResultAxis;
  supplement: 'none' | 'succeeded' | 'pending' | 'confirming' | 'unknown' | 'failed';
  settlement: 'not_applicable' | 'not_started' | 'pending' | 'processing' | 'unknown' | ResultAxis;
  insuranceClaim: InsuranceClaimAxis;
  externalConfirming: boolean;
}

export interface CloseDecision { closable: boolean; blockers: string[] }

export function evaluateClose(axes: CloseAxes): CloseDecision {
  const blockers: string[] = [];
  if (!axes.physicalClosed) blockers.push('实物交接尚未终结');
  if (!axes.acceptanceClosed) blockers.push('验机尚未终结');
  if (axes.dispute === 'open') blockers.push('售后处理中');
  if (axes.appeal === 'open' || axes.appeal === 'available') blockers.push('申诉尚未终结');
  if (axes.payment !== 'succeeded') blockers.push('支付尚未确认');
  if (!['not_applicable', 'succeeded'].includes(axes.depositReturn)) blockers.push('押金退回尚未完成');
  if (!['not_applicable', 'succeeded'].includes(axes.refund)) blockers.push('退款尚未完成');
  if (!['none', 'succeeded'].includes(axes.supplement)) blockers.push('补缴尚未完成');
  if (!['not_applicable', 'succeeded'].includes(axes.settlement)) blockers.push('出租方结算尚未完成');
  if (!['not_applicable', 'not_started', 'succeeded'].includes(axes.insuranceClaim)) blockers.push('安心保赔付尚未完成');
  if (axes.externalConfirming) blockers.push('外部结果确认中');
  return { closable: blockers.length === 0, blockers };
}

export function allowedDeliveryMethods(supplyType: SupplyType): ReadonlyArray<'cabinet' | 'express' | 'runner' | 'meet'> {
  if (supplyType === 'cabinet') return ['cabinet'];
  if (supplyType === 'store') return ['meet', 'express', 'runner'];
  return ['express', 'runner', 'meet'];
}

export function paymentDeadline(createdAtMs: number): number {
  return createdAtMs + PAYMENT_WINDOW_MS;
}

export function canReleaseReservation(payment: ResultAxis): boolean {
  return payment === 'idle' || payment === 'failed';
}
