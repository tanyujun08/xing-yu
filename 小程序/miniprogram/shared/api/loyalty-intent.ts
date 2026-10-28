import { demoStorage } from '../../preview/storage';
import { newIdempotencyKey } from './idempotency';
import { readStoredApiSession } from '../session/api-session';
import {
  loyaltyIdentifier, sameLoyaltyRequest, snapshotLoyaltyBody, validLoyaltyIntent,
  type LoyaltyIntent, type LoyaltyOperation,
} from '../model/loyalty-intent';

const prefix = 'xingyu.loyalty-intent.v1:';

function storageKey(owner: string, operation: LoyaltyOperation): string {
  if (!loyaltyIdentifier(owner) || readStoredApiSession()?.accountId !== owner) {
    throw new Error('登录状态已变化，请重新读取。');
  }
  if (operation !== 'lottery' && operation !== 'coupon-redemption') throw new Error('原请求类型无效。');
  return prefix + encodeURIComponent(owner) + ':' + operation;
}

function clone<TBody extends object>(intent: LoyaltyIntent<TBody>): LoyaltyIntent<TBody> {
  return { ...intent, body: snapshotLoyaltyBody(intent.body) };
}

export function readLoyaltyIntent<TBody extends object = Record<string, unknown>>(
  owner: string, operation: LoyaltyOperation,
): LoyaltyIntent<TBody> | null {
  const value: unknown = demoStorage.getStorageSync(storageKey(owner, operation));
  if (value === undefined || value === null || value === '') return null;
  if (!validLoyaltyIntent(value, owner, operation)) {
    throw new Error('待核实请求记录不完整，请先查询本人未决尝试。');
  }
  return clone(value) as LoyaltyIntent<TBody>;
}

function store<TBody extends object>(intent: LoyaltyIntent<TBody>): LoyaltyIntent<TBody> {
  const key = storageKey(intent.owner, intent.operation);
  const copy = clone(intent);
  demoStorage.setStorageSync(key, copy);
  const readback = readLoyaltyIntent<TBody>(intent.owner, intent.operation);
  if (!readback || !sameLoyaltyRequest(readback, copy) || readback.attemptId !== copy.attemptId) {
    throw new Error('未能保存原请求，尚未提交。');
  }
  return readback;
}

/** A pending request has no timeout: callers must query the original server attempt. */
export function prepareLoyaltyIntent<TBody extends object>(
  owner: string, operation: LoyaltyOperation, body: TBody, resourceId: string | null = null,
): LoyaltyIntent<TBody> {
  const original = snapshotLoyaltyBody(body);
  const saved = readLoyaltyIntent<TBody>(owner, operation);
  if (saved) {
    if (saved.resourceId !== resourceId || !sameLoyaltyRequest(saved, { ...saved, resourceId, body: original })) {
      throw new Error('上一请求尚待核实，请先恢复原请求。');
    }
    return saved;
  }
  const intent: LoyaltyIntent<TBody> = {
    owner, operation, key: newIdempotencyKey(operation), resourceId, body: original, attemptId: null,
  };
  if (!validLoyaltyIntent(intent, owner, operation)) throw new Error('原请求标识不完整，尚未提交。');
  return store(intent);
}

/** Store only a query locator; never cache an outcome, deduction or reward as authority. */
export function locateLoyaltyIntent<TBody extends object>(intent: LoyaltyIntent<TBody>, attemptId: string): LoyaltyIntent<TBody> {
  const saved = readLoyaltyIntent<TBody>(intent.owner, intent.operation);
  if (!saved || !sameLoyaltyRequest(saved, intent)) throw new Error('待核实原请求已变化，请重新读取。');
  if (!loyaltyIdentifier(attemptId) || (saved.attemptId !== null && saved.attemptId !== attemptId)) {
    throw new Error('原请求尝试号不一致，请继续核实。');
  }
  if (saved.attemptId === attemptId) return saved;
  return store({ ...saved, attemptId });
}

/** Call only after a matching terminal attempt and all required server readbacks are verified. */
export function clearConfirmedLoyaltyIntent(intent: LoyaltyIntent<object>, confirmedAttemptId: string): void {
  const saved = readLoyaltyIntent(intent.owner, intent.operation);
  if (!saved || !sameLoyaltyRequest(saved, intent) || saved.attemptId !== confirmedAttemptId
    || !loyaltyIdentifier(confirmedAttemptId)) {
    throw new Error('终态与原请求不一致，继续保留待核实请求。');
  }
  const key = storageKey(intent.owner, intent.operation);
  demoStorage.removeStorageSync(key);
  if (readLoyaltyIntent(intent.owner, intent.operation)) throw new Error('原请求未能清除，请重新查询。');
}
