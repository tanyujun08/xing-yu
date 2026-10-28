import { afterEach, expect, it, vi } from 'vitest';
import { formatUTC } from './time';

afterEach(() => vi.restoreAllMocks());

it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('renders the same Beijing business instant when the default timezone is %s', (defaultZone) => {
  const NativeFormatter = Intl.DateTimeFormat;
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
    return new NativeFormatter(locales, { timeZone: defaultZone, ...options });
  });
  expect(formatUTC('2026-10-06T15:59:59Z', 'en-GB')).toBe('6 Oct 2026, 23:59:59');
  expect(formatUTC('2026-10-06T16:00:00Z', 'en-GB')).toBe('7 Oct 2026, 00:00:00');
  expect(formatUTC('2026-10-07T00:00:00+08:00', 'en-GB')).toBe('7 Oct 2026, 00:00:00');
});

it('keeps an invalid source time visible instead of inventing a date', () => {
  expect(formatUTC('not-a-time')).toBe('not-a-time');
});
