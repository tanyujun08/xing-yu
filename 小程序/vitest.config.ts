import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      '.wechat-test/runner/loyalty-runtime.test.mjs',
      '.wechat-test/runner/material-upload-runtime.test.mjs',
      '.wechat-test/runner/rental-ui-runtime.test.mjs',
      '.wechat-test/runner/order-ui-read-routes.test.mjs',
      '.wechat-test/runner/rental-ui-controller.test.mjs',
      '.wechat-test/runner/owned-process.test.mjs',
    ],
    testTimeout: 15_000,
  },
});
