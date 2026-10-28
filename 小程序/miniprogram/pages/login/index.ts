import { readLoginReturn, returnFromLogin } from '../../shared/interaction/login-return';
import { accountApi } from '../../shared/api/account-api';
import { openLoginLegal, runLoginSheet } from '../../shared/interaction/login-sheet-host';
import { createNavigateOnce, navigateBackWithFallback, type NavigateOnce } from '../../shared/interaction/navigate-once';

const loginNavigationByPage = new WeakMap<object, NavigateOnce>();
function navigationFor(page: object): NavigateOnce {
  const current = loginNavigationByPage.get(page);
  if (current) return current;
  const created = createNavigateOnce();
  loginNavigationByPage.set(page, created);
  return created;
}

Page({
  data: { returnToCabinetDetail: false, returnTarget: readLoginReturn({}) },
  onLoad(options: Record<string, string | undefined>) {
    navigationFor(this);
    this.setData({ returnToCabinetDetail: options.source === 'cabinet-detail', returnTarget: readLoginReturn(options) });
  },
  onUnload() {
    const navigation = loginNavigationByPage.get(this);
    if (navigation) navigation.dispose();
    loginNavigationByPage.delete(this);
  },
  onWechatLogin() { void runLoginSheet(this, () => accountApi.login(), () => this.completeLoginNavigation()); },
  onPhoneLogin(event: WechatMiniprogram.CustomEvent<{ phoneCode: string }>) { void runLoginSheet(this, () => accountApi.phoneLogin(event.detail.phoneCode), () => this.completeLoginNavigation()); },
  isLoginHostActive() { return loginNavigationByPage.has(this); },
  onLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>) { openLoginLegal(event); },
  onLoginCancel() { this.browseAsGuest(); },
  completeLoginNavigation() {
    returnFromLogin(this.data.returnTarget, navigationFor(this), ['addresses', 'cabinet-detail', 'account-security','lottery','coupons','coupon-detail','publish-quota','powder-ledger','check-in'].includes(this.data.returnTarget.source) || !this.data.returnTarget.source);
  },
  browseAsGuest() {
    if (this.data.returnToCabinetDetail) {
      navigationFor(this).navigateOnce('login:cabinet-detail:guest', callbacks => wx.navigateBack({ delta: 1, ...callbacks }));
      return;
    }
    navigationFor(this).navigateOnce('login:guest:home', callbacks => wx.switchTab({ url: '/pages/home/index', ...callbacks }));
  },
  goBack() { navigateBackWithFallback(navigationFor(this)); },
});
