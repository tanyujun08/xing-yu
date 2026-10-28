import { accountApi, benefitApi } from '../../shared/api/account-api';
import { publicationApi, type PublicationEligibility } from '../../shared/api/supply-api';
import { designAssets } from '../../shared/design/assets';

type CheckView = { group: 'qualification'; title: string; value: string; route: string; done: boolean }
  | { group: 'service'; title: string; route: string; services: { label: string; value: string }[] };
type PageState = { epoch: number; owner: string | null; visible: boolean };
const states = new WeakMap<object, PageState>();
const labels: Record<string, string> = {
  RENTAL_ACCOUNT: '租赁账户', PERSONAL_LESSOR: '个人出租资格', MEMBERSHIP_LEVEL: '会员等级',
  IDENTITY_VERIFICATION: '实名核验', AGREEMENT_CONSENT: '协议签署', PUBLISH_QUOTA: '发布额度',
};
const routes: Record<string, string> = {
  OPEN_MEMBERSHIP: '/pages/membership/index', OPEN_PUBLISH_QUOTA: '/pages/publish-quota/index',
};
function state(page: object): PageState {
  let current = states.get(page);
  if (!current) { current = { epoch: 0, owner: null, visible: false }; states.set(page, current); }
  return current;
}
function current(page: object, owner: string, epoch: number): boolean {
  const value = states.get(page);
  return !!value && value.visible && value.epoch === epoch && value.owner === owner && accountApi.sessionIdentity() === owner;
}
function serviceCheck(values: { contract: string; face: string; risk: string }): CheckView {
  return { group: 'service', title: '出租服务额度', route: '/pages/rental-service/index', services: [
    { label: '电子合同', value: values.contract }, { label: '人脸核身', value: values.face }, { label: '风控报告', value: values.risk },
  ] };
}
const unknownServices = { contract: '暂未读取', face: '暂未接入', risk: '暂未接入' };
function present(projection: PublicationEligibility, service = unknownServices): { checks: CheckView[]; publishEnabled: boolean; primaryLabel: string; primaryRoute: string } {
  const checks: CheckView[] = projection.requirements.map((requirement) => {
    const done = requirement.status !== 'BLOCKED';
    const route = done ? '' : routes[requirement.action ?? ''] ?? '';
    const value = requirement.status === 'NOT_REQUIRED' ? '当前不要求'
      : done ? '已达成'
        : requirement.code === 'PUBLISH_QUOTA' && projection.publish_quota_expiry_pending ? '额度待刷新'
          : requirement.code === 'IDENTITY_VERIFICATION' ? '待真实核验'
            : '未达成';
    return { group: 'qualification', title: labels[requirement.code] ?? requirement.code, value, route, done };
  });
  checks.push(serviceCheck(service));
  if (projection.eligible) return { checks, publishEnabled: true, primaryLabel: '发布设备', primaryRoute: '/pages/publish/index' };
  const firstAction = checks.find((check) => check.group === 'qualification' && !check.done && check.route);
  return { checks, publishEnabled: false, primaryLabel: firstAction?.group === 'qualification' ? `去完成${firstAction.title}` : '暂不能发布', primaryRoute: firstAction?.route ?? '' };
}

Page({
  data: {
    icons: designAssets, secondaryNavigationTitle: '我要出租', loggedIn: false, loading: false, errorText: '',
    checks: [] as CheckView[], section: '', publishEnabled: false, primaryLabel: '正在读取资格', primaryRoute: '',
  },
  onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
  onLoad(options: Record<string, string | undefined>) {
    const section = options.section ?? '';
    this.setData({ section, secondaryNavigationTitle: section === 'quota' ? '发布额度' : section === 'service' ? '出租服务' : '我要出租' });
    if (!accountApi.sessionIdentity()) wx.showModal({ title: '请先登录', content: '登录后才能查看发布资格。', confirmText: '去登录', success: (result) => { if (result.confirm) wx.navigateTo({ url: '/pages/login/index' }); else wx.navigateBack(); } });
  },
  onShow() {
    const s = state(this);
    s.visible = true;
    s.owner = accountApi.sessionIdentity();
    ++s.epoch;
    this.setData({ loggedIn: !!s.owner, loading: !!s.owner, errorText: '', checks: [], publishEnabled: false, primaryLabel: s.owner ? '正在读取资格' : '请先登录', primaryRoute: '' });
    if (s.owner) void this.refresh();
  },
  onHide() { const s = state(this); s.visible = false; ++s.epoch; s.owner = null; this.setData({ checks: [], publishEnabled: false, primaryRoute: '' }); },
  onUnload() { states.delete(this); },
  async refresh(): Promise<PublicationEligibility | null> {
    const s = state(this); const owner = s.owner; const epoch = ++s.epoch;
    if (!owner || !s.visible) return null;
    this.setData({ loading: true, errorText: '', publishEnabled: false, primaryRoute: '' });
    try {
      const [eligibility, benefits] = await Promise.allSettled([publicationApi.eligibility().promise, benefitApi.summary().promise]);
      if (!current(this, owner, epoch)) return null;
      if (eligibility.status !== 'fulfilled') throw eligibility.reason;
      let service = unknownServices;
      if (benefits.status === 'fulfilled' && benefits.value.profile.account_id === owner) {
        const contract = benefits.value.entitlements.find((item) => item.kind === 'CONTRACT');
        service = { ...unknownServices, contract: contract?.expiry_pending ? '待刷新' : contract?.available_qty ?? '—' };
      }
      this.setData({ ...present(eligibility.value, service), loading: false });
      return eligibility.value;
    } catch (error) {
      if (current(this, owner, epoch)) this.setData({ checks: [], loading: false, publishEnabled: false, primaryLabel: '资格暂不可用', primaryRoute: '', errorText: error instanceof Error ? error.message : '发布资格读取失败，请重试。' });
      return null;
    }
  },
  retry() { void this.refresh(); },
  openCheck(event: WechatMiniprogram.TouchEvent) {
    const route = String(event.currentTarget.dataset['route'] ?? '');
    if (route) wx.navigateTo({ url: route });
    else wx.showToast({ title: '该条件暂无可用办理入口', icon: 'none' });
  },
  buyRentalService() { if (accountApi.sessionIdentity()) wx.navigateTo({ url: '/pages/rental-service/index' }); },
  buyPublishService() { if (accountApi.sessionIdentity()) wx.navigateTo({ url: '/pages/publish-quota/index' }); },
  async publish() {
    if (!accountApi.sessionIdentity() || this.data.loading) return;
    const projection = await this.refresh();
    if (!projection || !accountApi.sessionIdentity()) return;
    const action = present(projection);
    if (action.primaryRoute) wx.navigateTo({ url: action.primaryRoute });
    else wx.showToast({ title: '请先完成服务端发布条件', icon: 'none' });
  },
  goBack() { wx.navigateBack(); },
});
