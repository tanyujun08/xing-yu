import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({ owner: 'mini-a' as string | null, authenticators: vi.fn(), bindPhone: vi.fn(), unbindPhone: vi.fn(), bindWechat: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({
  accountApi: { sessionIdentity: () => api.owner, authenticators: api.authenticators,
    bindPhone: api.bindPhone, unbindPhone: api.unbindPhone, bindWechat: api.bindWechat },
}));

type Harness = { data: Record<string, unknown>; setData(value: Record<string, unknown>): void; [key: string]: unknown };
let definition: Harness;
let page: Harness;
const projection = {
  account_id: 'mini-a', security_version: 2, phone_bound: true, phone_masked: '138****0000',
  wechat_bound: true, allowed_actions: [
    { code: 'REBIND_PHONE', enabled: false }, { code: 'UNBIND_PHONE', enabled: false },
    { code: 'BIND_WECHAT', enabled: false },
  ],
};
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function call(name: string): unknown { return (page[name] as () => unknown).call(page); }

beforeAll(async () => {
  vi.stubGlobal('Page', (value: Harness) => { definition = value; });
  await import('../miniprogram/pages/account-security/index');
});
beforeEach(() => {
  api.owner = 'mini-a';
  api.authenticators.mockReset().mockReturnValue({ promise: Promise.resolve(projection), abort: vi.fn() });
  api.bindPhone.mockReset(); api.unbindPhone.mockReset(); api.bindWechat.mockReset();
  vi.stubGlobal('wx', { redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), showToast: vi.fn() });
  page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
});
afterAll(() => vi.unstubAllGlobals());

test('shows only masked server authenticator state and disabled actions', async () => {
  call('onShow'); await flush();
  expect(api.authenticators).toHaveBeenCalledTimes(1);
  expect(page.data.phoneText).toBe('138****0000');
  expect(page.data.wechatText).toBe('已绑定');
  expect(page.data.phoneActionEnabled).toBe(false);
  call('onUnload');
});

test('guest does not read private authenticators and account switch discards late result', async () => {
  api.owner = null;
  call('onShow');
  expect(api.authenticators).not.toHaveBeenCalled();
  expect(wx.redirectTo).toHaveBeenCalledTimes(1);
  call('onUnload');

  api.owner = 'mini-a';
  let finish!: (value: typeof projection) => void;
  api.authenticators.mockReturnValueOnce({ promise: new Promise(resolve => { finish = resolve; }), abort: vi.fn() });
  page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
  call('onShow');
  api.owner = 'mini-b';
  finish(projection); await flush();
  expect(page.data.phoneText).toBe('—');
  call('onUnload');
});

test('failed read leaves retry available', async () => {
  api.authenticators.mockReturnValueOnce({ promise: Promise.reject(new Error('服务暂不可用')), abort: vi.fn() });
  call('onShow'); await flush();
  expect(page.data.errorText).toBe('服务暂不可用');
  await call('loadAuthenticators');
  expect(page.data.phoneText).toBe('138****0000');
  call('onUnload');
});

test('phone binding uses the native authorization code and current security version', async () => {
  const unbound = { ...projection, security_version: 4, phone_bound: false, phone_masked: undefined,
    allowed_actions: [{ code: 'BIND_PHONE', enabled: true }, { code: 'BIND_WECHAT', enabled: false }] };
  api.authenticators.mockReturnValueOnce({ promise: Promise.resolve(unbound), abort: vi.fn() });
  api.bindPhone.mockReturnValue({ promise: Promise.resolve({ ...projection, security_version: 5 }), abort: vi.fn() });
  call('onShow'); await flush();
  expect(page.data.phoneActionEnabled).toBe(true);
  (page['onPhoneAuthorized'] as (event: unknown) => void).call(page, { detail: { code: 'native-code' } });
  await flush();
  expect(api.bindPhone).toHaveBeenCalledWith('native-code', 4);
  expect(page.data.phoneText).toBe('138****0000');
  expect(page.data.securityVersion).toBe(5);
  call('onUnload');
});
