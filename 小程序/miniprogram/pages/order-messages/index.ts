import { accountApi } from '../../shared/api/account-api';
import { type OrderMessageView } from '../../shared/presentation/info';
import { designAssets } from '../../shared/design/assets';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    loggedIn: accountApi.sessionIdentity() !== null,
    messages: [] as OrderMessageView[],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const loggedIn = accountApi.sessionIdentity() !== null;
    // No server read model exists for an order/progress message feed, so the list stays empty
    // instead of being rebuilt from a local fixture.
    this.setData({ loggedIn, messages: [] as OrderMessageView[] });
  },

  openLogin() { wx.navigateTo({ url: '/pages/login/index' }); },

  openOrder(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (id) wx.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(id)}` });
  },
});
