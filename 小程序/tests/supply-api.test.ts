import { expect, test } from 'vitest';
import type { PublicMaterialMedia } from '../miniprogram/shared/model/material-media';
import { publicSupplyGallery, publicSupplyVideo, MAX_DETAIL_MEDIA } from '../miniprogram/shared/presentation/api-supply';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';
function image(index:number):PublicMaterialMedia{return{material_id:'m'+index,role:index===0?'COVER':'IMAGE',sort_order:index,url:origin+'/m'+index+'.png',mime_type:'image/png',size_bytes:100,metadata:{schema_version:1,width:100,height:80,duration_ms:null,video_codec:null,audio_codec:null},poster:null}}
const supply={media:Array.from({length:12},(_,index)=>image(index))};
test('gallery preserves nine-image cap, server order and deduplication from public business media',()=>{
 const values=[supply.media[0]!,supply.media[0]!,...supply.media.slice(1)].reverse();
 expect(MAX_DETAIL_MEDIA).toBe(9);expect(publicSupplyGallery({media:values})).toEqual(supply.media.slice(0,9).map(item=>({src:item.url})));
 expect(publicSupplyGallery({media:[{...image(0),metadata:null}]})).toEqual([{src:image(0).url}]);
});
test('empty or malformed projection cannot create a device photograph',()=>{
 expect(publicSupplyGallery({media:[]})).toEqual([]);
 for(const patch of [{url:'http://other.test/a'},{url:origin+'/a?signature=x'},{metadata:{schema_version:1 as const,width:0,height:80,duration_ms:null,video_codec:null,audio_codec:null}},{poster:{material_id:'p',url:origin+'/p',width:10,height:10}},{size_bytes:0}])expect(publicSupplyGallery({media:[{...image(0),...patch}]})).toEqual([]);
});
test('video uses the original business identity, actual playback URL, metadata and own poster',()=>{
 const video:PublicMaterialMedia={...image(0),material_id:'original-video',role:'VIDEO',url:origin+'/own-playback.mp4',mime_type:'video/mp4',metadata:{schema_version:1,width:1920,height:1080,duration_ms:1000,video_codec:'h264',audio_codec:null},poster:{material_id:'own-poster',url:origin+'/own-poster.png',width:640,height:360}};
 expect(publicSupplyVideo({media:[video]},'original-video')).toMatchObject({materialId:'original-video',url:video.url,poster:video.poster!.url});
 expect(publicSupplyVideo({media:[video]},'own-poster')).toBeNull();expect(publicSupplyVideo(supply,'original-video')).toBeNull();
 for(const patch of [{url:'https://other.test/video'},{metadata:null},{mime_type:'image/png'},{poster:null},{poster:{...video.poster!,material_id:'original-video'}}])expect(publicSupplyVideo({media:[{...video,...patch}]},'original-video')).toBeNull();
});
