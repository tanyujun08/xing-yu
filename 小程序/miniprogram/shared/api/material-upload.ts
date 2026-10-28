import { request, uploadMaterialFile, type RequestHandle, type MaterialUploadOptions } from './request';
import { ApiProblem } from './problem';
import type { OperationScope } from '../interaction/operation-scope';
import { matchesMaterialUploadIntent, type Material, type MaterialFileResult, type MaterialUploadIntent, type ReadyMaterialMedia } from '../model/material-media';
import { readyMaterialMedia } from '../presentation/material-media';

export const materialUploadApi = {
 upload: (file: string, materialClass: MaterialUploadIntent['materialClass'], key: string, options?: MaterialUploadOptions) => uploadMaterialFile<MaterialFileResult>(file,materialClass,key,options),
 get: (id: string): RequestHandle<Material> => {
  if(!id||id.length>64||/[\s/\\?#]/.test(id))throw new Error('素材原 ID 无效');
  return request<Material>({path:'/v1/materials/'+encodeURIComponent(id)});
 },
};

interface MaterialUploadTransport {
 upload(file: string, materialClass: MaterialUploadIntent['materialClass'], key: string, options: MaterialUploadOptions): RequestHandle<MaterialFileResult>;
 get(id: string): RequestHandle<Material>;
}
interface UploadRunOptions {
 scope: OperationScope;
 isCurrent: () => boolean;
 onState: (intent: MaterialUploadIntent) => void;
 explicitRecovery?: boolean;
 transport?: MaterialUploadTransport;
}
const runs=new WeakMap<OperationScope,Map<string,RequestHandle<ReadyMaterialMedia>>>();
const expiredUploadMessage='素材上传已过期，请取消本次处理后重新选择。';

/** One selected file and key. Only an explicit recovery may re-POST an unknown upload. */
export function runMaterialUpload(intent: MaterialUploadIntent, options: UploadRunOptions): RequestHandle<ReadyMaterialMedia> {
 const runKey=intent.owner+':'+intent.field+':'+intent.item+':'+intent.generation;
 let entries=runs.get(options.scope);if(!entries){entries=new Map();runs.set(options.scope,entries)}
 const prior=entries.get(runKey);if(prior)return prior;
 const identity={owner:intent.owner,field:intent.field,item:intent.item,generation:intent.generation};
 const transport=options.transport??materialUploadApi;
 let cancelled=false;
 let active: {abort:()=>void}|undefined;
 let stopWait: (()=>void)|undefined;
 const current=()=>!cancelled&&!options.scope.disposed&&options.isCurrent()&&matchesMaterialUploadIntent(intent,identity);
 const cancelledError=()=>new Error('素材处理已取消或页面已变化');
 const notify=()=>{if(current())options.onState(intent)};
 const abort=()=>{
  if(cancelled)return;
  if(matchesMaterialUploadIntent(intent,identity)&&intent.phase!=='READY'&&intent.phase!=='FAILED'){
   intent.phase=intent.materialId?'PROCESSING':'UNKNOWN';
   intent.error=intent.materialId?'素材处理已暂停，请显式查询原 ID。':'上传结果待确认，请显式恢复原文件和原请求键。';
   notify();
  }
  cancelled=true;active?.abort();stopWait?.();
 };
 const release=options.scope.registerCleanup(abort);
 const wait=()=>new Promise<void>(resolve=>{
  const timer=options.scope.setTimeout(()=>{stopWait=undefined;resolve()},1200);
  stopWait=()=>{options.scope.clearTimer(timer);stopWait=undefined;resolve()};
 });
 const promise=options.scope.singleFlight('material:'+intent.field+':'+intent.item+':'+intent.generation,async()=>{
  const deadline=Date.now()+300000;
  try{
   if(!current())throw cancelledError();
   if(intent.phase==='READY'||intent.phase==='CANCELLED')throw new Error('本次素材已结束');
   if(intent.phase==='FAILED')throw new Error(intent.error||'素材处理失败，请取消后重新选择。');
   if(!intent.materialId&&intent.phase==='UNKNOWN'&&!options.explicitRecovery)throw new Error('上传结果未知；请显式恢复原文件和原请求键，不会自动重传。');
   let value: Material|MaterialFileResult;let fromUpload=!intent.materialId;
   if(!intent.materialId){
    intent.phase='UPLOADING';intent.error='';notify();
    const upload=transport.upload(intent.file,intent.materialClass,intent.key,{onProgress(progress){if(current()){intent.progress=progress.progress;notify()}}});active=upload;
    value=await upload.promise;
    if(!current())throw cancelledError();
    if(!value.material_id||value.material_id.length>64||/[\s/\\?#]/.test(value.material_id)||!value.upload_id)throw new Error('上传回执身份无法确认，请显式恢复原请求。');
    intent.materialId=value.material_id;
   }else{
    active=transport.get(intent.materialId);value=await (active as RequestHandle<Material>).promise;
   }
   for(;;){
    if(!current())throw cancelledError();
    if(value.material_id!==intent.materialId)throw new Error('素材原 ID 回读不匹配');
    if(!fromUpload){const material=value as Material;if(material.owner_account_id!==intent.owner||material.material_class!==intent.materialClass||material.scope_type==='SYSTEM'||material.scope_type==='CATALOG')throw new Error('素材归属或用途不匹配');}
    if(value.status==='READY'){
     const ready=readyMaterialMedia(value,intent.materialClass);
     if(!ready)throw new Error('READY 素材公开媒体不完整，请核对原 ID。');
     intent.phase='READY';intent.progress=100;intent.error='';notify();return ready;
    }
    if(['REJECTED','EXPIRED','ARCHIVED'].includes(value.status)){intent.phase='FAILED';throw new Error(value.status==='EXPIRED'?expiredUploadMessage:'素材处理未通过，请取消后重新选择。')}
    if(!['UPLOADED','SCANNING','PROCESSING'].includes(value.status))throw new Error('素材处理状态无法确认');
    intent.phase='PROCESSING';intent.error='';notify();
    if(Date.now()>=deadline)throw new Error('素材仍在处理中，请显式查询原 ID。');
    await wait();if(!current())throw cancelledError();
    const read=transport.get(intent.materialId);active=read;value=await read.promise;fromUpload=false;
   }
  }catch(error){
   if(current()&&intent.phase!=='READY'){
    const expired=error instanceof ApiProblem&&error.code==='MATERIAL_UPLOAD_EXPIRED';
    if(expired)intent.phase='FAILED';
    else if(intent.phase!=='FAILED')intent.phase=intent.materialId?'PROCESSING':error instanceof ApiProblem&&error.statusCode>=400&&error.statusCode<500&&![404,408,409,412,429].includes(error.statusCode)?'FAILED':'UNKNOWN';
    intent.error=expired?expiredUploadMessage:error instanceof Error?error.message:'素材结果无法确认，请恢复原意图。';notify();
   }
   throw error;
  }finally{active=undefined;stopWait?.();release()}
 });
 const handle={promise,abort};entries.set(runKey,handle);
 const clear=()=>{if(entries.get(runKey)===handle)entries.delete(runKey)};void promise.then(clear,clear);
 return handle;
}
