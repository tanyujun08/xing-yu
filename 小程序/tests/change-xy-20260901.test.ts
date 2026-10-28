import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { resetFixture, simulateMockProcessRestartForTest, getCurrentMockAccount, listMockAccounts, updateCurrentMockProfile, getCurrentMockProfile, switchMockAccount } from '../miniprogram/shared/fixture';

const root = process.cwd();
const miniRoot = join(root, 'miniprogram');
const targetPages = [
  'profile', 'profile-edit', 'account-security', 'about', 'wallet', 'withdrawal', 'identity', 'addresses',
  'device-orders', 'no-deposit', 'publish-eligibility', 'listings', 'publish-quota', 'rental-service',
  'powder-ledger', 'powder-mall', 'lottery', 'check-in',
];

const source = (path: string) => readFileSync(join(root, path), 'utf8');

beforeEach(() => resetFixture());

describe('XY-20260901-001 mine-page migration', () => {
  test('registers the three independent pages and keeps the powder asset entry on membership', () => {
    const app = JSON.parse(source('miniprogram/app.json')) as { pages: string[] };
    expect(app.pages).toEqual(expect.arrayContaining([
      'pages/profile-edit/index',
      'pages/account-security/index',
      'pages/about/index',
    ]));
    expect(source('miniprogram/app.ts')).toContain("version: '1.0.1.7'");
    const profile = source('miniprogram/pages/profile/index.ts');
    expect(profile).toContain("/pages/membership/index");
    expect(profile).toContain("route: '/pages/account-security/index'");
    expect(profile).toContain("route: '/pages/about/index'");
  });

  test('persists nickname and avatar independently for each local account', () => {
    const first = getCurrentMockAccount();
    const businessAccountName = first.name;
    const second = listMockAccounts().find((account) => account.id !== first.id)!;
    expect(updateCurrentMockProfile({ name: '本地昵称甲', avatarPath: 'wxfile://profile-a.webp' })).toMatchObject({ accountId: first.id, name: '本地昵称甲', avatarPath: 'wxfile://profile-a.webp' });
    simulateMockProcessRestartForTest();
    expect(getCurrentMockProfile()).toMatchObject({ accountId: first.id, name: '本地昵称甲', avatarPath: 'wxfile://profile-a.webp' });
    expect(getCurrentMockAccount().name).toBe(businessAccountName);

    expect(switchMockAccount(second.id)).toBe(true);
    expect(getCurrentMockProfile().avatarPath).toBe('');
    expect(updateCurrentMockProfile({ name: '本地昵称乙', avatarPath: 'wxfile://profile-b.webp' })).toMatchObject({ accountId: second.id, name: '本地昵称乙', avatarPath: 'wxfile://profile-b.webp' });
    expect(switchMockAccount(first.id)).toBe(true);
    expect(getCurrentMockProfile()).toMatchObject({ accountId: first.id, name: '本地昵称甲', avatarPath: 'wxfile://profile-a.webp' });
  });

  test('preserves the approved transparent untitled membership header and live account projections', () => {
    const markup = source('miniprogram/pages/membership/index.wxml');
    const script = source('miniprogram/pages/membership/index.ts');
    const header = markup.match(/<page-header\b[^>]*>/)?.[0];
    expect(header).toContain('title=""');
    expect(header).toContain('background="transparent"');
    expect(header).toContain('aria-label="会员中心"');
    expect(header).toContain('bind:back="goBack"');
    for (const field of ['starPoints', 'diamonds', 'progressPercent', 'nextLevelPoints']) expect(markup).toContain(`{{${field}}}`);
    expect(script).toContain('createBenefitPage'); expect(script).not.toContain('mockApi');
    for (const destination of ['check-in', 'level-rights']) expect(script).toContain(`/pages/${destination}/index`);
    expect(JSON.parse(source('miniprogram/pages/membership/index.json')).usingComponents['page-header']).toBe('../../components/page-header/index');
  });

  test('registers all nine HTML source assets without recompression', () => {
    const assets = source('miniprogram/shared/design/assets.ts');
    const expected = new Map([
      ['profile-scene.webp', 35_856],
      ['powder-ledger-hero.webp', 50_724],
      ['powder-mall-hero.webp', 75_700],
      ['powder-mall-coupon-10.webp', 23_468],
      ['powder-mall-coupon-20.webp', 30_570],
      ['powder-mall-after-sale.webp', 46_620],
      ['powder-mall-express-10.webp', 56_072],
      ['lottery-hero.webp', 79_882],
      ['check-in-hero.webp', 87_444],
    ]);
    for (const [name, bytes] of expected) {
      const file = join(miniRoot, '..', 'static-assets', 'assets', 'figma-media', name);
      expect(existsSync(file), name).toBe(true);
      expect(statSync(file).size, name).toBe(bytes);
      expect(assets, name).toContain(`/assets/figma-media/${name}`);
    }
  });

  test('uses native APIs and project tokens across every migrated page', () => {
    const combined = targetPages.flatMap((page) => [
      source(`miniprogram/pages/${page}/index.ts`),
      source(`miniprogram/pages/${page}/index.wxml`),
      source(`miniprogram/pages/${page}/index.wxss`),
    ]).join('\n');
    expect(combined).not.toMatch(/\b(?:window|document|querySelector|localStorage)\b/);
    expect(combined).not.toContain('1,278');
    expect(combined).not.toContain('08-30 03:03');
    for (const page of targetPages) {
      const style = source(`miniprogram/pages/${page}/index.wxss`);
      expect(style, page).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(style, page).not.toMatch(/append\s+override/i);
    }
  });

  test('retains wallet and benefit command boundaries while adding HTML interactions', () => {
    expect(source('miniprogram/pages/wallet/index.ts')).not.toContain('openWithdrawal');expect(source('miniprogram/pages/wallet/index.ts')).toContain('rentalOrderApi.income()');
    expect(source('miniprogram/pages/withdrawal/index.ts')).toContain('submit()');
    const mall = source('miniprogram/pages/powder-mall/index.ts');
    expect(mall).toContain('createBenefitPage');
    expect(mall).toContain('accountApi.sessionIdentity');
    expect(mall).toContain('benefitApi.summary');
    expect(mall).toContain('available_pink_units');
    expect(mall).not.toContain('mockApi');
    expect(mall).not.toContain('redeemCoupon');
    expect(source('miniprogram/pages/lottery/index.ts')).toContain('lotteryApi.submit');
    expect(source('miniprogram/pages/check-in/index.ts')).toContain('benefitApi.checkIn');
    expect(source('miniprogram/pages/powder-ledger/index.wxml')).toMatch(/<section-tabs\b[^>]*value="\{\{ledgerFilter\}\}"[^>]*bindchange="setLedgerFilter"/);
    expect(source('miniprogram/pages/powder-ledger/index.ts')).toContain("id: 'income'");
    expect(source('miniprogram/pages/check-in/index.ts')).toContain('benefitApi.month');
    expect(source('miniprogram/pages/check-in/index.ts')).toContain('benefitApi.rule');
    expect(source('miniprogram/pages/check-in/index.ts')).not.toContain('mockApi');
  });
});
