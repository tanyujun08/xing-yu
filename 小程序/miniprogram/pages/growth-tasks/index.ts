import { accountApi, benefitApi, loyaltyTraceApi, readGrowthTaskIntent, prepareGrowthTaskIntent, clearConfirmedGrowthTaskIntent } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { watchDayRefresh, stopDayRefresh, disposeDayRefresh, dayPageDisposed } from '../../shared/interaction/day-refresh';
import type { GrowthTaskList, GrowthTaskGrant, GrowthTaskIntent, GrowthTaskGrantTrace } from '../../shared/model/growth-task-intent';
import { assertGrowthTaskList, assertGrowthTaskClaim, assertGrowthGrantTrace, growthTaskView, growthGrantText } from '../../shared/presentation/growth-task';
import { displayQuantity } from '../../shared/format/quantity';
import { displayGrowthUnits } from '../../shared/presentation/api-points';

function createState() {
  return { owner: accountApi.sessionIdentity(), scope: createOperationScope(), navigation: createNavigateOnce(),
    visible: true, list: null as GrowthTaskList | null, pending: null as GrowthTaskIntent | null, blocked: false,
    grants: [] as GrowthTaskGrant[], traces: new Map<string, GrowthTaskGrantTrace>() };
}
const states = new WeakMap<object, ReturnType<typeof createState>>();
function current(page: object, value: ReturnType<typeof createState>) {
  return states.get(page) === value && value.visible && !value.scope.disposed && !!value.owner && value.owner === accountApi.sessionIdentity();
}
function state(page: object) { let value = states.get(page); if (!value) { value = createState(); states.set(page, value); } return value; }
async function response<T>(value: ReturnType<typeof createState>, handle: { promise: Promise<T>; abort: () => void }): Promise<T> {
  const release = value.scope.registerCleanup(handle.abort);
  try { return await handle.promise; } finally { release(); }
}
const blank = {
  loggedIn: false, tasks: [] as Array<ReturnType<typeof growthTaskView> & { icon: string }>,
  missions: [] as Array<ReturnType<typeof growthTaskView> & { icon: string }>, browseMissions: [] as Array<ReturnType<typeof growthTaskView> & { icon: string }>,
  taskCount: '—', taskProgress: '0%', dailyCount: '—', loading: false, busy: false, errorText: '', notice: '',
  pendingBenefitCode: '', receiptText: '', receiptGrants: [] as { id: string; label: string; couponId: string | null }[],
  grantDetail: '', balance: '—', starPoints: '—',
};

Page({
  data: { ...blank, icons: designAssets, browseExpanded: false },
  onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
  async onShow() {
    if (dayPageDisposed(this)) return;
    const previous = states.get(this); previous?.scope.dispose(); previous?.navigation.dispose();
    const value = createState(); states.set(this, value);
    this.setData({ ...blank, loggedIn: !!value.owner });
    watchDayRefresh(this, () => { void this.onShow(); });
    if (!value.owner) { this.setData({ notice: '登录后可查看本人成长任务。' }); return; }
    try {
      value.pending = readGrowthTaskIntent(value.owner);
      this.setData({ pendingBenefitCode: value.pending?.benefitCode ?? '' });
    } catch (error) {
      value.blocked = true;
      this.setData({ errorText: error instanceof Error ? error.message : '原领取请求无法读取。' });
    }
    await this.refresh();
  },
  onHide() {
    const value = states.get(this);
    if (value) { value.visible = false; value.scope.dispose(); value.navigation.dispose(); value.grants = []; value.traces.clear(); }
    stopDayRefresh(this);
    this.setData({ ...blank });
  },
  onUnload() { this.onHide(); disposeDayRefresh(this); states.delete(this); },
  async refresh(): Promise<boolean> {
    const value = state(this);
    if (!current(this, value)) return false;
    this.setData({ loading: true });
    try {
      const result = await value.scope.latest('growth-task-list', () => response(value, benefitApi.tasks()));
      if (!result.accepted || !current(this, value)) return false;
      assertGrowthTaskList(result.value);
      value.list = result.value;
      const views = result.value.items.map(task => ({ ...growthTaskView(task), icon: task.task_code === 'REGISTER' ? designAssets.profileVerified : designAssets.profileSupport }));
      const tasks = views.filter(item => result.value.items.find(task => task.benefit_code === item.id)!.period !== 'DAY');
      const missions = views.filter(item => result.value.items.find(task => task.benefit_code === item.id)!.period === 'DAY');
      const completed = tasks.filter(task => task.done).length;
      this.setData({ tasks, missions, browseMissions: missions,
        taskCount: tasks.length ? completed + '/' + tasks.length : '—', taskProgress: tasks.length ? Math.floor(completed * 100 / tasks.length) + '%' : '0%',
        dailyCount: missions.length ? missions.filter(item => item.done).length + '/' + missions.length : '—',
        notice: !result.value.enabled ? '当前没有可用的已发布任务配置。' : views.length ? '' : '当前没有可显示的成长任务。' });
      return true;
    } catch (error) {
      if (current(this, value)) { value.list = null; this.setData({ tasks: [], missions: [], browseMissions: [], taskCount: '—', dailyCount: '—', taskProgress: '0%', errorText: error instanceof Error ? error.message : '任务读取失败，请重试。' }); }
      return false;
    } finally { if (current(this, value)) this.setData({ loading: false }); }
  },
  openTask(event: WechatMiniprogram.TouchEvent) {
    const value = state(this), id = String(event.currentTarget.dataset['id'] ?? '');
    if (!current(this, value) || this.data.busy || value.blocked) return Promise.resolve();
    if (value.pending) { this.setData({ errorText: '上一领取结果尚待核实，请使用恢复原请求。' }); return Promise.resolve(); }
    const task = value.list?.items.find(item => item.benefit_code === id);
    if (!task || !value.list?.enabled || task.state !== 'CLAIMABLE' || task.claimable_count === '0') {
      wx.showToast({ title: '暂无可领取的真实任务奖励。', icon: 'none' }); return Promise.resolve();
    }
    return this.claim(id);
  },
  recoverClaim() {
    const value = state(this);
    if (!current(this, value) || this.data.busy || value.blocked || !value.pending) return Promise.resolve();
    return this.claim(value.pending.benefitCode);
  },
  claim(benefitCode: string) {
    const value = state(this);
    return value.scope.singleFlight('growth-task-claim', async () => {
      if (!current(this, value) || !value.owner || value.blocked) return;
      this.setData({ busy: true, errorText: '', receiptText: '', receiptGrants: [], grantDetail: '' });
      try {
        const intent = prepareGrowthTaskIntent(value.owner, benefitCode);
        value.pending = intent;
        this.setData({ pendingBenefitCode: intent.benefitCode });
        const receipt = await response(value, benefitApi.claimTask(intent.benefitCode, intent.key));
        if (!current(this, value)) return;
        assertGrowthTaskClaim(receipt, intent.benefitCode);
        const traces = new Map<string, GrowthTaskGrantTrace>();
        for (const grant of receipt.grants) {
          const trace = await response(value, loyaltyTraceApi.grant(grant.grant_id));
          if (!current(this, value)) return;
          assertGrowthGrantTrace(trace, grant, value.owner);
          traces.set(grant.grant_id, trace);
        }
        const summary = await response(value, benefitApi.summary());
        if (!current(this, value)) return;
        if (summary.profile.account_id !== value.owner || displayQuantity(summary.profile.available_pink_units) === '—'
          || displayGrowthUnits(summary.profile.total_growth_units) === '—') throw new Error('当前账户摘要无效，请继续核实原请求。');
        if (!await this.refresh() || !current(this, value)) throw new Error('任务回读未完成，请恢复原请求。');
        clearConfirmedGrowthTaskIntent(intent);
        value.pending = null; value.grants = receipt.grants; value.traces = traces;
        this.setData({ pendingBenefitCode: '', receiptText: '奖励已核实：' + receipt.grants.map(growthGrantText).join(' · '),
          receiptGrants: receipt.grants.map(grant => ({ id: grant.grant_id, label: growthGrantText(grant), couponId: grant.coupon_id })),
          balance: summary.profile.available_pink_units, starPoints: displayGrowthUnits(summary.profile.total_growth_units), errorText: '' });
        wx.showToast({ title: '任务奖励已核实', icon: 'success' });
      } catch (error) {
        if (current(this, value)) this.setData({ errorText: (error instanceof Error ? error.message : '领取结果尚待核实。') + (value.pending ? ' 请使用恢复原请求。' : '') });
      } finally { if (current(this, value)) this.setData({ busy: false }); }
    }).catch(() => undefined);
  },
  async openGrant(event: WechatMiniprogram.TouchEvent) {
    const value = state(this), id = String(event.currentTarget.dataset['id'] ?? '');
    const grant = value.grants.find(item => item.grant_id === id);
    if (!current(this, value) || !grant || !value.owner) return;
    try {
      const trace = await response(value, loyaltyTraceApi.grant(id));
      if (!current(this, value)) return;
      assertGrowthGrantTrace(trace, grant, value.owner); value.traces.set(id, trace);
      this.setData({ grantDetail: '发奖号 ' + trace.grant_id + ' · 来源 ' + trace.source_id + ' · ' + growthGrantText(grant) });
    } catch (error) { if (current(this, value)) this.setData({ errorText: error instanceof Error ? error.message : '奖励详情读取失败。' }); }
  },
  openReward(event: WechatMiniprogram.TouchEvent) {
    const value = state(this), id = String(event.currentTarget.dataset['id'] ?? '');
    const grant = value.grants.find(item => item.grant_id === id), trace = value.traces.get(id);
    if (!current(this, value) || !grant || !trace) return;
    const route = grant.coupon_id ? '/pages/coupon-detail/index?coupon_id=' + encodeURIComponent(grant.coupon_id)
      : grant.reward_code === 'PINK' ? '/pages/powder-ledger/index' + (trace.pink_entry_ids[0] ? '?entry_id=' + encodeURIComponent(trace.pink_entry_ids[0]) : '')
        : grant.reward_code === 'GROWTH' ? '/pages/star-ledger/index'
          : grant.reward_code === 'PUBLISH_QUOTA' ? '/pages/publish-quota/index' : '/pages/rental-service/index';
    value.navigation.navigateOnce('reward:' + id, callbacks => wx.navigateTo({ url: route, ...callbacks }));
  },
  openMission(event: WechatMiniprogram.TouchEvent) { return this.openTask(event); },
  openBrowseMission(event: WechatMiniprogram.TouchEvent) { return this.openTask(event); },
  toggleBrowse() { this.setData({ browseExpanded: !this.data.browseExpanded }); },
});
