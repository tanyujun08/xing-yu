import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  clearConfirmedLoyaltyIntent, locateLoyaltyIntent, prepareLoyaltyIntent, readLoyaltyIntent,
} from '../miniprogram/shared/api/loyalty-intent';

const body = {
  expected_lottery_config_version_id: 'lottery-version',
  expected_coupon_config_version_id: 'coupon-version' as string | null,
  confirmed_cost_pink_units: '9007199254740993',
};
let owner: string;
let values: Map<string, unknown>;

beforeEach(() => {
  owner = 'owner';
  values = new Map();
  vi.stubGlobal('wx', {
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1'
      ? { accountId: owner, accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 }
      : values.get(key),
    setStorageSync: (key: string, value: unknown) => values.set(key, structuredClone(value)),
    removeStorageSync: (key: string) => values.delete(key),
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('original key and full body survive detached mutation, repeat preparation and a new login of the same account', () => {
  const input = structuredClone(body);
  const first = prepareLoyaltyIntent(owner, 'lottery', input);
  input.confirmed_cost_pink_units = '0';
  first.body.expected_lottery_config_version_id = 'forged';
  owner = 'other';
  expect(readLoyaltyIntent(owner, 'lottery')).toBeNull();
  owner = 'owner';
  const restored = prepareLoyaltyIntent(owner, 'lottery', body);
  expect(restored.key).toBe(first.key);
  expect(restored.body).toEqual(body);
  expect(values.size).toBe(1);
});

test('changed cost or config cannot replace a pending original request', () => {
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  expect(() => prepareLoyaltyIntent(owner, 'lottery', { ...body, confirmed_cost_pink_units: '10' })).toThrow('恢复原请求');
  expect(() => prepareLoyaltyIntent(owner, 'lottery', { ...body, expected_coupon_config_version_id: null })).toThrow('恢复原请求');
  expect(readLoyaltyIntent(owner, 'lottery')?.key).toBe(first.key);
});

test('JSON property order may differ on replay while original bytes and key are preserved', () => {
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  const replay = prepareLoyaltyIntent(owner, 'lottery', {
    confirmed_cost_pink_units: body.confirmed_cost_pink_units,
    expected_coupon_config_version_id: body.expected_coupon_config_version_id,
    expected_lottery_config_version_id: body.expected_lottery_config_version_id,
  });
  expect(replay).toEqual(first);
  expect(Object.keys(replay.body)).toEqual(Object.keys(body));
});

test('coupon redemption keeps the same coupon and version, and cannot be replaced by a second coupon', () => {
  const first = prepareLoyaltyIntent(owner, 'coupon-redemption', { expected_coupon_version: '9223372036854775807' }, 'coupon-1');
  expect(() => prepareLoyaltyIntent(owner, 'coupon-redemption', first.body, 'coupon-2')).toThrow('恢复原请求');
  expect(() => prepareLoyaltyIntent(owner, 'coupon-redemption', { expected_coupon_version: '2' }, 'coupon-1')).toThrow('恢复原请求');
  expect(readLoyaltyIntent(owner, 'coupon-redemption')?.resourceId).toBe('coupon-1');
});

test('another account cannot inspect, locate or clear the previous account original intent', () => {
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  owner = 'other';
  expect(() => readLoyaltyIntent('owner', 'lottery')).toThrow('登录状态');
  expect(() => locateLoyaltyIntent(first, 'attempt-1')).toThrow('登录状态');
  expect(() => clearConfirmedLoyaltyIntent(first, 'attempt-1')).toThrow('登录状态');
  expect(values.size).toBe(1);
});

test('only a stable query locator is persisted; unknown outcomes and elapsed days retain original intent', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  const located = locateLoyaltyIntent(first, 'attempt-1');
  vi.setSystemTime(Date.now() + 7 * 86_400_000);
  expect(prepareLoyaltyIntent(owner, 'lottery', body)).toEqual(located);
  expect(Object.keys(located).sort()).toEqual(['attemptId', 'body', 'key', 'operation', 'owner', 'resourceId']);
  expect(() => locateLoyaltyIntent(first, 'attempt-2')).toThrow('尝试号不一致');
});

test('clear requires the original request and matching attempt; stale callbacks cannot clear a newer intent', () => {
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  expect(() => clearConfirmedLoyaltyIntent(first, 'attempt-1')).toThrow('终态');
  const located = locateLoyaltyIntent(first, 'attempt-1');
  expect(() => clearConfirmedLoyaltyIntent(located, 'attempt-2')).toThrow('终态');
  clearConfirmedLoyaltyIntent(located, 'attempt-1');
  const next = prepareLoyaltyIntent(owner, 'lottery', body);
  expect(next.key).not.toBe(first.key);
  expect(() => clearConfirmedLoyaltyIntent(located, 'attempt-1')).toThrow('终态');
  expect(readLoyaltyIntent(owner, 'lottery')?.key).toBe(next.key);
});

test('damaged storage fails closed and is retained for query recovery', () => {
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  const key = [...values.keys()][0]!;
  values.set(key, { ...first, owner: 'forged' });
  expect(() => readLoyaltyIntent(owner, 'lottery')).toThrow('记录不完整');
  expect(() => prepareLoyaltyIntent(owner, 'lottery', body)).toThrow('记录不完整');
  expect((values.get(key) as { owner: string }).owner).toBe('forged');
});

test.each([
  { field: undefined }, { field: NaN }, { field: Infinity }, { field: 9007199254740992 },
  { field: () => 'lost' }, { field: new Date() }, { field: [undefined] },
])('non-JSON or unsafe request %j never enters storage', input => {
  expect(() => prepareLoyaltyIntent(owner, 'lottery', input)).toThrow('内容不完整');
  expect(values.size).toBe(0);
});

test('cyclic body and extra cached outcome fields fail closed', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;
  expect(() => prepareLoyaltyIntent(owner, 'lottery', cyclic)).toThrow('内容不完整');
  const first = prepareLoyaltyIntent(owner, 'lottery', body);
  values.set([...values.keys()][0]!, { ...first, result: 'made-up' });
  expect(() => readLoyaltyIntent(owner, 'lottery')).toThrow('记录不完整');
});

test('JSON serialization cannot silently drop sparse arrays, extra array fields or accessors', () => {
  const sparse: unknown[] = [];
  sparse[1] = 'value';
  const extra = ['value'] as string[] & { extra?: string };
  extra.extra = 'would-disappear';
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => 'unstable' });
  for (const field of [sparse, extra, accessor]) {
    expect(() => prepareLoyaltyIntent(owner, 'lottery', { field })).toThrow('内容不完整');
  }
  expect(values.size).toBe(0);
});

test('a storage write without matching readback cannot authorize dispatch', () => {
  wx.setStorageSync = vi.fn();
  expect(() => prepareLoyaltyIntent(owner, 'lottery', body)).toThrow('未能保存');
});
