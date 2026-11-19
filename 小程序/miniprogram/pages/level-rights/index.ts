import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createBenefitPage, navigateBenefitPage } from '../../shared/interaction/benefit-page';
import { displayGrowthUnits } from '../../shared/presentation/api-points';

const initial = {
  icons: designAssets, tierKey: '', level: '会员', starPoints: '—', todayGrowth: '—',
  hasNextLevel: false, atMaxLevel: false, nextLevel: '', remainingPoints: '',
  currentLevelName: '', currentThreshold: '', nextThreshold: '', progress: 0, railProgress: 0,
  rightsCaption: '', heroVisual: null, panelVisual: null,
  levels: [] as { key: string; name: string; threshold: string; state: string; next: boolean; statusLabel: string }[],
  currentBenefits: [] as { id: string; label: string; value: string }[],
};

const benefitPage = createBenefitPage(initial, accountApi.sessionIdentity, benefitApi.summary,
  dossier => dossier.profile.account_id,
  dossier => ({
    level: dossier.profile.level_code ?? '尚未评定',
    starPoints: displayGrowthUnits(dossier.profile.total_growth_units),
    currentBenefits: dossier.entitlements
      .filter(item => item.kind === 'CONTRACT' || item.kind === 'PUBLISH_QUOTA')
      .map(item => ({
        id: item.kind,
        label: item.kind === 'CONTRACT' ? '电子合同' : '出租发布额度',
        value: item.expiry_pending ? '待刷新' : '剩余 ' + item.available_qty + ' 次',
      })),
  }));

Page({
  ...benefitPage,
  data: { ...benefitPage.data, headerScrolled: false },
  onPageScroll({ scrollTop }) {
    const headerScrolled = scrollTop > 0;
    if (headerScrolled !== this.data.headerScrolled) this.setData({ headerScrolled });
  },
  showStarOverview() { navigateBenefitPage(this, '/pages/star-ledger/index'); },
  openGrowthTasks() { navigateBenefitPage(this, '/pages/growth-tasks/index'); },
  showCurrentBenefits() {
    const pages = getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous?.route === 'pages/membership/index') {
      wx.navigateBack({ success: () => wx.pageScrollTo({ selector: '#membership-benefits', offsetTop: -96, duration: 220 }) });
      return;
    }
    wx.redirectTo({ url: '/pages/membership/index?section=benefits' });
  },
  ...demoExtras('level-rights'),
});
