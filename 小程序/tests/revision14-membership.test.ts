import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');
const hash = (sourcePath: string) => createHash('sha256').update(readFileSync(join(root, sourcePath))).digest('hex');
const selectorCount = (style: string, selector: string) => [...style.matchAll(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\{`, 'gu'))].length;

describe('XY-20260903-001 revision 14 membership Figma contract', () => {
  test('owns the 2102:534 overlap and long-board relationships once', () => {
    const app = read('miniprogram/app.wxss');
    const config = JSON.parse(read('miniprogram/pages/membership/index.json')) as { navigationStyle?: string; usingComponents?: Record<string, string> };
    const view = read('miniprogram/pages/membership/index.wxml');
    const style = read('miniprogram/pages/membership/index.wxss');

    expect(config.navigationStyle).toBe('custom');
    expect(app).toContain('--xy-layout-membership-hero-height: 319px;');
    expect(app).toContain('--xy-layout-membership-card-overlap-offset: -66px;');
    expect(app).toContain('--xy-layout-membership-card-height: 132px;');
    expect(app).toContain('--xy-layout-membership-content-tail: 57px;');
    expect(app).toContain('--xy-layout-membership-invite-height: 70px;');
    expect(view).toContain('balance-card xy-elevation-overlap-card');
    expect(config.usingComponents?.['page-header']).toBe('../../components/page-header/index');
    expect(view).toContain('<page-header title="" aria-label="会员中心" inverse="{{true}}"');
    expect(view).toContain('bind:back="goBack"');
    expect(view).not.toContain('member-navigation');
    expect(style).not.toContain('rpx');
    expect(style).not.toContain('trailing semantic');
    expect(selectorCount(style, '.member-hero')).toBe(1);
    expect(selectorCount(style, '.balance-card')).toBe(1);
    expect(selectorCount(style, '.member-content')).toBe(1);
    expect(style).not.toContain('.member-navigation');
    expect(style).toMatch(/\.member-hero-body \{[^}]*min-height: var\(--xy-layout-membership-hero-height\);/su);
    expect(style).toMatch(/\.balance-card \{[^}]*position: relative;[^}]*height: var\(--xy-layout-membership-card-height\);[^}]*min-height: var\(--xy-layout-membership-card-height\);[^}]*margin: var\(--xy-layout-membership-card-overlap-offset\) var\(--xy-layout-page-padding-x\) 0;/su);
    expect(style).toMatch(/\.member-content \{[^}]*padding: var\(--xy-layout-section-gap\) var\(--xy-layout-page-padding-x\) calc\(var\(--xy-layout-membership-content-tail\) \+ env\(safe-area-inset-bottom\)\)/su);
  });

  test('keeps the 42px information relation, 36px carrier and dividers independent from hit geometry', () => {
    const view = read('miniprogram/pages/membership/index.wxml');
    const style = read('miniprogram/pages/membership/index.wxss');

    expect(view.match(/class="task-entry-hit xy-hit-target xy-tap"/g)).toHaveLength(2);
    expect(view.match(/class="task-row xy-icon-entry xy-icon-entry--compact"/g)).toHaveLength(2);
    expect(style).toMatch(/\.task-list \{[^}]*padding-bottom: var\(--xy-space-2\);[^}]*gap: var\(--xy-space-6\)/su);
    expect(style).toMatch(/\.task-entry-hit \{[^}]*display: flex;[^}]*width: 100%/su);
    expect(style).toMatch(/\.task-entry-hit::after \{[^}]*bottom: calc\(0px - var\(--xy-space-3\)\)[^}]*background: var\(--xy-color-divider\)/su);
    expect(style).toMatch(/\.task-row \{[^}]*min-height: var\(--xy-size-icon-entry-copy-compact\)[^}]*align-items: center/su);
    expect(style).not.toMatch(/\.task-row \{[^}]*\n\s+height:/su);
  });

  test('aligns the check-in and shop icons to the same card grid', () => {
    const style = read('miniprogram/pages/membership/index.wxss');

    expect(style).toMatch(/\.balance-bottom \{[^}]*display: flex;[^}]*min-height: var\(--xy-layout-membership-balance-row-height\);/su);
    expect(style).toMatch(/\.balance-item \{[^}]*width: 50%;[^}]*padding: calc\(var\(--xy-inset-card\) - var\(--xy-border-object-card-width\)\) 0 0 calc\(var\(--xy-inset-card\) - var\(--xy-border-object-card-width\)\);[^}]*align-items: flex-start;[^}]*justify-content: flex-start;/su);
    expect(style).toMatch(/\.balance-icon-checkin,\n\.balance-icon-shop \{[^}]*margin-top: var\(--xy-border-object-card-width\);/su);
    expect(style).toMatch(/\.balance-icon-checkin image,\n\.balance-icon-shop image \{[^}]*width: var\(--xy-size-icon-entry-block-compact\);[^}]*height: var\(--xy-size-icon-entry-block-compact\);/su);
  });

  test('uses the exact current Figma task glyph bytes and preserves membership behavior', () => {
    const script = read('miniprogram/pages/membership/index.ts');

    expect(hash('static-assets/assets/figma-icons/membership-arrow-right.svg')).toBe('d560ec453d9c547dbef85e45e3e01fa0123b3f5e6a7338e472120c52b359ec4d');
    expect(hash('static-assets/assets/figma-icons/membership-task-upgrade.svg')).toBe('d04312d9e5ea39db04ccc4c1ffa7f9684ef7e429a2bfdcb00f218792af8eabfa');
    expect(hash('static-assets/assets/figma-icons/membership-task-checkin.svg')).toBe('98681d63e7bad4f84dc24ae831ceb43d3b2027a8dcf777e1ca9c7ef3905979c1');
    expect(hash('static-assets/assets/figma-icons/membership-task-waiver.svg')).toBe('a68a7318c09096dd2992d7747b339ca7196edae4088fc0709cfda9b65ed7ce2d');
    expect(hash('static-assets/assets/figma-icons/membership-task-quota.svg')).toBe('907091f44db134688232ed5a434558c4fcfc4f1df67f92b604ea48ac26355242');
    expect(script).not.toContain('readNavigationMetrics');
    expect(script).toContain('createBenefitPage');
    expect(script).toContain('benefitApi.summary');
    expect(script).not.toContain('mockApi');
    expect(script).toContain("openStarDetails(){navigateBenefitPage(this,'/pages/star-ledger/index')}");
    expect(script).toMatch(/openShop\(\)\s*\{this\.unavailable\(\)\}/u);
    expect(script).toMatch(/copyInvite\(\)\s*\{this\.unavailable\(\)\}/u);
  });
});
