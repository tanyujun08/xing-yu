import { expect, test } from 'vitest';
import { buildIncrementalListPatch } from '../miniprogram/shared/presentation/list-patch';
import { normalizeMediaDensity, normalizeMediaState } from '../miniprogram/shared/presentation/media-state';
import { calculateNavigationMetrics } from '../miniprogram/shared/presentation/navigation-metrics';

test('calculates the single custom-navigation contract with deterministic fallbacks', () => {
  expect(calculateNavigationMetrics(
    { statusBarHeight: 24 },
    { top: 28, height: 32, bottom: 60 },
  )).toEqual({ statusBarHeight: 24, contentHeight: 44, totalHeight: 68 });
  expect(calculateNavigationMetrics(
    { statusBarHeight: 20 },
    { top: 32, height: 32, bottom: 64 },
  )).toEqual({ statusBarHeight: 20, contentHeight: 56, totalHeight: 76 });
  expect(calculateNavigationMetrics({}, {})).toEqual({ statusBarHeight: 0, contentHeight: 44, totalHeight: 44 });
});

test('normalizes the new media states while retaining 1.0.0.13 state aliases', () => {
  expect(normalizeMediaState('ready', '/image.png')).toBe('ready');
  expect(normalizeMediaState('ready', '')).toBe('idle');
  expect(normalizeMediaState('real', '/legacy.png')).toBe('ready');
  expect(normalizeMediaState('empty', '')).toBe('idle');
  expect(normalizeMediaState('failed', '')).toBe('error');
  expect(normalizeMediaDensity('thumbnail')).toBe('thumbnail');
  expect(normalizeMediaDensity('unknown')).toBe('card');
});

test('builds only new row paths for incremental setData patches', () => {
  expect(buildIncrementalListPatch('items', 2, [{ id: '3' }, { id: '4' }])).toEqual({
    'items[2]': { id: '3' },
    'items[3]': { id: '4' },
  });
  expect(() => buildIncrementalListPatch('', 0, [])).toThrow('List data path is required');
});
