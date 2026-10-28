import type { CouponType, CouponRights, CouponsPolicy, LotteryPolicy, LoyaltySaveRequest, LotteryInventory } from '../../shared/services/loyaltyManagement';
import { formatLoyaltyMoney, formatLoyaltyPercent, loyaltyProbabilityTotal, parseLoyaltyInteger, parseLoyaltyMoney, parseLoyaltyPercent, parseLoyaltyReason, validateLoyaltyStock, type ParsedInput } from './loyaltyInputs';
import type { LoyaltyFieldDifference } from './LoyaltySaveReview';

export const couponLabels = { DEPOSIT_WAIVER: '免押券', PUBLISH_ONCE: '发布券', ONE_DAY_RENT: '一天租金券', GUARD_DISCOUNT: '保障抵扣券' } satisfies Record<CouponType, string>;
export const couponTypes = Object.keys(couponLabels) as CouponType[];
export const prizeCodes = [...couponTypes, 'PINK'] as const;
export const prizeLabel = (code: LotteryPolicy['prizes'][number]['prize_code']) => code === 'PINK' ? '粉钻' : couponLabels[code];
export const couponRightsText = (rights: CouponRights): string => {
  switch (rights.kind) {
    case 'DEPOSIT_WAIVER': return '全额免押';
    case 'PUBLISH_ONCE': return '固定增加 1 次发布额度';
    case 'ONE_DAY_RENT': return '固定抵扣 1 天租金';
    case 'GUARD_DISCOUNT': return `保障费用抵扣 ${formatLoyaltyMoney(rights.insurance_discount_fen)} 元`;
  }
};
export type CouponDraft = { coupons: { coupon_type: CouponType; enabled: boolean; amount: string }[] };
export type LotteryDraft = { enabled: boolean; cost: string; noWin: string; prizes: { prize_code: LotteryPolicy['prizes'][number]['prize_code']; enabled: boolean; probability: string; total: string; reward: string }[] };
export type LoyaltyDraft = CouponDraft | LotteryDraft;
export function isCouponsPolicy(value: unknown): value is CouponsPolicy {
  if (typeof value !== 'object' || value === null || !('coupons' in value) || !Array.isArray(value.coupons) || value.coupons.length !== 4) return false;
  const coupons = value.coupons;
  return couponTypes.every((type) => coupons.filter((row: unknown) => typeof row === 'object' && row !== null && 'coupon_type' in row && row.coupon_type === type).length === 1)
    && coupons.every((row: unknown) => typeof row === 'object' && row !== null && 'enabled' in row && typeof row.enabled === 'boolean' && 'insurance_discount_fen' in row
      && 'coupon_type' in row && (row.coupon_type === 'GUARD_DISCOUNT' ? typeof row.insurance_discount_fen === 'string' && parseLoyaltyInteger(row.insurance_discount_fen, true).ok : row.insurance_discount_fen === null));
}
export function isLotteryPolicy(value: unknown): value is LotteryPolicy {
  if (typeof value !== 'object' || value === null || !('pool_code' in value) || value.pool_code !== 'MAIN' || !('enabled' in value) || typeof value.enabled !== 'boolean'
    || !('cost_pink_units' in value) || typeof value.cost_pink_units !== 'string' || !parseLoyaltyInteger(value.cost_pink_units, true).ok
    || !('no_win_probability_bps' in value) || typeof value.no_win_probability_bps !== 'number' || !Number.isInteger(value.no_win_probability_bps) || value.no_win_probability_bps < 0 || value.no_win_probability_bps > 10000
    || !('prizes' in value) || !Array.isArray(value.prizes) || value.prizes.length !== 5) return false;
  const prizes = value.prizes;
  return prizeCodes.every((code) => prizes.filter((row: unknown) => typeof row === 'object' && row !== null && 'prize_code' in row && row.prize_code === code).length === 1)
    && prizes.every((row: unknown) => typeof row === 'object' && row !== null && 'enabled' in row && typeof row.enabled === 'boolean'
      && 'probability_bps' in row && typeof row.probability_bps === 'number' && Number.isInteger(row.probability_bps) && row.probability_bps >= 0 && row.probability_bps <= 10000
      && 'total_qty' in row && typeof row.total_qty === 'string' && parseLoyaltyInteger(row.total_qty).ok
      && 'pink_reward_units' in row && 'prize_code' in row && (row.prize_code === 'PINK' ? typeof row.pink_reward_units === 'string' && parseLoyaltyInteger(row.pink_reward_units, true).ok : row.pink_reward_units === null));
}
export function isLoyaltySaveRequest(value: unknown): value is LoyaltySaveRequest {
  return typeof value === 'object' && value !== null && 'base_effective_epoch' in value && typeof value.base_effective_epoch === 'string' && parseLoyaltyInteger(value.base_effective_epoch).ok
    && 'reason' in value && typeof value.reason === 'string' && parseLoyaltyReason(value.reason).ok && 'value' in value && (isCouponsPolicy(value.value) || isLotteryPolicy(value.value));
}
export function couponDraft(value: CouponsPolicy | null): CouponDraft {
  return { coupons: couponTypes.map((type) => { const row = value?.coupons.find((item) => item.coupon_type === type); return { coupon_type: type, enabled: row?.enabled ?? false, amount: row?.insurance_discount_fen == null ? '' : formatLoyaltyMoney(row.insurance_discount_fen) }; }) };
}
export function lotteryDraft(value: LotteryPolicy | null): LotteryDraft {
  return { enabled: value?.enabled ?? false, cost: value?.cost_pink_units ?? '', noWin: value ? formatLoyaltyPercent(value.no_win_probability_bps) : '', prizes: prizeCodes.map((code) => {
    const row = value?.prizes.find((item) => item.prize_code === code);
    return { prize_code: code, enabled: row?.enabled ?? false, probability: row ? formatLoyaltyPercent(row.probability_bps) : '', total: row?.total_qty ?? '', reward: row?.pink_reward_units ?? '' };
  }) };
}
export function parseCouponDraft(draft: CouponDraft): ParsedInput<CouponsPolicy> {
  const coupons: CouponsPolicy['coupons'] = [];
  for (const row of draft.coupons) {
    const amount = row.coupon_type === 'GUARD_DISCOUNT' ? parseLoyaltyMoney(row.amount) : { ok: true as const, value: null };
    if (!amount.ok) return amount;
    coupons.push({ coupon_type: row.coupon_type, enabled: row.enabled, insurance_discount_fen: amount.value });
  }
  const value = { coupons };
  return isCouponsPolicy(value) ? { ok: true, value } : { ok: false, message: '优惠券配置须完整包含四种固定券。' };
}
export function parseLotteryDraft(draft: LotteryDraft, inventory: readonly LotteryInventory[], coupons: CouponsPolicy | null): ParsedInput<LotteryPolicy> {
  const cost = parseLoyaltyInteger(draft.cost, true); if (!cost.ok) return cost;
  const noWin = parseLoyaltyPercent(draft.noWin); if (!noWin.ok) return noWin;
  const total = loyaltyProbabilityTotal([...draft.prizes.map((row) => row.probability), draft.noWin]);
  if (!total.ok) return total;
  if (total.value.differenceBps !== 0) return { ok: false, message: `概率合计须为 100.00%，当前 ${formatLoyaltyPercent(total.value.totalBps)}%，差额 ${(total.value.differenceBps / 100).toFixed(2)}%。` };
  const prizes: LotteryPolicy['prizes'] = [];
  for (const row of draft.prizes) {
    const stock = inventory.find((item) => item.prize_code === row.prize_code);
    if (stock === undefined) return { ok: false, message: `${prizeLabel(row.prize_code)}库存尚未读到，请刷新后编辑。` };
    const quantity = validateLoyaltyStock(row.total, stock.issued_qty, row.enabled); if (!quantity.ok) return { ok: false, message: `${prizeLabel(row.prize_code)}：${quantity.message}` };
    const probability = parseLoyaltyPercent(row.probability); if (!probability.ok) return probability;
    if (row.enabled && probability.value === 0 || !row.enabled && probability.value !== 0) return { ok: false, message: `${prizeLabel(row.prize_code)}启用时概率须大于零，停用时概率须为零。` };
    if (row.enabled && row.prize_code !== 'PINK' && coupons?.coupons.find((item) => item.coupon_type === row.prize_code)?.enabled !== true) return { ok: false, message: `${prizeLabel(row.prize_code)}未启用，请先在优惠券管理启用。` };
    const reward = row.prize_code === 'PINK' ? parseLoyaltyInteger(row.reward, true) : { ok: true as const, value: null }; if (!reward.ok) return reward;
    prizes.push({ prize_code: row.prize_code, enabled: row.enabled, probability_bps: probability.value, total_qty: quantity.value, pink_reward_units: reward.value });
  }
  if (draft.enabled && !prizes.some((row) => row.enabled)) return { ok: false, message: '启用奖池至少需要一个已启用且有库存的真实奖品。' };
  const value: LotteryPolicy = { pool_code: 'MAIN', enabled: draft.enabled, cost_pink_units: cost.value, no_win_probability_bps: noWin.value, prizes };
  return isLotteryPolicy(value) ? { ok: true, value } : { ok: false, message: '奖品配置须完整包含五种固定奖品。' };
}
export function policySummary(value: CouponsPolicy | LotteryPolicy): { field: string; label: string; value: string }[] {
  if ('coupons' in value) return value.coupons.flatMap((row) => [
    { field: `coupons.${row.coupon_type}.enabled`, label: `${couponLabels[row.coupon_type]}启用`, value: row.enabled ? '启用' : '停用' },
    { field: `coupons.${row.coupon_type}.rights`, label: `${couponLabels[row.coupon_type]}权益`, value: row.coupon_type === 'GUARD_DISCOUNT' ? `${formatLoyaltyMoney(row.insurance_discount_fen ?? '')} 元` : row.coupon_type === 'DEPOSIT_WAIVER' ? '全额免押' : row.coupon_type === 'PUBLISH_ONCE' ? '固定 1 次发布额度' : '固定 1 天租金' },
  ]);
  return [{ field: 'enabled', label: '奖池启用', value: value.enabled ? '启用' : '停用' }, { field: 'cost_pink_units', label: '每次粉钻消耗', value: value.cost_pink_units },
    ...value.prizes.flatMap((row) => [{ field: `prizes.${row.prize_code}.enabled`, label: `${prizeLabel(row.prize_code)}启用`, value: row.enabled ? '启用' : '停用' },
      { field: `prizes.${row.prize_code}.probability_bps`, label: `${prizeLabel(row.prize_code)}概率`, value: `${formatLoyaltyPercent(row.probability_bps)}%` },
      { field: `prizes.${row.prize_code}.total_qty`, label: `${prizeLabel(row.prize_code)}累计总份数`, value: row.total_qty },
      ...(row.prize_code === 'PINK' ? [{ field: 'prizes.PINK.pink_reward_units', label: '中奖粉钻数量', value: row.pink_reward_units ?? '—' }] : [])]),
    { field: 'no_win_probability_bps', label: '谢谢参与概率', value: `${formatLoyaltyPercent(value.no_win_probability_bps)}%` }];
}
export function policyDifferences(before: CouponsPolicy | LotteryPolicy | null, after: CouponsPolicy | LotteryPolicy): LoyaltyFieldDifference[] {
  const previous = before === null ? [] : policySummary(before);
  return policySummary(after).flatMap((field) => {
    const old = previous.find((item) => item.field === field.field)?.value ?? '尚未配置';
    return old === field.value ? [] : [{ field: field.field, label: field.label, before: old, after: field.value }];
  });
}
