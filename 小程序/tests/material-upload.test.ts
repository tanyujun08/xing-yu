import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { request, uploadMaterialFile } from '../miniprogram/shared/api/request';
import { runMaterialUpload } from '../miniprogram/shared/api/material-upload';
import { ApiProblem } from '../miniprogram/shared/api/problem';
import { createMaterialUploadIntent, type Material, type MaterialFileResult } from '../miniprogram/shared/model/material-media';
import { createOperationScope } from '../miniprogram/shared/interaction/operation-scope';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';

let owner='a';
let token='token-a';
interface UploadWire {url:string;filePath:string;header:Record<string,string>;formData:Record<string,string>;timeout:number;success(value:unknown):void;fail(value:unknown):void}
let native: UploadWire;
let progress: ((value: {progress:number;totalBytesSent:number;totalBytesExpectedToSend:number})=>void)|undefined;
const abort=vi.fn();
const upload=vi.fn((options: UploadWire)=>{
 native=options;return{abort,onProgressUpdate:(handler:typeof progress)=>{progress=handler}};
});
beforeEach(()=>{
 owner='a';token='token-a';progress=undefined;vi.clearAllMocks();
 vi.stubGlobal('wx',{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
  getStorageSync:()=>({accessToken:token,refreshToken:'refresh',accountId:owner,expiresAt:Date.now()+60000}),removeStorageSync:vi.fn(),uploadFile:upload});
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});

test('fixed first-party upload retains file/key, sends only class and uses 300000ms; JSON retains 15000ms',async()=>{
 const handle=uploadMaterialFile('wxfile://original','PROFILE_IMAGE','original-key');
 expect(native.url).toMatch(/\/v1\/materials\/files$/);expect(native.filePath).toBe('wxfile://original');
 expect(native.header).toMatchObject({Authorization:'Bearer token-a','Idempotency-Key':'original-key'});
 expect(native.formData).toEqual({class:'PROFILE_IMAGE'});expect(native.timeout).toBe(300000);
 native.success?.({statusCode:201,data:'{"material_id":"m"}',errMsg:'ok'});await handle.promise;
 const json=vi.fn((options:{timeout:number;success(value:unknown):void})=>{expect(options.timeout).toBe(15000);options.success({statusCode:200,data:{ok:true},header:{},cookies:[],errMsg:'ok'});return{abort:vi.fn()}});
 Object.assign(wx,{request:json});await request({path:'/readyz'}).promise;
});

test('progress cannot repaint after cancellation or account switch; abort settles even without native callback',async()=>{
 const onProgress=vi.fn();const handle=uploadMaterialFile('wxfile://original','PROFILE_IMAGE','original-key',{onProgress});
 progress?.({progress:12,totalBytesSent:12,totalBytesExpectedToSend:100});expect(onProgress).toHaveBeenCalledWith({progress:12,sentBytes:12,totalBytes:100});
 token='token-b';owner='b';progress?.({progress:80,totalBytesSent:80,totalBytesExpectedToSend:100});expect(onProgress).toHaveBeenCalledTimes(1);
 handle.abort();await expect(handle.promise).rejects.toMatchObject({code:'REQUEST_CANCELLED'});expect(abort).toHaveBeenCalledTimes(1);
 native.success?.({statusCode:201,data:'{"material_id":"late"}',errMsg:'ok'});expect(onProgress).toHaveBeenCalledTimes(1);
});

test('network or malformed upload receipt is UNKNOWN without automatic retry',async()=>{
 const first=uploadMaterialFile('wxfile://original','PROFILE_IMAGE','original-key');native.fail?.({errMsg:'uploadFile:fail timeout'});
 await expect(first.promise).rejects.toMatchObject({code:'UPLOAD_OUTCOME_UNKNOWN'});expect(upload).toHaveBeenCalledTimes(1);
 const second=uploadMaterialFile('wxfile://original','PROFILE_IMAGE','original-key');native.success?.({statusCode:202,data:'not-json',errMsg:'ok'});
 await expect(second.promise).rejects.toMatchObject({code:'UPLOAD_OUTCOME_UNKNOWN'});expect(upload).toHaveBeenCalledTimes(2);
});

test('late READY from a changed account never resolves as success',async()=>{
 const handle=uploadMaterialFile('wxfile://original','PROFILE_IMAGE','original-key');token='token-b';owner='b';
 native.success?.({statusCode:201,data:'{"material_id":"late"}',errMsg:'ok'});await expect(handle.promise).rejects.toThrow('登录状态已变化');
});

const metadata=null;
function receipt():MaterialFileResult{return{material_id:'m',upload_id:'u',status:'READY',public_url:origin+'/original.png',playback_url:null,mime_type:'image/png',size_bytes:100,metadata,poster:null}}
function managed(patch:Partial<Material>={}):Material{return{material_id:'m',owner_account_id:'a',scope_type:'ACCOUNT',scope_id:'a',material_class:'PROFILE_IMAGE',status:'READY',public_url:origin+'/original.png',playback_url:null,mime_type:'image/png',size_bytes:100,metadata,poster:null,expected_mime:'image/png',expected_size:100,expected_sha256:'a'.repeat(64),sse_mode:'SSE-OSS',version:1,created_at:'2026-10-02T00:00:00Z',updated_at:'2026-10-02T00:00:00Z',...patch}}
function intent(){return createMaterialUploadIntent({owner:'a',field:'avatar',item:'avatar',generation:1,file:'wxfile://original',key:'original-key',materialClass:'PROFILE_IMAGE'})}
function value<T>(data:T){return{promise:Promise.resolve(data),abort:vi.fn()}}

test('201 READY fills once without GET and bursts share one flight',async()=>{
 const original=intent();const scope=createOperationScope();const onState=vi.fn();const transport={upload:vi.fn(()=>value(receipt())),get:vi.fn(()=>value(managed()))};const options={scope,isCurrent:()=>true,onState,transport};
 const a=runMaterialUpload(original,options),b=runMaterialUpload(original,options);expect(a).toBe(b);
 await expect(a.promise).resolves.toMatchObject({material_id:'m',src:origin+'/original.png'});expect(transport.upload).toHaveBeenCalledTimes(1);expect(transport.get).not.toHaveBeenCalled();expect(original.phase).toBe('READY');scope.dispose();
});

test('202 automatically queries the original ID until READY; never reuploads',async()=>{
 vi.useFakeTimers();const original=intent();const scope=createOperationScope();const transport={upload:vi.fn(()=>value({...receipt(),status:'PROCESSING' as const,public_url:null,metadata:null})),get:vi.fn().mockReturnValueOnce(value(managed({status:'SCANNING',public_url:null,metadata:null}))).mockReturnValueOnce(value(managed()))};
 const run=runMaterialUpload(original,{scope,isCurrent:()=>true,onState:vi.fn(),transport});await vi.advanceTimersByTimeAsync(2500);
 await expect(run.promise).resolves.toMatchObject({material_id:'m'});expect(transport.get.mock.calls).toEqual([['m'],['m']]);expect(transport.upload).toHaveBeenCalledTimes(1);scope.dispose();
});

test('UNKNOWN never automatically re-POSTs; explicit recovery reuses original file/key; GET failure keeps same ID',async()=>{
 const original=intent();const scope=createOperationScope();const transport={upload:vi.fn().mockReturnValueOnce({promise:Promise.reject(new Error('timeout')),abort:vi.fn()}).mockReturnValueOnce(value(receipt())),get:vi.fn(()=>value(managed()))};const options={scope,isCurrent:()=>true,onState:vi.fn(),transport};
 await expect(runMaterialUpload(original,options).promise).rejects.toThrow('timeout');expect(original.phase).toBe('UNKNOWN');
 await expect(runMaterialUpload(original,options).promise).rejects.toThrow('显式恢复');expect(transport.upload).toHaveBeenCalledTimes(1);
 await runMaterialUpload(original,{...options,explicitRecovery:true}).promise;
 expect(transport.upload.mock.calls.map(call=>call.slice(0,3))).toEqual([['wxfile://original','PROFILE_IMAGE','original-key'],['wxfile://original','PROFILE_IMAGE','original-key']]);
 const known=intent();known.materialId='m';known.phase='PROCESSING';transport.get.mockReturnValueOnce({promise:Promise.reject(new Error('read timeout')),abort:vi.fn()});
 await expect(runMaterialUpload(known,options).promise).rejects.toThrow('read timeout');expect(known.materialId).toBe('m');await runMaterialUpload(known,{...options,explicitRecovery:true}).promise;expect(transport.upload).toHaveBeenCalledTimes(2);scope.dispose();
});

test.each([false,true])('explicit MATERIAL_UPLOAD_EXPIRED ends the original intent without replacing its facts (known ID: %s)',async knownId=>{
 const original=intent();if(knownId){original.materialId='m';original.phase='PROCESSING'}
 const facts={file:original.file,key:original.key,materialId:original.materialId,generation:original.generation};
 const scope=createOperationScope();const problem=new ApiProblem(412,{code:'MATERIAL_UPLOAD_EXPIRED',message:'上传接收授权已过期',request_id:'expired-request'});
 const fail=()=>({promise:Promise.reject(problem),abort:vi.fn()});const transport={upload:vi.fn(fail),get:vi.fn(fail)};const options={scope,isCurrent:()=>true,onState:vi.fn(),transport};
 await expect(runMaterialUpload(original,options).promise).rejects.toBe(problem);
 expect(original.phase).toBe('FAILED');expect(original.error).toContain('已过期');expect(original.error).toContain('取消');
 expect({file:original.file,key:original.key,materialId:original.materialId,generation:original.generation}).toEqual(facts);
 await expect(runMaterialUpload(original,{...options,explicitRecovery:true}).promise).rejects.toThrow('已过期');
 expect(transport.upload).toHaveBeenCalledTimes(knownId?0:1);expect(transport.get).toHaveBeenCalledTimes(knownId?1:0);scope.dispose();
});

test('GET terminal EXPIRED stops the same ID after management ownership validation and keeps the original intent',async()=>{
 const original=intent();original.materialId='m';original.phase='PROCESSING';const scope=createOperationScope();
 const transport={upload:vi.fn(()=>value(receipt())),get:vi.fn(()=>value(managed({status:'EXPIRED',public_url:null})))};
 const options={scope,isCurrent:()=>true,onState:vi.fn(),transport};
 await expect(runMaterialUpload(original,options).promise).rejects.toThrow('已过期');expect(original.phase).toBe('FAILED');
 expect(original).toMatchObject({materialId:'m',file:'wxfile://original',key:'original-key',generation:1});
 await expect(runMaterialUpload(original,{...options,explicitRecovery:true}).promise).rejects.toThrow('已过期');
 expect(transport.get.mock.calls).toEqual([['m']]);expect(transport.upload).not.toHaveBeenCalled();scope.dispose();
 const foreign=intent();foreign.materialId='m';foreign.phase='PROCESSING';const foreignScope=createOperationScope();
 await expect(runMaterialUpload(foreign,{scope:foreignScope,isCurrent:()=>true,onState:vi.fn(),transport:{upload:vi.fn(),get:()=>value(managed({status:'EXPIRED',owner_account_id:'b',public_url:null}))}}).promise).rejects.toThrow('归属');
 expect(foreign.phase).toBe('PROCESSING');expect(foreign.materialId).toBe('m');foreignScope.dispose();
});

test.each([404,409,412])('ordinary %i does not imply expiry; explicit recovery preserves original file/key or queries the same ID',async status=>{
 for(const knownId of [false,true]){
  const original=intent();if(knownId){original.materialId='m';original.phase='PROCESSING'}
  const scope=createOperationScope();const problem=new ApiProblem(status,{code:status===412?'PRECONDITION_FAILED':status===409?'RESOURCE_CONFLICT':'NOT_FOUND',message:'无法确认当前结果',request_id:'unconfirmed-request'});
  const fail=()=>({promise:Promise.reject(problem),abort:vi.fn()});
  const transport={upload:vi.fn().mockImplementationOnce(fail).mockImplementation(()=>value(receipt())),get:vi.fn().mockImplementationOnce(fail).mockImplementation(()=>value(managed()))};
  const options={scope,isCurrent:()=>true,onState:vi.fn(),transport};
  await expect(runMaterialUpload(original,options).promise).rejects.toBe(problem);expect(original.phase).toBe(knownId?'PROCESSING':'UNKNOWN');
  expect(original).toMatchObject({materialId:knownId?'m':null,file:'wxfile://original',key:'original-key',generation:1});expect(original.error).not.toContain('已过期');
  if(!knownId){await expect(runMaterialUpload(original,options).promise).rejects.toThrow('显式恢复');expect(transport.upload).toHaveBeenCalledTimes(1)}
  await expect(runMaterialUpload(original,{...options,explicitRecovery:true}).promise).resolves.toMatchObject({material_id:'m'});
  if(knownId){expect(transport.get.mock.calls).toEqual([['m'],['m']]);expect(transport.upload).not.toHaveBeenCalled()}
  else{expect(transport.upload.mock.calls.map(call=>call.slice(0,3))).toEqual([['wxfile://original','PROFILE_IMAGE','original-key'],['wxfile://original','PROFILE_IMAGE','original-key']]);expect(transport.get).not.toHaveBeenCalled()}
  scope.dispose();
 }
});

test.each(['owner','scope','generation','cancel','leave'] as const)('wrong %s or late response cannot fill',async reason=>{
 const original=intent();original.materialId='m';original.phase='PROCESSING';const scope=createOperationScope();let alive=true;let finish!:(data:Material)=>void;const onState=vi.fn();const transport={upload:vi.fn(()=>value(receipt())),get:vi.fn(()=>({promise:new Promise<Material>(resolve=>{finish=resolve}),abort:vi.fn()}))};
 const run=runMaterialUpload(original,{scope,isCurrent:()=>alive,onState,transport});const assertion=expect(run.promise).rejects.toThrow();await Promise.resolve();await Promise.resolve();
 if(reason==='generation')alive=false;if(reason==='cancel'){original.phase='CANCELLED';run.abort()}if(reason==='leave')scope.dispose();
 finish(managed(reason==='owner'?{owner_account_id:'b'}:reason==='scope'?{scope_type:'SYSTEM'}:{}));await assertion;expect(original.phase).not.toBe('READY');expect(transport.upload).not.toHaveBeenCalled();scope.dispose();
});
