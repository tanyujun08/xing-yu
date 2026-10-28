import { expect, it } from 'vitest';
import type { CouponsPolicy, LotteryPolicy, LotteryInventory } from '../../shared/services/loyaltyManagement';
import { couponDraft, lotteryDraft, parseCouponDraft, parseLotteryDraft, isCouponsPolicy, isLotteryPolicy, isLoyaltySaveRequest, policyDifferences, couponTypes, prizeCodes, couponRightsText } from './loyaltyPolicies';

const coupons: CouponsPolicy = { coupons: couponTypes.map((coupon_type) => ({ coupon_type, enabled: true, insurance_discount_fen: coupon_type === 'GUARD_DISCOUNT' ? '3000' : null })) };
const lottery: LotteryPolicy = { pool_code: 'MAIN', enabled: true, cost_pink_units: '1', no_win_probability_bps: 5000, prizes: prizeCodes.map((prize_code) => ({ prize_code, enabled: true, probability_bps: 1000, total_qty: '10', pink_reward_units: prize_code === 'PINK' ? '9223372036854775807' : null })) };
const inventory: LotteryInventory[] = prizeCodes.map((prize_code) => ({ prize_code, issued_qty: '2', total_qty: '10', remaining_qty: '8', version: '1' }));
it('requires exact fixed codes and explicit guard amount while preserving fixed rights', () => {
  expect(isCouponsPolicy(coupons)).toBe(true); expect(isLotteryPolicy(lottery)).toBe(true);
  expect(isCouponsPolicy({ coupons: [...coupons.coupons.slice(1), coupons.coupons[1]] })).toBe(false);
  expect(isLotteryPolicy({ ...lottery, prizes: [...lottery.prizes, { prize_code: 'NO_WIN' }] })).toBe(false);
  expect(parseCouponDraft(couponDraft(null)).ok).toBe(false);
  expect(parseCouponDraft(couponDraft(coupons))).toEqual({ ok: true, value: coupons });
  expect(couponRightsText({ kind: 'PUBLISH_ONCE', publish_quota_qty: '1' })).toContain('1 次');
  expect(isLoyaltySaveRequest({ base_effective_epoch: '9007199254740993', reason: '原配置原因', value: coupons })).toBe(true);
});
it('keeps bigint quantity exact and rejects probability drift, empty enabled stock and disabled coupon dependency', () => {
  const draft = lotteryDraft(lottery); expect(parseLotteryDraft(draft, inventory, coupons)).toEqual({ ok: true, value: lottery });
  draft.noWin = '49.99'; expect(parseLotteryDraft(draft, inventory, coupons)).toMatchObject({ ok: false, message: expect.stringContaining('差额 0.01%') });
  draft.noWin = '50.00'; draft.prizes[0]!.total = '2'; expect(parseLotteryDraft(draft, inventory, coupons)).toMatchObject({ ok: false, message: expect.stringContaining('剩余库存') });
  draft.prizes[0]!.total = '10'; const disabled = structuredClone(coupons); disabled.coupons[0]!.enabled = false;
  expect(parseLotteryDraft(draft, inventory, disabled)).toMatchObject({ ok: false, message: expect.stringContaining('先在优惠券管理启用') });
});
it('accepts all-NO_WIN only with pool disabled and never normalizes draft probabilities', () => {
  const draft = lotteryDraft(lottery); draft.noWin = '100'; draft.prizes.forEach((row) => { row.enabled = false; row.probability = '0'; });
  expect(parseLotteryDraft(draft, inventory, coupons).ok).toBe(false);
  draft.enabled = false; expect(parseLotteryDraft(draft, inventory, coupons).ok).toBe(true);
  expect(draft.noWin).toBe('100'); expect(draft.prizes.map((row) => row.probability)).toEqual(['0', '0', '0', '0', '0']);
  const after = structuredClone(coupons); after.coupons[3]!.insurance_discount_fen = '3001';
  expect(policyDifferences(coupons, after)).toEqual([{ field: 'coupons.GUARD_DISCOUNT.rights', label: '保障抵扣券权益', before: '30.00 元', after: '30.01 元' }]);
});
