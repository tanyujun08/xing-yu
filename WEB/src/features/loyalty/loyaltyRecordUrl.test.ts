import { describe, expect, it } from 'vitest';
import { applyLoyaltyRecordFilters, closeLoyaltyDetail, nextLoyaltyRecordPage, openLoyaltyDetail, previousLoyaltyRecordPage, readLoyaltyRecordFilters } from './loyaltyRecordUrl';

describe('record URL state', () => {
  it('roundtrips opaque cursors across reload and resets them when filters change', () => {
    const first = new URLSearchParams('tab=records&account_id=account-A');
    const second = nextLoyaltyRecordPage(first, 'opaque:page-2');
    const third = nextLoyaltyRecordPage(new URLSearchParams(second.toString()), 'opaque:page-3');
    expect(previousLoyaltyRecordPage(third).toString()).toBe(second.toString());
    expect(previousLoyaltyRecordPage(second).toString()).toBe(first.toString());
    const filtered = applyLoyaltyRecordFilters(third, ['account_id'], { account_id: 'account-B' });
    expect(filtered.get('account_id')).toBe('account-B');
    expect(filtered.has('cursor')).toBe(false);
    expect(filtered.has('_previous_cursor')).toBe(false);
    expect(filtered.get('tab')).toBe('records');
    expect(nextLoyaltyRecordPage(third, null).toString()).toBe(third.toString());
  });

  it('opens precise detail IDs independently of the current list and retains the list URL', () => {
    const list = new URLSearchParams('tab=records&account_id=account-A&cursor=opaque-page');
    const opened = openLoyaltyDetail(list, 'record', 'request/one:source');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(new URLSearchParams(opened.value.toString()).get('detail_id')).toBe('request/one:source');
    expect(closeLoyaltyDetail(opened.value).toString()).toBe(list.toString());
    expect(openLoyaltyDetail(list, 'record', 'invalid id').ok).toBe(false);
  });

  it('rejects duplicated filter values instead of silently broadening the query', () => {
    expect(readLoyaltyRecordFilters(new URLSearchParams('account_id=A&account_id=B'), ['account_id']).ok).toBe(false);
    expect(readLoyaltyRecordFilters(new URLSearchParams('cursor=A&cursor=B'), ['account_id']).ok).toBe(false);
    expect(readLoyaltyRecordFilters(new URLSearchParams('account_id=A&tab=records'), ['account_id'])).toEqual({ ok: true, value: { account_id: 'A' } });
  });
});
