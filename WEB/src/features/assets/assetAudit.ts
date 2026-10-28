import type { IAMGateway, IAMOperationEventProjection } from '../../shared/services/contracts';

export async function readAssetAudit(gateway: IAMGateway, assetId: string, signal?: AbortSignal): Promise<IAMOperationEventProjection[]> {
  const events: IAMOperationEventProjection[] = [];
  let cursor = '';
  do {
    const page = await gateway.listOperationEvents(cursor, signal === undefined ? undefined : { signal }, { resource_type: 'RENTAL_ASSET', resource_id: assetId, page_size: 100 });
    for (const event of page.items) {
      if (event.resource_type !== 'RENTAL_ASSET' || event.resource_id !== assetId) throw new Error('资产审计返回了其他业务对象');
      events.push(event);
    }
    cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
    if (page.page.has_more && cursor === '') throw new Error('资产审计分页游标缺失');
  } while (cursor !== '');
  return events;
}
