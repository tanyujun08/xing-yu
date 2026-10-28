import { randomId } from '../randomId';
import { createPreviewClient } from '../../preview/engine';
import { ApiProblem, isProblemPayload } from './problem';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UploadProgress {
  loaded: number;
  total: number | null;
}

export interface RequestOptions<TBody = never> {
  path: string;
  method?: HTTPMethod;
  body?: TBody;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
  aggregateVersion?: string;
  challengeToken?: string;
  onUploadProgress?: (progress: UploadProgress) => void;
  responseType?: 'image' | 'csv';
  onResponseHeaders?: (headers: Headers) => void;
}

export interface ApiClient {
  request<TResponse, TBody = never>(options: RequestOptions<TBody>): Promise<TResponse>;
}

export interface ApiClientConfig {
  baseURL: string;
  getAccessToken: () => string | null;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

// Fetch has no upload progress events. Multipart uses the browser's native
// transport inside the same client, with the same metadata and Problem handling.
function sendMultipart(url: string, method: HTTPMethod, body: FormData, headers: Headers, signal: AbortSignal, onProgress?: RequestOptions<FormData>['onUploadProgress']): Promise<{ status: number; payload: unknown; requestId: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      xhr.upload.onprogress = null;
    };
    const abort = () => { xhr.abort(); cleanup(); reject(new DOMException('aborted', 'AbortError')); };
    if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    xhr.open(method, url);
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (!signal.aborted) onProgress?.({ loaded: event.loaded, total: event.lengthComputable && event.total > 0 ? event.total : null });
    };
    xhr.onload = () => {
      let payload: unknown;
      try { payload = JSON.parse(xhr.responseText); } catch { payload = undefined; }
      const result = { status: xhr.status, payload, requestId: xhr.getResponseHeader('X-Request-ID') };
      cleanup();
      resolve(result);
    };
    xhr.onerror = () => { cleanup(); reject(new TypeError('上传连接中断，请恢复原上传以核对结果')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(body);
  });
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  void config;
  return createPreviewClient({ linked: true });
}

/** Preserved original implementation for source comparison; preview never calls it. */
export function createOriginalApiClient(config: ApiClientConfig): ApiClient {
  return {
    async request<TResponse, TBody = never>(options: RequestOptions<TBody>): Promise<TResponse> {
      const controller = new AbortController();
      const requestId = `web_${randomId()}`;
      const multipart = options.body instanceof FormData;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs ?? (multipart && options.path === '/v1/materials/files' ? 300_000 : 15_000));
      const abortFromCaller = () => controller.abort();
      options.signal?.addEventListener('abort', abortFromCaller, { once: true });
      if (options.signal?.aborted === true) {
        controller.abort();
      }

      try {
        const headers = new Headers({
          Accept: options.responseType === 'image' ? 'image/png, image/jpeg' : options.responseType === 'csv' ? 'text/csv' : 'application/json',
          'X-Request-ID': requestId,
        });
        const token = config.getAccessToken();
        if (token !== null) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (options.body !== undefined && !multipart) {
          headers.set('Content-Type', 'application/json');
        }
        if (options.idempotencyKey !== undefined) {
          headers.set('Idempotency-Key', options.idempotencyKey);
        }
        if (options.aggregateVersion !== undefined) {
          headers.set('If-Match', options.aggregateVersion);
        }
        if (options.challengeToken !== undefined) headers.set('X-Challenge-Token', options.challengeToken);

        const requestInit: RequestInit = {
          method: options.method ?? 'GET',
          headers,
          signal: controller.signal,
          credentials: 'same-origin',
        };
        if (options.body !== undefined && !multipart) {
          requestInit.body = JSON.stringify(options.body);
        }

        const uploadResponse = multipart
          ? await sendMultipart(`${config.baseURL}${options.path}`, options.method ?? 'POST', options.body as FormData, headers, controller.signal, options.onUploadProgress)
          : null;
        const response = uploadResponse === null ? await fetch(`${config.baseURL}${options.path}`, requestInit) : null;
        const status = uploadResponse?.status ?? response!.status;
        if (response && status >= 200 && status < 300) options.onResponseHeaders?.(response.headers);
        if (status === 204) {
          return undefined as TResponse;
        }

        if (status >= 200 && status < 300 && options.responseType && response) {
          const mime = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
          if (options.responseType === 'image' ? mime !== 'image/png' && mime !== 'image/jpeg' : mime !== 'text/csv') {
            throw new ApiProblem(status, { code: 'INVALID_RESPONSE_TYPE', message: '返回文件类型不正确，未下载文件', request_id: requestId });
          }
          const blob = await response.blob();
          if (options.responseType === 'image') {
            const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
            const valid = mime === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            if (!valid) throw new ApiProblem(status, { code: 'INVALID_IMAGE', message: '图片内容不正确，未下载文件', request_id: requestId });
          }
          return blob as TResponse;
        }
        const payload: unknown = uploadResponse === null ? await response!.json().catch(() => undefined) : uploadResponse.payload;
        if (status < 200 || status >= 300) {
          if (status === 401) {
            config.onUnauthorized?.();
          }
          if (status === 403) config.onForbidden?.();
          if (isProblemPayload(payload)) {
            throw new ApiProblem(status, payload);
          }
          throw new ApiProblem(status, {
            code: 'INVALID_ERROR_RESPONSE',
            message: '服务返回了无法识别的错误',
            request_id: (uploadResponse === null ? response!.headers.get('X-Request-ID') : uploadResponse.requestId) ?? 'unknown',
          });
        }
        return payload as TResponse;
      } catch (error) {
        if (timedOut) {
          throw new ApiProblem(0, {
            code: 'REQUEST_TIMEOUT',
            message: '请求超时，请稍后查询最新状态',
            request_id: requestId,
          });
        }
        if (options.signal?.aborted === true) {
          throw new ApiProblem(0, {
            code: 'REQUEST_CANCELLED',
            message: '请求已取消',
            request_id: requestId,
          });
        }
        throw error;
      } finally {
        window.clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
      }
    },
  };
}
