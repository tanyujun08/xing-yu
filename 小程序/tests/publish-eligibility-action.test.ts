import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { PublicationEligibility } from '../miniprogram/shared/api/publication-api';

interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
interface Wire { url: string; header: Record<string, string>; success(response: unknown): void }
let definition: Harness; let owner: string | null; let failure = false;
let projection: PublicationEligibility;
const navigateTo = vi.fn(); const showToast = vi.fn(); const wires: Wire[] = [];
function eligible(): PublicationEligibility { return { eligible: true, blocking_reasons: [], eligibility_rule_version_id: 'eligibility-v1', agreement_rule_version_id: 'agreement-v1', membership_rule_version_id: 'membership-v1', minimum_level_code: 'L3', current_level_code: 'L3', identity_check_kind: 'FACE', identity_check_id: 'identity-1', publish_quota_available: '1', publish_quota_account_as_of_at: '2026-09-23T00:00:00Z', publish_quota_expiry_pending: false, agreements: [], assets: { total_count: '0', online_count: '0', editable_draft_count: '0' }, as_of_at: '2026-09-23T00:00:00Z', requirements: [
  { code: 'MEMBERSHIP_LEVEL', status: 'SATISFIED', required: true, current_value: 'L3', required_value: 'L3', action: 'OPEN_MEMBERSHIP' },
  { code: 'IDENTITY_VERIFICATION', status: 'SATISFIED', required: true, current_value: null, required_value: 'FACE', action: 'OPEN_IDENTITY' },
  { code: 'PUBLISH_QUOTA', status: 'SATISFIED', required: true, current_value: '1', required_value: '1', action: 'OPEN_PUBLISH_QUOTA' },
] }; }
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/publish-eligibility/index'); });
beforeEach(() => {
  owner = 'owner-a'; failure = false; projection = eligible(); wires.length = 0; navigateTo.mockClear(); showToast.mockClear();
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60000 } : null,
    removeStorageSync: () => { owner = null; }, navigateTo, showToast, showModal: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(),
    request: (wire: Wire) => {
      wires.push(wire);
      wire.success({ statusCode: failure ? 503 : 200, data: failure ? { code: 'DEPENDENCY_UNAVAILABLE', message: '资格服务不可用', request_id: 'eligibility' }
        : wire.url.endsWith('/v1/me/publication-eligibility') ? projection : { profile: { account_id: owner }, entitlements: [{ kind: 'CONTRACT', available_qty: '2', expiry_pending: false }] }, header: {}, cookies: [] });
      return { abort: vi.fn() };
    },
  });
});
afterAll(() => vi.unstubAllGlobals());
function page(): Harness { return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; }
function call(target: Harness, name: string) { return (target[name] as () => unknown).call(target); }
async function tick() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
test('server eligibility alone opens publishing and click rereads current authority', async () => {
  const target = page(); call(target, 'onShow'); await tick();
  expect(wires.some((wire) => wire.url.endsWith('/v1/me/publication-eligibility'))).toBe(true);
  expect(target.data).toMatchObject({ publishEnabled: true, primaryRoute: '/pages/publish/index' });
  await call(target, 'publish'); expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/publish/index' });
  expect(wires.filter((wire) => wire.url.endsWith('/v1/me/publication-eligibility'))).toHaveLength(2);
});
test('blocked server requirement routes only to a real supported action', async () => {
  projection = { ...eligible(), eligible: false, blocking_reasons: ['MEMBERSHIP_LEVEL_INSUFFICIENT'], requirements: [
    { code: 'MEMBERSHIP_LEVEL', status: 'BLOCKED', required: true, current_value: 'L2', required_value: 'L3', action: 'OPEN_MEMBERSHIP' },
  ] };
  const target = page(); call(target, 'onShow'); await tick();
  expect(target.data).toMatchObject({ publishEnabled: false, primaryRoute: '/pages/membership/index' });
  await call(target, 'publish'); expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/membership/index' });
});
test('identity blocker never sends user to the old Mock identity completion page', async () => {
  projection = { ...eligible(), eligible: false, blocking_reasons: ['IDENTITY_VERIFICATION_REQUIRED'], requirements: [
    { code: 'IDENTITY_VERIFICATION', status: 'BLOCKED', required: true, current_value: null, required_value: 'FACE', action: 'OPEN_IDENTITY' },
  ] };
  const target = page(); call(target, 'onShow'); await tick();
  expect(target.data).toMatchObject({ publishEnabled: false, primaryRoute: '' });
  await call(target, 'publish'); expect(navigateTo).not.toHaveBeenCalled(); expect(showToast).toHaveBeenCalled();
});
test('server failure and account switch clear eligibility without Mock fallback', async () => {
  const target = page(); failure = true; call(target, 'onShow'); await tick();
  expect(target.data).toMatchObject({ publishEnabled: false, primaryRoute: '' }); expect(target.data.errorText).toBeTruthy();
  failure = false; owner = 'owner-b'; call(target, 'onShow'); await tick();
  expect(target.data.publishEnabled).toBe(true); expect(wires[wires.length - 1]?.header.Authorization).toBe('Bearer token-owner-b');
  owner = null; call(target, 'onShow'); expect(target.data).toMatchObject({ loggedIn: false, publishEnabled: false, primaryRoute: '' });
});
test.each(['eligibility_rule_version_id', 'agreement_rule_version_id', 'publish_quota_account_as_of_at', 'agreements', 'assets', 'as_of_at'])(
  'missing mandatory eligibility field %s fails closed', async (field) => {
    const invalid = { ...eligible() } as Record<string, unknown>; delete invalid[field]; projection = invalid as PublicationEligibility;
    const target = page(); call(target, 'onShow'); await tick();
    expect(target.data).toMatchObject({ publishEnabled: false, primaryRoute: '' });
    expect(target.data.errorText).toBeTruthy();
    await call(target, 'publish'); expect(navigateTo).not.toHaveBeenCalled();
  },
);
test('malformed nested eligibility assets and agreement cannot authorize publishing', async () => {
  projection = { ...eligible(), agreements: [{ document_version_id: 'document-1', kind: 'PUBLISH', title: '发布协议', accepted: true }],
    assets: { total_count: '0', online_count: '0', editable_draft_count: '0' } };
  (projection.assets as Record<string, unknown>).online_count = 'not-a-count';
  const target = page(); call(target, 'onShow'); await tick();
  expect(target.data).toMatchObject({ publishEnabled: false, primaryRoute: '' });
  expect(target.data.errorText).toBeTruthy();
});
