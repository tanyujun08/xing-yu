import type { ApiClient } from '../api/client';
import type { components, operations } from '../api/generated/schema';
import { ApiProblem } from '../api/problem';
export type { components, operations } from '../api/generated/schema';
export type RentalOrder = components['schemas']['OpsOrderDetail'];
export type RentalReturn = components['schemas']['OpsReturnView'];
export type RentalReviewInput = components['schemas']['ReviewRequest'];
export type RentalServerClock = { serverMillis: number; observedMonotonicMillis: number };
export type Versioned<T> = { data: T; etag: string; serverClock: RentalServerClock | null };
export function rentalServerNow(clock: RentalServerClock | null | undefined): number | null {
  if (!clock) return null;
  const elapsed = performance.now() - clock.observedMonotonicMillis;
  return Number.isFinite(clock.serverMillis) && Number.isFinite(elapsed) && elapsed >= 0 ? clock.serverMillis + elapsed : null;
}
export type OrderFilter = NonNullable<operations['Q02']['parameters']['query']>;
export type EarningFilter = NonNullable<operations['S04']['parameters']['query']>;
type Schema = components['schemas'];
const orderPath = (id: string) => `/v1/ops/rental-orders/${encodeURIComponent(id)}`;
export function rentalQuery(filter: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return params.toString();
}
export function createRentalOrders(client: ApiClient) {
  const read = <T>(path: string, signal?: AbortSignal) => client.request<T>({ path, ...(signal ? { signal } : {}) });
  const versioned = async <T>(path: string, signal?: AbortSignal): Promise<Versioned<T>> => {
    let etag = '';
    let serverClock: RentalServerClock | null = null;
    const data = await client.request<T>({ path, ...(signal ? { signal } : {}), onResponseHeaders: (headers) => {
      etag = headers.get('ETag') ?? '';
      const date = headers.get('Date');
      const serverMillis = date === null ? NaN : Date.parse(date);
      // Anchor to receipt time, conservatively ignoring network transit. A local
      // wall-clock change cannot authorize a future physical receipt.
      if (Number.isFinite(serverMillis) && new Date(serverMillis).toUTCString() === date) serverClock = { serverMillis, observedMonotonicMillis: performance.now() };
    } });
    if (!/^"[A-Za-z0-9._:-]{1,128}"$/.test(etag)) throw new Error('缺少有效对象版本，请刷新后再操作');
    return { data, etag, serverClock };
  };
  const write = <T, B>(path: string, body: B, etag: string, key: string) => client.request<T, B>({ path, method: 'POST', body, aggregateVersion: etag, idempotencyKey: key });
  return {
    refundUnpicked: (id: string, etag: string, key: string) => write<Schema['CommandResult'], Record<string, never>>(`${orderPath(id)}/refund`, {}, etag, key),
    members: (query: string, cursor: string, signal?: AbortSignal) => read<Schema['MemberSummaryPage']>(`/v1/ops/members?${rentalQuery({ query, cursor, page_size: 20 })}`, signal),
    assets: (query: string, cursor: string, signal?: AbortSignal) => read<Schema['OpsAssetPage']>(`/v1/ops/assets?${rentalQuery({ query, cursor, page_size: 20 })}`, signal),
    merchants: (name: string, cursor: string, signal?: AbortSignal) => read<Schema['MerchantPage']>(`/v1/ops/merchants?${rentalQuery({ name, cursor, page_size: 20 })}`, signal),
    purchases: (filter: NonNullable<operations['listOpsEntitlementPurchases']['parameters']['query']>, signal?: AbortSignal) => read<operations['listOpsEntitlementPurchases']['responses'][200]['content']['application/json']>(`/v1/ops/entitlement-purchases?${rentalQuery(filter)}`, signal),
    purchase: (id: string, signal?: AbortSignal) => read<Schema['OpsEntitlementPurchaseDetail']>(`/v1/ops/entitlement-purchases/${encodeURIComponent(id)}`, signal),
    movements: (accountId: string, sourceId: string, cursor: string, signal?: AbortSignal) => read<Schema['MemberEntitlementMovementPage']>(`/v1/ops/members/${encodeURIComponent(accountId)}/entitlement-movements?${rentalQuery({ source_id: sourceId, kind: 'CONTRACT', cursor, page_size: 20 })}`, signal),
    list: (filter: OrderFilter, signal?: AbortSignal) => read<Schema['OpsOrderPage']>(`/v1/ops/rental-orders?${rentalQuery(filter)}`, signal),
    detail: (id: string, signal?: AbortSignal) => versioned<RentalOrder>(orderPath(id), signal),
    paymentHistory: (id: string, cursor?: string, signal?: AbortSignal) => read<Schema['OpsPaymentHistoryPage']>(orderPath(id) + '/payments?' + rentalQuery({ cursor, limit: 20 }), signal),
    refundHistory: (id: string, cursor?: string, signal?: AbortSignal) => read<Schema['OpsRefundHistoryPage']>(orderPath(id) + '/refunds?' + rentalQuery({ cursor, limit: 20 }), signal),
    verifyExternalRefund: (id: string, out_refund_no: string, key: string) => client.request<Schema['CommandResult'], Schema['ExternalRefundVerificationRequest']>({ path: '/v1/ops/rental-payments/' + encodeURIComponent(id) + '/external-refund-verifications', method: 'POST', body: { out_refund_no }, idempotencyKey: key }),
    contract: (id: string, signal?: AbortSignal) => read<Schema['ContractView']>(orderPath(id) + '/contract', signal),
    returns: (id: string, signal?: AbortSignal) => versioned<RentalReturn>(orderPath(id) + '/return', signal),
    tasks: (id: string, signal?: AbortSignal) => read<Schema['CabinetTaskPage']>(orderPath(id) + '/cabinet-tasks', signal),
    reviews: (id: string, cursor?: string, signal?: AbortSignal) => read<Schema['OpsReviewPage']>(orderPath(id) + `/reviews?${rentalQuery({ cursor, limit: 20 })}`, signal),
    returnDraft: (id: string, method: Schema['Method'], etag: string, key: string) => write<Schema['OpsReturnView'], Schema['ReturnDraftRequest']>(orderPath(id) + '/return-draft', { method }, etag, key),
    receipt: (id: string, input: Schema['ReceiptRequest'], etag: string, key: string) => write<Schema['OpsReturnView'], Schema['ReceiptRequest']>(orderPath(id) + '/return/receipt', input, etag, key),
    correctReceipt: (id: string, input: Schema['ReceiptCorrection'], etag: string, key: string) => write<Schema['OpsReturnView'], Schema['ReceiptCorrection']>(orderPath(id) + '/return/receipt-corrections', input, etag, key),
    saveReturnEvidence: (id: string, slotKey: string, itemNo: number, body: Schema['ReturnEvidenceItemRequest'], etag: string, key: string) => client.request<Schema['OpsReturnView'], Schema['ReturnEvidenceItemRequest']>({ path: orderPath(id) + '/return/evidence-slots/' + encodeURIComponent(slotKey) + '/items/' + itemNo, method: 'PUT', body, aggregateVersion: etag, idempotencyKey: key }),
    resolveReturn: (task: Schema['CabinetTask'], body: Schema['ReturnResolutionRequest'], key: string) => {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(task.task_id) || !/^[1-9][0-9]*$/.test(task.version)) throw new Error('格口任务版本不可用，请刷新');
      const encoded = btoa(task.task_id).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
      return write<Schema['CommandResult'], Schema['ReturnResolutionRequest']>('/v1/ops/rental-cabinet-tasks/' + encodeURIComponent(task.task_id) + '/return-resolution', body, '"CABINET_TASK:' + encoded + ':' + task.version + '"', key);
    },
    preview: (id: string, body: RentalReviewInput, etag: string, signal?: AbortSignal) => client.request<Schema['ReviewPreview'], RentalReviewInput>({ path: orderPath(id) + '/review-preview', method: 'POST', body, aggregateVersion: etag, ...(signal ? { signal } : {}) }),
    review: (id: string, input: RentalReviewInput, etag: string, key: string) => write<Schema['OpsReviewView'], RentalReviewInput>(orderPath(id) + '/reviews', input, etag, key),
    payments: (filter: NonNullable<operations['O01']['parameters']['query']>, signal?: AbortSignal) => read<Schema['OpsPaymentPage']>(`/v1/ops/rental-payments?${rentalQuery(filter)}`, signal),
    refunds: (filter: NonNullable<operations['O02']['parameters']['query']>, signal?: AbortSignal) => read<Schema['OpsRefundPage']>(`/v1/ops/rental-refunds?${rentalQuery(filter)}`, signal),
    reconcilePayment: (id: string, key: string) => client.request<Schema['OpsPaymentView'], Record<string, never>>({ path: `/v1/ops/rental-payments/${encodeURIComponent(id)}/reconciliation`, method: 'POST', body: {}, idempotencyKey: key }),
    reconcileRefund: (id: string, key: string) => client.request<Schema['OpsRefundView'], Record<string, never>>({ path: `/v1/ops/rental-refunds/${encodeURIComponent(id)}/reconciliation`, method: 'POST', body: {}, idempotencyKey: key }),
    earnings: (filter: EarningFilter, signal?: AbortSignal) => read<Schema['OpsEarningPage']>(`/v1/ops/rental-earnings?${rentalQuery(filter)}`, signal),
    earning: (id: string, signal?: AbortSignal) => read<Schema['OpsEarningView']>(`/v1/ops/rental-earnings/${encodeURIComponent(id)}`, signal),
    exportIncome: (month: string, merchantId?: string, signal?: AbortSignal) => client.request<Blob>({ path: `/v1/ops/merchant-income/export?${rentalQuery({ period_month: month, merchant_id: merchantId })}`, responseType: 'csv', ...(signal ? { signal } : {}) }),
  };
}
export type RentalOrdersGateway = ReturnType<typeof createRentalOrders>;
export function rentalRefundVerificationRejected(error: unknown): boolean {
  return error instanceof ApiProblem && [400, 401, 403, 404, 409, 412, 422, 429].includes(error.status)
    && !['IDEMPOTENCY_IN_PROGRESS', 'IDEMPOTENCY_PENDING', 'UNKNOWN'].includes(error.code);
}
export function rentalFailure(error: unknown): string {
  if (error instanceof ApiProblem) {
    if (error.status === 403) return '当前账户没有权限，请返回有权查看的列表。';
    if (error.status === 404) return '记录不存在或当前不可见。';
    if (error.status === 412 || error.status === 428) return '记录已变化，请重新读取并核对，未覆盖最新记录。';
    if (error.status >= 400 && error.status < 500 && error.status !== 408) return error.message;
  }
  return '结果尚未确认，请查询原记录；不会自动重试或创建新请求。';
}
export function rentalUnknown(error: unknown): boolean { return !(error instanceof ApiProblem) || error.status === 0 || error.status === 408 || error.status >= 500 || error.code === 'IDEMPOTENCY_PENDING'; }
export function rentalValidationErrors(error: unknown): { field: string; reason: string }[] {
  if (!(error instanceof ApiProblem) || error.status !== 422 || !Array.isArray(error.details?.errors)) return [];
  return error.details.errors.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    return typeof item.field === 'string' && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/.test(item.field) && typeof item.reason === 'string' && item.reason.trim() && item.reason.length <= 256 && typeof item.rule === 'string' && /^[A-Z][A-Z0-9_]*$/.test(item.rule)
      ? [{ field: item.field, reason: item.reason }] : [];
  });
}
