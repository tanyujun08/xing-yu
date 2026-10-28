import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
const api = vi.hoisted(() => ({ owner: 'account-a' as string | null, delivered: false, tasks: vi.fn(), claim: vi.fn(), summary: vi.fn(), grant: vi.fn() }));
vi.mock('../miniprogram/shared/api/account-api', async () => {
  const actual = await vi.importActual<typeof import('../miniprogram/shared/api/account-api')>('../miniprogram/shared/api/account-api');
  return { ...actual, accountApi: { ...actual.accountApi, sessionIdentity: () => api.owner },
    benefitApi: { tasks: api.tasks, claimTask: api.claim, summary: api.summary }, loyaltyTraceApi: { grant: api.grant } };
});
interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness, page: Harness, storage: Map<string, unknown>;
const task = { benefit_code: 'server-register', task_code: 'REGISTER', period: 'LIFETIME', cycle_key: 'LIFETIME', limit: '1', progress_count: '1', claimed_count: '0', claimable_count: '1', state: 'CLAIMABLE', rewards: [{ kind: 'PINK', units: '25', quantity: null, valid_days: null, coupon_type: null }] };
const receipt = { task: { ...task, claimed_count: '1', claimable_count: '0', state: 'COMPLETED' }, grants: [{ grant_id: 'grant', reward_kind: 'POINT', reward_code: 'PINK', reward_units: '25', coupon_id: null }], replayed: false };
const trace = { grant_id: 'grant', account_id: 'account-a', source_kind: 'PROGRESS', source_id: 'progress', source_rule_version_id: 'rule', source_award_ordinal: 1, reward_kind: 'POINT', reward_code: 'PINK', reward_units: '25', coupon_ids: [], pink_entry_ids: ['entry'], created_at: '2026-10-02T00:00:00Z' };
function result(value: unknown) { return { promise: Promise.resolve(value), abort: vi.fn() }; }
function fresh(): Harness { return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; }
function call(name: string, ...args: unknown[]) { return (page[name] as (...args: unknown[]) => unknown).apply(page, args); }
const event = { currentTarget: { dataset: { id: 'server-register' } } };
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/growth-tasks/index'); });
beforeEach(() => {
  api.owner = 'account-a'; api.delivered = false; storage = new Map();
  api.tasks.mockReset().mockImplementation(() => result({ enabled: true, disabled_reason: '', rule_version_id: 'rule', as_of_at: '2026-10-02T00:00:00Z', items: [api.delivered ? receipt.task : task] }));
  api.claim.mockReset().mockImplementation(() => { api.delivered = true; return result(receipt); });
  api.grant.mockReset().mockReturnValue(result(trace));
  api.summary.mockReset().mockImplementation(() => result({ profile: { account_id: api.owner, available_pink_units: '9007199254740993', total_growth_units: '123' } }));
  vi.stubGlobal('wx', { showToast: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' && api.owner ? { accountId: api.owner, accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 } : storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)), removeStorageSync: (key: string) => storage.delete(key) });
  page = fresh();
});
afterEach(() => { call('onUnload'); });
afterAll(() => vi.unstubAllGlobals());

test('guest does no read or claim; published task replaces all four guessed tasks and verifies grant plus current summary', async () => {
  api.owner = null; await call('onShow'); await call('openTask', event);
  expect(api.tasks).not.toHaveBeenCalled(); expect(api.claim).not.toHaveBeenCalled();
  api.owner = 'account-a'; await call('onShow');
  expect(page.data.tasks).toEqual([expect.objectContaining({ id: 'server-register', reward: '25 粉钻' })]);
  await Promise.all(Array.from({ length: 8 }, () => call('openTask', event)));
  expect(api.claim).toHaveBeenCalledTimes(1); expect(api.grant).toHaveBeenCalledWith('grant'); expect(api.summary).toHaveBeenCalledTimes(1);
  expect(page.data.receiptText).toContain('25 粉钻'); expect(page.data.balance).toBe('9007199254740993'); expect(storage.size).toBe(0);
  await call('openGrant', { currentTarget: { dataset: { id: 'grant' } } });
  expect(page.data.grantDetail).toContain('来源 progress');
  call('openReward', { currentTarget: { dataset: { id: 'grant' } } });
  expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/powder-ledger/index?entry_id=entry' }));
});

test('unknown command survives page destruction and resumes only by explicit original-key recovery', async () => {
  await call('onShow'); api.claim.mockReturnValueOnce({ promise: Promise.reject(new Error('timeout')), abort: vi.fn() });
  await call('openTask', event);
  const original = api.claim.mock.calls[0]!;
  expect(page.data.receiptText).toBe(''); expect(storage.size).toBe(1);
  call('onUnload'); page = fresh(); await call('onShow');
  expect(api.claim).toHaveBeenCalledTimes(1); expect(page.data.pendingBenefitCode).toBe('server-register');
  await call('openTask', event); expect(api.claim).toHaveBeenCalledTimes(1);
  await call('recoverClaim'); expect(api.claim.mock.calls[1]).toEqual(original); expect(storage.size).toBe(0);
});

test('late old-account or hidden receipts neither project success nor discard the original command', async () => {
  await call('onShow'); let resolve!: (value: unknown) => void;
  api.claim.mockReturnValueOnce({ promise: new Promise(value => { resolve = value; }), abort: vi.fn() });
  const pending = call('openTask', event); await Promise.resolve(); await Promise.resolve();
  api.owner = 'account-b'; await call('onShow'); resolve(receipt); await pending;
  expect(page.data.receiptText).toBe(''); expect(api.grant).not.toHaveBeenCalled(); expect(storage.size).toBe(1);
  expect(wx.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
  api.owner = 'account-a'; await call('onShow');
  api.claim.mockReturnValueOnce({ promise: new Promise(value => { resolve = value; }), abort: vi.fn() });
  const retry = call('recoverClaim'); await Promise.resolve(); await Promise.resolve(); call('onHide'); resolve(receipt); await retry;
  expect(page.data.receiptText).toBe(''); expect(storage.size).toBe(1);
});

test('a mismatched grant or failed readback retains the request and never announces rewards', async () => {
  await call('onShow'); api.grant.mockReturnValueOnce(result({ ...trace, account_id: 'other' }));
  await call('openTask', event);
  expect(page.data.receiptText).toBe(''); expect(page.data.pendingBenefitCode).toBe('server-register'); expect(api.summary).not.toHaveBeenCalled();
  const original = api.claim.mock.calls[0]!;
  api.summary.mockReturnValueOnce({ promise: Promise.reject(new Error('summary unavailable')), abort: vi.fn() });
  await call('recoverClaim'); expect(api.claim.mock.calls[1]).toEqual(original); expect(storage.size).toBe(1); expect(page.data.receiptText).toBe('');
});
