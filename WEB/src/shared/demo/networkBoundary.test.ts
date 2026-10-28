import { expect, test, vi } from 'vitest';
import { DemoError } from './DemoError';
import { installDemoNetworkBoundary, isAllowedDemoNetworkURL, type DemoNetworkTarget } from './networkBoundary';

test('blocks fetch and restores the original implementation', async () => {
  const originalFetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
  const target: DemoNetworkTarget = { fetch: originalFetch };
  const restore = installDemoNetworkBoundary(target);

  const blockedFetch = target.fetch;
  expect(blockedFetch).toBeDefined();
  const failure = await blockedFetch!('https://example.test').catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(DemoError);
  expect(failure).toMatchObject({
    code: 'NETWORK_BLOCKED',
    details: { channel: 'fetch', target: 'https://example.test/' },
  });
  expect(originalFetch).not.toHaveBeenCalled();

  restore();
  expect(target.fetch).toBe(originalFetch);
  restore();
  expect(target.fetch).toBe(originalFetch);
});

test('allows only the exact Tencent map HTTPS hosts', async () => {
  const originalFetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
  const target: DemoNetworkTarget = { fetch: originalFetch };
  const restore = installDemoNetworkBoundary(target);

  await expect(target.fetch!('https://map.qq.com/api/gljs?v=1&key=test')).resolves.toMatchObject({ status: 204 });
  await expect(target.fetch!('https://apis.map.qq.com/ws/place/v1/suggestion?key=test')).resolves.toMatchObject({ status: 204 });
  await expect(target.fetch!('https://mapstyle.qpic.cn/fileupdate/jsauto/style')).resolves.toMatchObject({ status: 204 });
  await expect(target.fetch!('https://pr.map.qq.com/pingd')).resolves.toMatchObject({ status: 204 });
  await expect(target.fetch!('https://vectorsdk.map.qq.com/vector-resource')).resolves.toMatchObject({ status: 204 });
  await expect(target.fetch!('https://map.qq.com.evil.test/api/gljs')).rejects.toMatchObject({ code: 'NETWORK_BLOCKED' });
  await expect(target.fetch!('https://sub.vectorsdk.map.qq.com/vector-resource')).rejects.toMatchObject({ code: 'NETWORK_BLOCKED' });
  await expect(target.fetch!('http://map.qq.com/api/gljs')).rejects.toMatchObject({ code: 'NETWORK_BLOCKED' });
  await expect(target.fetch!('http://vectorsdk.map.qq.com/vector-resource')).rejects.toMatchObject({ code: 'NETWORK_BLOCKED' });
  expect(originalFetch).toHaveBeenCalledTimes(5);
  expect(isAllowedDemoNetworkURL('https://api.example.test')).toBe(false);

  restore();
});

test('guards XMLHttpRequest at open while blocking other constructor transports', () => {
  const open = vi.fn();
  const target: DemoNetworkTarget = {
    XMLHttpRequest: class OriginalXhr {
      open(...args: unknown[]) {
        open(...args);
      }
    } as unknown as typeof XMLHttpRequest,
    WebSocket: class OriginalWebSocket {} as unknown as typeof WebSocket,
    EventSource: class OriginalEventSource {} as unknown as typeof EventSource,
  };
  const restore = installDemoNetworkBoundary(target);
  const GuardedXhr = target.XMLHttpRequest!;
  const BlockedWebSocket = target.WebSocket!;
  const BlockedEventSource = target.EventSource!;

  const allowedXhr = new GuardedXhr();
  expect(() => allowedXhr.open('GET', 'https://apis.map.qq.com/ws/place/v1/suggestion')).not.toThrow();
  expect(() => allowedXhr.open('GET', 'https://mapstyle.qpic.cn/fileupdate/jsauto/style')).not.toThrow();
  expect(() => allowedXhr.open('POST', 'https://pr.map.qq.com/pingd')).not.toThrow();
  expect(() => allowedXhr.open('GET', 'https://vectorsdk.map.qq.com/vector-resource')).not.toThrow();
  expect(open).toHaveBeenCalledTimes(4);
  const blockedXhr = new GuardedXhr();
  expect(() => blockedXhr.open('GET', '/api/merchants')).toThrowError(DemoError);
  expect(() => new BlockedWebSocket('ws://example.test')).toThrowError(DemoError);
  expect(() => new BlockedEventSource('https://example.test/events')).toThrowError(DemoError);

  restore();
});
