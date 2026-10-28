import { accountApi, lotteryApi, ApiProblem, readLoyaltyIntent, prepareLoyaltyIntent, queryPendingLottery, verifyLotteryResult } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { createCursorList, type CursorList } from '../../shared/interaction/cursor-list';
import type { LotteryAttempt, LotteryDrawInput, LotteryState, CouponType } from '../../shared/model/api-loyalty';
import type { LoyaltyIntent } from '../../shared/model/loyalty-intent';
import type { ListState } from '../../shared/model/view-state';
import { loyaltyIdentifier } from '../../shared/model/loyalty-intent';
import { assertLotteryState, assertLotteryAttempt, lotteryCanDraw, presentLotteryAttempt, couponTitles, rightsText } from '../../shared/presentation/loyalty';
import { displayQuantity, quantityAfterCost } from '../../shared/format/quantity';

type ResultView=ReturnType<typeof presentLotteryAttempt>;
function createState(){return {owner:accountApi.sessionIdentity(),visible:false,scope:createOperationScope(),navigation:createNavigateOnce(),config:null as LotteryState|null,intent:null as LoyaltyIntent<LotteryDrawInput>|null,pending:[] as LotteryAttempt[],list:null as CursorList<ResultView>|null,detail:null as LotteryAttempt|null,entryAttempt:'',entryDraw:''};}
const states=new WeakMap<object,ReturnType<typeof createState>>();
function state(page:object){let value=states.get(page);if(!value){value=createState();states.set(page,value);}return value;}
function current(page:object,value:ReturnType<typeof createState>){return states.get(page)===value&&!value.scope.disposed&&value.visible&&!!value.owner&&value.owner===accountApi.sessionIdentity();}
const stateFilters:{id:LotteryAttempt['state']|'';label:string}[]=[{id:'',label:'全部状态'},{id:'RECEIVED',label:'已接收'},{id:'VERIFYING',label:'核实中'},{id:'REJECTED',label:'已拒绝'},{id:'COMPLETED',label:'已完成'}];
const resultFilters:{id:NonNullable<LotteryAttempt['result_kind']>|'';label:string}[]=[{id:'',label:'全部结果'},{id:'WIN',label:'中奖'},{id:'NO_WIN',label:'未中奖'}];

Page({
 data:{icons:designAssets,loggedIn:false,loading:false,drawing:false,canDraw:false,balance:'—',cost:'—',errorText:'',pendingText:'',restoreAvailable:false,prizes:[] as {id:string;title:string;description:string;status:string}[],records:[] as ResultView[],listState:{phase:'empty'} as ListState,stateFilters,resultFilters,stateFilter:'' as LotteryAttempt['state']|'',resultFilter:'' as NonNullable<LotteryAttempt['result_kind']>|'',resultOpen:false,result:null as ResultView|null,confirmOpen:false,confirmedCost:'—',predictedBalance:'—',currentConfig:null as LotteryState|null,lastRequest:null as LoyaltyIntent<LotteryDrawInput>|null,attempt:null as LotteryAttempt|null},
 onLoad(options:Record<string,string|undefined>){const value=state(this);value.entryAttempt=loyaltyIdentifier(options['attempt_id']??'')?options['attempt_id']!:'';value.entryDraw=loyaltyIdentifier(options['draw_id']??'')?options['draw_id']!:'';},
 onShow(){let value=state(this);if(value.scope.disposed||value.owner!==accountApi.sessionIdentity()){const old=value;old.scope.dispose();old.navigation.dispose();states.delete(this);value=state(this);value.entryAttempt=old.entryAttempt;value.entryDraw=old.entryDraw;}value.visible=true;return this.refresh();},
 clearPrivate(){this.setData({loggedIn:false,canDraw:false,balance:'—',cost:'—',prizes:[],records:[],resultOpen:false,result:null,confirmOpen:false,restoreAvailable:false,pendingText:'',drawing:false,listState:{phase:'empty'},currentConfig:null,lastRequest:null,attempt:null});},
 onHide(){const value=state(this);value.visible=false;value.list?.dispose();value.list=null;value.scope.dispose();this.clearPrivate();},
 onUnload(){const value=state(this);value.list?.dispose();value.scope.dispose();value.navigation.dispose();states.delete(this);},
 onSecondaryNavigationBack(){navigateBackWithFallback(state(this).navigation);},
 openLogin(){state(this).navigation.navigateOnce('login',callbacks=>wx.navigateTo({url:'/pages/login/index?source=lottery',...callbacks}));},
 async refresh(){const value=state(this);this.clearPrivate();this.setData({loggedIn:!!value.owner,loading:!!value.owner,errorText:''});if(!current(this,value))return;
  const results=await Promise.allSettled([this.loadState(),this.loadRecords(),this.recover()]);
  if(!current(this,value))return;
  const errors=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected').map(result=>result.reason instanceof Error?result.reason.message:'读取失败，请重试');
  this.setData({loading:false,errorText:errors.join('；')});this.updateGate();
  if(value.entryAttempt||value.entryDraw){const attempt=value.entryAttempt,draw=value.entryDraw;value.entryAttempt='';value.entryDraw='';await this.readDetail(attempt,draw);}
 },
 async loadState(){const value=state(this);value.config=null;this.setData({canDraw:false});const result=await value.scope.latest('state',()=>lotteryApi.state().promise);if(!result.accepted||!current(this,value))return;assertLotteryState(result.value,value.owner!);value.config=result.value;
  this.setData({currentConfig:result.value,balance:displayQuantity(result.value.available_pink_units),cost:displayQuantity(result.value.cost_pink_units),prizes:result.value.prizes.map(prize=>({id:prize.prize_code,title:prize.prize_code==='PINK'?'粉钻':couponTitles[prize.prize_code as CouponType],description:prize.prize_code==='PINK'?displayQuantity(prize.pink_reward_units)+' 粉钻':prize.rights_display?rightsText(prize.rights_display):'权益暂不可用',status:!prize.enabled?'暂不可用':prize.remaining_qty==='0'?'已发完':'可抽取'}))});
 },
 updateGate(){const value=state(this);if(!current(this,value))return;this.setData({canDraw:lotteryCanDraw(value.config,!!value.intent||value.pending.length>0||!!this.data.errorText||this.data.loading||this.data.drawing),pendingText:value.intent?'上一请求待核实，请查询原结果。':value.pending.length?'存在本人未决抽奖，请先查询。':value.config?.blocked_reason??''});},
 loadRecords(){const value=state(this);if(!current(this,value))return Promise.resolve();value.list?.dispose();const owner=value.owner!,filter=this.data.stateFilter,resultFilter=this.data.resultFilter;
  value.list=createCursorList<LotteryAttempt,ResultView>({load:async input=>{const page=await lotteryApi.list(input.cursor,filter||undefined,resultFilter||undefined).promise;if(!current(this,value))throw new Error('页面已离开');page.items.forEach(item=>{assertLotteryAttempt(item,owner);if((filter&&item.state!==filter)||(resultFilter&&item.result_kind!==resultFilter))throw new Error('抽奖筛选响应不一致');});return {items:page.items,hasMore:page.page.next_cursor!==null,nextCursor:page.page.next_cursor,generation:input.generation??accountApi.newIntent('lottery-list')};},present:presentLotteryAttempt,getId:item=>item.attempt_id,onPatch:patch=>{if(!current(this,value))return;const data:Record<string,unknown>={listState:patch.state};if(patch.replace)data['records']=patch.replace;for(const item of patch.append??[])data[item.path.replace(/^items/u,'records')]=item.value;this.setData(data);}});return value.list.initial();
 },
 onReachBottom(){const value=state(this);if(current(this,value))void value.list?.loadMore();},
 async onPullDownRefresh(){try{await this.refresh();}finally{wx.stopPullDownRefresh();}},
 retryList(){void this.loadRecords();},
 retryMore(){this.onReachBottom();},
 changeState(event:WechatMiniprogram.TouchEvent){const filter=String(event.currentTarget.dataset['filter']??'') as LotteryAttempt['state']|'';if(!stateFilters.some(item=>item.id===filter))return;this.setData({stateFilter:filter,resultFilter:filter&&filter!=='COMPLETED'?'':this.data.resultFilter,records:[]});void this.loadRecords();},
 changeResult(event:WechatMiniprogram.TouchEvent){const filter=String(event.currentTarget.dataset['filter']??'') as NonNullable<LotteryAttempt['result_kind']>|'';if(!resultFilters.some(item=>item.id===filter))return;this.setData({resultFilter:filter,stateFilter:filter?'COMPLETED':this.data.stateFilter,records:[]});void this.loadRecords();},
 async recover(){const value=state(this);if(!current(this,value))return;value.intent=readLoyaltyIntent<LotteryDrawInput>(value.owner!,'lottery');value.pending=await queryPendingLottery(value.owner!);if(!current(this,value))return;this.setData({restoreAvailable:false});
  if(value.intent){try{const attempt=await(value.intent.attemptId?lotteryApi.attempt(value.intent.attemptId):lotteryApi.intent(value.intent.key)).promise;if(!current(this,value))return;await this.acceptAttempt(attempt,value.intent);}catch(error){if(current(this,value)&&error instanceof ApiProblem&&error.statusCode===404){this.setData({restoreAvailable:true,pendingText:'原请求尚未查询到，可恢复同一请求。'});return;}throw error;}}
  else if(value.pending[0]){await this.readDetail(value.pending[0].attempt_id,'');}
 },
 async acceptAttempt(attempt:LotteryAttempt,intent?:LoyaltyIntent<LotteryDrawInput>|null){const value=state(this);if(!current(this,value))return;assertLotteryAttempt(attempt,value.owner!);value.detail=attempt;this.setData({attempt,result:presentLotteryAttempt(attempt),resultOpen:true});await verifyLotteryResult(attempt,value.owner!,intent);if(!current(this,value))return;value.intent=readLoyaltyIntent<LotteryDrawInput>(value.owner!,'lottery');this.setData({restoreAvailable:false});},
 async readDetail(attemptId:string,drawId:string){const value=state(this);if(!current(this,value))return;try{const result=await value.scope.latest('detail',()=>(attemptId?lotteryApi.attempt(attemptId):lotteryApi.draw(drawId)).promise);if(!result.accepted||!current(this,value))return;if(attemptId&&result.value.attempt_id!==attemptId||drawId&&result.value.draw_id!==drawId)throw new Error('抽奖记录标识不一致');await this.acceptAttempt(result.value,value.intent?.attemptId===result.value.attempt_id?value.intent:null);}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果读取失败'});}},
 openRecord(event:WechatMiniprogram.TouchEvent){const id=String(event.currentTarget.dataset['id']??'');if(this.data.records.some(item=>item.id===id))void this.readDetail(id,'');},
 queryOriginal(){const value=state(this);if(!current(this,value)||this.data.drawing)return;return value.scope.singleFlight('query-original',async()=>{this.setData({errorText:''});try{await this.recover();if(current(this,value)){await this.loadState();this.updateGate();}}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果读取失败'});}}).catch(()=>undefined);},
 draw(){const value=state(this);if(!current(this,value)||!this.data.canDraw||!value.config)return;this.setData({confirmOpen:true,confirmedCost:displayQuantity(value.config.cost_pink_units),predictedBalance:quantityAfterCost(value.config.available_pink_units,value.config.cost_pink_units!)??'—'});},
 cancelDraw(){this.setData({confirmOpen:false});},
 confirmDraw(){const value=state(this);if(!current(this,value)||!this.data.confirmOpen||!this.data.canDraw||!value.config)return Promise.resolve();const config=value.config;this.setData({confirmOpen:false,drawing:true,canDraw:false,errorText:''});
  return value.scope.singleFlight('lottery-submit',async()=>{try{value.pending=await queryPendingLottery(value.owner!);if(!current(this,value))return;if(value.pending.length)throw new Error('存在未决抽奖，请先查询原结果');value.intent=prepareLoyaltyIntent(value.owner!,'lottery',{expected_lottery_config_version_id:config.lottery_config_version_id!,expected_coupon_config_version_id:config.coupon_config_version_id,confirmed_cost_pink_units:config.cost_pink_units!});await this.submitOriginal();}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果待核实，请查询原结果'});}finally{if(current(this,value)){this.setData({drawing:false});this.updateGate();}}}).catch(()=>undefined);
 },
 restoreOriginal(){const value=state(this);if(!current(this,value)||!value.intent||!this.data.restoreAvailable||this.data.drawing)return Promise.resolve();this.setData({drawing:true,canDraw:false});return value.scope.singleFlight('lottery-submit',async()=>{try{await this.submitOriginal();}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果待核实'});}finally{if(current(this,value)){this.setData({drawing:false});this.updateGate();}}}).catch(()=>undefined);},
 async submitOriginal(){const value=state(this);const intent=value.intent;if(!intent||!current(this,value))return;this.setData({lastRequest:intent});const attempt=await lotteryApi.submit(intent.body,intent.key).promise;if(!current(this,value))return;await this.acceptAttempt(attempt,intent);if(current(this,value)){await Promise.all([this.loadState(),this.loadRecords()]);value.pending=await queryPendingLottery(value.owner!);}},
 closeResult(){const value=state(this);this.setData({resultOpen:false});if(current(this,value)){void this.loadState().then(()=>this.updateGate()).catch(()=>undefined);void this.loadRecords();}},
 noop(){},
 navigate(url:string){const value=state(this);if(current(this,value))value.navigation.navigateOnce(url,callbacks=>wx.navigateTo({url,...callbacks}));},
 goCheckIn(){this.navigate('/pages/check-in/index');},
 goCoupons(){this.navigate('/pages/coupons/index');},
 openCoupon(){if(this.data.result?.couponId)this.navigate('/pages/coupon-detail/index?coupon_id='+encodeURIComponent(this.data.result.couponId));},
 openSpend(){if(this.data.result?.spendEntryId)this.navigate('/pages/powder-ledger/index?entry_id='+encodeURIComponent(this.data.result.spendEntryId));},
 openReward(){if(this.data.result?.rewardEntryId)this.navigate('/pages/powder-ledger/index?entry_id='+encodeURIComponent(this.data.result.rewardEntryId));},
 showRules(){wx.showModal({title:'抽奖规则',content:'每次消耗 '+this.data.cost+' 粉钻，未中奖也会消耗。奖品与消耗以实际回执为准；结果未决时请查询原请求。',showCancel:false});},
});
