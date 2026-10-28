import { demoWx } from '../../preview/platform';
import { accountApi, ApiProblem, runMaterialUpload } from '../../shared/api/account-api';
import { publicationApi, type AssetDraft, type AssetDraftInput, type CatalogCategory, type CatalogProductPage, type OwnAssetPublicationContext } from '../../shared/api/rental-api';
import { designAssets } from '../../shared/design/assets';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { createNavigateOnce, navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { applyDraftChanges, bindAssetMedia, bindCatalogProduct, bindDeliveryOptions, bindPublicationContext, bindPublicationLocation, draftEditableFields, publicationDraftView, publicationIdentifierIssue, type AssetMediaChoice, type DeliveryChoice, type DraftChanges, type DraftEditableField, type PublicationLocationInput, type PublicationPositionInput } from '../../shared/presentation/api-publication-draft';
import { formatCNYMinorUnits } from '../../shared/format/money';
import { createMaterialUploadIntent, type MaterialUploadIntent } from '../../shared/model/material-media';
import { ownMaterialMedia, publicMedia } from '../../shared/presentation/material-media';
import { calendarWeekdays } from '../../shared/presentation/rental-calendar';

type PublicationCreateIntent=ReturnType<typeof publicationApi.prepareCreateIntent>;
type PublicationSubmitIntent=ReturnType<typeof publicationApi.prepareSubmitIntent>;
type Pending = { id:string; version:string; asset:AssetDraftInput; intent:string; owner:string };
type VerifiedDraft = { resource:AssetDraft; view:ReturnType<typeof publicationDraftView> };
type CatalogOption = { id:string; label:string; detail:string; category:string; categoryId:string };
type CatalogMedia = { url:string; role:string;poster:string;playback:string };
const photoMissingLabel='设备图片：至少 1 张已处理完成，首张自动为封面';
type MissingFieldView={id:string;label:string};
type Runtime = {
 scope:ReturnType<typeof createOperationScope>; navigation:ReturnType<typeof createNavigateOnce>;
 visible:boolean; epoch:number; id:string; owner:string|null; forcedView:boolean; resource?:AssetDraft|undefined; changes:DraftChanges; pending?:Pending|undefined; submitIntent?:PublicationSubmitIntent|undefined;
 productId:string; productChanged:boolean; publicationLocation:PublicationLocationInput|undefined; locationChanged:boolean;
 addressId:string; deliveryChanged:boolean;
 context:OwnAssetPublicationContext|undefined;contextChanged:boolean;
 mediaItems:AssetMediaChoice[];mediaURLs:Record<string,string>;mediaPosters:Record<string,string>;mediaChanged:boolean;pendingMedia:MaterialUploadIntent|undefined;mediaGeneration:number;mediaRun?:{abort:()=>void};
 preparingSubmitEpoch?:number;
 mediaPicker?:{hidden:boolean;completed?:boolean};
};
const states=new WeakMap<object,Runtime>();
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[!-~]{1,64}$/.test(value);
function canonicalJson(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonicalJson);
 if(value!==null&&typeof value==='object'){
  const source=value as Record<string,unknown>;const sorted:Record<string,unknown>={};
  for(const key of Object.keys(source).sort())sorted[key]=canonicalJson(source[key]);
  return sorted;
 }
 return value;
}
const exact=(left:unknown,right:unknown)=>JSON.stringify(canonicalJson(left))===JSON.stringify(canonicalJson(right));
const explicitRejection=(error:unknown)=>error instanceof ApiProblem&&error.statusCode>=400&&error.statusCode<500&&![401,408,429].includes(error.statusCode);
async function reportedPosition(scope:Runtime['scope']):Promise<PublicationPositionInput|undefined>{
 if(typeof demoWx.getLocation!=='function')return undefined;
 const found=await new Promise<WechatMiniprogram.GetLocationSuccessCallbackResult|undefined>(resolve=>{
  let settled=false;let timer:ReturnType<typeof setTimeout>|undefined;let release:()=>void=()=>{};
  const finish=(value:WechatMiniprogram.GetLocationSuccessCallbackResult|undefined)=>{if(settled)return;settled=true;if(timer)scope.clearTimer(timer);release();resolve(value)};
  release=scope.registerCleanup(()=>finish(undefined));
  if(!settled){timer=scope.setTimeout(()=>finish(undefined),2000);try{demoWx.getLocation({type:'gcj02',success:value=>finish(value),fail:()=>finish(undefined)});}catch{finish(undefined);}}
 });
 if(!found||!Number.isFinite(found.latitude)||!Number.isFinite(found.longitude)||Math.abs(found.latitude)>90||Math.abs(found.longitude)>180)return undefined;
 return {latitude:found.latitude.toFixed(6),longitude:found.longitude.toFixed(6),coordinate_system:'GCJ02',source:'WECHAT_CLIENT'};
}
function submissionMissing(asset:AssetDraftInput):MissingFieldView[]{
 const missing:MissingFieldView[]=[];
 const required=(valid:boolean,id:string,label:string)=>{if(!valid)missing.push({id,label});};
 const positive=(value:unknown)=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);
 const nonnegative=(value:unknown)=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);
 required(!!asset.product_id,'product_id','标准商品');
 required(!!asset.display_name?.trim(),'display_name','设备名称');
 required(!!asset.condition?.trim(),'condition','设备成色');
 const identifierIssue=publicationIdentifierIssue(asset.identifier_type,asset.identifier_value,true);
 if(identifierIssue)missing.push({id:'identifier_value',label:identifierIssue});
 required(asset.rental_unit==='DAY','rental_unit','按天出租');
 required(positive(asset.unit_price_fen),'unit_price_fen','日租金');
 required(nonnegative(asset.deposit_fen),'deposit_fen','押金');
 required(positive(asset.minimum_units),'minimum_units','最低租期');
 required(nonnegative(asset.reference_value_fen),'reference_value_fen','参考价值');
 const start=Date.parse(asset.available_from??'');const end=Date.parse(asset.available_until??'');
 required(Number.isFinite(start),'available_from','可租开始日');
 required(Number.isFinite(end)&&end>start,'available_until','可租截止日');
 required(asset.timezone==='Asia/Shanghai','timezone','可租日期时区');
 const deliveries=asset.delivery_options??[];
 required(deliveries.length>0&&deliveries.every(option=>(option.method==='EXPRESS'||option.method==='RUNNER')&&(option.outbound_fee_payer==='TENANT'||option.outbound_fee_payer==='LESSOR')&&(option.return_fee_payer==='TENANT'||option.return_fee_payer==='LESSOR')),'delivery_options','交付方式和双程费用承担者');
 required(!!asset.rule_version_id&&!!asset.eligibility_rule_version_id,'rule_versions','当前发布规则');
 const images=(asset.media??[]).filter(item=>item.role==='COVER'||item.role==='IMAGE');
 required(images.length>0&&(asset.media??[]).filter(item=>item.role==='COVER').length===1,'media_cover',photoMissingLabel);
 return missing;
}
function explainBlocked(page:{setData(patch:Record<string,unknown>):void},title:string,reason:string,missingFields:MissingFieldView[]=[]):void{
 page.setData({errorText:reason,missingFields,missingMedia:missingFields.some(field=>field.id==='media_cover'),canSubmit:false});
 wx.showModal({title,content:reason,showCancel:false});
}
function initial(){
 return {
  loggedIn:false,loading:false,submitting:false,selectingAddress:false,errorText:'',pendingSave:false,pendingCreate:false,pendingSubmit:false,editable:false,mode:'view',
   icons:designAssets,navigationTitle:'发布设备',types:[] as CatalogCategory[],typePickerOptions:[{name:'请选择设备类型'}],type:'',typeIndex:0,typeLoading:false,typeError:'',
  productId:'',productTypeFilter:'',productLabel:'尚未选择商品',productOptions:[] as CatalogOption[],productList:[] as CatalogOption[],productMedia:[] as CatalogMedia[],catalogNotice:'',catalogError:'',catalogLoading:false,catalogCursor:'',catalogHasMore:false,
  displayName:'',model:'',condition:'',identifierType:'',identifierTypeOptions:[{code:'MANUFACTURER_SERIAL',label:'厂家序列号'},{code:'IMEI',label:'IMEI'}],
  serialNumber:'',identifierLabel:'设备序列号',identityLocked:true,notes:'',accessories:'',description:'',
  expectedRent:'',expectedDeposit:'',minimumUnits:'',referenceValue:'',priceUnitLabel:'日租金',guidanceText:'草稿可随时保存，提交条件由服务端权威校验。',
  photoPaths:[] as string[],videoCards:[] as {id:string;url:string;poster:string}[],videoFailures:{} as Record<string,string>,videoReloading:{} as Record<string,string>,mediaViewEpoch:0,coverIndex:-1,mediaItemsCount:0,mediaPreviewCount:0,uploadingMedia:false,hasPendingMedia:false,proofPaths:[] as string[],mediaNotice:'请上传设备实拍；服务端确认为 READY 后才能绑定草稿。',
  availabilityStart:'',availabilityEnd:'',location:'',originAddressLabels:[] as string[],originAddressIndex:0,
  meetingAddress:'',meetingTime:'',runnerAddress:'',runnerContact:'',runnerPhone:'',runnerService:'',
  deliveries:[{id:'express',label:'快递配送',selected:false,outbound:'',return:''},{id:'runner',label:'跑腿配送',selected:false,outbound:'',return:''}] as DeliveryChoice[],
  deliveryText:'尚未设置',draftId:'',draftNoticeText:'',showDraftNotice:false,activeSheet:'',pricingCalendarOpen:false,
  canSubmit:false,submitHint:'先新建草稿，再由服务端校验提交条件。',missingFields:[] as MissingFieldView[],missingMedia:false,hasDraftTarget:false,weekdays:calendarWeekdays,
 };
}
function current(page:object,r:Runtime,owner=r.owner,epoch=r.epoch){
 return states.get(page)===r&&r.visible&&!r.scope.disposed&&r.epoch===epoch&&owner!==null&&r.owner===owner&&owner===accountApi.sessionIdentity();
}
function videoTarget(data:ReturnType<typeof initial>,dataset:Record<string,unknown>):{key:string;source:string}|null{
 const kind=String(dataset['kind']??'');const id=String(dataset['key']??'');const source=String(dataset['src']??'');
 const media=kind==='catalog'?data.productMedia.find(item=>item.role==='VIDEO'&&item.url===id):kind==='asset'?data.videoCards.find(item=>item.id===id):undefined;
 const actual=media&&('playback' in media?media.playback:media.url);
 if(dataset['poster']!==undefined&&dataset['poster']!==media?.poster)return null;
 return source&&source===actual?{key:kind+':'+id,source}:null;
}
function canSubmitSavedDraft(r:Runtime):boolean{
 return !!r.resource&&r.resource.status==='EDITING'&&!r.forcedView&&!r.pending&&!r.pendingMedia&&!r.submitIntent;
}
function hasUnsavedChanges(r:Runtime):boolean{
 return r.productChanged||r.locationChanged||r.deliveryChanged||r.contextChanged||r.mediaChanged||Object.keys(r.changes).length>0;
}
function firstPhotoCover(items:readonly AssetMediaChoice[]):AssetMediaChoice[]{
 let first=true;
 return items.map((item,sort_order)=>{
  if(item.role==='VIDEO')return {...item,sort_order};
  const role:AssetMediaChoice['role']=first?'COVER':'IMAGE';first=false;
  return {...item,role,sort_order};
 });
}
function candidateAsset(r:Runtime,deliveries:readonly DeliveryChoice[]):AssetDraftInput{
 if(!r.resource)throw new Error('草稿尚未读取，请重新进入发布页。');
 if(r.productChanged&&r.productId&&!r.context)throw new Error('当前商品发布规则未读取成功，请重新选择商品后重试。');
 const changed=applyDraftChanges(r.resource.asset,r.changes,r.resource.origin_kind==='EDIT');
 const located=r.locationChanged?bindPublicationLocation(changed,r.publicationLocation):changed;
 const catalogBound=bindCatalogProduct(located,r.productId);
 const deliveryBound=r.deliveryChanged||r.locationChanged?bindDeliveryOptions(catalogBound,deliveries,r.addressId):catalogBound;
 const contextBound=r.contextChanged&&r.context?bindPublicationContext(deliveryBound,r.context):deliveryBound;
 return r.mediaChanged?bindAssetMedia(contextBound,r.mediaItems):contextBound;
}
function verifyDraft(value:unknown,id:string):VerifiedDraft{
 const resource=publicationApi.validateDraft(value,id);return {resource,view:publicationDraftView(resource)};
}
function renderDraft(page:{data:Record<string,unknown>;setData(patch:Record<string,unknown>):void},r:Runtime,verified:VerifiedDraft,notice:string):void{
 const {resource:draft,view}=verified;r.resource=draft;r.changes={};r.productId=String(view.productId??'');r.productChanged=false;r.publicationLocation=draft.asset.publication_location;r.locationChanged=false;r.addressId=view.publicationAddressId;r.deliveryChanged=false;r.context=undefined;r.contextChanged=false;
 const savedMedia=[...(draft.asset.media??[])].filter(item=>item.role==='COVER'||item.role==='IMAGE'||item.role==='VIDEO').map(item=>({material_id:item.material_id,role:item.role as AssetMediaChoice['role'],sort_order:item.sort_order})).sort((a,b)=>a.sort_order-b.sort_order);
 r.mediaItems=firstPhotoCover(savedMedia);r.mediaURLs={};r.mediaPosters={};r.mediaChanged=savedMedia.some((item,index)=>item.role!==r.mediaItems[index]?.role);
 // The catalog list is loaded on demand, so a readback can only re-resolve the label from what the
 // page already holds; a product that is not in the loaded page keeps a neutral label instead of
 // pretending the platform still offers it.
 const known=((page.data['productOptions'] as CatalogOption[]|undefined)??[]).find(option=>option.id===r.productId);
 const editable=draft.status==='EDITING'&&!r.forcedView;const pendingSubmit=!!r.submitIntent;const pendingSave=!!r.pending;
  page.setData({...view,mediaViewEpoch:r.epoch,videoFailures:{},videoReloading:{},draftId:draft.draft_id,editable,mode:editable?(draft.origin_kind==='EDIT'?'edit':'draft'):'view',pendingSave,pendingCreate:false,pendingSubmit,
   types:page.data['types'],typePickerOptions:page.data['typePickerOptions'],type:known?.category??page.data['type'],typeIndex:page.data['typeIndex'],typeLoading:page.data['typeLoading'],typeError:page.data['typeError'],productTypeFilter:known?.categoryId??page.data['productTypeFilter'],
   productId:r.productId,productLabel:r.productId===''?'尚未选择商品':(known?known.label:'已选商品待核对'),model:known?known.detail.split(' · ').slice(-1)[0]??'':view.model,mediaItemsCount:r.mediaItems.length,mediaPreviewCount:0,photoPaths:[],videoCards:[],hasPendingMedia:!!r.pendingMedia,coverIndex:r.mediaItems.filter(item=>item.role==='COVER'||item.role==='IMAGE').findIndex(item=>item.role==='COVER'),
  canSubmit:!pendingSave&&(pendingSubmit||editable),submitHint:pendingSubmit?'上次提交结果未确认，请重试原提交。':editable?'可直接提交；页面会先保存并回读当前修改。':'当前草稿不能提交。',
  draftNoticeText:notice,showDraftNotice:true,hasDraftTarget:true,missingFields:[],missingMedia:false,errorText:''});
}
Page({
 data:initial(),
 onLoad(options:Record<string,string|undefined>){
  const id=options.draft_id??(options.mode==='draft'?options.id:'')??'';
  states.set(this,{id,owner:null,forcedView:options.mode==='view',visible:false,epoch:0,changes:{},scope:createOperationScope(),navigation:createNavigateOnce(),productId:'',productChanged:false,publicationLocation:undefined,locationChanged:false,addressId:'',deliveryChanged:false,context:undefined,contextChanged:false,mediaItems:[],mediaURLs:{},mediaPosters:{},mediaChanged:false,pendingMedia:undefined,mediaGeneration:0});
  this.setData({hasDraftTarget:id!==''});
 },
 onShow(){
  const r=states.get(this);if(!r)return;
  // The native media chooser can transiently hide this page. It is not a
  // navigation or an account change, so keep the in-flight selection alive.
  if(r.mediaPicker?.hidden&&r.owner===accountApi.sessionIdentity()){r.mediaPicker.hidden=false;if(r.mediaPicker.completed)delete r.mediaPicker;return;}
  r.scope.dispose();r.scope=createOperationScope();r.visible=true;++r.epoch;
  const owner=accountApi.sessionIdentity();if(owner!==r.owner){r.pending=undefined;if(r.pendingMedia)r.pendingMedia.phase='CANCELLED';r.mediaRun?.abort();r.pendingMedia=undefined;delete r.mediaPicker;}r.owner=owner;r.resource=undefined;r.submitIntent=undefined;r.changes={};r.publicationLocation=undefined;
  r.productChanged=false;r.locationChanged=false;r.deliveryChanged=false;r.context=undefined;r.contextChanged=false;r.mediaItems=[];r.mediaURLs={};r.mediaPosters={};r.mediaChanged=false;this.setData({...initial(),hasDraftTarget:r.id!==''});return this.reloadDraft();
 },
 onHide(){
  const r=states.get(this);if(!r)return;
  if(r.mediaPicker){r.mediaPicker.hidden=true;return;}
  r.visible=false;++r.epoch;r.scope.dispose();r.resource=undefined;r.submitIntent=undefined;r.changes={};r.publicationLocation=undefined;r.locationChanged=false;this.setData(initial());
 },
 onUnload(){const r=states.get(this);if(!r)return;r.visible=false;++r.epoch;r.scope.dispose();r.navigation.dispose();states.delete(this);this.setData(initial());},
 async reloadDraft(){
  const r=states.get(this);if(!r||!r.visible||r.scope.disposed)return;
  const owner=accountApi.sessionIdentity();const epoch=++r.epoch;
  r.resource=undefined;r.submitIntent=undefined;r.changes={};
  // Keep the already loaded catalog page across a readback: it belongs to the page session, not to
  // the draft, and dropping it would degrade the selected product label back to a placeholder.
  this.setData({...initial(),mediaViewEpoch:epoch,loggedIn:!!owner,loading:!!owner,pendingSave:!!r.pending,hasDraftTarget:r.id!=='',
    productId:r.productId,types:this.data.types,typePickerOptions:this.data.typePickerOptions,type:this.data.type,typeIndex:this.data.typeIndex,typeLoading:this.data.typeLoading,typeError:this.data.typeError,productTypeFilter:this.data.productTypeFilter,productOptions:this.data.productOptions,productList:this.data.productList,productMedia:this.data.productMedia,productLabel:this.data.productLabel,catalogNotice:this.data.catalogNotice,catalogError:this.data.catalogError,catalogCursor:this.data.catalogCursor,catalogHasMore:this.data.catalogHasMore});
  if(!owner||owner!==r.owner){r.pending=undefined;this.setData({loggedIn:false,loading:false,errorText:'请登录后查看本人草稿。'});return;}
  try{
   if(r.id===''){
    const intent=publicationApi.readCreateIntent(owner);if(!current(this,r,owner,epoch))return;
    this.setData({loading:false,pendingCreate:!!intent,draftNoticeText:intent?'上次新建结果未确认，请重试原新建请求。':'选择设备类型后，点击下方按钮建立空白发布草稿。',showDraftNotice:true});
    await this.loadTypeOptions();return;
   }
   if(!opaque(r.id))throw new Error('草稿标识无效，请重新进入发布页。');
   r.submitIntent=publicationApi.readSubmitIntent(owner,r.id)??undefined;
   const h=publicationApi.draft(r.id);const release=r.scope.registerCleanup(h.abort);let value:unknown;
   try{value=await h.promise}finally{release()}
   if(!current(this,r,owner,epoch))return;
   const verified=verifyDraft(value,r.id);
    renderDraft(this,r,verified,r.submitIntent?'上次提交结果未确认，请重试原提交。':r.pending?'上次保存结果未确认，请重试原保存。':'已读取当前草稿');
    await this.loadTypeOptions();await this.resolveSelectedProduct();
  }catch(error){if(current(this,r,owner,epoch))this.setData({errorText:error instanceof Error?error.message:'草稿读取失败'});}
  finally{if(states.get(this)===r&&r.visible&&epoch===r.epoch){if(owner!==accountApi.sessionIdentity()){r.resource=undefined;r.changes={};r.pending=undefined;this.setData({...initial(),errorText:'登录状态已变化，请重新登录。'});}else this.setData({loading:false});}}
 },
 createDraft(){
  const r=states.get(this);if(!r||!current(this,r)||r.id!==''||this.data.submitting)return Promise.resolve();
  const owner=r.owner!;const epoch=r.epoch;
  return r.scope.singleFlight('create-draft',async()=>{
   if(!current(this,r,owner,epoch))return;
   let intent:PublicationCreateIntent|undefined;let phase:'PREPARE'|'WRITE'|'READ'='PREPARE';let pending=true;
   try{
    intent=publicationApi.prepareCreateIntent(owner);this.setData({submitting:true,pendingCreate:true,errorText:''});
    let located:Extract<PublicationCreateIntent,{stage:'LOCATED'}>;
    if(intent.stage==='PREPARED'){
     phase='WRITE';const h=publicationApi.createDraft(intent.body.asset,intent.key);const unregister=r.scope.registerCleanup(h.abort);let receipt;
     try{receipt=await h.promise}finally{unregister()}
     if(!current(this,r,owner,epoch))return;
     receipt=publicationApi.validateCreateReceipt(receipt);
     const result=publicationApi.locateCreateIntent(intent,receipt.id,receipt.version);if(result.stage!=='LOCATED')throw new Error('新建草稿定位结果无效。');located=result;
    }else located=intent;
    if(!current(this,r,owner,epoch))return;
    phase='READ';const h=publicationApi.draft(located.draftId);const unregister=r.scope.registerCleanup(h.abort);let value:unknown;
    try{value=await h.promise}finally{unregister()}
    if(!current(this,r,owner,epoch))return;
    const verified=verifyDraft(value,located.draftId);const draft=verified.resource;
    if(draft.status!=='EDITING'||draft.origin_kind!=='CREATE'||draft.base_version!==null||draft.version!==located.version||draft.asset_id!=null||draft.committed_revision_id!=null||!exact(draft.asset,located.body.asset))throw new Error('新建草稿回读与原请求不一致，请重试原请求。');
    publicationApi.releaseCreateIntent(located);pending=false;r.id=draft.draft_id;r.resource=draft;r.submitIntent=undefined;r.changes={};
    this.setData({submitting:false,pendingCreate:false});renderDraft(this,r,verified,'新建草稿已确认，已回读当前草稿');
    await this.loadTypeOptions();
   }catch(error){
    if(current(this,r,owner,epoch)){
     if(intent&&phase==='WRITE'&&explicitRejection(error)){publicationApi.releaseCreateIntent(intent);pending=false;}
     this.setData({submitting:false,pendingCreate:pending,errorText:error instanceof Error?error.message:'新建草稿结果未确认，请重试原请求。'});
    }
   }finally{
    if(states.get(this)===r&&r.visible&&epoch===r.epoch){
     if(owner!==accountApi.sessionIdentity()){r.resource=undefined;r.submitIntent=undefined;r.changes={};this.setData({...initial(),errorText:'登录状态已变化，请重新登录。'});}
     else this.setData({submitting:false,pendingCreate:pending});
    }
   }
  }).catch((error:unknown)=>{if(current(this,r,owner,epoch))this.setData({submitting:false,errorText:error instanceof Error?error.message:'新建草稿失败'});});
 },
 handleErrorAction(){const r=states.get(this);return r?.visible&&r.id===''?this.createDraft():this.reloadDraft();},
 input(event:WechatMiniprogram.CustomEvent<{value:string}>){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  const field=String(event.currentTarget.dataset['field']??'') as DraftEditableField;
  if(!draftEditableFields.includes(field)||field==='identifierType'||field==='serialNumber'&&this.data.identityLocked)return;
  const value=String(event.detail.value??'');r.changes[field]=value;this.setData({[field]:value,errorText:'',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 changeIdentifierType(event:WechatMiniprogram.CustomEvent<{value:string}>){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  if(this.data.identityLocked)return;
  const option=this.data.identifierTypeOptions[Number(event.detail.value)];if(!option)return;
  r.changes.identifierType=option.code;this.setData({identifierType:option.code,identifierLabel:option.code==='IMEI'?'IMEI':'设备序列号',errorText:'',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 saveDraft(){
  const r=states.get(this);if(!r||!current(this,r)||r.submitIntent||(!r.pending&&(!this.data.editable||!r.resource)))return Promise.resolve();
  if(this.data.uploadingMedia||r.pendingMedia){explainBlocked(this,'暂不能保存','设备素材仍在处理中；请等待完成，或放弃待确认上传后再保存。');return Promise.resolve();}
  const owner=r.owner!;const epoch=r.epoch;
  return r.scope.singleFlight('save-draft',async()=>{
   if(!current(this,r,owner,epoch))return;
   if(!r.pending){
   if(!hasUnsavedChanges(r)){this.setData({draftNoticeText:'没有需要保存的修改',showDraftNotice:true});return;}
    const asset=candidateAsset(r,this.data.deliveries);
    // The client point is context only. A denied/failed/slow location request
    // never prevents saving a valid draft or submitting it for review.
    const position=await reportedPosition(r.scope);
    if(!current(this,r,owner,epoch))return;
    r.pending={owner,id:r.id,version:r.resource!.version,asset:position?{...asset,publication_position:position}:asset,intent:accountApi.newIntent('draft-update')};
   }
   const intent=r.pending;if(intent.owner!==owner||intent.id!==r.id)throw new Error('保存意图与当前草稿不一致');
   this.setData({submitting:true,pendingSave:true,errorText:'',canSubmit:false});
   let phase:'WRITE'|'READ'='WRITE';
   try{
    const h=publicationApi.updateDraft(intent.id,intent.version,intent.asset,intent.intent);const release=r.scope.registerCleanup(h.abort);
    let receipt;try{receipt=await h.promise}finally{release()}
    const version=receipt.version;
    if(receipt.kind!=='DRAFT'||receipt.id!==intent.id||receipt.status!=='EDITING'||!/^[1-9][0-9]{0,19}$/.test(version)||(version.length<intent.version.length||version.length===intent.version.length&&version<=intent.version))throw new Error('保存回执无效，请重试原保存以确认结果');
    if(!current(this,r,owner,epoch))return;
    phase='READ';const read=publicationApi.draft(intent.id);const releaseRead=r.scope.registerCleanup(read.abort);let value:unknown;
    try{value=await read.promise}finally{releaseRead()}
    if(!current(this,r,owner,epoch))return;
    const verified=verifyDraft(value,intent.id);
    if(verified.resource.status!=='EDITING'||verified.resource.version!==version||!exact(verified.resource.asset,intent.asset))throw new Error('草稿回读与本次保存字段或版本不一致，请重试原保存请求。');
    if(r.pending===intent)r.pending=undefined;
    this.setData({submitting:false,pendingSave:false});
    renderDraft(this,r,verified,'资料保存已确认，已回读当前草稿');
   }catch(error){
    if(phase==='WRITE'&&explicitRejection(error)&&r.pending===intent)r.pending=undefined;
    if(current(this,r,owner,epoch)){
     const reason=error instanceof Error?error.message:'保存结果未确认，请重试原保存';
     this.setData({pendingSave:!!r.pending});
     if(explicitRejection(error))explainBlocked(this,'草稿字段未通过校验',reason);
     else this.setData({errorText:reason});
    }
   }finally{
    if(states.get(this)===r&&r.visible&&epoch===r.epoch){
     if(owner!==accountApi.sessionIdentity()){r.resource=undefined;r.pending=undefined;r.changes={};this.setData({...initial(),errorText:'登录状态已变化，请重新登录。'});}
     else this.setData({submitting:false,pendingSave:!!r.pending});
    }
   }
  }).catch((error:unknown)=>{if(current(this,r,owner,epoch)){const reason=error instanceof Error?error.message:'草稿保存失败';this.setData({submitting:false});explainBlocked(this,'无法保存草稿',reason);}});
 },
 openSheet(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!r.resource||this.data.submitting)return;
  const sheet=String(event.currentTarget.dataset['sheet']??'');
  if(String(event.currentTarget.dataset['calendar'])==='true'){this.setData({activeSheet:'pricing',pricingCalendarOpen:true});return;}
  if(['pricing','details','delivery','accessories','proof'].includes(sheet))this.setData({activeSheet:sheet,pricingCalendarOpen:false});
 },
 closeSheet(){const r=states.get(this);if(r?.visible)this.setData({activeSheet:'',pricingCalendarOpen:false});},
 confirmSheet(){this.closeSheet();},stopSheetTap(){},
 handleNavigationBack(){const r=states.get(this);if(!r?.visible)return;if(this.data.activeSheet){this.closeSheet();return;}navigateBackWithFallback(r.navigation);},
 onSecondaryNavigationBack(){this.handleNavigationBack();},goBack(){this.handleNavigationBack();},
 openLogin(){const r=states.get(this);if(r?.visible)r.navigation.navigateOnce('login',callbacks=>wx.navigateTo({url:'/pages/login/index?source=publish',...callbacks}));},
 unavailable(){const r=states.get(this);if(r?.visible)wx.showToast({title:'该项暂未开放修改',icon:'none'});},
 async loadTypeOptions(){
  const r=states.get(this);if(!r||!current(this,r))return;
  const owner=r.owner!;const epoch=r.epoch;this.setData({typeLoading:true,typeError:''});
  try{
   const handle=publicationApi.catalogCategories();const release=r.scope.registerCleanup(handle.abort);let categories;
   try{categories=await handle.promise}finally{release()}
   if(!current(this,r,owner,epoch))return;
   const selected=categories.items.find(item=>item.category_id===this.data.productTypeFilter);
   this.setData({types:categories.items,typePickerOptions:[{name:'请选择设备类型'},...categories.items],typeLoading:false,typeIndex:selected?categories.items.indexOf(selected)+1:0,
    type:selected?selected.name:'',typeError:categories.items.length===0?'平台暂无可发布的设备类型，请稍后重试。':''});
  }catch(error){if(current(this,r,owner,epoch))this.setData({typeLoading:false,typeError:error instanceof Error?error.message:'设备类型读取失败，请重试。'});}
 },
 retryTypeOptions(){void this.loadTypeOptions();},
 async resolveSelectedProduct(){
  const r=states.get(this);if(!r||!current(this,r)||!r.productId)return;
  const owner=r.owner!;const epoch=r.epoch;const productId=r.productId;
  try{
   const handle=publicationApi.catalogProduct(productId);const release=r.scope.registerCleanup(handle.abort);let product;
   try{product=await handle.promise}finally{release()}
   if(!current(this,r,owner,epoch)||r.productId!==productId||r.productChanged)return;
   const index=this.data.types.findIndex(item=>item.category_id===product.category_id);
   if(index<0){this.setData({typeError:'原商品所属设备类型已不可选，请重新选择。',productLabel:'已选商品不可用，请重新选择',productTypeFilter:'',type:''});return;}
   this.setData({type:this.data.types[index]!.name,typeIndex:index+1,productTypeFilter:product.category_id,
    productLabel:product.name,model:product.model,productMedia:product.media.flatMap(item=>{const media=publicMedia(item);return media?[{url:media.url,role:item.role,poster:media.poster,playback:item.role==='VIDEO'?media.url:''}]:[]}),typeError:''});
  }catch{if(current(this,r,owner,epoch)&&r.productId===productId&&!r.productChanged)this.setData({typeError:'原商品不可用或读取失败，请重新选择设备类型及商品。',productLabel:'已选商品不可用，请重新选择',productTypeFilter:'',type:''});}
 },
 openProductSheet(){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  if(!this.data.productTypeFilter){wx.showModal({title:'请先选择设备类型',content:'选择设备类型后，才能查看该类型下的标准商品。',showCancel:false});return;}
  this.setData({activeSheet:'product',catalogError:'',catalogNotice:this.data.productOptions.length===0?'正在读取可选商品…':''});
  // Always refresh: the catalog page and its short-lived media URLs must not outlive their window
  // while the publisher keeps the sheet open across a long editing session.
  void this.loadCatalog();
 },
 async loadCatalog(append=false){
  const r=states.get(this);if(!r||!r.visible||r.scope.disposed)return;
  const owner=accountApi.sessionIdentity();
  if(!owner){this.setData({catalogLoading:false,catalogNotice:'登录后可选择标准商品',productOptions:[],productList:[],productMedia:[]});return;}
  const categoryId=this.data.productTypeFilter;if(!categoryId)return;
  const epoch=r.epoch;
  const cursor=append?String(this.data.catalogCursor):'';
  if(append&&(!this.data.catalogHasMore||!cursor))return;
  this.setData({catalogLoading:true,catalogError:'',catalogNotice:'正在读取可选商品…'});
  try{
   const handle=publicationApi.catalogProducts({categoryId,pageSize:50,...(cursor?{cursor}:{})});const release=r.scope.registerCleanup(handle.abort);let page:CatalogProductPage;
   try{page=await handle.promise}finally{release()}
   if(!current(this,r,owner,epoch)||this.data.productTypeFilter!==categoryId)return;
   if(page.page.has_more&&!page.page.next_cursor)throw new Error('商品分页游标缺失，请重试。');
   if(page.items.some(item=>item.category_id!==categoryId))throw new Error('商品类型与所选设备类型不一致，请重新读取。');
   const prior=append?this.data.productOptions:[];
   const options:CatalogOption[]=[...new Map([...prior,...page.items.map(item=>({id:item.product_id,label:item.name,detail:item.brand_name+' · '+item.model,category:item.category_name,categoryId:item.category_id}))].map(option=>[option.id,option])).values()];
   const selected=page.items.find(item=>item.product_id===r.productId);
   const productMedia:CatalogMedia[]=selected?(selected.media??[]).flatMap(item=>{const media=publicMedia(item);return media?[{url:media.url,role:item.role,poster:media.poster,playback:item.role==='VIDEO'?media.url:''}]:[]}):this.data.productMedia;
  this.setData({
   productOptions:options,productList:options,productMedia,catalogCursor:page.page.next_cursor??'',catalogHasMore:page.page.has_more,
   productLabel:r.productId===''?'尚未选择商品':selected?selected.name:'已选商品不在可售清单中',
   model:selected?selected.model:this.data.model,
   catalogLoading:false,
   catalogNotice:options.length===0?'平台暂无可选标准商品，请稍后再试':(page.page.has_more?'还有更多标准商品，可继续加载':''),
   catalogError:'',
  });
  }catch(error){
   if(current(this,r,owner,epoch)&&this.data.productTypeFilter===categoryId)this.setData({catalogLoading:false,catalogNotice:'',catalogError:error instanceof Error?error.message:'可选商品加载失败，请重试'});
  }
 },
 loadMoreCatalog(){if(!this.data.catalogLoading)void this.loadCatalog(true);},
 retryCatalog(){void this.loadCatalog();},
selectProduct(option:CatalogOption){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  if(option.categoryId!==this.data.productTypeFilter)return;
  r.productId=option.id;r.productChanged=true;
  r.context=undefined;r.contextChanged=false;
  this.setData({productId:option.id,productLabel:option.label,model:option.detail.split(' · ').slice(-1)[0]??'',activeSheet:'',errorText:'',guidanceText:'正在读取本人发布资格与价格建议…',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
  void this.loadPublicationContext(option.id);
 },
 async loadPublicationContext(productId:string){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||r.productId!==productId)return;
  const owner=r.owner!;const epoch=r.epoch;
  try{
   const eligible=publicationApi.eligibility();const releaseEligibility=r.scope.registerCleanup(eligible.abort);let admission;
   try{admission=await eligible.promise}finally{releaseEligibility()}
   if(!current(this,r,owner,epoch)||r.productId!==productId)return;
   if(!admission.eligible)throw new Error('当前账号尚未满足个人发布资格，请先完成发布前置条件。');
   const handle=publicationApi.publicationContext(productId);const release=r.scope.registerCleanup(handle.abort);let context;
   try{context=await handle.promise}finally{release()}
   if(!current(this,r,owner,epoch)||r.productId!==productId)return;
   if(context.eligibility_rule_version_id!==admission.eligibility_rule_version_id)throw new Error('发布资格规则已变化，请重新读取。');
   r.context=context;r.contextChanged=true;
   const guidance=context.pricing_guidance;
   const guidanceText=guidance?`当前日租建议 ${formatCNYMinorUnits(guidance.min_unit_price_fen)}–${formatCNYMinorUnits(guidance.max_unit_price_fen)}；实际价格由您填写。`:'当前商品无匹配价格建议，实际价格由您填写。';
   this.setData({guidanceText,errorText:'',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
  }catch(error){if(current(this,r,owner,epoch)&&r.productId===productId){r.context=undefined;r.contextChanged=false;this.setData({guidanceText:'发布规则未读取成功；点击提交时会自动重试。',errorText:error instanceof Error?error.message:'发布规则读取失败',canSubmit:true});}}
 },
 selectProductFromSheet(event:WechatMiniprogram.CustomEvent<WechatMiniprogram.IAnyObject>){
  const id=String(event.currentTarget.dataset['id']??'');
  const option=this.data.productOptions.find(candidate=>candidate.id===id);
  if(option)this.selectProduct(option);
 },
 chooseType(event?:WechatMiniprogram.CustomEvent<{value:string}>){
  const r=states.get(this);if(!r||!current(this,r)||(r.id!==''&&!this.data.editable)||this.data.submitting||this.data.pendingCreate||r.pending||r.submitIntent)return;
  if(!event?.detail||!/^\d+$/.test(String(event.detail.value)))return;
  const index=Number(event.detail.value);const category=this.data.types[index-1];if(!Number.isInteger(index)||!category)return;
  if(category.category_id===this.data.productTypeFilter)return;
  if(r.productId){r.productId='';r.productChanged=true;r.context=undefined;r.contextChanged=false;}
  this.setData({type:category.name,typeIndex:index,typeError:'',productTypeFilter:category.category_id,
   productId:'',productLabel:'尚未选择商品',productMedia:[],productOptions:[],productList:[],catalogCursor:'',catalogHasMore:false,catalogNotice:'',catalogError:'',
   guidanceText:'请选择该设备类型下的标准商品，再读取发布规则。',canSubmit:r.id!==''&&!r.pending,submitHint:'选择标准商品后可直接提交审核。'});
 },
 chooseDelivery(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  const id=String(event.currentTarget.dataset['delivery']??'');
  const deliveries=this.data.deliveries.map(choice=>choice.id===id?{...choice,selected:!choice.selected}:choice);
  if(!deliveries.some(choice=>choice.id===id))return;
  r.deliveryChanged=true;this.setData({deliveries,deliveryText:deliveries.filter(choice=>choice.selected).map(choice=>choice.label).join('、')||'尚未设置',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 chooseRule(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  const id=String(event.currentTarget.dataset['delivery']??'');const leg=String(event.currentTarget.dataset['leg']??'');const payer=String(event.currentTarget.dataset['payer']??'');
  if((leg!=='outbound'&&leg!=='return')||(payer!=='TENANT'&&payer!=='LESSOR'))return;
  const deliveries=this.data.deliveries.map(choice=>choice.id===id&&choice.selected?{...choice,[leg]:payer}:choice) as DeliveryChoice[];
  if(!deliveries.some(choice=>choice.id===id&&choice.selected))return;
  r.deliveryChanged=true;this.setData({deliveries,canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 changeStartDate(event:WechatMiniprogram.CustomEvent<{value:string}>){this.changeAvailabilityDate('availabilityStart',event.detail.value);},
 changeEndDate(event:WechatMiniprogram.CustomEvent<{value:string}>){this.changeAvailabilityDate('availabilityEnd',event.detail.value);},
 changeAvailabilityDate(field:'availabilityStart'|'availabilityEnd',value:string){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
  const start=field==='availabilityStart'?value:String(this.data.availabilityStart);
  const end=field==='availabilityEnd'?value:String(this.data.availabilityEnd);
  if(start&&end&&start>end){this.setData({errorText:'可租开始日不能晚于可租截止日。'});return;}
  r.changes[field]=value;this.setData({[field]:value,errorText:'',canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 chooseCalendarDate(){this.unavailable();},resetPricingDates(){this.unavailable();},applyPricingDates(){this.unavailable();},
 syncMediaView(){
  const r=states.get(this);if(!r?.visible)return;
  const images=r.mediaItems.filter(item=>item.role==='COVER'||item.role==='IMAGE');
  const videos=r.mediaItems.filter(item=>item.role==='VIDEO');
  const hasCover=images.some(item=>item.role==='COVER');
  const missingFields=hasCover?(this.data.missingFields as MissingFieldView[]).filter(item=>item.id!=='media_cover'):this.data.missingFields;
  this.setData({photoPaths:images.map(item=>r.mediaURLs[item.material_id]??''),videoCards:videos.map(item=>({id:item.material_id,url:r.mediaURLs[item.material_id]??'',poster:r.mediaPosters[item.material_id]??''})),coverIndex:images.findIndex(item=>item.role==='COVER'),mediaItemsCount:r.mediaItems.length,mediaPreviewCount:r.mediaItems.filter(item=>!!r.mediaURLs[item.material_id]).length,mediaNotice:r.mediaItems.length?`草稿已绑定 ${r.mediaItems.length} 项设备素材；仅 READY 素材可预览。`:'请上传设备实拍；服务端确认为 READY 后才能绑定草稿。',missingFields,missingMedia:!hasCover&&this.data.missingMedia});
 },
 async readDraftMedia(id:string,role:AssetMediaChoice['role'],r:Runtime,owner:string,epoch:number):Promise<string>{
  const materialHandle=publicationApi.material(id);const releaseMaterial=r.scope.registerCleanup(materialHandle.abort);let material;
  try{material=await materialHandle.promise}finally{releaseMaterial()}
  if(!current(this,r,owner,epoch))throw new Error('页面已离开');
  const expected=role==='VIDEO'?'RENTAL_ASSET_VIDEO':'RENTAL_ASSET_IMAGE';
  const media=ownMaterialMedia(material,id,owner,expected);if(!media)throw new Error('设备素材尚未 READY、公开媒体无效或不属于当前账号。');
  r.mediaPosters[id]=media.posterURL;return media.src;
 },
 async loadDraftMedia(){
  const r=states.get(this);if(!r||!current(this,r)||this.data.uploadingMedia)return;
  const owner=r.owner!;const epoch=r.epoch;this.setData({uploadingMedia:true,errorText:''});
  try{
   for(const item of r.mediaItems){
    const url=await this.readDraftMedia(item.material_id,item.role,r,owner,epoch);
    if(!current(this,r,owner,epoch))return;
    r.mediaURLs[item.material_id]=url;
   }
   this.syncMediaView();
  }catch(error){if(current(this,r,owner,epoch))this.setData({mediaNotice:error instanceof Error?error.message:'素材预览暂不可用，请重试。'});}
  finally{if(current(this,r,owner,epoch))this.setData({uploadingMedia:false});}
 },
 selectImage(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent||r.mediaItems.length>=20)return Promise.resolve();
  const requestedKind=String(event.currentTarget.dataset['kind']??'');if(requestedKind!=='photo'&&requestedKind!=='video')return Promise.resolve();
  const kind=requestedKind==='video'?'video':'image';
  return r.scope.singleFlight('asset-media',async()=>{
   const owner=r.owner!;const epoch=r.epoch;this.setData({uploadingMedia:true,errorText:'',canSubmit:false,submitHint:'正在选择或确认素材，暂不能提交。'});
   try{
    if(r.pendingMedia)throw new Error('上次素材上传结果待确认，请显式恢复原请求或取消。');
    if(!r.pendingMedia){
     r.mediaPicker={hidden:false};
     const chosen=await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve,reject)=>demoWx.chooseMedia({count:1,mediaType:[kind],sourceType:['album','camera'],success:resolve,fail:reject}));
     if(r.mediaPicker){r.mediaPicker.completed=true;if(!r.mediaPicker.hidden)delete r.mediaPicker;}
     if(!current(this,r,owner,epoch))return;
     const selected=chosen.tempFiles[0];const file=selected?.tempFilePath;
     if(!file)throw new Error('未取得设备素材文件。');
     const extension=/\.([a-z0-9]+)(?:[?#]|$)/i.exec(file)?.[1]?.toLowerCase();
     const wrongExtension=!!extension&&!(kind==='image'?['jpg','jpeg','png','webp']:['mp4']).includes(extension);
     if(chosen.type!==kind||selected.fileType!==kind||wrongExtension)throw new Error(kind==='image'?'所选文件不是支持的图片；请在“添加设备视频”上传视频，图片仅支持 JPEG、PNG、WebP。':'所选文件不是 MP4 视频；图片请使用“添加图片”。');
     r.pendingMedia=createMaterialUploadIntent({owner,field:'asset-media',item:'selected-media',generation:++r.mediaGeneration,file,key:accountApi.newIntent('asset-media'),materialClass:kind==='video'?'RENTAL_ASSET_VIDEO':'RENTAL_ASSET_IMAGE'});this.setData({hasPendingMedia:true});
    }
    await this.processPendingMedia(false);
   }catch(error){if(current(this,r,owner,epoch)){const reason=error instanceof Error?error.message:'设备素材上传未完成，请恢复原请求。';this.setData({hasPendingMedia:!!r.pendingMedia,errorText:reason});if(reason.startsWith('所选文件不是'))wx.showModal({title:'素材格式不支持',content:reason,showCancel:false});}}
   finally{if(!r.mediaPicker?.hidden)delete r.mediaPicker;if(current(this,r,owner,epoch))this.setData({uploadingMedia:false,canSubmit:canSubmitSavedDraft(r),submitHint:r.pendingMedia?'素材结果待确认，请显式恢复原文件或取消。':'可直接提交；页面会先保存并回读当前修改。'});}
  }).catch((error:unknown)=>{if(current(this,r))this.setData({uploadingMedia:false,errorText:error instanceof Error?error.message:'素材上传失败'});});
 },
 recoverPendingMedia(){return this.processPendingMedia(true)},
 async processPendingMedia(explicitRecovery:boolean){
  const r=states.get(this);const pending=r?.pendingMedia;if(!r||!pending||!current(this,r))return;const owner=r.owner!;const epoch=r.epoch;
  const kind=pending.materialClass==='RENTAL_ASSET_VIDEO'?'video':'image';const role:AssetMediaChoice['role']=kind==='video'?'VIDEO':'IMAGE';
  const handle=runMaterialUpload(pending,{scope:r.scope,explicitRecovery,isCurrent:()=>current(this,r,owner,epoch)&&r.pendingMedia===pending,onState:(value)=>this.setData({hasPendingMedia:true,mediaNotice:value.phase==='UPLOADING'?`正在上传 ${value.progress}%`:value.phase==='PROCESSING'?'设备素材处理中…':value.error}),transport:{upload:(file,_class,key,options)=>publicationApi.uploadAssetMedia(file,kind,key,options),get:publicationApi.material}});r.mediaRun=handle;
  this.setData({uploadingMedia:true,canSubmit:false,errorText:''});try{const media=await handle.promise;if(!current(this,r,owner,epoch)||r.pendingMedia!==pending)return;
   if(!r.mediaItems.some(item=>item.material_id===media.material_id))r.mediaItems.push({material_id:media.material_id,role,sort_order:r.mediaItems.length});r.mediaItems=firstPhotoCover(r.mediaItems);
   r.mediaURLs[media.material_id]=media.src;r.mediaPosters[media.material_id]=media.posterURL;r.mediaChanged=true;r.pendingMedia=undefined;this.syncMediaView();this.setData({hasPendingMedia:false});
  }catch(error){if(current(this,r,owner,epoch)&&r.pendingMedia===pending)this.setData({hasPendingMedia:true,errorText:error instanceof Error?error.message:'设备素材结果待确认'})}
  finally{if(r.mediaRun===handle)delete r.mediaRun;if(current(this,r,owner,epoch))this.setData({uploadingMedia:false,canSubmit:canSubmitSavedDraft(r),submitHint:r.pendingMedia?'素材仍未完成，请显式恢复原请求或取消。':'可直接提交；页面会先保存并回读当前修改。'})}
 },
 discardPendingMedia(){
  const r=states.get(this);if(!r||!current(this,r)||!r.pendingMedia)return;
  r.pendingMedia.phase='CANCELLED';r.mediaRun?.abort();++r.mediaGeneration;
  r.pendingMedia=undefined;this.setData({uploadingMedia:false,hasPendingMedia:false,errorText:'',canSubmit:canSubmitSavedDraft(r),submitHint:'可直接提交；页面会先保存并回读当前修改。',mediaNotice:'已取消本次待确认上传；已到达云端的对象会保留，可重新选择素材。'});
 },
 onVideoMediaError(event:WechatMiniprogram.CustomEvent){
  const r=states.get(this);if(!r||!current(this,r)||Number(event.currentTarget.dataset['epoch'])!==r.epoch)return;
  const target=videoTarget(this.data,event.currentTarget.dataset);if(!target)return;
  this.setData({videoFailures:{...this.data.videoFailures,[target.key]:target.source}});
 },
 retryVideoMedia(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||Number(event.currentTarget.dataset['epoch'])!==r.epoch)return;
  const target=videoTarget(this.data,event.currentTarget.dataset);if(!target||this.data.videoFailures[target.key]!==target.source||this.data.videoReloading[target.key]===target.source)return;
  const owner=r.owner;const epoch=r.epoch;this.setData({videoReloading:{...this.data.videoReloading,[target.key]:target.source}});
  wx.nextTick(()=>{
   if(!current(this,r,owner,epoch))return;const active=videoTarget(this.data,event.currentTarget.dataset);
   if(!active||active.key!==target.key||active.source!==target.source||this.data.videoReloading[target.key]!==target.source)return;
   const failures={...this.data.videoFailures};const reloading={...this.data.videoReloading};delete failures[target.key];delete reloading[target.key];
   this.setData({videoFailures:failures,videoReloading:reloading});
  });
 },
 previewMedia(event:WechatMiniprogram.TouchEvent){
  const index=Number(event.currentTarget.dataset['index']);const urls=this.data.photoPaths.filter(Boolean);
  const currentURL=urls[index];if(Number.isInteger(index)&&index>=0&&currentURL)wx.previewImage({urls,current:currentURL});
 },
 deleteMedia(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  const index=Number(event.currentTarget.dataset['index']);const kind=String(event.currentTarget.dataset['kind']??'');if(kind!=='photo'&&kind!=='video')return;
  const choices=r.mediaItems.filter(item=>kind==='video'?item.role==='VIDEO':item.role==='COVER'||item.role==='IMAGE');
  const target=choices[index];if(!target)return;
  r.mediaItems=firstPhotoCover(r.mediaItems.filter(item=>item.material_id!==target.material_id));
  delete r.mediaURLs[target.material_id];r.mediaChanged=true;this.syncMediaView();this.setData({canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 moveMedia(event:WechatMiniprogram.TouchEvent){
  const r=states.get(this);if(!r||!current(this,r)||!this.data.editable||this.data.submitting||r.pending||r.submitIntent)return;
  const index=Number(event.currentTarget.dataset['index']);const direction=Number(event.currentTarget.dataset['direction']);const kind=String(event.currentTarget.dataset['kind']??'');
  const choices=r.mediaItems.filter(item=>kind==='video'?item.role==='VIDEO':item.role==='COVER'||item.role==='IMAGE');
  if(!Number.isInteger(index)||![1,-1].includes(direction)||index<0||index+direction<0||index+direction>=choices.length)return;
  const left=choices[index],right=choices[index+direction];if(!left||!right)return;
  const first=r.mediaItems.findIndex(item=>item.material_id===left.material_id),second=r.mediaItems.findIndex(item=>item.material_id===right.material_id);
  [r.mediaItems[first],r.mediaItems[second]]=[r.mediaItems[second]!,r.mediaItems[first]!];r.mediaItems=firstPhotoCover(r.mediaItems);
  r.mediaChanged=true;this.syncMediaView();this.setData({canSubmit:true,submitHint:'可直接提交；页面会先保存并回读当前修改。'});
 },
 clearDraft(){this.unavailable();},
 jumpToMedia(){if(typeof wx.pageScrollTo==='function')wx.pageScrollTo({selector:'#publish-media',duration:300});},
 submit(){
  const r=states.get(this);if(!r||!current(this,r)||this.data.submitting||r.preparingSubmitEpoch===r.epoch)return Promise.resolve();
  if(this.data.uploadingMedia||r.pendingMedia){explainBlocked(this,'暂不能提交','设备素材仍在处理中；请等待完成，或放弃待确认上传后再提交。');return Promise.resolve();}
  if(r.pending){explainBlocked(this,'暂不能提交','上次保存结果尚未确认，请先重试原保存请求。');return Promise.resolve();}
  if(!r.submitIntent&&(!r.resource||r.resource.status!=='EDITING'||r.forcedView||!this.data.editable)){explainBlocked(this,'暂不能提交','当前草稿不是可编辑状态，请重新读取草稿。');return Promise.resolve();}
  const needsRule=!r.submitIntent&&!!r.productId&&(!r.resource?.asset.rule_version_id||!r.resource.asset.eligibility_rule_version_id);
  if(!r.submitIntent&&(hasUnsavedChanges(r)||needsRule)){
   const owner=r.owner!;const epoch=r.epoch;r.preparingSubmitEpoch=epoch;this.setData({submitting:true});
   return (async()=>{
    try{
     if((r.productChanged||needsRule)&&r.productId&&!r.context)await this.loadPublicationContext(r.productId);
     if(!current(this,r,owner,epoch))return;
     const candidate=candidateAsset(r,this.data.deliveries);
     const missing=submissionMissing(candidate);
     if(missing.length){explainBlocked(this,'资料尚未填写完整',`提交前请完善：${missing.map(field=>field.label).join('、')}。`,missing);return;}
     this.setData({submitting:false});
     await this.saveDraft();
     if(!current(this,r,owner,epoch))return;
     if(r.pending){explainBlocked(this,'保存结果未确认','本次资料保存结果尚未确认，请重试原保存请求；尚未提交平台审核。');return;}
     if(hasUnsavedChanges(r)){
      if(!this.data.errorText)explainBlocked(this,'无法提交审核','当前修改尚未保存成功，请按提示修正后重试提交。');
      return;
     }
    }catch(error){if(current(this,r,owner,epoch))explainBlocked(this,'无法提交审核',error instanceof Error?error.message:'提交前资料校验失败');return;}
    finally{if(r.preparingSubmitEpoch===epoch)delete r.preparingSubmitEpoch;if(current(this,r,owner,epoch))this.setData({submitting:false});}
    if(current(this,r,owner,epoch))return this.submit();
   })();
  }
  if(!r.submitIntent){const missing=submissionMissing(r.resource!.asset);if(missing.length){explainBlocked(this,'资料尚未填写完整',`提交前请完善：${missing.map(field=>field.label).join('、')}。`,missing);return Promise.resolve();}}
  const owner=r.owner!;const epoch=r.epoch;
  return r.scope.singleFlight('submit-draft',async()=>{
   if(!current(this,r,owner,epoch))return;
   let intent:PublicationSubmitIntent|undefined;let phase:'PREPARE'|'WRITE'|'READ'='PREPARE';let pending=true;
   try{
    intent=r.submitIntent??publicationApi.prepareSubmitIntent(owner,r.id,r.resource!.version);r.submitIntent=intent;
    this.setData({submitting:true,pendingSubmit:true,errorText:'',canSubmit:true});let located:Extract<PublicationSubmitIntent,{stage:'LOCATED'}>;
    if(intent.stage==='PREPARED'){
     phase='WRITE';const h=publicationApi.submitDraft(intent.draftId,intent.version,intent.key);const unregister=r.scope.registerCleanup(h.abort);let receipt;
     try{receipt=await h.promise}finally{unregister()}
     if(!current(this,r,owner,epoch))return;
     receipt=publicationApi.validateSubmitReceipt(receipt,intent.draftId);
     const result=publicationApi.locateSubmitIntent(intent,receipt.version,receipt.asset_id,receipt.revision_id);if(result.stage!=='LOCATED')throw new Error('提交审核定位结果无效。');located=result;r.submitIntent=located;
    }else located=intent;
    if(!current(this,r,owner,epoch))return;
    phase='READ';const h=publicationApi.draft(located.draftId);const unregister=r.scope.registerCleanup(h.abort);let value:unknown;
    try{value=await h.promise}finally{unregister()}
    if(!current(this,r,owner,epoch))return;
    const verified=verifyDraft(value,located.draftId);const draft=verified.resource;
    if(draft.status!=='SUBMITTED'||draft.version!==located.resultVersion||draft.asset_id!==located.assetId||draft.committed_revision_id!==located.revisionId)throw new Error('提交审核回读与原请求不一致，请重试原请求。');
    publicationApi.releaseSubmitIntent(located);pending=false;r.submitIntent=undefined;r.resource=draft;r.changes={};
    this.setData({submitting:false,pendingSubmit:false});renderDraft(this,r,verified,'提交审核已确认，已回读当前草稿状态');
   }catch(error){
    if(current(this,r,owner,epoch)){
     if(intent&&phase==='WRITE'&&explicitRejection(error)){publicationApi.releaseSubmitIntent(intent);r.submitIntent=undefined;pending=false;}
     const reason=error instanceof Error?error.message:'提交审核结果未确认，请重试原请求。';
     this.setData({submitting:false,pendingSubmit:pending,canSubmit:pending});
     if(explicitRejection(error))explainBlocked(this,'提交审核未通过',reason);
     else this.setData({errorText:reason});
    }
   }finally{
    if(states.get(this)===r&&r.visible&&epoch===r.epoch){
     if(owner!==accountApi.sessionIdentity()){r.resource=undefined;r.submitIntent=undefined;r.changes={};this.setData({...initial(),errorText:'登录状态已变化，请重新登录。'});}
     else this.setData({submitting:false,pendingSubmit:pending,canSubmit:pending||!!r.resource&&r.resource.status==='EDITING'&&!r.forcedView&&Object.keys(r.changes).length===0&&!r.pending});
    }
   }
  }).catch((error:unknown)=>{if(current(this,r,owner,epoch)){this.setData({submitting:false});explainBlocked(this,'无法提交审核',error instanceof Error?error.message:'提交审核失败');}});
 },
});
