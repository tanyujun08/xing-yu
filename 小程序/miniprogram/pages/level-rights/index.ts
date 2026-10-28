import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { displayGrowthUnits } from '../../shared/presentation/api-points';
import { createBenefitPage } from '../../shared/interaction/benefit-page';
import { designAssets } from '../../shared/design/assets';
Page({
 ...createBenefitPage({icons:designAssets,currentLevelName:'—',currentLevelNumber:'—',currentThresholdText:'—',hasNextLevel:false,levels:[],currentBenefits:[] as {id:string;label:string}[],nextBenefits:[],starPoints:'—',nextLevel:'规则暂未接入',nextThreshold:'—',remainingPoints:'—',progress:0,progressText:'—'},accountApi.sessionIdentity,benefitApi.summary,s=>s.profile.account_id,s=>({currentLevelName:s.profile.level_code??'尚未评定',starPoints:displayGrowthUnits(s.profile.total_growth_units),currentBenefits:s.entitlements.filter(e=>['CONTRACT','PUBLISH_QUOTA'].includes(e.kind)).map(e=>({id:e.kind,label:(e.kind==='CONTRACT'?'电子合同':'发布额度')+'：'+(e.expiry_pending?'待刷新':e.available_qty)}))})),
 openStarLedger(){this.unavailable()},openGrowthTasks(){this.unavailable()},
  ...demoExtras('level-rights'),
});
