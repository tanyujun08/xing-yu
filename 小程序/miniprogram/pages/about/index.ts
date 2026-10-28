import { designAssets } from '../../shared/design/assets';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: { version: '1.0.0.16', icons: designAssets },
  onLoad() { const app = getApp<{ globalData: { version: string } }>(); this.setData({ version: app.globalData.version }); },
  openPolicy(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (id !== 'user-agreement' && id !== 'privacy-policy') return;
    wx.navigateTo({ url: '/pages/info-guide/index?id=' + encodeURIComponent(id) });
  },
});
