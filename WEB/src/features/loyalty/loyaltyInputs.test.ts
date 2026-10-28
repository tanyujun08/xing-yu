import { describe, expect, it } from 'vitest';
import { formatLoyaltyMoney, formatLoyaltyPercent, loyaltyProbabilityTotal, MAX_LOYALTY_UNITS, parseLoyaltyInteger, parseLoyaltyMoney, parseLoyaltyPercent, parseLoyaltyReason, parseLoyaltyTimeRange, validLoyaltyId, validateLoyaltyStock } from './loyaltyInputs';

describe('loyalty input precision', () => {
  it('preserves large decimal integers and rejects signed BIGINT overflow', () => {
    expect(parseLoyaltyInteger('9007199254740993')).toEqual({ ok: true, value: '9007199254740993' });
    expect(parseLoyaltyInteger(MAX_LOYALTY_UNITS)).toEqual({ ok: true, value: MAX_LOYALTY_UNITS });
    expect(parseLoyaltyInteger('9223372036854775808').ok).toBe(false);
    for (const text of ['', '01', '-1', '+1', '1.0', '1e3', ' 1', '1,000']) expect(parseLoyaltyInteger(text).ok).toBe(false);
    expect(parseLoyaltyInteger('0').ok).toBe(true);
    expect(parseLoyaltyInteger('0', true).ok).toBe(false);
  });

  it('compares the exact converted fen amount against the upper bound', () => {
    expect(parseLoyaltyMoney('0.01')).toEqual({ ok: true, value: '1' });
    expect(parseLoyaltyMoney('1.2')).toEqual({ ok: true, value: '120' });
    expect(parseLoyaltyMoney('92233720368547758.07')).toEqual({ ok: true, value: MAX_LOYALTY_UNITS });
    expect(parseLoyaltyMoney('92233720368547758.08').ok).toBe(false);
    for (const text of ['', '0', '0.00', '01.00', '1.234', '1e3', '-1', '1,000']) expect(parseLoyaltyMoney(text).ok).toBe(false);
    expect(formatLoyaltyMoney(MAX_LOYALTY_UNITS)).toBe('92233720368547758.07');
  });

  it('represents basis points exactly and never normalizes invalid probabilities', () => {
    expect(parseLoyaltyPercent('12.34')).toEqual({ ok: true, value: 1234 });
    expect(parseLoyaltyPercent('0.01')).toEqual({ ok: true, value: 1 });
    expect(parseLoyaltyPercent('100')).toEqual({ ok: true, value: 10000 });
    expect(formatLoyaltyPercent(1)).toBe('0.01');
    expect(formatLoyaltyPercent(10000)).toBe('100.00');
    for (const text of ['', '100.01', '01', '0.001', '-1', '1e2', '1%']) expect(parseLoyaltyPercent(text).ok).toBe(false);
  });

  it('counts Unicode code points after reason normalization', () => {
    expect(parseLoyaltyReason('  🌟🌟🌟\r\n说明  ')).toEqual({ ok: true, value: '🌟🌟🌟\n说明' });
    expect(parseLoyaltyReason('🌟🌟').ok).toBe(false);
    expect(parseLoyaltyReason('🌟'.repeat(256)).ok).toBe(true);
    expect(parseLoyaltyReason('🌟'.repeat(257)).ok).toBe(false);
  });

  it('includes the separate no-win probability and preserves the probability difference', () => {
    expect(loyaltyProbabilityTotal(['0', '40', '0', '0', '20', '40'])).toEqual({ ok: true, value: { totalBps: 10000, differenceBps: 0 } });
    expect(loyaltyProbabilityTotal(['0', '40', '0', '0', '20', '39.99'])).toEqual({ ok: true, value: { totalBps: 9999, differenceBps: 1 } });
    expect(loyaltyProbabilityTotal(['0', '40', '0', '0', '20', '40.01'])).toEqual({ ok: true, value: { totalBps: 10001, differenceBps: -1 } });
    expect(loyaltyProbabilityTotal(['', '40', '0', '0', '20', '40']).ok).toBe(false);
  });

  it('checks inventory quantities without loss and permits a sold-out disabled prize', () => {
    expect(validateLoyaltyStock('9007199254740994', '9007199254740993', true).ok).toBe(true);
    expect(validateLoyaltyStock('9007199254740992', '9007199254740993', false).ok).toBe(false);
    expect(validateLoyaltyStock('9007199254740993', '9007199254740993', true).ok).toBe(false);
    expect(validateLoyaltyStock('9007199254740993', '9007199254740993', false).ok).toBe(true);
    expect(validateLoyaltyStock('1', 'not-a-quantity', true).ok).toBe(false);
  });

  it('rejects invalid exact queries before requesting and permits one-sided time ranges', () => {
    expect(validLoyaltyId('draw_1:source')).toBe(true);
    for (const text of ['', 'two words', '编号', 'x'.repeat(65), '\nrequest']) expect(validLoyaltyId(text)).toBe(false);
    expect(parseLoyaltyTimeRange('', '2026-10-02T00:00:00Z')).toEqual({ ok: true, value: { to: '2026-10-02T00:00:00.000Z' } });
    expect(parseLoyaltyTimeRange('invalid', '').ok).toBe(false);
    expect(parseLoyaltyTimeRange('1', '').ok).toBe(false);
    expect(parseLoyaltyTimeRange('2026-02-30T00:00:00Z', '').ok).toBe(false);
    expect(parseLoyaltyTimeRange('2026-10-02T24:00:00Z', '').ok).toBe(false);
    expect(parseLoyaltyTimeRange('2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z').ok).toBe(false);
  });
});
