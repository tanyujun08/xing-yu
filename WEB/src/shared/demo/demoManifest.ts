import { DemoError } from './DemoError';

export const PRODUCT_VERSION = '1.0.0.10' as const;
export type ProductVersion = typeof PRODUCT_VERSION;

export const DEMO_MANIFEST = Object.freeze({
  appMode: 'mock-demo' as const,
  productVersion: PRODUCT_VERSION,
  minViewportWidth: 1280,
  minViewportHeight: 720,
  dataMode: 'DETERMINISTIC_LOCAL_MOCK' as const,
  realBusinessNetworkAllowed: false,
  externalNetworkPolicy: 'TENCENT_MAP_ONLY' as const,
});

export interface DemoBootEnvironment {
  appMode: string | undefined;
  apiBaseUrl: string | undefined;
}

export function readDemoBootEnvironment(): DemoBootEnvironment {
  return {
    appMode: import.meta.env.VITE_APP_MODE,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  };
}

export function assertDemoEnvironment(environment: DemoBootEnvironment): typeof DEMO_MANIFEST {
  if (environment.appMode !== DEMO_MANIFEST.appMode) {
    throw new DemoError('DEMO_ENV_INVALID', '管理后台必须以 mock-demo 模式启动', {
      expectedMode: DEMO_MANIFEST.appMode,
      actualMode: environment.appMode ?? 'MISSING',
    });
  }
  if ((environment.apiBaseUrl ?? '').trim() !== '') {
    throw new DemoError('DEMO_ENV_INVALID', 'Mock Demo 禁止配置真实 API 地址');
  }
  return DEMO_MANIFEST;
}
