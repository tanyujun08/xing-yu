import { ACCOUNT, clone, schema, type DemoState, type Row } from './seed';
import { addPoints, businessDay, entitlement, grant, iso, list, nextId, quantity, requireRule, rules, time } from './rule-core';

export const checkInRule = { rule_version_id: 'check-in-demo-v2', policy: { schema_version: 2, timezone: 'Asia/Shanghai', daily_rewards: [{ kind: 'PINK', units: '100' }], first_rewards: [{ kind: 'PINK', units: '500' }], milestones: [{ days: 7, rewards: [{ kind: 'PINK', units: '300' }] }] } };
export function couponRights(kind: string): Row {
 return kind === 'DEPOSIT_WAIVER' ? { kind, deposit_waiver: 'FULL' } : kind === 'PUBLISH_ONCE' ? { kind, publish_quota_quantity: '1' } : kind === 'ONE_DAY_RENT' ? { kind, rental_days: '1' } : { kind, insurance_discount_fen: '2000' };
}
function coupon(s: DemoState, kind: string, source: string, sourceId: string): Row {
 const c = { ...schema('MemberCoupon'), coupon_id: nextId(s, 'coupon'), account_id: ACCOUNT, coupon_type: kind, rights_snapshot: couponRights(kind), status: 'AVAILABLE', source_kind: source, source_id: sourceId, issued_at: iso(s), version: '1', allowed_actions: { can_redeem: kind === 'PUBLISH_ONCE' } };
 s.coupons.unshift(c); return c;
}
export function expireCoupons(s: DemoState): void {
 for (const c of s.coupons) {
  if (c.status === 'AVAILABLE' && c.expires_at && Date.parse(c.expires_at) <= time(s)) { c.status = 'EXPIRED'; c.version = String(Number(c.version) + 1); }
  c.allowed_actions = { can_redeem: c.status === 'AVAILABLE' && !rules(s).couponReservations[c.coupon_id] && c.coupon_type === 'PUBLISH_ONCE' };
 }
}
function checked(s: DemoState): Row[] {
 const rows = rules(s).checkIns;
 // Preserve prior demo sign-ins without inventing or granting old rewards again.
 let streak = 0, previous: string | null = null, previousId: string | null = null, cumulative = 0;
 for (const day of [...new Set(s.checkedDates)].sort()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
  cumulative++; streak = previous && Date.parse(day) - Date.parse(previous) === 86400000 ? streak + 1 : 1;
  rows[day] ??= { check_in: { check_in_id: 'legacy-demo-' + day, business_date: day, timezone: 'Asia/Shanghai', checked_in_at: day + 'T00:00:00Z', streak_days: String(streak), cumulative_days: String(cumulative), rule_version_id: 'legacy-demo', previous_check_in_id: previousId }, grants: [] };
  previous = day; previousId = rows[day].check_in.check_in_id;
 }
 return Object.values(rows) as Row[];
}
function sign(s: DemoState): Row {
 checked(s);
 const today = businessDay(s), r = rules(s), priorReceipt = r.checkIns[today];
 if (priorReceipt) return priorReceipt;
 const previous = checked(s).map(v => v.check_in).sort((a, b) => b.business_date.localeCompare(a.business_date))[0];
 const legacy = [...s.checkedDates].sort().reverse().find(v => v < today);
 const priorDate = previous?.business_date ?? legacy;
 const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
 const streak = priorDate === yesterday ? Number(previous?.streak_days ?? 1) + 1 : 1;
 const cumulative = Number(previous?.cumulative_days ?? s.checkedDates.length) + 1;
 const entry = { ...schema('MemberCheckIn'), check_in_id: nextId(s, 'checkin'), business_date: today, timezone: 'Asia/Shanghai', checked_in_at: iso(s), streak_days: String(streak), cumulative_days: String(cumulative), rule_version_id: checkInRule.rule_version_id, previous_check_in_id: previous?.check_in_id ?? null };
 const rewards = [...checkInRule.policy.daily_rewards, ...(cumulative === 1 ? checkInRule.policy.first_rewards : []), ...checkInRule.policy.milestones.filter(v => v.days === streak).flatMap(v => v.rewards)];
 const receipt = { check_in: entry, grants: rewards.map(reward => grant(s, reward, 'CHECK_IN', entry.check_in_id)) };
 r.checkIns[today] = receipt; if (!s.checkedDates.includes(today)) s.checkedDates.push(today); return receipt;
}
export function loyaltyRoute(s: DemoState, method: string, path: string, q: Row, body: Row, ids: Row, headers: Row): Row | undefined {
 const r = rules(s); expireCoupons(s);
 if (path === '/v1/me/check-in-rule') return checkInRule;
 if (path === '/v1/me/check-ins') {
  if (method === 'POST') return sign(s);
  const month = q.month ?? businessDay(s).slice(0, 7);
  requireRule(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), '月份格式无效', 'VALIDATION_FAILED', 422);
  return { month, today: businessDay(s), items: checked(s).filter(v => v.check_in.business_date.startsWith(month)).sort((a, b) => b.check_in.business_date.localeCompare(a.check_in.business_date)) };
 }
 if (ids.check_in_id) { const receipt = checked(s).find(v => v.check_in.check_in_id === ids.check_in_id); requireRule(receipt, '签到回执不存在', 'RESOURCE_NOT_FOUND', 404); return receipt; }
 if (ids.grant_id) { requireRule(r.grants[ids.grant_id], '奖励记录不存在', 'RESOURCE_NOT_FOUND', 404); const g = r.grants[ids.grant_id]; return { ...g, coupon_ids: g.coupon_id ? [g.coupon_id] : [], pink_entry_ids: g.point_entry_id ? [g.point_entry_id] : [] }; }
 if (path === '/v1/me/entitlement-movements') return list((Object.values(r.movements) as Row[]).filter(v => v.kind === 'PUBLISH_QUOTA').reverse(), q);
 if (ids.movement_id) { requireRule(r.movements[ids.movement_id], '权益流水不存在', 'RESOURCE_NOT_FOUND', 404); return r.movements[ids.movement_id]; }
 if (path === '/v1/me/point-entries') {
  const items = s.points.filter(v => v.point_kind === (q.point_kind ?? 'PINK') && (!q.direction || (Number(v.available_delta) >= 0 ? 'INCREASE' : 'DECREASE') === q.direction));
  const today = businessDay(s); const earned = items.filter(v => v.occurred_at?.startsWith(today) && Number(v.available_delta) > 0).reduce((n, v) => n + Number(v.available_delta), 0);
  return list(items, q, { account_id: ACCOUNT, account: { ...schema('MemberPointAccount'), point_kind: q.point_kind ?? 'PINK', available_points: String(q.point_kind === 'GROWTH' ? s.growth : s.pink) }, statistics: { ...schema('OwnPointStatistics'), today_earned_delta: String(earned), week_earned_delta: String(earned) }, as_of_at: iso(s) });
 }
 if (ids.entry_id) { const e = s.points.find(v => v.entry_id === ids.entry_id); requireRule(e, '积分流水不存在', 'RESOURCE_NOT_FOUND', 404); return { ...schema('PointEntryDetail'), ...e }; }
 if (path.includes('/growth-tasks/') && method === 'POST') {
  requireRule(/^task-[1-4]$/.test(ids.benefit_code), '任务不存在', 'RESOURCE_NOT_FOUND', 404);
  const slot = 'growth:' + ids.benefit_code;
  if (s.receipts[slot]) return { ...s.receipts[slot], replayed: true };
  const result = { task: { ...schema('OwnGrowthTask'), benefit_code: ids.benefit_code, state: 'COMPLETED', claimed_count: '1', claimable_count: '0', progress_count: '1', cycle_key: 'DEMO' }, grants: [{ kind: 'GROWTH', units: '100' }, { kind: 'PINK', units: '50' }].map(v => grant(s, v, 'GROWTH_TASK', ids.benefit_code)), replayed: false };
  s.receipts[slot] = result; return result;
 }
 if (path.includes('/coupons/') && path.endsWith('/redemptions')) {
  const c = s.coupons.find(v => v.coupon_id === ids.coupon_id);
  requireRule(c, '优惠券不存在', 'RESOURCE_NOT_FOUND', 404);
  requireRule(c.status === 'AVAILABLE' && !r.couponReservations[c.coupon_id], '优惠券已使用、过期或被订单占用');
  requireRule(body.expected_coupon_version === c.version, '券版本已变化', 'VERSION_CONFLICT', 412);
  requireRule(c.coupon_type === 'PUBLISH_ONCE', '此类型优惠券应在下单时使用，不能兑换额度');
  const kind = 'PUBLISH_QUOTA';
  const m = entitlement(s, kind, 1, 'COUPON_REDEMPTION', c.coupon_id), id = nextId(s, 'redemption');
  const result = { ...schema('CouponRedemptionAttempt'), account_id: ACCOUNT, attempt_id: id, redemption_id: id, coupon_id: c.coupon_id, expected_coupon_version: c.version, state: 'COMPLETED', reason_code: null, quantity: '1', entitlement_lot_id: 'lot-' + id, movement_id: m.movement_id, available_before_qty: m.available_before_qty, available_after_qty: m.available_after_qty, received_at: iso(s), resolved_at: iso(s), replayed: false };
  c.status = 'REDEEMED'; c.version = String(Number(c.version) + 1); r.redemptions[id] = result; return result;
 }
 if (/coupon-redemption/.test(path)) {
  const values = Object.values(r.redemptions) as Row[];
  if (path.endsWith('coupon-redemption-attempts')) return list(values.filter(v => !q.state || v.state === q.state).reverse(), q);
  if (path.endsWith('coupon-redemption-intent')) return intentResult(s, headers, 'redemptions');
  const result = values.find(v => v.attempt_id === ids.attempt_id || v.redemption_id === ids.redemption_id);
  requireRule(result, '兑换记录不存在', 'RESOURCE_NOT_FOUND', 404); return result;
 }
 if (path === '/v1/me/entitlement-purchases' && method === 'POST') {
  requireRule(['contract-demo', 'publish_quota-demo'].includes(body.offer_code), '权益商品不存在', 'RESOURCE_NOT_FOUND', 404);
  const qty = quantity(body.quantity, '购买数量', 1); requireRule(qty <= 100, '单次最多购买 100 份');
  requireRule(!body.cost_unit || body.cost_unit === 'PINK_POINT', '离线权益购买仅支持演示粉钻');
  const kind = body.offer_code === 'contract-demo' ? 'CONTRACT' : 'PUBLISH_QUOTA', id = nextId(s, 'purchase');
  const spend = addPoints(s, 'PINK', -qty * 100, 'ENTITLEMENT_PURCHASE', id), m = entitlement(s, kind, qty, 'ENTITLEMENT_PURCHASE', id);
  const result = { ...schema('OwnEntitlementPurchase'), purchase_id: id, purchase_no: id, name: kind === 'CONTRACT' ? '电子合同' : '发布额度', offer_code: body.offer_code, kind, quantity: String(qty), cost_unit: 'PINK_POINT', purchase_model: 'PINK_IMMEDIATE', unit_price: '100', gross_cost: String(qty * 100), discount_cost: '0', total_cost: String(qty * 100), consideration_status: 'PAID', grant_status: 'GRANTED', refund_status: 'NONE', movement_id: m.movement_id, point_entry_id: spend.entry_id, settled_at: iso(s), granted_at: iso(s), created_at: iso(s), closed_at: null };
  s.purchases.unshift(result); return result;
 }
 if (path === '/v1/me/cash-balance') return { currency: 'CNY', available_fen: String(r.cashAvailable ?? 128800), frozen_fen: '26000', withdrawable_fen: String(r.cashAvailable ?? 128800), as_of_at: iso(s) };
 if (path === '/v1/me/withdrawals') {
  r.withdrawals ??= [];
  if (method === 'GET') return list(r.withdrawals, q);
  const amount = quantity(body.amount_fen, '提现金额', 100), available = Number(r.cashAvailable ?? 128800);
  requireRule(amount <= available, '可提现余额不足', 'INSUFFICIENT_BALANCE');
  const record = { ...schema('OwnWithdrawal'), withdrawal_id: nextId(s, 'withdrawal'), status: 'SUCCEEDED', state: 'COMPLETED', amount_fen: String(amount), currency: 'CNY', submitted_at: iso(s), created_at: iso(s) };
  r.cashAvailable = available - amount; r.withdrawals.unshift(record); return record;
 }
 if (!/lottery/.test(path) || path === '/v1/me/lottery') return undefined;
 if (path.endsWith('lottery-intent')) return intentResult(s, headers, 'lotteries');
 if (path.endsWith('lottery-attempts')) return list((Object.values(r.lotteries) as Row[]).filter(v => (!q.state || v.state === q.state) && (!q.result_kind || v.result_kind === q.result_kind)).reverse(), q);
 if (method === 'POST') {
  requireRule(body.confirmed_cost_pink_units === '50' && body.expected_lottery_config_version_id === 'lottery-demo' && body.expected_coupon_config_version_id === 'coupon-demo', '抽奖规则已经变化，请刷新', 'VERSION_CONFLICT', 412);
  const id = nextId(s, 'lottery'), count = Object.keys(r.lotteries).length, prize = ['PINK', 'DEPOSIT_WAIVER', 'PUBLISH_ONCE', 'ONE_DAY_RENT', 'GUARD_DISCOUNT', 'NO_WIN'][count % 6]!;
  const spend = addPoints(s, 'PINK', -50, 'LOTTERY', id);
  const reward = prize === 'PINK' ? grant(s, { kind: 'PINK', units: '100' }, 'LOTTERY', id) : null;
  const c = !['PINK', 'NO_WIN'].includes(prize) ? coupon(s, prize, 'LOTTERY', id) : null;
  const result = { ...schema('LotteryAttempt'), account_id: ACCOUNT, attempt_id: id, draw_id: 'draw-' + id, state: 'COMPLETED', result_kind: prize === 'NO_WIN' ? 'NO_WIN' : 'WIN', prize_code: prize === 'NO_WIN' ? null : prize, prize_snapshot: prize === 'NO_WIN' ? null : { prize_code: prize, prize_qty: '1', pink_reward_units: prize === 'PINK' ? '100' : null, rights_snapshot: c?.rights_snapshot ?? null }, confirmed_cost_pink_units: '50', cost_pink_units: '50', balance_after: String(s.pink), coupon_id: c?.coupon_id ?? null, pink_spend_entry_id: spend.entry_id, pink_reward_entry_id: reward?.point_entry_id ?? null, grant_id: reward?.grant_id ?? (c ? 'grant-' + id : null), inventory_movement_id: prize === 'NO_WIN' ? null : 'inventory-' + id, received_at: iso(s), completed_at: iso(s), reason_code: null, error_code: null };
  if (c) r.grants[result.grant_id] = { ...schema('BenefitGrantTrace'), account_id: ACCOUNT, grant_id: result.grant_id, reward_kind: 'COUPON', reward_code: prize, reward_units: '1', coupon_id: c.coupon_id, created_at: iso(s), source_kind: 'LOTTERY', source_id: id };
  r.lotteries[id] = result; return result;
 }
 const found = (Object.values(r.lotteries) as Row[]).find(v => v.attempt_id === ids.attempt_id || v.draw_id === ids.draw_id);
 requireRule(found, '抽奖记录不存在', 'RESOURCE_NOT_FOUND', 404); return found;
}
function intentResult(s: DemoState, headers: Row, collection: string): Row {
 const key = headers['Idempotency-Key'] ?? headers['idempotency-key'];
 const record = rules(s).intents[key];
 const result = record && rules(s)[collection][record.data.attempt_id];
 return result ? clone(result) : { state: 'NOT_FOUND', attempt: null };
}
