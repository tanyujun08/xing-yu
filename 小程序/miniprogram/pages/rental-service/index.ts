import { demoExtras } from '../../preview/extras';
import { accountApi, benefitApi } from '../../shared/api/account-api';
import { createBenefitPage } from '../../shared/interaction/benefit-page';
Page({
 ...createBenefitPage({tabs:[{id:'contract',label:'电子合同'},{id:'face',label:'人脸核身'},{id:'risk',label:'风控报告'},{id:'bundle',label:'组合包'}],currentTab:'contract',stats:[] as {label:string;value:string}[],packages:[],records:[],diamondBalance:'—',showRecords:false,buying:false,selectedQty:5},accountApi.sessionIdentity,benefitApi.summary,s=>s.profile.account_id,s=>({diamondBalance:s.profile.available_pink_units,stats:[{label:'电子合同',value:(()=>{const e=s.entitlements.find(e=>e.kind==='CONTRACT');return e?.expiry_pending?'待刷新':e?.available_qty??'—'})()},{label:'人脸核身',value:'即将上线'},{label:'风控报告',value:'即将上线'}]})),
 chooseSpec(event:WechatMiniprogram.TouchEvent){const q=Number(event.currentTarget.dataset['quantity']);if(q>0)this.setData({selectedQty:q})},
 chooseTab(event:WechatMiniprogram.TouchEvent){const tab=String(event.currentTarget.dataset['tab']);if(['contract','face','risk','bundle'].includes(tab))this.setData({currentTab:tab})},
 toggleRecords(){this.setData({showRecords:!this.data.showRecords})},buyPackage(){this.unavailable()},
  ...demoExtras('rental-service'),
});