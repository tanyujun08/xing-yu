import { beforeAll, afterAll, expect, test, vi } from 'vitest';
import { runLoginSheet } from '../miniprogram/shared/interaction/login-sheet-host';

type Sheet = {
  data: { agreed: boolean; showConsentModal: boolean; submitting: boolean; visible: boolean; errorText: string; windowWidth: number };
  setData(values: Record<string, unknown>): void;
  triggerEvent(name: string, detail?: unknown): void;
  [method: string]: unknown;
};

const readWindowInfo = vi.fn(() => ({ windowWidth: 390 }));
let definition: {
  data: Sheet['data'];
  methods: Record<string, (...args: unknown[]) => void>;
  lifetimes: { attached(this: Sheet): void };
  pageLifetimes: { show(this: Sheet): void; resize(this: Sheet, event: WechatMiniprogram.Page.IResizeOption): void };
};
beforeAll(async () => {
  vi.stubGlobal('Component', (value: typeof definition) => { definition = value; });
  vi.stubGlobal('wx', { getWindowInfo: readWindowInfo });
  await import('../miniprogram/components/login-sheet/index');
});
afterAll(() => vi.unstubAllGlobals());

function sheet() {
  const events: Array<{ name: string; detail?: unknown }> = [];
  const instance: Sheet = {
    data: structuredClone(definition.data),
    setData(values) { Object.assign(this.data, values); },
    triggerEvent(name, detail) { events.push({ name, detail }); },
  };
  for (const [name, method] of Object.entries(definition.methods)) instance[name] = method;
  const call = (name: string) => (instance[name] as () => void).call(instance);
  return { instance, call, events };
}

test('first login gesture only asks for consent, confirmation does not log in', () => {
  const { instance, call, events } = sheet();
  readWindowInfo.mockReturnValue({ windowWidth: 390 });
  definition.lifetimes.attached.call(instance);
  expect(instance.data.windowWidth).toBe(390);
  readWindowInfo.mockReturnValue({ windowWidth: 430 });
  call('open');
  expect(instance.data.windowWidth).toBe(430);
  definition.pageLifetimes.resize.call(instance, { size: { windowWidth: 390, windowHeight: 844 } });
  expect(instance.data.windowWidth).toBe(390);
  definition.pageLifetimes.show.call(instance);
  expect(instance.data.windowWidth).toBe(430);
  expect(instance.data.agreed).toBe(false);
  expect(events).toEqual([]);
  call('quickLogin');
  expect(instance.data.showConsentModal).toBe(true);
  expect(events).toEqual([]);
  call('confirmConsent');
  expect(instance.data.agreed).toBe(true);
  expect(events).toEqual([]);
  call('quickLogin');
  expect(events).toEqual([{ name: 'wechatlogin', detail: undefined }]);
  call('close');
  expect(instance.data.agreed).toBe(false);
  expect(events).toEqual([{ name: 'wechatlogin', detail: undefined }, { name: 'cancel', detail: undefined }]);
});

test('phone action requires consent before the native gesture and forwards only an approved code', () => {
  const { instance, call, events } = sheet();
  call('phoneConsent');
  expect(instance.data.showConsentModal).toBe(true);
  call('confirmConsent');
  (instance.onPhoneAuthorized as (event: unknown) => void).call(instance, { detail: { errMsg: 'getPhoneNumber:fail user deny' } });
  expect(instance.data.errorText).toContain('未获得微信手机号授权');
  expect(events).toEqual([]);
  (instance.onPhoneAuthorized as (event: unknown) => void).call(instance, { detail: { code: 'one-time-phone-code' } });
  expect(events).toEqual([{ name: 'phonelogin', detail: { phoneCode: 'one-time-phone-code' } }]);
});

test('host runs one login, closes on success, and keeps failed login open', async () => {
  const { instance } = sheet();
  let finish!: () => void;
  const login = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const success = vi.fn();
  const host = { selectComponent: () => instance };
  (instance.open as () => void).call(instance);
  const first = runLoginSheet(host, login, success);
  await runLoginSheet(host, login, success);
  expect(login).toHaveBeenCalledTimes(1);
  expect(instance.data.submitting).toBe(true);
  finish();
  await first;
  expect(success).toHaveBeenCalledTimes(1);
  expect(instance.data.visible).toBe(false);

  (instance.open as () => void).call(instance);
  await runLoginSheet(host, async () => { throw new Error('invalid code'); }, success);
  expect(instance.data.visible).toBe(true);
  expect(instance.data.errorText).toBe('invalid code');
  expect(success).toHaveBeenCalledTimes(1);
});

test('late login result never resumes an unloaded page', async () => {
  const { instance } = sheet();
  let finish!: () => void;
  let visible = true;
  const onSuccess = vi.fn();
  const host = { selectComponent: () => instance, isLoginHostActive: () => visible };
  (instance.open as () => void).call(instance);
  const pending = runLoginSheet(host, () => new Promise<void>(resolve => { finish = resolve; }), onSuccess);
  visible = false;
  finish();
  await pending;
  expect(onSuccess).not.toHaveBeenCalled();
});
