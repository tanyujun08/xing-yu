import { readFileSync, statSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { offlineMembershipLevel } from '../miniprogram/preview/membership-levels';

test('membership uses the shared native theme and three daily shortcuts', () => {
  const root = 'miniprogram/pages/membership/index';
  const view = readFileSync(root + '.wxml', 'utf8');
  const style = readFileSync(root + '.wxss', 'utf8');
  const config = JSON.parse(readFileSync(root + '.json', 'utf8'));

  expect(config.navigationStyle).toBe('custom');
  expect(config.usingComponents['page-header']).toBe('../../components/page-header/index');
  expect(style).toContain('member-center.wxss');
  expect(view).toContain('title="会员中心"');
  expect(view).not.toContain('dailyCheckInReward');
  expect(view).toContain('bindtap="openCheckIn"');
  expect(view).toContain('bindtap="openLottery"');
  expect(view).toContain('bindtap="openShop"');
  expect(view.match(/bindtap="openTask"/g)).toHaveLength(1);
  expect(view.match(/bindtap="openDailyTasks"/g)).toHaveLength(1);
  const taskCenter = view.slice(view.indexOf('任务中心'), view.indexOf('我的权益'));
  expect(taskCenter).toContain('升级任务');
  expect(taskCenter).toContain('每日星光任务');
  expect(taskCenter).toContain('bindtap="openDailyTasks"');
  expect(view).toContain('bindtap="openStarDetails"');
  expect(view).toContain('bindtap="openBalanceDetails"');
});

test('offline tiers and upgrade content follow the HTML prototype thresholds', () => {
  const belowGold = offlineMembershipLevel('99999');
  expect(belowGold).toMatchObject({
    tierKey: 'silver', starPoints: '9,999.9', nextLevel: '黄金', remainingPoints: '0.1',
  });
  expect(belowGold.progress).toBeLessThan(100);

  const gold = offlineMembershipLevel('100000');
  expect(gold).toMatchObject({
    tierKey: 'gold', progress: 0, remainingPoints: '10,000', nextThreshold: '20,000',
    rightsCaption: '当前 6 项权益 · 铂金 8 项',
    heroVisual: { src: '/assets/membership/levels/gold.png', showStand: false },
    panelVisual: { src: '/assets/membership/levels/platinum.png', showStand: false },
  });
  expect(gold.levels.find(level => level.state === 'current')?.key).toBe('gold');
  expect(gold.levels.find(level => level.next)?.statusLabel).toBe('还需 10,000');
  expect(gold.levels.map(level => level.threshold)).toEqual(['0', '5,000', '10,000', '20,000', '30,000', '50,000', '80,000']);
  expect(gold.nextArt).toBe('/assets/membership/platinum.png');

  const royal = offlineMembershipLevel('800000');
  expect(royal).toMatchObject({ tierKey: 'royal', atMaxLevel: true, hasNextLevel: false, nextArt: '', progress: 100, rightsCaption: '王者会员可享 14 项专属权益' });
  expect(royal.panelVisual).toEqual(royal.heroVisual);
  for (const tier of royal.levels) {
    expect(statSync('miniprogram/assets/membership/' + tier.key + '.png').size).toBeGreaterThan(0);
  }
});

test('membership headers keep their scroll background when a page is hidden and shown again', async () => {
  type ScrollPage = {
    data: { headerScrolled: boolean };
    setData(patch: Partial<ScrollPage['data']>): void;
    onPageScroll(event: { scrollTop: number }): void;
    onHide(): void;
    onUnload(): void;
  };
  const pages: ScrollPage[] = [];
  vi.stubGlobal('Page', (page: ScrollPage) => pages.push(page));
  try {
    await import('../miniprogram/pages/membership/index');
    await import('../miniprogram/pages/level-rights/index');
    expect(pages).toHaveLength(2);
    for (const definition of pages) {
      const page = {
        ...definition,
        data: { ...definition.data },
        setData(patch: Partial<ScrollPage['data']>) { Object.assign(this.data, patch); },
      };
      expect(page.data.headerScrolled).toBe(false);
      page.onPageScroll({ scrollTop: 32 });
      expect(page.data.headerScrolled).toBe(true);
      page.onHide();
      expect(page.data.headerScrolled).toBe(true);
      page.onPageScroll({ scrollTop: 0 });
      expect(page.data.headerScrolled).toBe(false);
      page.onUnload();
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
