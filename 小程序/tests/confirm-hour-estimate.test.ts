import { expect, test } from 'vitest';
import { calculateHourlyBilling } from '../miniprogram/shared/fixture/lifecycle-rules';

const hourlyRateFen = 2_000;
const referenceValueFen = 1_300_000;
function rentFor(durationMs: number) {
  return calculateHourlyBilling({ startedAtMs: 0, effectiveReturnAtMs: durationMs, hourlyRateFen, referenceValueFen });
}

test('whole-hour billing stays exact', () => {
  for (const [hours, rentFen] of [[1, 2_000], [3, 6_000], [6, 12_000], [12, 24_000], [24, 48_000]] as const) {
    expect(rentFor(hours * 3_600_000)).toMatchObject({ billedHours: hours, rentFen });
  }
  expect(rentFor(24 * 3_600_000 + 20 * 60_000)).toMatchObject({ billedHours: 25, rentFen: 50_000 });
});

test('fractional hours round up without losing an hour', () => {
  expect(rentFor(1)).toMatchObject({ billedHours: 1, rentFen: 2_000 });
  expect(rentFor(20 * 60_000)).toMatchObject({ billedHours: 1, rentFen: 2_000 });
  expect(rentFor(50 * 60_000)).toMatchObject({ billedHours: 1, rentFen: 2_000 });
  expect(rentFor(3_600_001)).toMatchObject({ billedHours: 2, rentFen: 4_000 });
});

test('the approved product-value cap rule remains exact', () => {
  expect(rentFor(649 * 3_600_000)).toMatchObject({ billedHours: 649, rentFen: 1_298_000 });
  expect(rentFor(650 * 3_600_000)).toMatchObject({ billedHours: 650, rentFen: referenceValueFen });
  expect(rentFor(900 * 3_600_000)).toMatchObject({ billedHours: 900, rentFen: referenceValueFen });
});
