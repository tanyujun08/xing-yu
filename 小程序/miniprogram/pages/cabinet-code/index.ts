import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalTask, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { createCabinetTaskMonitor, cabinetTaskTerminal } from '../../shared/interaction/cabinet-task-monitor';
import { cabinetFeedback } from '../../shared/presentation/cabinet-feedback';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { rentalDate, rentalActionAllowed, rentalCabinetTaskLabel, rentalCabinetTaskCopy } from '../../shared/presentation/rental-order';
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalTask>>> & {
    scene: string;
    readSequence: number;
    taskOwner: string;
    originalTaskId: string;
    cabinetId: string;
    monitor?: ReturnType<typeof createCabinetTaskMonitor>;
}>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalTask>>(), scene: '', readSequence: 0, taskOwner: '', originalTaskId: '', cabinetId: '' };
    states.set(page, s);
} return s; }
function captureCabinetView(s: ReturnType<typeof state>) {
    const epoch = s.epoch, sequence = s.readSequence;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && sequence === s.readSequence;
}
function captureCabinetSessionLoss(s: ReturnType<typeof state>) {
    const epoch = s.epoch, owner = s.owner;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}
function rememberTask(s: ReturnType<typeof state>, id: string) { s.taskOwner = s.owner; s.originalTaskId = id; rentalOrderApi.rememberPickupTask(s.scene, id); }
Page({
    data: { ...cabinetFeedback(), feedbackVisible: false, monitoring: false, monitorPaused: false, credentialErrorOpen: false, loaded: false, loading: false, busy: false, errorText: '', credentialInput: '', cabinetName: '', cabinetAddress: '', loggedIn: false, pickupEnabled: false, taskId: '', canResume: false, canCancel: false, taskStatus: '', taskCopy: '' },
    onLoad(options: Record<string, string | undefined>) { try {
        const scene = decodeURIComponent(options['scene'] ?? '');
        if (/^cab_[A-Za-z0-9]{20}$/.test(scene))
            state(this).scene = scene;
    }
    catch {
        this.setData({ errorText: '柜机码无效，请重新扫描实体柜小程序码' });
    } },
    onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (owner && s.taskOwner && s.taskOwner !== owner) { s.originalTaskId = ''; s.taskOwner = ''; }
        if (s.owner !== owner) this.setData({ ...cabinetFeedback(), feedbackVisible: false, monitoring: false, monitorPaused: false, credentialErrorOpen: false, credentialInput: '', taskId: '', canResume: false, canCancel: false, taskStatus: '', taskCopy: '' }); s.show(owner); this.setData({ loggedIn: !!owner, loading: false, busy: false }); void this.refresh(); },
    onHide() { const s = state(this); s.monitor?.stop(); s.hide(); s.current = null; this.setData({ ...cabinetFeedback(), feedbackVisible: false, monitoring: false, monitorPaused: false, credentialErrorOpen: false, credentialInput: '', taskId: '', canResume: false, canCancel: false, taskStatus: '', taskCopy: '', busy: false, loading: false }); }, onUnload() { const s = state(this); s.monitor?.stop(); s.dispose(); },
    clearUnavailableSession() { const s = state(this); s.monitor?.stop(); s.current = null; this.setData({ ...cabinetFeedback(), feedbackVisible: false, monitoring: false, monitorPaused: false, credentialErrorOpen: false, loading: false, busy: false, loggedIn: false, credentialInput: '', taskId: '', canResume: false, canCancel: false, taskStatus: '', taskCopy: '', errorText: '登录状态已失效或变化，请重新登录后查询原柜机任务' }); },
    async refresh() { const s = state(this), lease = s.capture(accountApi.sessionIdentity); s.monitor?.stop(); this.setData({ monitoring: false }); ++s.readSequence;
        const viewCurrent = captureCabinetView(s), sessionLost = captureCabinetSessionLoss(s), active = () => lease() && viewCurrent();
        if (!active()) { if (viewCurrent()) this.clearUnavailableSession(); return; } if (!s.scene) {
        this.setData({ errorText: '请扫描实体租赁柜的小程序码进入', loaded: false });
        return;
    } this.setData({ loading: true, canResume: false, canCancel: false, errorText: '' }); try {
        const result = await rentalOrderApi.cabinetEntry(s.scene).promise;
        if (!active())
            return;
        s.cabinetId = result.value.cabinet_id;
        this.setData({ loaded: true, cabinetName: result.value.name, cabinetAddress: result.value.address ?? '', pickupEnabled: result.value.pickup_enabled });
        if (s.owner) {
            if (!s.originalTaskId) { const id = rentalOrderApi.pickupTask(s.scene); if (id) rememberTask(s, id); }
            if (s.taskOwner === s.owner && s.originalTaskId) {
                this.setData({ taskId: s.originalTaskId });
                const original = await rentalOrderApi.task(s.originalTaskId).promise;
                if (!active()) return;
                this.applyTask(original);
                this.setData({ ...cabinetFeedback(original.value), feedbackVisible: true });
                if (!cabinetTaskTerminal(original.value.status) && original.value.status !== 'RESERVED') this.openProgress(2_000);
                return;
            }
            const pending = rentalOrderApi.pendingPickup();
            if (pending) {
                const result = await rentalOrderApi.lookup('K10', pending.key).promise;
                if (!active())
                    return;
                if (result.value.result?.resource_type === 'CABINET_TASK') {
                    rememberTask(s, result.value.result.resource_id);
                    this.setData({ taskId: result.value.result.resource_id });
                    this.openProgress();
                }
                else
                    this.setData({ errorText: '原取件请求待核实，请查询原请求；不会再次开门' });
            }
        }
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '柜机读取失败' });
    }
    finally {
        if (sessionLost()) this.clearUnavailableSession();
        else if (viewCurrent() && lease()) this.setData({ loading: false });
    } },
    applyTask(record: RentalRecord<RentalTask>) {
        const s = state(this), task = record.value;
        if (task.task_id !== s.originalTaskId || task.purpose !== 'PICKUP' || task.cabinet_id !== s.cabinetId)
            throw new Error('原取件任务与当前柜机不匹配，请返回订单核实');
        s.current = record;
        if (['SUCCEEDED', 'CANCELLED', 'FAILED_CONFIRMED'].includes(task.status)) {
            rentalOrderApi.forgetPickupTask(s.scene, task.task_id);
            s.originalTaskId = ''; s.taskOwner = ''; s.current = null;
            this.setData({ taskId: '', canResume: false, canCancel: false, credentialInput: '', taskStatus: rentalCabinetTaskLabel(task.status), taskCopy: task.status === 'SUCCEEDED' ? '取件已完成。还有其他订单时，可输入下一单的取件码。' : '本次取件已结束，请核对订单后重新输入取件码。' });
            return;
        }
        this.setData({ taskId: task.task_id, canResume: task.status === 'RESERVED' && rentalActionAllowed(task.allowed_actions, 'OPEN_CABINET'), canCancel: task.status === 'RESERVED' && rentalActionAllowed(task.allowed_actions, 'CANCEL_CABINET'), taskStatus: rentalCabinetTaskLabel(task.status), taskCopy: rentalCabinetTaskCopy(task) });
    },
    async cancelReservation() {
        const s = state(this);
        await s.run('cabinet-pickup', async () => {
            const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureCabinetView(s), active = () => lease() && viewCurrent();
            if (!active() || !this.data.canCancel || !s.originalTaskId) return;
            this.setData({ busy: true, errorText: '' });
            try {
                this.setData({ taskId: s.originalTaskId });
                const original = await rentalOrderApi.task(s.originalTaskId).promise;
                if (!active()) return;
                this.applyTask(original);
                if (!this.data.canCancel) return;
                await rentalOrderApi.cancelCabinet(original.value.task_id, original.etag).promise;
                if (active()) await this.refresh();
            } catch (error) { if (active()) this.setData({ errorText: error instanceof Error ? error.message : '取消结果待核实，请刷新状态' }); }
            finally { if (lease()) this.setData({ busy: false }); }
        });
    },
    showCredentialError() {
        const s = state(this);
        if (s.capture(accountApi.sessionIdentity)()) this.setData({ errorText: '', credentialErrorOpen: true });
    },
    acknowledgeFeedback() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)()) return;
        this.setData({ ...(this.data.credentialErrorOpen ? { credentialInput: '' } : {}), credentialErrorOpen: false, errorText: '' });
    },
    inputCredential(event: WechatMiniprogram.Input) { if (!this.data.busy)
        this.setData({ credentialInput: String(event.detail.value).replace(/[^0-9]/g, '').substring(0, 6), errorText: '' }); },
    async submitCredential() {
        const s = state(this);
        await s.run('cabinet-pickup', async () => {
            const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureCabinetView(s), sessionLost = captureCabinetSessionLoss(s), active = () => lease() && viewCurrent();
            if (active() && this.data.loading) { this.setData({ errorText: '正在查询原任务，请稍候' }); return; }
            if (active() && this.data.taskId && !this.data.canResume && !this.data.loading) { this.openProgress(); return; }
            if (!active() || this.data.credentialErrorOpen || this.data.loading || !s.owner || !s.scene || !this.data.pickupEnabled || !/^\d{6}$/.test(this.data.credentialInput))
                return;

            this.setData({ ...cabinetFeedback(), feedbackVisible: true, monitorPaused: false, feedbackContent: '正在核对取件码，请稍候。', busy: true, errorText: '' });
            wx.hideKeyboard?.({});
            let openingAttempted = false;
            try {
                if (s.taskOwner === s.owner && s.originalTaskId) {
                    this.setData({ taskId: s.originalTaskId });
                const original = await rentalOrderApi.task(s.originalTaskId).promise;
                    if (!active()) return;
                    this.applyTask(original);
                    if (!this.data.taskId) return;
                    if (!this.data.canResume) { this.openProgress(); return; }
                    openingAttempted = true;
                    await rentalOrderApi.openCabinet(original.value.task_id, this.data.credentialInput, original.etag).promise;
                    if (active()) this.openProgress();
                    return;
                }
                const pending = rentalOrderApi.pendingPickup();
                if (pending) {
                    const lookup = await rentalOrderApi.lookup('K10', pending.key).promise;
                    if (!active())
                        return;
                    if (lookup.value.result?.resource_type === 'CABINET_TASK') {
                        rememberTask(s, lookup.value.result.resource_id);
                        this.setData({ taskId: lookup.value.result.resource_id });
                        this.openProgress();
                        return;
                    }
                    if (!lookup.value.retry_same_request || lookup.value.state !== 'NOT_FOUND')
                        throw new Error('原请求结果待核实，请联系客服');
                }
                const task = await rentalOrderApi.pickup(s.scene, this.data.credentialInput).promise;
                if (!active())
                    return;
                s.current = task;
                rememberTask(s, task.value.task_id);
                this.setData({ taskId: task.value.task_id });
                if (task.value.status === 'RESERVED' && rentalActionAllowed(task.value.allowed_actions, 'OPEN_CABINET')) {
                    this.setData({ canResume: true, canCancel: rentalActionAllowed(task.value.allowed_actions, 'CANCEL_CABINET') });
                    openingAttempted = true;
                    await rentalOrderApi.openCabinet(task.value.task_id, this.data.credentialInput, task.etag).promise;
                    if (active()) this.openProgress();

                }
                else {
                    this.openProgress();
                }
            }
            catch (error) {
                if (!active())
                    return;
                if (openingAttempted && s.originalTaskId && (!(error instanceof ApiProblem) || error.statusCode >= 500 || error.statusCode === 408)) {
                    this.openProgress(); return;
                }
                this.setData({ feedbackVisible: false });
                this.setData({ errorText: error instanceof Error ? error.message : '取件结果待核实，请查询原请求' });
                const details = error instanceof ApiProblem && error.statusCode === 409 && error.code === 'RESOURCE_CONFLICT' ? error.details : undefined;
                if (details?.['reason_code'] === 'PICKUP_UNAVAILABLE') {
                    if (!rentalOrderApi.pendingPickup()) this.showCredentialError();
                    else this.setData({ errorText: '原取件请求的结果尚待核实，请先查询原请求。' });
                }
                const orderId = details?.['resource_id'];
                if (details?.['reason_code'] === 'RENTAL_NOT_STARTED' && details['resource_type'] === 'rental_order' && typeof orderId === 'string' && orderId !== 'redacted' && /^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
                    this.setData({ errorText: '尚未到取件时间，请返回订单查看可取件时间，或联系客服。' });
                    try {
                        const original = await rentalOrderApi.get(orderId).promise;
                        if (!active())
                            return;
                        const order = original.value.order;
                        if (order.order_id === orderId && original.value.delivery.method === 'CABINET' && Number.isFinite(Date.parse(order.rental_start_at)))
                            this.setData({ errorText: '租期尚未开始，请于 ' + rentalDate(order.rental_start_at) + '开始取件，不能提前开柜。' });
                    }
                    catch {
                        // Keep the original refusal when its authorized order cannot be reread.
                    }
                }
            }
            finally {
                if (lease()) this.setData({ busy: false });
                else if (sessionLost()) this.clearUnavailableSession();
            }
        });
    },
    openProgress(delay = 0) {
        const s = state(this), lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureCabinetView(s), sessionLost = captureCabinetSessionLoss(s);
        if (!lease() || s.taskOwner !== s.owner || !this.data.taskId || this.data.taskId !== s.originalTaskId) return;
        this.setData({ feedbackVisible: true, errorText: '', canResume: false, canCancel: false });
        if (this.data.monitoring) return;
        s.monitor?.stop();
        if (s.current?.value.status === 'RESERVED') s.current = null;
        this.setData({ monitoring: true, monitorPaused: false });
        s.monitor = createCabinetTaskMonitor({
            taskId: s.originalTaskId, read: rentalOrderApi.task, active: () => lease() && viewCurrent(),
            update: (record, elapsed) => {
                const feedback = cabinetFeedback(record.value, elapsed), previous = this.data.feedbackPhase;
                this.applyTask(record);
                this.setData({ ...feedback, feedbackVisible: this.data.feedbackVisible || (feedback.feedbackPhase !== previous && ['opened', 'done', 'failed'].includes(feedback.feedbackPhase)), monitoring: !cabinetTaskTerminal(record.value.status) && record.value.status !== 'RESERVED' });
            },
            waiting: (elapsed, disconnected) => this.setData({ ...cabinetFeedback(s.current?.value, elapsed, disconnected) }),
            unavailable: error => this.setData({ monitoring: false, feedbackVisible: false, errorText: error instanceof Error ? error.message : '无法读取取件结果，请从原订单查看' }),
            expired: () => this.setData({ monitoring: false, monitorPaused: true, feedbackTitle: '取件结果仍待确认', feedbackContent: '等待时间较长，您可以继续核实或联系客服。请勿重复开柜。', feedbackHint: '原取件任务已保留', feedbackPrimary: '继续核实', feedbackQuiet: false, feedbackContact: true }),
            invalidated: () => { if (sessionLost()) this.clearUnavailableSession(); },
        });
        s.monitor.start(delay);
    },
    closeProgress() { if (state(this).capture(accountApi.sessionIdentity)()) this.setData({ feedbackVisible: false }); },
    confirmProgress() {
        const s = state(this); if (!s.capture(accountApi.sessionIdentity)()) return;
        if (this.data.monitorPaused) { this.openProgress(); return; }
        this.closeProgress();
        if (this.data.feedbackPhase === 'done' && this.data.feedbackOrderId) s.navigation.navigateOnce('order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(this.data.feedbackOrderId), ...callbacks }));
    },
    openLogin() { state(this).navigation.navigateOnce('login', callbacks => wx.navigateTo({ url: '/pages/login/index', ...callbacks })); }, goOrders() { state(this).navigation.navigateOnce('orders', callbacks => wx.switchTab({ url: '/pages/orders/index', ...callbacks })); }, onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
