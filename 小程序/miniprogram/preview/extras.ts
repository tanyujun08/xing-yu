import { readDemo, benefits, handleDemo, runDemoExtra, DemoProblem } from './engine';
import { type Row } from './seed';
import { rules } from './rule-core';
import { designAssets } from '../shared/design/assets';
import { displayGrowthUnits } from '../shared/presentation/api-points';
import { isLinked, linkedAction, linkedRequest, refreshLinked } from './linked';
const go = (url: string) => wx.navigateTo({ url });
const levels = ['青铜', '白银', '黄金', '铂金', '钻石', '星耀', '王者'].map((name, i) => ({ name, threshold: String([0, 1000, 5000, 20000, 50000, 100000, 200000][i]), state: i < 2 ? 'passed' : i === 2 ? 'current' : 'locked' }));
const common = { onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/demo-center/index' }) }); } };
function rentalPackages(kind: string): Row[] { return [1, 5, 10].map(quantity => ({ kind, quantity, title: quantity + ' 次' + ({ contract: '电子合同', face: '人脸核身', risk: '风控报告', bundle: '组合服务' }[kind] ?? '服务'), copy: '演示权益，即时到账，有效期 365 天', priceText: quantity * 100 + ' 粉钻', costText: quantity * 100 + ' 粉钻' })); }
function fail(page: Row, error: unknown) { const message=error instanceof Error?error.message:'本机演示操作失败'; page.setData({errorText:message}); wx.showToast({title:message,icon:'none'}); }
async function refresh() { if(isLinked())await refreshLinked(); }
function intent(page: Row, operation: string, values: Row): string {
 const fingerprint=JSON.stringify({operation,values});
 if(page._demoIntent && page._demoIntent.fingerprint!==fingerprint)throw new Error('上次操作结果待确认，请先重试原操作');
 page._demoIntent ??= {fingerprint,key:'demo-extra-'+Date.now()+'-'+Math.random().toString(36).slice(2)};
 return page._demoIntent.key;
}
async function extra(page: Row, kind: string, values: Row): Promise<Row> {
 if(page._demoBusy)throw new Error('操作正在处理');
 const key=intent(page,kind,values);page._demoBusy=true;
 try { const result=isLinked()?await linkedAction('extra',{kind,values,key}):runDemoExtra(kind,values,key);page._demoIntent=null;return result; }
 catch(error) {if(error instanceof DemoProblem || (error as {outcomeKnown?:boolean}).outcomeKnown)page._demoIntent=null;throw error;}
 finally {page._demoBusy=false;}
}
function request(method: string, path: string, body: Row = {}, key = ''): Promise<Row> {
 const headers=key?{'Idempotency-Key':key}:{};
 if(!isLinked())return Promise.resolve().then(()=>handleDemo(method,path,body,headers).data).catch(error=>{if(error instanceof DemoProblem)Object.assign(error,{outcomeKnown:true});throw error;});
 return new Promise((resolve,reject)=>linkedRequest({url:path,method,data:body,header:headers,
  success:(value: Row)=>value.statusCode>=400?reject(Object.assign(new Error(value.data?.message??'演示请求失败'),{outcomeKnown:true})):resolve(value.data),
  fail:(value: Row)=>reject(new Error(value.errMsg??'本机 Mock 服务不可用'))}));
}
export function demoExtras(name: string): Row {
 if (name === 'rental-service') return { ...common,
  async onShow(this: Row) { try { await refresh(); const s=readDemo();this.setData({loggedIn:true,errorText:'',loading:false,diamondBalance:String(s.pink),currentTab:this.data.currentTab||'contract',stats:[{label:'电子合同',value:String(rules(s).entitlements.CONTRACT)},{label:'人脸核身（模拟）',value:String(rules(s).entitlements.FACE??0)},{label:'风控报告（模拟）',value:String(rules(s).entitlements.RISK??0)}],packages:rentalPackages(this.data.currentTab||'contract'),records:s.purchases.map(v=>({id:v.purchase_id,label:v.name,quantityText:v.quantity+' 次',createdText:v.created_at,priceText:v.total_cost+' 粉钻'}))}); } catch(error) {fail(this,error);} },
  chooseTab(this: Row, e: Row) { const kind = String(e.currentTarget.dataset.tab); this.setData({ currentTab: kind, packages: rentalPackages(kind) }); },
  buyPackage(this: Row, e: Row) { if(this._demoBusy)return;const quantity=Number(e.currentTarget.dataset.quantity),service=String(e.currentTarget.dataset.kind);wx.showModal({title:'模拟购买',content:'使用 '+quantity*100+' 演示粉钻购买服务，不扣款。',success:result=>{if(!result.confirm)return;void extra(this,'servicePurchase',{quantity,service}).then(async()=>{await this.onShow();wx.showToast({title:'模拟权益已到账'});}).catch(error=>fail(this,error));}}); },
 };
 if (name === 'powder-mall') return { ...common,
  async onShow(this: Row) { try {await refresh();this.setData({loggedIn:true,loading:false,errorText:'',balance:String(readDemo().pink),mallProducts:this.data.mallProducts.map((v:Row)=>({...v,statusText:'100 粉钻 · 模拟兑换'}))});}catch(error){fail(this,error);} },
  goLottery() { go('/pages/lottery/index'); },
  redeem(this: Row, e: Row) { if(this._demoBusy)return;const product=String(e.currentTarget.dataset.productId);wx.showModal({title:'兑换演示优惠券',content:'使用 100 演示粉钻，可在优惠券中查看。',success:result=>{if(!result.confirm)return;void extra(this,'mallRedeem',{product}).then(()=>this.setData({balance:String(readDemo().pink),errorText:'兑换成功，可在优惠券页面查看。'})).catch(error=>fail(this,error));}}); },
  goLedger() { go('/pages/powder-ledger/index'); }, goCheckIn() { go('/pages/check-in/index'); }, goCoupons() { go('/pages/coupons/index'); },
 };
 if (name === 'level-rights') return { ...common, async onShow(this: Row) { try {await refresh();const s=readDemo();this.setData({loggedIn:true,loading:false,errorText:'',currentLevelName:'黄金',currentLevelNumber:'3',currentThresholdText:'5000',hasNextLevel:true,levels,currentBenefits:[{id:'publish',label:'发布额度 '+rules(s).entitlements.PUBLISH_QUOTA+' 次'},{id:'contract',label:'电子合同 '+rules(s).entitlements.CONTRACT+' 次'},{id:'coupon',label:'免押优惠券'}],nextBenefits:[{title:'更高免押额度',detail:'铂金会员模拟权益',icon:designAssets.membershipTaskWaiver},{title:'额外发布额度',detail:'每月赠送 5 次',icon:designAssets.membershipTaskQuota}],starPoints:displayGrowthUnits(s.growth),nextLevel:'铂金',nextThreshold:'20000',remainingPoints:displayGrowthUnits(Math.max(0,200000-s.growth)),progress:64,progressText:'64%'});}catch(error){fail(this,error);} }, openStarLedger() { go('/pages/star-ledger/index'); }, openGrowthTasks() { go('/pages/growth-tasks/index'); } };
 if (name === 'membership') return { ...common, async onShow(this: Row) { try {await refresh();const b=benefits();this.setData({loggedIn:true,loading:false,errorText:'',level:'黄金会员',levelCode:'GOLD',starPoints:displayGrowthUnits(b.profile.total_growth_units),nextLevel:'铂金',nextLevelPoints:'20000',progress:64,progressPercent:'64%',todayGrowth:'100',diamonds:b.profile.available_pink_units,shopCount:'6',dailyCheckInReward:'+100 粉钻',taskRows:[{title:'升级任务',detail:'完成任务获得星光',icon:designAssets.membershipTaskUpgrade},{title:'每日星光任务',detail:'签到领取奖励',icon:designAssets.membershipTaskCheckin}]});}catch(error){fail(this,error);} }, openTask(e: Row) { go(e.currentTarget.dataset.section === 'more' ? '/pages/publish-quota/index' : '/pages/growth-tasks/index'); }, openStarDetails() { go('/pages/star-ledger/index'); }, openBalanceDetails() { go('/pages/powder-ledger/index'); }, openShop() { go('/pages/powder-mall/index'); }, copyInvite() { wx.setClipboardData({ data: 'XINGYU-DEMO-10001' }); }, openCheckIn() { go('/pages/check-in/index'); }, openDetails() { go('/pages/level-rights/index'); } };
 if (name === 'withdrawal') return { ...common,
  onShow(this: Row) {return this.loadWallet();},
  async loadWallet(this: Row) {try {const wallet=await request('GET','/v1/me/cash-balance'),items=await request('GET','/v1/me/withdrawals');
   const saved=items.items.map((v:Row)=>({id:v.withdrawal_id,amountText:'¥'+(Number(v.amount_fen)/100).toFixed(2),amountValueText:(Number(v.amount_fen)/100).toFixed(2),state:'completed',stateText:'已到账（模拟）',stateTone:'success',accountLabel:'演示微信账户',createdText:v.created_at}));const balance=Number(wallet.available_fen);
   this.setData({referencePreview:false,accountJoined:true,walletReady:true,amountDisabled:false,availableFen:balance,availableText:'¥'+(balance/100).toFixed(2),availableValueText:(balance/100).toFixed(2),processingFen:0,processingText:'¥0.00',processingValueText:'0.00',errorText:'',accountLabel:'演示微信账户',primaryActionText:'模拟提现',withdrawals:saved,currentWithdrawal:null,historyWithdrawals:saved,hasWithdrawalRecords:saved.length>0});
  }catch(error){fail(this,error);}},
  submit(this: Row) {const text=String(this.data.amount??'');if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text))return this.setData({errorText:'请输入最多两位小数的金额。'});const amount=Math.round(Number(text)*100);if(amount<100||amount>this.data.availableFen||this.data.submitting)return this.setData({errorText:'请输入 1 元至可用余额之间的金额。'});this.setData({submitting:true});
   wx.showModal({title:'模拟提现',content:'仅扣减演示钱包余额，不发起真实转账。',success:result=>{if(!result.confirm){this.setData({submitting:false});return;}void(async()=>{const body={amount_fen:String(amount)},key=intent(this,'withdrawal',body);await request('POST','/v1/me/withdrawals',body,key);this._demoIntent=null;this.setData({amount:'',view:'records',submitDisabled:true});await this.loadWallet();})().catch(error=>{if((error as {outcomeKnown?:boolean}).outcomeKnown)this._demoIntent=null;fail(this,error);}).finally(()=>this.setData({submitting:false}));},fail:()=>this.setData({submitting:false})});
  }
 };

 if (name === 'wechat-waiver') return { ...common, onShow(this: Row) { this.setData({ errorText: '', missing: false, order: { id: 'RO-DEMO-000002' }, phase: 'checking', title: '模拟免押资格确认', copy: '已准备演示资格。此步骤不调用微信支付分。', paymentAmount: '400.00', submitting: false }); }, queryVerification(this: Row) { this.setData({ phase: 'success', title: '演示免押资格通过', copy: '可继续查看模拟支付订单。' }); }, startPayment() { go('/pages/order-detail/index?orderId=order-2'); }, backOrder() { go('/pages/order-detail/index?orderId=order-2'); } };
 if (name === 'service-detail') return { ...common, onShow(this: Row) { this.setData({ preview: true, missing: false, unavailable: false, previewTitle: '售后守护（演示）', previewPrice: '20.00', service: 'guard' }); } };
 if (name === 'private-messages') return { ...common, async onShow(this: Row) { try {const result=await request('GET','/v1/me/rental-conversations');this.setData({loggedIn:true,conversations:result.items.map((v:Row)=>({id:v.conversation_id,orderId:v.order_id,deviceName:v.order_summary.asset_title,orderNo:v.order_summary.order_no,name:v.peer.display_name,title:v.peer.display_name,preview:v.last_message?.preview??'',message:v.last_message?.preview??'',unread:1,time:'刚刚',avatar:'/assets/demo/avatar.png'}))});}catch(error){fail(this,error);} } };
 if (name === 'dispute') return { ...common,
  async onShow(this: Row) {try {await refresh();const stored=readDemo().receipts['demo-dispute'],accepted=stored?.status==='ACCEPTED';this.setData({errorText:'',missing:false,order:{id:'order-6',kind:'c2c',axes:{}},device:{name:'索尼 A7M4 全画幅相机'},mode:accepted?'platform_final':stored?'platform_review':'tenant_objection',modeTitle:accepted?'双方已确认（演示）':stored?'平台核实中（演示）':'提交异议（演示）',modeCopy:'请说明设备情况并提交凭证。此页面是正式源码尚未接入流程的演示补充。',editable:!stored,proposalAmount:'0',proposalNote:'',submittedRecords:stored?.items??[],finalAmountText:'0',canSupplement:true,submitting:false});}catch(error){fail(this,error);} },
  addEvidence(this: Row) {this.setData({proposalImagePaths:[{id:'evidence-demo',path:'/assets/demo/device-1.png',index:0}],dirty:true});},
  addGenericEvidence(this: Row) {this.setData({evidencePaths:[{id:'evidence-demo',path:'/assets/demo/device-1.png',index:0}],dirty:true});},
  deleteEvidence(this: Row) {this.setData({proposalImagePaths:[],evidencePaths:[]});},
  previewEvidence() {wx.previewImage({urls:['/assets/demo/device-1.png']});},
  submitObjection(this: Row) {const description=String(this.data.proposalNote||this.data.description||'').trim();if(!description)return wx.showToast({title:'请填写说明',icon:'none'});void extra(this,'dispute',{description,imagePaths:this.data.proposalImagePaths??[]}).then(async()=>{await this.onShow();wx.showToast({title:'模拟材料已提交'});}).catch(error=>fail(this,error));},
  submitProposal(this: Row) {this.submitObjection();},submitGenericEvidence(this: Row) {this.submitObjection();},
  acceptProposal(this: Row) {void extra(this,'disputeAccept',{}).then(()=>this.onShow()).catch(error=>fail(this,error));},
  startObjection(this: Row) {this.setData({mode:'tenant_objection',editable:true});}
 };
 return {};
}
