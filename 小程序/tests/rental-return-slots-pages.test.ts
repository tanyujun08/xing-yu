import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RentalEvidenceDraft } from '../miniprogram/shared/api/rental-return-evidence';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';

const m = vi.hoisted(() => ({ owner: 'tenant', get: vi.fn(), returned: vi.fn(), task: vi.fn(), confirmCabinetReturn: vi.fn(), start: vi.fn(), shipment: vi.fn(), correct: vi.fn(), save: vi.fn(), drafts: [] as RentalEvidenceDraft[], persist: vi.fn(), chooser: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => m.owner } }));
vi.mock('../miniprogram/shared/api/rental-api', () => ({
  rentalOrderApi: { get: m.get, return: m.returned, task: m.task, confirmCabinetReturn: m.confirmCabinetReturn, startReturn: m.start, returnShipment: m.shipment, correctReturnShipment: m.correct },
  rentalEvidenceDrafts: {
    read: () => m.drafts, save: m.persist,
    create: (slotKey: string, itemNo: number, file: string, kind: string, reason: string | null) => ({ slotKey, itemNo, reason, intent: { owner: m.owner, field: slotKey, item: String(itemNo), generation: 1, file, key: 'proof-key', materialClass: kind === 'VIDEO' ? 'EVIDENCE_VIDEO' : 'EVIDENCE_IMAGE', phase: 'SELECTED', progress: 0, error: '', materialId: null } }),
    replaceFailed: (_: string, drafts: RentalEvidenceDraft[], key: string) => drafts.filter(d => d.slotKey + ':' + d.itemNo !== key),
  }, saveRentalEvidenceDraft: m.save,
}));
vi.mock('../miniprogram/shared/media/local-media', () => ({ chooseAndSaveMedia: m.chooser }));
const handle = (value: unknown, etag = '"RETURN:cg:1"') => ({ promise: Promise.resolve({ value, etag }), abort: vi.fn() });
const slots = () => ['front', 'inspection', 'in-cabinet'].map((key, i) => ({ slot_key: key, title: ['外观照片', '验机视频', '入柜照片'][i]!, kind: i === 1 ? 'VIDEO' : 'PHOTO', stage: i === 2 ? 'AFTER_OPEN' : 'PRE_RETURN', min_count: 1, max_count: 1, instruction: '拍清设备与配件', sort_order: i, example: { url: origin + '/return-examples/' + key + (i === 1 ? '.mp4' : '.jpg'), poster_url: i === 1 ? origin + '/return-examples/poster.jpg' : null } }));
function returned() { return { return_id: 'r', order_id: 'o', method: 'CABINET', received_at: null as string | null, address_version: '1', address: null, tracking_no: null, carrier: null, evidence_version: '0', evidence_template: { template_key: 'camera', version: '1', title: '相机归还', slots: slots() }, evidence_slots: slots().map(slot => ({ slot, editable: slot.stage === 'PRE_RETURN', complete: false, items: [] as Record<string, unknown>[] })), evidence_history: [], missing_items: [] as Record<string, unknown>[], pre_return_complete: false, cabinet_task: null as Record<string, unknown> | null, blockers: [] as Record<string, unknown>[], allowed_actions: [] as Record<string, unknown>[] }; }
function order() { return { order: { order_id: 'o', asset: { title: '测试相机' }, viewer_role: 'TENANT', allowed_actions: [{ action_code: 'START_RETURN', allowed: true }], blockers: [] }, delivery: { method: 'CABINET' }, return_id: 'r' as string | null, requirements: { return_instructions: '归还后退押审核', return_evidence_template: returned().evidence_template, media: { photo_bytes_max: '1000000', video_bytes_max: '10000000', video_seconds_max: 60 } } }; }
function expressReturn() {
  const value = order(); value.delivery.method = 'EXPRESS'; m.get.mockReturnValue(handle(value));
  return { ...returned(), method: 'EXPRESS', address: { region_ids: ['p', 'c', 'd'], source_id: 'lessor-address', recipient_name: '李四', country_code: '+86', phone: '13800000001', region_text: '浙江省杭州市西湖区', detail: '月光路6号' }, allowed_actions: [{ action_code: 'SHIP_RETURN', allowed: true }] };
}
async function handoff(record: ReturnType<typeof expressReturn>, owner = 'tenant', orderId = 'o', version = record.address_version) {
  const { returnAddressSnapshot } = await import('../miniprogram/shared/presentation/rental-return-dispatch');
  const { rememberReturnAddressConfirmation } = await import('../miniprogram/shared/interaction/return-address-confirmation');
  rememberReturnAddressConfirmation(owner, orderId, returnAddressSnapshot(record), version);
}

test('original address handoff survives the fresh read once and retains the country code', async () => {
  const r = expressReturn(); m.returned.mockReturnValue(handle(r)); await handoff(r);
  await load('PRE_RETURN', 'return-submit', '', { addressVersion: '1' });
  expect(page.data).toMatchObject({ addressConfirmed: true, address: '李四 +86 13800000001 浙江省杭州市西湖区 月光路6号' });
  await call('refresh'); expect(page.data['addressConfirmed']).toBe(true);
  call('confirmAddress'); await call('refresh'); expect(page.data['addressConfirmed']).toBe(false);
});

test.each(['query-only', 'other-account', 'other-order', 'new-version', 'new-content', 'wrong-query', 'readonly'])('address confirmation handoff rejects %s', async kind => {
  const r = expressReturn();
  if (kind !== 'query-only') await handoff(r, kind === 'other-account' ? 'another' : 'tenant', kind === 'other-order' ? 'another' : 'o');
  if (kind === 'new-version') r.address_version = '2';
  if (kind === 'new-content') r.address.detail = '新地址';
  m.returned.mockReturnValue(handle(r));
  await load('PRE_RETURN', 'return-submit', kind === 'readonly' ? 'record' : '', { addressVersion: kind === 'wrong-query' ? '2' : '1' });
  expect(page.data['addressConfirmed']).toBe(false);
  Object.assign(page.data, { tracking: 'NEW123' }); await call('saveShipment'); expect(m.shipment).not.toHaveBeenCalled();
});

test('same-version address content change clears a form checkbox before shipment', async () => {
  const r = expressReturn(); m.returned.mockReturnValue(handle(r)); await load(); call('confirmAddress');
  expect(page.data['addressConfirmed']).toBe(true); r.address.phone = '13800000002'; await call('refresh');
  expect(page.data['addressConfirmed']).toBe(false); Object.assign(page.data, { tracking: 'NEW123', addressConfirmed: true });
  await call('saveShipment'); expect(m.shipment).not.toHaveBeenCalled();
});

test('failed refresh invalidates the original return before another shipment attempt', async () => {
  const r = expressReturn(); m.returned.mockReturnValue(handle(r)); await load(); call('confirmAddress');
  m.returned.mockImplementation(() => ({ promise: Promise.reject(new Error('地址读取失败')), abort: vi.fn() }));
  await call('refresh'); expect(page.data).toMatchObject({ loaded: false, addressConfirmed: false, address: '', canShip: false });
  await call('saveShipment'); expect(m.shipment).not.toHaveBeenCalled();
});

test('express correction requires a reason and preserves the original return identity', async () => {
  const r = expressReturn(); r.allowed_actions = [{ action_code: 'CORRECT_RETURN_SHIPMENT', allowed: true }]; m.returned.mockReturnValue(handle(r));
  await load('PRE_RETURN', 'return-submit', 'correction'); call('confirmAddress'); Object.assign(page.data, { tracking: 'NEW123', carrier: '顺丰' });
  await call('saveShipment'); expect(m.correct).not.toHaveBeenCalled();
  Object.assign(page.data, { correctionReason: '原单号录入错误' }); await call('saveShipment');
  expect(m.correct).toHaveBeenCalledExactlyOnceWith('o', { tracking_no: 'NEW123', carrier: '顺丰', reason: '原单号录入错误' }, '"RETURN:cg:1"'); expect(m.shipment).not.toHaveBeenCalled();
});
function evidence(kind = 'PHOTO', id = 'proof') { return { evidence_id: 'e-' + id, material_id: id, item_no: 1, kind, availability: 'READY', media: { material_id: id, role: kind === 'VIDEO' ? 'VIDEO' : 'IMAGE', url: origin + '/' + id + (kind === 'VIDEO' ? '.mp4' : '.jpg'), mime_type: kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg', size_bytes: 120, sort_order: 0, metadata: kind === 'VIDEO' ? { schema_version: 1, width: 640, height: 480, duration_ms: 1000, video_codec: 'h264', audio_codec: null } : null, poster: kind === 'VIDEO' ? { material_id: id + '-poster', url: origin + '/own-poster.jpg', width: 640, height: 480 } : null } }; }
type PageHarness = { data: Record<string, unknown>; setData: (v: Record<string, unknown>) => void; [key: string]: unknown };
let page: PageHarness;
function call(name: string, ...args: unknown[]) { return (page[name] as (...a: unknown[]) => unknown).apply(page, args); }
const event = (key = 'front:1') => ({ detail: { key } });
const tiles = () => page.data['tiles'] as { key: string; ready: boolean; pending: boolean; failed: boolean; url: string; poster: string; state: string }[];
async function load(stage = 'PRE_RETURN', name: 'return-submit' | 'cabinet-return' = 'return-submit', mode = '', query: Record<string, string> = {}) { let definition!: PageHarness; vi.stubGlobal('Page', (v: PageHarness) => { definition = v; }); if (name === 'cabinet-return') await import('../miniprogram/pages/cabinet-return/index'); else await import('../miniprogram/pages/return-submit/index'); page = { ...definition, data: structuredClone(definition.data), setData(v) { Object.assign(this.data, v); } }; call('onLoad', { orderId: 'o', stage, mode, ...query }); call('onShow'); await call('refresh'); }
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); m.owner = 'tenant'; m.drafts = [];
  m.get.mockReturnValue(handle(order())); m.returned.mockReturnValue(handle(returned())); m.start.mockReturnValue(handle(returned())); m.shipment.mockReturnValue(handle(returned())); m.correct.mockReturnValue(handle(returned())); m.chooser.mockResolvedValue(['local-photo']);
  m.save.mockImplementation(async (_: string, draft: RentalEvidenceDraft) => { const r = returned(), index = r.evidence_slots.findIndex(s => s.slot.slot_key === draft.slotKey); r.evidence_slots[index]!.items = [evidence(index === 1 ? 'VIDEO' : 'PHOTO')]; r.evidence_slots[index]!.complete = true; return { value: r, etag: '"RETURN:cg:2"' }; });
  vi.stubGlobal('wx', { nextTick: (f: () => void) => f(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), previewMedia: vi.fn(), previewImage: vi.fn(), createVideoContext: () => ({ stop: vi.fn() }), showModal: vi.fn().mockResolvedValue({ confirm: true, content: '补拍设备' }) });
});
afterEach(() => { if (page) call('onUnload'); vi.unstubAllGlobals(); vi.useRealTimers(); });

test('shows only pre-return slots with examples; reading the page does not create a return', async () => { const o = order(); o.return_id = null; m.get.mockReturnValue(handle(o)); await load(); expect(tiles().map(v => v.key)).toEqual(['front:1', 'inspection:1']); expect(m.start).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); });
test('first selected slot creates the return once and autosaves that slot', async () => { const o = order(); o.return_id = null; m.get.mockReturnValue(handle(o)); await load(); await call('selectEvidence', event()); expect(m.start).toHaveBeenCalledOnce(); expect(m.save).toHaveBeenCalledWith('o', expect.objectContaining({ slotKey: 'front', itemNo: 1, reason: null }), expect.objectContaining({ recovery: false })); expect(tiles()[0]?.ready).toBe(true); expect(page.data['pendingCount']).toBe(0); });
test('READY evidence remains replaceable in the same slot', async () => { const r = returned(); r.evidence_slots[0]!.items = [evidence()]; r.evidence_slots[0]!.complete = true; m.returned.mockReturnValue(handle(r)); await load(); await call('selectEvidence', event()); expect(m.chooser).toHaveBeenCalledOnce(); expect(m.save.mock.calls[0]?.[1]).toMatchObject({ slotKey: 'front', itemNo: 1 }); });
test.each(['PHOTO', 'VIDEO'])('previews %s through its own authorized URL and own poster', async kind => { const r = returned(), index = kind === 'VIDEO' ? 1 : 0; r.evidence_slots[index]!.items = [evidence(kind)]; m.returned.mockReturnValue(handle(r)); await load(); call('previewEvidence', event(index ? 'inspection:1' : 'front:1')); expect(wx.previewMedia).toHaveBeenCalledWith(expect.objectContaining({ sources: [expect.objectContaining({ url: origin + '/proof' + (index ? '.mp4' : '.jpg'), ...(index ? { poster: origin + '/own-poster.jpg' } : {}) })] })); });
test.each(['UNAVAILABLE', 'wrong-owner'])('does not expose unusable or mismatched media (%s)', async status => { const r = returned(), item = evidence(); if (status === 'UNAVAILABLE') item.availability = status; else item.media.material_id = 'another'; r.evidence_slots[0]!.items = [item]; m.returned.mockReturnValue(handle(r)); await load(); expect(tiles()[0]).toMatchObject({ ready: false, url: '' }); call('previewEvidence', event()); expect(wx.previewMedia).not.toHaveBeenCalled(); });
test('opens the exact slot example and clears it on hide', async () => { await load(); call('showExample', event('inspection:1')); expect(page.data['example']).toMatchObject({ example: origin + '/return-examples/inspection.mp4', instruction: '拍清设备与配件' }); call('onHide'); expect(page.data['example']).toBeNull(); call('showExample', event()); expect(page.data['example']).toBeNull(); });

test('example checklist preserves the frozen instruction and additional order-specific steps without uploading', async () => {
  const r=returned(); r.evidence_slots[1]!.slot.instruction='连续展示拍照、闪光灯、视频录制、照片与视频回放。另需展示本单序列号。示例时长不作为上传时长限制。';
  m.returned.mockReturnValue(handle(r)); await load(); call('showExample',event('inspection:1'));
  expect((page.data['exampleSteps'] as {label:string}[]).map(v=>v.label)).toEqual(['拍照','闪光灯','视频录制','照片与视频回放','另需展示本单序列号']);
  expect(m.save).not.toHaveBeenCalled(); expect(m.chooser).not.toHaveBeenCalled();
  call('closeExample'); expect(page.data['exampleSteps']).toEqual([]);
});
test.each([false, true])('cabinet selection requires server pre-return completeness=%s', async complete => { const r = returned(); r.pre_return_complete = complete; m.returned.mockReturnValue(handle(r)); await load(); call('openCabinet'); expect(wx.navigateTo).toHaveBeenCalledTimes(complete ? 1 : 0); if (complete) expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinets/index?mode=return&orderId=o' })); });
test.each(['UNKNOWN', 'SUCCEEDED', 'AWAITING_CONFIRMATION', 'ANOMALY'])('resumes original %s task without another reservation', async status => { const r = returned(); r.pre_return_complete = true; r.cabinet_task = { task_id: 'original', status }; m.returned.mockReturnValue(handle(r)); await load(); call('openCabinet'); expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/cabinet-return/index?orderId=o' })); });
test('pending save is single flight and blocks forward navigation; refresh remains read only', async () => { await load(); const pending = deferred<unknown>(); m.save.mockReturnValue(pending.promise); const first = call('selectEvidence', event()); await vi.waitFor(() => expect(m.save).toHaveBeenCalledOnce()); const duplicate = call('selectEvidence', event()); call('openCabinet'); await call('refresh'); expect(wx.navigateTo).not.toHaveBeenCalled(); expect(m.save).toHaveBeenCalledOnce(); expect(page.data['busy']).toBe(true); pending.resolve({ value: returned(), etag: '"RETURN:cg:2"' }); await Promise.all([first, duplicate]); expect(page.data['busy']).toBe(false); });
test('unknown save preserves the selected file and requires explicit recovery without a new picker', async () => { await load(); m.save.mockRejectedValueOnce(new Error('结果待核实')); await call('selectEvidence', event()); expect(page.data['pendingCount']).toBe(1); await call('selectEvidence', event()); expect(m.chooser).toHaveBeenCalledOnce(); await call('recoverEvidence', event()); expect(m.save.mock.calls[1]?.[1]).toBe(m.save.mock.calls[0]?.[1]); expect(m.save.mock.calls[1]?.[2]).toMatchObject({ recovery: true }); });
test.each(['PROCESSING', 'UNKNOWN', 'FAILED'])('keeps %s upload visible and unbound, without counting it as saved', async phase => { await load(); m.save.mockImplementationOnce(async (_: string, d: RentalEvidenceDraft, o: { changed: () => void }) => { d.intent.phase = phase as RentalEvidenceDraft['intent']['phase']; d.intent.error = '待处理'; o.changed(); throw new Error('待处理'); }); await call('selectEvidence', event()); expect(tiles()[0]).toMatchObject({ pending: true, ready: false, failed: phase === 'FAILED' }); expect(page.data['readyCount']).toBe(0); call('openCabinet'); expect(wx.navigateTo).not.toHaveBeenCalled(); });
test('definite upload failure can be replaced without dropping another slot draft', async () => { await load(); m.save.mockImplementationOnce(async (_: string, d: RentalEvidenceDraft, o: { changed: () => void }) => { d.intent.phase = 'FAILED'; o.changed(); throw new Error('格式不支持'); }); await call('selectEvidence', event()); await call('selectEvidence', event()); expect(m.chooser).toHaveBeenCalledTimes(2); expect(page.data['pendingCount']).toBe(0); });
test('confirmed/final server lock prevents replacement', async () => { const r = returned(); r.evidence_slots.forEach(v => { v.editable = false; }); m.returned.mockReturnValue(handle(r)); await load(); await call('selectEvidence', event()); expect(m.chooser).not.toHaveBeenCalled(); });
test.each(['COMPLETED', 'CLOSED'])('terminal %s order shows all saved return stages and never resumes a stale draft or cabinet flow', async stage => {
  await load(); m.save.mockRejectedValueOnce(new Error('原上传结果待核实')); await call('selectEvidence', event());
  expect(page.data['pendingCount']).toBe(1);
  const o = order(), r = returned(); Object.assign(o.order, { stage, physical_status: 'RECEIVED' });
  r.pre_return_complete = true; r.received_at = '2026-10-09T06:00:00Z';
  r.evidence_slots.forEach((v, i) => { v.complete = true; v.editable = false; v.items = [evidence(i === 1 ? 'VIDEO' : 'PHOTO', 'saved-' + i)]; });
  r.cabinet_task = { task_id: 'original', status: 'SUCCEEDED' };
  m.get.mockReturnValue(handle(o)); m.returned.mockReturnValue(handle(r)); await call('refresh');
  expect(page.data).toMatchObject({ recordOnly: true, canProceed: false, canStart: false, canShip: false, canCorrect: false, pendingCount: 0 });
  expect(tiles().map(v => v.key)).toEqual(['front:1', 'inspection:1', 'in-cabinet:1']);
  expect(tiles()).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'front:1', draftPreview: '', pending: false, editable: false, url: origin + '/saved-0.jpg' })]));
  m.chooser.mockClear(); m.save.mockClear(); m.persist.mockClear();
  await call('selectEvidence', event()); await call('recoverEvidence', event()); await call('saveDraft', 'front:1', true); await call('start'); call('openCabinet');
  expect(m.chooser).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
  call('previewEvidence', event('in-cabinet:1')); expect(wx.previewMedia).toHaveBeenCalledWith(expect.objectContaining({ sources: [expect.objectContaining({ url: origin + '/saved-2.jpg' })] }));
  call('onHide'); expect(page.data).toMatchObject({ loaded: false, recordOnly: false, tiles: [] });
});
test('terminal express return ignores stale shipment permissions and exposes only original tracking', async () => {
  const o = order(), r = returned(); Object.assign(o.order, { stage: 'COMPLETED' }); o.delivery.method = 'EXPRESS'; r.method = 'EXPRESS';
  Object.assign(r, { tracking_no: 'original-waybill', carrier: '顺丰', allowed_actions: [{ action_code: 'SHIP_RETURN', allowed: true }, { action_code: 'CORRECT_RETURN_SHIPMENT', allowed: true }] });
  m.get.mockReturnValue(handle(o)); m.returned.mockReturnValue(handle(r)); await load('AFTER_OPEN');
  expect(page.data).toMatchObject({ recordOnly: true, canShip: false, canCorrect: false, tracking: 'original-waybill', carrier: '顺丰' });
  call('input', { currentTarget: { dataset: { field: 'tracking' } }, detail: { value: 'changed' } }); call('confirmAddress'); await call('saveShipment');
  expect(page.data['tracking']).toBe('original-waybill'); expect(m.shipment).not.toHaveBeenCalled(); expect(m.correct).not.toHaveBeenCalled();
});
test('completed cabinet record with complete evidence cannot select a cabinet; direct entry returns to this order', async () => {
  const o = order(), r = returned(); Object.assign(o.order, { stage: 'COMPLETED' }); r.pre_return_complete = true;
  m.get.mockReturnValue(handle(o)); m.returned.mockReturnValue(handle(r)); await load('AFTER_OPEN');
  expect(page.data).toMatchObject({ recordOnly: true, canProceed: false }); call('openCabinet'); expect(wx.navigateTo).not.toHaveBeenCalled();
  vi.mocked(wx.navigateBack).mockImplementationOnce(options => { options?.fail?.({ errMsg: 'no previous page' }); });
  const redirect = vi.fn(); Object.assign(wx, { redirectTo: redirect }); call('returnToOrder');
  expect(redirect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/pages/order-detail/index?id=o' }));
  m.owner = 'another'; call('returnToOrder'); expect(redirect).toHaveBeenCalledTimes(1);
});
test('completion received while the picker is open prevents a late file from uploading or changing the record', async () => {
  await load(); const pending = deferred<string[]>(); m.chooser.mockReturnValueOnce(pending.promise);
  const picking = call('selectEvidence', event()); await vi.waitFor(() => expect(m.chooser).toHaveBeenCalledOnce());
  const o = order(); Object.assign(o.order, { stage: 'COMPLETED' }); m.get.mockReturnValue(handle(o)); await call('refresh');
  pending.resolve(['late-local-photo']); await picking;
  expect(page.data).toMatchObject({ recordOnly: true, busy: false, pendingCount: 0 }); expect(m.save).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
});
test('a terminal refresh closes an already-open capture example', async () => {
  await load(); call('showExample', event()); expect(page.data['example']).not.toBeNull();
  const o = order(); Object.assign(o.order, { stage: 'COMPLETED' }); m.get.mockReturnValue(handle(o)); await call('refresh');
  expect(page.data).toMatchObject({ recordOnly: true, example: null, exampleSteps: [] });
  await call('selectExample', { currentTarget: { dataset: { source: 'camera' } } }); expect(m.chooser).not.toHaveBeenCalled();
});
test('server locked slot cannot recover a pending upload even before order completion', async () => {
  await load(); m.save.mockRejectedValueOnce(new Error('原保存待核实')); await call('selectEvidence', event());
  const r = returned(); r.evidence_slots.forEach(v => { v.editable = false; }); m.returned.mockReturnValue(handle(r)); await call('refresh'); m.save.mockClear();
  await call('recoverEvidence', event()); await call('saveDraft', 'front:1', true); expect(m.save).not.toHaveBeenCalled();
});
test.each([null, '2026-10-08T00:00:00Z'])('AFTER_OPEN stage uses album after door closed and requires post-receipt reason=%s', async received => { const r = returned(); r.received_at = received; r.evidence_slots[2]!.editable = true; r.cabinet_task = { door_status: 'CLOSED' }; m.returned.mockReturnValue(handle(r)); await load('AFTER_OPEN'); await call('selectEvidence', event('in-cabinet:1')); expect(m.chooser).toHaveBeenCalledWith('image', 1, ['album'], expect.any(Function), expect.any(Function)); expect(m.save.mock.calls[0]?.[1]).toMatchObject({ reason: received ? '补拍设备' : null }); });
test('empty post-receipt reason does not start an upload', async () => { const r = returned(); r.received_at = '2026-10-08T00:00:00Z'; m.returned.mockReturnValue(handle(r)); await load(); vi.mocked(wx.showModal).mockResolvedValueOnce({ confirm: true, cancel: false, content: '  ', errMsg: '' }); await call('selectEvidence', event()); expect(m.chooser).not.toHaveBeenCalled(); expect(page.data['errorText']).toContain('原因'); });
test.each(['order', 'return'])('rejects a mismatched %s record before commands', async which => { const o = order(), r = returned(); if (which === 'order') o.order.order_id = 'foreign'; else r.return_id = 'foreign'; m.get.mockReturnValue(handle(o)); m.returned.mockReturnValue(handle(r)); await load(); expect(page.data).toMatchObject({ loaded: false, canStart: false, canProceed: false }); expect(page.data['errorText']).toContain('不匹配'); await call('selectEvidence', event()); expect(m.save).not.toHaveBeenCalled(); });
test('late upload cannot repaint hidden page or persist under a new account', async () => { await load(); const pending = deferred<unknown>(); m.save.mockReturnValue(pending.promise); const first = call('selectEvidence', event()); await vi.waitFor(() => expect(m.save).toHaveBeenCalledOnce()); call('onHide'); m.owner = 'other'; call('onShow'); await call('refresh'); const snapshot = structuredClone(page.data), count = m.persist.mock.calls.length; pending.resolve({ value: returned(), etag: '"RETURN:cg:2"' }); await first; expect(page.data).toEqual(snapshot); expect(m.persist).toHaveBeenCalledTimes(count); });
test('personal shipment uses the latest confirmed address and clears private draft on account switch', async () => { const r = expressReturn(); m.returned.mockReturnValue(handle(r)); await load(); call('confirmAddress'); Object.assign(page.data, { tracking: '001Ab', carrier: '顺丰' }); r.address_version = '2'; m.returned.mockReturnValue(handle(r, '"RETURN:cg:2"')); await call('refresh'); expect(page.data['addressConfirmed']).toBe(false); await call('saveShipment'); expect(m.shipment).not.toHaveBeenCalled(); call('confirmAddress'); await call('saveShipment'); expect(m.shipment).toHaveBeenCalledWith('o', { tracking_no: '001Ab', carrier: '顺丰', confirmed_address_version: '2' }, '"RETURN:cg:2"'); call('onHide'); m.owner = 'another'; call('onShow'); await call('refresh'); expect(page.data).toMatchObject({ tracking: '', carrier: '', correctionReason: '', addressConfirmed: false }); });
test('version conflict retains slot draft and error until an explicit retry', async () => { await load(); m.save.mockRejectedValueOnce(new Error('归还版本已更新')); await call('selectEvidence', event()); expect(page.data['errorText']).toContain('版本已更新'); expect(page.data['pendingCount']).toBe(1); expect(m.save).toHaveBeenCalledOnce(); await call('refresh'); expect(m.save).toHaveBeenCalledOnce(); await call('recoverEvidence', event()); expect(m.save).toHaveBeenCalledTimes(2); });
test('required re-shoot copy names the frozen slot and reason', async () => { const r = returned(); r.missing_items = [{ slot_key: 'front', item_no: 1, reason: '请拍清划痕' }]; m.returned.mockReturnValue(handle(r)); await load(); expect(page.data['missing']).toEqual([{ key: 'front:1', text: '外观照片：请拍清划痕' }]); expect(m.start).not.toHaveBeenCalled(); });

async function loadPickerPage(name: 'return-submit' | 'cabinet-return') {
  const r = returned(); r.evidence_slots.forEach(v => { v.editable = true; });
  m.returned.mockReturnValue(handle(r));
  m.get.mockReturnValue(handle({ ...order(), latest_cabinet_tasks: [] }));
  await load('PRE_RETURN', name);
  return name === 'cabinet-return' ? 'in-cabinet:1' : 'front:1';
}
const pickerPages = ['return-submit', 'cabinet-return'] as const;
test.each(pickerPages.flatMap(name => [false, true].map(showFirst => ({ name, showFirst }))))('$name native picker survives hide/show with showFirst=$showFirst and uploads once', async ({ name, showFirst }) => {
  const key = await loadPickerPage(name), pending = deferred<string[]>();
  m.chooser.mockReturnValueOnce(pending.promise);
  const picking = call('selectEvidence', event(key));
  await vi.waitFor(() => expect(m.chooser).toHaveBeenCalledOnce());
  call('onHide');
  expect(page.data).toMatchObject({ loaded: true, busy: true });
  expect((m.chooser.mock.calls[0]?.[3] as () => boolean)()).toBe(true);
  if (showFirst) call('onShow');
  pending.resolve(['selected-native-file']); await picking;
  if (!showFirst) call('onShow');
  expect(m.save).toHaveBeenCalledOnce();
  expect(m.save.mock.calls[0]?.[1]).toMatchObject({ slotKey: key.split(':')[0], intent: { file: 'selected-native-file' } });
  expect(page.data['busy']).toBe(false);
  call('onHide');
  expect(page.data['loaded']).toBe(false);
});
test.each(pickerPages.flatMap(name => ['cancel', 'failure', 'unload', 'account'].map(boundary => ({ name, boundary }))))('$name native picker handles $boundary without uploading a stale file', async ({ name, boundary }) => {
  const key = await loadPickerPage(name), pending = deferred<string[]>();
  m.chooser.mockReturnValueOnce(pending.promise);
  const picking = call('selectEvidence', event(key));
  await vi.waitFor(() => expect(m.chooser).toHaveBeenCalledOnce());
  call('onHide');
  if (boundary === 'unload') call('onUnload');
  else if (boundary === 'account') { m.owner = 'another'; call('onShow'); await call('refresh'); }
  else call('onShow');
  if (boundary === 'failure') pending.reject(new Error('选图失败'));
  else pending.resolve(boundary === 'cancel' ? [] : ['private-late-file']);
  await picking;
  expect(m.save).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  if (boundary === 'failure') expect(page.data['errorText']).toContain('选图失败');
  if (boundary !== 'unload') expect(page.data['busy']).toBe(false);
});

function cabinetTask(status = 'AWAITING_CONFIRMATION', door = 'CLOSED', rfid = 'MATCH') { return { task_id: 'original-return', order_id: 'o', purpose: 'RETURN', status, door_status: door, rfid_result: rfid, allowed_actions: [{ action_code: 'CONFIRM_RETURN', allowed: status === 'AWAITING_CONFIRMATION' }], blockers: [] }; }
async function loadPollingPage(status = 'AWAITING_CONFIRMATION', door = 'CLOSED', rfid = 'MATCH') {
  vi.useFakeTimers();
  m.get.mockReturnValue(handle({ ...order(), latest_cabinet_tasks: [{ task_id: 'original-return', purpose: 'RETURN' }] }));
  m.task.mockReturnValue(handle(cabinetTask(status, door, rfid), '"TASK:old"'));
  m.confirmCabinetReturn.mockReturnValue(handle(cabinetTask('VERIFYING')));
  await load('AFTER_OPEN', 'cabinet-return');
}
test('closed matching return stops polling until explicit confirmation without declaring success', async () => {
  await loadPollingPage(); const reads = m.get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(20_000);
  expect(m.get).toHaveBeenCalledTimes(reads); expect(m.confirmCabinetReturn).not.toHaveBeenCalled();
  expect(page.data).toMatchObject({ loading: false, canConfirm: true, taskStatus: 'AWAITING_CONFIRMATION' });
});
test.each([['AWAITING_CONFIRMATION', 'OPEN', 'NOT_OBSERVED'], ['AWAITING_CONFIRMATION', 'CLOSED', 'MISMATCH'], ['VERIFYING', 'CLOSED', 'MATCH']])('polls %s/%s/%s silently and does not rebind unchanged evidence', async (status, door, rfid) => {
  await loadPollingPage(status, door, rfid); const read = deferred<unknown>(), originalTiles = page.data['tiles'], patches = vi.spyOn(page, 'setData');
  m.get.mockReturnValueOnce({ promise: read.promise }); await vi.advanceTimersByTimeAsync(2000);
  expect(page.data).toMatchObject({ loaded: true, loading: false, busy: false }); expect(page.data['tiles']).toBe(originalTiles); expect(patches).not.toHaveBeenCalled();
  read.resolve({ value: { ...order(), latest_cabinet_tasks: [{ task_id: 'original-return', purpose: 'RETURN' }] }, etag: '"ORDER:1"' });
  await vi.advanceTimersByTimeAsync(0); expect(patches).not.toHaveBeenCalled();
});
test('poll only updates changed cabinet facts, then stops when ready for confirmation', async () => {
  await loadPollingPage('AWAITING_CONFIRMATION', 'OPEN', 'NOT_OBSERVED'); const patches = vi.spyOn(page, 'setData');
  m.task.mockReturnValue(handle(cabinetTask())); await vi.advanceTimersByTimeAsync(2000);
  expect(page.data).toMatchObject({ door: '已关闭', rfid: '标签一致', canConfirm: true });
  expect(patches.mock.calls.every(([p]) => !('loading' in p) && !('tiles' in p))).toBe(true);
  const reads = m.task.mock.calls.length; await vi.advanceTimersByTimeAsync(10_000); expect(m.task).toHaveBeenCalledTimes(reads);
});
test.each(['SUCCEEDED', 'ANOMALY', 'FAILED_CONFIRMED', 'CANCELLED'])('terminal %s does not keep polling', async status => {
  await loadPollingPage(status); const reads = m.task.mock.calls.length; await vi.advanceTimersByTimeAsync(20_000); expect(m.task).toHaveBeenCalledTimes(reads);
});
test('confirmation rereads original task after the native modal and submits only the fresh ETag', async () => {
  await loadPollingPage(); const modal = deferred<WechatMiniprogram.ShowModalSuccessCallbackResult>(); vi.mocked(wx.showModal).mockReturnValueOnce(modal.promise);
  const confirmation = call('confirmReturn'); await vi.advanceTimersByTimeAsync(0);
  m.task.mockReturnValue(handle(cabinetTask(), '"TASK:latest"')); await vi.advanceTimersByTimeAsync(30_000);
  expect(m.confirmCabinetReturn).not.toHaveBeenCalled(); modal.resolve({ confirm: true, cancel: false, content: '', errMsg: '' }); await confirmation;
  expect(m.confirmCabinetReturn).toHaveBeenCalledExactlyOnceWith('original-return', '"TASK:latest"');
});
test.each(['different-task', 'different-order', 'different-purpose', 'door-open', 'unavailable', 'completed'])('fresh %s does not dispatch a stale confirmation', async boundary => {
  await loadPollingPage(); const latest = cabinetTask();
  if (boundary === 'different-task') latest.task_id = 'foreign';
  if (boundary === 'different-order') latest.order_id = 'foreign';
  if (boundary === 'different-purpose') latest.purpose = 'PICKUP';
  if (boundary === 'door-open') latest.door_status = 'OPEN';
  if (boundary === 'unavailable') latest.allowed_actions = [];
  if (boundary === 'completed') latest.status = 'SUCCEEDED';
  m.task.mockReturnValue(handle(latest)); await call('confirmReturn'); expect(m.confirmCabinetReturn).not.toHaveBeenCalled(); expect(page.data['busy']).toBe(false);
});
test('412 confirmation shows actionable feedback and rereads without replaying the write', async () => {
  await loadPollingPage(); m.confirmCabinetReturn.mockReturnValueOnce({ promise: Promise.reject(Object.assign(new Error('前置条件不成立'), { statusCode: 412 })) });
  await call('confirmReturn'); expect(page.data['errorText']).toBe('柜机状态刚刚更新，请核对后再次确认归还');
  await vi.advanceTimersByTimeAsync(10_000); expect(m.confirmCabinetReturn).toHaveBeenCalledOnce();
});
test.each(['hide', 'account'])('late confirmation preflight after %s never sends a command', async boundary => {
  await loadPollingPage(); const read = deferred<unknown>(); m.task.mockReturnValueOnce({ promise: read.promise }); const confirmation = call('confirmReturn'); await vi.advanceTimersByTimeAsync(0);
  if (boundary === 'hide') call('onHide'); else m.owner = 'another';
  read.resolve({ value: cabinetTask(), etag: '"TASK:latest"' }); await confirmation; expect(m.confirmCabinetReturn).not.toHaveBeenCalled();
});

test('lessor active receipt is always read only even if a stale slot says editable', async () => {
  const o = order(), r = returned(); o.order.viewer_role = 'LESSOR'; r.received_at = '2026-10-08T04:00:00Z'; r.evidence_slots[0]!.items = [evidence()];
  m.get.mockReturnValue(handle(o)); m.returned.mockReturnValue(handle(r)); await load();
  expect(page.data).toMatchObject({ recordOnly: true, supplementing: false, canProceed: false });
  await call('selectEvidence', event()); await call('recoverEvidence', event()); call('openCabinet');
  expect(m.chooser).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled(); expect(wx.navigateTo).not.toHaveBeenCalled();
});
test('tenant record entry hides drafts and previews only server history while leaving stored drafts intact', async () => {
  const r = returned(); Object.assign(r, { evidence_history: [{ ...evidence('VIDEO', 'old-video'), slot_key: 'inspection', revision_no: 1, is_current: false, created_at: '2026-10-07T00:00:00Z', reason: '旧版视频' }] });
  m.returned.mockReturnValue(handle(r)); await load('PRE_RETURN', 'return-submit', 'record');
  expect(page.data).toMatchObject({ recordOnly: true, pendingCount: 0, history: [expect.objectContaining({ id: 'e-old-video', title: '验机视频 · 第1版', reason: '旧版视频' })] });
  call('previewHistory', { currentTarget: { dataset: { id: 'e-old-video' } } }); expect(wx.previewMedia).toHaveBeenCalledWith(expect.objectContaining({ sources: [expect.objectContaining({ url: origin + '/old-video.mp4', poster: origin + '/own-poster.jpg' })] }));
  await call('selectEvidence', event()); expect(m.chooser).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  call('onHide'); expect(page.data['history']).toEqual([]);
});
test('unavailable or mismatched history media never exposes a URL', async () => {
  const r = returned(), old = evidence(); old.media.material_id = 'another'; Object.assign(r, { evidence_history: [{ ...old, slot_key: 'front', revision_no: 1, is_current: false, created_at: '2026-10-07T00:00:00Z' }] });
  m.returned.mockReturnValue(handle(r)); await load('PRE_RETURN', 'return-submit', 'record');
  expect(page.data['history']).toEqual([expect.objectContaining({ url: '' })]); call('previewHistory', { currentTarget: { dataset: { id: old.evidence_id } } }); expect(wx.previewMedia).not.toHaveBeenCalled();
});
test('received supplementary entry includes both stages, puts the missing slot first and cannot reopen a cabinet', async () => {
  const r = returned(); r.received_at = '2026-10-08T04:00:00Z'; r.pre_return_complete = true; r.missing_items = [{ slot_key: 'in-cabinet', item_no: 1, reason: '照片模糊' }]; r.evidence_slots[2]!.editable = true;
  m.returned.mockReturnValue(handle(r)); await load('PRE_RETURN', 'return-submit', 'supplement');
  expect(page.data).toMatchObject({ recordOnly: false, supplementing: true, canProceed: false, focusKey: 'in-cabinet:1' }); expect(tiles().map(item => item.key)).toEqual(['in-cabinet:1', 'front:1', 'inspection:1']);
  call('openCabinet'); expect(wx.navigateTo).not.toHaveBeenCalled();
  m.save.mockImplementationOnce(async () => { throw new Error('原上传结果未知'); }); await call('selectEvidence', event('in-cabinet:1'));
  expect(page.data['pendingCount']).toBe(1); expect(page.data['missing']).toHaveLength(1); expect(m.save).toHaveBeenCalledWith('o', expect.objectContaining({ slotKey: 'in-cabinet', reason: '补拍设备' }), expect.anything());
});
