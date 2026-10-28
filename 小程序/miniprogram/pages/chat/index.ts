import { accountApi } from '../../shared/api/account-api';
import { orderConversationApi, validConversationID, type OrderConversation, type OrderMessage, type MessageIntent } from '../../shared/api/rental-api';
import { chatImageDrafts, type ChatImageDraft } from '../../shared/api/rental-api';
import type { RequestHandle } from '../../shared/api/rental-api';
import { designAssets } from '../../shared/design/assets';
import { createNavigateOnce, navigateBackWithFallback, type NavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope, type OperationScope } from '../../shared/interaction/operation-scope';
import { orderConversationView, orderMessageView, mergeOrderMessages, compareSequence, conversationBlockedReason } from '../../shared/presentation/order-conversation';

type State = {
  owner: string; orderId: string; conversationId: string; valid: boolean; visible: boolean; entered: boolean;
  scope: OperationScope; navigation: NavigateOnce; conversation: OrderConversation | null; messages: OrderMessage[];
  before: string | null; observer: WechatMiniprogram.IntersectionObserver | null; observed: string; read: string;
  image: ChatImageDraft | null;
  invalidate: () => void;
};
const states = new WeakMap<object, State>();
type ImageSelection = { owner: string; conversationId: string; waiters: ((ready: boolean) => void)[] };
const imageSelections = new WeakMap<object, ImageSelection>();
function finishSelection(page: object) {
  const selection = imageSelections.get(page); imageSelections.delete(page);
  selection?.waiters.splice(0).forEach(resolve => resolve(false));
}
function current(state: State) { return state.visible && !state.scope.disposed && accountApi.sessionIdentity() === state.owner; }
async function run<T>(state: State, handle: RequestHandle<T>) {
  const release = state.scope.registerCleanup(handle.abort);
  try { return await handle.promise; }
  catch (error) { if (state.visible && accountApi.sessionIdentity() !== state.owner) state.invalidate(); throw error; }
  finally { release(); }
}
const empty = {
  title: '订单沟通', order: null as ReturnType<typeof orderConversationView> | null,
  messages: [] as ReturnType<typeof orderMessageView>[], content: '', errorText: '', loaded: false,
  loading: false, loadingMore: false, busy: false, unavailable: false, unavailableReason: '',
  readonly: false, readonlyReason: '', canPost: false, canSend: false, hasMore: false,
  pending: null as MessageIntent | null, pendingText: '', imageSrc: '', imagePhase: '', imageProgress: 0,
  imageError: '', imageReady: false, imageBusy: false, imageFailed: false, supportError: '',
  deliveryText: '', imageConfirmation: false, canRetryOriginal: false,
};
Page({
  data: { icons: designAssets, ...empty },
  onLoad(options: Record<string, string | undefined>) {
    finishSelection(this);
    const old = states.get(this); old?.scope.dispose(); old?.navigation.dispose(); old?.observer?.disconnect();
    const orderId = options['orderId'] ?? '', conversationId = options['conversationId'] ?? '';
    states.set(this, { owner: '', orderId, conversationId, valid: options['mode'] === 'c2c' && validConversationID(orderId) && (!conversationId || validConversationID(conversationId)), visible: false, entered: false,
      scope: createOperationScope(), navigation: createNavigateOnce(), conversation: null, messages: [], before: null, observer: null, observed: '0', read: '0', image: null, invalidate: () => undefined });
    this.setData({ ...empty });
  },
  onShow() {
    let state = states.get(this); if (!state) return;
    if (state.scope.disposed) { state = { ...state, scope: createOperationScope(), navigation: createNavigateOnce() }; states.set(this, state); }
    state.visible = true;
    const owner = accountApi.sessionIdentity() ?? '';
    if (state.owner !== owner) {
      finishSelection(this);
      state.visible = false; state.scope.dispose(); state.navigation.dispose(); state.observer?.disconnect();
      state = { ...state, visible: true, scope: createOperationScope(), navigation: createNavigateOnce(), observer: null }; states.set(this, state);
      state.owner = owner; state.messages = []; state.conversation = null; state.before = null; state.image = null; state.read = '0'; state.observed = '0';
      this.setData({ ...empty });
    }
    if (!state.valid || !owner) {
      this.setData({ unavailable: true, unavailableReason: !owner ? '请登录后从订单或沟通列表进入' : '请从个人订单或沟通列表进入此会话' }); return;
    }
    const shownState = state;
    state.invalidate = () => {
      if (states.get(this) !== shownState || !shownState.visible) return;
      shownState.scope.dispose(); shownState.observer?.disconnect(); shownState.messages = []; shownState.conversation = null; shownState.image = null;
      this.setData({ ...empty, unavailable: true, unavailableReason: '登录状态已变化，请返回后重新进入会话' });
      void this.onShow();
    };
    const selection = imageSelections.get(this);
    if (selection) this.setData({ busy: true });
    return Promise.resolve(this.refresh(selection ? false : !state.entered)).finally(() => {
      if (selection && imageSelections.get(this) === selection) {
        const ready = current(shownState) && !this.data.loading && !this.data.errorText && this.data.canPost;
        selection.waiters.splice(0).forEach(resolve => resolve(ready));
      }
    });
  },
  onHide() {
    const state = states.get(this); if (!state) return;
    state.visible = false; state.scope.dispose(); state.navigation.dispose(); state.observer?.disconnect(); state.observer = null;
    // Ordinary text is a per-page in-memory draft. An uncertain dispatched message is stored separately.
    this.setData({ content: '', canSend: false, busy: false, loading: false, loadingMore: false });
  },
  onUnload() { finishSelection(this); this.onHide(); states.delete(this); },
  async onPullDownRefresh() { try { await this.refresh(true); } finally { wx.stopPullDownRefresh(); } },
  async refresh(allowEnsure: unknown = true) {
    const state = states.get(this); if (!state || !current(state) || !state.valid || !state.owner) return;
    if (this.data.busy && allowEnsure !== false) return;
    return state.scope.singleFlight('read', async () => {
      this.setData({ loading: true, errorText: '' });
      try {
        if (!state.conversationId) {
          if (!allowEnsure && state.entered) { this.setData({ errorText: '请点击重新读取，按原请求核实会话' }); return; }
          state.entered = true;
          const conversation = await run(state, orderConversationApi.ensure(state.orderId)); if (!current(state)) return;
          state.conversationId = conversation.conversation_id;
        }
        state.entered = true;
        const pending = orderConversationApi.pending(state.conversationId);
        if (pending?.phase === 'UNKNOWN') await this.queryOriginal(false);
        if (!current(state)) return;
        const result = await run(state, orderConversationApi.messages(state.conversationId)); if (!current(state)) return;
        if (result.conversation.order_id !== state.orderId || result.conversation.conversation_id !== state.conversationId) throw new Error('订单与会话不匹配，请返回重新进入');
        // A fresh latest page is a contiguous window; never merge across an unqueried gap.
        state.conversation = result.conversation; state.messages = mergeOrderMessages([], result.items); state.before = result.has_more ? result.next_before_sequence : null;
        state.read = result.conversation.read_sequence; state.observed = state.read; state.image = chatImageDrafts.load(state.conversationId);
        this.setData({ deliveryText: '' });
        this.renderMessages();
      } catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '消息读取失败，请重试', unavailable: !this.data.loaded, unavailableReason: '暂时无法读取订单会话' }); }
      finally { if (current(state)) this.setData({ loading: false }); }
    });
  },
  renderMessages(anchor = '') {
    const state = states.get(this); if (!state || !current(state) || !state.conversation) return;
    const order = orderConversationView(state.conversation);
    this.setData({ order, title: order.counterpartName + ' · ' + order.counterpartRoleText, loaded: true, unavailable: false,
      messages: state.messages.map(value => orderMessageView(value, state.owner)), hasMore: !!state.before,
      canPost: state.conversation.can_post, readonly: !state.conversation.can_post, readonlyReason: conversationBlockedReason(state.conversation),
    }, () => {
      if (!current(state)) return;
      this.observeMessages();
      if (anchor) wx.pageScrollTo({ selector: '#' + anchor, duration: 0 });
    });
    this.renderComposer();
  },
  renderComposer() {
    const state = states.get(this); if (!state || !current(state) || !state.conversationId) return;
    const pending = orderConversationApi.pending(state.conversationId), image = state.image;
    const imageBusy = !!image && ['UPLOADING', 'PROCESSING'].includes(image.upload.phase) && this.data.busy;
    this.setData({ pending, pendingText: pending?.body.kind === 'IMAGE' ? '[图片]' : pending?.body.body ?? '',
      imageConfirmation: !!image && !pending,
      title: image && !pending ? '发送图片' : this.data.order ? this.data.order.counterpartName + ' · ' + this.data.order.counterpartRoleText : '订单沟通',
      canRetryOriginal: !!state.conversation?.can_post && pending?.phase === 'NOT_FOUND' && !this.data.busy,
      imageSrc: image?.url || image?.upload.file || '', imagePhase: image?.upload.phase ?? '', imageProgress: image?.upload.progress ?? 0,
      imageError: image?.upload.error ?? '', imageReady: image?.upload.phase === 'READY', imageBusy, imageFailed: image?.upload.phase === 'FAILED',
      canSend: !!state.conversation?.can_post && !pending && !this.data.busy && (image ? image.upload.phase === 'READY' : !!this.data.content.trim() && [...this.data.content.trim()].length <= 500),
    });
  },
  async loadMore() {
    const state = states.get(this); if (!state || !current(state) || !state.before || this.data.loading || this.data.loadingMore) return;
    return state.scope.singleFlight('read', async () => {
      this.setData({ loadingMore: true, errorText: '' });
      const anchor = state.messages[0] ? 'message-' + state.messages[0].sequence : '';
      try {
        const result = await run(state, orderConversationApi.messages(state.conversationId, { before: state.before! })); if (!current(state)) return;
        if (result.conversation.order_id !== state.orderId) throw new Error('订单会话不匹配');
        state.conversation = result.conversation; state.messages = mergeOrderMessages(state.messages, result.items); state.before = result.has_more ? result.next_before_sequence : null;
        this.renderMessages(anchor);
      } catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '历史消息读取失败' }); }
      finally { if (current(state)) this.setData({ loadingMore: false }); }
    });
  },
  observeMessages() {
    const state = states.get(this); if (!state || !current(state)) return;
    state.observer?.disconnect();
    if (!state.messages.length) return;
    state.observer = this.createIntersectionObserver({ observeAll: true, thresholds: [0.6] });
    state.observer.relativeToViewport().observe('.message-read-marker', event => {
      const sequence = String(event.dataset['sequence'] ?? '');
      if (!current(state) || event.intersectionRatio < 0.6 || !state.messages.some(value => value.sequence === sequence)) return;
      if (compareSequence(sequence, state.observed) > 0) state.observed = sequence;
      void this.markVisibleRead();
    });
  },
  async markVisibleRead() {
    const state = states.get(this); if (!state || !current(state) || compareSequence(state.observed, state.read) <= 0) return;
    return state.scope.singleFlight('read-cursor', async () => {
      try {
        while (current(state) && compareSequence(state.observed, state.read) > 0) {
          const through = state.observed, result = await run(state, orderConversationApi.markRead(state.conversationId, through));
          if (!current(state)) return;
          if (compareSequence(result.read_sequence, through) < 0) throw new Error('已读游标回执无效');
          state.read = result.read_sequence;
        }
      } catch { /* Preserve unread facts; a later visible observation or page show can retry. */ }
    });
  },
  inputMessage(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const state = states.get(this); if (!state || !current(state) || !this.data.canPost || this.data.pending || state.image || this.data.busy) return;
    const maximumCharacters = 500; const content = [...event.detail.value].slice(0, maximumCharacters).join('');
    this.setData({ content }); this.renderComposer();
  },
  async send() {
    const state = states.get(this); if (!state || !current(state) || !this.data.canSend || this.data.pending) return;
    return state.scope.singleFlight('send', async () => {
      this.setData({ busy: true, canSend: false, errorText: '' });
      try {
        const intent = orderConversationApi.prepare(state.conversationId, state.image?.upload.phase === 'READY' && state.image.upload.materialId
          ? { kind: 'IMAGE', materialId: state.image.upload.materialId } : { kind: 'TEXT', text: this.data.content });
        this.renderComposer();
        const message = await run(state, orderConversationApi.send(intent)); if (!current(state)) return;
        this.acceptMessage(message);
        await this.refresh(false);
        if (current(state)) wx.pageScrollTo({ selector: '#chat-bottom', duration: 0 });
      } catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '发送结果待核实' }); }
      finally { if (current(state)) { this.setData({ busy: false }); this.renderComposer(); } }
    });
  },
  acceptMessage(message: OrderMessage) {
    const state = states.get(this); if (!state || !current(state)) return;
    // An ACK can be far outside this paged window. Only a fresh GET may replace it;
    // appending the ACK would hide an unqueried gap from history pagination.
    const image = state.image;
    if (message.kind === 'IMAGE' && image && image.upload.materialId === message.media?.material_id) { chatImageDrafts.clear(image); state.image = null; }
    this.setData({ content: '', errorText: '', deliveryText: '消息已发送，刷新后可在记录中查看' }); this.renderComposer();
  },
  async queryOriginal(reload: unknown = true) {
    const state = states.get(this); if (!state || !current(state)) return;
    const intent = orderConversationApi.pending(state.conversationId); if (!intent) return;
    const applied = await state.scope.singleFlight('message-recovery', async () => {
      this.setData({ busy: true, canSend: false, errorText: '' });
      try {
        const result = await run(state, orderConversationApi.lookup(intent)); if (!current(state)) return;
        if (result.message) {
          this.acceptMessage(result.message);
          return true;
        }
      } catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '暂时无法核实原消息' }); }
      finally { if (current(state)) { this.setData({ busy: false }); this.renderComposer(); } }
    });
    if (applied && reload !== false && current(state)) await this.refresh(false);
  },
  async retryOriginal() {
    const state = states.get(this); if (!state || !current(state) || this.data.busy) return;
    const intent = orderConversationApi.pending(state.conversationId);
    if (!intent || intent.phase === 'UNKNOWN') { await this.queryOriginal(); return; }
    if (!state.conversation?.can_post || intent.phase !== 'NOT_FOUND') return;
    return state.scope.singleFlight('send', async () => {
      this.setData({ busy: true, errorText: '' }); this.renderComposer();
      try {
        const message = await run(state, orderConversationApi.send(intent)); if (!current(state)) return;
        this.acceptMessage(message); await this.refresh(false);
      } catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '发送结果待核实' }); }
      finally { if (state.visible && accountApi.sessionIdentity() !== state.owner) state.invalidate(); else if (current(state)) { this.setData({ busy: false }); this.renderComposer(); } }
    });
  },
  discardFailed() {
    const state = states.get(this); if (!state || !current(state) || this.data.busy) return;
    if (!state.conversation?.can_post) return;
    const intent = orderConversationApi.pending(state.conversationId); if (intent?.phase !== 'FAILED') return;
    wx.showModal({ title: '编辑未发送的消息', content: '本次发送已明确失败，返回编辑后可以重新发送。', success: result => {
      if (!result.confirm || !current(state) || this.data.busy) return;
      orderConversationApi.discardFailed(intent); this.setData({ content: intent.body.body ?? '', errorText: '' }); this.renderComposer();
    } });
  },
  async chooseImage() {
    const state = states.get(this); if (!state || !current(state) || !this.data.canPost || this.data.busy || this.data.pending || state.image || imageSelections.has(this)) return;
    const selection: ImageSelection = { owner: state.owner, conversationId: state.conversationId, waiters: [] };
    imageSelections.set(this, selection);
    const active = () => {
      const latest = states.get(this);
      return imageSelections.get(this) === selection && !!latest && current(latest) && latest.owner === selection.owner
        && latest.conversationId === selection.conversationId && this.data.canPost && !this.data.loading && !this.data.errorText && !this.data.pending;
    };
    const resume = () => {
      const latest = states.get(this);
      if (imageSelections.get(this) !== selection || !latest || accountApi.sessionIdentity() !== selection.owner) return Promise.resolve(false);
      if (latest.visible && !this.data.loading) return Promise.resolve(active());
      return new Promise<boolean>(resolve => selection.waiters.push(resolve));
    };
    return state.scope.singleFlight('choose-image', async () => {
      this.setData({ busy: true, errorText: '' });
      try {
        const draft = await chatImageDrafts.create(state.conversationId, active, resume); if (!active() || !draft) return;
        const latest = states.get(this)!;
        latest.image = draft; this.renderComposer();
        await chatImageDrafts.upload(draft, latest.scope, () => states.get(this) === latest && current(latest), () => this.renderComposer());
      } catch (error) { if (active() && !(error && typeof error === 'object' && 'errMsg' in error && String(error.errMsg).includes('cancel'))) this.setData({ errorText: error instanceof Error ? error.message : '图片选择或上传失败' }); }
      finally {
        const latest = states.get(this), ownsSelection = imageSelections.get(this) === selection;
        if (ownsSelection) finishSelection(this);
        if (latest?.visible && accountApi.sessionIdentity() !== latest.owner) latest.invalidate();
        else if (ownsSelection && latest && current(latest)) { this.setData({ busy: false }); this.renderComposer(); }
      }
    });
  },
  async recoverImage() {
    const state = states.get(this); if (!state || !current(state) || !state.image || this.data.busy || this.data.pending) return;
    return state.scope.singleFlight('choose-image', async () => {
      this.setData({ busy: true, errorText: '' });
      try { await chatImageDrafts.upload(state.image!, state.scope, () => current(state), () => this.renderComposer(), true); }
      catch (error) { if (current(state)) this.setData({ errorText: error instanceof Error ? error.message : '图片处理结果待核实' }); }
      finally { if (state.visible && accountApi.sessionIdentity() !== state.owner) state.invalidate(); else if (current(state)) { this.setData({ busy: false }); this.renderComposer(); } }
    });
  },
  removeImage() {
    const state = states.get(this); if (!state || !current(state) || !state.image || this.data.busy || this.data.pending) return;
    chatImageDrafts.clear(state.image); state.image = null; this.setData({ errorText: '' }); this.renderComposer();
  },
  previewDraftImage() {
    const state = states.get(this); if (!state || !current(state) || !state.image || this.data.pending) return;
    const url = state.image.url || state.image.upload.file;
    wx.previewImage({ current: url, urls: [url] });
  },
  previewImage(event: WechatMiniprogram.TouchEvent) {
    const state = states.get(this); if (!state || !current(state)) return;
    const message = state.messages.find(value => value.message_id === event.currentTarget.dataset['id']);
    if (message?.media) wx.previewImage({ current: message.media.url, urls: [message.media.url] });
  },
  openOrder() {
    const state = states.get(this); if (!state || !current(state) || !state.conversation) return;
    state.navigation.navigateOnce('order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(state.conversation!.order_id), ...callbacks }));
  },
  onSecondaryNavigationBack() {
    const state = states.get(this); if (!state?.visible || state.scope.disposed) return;
    if (this.data.imageConfirmation) { this.removeImage(); return; }
    if (this.data.busy) return;
    navigateBackWithFallback(state.navigation);
  },
  contactError() { const state = states.get(this); if (state && current(state)) this.setData({ supportError: '微信客服暂时无法打开，请稍后重试' }); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
