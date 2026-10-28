import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiProblem } from '../miniprogram/shared/api/problem';

const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, cabinetEntry: vi.fn(), pendingPickup: vi.fn(), pickupTask: vi.fn(), rememberPickupTask: vi.fn(), forgetPickupTask: vi.fn(), lookup: vi.fn(), pickup: vi.fn(), openCabinet: vi.fn(), task: vi.fn(), get: vi.fn(), queryCabinet: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem, accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: m, rentalEvidenceDrafts: { read: () => [] } }));
type Route = 'cabinet-code' | 'cabinet-open' | 'cabinet-return';
type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown };
let page: Harness | undefined;
const action = (action_code: string) => ({ action_code, allowed: true });
const record = (value: unknown) => ({ value, etag: '"CABINET_TASK:t1:1"' });
const response = (value: unknown) => ({ promise: Promise.resolve(record(value)), abort: vi.fn() });
const task = (purpose = 'PICKUP', status = 'UNKNOWN') => ({ task_id: 't1', order_id: 'o1', cabinet_id: 'cabinet-1', purpose, status, allowed_actions: [action(status === 'RESERVED' ? 'OPEN_CABINET' : 'QUERY_CABINET')], blockers: [], door_status: 'CLOSED', rfid_result: 'NOT_OBSERVED', occupancy_result: 'UNKNOWN', observed_at: null, confirmed_at: null });
const order = () => ({ order: { allowed_actions: [], blockers: [] }, delivery: { method: 'CABINET' }, latest_cabinet_tasks: [{ task_id: 't1', purpose: 'RETURN' }], requirements: { return_instructions: '原单归还要求' } });
const tick = async () => { for (let n = 0; n < 24; n++) await Promise.resolve(); };
function deferred() { let resolve!: (value: unknown) => void, reject!: (error: unknown) => void; return { promise: new Promise<unknown>((done, fail) => { resolve = done; reject = fail; }), resolve, reject, abort: vi.fn() }; }
const expired = () => new ApiProblem(401, { code: 'UNAUTHORIZED', message: '登录失效', request_id: 'offline-cabinet-401' });
function call(name: string, ...args: unknown[]) { return (page![name] as (...args: unknown[]) => unknown).apply(page, args); }
async function mount(route: Route) {
  let definition!: Harness;
  vi.stubGlobal('Page', (value: Harness) => definition = value);
  if (route === 'cabinet-return') m.task.mockReturnValue(response(task('RETURN')));
  await import('../miniprogram/pages/' + route + '/index.ts');
  page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  call('onLoad', { scene: 'cab_12345678901234567890', taskId: 't1', orderId: 'o1' }); call('onShow'); await tick();
}
function pendingRead(route: Route) {
  const pending = deferred();
  if (route === 'cabinet-code') { m.pendingPickup.mockReturnValue({ key: 'original-K10', body: { scene: 'cab_12345678901234567890', pickup_code: '001234' } }); m.lookup.mockReturnValueOnce(pending); }
  else m.task.mockReturnValueOnce(pending);
  return pending;
}
function expectExpired(route: Route) {
  expect(page!.data).toMatchObject({ loading: false, busy: false }); expect(page!.data['errorText']).toContain('登录');
  if (route === 'cabinet-code') expect(page!.data).toMatchObject({ loggedIn: false, credentialInput: '', taskId: '' });
  else expect(page!.data).toMatchObject({ loaded: false, canQuery: false, door: '', rfid: '', ...(route === 'cabinet-open' ? { occupancy: '' } : { cabinetName: '', compartmentNo: '' }) });
  expect(wx.removeStorageSync).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); page = undefined; m.owner = 'tenant';
  m.cabinetEntry.mockReturnValue(response({ cabinet_id: 'cabinet-1', name: '公共柜机', address: '场所', pickup_enabled: true })); m.pendingPickup.mockReturnValue(null); m.pickupTask.mockReturnValue(null);
  m.lookup.mockReturnValue(response({ state: 'UNKNOWN', result: null, retry_same_request: false }));
  m.pickup.mockReturnValue(response(task('PICKUP', 'RESERVED'))); m.openCabinet.mockReturnValue(response(task()));
  m.task.mockReturnValue(response(task())); m.get.mockReturnValue(response(order())); m.queryCabinet.mockReturnValue(response({ state: 'ACCEPTED' }));
  vi.stubGlobal('wx', { navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), removeStorageSync: vi.fn() });
});
afterEach(() => { if (page?.['onUnload']) call('onUnload'); vi.unstubAllGlobals(); });

test.each(['cabinet-code', 'cabinet-open', 'cabinet-return'] as const)('%s read 401 clears private view and activity without another cabinet command', async route => {
  await mount(route); if (route === 'cabinet-code') call('inputCredential', { detail: { value: '001234' } });
  const pending = pendingRead(route), reading = call('refresh'); await tick(); expect(page!.data['loading']).toBe(true);
  m.owner = null; pending.reject(expired()); await reading; expectExpired(route);
  const calls = m.task.mock.calls.length + m.get.mock.calls.length + m.lookup.mock.calls.length;
  await call('refresh'); expect(m.task.mock.calls.length + m.get.mock.calls.length + m.lookup.mock.calls.length).toBe(calls);
  expect(m.pickup).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled();
});

test.each(['cabinet-code', 'cabinet-open', 'cabinet-return'] as const)('%s successful old-account read cannot publish after the account changes before onShow', async route => {
  await mount(route); const pending = pendingRead(route), reading = call('refresh'); await tick(); m.owner = 'other';
  pending.resolve(record(route === 'cabinet-code' ? { state: 'COMPLETED', result: { resource_type: 'CABINET_TASK', resource_id: 't1' } } : task(route === 'cabinet-return' ? 'RETURN' : 'PICKUP', 'SUCCEEDED')));
  await reading; expectExpired(route); expect(wx.navigateTo).not.toHaveBeenCalled();
});

for (const route of ['cabinet-code', 'cabinet-open', 'cabinet-return'] as const) {
  test.each(['hide', 'new-account', 'new-read'] as const)(`${route} late read leaves the %s view untouched`, async boundary => {
    await mount(route); const pending = pendingRead(route), reading = call('refresh'); await tick();
    if (boundary === 'hide') { call('onHide'); m.owner = null; }
    else { if (boundary === 'new-account') { m.owner = 'other'; m.pendingPickup.mockReturnValue(null); m.pickupTask.mockReturnValue(null); call('onShow'); await tick(); } else await call('refresh'); }
    const shown = structuredClone(page!.data); pending.reject(expired()); await reading;
    expect(page!.data).toEqual(shown); expect(page!.data['loading']).toBe(false); expect(wx.navigateTo).not.toHaveBeenCalled();
  });
  test(`${route} older read clearing the real session removes even a newer completed private view`, async () => {
    await mount(route); const pending = pendingRead(route), reading = call('refresh'); await tick(); await call('refresh');
    expect(page!.data['loading']).toBe(false); m.owner = null; pending.reject(expired()); await reading;
    expectExpired(route); expect(m.openCabinet).not.toHaveBeenCalled();
  });
}

type Command = 'pickup' | 'open' | 'lookup' | 'pickup-window' | 'pickup-query' | 'return-query';
async function startCommand(command: Command) {
  const route: Route = command === 'pickup-query' ? 'cabinet-open' : command === 'return-query' ? 'cabinet-return' : 'cabinet-code';
  await mount(route); const pending = deferred();
  if (command === 'lookup') { m.pendingPickup.mockReturnValue({ key: 'original-K10', body: { pickup_code: '001234' } }); m.lookup.mockReturnValueOnce(pending); }
  else if (command === 'pickup-window') { const { ApiProblem: CurrentProblem } = await import('../miniprogram/shared/api/account-api'); m.pickup.mockReturnValueOnce({ promise: Promise.reject(new CurrentProblem(409, { code: 'RESOURCE_CONFLICT', message: '尚未到租期', request_id: 'offline', details: { resource_type: 'rental_order', resource_id: 'o1', reason_code: 'RENTAL_NOT_STARTED' } })), abort: vi.fn() }); m.get.mockReturnValueOnce(pending); }
  else (command === 'pickup' ? m.pickup : command === 'open' ? m.openCabinet : m.queryCabinet).mockReturnValueOnce(pending);
  if (route === 'cabinet-code') call('inputCredential', { detail: { value: '001234' } });
  const writing = call(route === 'cabinet-code' ? 'submitCredential' : 'query'); await tick();
  expect(page!.data['busy']).toBe(true); return { route, pending, writing };
}
test.each(['pickup', 'open', 'lookup', 'pickup-window', 'pickup-query', 'return-query'] as const)('%s 401 finishes activity but never concludes or repeats a cabinet operation', async command => {
  const { route, pending, writing } = await startCommand(command); m.owner = null; pending.reject(expired()); await writing; expectExpired(route);
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.pickup.mock.calls.length).toBeLessThanOrEqual(1); expect(m.openCabinet.mock.calls.length).toBeLessThanOrEqual(1); expect(m.queryCabinet.mock.calls.length).toBeLessThanOrEqual(1);
});

for (const command of ['open', 'pickup-query', 'return-query'] as const) {
  test.each(['hide', 'new-account'] as const)(`${command} late command cannot overwrite the %s view`, async boundary => {
    const { pending, writing } = await startCommand(command); call('onHide'); expect(page!.data).toMatchObject({ busy: false, loading: false });
    if (boundary === 'new-account') { m.owner = 'other'; call('onShow'); await tick(); }
    const shown = structuredClone(page!.data); pending.reject(expired()); await writing;
    expect(page!.data).toEqual(shown); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.openCabinet.mock.calls.length).toBeLessThanOrEqual(1);
  });
  test.each([false, true])(`${command} old command with sessionLost=%s cleans only an actually expired session`, async sessionLost => {
    const { route, pending, writing } = await startCommand(command), newer = deferred();
    m.task.mockReturnValueOnce(newer); const reading = call('refresh'); await tick();
    expect(page!.data).toMatchObject({ loading: true, busy: true }); const readingView = structuredClone(page!.data);
    if (sessionLost) m.owner = null;
    pending.reject(sessionLost ? expired() : new Error('旧请求网络失败')); await writing;
    if (sessionLost) {
      expectExpired(route);
      const cleared = structuredClone(page!.data); newer.resolve(record(task(route === 'cabinet-return' ? 'RETURN' : 'PICKUP', 'SUCCEEDED'))); await reading;
      expect(page!.data).toEqual(cleared);
    } else {
      expect(page!.data).toEqual({ ...readingView, busy: false });
      newer.reject(new Error('新读取网络失败')); await reading; expect(page!.data).toMatchObject({ loading: false, busy: false });
    }
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });
}

test.each(['cabinet-open', 'cabinet-return'] as const)('%s original UNKNOWN task survives re-login without repeating open or query', async route => {
  await mount(route); const pending = pendingRead(route), reading = call('refresh'); await tick(); m.owner = null; pending.reject(expired()); await reading; expectExpired(route);
  call('onHide'); m.owner = 'tenant'; call('onShow'); await tick();
  expect(page!.data).toMatchObject({ loaded: true, loading: false, busy: false, canQuery: true });
  expect(m.task.mock.calls.every(args => args[0] === 't1')).toBe(true); expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.queryCabinet).not.toHaveBeenCalled();
});

test.each(['cabinet-open', 'cabinet-return'] as const)('%s accepted query followed by read 401 ends both indicators without querying again', async route => {
  await mount(route); const pending = pendingRead(route), writing = call('query'); await tick();
  expect(page!.data).toMatchObject({ loading: true, busy: true }); m.owner = null; pending.reject(expired()); await writing;
  expectExpired(route); expect(m.queryCabinet).toHaveBeenCalledExactlyOnceWith('t1', '"CABINET_TASK:t1:1"'); expect(m.openCabinet).not.toHaveBeenCalled();
});

test('K10 UNKNOWN lookup 401 retains the original key and same-account recovery only looks it up', async () => {
  await mount('cabinet-code'); const pending = pendingRead('cabinet-code'), reading = call('refresh'); await tick(); m.owner = null; pending.reject(expired()); await reading; expectExpired('cabinet-code');
  call('onHide'); m.owner = 'tenant'; call('onShow'); await tick();
  expect(m.lookup.mock.calls.map(args => args[1])).toEqual(['original-K10', 'original-K10']); expect(page!.data).toMatchObject({ loading: false, busy: false, credentialInput: '' });
  expect(m.pickup).not.toHaveBeenCalled(); expect(m.openCabinet).not.toHaveBeenCalled(); expect(wx.removeStorageSync).not.toHaveBeenCalled();
});

test('known K10 task is recovered by same-account task reads after K04 and its later read lose login', async () => {
  const { pending, writing } = await startCommand('open'); m.owner = null; pending.reject(expired()); await writing; expectExpired('cabinet-code');
  call('onHide'); m.owner = 'tenant'; const originalRead = deferred(); m.task.mockReturnValueOnce(originalRead); call('onShow'); await tick();
  expect(m.task).toHaveBeenCalledExactlyOnceWith('t1');
  call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential');
  expect(m.pickup).toHaveBeenCalledTimes(1); expect(m.openCabinet).toHaveBeenCalledTimes(1); expect(page!.data['errorText']).toContain('原任务');
  m.owner = null; originalRead.reject(expired()); await tick(); expectExpired('cabinet-code');
  call('onHide'); m.owner = 'tenant'; call('onShow'); await tick();
  expect(m.task.mock.calls.map(args => args[0])).toEqual(['t1', 't1']); expect(m.pickup).toHaveBeenCalledTimes(1); expect(m.openCabinet).toHaveBeenCalledTimes(1);
  expect(wx.navigateTo).not.toHaveBeenCalled(); call('openProgress');
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data).toMatchObject({ feedbackVisible: true, monitoring: true }); expect(wx.removeStorageSync).not.toHaveBeenCalled();
});

test('known pickup locator is isolated on actual account change and a mismatched task cannot authorize navigation', async () => {
  const { pending, writing } = await startCommand('open'); m.owner = null; pending.reject(expired()); await writing;
  call('onHide'); m.owner = 'tenant'; m.task.mockReturnValueOnce(response({ ...task(), task_id: 'other-task' })); call('onShow'); await tick();
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(page!.data['errorText']).toContain('匹配');
  call('onHide'); m.owner = 'other'; call('onShow'); await tick();
  expect(m.task).toHaveBeenCalledTimes(1); expect(page!.data).toMatchObject({ taskId: '', credentialInput: '', busy: false }); expect(m.pickup).toHaveBeenCalledTimes(1); expect(m.openCabinet).toHaveBeenCalledTimes(1);
});
