import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalOrder } from '../../shared/api/rental-api';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { rentalFeeView } from '../../shared/presentation/rental-fees';
import { designAssets } from '../../shared/design/assets';

function newState(id: string) { return { id, owner: accountApi.sessionIdentity() ?? '', visible: true, scope: createOperationScope(), navigation: createNavigateOnce(), order: null as RentalOrder | null }; }
const states = new WeakMap<object, ReturnType<typeof newState>>();
const empty = { loaded: false, loading: false, errorText: '', unavailable: false, fees: null as ReturnType<typeof rentalFeeView>, previewError: '' };
function current(state: ReturnType<typeof newState>) { return state.visible && !state.scope.disposed && state.owner === (accountApi.sessionIdentity() ?? ''); }
Page({
  data: { ...empty, successIcon: designAssets.returnSuccess },
  onLoad(options: Record<string, string | undefined>) { states.set(this, newState(options['orderId'] ?? '')); },
  onShow() {
    const old = states.get(this); if (!old) return;
    old.visible = false; old.scope.dispose(); old.navigation.dispose();
    states.set(this, newState(old.id)); this.setData({ ...empty });
    return this.refresh();
  },
  onHide() { const state = states.get(this); if (!state) return; state.visible = false; state.order = null; state.scope.dispose(); state.navigation.dispose(); this.setData({ ...empty }); },
  onUnload() { this.onHide(); const state = states.get(this); if (state) { state.scope.dispose(); state.navigation.dispose(); } states.delete(this); },
  async refresh() {
    const state = states.get(this); if (!state || !current(state)) return;
    if (!state.owner || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(state.id)) { this.setData({ ...empty, errorText: '请登录后从本人订单进入费用依据' }); return; }
    return state.scope.singleFlight('read', async () => {
      state.order = null; this.setData({ ...empty, loading: true });
      const handle = rentalOrderApi.get(state.id), release = state.scope.registerCleanup(handle.abort);
      try {
        const result = await handle.promise; if (!current(state)) return;
        if (result.value.order.order_id !== state.id) throw new Error('费用依据与本单不匹配，请返回订单重新读取');
        const fees = rentalFeeView(result.value); state.order = result.value;
        this.setData({ loaded: true, unavailable: !fees, fees });
      } catch (error) { if (current(state)) this.setData({ ...empty, errorText: error instanceof Error ? error.message : '费用依据读取失败，请重试' }); }
      finally {
        release();
        if (states.get(this) === state && state.visible && !current(state)) { state.order = null; this.setData({ ...empty, errorText: '登录状态已变化，请返回重新登录' }); }
        else if (current(state)) this.setData({ loading: false });
      }
    });
  },
  previewProof(event: WechatMiniprogram.TouchEvent) {
    const state = states.get(this), fees = this.data.fees;
    if (!state || !current(state) || !fees || event.currentTarget.dataset['review'] !== fees.reviewId) return;
    const items = [...fees.lossItems.flatMap(item => item.evidence), ...fees.evidence];
    const proof = items.find(item => item.key === event.currentTarget.dataset['key']);
    if (!proof?.available) return;
    return state.scope.singleFlight('preview', async () => {
      this.setData({ previewError: '' });
      try {
        if (proof.kind === 'PHOTO') await new Promise<void>((resolve, reject) => wx.previewImage({ current: proof.url, urls: items.filter(item => item.available && item.kind === 'PHOTO').map(item => item.url), success: () => resolve(), fail: reject }));
        else await new Promise<void>((resolve, reject) => wx.previewMedia({ sources: [{ url: proof.url, type: 'video', poster: proof.poster }], success: () => resolve(), fail: reject }));
      } catch { if (current(state) && this.data.fees?.reviewId === fees.reviewId) this.setData({ previewError: '凭证暂时无法打开，请重试原凭证或联系官方客服' }); }
    });
  },
  returnToOrder() {
    const state = states.get(this); if (!state || !state.visible) return;
    const stack = getCurrentPages(), prior = stack[stack.length - 2];
    if (prior?.route === 'pages/order-detail/index' && (prior.options['id'] ?? prior.options['orderId']) === state.id) {
      state.navigation.navigateOnce('order', callbacks => wx.navigateBack({ ...callbacks }));
    } else if (current(state) && state.owner && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(state.id)) {
      state.navigation.navigateOnce('order', callbacks => wx.redirectTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(state.id), ...callbacks }));
    } else state.navigation.navigateOnce('orders', callbacks => wx.switchTab({ url: '/pages/orders/index', ...callbacks }));
  },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
