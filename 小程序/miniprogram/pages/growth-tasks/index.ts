import { accountApi, benefitApi, loyaltyTraceApi, readGrowthTaskIntent, prepareGrowthTaskIntent, clearConfirmedGrowthTaskIntent } from '../../shared/api/account-api';
import { supplyApi } from '../../shared/api/supply-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { watchDayRefresh, stopDayRefresh, disposeDayRefresh, dayPageDisposed } from '../../shared/interaction/day-refresh';
import type { GrowthTask, GrowthTaskList, GrowthTaskGrant, GrowthTaskIntent, GrowthTaskGrantTrace } from '../../shared/model/growth-task-intent';
import { assertGrowthTaskList, assertGrowthTaskClaim, assertGrowthGrantTrace, growthTaskView, growthGrantText, growthRewardLabel } from '../../shared/presentation/growth-task';
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

function taskRow(task: GrowthTask) {
  const view = growthTaskView(task);
  const daily = task.period === 'DAY';
  const isGuide = task.task_code === 'READ_RENTAL_GUIDES';
  const canBrowse = task.task_code === 'VIEW_ASSET' && !view.done && !view.claimable;
  const canRead = isGuide && !view.done && !view.claimable;
  const progress = canRead ? Math.min(Number(task.progress_count), task.target_count) : 0;
  const goal = canRead ? {
    label: progress + '/' + task.target_count,
    percent: Math.round(progress * 100 / task.target_count),
  } : null;
  return {
    ...view, period: task.period, canBrowse, canRead, goal,
    icon: isGuide ? designAssets.profileRentalGuide
      : task.task_code === 'REGISTER' ? designAssets.profileVerified : designAssets.search,
    title: isGuide ? '阅读 ' + task.target_count + ' 篇租赁指南'
      : task.task_code === 'REGISTER' ? '完成注册'
      : daily ? '今日浏览 1 台设备' : task.limit === '1' ? '首次浏览 1 台设备' : '浏览设备详情',
    actionText: view.done ? '已领取' : view.claimable ? '领取' : canRead ? '去完成' : canBrowse ? '去浏览' : '待完成',
    rewards: task.rewards.map(reward => ({
      label: '+' + growthRewardLabel(reward),
      tone: reward.kind === 'GROWTH' ? 'star' : reward.kind === 'PINK' ? 'diamond' : '',
      icon: reward.kind === 'GROWTH' ? designAssets.checkInStar : reward.kind === 'PINK' ? designAssets.checkInDiamond : '',
    })),
  };
}

const blank = {
  loggedIn: false, tasks: [] as ReturnType<typeof taskRow>[], missions: [] as ReturnType<typeof taskRow>[],
  loading: false, busy: false, browsing: false, errorText: '', notice: '',
  pendingBenefitCode: '', receiptText: '', receiptGrants: [] as { id: string; label: string; couponId: string | null }[],
  grantDetail: '', balance: '—', starPoints: '—',
};

Page({
  data: { ...blank, groupOrder: ['upgrade', 'daily'], headerScrolled: false },
  onLoad(options) {
    if (options?.['section'] === 'daily') this.setData({ groupOrder: ['daily', 'upgrade'] });
  },
  onPageScroll({ scrollTop }) {
    const headerScrolled = scrollTop >= 64;
    if (headerScrolled !== this.data.headerScrolled) this.setData({ headerScrolled });
  },
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
  retryTasks() {
    this.setData({ errorText: '' });
    return this.refresh();
  },
  async refresh(): Promise<boolean> {
    const value = state(this);
    if (!current(this, value)) return false;
    this.setData({ loading: true });
    try {
      const result = await value.scope.latest('growth-task-list', () => response(value, benefitApi.tasks()));
      if (!result.accepted || !current(this, value)) return false;
      assertGrowthTaskList(result.value);
      value.list = result.value;
      const views = result.value.items.map(taskRow);
      const tasks = views.filter(item => item.period !== 'DAY');
      const missions = views.filter(item => item.period === 'DAY');
      this.setData({ tasks, missions,
        notice: result.value.enabled ? '' : '任务暂未开放' });
      return true;
    } catch (error) {
      if (current(this, value)) { value.list = null; this.setData({ tasks: [], missions: [], notice: '', errorText: error instanceof Error ? error.message : '任务读取失败，请重试。' }); }
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
  async browseDevice() {
    const value = state(this);
    if (!current(this, value) || this.data.browsing || this.data.busy) return;
    this.setData({ browsing: true });
    try {
      const { items } = await response(value, supplyApi.list());
      if (!current(this, value)) return;
      const device = items[0];
      if (!device) { wx.showToast({ title: '暂无可浏览设备', icon: 'none' }); return; }
      value.navigation.navigateOnce('browse-device', callbacks => wx.navigateTo({
        url: '/pages/detail/index?id=' + encodeURIComponent(device.asset_id), ...callbacks,
      }));
    } catch {
      if (current(this, value)) wx.showToast({ title: '设备读取失败，请重试', icon: 'none' });
    } finally {
      if (current(this, value)) this.setData({ browsing: false });
    }
  },
  openGuides() {
    const value = state(this);
    if (!current(this, value)) return;
    value.navigation.navigateOnce('rental-guides', callbacks => wx.navigateTo({
      url: '/pages/info-guide/index?from=task-center', ...callbacks,
    }));
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
});
