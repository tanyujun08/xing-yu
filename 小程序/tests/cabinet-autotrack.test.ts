import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const m = vi.hoisted(() => ({ owner: 'tenant' as string | null, cabinetEntry: vi.fn(), pickup: vi.fn(), openCabinet: vi.fn(), task: vi.fn(), pendingPickup: vi.fn(), pickupTask: vi.fn(), rememberPickupTask: vi.fn(), forgetPickupTask: vi.fn(), queryCabinet: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => ({ ApiProblem: (await import('../miniprogram/shared/api/problem')).ApiProblem, accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({ rentalOrderApi: m }));
type Harness = { data: Record<string, unknown>; setData(p: Record<string, unknown>): void; [key: string]: unknown };
let page: Harness;
const task = (changes: Record<string, unknown> = {}) => ({ task_id: 't1', order_id: 'o1', cabinet_id: 'cabinet-1', purpose: 'PICKUP', status: 'VERIFYING', door_status: 'UNKNOWN', occupancy_result: 'UNKNOWN', observed_at: null, rfid_result: 'NOT_OBSERVED', allowed_actions: [{ action_code: 'QUERY_CABINET', allowed: true }], blockers: [], ...changes });
const record = (value: unknown) => ({ value, etag: '"task:1"' });
const response = (value: unknown) => ({ promise: Promise.resolve(record(value)), abort: vi.fn() });
const tick = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
function deferred() { let resolve!: (v: unknown) => void; let reject!: (v: unknown) => void; return { promise: new Promise((a, b) => { resolve = a; reject = b; }), resolve, reject, abort: vi.fn() }; }
function call(name: string, ...args: unknown[]) { return (page[name] as (...args: unknown[]) => unknown).apply(page, args); }
async function mount(route = 'cabinet-code') {
    let definition!: Harness; vi.stubGlobal('Page', (v: Harness) => definition = v);
    await import('../miniprogram/pages/' + route + '/index.ts');
    page = { ...definition, data: structuredClone(definition.data), setData(p) { Object.assign(this.data, p); } };
    call('onLoad', { scene: 'cab_12345678901234567890', taskId: 't1' }); call('onShow'); await tick();
}
async function submit() { call('inputCredential', { detail: { value: '001234' } }); await call('submitCredential'); await tick(); }
beforeEach(() => {
    vi.useFakeTimers(); vi.resetModules(); vi.resetAllMocks(); m.owner = 'tenant';
    m.cabinetEntry.mockReturnValue(response({ cabinet_id: 'cabinet-1', name: '测试柜', pickup_enabled: true }));
    m.pendingPickup.mockReturnValue(null); m.pickupTask.mockReturnValue(null);
    m.pickup.mockReturnValue(response(task({ status: 'RESERVED', allowed_actions: [{ action_code: 'OPEN_CABINET', allowed: true }] })));
    m.openCabinet.mockReturnValue(response(task({ status: 'EXECUTING' }))); m.task.mockReturnValue(response(task()));
    vi.stubGlobal('wx', { hideKeyboard: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn() });
});
afterEach(() => { if (page) call('onUnload'); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('submit immediately opens the modal before the API returns and hides the keyboard', async () => {
    const pending = deferred(); m.pickup.mockReturnValueOnce(pending); await mount();
    call('inputCredential', { detail: { value: '001234' } }); const writing = call('submitCredential'); await tick();
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackPhase: 'opening', busy: true }); expect(wx.hideKeyboard).toHaveBeenCalledOnce();
    const repeated = call('submitCredential');
    pending.resolve(record(task({ status: 'VERIFYING' }))); await Promise.all([writing, repeated]);
    expect(m.pickup).toHaveBeenCalledOnce();
});

test('the same modal tracks physical opening and completion without navigation, refresh or another command', async () => {
    await mount(); await submit();
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackTitle: '正在开柜', monitoring: true, canResume: false });
    call('closeProgress'); await call('submitCredential'); call('closeProgress');
    m.task.mockReturnValue(response(task({ door_status: 'OPEN', observed_at: '2026-10-08T06:00:00Z', occupancy_result: 'TARGET_PRESENT' })));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackTitle: '请取出设备并关门', feedbackPhase: 'opened' });
    call('confirmProgress'); expect(page.data.feedbackVisible).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000); expect(page.data.feedbackVisible).toBe(false);
    m.task.mockReturnValue(response(task({ status: 'SUCCEEDED', door_status: 'CLOSED', occupancy_result: 'TARGET_ABSENT', observed_at: '2026-10-08T06:00:04Z' })));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackTitle: '取件完成', monitoring: false, taskId: '', credentialInput: '' });
    const count = m.task.mock.calls.length; await vi.advanceTimersByTimeAsync(60_000); expect(m.task).toHaveBeenCalledTimes(count);
    expect(m.pickup).toHaveBeenCalledOnce(); expect(m.openCabinet).toHaveBeenCalledOnce(); expect(m.queryCabinet).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
    call('confirmProgress'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/order-detail/index?id=o1' }));
});

test('accepted response, absent observation and closed empty slot are not physical opening or completed pickup', async () => {
    await mount(); m.task.mockReturnValue(response(task({ door_status: 'OPEN' }))); await submit();
    expect(page.data.feedbackPhase).toBe('opening');
    m.task.mockReturnValue(response(task({ door_status: 'CLOSED', occupancy_result: 'TARGET_ABSENT', observed_at: '2026-10-08T06:00:00Z' })));
    await vi.advanceTimersByTimeAsync(2_000); expect(page.data.feedbackPhase).toBe('confirming'); expect(page.data.monitoring).toBe(true);
});

test('polling stays sequential while a slow GET is unresolved; repeated submit cannot open again', async () => {
    const pending = deferred(); m.task.mockReturnValueOnce(pending); await mount(); await submit();
    await call('submitCredential'); await vi.advanceTimersByTimeAsync(9_000); expect(m.task).toHaveBeenCalledOnce(); expect(m.openCabinet).toHaveBeenCalledOnce();
    pending.resolve(record(task())); await tick(); await vi.advanceTimersByTimeAsync(2_000); expect(m.task).toHaveBeenCalledTimes(2);
});

test('unknown opening result follows the original task and transient read errors reconnect automatically', async () => {
    m.openCabinet.mockReturnValueOnce({ promise: Promise.reject(new Error('网络中断')), abort: vi.fn() });
    m.task.mockReturnValueOnce({ promise: Promise.reject(new Error('读取超时')), abort: vi.fn() }); await mount(); await submit();
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackPhase: 'slow', feedbackHint: '网络恢复后会自动更新', errorText: '' });
    await vi.advanceTimersByTimeAsync(5_000); expect(page.data.feedbackPhase).toBe('opening');
    expect(m.task.mock.calls.every(([id]) => id === 't1')).toBe(true); expect(m.openCabinet).toHaveBeenCalledOnce();
});

test.each(['hide', 'unload', 'account'])('a pending response cannot update or restart tracking after %s', async boundary => {
    const pending = deferred(); m.task.mockReturnValueOnce(pending); await mount(); await submit();
    if (boundary === 'account') m.owner = 'someone-else'; else call(boundary === 'hide' ? 'onHide' : 'onUnload');
    pending.resolve(record(task({ status: 'SUCCEEDED' }))); await tick(); await vi.advanceTimersByTimeAsync(10_000);
    expect(m.task).toHaveBeenCalledOnce(); expect(page.data.feedbackPhase).not.toBe('done');
    if (boundary !== 'unload') expect(page.data.feedbackVisible).toBe(false);
    if (boundary === 'account') expect(page.data).toMatchObject({ loggedIn: false, taskId: '', monitoring: false });
});

test('returning to the page automatically follows its original task and never resubmits pickup', async () => {
    await mount(); await submit(); call('onHide'); await vi.advanceTimersByTimeAsync(10_000); const count = m.task.mock.calls.length;
    call('onShow'); await tick(); expect(page.data).toMatchObject({ monitoring: true, feedbackVisible: true, credentialInput: '' });
    await vi.advanceTimersByTimeAsync(2_000); expect(m.task.mock.calls.length).toBe(count + 2); expect(m.pickup).toHaveBeenCalledOnce(); expect(m.openCabinet).toHaveBeenCalledOnce();
});

test('foreground monitoring is bounded and continue only reads the same task', async () => {
    await mount(); await submit(); await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(page.data).toMatchObject({ monitorPaused: true, monitoring: false, feedbackTitle: '取件结果仍待确认', feedbackPrimary: '继续核实' });
    const count = m.task.mock.calls.length; await vi.advanceTimersByTimeAsync(60_000); expect(m.task).toHaveBeenCalledTimes(count);
    call('confirmProgress'); await tick(); expect(page.data).toMatchObject({ monitorPaused: false, monitoring: true });
    expect(m.openCabinet).toHaveBeenCalledOnce(); expect(m.pickup).toHaveBeenCalledOnce();
});

test('foreign cabinet observations fail closed without retry or displaying their success', async () => {
    m.task.mockReturnValue(response(task({ cabinet_id: 'another-cabinet', status: 'SUCCEEDED' }))); await mount(); await submit();
    expect(page.data).toMatchObject({ monitoring: false, feedbackVisible: false }); expect(page.data.errorText).toContain('不匹配');
    await vi.advanceTimersByTimeAsync(10_000); expect(m.task).toHaveBeenCalledOnce();
});

test('the existing result page also updates the same VERIFYING status when a physical door opens', async () => {
    await mount('cabinet-open'); call('dismissFeedback');
    m.task.mockReturnValue(response(task({ door_status: 'OPEN', observed_at: '2026-10-08T06:00:00Z' })));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(page.data).toMatchObject({ feedbackVisible: true, feedbackPhase: 'opened', door: '已开门' });
    m.task.mockReturnValue(response(task({ status: 'SUCCEEDED', door_status: 'CLOSED', occupancy_result: 'TARGET_ABSENT' })));
    await vi.advanceTimersByTimeAsync(2_000); expect(page.data).toMatchObject({ feedbackTitle: '取件完成', monitoring: false });
    expect(m.openCabinet).not.toHaveBeenCalled(); expect(m.queryCabinet).not.toHaveBeenCalled();
});
