import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveStyleValue, styleValue } from './helpers/style-contract';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');

describe('XY-20260903-001 revision 14 home Figma contract', () => {
  test('uses the authorized home geometry and named visual roles', () => {
    const view = read('miniprogram/pages/home/index.wxml');
    const style = read('miniprogram/pages/home/index.wxss');
    const tab = read('miniprogram/custom-tab-bar/index.wxss');

    // v1.0.1.7 R4 updates the shared four-tab shell; home keeps its own geometry.
    expect(resolveStyleValue('var(--xy-fixed-tab-visible-height)')).toBe('64px');
    expect(resolveStyleValue('var(--xy-color-brand-soft)')).toBe('#eaf6f1');
    expect(resolveStyleValue('var(--xy-color-tag-neutral)')).toBe('#e7ecf5');
    expect(view).toContain('cabinet-banner xy-elevation-banner xy-tap');
    expect(view).toContain('class="store-scroll" scroll-x="true"');
    expect(view).toContain('wx:key="id" class="store-card xy-tap"');
    expect(view).toContain('device-row--{{item.homeLayout}}');
    expect(view).not.toContain('bindtap="openPublish"');
    expect(view).not.toContain('publish-fab');
    expect(styleValue(style, '.store-card', 'flex-direction')).toBe('column');
    expect(styleValue(style, '.device-copy', 'min-width')).toBe('0');
    expect(styleValue(style, '.device-copy', 'flex')).toBe('1');
    expect(styleValue(style, '.device-copy', 'height')).toBe('');
    expect(styleValue(style, '.banner-media', 'inset')).toBe('0');
    expect(view).toContain('<media-state');
    expect(style).not.toContain('width: 246px');
    expect(style).not.toContain('--xy-optical-product-list-end-nudge');
    expect(styleValue(style, '.device-description', 'text-overflow')).toBe('ellipsis');
    expect(resolveStyleValue(tab)).toContain('64px');
    expect(resolveStyleValue('var(--xy-gap-tab-icon-label)')).toBe('3px');
  });

  test('keeps price and deposit grouped at the trailing edge without changing behavior code', () => {
    const view = read('miniprogram/pages/home/index.wxml');
    const script = read('miniprogram/pages/home/index.ts');

    expect(view).toContain('class="device-price-row"');
    expect(view).toContain('<text class="device-price-amount">¥{{item.homePrice}}</text><text class="device-price-unit">{{item.homePriceUnit}}</text>');
    expect(view).toContain('class="device-source device-source--{{item.supplyType}}"');
    expect(view).toContain("{{item.location || '取还地点待确认'}}");
    expect(view).toContain('押金 ¥{{item.deposit}}');
    expect(view).toContain('价格待确认');
    expect(view).toContain('homeSummary');
    expect(script).toContain("selectedSupply: '柜机'");
    expect(script).toContain('storeApi.list(');
    expect(script).toContain("'/pages/store-detail/index?id='");
    expect(view).toContain('bindtap="resetDeviceFilters"');
    expect(script).toContain('supplyApi.list(filter)');
    expect(script).not.toContain('mockApi');
  });
});
