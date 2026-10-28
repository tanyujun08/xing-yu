import { beforeEach, expect, test } from 'vitest';
import {
  completeMockCheckIn,
  getMockBenefitRecords,
  getMockCashAccount,
  getMockDiamondBalance,
  getMockDiamondLedger,
  getMockPublishEligibility,
  getMockStarBalance,
  getMockStarLedger,
  grantMockDiamonds,
  PREVIOUS_MOCK_NAMESPACE,
  purchaseMockPublishQuota,
  resetFixture,
  runMockBenefit,
  simulateMockProcessRestartForTest,
} from '../miniprogram/shared/fixture';
import { readMockState } from '../miniprogram/shared/fixture/mock-store';

beforeEach(() => resetFixture());

test('records failed benefits, retries once, and remains idempotent after restart', () => {
  const diamondBefore = getMockDiamondBalance();
  const starBefore = getMockStarBalance();
  const failed = runMockBenefit('growth_task', 'growth:change-retry', { starPoints: 11, diamondPoints: 7, note: '专项权益' }, 'failure');
  expect(failed.ok).toBe(false);
  expect(getMockDiamondBalance()).toBe(diamondBefore);
  expect(getMockStarBalance()).toBe(starBefore);

  const succeeded = runMockBenefit('growth_task', 'growth:change-retry', { starPoints: 11, diamondPoints: 7, note: '专项权益' });
  expect(succeeded.ok).toBe(true);
  expect(getMockDiamondBalance()).toBe(diamondBefore + 7);
  expect(getMockStarBalance()).toBe(starBefore + 11);
  expect(getMockDiamondLedger().filter((entry) => entry.businessKey === 'growth:change-retry:credit')).toHaveLength(1);
  expect(getMockStarLedger().filter((entry) => entry.businessKey === 'growth:change-retry:credit')).toHaveLength(1);

  expect(runMockBenefit('growth_task', 'growth:change-retry', { starPoints: 99, diamondPoints: 99, note: '重复点击' }).ok).toBe(true);
  expect(getMockDiamondBalance()).toBe(diamondBefore + 7);
  expect(getMockStarBalance()).toBe(starBefore + 11);
  simulateMockProcessRestartForTest();
  expect(getMockBenefitRecords().find((record) => record.businessKey === 'growth:change-retry')).toMatchObject({ status: 'succeeded', starPoints: 11, diamondPoints: 7 });
});

test('keeps check-in balances and ledgers idempotent', () => {
  const checkInBefore = { diamond: getMockDiamondBalance(), star: getMockStarBalance() };
  expect(completeMockCheckIn().ok).toBe(true);
  expect(completeMockCheckIn().ok).toBe(true);
  expect(getMockDiamondBalance()).toBe(checkInBefore.diamond + 20);
  expect(getMockStarBalance()).toBe(checkInBefore.star + 70);
  expect(getMockDiamondLedger().filter((entry) => entry.businessKey.startsWith('check-in:') && entry.direction === 'credit')).toHaveLength(1);

});

test('keeps publish quota separate from the cash account projection', () => {
  const cashBefore = getMockCashAccount();
  const eligibilityBefore = getMockPublishEligibility();
  expect(purchaseMockPublishQuota(1).ok).toBe(true);
  expect(getMockPublishEligibility().publishQuota).toBe(eligibilityBefore.publishQuota + 1);
  expect(getMockCashAccount()).toEqual(cashBefore);
  expect(getMockCashAccount()).not.toHaveProperty('publishQuota');
});

test('migrates 1.0.0.10 forward without deleting its namespace or duplicating snapshots', () => {
  const source = readMockState();
  const legacy = JSON.parse(JSON.stringify(source)) as typeof source;
  legacy.version = '1.0.0.10';
  delete legacy.starBalances;
  delete legacy.mediaObjects;
  delete legacy.diamondLedger;
  delete legacy.starLedger;
  delete legacy.benefitRecords;
  delete legacy.cashAccounts;
  const storage = new Map<string, unknown>([[PREVIOUS_MOCK_NAMESPACE, legacy]]);
  const previousWx = (globalThis as unknown as { wx?: unknown }).wx;
  (globalThis as unknown as { wx: unknown }).wx = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: (key: string) => storage.delete(key),
  };
  try {
    simulateMockProcessRestartForTest();
    const migrated = readMockState();
    expect(migrated.version).toBe('1.0.0.11');
    expect(storage.has(PREVIOUS_MOCK_NAMESPACE)).toBe(true);
    expect(storage.has('xingyu:rental:1.0.0.11')).toBe(true);
    expect(migrated.diamondLedger?.some((entry) => entry.businessKey.startsWith('migration:1.0.0.10:'))).toBe(true);
    expect(migrated.starLedger?.some((entry) => entry.businessKey.startsWith('migration:1.0.0.10:'))).toBe(true);
    simulateMockProcessRestartForTest();
    const replay = readMockState();
    expect(replay.diamondLedger?.filter((entry) => entry.businessKey.startsWith('migration:1.0.0.10:'))).toHaveLength(migrated.accounts.length);
    expect(replay.starLedger?.filter((entry) => entry.businessKey.startsWith('migration:1.0.0.10:'))).toHaveLength(migrated.accounts.length);
  } finally {
    (globalThis as unknown as { wx?: unknown }).wx = previousWx;
    simulateMockProcessRestartForTest();
    resetFixture();
  }
});

test('does not use a publish quota as a cash balance even after a diamond grant', () => {
  const cashBefore = getMockCashAccount();
  expect(grantMockDiamonds(25, 'change:diamond-grant', '专项奖励').ok).toBe(true);
  expect(getMockCashAccount()).toEqual(cashBefore);
});
