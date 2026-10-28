import type { components } from '../../../types/api/schema';
import { request } from './request';
import { lotteryApi, redemptionApi, loyaltyTraceApi, entitlementApi } from './loyalty-api';
import { readStoredApiSession } from '../session/api-session';
import { locateLoyaltyIntent, clearConfirmedLoyaltyIntent } from './loyalty-intent';
import type { LoyaltyIntent } from '../model/loyalty-intent';
import type { LotteryAttempt, LotteryDrawInput, CouponRedemptionAttempt, CouponRedemptionInput, CouponDetail, PointEntryDetail } from '../model/api-loyalty';
import { assertOwner, assertLotteryAttempt, assertRedemptionAttempt } from '../presentation/loyalty';
import { quantityAfterCost } from '../format/quantity';

type Schema = components['schemas'];
function active(owner: string): void { if (readStoredApiSession()?.accountId!==owner) throw new Error('登录状态已变化，请重新读取。'); }
function valid(condition: boolean): void { if (!condition) throw new Error('结果关联明细不一致，请继续核实原请求。'); }
async function summary(owner: string) {
  const result=await request<Schema['MemberDossier']>({path:'/v1/me/benefits'}).promise;
  active(owner);assertOwner(result.profile,owner);return result;
}
export async function queryPendingLottery(owner: string): Promise<LotteryAttempt[]> {
  active(owner);
  const pages=await Promise.all([lotteryApi.list(null,'RECEIVED').promise,lotteryApi.list(null,'VERIFYING').promise]);
  active(owner);
  const items=pages.flatMap(page=>page.items);
  items.forEach(item=>{assertLotteryAttempt(item,owner);valid(item.state==='RECEIVED'||item.state==='VERIFYING');});
  return items;
}
export async function queryPendingRedemptions(owner: string): Promise<CouponRedemptionAttempt[]> {
  active(owner);
  const pages=await Promise.all([redemptionApi.list(null,'RECEIVED').promise,redemptionApi.list(null,'VERIFYING').promise]);
  active(owner);
  const items=pages.flatMap(page=>page.items);
  items.forEach(item=>{assertRedemptionAttempt(item,owner);valid(item.state==='RECEIVED'||item.state==='VERIFYING');});
  return items;
}
export async function verifyLotteryResult(attempt: LotteryAttempt, owner: string, intent?: LoyaltyIntent<LotteryDrawInput> | null) {
  active(owner);assertLotteryAttempt(attempt,owner);
  if (intent) valid(intent.owner===owner && intent.body.confirmed_cost_pink_units===attempt.confirmed_cost_pink_units
    && intent.body.expected_lottery_config_version_id===attempt.confirmed_lottery_config_version_id
    && intent.body.expected_coupon_config_version_id===attempt.confirmed_coupon_config_version_id);
  const located=intent?locateLoyaltyIntent(intent,attempt.attempt_id):null;
  if (attempt.state==='RECEIVED'||attempt.state==='VERIFYING') return null;
  if (attempt.state==='COMPLETED') {
    const spend=await request<PointEntryDetail>({path:'/v1/me/point-entries/'+encodeURIComponent(attempt.pink_spend_entry_id!)}).promise;
    active(owner);assertOwner(spend,owner);
    valid(spend.entry_id===attempt.pink_spend_entry_id&&spend.point_kind==='PINK'&&spend.action==='CONSUME'
      && spend.source_kind==='LOTTERY'&&spend.source_id===attempt.draw_id&&spend.source_draw_id===attempt.draw_id
      && spend.source_grant_id===null&&spend.available_delta===(attempt.cost_pink_units==='0'?'0':'-'+attempt.cost_pink_units)
      &&quantityAfterCost(spend.available_before,attempt.cost_pink_units!)===spend.available_after);
    if(attempt.prize_code!=='PINK')valid(spend.available_after===attempt.balance_after);
    if (attempt.result_kind==='WIN') {
      const grant=await loyaltyTraceApi.grant(attempt.grant_id!).promise;active(owner);assertOwner(grant,owner);
      valid(grant.grant_id===attempt.grant_id&&grant.source_kind==='LOTTERY'&&grant.source_id===attempt.draw_id&&grant.reward_code===attempt.prize_code);
      if (attempt.prize_code==='PINK') {
        const reward=await request<PointEntryDetail>({path:'/v1/me/point-entries/'+encodeURIComponent(attempt.pink_reward_entry_id!)}).promise;
        active(owner);assertOwner(reward,owner);
        valid(reward.entry_id===attempt.pink_reward_entry_id&&reward.action==='EARN'&&reward.point_kind==='PINK'
          &&reward.source_draw_id===attempt.draw_id&&reward.source_id===attempt.draw_id&&reward.source_kind==='LOTTERY'
          &&reward.source_grant_id===attempt.grant_id&&reward.available_delta===attempt.prize_snapshot!.pink_reward_units
          &&grant.reward_kind==='POINT'&&grant.reward_units===attempt.prize_snapshot!.pink_reward_units&&grant.pink_entry_ids.includes(reward.entry_id)&&grant.coupon_ids.length===0
          &&reward.available_before===spend.available_after&&reward.available_after===attempt.balance_after
          &&quantityAfterCost(reward.available_after,attempt.prize_snapshot!.pink_reward_units!)===reward.available_before);
      } else {
        const coupon=await request<CouponDetail>({path:'/v1/me/coupons/'+encodeURIComponent(attempt.coupon_id!)}).promise;
        active(owner);assertOwner(coupon,owner);
        valid(coupon.coupon_id===attempt.coupon_id&&coupon.coupon_type===attempt.prize_code&&coupon.source_draw_id===attempt.draw_id
          &&coupon.source_grant_id===attempt.grant_id&&coupon.source_kind==='LOTTERY'&&coupon.source_id===attempt.draw_id
          &&grant.reward_kind==='COUPON'&&grant.reward_units==='1'&&grant.coupon_ids.includes(coupon.coupon_id)&&grant.pink_entry_ids.length===0);
      }
    }
  }
  const benefits=await summary(owner);
  if (located) clearConfirmedLoyaltyIntent(located,attempt.attempt_id);
  return benefits;
}
export async function verifyRedemptionResult(attempt: CouponRedemptionAttempt, owner: string, intent?: LoyaltyIntent<CouponRedemptionInput> | null) {
  active(owner);assertRedemptionAttempt(attempt,owner);
  if (intent) valid(intent.owner===owner&&intent.resourceId===attempt.coupon_id&&intent.body.expected_coupon_version===attempt.expected_coupon_version);
  const located=intent?locateLoyaltyIntent(intent,attempt.attempt_id):null;
  if (attempt.state==='RECEIVED'||attempt.state==='VERIFYING') return null;
  const coupon=await request<CouponDetail>({path:'/v1/me/coupons/'+encodeURIComponent(attempt.coupon_id)}).promise;
  active(owner);assertOwner(coupon,owner);valid(coupon.coupon_id===attempt.coupon_id);
  if (attempt.state==='COMPLETED') {
    const movement=await entitlementApi.detail(attempt.movement_id!).promise;active(owner);assertOwner(movement,owner);
    valid(coupon.coupon_type==='PUBLISH_ONCE'&&coupon.status==='REDEEMED'&&!coupon.allowed_actions.can_redeem
      &&coupon.redemption_id===attempt.redemption_id&&coupon.entitlement_lot_id===attempt.entitlement_lot_id&&coupon.movement_id===attempt.movement_id
      &&movement.movement_id===attempt.movement_id&&movement.kind==='PUBLISH_QUOTA'&&movement.action==='GRANT'&&movement.quantity==='1'
      &&movement.lot_id===attempt.entitlement_lot_id&&movement.source_kind==='COUPON_REDEMPTION'&&movement.source_id===attempt.redemption_id
      &&movement.source_redemption_id===attempt.redemption_id&&movement.available_delta==='1'
      &&movement.available_before_qty===attempt.available_before_qty&&movement.available_after_qty===attempt.available_after_qty
      &&quantityAfterCost(attempt.available_after_qty!,'1')===attempt.available_before_qty);
  }
  const benefits=await summary(owner);
  if (located) clearConfirmedLoyaltyIntent(located,attempt.attempt_id);
  return {coupon,benefits};
}
