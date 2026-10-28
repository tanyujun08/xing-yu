import { demoExtras } from '../../preview/extras';
import { accountApi } from '../../shared/api/account-api';
import { type PrivateConversationView } from '../../shared/presentation/info';
import { designAssets } from '../../shared/design/assets';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    loggedIn: accountApi.sessionIdentity() !== null,
    conversations: [] as PrivateConversationView[],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const loggedIn = accountApi.sessionIdentity() !== null;
    // Conversations are readable per order only (GET /v1/rental-orders/{order_id}/messages),
    // and the order list projection carries no business mode, so this page no longer
    // aggregates a first-level list from a local fixture.
    this.setData({ loggedIn, conversations: [] as PrivateConversationView[] });
  },

  openLogin() { wx.navigateTo({ url: '/pages/login/index' }); },

  openConversation(event: WechatMiniprogram.TouchEvent) {
    const orderId = String(event.currentTarget.dataset['orderId'] ?? '');
    if (orderId) wx.navigateTo({ url: `/pages/chat/index?mode=c2c&orderId=${encodeURIComponent(orderId)}` });
  },
  ...demoExtras('private-messages'),
});
