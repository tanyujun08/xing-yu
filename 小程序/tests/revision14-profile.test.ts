import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { styleValue } from './helpers/style-contract';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');

describe('XY-20260903-001 revision 14 profile Figma contract', () => {
  test('implements the direct 2102:1416 hero and overlap geometry', () => {
    const view = read('miniprogram/pages/profile/index.wxml');
    const style = read('miniprogram/pages/profile/index.wxss');

    expect(view).toContain('<page-header');
    expect(view).toContain('show-back="{{false}}"');
    expect(view).toContain('<text>会员中心</text>');
    expect(styleValue(style, '.profile-hero', 'height')).toBe('121px');
    expect(styleValue(style, '.avatar', 'width')).toBe('52px');
    expect(styleValue(style, '.avatar', 'height')).toBe('52px');
    expect(style).toMatch(/\.member-entry \{[^}]*width: var\(--xy-control-width-membership-entry\);[^}]*min-width: var\(--xy-size-touch-min\);[^}]*min-height: var\(--xy-size-touch-min\)/su);
    expect(style).toMatch(/\.member-entry-shell \{[^}]*width: var\(--xy-control-width-membership-entry\);[^}]*height: var\(--xy-control-height-compact\)/su);
    expect(style).toMatch(/\.profile-content \{[^}]*margin-top: var\(--xy-layout-profile-asset-overlap\);[^}]*padding: 0 var\(--xy-layout-page-padding-x\)/su);
    expect(styleValue(style, '.asset-strip', 'min-height')).toBe('64px');
    expect(styleValue(style, '.asset-strip', 'height')).toBe('');
    expect(styleValue(style, '.asset-strip', 'grid-template-columns')).toBe('repeat(4, minmax(0, 1fr))');
    expect(style).toMatch(/\.profile-section \{[^}]*margin-top: var\(--xy-layout-section-gap\)/su);
    expect(style).toMatch(/\.section-head \{[^}]*margin-bottom: var\(--xy-layout-title-content-gap\)/su);
  });

  test('keeps the 28px CTA shell separate from its 44px hit target and preserves routes', () => {
    const headerView = read('miniprogram/components/page-header/index.wxml');
    const headerStyle = read('miniprogram/components/page-header/index.wxss');
    const headerScript = read('miniprogram/components/page-header/index.ts');
    const profileScript = read('miniprogram/pages/profile/index.ts');

    expect(headerView).toContain("page-header--' + variant");
    expect(headerStyle).toContain('.page-header--profile-hero');
    expect(headerScript).toContain("variant: { type: String, value: '', observer: 'measure' }");
    expect(profileScript).toMatch(/url:\s*['"']\/pages\/membership\/index['"']/u);
    expect(profileScript).toContain("'/pages/device-orders/index?mode=rent'");
    expect(profileScript).toContain("'/pages/publish-eligibility/index'");
    expect(profileScript).toContain("'/pages/account-security/index'");
    expect(profileScript).toContain('accountApi.profile()');
    expect(profileScript).toContain('benefitApi.summary()');
    expect(profileScript).not.toContain('mockApi');
  });
});
