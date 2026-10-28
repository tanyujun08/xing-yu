import { accountApi, couponApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createCursorList, type CursorList, type CursorListPatch } from '../../shared/interaction/cursor-list';
import { createNavigateOnce, type NavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope, type OperationScope } from '../../shared/interaction/operation-scope';
import type { OwnCoupon as CouponWalletItem, OwnCouponStatus as CouponWalletFilter } from '../../shared/model/api-coupon';
import type { ListState } from '../../shared/model/view-state';
import { presentOwnCoupon as presentCouponWalletItem } from '../../shared/presentation/api-coupon';
import type { CouponType } from '../../shared/model/api-loyalty';
import { couponTitles } from '../../shared/presentation/loyalty';
type CouponWalletView = ReturnType<typeof presentCouponWalletItem>;

interface CouponRuntime {
  scope: OperationScope;
  navigation: NavigateOnce;
  list: CursorList<CouponWalletView> | null;
  accountId: string;
  filter: CouponWalletFilter;
  type: CouponType | '';
  visible: boolean;
}

const runtimes = new WeakMap<object, CouponRuntime>();
const filters: { id: CouponWalletFilter; label: string }[] = [
  { id: 'AVAILABLE', label: '可用' },
  { id: 'REDEEMED', label: '已兑换' },
];
const emptyTitles: Record<CouponWalletFilter, string> = {
  AVAILABLE: '暂无可用优惠券', REDEEMED: '暂无已兑换优惠券',
};
const types: {id:CouponType|'';label:string}[]=[{id:'',label:'全部类型'},...Object.entries(couponTitles).map(([id,label])=>({id:id as CouponType,label}))];

function runtimeFor(page: object): CouponRuntime {
  const current = runtimes.get(page);
  if (current) return current;
  const runtime: CouponRuntime = {
    scope: createOperationScope(), navigation: createNavigateOnce(),
    list: null, accountId: '', filter: 'AVAILABLE', type:'',visible:false,
  };
  runtimes.set(page, runtime);
  return runtime;
}

Page({
  data: {
    loggedIn: false,
    filters,
    types, type:'' as CouponType|'',
    filter: 'AVAILABLE' as CouponWalletFilter,
    emptyTitle: emptyTitles.AVAILABLE,
    illustration: designAssets.emptyLedger,
    items: [] as CouponWalletView[],
    listState: { phase: 'empty' } as ListState,
  },

  onLoad(options: Record<string,string|undefined> = {}) { runtimeFor(this); if(types.some(item=>item.id===options['coupon_type']))this.setData({type:options['coupon_type'] as CouponType}); },
  onShow() { runtimeFor(this).visible=true; return this.loadCoupons('initial'); },
  onHide() {
    const runtime = runtimes.get(this);
    if(runtime)runtime.visible=false;
    runtime?.list?.dispose();
    if (runtime) runtime.list = null;
    runtime?.scope.onHide();
    this.setData({ items: [], loggedIn: false, listState: { phase: 'empty' } });
  },
  onUnload() {
    const runtime = runtimes.get(this);
    runtime?.list?.dispose();
    runtime?.scope.dispose();
    runtime?.navigation.dispose();
    runtimes.delete(this);
  },

  clearPrivateView() {
    const runtime = runtimes.get(this);
    runtime?.list?.dispose();
    if (runtime) { runtime.list = null; runtime.accountId = ''; }
    this.setData({ loggedIn: false, items: [], listState: { phase: 'empty' } });
  },

  loadCoupons(mode: 'initial' | 'refresh'): Promise<void> {
    const runtime = runtimeFor(this);
    if (runtime.scope.disposed) return Promise.resolve();
    if (!accountApi.sessionIdentity()) { this.clearPrivateView(); return Promise.resolve(); }
    const accountId = (accountApi.sessionIdentity() ?? '');
    const filter = this.data.filter;
    const type=this.data.type;
    if (!runtime.list || runtime.accountId !== accountId || runtime.filter !== filter || runtime.type!==type) {
      runtime.list?.dispose();
      runtime.accountId = accountId;
      runtime.filter = filter;
      runtime.type=type;
      this.setData({ items: [], listState: { phase: 'initial-loading' } });
      runtime.list = createCursorList<CouponWalletItem, CouponWalletView>({
        load: async (request) => {
          if (!accountApi.sessionIdentity() || (accountApi.sessionIdentity() ?? '') !== accountId) throw new Error('请重新登录后查看');
          const handle = couponApi.list(filter, request.cursor, type||undefined);
          const release = runtime.scope.registerCleanup(handle.abort);
          try {
            const page = await handle.promise;
            if (page.items.some(item => item.account_id !== accountId || item.status !== filter || (type&&item.coupon_type!==type))) throw new Error('优惠券响应主体或状态不一致');
            return { items:page.items, hasMore:page.page.next_cursor!==null, nextCursor:page.page.next_cursor, generation:request.generation ?? accountApi.newIntent('coupon-query') };
          } finally { release(); }
        },
        present: presentCouponWalletItem,
        getId: (item) => item.coupon_id,
        onPatch: (patch) => {
          if (runtime.scope.disposed||!runtime.visible) return;
          if (!accountApi.sessionIdentity() || (accountApi.sessionIdentity() ?? '') !== accountId) { this.clearPrivateView(); return; }
          this.applyCouponPatch(patch);
        },
      });
      mode = 'initial';
    }
    this.setData({ loggedIn: true, emptyTitle: emptyTitles[filter] });
    return mode === 'refresh' ? runtime.list.refresh() : runtime.list.initial();
  },

  applyCouponPatch(patch: CursorListPatch<CouponWalletView>) {
    const data: Record<string, unknown> = { listState: patch.state };
    if (patch.replace) data['items'] = patch.replace;
    for (const item of patch.append ?? []) data[item.path] = item.value;
    this.setData(data);
  },

  async onPullDownRefresh() {
    try { await this.loadCoupons('refresh'); }
    finally { wx.stopPullDownRefresh(); }
  },
  onReachBottom() {
    const runtime = runtimes.get(this);
    if (!accountApi.sessionIdentity() || (runtime && (accountApi.sessionIdentity() ?? '') !== runtime.accountId)) { this.clearPrivateView(); return; }
    void runtime?.list?.loadMore();
  },
  changeFilter(event: WechatMiniprogram.TouchEvent) {
    const filter = String(event.currentTarget.dataset['filter'] ?? '') as CouponWalletFilter;
    if (!filters.some((item) => item.id === filter) || filter === this.data.filter) return;
    this.setData({ filter, items: [], emptyTitle: emptyTitles[filter] });
    void this.loadCoupons('initial');
  },
  retryInitial() { void this.loadCoupons('initial'); },
  changeType(event: WechatMiniprogram.TouchEvent) {
    const type=String(event.currentTarget.dataset['type']??'') as CouponType|'';
    if(!types.some(item=>item.id===type)||type===this.data.type)return;
    this.setData({type,items:[]});void this.loadCoupons('initial');
  },
  retryRefresh() { void this.loadCoupons('refresh'); },
  retryLoadMore() { this.onReachBottom(); },

  openLogin() {
    const runtime = runtimeFor(this);
    runtime.navigation.navigateOnce('coupons:login', (callbacks) => wx.navigateTo({
      url: '/pages/login/index?source=coupons', ...callbacks,
      fail: runtime.scope.guard((error) => { callbacks.fail(error); wx.showToast({ title: '暂时无法打开登录，请重试', icon: 'none' }); }),
    }));
  },
  onBack() {
    const runtime = runtimeFor(this);
    runtime.navigation.navigateOnce('coupons:back', (callbacks) => wx.navigateBack({
      ...callbacks,
      fail: runtime.scope.guard((error) => {
        callbacks.fail(error);
        runtime.navigation.navigateOnce('coupons:profile', (fallback) => wx.switchTab({ url: '/pages/profile/index', ...fallback }));
      }),
    }));
  },
  openCoupon(event: WechatMiniprogram.TouchEvent) {
    const runtime=runtimeFor(this);const id=String(event.currentTarget.dataset['id']??'');
    if(!runtime.visible||runtime.accountId!==accountApi.sessionIdentity()||!this.data.items.some(item=>item.id===id))return;
    runtime.navigation.navigateOnce('coupon:'+id,callbacks=>wx.navigateTo({url:'/pages/coupon-detail/index?coupon_id='+encodeURIComponent(id),...callbacks}));
  },
});
