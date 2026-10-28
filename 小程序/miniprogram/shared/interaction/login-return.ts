import type { NavigateOnce } from './navigate-once';

const loyaltySources = ['lottery','coupons','coupon-detail','publish-quota','powder-ledger','check-in'] as const;
const sources = [...loyaltySources, 'confirm', 'orders', 'addresses', 'identity', 'contract', 'wechat-waiver', 'order-detail', 'service-detail', 'cabinet-detail', 'account-security'] as const;
export interface LoginReturn { source: string; id: string; mode: string }

export function readLoginReturn(options: Record<string, string | undefined>): LoginReturn {
  const source = options.source ?? '';
  return { source: sources.some((item) => item === source) ? source : '', id: options.id ?? '', mode: options.mode === 'select' ? 'select' : 'manage' };
}

// The caller validates account/object access before navigation. No commands or arbitrary return URLs.
export function returnFromLogin(target: LoginReturn, navigation: NavigateOnce, valid: boolean): void {
  const fallback = () => {
    if (!valid) { wx.switchTab({ url: '/pages/orders/index' }); return; }
    if (target.source === 'orders') { wx.switchTab({ url: '/pages/orders/index' }); return; }
    if (target.id && ['identity', 'contract', 'wechat-waiver', 'order-detail', 'service-detail'].includes(target.source)) {
      wx.redirectTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(target.id)}` });
    } else if (target.source === 'confirm') {
      wx.redirectTo({ url: `/pages/confirm/index${target.id ? '?deviceId=' + encodeURIComponent(target.id) : ''}` });
    } else if (loyaltySources.some(source=>source===target.source)) {
      const query=target.id&&target.source==='coupon-detail'?'?coupon_id='+encodeURIComponent(target.id):'';
      wx.redirectTo({url:'/pages/'+target.source+'/index'+query});
    } else if (target.source === 'addresses') {
      wx.redirectTo({ url: `/pages/addresses/index?mode=${target.mode}` });
    } else if (target.source === 'account-security') {
      wx.redirectTo({ url: '/pages/account-security/index' });
    } else if (target.source === 'identity' && !target.id) {
      wx.redirectTo({ url: '/pages/identity/index' });
    } else { wx.switchTab({ url: '/pages/home/index' }); }
  };
  const pages = getCurrentPages();
  let index = -1;
  if (valid && target.source) {
    for (let i = pages.length - 2; i >= 0; i -= 1) {
      if (pages[i]?.route === `pages/${target.source}/index`) { index = i; break; }
    }
  }
  navigation.navigateOnce('login:return', (callbacks) => {
    if (index >= 0) {
      wx.navigateBack({ delta: pages.length - 1 - index, ...callbacks, fail: (error) => { callbacks.fail(error); fallback(); } });
    } else { fallback(); callbacks.complete(); }
  });
}
