import { afterEach, expect, test, vi } from 'vitest';
import { accountApi } from '../miniprogram/shared/api/account-api';

afterEach(() => vi.unstubAllGlobals());

test('phone login uses a distinct wx.login code and sends both only to the first-party session API', async () => {
  const setStorageSync = vi.fn();
  const login = vi.fn((options: { success: (result: { code: string }) => void }) => options.success({ code: 'independent-login-code' }));
  const request = vi.fn((options: { url: string; method: string; data: Record<string, string>; header: Record<string, string>; success: (response: unknown) => void }) => {
    options.success({ statusCode: 201, data: { access_token: 'new-token', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 900, account: { account_id: 'mini-account', audience: 'MINIPROGRAM', roles: [], permissions: [], scopes: [] } }, header: {}, cookies: [] });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: () => null, login, request, setStorageSync });

  await accountApi.phoneLogin('one-time-phone-code');
  expect(login).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledOnce();
  const wire = request.mock.calls[0]![0];
  expect(wire.url).toMatch(/\/v1\/auth\/wechat-mini\/phone-sessions$/);
  expect(wire.method).toBe('POST');
  expect(wire.data).toEqual({ phone_code: 'one-time-phone-code', code: 'independent-login-code' });
  expect(wire.header['Idempotency-Key']).toBeTruthy();
  expect(wire.header.Authorization).toBeUndefined();
  expect(setStorageSync).toHaveBeenCalledOnce();
});

test('a missing phone authorization never calls wx.login or the API', async () => {
  const login = vi.fn();
  const request = vi.fn();
  vi.stubGlobal('wx', { login, request });
  await expect(accountApi.phoneLogin('')).rejects.toThrow('未获得微信手机号授权');
  expect(login).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

test('existing WeChat account conflict guides explicit phone binding', async () => {
  const request = vi.fn((options: { success: (response: unknown) => void }) => {
    options.success({ statusCode: 412, data: { code: 'PRECONDITION_FAILED', message: '并发控制前置条件不成立', request_id: 'req-test' }, header: {} });
    return { abort: vi.fn() };
  });
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getStorageSync: () => null,
    login: ({ success }: { success: (value: { code: string }) => void }) => success({ code: 'fresh-login-code' }), request });
  await expect(accountApi.phoneLogin('fresh-phone-code')).rejects.toThrow('先微信登录，再到“账户安全”绑定手机号');
  expect(request).toHaveBeenCalledOnce();
});
