import { createNavigateOnce, navigateBackWithFallback } from './navigate-once';

export const orderUnavailableText = '订单服务暂不可用，请稍后再试。';

type ViewPage = { data: { routeId?: string }; setData(patch: Record<string, unknown>): void };
const states = new WeakMap<object, { visible: boolean; navigation: ReturnType<typeof createNavigateOnce>; route: Record<string, unknown> }>();

export function blockOrderAction(this: object): void {
  if (states.get(this)?.visible) wx.showToast({ title: orderUnavailableText, icon: 'none' });
}

function navigate(page: object, url: string, tab = false): void {
  const state = states.get(page);
  if (!state?.visible) return;
  state.navigation.navigateOnce(url, callbacks => {
    if (tab) wx.switchTab({ url, ...callbacks });
    else wx.navigateTo({ url, ...callbacks });
  });
}

/** Page-local unavailable state; it never reads or creates an order fact. */
export function unavailableOrderPage<T extends object>(
  initial: T,
  identity: () => string | null | undefined,
  routeView: (options: Record<string, string | undefined>) => Record<string, unknown> = () => ({}),
) {
  const empty = { ...initial, routeId: '', unavailable: true, missing: true, loaded: false, loading: false, loggedIn: false, errorText: orderUnavailableText };
  return {
    data: empty,
    onLoad(this: ViewPage, options: Record<string, string | undefined>) {
      states.get(this)?.navigation.dispose();
      const route = { ...routeView(options), routeId: options['id'] ?? options['orderId'] ?? options['deviceId'] ?? '' };
      states.set(this, { visible: true, navigation: createNavigateOnce(), route });
      this.setData(route);
    },
    onShow(this: ViewPage) {
      let state = states.get(this);
      if (!state) { state = { visible: true, navigation: createNavigateOnce(), route: {} }; states.set(this, state); }
      else if (!state.visible) state.navigation = createNavigateOnce();
      state.visible = true;
      this.setData({ ...empty, ...state.route, loggedIn: !!identity() });
    },
    onHide(this: ViewPage) {
      const state = states.get(this);
      if (state) { state.visible = false; state.navigation.dispose(); }
      this.setData({ ...empty, routeId: this.data.routeId ?? '' });
    },
    onUnload(this: ViewPage) {
      states.get(this)?.navigation.dispose();
      states.delete(this);
      this.setData(empty);
    },
    onPullDownRefresh() { wx.stopPullDownRefresh(); },
    onReachBottom: blockOrderAction,
    refresh: blockOrderAction,
    refreshStatus: blockOrderAction,
    retryInitial: blockOrderAction,
    retryRefresh: blockOrderAction,
    retryLoadMore: blockOrderAction,
    goBack(this: object) { const state = states.get(this); if (state?.visible) navigateBackWithFallback(state.navigation); },
    onSecondaryNavigationBack(this: object) { const state = states.get(this); if (state?.visible) navigateBackWithFallback(state.navigation); },
    goOrders(this: object) { navigate(this, '/pages/orders/index', true); },
    openLogin(this: object) { navigate(this, '/pages/login/index'); },
    openSupport(this: object) { navigate(this, '/pages/chat/index?mode=support'); },
    openWithdrawal(this: object) { navigate(this, '/pages/withdrawal/index'); },
    openWithdrawalRecords(this: object) { navigate(this, '/pages/withdrawal/index?view=records'); },
    goDetail(this: ViewPage) {
      if (this.data.routeId) navigate(this, '/pages/order-detail/index?id=' + encodeURIComponent(this.data.routeId));
      else navigate(this, '/pages/orders/index', true);
    },
  };
}
