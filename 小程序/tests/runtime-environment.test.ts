import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOrigin } from '../miniprogram/shared/config/env';

afterEach(() => vi.unstubAllGlobals());

describe('runtime API destination', () => {
  it.each([
    ['develop', 'http://127.0.0.1:8081'],
    ['trial', 'https://api.xingyuzlp.cn'],
    ['release', 'https://api.xingyuzlp.cn'],
  ])('routes %s to its approved environment', (stage, origin) => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: stage } }),
    });
    expect(apiOrigin()).toBe(origin);
  });

  it('rejects unknown stages instead of falling back to production', () => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'unknown' } }),
    });
    expect(() => apiOrigin()).toThrow('Unsupported mini-program environment');
  });
});
