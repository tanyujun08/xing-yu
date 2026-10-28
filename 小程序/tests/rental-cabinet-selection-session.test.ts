import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiProblem } from '../miniprogram/shared/api/problem';
import { rentalOrderApi } from '../miniprogram/shared/api/rental-order-api';

const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, get: vi.fn(), task: vi.fn(), cabinets: vi.fn(), request: vi.fn(), key: 0 }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem, accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/supply-api', () => ({ cabinetApi: {}, readDiscoveryCity: vi.fn() }));
vi.mock('../miniprogram/shared/session/api-session', () => ({ readStoredApiSession: () => m.owner ? { accountId: m.owner } : null }));
vi.mock('../miniprogram/shared/api/request', () => ({ request: m.request }));
vi.mock('../miniprogram/shared/api/idempotency', () => ({ newIdempotencyKey: () => 'cabinet-original-key-' + ++m.key }));
vi.mock('../miniprogram/shared/api/rental-api', async () => ({ rentalOrderApi: { ...(await import('../miniprogram/shared/api/rental-order-api')).rentalOrderApi, get: m.get, task: m.task, cabinets: m.cabinets } }));

type Harness = { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown };
type Route = 'cabinets' | 'cabinet-detail';
let page: Harness | undefined;
let store: Map<string, unknown>;
const allowed = (action_code: string, allow = true) => ({ action_code, allowed: allow });
const order = (hasTask = false) => ({ order: { blockers: [], allowed_actions: [allowed('SELECT_COMPARTMENT', !hasTask)] }, delivery: { method: 'CABINET' }, requirements: { return_instructions: '本单归还说明' }, latest_cabinet_tasks: hasTask ? [{ task_id: 't1', purpose: 'RETURN' }] : [] });
const task = (status = 'RESERVED') => ({ task_id: 't1', order_id: 'o1', cabinet_id: 'c1', compartment_id: 's1', purpose: 'RETURN', status, blockers: [], allowed_actions: [allowed('QUERY_CABINET'), allowed('OPEN_CABINET', status === 'RESERVED'), allowed('CANCEL_CABINET', status === 'RESERVED')] });
const options = () => ({ items: [{ cabinet_id: 'c1', name: '本人订单归还柜', address: '测试场所', connectivity_status: 'ONLINE', compartments: [{ compartment_id: 's1', compartment_no: '01', available: true, blockers: [] }] }], blockers: [], next_cursor: null });
const result = (value: unknown, etag = '"ORDER:o1:7"') => ({ promise: Promise.resolve({ value, etag }), abort: vi.fn() });
const tick = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
function deferred() { let resolve!: (value: unknown) => void, reject!: (error: unknown) => void; return { promise: new Promise<unknown>((done, fail) => { resolve = done; reject = fail; }), resolve, reject, abort: vi.fn() }; }
const expired = () => new ApiProblem(401, { code: 'UNAUTHORIZED', message: '登录已失效', request_id: 'local-401' });
function call(name: string, ...args: unknown[]) { return (page![name] as (...values: unknown[]) => unknown).apply(page, args); }
const refresh = (route: Route) => call(route === 'cabinets' ? 'refreshReturn' : 'refresh');
async function mount(route: Route) { let definition!: Harness; vi.stubGlobal('Page', (value: Harness) => definition = value); await import('../miniprogram/pages/' + route + '/index.ts'); page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; call('onLoad', { mode: 'return', orderId: 'o1', id: 'c1' }); call('onShow'); await tick(); }
function shownTask(status = 'RESERVED') { m.get.mockReturnValue(result(order(true))); m.task.mockReturnValue(result(task(status), '"TASK:t1:9"')); }
function assertCleared(route: Route) { expect(page!.data).toMatchObject({ loading: false, canSelect: false, optionsLoaded: false }); expect(page!.data['errorText']).toContain('登录'); if (route === 'cabinets') expect(page!.data).toMatchObject({ cabinets: [], activeCabinet: null, returnTaskId: '', returnTaskCabinetId: '', cursor: null }); else expect(page!.data).toMatchObject({ loaded: false, busy: false, compartments: [], taskId: '', taskStatus: '', canOpen: false, canCancel: false, canQuery: false, cabinet: { id: '', name: '' } }); }
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); page = undefined; store = new Map(); m.owner = 'tenant'; m.key = 0; m.get.mockReturnValue(result(order())); m.task.mockReturnValue(result(task(), '"TASK:t1:9"')); m.cabinets.mockReturnValue(result(options())); m.request.mockImplementation(() => ({ promise: Promise.resolve(task()), abort: vi.fn() })); vi.stubGlobal('wx', { navigateTo: vi.fn(), navigateBack: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), getStorageSync: (key: string) => store.get(key), setStorageSync: (key: string, value: unknown) => store.set(key, structuredClone(value)), removeStorageSync: vi.fn((key: string) => store.delete(key)) }); });
afterEach(() => { if (page) call('onUnload'); vi.unstubAllGlobals(); });

test.each((['cabinets', 'cabinet-detail'] as const).flatMap(route => (['get', 'task', 'cabinets'] as const).map(endpoint => ({ route, endpoint }))))('$route $endpoint 401 ends reading and removes only the unavailable projection', async ({ route, endpoint }) => {
    if (endpoint === 'task') shownTask(); await mount(route); const pending = deferred(); m[endpoint].mockReturnValueOnce(pending); const reading = refresh(route); await tick(); expect(page!.data['loading']).toBe(true);
    m.owner = null; pending.reject(expired()); await reading; assertCleared(route); const reads = m.get.mock.calls.length; await refresh(route); expect(m.get).toHaveBeenCalledTimes(reads); expect(m.request).not.toHaveBeenCalled();
});

test.each((['cabinets', 'cabinet-detail'] as const).flatMap(route => (['hide', 'new-owner', 'new-read'] as const).map(boundary => ({ route, boundary }))))('$route old read cannot alter $boundary view or finish its loading', async ({ route, boundary }) => {
    await mount(route); const pending = deferred(); m.get.mockReturnValueOnce(pending); const reading = refresh(route); let newer: Promise<unknown> | undefined; const next = deferred();
    if (boundary === 'hide') { call('onHide'); m.owner = null; expect(page!.data['loading']).toBe(false); }
    else { m.get.mockReturnValueOnce(next); if (boundary === 'new-owner') { m.owner = 'other'; call('onShow'); } else newer = refresh(route) as Promise<unknown>; }
    const shown = structuredClone(page!.data); pending.reject(expired()); await reading; expect(page!.data).toEqual(shown);
    if (boundary !== 'hide') { expect(page!.data['loading']).toBe(true); next.resolve({ value: order(), etag: '"ORDER:o1:8"' }); await newer; await tick(); }
});

test.each(['cabinets', 'cabinet-detail'] as const)('%s account change before onShow hides the stale success and prevents navigation', async route => {
    await mount(route); const pending = deferred(); m.get.mockReturnValueOnce(pending); const reading = refresh(route); m.owner = 'other'; pending.resolve({ value: order(), etag: '"ORDER:o1:7"' }); await reading; assertCleared(route);
    if (route === 'cabinets') call('openCabinet', { currentTarget: { dataset: { id: 'c1' } } }); else { call('goResult'); call('chooseAnotherCabinet'); } expect(wx.navigateTo).not.toHaveBeenCalled(); expect(wx.redirectTo).not.toHaveBeenCalled();
});

test.each((['cabinets', 'cabinet-detail'] as const).flatMap(route => (['get', 'task', 'cabinets'] as const).flatMap(endpoint => [false, true].map(newReadPending => ({ route, endpoint, newReadPending })))))('$route old $endpoint 401 clears real expired session after newer read pending=$newReadPending', async ({ route, endpoint, newReadPending }) => {
    if (endpoint === 'task') shownTask(); await mount(route); const old = deferred(); m[endpoint].mockReturnValueOnce(old); const first = refresh(route); await tick();
    const next = deferred(); if (newReadPending) m.get.mockReturnValueOnce(next); const second = refresh(route); await tick(); if (!newReadPending) await second;
    expect(page!.data['loading']).toBe(newReadPending); m.owner = null; old.reject(expired()); await first; assertCleared(route);
    if (newReadPending) { next.resolve({ value: order(), etag: '"ORDER:o1:8"' }); await second; assertCleared(route); } expect(m.request).not.toHaveBeenCalled();
});

type Command = 'reserve' | 'open' | 'cancel';
const commands: Command[] = ['reserve', 'open', 'cancel'];
async function prepareCommand(command: Command) { if (command !== 'reserve') shownTask(); await mount('cabinet-detail'); }
const execute = (command: Command) => command === 'reserve' ? call('reserve', { currentTarget: { dataset: { compartment: 's1' } } }) : call('taskAction', { currentTarget: { dataset: { action: command } } });

test.each(commands)('return cabinet %s direct 401 clears busy without inferring unopened or retrying', async command => {
    await prepareCommand(command); const pending = deferred(); m.request.mockReturnValueOnce(pending); const writing = execute(command); await tick(); expect(page!.data['busy']).toBe(true);
    m.owner = null; pending.reject(expired()); await writing; assertCleared('cabinet-detail'); expect(m.request).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test.each(commands)('return cabinet %s refresh 401 ends both loading and busy without navigating', async command => {
    await prepareCommand(command); const pending = deferred(); m.get.mockReturnValueOnce(pending); const writing = execute(command); await tick(); expect(page!.data).toMatchObject({ busy: true, loading: true });
    m.owner = null; pending.reject(expired()); await writing; assertCleared('cabinet-detail'); expect(m.request).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test.each(commands.flatMap(command => (['hide', 'new-owner'] as const).map(boundary => ({ command, boundary }))))('late $command 401 cannot alter the $boundary view', async ({ command, boundary }) => {
    await prepareCommand(command); const pending = deferred(); m.request.mockReturnValueOnce(pending); const writing = execute(command); await tick(); call('onHide');
    if (boundary === 'new-owner') { m.owner = 'other'; call('onShow'); await tick(); } const shown = structuredClone(page!.data); pending.reject(expired()); await writing;
    expect(page!.data).toEqual(shown); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.request).toHaveBeenCalledTimes(1);
});

test.each(commands)('successful return cabinet %s ends busy after its internal refresh', async command => {
    await prepareCommand(command); await execute(command); expect(page!.data).toMatchObject({ busy: false, loading: false }); expect(m.request).toHaveBeenCalledTimes(1);
});

test.each(commands.flatMap(command => [false, true].map(sessionLost => ({ command, sessionLost }))))('old $command with sessionLost=$sessionLost only clears the newer view when its owner loses the session', async ({ command, sessionLost }) => {
    await prepareCommand(command); const pending = deferred(); m.request.mockReturnValueOnce(pending); const writing = execute(command); await tick();
    const next = deferred(); m.get.mockReturnValueOnce(next); const reading = refresh('cabinet-detail'); const reads = m.get.mock.calls.length;
    if (sessionLost) m.owner = null; pending.reject(expired()); await writing;
    if (sessionLost) assertCleared('cabinet-detail'); else expect(page!.data).toMatchObject({ loading: true, loaded: true, busy: false });
    expect(m.get).toHaveBeenCalledTimes(reads);
    next.resolve({ value: order(), etag: '"ORDER:o1:8"' }); await reading;
    if (sessionLost) assertCleared('cabinet-detail'); else expect(page!.data).toMatchObject({ loading: false, loaded: true });
    expect(m.request).toHaveBeenCalledTimes(1); expect(wx.navigateTo).not.toHaveBeenCalled();
});

test.each(['cabinets', 'cabinet-detail'] as const)('%s new owner cannot navigate the former task while their own read is pending', async route => {
    shownTask(); await mount(route); const next = deferred(); m.get.mockReturnValueOnce(next); m.owner = 'other'; call('onShow');
    if (route === 'cabinets') call('resumeReturnTask'); else call('goResult'); expect(wx.navigateTo).not.toHaveBeenCalled();
    next.resolve({ value: order(), etag: '"ORDER:o1:8"' }); await tick(); expect(page!.data['loading']).toBe(false); expect(m.request).not.toHaveBeenCalled();
});

test.each(commands)('UNKNOWN %s preserves the owner original key body ETag and target across expired read and same-owner reentry', async command => {
    await prepareCommand(command); m.request.mockReturnValueOnce({ promise: Promise.reject(new Error('结果未知')), abort: vi.fn() }); await execute(command);
    const original = structuredClone([...store.entries()]); expect(original).toHaveLength(1); const sent = m.request.mock.calls[0]![0]; expect(original[0]![1]).toMatchObject({ owner: 'tenant', key: sent.idempotencyKey, body: sent.body, path: sent.path, etag: sent.aggregateVersion });
    const pending = deferred(); m.get.mockReturnValueOnce(pending); const reading = refresh('cabinet-detail'); m.owner = null; pending.reject(expired()); await reading;
    expect([...store.entries()]).toEqual(original); call('onHide'); call('onShow'); await tick(); m.owner = 'tenant'; shownTask('UNKNOWN'); call('onHide'); call('onShow'); await tick();
    expect(page!.data).toMatchObject({ busy: false, loading: false, taskId: 't1', taskStatus: 'UNKNOWN', canSelect: false, canOpen: false, canCancel: false, canQuery: true }); expect(m.request).toHaveBeenCalledTimes(1); expect([...store.entries()]).toEqual(original);
    await execute('reserve'); await execute('open'); await execute('cancel'); expect(m.request).toHaveBeenCalledTimes(1); expect(wx.removeStorageSync).not.toHaveBeenCalled();
    // The existing API journal also refuses substituting a different slot for the unresolved reservation.
    if (command === 'reserve') expect(() => rentalOrderApi.reserveCabinet('o1', 'c1', 'other-slot', '"ORDER:o1:8"')).toThrow('不能更换内容');
});
