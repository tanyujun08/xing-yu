import { accountApi } from '../api/account-api';
import { openLoginLegal, runLoginSheet } from './login-sheet-host';

import { openLoginHere } from './login-open';
export { openLoginHere };

type HostPage = { selectComponent(selector: string): unknown; onLoginSuccess?(): unknown; onShow?(): unknown };

function afterLogin(page: HostPage): unknown {
  if (typeof page.onLoginSuccess === 'function') return page.onLoginSuccess();
  if (typeof page.onShow === 'function') return page.onShow();
  return undefined;
}

/** 放进 Page({...}) 的登录弹窗事件处理。 */
export const loginHostMethods = {
  onWechatLogin(this: HostPage) { void runLoginSheet(this, () => accountApi.login(), () => afterLogin(this) as void); },
  onPhoneLogin(this: HostPage, event: WechatMiniprogram.CustomEvent<{ phoneCode: string }>) { void runLoginSheet(this, () => accountApi.phoneLogin(event.detail.phoneCode), () => afterLogin(this) as void); },
  onLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>) { openLoginLegal(event); },
};
