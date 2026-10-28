import { accountApi, ApiProblem } from '../../shared/api/account-api';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';

function createRuntime() {
  return { scope: createOperationScope(), navigation: createNavigateOnce(), scan: '', accountId: null as string | null, intent: null as { key: string; approve: boolean } | null };
}
const runtimes = new WeakMap<object, ReturnType<typeof createRuntime>>();

Page({
  data: { loggedIn: false, busy: false, purpose: '', status: '', displayName: '', phoneMasked: '', error: '', uncertain: false },
  onLoad(options: Record<string, string | undefined>) {
    const runtime = createRuntime();
    runtimes.set(this, runtime);
    try { runtime.scan = decodeURIComponent(options.scene ?? ''); } catch { runtime.scan = ''; }
    if (!/^[A-Za-z0-9_-]{24,32}$/.test(runtime.scan)) { runtime.scan = ''; this.setData({ error: '二维码无效，请在管理后台重新生成。' }); }
  },
  onShow() {
    const runtime = runtimes.get(this);
    if (!runtime) return;
    if (runtime.scope.disposed) runtime.scope = createOperationScope();
    const uncertain = runtime.intent !== null && this.data.status === 'PENDING';
    this.setData({ busy: false, uncertain, ...(uncertain ? { error: '请重试原请求，确认刚才的操作结果。' } : {}) });
    if (!uncertain) void this.inspect();
  },
  onHide() { runtimes.get(this)?.scope.dispose(); },
  onUnload() { const runtime = runtimes.get(this); runtime?.scope.dispose(); runtime?.navigation.dispose(); runtimes.delete(this); },
  onBack() { const runtime = runtimes.get(this); if (runtime) navigateBackWithFallback(runtime.navigation); },
  async inspect() {
    const runtime = runtimes.get(this);
    if (!runtime?.scan || this.data.busy || this.data.uncertain) return;
    const scope = runtime.scope;
    const accountId = accountApi.sessionIdentity();
    this.setData({ loggedIn: accountId !== null });
    if (accountId === null) return;
    if (runtime.accountId !== accountId) { runtime.accountId = accountId; runtime.intent = null; }
    this.setData({ busy: true, error: '' });
    try {
      const result = await scope.latest('inspect', () => accountApi.inspectOpsChallenge(runtime.scan).promise);
      if (result.accepted && accountApi.sessionIdentity() === accountId) {
        const value = result.value;
        this.setData({ purpose: value.purpose, status: value.status, displayName: value.display_name ?? '', phoneMasked: value.phone_masked ?? '' });
      }
    } catch { if (!scope.disposed) this.setData({ error: '无法读取确认请求，请重试。' }); }
    finally { if (!scope.disposed) this.setData({ busy: false }); }
  },
  async login() {
    const runtime = runtimes.get(this);
    if (!runtime || this.data.busy) return;
    const scope = runtime.scope;
    this.setData({ busy: true, error: '' });
    try { await scope.singleFlight('login', () => accountApi.login()); }
    catch { if (!scope.disposed) this.setData({ error: '微信登录未成功，请重试。' }); }
    finally { if (!scope.disposed) { this.setData({ busy: false }); void this.inspect(); } }
  },
  approve() { void this.decide(true); },
  reject() { void this.decide(false); },
  retryDecision() { const intent = runtimes.get(this)?.intent; if (intent) void this.decide(intent.approve); },
  async decide(approve: boolean) {
    const runtime = runtimes.get(this);
    if (!runtime?.scan || this.data.busy || this.data.status !== 'PENDING') return;
    const scope = runtime.scope;
    if (!runtime.accountId || runtime.accountId !== accountApi.sessionIdentity()) { this.setData({ error: '登录身份已变化，请重新扫描。' }); return; }
    if (runtime.intent && runtime.intent.approve !== approve) return;
    runtime.intent ??= { key: accountApi.newIntent('ops-consent'), approve };
    const intent = runtime.intent;
    this.setData({ busy: true, error: '' });
    try {
      const result = await scope.singleFlight('decision', () => accountApi.decideOpsChallenge(runtime.scan, intent.approve, intent.key).promise);
      if (!scope.disposed && runtime.accountId === accountApi.sessionIdentity()) this.setData({ status: result.status, uncertain: false });
    } catch (error) {
      if (!scope.disposed) {
        const definitive = error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408 && error.statusCode !== 429;
        if (definitive) runtime.intent = null;
        const unbound = error instanceof ApiProblem && error.statusCode === 403 && error.code === 'OPS_WECHAT_NOT_BOUND';
        this.setData({ uncertain: !definitive, error: unbound ? '此微信尚未绑定后台账号，请先在电脑使用手机号登录管理后台，完成微信绑定后重新扫码。' : definitive ? '确认失败，请重新查询状态或扫描新二维码。' : '确认结果暂未返回，请重试原请求。' });
      }
    } finally { if (!scope.disposed) this.setData({ busy: false }); }
  },
});
