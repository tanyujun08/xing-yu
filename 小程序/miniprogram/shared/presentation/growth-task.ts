import type { GrowthTask, GrowthTaskList, GrowthTaskClaim, GrowthTaskGrant, GrowthTaskGrantTrace } from '../model/growth-task-intent';
import { loyaltyIdentifier } from '../model/loyalty-intent';
import { displayQuantity } from '../format/quantity';
import { displayGrowthUnits } from './api-points';
import { couponTitles } from './loyalty';

function validCount(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
}

function assertTask(task: GrowthTask): void {
  if (!loyaltyIdentifier(task.benefit_code) || !['REGISTER', 'VIEW_ASSET'].includes(task.task_code)
    || !['LIFETIME', 'DAY', 'MONTH'].includes(task.period) || !task.cycle_key
    || ![task.limit, task.progress_count, task.claimed_count, task.claimable_count].every(validCount)
    || task.limit === '0' || BigInt(task.claimed_count) > BigInt(task.limit)
    || BigInt(task.claimed_count) > BigInt(task.progress_count)
    || BigInt(task.claimable_count) > BigInt(task.limit) - BigInt(task.claimed_count)
    || BigInt(task.claimable_count) > BigInt(task.progress_count) - BigInt(task.claimed_count)
    || !['IN_PROGRESS', 'CLAIMABLE', 'COMPLETED'].includes(task.state)
    || (task.state === 'CLAIMABLE') !== (task.claimable_count !== '0')
    || (task.state === 'COMPLETED') !== (task.claimed_count === task.limit)
    || !Array.isArray(task.rewards) || task.rewards.length === 0) throw new Error('任务进度响应无效，请重新读取。');
  task.rewards.forEach(reward => {
    if (reward.kind === 'PINK' || reward.kind === 'GROWTH') {
      if (displayQuantity(reward.units) === '—' || reward.units === '0') throw new Error('任务奖励响应无效。');
    } else if (!Number.isSafeInteger(reward.quantity) || (reward.quantity ?? 0) <= 0
      || !['CONTRACT', 'PUBLISH_QUOTA', 'COUPON'].includes(reward.kind)
      || reward.kind === 'COUPON' && (!reward.coupon_type || !couponTitles[reward.coupon_type])) throw new Error('任务奖励响应无效。');
  });
}

export function assertGrowthTaskList(list: GrowthTaskList): void {
  if (!Array.isArray(list.items) || typeof list.enabled !== 'boolean' || !Number.isFinite(Date.parse(list.as_of_at))
    || list.enabled && !loyaltyIdentifier(list.rule_version_id)
    || !list.enabled && (!list.disabled_reason || list.items.length !== 0)
    || new Set(list.items.map(item => item.benefit_code)).size !== list.items.length) throw new Error('任务清单响应无效，请重新读取。');
  list.items.forEach(assertTask);
}

export function growthRewardText(task: GrowthTask): string {
  return task.rewards.map(item => item.kind === 'PINK' ? item.units + ' 粉钻'
    : item.kind === 'GROWTH' ? displayGrowthUnits(item.units) + ' 星光'
      : item.kind === 'COUPON' ? item.quantity + ' 张' + couponTitles[item.coupon_type!]
        : item.quantity + (item.kind === 'CONTRACT' ? ' 次合同权益' : ' 次发布额度')).join(' · ');
}

export function growthTaskView(task: GrowthTask) {
  assertTask(task);
  return {
    id: task.benefit_code, title: task.task_code === 'REGISTER' ? '注册任务' : '浏览设备任务',
    detail: '来源 ' + task.progress_count + ' · 已领取 ' + task.claimed_count + '/' + task.limit,
    reward: growthRewardText(task), done: task.state === 'COMPLETED', claimable: task.state === 'CLAIMABLE',
    progress: String(BigInt(task.claimed_count) * 100n / BigInt(task.limit)) + '%',
    progressText: '可领取 ' + task.claimable_count, actionText: task.state === 'COMPLETED' ? '已完成' : task.state === 'CLAIMABLE' ? '领取奖励' : '未完成',
  };
}

export function growthGrantText(grant: GrowthTaskGrant): string {
  if (grant.reward_code === 'GROWTH') return displayGrowthUnits(grant.reward_units) + ' 星光';
  if (grant.reward_code === 'PINK') return grant.reward_units + ' 粉钻';
  if (grant.reward_kind === 'COUPON') return grant.reward_units + ' 张' + couponTitles[grant.reward_code as keyof typeof couponTitles];
  return grant.reward_units + (grant.reward_code === 'CONTRACT' ? ' 次合同权益' : ' 次发布额度');
}

export function assertGrowthTaskClaim(receipt: GrowthTaskClaim, benefitCode: string): void {
  assertTask(receipt.task);
  if (receipt.task.benefit_code !== benefitCode || receipt.task.claimed_count === '0' || typeof receipt.replayed !== 'boolean'
    || !Array.isArray(receipt.grants) || receipt.grants.length === 0
    || new Set(receipt.grants.map(grant => grant.grant_id)).size !== receipt.grants.length) throw new Error('原领取回执不一致，请继续核实。');
  receipt.grants.forEach(grant => {
    const point = grant.reward_kind === 'POINT' && ['PINK', 'GROWTH'].includes(grant.reward_code);
    const entitlement = grant.reward_kind === 'ENTITLEMENT' && ['CONTRACT', 'PUBLISH_QUOTA'].includes(grant.reward_code);
    const coupon = grant.reward_kind === 'COUPON' && Object.prototype.hasOwnProperty.call(couponTitles, grant.reward_code);
    if (!loyaltyIdentifier(grant.grant_id) || displayQuantity(grant.reward_units) === '—' || grant.reward_units === '0'
      || !(point || entitlement || coupon) || (coupon ? !loyaltyIdentifier(grant.coupon_id) || grant.reward_units !== '1' : grant.coupon_id !== null)) throw new Error('奖励回执不完整，请继续核实。');
  });
}

export function assertGrowthGrantTrace(trace: GrowthTaskGrantTrace, grant: GrowthTaskGrant, owner: string): void {
  if (trace.account_id !== owner || trace.grant_id !== grant.grant_id || trace.source_kind !== 'PROGRESS'
    || !loyaltyIdentifier(trace.source_id) || !Number.isSafeInteger(trace.source_award_ordinal) || trace.source_award_ordinal < 1 || trace.source_award_ordinal > 65535
    || trace.reward_kind !== grant.reward_kind || trace.reward_code !== grant.reward_code || trace.reward_units !== grant.reward_units
    || !Array.isArray(trace.coupon_ids) || (grant.coupon_id === null ? trace.coupon_ids.length !== 0 : trace.coupon_ids.length !== 1 || trace.coupon_ids[0] !== grant.coupon_id)
    || !Array.isArray(trace.pink_entry_ids) || trace.pink_entry_ids.some(id => !loyaltyIdentifier(id))
    || trace.pink_entry_ids.length !== (grant.reward_code === 'PINK' ? 1 : 0)) throw new Error('奖励事实与原领取回执不一致，请继续核实。');
}
