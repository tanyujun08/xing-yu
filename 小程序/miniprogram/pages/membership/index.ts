import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { displayGrowthUnits } from '../../shared/presentation/api-points';
import { createBenefitPage,navigateBenefitPage } from '../../shared/interaction/benefit-page';
import { designAssets } from '../../shared/design/assets';
import type { CurrentCheckInRule, CheckInReward } from '../../shared/api/account-api';
const taskRows=[{title:'升级任务',detail:'任务规则暂未接入',icon:designAssets.membershipTaskUpgrade},{title:'每日星光任务',detail:'任务规则暂未接入',icon:designAssets.membershipTaskCheckin}];
const moreRows=[{title:'信用免押',detail:'查看当前余额',icon:designAssets.membershipTaskWaiver},{title:'出租发布额度',detail:'查看当前额度',icon:designAssets.membershipTaskQuota}];
const ruleLoads = new WeakMap<object, { epoch: number; abort?: () => void }>();
function stopRuleLoad(page: object) {
 const current = ruleLoads.get(page);
 current?.abort?.();
 ruleLoads.set(page, { epoch: (current?.epoch ?? 0) + 1 });
}
function rewardLabel(reward: CheckInReward): string {
 if (reward.kind === 'PINK') return `+${reward.units ?? '0'} 粉钻`;
 if (reward.kind === 'GROWTH') return `+${displayGrowthUnits(reward.units ?? '0')} 星光`;
 if (reward.kind === 'COUPON') return `+${reward.quantity ?? 0} 张优惠券`;
 return `+${reward.quantity ?? 0} 次${reward.kind === 'CONTRACT' ? '合同权益' : '发布权益'}`;
}
function dailyReward(rule: CurrentCheckInRule): string {
 if (rule.policy.schema_version !== 2 || rule.policy.timezone !== 'Asia/Shanghai') throw new Error('签到规则版本无效');
 return rule.policy.daily_rewards.length ? rule.policy.daily_rewards.map(rewardLabel).join(' · ') : '无每日奖励';
}
const memberBase = createBenefitPage({icons:designAssets,level:'—',levelCode:'',starPoints:'—',nextLevel:'规则暂未接入',nextLevelPoints:'—',progress:0,progressPercent:'—',todayGrowth:'—',diamonds:'—',shopCount:'—',dailyCheckInReward:'—',taskRows,moreRows},accountApi.sessionIdentity,benefitApi.summary,s=>s.profile.account_id,s=>({level:s.profile.level_code??'尚未评定',levelCode:s.profile.level_code??'',starPoints:displayGrowthUnits(s.profile.total_growth_units),diamonds:s.profile.available_pink_units}));
Page({
 ...memberBase,
 async onShow() {
  stopRuleLoad(this);
  const owner = accountApi.sessionIdentity();
  const base = memberBase.onShow.call(this);
  if (!owner) return base;
  const current = ruleLoads.get(this)!;
  const handle = benefitApi.rule();
  current.abort = handle.abort;
  const rule = handle.promise.then(result => {
   if (ruleLoads.get(this) === current && owner === accountApi.sessionIdentity()) this.setData({ dailyCheckInReward: dailyReward(result) });
  }).catch(() => {
   if (ruleLoads.get(this) === current && owner === accountApi.sessionIdentity()) this.setData({ dailyCheckInReward: '暂不可用' });
  }).finally(() => { if (ruleLoads.get(this) === current) delete current.abort; });
  await Promise.all([base, rule]);
 },
 onHide() { stopRuleLoad(this); memberBase.onHide.call(this); },
 onUnload() { stopRuleLoad(this); ruleLoads.delete(this); memberBase.onUnload.call(this); },
 openTask(event:WechatMiniprogram.TouchEvent){const section=String(event.currentTarget.dataset['section']);const index=Number(event.currentTarget.dataset['index']);if(section==='more'&&index===0)navigateBenefitPage(this,'/pages/no-deposit/index');else if(section==='more'&&index===1)navigateBenefitPage(this,'/pages/publish-quota/index');else this.unavailable()},
 openStarDetails(){navigateBenefitPage(this,'/pages/star-ledger/index')},openBalanceDetails(){navigateBenefitPage(this,'/pages/powder-ledger/index')},openShop(){this.unavailable()},copyInvite(){this.unavailable()},
 openCheckIn(){navigateBenefitPage(this,'/pages/check-in/index')},openDetails(){navigateBenefitPage(this,'/pages/level-rights/index')},
  ...demoExtras('membership'),
});
