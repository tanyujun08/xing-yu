import { expect, test } from 'vitest';
import { assertGrowthTaskList, assertGrowthTaskClaim, assertGrowthGrantTrace, growthTaskView } from '../miniprogram/shared/presentation/growth-task';
import type { GrowthTask, GrowthTaskList, GrowthTaskClaim, GrowthTaskGrantTrace } from '../miniprogram/shared/model/growth-task-intent';

const task: GrowthTask = {
  benefit_code: 'server-register', task_code: 'REGISTER', period: 'LIFETIME', cycle_key: 'LIFETIME',
  limit: '9007199254740993', progress_count: '9007199254740993', claimed_count: '9007199254740992', claimable_count: '1', state: 'CLAIMABLE',
  rewards: [{ kind: 'GROWTH', units: '123', quantity: null, valid_days: null, coupon_type: null }, { kind: 'COUPON', units: null, quantity: 1, valid_days: null, coupon_type: 'PUBLISH_ONCE' }],
};
const list: GrowthTaskList = { enabled: true, disabled_reason: '', rule_version_id: 'rule', as_of_at: '2026-10-02T00:00:00Z', items: [task] };

test('projects only real source counts, reward units and configured coupons without four guessed tasks', () => {
  assertGrowthTaskList(list);
  expect(growthTaskView(task)).toMatchObject({ id: 'server-register', title: '注册任务', claimable: true, done: false, reward: '12.3 星光 · 1 张发布一次券', progress: '99%' });
  expect(growthTaskView(task).detail).toContain('9007199254740992/9007199254740993');
  expect(growthTaskView({ ...task, task_code: 'VIEW_ASSET', progress_count: '0', claimed_count: '0', claimable_count: '0', state: 'IN_PROGRESS' })).toMatchObject({ actionText: '未完成', claimable: false });
});

test('disabled configuration is explicit and inconsistent counts or duplicate task identities fail closed', () => {
  expect(() => assertGrowthTaskList({ ...list, items: [task, task] })).toThrow('清单');
  expect(() => growthTaskView({ ...task, claimable_count: '2' })).toThrow('进度');
  expect(() => growthTaskView({ ...task, state: 'COMPLETED' })).toThrow('进度');
  expect(() => assertGrowthTaskList({ ...list, enabled: false, disabled_reason: 'PUBLISHED_CONFIGURATION_REQUIRED', rule_version_id: null, items: [] })).not.toThrow();
});

test('receipt and grant readback require original benefit, owner, PROGRESS and exact immutable reward facts', () => {
  const receipt: GrowthTaskClaim = { task: { ...task, claimed_count: task.limit, claimable_count: '0', state: 'COMPLETED' }, grants: [{ grant_id: 'grant', reward_kind: 'COUPON', reward_code: 'PUBLISH_ONCE', reward_units: '1', coupon_id: 'coupon' }], replayed: false };
  const trace: GrowthTaskGrantTrace = { grant_id: 'grant', account_id: 'owner', source_kind: 'PROGRESS', source_id: 'source', source_rule_version_id: 'rule', source_award_ordinal: 2, reward_kind: 'COUPON', reward_code: 'PUBLISH_ONCE', reward_units: '1', coupon_ids: ['coupon'], pink_entry_ids: [], created_at: '2026-10-02T00:00:00Z' };
  assertGrowthTaskClaim(receipt, task.benefit_code);
  assertGrowthGrantTrace(trace, receipt.grants[0]!, 'owner');
  expect(() => assertGrowthTaskClaim(receipt, 'other')).toThrow('不一致');
  expect(() => assertGrowthTaskClaim({ ...receipt, grants: [receipt.grants[0]!, receipt.grants[0]!] }, task.benefit_code)).toThrow('不一致');
  expect(() => assertGrowthGrantTrace({ ...trace, account_id: 'other' }, receipt.grants[0]!, 'owner')).toThrow('不一致');
  expect(() => assertGrowthGrantTrace({ ...trace, coupon_ids: ['other'] }, receipt.grants[0]!, 'owner')).toThrow('不一致');
  expect(() => assertGrowthGrantTrace({ ...trace, source_award_ordinal: 65536 }, receipt.grants[0]!, 'owner')).toThrow('不一致');
  const pink = { grant_id: 'pink-grant', reward_kind: 'POINT' as const, reward_code: 'PINK' as const, reward_units: '25', coupon_id: null };
  const pinkTrace: GrowthTaskGrantTrace = { ...trace, grant_id: pink.grant_id, reward_kind: pink.reward_kind, reward_code: pink.reward_code, reward_units: pink.reward_units, coupon_ids: [], pink_entry_ids: ['entry'] };
  assertGrowthGrantTrace(pinkTrace, pink, 'owner');
  expect(() => assertGrowthGrantTrace({ ...pinkTrace, pink_entry_ids: [] }, pink, 'owner')).toThrow('不一致');
  expect(() => assertGrowthGrantTrace({ ...pinkTrace, pink_entry_ids: ['entry', 'duplicate'] }, pink, 'owner')).toThrow('不一致');
});
