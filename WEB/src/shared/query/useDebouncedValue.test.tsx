import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('publishes the latest remote keyword after the configured delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 275), { initialProps: { value: 'a' } });
    rerender({ value: 'alpha' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(274));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('alpha');
  });
});
