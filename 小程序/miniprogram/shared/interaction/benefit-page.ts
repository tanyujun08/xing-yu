
import { createOperationScope } from './operation-scope';
import { createNavigateOnce,navigateBackWithFallback } from './navigate-once';
type Handle<T>={promise:Promise<T>;abort():void};
type Target={setData(p:object):void};
const states=new WeakMap<object,{scope:ReturnType<typeof createOperationScope>;navigation:ReturnType<typeof createNavigateOnce>;epoch:number;visible:boolean;authorized:boolean}>();
function state(p:object){let s=states.get(p);if(!s){s={scope:createOperationScope(),navigation:createNavigateOnce(),epoch:0,visible:true,authorized:false};states.set(p,s)}return s}
export function createBenefitPage<T extends object,R>(initial:T,identity:()=>string|null,load:()=>Handle<R>,ownerOf:(r:R)=>string,project:(s:R)=>Partial<T>){return{
 data:{...initial,loggedIn:false,errorText:'',loading:false},
 async onShow(this:Target){const s=state(this);s.visible=true;const epoch=++s.epoch;const owner=identity();s.authorized=!!owner;this.setData({...initial,loggedIn:!!owner,loading:!!owner,errorText:owner?'':'请登录后查看账户权益'});if(!owner)return;
 try{const h=load();const release=s.scope.registerCleanup(h.abort);let summary:R;try{summary=await h.promise}finally{release()}if(s.scope.disposed||!s.visible||epoch!==s.epoch||owner!==identity())return;if(ownerOf(summary)!==owner)throw new Error('账户响应不一致');this.setData(project(summary))}catch(e){if(!s.scope.disposed&&s.visible&&epoch===s.epoch&&owner===identity())this.setData({errorText:e instanceof Error?e.message:'权益读取失败'})}finally{if(!s.scope.disposed&&s.visible&&epoch===s.epoch){if(owner!==identity()){s.authorized=false;this.setData({...initial,loggedIn:false,loading:false,errorText:'请登录后查看账户权益'})}else this.setData({loading:false})}}},
 onHide(this:Target){const s=state(this);s.visible=false;s.authorized=false;++s.epoch;this.setData({...initial,loggedIn:false})},
 onUnload(this:Target){const s=state(this);s.scope.dispose();s.navigation.dispose();states.delete(this)},
 onSecondaryNavigationBack(this:Target){navigateBackWithFallback(state(this).navigation)},
 goBack(this:Target){navigateBackWithFallback(state(this).navigation)},
 unavailable(){wx.showToast({title:'该功能接口暂未接入',icon:'none'})},
}}
export function navigateBenefitPage(page:object,url:string){const s=state(page);if(!s.authorized||!s.visible||s.scope.disposed)return;s.navigation.navigateOnce(url,c=>wx.navigateTo({url,...c}))}