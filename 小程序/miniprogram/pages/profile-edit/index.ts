import { demoWx } from '../../preview/platform';
import { accountApi, ApiProblem, runMaterialUpload } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce,navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { createMaterialUploadIntent, materialUploadBlocksSave, type MaterialUploadIntent } from '../../shared/model/material-media';
import { ownMaterialMedia } from '../../shared/presentation/material-media';
type Profile=Awaited<ReturnType<typeof accountApi.profile>['promise']>;
type SaveBody={display_name:string;avatar_material_id:string;locale:'zh-CN'};
function createState(){return{owner:accountApi.sessionIdentity(),visible:false,epoch:0,generation:0,picker:undefined as {hidden:boolean;completed?:boolean}|undefined,uploadRun:undefined as {abort:()=>void}|undefined,scope:createOperationScope(),navigation:createNavigateOnce(),original:undefined as Profile|undefined,avatarId:'',dirty:false,upload:undefined as MaterialUploadIntent|undefined,pending:undefined as {body:SaveBody;intent:string;version:number}|undefined}}
const states=new WeakMap<object,ReturnType<typeof createState>>();
function state(page:object){let s=states.get(page);if(!s){s=createState();states.set(page,s)}return s}
function current(page:object,s:ReturnType<typeof createState>,epoch=s.epoch){return s.visible&&epoch===s.epoch&&!s.scope.disposed&&states.get(page)===s&&!!s.owner&&s.owner===accountApi.sessionIdentity()}
Page({
 data:{icons:designAssets,name:'',avatarPath:'',avatarFailed:false,avatarReloading:false,avatarOwner:'',avatarEpoch:0,identityText:'身份状态暂未接入',identityTone:'pending',saving:false,selectingAvatar:false,avatarPending:false,avatarStatus:'',errorText:'',loading:false},
 onSecondaryNavigationBack(){navigateBackWithFallback(state(this).navigation)},
 async onShow(){let s=state(this);if(s.owner!==accountApi.sessionIdentity()){s.scope.dispose();s.navigation.dispose();states.delete(this);s=state(this);this.setData({name:'',avatarPath:'',avatarFailed:false,avatarReloading:false,avatarOwner:'',avatarEpoch:0,saving:false,selectingAvatar:false,avatarPending:false,avatarStatus:'',errorText:''})}
  if(s.picker?.hidden){s.picker.hidden=false;if(s.picker.completed)s.picker=undefined;return}
  if(s.scope.disposed)s.scope=createOperationScope();s.visible=true;const epoch=++s.epoch;
  this.setData({avatarPending:materialUploadBlocksSave(s.upload),avatarStatus:s.upload?.error??'',saving:false,selectingAvatar:false,avatarFailed:false,avatarReloading:false,avatarOwner:s.owner??'',avatarEpoch:epoch});
  if(!s.owner){s.navigation.navigateOnce('login',callbacks=>wx.redirectTo({url:'/pages/login/index',...callbacks}));return}
  if(s.original)return;this.setData({loading:true});
  try{const result=await s.scope.latest('profile',()=>accountApi.profile().promise);if(!result.accepted||!current(this,s,epoch))return;const profile=result.value;if(profile.account_id!==s.owner)throw new Error('账户响应不一致');s.original=profile;s.avatarId=profile.avatar_material_id??'';this.setData({name:profile.display_name});
   if(s.avatarId){const handle=accountApi.material(s.avatarId);const release=s.scope.registerCleanup(handle.abort);try{const material=await handle.promise;const media=ownMaterialMedia(material,s.avatarId,s.owner!,'PROFILE_IMAGE');if(current(this,s,epoch)&&media)this.setData({avatarPath:media.src})}finally{release()}}
  }catch(error){if(current(this,s,epoch))this.setData({errorText:error instanceof Error?error.message:'个人资料读取失败'})}finally{if(current(this,s,epoch))this.setData({loading:false})}
 },
 onHide(){const s=state(this);if(s.picker){s.picker.hidden=true;return}s.visible=false;++s.epoch;s.uploadRun?.abort();s.scope.dispose();this.setData({selectingAvatar:false,saving:false,loading:false,avatarReloading:false})},
 onUnload(){const s=state(this);s.scope.dispose();s.navigation.dispose();states.delete(this)},
 onAvatarImageError(event:WechatMiniprogram.CustomEvent){
  const s=states.get(this);const source=String(event.currentTarget.dataset['src']??'');
  if(!s||!current(this,s)||event.currentTarget.dataset['owner']!==s.owner||Number(event.currentTarget.dataset['epoch'])!==s.epoch||!source||source!==this.data.avatarPath)return;
  this.setData({avatarFailed:true});
 },
 retryAvatarImage(event:WechatMiniprogram.TouchEvent){
  const s=states.get(this);const source=String(event.currentTarget.dataset['src']??'');
  if(!s||!current(this,s)||event.currentTarget.dataset['owner']!==s.owner||Number(event.currentTarget.dataset['epoch'])!==s.epoch||!source||source!==this.data.avatarPath||!this.data.avatarFailed||this.data.avatarReloading)return;
  const epoch=s.epoch;this.setData({avatarReloading:true});
  wx.nextTick(()=>{if(current(this,s,epoch)&&this.data.avatarPath===source)this.setData({avatarFailed:false,avatarReloading:false})});
 },
 inputName(event:WechatMiniprogram.Input){const s=state(this);if(s.pending){this.setData({errorText:'上次保存结果待确认，请重试原请求。'});return}s.dirty=true;this.setData({name:event.detail.value})},
 chooseAvatar(){const s=state(this);if(!current(this,s)||s.pending)return Promise.resolve();if(s.upload){this.setData({errorText:'头像处理尚未完成，请显式恢复原请求，或取消后重新选择。'});return Promise.resolve()}
  const epoch=s.epoch;return s.scope.singleFlight('avatar-select',async()=>{this.setData({selectingAvatar:true,errorText:''});try{
   s.picker={hidden:false};const selected=await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve,reject)=>demoWx.chooseMedia({count:1,mediaType:['image'],sourceType:['album','camera'],success:resolve,fail:reject}));if(s.picker){s.picker.completed=true;if(!s.picker.hidden)s.picker=undefined;}
   if(!current(this,s,epoch))return;const file=selected.tempFiles[0]?.tempFilePath;if(!file)throw new Error('未取得头像原文件');
   s.upload=createMaterialUploadIntent({owner:s.owner!,field:'avatar',item:'avatar',generation:++s.generation,file,key:accountApi.newIntent('profile-avatar'),materialClass:'PROFILE_IMAGE'});
   await this.processAvatar(false);
  }catch(error){if(current(this,s,epoch))this.setData({errorText:error instanceof Error?error.message:'头像选择或上传未完成'})}finally{if(!s.picker?.hidden)s.picker=undefined;else s.picker.completed=true;if(current(this,s,epoch))this.setData({selectingAvatar:false})}}).catch(()=>undefined)
 },
 recoverAvatar(){return this.processAvatar(true)},
 async processAvatar(explicitRecovery:boolean){const s=state(this);const intent=s.upload;const epoch=s.epoch;if(!intent||!current(this,s,epoch))return;
  const handle=runMaterialUpload(intent,{scope:s.scope,explicitRecovery,isCurrent:()=>current(this,s,epoch)&&s.upload===intent,onState:(value)=>this.setData({avatarPending:materialUploadBlocksSave(value),avatarStatus:value.phase==='UPLOADING'?`正在上传 ${value.progress}%`:value.phase==='PROCESSING'?'头像处理中…':value.error}),transport:{upload:(file,_class,key,options)=>accountApi.uploadAvatar(file,key,options),get:accountApi.material}});s.uploadRun=handle;
  this.setData({selectingAvatar:true,avatarPending:true,errorText:''});try{const media=await handle.promise;if(!current(this,s,epoch)||s.upload!==intent)return;s.avatarId=media.material_id;s.upload=undefined;s.dirty=true;this.setData({avatarPath:media.src,avatarPending:false,avatarStatus:'',avatarFailed:false,avatarReloading:false})}
  catch(error){if(current(this,s,epoch)&&s.upload===intent)this.setData({avatarPending:true,errorText:error instanceof Error?error.message:'头像结果待确认'})}
  finally{if(s.uploadRun===handle)s.uploadRun=undefined;if(current(this,s,epoch))this.setData({selectingAvatar:false})}
 },
 cancelAvatar(){const s=state(this);if(!s.upload)return;s.upload.phase='CANCELLED';s.uploadRun?.abort();s.upload=undefined;++s.generation;this.setData({selectingAvatar:false,avatarPending:false,avatarStatus:'',errorText:''})},
 openIdentity(){wx.showToast({title:'身份接口暂未接入',icon:'none'})},
 save(){const s=state(this);if(!current(this,s)||!s.original||materialUploadBlocksSave(s.upload)||this.data.selectingAvatar)return Promise.resolve();const epoch=s.epoch;if(!this.data.name.trim()){this.setData({errorText:'请输入昵称'});return Promise.resolve()}
 s.pending??={body:{display_name:this.data.name.trim(),avatar_material_id:s.avatarId,locale:'zh-CN'},intent:accountApi.newIntent('profile-save'),version:s.original.version};const pending=s.pending;
 return s.scope.singleFlight('save',async()=>{if(!current(this,s,epoch))return;this.setData({saving:true,errorText:''});try{
 const receipt=await accountApi.updateProfile(pending.body,pending.version,pending.intent).promise;const saved=await accountApi.profile().promise;if(!current(this,s,epoch))return;
 if(saved.account_id!==s.owner||saved.version<receipt.version||saved.display_name!==pending.body.display_name||(saved.avatar_material_id??'')!==pending.body.avatar_material_id)throw new Error('保存回读尚未匹配，请核对后重试原请求。');
 s.original=saved;s.pending=undefined;s.dirty=false;wx.showToast({title:'个人资料已保存',icon:'success'});navigateBackWithFallback(s.navigation);
 }catch(error){if(current(this,s,epoch)){if(error instanceof ApiProblem&&error.statusCode>=400&&error.statusCode<500&&![408,429].includes(error.statusCode)){s.pending=undefined;if([409,412].includes(error.statusCode))s.original=undefined}this.setData({errorText:error instanceof ApiProblem&&[409,412].includes(error.statusCode)?'资料版本已变化，请返回重新打开后核对。':error instanceof Error?error.message:'保存结果待确认'})}}finally{if(current(this,s,epoch))this.setData({saving:false})}}).catch(()=>undefined)},
});
