import { demoStorage } from '../../preview/storage';
import type { components } from './generated';
import { request, type RequestHandle } from './request';
import { ApiProblem } from './problem';
import { accountApi } from './account-api';
import { newIdempotencyKey } from './idempotency';
import { publishOrderUnread } from '../model/order-unread';
export type { RequestHandle } from './request';

type S = components['schemas'];
export type OrderConversation = S['OrderConversation'];
export type OrderMessage = S['OrderMessage'];
export type OrderMessageCreate = S['OrderMessageCreate'];
export type OrderMessagePage = S['OrderMessagePage'];
export type OrderConversationPage = S['OrderConversationPage'];
export type MessageIntent = {
  owner: string; conversationId: string; body: OrderMessageCreate;
  phase: 'UNKNOWN' | 'FAILED' | 'NOT_FOUND'; reason: string;
};
const root = '/v1/me/rental-conversations';
const prefix = 'xingyu.order-message.v1:';
const unreadReads = new WeakMap<object, RequestHandle<OrderConversationPage>>();
export const orderUnreadLifecycle = {
  show(page: object) {
    this.hide(page);
    if (!accountApi.sessionIdentity()) return;
    const handle = orderConversationApi.list(); unreadReads.set(page, handle);
    void handle.promise.catch(() => undefined).finally(() => { if (unreadReads.get(page) === handle) unreadReads.delete(page); });
  },
  hide(page: object) { unreadReads.get(page)?.abort(); unreadReads.delete(page); },
};
export function validConversationID(id: string) { return /^[A-Za-z0-9_-]{1,64}$/.test(id); }
function segment(id: string) { if (!validConversationID(id)) throw new Error('会话标识无效'); return encodeURIComponent(id); }
function owner() { const id = accountApi.sessionIdentity(); if (!id) throw new Error('请先登录'); return id; }
function slot(account: string, id: string) { return prefix + encodeURIComponent(account) + ':' + segment(id); }
function writeIntent(intent: MessageIntent) {
  demoStorage.setStorageSync(slot(intent.owner, intent.conversationId), intent);
  if (JSON.stringify(demoStorage.getStorageSync(slot(intent.owner, intent.conversationId))) !== JSON.stringify(intent)) throw new Error('原消息未能保存，尚未提交');
}
function removeIntent(intent: MessageIntent) {
  const current = demoStorage.getStorageSync(slot(intent.owner, intent.conversationId)) as MessageIntent | undefined;
  if (current?.body?.client_message_id === intent.body.client_message_id) demoStorage.removeStorageSync(slot(intent.owner, intent.conversationId));
}
function assertOwner(intent: MessageIntent) { if (owner() !== intent.owner) throw new Error('登录账号已变化，请重新打开会话'); }
function validateBody(body: OrderMessageCreate) {
  if (!/^[!-~]{16,64}$/.test(body.client_message_id)) throw new Error('原消息标识无效');
  if (body.kind === 'TEXT') {
    if (typeof body.body !== 'string' || !body.body.trim() || [...body.body].length > 500 || body.material_id !== null) throw new Error('请输入 1–500 字消息');
  } else if (body.kind !== 'IMAGE' || body.body !== null || !body.material_id || !validConversationID(body.material_id)) throw new Error('图片尚未就绪');
}
function sameMessage(intent: MessageIntent, value: OrderMessage) {
  return value.client_message_id === intent.body.client_message_id && value.sender_id === intent.owner && value.kind === intent.body.kind
    && value.body === intent.body.body && (value.media?.material_id ?? null) === intent.body.material_id;
}
function checkAck(intent: MessageIntent, value: OrderMessage) {
  if (!sameMessage(intent, value)) throw new Error('原消息回执不一致，请查询原结果');
  removeIntent(intent); return value;
}

export const orderConversationApi = {
  list(cursor?: string) {
    const account = owner(), handle = request<S['OrderConversationPage']>({ path: root + '?context_kind=ORDER&limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '') });
    return { abort: handle.abort, promise: handle.promise.then(value => { publishOrderUnread(account, value.total_unread_count, value.as_of_at); return value; }) };
  },
  ensure(orderId: string) {
    const account = owner(), storage = prefix + 'ensure:' + encodeURIComponent(account) + ':' + segment(orderId);
    const saved: unknown = demoStorage.getStorageSync(storage);
    if (saved && (typeof saved !== 'string' || !/^[!-~]{16,64}$/.test(saved))) throw new Error('原会话请求无法核实');
    const key = typeof saved === 'string' && saved ? saved : newIdempotencyKey('order-chat');
    demoStorage.setStorageSync(storage, key);
    if (demoStorage.getStorageSync(storage) !== key) throw new Error('原会话请求未保存');
    const handle = request<OrderConversation, object>({ path: '/v1/me/rental-orders/' + segment(orderId) + '/conversation', method: 'POST', body: {}, idempotencyKey: key });
    return { abort: handle.abort, promise: handle.promise.then(value => {
      if (value.order_id !== orderId || value.context_kind !== 'ORDER') throw new Error('订单会话不匹配');
      demoStorage.removeStorageSync(storage); return value;
    }) };
  },
  messages(id: string, position: { before?: string; after?: string } = {}) {
    if (position.before && position.after) throw new Error('分页方向无效');
    const value = position.before ?? position.after;
    if (value !== undefined && !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('消息序号无效');
    return request<OrderMessagePage>({ path: root + '/' + segment(id) + '/messages?limit=30' + (value !== undefined ? '&' + (position.before ? 'before_sequence' : 'after_sequence') + '=' + value : '') });
  },
  pending(id: string): MessageIntent | null {
    const account = owner(), value: unknown = demoStorage.getStorageSync(slot(account, id));
    if (!value) return null;
    const intent = value as MessageIntent;
    if (intent.owner !== account || intent.conversationId !== id || !intent.body || !['UNKNOWN', 'FAILED', 'NOT_FOUND'].includes(intent.phase)) throw new Error('原消息记录不完整，请核实后继续');
    validateBody(intent.body);
    return intent;
  },
  prepare(id: string, value: { kind: 'TEXT'; text: string } | { kind: 'IMAGE'; materialId: string }): MessageIntent {
    if (this.pending(id)) throw new Error('请先核实上一条消息');
    const body: OrderMessageCreate = { client_message_id: newIdempotencyKey('order-message'), kind: value.kind, body: value.kind === 'TEXT' ? value.text.trim() : null, material_id: value.kind === 'IMAGE' ? value.materialId : null };
    validateBody(body);
    const intent: MessageIntent = { owner: owner(), conversationId: id, body, phase: 'UNKNOWN', reason: '' };
    writeIntent(intent); return intent;
  },
  send(intent: MessageIntent): RequestHandle<OrderMessage> {
    assertOwner(intent);
    const original = this.pending(intent.conversationId);
    if (!original || JSON.stringify(original.body) !== JSON.stringify(intent.body)) throw new Error('必须使用原消息内容与标识');
    intent.phase = 'UNKNOWN'; intent.reason = ''; writeIntent(intent);
    const handle = request<OrderMessage, OrderMessageCreate>({ path: root + '/' + segment(intent.conversationId) + '/messages', method: 'POST', body: intent.body, idempotencyKey: intent.body.client_message_id });
    return { abort: handle.abort, promise: handle.promise.then(value => checkAck(intent, value)).catch((error: unknown) => {
      const confirmedFailure = error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500 && ![408, 429].includes(error.statusCode) && error.code !== 'IDEMPOTENCY_CONFLICT';
      intent.phase = confirmedFailure ? 'FAILED' : 'UNKNOWN'; intent.reason = error instanceof Error ? error.message : '发送结果待核实'; writeIntent(intent); throw error;
    }) };
  },
  lookup(intent: MessageIntent): RequestHandle<S['OrderMessageLookup']> {
    assertOwner(intent);
    const handle = request<S['OrderMessageLookup']>({ path: root + '/' + segment(intent.conversationId) + '/message-results/' + encodeURIComponent(intent.body.client_message_id) });
    return { abort: handle.abort, promise: handle.promise.then(value => {
      if (value.state === 'APPLIED' && value.message) checkAck(intent, value.message);
      else if (value.state === 'NOT_FOUND' && value.message === null) { intent.phase = 'NOT_FOUND'; intent.reason = '暂未查到原消息，可按原内容重试'; writeIntent(intent); }
      else throw new Error('原消息查询结果无法确认');
      return value;
    }) };
  },
  discardFailed(intent: MessageIntent) {
    assertOwner(intent);
    if (this.pending(intent.conversationId)?.phase !== 'FAILED') throw new Error('未知结果不能丢弃，请查询原消息');
    removeIntent(intent);
  },
  markRead(id: string, through: string) {
    if (!/^(0|[1-9][0-9]*)$/.test(through)) throw new Error('消息序号无效');
    return request<S['OrderReadCursor'], S['OrderReadCursorRequest']>({ path: root + '/' + segment(id) + '/read-cursor', method: 'POST', body: { through_sequence: through }, idempotencyKey: newIdempotencyKey('message-read') });
  },
};
