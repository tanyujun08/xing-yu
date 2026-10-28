import { beforeEach, expect, it, vi } from 'vitest';
import { bootstrapPreview, createPreviewClient, resetPreview, setPreviewScenario, getPreviewInfo, previewMembers, previewDossier } from './engine';
import { createIntegratedAdminServices } from '../shared/services/createIntegratedAdminServices';
import { readyMaterialValue } from '../shared/media/materialUploadIntent';
import type { MaterialFileResult } from '../shared/services/contracts';
import type { MemberSummary, UserDossier } from '../shared/services/contracts';

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
  } });
  resetPreview(); setPreviewScenario('normal', 0);
});
const client = createPreviewClient();

it('shows the linked member and the same sign-in without mixing growth and pink units', async () => {
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const state={profile:{account_id:'demo-tenant',display_name:'共享演示账号',created_at:'2026-10-14T06:00:00Z',updated_at:'2026-10-14T06:00:00Z'},pink:888,growth:1230,
    checkedDates:[today],rules:{dayOffset:0,checkIns:{[today]:{check_in:{check_in_id:'check-1',checked_in_at:today+'T01:00:00Z',streak_days:'1',rule_version_id:'check-in-demo-v2'},grants:[{reward_code:'PINK',reward_units:'100'},{reward_code:'GROWTH',reward_units:'10'}]}}},
    points:[{entry_id:'pink-1',point_kind:'PINK',available_delta:'100'},{entry_id:'growth-1',point_kind:'GROWTH',available_delta:'10',available_after:'1230',source_kind:'CHECK_IN',occurred_at:today+'T01:00:00Z'}]};
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({state}),{status:200,headers:{'Content-Type':'application/json'}}));
  try {
    const template={avatarUrl:'/avatar.png',miniProgramRegisteredAt:'2026-01-01T00:00:00Z'} as MemberSummary;
    const rows=await previewMembers(template);expect(rows).toHaveLength(41);expect(rows[0]).toMatchObject({userId:'linked-demo-tenant',nickname:'共享演示账号',realNameStatus:'VERIFIED',consumptionAmountFen:null});
    const dossier=await previewDossier({} as UserDossier,'linked-demo-tenant');
    expect(dossier.starAccount.availableTenths).toBe(1230);expect(dossier.demoPinkBalance).toBe(888);
    expect(dossier.signIn).toMatchObject({signedInToday:true,currentStreakDays:1});
    expect(dossier.signInRecords[0]).toMatchObject({signInId:'check-1',rewardDisplay:'+100 粉钻、+1 星光'});
    expect(dossier.starLedger.map(item=>item.id)).toEqual(['growth-1']);
    await expect(previewDossier({} as UserDossier,'linked-other')).rejects.toMatchObject({code:'NOT_FOUND'});
  } finally {fetch.mockRestore();}
});

it('provides local data for every current menu without calling fetch', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const endpoints = ['/v1/ops/merchants','/v1/ops/cabinets','/v1/ops/catalog/products','/v1/ops/assets','/v1/ops/rental-orders','/v1/ops/entitlement-purchases','/v1/ops/rental-payments','/v1/ops/rental-refunds','/v1/ops/rental-earnings','/v1/ops/members','/v1/ops/coupons','/v1/ops/lottery-attempts','/v1/ops/iam/accounts','/v1/ops/iam/roles','/v1/ops/iam/login-events','/v1/ops/iam/operation-events','/v1/ops/system-config/effective'];
  for (const path of endpoints) { const value = await client.request<{items:unknown[]}>({path}); expect(value.items.length, path).toBeGreaterThan(0); }
  expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
});

it('keeps pagination contiguous and filters an exact order without altering the dataset', async () => {
  const first = await client.request<{items:{order_id:string;order_no:string}[];next_cursor:string}>({path:'/v1/ops/rental-orders?limit=20'});
  const next = await client.request<{items:{order_id:string}[]}>({path:'/v1/ops/rental-orders?limit=20&cursor='+first.next_cursor});
  expect(new Set([...first.items,...next.items].map(item=>item.order_id)).size).toBe(36);
  const exact=await client.request<{items:{order_no:string}[]}>({path:'/v1/ops/rental-orders?order_no='+first.items[0]!.order_no});
  expect(exact.items).toHaveLength(1); expect(getPreviewInfo().counts.orders).toBe(36);
});

it('supplies linked order, return evidence, contract, payments and cabinet task details', async () => {
  const gateway=createIntegratedAdminServices(client).rentalOrders!;
  const order=await gateway.detail('order-5');expect(order.data.order.order_id).toBe('order-5');expect(order.etag).toMatch(/^"/);
  const returned=await gateway.returns('order-5');expect(returned.data.evidence_slots[0]?.items[0]?.media?.url).toContain('/assets/');
  const contract=await gateway.contract('order-5');expect(contract.tenant_signature.name).toBe(order.data.order.participants.tenant_display_name);
  expect((await gateway.paymentHistory('order-5')).items[0]?.order_id).toBe('order-5');
  expect((await gateway.tasks('order-5')).items).toHaveLength(0); expect((await gateway.tasks('order-4')).items[0]?.order_id).toBe('order-4');
});

it('applies edits only locally and replays the same write without duplicating rows', async () => {
  const input={name:'本地新增商品',brand_id:'brand-1',category_id:'category-1',description:'视觉样例',tags:[],media:[],model:'PREVIEW'};
  const options={path:'/v1/ops/catalog/products',method:'POST' as const,body:input,idempotencyKey:'same-preview-write'};
  const saved=await client.request<{product_id:string},typeof input>(options);const replay=await client.request<{product_id:string},typeof input>(options);
  expect(replay.product_id).toBe(saved.product_id);expect(getPreviewInfo().counts.products).toBe(13);
  await client.request({path:'/v1/ops/catalog/products/'+saved.product_id,method:'PATCH',body:{name:'改造后的商品'}});
  const value=await client.request<{name:string}>({path:'/v1/ops/catalog/products/'+saved.product_id});expect(value.name).toBe('改造后的商品');
  resetPreview();expect(getPreviewInfo().counts.products).toBe(12);
});

it('saves a new configuration version and returns the current value on reload', async () => {
  const gateway=createIntegratedAdminServices(client).businessConfig!;
  await gateway.publish({config_key:'rental.creation_defaults',schema_version:1,expected_epoch:1,value:{schema_version:1,minimum_hourly_hours:24,minimum_daily_days:5,pay_score_enabled:false,pay_score_threshold:null},reason:'视觉配置保存'},'preview-config-write');
  const current=(await gateway.effective()).find(v=>v.config_key==='rental.creation_defaults');
  expect(current?.value).toMatchObject({minimum_daily_days:5});
  expect((await gateway.versions('rental.creation_defaults','')).items).toHaveLength(2);
});

it('renders empty and failure scenarios while preserving seed data', async () => {
  setPreviewScenario('empty',0);expect((await client.request<{items:unknown[]}>({path:'/v1/ops/merchants'})).items).toHaveLength(0);
  setPreviewScenario('error',0);await expect(client.request({path:'/v1/ops/merchants'})).rejects.toMatchObject({code:'PREVIEW_ERROR'});
  setPreviewScenario('normal',0);expect((await client.request<{items:unknown[]}>({path:'/v1/ops/merchants'})).items).toHaveLength(8);
});

it('simulates payment verification without creating another transaction', async () => {
  const gateway=createIntegratedAdminServices(client).rentalOrders!;
  const result=await gateway.reconcilePayment('payment-1','verify-local-payment');expect(result.status).toBe('SUCCEEDED');
  expect(result.payer_total_fen).toBe(result.amount_fen);expect(getPreviewInfo().counts.payments).toBe(40);
  const updated=await gateway.detail('order-1');expect(updated.data.order.initial_paid_fen).toBe('340000');expect(updated.data.bill.funds_summary.gross_received_fen).toBe('340000');
});

it('rejects unknown preview operations instead of inventing a successful response', async () => {
  await expect(client.request({path:'/v1/ops/not-a-feature'})).rejects.toMatchObject({code:'PREVIEW_UNMAPPED'});
});

it('keeps uploaded images in this browser tab and makes them usable by the original form', async () => {
  Object.defineProperty(URL, 'createObjectURL', {configurable:true,value:vi.fn(()=> 'blob:http://localhost/local-image')});
  const body=new FormData();body.append('file',new File(['image-bytes'],'preview.png',{type:'image/png'}));body.append('class','CATALOG_IMAGE');
  const result=await client.request<MaterialFileResult,FormData>({path:'/v1/materials/files',method:'POST',body});
  expect(readyMaterialValue(result,'CATALOG_IMAGE','').public_url).toBe('blob:http://localhost/local-image');
  const reloaded=await client.request<MaterialFileResult>({path:'/v1/materials/'+result.material_id});expect(reloaded.public_url).toBe(result.public_url);
});

it('filters nested order references and date intervals for the visible query', async () => {
  const list=await client.request<{items:{asset:{asset_id:string};created_at:string}[]}>({path:'/v1/ops/rental-orders?asset_id=asset-1&created_from=2026-10-01T00:00:00Z&created_before=2026-10-02T00:00:00Z'});
  expect(list.items).toHaveLength(1);expect(list.items[0]?.asset.asset_id).toBe('asset-1');
});

it('supports the v1.0.2.0 cabinet cover sync and reads back the same local task', async () => {
  const cabinet=await client.request<{allowed_actions:{sync_cover:boolean},cover:{sync_id:string|null}}>({path:'/v1/ops/cabinets/cabinet-1'});
  expect(cabinet.allowed_actions.sync_cover).toBe(true); expect(cabinet.cover.sync_id).toBeNull();
  const options={path:'/v1/ops/cabinets/cabinet-1/cover-syncs',method:'POST' as const,body:{},idempotencyKey:'cover-once'};
  const created=await client.request<{sync_id:string}, Record<string, never>>(options),replay=await client.request<{sync_id:string}, Record<string, never>>(options);
  expect(replay.sync_id).toBe(created.sync_id);
  const updated=await client.request<{cover:{sync_id:string,status:string,cover_url:string}}>({path:'/v1/ops/cabinets/cabinet-1'});
  expect(updated.cover).toMatchObject({sync_id:created.sync_id,status:'ACCEPTED',cover_url:'/assets/mock/cabinet-cover.png'});
});

it('requires explicit confirmation of the original uncertain cover sync', async () => {
  const cabinet=await client.request<{cover:{sync_id:string,status:string}}>({path:'/v1/ops/cabinets/cabinet-5'});
  expect(cabinet.cover.status).toBe('UNKNOWN');
  await expect(client.request({path:'/v1/ops/cabinets/cabinet-5/cover-syncs',method:'POST',body:{}})).rejects.toMatchObject({code:'RESOURCE_CONFLICT'});
  const result=await client.request<{sync_id:string}, {confirm_resend:boolean;original_sync_id:string}>({path:'/v1/ops/cabinets/cabinet-5/cover-syncs',method:'POST',body:{confirm_resend:true,original_sync_id:cabinet.cover.sync_id}});
  expect(result.sync_id).not.toBe(cabinet.cover.sync_id);
});

it('rejects unknown nested cabinet operations rather than returning a successful cabinet', async () => {
  await expect(client.request({path:'/v1/ops/cabinets/cabinet-1/unimplemented',method:'POST',body:{}})).rejects.toMatchObject({code:'PREVIEW_UNMAPPED'});
});

it('blocks same-origin and cross-origin business fetch and XHR while permitting local static assets', async () => {
  const originalFetch=window.fetch,originalOpen=XMLHttpRequest.prototype.open;
  const transport=vi.fn(async()=>new Response('local asset'));
  window.fetch=transport as typeof fetch;
  try {
    bootstrapPreview();
    await expect(window.fetch('/v1/ops/cabinets')).rejects.toThrow('禁止业务网络');
    await expect(window.fetch('/preview-local/v1/ops/cabinets')).rejects.toThrow('禁止业务网络');
    await expect(window.fetch('https://api.example.invalid/v1/ops/cabinets')).rejects.toThrow('禁止业务网络');
    expect(()=>new XMLHttpRequest().open('GET','/v1/ops/cabinets')).toThrow('禁止业务网络');
    expect(transport).not.toHaveBeenCalled();
    await window.fetch('/assets/mock/device-camera-kit.png'); expect(transport).toHaveBeenCalledTimes(1);
  } finally { window.fetch=originalFetch;XMLHttpRequest.prototype.open=originalOpen; }
});

it('matches cabinet provider action names consumed by the official UI', async () => {
  const response=await client.request<{items:{action:string,enabled:boolean}[]}>({path:'/v1/ops/cabinets/cabinet-1/provider-actions'});
  expect(response.items.filter(item=>item.enabled).map(item=>item.action)).toEqual(['ONLINE','DOOR_QUERY','OPEN_ONE','OPEN_ALL']);
  const query=await client.request<{query_id:string,status:string}>({path:'/v1/ops/cabinets/cabinet-1/provider-queries/online',method:'POST',idempotencyKey:'online-query'});
  expect(query.status).toBe('SUCCEEDED');expect(query.query_id).toBeTruthy();
});

it('keeps all 36 order summaries, detail amounts, fulfillment and linked records consistent', async () => {
  const result=await client.request<{items:{order_id:string,participants:{merchant_name:string|null,lessor_display_name:string|null}}[]}>({path:'/v1/ops/rental-orders?limit=100'});
  expect(result.items).toHaveLength(36);
  for(const row of result.items){
    const detail=await client.request<import('../shared/api/generated/schema').components['schemas']['OpsOrderDetail']>({path:'/v1/ops/rental-orders/'+row.order_id});
    const order=detail.order, bill=detail.bill, paid=Number(order.initial_paid_fen), refund=Number(bill.deposit_refunded_fen);
    expect(row.participants.merchant_name??row.participants.lessor_display_name).toBe(order.participants.lessor_display_name);
    expect(order.initial_payer_total_fen).toBe(String(paid));
    expect(bill.initial_payment?.order_id).toBe(order.order_id);
    expect(bill.initial_payment?.payer_total_fen).toBe(String(paid));
    expect(Number(bill.funds_summary.gross_received_fen)).toBe(paid);
    expect(Number(bill.funds_summary.payer_net_fen)).toBe(paid-refund);
    if(['AWAITING_PAYMENT','CLOSED'].includes(order.stage)){
      expect(paid).toBe(0);expect(bill.deposit_received_fen).toBe('0');expect(detail.delivery.shipped_at).toBeNull();expect(detail.delivery.delivered_at).toBeNull();
    }
    if(order.physical_status==='NOT_DELIVERED') expect(detail.delivery.delivered_at).toBeNull();
    if(order.display_status_code==='COMPLETED') expect(bill.refund_summary.latest_refund?.status).toBe('SUCCEEDED');
  }
});

it('creates new brand and category entries before saving a product', async () => {
  const services=createIntegratedAdminServices(client).catalog;
  const brand=await services.createBrand!('联动验证品牌');
  const category=await services.createCategory!('联动验证分类');
  expect(brand.id).toBeTruthy(); expect(category.id).toBeTruthy();
  expect((await services.listBrands()).some(item=>item.id===brand.id&&item.name==='联动验证品牌')).toBe(true);
  expect((await services.listCategories()).some(item=>item.id===category.id&&item.name==='联动验证分类')).toBe(true);
  const product=await services.createProduct({name:'联动验证商品',brand:brand.name,category:category.name,brandId:brand.id,categoryId:category.id,model:'LINK-1',description:'',tags:[]});
  expect(product.brand).toBe('联动验证品牌'); expect(product.category).toBe('联动验证分类'); expect(product.status).toBe('DRAFT');
});

it('derives listed product asset counts from actual preview assets and uses matching seed brands', async () => {
  const p=await client.request<{items:{product_id:string,name:string,brand_name:string,asset_count:string}[]}>({path:'/v1/ops/catalog/products?limit=100'});
  const a=await client.request<{items:{product_id:string}[]}>({path:'/v1/ops/assets?limit=100'});
  for(const row of p.items) expect(Number(row.asset_count)).toBe(a.items.filter(asset=>asset.product_id===row.product_id).length);
  expect(p.items.find(row=>row.name==='索尼 FE 70–200mm 镜头')?.brand_name).toBe('索尼');
});

it('repairs untouched legacy sample catalog without altering a user-edited product', async () => {
  const {exportPreview}=await import('./engine');
  const saved=JSON.parse(exportPreview()) as {records:{products:{product_id:string,name:string,version:string,brand_id:string,brand_name:string,category_id:string,category_name:string}[],brands:{brand_id:string}[]}};
  const old=saved.records.products.find(row=>row.product_id==='product-4')!;
  Object.assign(old,{brand_id:'brand-4',brand_name:'大疆',category_id:'category-4',category_name:'摄影配件',version:'1'});
  const edited=saved.records.products.find(row=>row.product_id==='product-5')!;
  Object.assign(edited,{brand_id:'brand-2',brand_name:'用户修改',category_id:'category-1',category_name:'相机',version:'2'});
  window.localStorage.setItem('xingyu.web-mock.v102.data.v2',JSON.stringify(saved));
  vi.resetModules();
  const reloaded=await import('./engine');
  const rows=(await reloaded.createPreviewClient().request<{items:typeof saved.records.products}>({path:'/v1/ops/catalog/products?limit=100'})).items;
  expect(rows.find(row=>row.product_id==='product-4')).toMatchObject({brand_id:'brand-1',brand_name:'索尼',category_id:'category-2'});
  expect(rows.find(row=>row.product_id==='product-5')).toMatchObject({brand_id:'brand-2',brand_name:'用户修改',version:'2'});
});

it('projects the shared order into the original admin list and detail with its own version', async () => {
  const local=JSON.parse((await import('./engine')).exportPreview()) as {records:{orders:{order:Record<string,unknown>}[]}};
  const sample=structuredClone(local.records.orders[0]!);
  Object.assign(sample.order,{order_id:'mini-order-1',order_no:'RO-LINK-1001',version:'7',display_status:'待支付',display_status_code:'AWAITING_PAYMENT'});
  const state={profile:{display_name:'演示租客'},orders:[sample],tasks:[],returns:{},receipts:{}};
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({state,stateVersion:7}),{status:200,headers:{'content-type':'application/json'}}));
  const linkedClient=createPreviewClient({linked:true});
  const page=await linkedClient.request<{items:{order_id:string;order_no:string}[]}>({path:'/v1/ops/rental-orders?order_no=RO-LINK-1001'});
  expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({order_id:'linked-mini-order-1',order_no:'RO-LINK-1001'});
  let etag='';const detail=await linkedClient.request<{order:{order_id:string;version:string}}>({path:'/v1/ops/rental-orders/linked-mini-order-1',onResponseHeaders:headers=>{etag=headers.get('ETag')??'';}});
  expect(detail.order.version).toBe('7');expect(etag).toBe('"linked.order.linked-mini-order-1.7"');
  await expect(linkedClient.request({path:'/v1/ops/rental-orders/linked-mini-order-1/review-preview',method:'POST',body:{},aggregateVersion:'"linked.order.linked-mini-order-1.6"'})).rejects.toMatchObject({status:412,code:'VERSION_CONFLICT'});
  expect(fetch).toHaveBeenCalled();fetch.mockRestore();
});

it('reads the mini account coupon and its current status without hiding local admin coupons', async () => {
  const state={coupons:[{coupon_id:'shared-coupon-1',account_id:'demo-tenant',status:'AVAILABLE',name:'本机共享券',version:'1'}]};
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({state}),{status:200,headers:{'content-type':'application/json'}}));
  try {
    const linked=createPreviewClient({linked:true});
    const list=await linked.request<{items:{coupon_id:string;status:string}[]}>({path:'/v1/ops/coupons?page_size=100'});
    expect(list.items.find(row=>row.coupon_id==='linked-shared-coupon-1')?.status).toBe('AVAILABLE');
    expect(list.items.some(row=>!row.coupon_id.startsWith('linked-'))).toBe(true);
    state.coupons[0]!.status='USED';
    const detail=await linked.request<{status:string;account_id:string}>({path:'/v1/ops/coupons/linked-shared-coupon-1'});
    expect(detail).toMatchObject({status:'USED',account_id:'linked-demo-tenant'});
  } finally {fetch.mockRestore();}
});

it('activates and deactivates a saved local catalog product', async () => {
  const before=await client.request<{items:{product_id:string}[]}>({path:'/v1/ops/catalog/products?page_size=100'});
  const id=before.items[0]!.product_id;
  const active=await client.request<{status:string},{reason:string}>({path:'/v1/ops/catalog/products/'+id+'/activate',method:'POST',body:{reason:'测试启用'}});
  expect(active.status).toBe('ACTIVE');
  const inactive=await client.request<{status:string},{reason:string}>({path:'/v1/ops/catalog/products/'+id+'/deactivate',method:'POST',body:{reason:'测试停用'}});
  expect(inactive.status).toBe('INACTIVE');
});

it('accepts only the bounded loopback proof URL for linked uploads', () => {
  const url='http://127.0.0.1:5190/__mock-link/materials/local-material-test-1';
  const value:MaterialFileResult={material_id:'local-material-test-1',upload_id:'local-material-test-1',status:'READY',public_url:url,playback_url:null,mime_type:'image/png',size_bytes:128,metadata:{schema_version:1,width:640,height:640,duration_ms:null,video_codec:null,audio_codec:null},poster:null};
  expect(readyMaterialValue(value,'EVIDENCE_IMAGE','').public_url).toBe(value.public_url);
  for(const public_url of [url+'?x=1',url.replace('127.0.0.1','localhost'),url.replace(':5190',':5191')])expect(()=>readyMaterialValue({...value,public_url},'EVIDENCE_IMAGE','')).toThrow('固定公开来源');
});

it('sends explicit product changes to shared state before changing the local admin row', async () => {
  const linked=createPreviewClient({linked:true});
  const before=await client.request<{items:{product_id:string;name:string;version:string}[]}>({path:'/v1/ops/catalog/products?page_size=100'});
  const first=before.items[0]!;let fail=true;let sent:Record<string,unknown>|undefined;
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async (_input,init)=>{
    if(!init?.body)return new Response(JSON.stringify({state:{receipts:{}}}),{status:200,headers:{'content-type':'application/json'}});
    sent=JSON.parse(String(init.body));
    if(fail)return new Response(JSON.stringify({message:'共享服务不可用'}),{status:503,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({result:{item:sent!.item,mini_id:'product-1'}}),{status:200,headers:{'content-type':'application/json'}});
  });
  try {
    const path='/v1/ops/catalog/products/'+first.product_id;
    await expect(linked.request<unknown,{name:string}>({path,method:'PATCH',body:{name:'共享新名称'},aggregateVersion:`"v${first.version}"`,idempotencyKey:'failed-catalog-write'})).rejects.toThrow('共享服务不可用');
    expect((await client.request<{name:string}>({path})).name).toBe(first.name);
    fail=false;
    const updated=await linked.request<{name:string},{name:string}>({path,method:'PATCH',body:{name:'共享新名称'},aggregateVersion:`"v${first.version}"`,idempotencyKey:'successful-catalog-write'});
    expect(updated.name).toBe('共享新名称');expect(sent).toMatchObject({action:'adminCatalog',previousName:first.name,item:{name:'共享新名称'}});
    await expect(linked.request<unknown,{name:string}>({path,method:'PATCH',body:{name:'其他名称'},aggregateVersion:`"v${first.version}"`,idempotencyKey:'successful-catalog-write'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  } finally {fetch.mockRestore();}
});
