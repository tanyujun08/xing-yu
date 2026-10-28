import { designAssets } from '../../shared/design/assets';

Component({
  options: { styleIsolation: 'isolated' },
  properties: { visible: { type: Boolean, value: false } },
  data: { icons: designAssets, agreed: false, submitting: false, errorText: '', showConsentModal: false, windowWidth: 0 },
  lifetimes: {
    attached() { this.updateWindowWidth(wx.getWindowInfo().windowWidth); },
  },
  pageLifetimes: {
    show() { this.updateWindowWidth(wx.getWindowInfo().windowWidth); },
    resize({ size }: WechatMiniprogram.Page.IResizeOption) { this.updateWindowWidth(size.windowWidth); },
  },
  methods: {
 demoPhoneAuthorize() { this.onPhoneAuthorized({ detail: { code: 'OFFLINE_DEMO_PHONE_CODE' } } as WechatMiniprogram.CustomEvent<{code?:string;errMsg?:string}>); },
    updateWindowWidth(windowWidth: number) {
      if (Number.isFinite(windowWidth) && windowWidth > 0 && this.data.windowWidth !== windowWidth) this.setData({ windowWidth });
    },
    open() { this.updateWindowWidth(wx.getWindowInfo().windowWidth); this.setData({ visible: true, errorText: '', showConsentModal: false }); },
    close() {
      if (this.data.submitting) return;
      this.setData({ visible: false, agreed: false, errorText: '', showConsentModal: false });
      this.triggerEvent('cancel');
    },
    setSubmitting(submitting: boolean) { this.setData({ submitting }); },
    setError(errorText: string) { this.setData({ errorText, submitting: false }); },
    complete() { this.setData({ visible: false, agreed: false, submitting: false, errorText: '' }); },
    toggleAgree() { this.setData({ agreed: !this.data.agreed }); },
    closeConsentModal() { this.setData({ showConsentModal: false }); },
    confirmConsent() { this.setData({ agreed: true, showConsentModal: false }); },
    openLegal(event: WechatMiniprogram.TouchEvent) {
      const legal = String(event.currentTarget.dataset['legal'] ?? '');
      if (legal === 'user-agreement' || legal === 'privacy-policy') this.triggerEvent('legal', { legal });
    },
    quickLogin() {
      if (this.data.submitting) return;
      if (!this.data.agreed) { this.setData({ showConsentModal: true }); return; }
      this.triggerEvent('wechatlogin');
    },
    phoneConsent() {
      if (this.data.submitting) return;
      this.setData({ showConsentModal: true });
    },
    onPhoneAuthorized(event: WechatMiniprogram.CustomEvent<{ code?: string; errMsg?: string }>) {
      if (this.data.submitting || !this.data.agreed) return;
      const phoneCode = event.detail?.code;
      if (!phoneCode) { this.setData({ errorText: '未获得微信手机号授权，请重试或使用微信登录。' }); return; }
      this.setData({ errorText: '' });
      this.triggerEvent('phonelogin', { phoneCode });
    },
  },
});
