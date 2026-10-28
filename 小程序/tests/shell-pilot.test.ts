import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { styleValue } from './helpers/style-contract';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');
const pages = ['login', 'profile-edit', 'orders', 'profile', 'withdrawal', 'addresses'] as const;

function rule(style: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return style.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('M2A shell pilot contracts', () => {
  test('uses the system root font and registers the expanded shell consumers', () => {
    for (const page of pages) {
      expect(source(`miniprogram/pages/${page}/index.wxml`).trimStart(), page).toMatch(/^<page-meta root-font-size="system" \/>/);
    }

    const consumers = (component: string) => pages.filter((page) => source(`miniprogram/pages/${page}/index.wxml`).includes(`<${component}`));
    expect(consumers('page-shell')).toEqual(['login', 'profile-edit', 'orders', 'withdrawal', 'addresses']);
    expect(consumers('page-header')).toEqual(pages.filter((page) => page !== 'login'));
    expect(consumers('bottom-actions')).toEqual(['profile-edit', 'withdrawal', 'addresses']);
  });

  test('registers each shared component at the consuming page boundary', () => {
    const expected: Partial<Record<(typeof pages)[number], Record<string, string>>> = {
      login: { 'page-shell': '../../components/page-shell/index' },
      'profile-edit': { 'page-shell': '../../components/page-shell/index', 'bottom-actions': '../../components/bottom-actions/index' },
      orders: { 'page-shell': '../../components/page-shell/index', 'page-header': '../../components/page-header/index' },
      profile: { 'page-header': '../../components/page-header/index' },
      withdrawal: { 'page-shell': '../../components/page-shell/index', 'bottom-actions': '../../components/bottom-actions/index' },
      addresses: { 'page-shell': '../../components/page-shell/index', 'bottom-actions': '../../components/bottom-actions/index' },
    };
    for (const page of pages) {
      const config = JSON.parse(source(`miniprogram/pages/${page}/index.json`)) as { usingComponents?: Record<string, string> };
      expect(config.usingComponents, page).toMatchObject(expected[page] ?? {});
    }
  });

  test('keeps status-view registered for every actual page consumer', () => {
    const statusConsumers = readdirSync(join(root, 'miniprogram/pages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((page) => existsSync(join(root, `miniprogram/pages/${page}/index.wxml`)))
      .filter((page) => source(`miniprogram/pages/${page}/index.wxml`).includes('<status-view'))
      .sort();
    expect(statusConsumers).toEqual(expect.arrayContaining(['addresses', 'orders', 'powder-ledger', 'address-edit', 'coupons']));
    for (const page of statusConsumers) {
      const config = JSON.parse(source(`miniprogram/pages/${page}/index.json`)) as { usingComponents?: Record<string, string> };
      expect(config.usingComponents?.['status-view'], page).toBe('../../components/status-view/index');
    }
  });

  test('has one navigation metrics owner and preserves root/back semantics', () => {
    for (const page of ['login', 'orders', 'profile']) {
      expect(source(`miniprogram/pages/${page}/index.ts`), page).not.toContain('wx.getSystemInfoSync');
      expect(source(`miniprogram/pages/${page}/index.ts`), page).not.toMatch(/statusBarHeight|navigationHeight/);
    }
    const metrics = source('miniprogram/shared/presentation/navigation-metrics.ts');
    expect(metrics).toContain('wx.getWindowInfo()');
    expect(metrics).toContain('wx.getMenuButtonBoundingClientRect()');
    expect(source('miniprogram/components/page-header/index.ts')).toContain('readNavigationMetrics');

    expect(JSON.parse(source('miniprogram/pages/login/index.json')).navigationStyle).toBe('custom');
    expect(source('miniprogram/pages/login/index.wxml')).toContain('<login-sheet id="login-sheet"');
    expect(source('miniprogram/components/login-sheet/index.wxml')).toContain('class="login-backdrop" catchtap="close"');
    expect(source('miniprogram/pages/login/index.ts')).toContain('browseAsGuest()');
    expect(source('miniprogram/pages/orders/index.wxml')).toContain('show-back="{{false}}"');
    expect(source('miniprogram/pages/profile/index.wxml')).toContain('show-back="{{false}}"');
  });

  test('keeps page commands and routes behind the migrated presentation shell', () => {
    const login = source('miniprogram/pages/login/index.ts');
    expect(login).not.toContain('mockApi');
    expect(login).toContain('runLoginSheet(this, () => accountApi.login()');
    expect(login).toContain("wx.switchTab({ url: '/pages/home/index', ...callbacks })");

    const profileEdit = source('miniprogram/pages/profile-edit/index.ts');
    expect(source('miniprogram/pages/profile-edit/index.wxml')).toContain('bindprimary="save"');
    expect(profileEdit).toContain('accountApi.updateProfile');
    expect(profileEdit).not.toContain('mockApi');
    expect(profileEdit).toContain('navigateBackWithFallback');
    expect(profileEdit).toContain('.navigation.navigateOnce(');


    const withdrawal = source('miniprogram/pages/withdrawal/index.ts');
    const withdrawalMarkup = source('miniprogram/pages/withdrawal/index.wxml');
    expect(withdrawalMarkup).toContain('bindprimary="submit"');
    expect(withdrawalMarkup).toContain('bindsecondary="contactSupport"');
    expect(withdrawal).toContain("'/pages/chat/index?mode=support'");
    expect(withdrawal).not.toContain('mockApi');

    const addresses = source('miniprogram/pages/addresses/index.ts');
    expect(source('miniprogram/pages/addresses/index.wxml')).toContain('bindprimary="newAddress"');
    expect(addresses).not.toContain('mockApi');
    expect(addresses).toContain('addressApi.transition');
    expect(addresses).toContain('addressSelected');
    expect(addresses).toContain('/pages/address-edit/index');
    expect(source('miniprogram/pages/address-edit/index.ts')).toContain('addressApi.create');
    expect(addresses).toContain('navigateBackWithFallback');

    const orders = source('miniprogram/pages/orders/index.ts');
    expect(orders).toContain('createRentalOrdersPage');
    expect(source('miniprogram/shared/interaction/order-unavailable.ts')).toContain('/pages/order-detail/index?id=');
    const profile = source('miniprogram/pages/profile/index.ts');
    expect(profile).toContain('connectedRoutes');
    expect(profile).toContain('wx.navigateTo');
  });

  test('keeps migrated bottom actions in document flow with safe-area spacing', () => {
    for (const page of pages) {
      const markup = source(`miniprogram/pages/${page}/index.wxml`);
      expect(markup, page).not.toMatch(/xy-bottom-action|xy-support-fab/);
    }
    const actions = source('miniprogram/components/bottom-actions/index.wxss');
    expect(actions).not.toMatch(/position:\s*fixed/);
    const shell = source('miniprogram/components/page-shell/index.wxss');
    expect(shell).toContain('.page-shell__main { min-height: 0; flex: 1 0 auto; }');
    expect(shell).toContain('.page-shell__footer { position: sticky;');
    expect(shell).toContain('.page-shell__footer--page { background: var(--xy-color-page');
    expect(source('miniprogram/pages/login/index.wxml')).toContain('<login-sheet id="login-sheet"');
    expect(source('miniprogram/components/login-sheet/index.wxml')).toContain('class="login-overlay" role="dialog"');
    expect(source('miniprogram/components/login-sheet/index.wxss')).toContain('env(safe-area-inset-bottom)');
    expect(source('miniprogram/shared/design/components.wxss')).toContain('env(safe-area-inset-bottom)');
  });

  test('locks the 320px and 200% text adaptation contract for the pilot pages', () => {
    const login = source('miniprogram/components/login-sheet/index.wxss');
    expect(rule(login, '.login-sheet')).toMatch(/max-height:\s*calc\(100vh - var\(--xy-control-height-large\)\);\s*overflow-y:\s*auto/);
    expect(login).not.toContain('--xy-fixed-bottom-clearance');
    expect(rule(login, '.agreement-row')).not.toMatch(/white-space:\s*nowrap/);
    expect(rule(login, '.agreement-text')).toMatch(/min-width:\s*0|overflow-wrap:\s*anywhere/);
    expect(rule(login, '.agreement-link-hit')).toContain('min-height: var(--xy-size-touch-min)');
    for (const selector of ['.consent-cancel, .consent-confirm']) {
      expect(rule(login, selector), selector).toContain('min-height: var(--xy-size-touch-min)');
      expect(rule(login, selector), selector).toContain('overflow-wrap: anywhere');
    }
    expect(rule(login, '.quick-button, .phone-button, .guest-button')).toContain('min-height: var(--xy-control-height-large)');
    expect(rule(login, '.quick-button, .phone-button, .guest-button')).toContain('box-sizing: border-box');

    const orders = source('miniprogram/pages/orders/index.wxss');
    expect(orders).not.toMatch(/min-height:\s*100vh|--xy-fixed-bottom-clearance/);
    expect(source('miniprogram/pages/orders/index.wxml')).toContain('bindtap="chooseFilter"');
    const filterPadding = Number.parseFloat(styleValue(orders, '.filter-chip', 'padding'));
    const filterLine = [...styleValue(orders, '.filter-chip', 'line-height').matchAll(/([\d.]+)(px|rem)/g)]
      .reduce((total, match) => total + Number(match[1]) * (match[2] === 'rem' ? 16 : 1), 0);
    const filterMinimum = Number.parseFloat(styleValue(orders, '.filter-chip', 'min-height')) || 0;
    const hitInsets = styleValue(orders, '.filter-chip::before', 'inset').split(/\s+/).map(Number.parseFloat);
    const extraTouch = Number.isFinite(hitInsets[0]) && hitInsets[0]! < 0 ? -2 * hitInsets[0]! : 0;
    expect(Math.max(filterPadding * 2 + filterLine, filterMinimum) + extraTouch).toBeGreaterThanOrEqual(44);
    expect(rule(orders, '.order-card')).toContain('min-height: var(--xy-size-touch-min)');
    expect(source('miniprogram/pages/orders/index.wxml')).toContain('class="order-status order-status--{{item.statusTone}}">{{item.currentNodeText || item.mainStatusText}}');
    expect(styleValue(orders, '.order-card-main', 'min-width')).toBe('0');
    for (const selector of ['.order-card-main', '.order-status']) {
      expect(styleValue(orders, selector, 'text-overflow')).not.toBe('ellipsis');
      expect(styleValue(orders, selector, 'white-space')).not.toBe('nowrap');
      expect(styleValue(orders, selector, 'height')).toBe('');
    }

    const profileEdit = source('miniprogram/pages/profile-edit/index.wxss');
    expect(profileEdit).not.toMatch(/min-height:\s*100vh|--xy-fixed-bottom-clearance/);

    const profile = source('miniprogram/pages/profile/index.wxss');
    for (const selector of ['.profile-state', '.asset-value']) {
      expect(styleValue(profile, selector, 'overflow-wrap'), selector).toBe('anywhere');
      expect(styleValue(profile, selector, 'text-overflow'), selector).not.toBe('ellipsis');
      expect(styleValue(profile, selector, 'white-space'), selector).not.toBe('nowrap');
    }
    expect(rule(profile, '.member-entry')).toContain('min-width: var(--xy-size-touch-min)');
    expect(rule(profile, '.member-entry')).toContain('min-height: var(--xy-size-touch-min)');
    expect(rule(profile, '.profile-entry')).toContain('min-height: var(--xy-size-touch-min)');
    expect(styleValue(profile, '.avatar', 'width')).toBe('52px');
    expect(styleValue(profile, '.avatar', 'height')).toBe('52px');
    expect(rule(profile, '.section-link')).toContain('min-height: var(--xy-size-touch-min)');

    const addresses = source('miniprogram/pages/addresses/index.wxss');
    expect(styleValue(addresses, '.address-actions > .address-action', 'position')).toBe('relative');
    expect(styleValue(addresses, '.touch-overlay', 'position')).toBe('absolute');
    expect(styleValue(addresses, '.touch-overlay', 'min-width')).toBe('44px');
    expect(styleValue(addresses, '.touch-overlay', 'min-height')).toBe('44px');
    expect(styleValue(addresses, '.touch-overlay', 'background')).toBe('transparent');
    const addressMarkup = source('miniprogram/pages/addresses/index.wxml');
    for (const handler of ['setDefault', 'editAddress', 'removeAddress']) {
      const button = addressMarkup.match(new RegExp(`<button\\b[^>]*catchtap="${handler}"[^>]*>`))?.[0] || '';
      expect(button).toContain('class="touch-overlay"');
      expect(button).toContain('data-id="{{item.id}}"');
      expect(button).toMatch(/aria-label="[^"]+"/);
    }

    const header = source('miniprogram/components/page-header/index.wxss');
    const headerMarkup = source('miniprogram/components/page-header/index.wxml');
    for (const [selector, handler] of [['.page-header__back', 'onBack'], ['.page-header__action', 'onAction']] as const) {
      expect(styleValue(header, selector, 'min-width')).toBe('44px');
      expect(Number.parseFloat(styleValue(header, selector, 'height'))).toBeGreaterThanOrEqual(44);
      const button = headerMarkup.match(new RegExp(`<button\\b[^>]*bindtap="${handler}"[^>]*>`))?.[0] || '';
      expect(button).toContain(selector.slice(1));
      expect(button).toMatch(/aria-label="[^"]+"/);
    }
    const primitives = source('miniprogram/shared/design/components.wxss');
    expect(primitives).toMatch(/\.xy-action-primary,[\s\S]*?min-height:\s*var\(--xy-control-height,\s*44px\)/);
  });
});
