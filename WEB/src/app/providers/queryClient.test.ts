import { describe, expect, it } from 'vitest';
import { shouldRetryQuery } from './queryClient';

describe('query retry policy', () => {
  it('only retries recoverable reads with a bounded attempt count', () => {
    const problem = (status: number, code = 'FAILED') => Object.assign(new Error(code), { status, code });
    expect(shouldRetryQuery(0, new TypeError('network'))).toBe(true);
    expect(shouldRetryQuery(1, problem(503))).toBe(true);
    expect(shouldRetryQuery(0, problem(409))).toBe(false);
    expect(shouldRetryQuery(0, problem(0, 'REQUEST_CANCELLED'))).toBe(false);
    expect(shouldRetryQuery(2, problem(503))).toBe(false);
  });
});
