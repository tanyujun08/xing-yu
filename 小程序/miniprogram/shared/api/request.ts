import { demoWx } from '../../preview/platform';
import { apiOrigin } from '../config/env';
import { clearApiSession, readApiSession, readStoredApiSession, type ApiSession } from '../session/api-session';
import { ensureApiSession } from '../session/refresh-api-session';
import { newRequestId } from './idempotency';
import { ApiProblem, isProblemPayload } from './problem';
import type { MaterialUploadClass } from '../model/material-media';
import { isPublicMaterialURL } from '../presentation/material-media';
export type { MaterialUploadClass } from '../model/material-media';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions<TBody = never> {
  path: string;
  method?: HTTPMethod;
  body?: TBody;
  timeoutMs?: number;
  authenticated?: boolean;
  idempotencyKey?: string;
  aggregateVersion?: string;
  onResponseHeaders?: (headers: Record<string, string>) => void;
}

export interface RequestHandle<TResponse> {
  promise: Promise<TResponse>;
  abort: () => void;
}

function responseRequestId(headers: WechatMiniprogram.IAnyObject, fallback: string): string {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'x-request-id') {
      return String(value);
    }
  }
  return fallback;
}

export function request<TResponse, TBody = never>(options: RequestOptions<TBody>): RequestHandle<TResponse> {
  const requestId = newRequestId();
  let task: WechatMiniprogram.RequestTask | undefined;
  let cancelled = false;

  const promise = new Promise<TResponse>((resolve, reject) => {
    let origin: string;
    try {
      if (!options.path.startsWith('/') || options.path.startsWith('//') || /[\\\r\n#]/.test(options.path)) {
        throw new Error('API path must be a first-party absolute path');
      }
      origin = apiOrigin();
    } catch (error) {
      reject(error);
      return;
    }

    const send = (session: ApiSession | null) => {
    if (cancelled) {
      reject(new ApiProblem(0, { code: 'REQUEST_CANCELLED', message: '请求已取消', request_id: requestId }));
      return;
    }
    const header: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-ID': requestId,
    };
    if (session !== null) {
      header.Authorization = `Bearer ${session.accessToken}`;
    }
    if (options.body !== undefined) {
      header['Content-Type'] = 'application/json';
    }
    if (options.idempotencyKey !== undefined) {
      header['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.aggregateVersion !== undefined) {
      header['If-Match'] = options.aggregateVersion;
    }

    const requestOptions: WechatMiniprogram.RequestOption<WechatMiniprogram.IAnyObject> = {
      url: `${origin}${options.path}`,
      method: options.method ?? 'GET',
      header,
      timeout: options.timeoutMs ?? 15_000,
      success(response) {
        if (cancelled) {
          reject(new ApiProblem(0, { code: 'REQUEST_CANCELLED', message: '请求已取消', request_id: requestId }));
          return;
        }
        if (session !== null && readStoredApiSession()?.accessToken !== session.accessToken) {
          reject(new ApiProblem(0, { code: 'SESSION_CHANGED', message: '登录状态已变化，请重新查询', request_id: requestId }));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          options.onResponseHeaders?.(Object.fromEntries(Object.entries(response.header ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)])));
          resolve(response.data as TResponse);
          return;
        }
        if (response.statusCode === 401 && session !== null) {
          clearApiSession(session.accessToken);
        }
        if (isProblemPayload(response.data)) {
          reject(new ApiProblem(response.statusCode, response.data));
          return;
        }
        reject(
          new ApiProblem(response.statusCode, {
            code: 'INVALID_ERROR_RESPONSE',
            message: '服务返回了无法识别的错误',
            request_id: responseRequestId(response.header, requestId),
          }),
        );
      },
      fail(error) {
        const timedOut = error.errMsg.toLowerCase().includes('timeout');
        reject(
          new ApiProblem(0, {
            code: cancelled ? 'REQUEST_CANCELLED' : timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
            message: cancelled ? '请求已取消' : timedOut ? '请求超时，请稍后查询最新状态' : '网络连接失败，请稍后重试',
            request_id: requestId,
          }),
        );
      },
    };
    if (options.body !== undefined) {
      requestOptions.data = options.body as WechatMiniprogram.IAnyObject;
    }
    task = demoWx.request(requestOptions);
    };
    const stored = options.authenticated === false ? null : readStoredApiSession();
    if (stored && stored.expiresAt <= Date.now() + 30_000) {
      void ensureApiSession(stored).then(send, reject);
    } else {
      send(options.authenticated === false ? null : readApiSession());
    }
  });

  return {
    promise,
    abort: () => {
      cancelled = true;
      task?.abort();
    },
  };
}

export interface MaterialUploadProgress {
 progress: number;
 sentBytes: number;
 totalBytes: number;
}
export interface MaterialUploadOptions {
 onProgress?: (progress: MaterialUploadProgress) => void;
}

/** First-party multipart upload; the caller retains the original file and intent on an unknown result. */
export function uploadMaterialFile<T>(filePath: string, materialClass: MaterialUploadClass, intent: string, options: MaterialUploadOptions = {}): RequestHandle<T> {
 const requestId=newRequestId();let task:WechatMiniprogram.UploadTask|undefined;let cancelled=false;
 let cancelRequest: (() => void) | undefined;
 const promise=new Promise<T>((resolve,reject)=>{
  cancelRequest=()=>reject(new ApiProblem(0,{code:'REQUEST_CANCELLED',message:'上传已取消',request_id:requestId}));
  if(!filePath||!['PROFILE_IMAGE','EVIDENCE_IMAGE','EVIDENCE_VIDEO','RENTAL_ASSET_IMAGE','RENTAL_ASSET_VIDEO','CHAT_IMAGE','CONTRACT_SIGNATURE_IMAGE'].includes(materialClass)||!/^[!-~]{1,64}$/.test(intent)){reject(new Error('上传请求无效'));return}
  const start=(session:ApiSession|null)=>{
  if(cancelled){reject(new ApiProblem(0,{code:'REQUEST_CANCELLED',message:'上传已取消',request_id:requestId}));return}
  if(!session){reject(new Error('请先登录'));return}
  task=demoWx.uploadFile({url:apiOrigin()+'/v1/materials/files',filePath,name:'file',formData:{class:materialClass},timeout:300000,
   header:{Authorization:`Bearer ${session.accessToken}`,'Idempotency-Key':intent,'X-Request-ID':requestId},
   success(response){
    if(cancelled||readStoredApiSession()?.accessToken!==session.accessToken){reject(new Error('上传已取消或登录状态已变化'));return}
    if(response.statusCode===401)clearApiSession(session.accessToken);
    let data:unknown;try{data=JSON.parse(response.data)}catch{reject(new ApiProblem(0,{code:'UPLOAD_OUTCOME_UNKNOWN',message:'上传响应无法确认，请显式恢复原文件和原请求',request_id:requestId}));return}
    if(response.statusCode===201||response.statusCode===202){resolve(data as T);return}
    if(response.statusCode===401)clearApiSession(session.accessToken);
    reject(new ApiProblem(response.statusCode,isProblemPayload(data)?data:{code:'UPLOAD_FAILED',message:'上传未完成，请核对后重试',request_id:requestId}));
   },fail(){reject(new ApiProblem(0,{code:cancelled?'REQUEST_CANCELLED':'UPLOAD_OUTCOME_UNKNOWN',message:'上传结果待确认，请重试原文件',request_id:requestId}))},
  });
  task.onProgressUpdate?.((event)=>{
   if(cancelled||readStoredApiSession()?.accessToken!==session.accessToken)return;
   options.onProgress?.({progress:Math.max(0,Math.min(100,event.progress)),sentBytes:event.totalBytesSent,totalBytes:event.totalBytesExpectedToSend});
  });
  };
  const stored=readStoredApiSession();
  if(stored&&stored.expiresAt<=Date.now()+30_000)void ensureApiSession(stored).then(start,reject);
  else start(readApiSession());
 });return{promise,abort(){cancelled=true;cancelRequest?.();task?.abort()}};
}

export function uploadProfileImage<T>(filePath: string, intent: string, options?: MaterialUploadOptions): RequestHandle<T> {
  return uploadMaterialFile<T>(filePath, 'PROFILE_IMAGE', intent, options);
}

/** Only immutable public OSS material URLs; no API tokens are sent to storage. */
export function downloadPublicDocument(url: string): RequestHandle<string> {
  let task: WechatMiniprogram.DownloadTask | undefined;
  const promise = new Promise<string>((resolve, reject) => {
    if (!isPublicMaterialURL(url)) { reject(new Error('合同文件地址不可用')); return; }
    task = demoWx.downloadFile({ url, timeout: 60000, success: result => {
      if (result.statusCode !== 200 || !result.tempFilePath) { reject(new Error('合同下载失败，请重试')); return; }
      wx.getFileSystemManager().getFileInfo({ filePath: result.tempFilePath, success: info => {
        if (info.size < 1 || info.size > 20 * 1024 * 1024) reject(new Error('合同文件大小异常')); else resolve(result.tempFilePath);
      }, fail: reject });
    }, fail: reject });
  });
  return { promise, abort: () => task?.abort() };
}
