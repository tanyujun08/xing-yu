import { expect, test } from 'vitest';
import {
  conversationMessageView,
  conversationPresentation,
  mergeConversationMessageViews,
} from '../miniprogram/shared/presentation/api-conversation';

const ownMessage = {
  message_id: 'message-own',
  sequence: '9007199254740993',
  sender_role: 'TENANT' as const,
  is_own: true,
  body: '确认面交时间',
  sent_at: '2026-09-14T00:00:01Z',
};
const peerMessage = {
  message_id: 'message-peer',
  sequence: '9007199254740994',
  sender_role: 'LESSOR' as const,
  is_own: false,
  body: '明天下午可以',
  sent_at: '2026-09-14T00:00:02Z',
};

test('projects current-subject messages without converting uint64 sequences', () => {
  expect(conversationMessageView(ownMessage)).toEqual({
    id: 'message-own',
    sequence: '9007199254740993',
    mine: true,
    senderLabel: '承租方',
    content: '确认面交时间',
    timeText: '2026-09-14 08:00',
  });
});

test('uses the server capability and terminal reasons for open versus read-only presentation', () => {
  const open = conversationPresentation({
    order_id: 'order', self_role: 'TENANT', effective_status: 'OPEN',
    conversation: null, allowed_actions: ['POST_MESSAGE'], blocked_reasons: [], items: [],
    page: { has_more: false, next_after_sequence: null },
  });
  expect(open).toMatchObject({ title: '联系出租方', orderStatus: '尚无消息', readonly: false, canPost: true, messages: [] });
  const terminal = conversationPresentation({
    order_id: 'order', self_role: 'LESSOR', effective_status: 'READ_ONLY',
    conversation: { conversation_id: 'conversation' }, allowed_actions: [], blocked_reasons: ['ORDER_TERMINAL'], items: [peerMessage],
    page: { has_more: false, next_after_sequence: null },
  });
  expect(terminal).toMatchObject({ title: '联系承租方', orderStatus: '只读会话', readonly: true, canPost: false, readonlyReason: '订单已结束，对话记录仅供查看。' });
});

test('merges pagination and mutation pages by exact string sequence and rejects contradictory duplicates', () => {
  const first = [conversationMessageView(peerMessage)];
  const large = conversationMessageView(ownMessage);
  expect(mergeConversationMessageViews(first, [large]).map(item => item.sequence)).toEqual(['9007199254740993', '9007199254740994']);
  expect(() => mergeConversationMessageViews(first, [{ ...first[0]!, content: 'changed' }])).toThrow('同一消息序号');
});
