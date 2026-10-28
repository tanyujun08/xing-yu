import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { AssetDraft } from '../miniprogram/shared/api/publication-api';

interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
interface Wire { url: string; method: string; header: Record<string, string>; data?: unknown; success(value: unknown): void; fail(value: { errMsg: string }): void }

let definition: Harness; let page: Harness; let owner: string | null; let server: AssetDraft; let deferred: boolean; let writeStatus: number;
const wires: Wire[] = []; const storage = new Map<string, unknown>(); const abort = vi.fn(); const showToast = vi.fn();
const navigateTo = vi.fn((value: { complete?: () => void }) => value.complete?.());
const redirectTo = vi.fn((value: { complete?: () => void }) => value.complete?.());

function fixture(): AssetDraft {
  return { draft_id: 'draft-owned', status: 'EDITING', version: '9', origin_kind: 'CREATE', base_version: null, asset_id: null, committed_revision_id: null, asset: {
    product_id: 'catalog-owned', display_name: '服务器相机', condition: 'GOOD', identifier_type: 'MANUFACTURER_SERIAL', identifier_value: 'serial-original',
    rental_unit: 'DAY', unit_price_fen: '105', deposit_fen: '9007199254740993', minimum_units: '1', reference_value_fen: '200000',
    description: '原说明', defect_description: '原瑕疵', accessories_text: '原配件', rule_version_id: 'published-rule', eligibility_rule_version_id: 'eligibility-rule',
    available_from: '2026-09-12T16:00:00Z', available_until: '2026-09-22T16:00:00Z', timezone: 'Asia/Shanghai',
    media: [{ material_id: 'owned-ready', role: 'COVER', sort_order: 0 }],
    publication_location: { dataset_id: 'ds', province_id: 'p', city_id: 'c', district_id: 'd', recipient_name: '本人', detail_address: '私密原地址', phone_country_code: '+86', phone: '13900000000', location: { latitude: '30.000000', longitude: '120.000000', source: 'MAP_PICK', coordinate_system: 'GCJ02' } },
    delivery_options: [{ method: 'EXPRESS', source_address_id: 'original-address', outbound_fee_payer: 'TENANT', return_fee_payer: 'LESSOR' }],
  } };
}
function send(wire: Wire, body: unknown, status = 200) { wire.success({ statusCode: status, data: body, header: {}, cookies: [] }); }
function nextVersion(value: string) { return String(Number(value) + 1); }
function defaultReply(wire: Wire) {
  if (wire.method === 'GET') { send(wire, structuredClone(server)); return; }
  if (writeStatus === 0) { wire.fail({ errMsg: 'request:fail timeout' }); return; }
  if (writeStatus !== 200) { send(wire, { code: 'DRAFT_CONFLICT', message: '服务器拒绝操作', request_id: 'listing-price-http' }, writeStatus); return; }
  if (wire.url.includes('/updates')) {
    const version = nextVersion(server.version); server = { ...server, version, asset: structuredClone((wire.data as { asset: AssetDraft['asset'] }).asset) };
    send(wire, { kind: 'DRAFT', id: server.draft_id, status: 'EDITING', version }); return;
  }
  const version = nextVersion(server.version); server = { ...server, status: 'SUBMITTED', version, asset_id: 'asset-owned', committed_revision_id: 'revision-owned' };
  send(wire, { kind: 'DRAFT', id: server.draft_id, status: 'SUBMITTED', version, asset_id: 'asset-owned', revision_id: 'revision-owned' });
}
function call(name: string, ...args: unknown[]) { return (page[name] as (...values: unknown[]) => unknown).apply(page, args); }
function input(field: string, value: string) { call('input', { currentTarget: { dataset: { field } }, detail: { value } }); }
async function tick() { for (let index = 0; index < 20; index++) await Promise.resolve(); }
function publicationKeys() { return [...storage.keys()].filter(key => key.startsWith('xingyu.publication-intent.v1:')); }
function newPage(options: Record<string, string> = { draft_id: 'draft-owned' }) {
  page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  call('onLoad', options);
}

beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/listing-price/index'); });
beforeEach(() => {
  owner = 'owner-a'; server = fixture(); deferred = false; writeStatus = 200; wires.length = 0; storage.clear(); abort.mockClear(); showToast.mockClear(); navigateTo.mockClear(); redirectTo.mockClear();
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: (key: string) => key === 'xingyu.api-session.v1' ? (owner ? { accountId: owner, accessToken: 'token-' + owner, refreshToken: 'refresh', expiresAt: Date.now() + 60_000 } : null) : storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
    removeStorageSync: (key: string) => { if (key === 'xingyu.api-session.v1') owner = null; else storage.delete(key); },
    request: (wire: Wire) => { wires.push(wire); if (!deferred) defaultReply(wire); return { abort }; },
    navigateTo, redirectTo, navigateBack: vi.fn(), switchTab: vi.fn(), showToast,
  });
  newPage();
});
afterEach(() => call('onUnload'));
afterAll(() => vi.unstubAllGlobals());

test('guest and missing draft identifiers issue no HTTP request and never fall back to Mock', async () => {
  owner = null; await call('onShow'); expect(wires).toHaveLength(0); expect(page.data.loggedIn).toBe(false); call('openLogin'); expect(navigateTo).toHaveBeenCalledOnce();
  call('onUnload'); owner = 'owner-a'; newPage({}); await call('onShow'); expect(wires).toHaveLength(0); expect(page.data.listing).toBeNull();
});

test('authoritative GET projects exact fen, billing unit and inclusive Shanghai dates', async () => {
  await call('onShow'); expect(wires).toHaveLength(1); expect(wires[0]).toMatchObject({ method: 'GET' }); expect(wires[0]!.url).toContain('/v1/me/asset-drafts/draft-owned');
  expect(page.data).toMatchObject({ rent: '1.05', deposit: '90071992547409.93', priceUnitLabel: '日租金', availabilityStart: '2026-09-13', availabilityEnd: '2026-09-22', deliveryText: '快递配送', editable: true });
  expect(publicationKeys()).toHaveLength(0);
});

test('one confirmation persists and verifies UPDATE before SUBMIT, preserving the full asset branch', async () => {
  await call('onShow'); const original = structuredClone(server.asset); input('rent', '12.34'); input('deposit', '0.01');
  call('changeStartDate', { detail: { value: '2026-10-01' } }); call('changeEndDate', { detail: { value: '2026-10-03' } }); await call('confirm');
  expect(wires.map(wire => wire.method)).toEqual(['GET', 'POST', 'GET', 'POST', 'GET']);
  const update = wires[1]!; expect(update.url).toContain('/updates'); expect(update.header['If-Match']).toBe('"v9"'); expect(update.header['Idempotency-Key']).toMatch(/^publication-update:/);
  expect(update.data).toEqual({ asset: { ...original, unit_price_fen: '1234', deposit_fen: '1', available_from: '2026-09-30T16:00:00.000Z', available_until: '2026-10-03T16:00:00.000Z' } });
  const submit = wires[3]!; expect(submit.url).toContain('/submissions'); expect(submit.header['If-Match']).toBe('"v10"'); expect(submit.header['Idempotency-Key']).toMatch(/^publication-submit:/); expect(submit.data).toEqual({});
  expect(showToast).toHaveBeenCalledWith({ title: '已提交审核', icon: 'success' }); expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/publish/index?draft_id=draft-owned&mode=view' }));
  expect(publicationKeys()).toHaveLength(0); expect(page.data).toMatchObject({ editable: false, pendingUpdate: false, pendingSubmit: false });
});

test('duplicate confirmation taps share one update and one submit command', async () => {
  await call('onShow'); input('rent', '2.00'); deferred = true; const first = call('confirm'); const second = call('confirm'); await tick(); expect(wires).toHaveLength(2);
  defaultReply(wires[1]!); await tick(); expect(wires).toHaveLength(3); defaultReply(wires[2]!); await tick(); expect(wires).toHaveLength(4); defaultReply(wires[3]!); await tick(); expect(wires).toHaveLength(5); defaultReply(wires[4]!);
  await first; await second; expect(wires.filter(wire => wire.url.includes('/updates'))).toHaveLength(1); expect(wires.filter(wire => wire.url.includes('/submissions'))).toHaveLength(1);
});

test('unknown update retains the exact body, If-Match and key until an explicit retry', async () => {
  await call('onShow'); input('rent', '2.50'); writeStatus = 0; await call('confirm'); const original = wires[1]!;
  expect(wires).toHaveLength(2); expect(page.data).toMatchObject({ pendingUpdate: true, pendingSubmit: false }); expect(publicationKeys()).toHaveLength(1);
  input('rent', '9.99'); expect(page.data.rent).toBe('2.50'); writeStatus = 200; await call('confirm');
  expect(wires[2]!.data).toEqual(original.data); expect(wires[2]!.header['If-Match']).toBe(original.header['If-Match']); expect(wires[2]!.header['Idempotency-Key']).toBe(original.header['Idempotency-Key']);
  expect(wires.map(wire => wire.method)).toEqual(['GET', 'POST', 'POST', 'GET', 'POST', 'GET']); expect(publicationKeys()).toHaveLength(0);
});

test('a located update survives unload and resumes with GET only before another confirmation', async () => {
  await call('onShow'); input('rent', '3.00'); deferred = true; const pending = call('confirm'); await tick();
  const update = wires[1]!; server = { ...server, version: '10', asset: structuredClone((update.data as { asset: AssetDraft['asset'] }).asset) };
  send(update, { kind: 'DRAFT', id: 'draft-owned', status: 'EDITING', version: '10' }); await tick(); expect(wires[2]!.method).toBe('GET');
  call('onUnload'); send(wires[2]!, structuredClone(server)); await pending; expect(publicationKeys()).toHaveLength(1);
  newPage(); deferred = false; await call('onShow'); expect(wires[3]!.method).toBe('GET'); expect(wires.filter(wire => wire.url.includes('/submissions'))).toHaveLength(0); expect(publicationKeys()).toHaveLength(0); expect(page.data.noticeText).toContain('再次确认');
});

test.each([409, 412, 422])('explicit update rejection %s releases only that request and requires a fresh GET', async status => {
  await call('onShow'); input('rent', '4.00'); writeStatus = status; await call('confirm');
  expect(wires).toHaveLength(2); expect(publicationKeys()).toHaveLength(0); expect(page.data.listing).toBeNull(); expect(page.data.errorText).toContain('服务器拒绝操作');
  writeStatus = 200; await call('handleErrorAction'); expect(wires[2]!.method).toBe('GET'); expect(page.data.listing).not.toBeNull();
});

test('invalid update receipt remains pending and dispatches no readback or submit', async () => {
  await call('onShow'); input('rent', '5.00'); deferred = true; const pending = call('confirm'); await tick();
  send(wires[1]!, { kind: 'DRAFT', id: 'foreign', status: 'EDITING', version: '10', unexpected: true }); await pending;
  expect(wires).toHaveLength(2); expect(page.data.pendingUpdate).toBe(true); expect(page.data.errorText).toContain('回执无效'); expect(publicationKeys()).toHaveLength(1); expect(showToast).not.toHaveBeenCalled();
});

test('mismatched final readback keeps the located submit intent and cannot claim success', async () => {
  await call('onShow'); deferred = true; const pending = call('confirm'); await tick(); expect(wires[1]!.url).toContain('/submissions');
  send(wires[1]!, { kind: 'DRAFT', id: 'draft-owned', status: 'SUBMITTED', version: '10', asset_id: 'asset-owned', revision_id: 'revision-owned' }); await tick();
  const wrong = fixture(); wrong.status = 'SUBMITTED'; wrong.version = '10'; wrong.asset_id = 'asset-other'; wrong.committed_revision_id = 'revision-owned'; send(wires[2]!, wrong); await pending;
  expect(page.data.pendingSubmit).toBe(true); expect(page.data.errorText).toContain('回读与原请求不一致'); expect(publicationKeys()).toHaveLength(1); expect(showToast).not.toHaveBeenCalled(); expect(redirectTo).not.toHaveBeenCalled();
});

test.each(['SUBMITTED', 'ARCHIVED'] as const)('%s draft is read-only and emits no mutation', async status => {
  server.status = status; await call('onShow'); input('rent', '8.00'); await call('confirm'); expect(wires).toHaveLength(1); expect(page.data.editable).toBe(false); expect(publicationKeys()).toHaveLength(0);
});

test('hide aborts an active request, clears private projection and ignores a late result', async () => {
  deferred = true; const pending = call('onShow'); await tick(); call('onHide'); expect(abort).toHaveBeenCalledOnce(); send(wires[0]!, fixture()); await pending;
  expect(page.data).toMatchObject({ listing: null, rent: '', deposit: '', editable: false }); expect(publicationKeys()).toHaveLength(0);
});
