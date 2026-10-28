import { Alert, Switch } from 'tdesign-react';
import type { CouponsPolicy, LotteryInventory } from '../../shared/services/loyaltyManagement';
import { LoyaltyTextInput } from './LoyaltyTextInput';
import { couponLabels, prizeLabel, type CouponDraft, type LotteryDraft } from './loyaltyPolicies';
import { formatLoyaltyMoney, loyaltyProbabilityTotal, parseLoyaltyInteger, parseLoyaltyMoney, parseLoyaltyPercent, validateLoyaltyStock } from './loyaltyInputs';

export function CouponPolicyFields({ draft, change, disabled, submitted, errors }: { draft: CouponDraft; change: (value: CouponDraft) => void; disabled: boolean; submitted: boolean; errors: Record<string, string> }) {
  return <div className="loyalty-policy-grid">{draft.coupons.map((row, index) => <section className="loyalty-policy-card" key={row.coupon_type}>
    <h3>{couponLabels[row.coupon_type]}</h3>
    <label className="loyalty-switch-label">启用<Switch disabled={disabled} value={row.enabled} onChange={(enabled) => change({ coupons: draft.coupons.map((item) => item.coupon_type === row.coupon_type ? { ...item, enabled: Boolean(enabled) } : item) })} /></label>
    {row.coupon_type === 'GUARD_DISCOUNT' ? <LoyaltyTextInput name="insurance_discount_fen" label="保障费用抵扣金额（元）" value={row.amount} onChange={(amount) => change({ coupons: draft.coupons.map((item) => item.coupon_type === row.coupon_type ? { ...item, amount } : item) })} parse={parseLoyaltyMoney} disabled={disabled} submitted={submitted} {...(errors[`coupons.${index}.insurance_discount_fen`] || errors[`coupons.${row.coupon_type}.insurance_discount_fen`] ? { serverError: errors[`coupons.${index}.insurance_discount_fen`] ?? errors[`coupons.${row.coupon_type}.insurance_discount_fen`] ?? '' } : {})} /> : <p>{row.coupon_type === 'DEPOSIT_WAIVER' ? '固定全额免押' : row.coupon_type === 'PUBLISH_ONCE' ? '固定增加 1 次发布额度' : '固定抵扣 1 天租金'}</p>}
    {errors[`coupons.${index}.enabled`] ? <p role="alert">{errors[`coupons.${index}.enabled`]}</p> : null}
  </section>)}</div>;
}
export function LotteryPolicyFields({ draft, change, inventory, coupons, disabled, submitted, errors }: { draft: LotteryDraft; change: (value: LotteryDraft) => void; inventory: readonly LotteryInventory[]; coupons: CouponsPolicy | null; disabled: boolean; submitted: boolean; errors: Record<string, string> }) {
  const total = loyaltyProbabilityTotal([...draft.prizes.map((row) => row.probability), draft.noWin]);
  return <div className="page-stack">
    <div className="loyalty-policy-grid"><label className="loyalty-switch-label">启用主奖池<Switch disabled={disabled} value={draft.enabled} onChange={(enabled) => change({ ...draft, enabled: Boolean(enabled) })} /></label>
      <LoyaltyTextInput name="cost_pink_units" label="每次抽奖消耗粉钻（整数）" value={draft.cost} onChange={(cost) => change({ ...draft, cost })} parse={(text) => parseLoyaltyInteger(text, true)} disabled={disabled} submitted={submitted} {...(errors.cost_pink_units ? { serverError: errors.cost_pink_units } : {})} /></div>
    {errors.enabled ? <p role="alert">{errors.enabled}</p> : null}
    <div className="loyalty-policy-grid">{draft.prizes.map((row, index) => {
      const stock = inventory.find((item) => item.prize_code === row.prize_code); const parsedTotal = parseLoyaltyInteger(row.total); const parsedIssued = parseLoyaltyInteger(stock?.issued_qty ?? '');
      const remaining = parsedTotal.ok && parsedIssued.ok && BigInt(parsedTotal.value) >= BigInt(parsedIssued.value) ? String(BigInt(parsedTotal.value) - BigInt(parsedIssued.value)) : '—';
      const patch = (value: Partial<typeof row>) => change({ ...draft, prizes: draft.prizes.map((item) => item.prize_code === row.prize_code ? { ...item, ...value } : item) });
      const coupon = row.prize_code === 'PINK' ? undefined : coupons?.coupons.find((item) => item.coupon_type === row.prize_code);
      return <section className="loyalty-policy-card" key={row.prize_code}><h3>{prizeLabel(row.prize_code)}</h3>
        <label className="loyalty-switch-label">启用奖品<Switch disabled={disabled} value={row.enabled} onChange={(enabled) => patch({ enabled: Boolean(enabled) })} /></label>
        {errors[`prizes.${index}.enabled`] ? <p role="alert">{errors[`prizes.${index}.enabled`]}</p> : null}
        <LoyaltyTextInput name={`prizes.${row.prize_code}.probability_bps`} label="中奖概率（%）" value={row.probability} onChange={(probability) => patch({ probability })} parse={parseLoyaltyPercent} disabled={disabled} submitted={submitted} {...(errors[`prizes.${index}.probability_bps`] ? { serverError: errors[`prizes.${index}.probability_bps`] } : {})} />
        <LoyaltyTextInput name={`prizes.${row.prize_code}.total_qty`} label="累计总份数" value={row.total} onChange={(value) => patch({ total: value })} parse={(value) => validateLoyaltyStock(value, stock?.issued_qty ?? '', row.enabled)} disabled={disabled} submitted={submitted} {...(errors[`prizes.${index}.total_qty`] ? { serverError: errors[`prizes.${index}.total_qty`] } : {})} />
        <p>已发 {stock?.issued_qty ?? '—'} 份 · 拟剩余 {remaining} 份</p>
        {row.prize_code === 'PINK' ? <LoyaltyTextInput name="pink_reward_units" label="每份粉钻奖励（整数）" value={row.reward} onChange={(reward) => patch({ reward })} parse={(value) => parseLoyaltyInteger(value, true)} disabled={disabled} submitted={submitted} {...(errors[`prizes.${index}.pink_reward_units`] ? { serverError: errors[`prizes.${index}.pink_reward_units`] } : {})} /> : <p>当前券权益：{coupon === undefined ? '尚未配置' : row.prize_code === 'GUARD_DISCOUNT' ? `${formatLoyaltyMoney(coupon.insurance_discount_fen ?? '')} 元保障费用抵扣` : row.prize_code === 'DEPOSIT_WAIVER' ? '全额免押' : row.prize_code === 'PUBLISH_ONCE' ? '固定 1 次发布额度' : '固定 1 天租金'} · {coupon?.enabled ? '券已启用' : '券未启用'}</p>}
      </section>;
    })}<section className="loyalty-policy-card"><h3>谢谢参与</h3><LoyaltyTextInput name="no_win_probability_bps" label="谢谢参与概率（%）" value={draft.noWin} onChange={(noWin) => change({ ...draft, noWin })} parse={parseLoyaltyPercent} disabled={disabled} submitted={submitted} {...(errors.no_win_probability_bps ? { serverError: errors.no_win_probability_bps } : {})} /><p>库存：— · 权益：—</p><p>正常消耗本次粉钻，不发奖励。</p></section></div>
    <Alert theme={total.ok && total.value.differenceBps === 0 ? 'success' : 'warning'} message={total.ok ? `概率合计 ${(total.value.totalBps / 100).toFixed(2)}%，距 100% 差额 ${(total.value.differenceBps / 100).toFixed(2)}%。` : '请填写六个概率，合计必须为 100.00%。'} />
  </div>;
}
