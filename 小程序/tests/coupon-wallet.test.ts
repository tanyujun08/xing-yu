import { expect, test } from 'vitest';
import { couponWalletFilter } from '../miniprogram/shared/model/coupon-wallet';

test('projects mutually exclusive states without treating released as available', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  const item = { id: 'coupon', type: 'rental' as const, amountFen: 2000, expiresAt: '2030-01-01T00:00:00Z', state: 'available' as const };
  expect(couponWalletFilter(item, now)).toBe('available');
  expect(couponWalletFilter(item, now + 1)).toBe('unavailable');
  expect(couponWalletFilter({ ...item, state: 'reserved' }, now + 1)).toBe('reserved');
  expect(couponWalletFilter({ ...item, state: 'redeemed' }, now + 1)).toBe('used');
  expect(couponWalletFilter({ ...item, state: 'released' }, now)).toBe('unavailable');
  expect(couponWalletFilter({ ...item, expiresAt: 'invalid' }, now)).toBe('unavailable');
  expect(couponWalletFilter({ ...item, amountFen: -1 }, now)).toBe('unavailable');
});
