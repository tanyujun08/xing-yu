import { readFileSync, existsSync } from 'node:fs';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

const session = vi.hoisted(() => ({ owner: 'owner-a' as string | null }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => session.owner } }));

type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown };
let definition: Harness | undefined;
const effects = { request: vi.fn(), uploadFile: vi.fn(), setStorageSync: vi.fn(), requestPayment: vi.fn(), scanCode: vi.fn(), chooseMedia: vi.fn(), getFileSystemManager: vi.fn() };
const navigation = vi.fn((options?: { complete?: () => void }) => options?.complete?.());
const toast = vi.fn();

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); session.owner = 'owner-a'; definition = undefined;
  vi.stubGlobal('Page', (value: Harness) => { definition = value; });
  vi.stubGlobal('getCurrentPages', () => [{}, {}]);
  vi.stubGlobal('wx', { ...effects, showToast: toast, showModal: vi.fn(), navigateTo: navigation, navigateBack: navigation, switchTab: navigation, stopPullDownRefresh: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

function source(path: string): string { return readFileSync(`miniprogram/${path}`, 'utf8'); }
function page(): Harness {
  if (!definition) throw new Error('Page was not registered');
  return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
}
function call(current: Harness, name: string, ...args: unknown[]): unknown {
  const method = current[name];
  if (typeof method !== 'function') throw new Error(`Missing ${name}`);
  return method.apply(current, args);
}
function noBusinessEffects(): void { for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled(); }

test('unrelated deferred routes retain registered files and dispute controls', () => {
  const app = JSON.parse(source('app.json')) as { pages: string[] };
  expect(app.pages).toHaveLength(54);
  expect(app.pages).toContain('pages/contract-sign/index');
  expect(app.pages).toContain('pages/order-fees/index');
  expect(app.pages).not.toContain('pages/cabinet-pickup/index');
  for (const extension of ['ts', 'wxml', 'wxss', 'json']) {
    expect(existsSync(`miniprogram/pages/cabinet-pickup/index.${extension}`)).toBe(false);
  }
  for (const route of app.pages) for (const extension of ['ts', 'wxml', 'wxss', 'json']) expect(existsSync(`miniprogram/${route}.${extension}`), `${route}.${extension}`).toBe(true);
  const dispute = source('pages/dispute/index.wxml');
  const bindings = new Set([...dispute.matchAll(/(?:bind|catch)(?::)?[a-z]+="([a-zA-Z0-9_]+)"/g)].map(match => match[1]));
  expect(bindings.size).toBe(22);
  expect([...dispute.matchAll(/wx:for=/g)]).toHaveLength(12);
  for (const collection of ['item.imagePaths', 'item.videoPaths', 'evidencePaths', 'proposalImagePaths', 'proposalVideoPaths', 'videoPaths']) {
    const loop = [...dispute.matchAll(/<[^>]+wx:for="[^"]+"[^>]*>/g)].find(match => match[0].includes(`wx:for="{{${collection}}}"`));
    expect(loop?.[0]).toContain('wx:key="id"');
  }
  expect(dispute).not.toContain('wx:key="*this"');
});

const unavailablePages = ['dispute', 'wechat-waiver'] as const;
test.each(unavailablePages)('%s keeps its view empty and refuses business actions before and after disposal', async name => {
  await import(`../miniprogram/pages/${name}/index.ts`);
  const current = page();
  call(current, 'onLoad', { id: 'original-order' }); call(current, 'onShow');
  expect(current.data).toMatchObject({ routeId: 'original-order', unavailable: true, loaded: false, loading: false });
  for (const field of ['order', 'axes']) if (field in current.data) expect(current.data[field]).toBeNull();
  if ('items' in current.data) expect(current.data['items']).toEqual([]);
  const actions = [...source(`pages/${name}/index.ts`).matchAll(/\b([a-zA-Z0-9_]+):\s*blockOrderAction/g)].map(match => match[1]!);
  expect(actions.length).toBeGreaterThan(0);
  for (const action of actions) call(current, action, { currentTarget: { dataset: { id: 'old', action: 'submit' } }, detail: { value: 'value' } });
  noBusinessEffects();
  session.owner = 'owner-b'; call(current, 'onShow');
  expect(current.data['loaded']).toBe(false);
  call(current, 'onHide'); const count = toast.mock.calls.length;
  for (const action of actions) call(current, action);
  expect(toast).toHaveBeenCalledTimes(count); noBusinessEffects();
  call(current, 'onUnload');
  for (const action of actions) call(current, action);
  expect(toast).toHaveBeenCalledTimes(count); noBusinessEffects();
});

test('retired support route cannot create a custom conversation or draft and keeps guarded return', async () => {
  await import('../miniprogram/pages/chat/index'); const current = page();
  call(current, 'onLoad', { mode: 'support' }); call(current, 'onShow');
  expect(current.data).toMatchObject({ title: '订单沟通', unavailable: true, unavailableReason: '请从个人订单或沟通列表进入此会话', messages: [] });
  call(current, 'inputMessage', { detail: { value: 'local draft' } }); expect(current.data['content']).toBe('');
  session.owner = 'owner-b'; call(current, 'onShow'); expect(current.data['content']).toBe('');
  call(current, 'send'); call(current, 'onSecondaryNavigationBack'); expect(navigation).toHaveBeenCalledTimes(1); noBusinessEffects();
  call(current, 'onHide'); call(current, 'inputMessage', { detail: { value: 'late' } }); expect(current.data['content']).toBe('');
  call(current, 'onUnload'); noBusinessEffects();
});

test.each(['guard', 'insurance'])('service %s preview retains explanation and return without a current price fact', async service => {
  await import('../miniprogram/pages/service-detail/index'); const current = page();
  call(current, 'onLoad', { mode: 'preview', service }); call(current, 'onShow');
  expect(current.data).toMatchObject({ preview: true, missing: false, service, previewPrice: '—' });
  call(current, 'goBack'); expect(navigation).toHaveBeenCalledTimes(1); noBusinessEffects();
  expect(source('pages/service-detail/index.wxml')).not.toContain('当前按40元计费');
});
