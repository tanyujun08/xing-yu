import { expect, test } from 'vitest';
import { cityInitial } from '../miniprogram/shared/presentation/city-initial';

test.each([
  ['阿勒泰地区', 'A'],
  ['澳门特别行政区', 'A'],
  ['长春市', 'C'],
  ['重庆市辖区', 'C'],
  ['鄂尔多斯市', 'E'],
  ['七台河市', 'Q'],
  ['深圳市', 'S'],
  ['台中市', 'T'],
  ['厦门市', 'X'],
  ['香港特别行政区', 'X'],
  ['珠海市', 'Z'],
  ['unknown city', 'U'],
  ['未知城市', '#'],
])('%s belongs to %s', (name, expected) => {
  expect(cityInitial(name)).toBe(expected);
});
