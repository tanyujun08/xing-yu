import { demoExtras } from '../../preview/extras';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { designAssets } from '../../shared/design/assets';
import { partitionWithdrawalRecords, useWithdrawalReferencePreview, type WithdrawalDisplayRecord } from '../../shared/presentation/withdrawal-layout';
import { createNavigateOnce, navigateBackWithFallback, type NavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope, type OperationScope } from '../../shared/interaction/operation-scope';

interface WithdrawalInteraction {
  scope: OperationScope;
  navigation: NavigateOnce;
}

const withdrawalInteractionByPage = new WeakMap<object, WithdrawalInteraction>();

function referencePreviewEnabled(): boolean {
  try {
    return useWithdrawalReferencePreview(wx.getAccountInfoSync().miniProgram.envVersion, wx.getDeviceInfo().platform);
  } catch { return false; }
}

function amountCanSubmit(raw: string, availableFen: number | null): boolean {
  const amount = Number(raw);
  return availableFen !== null && Number.isFinite(amount) && amount >= 1 && Math.round(amount * 100) <= availableFen;
}

function amountValueText(fen: number): string {
  return formatCNYMinorUnits(String(fen)).replace('¥', '').replace(/\.00$/, '');
}

type WithdrawalExplanationView = { id: string; title: string; detail: string; icon: string };

function withdrawalInteraction(page: object): WithdrawalInteraction {
  const current = withdrawalInteractionByPage.get(page);
  if (current) return current;
  const created = { scope: createOperationScope(), navigation: createNavigateOnce() };
  withdrawalInteractionByPage.set(page, created);
  return created;
}

function withdrawalNavigateTo(page: object, key: string, url: string): boolean {
  return withdrawalInteraction(page).navigation.navigateOnce(key, (callbacks) => wx.navigateTo({ url, ...callbacks }));
}

function withdrawalNavigateBack(page: object, key: string): boolean {
  return withdrawalInteraction(page).navigation.navigateOnce(key, (callbacks) => wx.navigateBack({ ...callbacks }));
}

Page({
  onSecondaryNavigationBack() { navigateBackWithFallback(withdrawalInteraction(this).navigation); },
  data: {
    referencePreview: false,
    view: 'apply' as 'apply' | 'records',
    availableText: '—',
    availableValueText: '—',
    availableFen: null as number | null,
    amount: '',
    amountFocused: false,
    accountJoined: false,
    amountDisabled: true,
    submitDisabled: true,
    primaryActionText: '确认提现',
    pendingAmountText: '',
    processingText: '—',
    processingValueText: '—',
    processingFen: null as number | null,
    walletReady: false,
    accountLabel: '微信账户',
    accountIcon: designAssets.loginWechat,
    heroArt: designAssets.withdrawalBalance,
    availableHeroArt: designAssets.withdrawalAvailable,
    statusIcons: { completed: designAssets.withdrawalStatusCompleted, failed: designAssets.withdrawalStatusFailed, pending: designAssets.withdrawalStatusPending },
    helpIcon: designAssets.withdrawalHelp,
    stepIcons: { completed: designAssets.withdrawalStepCompleted, current: designAssets.withdrawalStepCurrent, waiting: designAssets.withdrawalStepWaiting, unknown: designAssets.withdrawalStepUnknown },
    currentWithdrawal: null as WithdrawalDisplayRecord | null,
    historyWithdrawals: [] as WithdrawalDisplayRecord[],
    explanationRows: [
      { id: 'arrival', title: '到账时间', detail: '1–3 个工作日', icon: designAssets.profileChartPie },
      { id: 'fee', title: '手续费', detail: '以平台规则为准', icon: designAssets.profileCash },
    ] as WithdrawalExplanationView[],
    errorText: '',
    submitting: false,
    withdrawals: [] as Array<{ id: string; amountText: string; amountValueText?: string; state: string; stateText: string; stateTone: string; accountLabel: string; createdText: string }>,
    submissionKey: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const view = options.view === 'records' ? 'records' : 'apply';
    this.setData({ view });
    this.setData({ secondaryNavigationTitle: '提现' });
  },
  onShow() { this.loadWallet(); },
  onHide() { withdrawalInteractionByPage.get(this)?.scope.onHide(); },
  onUnload() { const interaction = withdrawalInteractionByPage.get(this); interaction?.scope.dispose(); interaction?.navigation.dispose(); withdrawalInteractionByPage.delete(this); },

  loadWallet() {
    if (referencePreviewEnabled()) {
      const withdrawals: WithdrawalDisplayRecord[] = [];
      this.setData({
        referencePreview: true, withdrawals, ...partitionWithdrawalRecords(withdrawals),
        availableFen: null, availableText: '—', availableValueText: '—',
        processingFen: null, processingText: '—', processingValueText: '—',
        accountLabel: '微信账户', walletReady: false,
        explanationRows: [{ id: 'arrival', title: '到账时间', detail: '1–3 个工作日', icon: designAssets.profileChartPie }, { id: 'fee', title: '手续费', detail: '以平台规则为准', icon: designAssets.profileCash }],
        submissionKey: '', amount: '', amountFocused: false, accountJoined: true, amountDisabled: false, submitDisabled: true, submitting: false, errorText: '',
      });
      return;
    }
    const withdrawals: WithdrawalDisplayRecord[] = [];
    this.setData({
      ...partitionWithdrawalRecords(withdrawals),
      referencePreview: false,
      explanationRows: [{ id: 'arrival', title: '到账时间', detail: '1–3 个工作日', icon: designAssets.profileChartPie }, { id: 'fee', title: '手续费', detail: '以平台规则为准', icon: designAssets.profileCash }],
      availableFen: null,
      availableText: '—',
      availableValueText: '—',
      accountLabel: '微信账户',
      walletReady: false,
      errorText: '',
      submissionKey: '',
      accountJoined: false,
      amountDisabled: true,
      submitDisabled: true,
      primaryActionText: '确认提现',
      pendingAmountText: '',
      processingFen: null,
      processingText: '—',
      processingValueText: '—',
      withdrawals,
    });
  },

  switchView(event: WechatMiniprogram.TouchEvent) {
    const view = String(event.currentTarget.dataset['view'] ?? 'apply') === 'records' ? 'records' : 'apply';
    if (view === this.data.view) return;
    this.setData({ view });
    this.setData({ secondaryNavigationTitle: '提现' });
    this.loadWallet();
  },

  input(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    if (this.data.amountDisabled) return;
    const amount = String(event.detail.value ?? '');
    this.setData({ amount, submitDisabled: !amountCanSubmit(amount, this.data.availableFen), errorText: '' });
  },
  amountFocus() { this.setData({ amountFocused: true }); },
  amountBlur() { this.setData({ amountFocused: false }); },
  fillAll() {
    if (this.data.amountDisabled || this.data.availableFen === null) return;
    const amount = amountValueText(this.data.availableFen);
    this.setData({ amount, submitDisabled: !amountCanSubmit(amount, this.data.availableFen), errorText: '' });
  },

  openRecords() {
    if (this.data.view === 'records') return;
    this.setData({ view: 'records' });
    this.setData({ secondaryNavigationTitle: '提现' });
    this.loadWallet();
  },

  submit() {
    if (this.data.referencePreview || referencePreviewEnabled()) {
      wx.showToast({ title: '仅供视觉预览，不执行提现', icon: 'none' });
      return Promise.resolve();
    }
    if (!this.data.walletReady || this.data.availableFen === null) {
      this.setData({ errorText: '可提现余额暂不可用，请稍后再试。' });
      return Promise.resolve();
    }
    if (this.data.availableFen < 100) {
      this.setData({ errorText: '可提现余额不足1元，暂不能提交。' });
      return Promise.resolve();
    }
    if (!amountCanSubmit(this.data.amount, this.data.availableFen)) {
      this.setData({ errorText: '请输入不低于1元且不超过可提现余额的金额。' });
      return Promise.resolve();
    }
    this.setData({ errorText: '提现服务暂不可用，请稍后再试。' });
    return Promise.resolve();
  },

  withdrawalAction(event: WechatMiniprogram.TouchEvent) {
    if (this.data.referencePreview || referencePreviewEnabled()) {
      wx.showToast({ title: '仅供视觉预览，不执行提现', icon: 'none' });
      return;
    }
    const id = String(event.currentTarget.dataset['id'] ?? '');
    const state = String(event.currentTarget.dataset['state'] ?? '');
    if (!id) return;
    wx.showToast({ title: state === 'failed' ? '提现重试暂不可用，请稍后再试。' : '提现查询暂不可用，请稍后再试。', icon: 'none' });
  },

  showBalanceHelp() {
    const scope = withdrawalInteraction(this).scope;
    const operation = scope.singleFlight('withdrawal:balance-help', async () => {
      if (scope.disposed) return;
      await wx.showModal({
        title: '可提现余额',
        content: '满 ¥1 可提现。托管押金、待收款和预期收益不计入可提现余额。',
        showCancel: false,
        confirmText: '知道了',
      });
    });
    void operation.catch(() => undefined);
    return operation;
  },
  contactSupport() { return withdrawalNavigateTo(this, 'withdrawal:support', '/pages/chat/index?mode=support'); },
  goBack() { return withdrawalNavigateBack(this, 'withdrawal:back'); },
  ...demoExtras('withdrawal'),
});
