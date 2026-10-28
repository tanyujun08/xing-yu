import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createBenefitPage, navigateBenefitPage } from '../../shared/interaction/benefit-page';

interface MallProduct {
  id: string;
  image: string;
  title: string;
  statusText: string;
  tone: 'gold' | 'green';
}

const mallProducts: MallProduct[] = [
  { id: 'rental-10', image: designAssets.powderMallCoupon10, title: '租赁优惠', statusText: '兑换暂未开放', tone: 'gold' },
  { id: 'rental-20', image: designAssets.powderMallCoupon20, title: '租赁优惠', statusText: '兑换暂未开放', tone: 'green' },
  { id: 'service-after-sale', image: designAssets.powderMallAfterSale, title: '售后守护', statusText: '兑换暂未开放', tone: 'green' },
  { id: 'service-insurance', image: designAssets.powderMallAfterSale, title: '安心保障', statusText: '兑换暂未开放', tone: 'gold' },
  { id: 'cabinet-rental-10', image: designAssets.powderMallCoupon10, title: '柜机租赁优惠', statusText: '兑换暂未开放', tone: 'green' },
  { id: 'express-10', image: designAssets.powderMallExpress10, title: '快递优惠', statusText: '兑换暂未开放', tone: 'gold' },
];

function showUnavailable(): void {
  wx.showToast({ title: '接口暂未接入', icon: 'none' });
}

Page({
  ...createBenefitPage(
    { icons: designAssets, balance: '—', mallProducts },
    accountApi.sessionIdentity,
    benefitApi.summary,
    (summary) => summary.profile.account_id,
    (summary) => ({ balance: summary.profile.available_pink_units }),
  ),

  goLedger() { navigateBenefitPage(this, '/pages/powder-ledger/index'); },
  goCheckIn() { navigateBenefitPage(this, '/pages/check-in/index'); },
  goCoupons() { navigateBenefitPage(this, '/pages/coupons/index'); },
  goLottery() { showUnavailable(); },
  redeem() { showUnavailable(); },
  ...demoExtras('powder-mall'),
});
