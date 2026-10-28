import { describe, expect, it } from 'vitest';
import { toShanghaiBusinessDate, toShanghaiBusinessMonth } from './shanghai';

describe('Shanghai business time', () => {
  it('uses Asia/Shanghai day and month boundaries exactly', () => {
    expect(toShanghaiBusinessDate('2026-08-31T15:59:59.000Z')).toBe('2026-08-31');
    expect(toShanghaiBusinessMonth('2026-08-31T15:59:59.000Z')).toBe('2026-08');
    expect(toShanghaiBusinessDate('2026-08-31T16:00:00.000Z')).toBe('2026-09-01');
    expect(toShanghaiBusinessMonth('2026-08-31T16:00:00.000Z')).toBe('2026-09');
  });
});
