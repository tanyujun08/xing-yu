import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createBenefitPage, navigateBenefitPage } from '../../shared/interaction/benefit-page';
import { displayGrowthUnits } from '../../shared/presentation/api-points';

const initial = {
  icons: designAssets, tierKey: '', level: '会员', levelEnglish: '', art: '',
  starPoints: '—', todayGrowth: '—', diamonds: '—', nextLevel: '', remainingPoints: '',
  progress: 0, hasNextLevel: false, atMaxLevel: false,
  publishAllowance: '查看当前额度',
};

const benefitPage = createBenefitPage(initial, accountApi.sessionIdentity, benefitApi.summary,
  dossier => dossier.profile.account_id,
  dossier => ({
    level: dossier.profile.level_code ?? '尚未评定',
    starPoints: displayGrowthUnits(dossier.profile.total_growth_units),
    diamonds: dossier.profile.available_pink_units,
  }));

Page({
  ...benefitPage,
  data: { ...benefitPage.data, headerScrolled: false },
  onPageScroll({ scrollTop }) {
    const headerScrolled = scrollTop > 0;
    if (headerScrolled !== this.data.headerScrolled) this.setData({ headerScrolled });
  },
  onReady() {
    if (this.options['section'] === 'benefits') wx.pageScrollTo({ selector: '#membership-benefits', offsetTop: -96, duration: 0 });
  },
  openTask() { navigateBenefitPage(this, '/pages/growth-tasks/index'); },
  openDailyTasks() { navigateBenefitPage(this, '/pages/growth-tasks/index?section=daily'); },
  openStarDetails() { navigateBenefitPage(this, '/pages/star-ledger/index'); },
  openBalanceDetails() { navigateBenefitPage(this, '/pages/powder-ledger/index'); },
  openCheckIn() { navigateBenefitPage(this, '/pages/check-in/index'); },
  openShop() { navigateBenefitPage(this, '/pages/powder-mall/index'); },
  openLottery() { navigateBenefitPage(this, '/pages/lottery/index'); },
  openDetails() { navigateBenefitPage(this, '/pages/level-rights/index'); },
  openWaiver() { navigateBenefitPage(this, '/pages/no-deposit/index'); },
  openPublishAllowance() { navigateBenefitPage(this, '/pages/publish-quota/index'); },
  ...demoExtras('membership'),
});
