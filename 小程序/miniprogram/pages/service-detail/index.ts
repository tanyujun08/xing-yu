import { demoExtras } from '../../preview/extras';

export {};

type ServiceKind = 'guard' | 'insurance';

type DetailItem = {
  id: string;
  index: string;
  title: string;
  copy: string;
};

type ServiceDetail = {
  available: boolean;
  title: string;
  priceText: string;
  statusText: string;
  summary: string;
  deviceName: string;
  productModel: string;
  orderId: string;
  periodText: string;
  maximumText: string;
  benefits: DetailItem[];
  scopeText: string;
  exclusionsText: string;
  claimConditionsText: string;
  evidenceText: string;
  cancellationText: string;
  processSteps: DetailItem[];
  providerText: string;
  contactText: string;
};

const emptyDetail: ServiceDetail = {
  available: false,
  title: '',
  priceText: '',
  statusText: '',
  summary: '',
  deviceName: '',
  productModel: '',
  orderId: '',
  periodText: '',
  maximumText: '',
  benefits: [],
  scopeText: '',
  exclusionsText: '',
  claimConditionsText: '',
  evidenceText: '',
  cancellationText: '',
  processSteps: [],
  providerText: '',
  contactText: '',
};

Page({
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  data: {
    preview: false,
    previewTitle: '',
    previewPrice: '',
    routeId: '',
    routeService: '',
    resumePending: false,
    missing: true,
    unavailable: false,
    service: 'guard' as ServiceKind,
    detail: emptyDetail,
  },

  onLoad(options: Record<string, string | undefined>) {
    if (options.mode === 'preview' && (options.service === 'guard' || options.service === 'insurance')) {
      this.setData({ preview: true, missing: false, resumePending: false, service: options.service, previewTitle: options.service === 'guard' ? '售后守护' : '安心保', previewPrice: '—', secondaryNavigationTitle: options.service === 'guard' ? '售后守护' : '安心保' }); return;
    }
    this.setData({ routeId: options.id ?? '', routeService: options.service ?? '', resumePending: false, missing: true, unavailable: true, detail: emptyDetail });
  },

  onShow() {
    if (this.data.preview) return;
    this.setData({ missing: true, unavailable: true, detail: emptyDetail });
  },

  onHide() {
    if (!this.data.preview) this.setData({ missing: true, detail: emptyDetail });
  },
  goBack() { wx.navigateBack(); },
  ...demoExtras('service-detail'),
});
