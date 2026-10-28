import { defineConfig } from '@playwright/test';

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const e2ePort = process.env.XINGYU_E2E_PORT ?? '45173';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const packaged = process.env.XINGYU_PACKAGED_E2E === '1';
const packagedOrigin = process.env.XINGYU_PACKAGED_ORIGIN ?? '';
if (packaged && !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(packagedOrigin)) throw new Error('Invalid isolated packaged origin');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !packaged,
  testIgnore: packaged ? undefined : ['**/api-integration.spec.ts'],
  forbidOnly: Boolean(process.env.CI),
  retries: packaged ? 0 : process.env.CI ? 2 : 0,
  workers: packaged ? 1 : process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  outputDir: 'test-results/playwright',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: packaged ? packagedOrigin : e2eBaseUrl,
    browserName: 'chromium',
    screenshot: packaged ? 'off' : 'only-on-failure',
    trace: packaged ? 'off' : 'on-first-retry',
    video: packaged ? 'off' : 'retain-on-failure',
  },
  projects: packaged ? [{ name: 'packaged-edge', use: { launchOptions: { executablePath: process.env.XINGYU_PACKAGED_EDGE }, viewport: { width: 1440, height: 900 } } }] : [
    {
      name: 'chromium-1920',
      use: { viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'chromium-2560',
      use: { viewport: { width: 2560, height: 1440 } },
    },
    {
      name: 'chromium-1440',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-1366',
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'chromium-1440-200pct-layout',
      use: { viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 },
    },
    {
      name: 'chromium-3840',
      use: { viewport: { width: 3840, height: 2160 } },
    },
  ],
  webServer: packaged ? undefined : {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...inheritedEnv,
      VITE_APP_MODE: 'mock-demo',
      VITE_API_BASE_URL: '',
    },
  },
});
