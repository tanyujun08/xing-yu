import { accountApi, benefitApi, couponApi } from '../../shared/api/account-api';
import { orderUnreadLifecycle, ownAssetsApi, rentalOrderApi } from '../../shared/api/rental-api';
import { designAssets } from '../../shared/design/assets';
import { rentalOrderCard } from '../../shared/presentation/rental-order';
import { createNavigateOnce } from '../../shared/interaction/navigate-once';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { ownMaterialMedia } from '../../shared/presentation/material-media';
type ProfileActionView={title:string;subtitle:string;icon:string;route:string};
type ProfileServiceView={title:string;icon:string;route:string};
const states=new WeakMap<object,{scope:ReturnType<typeof createOperationScope>;navigation:ReturnType<typeof createNavigateOnce>;visible:boolean;epoch:number;logoutIntent:string}>();
function state(page:object){let s=states.get(page);if(!s){s={scope:createOperationScope(),navigation:createNavigateOnce(),visible:true,epoch:0,logoutIntent:''};states.set(page,s)}return s}
function assets(loggedIn:boolean,pink='—',count='—'){return[
 {label:'粉钻',value:loggedIn?pink:'请登录',route:'/pages/powder-ledger/index',valueTone:'pink'},
 {label:'钱包',value:loggedIn?'查看收益':'请登录',route:'/pages/wallet/index'},
 {label:'免押服务',value:loggedIn?'查看说明':'请登录',route:'/pages/no-deposit/index?from=profile'},
 {label:'优惠券',value:loggedIn?count:'请登录',route:'/pages/coupons/index'},
]}
const connectedRoutes=new Set(['/pages/wallet/index','/pages/device-orders/index','/pages/order-detail/index','/pages/lottery/index','/pages/account-security/index','/pages/identity/index','/pages/coupons/index','/pages/membership/index','/pages/powder-ledger/index','/pages/rental-service/index','/pages/addresses/index','/pages/publish-quota/index','/pages/publish-eligibility/index','/pages/listings/index','/pages/no-deposit/index','/pages/about/index','/pages/info-guide/index','/pages/demo-support/index']);
const rentalShortcutItems: ProfileActionView[] = [
  { title: '我租的设备', subtitle: '', icon: designAssets.profileList, route: '/pages/device-orders/index?mode=rent' },
  { title: '我出租的设备', subtitle: '', icon: designAssets.profilePublish, route: '/pages/device-orders/index?mode=lend' },
  { title: '我的钱包', subtitle: '', icon: designAssets.profileWallet, route: '/pages/wallet/index' },
  { title: '免押服务', subtitle: '', icon: designAssets.profileCash, route: '/pages/no-deposit/index?from=profile' },
];

const personalRentalShortcuts: ProfileActionView[] = [
  { title: '我要出租', subtitle: '', icon: designAssets.profilePublish, route: '/pages/publish-eligibility/index' },
  { title: '我的上架', subtitle: '', icon: designAssets.profileList, route: '/pages/listings/index' },
  { title: '发布额度', subtitle: '', icon: designAssets.profileCoins, route: '/pages/publish-quota/index' },
  { title: '出租服务', subtitle: '', icon: designAssets.profileSecurity, route: '/pages/rental-service/index' },
];

const rentoutManagementItems: ProfileActionView[] = [
  { title: '我的上架', subtitle: '', icon: designAssets.profileList, route: '/pages/listings/index' },
  { title: '我出租的设备', subtitle: '', icon: designAssets.profileLend, route: '/pages/device-orders/index?mode=lend' },
  { title: '发布额度', subtitle: '', icon: designAssets.profileCoins, route: '/pages/publish-quota/index' },
  { title: '出租服务', subtitle: '', icon: designAssets.profileRentalService, route: '/pages/rental-service/index' },
];

const services: ProfileServiceView[] = [
  { title: '每日抽奖', icon: designAssets.membershipBalanceDiamond, route: '/pages/lottery/index' },
  { title: '租赁指南', icon: designAssets.profileRentalGuide, route: '/pages/info-guide/index' },
  { title: '地址管理', icon: designAssets.profileLocation, route: '/pages/addresses/index' },
  { title: '实名认证', icon: designAssets.profileVerified, route: '/pages/identity/index?from=profile' },
  { title: '账户安全', icon: designAssets.profileSecurity, route: '/pages/account-security/index' },
  { title: '联系客服', icon: designAssets.profileSupport, route: '/pages/demo-support/index' },
  { title: '关于星遇', icon: designAssets.profileAbout, route: '/pages/about/index' },
];

Page({
 data:{headerScrolled:false,icons:designAssets,currentAccount:{id:''},localProfile:{name:'',avatarPath:''},avatarFailed:false,avatarReloading:false,avatarEpoch:0,loggedIn:false,showLendSection:false,showAccountSwitcher:false,
 identityRegistered:false,identityText:'身份信息暂未接入',memberLevel:'—',memberLevelCode:'',stats:[] as {label:string;value:string}[],assetItems:assets(false),
 rentalSummary:null as {route:string;deviceName:string;statusText:string;rentText:string;timeText:string}|null,rentalEmptyTitle:'暂无租用订单',rentalEmptyCopy:'浏览设备，开启你的租赁体验。',
 lendStatus:{listingStatus:'暂未接入',lendOrderStatus:'暂未接入',quotaStatus:'—',serviceStatus:'—'},rentalShortcuts:rentalShortcutItems,personalRentalShortcuts,rentoutManagementItems,services,errorText:'',
 rentalItems:[{title:'我租的设备',route:'/pages/device-orders/index?mode=rent'},{title:'我出租的设备',route:'/pages/device-orders/index?mode=lend'},{title:'我的钱包',route:'/pages/wallet/index'},{title:'免押服务',route:'/pages/no-deposit/index?from=profile'}],
 lendItems:[{ title: '发布额度', route: '/pages/publish-quota/index' },{ title: '出租服务', route: '/pages/rental-service/index' }],
 },
 onPageScroll(event:WechatMiniprogram.Page.IPageScrollOption){const headerScrolled=event.scrollTop>0;if(headerScrolled!==this.data.headerScrolled)this.setData({headerScrolled})},
 clearPrivate(){this.setData({loggedIn:false,showLendSection:false,avatarFailed:false,avatarReloading:false,avatarEpoch:0,localProfile:{name:'',avatarPath:''},assetItems:assets(false),memberLevel:'—',memberLevelCode:'',identityRegistered:false,identityText:'—',currentAccount:{id:''},rentalSummary:null})},
 async onShow(){this.getTabBar()?.setData({selected:3});orderUnreadLifecycle.show(this);const s=state(this);s.visible=true;const epoch=++s.epoch;const owner=accountApi.sessionIdentity();this.clearPrivate();this.setData({errorText:''});if(!owner)return;
 this.setData({loggedIn:true,showLendSection:true,avatarEpoch:epoch,assetItems:assets(true)});
 try{const result=await s.scope.latest('profile',()=>Promise.allSettled([accountApi.profile().promise,benefitApi.summary().promise,couponApi.list('AVAILABLE',null).promise,accountApi.identity().promise,rentalOrderApi.list({role:'TENANT'}).promise,rentalOrderApi.list({role:'LESSOR'}).promise,ownAssetsApi.list().promise]));
 if(!result.accepted||!s.visible||epoch!==s.epoch)return; if(owner!==accountApi.sessionIdentity()){this.clearPrivate();return;}
 const [profile,benefits,coupons,identity,rented,lent,listings]=result.value;let pink='—';let count='—';
 if(profile.status==='fulfilled'){if(profile.value.account_id!==owner)throw new Error('账户响应不一致');this.setData({currentAccount:{id:owner},localProfile:{name:profile.value.display_name,avatarPath:''}});
  if(profile.value.avatar_material_id){const handle=accountApi.material(profile.value.avatar_material_id);const release=s.scope.registerCleanup(handle.abort);let avatar;try{avatar=await handle.promise}finally{release()}
   if(s.scope.disposed||epoch!==s.epoch||!s.visible||owner!==accountApi.sessionIdentity())return;
   const media=ownMaterialMedia(avatar,profile.value.avatar_material_id,owner,'PROFILE_IMAGE');if(media)this.setData({'localProfile.avatarPath':media.src});
  }
 }
 if(benefits.status==='fulfilled'){const v=benefits.value;if(v.profile.account_id!==owner)throw new Error('账户响应不一致');pink=v.profile.available_pink_units;const quota=v.entitlements.find(item=>item.kind==='PUBLISH_QUOTA');const contract=v.entitlements.find(item=>item.kind==='CONTRACT');this.setData({memberLevel:v.profile.level_code??'尚未评定',memberLevelCode:'',lendStatus:{listingStatus:listings.status==='fulfilled'?`${listings.value.items.filter(item=>item.resource_kind==='ASSET'&&item.publish_status==='ONLINE').length}${listings.value.page.has_more?'+':''}`:'—',lendOrderStatus:lent.status==='fulfilled'?`${lent.value.value.items.length}${lent.value.value.has_more?'+':''}`:'—',quotaStatus:quota?.expiry_pending?'待刷新':quota?.available_qty??'—',serviceStatus:contract?.expiry_pending?'待刷新':contract?.available_qty??'—'}})}
 if(coupons.status==='fulfilled'){if(coupons.value.items.some(item=>item.account_id!==owner||item.status!=='AVAILABLE'))throw new Error('优惠券响应不一致');count=`${coupons.value.items.length}${coupons.value.page.next_cursor!==null?'+':''} 张`}
 if(rented.status==='fulfilled'){const orders=rented.value.value.items;const order=orders.find(item=>item.display_status_code==='IN_USE')??orders.find(item=>!['CLOSED','COMPLETED'].includes(item.stage))??orders[0];if(order){const card=rentalOrderCard(order);this.setData({rentalSummary:{route:'/pages/order-detail/index?id='+encodeURIComponent(order.order_id),deviceName:card.deviceName,statusText:card.currentNodeText,rentText:card.amountLabel+' '+card.amountText,timeText:card.rentalText}})}else this.setData({rentalSummary:null,rentalEmptyTitle:'暂无租用订单',rentalEmptyCopy:'浏览设备，开启你的租赁体验。'})}else this.setData({rentalSummary:null,rentalEmptyTitle:'租用订单暂时无法读取',rentalEmptyCopy:'请稍后重新进入个人中心。'});
 const identityText=identity.status==='fulfilled'?({NOT_VERIFIED:'未实名认证',PENDING:'认证处理中',REAL_NAME_VERIFIED:'实名信息已填写',FACE_VERIFIED:'实名认证已完成'} as const)[identity.value.overall_status]:'认证状态读取失败';
 this.setData({identityRegistered:identity.status==='fulfilled'&&identity.value.real_name.status==='VERIFIED',assetItems:assets(true,pink,count),identityText:identityText||'认证状态响应无效',errorText:[profile,benefits,coupons,identity,rented,lent,listings].some(item=>item.status==='rejected')?'部分账户信息读取失败，请重试。':''});
 }catch(error){if(!s.scope.disposed&&s.visible&&owner===accountApi.sessionIdentity())this.setData({errorText:error instanceof Error?error.message:'账户读取失败'})}
 },
 onHide(){orderUnreadLifecycle.hide(this);++state(this).epoch;state(this).visible=false;this.clearPrivate()},
 onUnload(){orderUnreadLifecycle.hide(this);const s=state(this);s.scope.dispose();s.navigation.dispose();states.delete(this)},
 onAvatarImageError(event:WechatMiniprogram.CustomEvent){
  const s=states.get(this);const owner=accountApi.sessionIdentity();const source=String(event.currentTarget.dataset['src']??'');
  if(!s||!s.visible||s.scope.disposed||!owner||this.data.currentAccount.id!==owner||event.currentTarget.dataset['owner']!==owner||Number(event.currentTarget.dataset['epoch'])!==s.epoch||!source||source!==this.data.localProfile.avatarPath)return;
  this.setData({avatarFailed:true});
 },
 retryAvatarImage(event:WechatMiniprogram.TouchEvent){
  const s=states.get(this);const owner=accountApi.sessionIdentity();const source=String(event.currentTarget.dataset['src']??'');
  if(!s||!s.visible||s.scope.disposed||!owner||this.data.currentAccount.id!==owner||event.currentTarget.dataset['owner']!==owner||Number(event.currentTarget.dataset['epoch'])!==s.epoch||!source||source!==this.data.localProfile.avatarPath||!this.data.avatarFailed||this.data.avatarReloading)return;
  const epoch=s.epoch;this.setData({avatarReloading:true});
  wx.nextTick(()=>{
   if(states.get(this)!==s||!s.visible||s.scope.disposed||s.epoch!==epoch||owner!==accountApi.sessionIdentity()||this.data.currentAccount.id!==owner||this.data.localProfile.avatarPath!==source)return;
   this.setData({avatarFailed:false,avatarReloading:false});
  });
 },
 openLogin(){state(this).navigation.navigateOnce('login',callbacks=>wx.navigateTo({url:'/pages/login/index',...callbacks}))},
 requireLogin(){if(accountApi.sessionIdentity())return true;wx.showModal({title:'请先登录',content:'登录后查看本人账户信息。',confirmText:'去登录',success:state(this).scope.guard(result=>{if(result.confirm)this.openLogin()})});return false},
 openProfileEdit(){if(this.requireLogin())state(this).navigation.navigateOnce('edit',callbacks=>wx.navigateTo({url:'/pages/profile-edit/index',...callbacks}))},
 openMember(){if(this.requireLogin())state(this).navigation.navigateOnce('member',callbacks=>wx.navigateTo({url:'/pages/membership/index',...callbacks}))},
 toggleAccountSwitcher(){wx.showToast({title:'请退出后重新登录微信账户',icon:'none'})},
 chooseExperienceAccount(){this.toggleAccountSwitcher()},
 logout(){const s=state(this);const owner=accountApi.sessionIdentity();wx.showModal({title:'退出登录',content:'退出当前微信账户会话。',confirmText:'退出',success:s.scope.guard(result=>{if(!result.confirm||owner!==accountApi.sessionIdentity())return;s.logoutIntent ||= accountApi.newIntent('logout');void s.scope.singleFlight('logout',async()=>{try{await accountApi.logout(s.logoutIntent);s.logoutIntent='';if(!s.scope.disposed&&!accountApi.sessionIdentity())this.clearPrivate()}catch(error){if(!s.scope.disposed)this.setData({errorText:error instanceof Error?error.message:'退出结果待确认，请重试原请求。'})}}).catch(()=>undefined)})})},
 openItem(event:WechatMiniprogram.TouchEvent){const route=String(event.currentTarget.dataset['route']??'');const path=route.split('?')[0]??'';if(!['/pages/about/index','/pages/info-guide/index'].includes(path)&&!this.requireLogin())return;
 if(!connectedRoutes.has(path)){wx.showToast({title:'该功能接口暂未接入',icon:'none'});return}
 state(this).navigation.navigateOnce('profile:'+path,callbacks=>wx.navigateTo({url:route,...callbacks}));
 },
});
