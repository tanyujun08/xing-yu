import { expect, test, vi } from 'vitest';
import type { IAMGateway } from '../../shared/services/contracts';
import { readAssetAudit } from './assetAudit';

const event = { event_id: 'event-1', actor_account_id: 'operator', operation_id: 'createOpsPlatformAssetBatch', resource_type: 'RENTAL_ASSET', resource_id: 'asset-1', action_code: 'SUBMIT', result_code: 'SUCCESS', field_change_summary: {}, occurred_at: '2026-09-23T00:00:00Z' };

test('asset audit uses exact server resource filters across cursor pages', async () => {
  const listOperationEvents = vi.fn().mockImplementation(async (cursor: string) => cursor === ''
    ? { items: [event], page: { has_more: true, next_cursor: 'next' } }
    : { items: [{ ...event, event_id: 'event-2' }], page: { has_more: false } });
  const signal = new AbortController().signal;
  await expect(readAssetAudit({ listOperationEvents } as unknown as IAMGateway, 'asset-1', signal)).resolves.toHaveLength(2);
  expect(listOperationEvents).toHaveBeenNthCalledWith(1, '', { signal }, { resource_type: 'RENTAL_ASSET', resource_id: 'asset-1', page_size: 100 });
  expect(listOperationEvents).toHaveBeenNthCalledWith(2, 'next', { signal }, { resource_type: 'RENTAL_ASSET', resource_id: 'asset-1', page_size: 100 });
});

test('asset audit rejects cross-asset results instead of displaying them', async () => {
  const listOperationEvents = vi.fn().mockResolvedValue({ items: [{ ...event, resource_id: 'other' }], page: { has_more: false } });
  await expect(readAssetAudit({ listOperationEvents } as unknown as IAMGateway, 'asset-1')).rejects.toThrow('其他业务对象');
});
