import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

interface Harness {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  [key: string]: unknown;
}
interface ComponentDefinition {
  data: Record<string, unknown>;
  methods: Record<string, (...args: unknown[]) => unknown>;
  [key: string]: unknown;
}
const pages: Record<string, Harness> = {};
const components: Record<string, ComponentDefinition> = {};
let loading = '';
const navigateTo = vi.fn();
const navigateBack = vi.fn();
const showToast = vi.fn();
const request = vi.fn();

beforeAll(async () => {
  vi.stubGlobal('Page', (definition: Harness) => { pages[loading] = definition; });
  vi.stubGlobal('Component', (definition: ComponentDefinition) => { components[loading] = definition; });
  loading = 'order'; await import('../miniprogram/pages/order-detail/index');
  loading = 'identity'; await import('../miniprogram/pages/identity/index');
  loading = 'contract'; await import('../miniprogram/pages/contract/index');
  loading = 'devices'; await import('../miniprogram/pages/device-orders/index');
  loading = 'eligibility'; await import('../miniprogram/pages/publish-eligibility/index');
  loading = 'header'; await import('../miniprogram/components/page-header/index');
  loading = 'tabbar'; await import('../miniprogram/custom-tab-bar/index');
  // These native Component files are scripts: load for registration, without claiming module exports.
  for (const [name, path] of [['actions', '../miniprogram/components/bottom-actions/index.ts'], ['sheet', '../miniprogram/components/task-sheet/index.ts']] as const) {
    loading = name; await import(path);
  }
});
beforeEach(() => {
  navigateTo.mockReset(); navigateBack.mockReset(); showToast.mockReset(); request.mockReset();
  vi.stubGlobal('wx', { navigateTo, navigateBack, showToast, request, getStorageSync: () => null, showModal: vi.fn(), switchTab: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

function page(name: string): Harness {
  const definition = pages[name]!;
  return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
}
function component(name: string): Harness {
  const definition = components[name]!;
  return { ...definition.methods, data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); }, triggerEvent: vi.fn() };
}
function call(target: Harness, name: string, ...args: unknown[]) {
  return (target[name] as (...values: unknown[]) => unknown).apply(target, args);
}

test.each([false, true])('task sheet measures full-height opt-in without changing ordinary sheets (full=%s)', fullHeight => {
  const target = component('sheet'); Object.assign(target.data, { open: true, fullHeight });
  Object.assign(wx, { getWindowInfo: () => ({ windowHeight: 844, screenHeight: 844, safeArea: { bottom: 810 } }) });
  const query = { select: vi.fn(), boundingClientRect: vi.fn(), exec: (callback: (rects: { height: number }[]) => void) => callback([{ height: 99 }, { height: 1200 }, { height: 0 }, { height: 130 }]) };
  query.select.mockReturnValue(query); query.boundingClientRect.mockReturnValue(query); target['createSelectorQuery'] = () => query;
  call(target, 'measureBody'); expect(target.data['bodyHeight']).toBe((fullHeight ? 844 : 633) - 34 - 99 - 130);
  Object.assign(wx, { nextTick: (fn: () => void) => fn(), getWindowInfo: () => ({ windowHeight: 640, screenHeight: 844, safeArea: { bottom: 810 } }) });
  (components['sheet']!.pageLifetimes as {resize:(this:Harness)=>void}).resize.call(target);
  expect(target.data['bodyHeight']).toBe((fullHeight ? 640 : 480) - 34 - 99 - 130);
});

test('a tab hidden by an order filter cannot consume an underlying navigation tap', () => {
  const target = component('tabbar');
  target.data['overlayHidden'] = true;
  call(target, 'switchTab', { currentTarget: { dataset: { route: '/pages/info/index' } } });
  expect(wx.switchTab).not.toHaveBeenCalled();
  target.data['overlayHidden'] = false;
  call(target, 'switchTab', { currentTarget: { dataset: { route: '/pages/info/index' } } });
  expect(wx.switchTab).toHaveBeenCalledExactlyOnceWith({ url: '/pages/info/index' });
});

test('tab bar follows the current tab again when its page is shown',()=>{
  const target=component('tabbar');
  vi.stubGlobal('getCurrentPages',()=>[{route:'pages/home/index'}]);
  call(target,'syncSelected');
  expect(target.data.selected).toBe(0);
  vi.stubGlobal('getCurrentPages',()=>[{route:'pages/orders/index'}]);
  const lifecycle=components['tabbar']!.pageLifetimes as {show:(this:Harness)=>void};
  lifecycle.show.call(target);
  expect(target.data.selected).toBe(1);
  vi.stubGlobal('getCurrentPages',()=>[{route:'pages/order-detail/index'}]);
  lifecycle.show.call(target);
  expect(target.data.selected).toBe(1);
});

test('shared header remeasures current host geometry and falls back when capabilities fail', () => {
  const target = component('header');
  const windowInfo = vi.fn(() => ({ statusBarHeight: 20 }));
  vi.stubGlobal('wx', { getWindowInfo: windowInfo, getMenuButtonBoundingClientRect: () => ({ top: 26, bottom: 58, height: 32 }) });
  call(target, 'measure');
  expect(target.data).toMatchObject({ statusBarHeight: 20, contentHeight: 44, totalHeight: 64 });
  windowInfo.mockReturnValue({ statusBarHeight: 24 });
  call(target, 'measure');
  expect(target.data.totalHeight).toBe(68);
  windowInfo.mockImplementation(() => { throw new Error('unavailable host'); });
  call(target, 'measure');
  expect(target.data).toMatchObject({ statusBarHeight: 0, contentHeight: 44, totalHeight: 44 });
  call(target, 'onBack');
  expect(target.triggerEvent).toHaveBeenCalledWith('back');
});

test.each(['primary', 'secondary'])('shared %s action suppresses disabled and busy events', (kind) => {
  const target = component('actions');
  const handler = kind === 'primary' ? 'onPrimary' : 'onSecondary';
  const disabled = kind === 'primary' ? 'disabled' : 'secondaryDisabled';
  target.data[disabled] = true;
  call(target, handler);
  target.data[disabled] = false;
  target.data.busy = true;
  call(target, handler);
  expect(target.triggerEvent).not.toHaveBeenCalled();
  target.data.busy = false;
  call(target, handler);
  expect(target.triggerEvent).toHaveBeenCalledExactlyOnceWith(kind);
});

test('task sheet prevents closing while submission is busy and delegates close when idle', () => {
  const target = component('sheet');
  target.data.busy = true;
  call(target, 'close');
  expect(target.triggerEvent).not.toHaveBeenCalled();
  target.data.busy = false;
  call(target, 'close');
  expect(target.triggerEvent).toHaveBeenCalledExactlyOnceWith('close');
});





test('identity page exposes self declared save and server status without simulated verification commands', () => {
  const target = page('identity');
  expect(target.loadStatus).toBeTypeOf('function');
  expect(target.saveIdentity).toBeTypeOf('function');
  expect(target.submitDocuments).toBeUndefined();
  expect(target.startFaceAuthentication).toBeUndefined();
  expect(target.data).toMatchObject({ loading: false, overallText: '—', realName: '', identityNumber: '', completed: false });
});





test('publishing does not infer eligibility from old local identity', () => {
  const target = page('eligibility');
  vi.stubGlobal('wx', { navigateTo, navigateBack, showToast, showModal: vi.fn(), switchTab: vi.fn(), getStorageSync: () => null });
  call(target, 'onShow');
  expect(target.data).toMatchObject({ loggedIn: false, publishEnabled: false, primaryRoute: '' });
});

test('R4 order navigation includes a 52px bar and adds the host status area once', () => {
  const target = component('header'); target.data.variant = 'order';
  vi.stubGlobal('wx', { getWindowInfo: () => ({ statusBarHeight: 24 }), getMenuButtonBoundingClientRect: () => ({ top: 30, bottom: 62, height: 32 }) });
  call(target, 'measure'); expect(target.data).toMatchObject({ contentHeight: 52, totalHeight: 76 });
  target.data.variant = 'return'; call(target, 'measure'); expect(target.data).toMatchObject({ contentHeight: 44, totalHeight: 68 });
  target.data.variant = 'order-primary'; call(target, 'measure'); expect(target.data.totalHeight).toBe(76);
});
