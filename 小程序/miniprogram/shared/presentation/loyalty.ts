import type { CouponRights, CouponType, LotteryAttempt, LotteryState, CouponRedemptionAttempt, LotteryDrawInput, CouponRedemptionInput } from '../model/api-loyalty';
import { loyaltyIdentifier } from '../model/loyalty-intent';
import { compareQuantities, displayQuantity } from '../format/quantity';
import { formatCNYMinorUnits } from '../format/money';
import { formatDateTime } from '../format/date-time';

export const couponTitles: Record<CouponType, string> = {DEPOSIT_WAIVER:'免押券',PUBLISH_ONCE:'发布一次券',ONE_DAY_RENT:'一天租金券',GUARD_DISCOUNT:'保障抵扣券'};
export function rightsText(rights: CouponRights): string {
  switch (rights.kind) {
    case 'DEPOSIT_WAIVER': return '全额免押权益';
    case 'PUBLISH_ONCE': return '兑换 1 次发布额度';
    case 'ONE_DAY_RENT': return '1 天租金权益';
    case 'GUARD_DISCOUNT': return '保障费用抵扣 '+formatCNYMinorUnits(rights.insurance_discount_fen);
  }
}
export function assertOwner(value: {account_id:string}, owner: string): void {
  if (!owner || value.account_id !== owner) throw new Error('账户响应不一致，请重新读取。');
}
function requireId(value: string | null): void { if (!value || !loyaltyIdentifier(value)) throw new Error('结果关联标识不完整，请继续核实。'); }
export function assertLotteryInput(input:LotteryDrawInput):void {
  if(Object.keys(input).sort().join(',')!=='confirmed_cost_pink_units,expected_coupon_config_version_id,expected_lottery_config_version_id'
    ||!loyaltyIdentifier(input.expected_lottery_config_version_id)||input.expected_coupon_config_version_id!==null&&!loyaltyIdentifier(input.expected_coupon_config_version_id)
    ||displayQuantity(input.confirmed_cost_pink_units)==='—')throw new Error('抽奖原请求不完整，继续保留并查询。');
}
export function assertRedemptionInput(input:CouponRedemptionInput):void {
  if(Object.keys(input).join(',')!=='expected_coupon_version'||displayQuantity(input.expected_coupon_version)==='—')throw new Error('兑换原请求不完整，继续保留并查询。');
}
export function assertLotteryState(value:LotteryState,owner:string):void {
  assertOwner(value,owner);
  const ids=new Set(value.prizes.map(prize=>prize.prize_code));
  if(value.prizes.length!==5||ids.size!==5||!ids.has('PINK')||Object.keys(couponTitles).some(id=>!ids.has(id as CouponType))
    ||displayQuantity(value.available_pink_units)==='—'||value.cost_pink_units!==null&&displayQuantity(value.cost_pink_units)==='—'
    ||value.prizes.some(prize=>displayQuantity(prize.remaining_qty)==='—'||prize.prize_code!=='PINK'&&prize.rights_display!==null&&prize.rights_display.kind!==prize.prize_code))throw new Error('抽奖状态或奖品快照无效，请重新读取。');
}
export function assertLotteryAttempt(attempt: LotteryAttempt, owner: string): void {
  assertOwner(attempt,owner); requireId(attempt.attempt_id);
  if (displayQuantity(attempt.confirmed_cost_pink_units)==='—') throw new Error('抽奖确认消耗无效。');
  const empty = [attempt.draw_id,attempt.prize_code,attempt.prize_snapshot,attempt.coupon_id,attempt.pink_spend_entry_id,attempt.pink_reward_entry_id,attempt.balance_after,attempt.grant_id,attempt.inventory_movement_id];
  if (attempt.state==='RECEIVED'||attempt.state==='VERIFYING'||attempt.state==='REJECTED') {
    if (attempt.result_kind!==null||empty.some(item=>item!==null)||attempt.cost_pink_units!==(attempt.state==='REJECTED'?'0':null)) throw new Error('未决或拒绝结果无效，请继续核实。');
    return;
  }
  if (attempt.state!=='COMPLETED'||!['WIN','NO_WIN'].includes(attempt.result_kind??'')) throw new Error('抽奖状态无效，请继续核实。');
  requireId(attempt.draw_id); requireId(attempt.pink_spend_entry_id);
  if (attempt.cost_pink_units!==attempt.confirmed_cost_pink_units||displayQuantity(attempt.balance_after)==='—') throw new Error('抽奖扣费回执无效。');
  if (attempt.result_kind==='NO_WIN') {
    if ([attempt.prize_code,attempt.prize_snapshot,attempt.coupon_id,attempt.pink_reward_entry_id,attempt.grant_id,attempt.inventory_movement_id].some(item=>item!==null)) throw new Error('未中奖回执包含奖励，请继续核实。');
  } else {
    requireId(attempt.grant_id); requireId(attempt.inventory_movement_id);
    if (!attempt.prize_code||attempt.prize_snapshot?.prize_code!==attempt.prize_code||attempt.prize_snapshot.prize_qty!=='1') throw new Error('奖品回执无效。');
    if (attempt.prize_code==='PINK') {
      requireId(attempt.pink_reward_entry_id);
      if (attempt.coupon_id!==null||displayQuantity(attempt.prize_snapshot.pink_reward_units)==='—') throw new Error('粉钻奖励回执无效。');
    } else {requireId(attempt.coupon_id); if (attempt.pink_reward_entry_id!==null) throw new Error('券奖励回执无效。');}
  }
}
export function lotteryCanDraw(state: LotteryState | null, blocked: boolean): boolean {
  return !!state && !blocked && state.enabled && state.blocked_reason===null
    && !!state.lottery_config_version_id && displayQuantity(state.available_pink_units)!=='—' && displayQuantity(state.cost_pink_units)!=='—'
    && compareQuantities(state.available_pink_units,state.cost_pink_units!)>=0;
}
export function presentLotteryAttempt(attempt: LotteryAttempt) {
  const title=attempt.state==='COMPLETED'?(attempt.result_kind==='NO_WIN'?'本次未中奖':attempt.prize_code==='PINK'?'获得 '+displayQuantity(attempt.prize_snapshot?.pink_reward_units)+' 粉钻':couponTitles[attempt.prize_code! as CouponType]):attempt.state==='REJECTED'?'本次请求被拒绝':'结果核实中';
  return {id:attempt.attempt_id,title,time:formatDateTime(attempt.received_at),state:attempt.state,status:attempt.state==='COMPLETED'?'已完成':attempt.state==='REJECTED'?'已拒绝':'待核实',cost:attempt.cost_pink_units===null?'尚未确认扣费':displayQuantity(attempt.cost_pink_units)+' 粉钻',balance:displayQuantity(attempt.balance_after),reason:attempt.reason_code??'',couponId:attempt.coupon_id??'',spendEntryId:attempt.pink_spend_entry_id??'',rewardEntryId:attempt.pink_reward_entry_id??'',grantId:attempt.grant_id??'',drawId:attempt.draw_id??'',pending:attempt.state==='RECEIVED'||attempt.state==='VERIFYING'};
}
export function assertRedemptionAttempt(attempt: CouponRedemptionAttempt, owner: string): void {
  assertOwner(attempt,owner);requireId(attempt.attempt_id);requireId(attempt.coupon_id);
  if (attempt.quantity!=='1'||displayQuantity(attempt.expected_coupon_version)==='—') throw new Error('兑换回执无效。');
  const ids=[attempt.redemption_id,attempt.entitlement_lot_id,attempt.movement_id,attempt.available_before_qty,attempt.available_after_qty];
  if (attempt.state==='COMPLETED') {
    requireId(attempt.redemption_id);requireId(attempt.entitlement_lot_id);requireId(attempt.movement_id);
    if (displayQuantity(attempt.available_before_qty)==='—'||displayQuantity(attempt.available_after_qty)==='—') throw new Error('额度回执无效。');
  } else if (!['RECEIVED','VERIFYING','REJECTED'].includes(attempt.state)||ids.some(item=>item!==null)) throw new Error('未决兑换回执无效。');
}
