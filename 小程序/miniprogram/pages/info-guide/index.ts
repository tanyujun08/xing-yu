import { designAssets } from '../../shared/design/assets';
import { infoGuideDirectory, infoGuideView, type InfoGuideView } from '../../shared/presentation/info-guides';
import { readDemo, runDemoExtra } from '../../preview/engine';
import { readDemoGuideIds } from '../../preview/loyalty-rules';
import { isLinked, linkedAction } from '../../preview/linked';

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    icons: designAssets,
    missing: false,
    tabs: [] as { id: string; title: string }[],
    activeId: '',
    guide: null as InfoGuideView | null,
    legal: false,
    fromTask: false,
    readIds: [] as string[],
    currentRead: false,
    markingRead: false,
    secondaryNavigationTitle: '租赁指南',
  },

  // The three rental guides share one page. Legal texts stay outside the reading task.
  onLoad(options: Record<string, string | undefined>) {
    const entries = infoGuideDirectory();
    const id = options.id || entries[0]?.id || '';
    const guide = infoGuideView(id);
    if (!guide) { this.setData({ missing: true }); return; }
    const inDirectory = entries.some((entry) => entry.id === id);
    const fromTask = inDirectory && options.from === 'task-center';
    const readIds = fromTask ? readDemoGuideIds(readDemo()) : [];
    this.setData({ tabs: inDirectory ? entries.map((entry) => ({ id: entry.id, title: entry.title })) : [], activeId: id, guide,
      legal: !inDirectory, fromTask, readIds, currentRead: readIds.includes(id), secondaryNavigationTitle: inDirectory ? '租赁指南' : guide.title });
  },

  chooseTab(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset['id'] ?? '');
    if (!this.data.tabs.some(tab => tab.id === id)) return;
    const guide = infoGuideView(id);
    if (guide) {
      this.setData({ activeId: id, guide, currentRead: this.data.readIds.includes(id) });
      if (this.data.fromTask) wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }
  },

  async markGuideRead() {
    const { activeId, fromTask, currentRead, markingRead } = this.data;
    if (!fromTask || currentRead || markingRead) return;
    this.setData({ markingRead: true });
    const values = { id: activeId };
    const key = 'growth-read-guide:' + activeId;
    try {
      const result = isLinked() ? await linkedAction('extra', { kind: 'readRentalGuide', values, key })
        : runDemoExtra('readRentalGuide', values, key);
      const readIds = [...new Set<string>([...this.data.readIds, ...result.readIds])];
      this.setData({ readIds, currentRead: readIds.includes(this.data.activeId) });
    } catch {
      wx.showToast({ title: '阅读进度未保存，请重试', icon: 'none' });
    } finally {
      this.setData({ markingRead: false });
    }
  },

  goBack() { wx.navigateBack(); },
  openSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
