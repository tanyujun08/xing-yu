import { DemoError } from './DemoError';

export interface DemoNetworkTarget {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  WebSocket?: typeof WebSocket;
  EventSource?: typeof EventSource;
}

const TENCENT_MAP_NETWORK_HOSTS = new Set([
  'map.qq.com',
  'apis.map.qq.com',
  'mapapi.qq.com',
  'mapstyle.qpic.cn',
  'pr.map.qq.com',
  'vectorsdk.map.qq.com',
]);

function requestURL(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && input !== null && 'url' in input && typeof input.url === 'string') {
    return input.url;
  }
  return String(input);
}

function parseRequestURL(input: RequestInfo | URL): URL | null {
  try {
    const baseURL = typeof globalThis.location?.href === 'string'
      ? globalThis.location.href
      : 'https://mock.invalid';
    return new URL(requestURL(input), baseURL);
  } catch {
    return null;
  }
}

export function isAllowedDemoNetworkURL(input: RequestInfo | URL): boolean {
  const url = parseRequestURL(input);
  return url !== null && url.protocol === 'https:' && TENCENT_MAP_NETWORK_HOSTS.has(url.hostname);
}

function blocked(channel: string, input?: RequestInfo | URL): DemoError {
  const parsedURL = input === undefined ? null : parseRequestURL(input);
  const target = parsedURL === null ? 'unknown' : `${parsedURL.origin}${parsedURL.pathname}`;
  return new DemoError('NETWORK_BLOCKED', `Mock Demo 已阻止 ${channel} 业务网络请求（${target}）`, { channel, target });
}

export function installDemoNetworkBoundary(target: DemoNetworkTarget = globalThis): () => void {
  const originalFetch = target.fetch;
  const originalXhr = target.XMLHttpRequest;
  const originalWebSocket = target.WebSocket;
  const originalEventSource = target.EventSource;

  if (originalFetch !== undefined) {
    target.fetch = ((input, init) => isAllowedDemoNetworkURL(input)
      ? originalFetch(input, init)
      : Promise.reject(blocked('fetch', input))) as typeof fetch;
  }
  if (originalXhr !== undefined) {
    target.XMLHttpRequest = new Proxy(originalXhr, {
      construct(Target, args, NewTarget) {
        const instance = Reflect.construct(Target, args, NewTarget) as XMLHttpRequest;
        const originalOpen = instance.open;
        if (typeof originalOpen === 'function') {
          instance.open = ((method: string, url: string | URL, ...rest: unknown[]) => {
            if (!isAllowedDemoNetworkURL(url)) {
              throw blocked('XMLHttpRequest', url);
            }
            return Reflect.apply(originalOpen, instance, [method, url, ...rest]);
          }) as typeof instance.open;
        }
        return instance;
      },
    });
  }
  if (originalWebSocket !== undefined) {
    target.WebSocket = class BlockedWebSocket {
      constructor() {
        throw blocked('WebSocket');
      }
    } as unknown as typeof WebSocket;
  }
  if (originalEventSource !== undefined) {
    target.EventSource = class BlockedEventSource {
      constructor() {
        throw blocked('EventSource');
      }
    } as unknown as typeof EventSource;
  }

  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    if (originalFetch === undefined) {
      delete target.fetch;
    } else {
      target.fetch = originalFetch;
    }
    if (originalXhr === undefined) {
      delete target.XMLHttpRequest;
    } else {
      target.XMLHttpRequest = originalXhr;
    }
    if (originalWebSocket === undefined) {
      delete target.WebSocket;
    } else {
      target.WebSocket = originalWebSocket;
    }
    if (originalEventSource === undefined) {
      delete target.EventSource;
    } else {
      target.EventSource = originalEventSource;
    }
  };
}
