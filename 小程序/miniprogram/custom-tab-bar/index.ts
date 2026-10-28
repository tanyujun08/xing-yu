import { designAssets } from '../shared/design/assets';
import { unreadLabel } from '../shared/presentation/order-conversation';
import { readOrderUnread, subscribeOrderUnread } from '../shared/model/order-unread';

const subscriptions = new WeakMap<object, () => void>();

interface TabItem {
  pagePath: string;
  text: string;
  icon?: string;
  selectedIcon?: string;
}

const tabs: TabItem[] = [
  { pagePath: '/pages/home/index', text: '首页', icon: designAssets.tabHome, selectedIcon: designAssets.tabHomeSelected },
  { pagePath: '/pages/orders/index', text: '订单', icon: designAssets.tabOrders, selectedIcon: designAssets.tabOrdersSelected },
  { pagePath: '/pages/info/index', text: '沟通', icon: designAssets.tabCommunication, selectedIcon: designAssets.tabCommunicationSelected },
  { pagePath: '/pages/profile/index', text: '我的', icon: designAssets.tabProfile, selectedIcon: designAssets.tabProfileSelected },
];

Component({
  data: {
    selected: 0,
    overlayHidden: false,
    unreadText: '',
    tabs,
  },

  lifetimes: {
    attached() {
      this.syncSelected();
      this.watchUnread();
    },
    detached() { subscriptions.get(this)?.(); subscriptions.delete(this); },
  },

  pageLifetimes: {
    show() {
      this.syncSelected();
      this.watchUnread();
    },
    hide() { subscriptions.get(this)?.(); subscriptions.delete(this); },
  },

  methods: {
    watchUnread() {
      subscriptions.get(this)?.();
      const refresh = () => this.setData({ unreadText: unreadLabel(readOrderUnread()) });
      subscriptions.set(this, subscribeOrderUnread(refresh)); refresh();
    },
    syncSelected() {
      const pages = getCurrentPages();
      const currentRoute = pages[pages.length - 1]?.route;
      const selected = tabs.findIndex((item) => item.pagePath === `/${currentRoute}`);
      if (selected >= 0) this.setData({ selected });
    },
    switchTab(event: WechatMiniprogram.TouchEvent) {
      if (this.data.overlayHidden) return;
      const url = String(event.currentTarget.dataset['route'] ?? tabs[0]?.pagePath ?? '/pages/home/index');
      wx.switchTab({ url });
    },
  },
});
