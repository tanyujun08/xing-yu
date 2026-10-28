import { afterEach, expect, test, vi } from 'vitest';
import { request, uploadProfileImage } from '../miniprogram/shared/api/request';
import { uploadMaterialFile } from '../miniprogram/shared/api/request';

interface MockRequestOptions {
  header: Record<string, string>;
  success: (response: unknown) => void;
  fail: (error: { errMsg: string }) => void;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('adds request correlation and mutation guards without automatic retries', async () => {
  const requestMock = vi.fn((options: { header: Record<string, string>; success: (response: unknown) => void }) => {
    options.success({ statusCode: 200, data: { status: 'ready' }, header: {}, cookies: [] });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => ({ accessToken: 'test-token', refreshToken: 'refresh', accountId: 'a', expiresAt: Date.now() + 60_000 }),
    removeStorageSync: vi.fn(),
    request: requestMock,
  });

  const handle = request<{ status: string }, { check: boolean }>({
    path: '/readyz',
    method: 'POST',
    body: { check: true },
    idempotencyKey: 'ready:test',
    aggregateVersion: '7',
  });
  await expect(handle.promise).resolves.toEqual({ status: 'ready' });

  const options = requestMock.mock.calls[0]?.[0];
  expect(options?.header.Authorization).toBe('Bearer test-token');
  expect(options?.header['Idempotency-Key']).toBe('ready:test');
  expect(options?.header['If-Match']).toBe('7');
  expect(requestMock).toHaveBeenCalledTimes(1);
});

test('preserves a version-conflict problem without retrying', async () => {
  const requestMock = vi.fn((options: MockRequestOptions) => {
    options.success({
      statusCode: 409,
      data: { code: 'VERSION_CONFLICT', message: 'refresh', request_id: 'req_conflict' },
      header: {},
      cookies: [],
    });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => '',
    removeStorageSync: vi.fn(),
    request: requestMock,
  });

  await expect(request({ path: '/v1/action' }).promise).rejects.toMatchObject({
    statusCode: 409,
    code: 'VERSION_CONFLICT',
    requestId: 'req_conflict',
  });
  expect(requestMock).toHaveBeenCalledTimes(1);
});

test('clears the local business session on 401', async () => {
  const removeStorageSync = vi.fn();
  const requestMock = vi.fn((options: MockRequestOptions) => {
    options.success({
      statusCode: 401,
      data: { code: 'UNAUTHENTICATED', message: 'login', request_id: 'req_401' },
      header: {},
      cookies: [],
    });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => ({ accessToken: 'expired', refreshToken: 'refresh', accountId: 'a', expiresAt: Date.now() + 60_000 }),
    removeStorageSync,
    request: requestMock,
  });

  await expect(request({ path: '/v1/session' }).promise).rejects.toMatchObject({ statusCode: 401 });
  expect(removeStorageSync).toHaveBeenCalledWith('xingyu.api-session.v1');
});

test('classifies transport timeout without retrying', async () => {
  const requestMock = vi.fn((options: MockRequestOptions) => {
    options.fail({ errMsg: 'request:fail timeout' });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => '',
    removeStorageSync: vi.fn(),
    request: requestMock,
  });

  await expect(request({ path: '/v1/query' }).promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  expect(requestMock).toHaveBeenCalledTimes(1);
});

test('classifies explicit RequestTask cancellation', async () => {
  let captured: MockRequestOptions | undefined;
  const requestMock = vi.fn((options: MockRequestOptions) => {
    captured = options;
    return {
      abort: () => captured?.fail({ errMsg: 'request:fail abort' }),
    };
  });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => '',
    removeStorageSync: vi.fn(),
    request: requestMock,
  });

  const handle = request({ path: '/v1/query' });
  const assertion = expect(handle.promise).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  handle.abort();
  await assertion;
});

test('late 401 does not clear a newer session', async () => {
  let session = { accessToken: 'old', refreshToken: 'refresh', accountId: 'a', expiresAt: Date.now() + 60_000 };
  let pending: MockRequestOptions | undefined;
  const remove = vi.fn();
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: () => session,
    removeStorageSync: remove, request: (options: MockRequestOptions) => { pending = options; return { abort: vi.fn() }; } });
  const handle = request({ path: '/v1/auth/me' });
  session = { ...session, accessToken: 'new', accountId: 'b' };
  pending?.success({ statusCode: 401, data: { code: 'UNAUTHENTICATED', message: 'expired', request_id: 'old' }, header: {} });
  await expect(handle.promise).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(remove).not.toHaveBeenCalled();
});

test('successful old-account data is discarded after account switch', async () => {
  let token = 'old';
  let pending: MockRequestOptions | undefined;
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => ({ accessToken: token, refreshToken: 'refresh', accountId: token, expiresAt: Date.now() + 60_000 }),
    request: (options: MockRequestOptions) => { pending = options; return { abort: vi.fn() }; } });
  const handle = request({ path: '/v1/me/addresses' });
  token = 'new';
  pending?.success({ statusCode: 200, data: { private: 'old account' }, header: {} });
  await expect(handle.promise).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
});

test('abort followed by a host success never returns data', async () => {
  let pending: MockRequestOptions | undefined;
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: () => '',
    request: (options: MockRequestOptions) => { pending = options; return { abort: vi.fn() }; } });
  const handle = request({ path: '/v1/me/addresses' });
  handle.abort();
  pending?.success({ statusCode: 200, data: { private: true }, header: {} });
  await expect(handle.promise).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
});

test('foreign and malformed paths fail before wx.request', async () => {
  const host = vi.fn();
  vi.stubGlobal('wx', { request: host });
  for (const path of ['https://example.com', '//example.com', '/a\\b', '/a\r\nX: y', '/a#fragment']) {
    await expect(request({ path }).promise).rejects.toThrow('first-party');
  }
  expect(host).not.toHaveBeenCalled();
});

test('public login does not attach an existing bearer', async () => {
  const host = vi.fn((options: MockRequestOptions) => { options.success({ statusCode: 201, data: {}, header: {} }); return { abort: vi.fn() }; });
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => ({ accessToken: 'old', refreshToken: 'r', accountId: 'a', expiresAt: Date.now() + 60_000 }), request: host });
  await request({ path: '/v1/auth/wechat-mini/sessions', authenticated: false }).promise;
  expect(host.mock.calls[0]?.[0].header.Authorization).toBeUndefined();
});

test('multipart avatar targets only first-party staging and preserves async processing receipt', async()=>{
 const uploadFile=vi.fn((o:{success:(r:unknown)=>void})=>{o.success({statusCode:202,data:JSON.stringify({material_id:'m',status:'PROCESSING'})});return{abort:vi.fn()}});
 vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:()=>({accessToken:'token',refreshToken:'refresh',accountId:'a',expiresAt:Date.now()+60000}),uploadFile});
 await expect(uploadProfileImage('wxfile://image','stable').promise).resolves.toEqual({material_id:'m',status:'PROCESSING'});
 expect(uploadFile.mock.calls[0]?.[0]).toMatchObject({url:expect.stringMatching(/\/v1\/materials\/files$/),name:'file',filePath:'wxfile://image',formData:{class:'PROFILE_IMAGE'},header:{Authorization:'Bearer token','Idempotency-Key':'stable'}});
 expect(uploadFile).toHaveBeenCalledTimes(1);
});
test.each(['account-change','abort','invalid-json','unauthorized'] as const)('avatar upload fails closed on %s',async(kind)=>{
 let token='old';let pending!:{success:(r:unknown)=>void};const abort=vi.fn();const remove=vi.fn();
 vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:()=>({accessToken:token,refreshToken:'refresh',accountId:token,expiresAt:Date.now()+60000}),removeStorageSync:remove,uploadFile:(o:typeof pending)=>{pending=o;return{abort}}});
 const h=uploadProfileImage('wxfile://image','intent');if(kind==='account-change')token='new';if(kind==='abort')h.abort();pending.success({statusCode:kind==='unauthorized'?401:201,data:kind==='invalid-json'||kind==='unauthorized'?'invalid':JSON.stringify({material_id:'m'})});await expect(h.promise).rejects.toBeInstanceOf(Error);
 expect(remove).toHaveBeenCalledTimes(kind==='unauthorized'?1:0);expect(abort).toHaveBeenCalledTimes(kind==='abort'?1:0);
});

test('expired publication upload refreshes once and uses the renewed bearer', async () => {
  let session = { accessToken: 'old', refreshToken: 'refresh-old', accountId: 'owner-a', expiresAt: Date.now() - 1 };
  const requestHost = vi.fn((options: { url: string; header: Record<string, string>; success: (value: unknown) => void }) => {
    expect(options.url).toMatch(/\/v1\/auth\/token\/refresh$/);
    expect(options.header.Authorization).toBeUndefined();
    options.success({ statusCode: 200, data: { token_type: 'Bearer', access_token: 'new', refresh_token: 'refresh-new',
      expires_in: 900, account: { account_id: 'owner-a', audience: 'MINIPROGRAM' } } });
    return { abort: vi.fn() };
  });
  const uploadHost = vi.fn((options: { header: Record<string, string>; success: (value: unknown) => void }) => {
    options.success({ statusCode: 201, data: JSON.stringify({ material_id: 'asset-image' }) });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? session : '',
    setStorageSync: (key: string, value: typeof session) => { if (key === 'xingyu.api-session.v1') session = value; },
    removeStorageSync: vi.fn(), request: requestHost, uploadFile: uploadHost });
  await expect(uploadMaterialFile('wxfile://camera', 'RENTAL_ASSET_IMAGE', 'stable-upload').promise)
    .resolves.toEqual({ material_id: 'asset-image' });
  expect(requestHost).toHaveBeenCalledTimes(1);
  expect(uploadHost.mock.calls[0]?.[0].header).toMatchObject({ Authorization: 'Bearer new', 'Idempotency-Key': 'stable-upload' });
});

test('concurrent expired publication requests share refresh but do not replay business mutations', async () => {
  let session = { accessToken: 'old', refreshToken: 'refresh-old', accountId: 'owner-a', expiresAt: Date.now() - 1 };
  let refresh: ((value: unknown) => void) | undefined;
  const requestHost = vi.fn((options: { url: string; success: (value: unknown) => void }) => {
    if (options.url.endsWith('/v1/auth/token/refresh')) refresh = options.success;
    else options.success({ statusCode: 200, data: { ok: true }, header: {} });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? session : '',
    setStorageSync: (key: string, value: typeof session) => { if (key === 'xingyu.api-session.v1') session = value; },
    removeStorageSync: vi.fn(), request: requestHost });
  const first = request({ path: '/v1/me/assets/a/updates', method: 'POST', idempotencyKey: 'update-a' });
  const second = request({ path: '/v1/me/assets/b/updates', method: 'POST', idempotencyKey: 'update-b' });
  expect(requestHost).toHaveBeenCalledTimes(1);
  refresh?.({ statusCode: 200, data: { token_type: 'Bearer', access_token: 'new', refresh_token: 'refresh-new',
    expires_in: 900, account: { account_id: 'owner-a', audience: 'MINIPROGRAM' } } });
  await expect(Promise.all([first.promise, second.promise])).resolves.toEqual([{ ok: true }, { ok: true }]);
  expect(requestHost).toHaveBeenCalledTimes(3);
});

test('unknown refresh outcome keeps the same intent for a later attempt', async () => {
  const session = { accessToken: 'old', refreshToken: 'refresh-old', accountId: 'owner-a', expiresAt: Date.now() - 1 };
  let savedIntent: unknown;
  const seenKeys: string[] = [];
  const requestHost = vi.fn((options: { header: Record<string, string>; fail: (value: { errMsg: string }) => void }) => {
    seenKeys.push(options.header['Idempotency-Key'] ?? '');
    options.fail({ errMsg: 'request:fail timeout' });
    return { abort: vi.fn() };
  });
  const uploadHost = vi.fn();
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? session : savedIntent,
    setStorageSync: (key: string, value: unknown) => { if (key !== 'xingyu.api-session.v1') savedIntent = value; },
    removeStorageSync: vi.fn(), request: requestHost, uploadFile: uploadHost });
  await expect(uploadMaterialFile('wxfile://camera', 'RENTAL_ASSET_IMAGE', 'same-upload').promise)
    .rejects.toMatchObject({ code: 'SESSION_REFRESH_UNKNOWN' });
  await expect(uploadMaterialFile('wxfile://camera', 'RENTAL_ASSET_IMAGE', 'same-upload').promise)
    .rejects.toMatchObject({ code: 'SESSION_REFRESH_UNKNOWN' });
  expect(seenKeys).toHaveLength(2);
  expect(seenKeys[0]).toMatch(/^mini-refresh:/);
  expect(seenKeys[0]).toBe(seenKeys[1]);
  expect(uploadHost).not.toHaveBeenCalled();
});

test('account switch during refresh never uploads under the other identity', async () => {
  let session = { accessToken: 'old', refreshToken: 'refresh-old', accountId: 'owner-a', expiresAt: Date.now() - 1 };
  let refresh: ((value: unknown) => void) | undefined;
  const uploadHost = vi.fn();
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? session : '',
    setStorageSync: vi.fn(), removeStorageSync: vi.fn(), uploadFile: uploadHost,
    request: (options: { success: (value: unknown) => void }) => { refresh = options.success; return { abort: vi.fn() }; } });
  const upload = uploadMaterialFile('wxfile://camera', 'RENTAL_ASSET_IMAGE', 'same-upload');
  session = { accessToken: 'other', refreshToken: 'other-refresh', accountId: 'owner-b', expiresAt: Date.now() + 900_000 };
  refresh?.({ statusCode: 200, data: { token_type: 'Bearer', access_token: 'new', refresh_token: 'refresh-new',
    expires_in: 900, account: { account_id: 'owner-a', audience: 'MINIPROGRAM' } } });
  await expect(upload.promise).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(uploadHost).not.toHaveBeenCalled();
});
