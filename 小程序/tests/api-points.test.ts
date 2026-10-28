import { expect, test } from 'vitest';
import { displayGrowthUnits } from '../miniprogram/shared/presentation/api-points';

test.each([
  ['0', '0'], ['1', '0.1'], ['9', '0.9'], ['10', '1'], ['100', '10'],
  ['123', '12.3'], ['9007199254740993', '900719925474099.3'],
  ['9223372036854775807', '922337203685477580.7'],
])('projects GROWTH %s without numeric precision loss', (units, expected) => {
  expect(displayGrowthUnits(units)).toBe(expected);
});
test.each([undefined, null, 123, '', '01', '1.2', '1e3', '-1', '+1', ' 1', '9223372036854775808', '12345678901234567890'])('invalid GROWTH %s stays unavailable', (value) => {
  expect(displayGrowthUnits(value)).toBe('—');
});
