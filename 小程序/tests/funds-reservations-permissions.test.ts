import { beforeEach, expect, test } from 'vitest';
import { getMockFinancialFacts, resetFixture, switchMockAccount } from '../miniprogram/shared/fixture';
import { readMockState, writeMockState } from '../miniprogram/shared/fixture/mock-store';
beforeEach(() => resetFixture());

test('keeps unrelated accounts unable to read financial facts', () => {
  const state = readMockState();
  state.financialFacts.push({
    id: 'withdrawal-fact', businessKey: 'withdrawal-fact-key', kind: 'withdrawal_request',
    orderId: null, userId: state.currentAccountId, amountFen: 100,
    source: 'withdrawal_action', createdAt: new Date().toISOString(),
  });
  writeMockState(state);
  expect(getMockFinancialFacts()).toHaveLength(1);
  expect(switchMockAccount('mock-user-c')).toBe(true);
  const before = readMockState();
  expect(getMockFinancialFacts()).toEqual([]);
  expect(readMockState()).toEqual(before);
});
