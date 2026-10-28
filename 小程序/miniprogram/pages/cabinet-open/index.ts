import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalTask, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { createCabinetTaskMonitor, cabinetTaskTerminal } from '../../shared/interaction/cabinet-task-monitor';
import { cabinetFeedback } from '../../shared/presentation/cabinet-feedback';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { rentalActionAllowed, rentalCabinetTaskCopy, rentalCabinetTaskLabel, beijingTime } from '../../shared/presentation/rental-order';
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalTask>>> & { readSequence: number; scene: string; notifiedStatus: string; monitor?: ReturnType<typeof createCabinetTaskMonitor> }>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalTask>>(), readSequence: 0, scene: '', notifiedStatus: '' };
    states.set(page, s);
} return s; }
function captureTaskView(s: ReturnType<typeof state>) {
    const epoch = s.epoch, sequence = s.readSequence;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readSequence === sequence;
}
function captureTaskSessionLoss(s: ReturnType<typeof state>) {
    const epoch = s.epoch, owner = s.owner;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}
function emptyTaskView() { return { ...cabinetFeedback(), pickup: false, monitoring: false, monitorPaused: false, loaded: false, loading: false, busy: false, title: '柜机结果', status: '', copy: '', door: '', rfid: '', occupancy: '', observed: '', confirmed: '', canQuery: false, canResumePickup: false, orderId: '', feedbackVisible: false, feedbackTone: 'pending', feedbackTitle: '', feedbackContent: '', feedbackPrimary: '知道了' }; }
function fact(code: string) { const labels: Record<string, string> = { OPEN: '已开门', CLOSED: '已关门', UNKNOWN: '待核实', MATCH: '编号一致', MISMATCH: '编号不一致', NOT_OBSERVED: '编号待核实', TARGET_PRESENT: '已检测到设备', TARGET_ABSENT: '格口为空', OTHER_ASSET: '检测到其他设备' }; return labels[code] ?? '待核实'; }
Page({ data: { ...emptyTaskView(), errorText: '' },
    onLoad(options: Record<string, string | undefined>) { const s = state(this); s.id = options['taskId'] ?? ''; const scene = options['scene'] ?? ''; if (/^cab_[A-Za-z0-9]{20}$/.test(scene)) s.scene = scene; }, onShow() { const s = state(this); if (s.owner !== (accountApi.sessionIdentity() ?? '')) s.notifiedStatus = ''; s.show(accountApi.sessionIdentity() ?? ''); s.current = null; this.setData(emptyTaskView()); void this.refresh(); },
    onHide() { const s = state(this); s.monitor?.stop(); s.hide(); s.current = null; this.setData(emptyTaskView()); }, onUnload() { const s = state(this); s.monitor?.stop(); s.dispose(); },
    clearUnavailableSession() { const s = state(this); s.monitor?.stop(); s.current = null; this.setData({ ...emptyTaskView(), errorText: '登录状态已失效或变化，请重新登录后查询原柜机任务' }); },
    async refresh() { const s = state(this), lease = s.capture(accountApi.sessionIdentity); s.monitor?.stop(); ++s.readSequence;
        const viewCurrent = captureTaskView(s), sessionLost = captureTaskSessionLoss(s), active = () => lease() && viewCurrent();
        if (!active()) { if (viewCurrent()) this.clearUnavailableSession(); return; } if (!s.owner || !s.id) {
        this.clearUnavailableSession();
        this.setData({ errorText: '请从本人原柜机任务进入' });
        return;
    } this.setData({ loading: true, errorText: '' }); try {
        const result = await rentalOrderApi.task(s.id).promise;
        if (!active())
            return;
        if (result.value.task_id !== s.id)
            throw new Error('柜机任务不匹配');
        this.applyObservedTask(result);
        if (result.value.purpose === 'PICKUP' && !cabinetTaskTerminal(result.value.status) && result.value.status !== 'RESERVED') {
            this.setData({ monitoring: true, monitorPaused: false });
            s.monitor = createCabinetTaskMonitor({
                taskId: s.id, read: rentalOrderApi.task, active,
                update: (record, elapsed) => this.applyObservedTask(record, elapsed),
                waiting: (elapsed, disconnected) => this.setData(cabinetFeedback(s.current?.value, elapsed, disconnected)),
                expired: () => this.setData({ monitoring: false, monitorPaused: true, feedbackTitle: '取件结果仍待确认', feedbackContent: '等待时间较长，请继续核实或联系客服。请勿重复开柜。', feedbackHint: '原取件任务已保留', feedbackPrimary: '继续核实', feedbackContact: true }),
                unavailable: error => this.setData({ monitoring: false, feedbackVisible: false, errorText: error instanceof Error ? error.message : '无法读取取件结果' }),
                invalidated: () => { if (sessionLost()) this.clearUnavailableSession(); },
            });
            s.monitor.start(2_000);
        }
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '柜机状态读取失败' });
    }
    finally {
        if (sessionLost()) this.clearUnavailableSession();
        else if (viewCurrent() && lease()) this.setData({ loading: false });
    } },
    applyObservedTask(result: RentalRecord<RentalTask>, elapsed = 0) {
        const s = state(this), t = result.value;
        if (t.task_id !== s.id) throw new Error('柜机任务不匹配');
        s.current = result;
        this.setData({ loaded: true, pickup: t.purpose === 'PICKUP', monitoring: t.purpose === 'PICKUP' && !cabinetTaskTerminal(t.status) && t.status !== 'RESERVED', title: t.purpose === 'PICKUP' ? '取件结果' : '归还进度', status: rentalCabinetTaskLabel(t.status), copy: rentalCabinetTaskCopy(t), door: fact(t.door_status), rfid: t.purpose === 'PICKUP' && t.status === 'SUCCEEDED' && t.occupancy_result === 'TARGET_ABSENT' ? '设备已取出' : fact(t.rfid_result), occupancy: fact(t.occupancy_result), observed: beijingTime(t.observed_at), confirmed: beijingTime(t.confirmed_at), canResumePickup: !!s.scene && t.purpose === 'PICKUP' && t.status === 'RESERVED' && rentalActionAllowed(t.allowed_actions, 'OPEN_CABINET'), canQuery: rentalActionAllowed(t.allowed_actions, 'QUERY_CABINET'), orderId: t.order_id });
        const feedback = cabinetFeedback(t, elapsed), key = t.purpose === 'PICKUP' ? feedback.feedbackPhase : t.status;
        if (t.purpose === 'PICKUP') this.setData(feedback);
        if (s.notifiedStatus !== key) { s.notifiedStatus = key; this.showResultFeedback(); }
    },
    async query() { const s = state(this); await s.run('query-original-task', async () => { const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureTaskView(s), sessionLost = captureTaskSessionLoss(s), active = () => lease() && viewCurrent(); if (!s.current || !active() || !this.data.canQuery)
        return; this.setData({ busy: true }); try {
        await rentalOrderApi.queryCabinet(s.id, s.current.etag).promise;
        if (active())
            await this.refresh();
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '柜机结果仍待核实' });
    }
    finally {
        if (lease()) this.setData({ busy: false });
        else if (sessionLost()) this.clearUnavailableSession();
    } }); },
    showResultFeedback() {
        const s = state(this), task = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !task) return;
        if (task.purpose === 'PICKUP') { this.setData({ feedbackVisible: true }); return; }
        const success = task.status === 'SUCCEEDED', failed = task.status === 'FAILED_CONFIRMED' || task.status === 'CANCELLED';
        this.setData({ feedbackVisible: true, feedbackTone: success ? 'success' : failed ? 'error' : 'pending', feedbackTitle: success ? '归还已确认' : rentalCabinetTaskLabel(task.status), feedbackContent: rentalCabinetTaskCopy(task), feedbackPrimary: success ? '查看订单' : this.data.canQuery ? '查询归还结果' : '知道了' });
    },
    confirmFeedback() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)()) return;
        if (this.data.errorText) { this.setData({ errorText: '' }); return; }
        if (!this.data.feedbackVisible || this.data.busy) return;
        if (this.data.pickup && this.data.monitorPaused) { void this.refresh(); return; }
        this.setData({ feedbackVisible: false });
        if (s.current?.value.status === 'SUCCEEDED') this.goDetail();
        else if (this.data.canResumePickup) this.goPickup();
        else if (!this.data.pickup && this.data.canQuery) void this.query();
    },
    dismissFeedback() { if (state(this).capture(accountApi.sessionIdentity)() && !this.data.busy) this.setData({ feedbackVisible: false, errorText: '' }); },
    goPickup() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.canResumePickup || !s.scene) return; s.navigation.navigateOnce('pickup', callbacks => wx.redirectTo({ url: '/pages/cabinet-code/index?scene=' + encodeURIComponent(s.scene), ...callbacks })); },
    goDetail() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || !this.data.orderId || s.current?.value.order_id !== this.data.orderId) return; s.navigation.navigateOnce('order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(this.data.orderId), ...callbacks })); }, onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
