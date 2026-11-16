import { designAssets } from '../../shared/design/assets';
import { infoGuideDirectory, infoGuideView, type InfoGuideView } from '../../shared/presentation/info-guides';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    missing: false,
    tabs: [] as { id: string; title: string }[],
    activeId: '',
    guide: null as InfoGuideView | null,
    legal: false,
    secondaryNavigationTitle: '租赁指南',
  },

  // The three rental guides share one page with a segment switch; the agreement and privacy policy
  // open on their own as plain reading text. The legacy reading-journey counter lived only in the
  // mock fixture and has no server contract, so opening a guide does not fabricate a reward.
  onLoad(options: Record<string, string | undefined>) {
    const entries = infoGuideDirectory();
    const id = options.id || entries[0]?.id || '';
    const guide = infoGuideView(id);
    if (!guide) { this.setData({ missing: true }); return; }
    const inDirectory = entries.some((entry) => entry.id === id);
    this.setData({ tabs: inDirectory ? entries.map((entry) => ({ id: entry.id, title: entry.title })) : [], activeId: id, guide, legal: !inDirectory, secondaryNavigationTitle: inDirectory ? '租赁指南' : guide.title });
  },

  chooseTab(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const guide = infoGuideView(id);
    if (guide) this.setData({ activeId: id, guide });
  },

  goBack() { wx.navigateBack(); },
  openSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
