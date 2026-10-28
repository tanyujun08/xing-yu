import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
type ResponseValue = { result: Record<string,any>; data: Record<string,any>; state: Record<string,any> };

test('isolated shared HTTP service persists catalog, proof and loss review consistently', async () => {
 const webRoot=resolve(process.cwd(),'../WEB'),stateDir=mkdtempSync(join(tmpdir(),'xingyu-linked-check-'));
 const child=spawn(process.execPath,[join(webRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5191','--strictPort'],{cwd:webRoot,env:{...process.env,XINGYU_MOCK_STATE_DIR:stateDir},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',data=>{stderr+=String(data);});child.on('error',error=>{stderr+=String(error);});
 const base='http://127.0.0.1:5191';
 try {
  const deadline=Date.now()+15000;let ready=false;
  while(Date.now()<deadline&&!ready){if(child.exitCode!==null)break;try{const response=await fetch(base+'/');ready=response.ok;}catch{await new Promise(done=>setTimeout(done,100));}}
  if(!ready)throw new Error('MOCK_TEST_ENVIRONMENT: isolated service unavailable '+stderr.slice(0,500));
  const post=async (path:string,body:unknown):Promise<ResponseValue>=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await response.json() as ResponseValue;if(!response.ok)throw new Error(JSON.stringify(value));return value;};
  const product={product_id:'product-http-fixture',name:'HTTP 联动商品',model:'HTTP-1',description:'联动演示商品',brand_id:'brand-http',brand_name:'联动品牌',category_id:'category-http',category_name:'联动分类',tags:[],status:'DRAFT',version:'1',updated_at:'2026-10-16T02:00:00Z'};
  const created=await post('/__mock-link/action',{action:'adminCatalog',item:product,previousName:'',key:'http-create',command:{method:'POST'}});
  await post('/__mock-link/action',{action:'adminCatalog',item:{...product,status:'ACTIVE',version:'2'},previousName:product.name,key:'http-activate',command:{method:'POST',activate:true}});
  const catalog=await post('/__mock-link/request',{method:'GET',path:'/v1/me/catalog/products?query='+encodeURIComponent(product.name)});
  expect(catalog.data.items).toHaveLength(1);expect(catalog.data.items[0].product_id).toBe(created.result.mini_id);
  const bytes=readFileSync(resolve(process.cwd(),'miniprogram/assets/demo/device-1.png'));
  const miniUpload=await post('/__mock-link/action',{action:'miniMaterial',key:'http-mini-image',base64:bytes.toString('base64')});
  expect(miniUpload.result).toMatchObject({owner_account_id:'demo-tenant',material_class:'EVIDENCE_IMAGE',mime_type:'image/png'});
  const miniImage=await fetch(base+'/__mock-link/materials/'+miniUpload.result.material_id);expect(Buffer.from(await miniImage.arrayBuffer()).equals(bytes)).toBe(true);
  const upload={action:'adminMaterial',id:'local-material-http-fixture',mime:'image/png',base64:bytes.toString('base64')};
  const uploaded=await post('/__mock-link/action',upload);expect(uploaded.result.material_id).toBe(upload.id);
  const image=await fetch(base+'/__mock-link/materials/'+upload.id);expect(Buffer.from(await image.arrayBuffer()).equals(bytes)).toBe(true);
  const returned=await post('/__mock-link/request',{method:'GET',path:'/v1/me/rental-orders/order-6/return'});
  const order=returned.state.orders.find((v:{order:{order_id:string}})=>v.order.order_id==='order-6');
  const pending={decision:'REVIEW_PENDING',receipt_version:returned.data.version,overtime_assessed_fen:null,adjustment_reason:null,loss_items:[],missing_items:[],evidence_ids:[],rejection_reason:'核对演示凭证'};
  const calc=await post('/__mock-link/action',{action:'adminPreview',id:'order-6',expectedVersion:order.order.version,body:pending});
  expect(calc.result.overtime_fen).not.toBeNull();
  const final={...pending,decision:'APPROVE_FINAL',overtime_assessed_fen:calc.result.overtime_fen,rejection_reason:null,loss_items:[{description:'模拟损坏',confirmed_fen:'40000',evidence_ids:[upload.id]}]};
  const preview=await post('/__mock-link/action',{action:'adminPreview',id:'order-6',expectedVersion:order.order.version,body:final});
  expect(preview.result.loss_fen).toBe('40000');
  const saved=await post('/__mock-link/action',{action:'adminReview',id:'order-6',expectedVersion:order.order.version,key:'http-review',body:final});expect(saved.result.review_id).toBeTruthy();
  const readback=await post('/__mock-link/request',{method:'GET',path:'/v1/me/rental-orders/order-6'});
  expect(readback.data.bill.loss_fen).toBe('40000');expect(readback.data.bill.deducted_fen).toBe(preview.result.deducted_fen);
 } finally {if(child.exitCode===null)child.kill('SIGTERM');}
},45000);
