import { designAssets } from '../../shared/design/assets';
import { infoGuideDirectory, infoGuideView, type InfoGuideView } from '../../shared/presentation/info-guides';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    missing: false,
    directory: false,
    entries: infoGuideDirectory(),
    guide: null as InfoGuideView | null,
  },

  onLoad(options: Record<string, string | undefined>) {
    if (!options.id) { this.setData({ directory: true, missing: false, secondaryNavigationTitle: '租赁指南' }); return; }
    const guide = infoGuideView(options.id ?? '');
    if (!guide) { this.setData({ missing: true }); return; }
    // The legacy reading-journey counter lived only in the mock fixture and has no server
    // contract, so this page no longer fabricates a reward for opening a guide.
    this.setData({ secondaryNavigationTitle: guide.title });
    this.setData({ guide });
  },

  goBack() { wx.navigateBack(); },
  openEntry(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const entry = this.data.entries.find((item) => item.id === id);
    if (entry) wx.navigateTo({ url: entry.route });
  },
});
