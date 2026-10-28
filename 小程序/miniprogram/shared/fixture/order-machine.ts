import type { AppealAxis, ApprovalAxis, DiamondAxis, InsuranceClaimAxis, RentalMode, ReservationAxis, SupplyType, VoucherAxis } from './lifecycle-rules';

export type { AppealAxis, ApprovalAxis, DiamondAxis, InsuranceClaimAxis, RentalMode, ReservationAxis, SupplyType, VoucherAxis } from './lifecycle-rules';

export type DeviceSource = 'platform' | 'personal';
export type OrderKind = 'platform' | 'c2c';
export type OrderActor = 'tenant' | 'lessor' | 'platformMock' | 'cabinetCredential';
export type DeliveryMethod = 'cabinet' | 'express' | 'runner' | 'meet';
// `diamond`/`credit`/`member` remain readable only for legacy local orders; new drafts expose cash/full/WeChat waiver.
export type DepositPlan = 'cash' | 'full' | 'wechat' | 'diamond' | 'credit' | 'member';
export type WechatWaiverStatus = 'not_applicable' | 'confirming' | 'confirmed' | 'rejected';
export type RiskResult = 'not_applicable' | 'not_queried' | 'pass' | 'reject' | 'abnormal';

export type OrderStatus =
  | 'pending_identity'
  | 'pending_payment'
  | 'pending_review'
  | 'refunding'
  | 'ready_handover'
  | 'renting'
  | 'overdue'
  | 'returning'
  | 'settling'
  | 'supplement'
  | 'dispute'
  | 'completed'
  | 'cancelled';

export type OrderMainStatus = 'pending' | 'renting' | 'returning' | 'after_sales' | 'ended';
export type RequirementStatus = 'required' | 'not_required';

export const MAIN_STATUS_LABELS: Record<OrderMainStatus, string> = {
  pending: '待处理',
  renting: '租赁中',
  returning: '归还中',
  after_sales: '售后中',
  ended: '已结束',
};

export type FulfillmentStatus =
  | 'pending_handover'
  | 'delivered'
  | 'return_preparing'
  | 'return_in_transit'
  | 'return_received'
  | 'completed'
  | 'failed';

export type PickupStatus =
  | 'not_started'
  | 'awaiting_dispatch'
  | 'shipped'
  | 'in_transit'
  | 'runner_delivering'
  | 'cabinet_ready'
  | 'cabinet_opening'
  | 'cabinet_open'
  | 'cabinet_closed'
  | 'detecting'
  | 'waiting_receipt'
  | 'awaiting_meet'
  | 'completed'
  | 'unknown'
  | 'failed';

export type ReturnStatus =
  | 'not_started'
  | 'evidence_pending'
  | 'cabinet_assigned'
  | 'cabinet_opening'
  | 'cabinet_open'
  | 'cabinet_closed'
  | 'detecting'
  | 'waiting_receipt'
  | 'received'
  | 'success'
  | 'unknown'
  | 'failed';

export type AcceptanceStatus = 'not_started' | 'pending_receipt' | 'pending_inspection' | 'passed' | 'abnormal';
export type PaymentStatus = 'unpaid' | 'processing' | 'confirming' | 'unknown' | 'paid' | 'failed';
export type DepositStatus = 'waived' | 'held' | 'releasable' | 'partially_deducted' | 'deducted' | 'frozen' | 'released';
export type DepositReturnStatus = 'not_applicable' | 'not_started' | 'processing' | 'confirming' | 'unknown' | 'succeeded' | 'failed';
export type DisputeStatus = 'none' | 'evidence_pending' | 'under_review' | 'ruled' | 'resolved';
export type SupplementStatus = 'none' | 'pending' | 'confirming' | 'unknown' | 'paid' | 'failed';
export type RenewalStatus = 'idle' | 'pending_approval' | 'pending_payment' | 'confirming' | 'unknown' | 'paid' | 'failed' | 'rejected' | 'expired';
export type CancellationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type RefundStatus = 'not_applicable' | 'not_started' | 'processing' | 'confirming' | 'unknown' | 'succeeded' | 'failed';
export type SettlementStatus = 'not_applicable' | 'not_started' | 'pending' | 'processing' | 'confirming' | 'unknown' | 'succeeded' | 'failed';
export type ExternalResultStatus = 'idle' | 'pending' | 'succeeded' | 'failed' | 'unknown';
export type DisputeRuling = 'none' | 'normal' | 'tenant_liability' | 'lessor_liability' | 'insufficient_evidence';
export type MeetingConfirmationStatus = 'pending' | 'tenant_confirmed' | 'lessor_confirmed' | 'both_confirmed';
export type DisputeDecision = 'none' | 'awaiting_tenant' | 'tenant_agreed' | 'awaiting_lessor' | 'lessor_accepted' | 'platform_review' | 'platform_final';
export type ScenarioKind = 'normal' | 'payment_failure' | 'wechat_failure' | 'cabinet_failure' | 'cabinet_occupied' | 'cabinet_timeout' | 'cabinet_unknown' | 'renewal_failure' | 'damage' | 'missing' | 'lost' | 'lessor_fault' | 'evidence_insufficient';

export interface OrderAxes {
  order: OrderStatus;
  fulfillment: FulfillmentStatus;
  pickup: PickupStatus;
  returning: ReturnStatus;
  acceptance: AcceptanceStatus;
  payment: PaymentStatus;
  deposit: DepositStatus;
  depositReturn: DepositReturnStatus;
  dispute: DisputeStatus;
  supplement: SupplementStatus;
  renewal: RenewalStatus;
  cancellation: CancellationStatus;
  meeting: MeetingConfirmationStatus;
  refund: RefundStatus;
  settlement: SettlementStatus;
  approval: ApprovalAxis;
  reservation: ReservationAxis;
  appeal: AppealAxis;
  diamonds: DiamondAxis;
  rentalVoucher: VoucherAxis;
  insuranceVoucher: VoucherAxis;
  guardVoucher?: VoucherAxis;
  insuranceClaim: InsuranceClaimAxis;
  wechatWaiver: WechatWaiverStatus;
  risk: RiskResult;
}

export interface ReturnEvidence {
  imageCount: number;
  videoCount: number;
  disputeEvidenceCount: number;
  imagePaths: string[];
  videoPaths: string[];
  disputePaths: string[];
  disputeVideoPaths?: string[];
  tenantDisputePaths: string[];
  lessorDisputePaths: string[];
}

export interface DisputeEvidenceSubmission {
  amountFen?: number;
  id: string;
  actor: 'tenant' | 'lessor';
  kind: 'initial' | 'supplement';
  description: string;
  imagePaths: string[];
  videoPaths: string[];
  createdAt: string;
}

export interface IdentityInfo {
  name: string;
  phone: string;
  idNumber: string;
}

export interface CabinetReturn {
  id?: string;
  name: string;
  address: string;
  code: string;
  doorOpened: boolean;
  closeAcknowledged: boolean;
  devicePlaced: boolean;
  chargingConnected: boolean;
  chargePhotoPaths: string[];
  openMethod?: 'scan' | 'code';
}

export interface CabinetPickup {
  id?: string;
  name: string;
  address: string;
  code: string;
  grid: string;
  doorOpened: boolean;
  closeAcknowledged: boolean;
  openMethod?: 'scan' | 'code';
}

export interface PickupContact {
  name: string;
  phone: string;
  address: string;
}

export interface PickupFulfillment {
  contact: PickupContact;
  cabinet: CabinetPickup | null;
  carrier: string;
  trackingNumber: string;
  runnerName: string;
  runnerPhone: string;
  estimatedArrival: string;
  meetAddress: string;
  meetTime: string;
  actualHandoverAt: string | null;
  lessorReady: boolean;
  dispatchProofPaths?: string[];
  dispatchNote?: string;
}

export interface RiskReport {
  reportId: string;
  result: Exclude<RiskResult, 'not_applicable' | 'not_queried'>;
  queriedAt: string;
  subject: { name: string; idNumber: string; phone: string };
  score: number;
  summary: string;
}

export interface ReturnDeliverySnapshot {
  method: DeliveryMethod;
  carrier: string;
  trackingNumber: string;
  locationId: string;
  locationAddress: string;
  proofPaths: string[];
  imagePaths?: string[];
  videoPaths?: string[];
  runnerInfoPaths?: string[];
  note: string;
  submittedAt: string;
}

export interface OrderAmounts {
  rentFen: number;
  rentPayableFen?: number;
  diamondRentDeductionFen?: number;
  diamondRentPoints?: number;
  diamondAfterSalesDeductionFen?: number;
  diamondAfterSalesPoints?: number;
  guardFen?: number;
  guardGrossFen?: number;
  guardVoucherFen?: number;
  deliveryFeeFen?: number;
  totalFen?: number;
  depositFen: number;
  depositDeductedFen: number;
  depositReturnFen: number;
  supplementFen: number;
  renewalFen: number;
  refundFen: number;
  settlementFen: number;
  directChargeFen?: number;
  rentalVoucherFen?: number;
  finalGrossRentFen?: number;
  finalCashRentFen?: number;
  cashRentPaidFen?: number;
  cashRentRefundFen?: number;
  cashRentSupplementFen?: number;
  diamondWaiverFen?: number;
  insuranceFen?: number;
  insuranceVoucherFen?: number;
  insurancePaidFen?: number;
  confirmedLossFen?: number;
  occupancyFeeFen?: number;
}

export interface OrderProductSnapshot {
  deviceId: string;
  spuId?: string;
  skuId?: string;
  name: string;
  model: string;
  source: DeviceSource;
  lessorUserId: string;
  pricePerDayFen: number;
  depositFen: number;
  deliveryMethods: DeliveryMethod[];
  capturedAt: string;
  supplyType?: SupplyType;
  rentalMode?: RentalMode;
  hourlyRateFen?: number;
  referenceValueFen?: number;
  storeHours?: string;
  minimumDays?: number;
  allowEarlyReduction?: boolean;
  stock?: number;
  depositPlans?: DepositPlan[];
  assetIds?: string[];
  allowRenewal?: boolean;
  configVersion?: string;
  rentalRule?: string;
  renewalPricePerDayFen?: number;
}

export interface BillingCredential {
  paymentConfirmedAt: string;
  billingStartedAt: string;
  hourlyRateFen: number;
  referenceValueFen: number;
  contractVersion: string;
  orderId: string;
}

export interface InsuranceSnapshot {
  enabled: boolean;
  scope: string;
  exclusions: string;
  maximumFen: number;
  deductibleFen: number;
  effectiveAt: string;
  expiresAt: string;
  claimConditions: string;
  evidenceRequirements: string;
  cancellationRule: string;
  provider: string;
  contact: string;
}

export interface OrderDeliverySnapshot {
  method: DeliveryMethod;
  address: string;
  originAddress?: string;
  contactName: string;
  contactPhone: string;
  providerContact?: string;
  providerPhone?: string;
  feeFen: number;
  rule: string;
  serviceDescription?: string;
  meetingTime?: string;
  capturedAt: string;
}

export interface RentalOrder {
  serviceRule?: { version: string; contract: number; face: number; risk: number };
  id: string;
  diagnosticFixture?: boolean;
  tenantUserId: string;
  lessorUserId: string;
  platformSubjectId: string;
  deviceId: string;
  kind: OrderKind;
  supplyType?: SupplyType;
  rentalMode?: RentalMode;
  days: number;
  pickupMethod: DeliveryMethod;
  returnMethod: DeliveryMethod | null;
  depositPlan: DepositPlan;
  guard: boolean;
  region: string;
  createdAt: string;
  plannedStartAt: string;
  plannedEndAt: string;
  startAt: string;
  endAt: string;
  signedAt: string | null;
  contractId: string;
  identityRequirement: RequirementStatus;
  contractRequirement: RequirementStatus;
  identityVerified: boolean;
  contractSigned: boolean;
  identityInfo: IdentityInfo;
  scenario: ScenarioKind;
  axes: OrderAxes;
  evidence: ReturnEvidence;
  pickup: PickupFulfillment;
  returnDetails: string;
  returnSnapshot?: ReturnDeliverySnapshot;
  cabinet: CabinetReturn | null;
  tenantMeetConfirmed: boolean;
  lessorMeetConfirmed: boolean;
  issueCategory: string;
  issueDescription: string;
  disputeRuling: DisputeRuling;
  disputeDecision?: DisputeDecision;
  disputeProposal?: { actor: 'lessor' | 'tenant'; amountFen: number; note: string; imagePaths: string[]; videoPaths: string[]; createdAt: string } | null;
  disputeSubmissions?: DisputeEvidenceSubmission[];
  disputeFinalAmountFen?: number;
  disputeFinalizedAt?: string | null;
  createIdempotencyKey?: string;
  productSnapshot?: OrderProductSnapshot;
  deliverySnapshot?: OrderDeliverySnapshot;
  external: {
    pickupCabinet: ExternalResultStatus;
    returnCabinet: ExternalResultStatus;
  };
  amounts: OrderAmounts;
  paymentDeadlineAt?: string;
  approvalDeadlineAt?: string | null;
  approvalActorId?: string;
  approvalDecidedAt?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationDecidedAt?: string | null;
  cancellationOriginOrder?: OrderStatus | null;
  closureReason?: 'user_cancelled' | 'refund' | 'rejected' | 'unfulfillable' | 'expired';
  chatEnabled?: boolean;
  reservationId?: string | null;
  billingCredential?: BillingCredential | null;
  effectiveReturnAt?: string | null;
  provisionalReturnAt?: string | null;
  returnCabinetClosedAt?: string | null;
  returnResultQueries?: number;
  inspectionDeadlineAt?: string | null;
  settlementRequestedAt?: string | null;
  settlementQueryCount?: number;
  appealDeadlineAt?: string | null;
  appealCountByUser?: Record<string, number>;
  appealFinancialSnapshot?: {
    deposit: DepositStatus;
    depositReturn: DepositReturnStatus;
    supplement: SupplementStatus;
    settlement: SettlementStatus;
    refund: RefundStatus;
  } | null;
  guardSnapshot?: { purchased: boolean; priceFen: number; priority: boolean; proactiveFollowUpUsed: boolean; grossFeeFen?: number; discountFen?: number; netFeeFen?: number; couponRuleVersion?: string };
  insuranceSnapshot?: InsuranceSnapshot | null;
  rentalVoucherId?: string | null;
  insuranceVoucherId?: string | null;
  guardVoucherId?: string | null;
  riskReport?: RiskReport | null;
  recoveryRequired?: { code: 'legacy_appeal_funds' | 'legacy_reservation'; sourceVersion: string; reason: string; detectedAt: string } | null;
}

export type OrderAction =
  | 'approve_application'
  | 'reject_application'
  | 'expire_application'
  | 'withdraw_application'
  | 'expire_payment_window'
  | 'query_payment_result'
  | 'complete_wechat_waiver'
  | 'verify_wechat_waiver'
  | 'query_risk_report'
  | 'sign_contract'
  | 'complete_requirements'
  | 'pay_order'
  | 'complete_payment'
  | 'platform_dispatch'
  | 'platform_advance_delivery'
  | 'lessor_dispatch'
  | 'lessor_prepare_meet'
  | 'open_pickup_cabinet'
  | 'receive_pickup_cabinet_open_result'
  | 'retry_pickup_cabinet'
  | 'acknowledge_pickup_cabinet_opened'
  | 'confirm_pickup_cabinet_closed'
  | 'run_pickup_cabinet_detection'
  | 'query_pickup_cabinet_result'
  | 'confirm_delivery_received'
  | 'confirm_pickup_meet'
  | 'cancel_order'
  | 'withdraw_cancellation'
  | 'approve_cancellation'
  | 'reject_cancellation'
  | 'add_return_image'
  | 'add_return_video'
  | 'submit_return'
  | 'open_cabinet'
  | 'receive_cabinet_open_result'
  | 'retry_return_cabinet'
  | 'acknowledge_cabinet_opened'
  | 'add_return_charge_photo'
  | 'remove_return_charge_photo'
  | 'confirm_cabinet_closed'
  | 'run_cabinet_detection'
  | 'query_return_cabinet_result'
  | 'manual_recover'
  | 'platform_receive'
  | 'platform_inspect'
  | 'lessor_receive'
  | 'lessor_receive_clear'
  | 'lessor_inspect'
  | 'confirm_meet'
  | 'cancel_meet_confirmation'
  | 'open_dispute'
  | 'report_issue'
  | 'submit_dispute'
  | 'accept_dispute'
  | 'object_dispute'
  | 'accept_tenant_proposal'
  | 'reject_tenant_proposal'
  | 'add_dispute_evidence'
  | 'submit_dispute_evidence'
  | 'platform_review_dispute'
  | 'platform_resolve_dispute'
  | 'open_appeal'
  | 'resolve_appeal'
  | 'start_deposit_return'
  | 'complete_deposit_return'
  | 'query_deposit_return'
  | 'retry_deposit_return'
  | 'complete_waived_settlement'
  | 'start_refund'
  | 'complete_refund'
  | 'query_refund_result'
  | 'retry_refund'
  | 'start_settlement'
  | 'complete_settlement'
  | 'query_settlement_result'
  | 'retry_settlement'
  | 'pay_supplement'
  | 'query_supplement_result'
  | 'retry_supplement'
  | 'use_diamond_after_sales'
  | 'request_renewal'
  | 'approve_renewal'
  | 'reject_renewal'
  | 'pay_renewal'
  | 'query_renewal_result'
  | 'retry_renewal'
  | 'complete_renewal_payment'
  | 'retry_insurance_claim'
  | 'complete_insurance_claim'
  | 'renew';

export interface OrderActionPayload {
  idempotencyKey?: string;
  method?: DeliveryMethod;
  details?: string;
  issueCategory?: string;
  description?: string;
  days?: number;
  paths?: string[];
  imagePaths?: string[];
  videoPaths?: string[];
  runnerInfoPaths?: string[];
  ruling?: DisputeRuling;
  cabinet?: { id: string; name: string; address: string };
  paymentOutcome?: 'success' | 'failure' | 'processing' | 'confirming' | 'unknown';
  paymentMethod?: 'cash' | 'diamond';
  /** Injected by the Mock command boundary; pages cannot choose the balance. */
  diamondAvailablePoints?: number;
  meetingAddress?: string;
  meetingTime?: string;
  carrier?: string;
  trackingNumber?: string;
  returnLocationId?: string;
  returnLocationAddress?: string;
  occurredAt?: string;
  externalResult?: 'success' | 'failure' | 'confirming' | 'unknown';
  actualLossFen?: number;
  insurancePaidFen?: number;
  devicePlaced?: boolean;
  chargingConnected?: boolean;
  openMode?: 'scan' | 'code';
  /** Scanned or user-entered cabinet credential supplied by the mini-program. */
  cabinetCode?: string;
  riskResult?: Exclude<RiskResult, 'not_applicable' | 'not_queried'>;
  proposalAmountFen?: number;
  proposalNote?: string;
}

export interface OrderActionResult {
  ok: boolean;
  order: RentalOrder;
  reason: string;
}

export function cloneOrder(order: RentalOrder): RentalOrder {
  return {
    ...order,
    axes: { ...order.axes },
    evidence: {
      ...order.evidence,
      imagePaths: [...order.evidence.imagePaths],
      videoPaths: [...order.evidence.videoPaths],
      disputePaths: [...order.evidence.disputePaths],
      ...(order.evidence.disputeVideoPaths ? { disputeVideoPaths: [...order.evidence.disputeVideoPaths] } : {}),
      tenantDisputePaths: [...order.evidence.tenantDisputePaths],
      lessorDisputePaths: [...order.evidence.lessorDisputePaths],
    },
    identityInfo: { ...order.identityInfo },
    pickup: {
      ...order.pickup,
      contact: { ...order.pickup.contact },
      cabinet: order.pickup.cabinet ? { ...order.pickup.cabinet } : null,
      ...(order.pickup.dispatchProofPaths ? { dispatchProofPaths: [...order.pickup.dispatchProofPaths] } : {}),
    },
    cabinet: order.cabinet ? { ...order.cabinet, chargePhotoPaths: [...(order.cabinet.chargePhotoPaths ?? [])] } : null,
    ...(order.returnSnapshot ? {
      returnSnapshot: {
        ...order.returnSnapshot,
        proofPaths: [...(order.returnSnapshot.proofPaths ?? [])],
        ...(order.returnSnapshot.imagePaths ? { imagePaths: [...order.returnSnapshot.imagePaths] } : {}),
        ...(order.returnSnapshot.videoPaths ? { videoPaths: [...order.returnSnapshot.videoPaths] } : {}),
        ...(order.returnSnapshot.runnerInfoPaths ? { runnerInfoPaths: [...order.returnSnapshot.runnerInfoPaths] } : {}),
      },
    } : {}),
    external: { ...order.external },
    amounts: { ...order.amounts },
    ...(order.productSnapshot ? {
      productSnapshot: {
        ...order.productSnapshot,
        deliveryMethods: [...order.productSnapshot.deliveryMethods],
        ...(order.productSnapshot.depositPlans ? { depositPlans: [...order.productSnapshot.depositPlans] } : {}),
        ...(order.productSnapshot.assetIds ? { assetIds: [...order.productSnapshot.assetIds] } : {}),
      },
    } : {}),
    ...(order.deliverySnapshot ? { deliverySnapshot: { ...order.deliverySnapshot } } : {}),
    ...(order.appealFinancialSnapshot ? { appealFinancialSnapshot: { ...order.appealFinancialSnapshot } } : {}),
    ...(order.disputeProposal ? { disputeProposal: { ...order.disputeProposal, imagePaths: [...order.disputeProposal.imagePaths], videoPaths: [...order.disputeProposal.videoPaths] } } : {}),
    ...(order.disputeSubmissions ? { disputeSubmissions: order.disputeSubmissions.map((submission) => ({ ...submission, imagePaths: [...submission.imagePaths], videoPaths: [...submission.videoPaths] })) } : {}),
    ...(order.riskReport ? { riskReport: { ...order.riskReport, subject: { ...order.riskReport.subject } } } : {}),
  };
}

function addDays(dateTime: string, days: number): string {
  const [datePart = '2026-08-26', timePart = '10:00'] = dateTime.split(' ');
  const [year = 2026, month = 8, day = 26] = datePart.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${timePart}`;
}

export function previewRenewalEndAt(order: RentalOrder, days: number): string {
  return Number.isInteger(days) && days > 0 ? addDays(order.endAt, days) : order.endAt;
}

export function orderMainStatus(order: RentalOrder): OrderMainStatus {
  if (['completed', 'cancelled'].includes(order.axes.order)) return 'ended';
  const physicalReturn = hasPhysicalReturnFact(order);
  const returnIntent = !['not_started', 'evidence_pending'].includes(order.axes.returning);
  const disputeOpen = isDisputeOpenForPresentation(order);
  const resolvedAbnormalAfterSales = order.axes.dispute === 'resolved'
    && (order.kind !== 'c2c' || hasC2CInitialSubmission(order))
    && physicalReturn
    && order.axes.acceptance === 'abnormal'
    && ['settling', 'supplement', 'refunding', 'dispute'].includes(order.axes.order);
  // A legacy snapshot may have promoted a pending loss to `supplement` before
  // any receiver acknowledged the device. Keep the five-state projection on
  // the real renting/returning path until a physical return fact exists.
  if (!physicalReturn && order.axes.order === 'supplement' && order.axes.supplement !== 'paid') return returnIntent ? 'returning' : 'renting';
  if (!physicalReturn && order.axes.order === 'dispute' && order.axes.dispute === 'resolved') return returnIntent ? 'returning' : 'renting';
  const abnormalSupplement = order.axes.order === 'supplement'
    && (order.kind !== 'c2c' || hasC2CInitialSubmission(order))
    && (order.axes.acceptance === 'abnormal' || order.axes.dispute !== 'none' || (order.amounts.confirmedLossFen ?? 0) > 0);
  const disputeOrder = order.axes.order === 'dispute' && (order.kind !== 'c2c' || hasC2CInitialSubmission(order));
  if (order.axes.cancellation === 'pending' || order.axes.appeal !== 'none' || disputeOpen || resolvedAbnormalAfterSales || abnormalSupplement || order.axes.order === 'refunding' || disputeOrder) return 'after_sales';
  if (isC2CPreSubmission(order)) return returnIntent ? 'returning' : 'renting';
  if (['returning', 'settling', 'supplement'].includes(order.axes.order)) return 'returning';
  if (['ready_handover', 'renting', 'overdue'].includes(order.axes.order)) return 'renting';
  return 'pending';
}


/**
 * Parse local business timestamps produced by the mini-program as well as ISO
 * timestamps persisted by the mock store. `toLocaleString('zh-CN')` is not
 * guaranteed to zero-pad month/day, and Safari/Android do not consistently
 * parse that form. Keep one explicit parser for every billing/expiry path.
 */
export function parseDateTimeMs(value?: string | null): number {
  if (!value) return Number.NaN;
  const raw = value.trim();
  const normalized = raw.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\//g, '-');
  // `toLocaleString('zh-CN')` on different mini-program runtimes may emit
  // `2026-8-28 18:56`, `2026-8-28 18:56:00`, or the occasionally observed
  // trailing-colon form `2026-8-28 18:56:`. Parse all of them explicitly;
  // relying on Date.parse makes the billing clock platform dependent.
  const localMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?:?)?$/);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4] ?? 0);
    const minute = Number(localMatch[5] ?? 0);
    const second = Number(localMatch[6] ?? 0);
    const millisecond = Number((localMatch[7] ?? '').padEnd(3, '0') || 0);
    if (hour > 23 || minute > 59 || second > 59 || millisecond > 999) return Number.NaN;
    const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute && date.getSeconds() === second) return date.getTime();
    return Number.NaN;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Whether the order contains an actual return/receipt fact rather than only a
 * submitted return intent or an unrelated after-sales case.  This distinction
 * is used by both persistence repair and page projections: submitting a return
 * must not end billing, release the deposit, or display “已归还” before the
 * receiving channel has acknowledged the device.
 */
export function hasPhysicalReturnFact(order: RentalOrder): boolean {
  const returningFact = ['received', 'success'].includes(order.axes.returning);
  // `return_received` by itself is not enough: older builds wrote that
  // fulfillment value when the tenant only submitted a return intent. Require
  // the independent returning axis as corroboration; a terminal completed
  // record is the one safe legacy exception.
  const fulfillmentFact = ['return_received', 'completed'].includes(order.axes.fulfillment)
    && (returningFact || order.axes.order === 'completed');
  const acceptanceFact = ['passed', 'abnormal'].includes(order.axes.acceptance) && (returningFact || fulfillmentFact);
  const inspectionReceiptFact = order.axes.acceptance === 'pending_inspection' && (returningFact || fulfillmentFact);
  return returningFact || fulfillmentFact || acceptanceFact || inspectionReceiptFact;
}

/**
 * A C2C after-sales case is visible to both parties only after the lessor's
 * initial proposal has been formally submitted. A proposal is the durable
 * handoff; an issue-entry tap or a page draft is not a submission.
 */
export function hasC2CInitialSubmission(order: RentalOrder): boolean {
  if (order.kind !== 'c2c') return false;
  return order.disputeProposal?.actor === 'lessor'
    || (order.disputeSubmissions ?? []).some((submission) => submission.actor === 'lessor' && submission.kind === 'initial');
}

/**
 * Detect the legacy/incomplete C2C shape that must not project as after-sales.
 * It may still be opened by the lessor to complete the private first proposal,
 * but it is not a tenant-visible case until that proposal is submitted.
 */
export function isC2CPreSubmission(order: RentalOrder): boolean {
  if (order.kind !== 'c2c' || hasC2CInitialSubmission(order) || ['completed', 'cancelled'].includes(order.axes.order)) return false;
  if (['evidence_pending', 'under_review', 'ruled'].includes(order.axes.dispute) || order.axes.order === 'dispute') return true;
  return order.axes.order === 'returning' && hasPhysicalReturnFact(order) && order.axes.acceptance === 'abnormal';
}

/** Receipt is only recorded once a normal confirmation or valid abnormal proposal is submitted. */
function canConfirmC2CReturnReceipt(order: RentalOrder): boolean {
  return order.kind === 'c2c' && order.axes.order === 'returning' && order.axes.returning === 'waiting_receipt'
    && (order.returnMethod === 'express' || order.returnMethod === 'runner'
      || (order.returnMethod === 'meet' && order.tenantMeetConfirmed === true && !order.lessorMeetConfirmed));
}

/** The lessor may enter the private first-proposal form at this handoff. */
export function isC2CInitialProposalEntryAllowed(order: RentalOrder): boolean {
  if (order.kind !== 'c2c' || hasC2CInitialSubmission(order) || !['none', 'platform_review'].includes(order.disputeDecision ?? 'none')) return false;
  if (canConfirmC2CReturnReceipt(order)) return true;
  if (['completed', 'cancelled'].includes(order.axes.order) || !hasPhysicalReturnFact(order)) return false;
  return (order.axes.order === 'returning' && ['pending_inspection', 'abnormal'].includes(order.axes.acceptance))
    || order.axes.order === 'dispute'
    || ['evidence_pending', 'under_review', 'ruled'].includes(order.axes.dispute);
}

/** Shared projection guard used by lists, detail pages and status copies. */
export function isDisputeOpenForPresentation(order: RentalOrder): boolean {
  return ['evidence_pending', 'under_review', 'ruled'].includes(order.axes.dispute)
    && !isC2CPreSubmission(order);
}
























/** Only an unissued legacy normal acceptance can have its erroneous quote replaced. */




export function orderStatusLabel(order: RentalOrder, actor?: OrderActor): string {
  if (order.axes.cancellation === 'pending') return '取消申请处理中';
  if (order.axes.order === 'supplement' && order.axes.supplement !== 'paid' && !hasPhysicalReturnFact(order)) {
    return !['not_started', 'evidence_pending'].includes(order.axes.returning) ? '归还中' : '租赁中';
  }
  if (order.axes.order === 'pending_review' || (order.axes.approval === 'pending' && order.axes.payment === 'paid')) return order.supplyType === 'personal' ? '待出租方确认' : '待审核';
  if (order.axes.order === 'refunding') return order.axes.refund === 'confirming' || order.axes.depositReturn === 'confirming' ? '退款确认中' : '退款处理中';
  if (order.axes.payment === 'unknown') return '支付结果未知';
  if (order.axes.payment === 'confirming' || order.axes.payment === 'processing') return '支付确认中';
  if (order.axes.appeal === 'available') return '申诉期内';
  if (isC2CPreSubmission(order)) return !['not_started', 'evidence_pending'].includes(order.axes.returning) ? '归还中' : '租赁中';
  if (order.axes.appeal === 'open' || isDisputeOpenForPresentation(order)) return '售后处理中';
  if (order.axes.order === 'completed') return order.closureReason && order.closureReason !== 'user_cancelled' ? '已关闭' : '已完成';
  if (order.axes.order === 'cancelled') return order.closureReason === 'user_cancelled' ? '已取消' : '已关闭';
  const labels: Record<OrderStatus, string> = {
    pending_identity: '待支付订单',
    pending_payment: '待支付订单',
    pending_review: '待出租方确认',
    refunding: '退款处理中',
    ready_handover: ['failed', 'unknown'].includes(order.axes.pickup)
      ? '取件异常'
      : order.pickupMethod === 'cabinet'
        ? order.axes.pickup === 'cabinet_opening'
          ? '等待柜机开柜'
          : order.axes.pickup === 'cabinet_open'
            ? '柜门已打开'
            : order.axes.pickup === 'cabinet_closed' || order.axes.pickup === 'detecting'
              ? '柜机检测中'
              : '已支付，待取货'
        : order.axes.pickup === 'awaiting_dispatch'
          ? order.kind === 'c2c' ? '待出租方发货' : '待平台发货'
          : order.pickupMethod === 'meet'
            ? '已支付，待面交'
            : order.axes.pickup === 'runner_delivering'
              ? '跑腿配送中'
              : order.axes.pickup === 'in_transit'
                ? '运输中，待签收'
                : order.axes.pickup === 'shipped'
                  ? '已发货，待运输'
                  : '已支付，待签收',
    renting: '租赁中',
    overdue: '已逾期',
    returning: ['failed', 'unknown'].includes(order.axes.returning)
      ? '归还异常'
      : order.returnMethod === 'cabinet' && order.axes.returning === 'cabinet_opening'
        ? '等待柜机开柜'
      : order.returnMethod === 'cabinet' && order.axes.returning === 'cabinet_open'
        ? '柜门已打开'
        : order.returnMethod === 'cabinet' && (order.axes.returning === 'cabinet_closed' || order.axes.returning === 'detecting')
          ? '柜机确认中'
          : order.axes.acceptance === 'pending_inspection'
            ? order.kind === 'c2c' ? actor === 'lessor' ? '待确认正常并收货' : '待出租方确认收货' : '待平台验机'
            : order.axes.acceptance === 'pending_receipt'
              ? order.kind === 'c2c' ? actor === 'lessor' ? '待确认正常并收货' : '待出租方确认收货' : '待平台收货'
              : order.kind === 'c2c' && order.axes.returning === 'waiting_receipt' ? '待归还交接确认' : '归还中',
    settling: order.axes.depositReturn === 'processing' ? '押金退回中' : '待结算',
    supplement: order.kind === 'c2c' && actor === 'lessor' ? '待承租方补缴' : '待补缴',
    dispute: '纠纷处理中',
    completed: '已完成',
    cancelled: '已关闭',
  };
  return labels[order.axes.order];
}

export function axisLabels(order: RentalOrder, actor?: OrderActor): Record<keyof OrderAxes, string> {
  const fulfillment: Record<FulfillmentStatus, string> = { pending_handover: '待交付', delivered: '租赁履约中', return_preparing: '准备归还', return_in_transit: '归还运输中', return_received: '设备已接收', completed: '履约完成', failed: '履约异常' };
  const pickup: Record<PickupStatus, string> = { not_started: '未开始', awaiting_dispatch: '等待发货', shipped: '已发货', in_transit: '运输中', runner_delivering: '跑腿配送中', cabinet_ready: '待开柜取件', cabinet_opening: '等待柜机开柜结果', cabinet_open: '柜门已打开', cabinet_closed: '等待柜机检测', detecting: '柜机检测中', waiting_receipt: '等待确认收到', awaiting_meet: '等待线下交接', completed: '设备已交付', unknown: '取件结果待确认', failed: '取件异常，请联系客服' };
  const returning: Record<ReturnStatus, string> = { not_started: '未发起', evidence_pending: '待补归还凭证', cabinet_assigned: '已选择归还柜机', cabinet_opening: '等待柜机开柜结果', cabinet_open: '柜门已打开', cabinet_closed: '等待柜机检测', detecting: '柜机检测中', waiting_receipt: '等待接收设备', received: '已收到设备，待验机', success: '归还交接完成', unknown: '归还结果待确认', failed: '归还失败，请联系客服' };
  const acceptance: Record<AcceptanceStatus, string> = { not_started: '未开始', pending_receipt: '等待收货', pending_inspection: '待验机', passed: '验收正常', abnormal: '验收异常' };
  const payment: Record<PaymentStatus, string> = { unpaid: '待支付', processing: '支付处理中', confirming: '支付确认中', unknown: '支付结果未知', paid: '已支付', failed: '支付失败' };
  const deposit: Record<DepositStatus, string> = { waived: '免押，无现金押金', held: '押金已冻结', releasable: '押金可释放', partially_deducted: '部分扣除', deducted: '押金已扣除', frozen: '纠纷冻结中', released: '押金已释放' };
  const depositReturn: Record<DepositReturnStatus, string> = { not_applicable: '无需现金退回', not_started: '尚未退回', processing: '押金退回处理中', confirming: '押金退回确认中', unknown: '押金退回结果未知', succeeded: '押金已到账', failed: '押金退回失败' };
  const dispute: Record<DisputeStatus, string> = { none: '无纠纷', evidence_pending: '待举证', under_review: '平台审核', ruled: '平台已裁决', resolved: '纠纷已解决' };
  const supplement: Record<SupplementStatus, string> = { none: '无需补缴', pending: '待补缴', confirming: '补缴确认中', unknown: '补缴结果未知', paid: '补缴已支付', failed: '补缴失败' };
  const renewal: Record<RenewalStatus, string> = { idle: '未续租', pending_approval: '续租审批中', pending_payment: '续租待支付', confirming: '续租支付确认中', unknown: '续租支付结果未知', paid: '续租支付成功', failed: '续租支付失败', rejected: '续租申请未通过', expired: '续租申请已结束' };
  const cancellation: Record<CancellationStatus, string> = { none: '未申请取消', pending: '取消申请审批中', approved: '取消申请已通过', rejected: '取消申请未通过', withdrawn: '取消申请已撤回' };
  const meeting: Record<MeetingConfirmationStatus, string> = { pending: '双方待确认', tenant_confirmed: '承租方已确认', lessor_confirmed: '出租方已确认', both_confirmed: '双方已确认' };
  const refund: Record<RefundStatus, string> = { not_applicable: '无需退款', not_started: '待退款', processing: '退款处理中', confirming: '退款确认中', unknown: '退款结果未知', succeeded: '退款已到账', failed: '退款异常' };
  const settlement: Record<SettlementStatus, string> = { not_applicable: '无需结算', not_started: '未开始', pending: '待收款', processing: '收款处理中', confirming: '收款确认中', unknown: '收款结果未知', succeeded: '已收款', failed: '收款失败' };
  return {
    order: orderStatusLabel(order, actor),
    fulfillment: fulfillment[order.axes.fulfillment],
    pickup: pickup[order.axes.pickup],
    returning: order.kind === 'platform' && order.axes.acceptance === 'pending_inspection'
      ? order.returnMethod === 'cabinet'
        ? '柜机已检测到设备，待平台验机'
        : order.supplyType === 'store'
          ? '门店已确认收货，待平台验机'
          : '平台已确认收货，待平台验机'
      : order.kind === 'c2c' && ['received', 'success'].includes(order.axes.returning) ? order.axes.acceptance === 'pending_inspection' ? '设备已收到，待出租方确认正常' : '归还交接完成' : returning[order.axes.returning],
    acceptance: order.kind === 'c2c' && order.axes.acceptance === 'pending_inspection' ? '待出租方确认正常' : acceptance[order.axes.acceptance],
    payment: payment[order.axes.payment],
    deposit: deposit[order.axes.deposit],
    depositReturn: depositReturn[order.axes.depositReturn],
    dispute: order.kind === 'c2c' && order.disputeDecision === 'awaiting_tenant' ? '待承租方确认' : order.kind === 'c2c' && order.disputeDecision === 'awaiting_lessor' ? '待出租方处理' : dispute[order.axes.dispute],
    supplement: order.kind === 'c2c' && actor === 'lessor' && order.axes.supplement !== 'none' ? `承租方${supplement[order.axes.supplement]}` : supplement[order.axes.supplement],
    renewal: renewal[order.axes.renewal],
    cancellation: cancellation[order.axes.cancellation],
    meeting: meeting[order.axes.meeting],
    refund: refund[order.axes.refund],
    settlement: settlement[order.axes.settlement],
    approval: ({ not_required: '无需审批', pending: '审批中', approved: '审批通过', rejected: '审批未通过', withdrawn: '申请已撤回' } as const)[order.axes.approval],
    reservation: ({ none: '未预占', held: '资源已锁定', occupied: '资源已占用', confirming: '资源保持锁定', released: '资源已释放' } as const)[order.axes.reservation],
    appeal: ({ none: '无申诉', available: '申诉期内', open: '申诉处理中', resolved: '申诉已处理', expired: '申诉期已结束' } as const)[order.axes.appeal],
    diamonds: ({ none: '未使用粉钻', reserved: '粉钻已预占', consumed: '粉钻已使用', restored: '粉钻已恢复' } as const)[order.axes.diamonds],
    rentalVoucher: ({ none: '未使用租赁券', reserved: '租赁券已预占', redeemed: '租赁券已使用', released: '租赁券已退回' } as const)[order.axes.rentalVoucher],
    insuranceVoucher: ({ none: '未使用安心保券', reserved: '安心保券已预占', redeemed: '安心保券已使用', released: '安心保券已退回' } as const)[order.axes.insuranceVoucher],
    guardVoucher: ({ none: '未使用售后守护券', reserved: '售后守护券已预占', redeemed: '售后守护券已使用', released: '售后守护券已退回' } as const)[order.axes.guardVoucher ?? 'none'],
    insuranceClaim: ({ not_applicable: '未购买安心保', not_started: '尚未申请赔付', pending: '赔付处理中', confirming: '赔付确认中', succeeded: '赔付已到账', failed: '赔付异常' } as const)[order.axes.insuranceClaim],
    wechatWaiver: ({ not_applicable: '未使用微信支付免押', confirming: '正在校验微信免押资格', confirmed: '微信支付免押已确认', rejected: '微信支付免押未通过' } as const)[order.axes.wechatWaiver],
    risk: ({ not_applicable: '无需风控', not_queried: '尚未查询风控', pass: '风控评估通过', reject: '风控评估拒绝', abnormal: '风控结果异常' } as const)[order.axes.risk],
  };
}
