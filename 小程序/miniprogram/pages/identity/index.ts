import { accountApi } from '../../shared/api/account-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { identityInput, IdentityInputError } from '../../shared/presentation/identity-input';

const states = new WeakMap<object, ReturnType<typeof createRentalPageState<null>> & { intent: string; intentOwner: string; payload: string; readEpoch: number }>();
function state(page: object) {
  let value = states.get(page);
  if (!value) { value = { ...createRentalPageState<null>(), intent: '', intentOwner: '', payload: '', readEpoch: 0 }; states.set(page, value); }
  return value;
}
function captureIdentitySessionLoss(s: ReturnType<typeof state>) {
  const epoch = s.epoch, owner = s.owner;
  return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}
Page({
  data: { loading: false, busy: false, loaded: false, errorText: '', errorField: '', completed: false, realName: '', identityNumber: '', overallText: '—' },
  onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? '';
    if (owner && (s.intentOwner && owner !== s.intentOwner || s.owner && owner !== s.owner)) { s.intent = ''; s.intentOwner = ''; s.payload = ''; this.clearUnavailableSession(); }
    s.show(owner); void this.loadStatus(); },
  clearUnavailableSession() {
    // The original in-memory intent remains bound to this page's owner; a read must not replace an UNKNOWN save.
    this.setData({ loading: false, busy: false, loaded: false, completed: false, realName: '', identityNumber: '', overallText: '—', errorField: '', errorText: '登录状态已失效或变化，请重新登录后读取实名信息' });
  },
  async loadStatus() {
    const s = state(this), epoch = s.epoch, readEpoch = ++s.readEpoch;
    const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readEpoch === readEpoch;
    const lease = s.capture(accountApi.sessionIdentity), sessionLost = captureIdentitySessionLoss(s), active = () => viewCurrent() && lease();
    if (!active()) { if (viewCurrent()) this.clearUnavailableSession(); return; }
    if (!s.owner) { this.clearUnavailableSession(); s.navigation.navigateOnce('login', callbacks => wx.navigateTo({ url: '/pages/login/index', ...callbacks })); return; }
    this.setData({ loading: true, errorText: '', errorField: '' });
    try {
      const value = await accountApi.identity().promise;
      if (!active()) return;
      const completed = value.real_name.status === 'VERIFIED';
      this.setData({ loaded: true, completed, overallText: completed ? '实名信息已填写' : '请填写实名信息', ...(completed ? { realName: '', identityNumber: '' } : {}) });
    } catch (error) {
      if (active()) this.setData({ errorText: error instanceof Error ? error.message : '实名信息读取失败' });
    } finally { if (sessionLost()) this.clearUnavailableSession(); else if (viewCurrent() && lease()) this.setData({ loading: false }); }
  },
  inputName(event: WechatMiniprogram.Input) { if (!this.data.busy && !this.data.completed) this.setData({ realName: event.detail.value, errorText: '', errorField: '' }); },
  // Keep native input/cursor state while typing; identityInput normalizes on submission.
  inputIdentity(event: WechatMiniprogram.Input) { if (!this.data.busy && !this.data.completed) this.setData({ identityNumber: event.detail.value, errorText: '', errorField: '' }); },
  async saveIdentity() {
    const s = state(this);
    await s.run('save-identity', async () => {
      const epoch = s.epoch, readEpoch = s.readEpoch;
      const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readEpoch === readEpoch;
      const active = s.capture(accountApi.sessionIdentity), sessionLost = captureIdentitySessionLoss(s);
      if (!active() || !s.owner || !this.data.loaded || this.data.completed) return;
      this.setData({ busy: true, errorText: '', errorField: '' });
      try {
        const body = identityInput(this.data.realName, this.data.identityNumber), payload = JSON.stringify(body);
        if (s.payload && s.payload !== payload) throw new Error('原保存结果待确认，请先查询实名状态或使用原内容重试');
        if (s.payload !== payload) { s.intent = accountApi.newIntent('identity'); s.intentOwner = s.owner; s.payload = payload; }
        const saved = await accountApi.saveIdentity(body, s.intent).promise;
        if (!active()) return;
        if (saved.status !== 'VERIFIED' || saved.check_kind !== 'REAL_NAME') throw new Error('保存结果待核实，请重新查询实名状态');
        this.setData({ realName: '', identityNumber: '' }); s.payload = ''; s.intent = ''; s.intentOwner = '';
        await this.loadStatus();
        if (active() && this.data.completed) navigateBackWithFallback(s.navigation);
      } catch (error) {
        if (active() && error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500 && ![408, 409, 429].includes(error.statusCode)) { s.payload = ''; s.intent = ''; s.intentOwner = ''; }
        if (active() && viewCurrent()) this.setData({ errorText: error instanceof Error ? error.message : '保存结果待核实，请重新查询实名状态', errorField: error instanceof IdentityInputError ? error.field : '' });
      } finally { if (active()) this.setData({ busy: false }); else if (sessionLost()) this.clearUnavailableSession(); }
    });
  },
  primary() { if (this.data.completed) this.onSecondaryNavigationBack(); else void this.saveIdentity(); },
  onHide() { state(this).hide(); this.setData({ loading: false, busy: false, loaded: false, realName: '', identityNumber: '', completed: false, overallText: '—', errorText: '', errorField: '' }); },
  onUnload() { this.onHide(); const s = state(this); s.intent = ''; s.intentOwner = ''; s.payload = ''; s.dispose(); },
  onSecondaryNavigationBack() { if (this.data.busy) return; navigateBackWithFallback(state(this).navigation); },
});
