import { demoWx } from '../../preview/platform';
import { accountApi, type OwnAuthenticators } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';

type Runtime = { scope: ReturnType<typeof createOperationScope>; navigation: ReturnType<typeof createNavigateOnce>; epoch: number; visible: boolean; active?: { abort: () => void } };
const states = new WeakMap<object, Runtime>();
function state(page: object): Runtime {
  let current = states.get(page);
  if (!current) {
    current = { scope: createOperationScope(), navigation: createNavigateOnce(), epoch: 0, visible: false };
    states.set(page, current);
  }
  return current;
}

function project(view: OwnAuthenticators) {
  return {
    securityVersion: view.security_version,
    phoneText: view.phone_bound ? view.phone_masked || '已绑定（号码不可展示）' : '未绑定',
    wechatText: view.wechat_bound ? '已绑定' : '未绑定',
    phoneActionText: view.phone_bound ? '换绑手机号' : '绑定手机号',
    phoneActionEnabled: view.allowed_actions.some(action => action.code === (view.phone_bound ? 'REBIND_PHONE' : 'BIND_PHONE') && action.enabled),
    unbindPhoneEnabled: view.allowed_actions.some(action => action.code === 'UNBIND_PHONE' && action.enabled),
    wechatActionEnabled: view.allowed_actions.some(action => action.code === 'BIND_WECHAT' && action.enabled),
  };
}

type SecurityPage = { data: { securityVersion: number; actionBusy: boolean }; setData(value: Record<string, unknown>): void };
async function applyMutation(page: SecurityPage, operation: () => Promise<OwnAuthenticators>): Promise<void> {
  const runtime = state(page);
  const owner = accountApi.sessionIdentity();
  if (!owner || !runtime.visible || page.data.actionBusy || page.data.securityVersion < 1) return;
  runtime.active?.abort();
  delete runtime.active;
  const epoch = ++runtime.epoch;
  page.setData({ actionBusy: true, errorText: '' });
  try {
    const result = await operation();
    if (runtime.visible && epoch === runtime.epoch && accountApi.sessionIdentity() === owner) {
      if (result.account_id !== owner) throw new Error('账户响应不一致');
      page.setData(project(result));
    }
  } catch (error) {
    if (runtime.visible && epoch === runtime.epoch && accountApi.sessionIdentity() === owner)
      page.setData({ errorText: error instanceof Error ? error.message : '操作结果暂不确定，请刷新账户安全状态' });
  } finally {
    if (runtime.visible && epoch === runtime.epoch) page.setData({ actionBusy: false });
  }
}

Page({
  data: {
    icons: designAssets, loading: false, errorText: '', phoneText: '—', wechatText: '—',
    securityVersion: 0, actionBusy: false,
    phoneActionText: '绑定手机号', phoneActionEnabled: false, unbindPhoneEnabled: false, wechatActionEnabled: false,
  },
  onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
  onShow() {
    const runtime = state(this);
    runtime.visible = true;
    void this.loadAuthenticators();
  },
  async loadAuthenticators() {
    const runtime = state(this);
    runtime.active?.abort();
    const epoch = ++runtime.epoch;
    const owner = accountApi.sessionIdentity();
    this.setData({ loading: !!owner, errorText: '', phoneText: '—', wechatText: '—', securityVersion: 0, phoneActionEnabled: false, unbindPhoneEnabled: false, wechatActionEnabled: false });
    if (!owner) {
      runtime.navigation.navigateOnce('login', callbacks => wx.redirectTo({ url: '/pages/login/index?source=account-security', ...callbacks }));
      return;
    }
    const request = accountApi.authenticators();
    runtime.active = request;
    try {
      const response = await request.promise;
      if (!runtime.visible || runtime.scope.disposed || epoch !== runtime.epoch || accountApi.sessionIdentity() !== owner) return;
      if (response.account_id !== owner) throw new Error('账户响应不一致');
      this.setData(project(response));
    } catch (error) {
      if (runtime.visible && !runtime.scope.disposed && epoch === runtime.epoch && accountApi.sessionIdentity() === owner)
        this.setData({ errorText: error instanceof Error ? error.message : '账户安全读取失败，请重试' });
    } finally {
      if (runtime.active === request) delete runtime.active;
      if (runtime.visible && epoch === runtime.epoch) this.setData({ loading: false });
    }
  },
  onHide() {
    const runtime = state(this);
    runtime.visible = false;
    ++runtime.epoch;
    runtime.active?.abort();
    delete runtime.active;
    this.setData({ loading: false, actionBusy: false, phoneText: '—', wechatText: '—', securityVersion: 0, phoneActionEnabled: false, unbindPhoneEnabled: false, wechatActionEnabled: false });
  },
  onUnload() {
    this.onHide();
    const runtime = state(this);
    runtime.scope.dispose();
    runtime.navigation.dispose();
    states.delete(this);
  },
  onPhoneAuthorized(event: WechatMiniprogram.CustomEvent<{ code?: string; errMsg?: string }>) {
    const code = event.detail?.code;
    if (!code) { this.setData({ errorText: '未获得微信手机号授权，请重试。' }); return; }
    const version = this.data.securityVersion;
    void applyMutation(this, () => accountApi.bindPhone(code, version).promise);
  },
  unbindPhone() {
    if (!this.data.unbindPhoneEnabled || this.data.actionBusy) return;
    const version = this.data.securityVersion;
    wx.showModal({ title: '解绑手机号', content: '解绑后只能使用已绑定的微信登录。',
      success: result => { if (result.confirm) void applyMutation(this, () => accountApi.unbindPhone(version).promise); },
    });
  },
  bindWechat() {
    if (!this.data.wechatActionEnabled || this.data.actionBusy) return;
    const version = this.data.securityVersion;
    demoWx.login({ success: result => {
      if (!result.code) { this.setData({ errorText: '微信登录未返回凭证，请重试。' }); return; }
      void applyMutation(this, () => accountApi.bindWechat(result.code, version).promise);
    }, fail: () => this.setData({ errorText: '微信授权不可用，请稍后重试。' }) });
  },
demoPhoneAuthorize() { this.onPhoneAuthorized({ detail: { code: 'OFFLINE_DEMO_PHONE_CODE' } } as WechatMiniprogram.CustomEvent<{code?:string;errMsg?:string}>); },
});
