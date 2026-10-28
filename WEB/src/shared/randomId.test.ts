import { afterEach, expect, it, vi } from 'vitest';
import { randomId } from './randomId';

afterEach(() => vi.unstubAllGlobals());

it('creates distinct RFC 4122 version 4 IDs on HTTP without randomUUID', () => {
  const secureRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues: secureRandom });
  const ids = Array.from({ length: 128 }, () => randomId());
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it('fails closed when secure randomness is unavailable', () => {
  vi.stubGlobal('crypto', undefined);
  expect(() => randomId()).toThrow('安全随机数');
});
