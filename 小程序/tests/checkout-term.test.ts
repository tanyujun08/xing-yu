import { afterEach, expect, test, vi } from 'vitest';
import { validateCheckoutDates, checkoutError } from '../miniprogram/shared/presentation/checkout-term';
import { ApiProblem } from '../miniprogram/shared/api/problem';
afterEach(() => vi.useRealTimers());
test('today stays valid at noon and date ranges price exact whole days in Beijing', () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T04:00:00Z'));
  expect(validateCheckoutDates('2026-10-08', '2026-10-11', 3)).toEqual({ from: '2026-10-07T16:00:00.000Z', to: '2026-10-10T16:00:00.000Z', days: 3 });
  expect(() => validateCheckoutDates('2026-10-07', '2026-10-11', 3)).toThrow('开始日期已过期');
  expect(() => validateCheckoutDates('2026-10-08', '2026-10-10', 3)).toThrow('至少租用 3 天');
  expect(() => validateCheckoutDates('2026-10-08', '2026-10-08', 3)).toThrow('晚于');
  expect(() => validateCheckoutDates('', '', 3)).toThrow('请先选择');
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  expect(() => validateCheckoutDates('2026-10-08', '2026-10-11', 3)).toThrow('已过期');
});
test('availability and server validation failures explain the field without generic protocol copy', () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T04:00:00Z'));
  expect(() => validateCheckoutDates('2026-10-08', '2026-10-11', 3, '2026-10-09')).toThrow('可租日期');
  const error = new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '请求校验失败', request_id: 'test', details: { errors: [{ field: 'rental_end_at', rule: 'RENTAL_MINIMUM_UNITS', reason: '该设备至少租用 3 天，请延后归还日期' }] } });
  expect(checkoutError(error)).toBe('该设备至少租用 3 天，请延后归还日期');
});
