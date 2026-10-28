import { accountApi, pointApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createAccountLedgerPage } from '../../shared/interaction/account-ledger-page';
import { growthLedgerSummary, pointLedgerEntry } from '../../shared/presentation/api-point-ledger';

const initial = { icons: designAssets, starBalance: '—', today: '—', week: '—' };
type PointResponse = Awaited<ReturnType<typeof pointApi.list>['promise']>;
Page({
  ...createAccountLedgerPage<PointResponse, ReturnType<typeof pointLedgerEntry>, typeof initial>({
    initial,
    identity: accountApi.sessionIdentity,
    load: cursor => pointApi.list('GROWTH', cursor),
    present: pointLedgerEntry, summary: growthLedgerSummary,
    generation: 'GROWTH', loginURL: '/pages/login/index?source=star-ledger',
  }),
  openTasks() { wx.showToast({ title: '任务功能接口暂未接入', icon: 'none' }); },
  openLevelRights() { this.navigateLedger('/pages/level-rights/index'); },
});
