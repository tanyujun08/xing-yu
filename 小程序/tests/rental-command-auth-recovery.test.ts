import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { rentalOrderApi } from '../miniprogram/shared/api/rental-order-api';
import { readStoredApiSession } from '../miniprogram/shared/session/api-session';

interface Wire {
    url: string;
    method: string;
    data: Record<string, unknown>;
    header: Record<string, string>;
    success(response: unknown): void;
    fail(error: { errMsg: string }): void;
}
const sessionKey = 'xingyu.api-session.v1';
const originalPath = '/v1/me/rental-orders/order-a/return/evidence-slots/front/items/1';
const originalETag = '"RETURN:return-a:1"';
const body = { material_id: 'material-a', reason: '原归还材料' };
const calls: Wire[] = [];
const storage = new Map<string, unknown>();
let transport: (options: Wire) => void;
const slot = (owner = 'account-a', path = originalPath) => 'xingyu.rental-command.v1:' + encodeURIComponent(owner) + ':' + encodeURIComponent(path);
function login(owner = 'account-a', token = 'fixture-token-' + owner) {
    storage.set(sessionKey, { accountId: owner, accessToken: token, refreshToken: 'fixture-refresh', expiresAt: Date.now() + 120000 });
}
function reply(options: Wire, status = 200) {
    options.success({ statusCode: status, data: status === 200 ? { accepted: true } : { code: status === 401 ? 'TOKEN_INVALID' : 'FORBIDDEN', message: '本地模拟认证失败', request_id: 'fixture-auth-recovery' }, header: { ETag: '"RETURN:return-a:2"' } });
}
const submit = (etag = originalETag) => rentalOrderApi.saveReturnEvidence('order-a', 'front', 1, body, etag);
async function makeUnknown() {
    transport = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(submit().promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    return structuredClone(storage.get(slot()));
}
function sameIntent(actual: Wire, original: Wire) {
    expect(actual.url).toBe(original.url);
    expect(actual.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
    expect(actual.header['If-Match']).toBe(original.header['If-Match']);
    expect(actual.data).toEqual(original.data);
}
beforeEach(() => {
    calls.length = 0; storage.clear(); login(); transport = options => reply(options);
    vi.stubGlobal('wx', {
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
        getStorageSync: (key: string) => storage.get(key),
        setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
        removeStorageSync: (key: string) => storage.delete(key),
        request: (options: Wire) => { calls.push(options); transport(options); return { abort: vi.fn() }; },
    });
});
afterEach(() => vi.unstubAllGlobals());

test('first unauthenticated command may retire its unaccepted intent without retrying', async () => {
    transport = options => reply(options, 401);
    await expect(submit().promise).rejects.toMatchObject({ statusCode: 401, code: 'TOKEN_INVALID' });
    expect(readStoredApiSession()).toBeNull(); expect(storage.has(slot())).toBe(false); expect(calls).toHaveLength(1);
    login(); transport = options => reply(options); await submit().promise;
    expect(calls[1]!.header['Idempotency-Key']).not.toBe(calls[0]!.header['Idempotency-Key']);
    expect(storage.has(slot())).toBe(false); expect(calls).toHaveLength(2);
});

test.each(['401', '403', 'SESSION_CHANGED'] as const)('an UNKNOWN command recovered through %s retains its original body key and ETag until explicit success', async boundary => {
    const pending = await makeUnknown(), original = calls[0]!;
    transport = options => {
        if (boundary === 'SESSION_CHANGED') login('account-a', 'new-fixture-token');
        reply(options, boundary === '403' ? 403 : 401);
    };
    await expect(submit('"RETURN:return-a:9"').promise).rejects.toMatchObject(boundary === 'SESSION_CHANGED' ? { code: 'SESSION_CHANGED' } : { statusCode: Number(boundary) });
    expect(storage.get(slot())).toEqual(pending); sameIntent(calls[1]!, original); expect(calls).toHaveLength(2);
    if (boundary === '401') expect(readStoredApiSession()).toBeNull();
    login(); transport = options => reply(options);
    await submit('"RETURN:return-a:10"').promise;
    sameIntent(calls[2]!, original); expect(storage.has(slot())).toBe(false); expect(calls).toHaveLength(3);
});

test('account A late authentication failure cannot erase account B intent or newer session', async () => {
    const a = await makeUnknown(); transport = () => undefined;
    const recoveringA = submit('"RETURN:return-a:9"'), aWire = calls[1]!;
    login('account-b'); transport = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(submit().promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    const b = structuredClone(storage.get(slot('account-b')));
    reply(aWire, 401);
    await expect(recoveringA.promise).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(readStoredApiSession()?.accountId).toBe('account-b');
    expect(storage.get(slot())).toEqual(a); expect(storage.get(slot('account-b'))).toEqual(b); expect(calls).toHaveLength(3);
    transport = options => reply(options); await submit().promise;
    expect(storage.has(slot('account-b'))).toBe(false); expect(storage.get(slot())).toEqual(a);
});

test('UNKNOWN recovery refuses body replacement and a stored intent transplanted to another target', async () => {
    const original = await makeUnknown();
    expect(() => rentalOrderApi.saveReturnEvidence('order-a', 'front', 1, { ...body, reason: '替换正文' }, originalETag)).toThrow('原请求结果待核实');
    const otherPath = originalPath.replace('order-a', 'order-b');
    storage.set(slot('account-a', otherPath), original);
    expect(() => rentalOrderApi.saveReturnEvidence('order-b', 'front', 1, body, originalETag)).toThrow('原请求记录不完整');
    expect(calls).toHaveLength(1); expect(storage.get(slot())).toEqual(original);
});

test('confirmed version conflict still retires an UNKNOWN command rather than swallowing a business rejection', async () => {
    await makeUnknown();
    transport = options => options.success({ statusCode: 412, data: { code: 'VERSION_CONFLICT', message: '已明确拒绝', request_id: 'fixture-conflict' }, header: {} });
    await expect(submit().promise).rejects.toMatchObject({ statusCode: 412, code: 'VERSION_CONFLICT' });
    expect(storage.has(slot())).toBe(false); expect(calls).toHaveLength(2);
});

test.each([false, true])('pending shipment survives reload and replays original body key and version (correction=%s)', async correction => {
    const shipping = { tracking_no: '001ABC', carrier: null }, corrected = { ...shipping, reason: '原单号有误' };
    const send = (etag: string) => correction ? rentalOrderApi.correctShipment('order-a', corrected, etag) : rentalOrderApi.ship('order-a', shipping, etag);
    transport = options => options.fail({ errMsg: 'request:fail timeout' });
    await expect(send('"ORDER:1"').promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    const original = calls[0]!;
    expect(rentalOrderApi.pendingShipment('order-a')).toEqual({ correction, body: correction ? corrected : shipping, etag: '"ORDER:1"' });
    expect(rentalOrderApi.pendingShipment('another-order')).toBeNull();
    login('account-b'); expect(rentalOrderApi.pendingShipment('order-a')).toBeNull(); login();
    transport = options => reply(options); await send('"ORDER:99"').promise;
    sameIntent(calls[1]!, original); expect(rentalOrderApi.pendingShipment('order-a')).toBeNull(); expect(calls).toHaveLength(2);
});
test('stored shipment with missing required correction reason is not replayed', () => {
    const path = '/v1/me/rental-orders/order-a/shipment/corrections';
    storage.set(slot('account-a', path), { owner: 'account-a', path, key: 'original-key', etag: '"ORDER:1"', body: { tracking_no: '001ABC', carrier: null } });
    expect(() => rentalOrderApi.pendingShipment('order-a')).toThrow('原物流请求记录不完整'); expect(calls).toHaveLength(0);
});
