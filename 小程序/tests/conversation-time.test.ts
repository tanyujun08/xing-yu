import { expect, test } from 'vitest';
import { conversationTime } from '../miniprogram/shared/presentation/order-conversation';

const now = Date.parse('2026-10-10T16:05:00Z'); // Beijing October 11.
test.each([
  ['2026-10-10T16:01:00Z', '00:01'],
  ['2026-10-10T15:59:00Z', '昨天'],
  ['2026-10-08T16:00:00Z', '10.09'],
  ['2025-12-20T00:00:00Z', '2025-12-20'],
  ['invalid', ''], ['', ''], [null, ''],
])('conversation time %s uses the Beijing date boundary', (value, expected) => {
  expect(conversationTime(value, now)).toBe(expected);
});
