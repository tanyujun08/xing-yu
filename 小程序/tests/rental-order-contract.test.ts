import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { rentalOrderApi } from '../miniprogram/shared/api/rental-order-api';
import { request } from '../miniprogram/shared/api/request';
import { accountApi } from '../miniprogram/shared/api/account-api';
import { beijingTime, beijingInputToUTC, rentalMoney, rentalOrderCard } from '../miniprogram/shared/presentation/rental-order';
interface Options {
    url: string;
    method: string;
    data: Record<string, unknown>;
    header: Record<string, string>;
    success(response: unknown): void;
    fail(error: {
        errMsg: string;
    }): void;
}
let owner = 'tenant-a';
let wire: (options: Options) => void;
const calls: Options[] = [];
const storage = new Map<string, unknown>();
beforeEach(() => { owner = 'tenant-a'; calls.length = 0; storage.clear(); wire = options => options.success({ statusCode: 200, data: { ok: true }, header: { ETag: '"ORDER:1:7"' } }); vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'r', expiresAt: Date.now() + 100000 } : storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)), removeStorageSync: (key: string) => storage.delete(key), request: (options: Options) => { calls.push(options); wire(options); return { abort: vi.fn() }; } }); });
afterEach(() => vi.unstubAllGlobals());
function orderCardSource() { return { order_id: 'original-order', order_no: 'R19', display_status: '待补缴', display_status_code: 'AWAITING_SUPPLEMENT', has_exception: false, created_at: '2026-10-09T08:00:00Z', rental_start_at: '2026-10-10T00:00:00Z', rental_end_at: '2026-10-13T00:00:00Z', supply_channel: 'PERSONAL', initial_due_fen: '68000', initial_paid_fen: '68000', initial_payer_total_fen: '67000', supplement_due_fen: '20000' as string | null, payment_due_at: null as string | null, viewer_role: 'TENANT', allowed_actions: [] as { action_code: string; allowed: boolean; display_reason: string | null }[], asset: { title: '合成设备', cover_media: null } }; }
test.each([['20000', '¥200.00'], [null, '待核实']])('order card uses only the final supplement projection %s', (amount, expected) => {
    const source = orderCardSource(); source.supplement_due_fen = amount;
    expect(rentalOrderCard(source)).toMatchObject({ id: 'original-order', amountText: expected, amountLabel: '待补缴金额', actionLabel: '查看费用', destination: 'detail' });
});
test('a signature card uses server permission and keeps the original order identity', () => {
    const source = orderCardSource(); source.display_status_code = 'PREPARING'; source.allowed_actions = [{ action_code: 'SIGN_CONTRACT', allowed: false, display_reason: '已过期' }];
    expect(rentalOrderCard(source)).toMatchObject({ actionLabel: '查看订单', destination: 'detail' });
    source.allowed_actions[0]!.allowed = true;
    expect(rentalOrderCard(source)).toMatchObject({ id: 'original-order', actionLabel: '继续签约', destination: 'contract' });
});
test('only an awaiting-payment card displays its trusted payment deadline', () => {
    const source = orderCardSource(); source.payment_due_at = '2026-10-09T07:40:00Z';
    expect(rentalOrderCard(source).deadlineText).toBe('');
    source.display_status_code = 'AWAITING_PAYMENT'; expect(rentalOrderCard(source).deadlineText).toContain('2026-10-09 15:40');
});
test.each([
    ['AWAITING_DELIVERY', 'SHIP', true, '填写运单'],
    ['AWAITING_DELIVERY', 'SHIP', false, '查看订单'],
    ['IN_USE', 'START_RETURN', true, '查看订单'],
    ['RETURNING', 'SAVE_RETURN_EVIDENCE', true, '查看归还'],
    ['RETURN_REVIEW', '', false, '查看归还'],
    ['AWAITING_SUPPLEMENT', 'PAY_INITIAL', true, '查看结算'],
    ['COMPLETED', '', false, '查看结算'],
    ['PREPARING', 'SIGN_CONTRACT', true, '查看订单'],
] as const)('lessor %s lists its own task without tenant money or signature/payment tasks', (code, action, allowed, label) => {
    const source = orderCardSource(); source.viewer_role = 'LESSOR'; source.display_status_code = code;
    source.payment_due_at = '2026-10-09T07:40:00Z'; source.allowed_actions = [{ action_code: action, allowed, display_reason: null }];
    expect(rentalOrderCard(source)).toMatchObject({ showAmount: false, amountLabel: '', amountText: '', deadlineText: '', actionLabel: label, destination: 'detail' });
});
test('return cabinet options send required purpose on initial and cursor reads without dispatching a task', async () => {
    await rentalOrderApi.cabinets('o1').promise;
    await rentalOrderApi.cabinets('o1', 'next+page/=').promise;
    for (const [index, call] of calls.entries()) {
        const url = new URL(call.url);
        expect(call.method).toBe('GET');
        expect(url.pathname).toBe('/v1/me/rental-orders/o1/cabinet-options');
        expect(url.searchParams.get('purpose')).toBe('RETURN');
        expect(url.searchParams.get('limit')).toBe('20');
        expect(url.searchParams.get('cursor')).toBe(index === 0 ? null : 'next+page/=');
    }
    expect(calls).toHaveLength(2);
});
test('object ETag is preserved from response and sent verbatim; missing ETag refuses mutation', async () => { const record = await rentalOrderApi.get('o1').promise; expect(record.etag).toBe('"ORDER:1:7"'); await rentalOrderApi.confirm('o1', record.etag).promise; expect(calls[1]?.header['If-Match']).toBe('"ORDER:1:7"'); expect(calls[1]?.data).toEqual({}); expect(() => rentalOrderApi.confirm('o1', '')).toThrow('对象版本'); expect(calls).toHaveLength(2); });
test('ambiguous shipment replay keeps the original key, payload and ETag across fresh reads', async () => { wire = options => options.fail({ errMsg: 'request:fail timeout' }); await expect(rentalOrderApi.ship('o1', { tracking_no: '00123', carrier: null }, '"ORDER:o1:2"').promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' }); const original = calls[0]!; await expect(rentalOrderApi.ship('o1', { tracking_no: '00123', carrier: null }, '"ORDER:o1:9"').promise).rejects.toBeDefined(); expect(calls[1]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']); expect(calls[1]?.header['If-Match']).toBe(original.header['If-Match']); expect(() => rentalOrderApi.ship('o1', { tracking_no: 'other', carrier: null }, '"ORDER:o1:9"')).toThrow('原请求结果待核实'); expect(calls).toHaveLength(2); });
test('command storage is scoped to the authenticated actor and does not clear another account on late response', async () => { wire = () => undefined; const handle = rentalOrderApi.confirm('o1', '"ORDER:o1:2"'); const first = calls[0]!; owner = 'tenant-b'; const other = rentalOrderApi.confirm('o1', '"ORDER:o1:2"'); const second = calls[1]!; expect(second.header['Idempotency-Key']).not.toBe(first.header['Idempotency-Key']); first.success({ statusCode: 200, data: {}, header: { ETag: '"ORDER:o1:3"' } }); await expect(handle.promise).rejects.toMatchObject({ code: 'SESSION_CHANGED' }); second.success({ statusCode: 200, data: {}, header: { ETag: '"ORDER:o1:3"' } }); await other.promise; expect([...storage.keys()].some(key => key.includes('tenant-a'))).toBe(true); expect([...storage.keys()].some(key => key.includes('tenant-b'))).toBe(false); });
test('confirmed RENTAL_NOT_STARTED retires that pickup intent; explicit later retry creates a new key', async () => { wire = options => options.success({ statusCode: 409, data: { code: 'RESOURCE_CONFLICT', message: '租期尚未开始', request_id: 'r', details: { reason_code: 'RENTAL_NOT_STARTED' } }, header: {} }); await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' }); const key = calls[0]!.header['Idempotency-Key']; expect(rentalOrderApi.pendingPickup()).toBeNull(); await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise).rejects.toBeDefined(); expect(calls[1]?.data['pickup_code']).toBe('001234'); expect(calls[1]?.header['Idempotency-Key']).not.toBe(key); });
test('unknown creation uses read-only lookup and clears the matching key only after terminal locator', async () => { wire = options => options.fail({ errMsg: 'request:fail timeout' }); const body = { asset_id: 'a', rental_start_at: '2026-10-06T00:00:00Z', rental_end_at: '2026-10-07T00:00:00Z', delivery_method: 'CABINET' as const, address_id: null, coupon_id: null, accepted_terms_hash: 'a'.repeat(64) }; await expect(rentalOrderApi.prepare(body).promise).rejects.toBeDefined(); const pending = rentalOrderApi.pendingPreparation()!; wire = options => options.success({ statusCode: 200, data: { state: 'COMPLETED', result: { resource_type: 'ORDER', resource_id: 'o1' }, error: null, retry_same_request: false }, header: {} }); await rentalOrderApi.lookup('B02', pending.key).promise; expect(calls[1]?.data).toEqual({ operation_id: 'B02', target_id: null, idempotency_key: pending.key }); expect(rentalOrderApi.pendingPreparation()).toBeNull(); expect(calls).toHaveLength(2); });
test('response metadata cannot escape a cancelled or account-stale request', async () => { wire = () => undefined; const callback = vi.fn(); const handle = request({ path: '/v1/me/rental-orders/o1', onResponseHeaders: callback }); handle.abort(); calls[0]!.success({ statusCode: 200, data: {}, header: { ETag: '"unsafe"' } }); await expect(handle.promise).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' }); expect(callback).not.toHaveBeenCalled(); });
test('all fixed-term display and input is explicitly Beijing and preserves money precision', () => { expect(beijingInputToUTC('2026-10-06', '09:30')).toBe('2026-10-06T01:30:00.000Z'); expect(beijingTime('2026-10-06T01:30:00Z')).toBe('2026-10-06 09:30'); expect(() => beijingInputToUTC('2026-02-30', '09:30')).toThrow('日期无效'); expect(rentalMoney(null)).toBe('待核实'); expect(rentalMoney('24000')).toBe('¥240.00'); });
test('handwritten signature posts the frozen hashes material identity and CONTRACT ETag', async () => {
    const body = { client_signature_id: 'signature-original-01', signature_material_id: 'ink-1', agreement_sha256: 'a'.repeat(64), order_terms_sha256: 'b'.repeat(64), replaces_attempt_id: null, replaces_attempt_version: null };
    await rentalOrderApi.createSignature('o1', body, '"CONTRACT:YzE:3"').promise;
    expect(calls[0]?.url).toContain('/v1/me/rental-orders/o1/contract/signature-attempts');expect(calls[0]?.data).toEqual(body);
    expect(calls[0]?.header['If-Match']).toBe('"CONTRACT:YzE:3"');expect(calls[0]?.header['Idempotency-Key']).toBeTruthy();
    expect(() => rentalOrderApi.createSignature('o1', body, '')).toThrow('对象版本');expect(calls).toHaveLength(1);
});
test('self declared identity posts only name and ID with the caller intent and never stores raw identity', async () => {
    const body={real_name:'张三',identity_number:'11010519491231002X'};
    await accountApi.saveIdentity(body,'original-identity-intent').promise;
    expect(calls[0]?.url).toContain('/v1/me/identity/verifications');expect(calls[0]?.method).toBe('POST');expect(calls[0]?.data).toEqual(body);
    expect(calls[0]?.header['Idempotency-Key']).toBe('original-identity-intent');expect(calls[0]?.header['If-Match']).toBeUndefined();
    expect(storage.size).toBe(0);
});
test('order return reads and original intent lookup never invent an If-Match or mutation intent', async () => {
    await rentalOrderApi.get('o1').promise;await rentalOrderApi.return('o1').promise;await rentalOrderApi.lookup('B02','original-key').promise;
    expect(calls.map(v=>v.method)).toEqual(['GET','GET','POST']);
    expect(calls.every(v=>v.header['If-Match']===undefined && v.header['Idempotency-Key']===undefined)).toBe(true);
});
test('lost pickup response survives a client reload and resolves its stored original intent without digits or an open command', async () => {
    wire=options=>options.fail({errMsg:'request:fail timeout'});await expect(rentalOrderApi.pickup('cab_12345678901234567890','001234').promise).rejects.toBeDefined();
    const original=rentalOrderApi.pendingPickup()!;expect(original.key).toBe(calls[0]?.header['Idempotency-Key']);
    vi.resetModules();const fresh=(await import('../miniprogram/shared/api/rental-order-api')).rentalOrderApi;
    expect(fresh.pendingPickup()?.key).toBe(original.key);
    wire=options=>options.success({statusCode:200,data:{state:'COMPLETED',result:{resource_type:'CABINET_TASK',resource_id:'original-task'},retry_same_request:false,error:null},header:{}});
    const recovered=await fresh.lookup('K10',fresh.pendingPickup()!.key).promise;
    expect(recovered.value.result?.resource_id).toBe('original-task');expect(calls).toHaveLength(2);expect(calls[1]?.data).toEqual({operation_id:'K10',target_id:null,idempotency_key:original.key});expect(fresh.pendingPickup()).toBeNull();
    expect(calls.some(call=>call.url.includes('/open'))).toBe(false);
});
test('pickup intents are actor scoped and switching accounts does not expose the previous locator', async () => {
    wire=options=>options.fail({errMsg:'request:fail timeout'});await expect(rentalOrderApi.pickup('cab_12345678901234567890','001234').promise).rejects.toBeDefined();
    expect(rentalOrderApi.pendingPickup()).not.toBeNull();owner='different-tenant';expect(rentalOrderApi.pendingPickup()).toBeNull();expect(calls).toHaveLength(1);
});

test('ambiguous slot replacement preserves original evidence intent until an explicit confirmed conflict', async () => {
    const body = { material_id: 'material-1', reason: '原材料说明' };
    wire = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(rentalOrderApi.saveReturnEvidence('o1', 'front', 1, body, '"RETURN:return-1:1"').promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    const original = calls[0]!;
    await expect(rentalOrderApi.saveReturnEvidence('o1', 'front', 1, body, '"RETURN:return-1:2"').promise).rejects.toBeDefined();
    expect(calls[1]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
    expect(calls[1]?.header['If-Match']).toBe(original.header['If-Match']); expect(calls[1]?.data).toEqual(original.data);
    expect(() => rentalOrderApi.saveReturnEvidence('o1', 'front', 1, { ...body, reason: '更换内容' }, '"RETURN:return-1:2"')).toThrow('原请求结果待核实');
    wire = options => options.success({ statusCode: 412, data: { code: 'VERSION_CONFLICT', message: '归还记录已更新', request_id: 'fixture' }, header: {} });
    await expect(rentalOrderApi.saveReturnEvidence('o1', 'front', 1, body, '"RETURN:return-1:2"').promise).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(calls).toHaveLength(3);
    wire = options => options.success({ statusCode: 200, data: {}, header: { ETag: '"RETURN:return-1:3"' } });
    await rentalOrderApi.saveReturnEvidence('o1', 'front', 1, body, '"RETURN:return-1:2"').promise;
    expect(calls[3]?.header['Idempotency-Key']).not.toBe(original.header['Idempotency-Key']);
    expect(calls[3]?.header['If-Match']).toBe('"RETURN:return-1:2"');
});
test('pickup recovery 05 early pickup definitive rejection retires the original intent', async () => {
  wire = options => options.success({ statusCode: 409, data: { code: 'RESOURCE_CONFLICT', message: '租期尚未开始', request_id: 'audit-early', details: { reason_code: 'RENTAL_NOT_STARTED' } }, header: {} });
  await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
  expect(rentalOrderApi.pendingPickup()).toBeNull();
});

test('pickup recovery 06 a mistyped code can be corrected after definitive refusal and authoritative NOT_FOUND lookup', async () => {
  wire = options => options.success({ statusCode: 409, data: { code: 'RESOURCE_CONFLICT', message: '当前状态不能执行', request_id: 'audit-wrong-code', details: { reason_code: 'PICKUP_UNAVAILABLE' } }, header: {} });
  await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001235').promise).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
  const pending = rentalOrderApi.pendingPickup();
  if (pending) {
    wire = options => options.success({ statusCode: 200, data: { state: 'NOT_FOUND', result: null, error: null, retry_same_request: true }, header: {} });
    await rentalOrderApi.lookup('K10', pending.key).promise;
  }
  wire = options => options.success({ statusCode: 201, data: { task_id: 't1', status: 'RESERVED' }, header: { ETag: '"TASK:t1:1"' } });
  let failure: unknown;
  try { await rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise; } catch (error) { failure = error; }
  expect(failure, 'corrected code must be submit-able after the server definitely rejected the typo without creating a task').toBeUndefined();
  expect(calls.filter(call => call.url.endsWith('/cabinet-pickups'))).toHaveLength(2);
});

test('pickup refusal after a lost response preserves its original key and immutable digits', async () => {
    wire = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise).rejects.toBeDefined();
    const original = rentalOrderApi.pendingPickup();
    wire = options => options.success({ statusCode: 409, data: { code: 'RESOURCE_CONFLICT', message: '不可用', request_id: 'pickup-refused', details: { reason_code: 'PICKUP_UNAVAILABLE' } }, header: {} });
    await expect(rentalOrderApi.pickup('cab_12345678901234567890', '001234').promise).rejects.toBeDefined();
    expect(rentalOrderApi.pendingPickup()?.key).toBe(original?.key);
    expect(() => rentalOrderApi.pickup('cab_12345678901234567890', '005678')).toThrow('原请求');
});
test('an original cabinet opening reuses its idempotency key and version after a lost response', async () => {
    wire = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(rentalOrderApi.openCabinet('t1', '001234', '"TASK:t1:1"').promise).rejects.toBeDefined();
    const key = calls[0]!.header['Idempotency-Key'];
    wire = options => options.success({ statusCode: 200, data: { task_id: 't1' }, header: {} });
    await rentalOrderApi.openCabinet('t1', '001234', '"TASK:t1:2"').promise;
    expect(calls[1]!.header).toMatchObject({ 'Idempotency-Key': key, 'If-Match': '"TASK:t1:1"' });
});
test('a definitely rejected resume code can be corrected without retaining its initial intent', async () => {
    wire = options => options.success({ statusCode: 409, data: { code: 'RESOURCE_CONFLICT', message: '不可用', request_id: 'pickup-refused', details: { reason_code: 'PICKUP_UNAVAILABLE' } }, header: {} });
    await expect(rentalOrderApi.openCabinet('t1', '001235', '"TASK:t1:1"').promise).rejects.toBeDefined();
    wire = options => options.success({ statusCode: 200, data: { task_id: 't1' }, header: {} });
    await rentalOrderApi.openCabinet('t1', '001234', '"TASK:t1:1"').promise;
    expect(calls).toHaveLength(2);
});
test('pickup task locators survive a new page and are isolated by account and cabinet scene', () => {
    const scene = 'cab_12345678901234567890';
    rentalOrderApi.rememberPickupTask(scene, 't1');
    expect(rentalOrderApi.pickupTask(scene)).toBe('t1');
    expect(rentalOrderApi.pickupTask('cab_12345678901234567891')).toBeNull();
    owner = 'tenant-b'; expect(rentalOrderApi.pickupTask(scene)).toBeNull();
    owner = 'tenant-a'; rentalOrderApi.forgetPickupTask(scene, 'different'); expect(rentalOrderApi.pickupTask(scene)).toBe('t1');
    rentalOrderApi.forgetPickupTask(scene, 't1'); expect(rentalOrderApi.pickupTask(scene)).toBeNull();
});
