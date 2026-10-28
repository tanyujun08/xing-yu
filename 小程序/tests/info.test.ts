import { beforeEach, describe, expect, test } from 'vitest';
import { resetFixture } from '../miniprogram/shared/fixture';
import { infoGuideDirectory, infoGuides, infoGuideView } from '../miniprogram/shared/presentation/info-guides';

beforeEach(() => resetFixture());

describe('information page display data', () => {
  test('keeps the approved static guide entries separate from order state', () => {
    expect(infoGuides.map((guide) => guide.id)).toEqual(['rental-flow', 'deposit-waiver', 'device-protection', 'user-agreement', 'privacy-policy']);
    expect(infoGuides.every((guide) => guide.sections.length > 0)).toBe(true);
  });

  test('keeps the guide directory and detail projections closed to unknown ids', () => {
    expect(infoGuideDirectory().map((entry) => entry.id)).toEqual(['rental-flow', 'deposit-waiver', 'device-protection']);
    expect(infoGuideDirectory().every((entry) => entry.route === '/pages/info-guide/index?id=' + entry.id)).toBe(true);
    expect(infoGuideView('deposit-waiver')).toMatchObject({ title: '押金与免押', kicker: '押金说明' });
    expect(infoGuideView('user-agreement')?.kicker).toBe('用户协议');
    expect(infoGuideView('missing')).toBeUndefined();
  });

  // The order-message and private-conversation projections were retired together with their
  // local fixture: neither feed has a server read model, so there is nothing left to assert.
});
