import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');

describe('XY-20260903-001 revision 14 design-source and role contracts', () => {
  test('keeps one runtime authority for first-block, object, media, carrier and elevation roles', () => {
    const app = read('miniprogram/app.wxss');
    const compatibility = read('miniprogram/shared/design/member-tokens.wxss');

    expect(compatibility.trim()).toBe('/* Compatibility import only. Runtime values live in app.wxss. */');
    expect(app).toContain('--xy-layout-first-block-gap: var(--xy-space-3);');
    expect(app).toContain('--xy-layout-first-block-gap-form: var(--xy-space-4);');
    expect(app).toContain('--xy-border-object-card-width: 1px;');
    expect(app).toContain('--xy-product-list-media-size-compact: 82px;');
    expect(app).toContain('--xy-size-icon-entry-block: 40px;');
    expect(app).toContain('--xy-size-icon-entry-block-compact: 36px;');
    expect(app).toContain('--xy-size-icon-entry-glyph-compact: 24px;');
    expect(app).toContain('--xy-size-icon-entry-copy-compact: 42px;');
    expect(app).toContain('--xy-shadow-card: none;');
    expect(app).toContain('--xy-shadow-banner: 0 4px 12px rgba(18, 28, 26, .08);');
    expect(app).toContain('--xy-shadow-floating-action: 0 8px 20px rgba(18, 28, 26, .12);');
    expect(app).toContain('--xy-shadow-overlap-card: 0 8px 24px rgba(0, 0, 0, .14);');
    expect(app).toContain('--xy-member-shadow-balance: var(--xy-shadow-overlap-card);');
  });

  test('keeps role variants explicit while ordinary defaults remain undecorated', () => {
    const app = read('miniprogram/app.wxss');
    const shared = read('miniprogram/shared/design/components.wxss');
    const storeCard = shared.match(/\.xy-store-item--object-card \{[^}]+\}/su)?.[0] ?? '';

    expect(app).toContain('.xy-card { border: 0; border-radius: var(--xy-radius-container, 6px); background: var(--xy-color-surface, #fff); box-shadow: none; }');
    expect(storeCard).toContain('padding: var(--xy-inset-card, 12px)');
    expect(storeCard).toContain('border: var(--xy-border-object-card-width, 1px) solid var(--xy-color-border, #e2e6e5)');
    expect(storeCard).not.toContain('box-shadow');
    expect(shared).toMatch(/\.xy-product-item:not\(:last-child\)::after \{[^}]*border-bottom: 1rpx dashed var\(--xy-color-divider/su);
    expect(shared).toMatch(/\.xy-product-item--media-82:not\(:last-child\)::after \{[^}]*left: calc\(var\(--xy-product-list-media-size-compact/su);
    expect(shared).toMatch(/\.xy-product-item--media-82 > \.xy-product-item__media \{[^}]*width: var\(--xy-product-list-media-size-compact[^}]*height: var\(--xy-product-list-media-size-compact/su);
    expect(shared).toContain('.xy-elevation-banner { box-shadow: var(--xy-shadow-banner, none); }');
    expect(shared).toContain('.xy-elevation-floating-action { box-shadow: var(--xy-shadow-floating-action, none); }');
    expect(shared).toContain('.xy-elevation-overlap-card { box-shadow: var(--xy-shadow-overlap-card, none); }');
  });

  test('keeps 36 and 40 visible carriers inside an independent 44px hit contract', () => {
    const shared = read('miniprogram/shared/design/components.wxss');

    expect(shared).toMatch(/\.xy-icon-entry \{[^}]*min-height: var\(--xy-control-hit-size, 44px\)[^}]*align-items: center;/su);
    expect(shared).toMatch(/\.xy-icon-entry--prominent \.xy-icon-entry__carrier \{[^}]*--xy-size-icon-entry-block, 40px/su);
    expect(shared).toMatch(/\.xy-icon-entry--compact \.xy-icon-entry__carrier \{[^}]*--xy-size-icon-entry-block-compact, 36px/su);
    expect(shared).toMatch(/\.xy-icon-entry--compact \.xy-icon-entry__glyph \{[^}]*--xy-size-icon-entry-glyph-compact, 24px/su);
    expect(shared).toMatch(/\.xy-icon-entry--compact \.xy-icon-entry__copy \{[^}]*min-height: var\(--xy-size-icon-entry-copy-compact, 42px\)[^}]*justify-content: center;/su);
  });

  test('keeps the Policy partition immutable and exercises named roles through existing checker fixtures', () => {
    const policy = JSON.parse(read('config/miniprogram-architecture-policy.json')) as {
      exceptions: unknown[];
      retiredLegacyIdentityDigests: string[];
    };
    const architecture = read('docs/architecture/miniprogram-architecture.md');
    const tokenAccept = read('tests/fixtures/miniprogram-architecture/MPA-TOKEN-001.accept.json');
    const tokenReject = read('tests/fixtures/miniprogram-architecture/MPA-TOKEN-001.reject.json');
    const typeAccept = read('tests/fixtures/miniprogram-architecture/MPA-TYPE-001.accept.json');
    const typeReject = read('tests/fixtures/miniprogram-architecture/MPA-TYPE-001.reject.json');

    expect(policy.exceptions.length + policy.retiredLegacyIdentityDigests.length).toBe(690);
    expect(new Set(policy.retiredLegacyIdentityDigests).size).toBe(policy.retiredLegacyIdentityDigests.length);
    expect(architecture).toContain('live 与 retired 的合计保持 690');
    expect(tokenAccept).toContain('var(--xy-shadow-banner)');
    expect(tokenAccept).toContain('var(--xy-shadow-floating-action)');
    expect(tokenAccept).toContain('var(--xy-shadow-overlap-card)');
    expect(tokenReject).toContain('raw-named-elevation-values');
    expect(typeAccept).toContain('var(--xy-size-icon-entry-block-compact)');
    expect(typeReject).toContain('compact-visible-shell-used-as-hit-target');
  });
});
