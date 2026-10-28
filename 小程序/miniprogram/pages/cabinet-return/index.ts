import { designAssets } from '../../shared/design/assets';
import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, rentalEvidenceDrafts, saveRentalEvidenceDraft, type RentalEvidenceDraft, type RentalReturn, type RentalRecord, type RentalOrder, type RentalTask } from '../../shared/api/rental-api';
import { createReturnCabinetState, readReturnCabinetContext, returnTaskView, returnCabinetFact } from '../../shared/interaction/return-cabinet-context';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { beijingTime, rentalCabinetTaskCopy, rentalCabinetTaskLabel } from '../../shared/presentation/rental-order';
import { returnEvidenceTiles, type ReturnEvidenceTile } from '../../shared/presentation/return-evidence';
import { chooseAndSaveMedia } from '../../shared/media/local-media';
type EvidenceEvent = WechatMiniprogram.CustomEvent<{ key: string }>;
function createState() { return { ...createReturnCabinetState<RentalOrder, RentalTask>(createNavigateOnce()), returned: null as RentalRecord<RentalReturn> | null, drafts: [] as RentalEvidenceDraft[], polls: 0, pollTimer: undefined as ReturnType<typeof setTimeout> | undefined, mediaPicker: undefined as { hidden: boolean; completed?: boolean } | undefined }; }
const states = new WeakMap<object, ReturnType<typeof createState>>();
function state(page: object) { let value = states.get(page); if (!value) { value = createState(); states.set(page, value); } return value; }
function emptyView() { return { assetTitle: '', preReadyCount: 0, preTotalCount: 0, placementExample: '', loaded: false, loading: false, busy: false, canSelect: false, canQuery: false, canConfirm: false, canResumeReservation: false, cabinetName: '', compartmentNo: '', taskId: '', taskStatus: '', taskStatusLabel: '', door: '', rfid: '', taskCopy: '', confirmed: '', photoComplete: false, tiles: [] as ReturnEvidenceTile[] }; }
Page({
  data: { ...emptyView(), icons: designAssets, errorText: '' },
  onLoad(options: Record<string, string | undefined>) { state(this).id = options['orderId'] ?? ''; },
  onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (s.mediaPicker?.hidden && s.owner === owner) { s.mediaPicker.hidden = false; if (s.mediaPicker.completed) s.mediaPicker = undefined; return; } s.mediaPicker = undefined; s.show(owner); s.current = null; s.task = null; s.returned = null; s.drafts = []; s.polls = 0; this.setData(emptyView()); try { if (s.owner) s.drafts = rentalEvidenceDrafts.read(s.id); } catch (error) { this.failure(error); } void this.refresh(); },
  onHide() { const s = state(this); if (s.mediaPicker) { s.mediaPicker.hidden = true; return; } this.stopPolling(); s.hide(); s.current = null; s.task = null; s.returned = null; this.setData(emptyView()); },
  onUnload() { const current = state(this); current.dispose(); states.delete(this); },
  failure(error: unknown) { this.setData({ errorText: error instanceof Error ? error.message : '归还结果待核实，请查询原任务' }); },
  stopPolling() { const s = state(this); if (s.pollTimer !== undefined) s.scope.clearTimer(s.pollTimer); s.pollTimer = undefined; },
  updateView(patch: Partial<ReturnType<typeof emptyView>>) { const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => JSON.stringify(this.data[key as keyof typeof this.data]) !== JSON.stringify(value))); if (Object.keys(changes).length) this.setData(changes); },
  clearExpired() { const s = state(this); if (!s.visible || accountApi.sessionIdentity() === s.owner) return; s.current = null; s.task = null; s.returned = null; s.epoch++; s.readSequence++; s.scope.onHide(); this.setData({ ...emptyView(), errorText: '登录状态已变化，请重新读取本人归还记录' }); },
  persistEvidence() { const s = state(this); if (s.owner && accountApi.sessionIdentity() === s.owner) rentalEvidenceDrafts.save(s.id, s.drafts); },
  renderEvidence() { const s = state(this), slots = s.returned?.value.evidence_slots ?? []; this.updateView({ tiles: returnEvidenceTiles(slots, s.drafts, 'AFTER_OPEN'), placementExample: returnEvidenceTiles(slots, [], 'AFTER_OPEN')[0]?.example ?? '', preReadyCount: slots.filter(v => v.slot.stage === 'PRE_RETURN' && v.complete).reduce((n,v) => n + v.slot.min_count,0), preTotalCount: slots.filter(v => v.slot.stage === 'PRE_RETURN').reduce((n,v) => n + v.slot.min_count,0), photoComplete: slots.filter(v => v.slot.stage === 'AFTER_OPEN').every(v => v.complete) && !s.drafts.some(d => slots.some(v => v.slot.stage === 'AFTER_OPEN' && v.slot.slot_key === d.slotKey)) }); },
  async refresh(preserveError = false, silent = false) {
    const s = state(this), lease = s.capture(accountApi.sessionIdentity), sequence = ++s.readSequence, active = () => lease() && s.readSequence === sequence;
    if (!active()) return; this.stopPolling(); if (!silent || !this.data.loaded) this.setData({ loading: true }); if (!preserveError && this.data.errorText) this.setData({ errorText: '' });
    try {
      if (!s.id || !s.owner) throw new Error('请从本人官方订单进入柜机归还');
      const context = await readReturnCabinetContext(rentalOrderApi, s.id, active); if (!context || !active()) return;
      const returned = context.order.value.return_id ? await rentalOrderApi.return(s.id).promise : null; if (!active()) return;
      if (returned && returned.value.order_id !== s.id) throw new Error('凭证记录与本单不匹配');
      s.current = context.order; s.task = context.task; s.returned = returned;
      const task = context.task?.value, view = returnTaskView(context.task);
      this.updateView({ loaded: true, assetTitle: context.order.value.order.asset?.title ?? '', cabinetName: task?.cabinet_name ?? '', compartmentNo: task?.compartment_no ?? '', taskId: view.taskId, taskStatus: view.taskStatus, taskStatusLabel: task ? rentalCabinetTaskLabel(task.status) : '', taskCopy: task ? rentalCabinetTaskCopy(task) : '', canConfirm: view.canConfirm && task?.door_status === 'CLOSED', canQuery: view.canQuery, canSelect: context.canSelect, canResumeReservation: view.canOpen || view.canCancel, confirmed: beijingTime(task?.confirmed_at), door: returnCabinetFact(task?.door_status), rfid: returnCabinetFact(task?.rfid_result) }); this.renderEvidence();
      const awaitingUser = task?.status === 'AWAITING_CONFIRMATION' && task.door_status === 'CLOSED' && task.rfid_result === 'MATCH';
      if (task && !awaitingUser && ['EXECUTING', 'VERIFYING', 'AWAITING_CONFIRMATION', 'UNKNOWN'].includes(task.status) && s.polls++ < 30) s.pollTimer = s.scope.setTimeout(() => { s.pollTimer = undefined; if (active()) void this.refresh(true, true); }, 2000);
    } catch (error) { if (active()) this.failure(error); }
    finally { if (active()) { if (this.data.loading) this.setData({ loading: false }); } else this.clearExpired(); }
  },
  async confirmReturn() {
    const s = state(this), active = s.capture(accountApi.sessionIdentity);
    await s.run('confirm-cabinet-return', async () => {
      if (!active() || !s.task || !this.data.canConfirm || this.data.busy) return; const taskId = s.task.value.task_id; this.stopPolling(); s.readSequence++; this.setData({ busy: true, loading: false, errorText: '' });
      try {
        const answer = await wx.showModal({ title: '确认设备已放入并关门', content: this.data.photoComplete ? '确认后将核对柜门和设备标签，请等待归还结果。' : '入柜照片尚未齐全，可先核验归还；退押审核前仍需补齐照片。', confirmText: '确认归还' });
        if (!active() || !answer.confirm) return;
        // The cabinet worker may update the task while the native modal is open.
        const latest = await rentalOrderApi.task(taskId).promise; if (!active()) return;
        if (latest.value.task_id !== taskId || latest.value.order_id !== s.id || latest.value.purpose !== 'RETURN') throw new Error('归还任务与当前订单不一致，请刷新原订单');
        if (latest.value.status === 'SUCCEEDED') return;
        if (!returnTaskView(latest).canConfirm || latest.value.door_status !== 'CLOSED') throw new Error('柜门或任务状态已变化，请核对后再确认归还');
        s.task = latest;
        await rentalOrderApi.confirmCabinetReturn(taskId, latest.etag).promise;
        if (active()) s.polls = 0;
      } catch (error) { if (active()) this.failure((error as { statusCode?: number })?.statusCode === 412 ? new Error('柜机状态刚刚更新，请核对后再次确认归还') : error); }
      finally { if (active()) { this.setData({ busy: false }); await this.refresh(true, true); } else this.clearExpired(); }
    });
  },
  async query() { const s = state(this), active = s.capture(accountApi.sessionIdentity), readSequence = s.readSequence; await s.run('query-original-return-task', async () => { if (!active() || !s.task || !this.data.canQuery || this.data.busy) return; this.setData({ busy: true }); try { await rentalOrderApi.queryCabinet(s.task.value.task_id, s.task.etag).promise; if (active()) { s.polls = 0; await this.refresh(); } } catch (error) { if (active() && s.readSequence === readSequence) this.failure(error); } finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); } }); },
  async selectEvidence(event: EvidenceEvent) {
    const s = state(this), active = s.capture(accountApi.sessionIdentity);
    await s.run('return-placement-photo', async () => {
      const tile = this.data.tiles.find(v => v.key === event.detail.key); if (!active() || !tile?.editable || (tile.pending && !tile.failed) || this.data.busy) return; this.setData({ busy: true, errorText: '' });
      try {
        let reason: string | null = null;
        if (s.returned?.value.received_at) { const answer = await wx.showModal({ title: '补充入柜凭证', content: '', editable: true, placeholderText: '请填写补充原因' }); if (!active() || !answer.confirm) return; reason = answer.content?.trim() ?? ''; if (!reason) throw new Error('收回设备后补充凭证需填写原因'); }
        // Preserve the in-flight native selection, not ordinary page navigation.
        s.mediaPicker = { hidden: false };
        let paths: string[];
        try { paths = await chooseAndSaveMedia(tile.kind === 'VIDEO' ? 'video' : 'image', 1, s.task?.value.door_status === 'CLOSED' ? ['album'] : ['camera', 'album'], active, file => { const limits = s.current?.value.requirements.media; if (!limits || !Number.isFinite(file.size) || BigInt(Math.ceil(file.size)) > BigInt(tile.kind === 'VIDEO' ? limits.video_bytes_max : limits.photo_bytes_max)) throw new Error('文件超过本单允许的大小'); if (tile.kind === 'VIDEO' && (!Number.isFinite(file.duration) || file.duration > limits.video_seconds_max)) throw new Error('视频超过本单允许的时长'); }); } finally { if (s.mediaPicker) { s.mediaPicker.completed = true; if (!s.mediaPicker.hidden) s.mediaPicker = undefined; } }
        if (!active() || !paths[0]) return;
        s.drafts = rentalEvidenceDrafts.replaceFailed(s.id, s.drafts, tile.key); s.drafts.push(rentalEvidenceDrafts.create(tile.slotKey, tile.itemNo, paths[0], tile.kind, reason)); this.persistEvidence(); this.renderEvidence(); await this.saveEvidence(tile.key, false);
      } catch (error) { if (active()) this.failure(error); }
      finally { if (active()) { this.setData({ busy: false }); void this.refresh(true, true); } else this.clearExpired(); }
    });
  },
  async saveEvidence(key: string, recovery: boolean) { const s = state(this), active = s.capture(accountApi.sessionIdentity), draft = s.drafts.find(v => v.slotKey + ':' + v.itemNo === key); if (!active() || !draft) return; const result = await saveRentalEvidenceDraft(s.id, draft, { scope: s.scope, active, recovery, changed: () => { if (active()) { this.persistEvidence(); this.renderEvidence(); } } }); if (result && active()) { s.returned = result; s.drafts = s.drafts.filter(v => v !== draft); this.persistEvidence(); this.renderEvidence(); } },
  async recoverEvidence(event: EvidenceEvent) { const s = state(this), active = s.capture(accountApi.sessionIdentity); await s.run('return-placement-photo', async () => { if (!active() || this.data.busy) return; this.setData({ busy: true }); try { await this.saveEvidence(event.detail.key, true); } catch (error) { if (active()) this.failure(error); } finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); } }); },
  previewEvidence(event: EvidenceEvent) { if (!state(this).capture(accountApi.sessionIdentity)()) return; const tile = this.data.tiles.find(v => v.key === event.detail.key); const url = tile?.draftPreview || tile?.url; if (tile && url) wx.previewMedia({ sources: [{ url, type: tile.kind === 'VIDEO' ? 'video' : 'image', poster: tile.poster }], current: 0 }); },
  showExample(event: EvidenceEvent) { if (!state(this).capture(accountApi.sessionIdentity)()) return; const tile = this.data.tiles.find(v => v.key === event.detail.key); if (tile?.example) wx.previewMedia({ sources: [{ url: tile.example, type: tile.kind === 'VIDEO' ? 'video' : 'image', poster: tile.examplePoster }], current: 0 }); },
  goSelection() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && this.data.canSelect && !this.data.busy) s.navigation.navigateOnce('return-selection', callbacks => wx.navigateTo({ url: '/pages/cabinets/index?mode=return&orderId=' + encodeURIComponent(s.id), ...callbacks })); },
  resumeReservation() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && this.data.canResumeReservation && s.task) s.navigation.navigateOnce('return-reservation', callbacks => wx.navigateTo({ url: '/pages/cabinet-detail/index?mode=return&orderId=' + encodeURIComponent(s.id) + '&id=' + encodeURIComponent(s.task!.value.cabinet_id), ...callbacks })); },
  previewPlacementExample() { const tile = this.data.tiles[0]; if (tile) this.showExample({ detail: { key: tile.key } } as EvidenceEvent); },
  goOrder() { const s = state(this); if (s.capture(accountApi.sessionIdentity)()) s.navigation.navigateOnce('return-order', callbacks => wx.redirectTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(s.id), ...callbacks })); },
  goPlacement() { const s = state(this); if (s.capture(accountApi.sessionIdentity)()) s.navigation.navigateOnce('return-placement', callbacks => wx.navigateTo({ url: '/pages/return-submit/index?stage=AFTER_OPEN&orderId=' + encodeURIComponent(s.id), ...callbacks })); },
  goMaterials() { const s = state(this); if (s.capture(accountApi.sessionIdentity)()) s.navigation.navigateOnce('return-material', callbacks => wx.navigateTo({ url: '/pages/return-submit/index?orderId=' + encodeURIComponent(s.id), ...callbacks })); },
  onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
