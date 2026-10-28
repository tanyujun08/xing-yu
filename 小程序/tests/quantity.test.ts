import { expect, test } from 'vitest';
import { compareQuantities, displayQuantity, isUnsignedQuantity, quantityAfterCost } from '../miniprogram/shared/format/quantity';

test.each(['0', '1', '9007199254740993', '9223372036854775807'])('display keeps every digit of quantity %s', value => {
  expect(isUnsignedQuantity(value)).toBe(true);
  expect(displayQuantity(value)).toBe(value);
});

test.each(['', '01', '-1', '1.0', '1e3', '9223372036854775808', 9007199254740992, null])('invalid quantity %s is never interpreted as a balance', value => {
  expect(isUnsignedQuantity(value)).toBe(false);
  expect(displayQuantity(value)).toBe('—');
});

test('confirmation preview subtracts only confirmed cost without losing integer precision', () => {
  expect(quantityAfterCost('260', '10')).toBe('250');
  expect(quantityAfterCost('9007199254740993', '10')).toBe('9007199254740983');
  expect(quantityAfterCost('9223372036854775807', '9007199254740993')).toBe('9214364837600034814');
  expect(quantityAfterCost('1000000000000000000', '1')).toBe('999999999999999999');
  expect(quantityAfterCost('10', '10')).toBe('0');
  expect(quantityAfterCost('0', '0')).toBe('0');
  expect(quantityAfterCost('9', '10')).toBeNull();
});

test('large quantities compare as strings and malformed input prevents a prediction', () => {
  expect(compareQuantities('9007199254740993', '9007199254740992')).toBe(1);
  expect(compareQuantities('99', '100')).toBe(-1);
  expect(compareQuantities('10', '10')).toBe(0);
  expect(() => quantityAfterCost('9007199254740993', '1.5')).toThrow('整数字符串');
});
