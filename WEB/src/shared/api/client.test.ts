import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test('binary downloads reject Problem or false image data and preserve failures', async () => {
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"code":"FORBIDDEN","message":"denied","request_id":"binary-test"}', { status: 403, headers: { 'Content-Type': 'application/problem+json' } })).mockResolvedValueOnce(new Response('not an image', { headers: { 'Content-Type': 'image/png' } })).mockResolvedValueOnce(new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
  await expect(client.request({ path: '/code', responseType: 'image' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  await expect(client.request({ path: '/code', responseType: 'image' })).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  await expect(client.request({ path: '/csv', responseType: 'csv' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE_TYPE' });
});
test('accepts actual PNG signature and CSV bytes without parsing them as JSON', async () => {
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { 'Content-Type': 'image/png' } })).mockResolvedValueOnce(new Response('order,amount\n1,240\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })));
  expect((await client.request<Blob>({ path: '/code', responseType: 'image' })).size).toBe(8);
  expect(await (await client.request<Blob>({ path: '/csv', responseType: 'csv' })).text()).toContain('240');
});

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, message: code, request_id: `req_${status}` }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

test('adds first-party request metadata', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ready' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const client = createApiClient({ baseURL: 'https://api.example.test', getAccessToken: () => 'test-token' });
  await client.request<{ status: string }, { check: boolean }>({
    path: '/readyz',
    method: 'POST',
    body: { check: true },
    idempotencyKey: 'ready:test',
    aggregateVersion: '7',
  });

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Headers;
  expect(headers.get('Authorization')).toBe('Bearer test-token');
  expect(headers.get('Idempotency-Key')).toBe('ready:test');
  expect(headers.get('If-Match')).toBe('7');
});

test('preserves the API problem contract', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'VERSION_CONFLICT', message: 'refresh', request_id: 'req_test' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  await expect(client.request({ path: '/v1/test' })).rejects.toMatchObject({
    code: 'VERSION_CONFLICT',
    requestId: 'req_test',
    status: 409,
  });
});

describe.each([
  [403, 'FORBIDDEN'],
  [422, 'BUSINESS_RULE_REJECTED'],
  [409, 'VERSION_CONFLICT'],
] as const)('structured HTTP failure %i', (status, code) => {
  test(`returns ${code} without retrying`, async () => {
    const fetchMock = vi.fn().mockResolvedValue(problemResponse(status, code));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient({ baseURL: '', getAccessToken: () => null });

    await expect(client.request({ path: '/v1/action' })).rejects.toMatchObject({ status, code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

test('clears the session projection on 401', async () => {
  const onUnauthorized = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(401, 'UNAUTHENTICATED')));
  const client = createApiClient({ baseURL: '', getAccessToken: () => 'expired', onUnauthorized });

  await expect(client.request({ path: '/v1/session' })).rejects.toMatchObject({ status: 401 });
  expect(onUnauthorized).toHaveBeenCalledOnce();
});

function abortableFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const rejectAbort = () => reject(new DOMException('aborted', 'AbortError'));
    if (init?.signal?.aborted === true) {
      rejectAbort();
      return;
    }
    init?.signal?.addEventListener('abort', rejectAbort, { once: true });
  });
}

test('classifies timeout without retrying the write', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(abortableFetch);
  vi.stubGlobal('fetch', fetchMock);
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  const pending = client.request<never, { value: string }>({
    path: '/v1/action',
    method: 'POST',
    body: { value: 'test' },
    timeoutMs: 10,
  });
  const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', status: 0 });

  await vi.advanceTimersByTimeAsync(11);
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('classifies caller cancellation', async () => {
  const fetchMock = vi.fn(abortableFetch);
  vi.stubGlobal('fetch', fetchMock);
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  const controller = new AbortController();
  const pending = client.request({ path: '/v1/query', signal: controller.signal });
  controller.abort();

  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED', status: 0 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('reuses a caller-owned idempotency key for an intentional replay', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ decision: 'ACCEPTED' }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ decision: 'IDEMPOTENT_REPLAY' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const client = createApiClient({ baseURL: '', getAccessToken: () => null });
  const options = { path: '/v1/action', method: 'POST' as const, idempotencyKey: 'action:stable' };

  await client.request(options);
  await client.request(options);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
    expect((init.headers as Headers).get('Idempotency-Key')).toBe('action:stable');
  }
});

class UploadXHR {
  static instances: UploadXHR[] = [];
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 201;
  responseText = '{"status":"READY"}';
  headers = new Headers();
  open = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  setRequestHeader = (name: string, value: string) => this.headers.set(name, value);
  getResponseHeader = () => 'upload-request';
  constructor() { UploadXHR.instances.push(this); }
}

function multipartClient() {
  UploadXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', UploadXHR);
  return createApiClient({ baseURL: '/api', getAccessToken: () => 'first-party-token' });
}

test('sends multipart bytes with real progress and no manual boundary or JSON serialization', async () => {
  const client = multipartClient();
  const body = new FormData();
  body.append('file', new File(['image'], 'a.png'));
  body.append('class', 'CATALOG_IMAGE');
  const progress = vi.fn();
  const pending = client.request<{ status: string }, FormData>({ path: '/v1/materials/files', method: 'POST', body, idempotencyKey: 'original-key', onUploadProgress: progress });
  const xhr = UploadXHR.instances[0]!;
  expect(xhr.open).toHaveBeenCalledWith('POST', '/api/v1/materials/files');
  expect(xhr.send).toHaveBeenCalledWith(body);
  expect(xhr.headers.has('Content-Type')).toBe(false);
  expect(xhr.headers.get('Authorization')).toBe('Bearer first-party-token');
  expect(xhr.headers.get('Idempotency-Key')).toBe('original-key');
  expect(xhr.headers.get('X-Request-ID')).toMatch(/^web_/);
  xhr.upload.onprogress?.({ loaded: 5, total: 10, lengthComputable: true });
  xhr.upload.onprogress?.({ loaded: 7, total: 0, lengthComputable: false });
  expect(progress.mock.calls).toEqual([[{ loaded: 5, total: 10 }], [{ loaded: 7, total: null }]]);
  xhr.onload?.();
  await expect(pending).resolves.toEqual({ status: 'READY' });
  expect(xhr.upload.onprogress).toBeNull();
});

test('uses 300000ms only for multipart and never retries an uncertain write', async () => {
  vi.useFakeTimers();
  const client = multipartClient();
  const pending = client.request({ path: '/v1/materials/files', method: 'POST', body: new FormData() });
  const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  const xhr = UploadXHR.instances[0]!;
  await vi.advanceTimersByTimeAsync(299999);
  expect(xhr.abort).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(xhr.abort).toHaveBeenCalledOnce();
  expect(xhr.send).toHaveBeenCalledOnce();
});

test('aborts multipart and ignores late progress; pre-aborted uploads never send', async () => {
  const client = multipartClient();
  const controller = new AbortController();
  const progress = vi.fn();
  const pending = client.request({ path: '/v1/materials/files', body: new FormData(), signal: controller.signal, onUploadProgress: progress });
  const lateProgress = UploadXHR.instances[0]!.upload.onprogress;
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  lateProgress?.({ loaded: 10, total: 10, lengthComputable: true });
  expect(progress).not.toHaveBeenCalled();
  await expect(client.request({ path: '/v1/materials/files', body: new FormData(), signal: controller.signal })).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(UploadXHR.instances[1]!.send).not.toHaveBeenCalled();
});

test('preserves multipart server Problem text, details and 403 handling', async () => {
  UploadXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', UploadXHR);
  const forbidden = vi.fn();
  const client = createApiClient({ baseURL: '', getAccessToken: () => null, onForbidden: forbidden });
  const pending = client.request({ path: '/v1/materials/files', body: new FormData() });
  const xhr = UploadXHR.instances[0]!;
  xhr.status = 403;
  xhr.responseText = JSON.stringify({ code: 'FORBIDDEN', message: '原服务端拒绝原因', request_id: 'original-request', details: { field: 'class' } });
  xhr.onload?.();
  await expect(pending).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: '原服务端拒绝原因', requestId: 'original-request', details: { field: 'class' } });
  expect(forbidden).toHaveBeenCalledOnce();
  expect(xhr.send).toHaveBeenCalledOnce();
});
