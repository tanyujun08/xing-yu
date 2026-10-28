import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { prepareGrowthTaskIntent, readGrowthTaskIntent, clearConfirmedGrowthTaskIntent } from '../miniprogram/shared/api/growth-task-intent';
import { benefitApi } from '../miniprogram/shared/api/account-api';

let owner: string;
let values: Map<string, unknown>;
beforeEach(() => {
  owner = 'account-a'; values = new Map();
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1'
      ? { accountId: owner, accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 } : values.get(key),
    setStorageSync: (key: string, value: unknown) => values.set(key, structuredClone(value)),
    removeStorageSync: (key: string) => values.delete(key), request: vi.fn(() => ({ abort: vi.fn() })),
  });
});
afterEach(() => vi.unstubAllGlobals());

test('keeps one original empty command across process reads and account changes, blocking a different task', () => {
  const intent = prepareGrowthTaskIntent(owner, 'register-reward');
  expect(intent.body).toEqual({});
  expect(() => prepareGrowthTaskIntent(owner, 'other-reward')).toThrow('恢复原请求');
  owner = 'account-b';
  expect(readGrowthTaskIntent(owner)).toBeNull();
  expect(() => readGrowthTaskIntent('account-a')).toThrow('登录状态');
  expect(() => clearConfirmedGrowthTaskIntent(intent)).toThrow('登录状态');
  owner = 'account-a';
  expect(prepareGrowthTaskIntent(owner, intent.benefitCode)).toEqual(intent);
});

test('damaged original storage and failed durable save block a new command without discarding evidence', () => {
  const intent = prepareGrowthTaskIntent(owner, 'register-reward'), key = [...values.keys()][0]!;
  values.set(key, { ...intent, body: { count: 1 } });
  expect(() => prepareGrowthTaskIntent(owner, intent.benefitCode)).toThrow('不完整');
  expect((values.get(key) as { body: object }).body).toEqual({ count: 1 });
  values.clear();
  wx.setStorageSync = vi.fn();
  expect(() => prepareGrowthTaskIntent(owner, intent.benefitCode)).toThrow('未能保存');
});

test('a stale completion cannot clear the next original command', () => {
  const first = prepareGrowthTaskIntent(owner, 'register-reward');
  clearConfirmedGrowthTaskIntent(first);
  const next = prepareGrowthTaskIntent(owner, 'register-reward');
  expect(next.key).not.toBe(first.key);
  expect(() => clearConfirmedGrowthTaskIntent(first)).toThrow('已变化');
  expect(readGrowthTaskIntent(owner)).toEqual(next);
});

test('real request adapter uses the two registered paths and only empty body plus original Header key', () => {
  const intent = prepareGrowthTaskIntent(owner, 'register-reward');
  benefitApi.tasks(); benefitApi.claimTask(intent.benefitCode, intent.key);
  const calls = vi.mocked(wx.request).mock.calls.map(call => call[0]);
  expect(calls[0]).toMatchObject({ method: 'GET' });
  expect(calls[0]!.url).toMatch(/\/v1\/me\/growth-tasks$/);
  expect(calls[0]!.data).toBeUndefined();
  expect(calls[1]).toMatchObject({ method: 'POST', data: {}, header: { 'Idempotency-Key': intent.key } });
  expect(calls[1]!.url).toMatch(/\/v1\/me\/growth-tasks\/register-reward\/claims$/);
});
