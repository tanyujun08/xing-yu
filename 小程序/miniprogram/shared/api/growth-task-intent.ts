import { demoStorage } from '../../preview/storage';
import { newIdempotencyKey } from './idempotency';
import { readStoredApiSession } from '../session/api-session';
import { loyaltyIdentifier } from '../model/loyalty-intent';
import { sameGrowthTaskIntent, validGrowthTaskIntent, type GrowthTaskIntent } from '../model/growth-task-intent';

function storageKey(owner: string): string {
  if (!loyaltyIdentifier(owner) || readStoredApiSession()?.accountId !== owner) throw new Error('登录状态已变化，请重新读取。');
  return 'xingyu.growth-task-intent.v1:' + encodeURIComponent(owner);
}

export function readGrowthTaskIntent(owner: string): GrowthTaskIntent | null {
  const value: unknown = demoStorage.getStorageSync(storageKey(owner));
  if (value === undefined || value === null || value === '') return null;
  if (!validGrowthTaskIntent(value, owner)) throw new Error('原领取请求记录不完整，不能提交新请求。');
  return { ...value, body: {} };
}

export function prepareGrowthTaskIntent(owner: string, benefitCode: string): GrowthTaskIntent {
  if (!loyaltyIdentifier(benefitCode)) throw new Error('任务标识无效，尚未提交。');
  const saved = readGrowthTaskIntent(owner);
  if (saved) {
    if (saved.benefitCode !== benefitCode) throw new Error('上一领取结果尚待核实，请先恢复原请求。');
    return saved;
  }
  const intent: GrowthTaskIntent = { owner, benefitCode, key: newIdempotencyKey('growth-task'), body: {} };
  if (!validGrowthTaskIntent(intent, owner)) throw new Error('原领取请求无效，尚未提交。');
  demoStorage.setStorageSync(storageKey(owner), intent);
  const readback = readGrowthTaskIntent(owner);
  if (!readback || !sameGrowthTaskIntent(readback, intent)) throw new Error('未能保存原请求，尚未提交。');
  return readback;
}

/** Only after the original receipt, grant facts and current owner reads are verified. */
export function clearConfirmedGrowthTaskIntent(intent: GrowthTaskIntent): void {
  const saved = readGrowthTaskIntent(intent.owner);
  if (!saved || !sameGrowthTaskIntent(saved, intent)) throw new Error('原领取请求已变化，继续保留待核实请求。');
  demoStorage.removeStorageSync(storageKey(intent.owner));
  if (readGrowthTaskIntent(intent.owner)) throw new Error('原请求未能清除，请继续核实。');
}
