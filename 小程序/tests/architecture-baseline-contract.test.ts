import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const splitDigests = (value: string) => value.match(/.{64}/gu) ?? [];
const policy = JSON.parse(read('config/miniprogram-architecture-policy.json')) as {
  legacyBaselineGovernedWxmlPaths: string[];
  retiredMigrationWxmlPaths: string[];
  visualOnlyMigrationWxmlPaths: string[];
  newlyGovernedWxmlPaths: string[];
  legacyBaselineSourceIdentityCount: number;
  legacyBaselineSourceIdentityDigests: string;
  legacyBaselineSourceIdentityManifestSha256: string;
  legacyBaselineDirectDiagnostic: { rawFindingCount: number; waivableFindingCount: number };
  legacyBaselineIdentityCount: number;
  legacyBaselineIdentityManifestSha256: string;
  legacyBaselineIdentityDigests: string;
  retiredLegacyIdentityDigests: string[];
  exceptions: Array<{ ruleId: string; path: string; fingerprint: string }>;
};

const expectedGovernedWxmlPaths = [
  'miniprogram/pages/addresses/index.wxml',
  'miniprogram/pages/cabinet-pickup/index.wxml',
  'miniprogram/pages/cabinet-return/index.wxml',
  'miniprogram/pages/login/index.wxml',
  'miniprogram/pages/orders/index.wxml',
  'miniprogram/pages/powder-ledger/index.wxml',
  'miniprogram/pages/powder-mall/index.wxml',
  'miniprogram/pages/profile-edit/index.wxml',
  'miniprogram/pages/profile/index.wxml',
  'miniprogram/pages/withdrawal/index.wxml',
];

describe('normalized 1.0.0.13 architecture baseline contract', () => {
  test('locks one 241-source replay and its exact ten in-memory page-meta paths', () => {
    expect(policy.legacyBaselineGovernedWxmlPaths).toEqual(expectedGovernedWxmlPaths);
    const sourceIdentities = splitDigests(policy.legacyBaselineSourceIdentityDigests);
    expect(policy.legacyBaselineSourceIdentityCount).toBe(241);
    expect(sourceIdentities).toHaveLength(241);
    expect(new Set(sourceIdentities).size).toBe(241);
    expect(sourceIdentities).toEqual([...sourceIdentities].sort());
    expect(sha256(policy.legacyBaselineSourceIdentityDigests)).toBe('6c43ccd8e93068dfafdceeb8f9ec54d8ccdfd33f788360a9118cb806befe89fc');
    expect(policy.legacyBaselineSourceIdentityManifestSha256).toBe('6c43ccd8e93068dfafdceeb8f9ec54d8ccdfd33f788360a9118cb806befe89fc');
    expect(policy.legacyBaselineDirectDiagnostic).toEqual({ rawFindingCount: 562, waivableFindingCount: 560 });
  });

  test('preserves all 690 normalized identities when repaired exceptions are retired', () => {
    const live = splitDigests(policy.legacyBaselineIdentityDigests);
    const retired = policy.retiredLegacyIdentityDigests;
    const baseline = [...live, ...retired].sort();
    const exceptionDigests = policy.exceptions.map((item) => sha256(['mpa-legacy-exception-v1', item.ruleId, item.path, item.fingerprint].join('\0'))).sort();
    expect(live).toEqual(exceptionDigests);
    expect(live.length + retired.length).toBe(690);
    expect(new Set([...live, ...retired]).size).toBe(690);
    expect(retired).toEqual([...retired].sort());
    expect(policy.legacyBaselineIdentityCount).toBe(690);
    expect(sha256(baseline.join(''))).toBe('705a02d06b9b9465e5f63a32f0fb4b4c6e316edf1728df9af6d1fb845601b33f');
    expect(policy.legacyBaselineIdentityManifestSha256).toBe('705a02d06b9b9465e5f63a32f0fb4b4c6e316edf1728df9af6d1fb845601b33f');
    const declaredLive = policy.exceptions.map((exception) => sha256([
      'mpa-legacy-exception-v1',
      exception.ruleId,
      exception.path,
      exception.fingerprint,
    ].join('\0'))).sort();
    expect(declaredLive.join('')).toBe(policy.legacyBaselineIdentityDigests);
  });

  test('covers every registered route with one migration authority without overlap', () => {
    const app = JSON.parse(read('miniprogram/app.json')) as { pages: string[] };
    const governed = new Set(policy.legacyBaselineGovernedWxmlPaths.filter(path => !policy.retiredMigrationWxmlPaths.includes(path)));
    const visualOnly = new Set(policy.visualOnlyMigrationWxmlPaths);
    const expected = app.pages.map((route) => `miniprogram/${route}.wxml`).sort();
    expect([...governed].filter((sourcePath) => visualOnly.has(sourcePath))).toEqual([]);
    const declared = [...governed, ...visualOnly, ...policy.newlyGovernedWxmlPaths];
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared.sort()).toEqual(expected);
    expect(policy.newlyGovernedWxmlPaths).toEqual(['miniprogram/pages/address-edit/index.wxml', 'miniprogram/pages/admin-approval/index.wxml', 'miniprogram/pages/contract-sign/index.wxml', 'miniprogram/pages/coupon-detail/index.wxml', 'miniprogram/pages/coupons/index.wxml', 'miniprogram/pages/order-fees/index.wxml']);
    expect(policy.visualOnlyMigrationWxmlPaths).toContain('miniprogram/pages/cabinet-code/index.wxml');
  });

  test('retired pickup is truly removed and re-registration or any surviving entry file fails closed', async () => {
    const checkerPath = '../scripts/check-miniprogram-architecture.mjs';
    const { evaluateRepository, readPolicy } = await import(checkerPath);
    expect(policy.retiredMigrationWxmlPaths).toEqual(['miniprogram/pages/cabinet-pickup/index.wxml']);
    for (const extension of ['ts', 'wxml', 'wxss', 'json']) expect(existsSync(join(root, 'miniprogram/pages/cabinet-pickup/index.' + extension))).toBe(false);
    const app = JSON.parse(read('miniprogram/app.json')) as { pages: string[] };
    const files = new Map([['miniprogram/app.json', JSON.stringify(app)]]);
    const routeFindings = (sources: Map<string, string>) => evaluateRepository(sources, policy).active.filter((item: { fingerprint: string; message: string }) => /Registered pages|Retired cabinet-pickup/.test(item.message));
    expect(routeFindings(files)).toEqual([]);
    const registered = new Map(files); registered.set('miniprogram/app.json', JSON.stringify({ ...app, pages: [...app.pages, 'pages/cabinet-pickup/index'] }));
    expect(routeFindings(registered)).toHaveLength(1);
    for (const extension of ['ts', 'wxml', 'wxss', 'json']) { const residue = new Map(files); residue.set('miniprogram/pages/cabinet-pickup/index.' + extension, ''); expect(routeFindings(residue)).toHaveLength(1); }
    const arbitrary = structuredClone(policy); arbitrary.retiredMigrationWxmlPaths.push('miniprogram/pages/orders/index.wxml');
    expect(() => readPolicy(new Map([['config/miniprogram-architecture-policy.json', JSON.stringify(arbitrary)]]))).toThrow(/explicitly removed/);
  });

  test('keeps Mock-only network reachability inside the non-waivable authority rule', () => {
    const checker = read('scripts/check-miniprogram-architecture.mjs');
    const authorityAccept = read('tests/fixtures/miniprogram-architecture/MPA-AUTH-001.accept.json');
    const authorityReject = JSON.parse(read('tests/fixtures/miniprogram-architecture/MPA-AUTH-001.reject.json')) as { cases: Array<{ name: string }> };
    const fixtureNames = readdirSync(join(root, 'tests/fixtures/miniprogram-architecture'));
    expect(checker).not.toContain('MPA-MOCK-001');
    expect(fixtureNames.some((name) => name.startsWith('MPA-MOCK-001.'))).toBe(false);
    expect(authorityAccept).toContain('miniprogram/shared/api/request.ts');
    expect(authorityReject.cases.map((item) => item.name)).toEqual(expect.arrayContaining([
      'mock-app-direct-request',
      'mock-page-indirect-dormant-import',
      'mock-upload-and-socket-host-apis',
    ]));
    expect(checker.match(/return \[\.\.\.findings, \.\.\.evaluateMigrationRouteCoverage\(files, policy\), \.\.\.evaluateMockOnly\(files, policy\)\];/gu)).toHaveLength(2);
  });

  test('keeps ordinary verification independent from Git replay', () => {
    const checker = read('scripts/check-miniprogram-architecture.mjs');
    expect(checker).not.toMatch(/node:child_process|execFileSync|spawnSync/gu);
  });

  test('accepts all 690 retired identities with no live exceptions and rejects incomplete or damaged partitions', async () => {
    const checkerPath = '../scripts/check-miniprogram-architecture.mjs';
    const { readPolicy } = await import(checkerPath);
    const validate = (candidate: typeof policy) => readPolicy(new Map([
      ['config/miniprogram-architecture-policy.json', JSON.stringify(candidate)],
    ]));
    expect(policy.legacyBaselineIdentityDigests).toBe('');
    expect(policy.exceptions).toEqual([]);
    expect(policy.retiredLegacyIdentityDigests).toHaveLength(690);
    expect(() => validate(policy)).not.toThrow();

    const missing = structuredClone(policy);
    missing.retiredLegacyIdentityDigests.pop();
    expect(() => validate(missing)).toThrow(/live\/retired partition/);
    const duplicate = structuredClone(policy);
    duplicate.retiredLegacyIdentityDigests[1] = duplicate.retiredLegacyIdentityDigests[0]!;
    expect(() => validate(duplicate)).toThrow(/unique sorted/);
    const damaged = structuredClone(policy);
    damaged.retiredLegacyIdentityDigests[0] = '0'.repeat(64);
    expect(() => validate(damaged)).toThrow(/live\/retired partition/);
  });
});
