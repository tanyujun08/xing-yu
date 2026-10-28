import { accountApi, benefitApi, type CheckInMonth, type CheckInReward, type CurrentCheckInRule } from '../../shared/api/account-api';
import { displayGrowthUnits } from '../../shared/presentation/api-points';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { couponTitles } from '../../shared/presentation/loyalty';
import { loyaltyIdentifier } from '../../shared/model/loyalty-intent';
type Receipt=Awaited<ReturnType<typeof benefitApi.checkIn>['promise']>;
function grantLabel(grant:Receipt['grants'][number]){return grant.reward_code==='PINK'?grant.reward_units+' 粉钻':grant.reward_code==='GROWTH'?displayGrowthUnits(grant.reward_units)+' 星光':grant.reward_kind==='COUPON'?grant.reward_units+' 张'+couponTitles[grant.reward_code as keyof typeof couponTitles]:grant.reward_units+(grant.reward_code==='CONTRACT'?' 次合同权益':' 次发布额度');}

type Month = CheckInMonth;
type Reward = CheckInReward;
type Rule = CurrentCheckInRule;
function monthOf(date: string): string { return /^\d{4}-\d{2}/u.exec(date)?.[0] ?? ''; }
function rewardLabel(item: Reward): string {
  if (item.kind === 'PINK') return (item.units ?? '0') + ' 粉钻';
  if (item.kind === 'GROWTH') return displayGrowthUnits(item.units ?? '0') + ' 星光';
  if (item.kind === 'COUPON') return String(item.quantity ?? 0) + ' 张优惠券';
  return String(item.quantity ?? 0) + (item.kind === 'CONTRACT' ? ' 次合同权益' : ' 次发布权益');
}
function rewardsLabel(items: Reward[]): string { return items.length ? items.map(rewardLabel).join('、') : '无额外奖励'; }
function chinaMonth(): string { return monthOf(new Date(Date.now() + 8 * 3600000).toISOString()); }
function dayOf(date: string): string { return /^\d{4}-\d{2}-\d{2}/u.exec(date)?.[0] ?? ''; }
function calendar(month: Month) {
  const [year, value] = month.month.split('-').map(Number);
  const first = new Date(Date.UTC(year!, value! - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year!, value!, 0)).getUTCDate();
  const signed = new Set(month.items.map((item) => item.check_in.business_date));
  return Array.from({ length: first + days }, (_, index) => {
    if (index < first) return { key: 'empty-' + index, day: '', state: 'empty', stateText: '' };
    const day = index - first + 1, date = month.month + '-' + String(day).padStart(2, '0');
    return { key: date, day: String(day), state: signed.has(date) ? 'signed' : date === month.today ? 'today' : 'normal', stateText: signed.has(date) ? '已签' : '' };
  });
}
function week(month: Month) {
  const date = new Date(month.today + 'T00:00:00Z');
  const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
  const signed = new Set(month.items.map((item) => item.check_in.business_date));
  return Array.from({ length: 7 }, (_, index) => {
    const day = dayOf(new Date(monday.getTime() + index * 86400000).toISOString());
    const inMonth = monthOf(day) === month.month;
    return { key: day, label: ['一', '二', '三', '四', '五', '六', '日'][index], status: !inMonth ? '跨月' : signed.has(day) ? '已签' : day > month.today ? '待签' : '未签', state: !inMonth ? 'outside' : signed.has(day) ? 'done' : 'normal' };
  });
}
function createState() { return { owner: accountApi.sessionIdentity(), scope: createOperationScope(), navigation: createNavigateOnce(), visible: true, intent: '', receiptId:'', timer: undefined as ReturnType<typeof setTimeout> | undefined }; }
const states = new WeakMap<object, ReturnType<typeof createState>>();
function state(page: object) { let value = states.get(page); if (!value) { value = createState(); states.set(page, value); } return value; }
function current(page: object, value: ReturnType<typeof createState>) { return states.get(page) === value && !value.scope.disposed && value.visible && !!value.owner && value.owner === accountApi.sessionIdentity(); }

Page({
  data: {
    icons: designAssets, loggedIn: false, busy: false, errorText: '', receiptText: '', signedToday: false,
    balance: '—', starPoints: '—', streak: '—', monthTitle: '', signedMonthCount: 0,
    calendarDays: [] as ReturnType<typeof calendar>, weekDays: [] as ReturnType<typeof week>,
    ruleAvailable: false, dailyReward: '—', firstReward: '—', milestones: [] as Array<{ key: string; day: string; reward: string }>,
    history: [] as Array<{ key: string; date: string; streak: string; reward: string }>,
    receiptCoupons:[] as {id:string;title:string}[],
  },
  onLoad(options:Record<string,string|undefined> = {}){state(this).receiptId=loyaltyIdentifier(options['check_in_id']??'')?options['check_in_id']!:'';},
  onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
  async onShow() {
    let value = state(this);
    if (value.owner !== accountApi.sessionIdentity()) {
      value.scope.dispose(); value.navigation.dispose(); states.delete(this); value = state(this);
      this.setData({ signedToday: false, calendarDays: [], weekDays: [], history: [], ruleAvailable: false, receiptText: '', streak: '—' });
    }
    value.visible = true;
    if (value.timer !== undefined) value.scope.clearTimer(value.timer);
    value.timer = value.scope.setTimeout(() => { if (current(this, value)) void this.refresh(); }, 86400000 - ((Date.now() + 8 * 3600000) % 86400000));
    this.setData({ loggedIn: !!value.owner, busy: false, errorText: value.owner ? '' : '请登录后签到' });
    if (value.owner) {await this.refresh();if(value.receiptId)await this.readReceipt(value.receiptId);}
  },
  async refresh() {
    const value = state(this);
    if (!current(this, value)) return;
    try {
      const result = await value.scope.latest('check-in-month', () => benefitApi.month(chinaMonth()).promise);
      if (!result.accepted || !current(this, value)) return;
      const month = result.value;
      if (month.month !== monthOf(month.today)) {
        const corrected = await value.scope.latest('check-in-month', () => benefitApi.month(monthOf(month.today)).promise);
        if (!corrected.accepted || !current(this, value)) return;
        this.applyMonth(corrected.value);
      } else this.applyMonth(month);
    } catch (error) { if (current(this, value)) this.setData({ errorText: error instanceof Error ? error.message : '签到历史读取失败' }); }
    try {
      const result = await value.scope.latest('check-in-rule', () => benefitApi.rule().promise);
      if (result.accepted && current(this, value)) this.applyRule(result.value);
    } catch { if (current(this, value)) this.setData({ ruleAvailable: false, dailyReward: '当前没有可用的已发布签到规则', firstReward: '—', milestones: [] }); }
    try {
      const result = await value.scope.latest('check-in-balance', () => benefitApi.summary().promise);
      if (result.accepted && current(this, value)) {
        if (result.value.profile.account_id !== value.owner) throw new Error('账户响应不一致');
        this.setData({ balance: result.value.profile.available_pink_units, starPoints: displayGrowthUnits(result.value.profile.total_growth_units) });
      }
    } catch (error) { if (current(this, value)) this.setData({ errorText: error instanceof Error ? error.message : '权益读取失败' }); }
  },
  applyMonth(month: Month) {
    const todayEntry = month.items.find((item) => item.check_in.business_date === month.today);
    this.setData({
      monthTitle: month.month.replace('-', ' 年 ') + ' 月', calendarDays: calendar(month), weekDays: week(month),
      signedMonthCount: month.items.length, signedToday: !!todayEntry, streak: todayEntry?.check_in.streak_days ?? month.items[0]?.check_in.streak_days ?? '—',
      history: month.items.map((entry) => ({
        key: entry.check_in.check_in_id, date: entry.check_in.business_date, streak: entry.check_in.streak_days,
        reward: entry.grants.map(grantLabel).join('、') || '无额外奖励',
      })),
    });
  },
  applyRule(rule: Rule) {
    if (rule.policy.schema_version !== 2 || rule.policy.timezone !== 'Asia/Shanghai') throw new Error('签到规则版本无效');
    this.setData({
      ruleAvailable: true, dailyReward: rewardsLabel(rule.policy.daily_rewards), firstReward: rewardsLabel(rule.policy.first_rewards),
      milestones: rule.policy.milestones.map((item) => ({ key: String(item.days), day: '连续 ' + item.days + ' 天', reward: rewardsLabel(item.rewards) })),
    });
  },
  onHide() { const value = state(this); value.visible = false; if (value.timer !== undefined) value.scope.clearTimer(value.timer); this.setData({ balance: '—', starPoints: '—', receiptText: '',receiptCoupons:[],history:[],calendarDays:[],weekDays:[],signedToday:false }); },
  onUnload() { const value = state(this); value.scope.dispose(); value.navigation.dispose(); states.delete(this); },
  checkIn() {
    const value = state(this);
    if (!current(this, value) || this.data.signedToday || !this.data.ruleAvailable) return Promise.resolve();
    value.intent ||= accountApi.newIntent('check-in');
    return value.scope.singleFlight('check-in', async () => {
      if (!current(this, value)) return;
      this.setData({ busy: true, errorText: '' });
      try {
        const receipt = await benefitApi.checkIn(value.intent).promise;
        if (!current(this, value)) return;
        if (!receipt.check_in.check_in_id || receipt.check_in.timezone !== 'Asia/Shanghai') throw new Error('签到回执无效，请重试原请求');
        value.intent = '';
        this.applyReceipt(receipt);
        await this.refresh();
      } catch (error) { if (current(this, value)) this.setData({ errorText: error instanceof Error ? error.message : '签到结果待确认，请重试原请求' }); }
      finally { if (current(this, value)) this.setData({ busy: false }); }
    }).catch(() => undefined);
  },
  applyReceipt(receipt:Receipt){this.setData({receiptText:receipt.check_in.business_date+' 已签到；'+(receipt.grants.map(grantLabel).join('、')||'无额外奖励'),receiptCoupons:receipt.grants.filter(grant=>grant.coupon_id!==null).map(grant=>({id:grant.coupon_id!,title:couponTitles[grant.reward_code as keyof typeof couponTitles]}))});},
  async readReceipt(id:string){const value=state(this);if(!current(this,value))return;try{const receipt=await benefitApi.checkInDetail(id).promise;if(!current(this,value))return;if(receipt.check_in.check_in_id!==id)throw new Error('签到回执标识不一致');this.applyReceipt(receipt);}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'签到回执读取失败'});}},
  openReceipt(event:WechatMiniprogram.TouchEvent){const id=String(event.currentTarget.dataset['id']??'');if(this.data.history.some(item=>item.key===id))void this.readReceipt(id);},
  openCoupon(event:WechatMiniprogram.TouchEvent){const value=state(this),id=String(event.currentTarget.dataset['id']??'');if(current(this,value)&&this.data.receiptCoupons.some(item=>item.id===id))value.navigation.navigateOnce('coupon:'+id,callbacks=>wx.navigateTo({url:'/pages/coupon-detail/index?coupon_id='+encodeURIComponent(id),...callbacks}));},
});
