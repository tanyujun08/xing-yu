export interface ApiConversationMessageLike {
  message_id: string;
  sequence: string;
  sender_role: 'TENANT' | 'LESSOR';
  is_own: boolean;
  body: string;
  sent_at: string;
}

export interface ApiConversationLike {
  order_id: string;
  self_role: 'TENANT' | 'LESSOR';
  effective_status: 'OPEN' | 'READ_ONLY';
  conversation: null | { conversation_id: string };
  allowed_actions: readonly string[];
  blocked_reasons: readonly string[];
  items: readonly ApiConversationMessageLike[];
  page: { has_more: boolean; next_after_sequence: string | null };
}

export interface ConversationMessageView {
  id: string;
  sequence: string;
  mine: boolean;
  senderLabel: string;
  content: string;
  timeText: string;
}

const compareDecimal = (left: string, right: string) => left.length === right.length
  ? (left === right ? 0 : left < right ? -1 : 1)
  : left.length - right.length;
function beijingTime(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 8 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : '时间待核实';
}

export function conversationMessageView(message: ApiConversationMessageLike): ConversationMessageView {
  return {
    id: message.message_id,
    sequence: message.sequence,
    mine: message.is_own,
    senderLabel: message.sender_role === 'TENANT' ? '承租方' : '出租方',
    content: message.body,
    timeText: beijingTime(message.sent_at),
  };
}

export function mergeConversationMessageViews(current: readonly ConversationMessageView[], incoming: readonly ConversationMessageView[]): ConversationMessageView[] {
  const merged = new Map<string, ConversationMessageView>();
  for (const message of [...current, ...incoming]) {
    const previous = merged.get(message.sequence);
    if (previous && JSON.stringify(previous) !== JSON.stringify(message)) throw new Error('同一消息序号返回了不同内容，请重新读取。');
    merged.set(message.sequence, message);
  }
  return [...merged.values()].sort((left, right) => compareDecimal(left.sequence, right.sequence));
}

export function conversationPresentation(value: ApiConversationLike) {
  const peer = value.self_role === 'TENANT' ? '出租方' : '承租方';
  const readonly = value.effective_status === 'READ_ONLY';
  const reason = value.blocked_reasons.includes('ORDER_TERMINAL')
    ? '订单已结束，对话记录仅供查看。'
    : value.blocked_reasons.includes('APPROVAL_TERMINAL')
      ? '订单申请已结束，对话记录仅供查看。'
      : value.blocked_reasons.includes('CONVERSATION_READ_ONLY')
        ? '当前会话只允许查看历史消息。'
        : '';
  return {
    title: `联系${peer}`,
    orderName: `与${peer}的订单沟通`,
    orderStatus: value.conversation ? (readonly ? '只读会话' : '会话已开启') : '尚无消息',
    readonly,
    readonlyReason: reason,
    canPost: value.allowed_actions.includes('POST_MESSAGE'),
    messages: value.items.map(conversationMessageView),
    hasMore: value.page.has_more,
    nextAfterSequence: value.page.next_after_sequence,
    conversationId: value.conversation?.conversation_id ?? '',
  };
}
