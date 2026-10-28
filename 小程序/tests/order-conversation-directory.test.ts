import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { OrderConversation, OrderConversationPage } from '../miniprogram/shared/model/order-conversation';
import { readOrderUnread } from '../miniprogram/shared/model/order-unread';

interface Harness { data: { conversations: { id: string }[]; loaded: boolean; loading: boolean; errorText: string; hasMore: boolean }; setData(value: object): void; [key: string]: unknown }
type Wire = { url: string; method: string; success(value: { statusCode: number; data: unknown; header: object }): void; fail(value: { errMsg: string }): void };
let definition: Harness, page: Harness, owner: string | null, route: (wire: Wire) => void;
const requests: Wire[] = [], navigate = vi.fn(), tab = vi.fn();
const conversation = (id: string): OrderConversation => ({
  conversation_id: id, context_kind: 'ORDER', order_id: 'order-' + id, viewer_role: 'TENANT', peer: { account_id: 'peer', role: 'LESSOR', display_name: '出租方姓名', avatar_url: null },
  order_summary: { order_id: 'order-' + id, order_no: 'R1', asset_title: '相机', cover_url: null, display_status_code: 'IN_USE', rental_start_at: '2026-10-09T00:00:00Z', rental_end_at: '2026-10-10T16:00:00Z' },
  last_message: null, last_message_at: null, read_sequence: '0', unread_count: '2', can_post: true, blocked_reason: null, version: '1',
});
function reply(wire: Wire, ids = ['one'], cursor: string | null = null, unread = '2') { wire.success({ statusCode: 200, header: {}, data: { items: ids.map(conversation), next_cursor: cursor, has_more: !!cursor, total_unread_count: unread, as_of_at: '2026-10-09T12:00:00Z' } satisfies OrderConversationPage }); }
function call(name: string, ...args: unknown[]) { return (page[name] as (...values: unknown[]) => unknown).apply(page, args); }
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/info/index'); });
beforeEach(() => {
  owner = 'info-owner'; requests.length = 0; navigate.mockReset(); tab.mockReset(); route = wire => reply(wire);
  vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60_000 } : null,
    request: (wire: Wire) => { requests.push(wire); route(wire); return { abort: vi.fn() }; },
    navigateTo: navigate, switchTab: navigate, stopPullDownRefresh: vi.fn(),
  });
  page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); }, getTabBar: () => ({ setData: tab }) };
  call('onLoad');
});
afterEach(() => call('onUnload'));
afterAll(() => vi.unstubAllGlobals());

test('directory is ORDER-scoped GET only; rows navigate with separate conversation and order identities', async () => {
  await call('onShow');
  expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ method: 'GET', url: 'http://127.0.0.1:8081/v1/me/rental-conversations?context_kind=ORDER&limit=20' });
  call('openConversation', { currentTarget: { dataset: { id: 'one' } } });
  expect(navigate.mock.calls[0]?.[0].url).toBe('/pages/chat/index?mode=c2c&orderId=order-one&conversationId=one');
});
test('unknown dataset IDs never navigate to arbitrary conversations', async () => {
  await call('onShow'); call('openConversation', { currentTarget: { dataset: { id: 'other' } } }); expect(navigate).not.toHaveBeenCalled();
});
test('the empty directory returns to orders once without creating a conversation and ignores hidden clicks', async () => {
  route = wire => reply(wire, [], null, '0'); await call('onShow');
  call('openOrders'); call('openOrders');
  expect(navigate).toHaveBeenCalledOnce(); expect(navigate.mock.calls[0]?.[0].url).toBe('/pages/orders/index');
  expect(requests).toHaveLength(1); expect(requests[0]?.method).toBe('GET');
  call('onHide'); call('openOrders'); expect(navigate).toHaveBeenCalledOnce();
});
test('a successful empty list differs from a failed first read', async () => {
  route = wire => reply(wire, [], null, '0'); await call('onShow'); expect(page.data).toMatchObject({ loaded: true, conversations: [], errorText: '' });
  call('onHide'); owner = 'info-other'; route = wire => wire.fail({ errMsg: 'network error' }); await call('onShow');
  expect(page.data.loaded).toBe(false); expect(page.data.errorText).not.toBe('');
});
test('incremental failure preserves rows, cursor and authoritative unread count', async () => {
  route = wire => reply(wire, ['one'], 'cursor-original', '102'); await call('onShow');
  expect(readOrderUnread()).toBe('102'); route = wire => wire.fail({ errMsg: 'network error' }); await call('loadMore');
  expect(page.data.conversations).toHaveLength(1); expect(page.data.hasMore).toBe(true); expect(readOrderUnread()).toBe('102');
  expect(requests[1]?.url).toContain('cursor=cursor-original');
});
test('a return to a loaded list revalidates its original two-page window', async () => {
  route = wire => wire.url.includes('cursor=') ? reply(wire, ['two']) : reply(wire, ['one'], 'next');
  await call('onShow'); await call('loadMore'); expect(page.data.conversations.map(value => value.id)).toEqual(['one', 'two']);
  call('onHide'); await call('onShow'); expect(page.data.conversations.map(value => value.id)).toEqual(['one', 'two']); expect(requests).toHaveLength(4);
});
test('a delayed response from the previous account cannot render or replace unread facts', async () => {
  let late!: Wire; route = wire => { late = wire; }; const first = call('onShow');
  await vi.waitFor(() => expect(requests).toHaveLength(1)); call('onHide'); owner = 'new-info-owner'; route = wire => reply(wire, ['new'], null, '1');
  await call('onShow'); reply(late, ['old'], null, '99'); await first;
  expect(page.data.conversations.map(value => value.id)).toEqual(['new']); expect(readOrderUnread()).toBe('1');
});
test('guests retain native support entry and cause no directory network request', async () => {
  owner = null; await call('onShow'); expect(requests).toHaveLength(0);
  call('openLogin'); expect(navigate.mock.calls[0]?.[0].url).toBe('/pages/login/index');
});
