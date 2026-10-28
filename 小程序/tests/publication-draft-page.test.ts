import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyDraftChanges, bindAssetMedia, bindDeliveryOptions, draftMoneyInput, publicationDraftView, publicationIdentifierIssue } from '../miniprogram/shared/presentation/api-publication-draft';
import { publicationApi, type AssetDraft } from '../miniprogram/shared/api/publication-api';
import { preparePublicationAddressIntent, readPublicationAddressIntent, releasePublicationAddressIntent } from '../miniprogram/shared/session/publication-address-intent';

interface Harness { data:Record<string,unknown>;setData(p:Record<string,unknown>):void;[key:string]:unknown }
interface Wire {url:string;method:string;header:Record<string,string>;data?:unknown;success(v:unknown):void;fail(v:{errMsg:string}):void}
let definition:Harness;let page:Harness;let owner:string|null;let deferred:boolean;let writeStatus:number;let readStatus:number;let storageFailure:boolean;let reorderedReadback:boolean;let changedReadback:boolean;
const wires:Wire[]=[];const abort=vi.fn();const navigateTo=vi.fn((v:{complete?:()=>void})=>v.complete?.());const storageWrite=vi.fn();const showToast=vi.fn();const showModal=vi.fn();
const storage=new Map<string,unknown>();
function fixture():AssetDraft{
 return {draft_id:'draft-owned',status:'EDITING',origin_kind:'CREATE',base_version:null as string|null,version:'9',asset_id:null as string|null,committed_revision_id:null as string|null,asset:{
  display_name:'服务器相机',condition:'GOOD',identifier_type:'MANUFACTURER_SERIAL',identifier_value:'serial-original',rental_unit:'DAY',
  unit_price_fen:'105',deposit_fen:'9007199254740993',minimum_units:'1',reference_value_fen:'200000',
  description:'原说明',defect_description:'原瑕疵',accessories_text:'原配件',product_id:'catalog-owned',rule_version_id:'published-rule',eligibility_rule_version_id:'eligibility-rule',
  available_from:'2026-09-12T16:00:00Z',available_until:'2026-09-22T16:00:00Z',timezone:'Asia/Shanghai',
  media:[{material_id:'owned-ready',role:'COVER',sort_order:0}],
  publication_location:{dataset_id:'ds',province_id:'p',city_id:'c',district_id:'d',recipient_name:'本人',detail_address:'私密原地址',phone_country_code:'+86',phone:'13900000000',location:{latitude:'30.000000',longitude:'120.000000',source:'MAP_PICK',coordinate_system:'GCJ02'}},
  delivery_options:[{method:'EXPRESS',source_address_id:'original-address',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}],
 }};
}
let server:AssetDraft=fixture();
const catalogProduct={product_id:'product-available',name:'在售相机',model:'A7',description:'合成说明',brand_id:'brand-1',brand_name:'合成品牌',category_id:'category-1',category_name:'微单相机',tags:['摄影'],media:[{material_id:'material-cover',role:'COVER',mime_type:'image/png',size_bytes:1024,sort_order:0,url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/cover',metadata:{schema_version:1,width:100,height:80,duration_ms:null,video_codec:null,audio_codec:null},poster:null}],updated_at:'2026-09-17T04:00:00Z'};
function send(w:Wire,body:unknown,status=200){w.success({statusCode:status,data:body,header:{},cookies:[]});}
function defaultReply(w:Wire){
 if(w.url.includes('/v1/me/catalog/products')){send(w,{items:[catalogProduct],page:{page_size:50,has_more:false}});return;}
 const status=w.method==='GET'?readStatus:writeStatus;
 if(status===0){w.fail({errMsg:'request:fail timeout'});return;}
 if(status!==200){send(w,{code:status===401?'TOKEN_EXPIRED':'DRAFT_CONFLICT',message:'服务器拒绝操作',request_id:'draft-http'},status);return;}
 if(w.method==='GET'){
  const response=structuredClone(server);
  if(reorderedReadback)response.asset=Object.fromEntries(Object.entries(response.asset).reverse()) as AssetDraft['asset'];
  if(changedReadback)response.asset={...response.asset,display_name:'服务端返回的不同名称'};
  send(w,response);return;
 }
 if(w.url.includes('/submissions')){const version=(BigInt(server.version)+1n).toString();server={...server,status:'SUBMITTED',version,asset_id:'asset-owned',committed_revision_id:'revision-owned'};send(w,{kind:'DRAFT',id:server.draft_id,status:'SUBMITTED',version,asset_id:'asset-owned',revision_id:'revision-owned',asset_version:'1'});return;}
 if(/\/v1\/me\/asset-drafts$/.test(w.url)){server={draft_id:'draft-new',status:'EDITING',origin_kind:'CREATE',base_version:null,version:'1',asset_id:null,committed_revision_id:null,asset:{}};send(w,{kind:'DRAFT',id:'draft-new',status:'EDITING',version:'1'});return;}
 const version=(BigInt(server.version)+1n).toString();server={...server,version,asset:structuredClone((w.data as {asset:typeof server.asset}).asset)};
 send(w,{kind:'DRAFT',id:'draft-owned',status:'EDITING',version});
}
beforeAll(async()=>{vi.stubGlobal('Page',(v:Harness)=>{definition=v;});await import('../miniprogram/pages/publish/index');});
beforeEach(()=>{
 owner='owner-a';deferred=false;writeStatus=200;readStatus=200;storageFailure=false;reorderedReadback=false;changedReadback=false;server=fixture();wires.length=0;storage.clear();abort.mockClear();navigateTo.mockClear();storageWrite.mockClear();showToast.mockClear();showModal.mockClear();
 vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:(key:string)=>key==='xingyu.api-session.v1'?(owner?{accountId:owner,accessToken:'token-'+owner,refreshToken:'refresh',expiresAt:Date.now()+60000}:null):storage.get(key),
 removeStorageSync:(key:string)=>{if(key==='xingyu.api-session.v1')owner=null;else storage.delete(key)},setStorageSync:(key:string,value:unknown)=>{storageWrite(key,value);if(storageFailure)throw new Error('storage unavailable');storage.set(key,structuredClone(value));},navigateTo,navigateBack:vi.fn(),switchTab:vi.fn(),showToast,showModal,
 request:(w:Wire)=>{wires.push(w);if(!deferred)defaultReply(w);return {abort};}});
 vi.spyOn(publicationApi,'catalogCategories').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({items:[{category_id:'category-1',name:'微单相机'},{category_id:'category-2',name:'镜头'}]})} as ReturnType<typeof publicationApi.catalogCategories>);
 vi.spyOn(publicationApi,'catalogProduct').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({...catalogProduct,product_id:'catalog-owned'})} as ReturnType<typeof publicationApi.catalogProduct>);
 page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p)}};
 call('onLoad',{draft_id:'draft-owned'});
});
afterEach(()=>{call('onUnload');vi.restoreAllMocks()});afterAll(()=>vi.unstubAllGlobals());
function call(name:string,...args:unknown[]){return (page[name] as (...args:unknown[])=>unknown).apply(page,args);}
function input(field:string,value:string){call('input',{currentTarget:{dataset:{field}},detail:{value}});}
async function tick(){for(let i=0;i<20;i++)await Promise.resolve();}
test('reads current own draft and exact CNY fen without Mock or route state',async()=>{
 await call('onShow');expect(wires).toHaveLength(1);expect(wires[0]?.method).toBe('GET');expect(wires[0]?.url).toContain('/v1/me/asset-drafts/draft-owned');expect(wires[0]?.header.Authorization).toBe('Bearer token-owner-a');
 expect(page.data).toMatchObject({displayName:'服务器相机',expectedRent:'1.05',expectedDeposit:'90071992547409.93',location:'私密原地址',editable:true,mode:'draft',availabilityStart:'2026-09-13',canSubmit:true});
 expect(storageWrite).not.toHaveBeenCalled();
});
test('saved media remains explicitly reloadable until every preview authorization succeeds',async()=>{
 await call('onShow');
 expect(page.data).toMatchObject({mediaItemsCount:1,mediaPreviewCount:0,photoPaths:[]});
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 expect(wxml).toContain('mediaItemsCount > mediaPreviewCount');
});
test('native image chooser hide/show keeps the owned draft and does not show a false login gate',async()=>{
 let chooseSuccess:((value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void)|undefined;
 vi.stubGlobal('wx',{...wx,chooseMedia:(options:{success:(value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void})=>{chooseSuccess=options.success;}});
 const upload=vi.spyOn(publicationApi,'uploadAssetMedia').mockImplementation(()=>({abort:vi.fn(),promise:Promise.reject(new Error('fixture stops before upload'))} as ReturnType<typeof publicationApi.uploadAssetMedia>));
 await call('onShow');
 const selecting=call('selectImage',{currentTarget:{dataset:{kind:'photo'}}});
 await tick();expect(chooseSuccess).toBeTypeOf('function');
 call('onHide');expect(page.data).toMatchObject({loggedIn:true,displayName:'服务器相机',uploadingMedia:true});
 call('onShow');expect(page.data).toMatchObject({loggedIn:true,displayName:'服务器相机'});
 chooseSuccess?.({type:'image',tempFiles:[{tempFilePath:'wxfile://chosen-camera.png',fileType:'image'}]});
 await selecting;
 expect(upload).toHaveBeenCalledWith('wxfile://chosen-camera.png','image',expect.any(String),expect.objectContaining({onProgress:expect.any(Function)}));
 expect(page.data.loggedIn).toBe(true);
 upload.mockRestore();
});
test('a video selected through the image picker is rejected before upload without a pending blocker',async()=>{
 let chooseSuccess:((value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void)|undefined;
 vi.stubGlobal('wx',{...wx,chooseMedia:(options:{success:(value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void})=>{chooseSuccess=options.success;}});
 const upload=vi.spyOn(publicationApi,'uploadAssetMedia');
 await call('onShow');
 const selecting=call('selectImage',{currentTarget:{dataset:{kind:'photo'}}});await tick();
 chooseSuccess?.({type:'video',tempFiles:[{tempFilePath:'wxfile://wrong-video.mp4',fileType:'video'}]});
 await selecting;
 expect(upload).not.toHaveBeenCalled();
 expect(page.data).toMatchObject({loggedIn:true,uploadingMedia:false,hasPendingMedia:false});
 expect(page.data.errorText).toContain('不是支持的图片');
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'素材格式不支持',content:expect.stringContaining('添加设备视频')}));
 upload.mockRestore();
});
test('saving without an address tolerates denied client location and preserves delivery terms',async()=>{
 delete server.asset.publication_location;
 server.asset={...server.asset,delivery_options:[{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]};
 vi.stubGlobal('wx',{...wx,getLocation:({fail}:{fail:()=>void})=>fail()});
 await call('onShow');input('description','无地址发布');await call('saveDraft');
 const saved=(wires.find(w=>w.method==='POST')?.data as {asset:AssetDraft['asset']}).asset;
 expect(saved).toMatchObject({description:'无地址发布',delivery_options:[{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]});
 expect(saved.publication_location).toBeUndefined();expect(saved.publication_position).toBeUndefined();
 expect(page.data).toMatchObject({pendingSave:false,errorText:''});
});
test('saving records a bounded unverified GCJ02 client point without inventing an address',async()=>{
 delete server.asset.publication_location;
 server.asset={...server.asset,delivery_options:[{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]};
 vi.stubGlobal('wx',{...wx,getLocation:({success}:{success:(value:{latitude:number;longitude:number})=>void})=>success({latitude:22.5,longitude:114})});
 await call('onShow');input('description','带实时定位');await call('saveDraft');
 const saved=(wires.find(w=>w.method==='POST')?.data as {asset:AssetDraft['asset']}).asset;
 expect(saved.publication_position).toEqual({latitude:'22.500000',longitude:'114.000000',coordinate_system:'GCJ02',source:'WECHAT_CLIENT'});
 expect(saved.publication_location).toBeUndefined();
});
test('a complete saved personal draft without a delivery address can be submitted',async()=>{
 delete server.asset.publication_location;
 server.asset={...server.asset,delivery_options:[{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]};
 await call('onShow');await call('submit');
 expect(wires.find(w=>w.url.includes('/submissions'))?.method).toBe('POST');
 expect(page.data).toMatchObject({mode:'view',pendingSubmit:false,errorText:''});
});
test('one-click submission with no address and denied client location still saves then submits',async()=>{
 delete server.asset.publication_location;
 server.asset={...server.asset,delivery_options:[{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]};
 vi.stubGlobal('wx',{...wx,getLocation:({fail}:{fail:()=>void})=>fail()});
 await call('onShow');input('description','直接提交无地址设备');await call('submit');
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);
 expect(server.asset.publication_location).toBeUndefined();expect(server.asset.publication_position).toBeUndefined();
 expect(page.data).toMatchObject({mode:'view',pendingSubmit:false});
});
test('an unknown image upload can be explicitly abandoned so the saved draft is submittable again',async()=>{
 let chooseSuccess:((value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void)|undefined;
 vi.stubGlobal('wx',{...wx,chooseMedia:(options:{success:(value:{type:string;tempFiles:{tempFilePath:string;fileType:string}[]})=>void})=>{chooseSuccess=options.success;}});
 const upload=vi.spyOn(publicationApi,'uploadAssetMedia').mockImplementation(()=>({abort:vi.fn(),promise:Promise.reject(new Error('上传结果待确认'))} as ReturnType<typeof publicationApi.uploadAssetMedia>));
 await call('onShow');
 const selecting=call('selectImage',{currentTarget:{dataset:{kind:'photo'}}});await tick();
 chooseSuccess?.({type:'image',tempFiles:[{tempFilePath:'wxfile://camera.png',fileType:'image'}]});
 await selecting;
 expect(page.data).toMatchObject({hasPendingMedia:true,canSubmit:false,uploadingMedia:false});
 call('discardPendingMedia');
 expect(page.data).toMatchObject({hasPendingMedia:false,canSubmit:true,uploadingMedia:false});
 upload.mockRestore();
});
test('shows a type dropdown first, then loads only that type of products and binds the chosen product on save',async()=>{
 const admission=vi.spyOn(publicationApi,'eligibility').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({eligible:true,eligibility_rule_version_id:'eligibility-rule'})} as unknown as ReturnType<typeof publicationApi.eligibility>);
 const context=vi.spyOn(publicationApi,'publicationContext').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({product_id:'product-available',rental_unit:'DAY',rule_version_id:'published-rule',eligibility_rule_version_id:'eligibility-rule',read_at:'2026-09-25T00:00:00Z',pricing_guidance:null})} as ReturnType<typeof publicationApi.publicationContext>);
 await call('onShow');expect(wires).toHaveLength(1);
 expect(page.data).toMatchObject({type:'微单相机',productTypeFilter:'category-1'});
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 expect(wxml).toContain('<picker mode="selector" range="{{typePickerOptions}}" range-key="name"');
 await call('openProductSheet');
 expect(wires).toHaveLength(2);expect(wires[1]?.method).toBe('GET');expect(wires[1]?.url).toContain('/v1/me/catalog/products?category_id=category-1');
 expect(wires[1]?.header.Authorization).toBe('Bearer token-owner-a');
 expect(page.data.activeSheet).toBe('product');
 await tick();
 expect(page.data.productList).toEqual([{id:'product-available',label:'在售相机',detail:'合成品牌 · A7',category:'微单相机',categoryId:'category-1'}]);
 call('selectProductFromSheet',{currentTarget:{dataset:{id:'product-available'}}});
 await tick();
 expect(page.data).toMatchObject({productId:'product-available',productLabel:'在售相机',model:'A7',activeSheet:''});
 await call('saveDraft');
 const write=wires.find(w=>w.method==='POST');
 expect((write?.data as {asset:{product_id:string}}).asset.product_id).toBe('product-available');
 expect(page.data.productLabel).toBe('在售相机');
 admission.mockRestore();context.mockRestore();
});
test('product picker loads a server cursor instead of silently hiding later active products',async()=>{
 await call('onShow');
 const catalog=vi.spyOn(publicationApi,'catalogProducts')
  .mockReturnValueOnce({abort:vi.fn(),promise:Promise.resolve({items:[catalogProduct],page:{page_size:50,has_more:true,next_cursor:'next-page'}})} as ReturnType<typeof publicationApi.catalogProducts>)
  .mockReturnValueOnce({abort:vi.fn(),promise:Promise.resolve({items:[{...catalogProduct,product_id:'later-product',name:'后续商品'}],page:{page_size:50,has_more:false}})} as ReturnType<typeof publicationApi.catalogProducts>);
 await call('loadCatalog');expect(page.data).toMatchObject({catalogHasMore:true,catalogCursor:'next-page'});
 await call('loadMoreCatalog');await tick();
 expect(catalog).toHaveBeenNthCalledWith(2,{categoryId:'category-1',pageSize:50,cursor:'next-page'});
 expect((page.data.productList as Array<{id:string}>).map(item=>item.id)).toEqual(['product-available','later-product']);
 catalog.mockRestore();
});
test('an empty draft requires type selection before opening products and filters the selected type',async()=>{
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 expect(wxml.indexOf('class="form-card catalog-card"')).toBeGreaterThan(0);
 expect(wxml.indexOf('class="form-card catalog-card"')).toBeLessThan(wxml.indexOf('id="publish-media"'));
 expect(wxml.indexOf('aria-label="选择设备类型"')).toBeLessThan(wxml.indexOf('aria-label="选择标准商品"'));
 expect(wxml.indexOf('aria-label="选择标准商品"')).toBeLessThan(wxml.indexOf('id="publish-media"'));
 delete server.asset.product_id;delete server.asset.rule_version_id;delete server.asset.eligibility_rule_version_id;
 await call('onShow');
 expect(page.data).toMatchObject({type:'',productTypeFilter:'',types:[{category_id:'category-1',name:'微单相机'},{category_id:'category-2',name:'镜头'}],typePickerOptions:[{name:'请选择设备类型'},{category_id:'category-1',name:'微单相机'},{category_id:'category-2',name:'镜头'}]});
 call('openProductSheet');expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'请先选择设备类型'}));expect(wires).toHaveLength(1);
 call('chooseType',{detail:{value:'2'}});
 expect(page.data).toMatchObject({type:'镜头',productTypeFilter:'category-2',productId:'',productLabel:'尚未选择商品'});
 const catalog=vi.spyOn(publicationApi,'catalogProducts').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({items:[{...catalogProduct,product_id:'lens-1',category_id:'category-2',category_name:'镜头',name:'在售镜头'}],page:{page_size:50,has_more:false}})} as ReturnType<typeof publicationApi.catalogProducts>);
 call('openProductSheet');await tick();
 expect(catalog).toHaveBeenCalledWith({categoryId:'category-2',pageSize:50});
 expect((page.data.productList as Array<{id:string}>).map(item=>item.id)).toEqual(['lens-1']);
});
test('switching type clears a previously selected product and its rule IDs before draft save',async()=>{
 await call('onShow');
 call('chooseType',{detail:{value:'2'}});
 expect(page.data).toMatchObject({type:'镜头',productTypeFilter:'category-2',productId:'',productMedia:[],productList:[]});
 await call('saveDraft');
 const write=wires.find(w=>w.method==='POST');
 const asset=(write?.data as {asset:Record<string,unknown>}).asset;
 expect(asset.product_id).toBeUndefined();expect(asset.rule_version_id).toBeUndefined();expect(asset.eligibility_rule_version_id).toBeUndefined();
});
test('the sole active type remains selectable after an explicit placeholder',async()=>{
 delete server.asset.product_id;delete server.asset.rule_version_id;delete server.asset.eligibility_rule_version_id;
 vi.spyOn(publicationApi,'catalogCategories').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({items:[{category_id:'category-1',name:'微单相机'}]})} as ReturnType<typeof publicationApi.catalogCategories>);
 await call('onShow');
 expect(page.data).toMatchObject({type:'',typeIndex:0,typePickerOptions:[{name:'请选择设备类型'},{category_id:'category-1',name:'微单相机'}]});
 call('chooseType',{detail:{value:'0'}});expect(page.data.productTypeFilter).toBe('');
 call('chooseType',{detail:{value:'1'}});
 expect(page.data).toMatchObject({type:'微单相机',typeIndex:1,productTypeFilter:'category-1'});
});
test('wrong-category product response fails closed without offering a stale product',async()=>{
 await call('onShow');
 const catalog=vi.spyOn(publicationApi,'catalogProducts').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({items:[{...catalogProduct,category_id:'category-2',category_name:'镜头'}],page:{page_size:50,has_more:false}})} as ReturnType<typeof publicationApi.catalogProducts>);
 call('openProductSheet');await tick();
 expect(page.data.catalogError).toContain('类型不一致');expect(page.data.productList).toEqual([]);
 catalog.mockRestore();
});
test('accepts canonical UTC RFC3339 seconds with an optional fractional part',async()=>{
 server.asset.available_from='2024-02-29T00:00:00.123456Z';server.asset.available_until='2024-03-01T00:00:00Z';await call('onShow');
 expect(page.data.errorText).toBe('');expect(page.data.availabilityStart).toBe('2024-02-29');expect(wires).toHaveLength(1);
});
test('save retains hidden fields and reads server facts after guarded POST',async()=>{
 await call('onShow');const original=structuredClone(server.asset);
 input('displayName','新名称');input('expectedRent','12.34');input('expectedDeposit','0.01');input('notes','新瑕疵');
 await call('saveDraft');
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET']);const write=wires[1]!;
 expect(write.url).toContain('/v1/me/asset-drafts/draft-owned/updates');expect(write.header['If-Match']).toBe('"v9"');expect(write.header['Idempotency-Key']).toMatch(/^draft-update:/);
 expect(write.data).toEqual({asset:{...original,display_name:'新名称',unit_price_fen:'1234',deposit_fen:'1',defect_description:'新瑕疵'}});
 expect(page.data).toMatchObject({displayName:'新名称',expectedRent:'12.34',expectedDeposit:'0.01',submitting:false,pendingSave:false,canSubmit:true});
 expect(showModal).not.toHaveBeenCalled();
 expect(page.data.draftNoticeText).toContain('已回读');expect(storageWrite).not.toHaveBeenCalled();
});
test('save accepts JSON object key reordering',async()=>{
 await call('onShow');input('displayName','重排回读');reorderedReadback=true;
 await call('saveDraft');
 expect(page.data).toMatchObject({pendingSave:false,errorText:'',displayName:'重排回读'});
});
test('save still rejects a changed field in the readback',async()=>{
 await call('onShow');input('displayName','本次保存');changedReadback=true;
 await call('saveDraft');
 expect(page.data.pendingSave).toBe(true);
 expect(page.data.errorText).toContain('回读与本次保存字段或版本不一致');
});
test('server field rejection on save explains the reason in a modal and releases the rejected intent',async()=>{
 await call('onShow');input('displayName','待校验名称');writeStatus=422;
 await call('saveDraft');
 expect(wires.filter(w=>w.method==='POST')).toHaveLength(1);
 expect(page.data.pendingSave).toBe(false);
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'草稿字段未通过校验',content:expect.stringContaining('服务器拒绝操作')}));
});
test('duplicate clicks share one write until readback completes',async()=>{
 await call('onShow');input('displayName','同一修改');deferred=true;
 const first=call('saveDraft');const second=call('saveDraft');await tick();expect(wires).toHaveLength(2);
 defaultReply(wires[1]!);await tick();expect(wires).toHaveLength(3);defaultReply(wires[2]!);await first;await second;expect(wires.filter(w=>w.method==='POST')).toHaveLength(1);
});
test('unknown outcome retains exact original body and key, blocks new editing, no automatic retry',async()=>{
 await call('onShow');input('description','原保存内容');writeStatus=0;await call('saveDraft');
 expect(wires).toHaveLength(2);expect(page.data.pendingSave).toBe(true);const original=wires[1]!;
 input('description','不得覆盖未知操作');expect(page.data.description).toBe('原保存内容');
 writeStatus=200;await call('saveDraft');
 expect(wires[2]?.data).toEqual(original.data);expect(wires[2]?.header['If-Match']).toBe(original.header['If-Match']);expect(wires[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','POST','GET']);expect(page.data.pendingSave).toBe(false);
});
test.each([409,412,422])('business failure %s neither auto-retries nor pretends save success',async status=>{
 await call('onShow');input('description','未保存');writeStatus=status;await call('saveDraft');
 expect(wires).toHaveLength(2);expect(page.data).toMatchObject({description:'未保存',submitting:false,pendingSave:false});expect(page.data.errorText).toBeTruthy();expect(page.data.draftNoticeText).not.toContain('保存已确认');
});
test('readback failure retains the original save intent until exact retry and readback',async()=>{
 await call('onShow');input('description','保存内容');readStatus=503;await call('saveDraft');
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET']);expect(page.data.errorText).toBeTruthy();expect(page.data.draftId).toBe('draft-owned');expect(page.data.pendingSave).toBe(true);
 readStatus=200;await call('saveDraft');expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);
 expect(wires[3]?.header['Idempotency-Key']).toBe(wires[1]?.header['Idempotency-Key']);
 expect(wires[3]?.data).toEqual(wires[1]?.data);expect(page.data.description).toBe('保存内容');expect(page.data.pendingSave).toBe(false);
});
test.each(['SUBMITTED','ARCHIVED'] as const)('%s draft is read-only and cannot save or submit',async status=>{
 server.status=status;await call('onShow');input('displayName','伪修改');await call('saveDraft');call('submit');
 expect(page.data.editable).toBe(false);expect(page.data.displayName).toBe('服务器相机');expect(wires).toHaveLength(1);expect(page.data.canSubmit).toBe(false);
});
test('EDIT locks physical identity while retaining current saved identifier',async()=>{
 server.origin_kind='EDIT';server.base_version='17';await call('onShow');input('serialNumber','new-serial');input('description','允许说明');await call('saveDraft');
 expect((wires[1]?.data as {asset:{identifier_value:string}}).asset.identifier_value).toBe('serial-original');expect(page.data.identityLocked).toBe(true);
});
test('explicit read-only route cannot edit even an EDITING draft',async()=>{
 call('onUnload');call('onLoad',{draft_id:'draft-owned',mode:'view'});await call('onShow');input('notes','bad');await call('saveDraft');expect(wires).toHaveLength(1);expect(page.data.editable).toBe(false);
});
test('guest or missing actual draft id never reads Mock drafts or creates without an explicit click',async()=>{
 owner=null;await call('onShow');expect(wires).toHaveLength(0);call('openLogin');expect(navigateTo).toHaveBeenCalled();
 owner='owner-a';call('onUnload');call('onLoad',{});await call('onShow');await call('saveDraft');await call('submit');expect(wires).toHaveLength(0);expect(page.data).toMatchObject({loggedIn:true,pendingCreate:false,draftId:''});
});
test('explicit new draft persists fixed empty command before POST and paints only after authoritative GET',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');expect(wires).toHaveLength(0);
 await call('createDraft');expect(wires.map(w=>w.method)).toEqual(['POST','GET']);
 expect(wires[0]?.data).toEqual({asset:{}});expect(wires[0]?.header['Idempotency-Key']).toMatch(/^publication-create:/);
 expect(storageWrite).toHaveBeenCalled();expect([...storage.keys()].filter(key=>key.includes('publication-intent'))).toHaveLength(0);
 expect(page.data).toMatchObject({draftId:'draft-new',editable:true,mode:'draft',pendingCreate:false,canSubmit:true,errorText:''});expect(page.data.draftNoticeText).toContain('已回读');
});
test('first entry shows the type picker, keeps selection local, and creates only on explicit click',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 expect(wxml).toContain('<view wx:elif="{{!draftId}}" class="publish-content publish-preflight">');
 expect(wxml).toContain('disabled="{{submitting || pendingCreate || typeLoading || types.length === 0}}" bindchange="chooseType"');
 expect(page.data).toMatchObject({draftId:'',type:'',typeIndex:0,types:[{category_id:'category-1',name:'微单相机'},{category_id:'category-2',name:'镜头'}]});
 expect(wires).toHaveLength(0);
 call('chooseType',{detail:{value:'1'}});
 expect(page.data).toMatchObject({type:'微单相机',typeIndex:1,productTypeFilter:'category-1'});
 expect(wires).toHaveLength(0);
 await call('createDraft');
 expect(wires.map(w=>w.method)).toEqual(['POST','GET']);
 expect(page.data).toMatchObject({draftId:'draft-new',editable:true,type:'微单相机',productTypeFilter:'category-1'});
});
test('failed intent persistence dispatches neither CREATE nor SUBMIT',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');storageFailure=true;await call('createDraft');expect(wires).toHaveLength(0);expect(page.data.pendingCreate).toBe(true);
 storageFailure=false;call('onUnload');page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p)}};call('onLoad',{draft_id:'draft-owned'});await call('onShow');
 storageFailure=true;await call('submit');expect(wires).toHaveLength(1);expect(wires[0]?.method).toBe('GET');expect(page.data.pendingSubmit).toBe(true);
});
test('duplicate new-draft clicks share one command and empty draft cannot submit',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');deferred=true;
 const createOne=call('createDraft');const createTwo=call('createDraft');await tick();expect(wires).toHaveLength(1);defaultReply(wires[0]!);await tick();expect(wires).toHaveLength(2);defaultReply(wires[1]!);await createOne;await createTwo;
 expect(wires.filter(w=>/\/v1\/me\/asset-drafts$/.test(w.url))).toHaveLength(1);
 await call('submit');expect(wires).toHaveLength(2);expect((page.data.missingFields as string[]).length).toBeGreaterThan(0);
 expect(page.data.missingMedia).toBe(true);
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'资料尚未填写完整',content:expect.stringContaining('标准商品')}));
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 expect(wxml).toContain('id="publish-media"');expect(wxml).toContain('bindtap="jumpToMedia"');
 expect(wxml).toContain('第一张 READY 图片会自动成为封面');
 expect(wxml).not.toContain('bindtap="makeCover"');expect(wxml).not.toContain('刷新发布规则与价格建议');
 expect(wxml).toContain('disabled="{{submitting || (mode === \'view\' && !pendingSubmit)}}"');
 expect(wxml).toContain('<status-view wx:elif="{{errorText && !draftId}}"');
 expect(wxml).toContain('<view wx:if="{{draftId}}" class="publish-content">');
});
test('duplicate complete-draft submission clicks share one command through readback',async()=>{
 await call('onShow');deferred=true;
 const submitOne=call('submit');const submitTwo=call('submit');await tick();expect(wires).toHaveLength(2);defaultReply(wires[1]!);await tick();expect(wires).toHaveLength(3);defaultReply(wires[2]!);await submitOne;await submitTwo;
 expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(1);expect(page.data.mode).toBe('view');
});
test('unknown new-draft outcome keeps the exact command across hide and retries only after an explicit click',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');deferred=true;
 const old=call('createDraft');await tick();const original=wires[0]!;call('onHide');send(original,{kind:'DRAFT',id:'draft-new',status:'EDITING',version:'1'});await old;
 expect(page.data.draftId).toBe('');expect([...storage.keys()].some(key=>key.endsWith(':create'))).toBe(true);
 deferred=false;await call('onShow');expect(wires).toHaveLength(1);expect(page.data.pendingCreate).toBe(true);await call('createDraft');
 expect(wires.map(w=>w.method)).toEqual(['POST','POST','GET']);expect(wires[1]?.data).toEqual(original.data);expect(wires[1]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
 expect(page.data.draftId).toBe('draft-new');
});
test('unknown new-draft outcome survives unload and reuses the original command in a new page instance',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');deferred=true;
 const old=call('createDraft');await tick();const original=wires[0]!;call('onUnload');send(original,{kind:'DRAFT',id:'draft-new',status:'EDITING',version:'1'});await old;
 page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p)}};call('onLoad',{});deferred=false;await call('onShow');
 expect(page.data.pendingCreate).toBe(true);await call('createDraft');expect(wires.map(w=>w.method)).toEqual(['POST','POST','GET']);
 expect(wires[1]?.data).toEqual(original.data);expect(wires[1]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
});
test('closed CREATE receipt rejects additional members and preserves the original request',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');deferred=true;const pending=call('createDraft');await tick();
 send(wires[0]!,{kind:'DRAFT',id:'draft-new',status:'EDITING',version:'1',unexpected:true});await pending;
 expect(wires).toHaveLength(1);expect(page.data.pendingCreate).toBe(true);expect([...storage.keys()].some(key=>key.endsWith(':create'))).toBe(true);
});
test('clean EDITING draft submits strict empty body and claims success only after receipt-bound GET',async()=>{
 await call('onShow');await call('submit');expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET']);
 expect(showModal).not.toHaveBeenCalled();
 const write=wires[1]!;expect(write.url).toContain('/submissions');expect(write.data).toEqual({});expect(write.header['If-Match']).toBe('"v9"');expect(write.header['Idempotency-Key']).toMatch(/^publication-submit:/);
 expect(page.data).toMatchObject({mode:'view',editable:false,canSubmit:false,pendingSubmit:false,draftId:'draft-owned'});expect(page.data.draftNoticeText).toContain('已回读');
 expect([...storage.keys()].filter(key=>key.includes('publication-intent'))).toHaveLength(0);
});
test('one click saves and reads dirty fields before submitting the readback version',async()=>{
 await call('onShow');input('description','未手动保存也能提交');await call('submit');
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);
 expect(wires[1]?.url).not.toContain('/submissions');expect(wires[1]?.header['If-Match']).toBe('"v9"');
 expect(wires[3]?.url).toContain('/submissions');expect(wires[3]?.header['If-Match']).toBe('"v10"');
 expect(server.status).toBe('SUBMITTED');expect(server.version).toBe('11');expect(server.asset.description).toBe('未手动保存也能提交');
 expect(page.data).toMatchObject({mode:'view',pendingSubmit:false});expect(showModal).not.toHaveBeenCalled();
});
test('two rapid submit taps with dirty fields create one save and one submission',async()=>{
 await call('onShow');input('description','同一点击事务');deferred=true;
 const first=call('submit');const second=call('submit');await tick();expect(wires.map(w=>w.method)).toEqual(['GET','POST']);
 defaultReply(wires[1]!);await tick();expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET']);
 defaultReply(wires[2]!);await tick();expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST']);
 defaultReply(wires[3]!);await tick();expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);
 defaultReply(wires[4]!);await first;await second;
 expect(wires.filter(w=>w.method==='POST'&&!w.url.includes('/submissions'))).toHaveLength(1);
 expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(1);
 expect(page.data.mode).toBe('view');
});
test('first image is automatically cover after legacy readback, reorder and deleting the lead image',async()=>{
 server.asset.media=[{material_id:'photo-a',role:'IMAGE',sort_order:0},{material_id:'photo-b',role:'COVER',sort_order:1}];
 await call('onShow');expect(page.data.coverIndex).toBe(0);
 await call('saveDraft');expect((wires[1]!.data as {asset:AssetDraft['asset']}).asset.media).toEqual([{material_id:'photo-a',role:'COVER',sort_order:0},{material_id:'photo-b',role:'IMAGE',sort_order:1}]);
 call('moveMedia',{currentTarget:{dataset:{kind:'photo',index:1,direction:-1}}});expect(page.data.coverIndex).toBe(0);
 await call('saveDraft');expect((wires[3]!.data as {asset:AssetDraft['asset']}).asset.media).toEqual([{material_id:'photo-b',role:'COVER',sort_order:0},{material_id:'photo-a',role:'IMAGE',sort_order:1}]);
 call('deleteMedia',{currentTarget:{dataset:{kind:'photo',index:0}}});expect(page.data.coverIndex).toBe(0);
 await call('saveDraft');expect((wires[5]!.data as {asset:AssetDraft['asset']}).asset.media).toEqual([{material_id:'photo-a',role:'COVER',sort_order:0}]);
});
test('first READY upload becomes cover without an extra selection step',async()=>{
 server.asset.media=[];
 vi.stubGlobal('wx',{...wx,chooseMedia:({success}:{success:(value:unknown)=>void})=>success({type:'image',tempFiles:[{tempFilePath:'wxfile://first-photo.png',fileType:'image'}]})});
 vi.spyOn(publicationApi,'uploadAssetMedia').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({material_id:'new-photo',upload_id:'new-upload',status:'READY',public_url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/new-photo',playback_url:null,mime_type:'image/png',size_bytes:1024,metadata:{schema_version:1,width:100,height:80,duration_ms:null,video_codec:null,audio_codec:null},poster:null})} as ReturnType<typeof publicationApi.uploadAssetMedia>);
 const managed=vi.spyOn(publicationApi,'material');
 await call('onShow');await call('selectImage',{currentTarget:{dataset:{kind:'photo'}}});
 expect(page.data).toMatchObject({coverIndex:0,mediaItemsCount:1,missingMedia:false});
 expect(managed).not.toHaveBeenCalled();
 await call('saveDraft');expect((wires[1]!.data as {asset:AssetDraft['asset']}).asset.media).toEqual([{material_id:'new-photo',role:'COVER',sort_order:0}]);
});
test('missing READY photo points to the media card and never writes a submission',async()=>{
 server.asset.media=[];const pageScrollTo=vi.fn();vi.stubGlobal('wx',{...wx,pageScrollTo});
 await call('onShow');await call('submit');
 expect(wires.map(w=>w.method)).toEqual(['GET']);
 expect(page.data).toMatchObject({missingMedia:true,canSubmit:false});
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'资料尚未填写完整',content:expect.stringContaining('设备图片：至少 1 张已处理完成')}));
 call('jumpToMedia');expect(pageScrollTo).toHaveBeenCalledWith({selector:'#publish-media',duration:300});
});
test('submit automatically retries missing current-product rules without a manual refresh control',async()=>{
 const admission=vi.spyOn(publicationApi,'eligibility').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({eligible:true,eligibility_rule_version_id:'eligibility-rule'})} as unknown as ReturnType<typeof publicationApi.eligibility>);
 const value={product_id:'product-available',rental_unit:'DAY',rule_version_id:'published-rule',eligibility_rule_version_id:'eligibility-rule',read_at:'2026-09-25T00:00:00Z',pricing_guidance:null};
 const context=vi.spyOn(publicationApi,'publicationContext')
  .mockImplementationOnce(()=>({abort:vi.fn(),promise:Promise.reject(new Error('首次暂不可用'))} as ReturnType<typeof publicationApi.publicationContext>))
  .mockReturnValueOnce({abort:vi.fn(),promise:Promise.resolve(value)} as ReturnType<typeof publicationApi.publicationContext>);
 await call('onShow');await call('openProductSheet');await tick();call('selectProductFromSheet',{currentTarget:{dataset:{id:'product-available'}}});await tick();
 expect(page.data.guidanceText).toContain('点击提交时会自动重试');
 await call('submit');expect(context).toHaveBeenCalledTimes(2);
 expect(wires.filter(w=>w.method==='POST'&&!w.url.includes('/submissions'))).toHaveLength(1);
 expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(1);
 expect(server.asset.product_id).toBe('product-available');expect(page.data.mode).toBe('view');
 admission.mockRestore();context.mockRestore();
});
test('a saved product missing its rule is recovered during submit instead of exposing a refresh button',async()=>{
 delete server.asset.rule_version_id;delete server.asset.eligibility_rule_version_id;
 vi.spyOn(publicationApi,'eligibility').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({eligible:true,eligibility_rule_version_id:'eligibility-rule'})} as unknown as ReturnType<typeof publicationApi.eligibility>);
 const context=vi.spyOn(publicationApi,'publicationContext').mockReturnValue({abort:vi.fn(),promise:Promise.resolve({product_id:'catalog-owned',rental_unit:'DAY',rule_version_id:'published-rule',eligibility_rule_version_id:'eligibility-rule',read_at:'2026-09-25T00:00:00Z',pricing_guidance:null})} as ReturnType<typeof publicationApi.publicationContext>);
 await call('onShow');await call('submit');
 expect(context).toHaveBeenCalledTimes(1);expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);
 expect(server.asset).toMatchObject({rule_version_id:'published-rule',eligibility_rule_version_id:'eligibility-rule'});
 expect(page.data.mode).toBe('view');
});
test('unknown autosave stops before submission and preserves its exact retry intent',async()=>{
 await call('onShow');input('description','保存超时');writeStatus=0;await call('submit');
 expect(wires.map(w=>w.method)).toEqual(['GET','POST']);expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(0);
 expect(page.data.pendingSave).toBe(true);expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'保存结果未确认'}));
 const original=wires[1]!;writeStatus=200;await call('saveDraft');expect(wires[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
 expect(wires[2]?.data).toEqual(original.data);expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(0);
});
test('leaving during automatic save cannot dispatch a hidden submission',async()=>{
 await call('onShow');input('description','离页时停止');deferred=true;
 const pending=call('submit');await tick();expect(wires.map(w=>w.method)).toEqual(['GET','POST']);
 call('onHide');defaultReply(wires[1]!);await pending;
 expect(wires.filter(w=>w.url.includes('/submissions'))).toHaveLength(0);
 deferred=false;await call('onShow');expect(page.data.pendingSave).toBe(true);
});
test('submission timeout keeps durable original version, body and key for explicit retry',async()=>{
 await call('onShow');writeStatus=0;await call('submit');expect(page.data).toMatchObject({pendingSubmit:true,canSubmit:true,mode:'draft'});const original=wires[1]!;
 writeStatus=200;await call('submit');expect(wires.map(w=>w.method)).toEqual(['GET','POST','POST','GET']);
 expect(wires[2]?.data).toEqual(original.data);expect(wires[2]?.header['If-Match']).toBe(original.header['If-Match']);expect(wires[2]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
 expect(page.data).toMatchObject({pendingSubmit:false,mode:'view'});
});
test('explicit submission rejection releases only that verified intent and permits correction',async()=>{
 await call('onShow');writeStatus=422;await call('submit');expect(page.data).toMatchObject({pendingSubmit:false,canSubmit:true,mode:'draft'});expect(page.data.errorText).toContain('服务器拒绝操作');
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'提交审核未通过',content:expect.stringContaining('服务器拒绝操作')}));
 expect([...storage.keys()].filter(key=>key.includes('publication-intent'))).toHaveLength(0);input('description','补充资料');expect(page.data.description).toBe('补充资料');expect(page.data.canSubmit).toBe(true);
});
test('late submission receipt after hide neither paints nor releases the original request',async()=>{
 await call('onShow');deferred=true;const old=call('submit');await tick();const original=wires[1]!;call('onHide');
 send(original,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned'});await old;
 expect(page.data).toMatchObject({draftId:'',pendingSubmit:false});expect([...storage.keys()].some(key=>key.includes(':submit:'))).toBe(true);
 deferred=false;server={...server,status:'SUBMITTED',version:'10',asset_id:'asset-owned',committed_revision_id:'revision-owned'};await call('onShow');expect(page.data.pendingSubmit).toBe(true);
 await call('submit');expect(wires[3]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);expect(wires[3]?.header['If-Match']).toBe(original.header['If-Match']);expect(page.data.pendingSubmit).toBe(false);
});
test('unknown submission survives unload and reuses the original version, body and key',async()=>{
 await call('onShow');deferred=true;const old=call('submit');await tick();const original=wires[1]!;call('onUnload');
 send(original,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned'});await old;
 page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p)}};call('onLoad',{draft_id:'draft-owned'});deferred=false;await call('onShow');expect(page.data.pendingSubmit).toBe(true);
 await call('submit');expect(wires[3]?.data).toEqual(original.data);expect(wires[3]?.header['If-Match']).toBe(original.header['If-Match']);expect(wires[3]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
 expect(page.data.pendingSubmit).toBe(false);
});
test('closed SUBMIT receipt rejects additional members without GET or release',async()=>{
 await call('onShow');deferred=true;const pending=call('submit');await tick();
 send(wires[1]!,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned',unexpected:true});await pending;
 expect(wires).toHaveLength(2);expect(page.data.pendingSubmit).toBe(true);expect([...storage.keys()].some(key=>key.includes(':submit:'))).toBe(true);
});
test('invalid nested submission GET remains located and cannot release or paint success',async()=>{
 await call('onShow');deferred=true;const pending=call('submit');await tick();
 send(wires[1]!,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned'});await tick();
 const invalid=fixture() as AssetDraft&{asset:AssetDraft['asset']&{unexpected?:boolean}};invalid.status='SUBMITTED';invalid.version='10';invalid.asset_id='asset-owned';invalid.committed_revision_id='revision-owned';invalid.asset.unexpected=true;
 send(wires[2]!,invalid);await pending;
 expect(page.data.pendingSubmit).toBe(true);expect(page.data.mode).toBe('draft');expect(page.data.draftNoticeText).not.toContain('提交审核已确认');expect([...storage.keys()].some(key=>key.includes(':submit:'))).toBe(true);
});
test.each(['2024-01-01Z','2024-02-30T00:00:00Z','2024-01-01T00:00Z','2024-01-01T24:00:00Z'])('noncanonical draft time %s cannot release a located submission intent',async value=>{
 await call('onShow');deferred=true;const pending=call('submit');await tick();
 send(wires[1]!,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned'});await tick();
 const invalid=fixture();invalid.status='SUBMITTED';invalid.version='10';invalid.asset_id='asset-owned';invalid.committed_revision_id='revision-owned';invalid.asset.available_from=value;
 send(wires[2]!,invalid);await pending;
 expect(page.data.pendingSubmit).toBe(true);expect(page.data.mode).toBe('draft');expect([...storage.keys()].some(key=>key.includes(':submit:'))).toBe(true);
});
test('noncanonical CREATE readback time preserves the located original intent',async()=>{
 call('onUnload');call('onLoad',{});await call('onShow');deferred=true;const pending=call('createDraft');await tick();
 send(wires[0]!,{kind:'DRAFT',id:'draft-new',status:'EDITING',version:'1'});await tick();
 send(wires[1]!,{draft_id:'draft-new',status:'EDITING',origin_kind:'CREATE',base_version:null,version:'1',asset_id:null,committed_revision_id:null,asset:{available_from:'2024-02-30T00:00:00Z'}});await pending;
 expect(page.data.pendingCreate).toBe(true);expect(page.data.draftId).toBe('');expect([...storage.keys()].some(key=>key.endsWith(':create'))).toBe(true);
});
test('invalid submission receipt or mismatched readback remains pending and cannot claim review submission',async()=>{
 await call('onShow');deferred=true;let pending=call('submit');await tick();send(wires[1]!,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:''});await pending;
 expect(page.data.pendingSubmit).toBe(true);expect(page.data.errorText).toContain('回执无效');expect(wires).toHaveLength(2);
 call('onHide');deferred=false;await call('onShow');deferred=true;pending=call('submit');await tick();send(wires[3]!,{kind:'DRAFT',id:'draft-owned',status:'SUBMITTED',version:'10',asset_id:'asset-owned',revision_id:'revision-owned'});await tick();
 const wrong=fixture();wrong.status='SUBMITTED';wrong.version='10';wrong.asset_id='asset-other';wrong.committed_revision_id='revision-owned';send(wires[4]!,wrong);await pending;
 expect(page.data.pendingSubmit).toBe(true);expect(page.data.errorText).toContain('回读与原请求不一致');expect(page.data.mode).toBe('draft');
});
test('wrong draft response and 404 fail closed',async()=>{
 server.draft_id='foreign';await call('onShow');expect(page.data.errorText).toContain('不一致');expect(page.data.displayName).toBe('');expect(page.data.editable).toBe(false);
 readStatus=404;await call('reloadDraft');expect(page.data.errorText).toBeTruthy();expect(page.data.draftId).toBe('');
});
test('hidden page clears private projection, aborts old reads and ignores late result',async()=>{
 deferred=true;const pending=call('onShow');await tick();call('onHide');expect(abort).toHaveBeenCalledOnce();defaultReply(wires[0]!);await pending;
 expect(page.data).toMatchObject({displayName:'',location:'',serialNumber:'',description:'',editable:false});expect(wires).toHaveLength(1);expect(storageWrite).not.toHaveBeenCalled();
});
test('old owner response cannot overwrite or clear a newly shown owner page',async()=>{
 deferred=true;const old=call('onShow');await tick();owner='owner-b';const next=call('onShow');await tick();
 const fresh=fixture();fresh.asset.display_name='账号B草稿';send(wires[1]!,fresh);await next;send(wires[0]!,fixture());await old;
 expect(page.data.displayName).toBe('账号B草稿');expect(page.data.loggedIn).toBe(true);
});
test('401 on mutation clears private state and performs no readback',async()=>{
 await call('onShow');input('displayName','未确认');writeStatus=401;await call('saveDraft');expect(owner).toBeNull();expect(wires).toHaveLength(2);expect(page.data.displayName).toBe('');expect(page.data.loggedIn).toBe(false);
});
test('unsupported controls, forged fields and hide never manufacture a command or update hidden data',async()=>{
 await call('onShow');input('location','伪造定位');input('product_id','mock-product');input('__proto__','bad');
 for(const event of ['chooseType','clearDraft','submit'])call(event);
 call('onHide');call('onUnload');expect(wires).toHaveLength(1);expect(server.asset.product_id).toBe('catalog-owned');expect(storageWrite).not.toHaveBeenCalled();
});
test.each(['1.001','01','-1','1e2','92233720368547758.08'])('invalid monetary input %s cannot dispatch',async value=>{
 await call('onShow');input('expectedRent',value);await call('saveDraft');expect(wires).toHaveLength(1);expect(page.data.errorText).toBeTruthy();expect(page.data.submitting).toBe(false);
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'无法保存草稿'}));
});
test('pure draft patch preserves branches and does not apply Mock pricing or date limits',()=>{
 expect(draftMoneyInput('92233720368547758.07')).toBe('9223372036854775807');expect(draftMoneyInput('0.01')).toBe('1');
 const a=fixture().asset;const updated=applyDraftChanges(a,{description:'',expectedRent:'1.25'},false);
 expect(updated).not.toHaveProperty('description');expect(updated.unit_price_fen).toBe('125');expect(updated.publication_location).toEqual(a.publication_location);expect(updated.media).toEqual(a.media);expect(a.description).toBe('原说明');
 expect(()=>applyDraftChanges(a,{serialNumber:'other'},true)).toThrow();
});
test('team page structure remains while current controller has no Mock, cached private draft or hidden write',()=>{
 const ts=readFileSync(new URL('../miniprogram/pages/publish/index.ts',import.meta.url),'utf8');
 const wxml=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 for(const token of ['mockApi','shared/fixture','persistDraft','completeGrowthTask','chooseAndSaveMedia','setStorageSync'])expect(ts).not.toContain(token);
 for(const cls of ['publish-page','media-card','core-card','pricing-card','disclosure-card','review-card','publish-bottom','publish-sheet'])expect(wxml).toContain(cls);
 expect(wxml).toContain('bindtap="saveDraft"');expect(wxml).toContain('identityLocked');expect(wxml).toContain('bindaction="handleErrorAction"');expect(wxml).toContain("hasDraftTarget ? '重新读取草稿'");expect(wxml).toContain('bindtap="createDraft"');
});

test('hidden unknown write is retried with the same intent after a fresh read, without hidden autosave',async()=>{
 await call('onShow');input('description','隐藏前原保存');deferred=true;
 const old=call('saveDraft');await tick();const original=wires[1]!;
 call('onHide');send(original,{kind:'DRAFT',status:'EDITING',id:'draft-owned',version:'10'});await old;
 expect(page.data.description).toBe('');expect(wires).toHaveLength(2);expect(abort).toHaveBeenCalled();
 deferred=false;await call('onShow');expect(page.data.pendingSave).toBe(true);
 input('description','不能替换原意图');await call('saveDraft');
 expect(wires[3]?.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);expect(wires[3]?.data).toEqual(original.data);
 expect(wires.map(w=>w.method)).toEqual(['GET','POST','GET','POST','GET']);expect(storageWrite).not.toHaveBeenCalled();
});
test('invalid successful receipt remains unknown and cannot claim saved or submitted',async()=>{
 await call('onShow');input('description','原请求');deferred=true;const pending=call('saveDraft');await tick();
 send(wires[1]!,{kind:'DRAFT',status:'SUBMITTED',id:'foreign',version:'10'});await pending;
 expect(page.data.pendingSave).toBe(true);expect(page.data.errorText).toContain('回执无效');expect(wires).toHaveLength(2);expect(page.data.canSubmit).toBe(false);
});
test('existing HOUR pricing stays intact while free-text condition is saved verbatim',async()=>{
 server.asset.rental_unit='HOUR';await call('onShow');expect(page.data.priceUnitLabel).toBe('小时租金');
 input('condition','镜头外壳有轻微划痕');input('expectedRent','0.25');await call('saveDraft');
 expect((wires[1]!.data as {asset:unknown}).asset).toMatchObject({rental_unit:'HOUR',condition:'镜头外壳有轻微划痕',unit_price_fen:'25'});
 expect(page.data.condition).toBe('镜头外壳有轻微划痕');
});
test('unchanged fields issue no save and back closes a sheet before navigating',async()=>{
 await call('onShow');await call('saveDraft');expect(wires).toHaveLength(1);
 call('openSheet',{currentTarget:{dataset:{sheet:'details'}}});expect(page.data.activeSheet).toBe('details');
 call('handleNavigationBack');expect(page.data.activeSheet).toBe('');
 call('openSheet',{currentTarget:{dataset:{sheet:'pricing'}}});expect(page.data.activeSheet).toBe('pricing');
});
test('personal price, minimum term and inclusive Shanghai dates round-trip without floating money',()=>{
 const source=fixture().asset;
 const asset=applyDraftChanges(source,{condition:'实际成色九成新',minimumUnits:'3',referenceValue:'1260.05',availabilityStart:'2026-10-01',availabilityEnd:'2026-10-03'},false);
 expect(asset).toMatchObject({condition:'实际成色九成新',minimum_units:'3',reference_value_fen:'126005',available_from:'2026-09-30T16:00:00.000Z',available_until:'2026-10-03T16:00:00.000Z',timezone:'Asia/Shanghai'});
 const view=publicationDraftView({draft_id:'draft-owned',version:'9',origin_kind:'CREATE',status:'EDITING',asset});
 expect(view).toMatchObject({condition:'实际成色九成新',minimumUnits:'3',referenceValue:'1260.05',availabilityStart:'2026-10-01',availabilityEnd:'2026-10-03'});
 expect(()=>applyDraftChanges(source,{minimumUnits:'0'},false)).toThrow();
 expect(()=>applyDraftChanges(source,{availabilityEnd:'2026-02-30'},false)).toThrow();
});
test('IMEI is checked with the same 15-digit Luhn rule before saving or submitting',async()=>{
 expect(publicationIdentifierIssue('IMEI','1234567890',true)).toBe('IMEI 须为 15 位数字');
 expect(publicationIdentifierIssue('IMEI','490154203237517',true)).toContain('校验位');
 expect(publicationIdentifierIssue('IMEI','490154203237518',true)).toBeUndefined();
 expect(()=>applyDraftChanges(fixture().asset,{identifierType:'IMEI',serialNumber:'1234567890'},false)).toThrow('IMEI 须为 15 位数字');
 server.asset={...server.asset,identifier_type:'IMEI',identifier_value:'1234567890'};
 await call('onShow');await call('submit');
 expect(wires).toHaveLength(1);
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'资料尚未填写完整',content:expect.stringContaining('IMEI 须为 15 位数字')}));
});
test('invalid filled IMEI is rejected before draft save and explains the correction',async()=>{
 await call('onShow');call('changeIdentifierType',{detail:{value:'1'}});input('serialNumber','1234567890');await call('saveDraft');
 expect(wires).toHaveLength(1);
 expect(showModal).toHaveBeenCalledWith(expect.objectContaining({title:'无法保存草稿',content:expect.stringContaining('IMEI 须为 15 位数字')}));
});
test('personal delivery may omit an address but requires explicit fees in both directions',()=>{
 const selected=[{id:'express' as const,label:'快递配送',selected:true,outbound:'TENANT' as const,return:'LESSOR' as const}];
 const asset=bindDeliveryOptions(fixture().asset,selected,'addr-owned');
 expect(asset.delivery_options).toEqual([{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR',source_address_id:'addr-owned'}]);
 expect(bindDeliveryOptions(fixture().asset,selected,'').delivery_options).toEqual([{method:'EXPRESS',outbound_fee_payer:'TENANT',return_fee_payer:'LESSOR'}]);
 expect(()=>bindDeliveryOptions({},[{...selected[0]!,return:''}], 'addr-owned')).toThrow();
});
test('asset media keeps only READY material identities and explicit cover ordering in draft payload',()=>{
 const asset=bindAssetMedia(fixture().asset,[{material_id:'photo-a',role:'IMAGE',sort_order:5},{material_id:'photo-b',role:'COVER',sort_order:9},{material_id:'video-c',role:'VIDEO',sort_order:11}]);
 expect(asset.media).toEqual([{material_id:'photo-a',role:'IMAGE',sort_order:0},{material_id:'photo-b',role:'COVER',sort_order:1},{material_id:'video-c',role:'VIDEO',sort_order:2}]);
 expect(JSON.stringify(asset.media)).not.toContain('wxfile://');
 expect(()=>bindAssetMedia(fixture().asset,[{material_id:'photo-a',role:'IMAGE',sort_order:0},{material_id:'photo-a',role:'VIDEO',sort_order:1}])).toThrow();
});
test('unknown own-address creation reuses the exact persisted intent after page re-entry',()=>{
 const body={dataset_id:'ds',province_id:'p',city_id:'c',district_id:'d',detail_address:'测试路1号',recipient_name:'本人',phone_country_code:'+86',phone:'13900000000',is_default:false,location:null};
 const original=preparePublicationAddressIntent('owner-a','draft-owned',body,'测试地址');
 const resumed=preparePublicationAddressIntent('owner-a','draft-owned',{...body,detail_address:'新地址'},'新地址');
 expect(resumed).toEqual(original);
 expect(readPublicationAddressIntent('owner-a','draft-owned')).toEqual(original);
 releasePublicationAddressIntent(original);
 expect(readPublicationAddressIntent('owner-a','draft-owned')).toBeNull();
});

test('catalog and asset video render failures retry identical sources and own posters without requests',async()=>{
 await call('onShow');input('displayName','保留输入');
 // Rendering fixtures only: this test does not assert upload, READY processing or business persistence.
 const catalog={url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-video',role:'VIDEO',playback:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-poster'};
 const asset={id:'original-video-id',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-poster'};
 page.setData({productMedia:[catalog],videoCards:[asset],hasPendingMedia:true});const requestCount=wires.length;const originalServer=structuredClone(server);const ticks:Array<()=>void>=[];
 vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});const epoch=page.data.mediaViewEpoch;
 const catalogEvent={currentTarget:{dataset:{kind:'catalog',key:catalog.url,src:catalog.playback,epoch}}};const assetEvent={currentTarget:{dataset:{kind:'asset',key:asset.id,src:asset.url,epoch}}};
 call('onVideoMediaError',{currentTarget:{dataset:{...assetEvent.currentTarget.dataset,src:asset.url+'-old'}}});expect(page.data.videoFailures).toEqual({});
 for(const event of [catalogEvent,assetEvent]){call('onVideoMediaError',event);call('retryVideoMedia',event);call('retryVideoMedia',event)}
 expect(ticks).toHaveLength(2);expect(page.data.videoFailures).toEqual({['catalog:'+catalog.url]:catalog.playback,['asset:'+asset.id]:asset.url});
 ticks.forEach(callback=>callback());expect(page.data.videoFailures).toEqual({});expect(page.data.videoReloading).toEqual({});
 expect(page.data).toMatchObject({productMedia:[catalog],videoCards:[asset],displayName:'保留输入',hasPendingMedia:true});expect(wires).toHaveLength(requestCount);expect(server).toEqual(originalServer);expect(navigateTo).not.toHaveBeenCalled();
 const markup=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');expect(markup).toContain('state="real" src="{{item.url}}" mode="aspectFill" failure-label="商品图片暂时无法加载"');
 expect(markup).toContain('src="{{item.playback}}" poster="{{item.poster}}" controls="true"');expect(markup).toContain('src="{{item.url}}" poster="{{item.poster}}" controls="true"');expect(markup.match(/<video\b[^>]*binderror="onVideoMediaError"/gu)).toHaveLength(2);expect(markup.match(/catchtap="retryVideoMedia"/gu)).toHaveLength(2);expect(markup).toContain('bindtap="previewMedia"');
 const style=readFileSync(new URL('../miniprogram/pages/publish/index.wxss',import.meta.url),'utf8');expect(style).toMatch(/\.product-media-item\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px;/u);expect(style).toMatch(/\.hero-card,[\s\S]*?\.hero-upload\s*\{[^}]*width:\s*152px;[^}]*height:\s*152px;/u);
});
test('video retry rejects stale epoch, changed source and a page hidden before remount',async()=>{
 await call('onShow');const video={id:'original-video-id',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-poster'};
 page.setData({videoCards:[video]});const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});const event={currentTarget:{dataset:{kind:'asset',key:video.id,src:video.url,epoch:page.data.mediaViewEpoch}}};
 call('onVideoMediaError',{currentTarget:{dataset:{...event.currentTarget.dataset,epoch:Number(page.data.mediaViewEpoch)-1}}});expect(page.data.videoFailures).toEqual({});
 call('onVideoMediaError',event);call('retryVideoMedia',event);page.setData({videoCards:[{...video,url:video.url+'-replacement'}]});const replaced=structuredClone(page.data);ticks.shift()!();expect(page.data).toEqual(replaced);
 call('onHide');const hidden=structuredClone(page.data);call('onVideoMediaError',event);call('retryVideoMedia',event);expect(page.data).toEqual(hidden);expect(ticks).toHaveLength(0);
 await call('onShow');page.setData({videoCards:[video]});const currentEvent={currentTarget:{dataset:{...event.currentTarget.dataset,epoch:page.data.mediaViewEpoch}}};call('onVideoMediaError',currentEvent);call('retryVideoMedia',currentEvent);call('onHide');owner='owner-b';await call('onShow');const changedOwner=structuredClone(page.data);ticks.shift()!();expect(page.data).toEqual(changedOwner);
});

test('visible own posters retry the same image and native video through existing media events without requests',async()=>{
 await call('onShow');page.setData({displayName:'封面重载保留输入',hasPendingMedia:true});
 const catalog={url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-video',role:'VIDEO',playback:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/catalog-own-poster'};
 const asset={id:'original-video-id',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-own-poster'};
 page.setData({productMedia:[catalog],videoCards:[asset]});const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});const requestCount=wires.length;const originalServer=structuredClone(server);
 const events=[{currentTarget:{dataset:{kind:'catalog',key:catalog.url,src:catalog.playback,poster:catalog.poster,epoch:page.data.mediaViewEpoch}}},{currentTarget:{dataset:{kind:'asset',key:asset.id,src:asset.url,poster:asset.poster,epoch:page.data.mediaViewEpoch}}}];
 for(const event of events){call('onVideoMediaError',event);call('retryVideoMedia',event)}
 expect(ticks).toHaveLength(2);ticks.forEach(callback=>callback());expect(page.data.videoFailures).toEqual({});expect(page.data.videoReloading).toEqual({});
 expect(page.data).toMatchObject({productMedia:[catalog],videoCards:[asset],displayName:'封面重载保留输入',hasPendingMedia:true});expect(wires).toHaveLength(requestCount);expect(server).toEqual(originalServer);expect(navigateTo).not.toHaveBeenCalled();
 const markup=readFileSync(new URL('../miniprogram/pages/publish/index.wxml',import.meta.url),'utf8');
 const posters=markup.match(/<media-state\b[^>]*src="\{\{item.poster\}\}"[^>]*>/gu)??[];expect(posters).toHaveLength(2);
 for(const poster of posters){expect(poster).toContain('density="thumbnail"');expect(poster).toContain('data-poster="{{item.poster}}"');expect(poster).toContain('binderror="onVideoMediaError"');expect(poster).toContain('bindretry="retryVideoMedia"');expect(poster).toContain('retry-label="重试封面"')}
 expect(markup).toContain('class="hero-card xy-draft-media-tile"');expect(markup).toContain('catchtap="deleteMedia"');expect(markup).toContain('src="{{item.url}}" poster="{{item.poster}}" controls="true"');expect(markup).toContain('src="{{item.playback}}" poster="{{item.poster}}" controls="true"');
});
test('poster events from an older own cover or epoch cannot mark or retry the current video',async()=>{
 await call('onShow');const asset={id:'original-video-id',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/asset-video',poster:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/current-own-poster'};page.setData({videoCards:[asset]});
 const original=structuredClone(page.data);const oldCover={currentTarget:{dataset:{kind:'asset',key:asset.id,src:asset.url,poster:asset.poster+'-old',epoch:page.data.mediaViewEpoch}}};
 call('onVideoMediaError',oldCover);call('retryVideoMedia',oldCover);expect(page.data).toEqual(original);
 const oldEpoch={currentTarget:{dataset:{...oldCover.currentTarget.dataset,poster:asset.poster,epoch:Number(page.data.mediaViewEpoch)-1}}};call('onVideoMediaError',oldEpoch);call('retryVideoMedia',oldEpoch);expect(page.data).toEqual(original);
});
