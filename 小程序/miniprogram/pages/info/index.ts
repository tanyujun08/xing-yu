import { designAssets } from '../../shared/design/assets';
import { accountApi } from '../../shared/api/account-api';
import { orderConversationApi, type OrderConversation, type OrderConversationPage } from '../../shared/api/rental-api';
import { orderConversationView, unreadLabel } from '../../shared/presentation/order-conversation';
import { createNavigateOnce, type NavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope, type OperationScope } from '../../shared/interaction/operation-scope';
import type { RequestHandle } from '../../shared/api/rental-api';

type State = { owner: string | null; visible: boolean; scope: OperationScope; navigation: NavigateOnce; items: OrderConversation[]; cursor: string | null; pages: number; invalidate: () => void };
const states = new WeakMap<object, State>();
function active(state: State) { return state.visible && !state.scope.disposed && accountApi.sessionIdentity() === state.owner; }
async function read<T>(state: State, handle: RequestHandle<T>) { const release = state.scope.registerCleanup(handle.abort); try { return await handle.promise; } catch (error) { if (state.visible && accountApi.sessionIdentity() !== state.owner) state.invalidate(); throw error; } finally { release(); } }
const empty = { loggedIn: false, conversations: [] as ReturnType<typeof orderConversationView>[], loaded: false, loading: false, loadingMore: false, hasMore: false, errorText: '' };

Page({
  data: { icons: designAssets, ...empty, supportError: '' },
  onLoad() { states.set(this, { owner: null, visible: false, scope: createOperationScope(), navigation: createNavigateOnce(), items: [], cursor: null, pages: 1, invalidate: () => undefined }); },
  onShow() {
    let state = states.get(this); if (!state) return;
    if (state.scope.disposed) { state = { ...state, scope: createOperationScope(), navigation: createNavigateOnce() }; states.set(this, state); }
    state.visible = true;
    const owner = accountApi.sessionIdentity();
    if (state.owner !== owner) {
      state.visible = false; state.scope.dispose(); state.navigation.dispose();
      state = { ...state, visible: true, scope: createOperationScope(), navigation: createNavigateOnce(), owner, items: [], cursor: null, pages: 1 };
      states.set(this, state); this.setData({ ...empty });
    }
    this.getTabBar()?.setData({ selected: 2 });
    this.setData({ loggedIn: owner !== null });
    const shownState = state;
    state.invalidate = () => {
      if (states.get(this) !== shownState || !shownState.visible) return;
      shownState.scope.dispose(); shownState.items = []; shownState.cursor = null;
      this.setData({ ...empty }); this.getTabBar()?.setData({ unreadText: '' });
      void this.onShow();
    };
    if (!owner) return;
    return this.refresh();
  },
  onHide() { const state = states.get(this); if (state) { state.visible = false; state.scope.dispose(); state.navigation.dispose(); this.setData({ loading: false, loadingMore: false }); } },
  onUnload() { this.onHide(); states.delete(this); },
  async onPullDownRefresh() { try { await this.refresh(); } finally { wx.stopPullDownRefresh(); } },
  onReachBottom() { return this.loadMore(); },
  async refresh() {
    const state = states.get(this); if (!state || !active(state) || !state.owner) return;
    return state.scope.singleFlight('directory', async () => {
      this.setData({ loading: true, errorText: '' });
      try {
        let cursor: string | null = null, items: OrderConversation[] = [], total = '0', pages = 0;
        do {
          const result: OrderConversationPage = await read(state, orderConversationApi.list(cursor ?? undefined)); if (!active(state)) return;
          items = [...items, ...result.items]; cursor = result.next_cursor; total = result.total_unread_count; pages++;
        } while (cursor && pages < state.pages);
        state.items = [...new Map(items.map(item => [item.conversation_id, item])).values()]; state.cursor = cursor; state.pages = pages;
        this.setData({ loaded: true, conversations: state.items.map(orderConversationView), hasMore: !!cursor });
        this.getTabBar()?.setData({ unreadOwner: state.owner, unreadText: unreadLabel(total) });
      } catch (error) { if (active(state)) this.setData({ errorText: error instanceof Error ? error.message : '会话读取失败，请重试' }); }
      finally { if (active(state)) this.setData({ loading: false }); }
    });
  },
  async loadMore() {
    const state = states.get(this); if (!state || !active(state) || !state.cursor || this.data.loading || this.data.loadingMore) return;
    return state.scope.singleFlight('directory', async () => {
      this.setData({ loadingMore: true, errorText: '' });
      try {
        const result = await read(state, orderConversationApi.list(state.cursor!)); if (!active(state)) return;
        state.items = [...new Map([...state.items, ...result.items].map(item => [item.conversation_id, item])).values()]; state.cursor = result.next_cursor; state.pages++;
        this.setData({ conversations: state.items.map(orderConversationView), hasMore: !!state.cursor });
        this.getTabBar()?.setData({ unreadOwner: state.owner, unreadText: unreadLabel(result.total_unread_count) });
      } catch (error) { if (active(state)) this.setData({ errorText: error instanceof Error ? error.message : '加载失败，请重试' }); }
      finally { if (active(state)) this.setData({ loadingMore: false }); }
    });
  },
  navigate(url: string) {
    const state = states.get(this); if (!state || !active(state)) return;
    state.navigation.navigateOnce('info-navigation', callbacks => wx.navigateTo({ url, ...callbacks,
      fail: error => { callbacks.fail(error); if (active(state)) this.setData({ errorText: '暂时无法打开，请重试' }); },
    }));
  },
  openLogin() { this.navigate('/pages/login/index'); },
  openOrders() {
    const state = states.get(this); if (!state || !active(state)) return;
    state.navigation.navigateOnce('info-navigation', callbacks => wx.switchTab({ url: '/pages/orders/index', ...callbacks,
      fail: error => { callbacks.fail(error); if (active(state)) this.setData({ errorText: '暂时无法打开订单，请重试' }); },
    }));
  },
  openConversation(event: WechatMiniprogram.TouchEvent) {
    const state = states.get(this); if (!state || !active(state)) return;
    const item = state.items.find(value => value.conversation_id === event.currentTarget.dataset['id']);
    if (item) this.navigate('/pages/chat/index?mode=c2c&orderId=' + encodeURIComponent(item.order_id) + '&conversationId=' + encodeURIComponent(item.conversation_id));
  },
  contactError() { const state = states.get(this); if (state && active(state)) this.setData({ supportError: '微信客服暂时无法打开，请稍后点击重试' }); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
