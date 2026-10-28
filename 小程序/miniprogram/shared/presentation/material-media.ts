/** Non-secret original-bucket origin registered for this build. */
export const PUBLIC_MATERIAL_ORIGIN = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com';

export function isPublicMaterialURL(value: unknown): value is string {
 return typeof value === 'string' && (value.startsWith('/assets/') || value.startsWith('wxfile://') || value.startsWith('http://tmp/') || value.startsWith(wx.env.USER_DATA_PATH + '/') || /^http:\/\/127\.0\.0\.1:5190\/__mock-link\/materials\/local-material-[A-Za-z0-9-]+$/.test(value));
}

export function validMediaMetadata(value: MediaMetadata | null, video: boolean): boolean {
 if(value===null)return !video;
 if(!value||value.schema_version!==1||!Number.isInteger(value.width)||value.width<1||value.width>8192||!Number.isInteger(value.height)||value.height<1||value.height>8192)return false;
 if(video)return Number.isInteger(value.duration_ms)&&value.duration_ms!>0&&value.duration_ms!<=4294967295&&typeof value.video_codec==='string'&&value.video_codec.length>0&&(value.audio_codec===null||typeof value.audio_codec==='string');
 return value.duration_ms===null&&value.video_codec===null&&value.audio_codec===null;
}
function validPoster(value: MaterialPoster | null, sourceId: string): boolean {
 return value===null||!!value&&!!value.material_id&&value.material_id!==sourceId&&isPublicMaterialURL(value.url)&&Number.isInteger(value.width)&&value.width>0&&value.width<=1280&&Number.isInteger(value.height)&&value.height>0&&value.height<=1280;
}

export function readyMaterialMedia(value: Material | MaterialFileResult, materialClass: MaterialUploadIntent['materialClass']): ReadyMaterialMedia | null {
 if(materialClass==='CONTRACT_SIGNATURE_IMAGE'&&(value.mime_type!=='image/png'||value.size_bytes>2*1024*1024))return null;
 if(materialClass==='CHAT_IMAGE'&&value.size_bytes>10*1024*1024)return null;
 const video=materialClass.endsWith('_VIDEO');
 if(!value||value.status!=='READY'||!value.material_id||!isPublicMaterialURL(value.public_url)||!Number.isInteger(value.size_bytes)||value.size_bytes<1||value.size_bytes>104857600||!validMediaMetadata(value.metadata,video)||!validPoster(value.poster,value.material_id))return null;
 if(video?(value.mime_type!=='video/mp4'||!isPublicMaterialURL(value.playback_url)||value.poster===null):(!['image/jpeg','image/png','image/webp'].includes(value.mime_type)||value.playback_url!==null||value.poster!==null))return null;
 return{material_id:value.material_id,public_url:value.public_url,playback_url:value.playback_url,mime_type:value.mime_type,size_bytes:value.size_bytes,metadata:value.metadata,poster:value.poster,src:video?value.playback_url!:value.public_url,posterURL:value.poster?.url??''};
}

export function ownMaterialMedia(value: Material, id: string, owner: string, materialClass: MaterialUploadIntent['materialClass']): ReadyMaterialMedia | null {
 if(value.material_id!==id||value.owner_account_id!==owner||value.material_class!==materialClass||value.scope_type==='SYSTEM'||value.scope_type==='CATALOG')return null;
 return readyMaterialMedia(value,materialClass);
}

export function publicMedia(value: PublicMaterialMedia): {materialId:string;url:string;poster:string;metadata:MediaMetadata|null} | null {
 if(!value||!value.material_id||!['COVER','IMAGE','VIDEO'].includes(value.role)||!Number.isInteger(value.sort_order)||value.sort_order<0||!isPublicMaterialURL(value.url)||!Number.isInteger(value.size_bytes)||value.size_bytes<1||value.size_bytes>104857600)return null;
 const video=value.role==='VIDEO';
 if(!validMediaMetadata(value.metadata,video)||!validPoster(value.poster,value.material_id)|| (video?(value.mime_type!=='video/mp4'||value.poster===null):!['image/jpeg','image/png','image/webp'].includes(value.mime_type)||value.poster!==null))return null;
 return{materialId:value.material_id,url:value.url,poster:value.poster?.url??'',metadata:value.metadata};
}

export function publicPhoto(value: MaterialPhoto | undefined): string {
 return value&&!!value.material_id&&Number.isInteger(value.sort_order)&&value.sort_order>=0&&isPublicMaterialURL(value.url)?value.url:'';
}

export function publicMediaGallery(items: PublicMaterialMedia[], limit=9): {src:string}[] {
 const ids=new Set<string>(),urls=new Set<string>();
 return [...items].sort((a,b)=>a.sort_order-b.sort_order).flatMap(item=>{
  if(item.role==='VIDEO')return[];
  const media=publicMedia(item);if(!media||ids.has(media.materialId)||urls.has(media.url))return[];
  ids.add(media.materialId);urls.add(media.url);return[{src:media.url}];
 }).slice(0,limit);
}
import type { Material, MaterialFileResult, MaterialUploadIntent, MaterialPoster, MediaMetadata, PublicMaterialMedia, MaterialPhoto, ReadyMaterialMedia } from '../model/material-media';
