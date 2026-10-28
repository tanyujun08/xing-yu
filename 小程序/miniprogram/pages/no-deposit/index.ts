import { accountApi, benefitApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { currentAllowances } from '../../shared/presentation/member-allowances';
const states=new WeakMap<object,{scope:ReturnType<typeof createOperationScope>;navigation:ReturnType<typeof createNavigateOnce>;visible:boolean}>();
function state(page:object){let s=states.get(page);if(!s){s={scope:createOperationScope(),navigation:createNavigateOnce(),visible:true};states.set(page,s)}return s}
Page({
 data:{icons:designAssets,diamondBalance:'—',allowances:[] as ReturnType<typeof currentAllowances>,allowancesLoaded:false,hourly:false,errorText:'',visibleRules:[{id:'server',title:'押金方案',detail:'当前月免押次数来自账户权益。具体可用方案与抵扣结果以服务端订单报价为准。'}]},
 onSecondaryNavigationBack(){navigateBackWithFallback(state(this).navigation)},
 onLoad(options:Record<string,string|undefined>){this.setData({secondaryNavigationTitle:options.from==='profile'?'免押服务':'押金与粉钻'})},
 async onShow(){const s=state(this);s.visible=true;const owner=accountApi.sessionIdentity();this.setData({diamondBalance:'—',allowances:[],allowancesLoaded:false,errorText:owner?'':'请登录后查看账户权益。'});if(!owner)return;
  try{const result=await s.scope.latest('benefits',async()=>{const h=benefitApi.summary();const release=s.scope.registerCleanup(h.abort);try{return await h.promise}finally{release()}});
   if(!result.accepted||!s.visible||owner!==accountApi.sessionIdentity())return;if(result.value.profile.account_id!==owner)throw new Error('账户响应不一致');this.setData({diamondBalance:result.value.profile.available_pink_units,allowances:currentAllowances(result.value),allowancesLoaded:true});
  }catch(error){if(!s.scope.disposed&&s.visible)this.setData({errorText:error instanceof Error?error.message:'账户读取失败'})}
 },
 onHide(){state(this).visible=false;this.setData({diamondBalance:'—',allowances:[],allowancesLoaded:false})},
 onUnload(){const s=state(this);s.scope.dispose();s.navigation.dispose();states.delete(this)},
 goBack(){this.onSecondaryNavigationBack()},
});
