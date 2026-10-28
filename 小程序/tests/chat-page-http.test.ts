import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { orderConversationApi, type OrderConversation, type OrderMessage, type OrderMessageCreate, type MessageIntent } from '../miniprogram/shared/api/order-conversation-api';

type MessageView = { id: string; sequence: string; timeText: string };
type PageData = { messages: MessageView[]; pending: MessageIntent | null; content: string; canSend: boolean; canPost: boolean; loaded: boolean; unavailable: boolean; errorText: string; imageReady: boolean; imageSrc: string; imageConfirmation: boolean; canRetryOriginal: boolean; title: string; hasMore: boolean; };
interface Harness { data: PageData; setData(value: Record<string, unknown>, callback?: () => void): void; [key: string]: unknown }
interface Wire { url: string; method: string; data: OrderMessageCreate & { through_sequence: string }; header: Record<string, string>; success(value: { statusCode: number; data: unknown; header: Record<string, string> }): void; fail(value: { errMsg: string }): void }
type Observation = { intersectionRatio: number; dataset: Record<string, string> };
let definition: Harness, page: Harness, owner: string | null;
const storage = new Map<string, unknown>();
const request = vi.fn(), back = vi.fn(), navigate = vi.fn(), scroll = vi.fn(), chooseMedia = vi.fn(), uploadFile = vi.fn();
let route: (value: Wire) => void, observe: ((value: Observation) => void) | null;
const requests: Wire[] = [];
const conversation = (): OrderConversation => ({
  conversation_id: 'conv-1', context_kind: 'ORDER', order_id: 'order-1', viewer_role: 'TENANT',
  peer: { account_id: 'peer', display_name: '出租者', avatar_url: null, role: 'LESSOR' },
  order_summary: { order_id: 'order-1', order_no: 'R001', asset_title: '测试相机', cover_url: null, display_status_code: 'IN_USE', rental_start_at: '2026-10-09T00:00:00Z', rental_end_at: '2026-10-10T16:00:00Z' },
  last_message: null, last_message_at: null, read_sequence: '0', unread_count: '1', can_post: true, blocked_reason: null, version: '1',
});
const message = (sequence = '1', sender = 'peer'): OrderMessage => ({ message_id: 'msg-' + sequence, sequence, client_message_id: 'intent-fixture-' + sequence, sender_id: sender, kind: 'TEXT', body: '已入库消息', media: null, sent_at: '2026-10-09T01:00:00Z' });
const ok = (options: Wire, data: unknown, statusCode = 200) => options.success({ statusCode, data, header: {} });
const fail = (options: Wire, code = 'VALIDATION_FAILED', statusCode = 422) => ok(options, { code, message: '请求被拒绝', request_id: 'fixture' }, statusCode);
const pageResult = (items = [message()], extra: object = {}) => ({ conversation: conversation(), items, has_more: false, next_before_sequence: null, next_after_sequence: null, last_sequence: items[items.length - 1]?.sequence ?? '0', ...extra });
function call(name: string, ...args: unknown[]) { return (page[name] as (...values: unknown[]) => unknown).apply(page, args); }
function input(text: string) { call('inputMessage', { detail: { value: text } }); }
function messagesPosts() { return requests.filter(value => value.method === 'POST' && /\/messages$/.test(value.url)); }

beforeAll(async () => {
  vi.stubGlobal('Page', (value: Harness) => { definition = value; });
  await import('../miniprogram/pages/chat/index');
});
beforeEach(() => {
  owner = 'owner'; storage.clear(); requests.length = 0; observe = null;
  for (const spy of [request, back, navigate, scroll, chooseMedia, uploadFile]) spy.mockReset();
  route = options => {
    if (/\/conversation$/.test(options.url)) ok(options, conversation());
    else if (/\/messages\?/.test(options.url)) ok(options, pageResult());
    else if (/\/read-cursor$/.test(options.url)) ok(options, { read_sequence: options.data.through_sequence, unread_count: '0' });
    else throw new Error('Unexpected request ' + options.url);
  };
  request.mockImplementation(options => { requests.push(options); route(options); return { abort: vi.fn() }; });
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' && owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60_000 } : storage.has(key) ? structuredClone(storage.get(key)) : '',
    setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)), removeStorageSync: (key: string) => { if (key === 'xingyu.api-session.v1') owner = null; else storage.delete(key); },
    request, navigateTo: navigate, navigateBack: back, switchTab: vi.fn(), pageScrollTo: scroll, chooseMedia, uploadFile,
    showModal: (value: { success(result: { confirm: boolean }): void }) => value.success({ confirm: true }), stopPullDownRefresh: vi.fn(),
    getFileSystemManager: () => ({ removeSavedFile: vi.fn() }),
  });
  page = { ...definition, data: structuredClone(definition.data), setData(value, cb) { Object.assign(this.data, value); cb?.(); },
    createIntersectionObserver: () => ({ relativeToViewport() { return this; }, observe(_selector: string, callback: (value: Observation) => void) { observe = callback; }, disconnect: vi.fn() }),
  };
  call('onLoad', { mode: 'c2c', orderId: 'order-1', conversationId: 'conv-1' });
});
afterEach(() => { call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());

test('entry with an existing conversation only reads, does not create or mark unseen messages', async () => {
  await call('onShow');
  expect(page.data).toMatchObject({ loaded: true, title: '出租者 · 出租方', canSend: false, canPost: true });
  expect(requests.every(value => value.method === 'GET')).toBe(true);
  expect(page.data.messages[0]!.timeText).toBe('2026-10-09 09:00');
  expect(page.data).toMatchObject({ order: { rentalPeriod: '2026-10-09 至 2026-10-11' } });
  observe?.({ intersectionRatio: 0.7, dataset: { sequence: '1' } });
  await vi.waitFor(() => expect(requests.filter(value => value.url.endsWith('/read-cursor'))).toHaveLength(1));
  expect(requests[requests.length - 1]).toMatchObject({ method: 'POST', data: { through_sequence: '1' } });
});
test('the explicit order entry creates only an order-bound empty conversation, never a message', async () => {
  call('onLoad', { mode: 'c2c', orderId: 'order-1' }); await call('onShow');
  expect(requests[0]).toMatchObject({ method: 'POST', data: {}, url: 'http://127.0.0.1:8081/v1/me/rental-orders/order-1/conversation' });
  expect(requests[0]!.header['Idempotency-Key']).toMatch(/^[!-~]{16,64}$/);
  expect(page.data.loaded).toBe(true);
  expect(messagesPosts()).toHaveLength(0);
});
test('an explicit retry of unknown conversation creation retains its original nonempty intent', async () => {
  route = options => options.fail({ errMsg: 'request:fail timeout' });
  await expect(orderConversationApi.ensure('order-1').promise).rejects.toThrow();
  const original = requests[0]!.header['Idempotency-Key'];
  expect(original).toMatch(/^[!-~]{16,64}$/);
  await expect(orderConversationApi.ensure('order-1').promise).rejects.toThrow();
  expect(requests).toHaveLength(2);
  expect(requests[1]!.header['Idempotency-Key']).toBe(original);
  expect(storage.get('xingyu.order-message.v1:ensure:owner:order-1')).toBe(original);
  expect(messagesPosts()).toHaveLength(0);
});
test.each([{ mode: 'support' }, { mode: 'c2c', orderId: 'order/1' }])('invalid or retired route cannot request a custom support conversation', async options => {
  call('onLoad', options); await call('onShow'); input('不能发送'); await call('send');
  expect(request).not.toHaveBeenCalled(); expect(page.data.content).toBe(''); expect(page.data.unavailable).toBe(true);
});
test('text counts Unicode points; blank is disabled; duplicate clicks produce one POST', async () => {
  await call('onShow'); input('  '); expect(page.data.canSend).toBe(false);
  input('😀'.repeat(501)); expect([...page.data.content]).toHaveLength(500);
  let post!: Wire;
  route = options => { if (options.method === 'POST') post = options; else ok(options, pageResult()); };
  const first = call('send'), duplicate = call('send'); await vi.waitFor(() => expect(messagesPosts()).toHaveLength(1));
  expect(post.data.body).toBe('😀'.repeat(500)); expect(page.data.pending!.phase).toBe('UNKNOWN');
  ok(post, { ...message('2', 'owner'), body: post.data.body, client_message_id: post.data.client_message_id }, 201);
  await Promise.all([first, duplicate]); expect(orderConversationApi.pending('conv-1')).toBeNull(); expect(page.data.content).toBe('');
});
test('a timeout locks the original text, a query recovers it with no second POST', async () => {
  await call('onShow'); input('保持这条消息'); let submitted!: OrderMessageCreate;
  route = options => {
    if (/\/messages$/.test(options.url)) { submitted = options.data; options.fail({ errMsg: 'request:fail timeout' }); }
    else if (options.url.includes('/message-results/')) ok(options, { state: 'APPLIED', message: { ...message('2', 'owner'), body: submitted.body, client_message_id: submitted.client_message_id } });
    else ok(options, pageResult([message(), { ...message('2', 'owner'), body: submitted.body, client_message_id: submitted.client_message_id }]));
  };
  await call('send'); expect(page.data.pending!.phase).toBe('UNKNOWN');
  input('不同内容'); expect(page.data.content).toBe('保持这条消息');
  await call('queryOriginal'); expect(page.data.pending).toBeNull(); expect(messagesPosts()).toHaveLength(1);
  expect(page.data.messages.filter((value: MessageView) => value.id === 'msg-2')).toHaveLength(1);
});
test('NOT_FOUND permits an explicit same-body same-key retry and never auto-sends', async () => {
  await call('onShow'); input('原文'); let first!: Wire;
  route = options => {
    if (/\/messages$/.test(options.url)) { first ??= options; options.fail({ errMsg: 'network unavailable' }); }
    else if (options.url.includes('/message-results/')) ok(options, { state: 'NOT_FOUND', message: null });
    else ok(options, pageResult());
  };
  await call('send'); await call('queryOriginal'); expect(messagesPosts()).toHaveLength(1); expect(page.data.pending!.phase).toBe('NOT_FOUND');
  await call('retryOriginal'); expect(messagesPosts()).toHaveLength(2);
  expect(messagesPosts()[1]!.data).toEqual(first.data); expect(messagesPosts()[1]!.header['Idempotency-Key']).toBe(first.header['Idempotency-Key']);
});
test('a terminal latest page hides history even when the API includes a boundary cursor', async () => {
  route = options => ok(options, pageResult([message('1')], { has_more: false, next_before_sequence: '1' }));
  await call('onShow');
  expect(page.data.hasMore).toBe(false);
  const before = requests.length;
  await call('loadMore');
  expect(requests).toHaveLength(before);
});

test('loading the last history page preserves messages and removes the history action', async () => {
  route = options => ok(options, options.url.includes('before_sequence=')
    ? pageResult([message('1')], { has_more: false, next_before_sequence: '1' })
    : pageResult([message('2')], { has_more: true, next_before_sequence: '2' }));
  await call('onShow');
  expect(page.data.hasMore).toBe(true);
  await call('loadMore');
  expect(page.data.messages.map(value => value.sequence)).toEqual(['1', '2']);
  expect(page.data.hasMore).toBe(false);
  const before = requests.length;
  await call('loadMore');
  expect(requests).toHaveLength(before);
});

test('recovering an old original after reopening keeps one contiguous latest window', async () => {
  await call('onShow'); input('原消息');
  let submitted!: OrderMessageCreate;
  route = options => { submitted = options.data; options.fail({ errMsg: 'timeout' }); };
  await call('send'); call('onHide');
  const latest = Array.from({ length: 30 }, (_, index) => message(String(index + 71)));
  route = options => {
    if (options.url.includes('/message-results/')) ok(options, { state: 'APPLIED', message: { ...message('2', 'owner'), body: submitted.body, client_message_id: submitted.client_message_id } });
    else if (options.url.includes('before_sequence=')) ok(options, pageResult([message('70')], { has_more: true, next_before_sequence: '70' }));
    else ok(options, pageResult(latest, { has_more: true, next_before_sequence: '71' }));
  };
  await call('onShow'); expect(page.data.pending).toBeNull();
  expect(page.data.messages.map(value => value.sequence)).toEqual(latest.map(value => value.sequence));
  await call('loadMore'); expect(requests[requests.length - 1]!.url).toContain('before_sequence=71');
  expect(page.data.messages[0]!.sequence).toBe('70'); expect(messagesPosts()).toHaveLength(1);
});
test('an acknowledged send with a failed reload cannot append across unseen messages', async () => {
  await call('onShow'); input('新消息');
  route = options => {
    if (options.method === 'POST') ok(options, { ...message('100', 'owner'), body: options.data.body, client_message_id: options.data.client_message_id }, 201);
    else options.fail({ errMsg: 'read timeout' });
  };
  await call('send');
  expect(page.data.pending).toBeNull(); expect(page.data.messages.map(value => value.sequence)).toEqual(['1']);
  expect(page.data).toMatchObject({ content: '', deliveryText: '消息已发送，刷新后可在记录中查看' });
  expect(page.data.errorText).not.toBe('');
});
test('explicit rejection may return to editing, but idempotency conflict stays uncertain', async () => {
  await call('onShow'); input('待改内容'); route = options => fail(options);
  await call('send'); expect(page.data.pending!.phase).toBe('FAILED'); call('discardFailed'); expect(page.data.pending).toBeNull(); expect(page.data.content).toBe('待改内容');
  route = options => fail(options, 'IDEMPOTENCY_CONFLICT', 409);
  await call('send'); expect(page.data.pending!.phase).toBe('UNKNOWN'); call('discardFailed'); expect(page.data.pending).not.toBeNull();
});
test('server readonly preserves history and stops new text and image sends', async () => {
  route = options => ok(options, pageResult([message()], { conversation: { ...conversation(), can_post: false, blocked_reason: 'ORDER_TERMINAL' } }));
  await call('onShow'); input('无法新发'); await call('send'); await call('chooseImage');
  expect(page.data).toMatchObject({ readonly: true, canPost: false, canSend: false, content: '' }); expect(page.data.messages).toHaveLength(1);
  expect(chooseMedia).not.toHaveBeenCalled(); expect(messagesPosts()).toHaveLength(0);
});

test.each([403,422])('confirmed rejection %i cannot blindly retry the same rejected message', async status => {
  await call('onShow'); input('需要修改'); route = options => fail(options, 'VALIDATION_FAILED', status);
  await call('send'); expect(page.data.pending?.phase).toBe('FAILED'); expect(page.data.canRetryOriginal).toBe(false);
  await call('retryOriginal'); expect(messagesPosts()).toHaveLength(1);
});

test('a NOT_FOUND original cannot retry after the server makes the conversation readonly', async () => {
  await call('onShow'); input('原文'); route = options => options.fail({ errMsg: 'timeout' }); await call('send');
  route = options => options.url.includes('/message-results/') ? ok(options, { state: 'NOT_FOUND', message: null }) : ok(options, pageResult([], { conversation: { ...conversation(), can_post: false, blocked_reason: 'ORDER_TERMINAL' } }));
  await call('queryOriginal'); await call('refresh'); expect(page.data.pending?.phase).toBe('NOT_FOUND'); expect(page.data.canRetryOriginal).toBe(false);
  await call('retryOriginal'); expect(messagesPosts()).toHaveLength(1);
});
test('earlier pages prepend and retain their anchor without rounding BIGINT sequences', async () => {
  route = options => ok(options, options.url.includes('before_sequence=') ? pageResult([message('9007199254740991')]) : pageResult([message('9007199254740992'), message('9007199254740993')], { next_before_sequence: '9007199254740992', has_more: true }));
  await call('onShow'); await call('loadMore');
  expect(page.data.messages.map((value: MessageView) => value.sequence)).toEqual(['9007199254740991', '9007199254740992', '9007199254740993']);
  expect(scroll).toHaveBeenCalledWith({ selector: '#message-9007199254740992', duration: 0 });
});
test('a hidden page cannot resurrect from its delayed response after reopening', async () => {
  let old!: Wire; route = options => { old = options; };
  const pending = call('onShow'); await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
  call('onHide'); route = options => ok(options, pageResult([message('3')]));
  await call('onShow'); ok(old, pageResult([message('1')])); await pending;
  expect(page.data.messages.map((value: MessageView) => value.id)).toEqual(['msg-3']);
  expect(page.data.errorText).toBe('');
});
test('account changes clear ordinary drafts and never recover another account intent', async () => {
  await call('onShow'); input('owner的消息'); route = options => options.fail({ errMsg: 'timeout' }); await call('send');
  call('onHide'); owner = 'other'; route = options => ok(options, pageResult([], { conversation: { ...conversation(), viewer_role: 'LESSOR' } }));
  await call('onShow'); expect(page.data.pending).toBeNull(); expect(page.data.content).toBe('');
  expect(requests.filter(value => value.url.includes('/message-results/'))).toHaveLength(0);
});
test('a mismatched order response cannot disclose messages or enable sending', async () => {
  route = options => ok(options, pageResult([message()], { conversation: { ...conversation(), order_id: 'different-order' } }));
  await call('onShow'); expect(page.data.loaded).toBe(false); expect(page.data.messages).toEqual([]); expect(page.data.canSend).toBe(false);
});
test('reading an empty conversation never writes a read cursor', async () => {
  route = options => ok(options, pageResult([])); await call('onShow');
  expect(page.data.messages).toEqual([]); expect(observe).toBeNull(); expect(requests.every(value => value.method === 'GET')).toBe(true);
});
test('image upload is user-triggered and a ready image still waits for explicit send', async () => {
  await call('onShow');
  chooseMedia.mockImplementation(options => options.success({ tempFiles: [{ tempFilePath: '/temp/image.png', size: 64 }] }));
  const wxValue = wx as unknown as Record<string, unknown>;
  wxValue['getImageInfo'] = (options: { success(value: { type: string; width: number; height: number }): void }) => options.success({ type: 'png', width: 32, height: 24 });
  wxValue['getFileSystemManager'] = () => ({ saveFile: (options: { success(value: { savedFilePath: string }): void }) => options.success({ savedFilePath: '/saved/image.png' }), removeSavedFile: vi.fn() });
  uploadFile.mockImplementation(options => {
    options.success({ statusCode: 201, data: JSON.stringify({ upload_id: 'upload-1', material_id: 'image-1', status: 'READY', public_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/image.png', playback_url: null, mime_type: 'image/png', size_bytes: 64, metadata: null, poster: null }) });
    return { abort: vi.fn(), onProgressUpdate: vi.fn() };
  });
  await call('chooseImage');
  expect(uploadFile).toHaveBeenCalledOnce(); expect(page.data.imageReady).toBe(true); expect(page.data.canSend).toBe(true); expect(messagesPosts()).toHaveLength(0);
  expect(page.data).toMatchObject({ imageConfirmation: true, title: '发送图片' });
  const preview = vi.fn(); wxValue['previewImage'] = preview; call('previewDraftImage');
  expect(preview).toHaveBeenCalledWith({ current: page.data.imageSrc, urls: [page.data.imageSrc] }); expect(messagesPosts()).toHaveLength(0);
  route = options => {
    if (/\/messages$/.test(options.url)) ok(options, { ...message('2', 'owner'), client_message_id: options.data.client_message_id, kind: 'IMAGE', body: null, media: { material_id: 'image-1', url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/image.png', mime_type: 'image/png', width: 32, height: 24 } }, 201);
    else ok(options, pageResult());
  };
  await call('send'); expect(messagesPosts()[0]!.data).toMatchObject({ kind: 'IMAGE', body: null, material_id: 'image-1' }); expect(page.data.imageSrc).toBe('');
  expect(page.data.imageConfirmation).toBe(false);
});

test.each(['removeImage', 'onSecondaryNavigationBack'])('image confirmation %s returns to the conversation without sending or leaving', async action => {
  const slot = 'xingyu.order-chat-image.v1:owner:conv-1';
  storage.set(slot, { owner: 'owner', conversationId: 'conv-1', url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/image.png', upload: { owner: 'owner', field: 'order-message-image', item: 'conv-1', generation: 1, file: '/saved/image.png', key: 'original-image-key', materialClass: 'CHAT_IMAGE', materialId: 'image-1', phase: 'READY', progress: 100, error: '' } });
  await call('onShow'); expect(page.data.imageConfirmation).toBe(true);
  call(action);
  expect(page.data).toMatchObject({ imageConfirmation: false, imageSrc: '', canSend: false }); expect(storage.has(slot)).toBe(false);
  expect(messagesPosts()).toHaveLength(0); expect(back).not.toHaveBeenCalled(); expect(uploadFile).not.toHaveBeenCalled();
});

test.each(['before-show', 'after-show', 'unload', 'account-change', 'readonly', 'cancel'] as const)('native picker lifecycle: %s', async mode => {
  await call('onShow');
  let choice!: { success(value: object): void; fail(value: object): void };
  chooseMedia.mockImplementation(options => { choice = options; });
  const saveFile = vi.fn((options: { success(value: { savedFilePath: string }): void }) => options.success({ savedFilePath: '/saved/lifecycle.png' }));
  const wxValue = wx as unknown as Record<string, unknown>;
  wxValue['getImageInfo'] = (options: { success(value: object): void }) => options.success({ type: 'png', width: 32, height: 24 });
  wxValue['getFileSystemManager'] = () => ({ saveFile, removeSavedFile: vi.fn() });
  uploadFile.mockImplementation(options => {
    options.success({ statusCode: 201, data: JSON.stringify({ upload_id: 'upload-1', material_id: 'image-1', status: 'READY', public_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/test/image.png', playback_url: null, mime_type: 'image/png', size_bytes: 64, metadata: null, poster: null }) });
    return { abort: vi.fn(), onProgressUpdate: vi.fn() };
  });
  const selected = call('chooseImage');
  await vi.waitFor(() => expect(chooseMedia).toHaveBeenCalledOnce());
  call('onHide');
  const choose = () => choice.success({ tempFiles: [{ tempFilePath: '/temp/lifecycle.png', size: 64 }] });
  if (mode === 'before-show') { choose(); await Promise.resolve(); expect(uploadFile).not.toHaveBeenCalled(); }
  if (mode === 'unload') call('onUnload');
  if (mode === 'account-change') owner = 'other';
  if (mode === 'readonly') route = options => ok(options, pageResult([], { conversation: { ...conversation(), can_post: false, blocked_reason: 'ORDER_TERMINAL' } }));
  if (mode !== 'unload') await call('onShow');
  if (mode === 'cancel') choice.fail({ errMsg: 'chooseMedia:fail cancel' });
  else if (mode !== 'before-show') choose();
  await selected;
  if (mode === 'before-show' || mode === 'after-show') {
    expect(uploadFile).toHaveBeenCalledOnce(); expect(page.data.imageReady).toBe(true); expect(page.data.canSend).toBe(true);
  } else { expect(uploadFile).not.toHaveBeenCalled(); expect(saveFile).not.toHaveBeenCalled(); }
  expect(messagesPosts()).toHaveLength(0);
});

test('an expired session clears already visible private messages before any further input', async () => {
  await call('onShow'); expect(page.data.messages).toHaveLength(1);
  route = options => fail(options, 'AUTH_REQUIRED', 401);
  await call('refresh'); expect(page.data.messages).toEqual([]); expect(page.data.loaded).toBe(false); expect(page.data.canPost).toBe(false);
  input('expired draft'); expect(page.data.content).toBe('');
});
test('an expired session during image upload also clears visible private messages', async () => {
  await call('onShow');
  chooseMedia.mockImplementation(options => options.success({ tempFiles: [{ tempFilePath: '/temp/image.png', size: 64 }] }));
  const wxValue = wx as unknown as Record<string, unknown>;
  wxValue['getImageInfo'] = (options: { success(value: { type: string; width: number; height: number }): void }) => options.success({ type: 'png', width: 32, height: 24 });
  wxValue['getFileSystemManager'] = () => ({ saveFile: (options: { success(value: { savedFilePath: string }): void }) => options.success({ savedFilePath: '/saved/image.png' }), removeSavedFile: vi.fn() });
  uploadFile.mockImplementation(options => {
    options.success({ statusCode: 401, data: JSON.stringify({ code: 'AUTH_REQUIRED', message: '请重新登录', request_id: 'fixture' }) });
    return { abort: vi.fn(), onProgressUpdate: vi.fn() };
  });
  await call('chooseImage');
  expect(page.data).toMatchObject({ loaded: false, canPost: false, messages: [], imageSrc: '' });
  input('expired draft'); expect(page.data.content).toBe(''); expect(messagesPosts()).toHaveLength(0);
});
