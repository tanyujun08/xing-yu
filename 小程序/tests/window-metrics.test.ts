import { afterEach, expect, test, vi } from 'vitest';
import { readDisplayWindowMetrics } from '../miniprogram/shared/presentation/window-metrics';

afterEach(() => vi.unstubAllGlobals());
test('window and font settings come from their respective modern APIs and refresh', () => {
  let width = 375; let font = 16;
  const legacy = vi.fn();
  vi.stubGlobal('wx', { getWindowInfo: () => ({ windowWidth: width }), getAppBaseInfo: () => ({ fontSizeSetting: font }), getSystemInfoSync: legacy });
  expect(readDisplayWindowMetrics()).toEqual({ windowWidth: 375, fontSizeSetting: 16 });
  width = 320; font = 32;
  expect(readDisplayWindowMetrics()).toEqual({ windowWidth: 320, fontSizeSetting: 32 });
  expect(legacy).not.toHaveBeenCalled();
});
test('legacy hosts and unavailable fields retain explicit defaults', () => {
  vi.stubGlobal('wx', { getSystemInfoSync: () => ({ windowWidth: 414, fontSizeSetting: 24 }) });
  expect(readDisplayWindowMetrics()).toEqual({ windowWidth: 414, fontSizeSetting: 24 });
  vi.stubGlobal('wx', { getWindowInfo: () => ({ windowWidth: -1 }), getAppBaseInfo: () => ({ fontSizeSetting: NaN }) });
  expect(readDisplayWindowMetrics()).toEqual({ windowWidth: 430, fontSizeSetting: 16 });
});
