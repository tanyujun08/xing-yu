import { describe, expect, test } from 'vitest';
import { DemoError } from './DemoError';
import { assertDemoEnvironment, DEMO_MANIFEST, PRODUCT_VERSION } from './demoManifest';

describe('demo manifest fail-closed boundary', () => {
  test('accepts only the exact mock-demo mode without an API base URL', () => {
    expect(assertDemoEnvironment({ appMode: 'mock-demo', apiBaseUrl: '' })).toBe(DEMO_MANIFEST);
    expect(PRODUCT_VERSION).toBe('1.0.0.10');
    expect(DEMO_MANIFEST.externalNetworkPolicy).toBe('TENCENT_MAP_ONLY');
  });

  test.each([
    { appMode: undefined, apiBaseUrl: undefined },
    { appMode: 'MOCK_DEMO', apiBaseUrl: undefined },
    { appMode: 'mock-demo', apiBaseUrl: 'http://127.0.0.1:8080' },
  ])('rejects unsafe environment %#', (environment) => {
    expect(() => assertDemoEnvironment(environment)).toThrowError(DemoError);
  });
});
