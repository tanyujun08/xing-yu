import type { OrderConversation, OrderMessage } from '../model/order-conversation';
import { beijingTime, rentalDateRange, rentalStateLabel } from './rental-order';

export const compareSequence = (a: string, b: string) => a.length === b.length ? (a === b ? 0 : a < b ? -1 : 1) : a.length - b.length;
export function unreadLabel(value: string) { return /^[1-9][0-9]*$/.test(value) ? compareSequence(value, '99') > 0 ? '99+' : value : ''; }
export function conversationTime(value: string | null | undefined, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const full = beijingTime(value), today = beijingTime(new Date(now).toISOString()).slice(0, 10);
  if (full.slice(0, 10) === today) return full.slice(11);
  const yesterday = beijingTime(new Date(now - 86400000).toISOString()).slice(0, 10);
  if (full.slice(0, 10) === yesterday) return '昨天';
  return full.slice(0, 4) === today.slice(0, 4) ? full.slice(5, 10).replace('-', '.') : full.slice(0, 10);
}
const toneByStatus: Record<string, 'ok' | 'warn' | 'wait' | 'end'> = {
  ACTIVE: 'ok', PREPARING: 'ok', AWAITING_PAYMENT: 'warn', AWAITING_SUPPLEMENT: 'warn', AWAITING_CONFIRMATION: 'warn',
  COMPLETED: 'end', CLOSED: 'end',
};
export function conversationTone(code: string): 'ok' | 'warn' | 'wait' | 'end' { return toneByStatus[code] ?? 'wait'; }
export function orderConversationView(value: OrderConversation) {
  return {
    id: value.conversation_id, orderId: value.order_id, role: value.viewer_role,
    tone: conversationTone(value.order_summary.display_status_code),
    counterpartName: value.peer.display_name, counterpartRoleText: value.peer.role === 'LESSOR' ? '出租方' : '承租方',
    avatarText: [...value.peer.display_name][0] ?? '人', avatarURL: value.peer.avatar_url ?? '',
    deviceName: value.order_summary.asset_title, deviceImage: value.order_summary.cover_url ?? '',
    statusText: rentalStateLabel(value.order_summary.display_status_code),
    rentalPeriod: rentalDateRange(value.order_summary.rental_start_at, value.order_summary.rental_end_at),
    periodShort: rentalDateRange(value.order_summary.rental_start_at, value.order_summary.rental_end_at).replace(/[0-9]{4}-/g, ''),
    lastMessage: value.last_message?.kind === 'IMAGE' ? '[图片]' : value.last_message?.preview ?? '暂无消息',
    timeText: value.last_message_at ? beijingTime(value.last_message_at) : '', shortTimeText: conversationTime(value.last_message_at), unreadText: unreadLabel(value.unread_count),
  };
}
export function orderMessageView(value: OrderMessage, account: string) {
  const scale = value.media ? Math.min(1, 224 / value.media.width, 240 / value.media.height) : 0;
  return { id: value.message_id, anchor: 'message-' + value.sequence, sequence: value.sequence, mine: value.sender_id === account,
    content: value.body ?? '', kind: value.kind, src: value.media?.url ?? '', timeText: beijingTime(value.sent_at),
    imageWidth: value.media ? Math.max(44, Math.round(value.media.width * scale)) : 0,
    imageHeight: value.media ? Math.max(44, Math.round(value.media.height * scale)) : 0,
  };
}
/** Groups consecutive messages from one sender and shows a time label only after a 5-minute gap. */
export function decorateMessages<T extends { mine: boolean; timeText: string }>(rows: T[]) {
  const stamp = (row: T) => Date.parse(row.timeText.replace(' ', 'T'));
  return rows.map((row, index) => {
    const before = rows[index - 1], after = rows[index + 1];
    const showTime = !before || !(stamp(row) - stamp(before) < 300000);
    const nextShowsTime = !!after && !(stamp(after) - stamp(row) < 300000);
    const [date = '', clock = ''] = row.timeText.split(' ');
    const [, month = '', day = ''] = date.split('-');
    return { ...row, showTime, timeLabel: month ? Number(month) + '月' + Number(day) + '日 ' + clock.slice(0, 5) : row.timeText,
      first: showTime || !before || before.mine !== row.mine, last: !after || after.mine !== row.mine || nextShowsTime };
  });
}
export function mergeOrderMessages(current: readonly OrderMessage[], incoming: readonly OrderMessage[]) {
  const values = new Map<string, OrderMessage>();
  const clients = new Map<string, string>();
  for (const message of [...current, ...incoming]) {
    const prior = values.get(message.sequence), client = message.sender_id + ':' + message.client_message_id;
    if (prior && JSON.stringify(prior) !== JSON.stringify(message) || clients.has(client) && clients.get(client) !== message.sequence) throw new Error('同一消息返回了不同内容，请重新读取');
    values.set(message.sequence, message); clients.set(client, message.sequence);
  }
  return [...values.values()].sort((a, b) => compareSequence(a.sequence, b.sequence));
}
export function conversationBlockedReason(value: OrderConversation) {
  return value.can_post ? '' : value.blocked_reason === 'ORDER_TERMINAL' ? '订单已结束，历史消息仍可查看' : '当前订单会话只允许查看历史消息';
}
