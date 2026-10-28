import { ACCOUNT, clone, schema, type DemoState, type Row } from './seed';

export class DemoProblem extends Error {
 constructor(public code: string, message: string, public status = 422) { super(message); }
}
export function requireRule(ok: unknown, message: string, code = 'RESOURCE_CONFLICT', status = 409): asserts ok {
 if (!ok) throw new DemoProblem(code, message, status);
}
export function rules(s: DemoState): Row {
 s.rules ??= {};
 const r = s.rules;
 r.dayOffset ??= 0; r.sequence ??= 0;
 r.entitlements ??= { CONTRACT: 36, PUBLISH_QUOTA: 36 };
 r.entitlementGranted ??= { CONTRACT: 50, PUBLISH_QUOTA: 50 };
 r.entitlementConsumed ??= { CONTRACT: 14, PUBLISH_QUOTA: 14 };
 for (const key of ['checkIns', 'grants', 'movements', 'lotteries', 'redemptions', 'intents', 'paymentResults', 'couponReservations']) r[key] ??= {};
 return r;
}
export const time = (s: DemoState) => Date.now() + Number(rules(s).dayOffset) * 86400000;
export const iso = (s: DemoState) => new Date(time(s)).toISOString();
export const businessDay = (s: DemoState) => new Date(time(s) + 8 * 3600000).toISOString().slice(0, 10);
export function nextId(s: DemoState, kind: string): string { return 'demo-' + kind + '-' + (++rules(s).sequence); }
export function quantity(value: unknown, label: string, minimum = 0): number {
 requireRule(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value), label + '必须是非负整数', 'VALIDATION_FAILED', 422);
 const n = Number(value);
 requireRule(Number.isSafeInteger(n) && n >= minimum, label + '超出可用范围', 'VALIDATION_FAILED', 422);
 return n;
}
export function list(items: Row[], q: Row, extra: Row = {}): Row {
 const size = Math.max(1, Math.min(30, Number(q.page_size ?? q.limit ?? 20) || 20));
 const start = Math.max(0, Number(q.cursor) || 0), more = start + size < items.length, cursor = more ? String(start + size) : null;
 return { items: clone(items.slice(start, start + size)), page: { page_size: size, has_more: more, next_cursor: cursor }, has_more: more, next_cursor: cursor, ...extra };
}
export function addPoints(s: DemoState, kind: 'PINK' | 'GROWTH', delta: number, source: string, sourceId: string): Row {
 const field = kind === 'PINK' ? 'pink' : 'growth', before = s[field];
 requireRule(Number.isSafeInteger(delta) && Number.isSafeInteger(before + delta) && before + delta >= 0, '积分余额不足或数值无效', 'INSUFFICIENT_BALANCE');
 s[field] += delta;
 const entry = { ...schema('OwnPointEntry'), entry_id: nextId(s, 'point'), account_id: ACCOUNT, point_kind: kind, account_sequence: String(s.points.length + 1), action: delta >= 0 ? 'GRANT' : 'SPEND', available_delta: String(delta), available_before: String(before), available_after: String(s[field]), reserved_after: '0', reserved_delta: '0', earned_delta: String(Math.max(delta, 0)), source_kind: source, source_id: sourceId, occurred_at: iso(s) };
 s.points.unshift(entry); return entry;
}
export function entitlement(s: DemoState, kind: string, delta: number, source: string, sourceId: string): Row {
 const r = rules(s), before = Number(r.entitlements[kind] ?? 0);
 requireRule(Number.isSafeInteger(delta) && before + delta >= 0, '权益额度不足', 'INSUFFICIENT_BALANCE');
 r.entitlements[kind] = before + delta;
 if (delta >= 0) r.entitlementGranted[kind] = Number(r.entitlementGranted[kind] ?? before) + delta;
 else r.entitlementConsumed[kind] = Number(r.entitlementConsumed[kind] ?? 0) - delta;
 const id = nextId(s, 'movement'), movement = { ...schema('EntitlementMovementDetail'), movement_id: id, account_id: ACCOUNT, kind, action: delta >= 0 ? 'GRANT' : 'CONSUME', quantity: String(Math.abs(delta)), available_before_qty: String(before), available_after_qty: String(before + delta), reserved_after_qty: '0', source_kind: source, source_id: sourceId, occurred_at: iso(s) };
 r.movements[id] = movement; return movement;
}
export function grant(s: DemoState, reward: Row, source: string, sourceId: string): Row {
 const id = nextId(s, 'grant'), amount = quantity(String(reward.units ?? reward.quantity ?? '1'), '奖励数量', 1);
 let point: Row | undefined, movement: Row | undefined;
 if (reward.kind === 'PINK' || reward.kind === 'GROWTH') point = addPoints(s, reward.kind, amount, source, sourceId);
 else movement = entitlement(s, reward.kind, amount, source, sourceId);
 const result = { grant_id: id, reward_kind: point ? 'POINT' : 'ENTITLEMENT', reward_code: reward.kind, reward_units: String(amount), coupon_id: null, point_entry_id: point?.entry_id ?? null, entitlement_movement_id: movement?.movement_id ?? null };
 rules(s).grants[id] = { ...schema('BenefitGrantTrace'), ...result, account_id: ACCOUNT, source_kind: source, source_id: sourceId, granted_at: iso(s) };
 return result;
}
export const etag = (value: Row) => '"DEMO:2:' + (value.version ?? value.order?.version ?? '1') + '"';
export function checkVersion(value: Row, headers: Row): void {
 const expected = headers['If-Match'] ?? headers['if-match'];
 if (expected) requireRule(expected === etag(value), '对象已经变化，请刷新后重新操作', 'VERSION_CONFLICT', 412);
}
