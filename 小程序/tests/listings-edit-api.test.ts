import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { accountApi } from '../miniprogram/shared/api/account-api';
import { ownAssetsApi, type OwnRentalAssetDetail, type OwnRentalAssetPage } from '../miniprogram/shared/api/own-assets-api';
import { publicationApi, type AssetDraft } from '../miniprogram/shared/api/publication-api';

interface Harness { data: Record<string, unknown>; setData(patch: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness;
const navigateTo = vi.fn();
beforeAll(async () => { vi.stubGlobal('Page', (value: Harness) => { definition = value; }); await import('../miniprogram/pages/listings/index'); });
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());
function page(): Harness { return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } }; }
function assetDetail(editableDraftId: string | null = null, canCreate = true): OwnRentalAssetDetail {
  return { item: {
    resource_kind: 'ASSET', resource_id: 'asset-owned', asset_id: 'asset-owned', product_name: '相机', display_name: '本人相机',
    state: 'ONLINE', delivery_methods: [], editable_draft_id: editableDraftId,
    allowed_actions: [{ code: 'CREATE_EDIT_DRAFT', enabled: canCreate, blocked_reasons: canCreate ? [] : ['OCCUPIED'] }],
    created_at: '2026-09-23T00:00:00Z', updated_at: '2026-09-23T00:00:00Z', version: '7',
  }, current_revision: null, latest_revision: null, publication_blockers: [], as_of_at: '2026-09-23T00:00:00Z' };
}
function tap(target: Harness, draft = '', asset = 'asset-owned') {
  return (target.editListing as (event: unknown) => Promise<void>).call(target, { currentTarget: { dataset: { draft, asset } } });
}
function setup(detail = assetDetail()) {
  vi.stubGlobal('wx', { navigateTo }); navigateTo.mockClear();
  vi.spyOn(accountApi, 'sessionIdentity').mockReturnValue('owner-a');
  vi.spyOn(accountApi, 'newIntent').mockReturnValue('edit-intent-stable');
  vi.spyOn(ownAssetsApi, 'detail').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve(detail) });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}
function listed(price = '100', deposit = '100'): OwnRentalAssetPage {
  return { items: [{ ...assetDetail().item, unit_price_fen: price, deposit_fen: deposit, rental_unit: 'DAY' }],
    page: { page_size: 20, has_more: false } };
}
async function tick() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
test('existing editable draft routes by draft_id without another write', async () => {
  setup(assetDetail('draft-existing'));
  const write = vi.spyOn(publicationApi, 'editDraft');
  await tap(page(), 'draft-existing');
  expect(write).not.toHaveBeenCalled();
  expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/publish/index?mode=draft&draft_id=draft-existing' });
});
test('own publication list works without URLSearchParams in the Mini runtime', async () => {
  const previous = globalThis.URLSearchParams;
  vi.stubGlobal('URLSearchParams', undefined);
  const urls: string[] = [];
  const emptyDraft: OwnRentalAssetPage['items'][number] = { ...assetDetail().item,
    resource_kind: 'DRAFT', resource_id: 'draft-empty', draft_id: 'draft-empty', asset_id: null,
    display_name: '', product_name: '', state: 'DRAFT', version: '1' };
  vi.stubGlobal('wx', {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: () => null,
    request: (options: { url: string; success(response: unknown): void }) => {
      urls.push(options.url);
      options.success({ statusCode: 200, data: { items: [emptyDraft], page: { page_size: 20, has_more: false } }, header: {} });
      return { abort: vi.fn() };
    },
  });
  try {
    const result = await ownAssetsApi.list('DRAFT', 'next/cursor').promise;
    expect(result.items).toEqual([emptyDraft]);
    expect(urls).toEqual(['http://127.0.0.1:8081/v1/me/rental-assets?page_size=20&state=DRAFT&cursor=next%2Fcursor']);
  } finally {
    vi.stubGlobal('URLSearchParams', previous);
  }
});
test('new edit draft binds the current asset version, verifies receipt and readback before navigation', async () => {
  setup();
  const write = vi.spyOn(publicationApi, 'editDraft').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve({ kind: 'DRAFT', id: 'draft-edit', status: 'EDITING', version: '1', asset_id: 'asset-owned', asset_version: '7' }) } as ReturnType<typeof publicationApi.editDraft>);
  vi.spyOn(publicationApi, 'draft').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve({ draft_id: 'draft-edit' } as AssetDraft) });
  vi.spyOn(publicationApi, 'validateDraft').mockReturnValue({ draft_id: 'draft-edit', origin_kind: 'EDIT', status: 'EDITING', asset_id: 'asset-owned', base_version: '7', version: '1' } as AssetDraft);
  await tap(page());
  expect(write).toHaveBeenCalledWith('asset-owned', '7', 'edit-intent-stable');
  expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/publish/index?mode=draft&draft_id=draft-edit' });
});
test('blocked server action never creates an edit draft', async () => {
  setup(assetDetail(null, false));
  const write = vi.spyOn(publicationApi, 'editDraft');
  const target = page(); await tap(target);
  expect(write).not.toHaveBeenCalled(); expect(navigateTo).not.toHaveBeenCalled(); expect(target.data.errorText).toBeTruthy();
});
test('hidden page invalidates a pending pagination result and clears previous owner data', async () => {
  setup();
  const second = deferred<OwnRentalAssetPage>();
  const list = vi.spyOn(ownAssetsApi, 'list')
    .mockReturnValueOnce({ abort: vi.fn(), promise: Promise.resolve({ items: listed().items, page: { page_size: 20, has_more: true, next_cursor: 'next' } }) })
    .mockReturnValueOnce({ abort: vi.fn(), promise: second.promise });
  const target = page(); (target.onShow as () => void).call(target); await tick();
  expect(list).toHaveBeenCalledTimes(2);
  (target.onHide as () => void).call(target);
  second.resolve(listed('200')); await tick();
  expect(target.data).toMatchObject({ listings: [], loading: false, errorText: '' });
});
test('new owner request wins after hide/show even when the old response arrives last', async () => {
  setup();
  const old = deferred<OwnRentalAssetPage>();
  vi.spyOn(ownAssetsApi, 'list').mockReturnValueOnce({ abort: vi.fn(), promise: old.promise })
    .mockReturnValueOnce({ abort: vi.fn(), promise: Promise.resolve(listed('250')) });
  const target = page(); (target.onShow as () => void).call(target);
  (target.onHide as () => void).call(target); (target.onShow as () => void).call(target); await tick();
  expect((target.data.listings as Array<{ price: string }>)[0]?.price).toBe('¥2.50/天');
  old.resolve(listed('100')); await tick();
  expect((target.data.listings as Array<{ price: string }>)[0]?.price).toBe('¥2.50/天');
});
test('account switch during original cover management GET cannot fill a former owner list', async () => {
  setup();
  let owner = 'owner-a'; vi.spyOn(accountApi, 'sessionIdentity').mockImplementation(() => owner);
  const grant = deferred<Awaited<ReturnType<typeof publicationApi.material>['promise']>>();
  vi.spyOn(ownAssetsApi, 'list').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve({
    ...listed(), items: [{ ...listed().items[0]!, cover_material_id: 'cover-1' }],
  }) });
  vi.spyOn(publicationApi, 'material').mockReturnValue({ abort: vi.fn(), promise: grant.promise });
  const target = page(); (target.onShow as () => void).call(target); await tick();
  owner = 'owner-b'; grant.resolve({ material_id:'cover-1',owner_account_id:'owner-a',scope_type:'ACCOUNT',material_class:'RENTAL_ASSET_IMAGE',status:'READY',public_url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/old-cover',playback_url:null,mime_type:'image/png',size_bytes:100,metadata:{schema_version:1,width:100,height:80,duration_ms:null,video_codec:null,audio_codec:null},poster:null } as Awaited<typeof grant.promise>);
  await tick();
  expect(target.data).toMatchObject({ listings: [], loading: false, errorText: '登录状态已变化，请刷新本人资产。' });
});
test('large uint64 minor-unit prices render exactly; malformed amount does not become a number', async () => {
  setup();
  vi.spyOn(ownAssetsApi, 'list').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve(listed('18446744073709551615', '9007199254740993')) });
  const target = page(); (target.onShow as () => void).call(target); await tick();
  expect((target.data.listings as Array<{ price: string; deposit: string }>)[0]).toMatchObject({
    price: '¥184467440737095516.15/天', deposit: '¥90071992547409.93',
  });
  vi.spyOn(ownAssetsApi, 'list').mockReturnValue({ abort: vi.fn(), promise: Promise.resolve(listed('18446744073709551616', '-1')) });
  (target.onShow as () => void).call(target); await tick();
  expect((target.data.listings as Array<{ price: string; deposit: string }>)[0]).toMatchObject({
    price: '待设定/天', deposit: '待设定',
  });
});
test('owner review detail reads the private owner endpoint, shows latest rejected price and reason without public navigation', async () => {
  const oldRevision = {
    revision_id: 'rev-old', display_name: '旧版相机', condition: '九成新', defect_description: '', accessories_text: '', description: '',
    rental_unit: 'DAY' as const, unit_price_fen: '10000', deposit_fen: '100000', minimum_units: '1', reference_value_fen: '1000000',
    available_from: '2026-09-22T16:00:00Z', available_until: '2026-09-23T16:00:00Z', review_status: 'APPROVED' as const, review_reason: null,
    media: [{material_id:'second-photo',role:'IMAGE' as const,sort_order:1},{material_id:'first-photo',role:'COVER' as const,sort_order:0}], delivery_options: [{ method: 'EXPRESS', outbound_fee_payer: 'TENANT', return_fee_payer: 'LESSOR' }],
  };
  const detail: OwnRentalAssetDetail = {
    ...assetDetail(), item: { ...assetDetail().item, state: 'REJECTED', publish_status: 'OFFLINE', current_revision_id: 'rev-old', latest_revision_id: 'rev-new' },
    current_revision: oldRevision,
    latest_revision: { ...oldRevision, revision_id: 'rev-new', display_name: '新版相机', unit_price_fen: '25000', review_status: 'REJECTED', review_reason: '请补拍设备铭牌' },
    publication_blockers: ['LATEST_NOT_APPROVED'],
  };
  setup(detail);
  vi.spyOn(publicationApi, 'material').mockImplementation(id => ({
    abort: vi.fn(),
    promise: Promise.resolve({
      material_id: id, owner_account_id: 'owner-a', scope_type: 'ACCOUNT', scope_id: 'owner-a',
      material_class: 'RENTAL_ASSET_IMAGE', status: 'READY',
      public_url: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/' + id, playback_url: null,
      mime_type: 'image/png', size_bytes: 100, metadata: null, poster: null,
      expected_mime: 'image/png', expected_size: 100, expected_sha256: 'a'.repeat(64),
      sse_mode: 'SSE-OSS', version: 1,
      created_at: '2026-09-23T00:00:00Z', updated_at: '2026-09-23T00:00:00Z',
    } satisfies Awaited<ReturnType<typeof publicationApi.material>['promise']>),
  }));
  const target = page();
  await (target.viewMaterial as (event: unknown) => Promise<void>).call(target, { currentTarget: { dataset: { id: 'asset-owned' } } });
  expect(ownAssetsApi.detail).toHaveBeenCalledWith('asset-owned');
  expect((target.data.ownDetail as {photos:{id:string;url:string}[]}).photos).toEqual([{id:'first-photo',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/first-photo'},{id:'second-photo',url:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/second-photo'}]);
  expect(publicationApi.material).toHaveBeenCalledTimes(2);
  expect(target.data.ownDetail).toMatchObject({ name: '新版相机', rent: '¥250.00/天', currentRent: '¥100.00/天', reviewReason: '请补拍设备铭牌', latestRevisionId: 'rev-new', currentRevisionId: 'rev-old', availableUntil: '2026-09-23', hasDifferentCurrent: true, blockers: [{id:'LATEST_NOT_APPROVED',code:'LATEST_NOT_APPROVED'}] });
  expect(navigateTo).not.toHaveBeenCalled();
  (target.closeMaterial as () => void).call(target);
  expect(target.data.ownDetail).toBeNull();
});

test('own detail retry uses shared media nodes and preserves the original photo slot size',()=>{
 const markup=readFileSync(new URL('../miniprogram/pages/listings/index.wxml',import.meta.url),'utf8');
 const style=readFileSync(new URL('../miniprogram/pages/listings/index.wxss',import.meta.url),'utf8');
 expect(markup).toContain('<media-state wx:for="{{ownDetail.photos}}" wx:key="id" class="listing-detail-photo" state="real" src="{{item.url}}" mode="aspectFill"');
 expect(markup).toContain('retry-label="重试" aria-label="本人设备实拍图"');expect(markup).not.toContain('<image wx:for="{{ownDetail.photos}}"');
 expect(style).toContain('.listing-detail-photos .listing-detail-photo { width: 180rpx; height: 180rpx; flex: 0 0 180rpx; border-radius: var(--xy-radius-media); overflow: hidden; }');
});
