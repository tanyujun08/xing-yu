import { expect, test } from 'vitest';
import { anchorOrderPaymentClock, orderPaymentNow, paymentDeadlineValid } from '../miniprogram/shared/presentation/rental-order-payment';

test('payment deadline uses a short server anchor despite device clock skew', () => {
  const detail = { server_time: '2026-10-11T00:00:00Z' };
  const device = Date.parse('2099-01-01T00:00:00Z');
  expect(Number.isNaN(orderPaymentNow(detail, device))).toBe(true);
  anchorOrderPaymentClock(detail, device);
  expect(orderPaymentNow(detail, device + 1000)).toBe(Date.parse(detail.server_time) + 1000);
  expect(paymentDeadlineValid('2026-10-11T00:00:10Z', orderPaymentNow(detail, device + 1000))).toBe(true);
  expect(paymentDeadlineValid('2026-10-11T00:00:10Z', orderPaymentNow(detail, device + 10000))).toBe(false);
  expect(Number.isNaN(orderPaymentNow(detail, device + 30001))).toBe(true);
  expect(Number.isNaN(orderPaymentNow(detail, device - 1))).toBe(true);
  expect(Number.isNaN(orderPaymentNow({ ...detail }, device))).toBe(true);
});

test('invalid server time never authorizes payment', () => {
  const detail = { server_time: 'invalid' };
  anchorOrderPaymentClock(detail, 100);
  expect(paymentDeadlineValid('2099-01-01T00:00:00Z', orderPaymentNow(detail, 101))).toBe(false);
});
