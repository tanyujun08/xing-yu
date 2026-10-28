import type { components } from '../../../types/api/schema';
import { request } from './request';
import { assertLotteryInput, assertRedemptionInput } from '../presentation/loyalty';

type Schema = components['schemas'];
type AttemptState = Schema['LotteryAttempt']['state'];
function query(cursor: string | null, values: Record<string, string | undefined>): string {
  return '?page_size=20' + Object.entries({ ...values, cursor: cursor ?? undefined })
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => '&' + key + '=' + encodeURIComponent(value)).join('');
}
export const lotteryApi = {
  state: () => request<Schema['LotteryState']>({path:'/v1/me/lottery'}),
  list: (cursor: string | null, state?: AttemptState, result?: NonNullable<Schema['LotteryAttempt']['result_kind']>) => {
    if (result && state && state !== 'COMPLETED') throw new Error('中奖结果只适用于已完成的抽奖。');
    return request<Schema['LotteryAttemptPage']>({path:'/v1/me/lottery-attempts'+query(cursor,{state,result_kind:result})});
  },
  attempt: (id: string) => request<Schema['LotteryAttempt']>({path:'/v1/me/lottery-attempts/'+encodeURIComponent(id)}),
  draw: (id: string) => request<Schema['LotteryAttempt']>({path:'/v1/me/lottery-draws/'+encodeURIComponent(id)}),
  intent: (key: string) => request<Schema['LotteryAttempt']>({path:'/v1/me/lottery-intent',idempotencyKey:key}),
  submit: (body: Schema['LotteryDrawInput'], key: string) => {assertLotteryInput(body);return request<Schema['LotteryAttempt'], Schema['LotteryDrawInput']>({path:'/v1/me/lottery-draws',method:'POST',body,idempotencyKey:key});},
};
export const redemptionApi = {
  list: (cursor: string | null, state?: AttemptState) => request<Schema['CouponRedemptionAttemptPage']>({path:'/v1/me/coupon-redemption-attempts'+query(cursor,{state})}),
  attempt: (id: string) => request<Schema['CouponRedemptionAttempt']>({path:'/v1/me/coupon-redemption-attempts/'+encodeURIComponent(id)}),
  receipt: (id: string) => request<Schema['CouponRedemptionAttempt']>({path:'/v1/me/coupon-redemptions/'+encodeURIComponent(id)}),
  intent: (key: string) => request<Schema['CouponRedemptionAttempt']>({path:'/v1/me/coupon-redemption-intent',idempotencyKey:key}),
  submit: (coupon: string, body: Schema['CouponRedemptionInput'], key: string) => {assertRedemptionInput(body);return request<Schema['CouponRedemptionAttempt'], Schema['CouponRedemptionInput']>({path:'/v1/me/coupons/'+encodeURIComponent(coupon)+'/redemptions',method:'POST',body,idempotencyKey:key});},
};
export const entitlementApi = {
  list: (cursor: string | null) => request<Schema['EntitlementMovementPage']>({path:'/v1/me/entitlement-movements'+query(cursor,{})}),
  detail: (id: string) => request<Schema['EntitlementMovementDetail']>({path:'/v1/me/entitlement-movements/'+encodeURIComponent(id)}),
};
export const loyaltyTraceApi = {
  grant: (id: string) => request<Schema['BenefitGrantTrace']>({path:'/v1/me/benefit-grants/'+encodeURIComponent(id)}),
};
