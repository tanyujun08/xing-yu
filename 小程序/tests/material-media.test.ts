import { expect, test } from 'vitest';
import { createMaterialUploadIntent, materialUploadBlocksSave, matchesMaterialUploadIntent, type MaterialFileResult, type PublicMaterialMedia } from '../miniprogram/shared/model/material-media';
import { isPublicMaterialURL, PUBLIC_MATERIAL_ORIGIN, readyMaterialMedia, publicMedia, publicMediaGallery } from '../miniprogram/shared/presentation/material-media';

test('only the fixed original origin and permanent addresses are accepted',()=>{
 expect(isPublicMaterialURL(PUBLIC_MATERIAL_ORIGIN+'/media/original.png')).toBe(true);
 for(const value of ['http://xyuprj.oss-cn-hangzhou.aliyuncs.com/a',PUBLIC_MATERIAL_ORIGIN+'.evil.test/a',PUBLIC_MATERIAL_ORIGIN+'@evil.test/a',PUBLIC_MATERIAL_ORIGIN+'/a?signature=x',PUBLIC_MATERIAL_ORIGIN+'/a#x',PUBLIC_MATERIAL_ORIGIN+'/a\\b',PUBLIC_MATERIAL_ORIGIN+'/a b'])expect(isPublicMaterialURL(value)).toBe(false);
});

test('intent retains owner, field, item, generation and exact file/key; failed and UNKNOWN block saving',()=>{
 const intent=createMaterialUploadIntent({owner:'a',field:'avatar',item:'avatar',generation:1,file:'wxfile://original',key:'original-key',materialClass:'PROFILE_IMAGE'});
 expect(intent).toMatchObject({owner:'a',field:'avatar',item:'avatar',generation:1,file:'wxfile://original',key:'original-key',materialId:null});
 for(const phase of ['SELECTED','UPLOADING','PROCESSING','UNKNOWN','FAILED'] as const){intent.phase=phase;expect(materialUploadBlocksSave(intent)).toBe(true)}
 intent.phase='READY';expect(materialUploadBlocksSave(intent)).toBe(false);intent.phase='CANCELLED';expect(materialUploadBlocksSave(intent)).toBe(false);
});

test('replacement in any owner, field, item or generation invalidates the previous intent',()=>{
 const intent=createMaterialUploadIntent({owner:'a',field:'photos',item:'item-1',generation:1,file:'wxfile://original',key:'original-key',materialClass:'RENTAL_ASSET_IMAGE'});
 expect(matchesMaterialUploadIntent(intent,intent)).toBe(true);
 for(const patch of [{owner:'b'},{field:'avatar'},{item:'item-2'},{generation:2}])expect(matchesMaterialUploadIntent(intent,{...intent,...patch})).toBe(false);
 intent.phase='CANCELLED';expect(matchesMaterialUploadIntent(intent,intent)).toBe(false);
});

test('video uses actual playback and its own poster; malformed metadata or foreign origin cannot render',()=>{
 const origin=PUBLIC_MATERIAL_ORIGIN;
 const video:MaterialFileResult={material_id:'original-video',upload_id:'original-upload',status:'READY',public_url:origin+'/original.mp4',playback_url:origin+'/playback.mp4',mime_type:'video/mp4',size_bytes:100,metadata:{schema_version:1,width:1920,height:1080,duration_ms:2000,video_codec:'h264',audio_codec:null},poster:{material_id:'own-poster',url:origin+'/own-poster.jpg',width:640,height:360}};
 expect(readyMaterialMedia(video,'RENTAL_ASSET_VIDEO')).toMatchObject({material_id:'original-video',src:origin+'/playback.mp4',posterURL:origin+'/own-poster.jpg'});
 for(const patch of [{playback_url:null},{playback_url:'https://other.test/video.mp4'},{metadata:null},{metadata:{...video.metadata!,duration_ms:4294967296}},{poster:null},{poster:{...video.poster!,material_id:'original-video'}},{poster:{...video.poster!,url:'https://other.test/poster.jpg'}}])expect(readyMaterialMedia({...video,...patch},'RENTAL_ASSET_VIDEO')).toBeNull();
 expect(readyMaterialMedia(video,'PROFILE_IMAGE')).toBeNull();
 const projected:PublicMaterialMedia={material_id:video.material_id,role:'VIDEO',sort_order:0,url:video.playback_url!,mime_type:video.mime_type,size_bytes:video.size_bytes,metadata:video.metadata,poster:video.poster};
 expect(publicMedia(projected)).toMatchObject({url:video.playback_url,poster:video.poster!.url,metadata:video.metadata});
 for(const patch of [{metadata:null},{poster:null},{poster:{...video.poster!,material_id:video.material_id}},{poster:{...video.poster!,url:'https://other.test/poster.jpg'}}])expect(publicMedia({...projected,...patch})).toBeNull();
});

test('READY image accepts contract null metadata without inventing dimensions and retains all material guards',()=>{
 const origin=PUBLIC_MATERIAL_ORIGIN;const image:MaterialFileResult={material_id:'original-image',upload_id:'original-upload',status:'READY',public_url:origin+'/original.png',playback_url:null,mime_type:'image/png',size_bytes:100,metadata:null,poster:null};
 expect(readyMaterialMedia(image,'RENTAL_ASSET_IMAGE')).toMatchObject({src:image.public_url,metadata:null,playback_url:null,poster:null,posterURL:''});
 const invalid:Partial<MaterialFileResult>[]=[{status:'PROCESSING'},{public_url:origin+'/original.png?signature=x'},{size_bytes:0},{mime_type:'video/mp4'},{playback_url:origin+'/video.mp4'},{poster:{material_id:'poster',url:origin+'/poster.png',width:640,height:360}},{metadata:{schema_version:1,width:0,height:80,duration_ms:null,video_codec:null,audio_codec:null}}];
 for(const patch of invalid)expect(readyMaterialMedia({...image,...patch},'RENTAL_ASSET_IMAGE')).toBeNull();
});

test('public gallery reads only business projection; ordered original IDs are deduplicated and no expiry exists',()=>{
 const origin=PUBLIC_MATERIAL_ORIGIN;const image:PublicMaterialMedia={material_id:'image-1',role:'IMAGE',sort_order:1,url:origin+'/1.png',mime_type:'image/png',size_bytes:100,metadata:null,poster:null};
 const cover={...image,material_id:'cover',role:'COVER' as const,sort_order:0,url:origin+'/cover.png'};
 expect(publicMediaGallery([image,cover,image])).toEqual([{src:cover.url},{src:image.url}]);expect(publicMedia(image)?.url).toBe(image.url);
 expect(publicMedia(image)).toMatchObject({url:image.url,metadata:null});expect(publicMedia({...image,url:image.url+'?signed=1'})).toBeNull();expect(publicMedia({...image,metadata:{schema_version:1,width:0,height:80,duration_ms:null,video_codec:null,audio_codec:null}})).toBeNull();
});
