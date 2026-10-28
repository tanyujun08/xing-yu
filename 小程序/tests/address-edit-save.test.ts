import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
const service = vi.hoisted(() => ({ owner: 'a' as string | null, create: vi.fn(), update: vi.fn(), find: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({
  accountApi: { sessionIdentity: () => service.owner, newIntent: () => 'stable-intent' },
  addressApi: { create: service.create, update: service.update }, findOwnAddress: service.find, regionApi: {},
}));
interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness; let page: Harness;
const navigateBack = vi.fn();
const call = (method: string, ...args: unknown[]) => (page[method] as (...args: unknown[]) => unknown).apply(page, args);
const saved = { address_id: 'saved', version: '2', allowed_actions: [{ code: 'UPDATE', enabled: true }] };
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/address-edit/index'); });
beforeEach(async () => {
  service.owner = 'a'; service.create.mockReset(); service.update.mockReset(); service.find.mockReset(); navigateBack.mockReset();
  service.create.mockReturnValue({ promise: Promise.resolve({ address_id: 'saved' }) });
  service.update.mockReturnValue({ promise: Promise.resolve({ address_id: 'saved' }) });
  service.find.mockResolvedValue(saved);
  vi.stubGlobal('wx', { navigateBack, showModal: vi.fn() }); vi.stubGlobal('getCurrentPages', () => []);
  page = { ...definition, data: structuredClone(definition.data), setData: vi.fn(function(this: Harness, patch) { Object.assign(this.data, patch); }) };
  await call('onLoad', {});
  Object.assign(page.data, { name: '测试收货人', phone: '13800138000', detail: '测试地址1号', datasetId: 'dataset', dirty: true,
    regionDraft: [{ code: 'p', name: '省', level: 'PROVINCE' }, { code: 'c', name: '市', level: 'CITY' }, { code: 'd', name: '区', level: 'DISTRICT' }] });
});
afterEach(() => { call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());
test('burst save dispatches once, reads persistence, then edits the returned identity', async () => {
  const operation = call('saveOnly'); call('saveOnly'); call('saveOnly'); await operation;
  expect(service.create).toHaveBeenCalledOnce(); expect(service.find).toHaveBeenCalledWith('saved');
  expect(page.data.editingId).toBe('saved'); expect(navigateBack).toHaveBeenCalledOnce();
  await call('saveOnly'); expect(service.create).toHaveBeenCalledOnce(); expect(service.update).toHaveBeenCalledOnce();
});
test.each(['account-switch', 'unload'])('%s invalidates a queued address command', async (kind) => {
  const operation = call('saveOnly'); if (kind === 'unload') call('onUnload'); else service.owner = 'b';
  const patches = vi.mocked(page.setData).mock.calls.length;
  await Promise.resolve(operation).catch(() => undefined);
  expect(service.create).not.toHaveBeenCalled(); expect(page.setData).toHaveBeenCalledTimes(patches); expect(navigateBack).not.toHaveBeenCalled();
});
test('unknown outcome retries the exact same body and intent without claiming success', async () => {
  service.create.mockReturnValueOnce({ promise: Promise.reject(Object.assign(new Error('timeout'), { statusCode: 0 })) });
  await call('saveOnly'); expect(navigateBack).not.toHaveBeenCalled(); expect(page.data.dirty).toBe(true);
  const first = service.create.mock.calls[0];
  await call('saveOnly'); expect(service.create.mock.calls[1]).toEqual(first);
});
test('a success receipt without persistence readback does not navigate or clear the draft', async () => {
  service.find.mockResolvedValue(undefined); await call('saveOnly');
  expect(navigateBack).not.toHaveBeenCalled(); expect(page.data.dirty).toBe(true); expect(page.data.errorText).toContain('回读');
});
