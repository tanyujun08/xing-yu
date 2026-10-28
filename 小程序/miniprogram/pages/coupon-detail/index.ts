import { accountApi, couponApi, redemptionApi, ApiProblem, readLoyaltyIntent, prepareLoyaltyIntent, queryPendingRedemptions, verifyRedemptionResult, loyaltyTraceApi } from '../../shared/api/account-api';
import type { CouponDetail, CouponRedemptionAttempt, CouponRedemptionInput } from '../../shared/model/api-loyalty';
import type { LoyaltyIntent } from '../../shared/model/loyalty-intent';
import { loyaltyIdentifier } from '../../shared/model/loyalty-intent';
import { assertOwner, assertRedemptionAttempt } from '../../shared/presentation/loyalty';
import { presentOwnCoupon } from '../../shared/presentation/api-coupon';
import { formatDateTime } from '../../shared/format/date-time';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';

function createState(){return {owner:accountApi.sessionIdentity(),visible:false,scope:createOperationScope(),navigation:createNavigateOnce(),id:'',receiptId:'',coupon:null as CouponDetail|null,intent:null as LoyaltyIntent<CouponRedemptionInput>|null,pending:[] as CouponRedemptionAttempt[],attempt:null as CouponRedemptionAttempt|null};}
const states=new WeakMap<object,ReturnType<typeof createState>>();
function state(page:object){let value=states.get(page);if(!value){value=createState();states.set(page,value);}return value;}
function current(page:object,value:ReturnType<typeof createState>){return states.get(page)===value&&!value.scope.disposed&&value.visible&&!!value.owner&&value.owner===accountApi.sessionIdentity();}
const sourceTitles={CHECK_IN:'签到',PROGRESS:'成长奖励',REDEMPTION:'权益兑换',LOTTERY:'抽奖'};

Page({
 data:{loggedIn:false,loading:false,busy:false,errorText:'',coupon:null as ReturnType<typeof presentOwnCoupon>|null,canRedeem:false,confirmOpen:false,pendingText:'',restoreAvailable:false,pendingCouponId:'',attemptId:'',redemptionId:'',movementId:'',availableBefore:'—',availableAfter:'—',receiptState:'',reason:'',sourceTitle:'',issuedAt:'',events:[] as {id:string;title:string;time:string}[],currentCoupon:null as CouponDetail|null,lastRequest:null as LoyaltyIntent<CouponRedemptionInput>|null,attempt:null as CouponRedemptionAttempt|null},
 onLoad(options:Record<string,string|undefined>){const value=state(this);value.id=loyaltyIdentifier(options['coupon_id']??'')?options['coupon_id']!:'';value.receiptId=loyaltyIdentifier(options['redemption_id']??'')?options['redemption_id']!:'';},
 onShow(){let value=state(this);if(value.scope.disposed||value.owner!==accountApi.sessionIdentity()){const old=value;old.scope.dispose();old.navigation.dispose();states.delete(this);value=state(this);value.id=old.id;value.receiptId=old.receiptId;}value.visible=true;return this.refresh();},
 clearPrivate(){this.setData({loggedIn:false,coupon:null,canRedeem:false,confirmOpen:false,pendingText:'',restoreAvailable:false,pendingCouponId:'',attemptId:'',redemptionId:'',movementId:'',availableBefore:'—',availableAfter:'—',receiptState:'',reason:'',sourceTitle:'',issuedAt:'',events:[],busy:false,currentCoupon:null,lastRequest:null,attempt:null});},
 onHide(){const value=state(this);value.visible=false;value.scope.dispose();this.clearPrivate();},
 onUnload(){const value=state(this);value.scope.dispose();value.navigation.dispose();states.delete(this);},
 onBack(){navigateBackWithFallback(state(this).navigation);},
 openLogin(){state(this).navigation.navigateOnce('login',callbacks=>wx.navigateTo({url:'/pages/login/index?source=coupon-detail&id='+encodeURIComponent(state(this).id),...callbacks}));},
 async refresh(){const value=state(this);this.clearPrivate();this.setData({loggedIn:!!value.owner,loading:!!value.owner,errorText:''});if(!current(this,value))return;
  try{if(value.receiptId){const attempt=await redemptionApi.receipt(value.receiptId).promise;if(!current(this,value))return;assertRedemptionAttempt(attempt,value.owner!);if(attempt.redemption_id!==value.receiptId)throw new Error('兑换回执标识不一致');if(value.id&&value.id!==attempt.coupon_id)throw new Error('兑换回执与券不一致');value.id=attempt.coupon_id;}
   if(!value.id)throw new Error('缺少有效券标识，请从本人券包打开');await this.readCoupon();await this.recover();
  }catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'券详情读取失败'});}
  finally{if(current(this,value)){this.setData({loading:false});this.updateGate();}}
 },
 async readCoupon(){const value=state(this);const result=await value.scope.latest('coupon',()=>couponApi.detail(value.id).promise);if(!result.accepted||!current(this,value))return;assertOwner(result.value,value.owner!);if(result.value.coupon_id!==value.id)throw new Error('券标识不一致');value.coupon=result.value;
  this.setData({currentCoupon:result.value,coupon:presentOwnCoupon(result.value),sourceTitle:sourceTitles[result.value.source_kind],issuedAt:formatDateTime(result.value.issued_at),movementId:result.value.movement_id??'',redemptionId:result.value.redemption_id??'',events:result.value.status_events.map(event=>({id:event.event_id,title:event.action==='ISSUED'?'已发放':'已兑换',time:formatDateTime(event.occurred_at)}))});
 },
 updateGate(){const value=state(this);if(!current(this,value))return;const coupon=value.coupon;this.setData({canRedeem:!!coupon&&coupon.coupon_type==='PUBLISH_ONCE'&&coupon.rights_snapshot.kind==='PUBLISH_ONCE'&&coupon.status==='AVAILABLE'&&coupon.allowed_actions.can_redeem&&!value.intent&&!value.pending.length&&!this.data.loading&&!this.data.busy&&!this.data.errorText,pendingText:value.intent?'上一兑换请求待核实。':value.pending.length?'存在本人未决兑换，请先查询。':''});},
 async recover(){const value=state(this);if(!current(this,value))return;value.intent=readLoyaltyIntent<CouponRedemptionInput>(value.owner!,'coupon-redemption');value.pending=await queryPendingRedemptions(value.owner!);if(!current(this,value))return;
  this.setData({restoreAvailable:false,pendingCouponId:value.intent?.resourceId&&value.intent.resourceId!==value.id?value.intent.resourceId:value.pending.find(item=>item.coupon_id!==value.id)?.coupon_id??''});
  if(value.intent){try{const attempt=await(value.intent.attemptId?redemptionApi.attempt(value.intent.attemptId):redemptionApi.intent(value.intent.key)).promise;if(!current(this,value))return;await this.acceptAttempt(attempt,value.intent);}catch(error){if(current(this,value)&&error instanceof ApiProblem&&error.statusCode===404){this.setData({restoreAvailable:value.intent.resourceId===value.id});return;}throw error;}}
  else if(value.pending[0]){const attempt=await redemptionApi.attempt(value.pending[0].attempt_id).promise;if(current(this,value))await this.acceptAttempt(attempt);}
 },
 async acceptAttempt(attempt:CouponRedemptionAttempt,intent?:LoyaltyIntent<CouponRedemptionInput>|null){const value=state(this);if(!current(this,value))return;assertRedemptionAttempt(attempt,value.owner!);if(intent&&attempt.coupon_id!==intent.resourceId)throw new Error('原兑换请求与券不一致');value.attempt=attempt;
  if(attempt.coupon_id===value.id)this.setData({attempt,attemptId:attempt.attempt_id,receiptState:attempt.state==='COMPLETED'?'兑换已完成':attempt.state==='REJECTED'?'兑换被拒绝':'兑换结果核实中',reason:attempt.reason_code??'',availableBefore:attempt.available_before_qty??'—',availableAfter:attempt.available_after_qty??'—',redemptionId:attempt.redemption_id??'',movementId:attempt.movement_id??''});
  await verifyRedemptionResult(attempt,value.owner!,intent);if(!current(this,value))return;value.intent=readLoyaltyIntent<CouponRedemptionInput>(value.owner!,'coupon-redemption');if(attempt.coupon_id===value.id)await this.readCoupon();
 },
 queryOriginal(){const value=state(this);if(!current(this,value)||this.data.busy)return Promise.resolve();return value.scope.singleFlight('redemption-query',async()=>{this.setData({errorText:''});try{await this.recover();value.pending=await queryPendingRedemptions(value.owner!);if(current(this,value))this.updateGate();}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果读取失败'});}}).catch(()=>undefined);},
 redeem(){if(this.data.canRedeem)this.setData({confirmOpen:true});},
 cancelRedeem(){this.setData({confirmOpen:false});},
 confirmRedeem(){const value=state(this);if(!current(this,value)||!this.data.confirmOpen||!this.data.canRedeem||!value.coupon)return Promise.resolve();const coupon=value.coupon;this.setData({confirmOpen:false,busy:true,canRedeem:false,errorText:''});
  return value.scope.singleFlight('redemption-submit',async()=>{try{value.pending=await queryPendingRedemptions(value.owner!);if(!current(this,value))return;if(value.pending.length)throw new Error('存在未决兑换，请先查询');value.intent=prepareLoyaltyIntent(value.owner!,'coupon-redemption',{expected_coupon_version:coupon.version},coupon.coupon_id);await this.submitOriginal();}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'兑换结果待核实'});}finally{if(current(this,value)){this.setData({busy:false});this.updateGate();}}}).catch(()=>undefined);
 },
 restoreOriginal(){const value=state(this);if(!current(this,value)||!this.data.restoreAvailable||this.data.busy||value.intent?.resourceId!==value.id)return Promise.resolve();this.setData({busy:true});return value.scope.singleFlight('redemption-submit',async()=>{try{await this.submitOriginal();}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'结果待核实'});}finally{if(current(this,value)){this.setData({busy:false});this.updateGate();}}}).catch(()=>undefined);},
 async submitOriginal(){const value=state(this),intent=value.intent;if(!current(this,value)||!intent?.resourceId)return;this.setData({lastRequest:intent});const attempt=await redemptionApi.submit(intent.resourceId,intent.body,intent.key).promise;if(!current(this,value))return;await this.acceptAttempt(attempt,intent);value.pending=await queryPendingRedemptions(value.owner!);},
 navigate(url:string){const value=state(this);if(current(this,value))value.navigation.navigateOnce(url,callbacks=>wx.navigateTo({url,...callbacks}));},
 openPendingCoupon(){if(this.data.pendingCouponId)this.navigate('/pages/coupon-detail/index?coupon_id='+encodeURIComponent(this.data.pendingCouponId));},
 openQuota(){this.navigate('/pages/publish-quota/index'+(this.data.movementId?'?movement_id='+encodeURIComponent(this.data.movementId):''));},
 openSource(){const value=state(this),coupon=value.coupon;if(!coupon)return;if(coupon.source_kind==='LOTTERY'&&coupon.source_draw_id)this.navigate('/pages/lottery/index?draw_id='+encodeURIComponent(coupon.source_draw_id));else if(coupon.source_kind==='CHECK_IN')this.navigate('/pages/check-in/index?check_in_id='+encodeURIComponent(coupon.source_id));else void this.readGrant();},
 async readGrant(){const value=state(this);if(!current(this,value)||!value.coupon)return;try{const grant=await loyaltyTraceApi.grant(value.coupon.source_grant_id).promise;if(!current(this,value))return;assertOwner(grant,value.owner!);if(grant.grant_id!==value.coupon.source_grant_id||!grant.coupon_ids.includes(value.id))throw new Error('发放来源不一致');wx.showModal({title:'券发放来源',content:sourceTitles[grant.source_kind]+' · '+formatDateTime(grant.created_at)+'；'+grant.reward_units+' 张',showCancel:false});}catch(error){if(current(this,value))this.setData({errorText:error instanceof Error?error.message:'来源读取失败'});}},
});
