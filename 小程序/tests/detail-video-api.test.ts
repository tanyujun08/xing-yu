import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';
const api=vi.hoisted(()=>({owner:'viewer' as string|null,supply:vi.fn()}));
vi.mock('../miniprogram/shared/api/account-api',()=>({accountApi:{sessionIdentity:()=>api.owner}}));
vi.mock('../miniprogram/shared/api/supply-api',()=>({supplyApi:{get:api.supply},discoveryApi:{getSupply:api.supply}}));
interface Harness{data:Record<string,unknown>;setData(patch:Record<string,unknown>):void;[key:string]:unknown}
let definition:Harness,page:Harness;const stop=vi.fn();
function response(value:unknown){return{promise:Promise.resolve(value),abort:vi.fn()}}
function call(name:string,...args:unknown[]){return(page[name] as(...values:unknown[])=>unknown).apply(page,args)}
function supply(){return{asset_id:'asset-1',asset_revision_id:'revision-1',product_id:'product-1',display_name:'相机',supply_type:'PERSONAL',rental_mode:'DAY',currency:'CNY',unit_price_fen:'1000',deposit_fen:'10000',reference_value_fen:'30000',minimum_units:'1',available_from:'2026-09-01T00:00:00Z',available_until:'2026-10-01T00:00:00Z',condition:'良好',description:'',defect_description:'',accessories_text:'',region:{city_name:'上海市',district_name:'徐汇区'},media:[{material_id:'video-1',role:'VIDEO',sort_order:0,url:origin+'/own-playback.mp4',mime_type:'video/mp4',size_bytes:100,metadata:{schema_version:1,width:1920,height:1080,duration_ms:1000,video_codec:'h264',audio_codec:null},poster:{material_id:'own-poster',url:origin+'/own-poster.png',width:640,height:360}}],delivery_methods:['MEET'],allowed_actions:[]}}
beforeAll(async()=>{vi.stubGlobal('Page',(value:Harness)=>{definition=value});await import('../miniprogram/pages/detail/index')});
beforeEach(()=>{vi.clearAllMocks();api.owner='viewer';api.supply.mockReset().mockReturnValue(response(supply()));vi.stubGlobal('wx',{getWindowInfo:()=>({windowWidth:390}),getAppBaseInfo:()=>({fontSizeSetting:16}),createVideoContext:()=>({stop}),showToast:vi.fn()});page={...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch)}};call('onLoad',{id:'asset-1'})});
afterAll(()=>vi.unstubAllGlobals());
test('availability reads UTC as local rental time without leaking the transport timestamp',async()=>{
 const value={...supply(),available_from:'2026-09-25T16:00:00Z',available_until:'2026-10-31T16:00:00Z'};api.supply.mockReturnValueOnce(response(value));
 await call('refreshSupply');expect(page.data.equipmentRows).toContainEqual({label:'可租时间',value:'2026-09-26 00:00 至 2026-11-01 00:00'});
});
test('each play and retry reuse business playback URL and own poster without material authorization',async()=>{
 await call('refreshSupply');expect(page.data.videoMediaIds).toEqual(['video-1']);
 await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});const expected={materialId:'video-1',src:origin+'/own-playback.mp4',poster:origin+'/own-poster.png'};expect(page.data.videoState).toEqual(expected);
 call('onVideoError');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});expect(page.data.videoState).toEqual(expected);expect(api.supply).toHaveBeenCalledTimes(1);
 call('onHide');expect(stop).toHaveBeenCalled();expect(page.data.videoState).toBeNull();
});
test('malformed public video and late account read cannot paint a player',async()=>{
 const invalid=supply();invalid.media[0]!.url='https://other.test/video.mp4';api.supply.mockReturnValueOnce(response(invalid));await call('refreshSupply');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});expect(page.data.videoState).toBeNull();expect(page.data.videoErrorText).toContain('公开媒体不完整');
 let resolve!:(value:unknown)=>void;api.supply.mockReturnValueOnce({promise:new Promise(done=>{resolve=done}),abort:vi.fn()});const pending=call('refreshSupply');api.owner='other';call('onHide');resolve(supply());await pending;expect(page.data.videoState).toBeNull();expect(page.data.videoMediaIds).toEqual([]);
});
test('visible player stops and clears page state on account change',async()=>{
 await call('refreshSupply');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});expect(page.data.videoState).not.toBeNull();api.owner='other';call('onVideoTimeUpdate');expect(stop).toHaveBeenCalled();expect(page.data.videoState).toBeNull();
});
test('guest plays public business DTO directly without management GET',async()=>{
 api.owner=null;await call('refreshSupply');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});expect(page.data.videoState).toMatchObject({src:origin+'/own-playback.mp4'});expect(api.supply).toHaveBeenCalledTimes(1);
});

test('visible own poster retry remounts the original player and cover without another supply read',async()=>{
 await call('refreshSupply');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});const original=structuredClone(page.data.videoState);
 const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});
 const event={currentTarget:{dataset:{id:'video-1',src:origin+'/own-playback.mp4',poster:origin+'/own-poster.png',epoch:page.data.videoViewEpoch}}};
 call('retryVideoPoster',event);expect(page.data.videoState).toBeNull();expect(page.data.videoBusy).toBe(true);expect(ticks).toHaveLength(1);ticks.shift()!();
 expect(page.data.videoState).toEqual(original);expect(page.data.videoBusy).toBe(false);expect(api.supply).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalled();
 const markup=readFileSync(new URL('../miniprogram/pages/detail/index.wxml',import.meta.url),'utf8');
 const poster=markup.match(/<media-state\b[^>]*src="\{\{videoState.poster\}\}"[^>]*>/u)?.[0];
 expect(poster).toContain('density="thumbnail"');expect(poster).toContain('width:72px;height:72px');expect(poster).toContain('bindretry="retryVideoPoster"');expect(poster).toContain('data-epoch="{{videoViewEpoch}}"');
 expect(markup).toContain('src="{{videoState.src}}" poster="{{videoState.poster}}" controls autoplay');expect(markup).toContain('retry-label="重试封面"');
 const styles=readFileSync(new URL('../miniprogram/pages/detail/index.wxss',import.meta.url),'utf8');expect(styles).toMatch(/\.detail-videos__player\s*\{[^}]*height:248px;/u);
});
test('poster retry rejects stale cover and epoch and cannot remount across hidden or changed owner state',async()=>{
 await call('refreshSupply');await call('playVideo',{currentTarget:{dataset:{id:'video-1'}}});const original=structuredClone(page.data);
 const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});
 const event={currentTarget:{dataset:{id:'video-1',src:origin+'/own-playback.mp4',poster:origin+'/own-poster.png',epoch:page.data.videoViewEpoch}}};
 call('retryVideoPoster',{currentTarget:{dataset:{...event.currentTarget.dataset,poster:origin+'/other-cover.png'}}});call('retryVideoPoster',{currentTarget:{dataset:{...event.currentTarget.dataset,epoch:Number(page.data.videoViewEpoch)-1}}});expect(page.data).toEqual(original);expect(ticks).toHaveLength(0);
 call('retryVideoPoster',event);call('onHide');const hidden=structuredClone(page.data);api.owner='other';ticks.shift()!();expect(page.data).toEqual(hidden);expect(page.data.videoState).toBeNull();expect(api.supply).toHaveBeenCalledTimes(1);
});
