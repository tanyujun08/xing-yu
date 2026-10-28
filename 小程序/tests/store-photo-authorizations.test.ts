import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { PublicStore } from '../miniprogram/shared/api/supply-api';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';
import { selectDiscoveryCity } from '../miniprogram/shared/session/discovery-city';
interface Harness {data:Record<string,unknown>;setData(patch:Record<string,unknown>):void;[key:string]:unknown}
interface Wire {url:string;method:string;header:Record<string,string>;success(response:unknown):void}
const definitions:Record<string,Harness>={};let target:Harness|undefined,wires:Wire[],owner:string;
function photo(id:string,sort_order=0){return{material_id:id,url:origin+'/'+id+'.jpg',sort_order}}
const store:PublicStore={store_id:'merchant-one',name:'商家一',status:'ACTIVE',version:'3',address:{dataset_id:'ds',province_id:'p',city_id:'c',district_id:'d',province_name:'广东省',city_name:'深圳市',district_name:'南山区',detail_address:'测试经营地址',contact_name:'经营联系',phone_dial:'+8613900000000',location:null},supplies:[],business_hours:null,photo_material_ids:['photo-first','photo-second'],photos:[photo('photo-first'),photo('photo-second',1)],cover:photo('photo-first'),created_at:'2026-10-02T00:00:00Z',updated_at:'2026-10-02T00:00:00Z'};
beforeAll(async()=>{
 vi.stubGlobal('wx',{getWindowInfo:()=>({windowWidth:430,windowHeight:932,statusBarHeight:44}),getAppBaseInfo:()=>({fontSizeSetting:16})});
 let name='home';vi.stubGlobal('Page',(definition:Harness)=>{definitions[name]=definition});
 await import('../miniprogram/pages/home/index');name='stores';await import('../miniprogram/pages/stores/index');name='store-detail';await import('../miniprogram/pages/store-detail/index');
});
beforeEach(()=>{
 target=undefined;owner='viewer';wires=[];selectDiscoveryCity(null);
 vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:()=>owner?{accountId:owner,accessToken:'token-'+owner,refreshToken:'refresh',expiresAt:Date.now()+60000}:'',request:(wire:Wire)=>{wires.push(wire);return{abort:vi.fn()}},getWindowInfo:()=>({windowWidth:430,windowHeight:932,statusBarHeight:44}),getAppBaseInfo:()=>({fontSizeSetting:16}),showToast:vi.fn(),navigateTo:vi.fn(),navigateBack:vi.fn()});
});
afterEach(()=>{if(target)call('onUnload');vi.unstubAllGlobals()});
function page(name:string){const definition=definitions[name]!;target={...definition,data:structuredClone(definition.data),getTabBar:()=>undefined,setData(patch){Object.assign(this.data,patch)}};return target}
function call(name:string,...args:unknown[]){return(target![name] as(...values:unknown[])=>unknown).apply(target,args)}
function reply(data:unknown){expect(wires).toHaveLength(1);wires[0]!.success({statusCode:200,data,header:{},cookies:[]})}
async function flush(){for(let index=0;index<15;index++)await Promise.resolve()}
test.each(['home','stores'])('%s consumes ordered permanent store photos with one business GET',async name=>{
 const view=page(name);const reading=call('loadStores');reply({items:[store],page:{page_size:20,has_more:false}});await reading;await flush();
 expect(wires[0]!.method).toBe('GET');expect(wires.every(wire=>!wire.url.includes('/materials/'))).toBe(true);
 expect(view.data.stores).toMatchObject(name==='home'?[{id:store.store_id,media:photo('photo-first').url}]:[{id:store.store_id,gallery:store.photos.map(item=>item.url)}]);
 wires=[];const reread=call('loadStores');const photos=[photo('photo-second'),photo('photo-first',1)];reply({items:[{...store,photos,cover:photos[0],photo_material_ids:photos.map(item=>item.material_id)}],page:{has_more:false}});await reread;await flush();
 expect(view.data.stores).toMatchObject(name==='home'?[{media:photos[0]!.url}]:[{gallery:photos.map(item=>item.url)}]);
});
test('store detail renders nine business photos and authoritative empty read clears them without management GET',async()=>{
 const view=page('store-detail'),photos=Array.from({length:9},(_,index)=>photo('photo-'+index,index));const reading=call('loadStore',store.store_id);reply({...store,photos,cover:photos[0],photo_material_ids:photos.map(item=>item.material_id)});await reading;await flush();
 expect(view.data.heroImages).toEqual(photos.map(item=>({id:item.material_id,src:item.url})));wires=[];const reread=call('loadStore',store.store_id);expect(view.data.heroImages).toEqual([]);reply({...store,photos:[],cover:null,photo_material_ids:[]});await reread;expect(view.data.heroImages).toEqual([]);expect(wires.every(wire=>!wire.url.includes('/materials/'))).toBe(true);
});
test.each(['home','stores','store-detail'])('%s rejects a foreign or signed media origin from business DTO',async name=>{
 const view=page(name),reading=name==='store-detail'?call('loadStore',store.store_id):call('loadStores');const bad={...store,photos:[{...photo('photo-first'),url:'https://other.test/photo.jpg?signature=x'}]};
 reply(name==='store-detail'?bad:{items:[bad],page:{has_more:false}});await reading;await flush();expect(wires.every(wire=>!wire.url.includes('/materials/'))).toBe(true);
 if(name==='store-detail'){expect(view.data.heroImages).toEqual([]);expect(view.data.store).toBeNull()}else expect(view.data.stores).toEqual([]);
});
test.each(['stores','store-detail'])('%s ignores a late business DTO after account changes',async name=>{
 const view=page(name),reading=name==='stores'?call('loadStores'):call('loadStore',store.store_id);owner='another-viewer';reply(name==='stores'?{items:[store],page:{has_more:false}}:store);await reading;await flush();expect(name==='stores'?view.data.stores:view.data.heroImages).toEqual([]);
});
