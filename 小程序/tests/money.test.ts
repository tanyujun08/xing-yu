import { expect, test } from 'vitest';
import { formatCNYMinorUnits } from '../miniprogram/shared/format/money';

test('formats minor-unit strings without floating-point conversion', () => {
  expect(formatCNYMinorUnits('0')).toBe('¥0.00');
  expect(formatCNYMinorUnits('100001')).toBe('¥1000.01');
  expect(formatCNYMinorUnits('-9')).toBe('-¥0.09');
});
