import samples from './schema-samples.json';
import routes from './api-routes.json';
import demoQrSvg from './qr-example.svg?raw';
import { makeSeed, permissionCodes, action, media, now, names, imagePaths, products, brandNames, productBrandIndexes, productCategoryIndexes } from './seed';
import { ApiProblem } from '../shared/api/problem';
import { linkedState, linkedRequest, linkedAction, linkedOrder, linkedMember, linkedDossier, isLinkedId, originalId, linkedId } from './linked';

const STORAGE_KEY = 'xingyu.web-mock.v102.data.v2';
const copy = (name) => structuredClone(samples[name] ?? {});
const clone = (value) => structuredClone(value);
const linkTag = (kind,id,version) => `"linked.${kind}.${id}.${String(version)}"`;
let memory;
const ephemeralMaterials = new Map();
const commands = new Map();
const writeReceipts = new Map();
const reviewIntentFingerprints = new Map();
export const requestLog = [];
// Repair only untouched v1 seed entries. Never replace edited rows or existing IDs.
function repairUntouchedCatalog(state) {
  const r = state.records;
  if (!Array.isArray(r?.products) || !Array.isArray(r.brands) || !Array.isArray(r.categories)) return;
  products.forEach((name, i) => {
    const row = r.products.find(item => item.product_id === `product-${i + 1}`);
    if (!row || row.name !== name || String(row.version) !== '1' || row.brand_id !== `brand-${i % 6 + 1}` || row.category_id !== `category-${i % 4 + 1}`) return;
    const brandId = `brand-${productBrandIndexes[i] + 1}`;
    const brandName = brandNames[productBrandIndexes[i]];
    let brand = r.brands.find(item => item.brand_id === brandId);
    if (!brand) { brand = { brand_id: brandId, name: brandName, status: 'ACTIVE', version: '1' }; r.brands.push(brand); }
    if (brand.name === brandName) { row.brand_id = brandId; row.brand_name = brandName; }
    const category = r.categories.find(item => item.category_id === `category-${productCategoryIndexes[i] + 1}`);
    if (category) { row.category_id = category.category_id; row.category_name = category.name; }
  });
}
function read() {
  if (memory) return memory;
  try { const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'); if (stored?.schemaVersion === 3) memory = stored; } catch { /* A fresh local preview is always recoverable. */ }
  memory ??= makeSeed();
  repairUntouchedCatalog(memory);
  return memory;
}
function save() { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(read())); } catch { /* Uploaded blobs stay in this tab; quota failure does not lose the working view. */ } }
export function getPreviewInfo() { const s = read(); return { scenario: s.scenario, latency: s.latency, counts: Object.fromEntries(Object.entries(s.records).map(([key, value]) => [key, value.length])), requests: requestLog.length }; }
export function setPreviewScenario(scenario, latency = 120) { const s=read(); s.scenario=scenario; s.latency=latency; save(); window.dispatchEvent(new Event('preview-change')); }
export function resetPreview() { memory=makeSeed(); window.localStorage.removeItem(STORAGE_KEY); ephemeralMaterials.forEach((m)=>URL.revokeObjectURL(m.public_url));ephemeralMaterials.clear();writeReceipts.clear();reviewIntentFingerprints.clear();commands.clear();save(); }
export function previewMember(template, item) { return {...clone(template),userId:item.account_id,nickname:item.display_name,mobileMasked:'138****0000',miniProgramOpenIdMasked:'wx_preview_'+item.account_id,miniProgramRegisteredAt:item.first_registered_at,realNameStatus:'VERIFIED',consumptionAmountFen:36000,consumptionOrderCount:3,lastOrderAt:now()}; }
export async function previewMembers(template) { if(read().scenario==='empty')return [];const shared=await linkedState();return [linkedMember(template,shared),...read().records.members.map(item=>previewMember(template,item))]; }
export async function previewDossier(template,id) { if(isLinkedId(id)){const shared=await linkedState();if(id!==linkedId(shared.profile.account_id))throw new ApiProblem(404,{code:'NOT_FOUND',message:'共享演示会员不存在',request_id:'linked-demo'});return linkedDossier(template,shared);}const item=found(read().records.members,'account_id',id);return {...previewMember(template,item),starAccount:{...clone(template.starAccount),userId:id},riskTags:['合成视觉样例'],notes:['本用户及记录仅存在于浏览器 Mock 数据中。']}; }
export function previewDashboard() {const r=read().records;return {merchantCount:r.merchants.length,operatingAddressCount:r.merchants.length,cabinetTotal:r.cabinets.length,cabinetOnline:r.cabinets.filter(c=>c.connectivity_status==='ONLINE').length,cabinetOffline:r.cabinets.filter(c=>c.connectivity_status==='OFFLINE').length,cabinetUnknown:0,boxTotal:r.compartments.length,boxAvailable:r.compartments.filter(c=>c.business_occupancy_status==='AVAILABLE').length,boxOccupied:r.compartments.filter(c=>c.occupant).length,assetTotal:r.assets.length,assetInCabinet:r.compartments.filter(c=>c.occupant).length,openAlertCount:2};}
export function exportPreview() { return JSON.stringify(read(), null, 2); }
const found = (items, key, id) => { const row=items.find(item=>String(item[key])===id); if(!row) throw new ApiProblem(404,{code:'NOT_FOUND',message:'当前预览数据没有这条记录，请重置数据或返回列表。',request_id:'preview'}); return row; };
const asPage = (items, query, key) => {
  const size=Math.max(1,Math.min(100,Number(query.get('limit')??query.get('page_size')??20)));
  const start=Number(query.get('cursor')??0)||0;
  let data=read().scenario==='empty'?[]:items;
  const ignored=new Set(['cursor','limit','page_size','period_month','from','to','created_from','created_before','created_to','tab','dataset_id']);
  for(const [field,value] of query) {
    if(!value || ignored.has(field)) continue;
    if(['query','keyword','name'].includes(field)) data=data.filter(item=>JSON.stringify(item).toLowerCase().includes(value.toLowerCase()));
    else if(data.some(item=>Object.hasOwn(item,field))) data=data.filter(item=>String(item[field]??'')===value);
    else if(field==='asset_id')data=data.filter(item=>item.asset?.asset_id===value);
    else if(field==='account_id'||field==='tenant_account_id')data=data.filter(item=>item.participants?.tenant_account_id===value);
    else if(field==='merchant_id')data=data.filter(item=>item.participants?.merchant_id===value);
  }
  if(query.get('created_from'))data=data.filter(item=>item.created_at>=query.get('created_from'));
  if(query.get('created_before'))data=data.filter(item=>item.created_at<query.get('created_before'));
  const pageItems=data.slice(start,start+size),next=start+size<data.length?String(start+size):null;
  return {items:clone(pageItems),page:{page_size:size,has_more:next!==null,next_cursor:next},next_cursor:next,has_more:next!==null,as_of_at:now(),...(key?{summary:{count:data.length,beneficiary_fen:String(data.reduce((sum,row)=>sum+Number(row.beneficiary_fen??0),0)),as_of:now()}}:{})};
};
function effectiveRows() { return Object.entries(read().configs).map(([config_key,value])=>{const v=read().versions.filter(v=>v.config_key===config_key).at(-1); return {config_key,value:clone(value),schema_version:value.schema_version??(config_key==='material.upload_policy'?2:1),effective_epoch:Number(v.effective_epoch??1),published_at:v.effective_at??v.created_at,published_by:'preview-admin',source:'DATABASE',config_version:clone(v)};}); }
const localActions=['ONLINE','DOOR_QUERY','OPEN_ONE','OPEN_ALL'].map(code=>({action:code,enabled:true,reason_code:null,display_reason:null}));
function dossier(id) { const r=read().records;const asset=found(r.assets,'asset_id',id),revision=r.revisions.find(v=>v.asset_id===id);const slot=r.compartments.find(v=>v.occupant?.asset_id===id);return {asset:clone(asset),current_revision:clone(revision),latest_revision:clone(revision),allowed_actions:['EDIT','UPDATE_RFID','REVIEW','PUBLISH','UNPUBLISH','PLACE','END_PLACEMENT'].map(code=>({code,enabled:true,blocked_reasons:[]})),publication_blockers:[],private_access:{allowed:true,blocked_reasons:[]},placement:slot?{...copy('OpsAssetPlacement'),location_kind:'CABINET',placement_id:'placement-'+id,placement_version:'1',version:'1',cabinet_id:slot.cabinet_id,cabinet_name:read().records.cabinets.find(c=>c.cabinet_id===slot.cabinet_id)?.cabinet_name,compartment_id:slot.compartment_id,compartment_no:slot.compartment_no,asset_id:id}:null}; }
function returnView(order) {
  const id=order.order.order_id;
  const stored=read().records.returns?.find(v=>v.order_id===id);if(stored)return clone(stored);
  const item={...copy('OpsReturnView'),return_id:'return-'+id,order_id:id,method:order.delivery.method,received_at:order.order.physical_status==='RECEIVED'?now():null,receipt_recorded_at:order.order.physical_status==='RECEIVED'?now():null,receipt_actor_display_name:'林沐',receipt_actor_id:'preview-admin',receipt_source:order.delivery.method==='CABINET'?'CABINET':'MANUAL',carrier:'顺丰速运',tracking_no:'SF-PREVIEW-'+id,material_status:'COMPLETE',pre_return_complete:true,missing_items:[],blockers:[],cabinet_task:null,evidence_history:[],receipt_history:[],allowed_actions:[action('RECORD_RECEIPT',id),action('CORRECT_RECEIPT',id),action('SUBMIT_REVIEW',id)]};
  if(item.receipt_source==='MANUAL')item.receipt_source='OFFICIAL';
  item.evidence_template=clone(read().configs['rental.order_policy'].evidence_templates[0]);
  item.evidence_slots=item.evidence_template.slots.map(slot=>({slot,editable:true,complete:true,blocker:null,items:[{...copy('ReturnEvidenceItem'),evidence_id:'evidence-'+id,item_no:1,slot_key:slot.slot_key,kind:'PHOTO',stage:'PRE_RETURN',availability:'READY',is_current:true,media:media(0),material_id:'preview-material-0'}]}));
  read().records.returns??=[];read().records.returns.push(item);return clone(item);
}
function authAccount() { return {account_id:'preview-admin',audience:'OPS',display_name:'林沐 · 视觉预览',permissions:permissionCodes,roles:['ops.super_admin'],scopes:[{type:'PLATFORM',id:'platform'}],wechat_binding:{status:'BOUND',nickname:'星遇预览账号',avatar_material_id:null,bound_at:now()}}; }
const session=()=>({token_type:'Bearer',access_token:'preview-local-access',refresh_token:'preview-local-refresh',expires_in:86400,account:authAccount()});
function logWrite(path, body) { const r=read().records; r.operationEvents.unshift({event_id:'preview-event-'+Date.now(),actor_account_id:'preview-admin',current_display_name:names[0],operation_id:path,action_code:'UPDATE',resource_type:'VISUAL_PREVIEW',resource_id:path,result_code:'SUCCESS',field_change_summary:clone(body??{}),occurred_at:now()});save(); }

async function handle(options, linked = false) {
  const url=new URL(options.path,'http://visual-preview.invalid'),p=url.pathname,q=url.searchParams;
  const method=options.method??'GET',body=options.body??{},write=method!=='GET';
  const validRoute=routes.some(route=>route.method===method&&new RegExp('^'+route.path.split('/').map(part=>part.startsWith('{')?'[^/]+':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'$').test(p));
  if(!validRoute)throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:`预览尚未覆盖此接口：${method} ${p}`,request_id:'preview-unmapped'});
  const s=read(),r=s.records;
  if(p.startsWith('/v1/ops/auth/')) {
    if(p.endsWith('/me')) return authAccount();
    if(p.endsWith('/logout'))return undefined;
    if(p.endsWith('/sessions')||p.endsWith('/refresh'))return session();
    if(p.endsWith('/phone/challenges'))return {challenge_id:'preview-challenge',status:'PENDING',expires_in:300,retry_after_seconds:0};
    if(p.includes('/challenges'))return {challenge_id:'preview-qr',purpose:p.includes('binding')?'BIND':'LOGIN',status:write?'PENDING':'APPROVED',expires_at:new Date(Date.now()+300000).toISOString(),poll_token:'p'.repeat(43),code_image:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="230" height="230"><rect width="230" height="230" fill="#eef2ff"/><text x="35" y="115" font-size="18">LOCAL PREVIEW</text></svg>')};
  }
  if(s.scenario==='error')throw new ApiProblem(503,{code:'PREVIEW_ERROR',message:'预览错误状态：切回正常数据即可恢复。',request_id:'preview-error'});
  if(p==='/v1/materials/files' && body instanceof FormData) {
    const file=body.get('file');if(!(file instanceof File))throw new Error('请选择本地文件');
    let id='local-material-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
    if(linked&&body.get('class')==='EVIDENCE_IMAGE'){
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new ApiProblem(422,{code:'VALIDATION_FAILED',message:'联动演示凭证须为不超过 5 MB 的图片',request_id:'linked-demo'});
      if(!options.idempotencyKey)throw new ApiProblem(422,{code:'VALIDATION_FAILED',message:'联动演示凭证缺少上传标识',request_id:'linked-demo'});
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(options.idempotencyKey));id='local-material-'+Array.from(new Uint8Array(digest)).slice(0,12).map(v=>v.toString(16).padStart(2,'0')).join('');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('无法读取演示凭证'));reader.readAsDataURL(file);});
      const reply=await linkedAction('adminMaterial',{id,mime:file.type,base64:data.slice(data.indexOf(',')+1)});ephemeralMaterials.set(id,reply.result);options.onUploadProgress?.({loaded:file.size,total:file.size});return clone(reply.result);
    }
    const url=URL.createObjectURL(file);
    const material={...copy('Material'),material_id:id,material_class:body.get('class')??'SYSTEM_MATERIAL',owner_account_id:'preview-admin',status:'READY',public_url:url,playback_url:file.type.startsWith('video')?url:null,mime_type:file.type,size_bytes:file.size,metadata:{schema_version:1,width:800,height:800,duration_ms:file.type.startsWith('video')?10000:null,video_codec:file.type.startsWith('video')?'preview-local-video':null,audio_codec:null},poster:file.type.startsWith('video')?{material_id:'preview-material-0',url:imagePaths[0],width:800,height:800}:null};
    ephemeralMaterials.set(id,material);options.onUploadProgress?.({loaded:file.size,total:file.size});return clone(material);
  }
  if(p.startsWith('/v1/materials/')) {const id=p.split('/').at(-1);return ephemeralMaterials.get(id)??{...copy('Material'),material_id:id,status:'READY',owner_account_id:'preview-admin',material_class:'SYSTEM_MATERIAL',mime_type:'image/png',size_bytes:48000,public_url:imagePaths[(Number(id.match(/\d+$/)?.[0])||0)%3],playback_url:null,metadata:{schema_version:1,width:800,height:800,duration_ms:null,video_codec:null,audio_codec:null},poster:null};}
  if(p==='/v1/regions'){const parent=q.get('parent_id');return {dataset_id:'preview-regions',items:parent==='440000'?[{region_id:'440300',name:'深圳市',has_children:true}]:parent==='440300'?[{region_id:'440303',name:'南山区',has_children:false},{region_id:'440304',name:'福田区',has_children:false},{region_id:'440305',name:'宝安区',has_children:false},{region_id:'440306',name:'罗湖区',has_children:false}]:[{region_id:'440000',name:'广东省',has_children:true}],page:{has_more:false,next_cursor:null}};}
  if(p==='/v1/ops/catalog/brands'||p==='/v1/ops/catalog/categories') {
    const isBrand=p.endsWith('/brands'), items=isBrand?r.brands:r.categories, idKey=isBrand?'brand_id':'category_id';
    if(!write) return asPage(!isBrand&&q.has('parent_id')?items.filter(item=>item.parent_id===q.get('parent_id')):items.filter(item=>isBrand||!item.parent_id),q);
    if(method!=='POST') throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:'此目录操作未配置',request_id:'preview'});
    const name=String(body.name??'').normalize('NFC').trim();
    if(!name||name.length>80)throw new ApiProblem(422,{code:'VALIDATION_FAILED',message:'品牌或分类名称须为 1～80 字',request_id:'preview'});
    const existing=items.find(item=>item.name.normalize('NFC').trim()===name&&String(item.parent_id??'')===String(body.parent_id??''));
    if(existing)return clone(existing);
    const id=`preview-${isBrand?'brand':'category'}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const row={ [idKey]:id, name, status:'ACTIVE', version:'1', ...(isBrand?{}:{parent_id:body.parent_id??null,has_children:false,sort_order:body.sort_order??0}) };
    items.push(row);save();return clone(row);
  }
  if(p.startsWith('/v1/ops/catalog/products')) {
    const id=p.split('/')[5];
    if(!id){if(write){
      if(linked&&!options.idempotencyKey)throw new ApiProblem(422,{code:'VALIDATION_FAILED',message:'商品同步缺少操作标识',request_id:'linked-demo'});
      const digest=linked?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(options.idempotencyKey)))).slice(0,12).map(v=>v.toString(16).padStart(2,'0')).join(''):String(Date.now());
      let item={...clone(r.products[0]),...body,product_id:'product-'+digest,product_no:'XYP-'+Date.now(),brand_name:r.brands.find(b=>b.brand_id===body.brand_id)?.name,category_name:r.categories.find(c=>c.category_id===body.category_id)?.name,asset_count:'0',status:'DRAFT',version:'1',created_at:now(),updated_at:now()};
      if(linked){const reply=await linkedAction('adminCatalog',{item,previousName:'',key:options.idempotencyKey,command:{method,path:p,body,version:options.aggregateVersion??null}});item=reply.result.item;}
      if(!r.products.some(row=>row.product_id===item.product_id))r.products.unshift(item);save();return clone(item);
    }return asPage(r.products.map(item=>({...item,asset_count:String(r.assets.filter(asset=>asset.product_id===item.product_id).length)})),q);}
    const item=found(r.products,'product_id',id);if(write){
      if(linked&&!options.idempotencyKey)throw new ApiProblem(422,{code:'VALIDATION_FAILED',message:'商品同步缺少操作标识',request_id:'linked-demo'});
      if(linked){const previous=(await linkedState()).receipts['linked-catalog-intent:'+options.idempotencyKey];if(previous){if(previous.fingerprint!==JSON.stringify({method,path:p,body,version:options.aggregateVersion??null}))throw new ApiProblem(409,{code:'IDEMPOTENCY_CONFLICT',message:'同一操作键不能用于不同内容',request_id:'linked-demo'});Object.assign(item,previous.result.item);save();return clone(item);}}
      if(linked&&options.aggregateVersion&&options.aggregateVersion!==`"v${item.version}"`)throw new ApiProblem(412,{code:'VERSION_CONFLICT',message:'商品已变化，请刷新后重试',request_id:'linked-demo'});
      let next={...clone(item),...body,version:String(Number(item.version)+1),updated_at:now()};
      if(body.brand_id)next.brand_name=r.brands.find(b=>b.brand_id===body.brand_id)?.name;if(body.category_id)next.category_name=r.categories.find(c=>c.category_id===body.category_id)?.name;
      if(p.endsWith('/archive'))next.status='ARCHIVED';if(p.endsWith('/restore')||p.endsWith('/activate'))next.status='ACTIVE';if(p.endsWith('/deactivate'))next.status='INACTIVE';
      if(linked){const reply=await linkedAction('adminCatalog',{item:next,previousName:item.name,key:options.idempotencyKey,command:{method,path:p,body,version:options.aggregateVersion??null}});next=reply.result.item;}
      Object.assign(item,next);save();
    }return clone(item);
  }
  if(p.startsWith('/v1/ops/merchants')) {
    const id=p.split('/')[4];
    if(!id){if(write){const item={...clone(r.merchants[0]),...body,merchant_id:'merchant-'+Date.now(),version:'1',photo_material_ids:body.photo_material_ids??[]};item.cover_material_id=item.photo_material_ids[0]??null;r.merchants.unshift(item);save();return clone(item);}return asPage(r.merchants,q);}
    const item=found(r.merchants,'merchant_id',id);if(write){Object.assign(item,body,{version:String(Number(item.version)+1),updated_at:now()});item.cover_material_id=item.photo_material_ids?.[0]??null;for(const [suffix,status]of[['archive','ARCHIVED'],['restore','ACTIVE'],['activate','ACTIVE'],['deactivate','INACTIVE']])if(p.endsWith('/'+suffix))item.status=status;save();}return clone(item);
  }
  if(p.startsWith('/v1/ops/assets')) {
    const parts=p.split('/'),id=parts[4];
    if(id==='platform-publication-context')return {official_lessor:{lessor_id:'lessor-official',display_name:'星遇官方'},product_id:q.get('product_id'),rental_unit:q.get('rental_unit')??'DAY',rule_version_id:'preview-rule',eligibility_rule_version_id:'preview-eligibility',read_at:now(),available_from:now(),available_until:'2027-12-31T00:00:00Z',availability_policy:'OPEN_ENDED'};
    if(id==='platform-batches'){const list=Array.from({length:Math.max(1,Number(body.quantity??body.count??1))},()=>{const asset={...clone(r.assets[1]),asset_id:'asset-'+Date.now()+'-'+r.assets.length,asset_no:'XYA-'+r.assets.length,product_id:body.product_id??'product-1',display_name:body.display_name??'新建预览资产',supply_type:'CABINET',publish_status:'OFFLINE',availability_status:'AVAILABLE'};const revision={...clone(r.revisions[1]),...body,asset_id:asset.asset_id,revision_id:'revision-'+asset.asset_id};asset.latest_revision_id=revision.revision_id;asset.current_revision_id=revision.revision_id;r.assets.unshift(asset);r.revisions.unshift(revision);return{asset_id:asset.asset_id,asset_no:asset.asset_no,revision_id:revision.revision_id,state:{version:'1'}};});save();return{assets:list};}
    if(!id)return asPage(r.assets,q);
    const asset=found(r.assets,'asset_id',id);
    if(p.endsWith('/placements')){const slot=found(r.compartments,'compartment_id',body.compartment_id);slot.business_occupancy_status='OCCUPIED';slot.occupant={asset_id:id,asset_no:asset.asset_no,display_name:asset.display_name};save();return {placement:dossier(id).placement,asset:dossier(id).asset};}
    if(p.includes('/edit-details'))return {...copy('OpsPlatformAssetEditDetails'),...clone(r.revisions.find(v=>v.asset_id===id))};
    if(p.includes('/private-details'))return {...copy('OpsAssetPrivateDetails'),asset_id:id,revision_id:asset.latest_revision_id,asset_version:asset.version,expires_at:new Date(Date.now()+600000).toISOString(),publication_location:{province_name:'广东省',city_name:'深圳市',district_name:'南山区',detail_address:'创意园 1 号',recipient_name:'林沐',phone_country_code:'86',phone:'13800000000'},delivery_locations:[]};
    if(p.endsWith('/revisions')&&!write)return asPage(r.revisions.filter(v=>v.asset_id===id),q);
    if(write){asset.version=String(Number(asset.version)+1);if(p.endsWith('/rfid')){asset.rfid_code=body.rfid_code;save();return {asset_id:id,rfid_code:asset.rfid_code,version:asset.version};}if(p.endsWith('/publish'))asset.publish_status='ONLINE';if(p.endsWith('/unpublish'))asset.publish_status='OFFLINE';if(p.endsWith('/decisions')){asset.latest_review_status=body.decision==='APPROVE'?'APPROVED':'REJECTED';r.revisions.find(v=>v.asset_id===id).review_status=asset.latest_review_status;}if(p.endsWith('/revisions')){Object.assign(r.revisions.find(v=>v.asset_id===id),body);save();return{assets:[{asset_id:id,revision_id:asset.latest_revision_id,asset_no:asset.asset_no,state:{version:asset.version}}]};}save();}
    return dossier(id);
  }
  if(p.startsWith('/v1/ops/cabinet-credentials/'))return {...copy('OpsCabinetCredential'),credential_id:p.split('/').at(-1),status:'DORMANT',pickup_code:null};
  if(p.startsWith('/v1/ops/cabinet-commands/')){const cmd=commands.get(p.split('/')[4]);if(write){if(cmd)cmd.resolution_status='SAFE_RELEASED';return {...copy('RecoveryRecord'),command_id:p.split('/')[4],result:'SAFE_RELEASED',created_at:now()};}return clone(cmd??copy('CabinetCommand'));}
  if(p.startsWith('/v1/ops/cabinets')) {
    const parts=p.split('/'),id=parts[4];
    if(!id){if(write){const item={...clone(r.cabinets[0]),...body,cabinet_id:'cabinet-'+Date.now(),lifecycle_status:'INACTIVE',version:1};r.cabinets.push(item);r.compartments.push(...Array.from({length:item.compartment_count},(_,j)=>({...clone(r.compartments[7]),cabinet_id:item.cabinet_id,compartment_id:item.cabinet_id+'-'+j,compartment_no:j+1,occupant:null})));save();return clone(item);}return{...asPage(r.cabinets,q),statistics:{total:r.cabinets.length,active:r.cabinets.filter(c=>c.lifecycle_status==='ACTIVE').length,inactive:1,archived:0,online:5,offline:1,unknown:0,occupied:6,available:6,full:0}};}
    const item=found(r.cabinets,'cabinet_id',id),slots=r.compartments.filter(c=>c.cabinet_id===id);
    if(parts[5]==='cover-syncs') {
      if(method!=='POST')throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:'封面同步只支持本地提交',request_id:'preview-unmapped'});
      if(item.cover?.status==='UNKNOWN'&&(!body.confirm_resend||body.original_sync_id!==item.cover.sync_id))throw new ApiProblem(409,{code:'RESOURCE_CONFLICT',message:'请先核对上次结果并确认重新下发',request_id:'preview'});
      const syncId='preview-cover-'+Date.now()+'-'+Math.floor(Math.random()*100000);
      item.cover={sync_id:syncId,status:'ACCEPTED',cover_url:'/assets/mock/cabinet-cover.png',code_ready:true,accepted_at:now(),error_code:null,preview_is_previous:false};save();
      return {sync_id:syncId};
    }
    if(p.endsWith('/mini-program-code')) { const image=new Image(), url=URL.createObjectURL(new Blob([demoQrSvg],{type:'image/svg+xml'})); try { await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;}); const canvas=document.createElement('canvas');canvas.width=220;canvas.height=220;const context=canvas.getContext('2d');if(!context)throw new Error('浏览器不支持生成本地二维码示意图');context.drawImage(image,0,0,220,220);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('二维码示意图生成失败')),'image/png')); } finally { URL.revokeObjectURL(url); } }
    if(parts[5]==='compartments'&&parts.length===6)return{items:clone(slots)};
    if(p.endsWith('/provider-actions'))return {items:clone(localActions)};
    if(p.includes('/stocking-options'))return {items:r.assets.filter(a=>a.supply_type!=='PERSONAL'&&a.availability_status==='AVAILABLE').map(a=>({...a,asset_version:a.version})),page:{has_more:false,next_cursor:null}};
    if(p.includes('/provider-operations'))return asPage([...commands.values()].map(c=>({...copy('CabinetProviderOperation'),...c,operation_id:c.command_id,kind:c.command_type==='OPEN_ONE'?'OPEN_ONE':'ONLINE_QUERY',status:'SUCCEEDED',created_at:now()})),q);
    if(p.includes('/provider-queries')){const queryId=write?'preview-query-'+Date.now():parts.at(-1);item.connectivity_status='ONLINE';item.connectivity_stale=false;slots.forEach(slot=>Object.assign(slot,{door_status:'CLOSED',door_observed_at:now(),rfid_checked_at:now()}));save();return {...copy('CabinetProviderQuery'),query_id:queryId,cabinet_id:id,status:'SUCCEEDED',connectivity_status:'ONLINE',door_status:'CLOSED',observed_at:now(),compartment_no:Number(parts[6])||null};}
    if(p.includes('/open-all-challenges'))return {...copy('OpenAllChallenge'),challenge_id:'preview-open-all',status:'VERIFIED',expires_at:new Date(Date.now()+300000).toISOString(),phone_masked:'138****0000'};
    if(p.includes('/maintenance-open-commands')||p.includes('/open-all-commands')||p.endsWith('/observation-refreshes')){const c={...copy('CabinetCommand'),command_id:'preview-command-'+Date.now(),cabinet_id:id,command_type:p.includes('maintenance-open')?'OPEN_ONE':p.includes('open-all')?'OPEN_ALL':'OBSERVE_CABINET',execution_status:'ACCEPTED',resolution_status:'SAFE_RELEASED',observation_status:'CLOSED',created_at:now(),topology_version:item.topology_version,targets:slots.map(slot=>({compartment_id:slot.compartment_id,compartment_no:slot.compartment_no,door_status:'CLOSED',observed_at:now()}))};commands.set(c.command_id,c);return clone(c);}
    if(parts.length>5&&!['activate','deactivate','archive','restore','compartment-adjustments'].includes(parts[5]))throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:`预览尚未实现此柜机操作：${method} ${p}`,request_id:'preview-unmapped'});
    if(write){Object.assign(item,body,{version:item.version+1});if(p.endsWith('/activate')||p.endsWith('/restore'))item.lifecycle_status='ACTIVE';if(p.endsWith('/deactivate'))item.lifecycle_status='INACTIVE';if(p.endsWith('/archive'))item.lifecycle_status='ARCHIVED';save();}return clone(item);
  }
  if(p.startsWith('/v1/ops/asset-placements/')){const assetId=p.split('/')[4].replace(/^placement-/,'');const slot=r.compartments.find(c=>c.occupant?.asset_id===assetId);if(slot){slot.occupant=null;slot.business_occupancy_status='AVAILABLE';}save();return {...copy('OpsPlacementReceipt'),placement:null,asset:r.assets.find(a=>a.asset_id===assetId)};}
  if(p.includes('/placements')) {
    if(write){const slot=r.compartments.find(c=>c.compartment_id===body.compartment_id);const asset=r.assets.find(a=>a.asset_id===body.asset_id);if(slot&&asset){slot.business_occupancy_status='OCCUPIED';slot.occupant={asset_id:asset.asset_id,asset_no:asset.asset_no,display_name:asset.display_name};}save();return {...copy('OpsPlacementReceipt'),placement_id:'preview-placement',placement:dossier(asset?.asset_id??'asset-1').placement};}
  }
  if(p.startsWith('/v1/ops/members')) {const id=p.split('/')[4];if(!id)return asPage(r.members,q);if(p.includes('entitlement-movements'))return asPage([{...copy('MemberEntitlementMovement'),movement_id:'movement-1',account_id:id,quantity:'5',source_id:q.get('source_id')}],q);return {...copy('MemberDossier'),profile:r.members.find(m=>m.account_id===id)??r.members[0]};}
  if(p.startsWith('/v1/ops/rental-orders')) {
    const id=p.split('/')[4],suffix=p.split('/').slice(5).join('/');
    if(!id) {
      const shared=linked?(await linkedState()):null;
      return asPage([...(shared?shared.orders.map(d=>linkedOrder(d,shared,r.orders[0],action).order):[]),...r.orders.map(d=>d.order)],q);
    }
    if(linked&&isLinkedId(id)) {
      const state=await linkedState(), original=originalId(id), mini=state.orders.find(d=>d.order.order_id===original);
      if(!mini)throw new ApiProblem(404,{code:'NOT_FOUND',message:'共享演示订单不存在',request_id:'linked-demo'});
      const detail=linkedOrder(mini,state,r.orders[0],action);
      if(write && suffix==='reviews' && options.idempotencyKey){const previous=state.receipts['linked-admin:'+options.idempotencyKey];if(previous){if(previous.fingerprint!==JSON.stringify({id:original,input:body}))throw new ApiProblem(409,{code:'IDEMPOTENCY_CONFLICT',message:'同一审核键不能用于不同内容',request_id:'linked-demo'});return {...copy('OpsReviewView'),...previous.result,order_id:id};}}
      if(write && ['review-preview','reviews'].includes(suffix) && options.aggregateVersion !== linkTag('order',id,mini.order.version)) throw new ApiProblem(412,{code:'VERSION_CONFLICT',message:'共享订单已变化，请刷新后再操作',request_id:'linked-demo'});
      if(!suffix&&!write)return detail;
      if(suffix==='contract'&&!write){const reply=await linkedRequest('/v1/me/rental-orders/'+encodeURIComponent(original)+'/contract');return {...reply.data,order_id:id};}
      if(suffix==='payments'&&!write)return asPage([detail.bill.initial_payment,detail.bill.supplement?.paid_payment,detail.bill.supplement?.active_payment].filter(Boolean),q);
      if(suffix==='refunds'&&!write)return asPage([detail.bill.refund_summary?.latest_refund].filter(Boolean),q);
      if(suffix==='cabinet-tasks'&&!write)return asPage(state.tasks.filter(task=>task.order_id===original).map(task=>({...task,order_id:id})),q);
      if(suffix==='reviews'&&!write)return asPage(state.receipts['linked-reviews:'+original]?.items??[],q);
      if(suffix==='return'&&!write){
        const entry=state.returns[original] ?? (await linkedRequest('/v1/me/rental-orders/'+encodeURIComponent(original)+'/return')).data;
        const evidence_slots=(entry.evidence_slots??[]).map(slot=>({...slot,items:(slot.items??[]).map(item=>({...copy('ReturnEvidenceItem'),...item,evidence_id:item.evidence_id??`${original}-${slot.slot.slot_key}-${item.item_no}`,availability:item.availability??item.status??'READY',is_current:true,media:item.media?{...item.media,url:item.media.url?.startsWith('/assets/')?'/__mock-link'+item.media.url:item.media.url}:null}))}));
        return {...copy('OpsReturnView'),...entry,evidence_slots,order_id:id,receipt_source:entry.method==='CABINET'?'CABINET':'OFFICIAL',receipt_actor_display_name:'本机模拟',receipt_actor_id:'preview-admin',allowed_actions:[action('RECORD_RECEIPT',id),action('PREVIEW_REVIEW',id),action('SUBMIT_REVIEW',id)]};
      }
      if(suffix==='review-preview'&&write){
        const reply=await linkedAction('adminPreview',{id:original,expectedVersion:mini.order.version,body});return {...copy('ReviewPreview'),...reply.result,order_id:id};
      }
      if(suffix==='reviews'&&write){
        const reply=await linkedAction('adminReview',{id:original,key:options.idempotencyKey??'',expectedVersion:mini.order.version,body});return {...copy('OpsReviewView'),...reply.result,order_id:id};
      }
      if(suffix==='return/receipt'&&write){const entry=state.returns[original];if(!entry||options.aggregateVersion!==linkTag('return',id,entry.version??'1'))throw new ApiProblem(412,{code:'VERSION_CONFLICT',message:'共享归还记录已变化，请刷新后再操作',request_id:'linked-demo'});const reply=await linkedAction('adminReceipt',{id:original,key:options.idempotencyKey??'',expectedVersion:entry.version??'1',body});return {...copy('OpsReturnView'),...reply.result,order_id:id};}
      throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:'该共享订单操作尚未配置，不会伪造成功',request_id:'linked-demo'});
    }
    const d=found(r.orders.map(d=>({...d,id:d.order.order_id})),'id',id),original=r.orders.find(o=>o.order.order_id===id);
    if(suffix==='payments')return asPage(r.payments.filter(v=>v.order_id===id),q);
    if(suffix==='refunds')return asPage(r.refunds.filter(v=>v.order_id===id),q);
    if(suffix==='contract'){const c={...copy('ContractView'),contract_id:'contract-'+id,order_id:id,status:'SUCCEEDED',quota_state:'CONSUMED',agreement_text:'星遇设备租赁协议（视觉预览）\n出租方提供约定设备，承租人按约定保管并如期归还。\n本文件为合成样例，仅供后台视觉预览。',lessor_signature:{...copy('ContractView').lessor_signature,name:'林沐'},tenant_signature:{...copy('ContractView').tenant_signature,name:d.order.participants.tenant_display_name,status:'SUCCEEDED',signed_at:now()},current_attempt:null,final_artifact:{...copy('ContractView').final_artifact,document_url:'/preview-contract.html',document_sha256:'preview-document',page_count:2}};return c;}
    if(suffix==='cabinet-tasks'){if(d.order.supply_channel!=='OFFICIAL_CABINET'||['AWAITING_PAYMENT','CLOSED'].includes(d.order.stage))return asPage([],q);return asPage([{...copy('CabinetTask'),task_id:'task-'+id,order_id:id,cabinet_id:'cabinet-1',cabinet_name:r.cabinets[0].cabinet_name,compartment_id:'slot-1-1',compartment_no:1,status:d.order.display_status_code==='AWAITING_PICKUP'?'RESERVED':'SUCCEEDED',door_status:'CLOSED',purpose:'PICKUP',rfid_result:'MATCH',occupancy_result:d.order.display_status_code==='AWAITING_PICKUP'?'TARGET_PRESENT':'TARGET_ABSENT',blockers:[],allowed_actions:[]}],q);}
    if(suffix==='reviews'&&!write)return asPage(r.reviews?.filter(v=>v.order_id===id)??[],q);
    if(suffix==='review-preview')return {...copy('ReviewPreview'),basis_version:original.order.version,order_id:id,overtime_fen:'6000',loss_fen:'0',deducted_fen:'6000',refund_due_fen:'294000',supplement_due_fen:'0',blockers:[]};
    if(suffix==='reviews'&&write){const review={...copy('OpsReviewView'),...body,review_id:'review-'+Date.now(),review_no:'RV-'+Date.now(),order_id:id,created_at:now(),actor_account_id:'preview-admin',actor_display_name:'林沐',allocation:{deducted_fen:'6000',refund_due_fen:'294000',supplement_due_fen:'0'},assessment:{...copy('OpsReviewView').assessment,rejection_reason:body.rejection_reason??null,adjustment_reason:body.adjustment_reason??null,evidence:[],loss_items:[],missing_items:[]},overtime_calculated_fen:'6000',overtime_assessed_fen:body.overtime_assessed_fen??'6000',loss_confirmed_fen:'0'};r.reviews??=[];r.reviews.push(review);original.order.review_status=body.decision==='APPROVE_FINAL'?'FINAL':body.decision==='MATERIAL_REQUIRED'?'MATERIAL_REQUIRED':'DISPUTED';original.order.display_status=body.decision==='APPROVE_FINAL'?'退款中':'待核实';original.order.display_status_code=body.decision==='APPROVE_FINAL'?'AWAITING_REFUND':'AWAITING_REVIEW';original.bill.finalized=body.decision==='APPROVE_FINAL';save();return review;}
    if(suffix.startsWith('return')){const result=returnView(original);const stored=r.returns.find(v=>v.order_id===id);if(write){Object.assign(stored,body);if(suffix.includes('receipt')){stored.received_at=body.received_at??now();original.order.physical_status='RECEIVED';original.order.review_status='PENDING';original.order.display_status='待审核';}if(suffix.includes('evidence-slots')){const slot=stored.evidence_slots[0];slot.items=[{...copy('ReturnEvidenceItem'),...body,media:media(0),availability:'READY',is_current:true}];}save();return clone(stored);}return result;}
    if(suffix==='refund'&&write){original.order.display_status='退款中';original.order.display_status_code='AWAITING_REFUND';save();return {accepted:true,command_id:'preview-refund-command'};}
    return clone(original);
  }
  if(p.startsWith('/v1/ops/rental-cabinet-tasks/')&&write)return {accepted:true,command_id:'preview-return-resolution',task_id:p.split('/')[4]};
  if(linked && (p.startsWith('/v1/ops/rental-payments') || p.startsWith('/v1/ops/rental-refunds'))) {
    const payments=p.startsWith('/v1/ops/rental-payments'), id=p.split('/')[4], state=await linkedState(), key=payments?'payment_id':'refund_id';
    const rows=state.orders.flatMap(d=>{
      const values=payments?[d.bill.initial_payment,d.bill.supplement?.active_payment,d.bill.supplement?.paid_payment]:[d.bill.refund_summary?.latest_refund];
      return values.filter(Boolean).map(value=>({...clone(payments?r.payments[0]:r.refunds[0]),...value,[key]:linkedId(value[key]),order_id:linkedId(d.order.order_id),order_no:d.order.order_no}));
    });
    if(!id)return asPage([...rows,...(payments?r.payments:r.refunds)],q);
    if(isLinkedId(id)) {
      const item=found(rows,key,id);
      if(write&&p.endsWith('/reconciliation')) {
        const kind=payments?'rental-payments':'rental-refunds';
        const reply=await linkedRequest('/v1/me/'+kind+'/'+encodeURIComponent(originalId(id))+'/reconciliation','POST',{}, {'Idempotency-Key':options.idempotencyKey??''});
        return {...item,...reply.data,[key]:id,order_id:item.order_id,order_no:item.order_no};
      }
      if(!write)return item;
      throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:'该共享资金操作尚未配置，不会伪造成功',request_id:'linked-demo'});
    }
  }
  for(const [path,name,idKey] of [['rental-payments','payments','payment_id'],['rental-refunds','refunds','refund_id'],['rental-earnings','earnings','earning_id'],['entitlement-purchases','purchases','purchase_id']]) {
    if(p.startsWith('/v1/ops/'+path)){const id=p.split('/')[4];if(!id)return asPage(r[name],q,name==='earnings');const item=found(r[name],idKey,id);if(write){item.last_verified_at=now();if(p.includes('reconciliation')){item.status='SUCCEEDED';const order=r.orders.find(v=>v.order.order_id===item.order_id);if(name==='payments'){item.payer_total_fen=item.amount_fen;item.paid_at=now();item.channel_status='SUCCESS';if(order&&item.purpose==='INITIAL'&&order.order.stage==='AWAITING_PAYMENT'){order.order.initial_paid_fen=item.amount_fen;order.order.initial_payer_total_fen=item.amount_fen;order.order.stage='ACTIVE';order.order.display_status_code='AWAITING_PICKUP';order.order.display_status='待取件';order.bill.deposit_received_fen=order.fees.deposit_due_fen;order.bill.initial_payment=clone(item);Object.assign(order.bill.funds_summary,{gross_received_fen:item.amount_fen,payer_total_fen:item.amount_fen,net_received_fen:item.amount_fen,payer_net_fen:item.amount_fen});}else if(order&&item.purpose==='SUPPLEMENT'&&order.bill.supplement?.supplement_id===item.supplement_id){order.bill.supplement.status='PAID';order.bill.supplement.active_payment=null;order.bill.supplement.paid_payment=clone(item);order.order.supplement_due_fen='0';order.bill.supplement_due_fen='0';const received=String(Number(order.order.initial_paid_fen)+Number(item.amount_fen));Object.assign(order.bill.funds_summary,{gross_received_fen:received,payer_total_fen:received,net_received_fen:received,payer_net_fen:received});order.order.display_status_code='AWAITING_REVIEW';order.order.display_status='待审核';}}if(name==='refunds'){item.payer_refund_fen=item.amount_fen;item.refunded_at=now();if(order){order.bill.deposit_refunded_fen=item.amount_fen;const net=String(Number(order.bill.funds_summary.payer_total_fen)-Number(item.amount_fen));Object.assign(order.bill.funds_summary,{refunded_fen:item.amount_fen,payer_refund_fen:item.amount_fen,net_received_fen:net,payer_net_fen:net});Object.assign(order.bill.refund_summary,{refunded_fen:item.amount_fen,pending_fen:'0',open_obligation_count:0,latest_refund:clone(item)});order.order.stage='COMPLETED';order.order.display_status_code='COMPLETED';order.order.display_status='已完成';order.completed_at=now();}}}save();}return clone(item);}
  }
  if(p==='/v1/ops/merchant-income/export')return new Blob(['\ufeff订单号,商家,收益（分）\n'+r.earnings.filter(v=>v.beneficiary_kind==='MERCHANT').map(v=>[v.order_no,v.merchant_name,v.beneficiary_fen].join(',')).join('\n')],{type:'text/csv'});
  if(p.startsWith('/v1/ops/iam')) {
    const kind=p.split('/')[4],id=p.split('/')[5];const name={roles:'roles',accounts:'accounts','login-events':'loginEvents','operation-events':'operationEvents'}[kind];
    if(!name)throw new Error('预览身份接口不存在');
    if(kind==='roles'&&!id)return {items:clone(r.roles)};
    if(!id){if(write){const row={...clone(r.accounts[0]),...body,account_id:'admin-'+Date.now(),roles:body.role_ids?.map(id=>r.roles.find(v=>v.role_id===id)?.role_code)??['ops.operations']};r.accounts.unshift(row);save();return clone(row);}return asPage(r[name],q);}
    const row=found(r[name],kind==='roles'?'role_id':'account_id',id);if(write){Object.assign(row,body);if(p.endsWith('deactivate'))row.status='DISABLED';if(p.endsWith('reactivate'))row.status='ACTIVE';if(p.endsWith('archive'))row.status='ARCHIVED';save();}return clone(row);
  }
  if(p.startsWith('/v1/ops/system-config')) {
    const key=q.get('config_key')??p.split('/')[5];
    if(p.endsWith('/definitions'))return {items:['material.upload_policy','identity.profile_policy','sms.challenge_policy'].map(config_key=>({...copy('ConfigDefinition'),config_key,schema_version:config_key==='material.upload_policy'?2:1,status:'ACTIVE',scope_type:'PLATFORM',value_type:{'material.upload_policy':'MATERIAL_UPLOAD_POLICY','identity.profile_policy':'IDENTITY_PROFILE_POLICY','sms.challenge_policy':'SMS_CHALLENGE_POLICY'}[config_key]}))};
    if(p.includes('/effective')&&key){if(write){s.configs[key]=clone(body.value);const v={...copy('LoyaltyConfigVersion'),config_key:key,config_version_id:'config-'+Date.now(),value:clone(body.value),effective_epoch:String(s.versions.filter(v=>v.config_key===key).length+1),effective_at:now(),saved_by:'preview-admin',reason:body.reason,field_changes:[],inventory_movements:[],operation_event_id:'preview-event'};s.versions.push(v);if(key==='benefits.lottery')for(const prize of body.value.prizes){const row=r.inventory.find(i=>i.prize_code===prize.prize_code);row.total_qty=prize.total_qty;row.remaining_qty=String(BigInt(prize.total_qty)-BigInt(row.issued_qty));row.version=String(Number(row.version)+1);}save();return{...v,current:{...v},inventory:key==='benefits.lottery'?clone(r.inventory):null,replayed:false,operation_event_id:'preview-event'};}const v=s.versions.filter(v=>v.config_key===key).at(-1);return {current:{config_key:key,config_version_id:v.config_version_id,effective_epoch:String(v.effective_epoch??1),effective_at:v.effective_at??v.created_at,saved_by:'preview-admin',value:clone(s.configs[key])},inventory:key==='benefits.lottery'?clone(r.inventory):null,as_of_at:now()};}
    if(p.endsWith('/effective'))return {items:effectiveRows()};
    if(p.endsWith('/business-publications')){s.configs[body.config_key]=clone(body.value);const v={...copy('BusinessConfigVersion'),...body,config_version_id:'config-'+Date.now(),version_no:s.versions.filter(v=>v.config_key===body.config_key).length+1,effective_epoch:String(s.versions.length+1),effective_at:now(),published_at:now(),created_at:now(),status:'PUBLISHED',version:1,created_by:'preview-admin'};s.versions.push(v);save();return clone(v);}
    if(p.includes('/versions')){const id=p.split('/')[5];if(id&&id!=='versions'){const v=found(s.versions,'config_version_id',id);if(write){v.status={validate:'VALIDATED',approve:'APPROVED',publish:'PUBLISHED'}[p.split('/').at(-1)]??v.status;if(v.status==='PUBLISHED')s.configs[v.config_key]=clone(v.value);save();}return clone(v);}if(write){const v={...copy('ConfigVersion'),...body,config_version_id:'config-'+Date.now(),status:'DRAFT',version:1,version_no:s.versions.length+1,created_at:now(),created_by:'preview-admin'};s.versions.push(v);save();return clone(v);}return asPage(s.versions.filter(v=>!key||v.config_key===key),q);}
  }
  if(p==='/v1/ops/lottery-prizes/inventory')return {items:clone(r.inventory),as_of_at:now()};
  if(p==='/v1/ops/coupons'||p.startsWith('/v1/ops/coupons/')){
    const id=p.slice('/v1/ops/coupons'.length).replace(/^\//,'');
    if(linked&&(!id||isLinkedId(id))){const shared=await linkedState();const rows=shared.coupons.map(c=>({...copy('CouponDetail'),...clone(c),coupon_id:linkedId(c.coupon_id),account_id:linkedId(c.account_id),status_events:[],redemption_id:null,entitlement_lot_id:null,movement_id:null}));if(id)return clone(found(rows,'coupon_id',id));return asPage([...rows,...r.coupons],q);}
    return id?clone(found(r.coupons,'coupon_id',id)):asPage(r.coupons,q);
  }
  for(const [path,name,idKey]of [['lottery-attempts','lottery','draw_id'],['coupon-redemption-attempts','redemptions','attempt_id'],['lottery-prizes/movements','movements','movement_id']])if(p.startsWith('/v1/ops/'+path)){const id=p.slice(('/v1/ops/'+path).length).replace(/^\//,'');return id?clone(found(r[name],idKey,id)):asPage(r[name],q);}
  for(const [prefix,schema]of [['benefit-grants','BenefitGrantTrace'],['point-entries','PointEntryDetail'],['entitlement-movements','EntitlementMovementDetail'],['operation-events','LoyaltyOperationEvent'],['coupon-redemptions','CouponRedemptionAttempt'],['check-ins','MemberCheckIn']])if(p.startsWith('/v1/ops/'+prefix))return {...copy(schema),account_id:'member-1',created_at:now(),occurred_at:now()};
  throw new ApiProblem(501,{code:'PREVIEW_UNMAPPED',message:`预览尚未覆盖此操作：${method} ${p}`,request_id:'preview-unmapped'});
}
export function createPreviewClient(config = {}) {
  return { async request(options) {
    options.signal?.throwIfAborted();
    const info={path:options.path,method:options.method??'GET',at:now(),status:'pending'};requestLog.push(info);if(requestLog.length>200)requestLog.shift();
    const receiptKey=options.idempotencyKey?`${options.method??'GET'}:${options.path}:${options.idempotencyKey}`:null;
    const linkedReview=config.linked===true&&(options.method??'GET')==='POST'&&/^\/v1\/ops\/rental-orders\/linked-[^/]+\/reviews$/.test(new URL(options.path,'http://visual-preview.invalid').pathname);
    const linkedCatalog=config.linked===true&&(options.method??'GET')!=='GET'&&new URL(options.path,'http://visual-preview.invalid').pathname.startsWith('/v1/ops/catalog/products');
    const fingerprint=linkedReview||linkedCatalog?JSON.stringify({body:options.body??null,version:options.aggregateVersion??null}):null;
    if(receiptKey&&writeReceipts.has(receiptKey)){if((linkedReview||linkedCatalog)&&reviewIntentFingerprints.get(receiptKey)!==fingerprint)throw new ApiProblem(409,{code:'IDEMPOTENCY_CONFLICT',message:'同一操作键不能用于不同内容',request_id:'linked-demo'});return clone(writeReceipts.get(receiptKey));}
    const delay=read().scenario==='loading'?3000:read().latency;
    await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});});
    options.signal?.throwIfAborted();
    try{const result=await handle(options, config.linked === true);
      const match=config.linked===true?new URL(options.path,'http://visual-preview.invalid').pathname.match(/^\/v1\/ops\/rental-orders\/(linked-[^/]+)(\/return)?$/):null;
      const tag=match&&result?(match[2]?linkTag('return',match[1],result.version??'1'):linkTag('order',match[1],result.order?.version??'1')):'"preview-v1"';
      options.onResponseHeaders?.(new Headers({'ETag':tag,'Date':new Date().toUTCString()}));info.status='success';if(receiptKey){writeReceipts.set(receiptKey,clone(result));if(linkedReview||linkedCatalog)reviewIntentFingerprints.set(receiptKey,fingerprint);}if(options.method&&options.method!=='GET'&&!options.path.includes('/auth/'))logWrite(options.path,options.body instanceof FormData?{file:'local-preview'}:options.body);return clone(result);}catch(error){info.status='error';console.warn('Preview operation',options.path,error);throw error;}
  }};
}
export function bootstrapPreview() {
  read();
  if(!sessionStorage.getItem('preview-intentionally-logged-out'))sessionStorage.setItem('xingyu.web-mock.v102.api-refresh.v1',JSON.stringify({token:'preview-local-refresh',key:'preview-restore-key-00000000000001'}));
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.origin!==location.origin||url.pathname.includes('/v1/')) return Promise.reject(new Error('离线预览禁止业务网络请求'));return originalFetch(input,init);};
  const originalOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...rest){const target=new URL(String(url),location.href);if(target.origin!==location.origin||target.pathname.includes('/v1/'))throw new Error('离线预览禁止业务网络请求');return Reflect.apply(originalOpen,this,[method,url,...rest]);};
}
