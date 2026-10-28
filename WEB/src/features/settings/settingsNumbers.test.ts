import { describe, expect, it } from 'vitest';
import { positiveYuanToFen } from './settingsNumbers';

describe('configured prices', () => {
  it('converts decimal prices exactly instead of rounding floating point values', () => {
    expect(positiveYuanToFen('0.29')).toBe(29);
    expect(positiveYuanToFen('1.01')).toBe(101);
    expect(positiveYuanToFen('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each(['0', '0.00', '-1', '0.001', '1e3', 'Infinity', '', '90071992547409.92'])('rejects invalid price %s', (value) => {
    expect(() => positiveYuanToFen(value)).toThrow();
  });
});
