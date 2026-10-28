import { readMockState, writeMockState, type MockRootState, type MockBenefitRecordKind } from './mock-store';
import { getMockMemberRules } from './member-rules';

export function memberDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export interface MemberReward { starPoints?: number; diamondPoints?: number; note: string; insurance?: number[]; rental?: number[]; }

/** The caller commits this state once together with its triggering business fact. */
export function applyMemberReward(state: MockRootState, kind: MockBenefitRecordKind, key: string, reward: MemberReward, outcome: 'success' | 'failure' = 'success') {
  const userId = state.currentAccountId;
  state.benefitRecords ??= [];
  const existing = state.benefitRecords.find((record) => record.userId === userId && record.businessKey === key);
  if (existing?.status === 'succeeded') return { ok: true, record: { ...existing }, reason: '' };
  if (!key.trim()) return { ok: false, record: null, reason: '权益操作缺少业务标识' };
  const rules = getMockMemberRules();
  const succeeded = outcome === 'success';
  const starPoints = succeeded ? Math.max(0, Math.floor(reward.starPoints ?? 0)) : 0;
  const diamondPoints = succeeded ? Math.max(0, Math.floor(reward.diamondPoints ?? 0)) : 0;
  const createdAt = new Date().toISOString();
  const record = { id: existing?.id ?? `benefit-${state.sequence++}`, userId, kind, businessKey: key, status: succeeded ? 'succeeded' as const : 'failed' as const, starPoints, diamondPoints, createdAt, note: succeeded ? reward.note : `${reward.note}，暂未发放`, ruleVersion: rules.version };
  if (existing) Object.assign(existing, record); else state.benefitRecords.unshift(record);
  if (succeeded) {
    state.starBalances ??= {};
    state.starBalances[userId] = (state.starBalances[userId] ?? 0) + starPoints;
    state.diamondBalances[userId] = (state.diamondBalances[userId] ?? 0) + diamondPoints;
    state.starLedger ??= [];
    state.diamondLedger ??= [];
    for (const [points, ledger] of [[starPoints, state.starLedger], [diamondPoints, state.diamondLedger]] as const) {
      if (points) ledger.unshift({ id: `reward-ledger-${state.sequence++}`, userId, businessKey: `${key}:credit`, direction: 'credit', points, note: reward.note, createdAt });
    }
    const expires = new Date();
    expires.setDate(expires.getDate() + rules.couponValidDays);
    for (const type of ['insurance', 'rental'] as const) {
      for (const yuan of reward[type] ?? []) state.vouchers.push({ id: `reward-voucher-${state.sequence++}`, ownerUserId: userId, type, amountFen: Math.round(yuan * 100), expiresAt: expires.toISOString(), state: 'available', orderId: null, redemptionKey: key, ruleVersion: rules.version });
    }
  }
  return { ok: succeeded, record: { ...record }, reason: succeeded ? '' : '权益结果未确认，请稍后查询或重试' };
}

export function memberStreak(state = readMockState()) {
  const days = new Set((state.benefitRecords ?? []).filter((record) => record.userId === state.currentAccountId && record.kind === 'check_in' && record.status === 'succeeded').map((record) => record.businessKey.slice('check-in:'.length)));
  const cursor = new Date();
  if (!days.has(memberDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  let start = memberDay(cursor);
  while (days.has(memberDay(cursor))) { start = memberDay(cursor); count++; cursor.setDate(cursor.getDate() - 1); }
  return { count, start };
}

export function completeMemberCheckIn(outcome: 'success' | 'failure' = 'success') {
  const state = readMockState();
  const rules = getMockMemberRules();
  const result = applyMemberReward(state, 'check_in', `check-in:${memberDay()}`, rules.daily, outcome);
  if (result.ok) {
    applyMemberReward(state, 'growth_task', 'growth:checkin', rules.growth.checkin);
    const streak = memberStreak(state);
    const currentRuleStreak = (state.benefitRecords ?? []).filter((record) => record.userId === state.currentAccountId && record.kind === 'check_in' && record.status === 'succeeded' && record.businessKey >= `check-in:${streak.start}` && record.businessKey <= `check-in:${memberDay()}`);
    for (const milestone of rules.milestones) if (streak.count === milestone.days && currentRuleStreak.length === streak.count && currentRuleStreak.every((record) => record.ruleVersion === rules.version)) {
      applyMemberReward(state, 'growth_task', `streak:${streak.start}:${milestone.days}`, { ...milestone, note: `连签${milestone.days}天奖励` });
    }
  }
  writeMockState(state);
  return result;
}

export function profileComplete(state = readMockState()): boolean {
  const id = state.currentAccountId;
  const name = state.profileNames?.[id] ?? state.accounts.find((account) => account.id === id)?.name;
  return Boolean(name?.trim() && state.profileAvatars?.[id]?.trim());
}

export function growthEligible(state: MockRootState, taskId: string): boolean {
  const id = state.currentAccountId;
  return taskId === 'profile' ? profileComplete(state)
    : taskId === 'identity' ? state.identityProfiles[id]?.status === 'verified'
      : taskId === 'checkin' ? (state.benefitRecords ?? []).some((record) => record.userId === id && record.kind === 'check_in' && record.status === 'succeeded')
        : taskId === 'publish' ? state.listings.some((listing) => listing.lessorUserId === id) : false;

}

export function settleGrowthTask(state: MockRootState, taskId: string, outcome: 'success' | 'failure' = 'success') {
  const rules = getMockMemberRules();
  const eligible = growthEligible(state, taskId);
  if (!eligible || !Object.prototype.hasOwnProperty.call(rules.growth, taskId)) return { ok: false, record: null, reason: '任务尚未完成或不支持该任务' };
  return applyMemberReward(state, 'growth_task', `growth:${taskId}`, rules.growth[taskId as keyof typeof rules.growth], outcome);
}

/** Invoked only after a validated detail was opened, never by refresh queries. */
export function recordMemberVisit(kind: string, objectId: string) {
  const state = readMockState();
  const mission = getMockMemberRules().missions.find((item) => item.id === kind);
  if (!mission) return false;
  state.memberVisits ??= [];
  const userId = state.currentAccountId;
  const day = memberDay();
  if (!state.memberVisits.some((visit) => visit.userId === userId && visit.day === day && visit.kind === kind && visit.objectId === objectId)) state.memberVisits.push({ userId, day, kind, objectId });
  const count = state.memberVisits.filter((visit) => visit.userId === userId && visit.day === day && visit.kind === kind).length;
  if (count >= mission.target) applyMemberReward(state, 'growth_task', `mission:${day}:${kind}`, { starPoints: mission.starPoints, note: `${mission.title}奖励` });
  writeMockState(state);
  return true;
}
