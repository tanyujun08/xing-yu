import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { readDiscoveryCity, selectDiscoveryCity } from '../miniprogram/shared/session/discovery-city';
interface Harness {data:Record<string,unknown>;setData(p:Record<string,unknown>):void;[key:string]:unknown}
interface Wire{url:string;success(r:unknown):void}
const definitions:Record<string,Harness>={};let target:Harness;let wires:Wire[];const toast=vi.fn(),back=vi.fn(),navigateTo=vi.fn();
beforeAll(async()=>{let name='home';vi.stubGlobal('Page',(p:Harness)=>{definitions[name]=p});await import('../miniprogram/pages/home/index');name='region';await import('../miniprogram/pages/region/index');});
beforeEach(()=>{selectDiscoveryCity(null);wires=[];toast.mockClear();back.mockClear();navigateTo.mockClear();vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:()=>({accountId:'viewer',accessToken:'token',refreshToken:'r',expiresAt:Date.now()+60000}),request:(w:Wire)=>{wires.push(w);return{abort:vi.fn()}},showToast:toast,navigateBack:back,navigateTo});});
afterEach(()=>{if(target)call('onUnload');vi.unstubAllGlobals();});
function page(name:string){target={...definitions[name]!,data:structuredClone(definitions[name]!.data),getTabBar:()=>undefined,setData(p){Object.assign(this.data,p)}}}
function call(name:string,...args:unknown[]){return(target[name]as(...a:unknown[])=>unknown).apply(target,args)}
const answered=new Set<Wire>();
function reply(index:number,data:unknown){answered.add(wires[index]!);wires[index]!.success({statusCode:200,data,header:{},cookies:[]})}
// The discovery home also loads the public store projection; those side requests are answered
// with an empty page so the assertions below keep addressing the supply request.
function drainStores(){for(const wire of wires){if(answered.has(wire))continue;if(wire.url.includes('/v1/rental-stores')){answered.add(wire);wire.success({statusCode:200,data:{items:[],page:{page_size:20,has_more:false}},header:{},cookies:[]})}}}
function supplyIndex():number{const index=wires.findIndex(wire=>!answered.has(wire)&&wire.url.includes('/v1/rental-supplies'));if(index<0)throw new Error('no pending supply request');return index}
function item(id:string,source='PERSONAL'){return{asset_id:id,asset_revision_id:'revision-'+id,product_id:'p',display_name:id,rental_mode:'DAY',supply_type:source,currency:'CNY',unit_price_fen:'100',deposit_fen:'50000',reference_value_fen:'100000',minimum_units:'1',region:{city_name:'上海市',district_name:''},delivery_methods:source==='CABINET'?['CABINET']:['EXPRESS'],allowed_actions:[],media:[]}}
const list=(items:unknown[])=>({items,page:{page_size:20,has_more:false}});
test('current API city switching retains remote express assets and uses only server-approved local cabinet results',async()=>{page('home');selectDiscoveryCity({datasetId:'d',cityId:'beijing',name:'北京市'});let pending=call('loadSupplies');drainStores();const first=supplyIndex();expect(wires[first]!.url).toContain('city_id=beijing');reply(first,list([item('express')]));await pending;expect((target.data.devices as {id:string}[]).map(i=>i.id)).toEqual(['express']);expect(target.data.stores).toEqual([]);selectDiscoveryCity({datasetId:'d',cityId:'shanghai',name:'上海市'});pending=call('loadSupplies');drainStores();const second=supplyIndex();expect(wires[second]!.url).toContain('city_id=shanghai');reply(second,list([item('express'),item('cabinet','CABINET')]));await pending;expect((target.data.devices as {id:string}[]).map(i=>i.id)).toEqual(['express','cabinet']);selectDiscoveryCity({datasetId:'d',cityId:'beijing',name:'北京市'});pending=call('loadSupplies');drainStores();reply(supplyIndex(),list([item('express')]));await pending;expect((target.data.visibleDevices as {id:string}[]).map(i=>i.id)).toEqual(['express']);call('openStores');expect(toast).not.toHaveBeenCalled();expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({url:'/pages/stores/index'}));});
test('authenticated home store card displays the business cover without a management or authorization request',async()=>{
  page('home');
  const pending=call('loadStores');
  const listWire=wires.findIndex(wire=>wire.url.includes('/v1/rental-stores?'));
  expect(listWire).toBeGreaterThanOrEqual(0);
  const url='https://xyuprj.oss-cn-hangzhou.aliyuncs.com/merchant-first.jpg';
  const first={material_id:'photo-first',url,sort_order:0};const second={material_id:'photo-second',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/merchant-second.jpg',sort_order:1};
  reply(listWire,{items:[{store_id:'merchant-one',name:'商家一',status:'ACTIVE',address:{city_name:'深圳市',district_name:'南山区'},supplies:[],version:'1',photo_material_ids:['photo-first','photo-second'],photos:[first,second],cover:first}],page:{page_size:20,has_more:false}});
  for(let i=0;i<8;i++)await Promise.resolve();
  expect(wires.some(wire=>wire.url.includes('/v1/materials/'))).toBe(false);
  await pending;
  expect(target.data.stores).toMatchObject([{id:'merchant-one',name:'商家一',media:url}]);
});
test('current region API selection has no opened flag and rejects unknown cities',async()=>{page('region');const pending=call('onShow');reply(0,{dataset_id:'d',items:[{region_id:'p',name:'北京市',level:'PROVINCE'}]});for(let i=0;i<8;i++)await Promise.resolve();reply(1,{dataset_id:'d',items:[{region_id:'beijing',name:'北京市',level:'CITY'}]});await pending;expect(target.data.cityGroups).toEqual([{letter:'B',cities:[{id:'beijing',name:'北京市'}]}]);call('selectCity',{currentTarget:{dataset:{id:'forged',city:'上海市'}}});expect(readDiscoveryCity()).toBeNull();call('selectCity',{currentTarget:{dataset:{id:'beijing'}}});expect(readDiscoveryCity()).toEqual({datasetId:'d',cityId:'beijing',name:'北京市'});expect(back).toHaveBeenCalledWith({delta:1});expect(toast).not.toHaveBeenCalled();});
