import type { ApiClient } from '../api/client';
import type { components, operations } from '../api/generated/schema';

type Schema = components['schemas'];
export type CouponType = Schema['CouponType'];
export type PrizeCode = Schema['PrizeCode'];
export type CouponRights = Schema['CouponRights'];
export type CouponsPolicy = Schema['CouponsPolicy'];
export type LotteryPolicy = Schema['LotteryPolicy'];
export type LoyaltyConfigKey = Schema['LoyaltyEffectiveConfig']['config_key'];
export type LoyaltyEffectiveResult = Schema['LoyaltyEffectiveConfigResult'];
export type LoyaltyEffectiveConfig = Schema['LoyaltyEffectiveConfig'];
export type LoyaltySaveRequest = Schema['LoyaltyConfigSaveRequest'];
export type LoyaltySaveResult = Schema['LoyaltyConfigSaveResult'];
export type LoyaltyConfigVersion = Schema['LoyaltyConfigVersion'];
export type LoyaltyConfigConflict = Schema['LoyaltyConfigConflict'];
export type LotteryInventory = Schema['LotteryInventory'];
export type LotteryAttempt = Schema['LotteryAttempt'];
export type MemberCoupon = Schema['MemberCoupon'];
export type CouponDetail = Schema['CouponDetail'];
export type CouponRedemptionAttempt = Schema['CouponRedemptionAttempt'];
export type BenefitGrantTrace = Schema['BenefitGrantTrace'];
export type PointEntryDetail = Schema['PointEntryDetail'];
export type EntitlementMovementDetail = Schema['EntitlementMovementDetail'];
export type LotteryMovement = Schema['LotteryMovement'];
export type LoyaltyOperationEvent = Schema['LoyaltyOperationEvent'];
type Query<K extends keyof operations> = operations[K]['parameters'] extends { query?: infer Q } ? NonNullable<Q> : never;
export type CouponFilter = Query<'listOpsCoupons'>;
export type LotteryFilter = Query<'listOpsLotteryAttempts'>;
export type RedemptionFilter = Query<'listOpsCouponRedemptionAttempts'>;
export type MovementFilter = Query<'listOpsLotteryMovements'>;
export type LoyaltyDetailKind = 'coupon' | 'lottery-attempt' | 'redemption' | 'redemption-attempt' | 'grant' | 'pink-entry' | 'quota-movement' | 'inventory-movement' | 'config-version' | 'operation-event' | 'check-in';
type Response<K extends keyof operations> = operations[K]['responses'] extends { 200: { content: { 'application/json': infer R } } } ? R : never;
export type LoyaltyDetail = CouponDetail | LotteryAttempt | CouponRedemptionAttempt | BenefitGrantTrace | PointEntryDetail | EntitlementMovementDetail | LotteryMovement | LoyaltyConfigVersion | LoyaltyOperationEvent | Response<'getOpsCouponRedemption'> | Response<'getOpsCheckIn'>;

export interface LoyaltyManagementGateway {
  effective(key: LoyaltyConfigKey, signal?: AbortSignal): Promise<LoyaltyEffectiveResult>;
  save(key: LoyaltyConfigKey, body: LoyaltySaveRequest, idempotencyKey: string): Promise<LoyaltySaveResult>;
  versions(key: LoyaltyConfigKey, cursor?: string, signal?: AbortSignal): Promise<Schema['LoyaltyConfigVersionPage']>;
  inventory(signal?: AbortSignal): Promise<Schema['LotteryInventoryResult']>;
  coupons(filter: CouponFilter, signal?: AbortSignal): Promise<Schema['MemberCouponPage']>;
  lotteryAttempts(filter: LotteryFilter, signal?: AbortSignal): Promise<Schema['LotteryAttemptPage']>;
  redemptionAttempts(filter: RedemptionFilter, signal?: AbortSignal): Promise<Schema['CouponRedemptionAttemptPage']>;
  movements(filter: MovementFilter, signal?: AbortSignal): Promise<Schema['LotteryMovementPage']>;
  detail(kind: LoyaltyDetailKind, id: string, signal?: AbortSignal): Promise<LoyaltyDetail>;
}
const detailPaths: Record<LoyaltyDetailKind, string> = {
  coupon: '/v1/ops/coupons', 'lottery-attempt': '/v1/ops/lottery-attempts', redemption: '/v1/ops/coupon-redemptions',
  'redemption-attempt': '/v1/ops/coupon-redemption-attempts', grant: '/v1/ops/benefit-grants', 'pink-entry': '/v1/ops/point-entries',
  'quota-movement': '/v1/ops/entitlement-movements', 'inventory-movement': '/v1/ops/lottery-prizes/movements',
  'config-version': '/v1/ops/system-config/versions', 'operation-event': '/v1/ops/operation-events', 'check-in': '/v1/ops/check-ins',
};
export function isLoyaltyDetailKind(value: string): value is LoyaltyDetailKind { return Object.hasOwn(detailPaths, value); }
function query(values: object) {
  const parameters = new URLSearchParams();
  const merged: Record<string, unknown> = { page_size: 20, ...values };
  for (const [key, value] of Object.entries(merged)) if (value !== undefined && value !== '') parameters.set(key, String(value));
  return parameters.toString();
}
export function createLoyaltyManagement(client: ApiClient): LoyaltyManagementGateway {
  const read = <T>(path: string, signal?: AbortSignal) => client.request<T>({ path, ...(signal === undefined ? {} : { signal }) });
  return {
    effective: (key, signal) => read(`/v1/ops/system-config/effective?config_key=${encodeURIComponent(key)}`, signal),
    save: (key, body, idempotencyKey) => client.request({ path: `/v1/ops/system-config/effective/${encodeURIComponent(key)}`, method: 'PUT', body, idempotencyKey }),
    versions: (key, cursor = '', signal) => read(`/v1/ops/system-config/versions?${query({ config_key: key, cursor })}`, signal),
    inventory: (signal) => read('/v1/ops/lottery-prizes/inventory', signal),
    coupons: (filter, signal) => read(`/v1/ops/coupons?${query(filter)}`, signal),
    lotteryAttempts: (filter, signal) => read(`/v1/ops/lottery-attempts?${query(filter)}`, signal),
    redemptionAttempts: (filter, signal) => read(`/v1/ops/coupon-redemption-attempts?${query(filter)}`, signal),
    movements: (filter, signal) => read(`/v1/ops/lottery-prizes/movements?${query(filter)}`, signal),
    detail: (kind, id, signal) => read(`${detailPaths[kind]}/${encodeURIComponent(id)}`, signal),
  };
}
