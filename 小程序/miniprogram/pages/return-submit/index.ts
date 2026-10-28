import { designAssets } from '../../shared/design/assets';
import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, rentalEvidenceDrafts, saveRentalEvidenceDraft, type RentalEvidenceDraft, type RentalReturn, type RentalOrder, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { chooseAndSaveMedia } from '../../shared/media/local-media';
import { beijingTime, rentalActionAllowed, rentalBlockers } from '../../shared/presentation/rental-order';
import { returnEvidenceTiles, type ReturnEvidenceTile } from '../../shared/presentation/return-evidence';
import { publicMedia } from '../../shared/presentation/material-media';
import { returnAddressSnapshot } from '../../shared/presentation/rental-return-dispatch';
import { rentalDeliveryAddressText } from '../../shared/presentation/rental-order-delivery';
import { takeReturnAddressConfirmation } from '../../shared/interaction/return-address-confirmation';
type EvidenceEvent = WechatMiniprogram.CustomEvent<{ key: string }>;
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalReturn>>> & { addressAck: string; requestedAddressVersion: string; order: RentalRecord<RentalOrder> | null; drafts: RentalEvidenceDraft[]; readSequence: number; stage: string; mediaPicker?: { hidden: boolean; completed?: boolean } }>();
function state(page: object) { let s = states.get(page); if (!s) { s = { ...createRentalPageState<RentalRecord<RentalReturn>>(), addressAck: '', requestedAddressVersion: '', order: null, drafts: [], readSequence: 0, stage: 'PRE_RETURN' }; states.set(page, s); } return s; }
const recordRequests = new WeakSet<object>();
function recordOnly(page: object) { const order = state(page).order?.value.order; return recordRequests.has(page) || !!order && (order.viewer_role !== 'TENANT' || order.review_status === 'FINAL' || ['COMPLETED', 'CLOSED'].includes(order.stage)); }
function supplementing(page: object) { return !recordOnly(page) && !!state(page).current?.value.received_at; }
function historyRows(record: RentalReturn | undefined) {
  return (record?.evidence_history ?? []).filter(item => !item.is_current).map(item => {
    const media = item.availability === 'READY' && item.media?.material_id === item.material_id && (item.kind === 'VIDEO' ? item.media.role === 'VIDEO' : item.media?.role !== 'VIDEO') ? publicMedia(item.media) : null;
    return { id: item.evidence_id, title: (record?.evidence_template.slots.find(slot => slot.slot_key === item.slot_key)?.title ?? '归还凭证') + ' · 第' + item.revision_no + '版', kind: item.kind, time: beijingTime(item.created_at), reason: item.reason ?? '', url: media?.url ?? '', poster: media?.poster ?? '' };
  });
}
// Only structure the wording frozen on this order; never add evidence requirements.
function exampleSteps(tile: ReturnEvidenceTile) {
  const sentences = tile.instruction.split(/[。；\n]/).map(v => v.trim()).filter(Boolean);
  const labels = tile.kind === 'VIDEO' && sentences[0]?.startsWith('连续展示')
    ? [...sentences[0].slice(4).split('、'), ...sentences.slice(1).filter(v => !v.startsWith('示例时长'))] : sentences.flatMap(v => v.split('，'));
  return labels.map((label, index) => ({ key: String(index), number: index + 1, label,
    icon: label.includes('闪光') ? designAssets.returnFlash : label.includes('回放') ? designAssets.returnPlayback : label.includes('视频') ? designAssets.returnVideo : designAssets.returnCamera }));
}
Page({
  data: { supplementing: false, focusKey: '', history: [] as ReturnType<typeof historyRows>, recordOnly: false, icons: designAssets, exampleSteps: [] as { key: string; number: number; label: string; icon: string }[], loaded: false, loading: false, busy: false, errorText: '', title: '', media: '', photoCount: 0, videoCount: 0, exampleIndex: 0, exampleCount: 0, method: '', instructions: '', received: '', address: '', addressVersion: '0', addressConfirmed: false, tracking: '', carrier: '', correctionReason: '', canStart: false, canShip: false, canCorrect: false, canProceed: false, isAfterOpen: false, pendingCount: 0, readyCount: 0, totalCount: 0, blockers: '', tiles: [] as ReturnEvidenceTile[], missing: [] as { key: string; text: string }[], example: null as ReturnEvidenceTile | null },
  onLoad(options: Record<string, string | undefined>) { if (options['mode'] === 'record') recordRequests.add(this); const s = state(this); s.id = options['orderId'] ?? options['id'] ?? ''; s.requestedAddressVersion = options['addressVersion'] ?? ''; s.stage = options['stage'] === 'AFTER_OPEN' ? 'AFTER_OPEN' : 'PRE_RETURN'; this.setData({ isAfterOpen: s.stage === 'AFTER_OPEN' }); },
  onShow() { const s = state(this); const nextOwner = accountApi.sessionIdentity() ?? ''; if (s.mediaPicker?.hidden && s.owner === nextOwner) { s.mediaPicker.hidden = false; if (s.mediaPicker.completed) delete s.mediaPicker; return; } delete s.mediaPicker; if (s.owner !== nextOwner) s.addressAck = ''; if (s.owner !== nextOwner) this.setData({ tracking: '', carrier: '', correctionReason: '', addressConfirmed: false, addressVersion: '0', address: '', errorText: '' }); s.show(nextOwner); s.current = null; s.order = null; s.drafts = []; this.setData({ loaded: false, recordOnly: false, supplementing: false, focusKey: '', history: [], busy: false, tiles: [], example: null }); try { if (s.owner) s.drafts = rentalEvidenceDrafts.read(s.id); } catch (error) { this.failure(error); } void this.refresh(); },
  onHide() { const s = state(this); if (s.mediaPicker) { s.mediaPicker.hidden = true; return; } this.closeExample(); s.hide(); s.addressAck = ''; this.setData({ addressConfirmed: false, busy: false, loading: false, loaded: false, recordOnly: false, supplementing: false, focusKey: '', history: [], tiles: [] }); },
  onUnload() { this.closeExample(); state(this).dispose(); states.delete(this); },
  failure(error: unknown) { this.setData({ errorText: error instanceof Error ? error.message : '操作未完成，请查询原记录' }); },
  clearExpired() { const s = state(this); if (!s.visible || accountApi.sessionIdentity() === s.owner) return; s.current = null; s.order = null; s.addressAck = ''; s.requestedAddressVersion = ''; s.epoch++; s.readSequence++; s.scope.onHide(); this.closeExample(); this.setData({ loaded: false, loading: false, busy: false, recordOnly: false, supplementing: false, focusKey: '', history: [], title: '', media: '', photoCount: 0, videoCount: 0, instructions: '', received: '', address: '', tracking: '', carrier: '', correctionReason: '', addressConfirmed: false, canStart: false, canShip: false, canCorrect: false, canProceed: false, pendingCount: 0, readyCount: 0, totalCount: 0, blockers: '', tiles: [], missing: [], errorText: '登录状态已变化，请重新读取本人订单' }); },
  persist() { const s = state(this); if (s.owner && accountApi.sessionIdentity() === s.owner) rentalEvidenceDrafts.save(s.id, s.drafts); },
  renderEvidence() {
    const s = state(this), value = s.current?.value;
    const slots = value?.evidence_slots ?? s.order?.value.requirements.return_evidence_template.slots.map(slot => ({ slot, items: [], editable: this.data.canStart, complete: false })) ?? [];
    const readOnly = recordOnly(this), supplement = supplementing(this), visible = slots.filter(v => readOnly || supplement || v.slot.stage === s.stage);
    const tiles = readOnly ? [...new Set(slots.map(v => v.slot.stage))].flatMap(stage => returnEvidenceTiles(slots, [], stage)).map(tile => ({ ...tile, editable: false, example: '', examplePoster: '', state: tile.ready ? '已保存' : '无可用凭证' })) : supplement ? [...new Set(slots.map(v => v.slot.stage))].flatMap(stage => returnEvidenceTiles(slots, s.drafts, stage)) : returnEvidenceTiles(slots, s.drafts, s.stage);
    if (supplement) { const missing = new Set((value?.missing_items ?? []).map(item => item.slot_key + ':' + item.item_no)); tiles.sort((a, b) => Number(missing.has(b.key)) - Number(missing.has(a.key))); }
    const focus = supplement ? tiles.find(tile => tile.editable && value?.missing_items.some(item => item.slot_key + ':' + item.item_no === tile.key)) : null;
    if (focus) tiles.sort((a, b) => Number(b.key === focus.key) - Number(a.key === focus.key));
    this.setData({ focusKey: focus?.key ?? '' });
    const pending = readOnly ? [] : s.drafts.filter(v => tiles.some(t => t.slotKey === v.slotKey));
    this.setData({ recordOnly: readOnly, supplementing: supplement, history: readOnly ? historyRows(value) : [], tiles, pendingCount: pending.length, totalCount: visible.reduce((n, v) => n + v.slot.min_count, 0), readyCount: visible.reduce((n, v) => n + (v.complete ? v.slot.min_count : 0), 0), canProceed: !readOnly && !supplement && !!value?.pre_return_complete && !pending.length, missing: readOnly ? [] : (value?.missing_items ?? []).map(v => ({ key: v.slot_key + ':' + v.item_no, text: (slots.find(s => s.slot.slot_key === v.slot_key)?.slot.title ?? v.slot_key) + '：' + v.reason })) });
  },
  async refresh() {
    const s = state(this), lease = s.capture(accountApi.sessionIdentity), sequence = ++s.readSequence, active = () => lease() && s.readSequence === sequence;
    if (!s.owner || !s.id || !active()) { this.setData({ loaded: false, errorText: '请登录后从本人订单进入归还' }); return; }
    this.setData({ loading: true, errorText: '' });
    try {
      const order = await rentalOrderApi.get(s.id).promise; if (!active()) return;
      const record = order.value.return_id ? await rentalOrderApi.return(s.id).promise : null; if (!active()) return;
      if (order.value.order.order_id !== s.id || record && (record.value.order_id !== s.id || record.value.return_id !== order.value.return_id)) throw new Error('归还记录与本单不匹配');
      const r = record?.value, snapshot = returnAddressSnapshot(r), requested = s.requestedAddressVersion;
      s.requestedAddressVersion = ''; s.order = order; s.current = record;
      const handedOver = !!requested && takeReturnAddressConfirmation(s.owner, s.id, snapshot, requested) && requested === r?.address_version;
      s.addressAck = !recordOnly(this) && !supplementing(this) && snapshot && (handedOver || s.addressAck === snapshot) ? snapshot : '';
      if (recordOnly(this)) this.closeExample();
      this.setData({ loaded: true, title: order.value.order.asset.title, media: order.value.order.asset.cover_media?.url ?? '', photoCount: order.value.requirements.return_evidence_template.slots.filter(v => v.stage === 'PRE_RETURN' && v.kind === 'PHOTO').reduce((n,v) => n + v.min_count,0), videoCount: order.value.requirements.return_evidence_template.slots.filter(v => v.stage === 'PRE_RETURN' && v.kind === 'VIDEO').reduce((n,v) => n + v.min_count,0), method: order.value.delivery.method, instructions: order.value.requirements.return_instructions, received: beijingTime(r?.received_at), address: rentalDeliveryAddressText(r?.address), addressVersion: r?.address_version ?? '0', addressConfirmed: !!s.addressAck, tracking: (recordOnly(this) ? r?.tracking_no : this.data.tracking || r?.tracking_no) || '', carrier: (recordOnly(this) ? r?.carrier : this.data.carrier || r?.carrier) || '', canStart: !recordOnly(this) && !record && order.value.order.viewer_role === 'TENANT' && rentalActionAllowed(order.value.order.allowed_actions, 'START_RETURN'), canShip: !recordOnly(this) && !supplementing(this) && rentalActionAllowed(r?.allowed_actions ?? [], 'SHIP_RETURN'), canCorrect: !recordOnly(this) && !supplementing(this) && rentalActionAllowed(r?.allowed_actions ?? [], 'CORRECT_RETURN_SHIPMENT'), blockers: rentalBlockers(r?.blockers ?? order.value.order.blockers) }); this.renderEvidence();
    } catch (error) { if (active()) { s.current = null; s.order = null; s.addressAck = ''; this.setData({ loaded: false, addressConfirmed: false, address: '', addressVersion: '0', canStart: false, canShip: false, canCorrect: false, canProceed: false }); this.failure(error); } }
    finally { if (active()) this.setData({ loading: false }); else this.clearExpired(); }
  },
  async ensureReturn() { const s = state(this); if (recordOnly(this)) throw new Error('当前仅可查看归还记录'); if (s.current) return; if (!s.order || !this.data.canStart) throw new Error('当前订单不能开始归还'); const active = s.capture(accountApi.sessionIdentity); const result = await rentalOrderApi.startReturn(s.id, s.order.value.delivery.method, s.order.etag).promise; if (active() && !recordOnly(this)) { s.current = result; this.setData({ canStart: false }); this.renderEvidence(); } },
  async start() { const s = state(this), active = s.capture(accountApi.sessionIdentity); await s.run('return-start', async () => { if (!active() || !this.data.loaded || recordOnly(this) || this.data.busy) return; this.setData({ busy: true }); try { await this.ensureReturn(); if (active()) await this.refresh(); } catch (error) { if (active()) this.failure(error); } finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); } }); },
  async selectEvidence(event: EvidenceEvent, source?: 'camera' | 'album') {
    const s = state(this), active = s.capture(accountApi.sessionIdentity);
    await s.run('return-media-edit', async () => {
      const tile = this.data.tiles.find(v => v.key === event.detail.key); if (!active() || !this.data.loaded || recordOnly(this) || !tile?.editable || this.data.busy) return;
      if (tile.pending && !tile.failed) { this.setData({ errorText: '请先恢复该槽位的原上传和保存请求' }); return; }
      this.setData({ busy: true, errorText: '' });
      try {
        await this.ensureReturn(); if (!active()) return;
        let reason: string | null = null;
        if (s.current?.value.received_at) { const answer = await wx.showModal({ title: '补充 / 更换归还凭证', content: '', editable: true, placeholderText: '请填写补充或更换原因', confirmText: '继续' }); if (!active() || !answer.confirm) return; reason = answer.content?.trim() ?? ''; if (!reason) throw new Error('收回设备后补充凭证需填写原因'); }
        // A native chooser temporarily hides the page without leaving this order.
        s.mediaPicker = { hidden: false };
        let paths: string[];
        try { paths = await chooseAndSaveMedia(tile.kind === 'VIDEO' ? 'video' : 'image', 1, s.current?.value.cabinet_task?.door_status === 'CLOSED' && s.stage === 'AFTER_OPEN' ? ['album'] : source ? [source] : ['camera', 'album'], active, file => {
          const limits = s.order?.value.requirements.media; if (!limits) throw new Error('未读取本单材料规范');
          if (!Number.isFinite(file.size) || BigInt(Math.ceil(file.size)) > BigInt(tile.kind === 'VIDEO' ? limits.video_bytes_max : limits.photo_bytes_max)) throw new Error('文件超过本单允许的大小');
          if (tile.kind === 'VIDEO' && (!Number.isFinite(file.duration) || file.duration > limits.video_seconds_max)) throw new Error('视频超过本单允许的时长');
        }); } finally { if (s.mediaPicker) { s.mediaPicker.completed = true; if (!s.mediaPicker.hidden) delete s.mediaPicker; } }
        if (!active() || recordOnly(this) || !this.data.tiles.find(v => v.key === tile.key)?.editable || !paths[0]) return;
        s.drafts = rentalEvidenceDrafts.replaceFailed(s.id, s.drafts, tile.key); s.drafts.push(rentalEvidenceDrafts.create(tile.slotKey, tile.itemNo, paths[0], tile.kind, reason)); this.persist(); this.renderEvidence(); await this.saveDraft(tile.key, false);
      } catch (error) { if (active()) this.failure(error); }
      finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); }
    });
  },
  async saveDraft(key: string, recovery: boolean) {
    const s = state(this), lease = s.capture(accountApi.sessionIdentity), active = () => lease() && !recordOnly(this) && !!this.data.tiles.find(v => v.key === key)?.editable, draft = s.drafts.find(v => v.slotKey + ':' + v.itemNo === key); if (!active() || !this.data.loaded || !draft) return;
    const result = await saveRentalEvidenceDraft(s.id, draft, { scope: s.scope, active, recovery, changed: () => { if (active()) { this.persist(); this.renderEvidence(); } } });
    if (result && active()) { s.current = result; s.drafts = s.drafts.filter(v => v !== draft); this.persist(); this.renderEvidence(); }
  },
  async recoverEvidence(event: EvidenceEvent) { const s = state(this), active = s.capture(accountApi.sessionIdentity); await s.run('return-media-edit', async () => { if (!active() || !this.data.loaded || recordOnly(this) || this.data.busy) return; this.setData({ busy: true, errorText: '' }); try { await this.saveDraft(event.detail.key, true); } catch (error) { if (active()) this.failure(error); } finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); } }); },
  previewEvidence(event: EvidenceEvent) { if (!state(this).capture(accountApi.sessionIdentity)()) return; const tile = this.data.tiles.find(v => v.key === event.detail.key); const url = tile?.draftPreview || tile?.url; if (tile && url) wx.previewMedia({ sources: [{ url, type: tile.kind === 'VIDEO' ? 'video' : 'image', poster: tile.poster }], current: 0 }); },
  previewHistory(event: WechatMiniprogram.TouchEvent) { if (!state(this).capture(accountApi.sessionIdentity)() || !this.data.loaded || !recordOnly(this)) return; const row = this.data.history.find(item => item.id === event.currentTarget.dataset['id']); if (row?.url) wx.previewMedia({ sources: [{ url: row.url, type: row.kind === 'VIDEO' ? 'video' : 'image', poster: row.poster }], current: 0 }); },
  showExample(event: EvidenceEvent) { if (!state(this).capture(accountApi.sessionIdentity)()) return; const tile = this.data.tiles.find(v => v.key === event.detail.key); if (tile?.example) { this.closeExample(); const photos = this.data.tiles.filter(v => v.kind === tile.kind && v.example); this.setData({ example: tile, exampleSteps: exampleSteps(tile), exampleIndex: photos.findIndex(v => v.key === tile.key), exampleCount: photos.length }); } },
  changeExample(event: WechatMiniprogram.TouchEvent) { if (!state(this).capture(accountApi.sessionIdentity)() || !this.data.example) return; const list = this.data.tiles.filter(v => v.kind === this.data.example!.kind && v.example), index = this.data.exampleIndex + Number(event.currentTarget.dataset['direction']); if (index >= 0 && index < list.length) this.setData({ example: list[index]!, exampleSteps: exampleSteps(list[index]!), exampleIndex: index }); },
  async selectExample(event: WechatMiniprogram.TouchEvent) { const tile = this.data.example; if (!tile || !tile.editable) return; this.closeExample(); await this.selectEvidence({ detail: { key: tile.key } } as EvidenceEvent, event.currentTarget.dataset['source'] === 'album' ? 'album' : 'camera'); },
  closeExample() { if (typeof wx.createVideoContext === 'function') wx.createVideoContext('return-slot-example', this).stop(); this.setData({ example: null, exampleSteps: [] }); },
  previewExample() { const tile = this.data.example; if (state(this).capture(accountApi.sessionIdentity)() && tile?.example && tile.kind === 'PHOTO') wx.previewImage({ current: tile.example, urls: [tile.example] }); },
  input(event: WechatMiniprogram.Input) { if (!state(this).capture(accountApi.sessionIdentity)() || !this.data.loaded || recordOnly(this) || this.data.busy) return; const field = String(event.currentTarget.dataset['field']); if (['tracking', 'carrier', 'correctionReason'].includes(field)) this.setData({ [field]: event.detail.value }); },
  confirmAddress() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || recordOnly(this) || supplementing(this) || this.data.busy) return;
    const snapshot = returnAddressSnapshot(s.current?.value); s.addressAck = snapshot && s.addressAck !== snapshot ? snapshot : ''; this.setData({ addressConfirmed: !!s.addressAck }); },
  async saveShipment() { const s = state(this), active = s.capture(accountApi.sessionIdentity); await s.run('return-shipment', async () => { const r = s.current; if (!active() || !this.data.loaded || recordOnly(this) || !r || this.data.busy || !(this.data.canShip || this.data.canCorrect)) return; this.setData({ busy: true }); try { if (!this.data.addressConfirmed || !s.addressAck || s.addressAck !== returnAddressSnapshot(r.value) || !/^\S{1,64}$/.test(this.data.tracking.trim())) throw new Error('请核对返程地址并填写有效的快递单号'); const body = { tracking_no: this.data.tracking.trim(), carrier: this.data.carrier.trim() || null }; if (this.data.canCorrect) { if (!this.data.correctionReason.trim()) throw new Error('请填写更正原因'); await rentalOrderApi.correctReturnShipment(s.id, { ...body, reason: this.data.correctionReason.trim() }, r.etag).promise; } else await rentalOrderApi.returnShipment(s.id, { ...body, confirmed_address_version: r.value.address_version }, r.etag).promise; if (active()) await this.refresh(); } catch (error) { if (active()) this.failure(error); } finally { if (active()) this.setData({ busy: false }); else this.clearExpired(); } }); },
  openCabinet() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || recordOnly(this) || this.data.busy || !this.data.canProceed || !s.current) return; const task = s.current.value.cabinet_task; const route = this.data.isAfterOpen || task && !['CANCELLED', 'FAILED_CONFIRMED'].includes(task.status) ? '/pages/cabinet-return/index?orderId=' : '/pages/cabinets/index?mode=return&orderId='; s.navigation.navigateOnce('return-cabinet', callbacks => wx.navigateTo({ url: route + encodeURIComponent(s.id), ...callbacks })); },
  returnToOrder() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || !(recordOnly(this) || supplementing(this))) return; s.navigation.navigateOnce('record-order', callbacks => wx.navigateBack({ ...callbacks, fail: error => { callbacks.fail(error); s.navigation.navigateOnce('record-order-fallback', fallback => wx.redirectTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(s.id), ...fallback })); } })); },
  onSecondaryNavigationBack() { if (recordOnly(this) || supplementing(this)) this.returnToOrder(); else navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
