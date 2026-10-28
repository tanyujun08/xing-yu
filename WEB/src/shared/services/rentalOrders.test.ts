import { afterEach, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client';
import { createRentalOrders, rentalServerNow, rentalValidationErrors, type RentalReviewInput } from './rentalOrders';
import { ApiProblem } from '../api/problem';

it('reads only contract-shaped 422 field errors and leaves unknown shapes for the form fallback', () => {
  const error = new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '校验失败', request_id: 'validation', details: { errors: [
    { field: 'adjustment_reason', reason: '请补充调整原因', rule: 'REQUIRED' },
    { field: 'loss_items', reason: '请核对损失凭证', rule: 'INVALID' },
    { field: 'loss_items.1.description', reason: '未知数组路径', rule: 'INVALID' },
    { field: 'note', reason: '缺少规则' }, null,
  ] } });
  expect(rentalValidationErrors(error)).toEqual([{ field: 'adjustment_reason', reason: '请补充调整原因' }, { field: 'loss_items', reason: '请核对损失凭证' }]);
  expect(rentalValidationErrors(new ApiProblem(403, { code: 'PERMISSION_DENIED', message: '拒绝', request_id: 'denied', details: error.details! }))).toEqual([]);
  expect(rentalValidationErrors(new Error('offline'))).toEqual([]);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('anchors receipt validation to HTTP Date plus monotonic elapsed time, never the browser wall clock', async () => {
  let elapsed = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { ETag: '"ORDER:order:1"', Date: 'Tue, 06 Oct 2026 00:00:00 GMT' } })));
  const gateway = createRentalOrders(createApiClient({ baseURL: '', getAccessToken: () => null }));
  const row = await gateway.detail('order');
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-01T00:00:00Z'));
  elapsed += 120000;
  expect(rentalServerNow(row.serverClock)).toBe(Date.parse('2026-10-06T00:02:00Z'));
  for (const date of [undefined, 'invalid', '0']) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { ETag: '"ORDER:order:1"', ...(date ? { Date: date } : {}) } })));
    expect((await gateway.detail('order')).serverClock).toBeNull();
  }
});
it('binds B11 preview to the actual ORDER ETag without creating an idempotent write', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetchMock);
  const gateway = createRentalOrders(createApiClient({ baseURL: '', getAccessToken: () => null }));
  const controller = new AbortController();
  const body: RentalReviewInput = { decision: 'REVIEW_PENDING', receipt_version: '4', overtime_assessed_fen: null, adjustment_reason: null, loss_items: [], rejection_reason: '只读计算系统超期', missing_items: [], evidence_ids: [] };
  await gateway.preview('order1', body, '"ORDER:b3JkZXIx:7"', controller.signal);
  const init = fetchMock.mock.calls[0]![1] as RequestInit;
  expect(fetchMock.mock.calls[0]![0]).toBe('/v1/ops/rental-orders/order1/review-preview');
  expect((init.headers as Headers).get('If-Match')).toBe('"ORDER:b3JkZXIx:7"');
  expect((init.headers as Headers).has('Idempotency-Key')).toBe(false);
  expect(JSON.parse(String(init.body))).toEqual(body);
  expect(init.signal).toBeInstanceOf(AbortSignal);
});
it('keeps object ETags exactly and uses RETURN rather than ORDER for receipt writes', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { headers: { ETag: '"return-object:8"' } })).mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock); const gateway = createRentalOrders(createApiClient({ baseURL: '', getAccessToken: () => 'test-token' }));
  const row = await gateway.returns('order/1'); await gateway.receipt('order/1', { received_at: '2026-10-06T00:00:00Z', note: null }, row.etag, 'original-receipt-key');
  expect(fetchMock.mock.calls[1]![0]).toBe('/v1/ops/rental-orders/order%2F1/return/receipt');
  const init = fetchMock.mock.calls[1]![1] as RequestInit; expect((init.headers as Headers).get('If-Match')).toBe('"return-object:8"');
});
it('does not fabricate an object version when the read response omits its ETag', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"order":{"version":"99"}}')));
  const gateway = createRentalOrders(createApiClient({ baseURL: '', getAccessToken: () => null }));
  await expect(gateway.detail('order1')).rejects.toThrow('版本');
});
it('queries the original financial transaction with empty JSON and no extra If-Match', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 })); vi.stubGlobal('fetch', fetchMock);
  await createRentalOrders(createApiClient({ baseURL: '', getAccessToken: () => null })).reconcileRefund('refund1', 'original-refund-query');
  const init = fetchMock.mock.calls[0]![1] as RequestInit; expect(init.body).toBe('{}'); expect((init.headers as Headers).has('If-Match')).toBe(false); expect(fetchMock).toHaveBeenCalledOnce();
});
