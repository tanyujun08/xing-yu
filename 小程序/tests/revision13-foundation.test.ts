import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('XY-20260903-001 revision 13 foundation contracts', () => {
  test('keeps app.wxss as the only runtime token authority, including the closed member theme', () => {
    const app = read('miniprogram/app.wxss');
    const memberCompatibility = read('miniprogram/shared/design/member-tokens.wxss');
    const memberDeclarations = [...app.matchAll(/--xy-member-[a-z0-9-]+\s*:/gu)].map((match) => match[0]);

    expect(memberCompatibility.trim()).toBe('/* Compatibility import only. Runtime values live in app.wxss. */');
    expect(memberDeclarations).toHaveLength(115);
    expect(new Set(memberDeclarations).size).toBe(memberDeclarations.length);
    expect(app).toContain('--xy-text-asset-summary-size: 28px;');
    expect(app).toContain('--xy-text-operations-hero-size: 40px;');
    expect(app).toContain('--xy-size-icon-entry-block: 40px;');
    expect(app).toContain('--xy-size-icon-entry-glyph: 24px;');
    expect(app).not.toMatch(/--xy-member-(?:text|border|coupon|record)-/u);
  });

  test('locks the shared relationship, divider, amount, safe-area and flow-rail owners', () => {
    const shared = read('miniprogram/shared/design/components.wxss');
    const shell = read('miniprogram/components/page-shell/index.wxss');
    const actions = shared.match(/\.xy-bottom-actions \{[^}]+\}/su)?.[0] ?? '';

    expect(shared).toMatch(/\.xy-icon-entry__carrier \{[^}]*--xy-size-icon-entry-block/su);
    expect(shared).toMatch(/\.xy-icon-entry__glyph \{[^}]*--xy-size-icon-entry-glyph/su);
    expect(shared).toMatch(/\.xy-icon-entry__detail \{[^}]*--xy-gap-title-description/su);
    expect(shared).toMatch(/\.xy-list-row:not\(:last-child\)::after \{[^}]*right: 0;[^}]*left: 0;/su);
    expect(shared).toMatch(/\.xy-sparse-card \{[^}]*padding: var\(--xy-inset-card[^}]*border: 0;[^}]*box-shadow: none;/su);
    expect(shared).toContain('.xy-price--end { justify-content: flex-end; text-align: right; }');
    expect(shared).toMatch(/\.xy-price__meta--critical \{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/su);
    expect(actions).not.toContain('safe-area-inset-bottom');
    expect(shell).toMatch(/\.page-shell__footer \{[^}]*padding-bottom: env\(safe-area-inset-bottom\)/su);
    expect(shared).toMatch(/\.xy-flow-node\.is-current::after \{[^}]*--xy-color-brand/su);
    expect(shared).toMatch(/\.xy-flow-node\.is-unknown::after \{[^}]*--xy-color-border-strong[^}]*--xy-color-surface/su);
  });

  test('uses the 24 viewBox icon grammar while preserving Figma intrinsic assets', () => {
    const iconDirectory = join(root, 'static-assets/assets/figma-icons');
    const files = readdirSync(iconDirectory).filter((file) => file.endsWith('.svg')).sort();
    const intrinsic = new Set([
      'membership-hero-decoration.svg',
      'membership-balance-checkin.svg',
      'membership-balance-diamond.svg',
      'membership-balance-shop.svg',
      'membership-arrow-right.svg',
      'membership-task-checkin.svg',
      'membership-task-quota.svg',
      'membership-task-upgrade.svg',
      'membership-task-waiver.svg',
      'profile-avatar-default.svg',
      'profile-rental-camera.svg',
      'profile-publish-filled.svg',
    ]);

    expect(files.length).toBeGreaterThan(intrinsic.size);
    expect(files).toEqual(expect.arrayContaining([...intrinsic]));
    for (const file of files) {
      const svg = read(`static-assets/assets/figma-icons/${file}`);
      if (intrinsic.has(file)) continue;
      expect(svg, file).toContain('viewBox="0 0 24 24"');
      expect(svg, file).not.toContain('preserveAspectRatio="none"');
      for (const match of svg.matchAll(/stroke-width="([^"]+)"/gu)) expect(match[1], file).toBe('1.8');
    }

    for (const file of files.filter((file) => file.startsWith('profile-') && !intrinsic.has(file) && file !== 'profile-member-star.svg')) {
      expect(read(`static-assets/assets/figma-icons/${file}`), file).not.toContain('#0A7F5E');
    }
    const assets = read('miniprogram/shared/design/assets.ts');
    expect(assets).toContain("membershipArrowRight: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/miniprogram-static/v1.0.1.3/d560ec453d9c547dbef85e45e3e01fa0123b3f5e6a7338e472120c52b359ec4d/assets/figma-icons/membership-arrow-right.svg'");
    expect(assets).toContain("membershipBalanceArrow: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/miniprogram-static/v1.0.1.3/a4fa50358c7e250e722b6d8032fba6ab0d09f02e811cf98631591e4abd2c9e57/assets/figma-icons/membership-balance-arrow.svg'");
    expect(assets).toContain("membershipBalanceCheckin: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/miniprogram-static/v1.0.1.3/ecd64bb17624f9cd050565323af671ca6e9fbc7fd550a7fbacd3fcdc86047f7a/assets/figma-icons/membership-balance-checkin.svg'");
  });

  test('keeps member geometry and type on shared semantic roles', () => {
    const member = read('miniprogram/shared/design/member-subpage.wxss');
    expect(member).toMatch(/\.member-subpage__hero \{[^}]*border: 0;[^}]*box-shadow: none;/su);
    expect(member).toMatch(/\.member-subpage__surface \{[^}]*border: 0;[^}]*box-shadow: none;/su);
    expect(member).toMatch(/\.member-subpage__row:not\(:last-child\)::after \{[^}]*right: 0;[^}]*left: 0;/su);
    expect(member).toMatch(/\.member-subpage__icon-box \{[^}]*--xy-size-icon-entry-block/su);
    expect(member).toMatch(/\.member-subpage__icon \{[^}]*--xy-size-icon-entry-glyph/su);
    expect(member).not.toMatch(/(?:font-size|line-height|font-weight|letter-spacing):\s*(?:-?\d|SF Pro)/u);
  });
});
