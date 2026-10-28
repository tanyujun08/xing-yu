import { describe, expect, test } from 'vitest';
import { PRODUCT_VERSION } from '../demo';
import { createMemoryDemoStorage } from './persistence';
import { createDemoRuntime } from './runtime';
import { createLegacySeedStateV7, createSeedState } from './seed';
import { DEFAULT_DEMO_STORAGE_KEY } from './schema';

function createRuntime() {
  return createDemoRuntime({ storage: createMemoryDemoStorage(), scenarioName: 'normal' });
}

function createSchemaSixFixture(): Record<string, unknown> {
  const state = structuredClone(createLegacySeedStateV7('normal')) as Record<string, unknown>;
  (state.meta as Record<string, unknown>).schemaVersion = 6;

for (const sku of state.skus as Array<Record<string, unknown>>) delete sku.rentalType;
  for (const asset of state.assets as Array<Record<string, unknown>>) delete asset.referenceValueFen;
  delete state.settlementLines;
  delete state.depositClosureEvents;
  delete state.rentalContracts;
  return state;
}

function demoAddress() {
  return {
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detailAddress: '演示路 8 号',
    fullAddress: '广东省深圳市南山区演示路 8 号',
    longitude: 113.93,
    latitude: 22.53,
  };
}

function createMerchantInput(name: string) {
  return {
    name,
    sharePercent: 15,
    settlementAccount: '6222020202020001',
    contactName: '演示联系人',
    operatingAddress: demoAddress(),
  };
}


describe('deterministic Mock runtime', () => {
  test('rejects retired rental storage without importing it into shared master data', () => {
    const storage = createMemoryDemoStorage();
    const raw = JSON.stringify({ ...createSeedState(), orders: [{ id: 'retired-rental' }] });
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, raw);
    expect(() => createDemoRuntime({ storage })).toThrowError(expect.objectContaining({ code: 'PERSISTENCE_INVALID' }));
    expect(storage.getItem(DEFAULT_DEMO_STORAGE_KEY)).toBe(raw);
  });

  test('resetScenario restores the same deterministic snapshot', () => {
    const runtime = createRuntime();
    runtime.createMerchant(createMerchantInput('临时演示商家'));

    runtime.resetScenario('normal', 'mock-operations-001');
    const first = runtime.getSnapshot();
    runtime.resetScenario('normal', 'mock-operations-001');
    const second = runtime.getSnapshot();

    expect(second).toEqual(first);
    expect(runtime.getInfo()).toMatchObject({ appMode: 'mock-demo', schemaVersion: 10, revision: 1 });
  });

  test('enforces mock.control and the active actor role inside runtime before mutating controls', () => {
    const runtime = createRuntime();
    const initial = runtime.getInfo();

    expect(() => runtime.recordMockControl('MOCK_BEHAVIOR_CONFIGURED', 'mock-finance-001', { fault: 'TIMEOUT' })).toThrowError();
    expect(() => runtime.recordMockControl('MOCK_BEHAVIOR_CONFIGURED', 'system-seed', { fault: 'TIMEOUT' })).toThrowError();
    expect(() => runtime.advanceClock(60_000, 'mock-finance-001')).toThrowError();
    expect(() => runtime.resetScenario('exceptions', 'mock-finance-001')).toThrowError();
    expect(runtime.getInfo()).toEqual(initial);

    expect(() => runtime.recordRoleSwitch({
      actorId: 'mock-operations-001',
      fromRole: 'FINANCE',
      toRole: 'SUPER_ADMIN',
    })).toThrowError(/来源角色/);
    expect(runtime.recordMockControl(
      'MOCK_BEHAVIOR_CONFIGURED',
      'mock-operations-001',
      { fault: 'TIMEOUT' },
    )).toMatchObject({ action: 'MOCK_BEHAVIOR_CONFIGURED', actorId: 'mock-operations-001' });
    expect(runtime.recordRoleSwitch({
      actorId: 'mock-operations-001',
      fromRole: 'OPERATIONS',
      toRole: 'FINANCE',
    })).toMatchObject({ action: 'ADMIN_ROLE_SWITCHED', actorId: 'mock-operations-001' });
    expect(runtime.advanceClock(60_000, 'mock-operations-001').now).not.toBe(initial.now);
    expect(runtime.resetScenario('exceptions', 'mock-super-admin')).toMatchObject({ scenarioName: 'exceptions' });
  });

  test('persists versioned state through the storage adapter', () => {
    const storage = createMemoryDemoStorage();
    const first = createDemoRuntime({ storage });
    const merchant = first.createMerchant({
      ...createMerchantInput('持久化演示商家'),
      sharePercent: 20,
      settlementAccount: '6222020202021234',
    });

    const reloaded = createDemoRuntime({ storage });
    expect(reloaded.listMerchants().some((candidate) => candidate.id === merchant.id)).toBe(true);
    expect(reloaded.getInfo().schemaVersion).toBe(10);
    expect(reloaded.getInfo().productVersion).toBe(PRODUCT_VERSION);
  });

  test('backs up exact v6 bytes before a provable v7 migration', () => {
    const storage = createMemoryDemoStorage();
    const fixture = createSchemaSixFixture();
    const raw = JSON.stringify(fixture);
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, raw);

    const runtime = createDemoRuntime({ storage });

    expect(runtime.getInfo().schemaVersion).toBe(10);
    expect(storage.getItem(`${DEFAULT_DEMO_STORAGE_KEY}.backup.v6`)).toBe(raw);
    expect(runtime.listProducts().every((product) => product.model.trim() !== '')).toBe(true);
  });

  test('fails closed and preserves v6 bytes when one SKU has two active rental modes', () => {
    const storage = createMemoryDemoStorage();
    const fixture = createSchemaSixFixture();
    const offers = fixture.offers as Array<Record<string, unknown>>;
    offers.push({ ...offers[0], id: 'offer_v6_ambiguous_hour', name: '旧版小时方案', rentalType: 'HOUR' });
    const raw = JSON.stringify(fixture);
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, raw);

    expect(() => createDemoRuntime({ storage })).toThrowError(expect.objectContaining({
      code: 'PERSISTENCE_INVALID',
      details: expect.objectContaining({ migrationKind: 'SCHEMA_V6_SKU_RENTAL_MODE_AMBIGUOUS' }),
    }));
    expect(storage.getItem(DEFAULT_DEMO_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(`${DEFAULT_DEMO_STORAGE_KEY}.backup.v6`)).toBeNull();
  });

  test('updates product metadata on the current schema without clearing records', () => {
    const storage = createMemoryDemoStorage();
    const saved = createSeedState('normal') as unknown as {
      meta: { productVersion: string };
      assets: Array<{ id: string }>;
      assetTermsRevisions: Array<Record<string, unknown>>;
    };
    saved.meta.productVersion = '1.0.0.1';
    saved.assets.push({ id: 'asset_metadata_preserved' });
    const preservedAsset = {
      ...createSeedState('normal').assets.find((asset) => asset.id === 'asset_seed_004')!,
      id: 'asset_metadata_preserved',
      assetNo: 'XY-METADATA-PRESERVED',
      identifierValue: 'DEMO-METADATA-PRESERVED',
      identifierNormalizedValue: 'demo-metadata-preserved',
    };
    saved.assets[saved.assets.length - 1] = preservedAsset;
    saved.assetTermsRevisions.push({
      ...createSeedState('normal').assetTermsRevisions.find((revision) => revision.assetId === 'asset_seed_004')!,
      id: 'terms_asset_metadata_preserved_v1',
      assetId: preservedAsset.id,
    });
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, JSON.stringify(saved));

    const runtime = createDemoRuntime({ storage });

    expect(runtime.getInfo().productVersion).toBe(PRODUCT_VERSION);
    expect(runtime.listAssets().some((asset) => asset.id === preservedAsset.id)).toBe(true);
  });

  test('migrates schemaVersion 8 admin login methods into independent phone and WeChat capabilities', () => {
    const storage = createMemoryDemoStorage();
    const saved = createSeedState('normal') as unknown as {
      meta: { schemaVersion: number; productVersion: string };
      admins: Array<Record<string, unknown>>;

assets: Array<Record<string, unknown>>;
      contractPurchaseOrders?: unknown;
      contractCreditLedger?: unknown;
    };
    saved.meta.schemaVersion = 8;
    saved.meta.productVersion = '1.0.0.8';
    saved.admins = saved.admins.map((admin, index) => {
      const legacyAdmin = { ...admin };
      delete legacyAdmin.loginCapabilities;
      delete legacyAdmin.wechatBinding;
      return { ...legacyAdmin, loginMethod: index === 0 ? 'MINIPROGRAM_QR' : 'PHONE' };
    });

delete saved.contractPurchaseOrders;
    delete saved.contractCreditLedger;
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, JSON.stringify(saved));

    const runtime = createDemoRuntime({ storage });
    const admins = runtime.listAdmins();

    expect(runtime.getInfo().schemaVersion).toBe(10);
    expect(admins[0]).toMatchObject({
      loginCapabilities: { phone: true, wechat: true },
      wechatBinding: { status: 'BOUND' },
    });
    expect(admins[1]).toMatchObject({
      loginCapabilities: { phone: true, wechat: false },
      wechatBinding: { status: 'UNBOUND', nickname: null, avatarUrl: null, boundAt: null },
    });
    expect(storage.getItem(`${DEFAULT_DEMO_STORAGE_KEY}.backup.v8`)).not.toBeNull();
  });


  test('refuses malformed local persistence and preserves its original bytes', () => {
    const storage = createMemoryDemoStorage();
    const malformed = '{invalid-json';
    storage.setItem(DEFAULT_DEMO_STORAGE_KEY, malformed);

    expect(() => createDemoRuntime({ storage })).toThrowError(expect.objectContaining({
      code: 'PERSISTENCE_INVALID',
      details: expect.objectContaining({
        migrationBlocked: true,
        migrationKind: 'STORAGE_PARSE_FAILED',
      }),
    }));
    expect(storage.getItem(DEFAULT_DEMO_STORAGE_KEY)).toBe(malformed);
  });

  test('creates core master data through validated commands and audits each command', () => {
    const runtime = createRuntime();
    const merchant = runtime.createMerchant({
      ...createMerchantInput('新录入演示商家'),
      sharePercent: 18,
      settlementAccount: '建设银行 6227000000001008',
      contactName: '商家联系人',
    });
    const product = runtime.createProduct({
      name: 'Demo Camera X1',
      brandId: 'brand_demo',
      brand: 'Demo',
      model: 'Camera X1',
      category: '微单相机',
      description: '测试商品',
      tags: ['演示'],
    });
    const asset = runtime.createOfficialAssetBatch({
      productId: product.id, displayName: 'Demo Camera X1 标准套装',
      identifiers: [{ identifierType: 'MANUFACTURER_SERIAL', identifierValue: 'DEMO-SERIAL-1008' }],
      condition: '全新演示资产', defectDescription: '', accessoryDescription: '电池', rentalType: 'DAY',
      unitPriceFen: 10_000, minimumUnits: 3, depositFen: 100_000, referenceValueFen: 899_900,
    })[0]!;

    expect(merchant).toMatchObject({ shareBps: 1_800, operatingAddress: demoAddress() });
    expect(asset.productId).toBe(product.id);
    expect(asset.availabilityStatus).toBe('AVAILABLE');
    expect(runtime.listAuditEvents().filter((event) => event.aggregateType !== 'ADMIN_SESSION' && event.aggregateType !== 'CONTRACT_PURCHASE_ORDER').slice(0, 5).map((event) => event.action)).toEqual([
      'OFFICIAL_ASSET_BATCH_CREATED',
      'PRODUCT_CREATED',
      'MERCHANT_CREATED',
      'SCENARIO_SEEDED',
    ]);
  });

  test('keeps ordered merchant photos and cover in sync across create, edit, reorder and clear', () => {
    const runtime = createRuntime();
    const nine = Array.from({ length: 9 }, (_, index) => `data:image/png;base64,PHOTO${index}`);
    const merchant = runtime.createMerchant({ ...createMerchantInput('带图片的商家'), photoMaterialIds: nine });
    expect(runtime.getMerchantById(merchant.id)).toMatchObject({ version: '1', photoMaterialIds: nine, coverMaterialId: nine[0] });
    expect(runtime.listMerchants().find((item) => item.id === merchant.id)?.coverMaterialId).toBe(nine[0]);
    expect(() => runtime.updateMerchantPhotos(merchant.id, '1', [...nine, 'photo-10'])).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() => runtime.updateMerchantPhotos(merchant.id, '1', [nine[0]!, nine[0]!])).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    const reordered = runtime.updateMerchantPhotos(merchant.id, '1', [nine[2]!, nine[0]!]);
    expect(reordered).toMatchObject({ version: '2', photoMaterialIds: [nine[2], nine[0]], coverMaterialId: nine[2] });
    expect(() => runtime.updateMerchantPhotos(merchant.id, '1', [])).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
    const cleared = runtime.updateMerchantPhotos(merchant.id, '2', []);
    expect(cleared).toMatchObject({ version: '3', photoMaterialIds: [], coverMaterialId: null });
    expect(() => runtime.updateMerchant({ ...createMerchantInput('带图片的商家'), merchantId: merchant.id, photoMaterialIds: [nine[1]!], command: { intentId: 'stale', idempotencyKey: 'stale', expectedVersion: '1' } })).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
    const edited = runtime.updateMerchant({ ...createMerchantInput('带图片的商家'), merchantId: merchant.id, photoMaterialIds: [nine[1]!] });
    expect(edited).toMatchObject({ version: '4', photoMaterialIds: [nine[1]], coverMaterialId: nine[1] });
  });

  test('edits one optional official RFID with leading zeros, uniqueness and version checks', () => {
    const runtime = createRuntime();
    const official = runtime.listAssets().find((asset) => asset.supplyMode === 'OFFICIAL')!;
    const other = runtime.listAssets().find((asset) => asset.id !== official.id && asset.supplyMode === 'OFFICIAL')!;
    expect(official.version).toBe('1');
    expect(() => runtime.updateAssetRFID(official.id, '1', '1234567')).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() => runtime.updateAssetRFID(official.id, '1', '00000000')).toThrowError('空位标记，不可绑定');
    expect(runtime.updateAssetRFID(official.id, '1', '00128473')).toMatchObject({ version: '2', rfidCode: '00128473' });
    expect(() => runtime.updateAssetRFID(other.id, other.version!, '00128473')).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
    expect(() => runtime.updateAssetRFID(official.id, '1', null)).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
    expect(runtime.updateAssetRFID(official.id, '2', null)).toMatchObject({ version: '3', rfidCode: null });
    expect(() => runtime.updateAssetRFID(official.id, '3', '1937G715')).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(runtime.updateAssetRFID(official.id, '3', '1937d715')).toMatchObject({ version: '4', rfidCode: '1937D715' });
    expect(() => runtime.updateAssetRFID(other.id, other.version!, '1937d715')).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
    const personal = runtime.listAssets().find((asset) => asset.supplyMode === 'C2C')!;
    expect(() => runtime.updateAssetRFID(personal.id, personal.version!, '87654321')).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
  });


  test('rejects current asset edits for every non-AVAILABLE state without changing persisted facts', () => {
    for (const availabilityStatus of ['RESERVED', 'RENTING', 'RETURN_PENDING', 'MAINTENANCE', 'FROZEN', 'RETIRED'] as const) {
      const storage = createMemoryDemoStorage();
      const state = createSeedState();
      const asset = state.assets[0]!;
      asset.availabilityStatus = availabilityStatus;
      asset.publishStatus = 'OFFLINE';
      storage.setItem(DEFAULT_DEMO_STORAGE_KEY, JSON.stringify(state));
      const runtime = createDemoRuntime({ storage });
      const before = storage.getItem(DEFAULT_DEMO_STORAGE_KEY);
      expect(() => runtime.updateAsset({
        assetId: asset.id, displayName: '不应保存的改动', condition: asset.condition,
        defectDescription: asset.defectDescription, accessoryDescription: asset.accessoryDescription,
        rentalType: asset.rentalType, unitPriceFen: asset.unitPriceFen, minimumUnits: asset.minimumUnits,
        depositFen: asset.depositFen, referenceValueFen: asset.referenceValueFen,
        changeReason: '核验非可用状态守卫', actorId: 'mock-operator',
      })).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));
      expect(runtime.listAssets().find((current) => current.id === asset.id)?.availabilityStatus).toBe(availabilityStatus);
      expect(storage.getItem(DEFAULT_DEMO_STORAGE_KEY)).toBe(before);
    }
  });

  test('updates only editable asset master fields and appends an audit event', () => {
    const runtime = createRuntime();
    const before = runtime.listAssets()[0]!;

    const updated = runtime.updateAsset({
      assetId: before.id,
      displayName: before.displayName,
      condition: '  96新，机身底部有轻微使用痕迹  ',
      defectDescription: before.defectDescription,
      accessoryDescription: before.accessoryDescription,
      rentalType: before.rentalType,
      unitPriceFen: before.unitPriceFen,
      minimumUnits: before.minimumUnits,
      depositFen: before.depositFen,
      referenceValueFen: 1_659_900,
      changeReason: '修正设备成色与商品价值',
      actorId: 'mock-operator',
    });

    expect(updated).toMatchObject({
      id: before.id,
      assetNo: before.assetNo,
      productId: before.productId,
      identifierValue: before.identifierValue,
      availabilityStatus: before.availabilityStatus,
      boxId: before.boxId,
      condition: '96新，机身底部有轻微使用痕迹',
      referenceValueFen: 1_659_900,
    });
    expect(updated.createdAt).toBe(before.createdAt);
    expect(updated.updatedAt).not.toBe(before.updatedAt);
    expect(runtime.listAuditEvents(1)[0]).toMatchObject({
      aggregateType: 'ASSET',
      aggregateId: before.id,
      action: 'ASSET_UPDATED',
      payload: {
        assetId: before.id,
        termsChanged: true,
        requiresReview: false,
      },
    });
  });

  test('rejects blank condition and invalid reference value when updating an asset', () => {
    const runtime = createRuntime();
    const asset = runtime.listAssets()[0]!;

    expect(() => runtime.updateAsset({
      assetId: asset.id,
      displayName: asset.displayName,
      condition: '   ',
      defectDescription: asset.defectDescription,
      accessoryDescription: asset.accessoryDescription,
      rentalType: asset.rentalType,
      unitPriceFen: asset.unitPriceFen,
      minimumUnits: asset.minimumUnits,
      depositFen: asset.depositFen,
      referenceValueFen: 100,
      changeReason: '测试空成色',
    })).toThrow('成色与瑕疵描述 不能为空');
    expect(() => runtime.updateAsset({
      assetId: asset.id,
      displayName: asset.displayName,
      condition: asset.condition,
      defectDescription: asset.defectDescription,
      accessoryDescription: asset.accessoryDescription,
      rentalType: asset.rentalType,
      unitPriceFen: asset.unitPriceFen,
      minimumUnits: asset.minimumUnits,
      depositFen: asset.depositFen,
      referenceValueFen: -1,
      changeReason: '测试非法商品价值',
    })).toThrow('商品价值 必须是 0 到');
  });

  test('creates an administrator with the selected login method and status and keeps mobile unique', () => {
    const runtime = createRuntime();
    const created = runtime.createAdmin({
      displayName: '小程序扫码管理员',
      mobile: '13900001008',
      role: 'OPERATIONS',
      status: 'LOCKED',
      actorId: 'mock-super-admin',
    });

    expect(created).toMatchObject({
      displayName: '小程序扫码管理员',
      mobile: '13900001008',
      mobileMasked: '139****1008',
      role: 'OPERATIONS',
      status: 'LOCKED',
      createdBy: 'mock-super-admin',
    });
    expect(runtime.listAdmins()).toContainEqual(created);
    expect(() => runtime.createAdmin({
      displayName: '重复手机号管理员',
      mobile: '13900001008',
      role: 'FINANCE',
      status: 'ACTIVE',
    })).toThrowError(expect.objectContaining({
      code: 'CONFLICT',
      message: '管理员手机号已存在',
      details: { mobileMasked: '139****1008' },
    }));
  });

  test('creates exactly boxNo 1..N for a new cabinet', () => {
    const runtime = createRuntime();
    const merchant = runtime.listMerchants()[0]!;
    const cabinet = runtime.createCabinet({
      merchantId: merchant.id,
      cabinetId: 'DEMO-CABINET-005',
      name: '五格测试柜',
      boxCount: 5,
      connectivity: 'ONLINE',
    });

    expect(runtime.listBoxes(cabinet.id).map((box) => box.boxNo)).toEqual([1, 2, 3, 4, 5]);
    expect(cabinet.deploymentAddressSnapshot).toEqual(merchant.operatingAddress);
  });

test('appends validated rental-rule versions and enforces deposit-free and minimum-duration guards', () => {
    const runtime = createRuntime();
    const assetTermsBefore = runtime.listAssets().map((asset) => ({ id: asset.id, minimumUnits: asset.minimumUnits, termsRevision: asset.termsRevision }));
    const validInput = {
      payScoreDepositFreeEnabled: true,
      payScoreDepositFreeThreshold: 700,
      contractUnitPriceFen: 200,
      publishingQuotaUnitPriceFen: 800,
      minimumHourlyRentalHours: 12,
      minimumDailyRentalDays: 3,
      actorId: 'mock-super-admin',
    };

    const saved = runtime.saveBusinessRules(validInput);

    expect(saved).toMatchObject({ version: 2, payScoreDepositFreeEnabled: true, minimumHourlyRentalHours: 12, minimumDailyRentalDays: 3, createdBy: 'mock-super-admin' });
    expect(runtime.listBusinessRuleVersions().map((version) => version.version)).toEqual([2, 1]);
    expect(runtime.getCurrentBusinessRules()).toEqual(saved);
    expect(runtime.listAssets().map((asset) => ({ id: asset.id, minimumUnits: asset.minimumUnits, termsRevision: asset.termsRevision }))).toEqual(assetTermsBefore);
    expect(() => runtime.saveBusinessRules({ ...validInput, payScoreDepositFreeThreshold: 1_001 })).toThrowError(
      /1 到 1000/,
    );
    expect(() => runtime.saveBusinessRules({ ...validInput, payScoreDepositFreeEnabled: false })).toThrowError(/阈值必须为空/);
    expect(() => runtime.saveBusinessRules({ ...validInput, minimumHourlyRentalHours: 11 })).toThrowError(/12 到 720/);
    expect(() => runtime.saveBusinessRules({ ...validInput, minimumDailyRentalDays: 2 })).toThrowError(/3 到 365/);
  });

test('sorts consecutive-sign-in milestones and refuses duplicate days', () => {
    const runtime = createRuntime();
    const current = runtime.getCurrentLoyaltyConfig();
    const saved = runtime.saveLoyaltyConfig({
      consumptionStarTenthsPerYuan: current.consumptionStarTenthsPerYuan,
      levels: current.levels,
      dailySignInRewardStarTenths: current.dailySignInRewardStarTenths,
      streakRewards: [
        { consecutiveDays: 30, bonusStarTenths: 300 },
        { consecutiveDays: 7, bonusStarTenths: 70 },
        { consecutiveDays: 15, bonusStarTenths: 150 },
      ],
    });
    expect(saved.streakRewards.map((reward) => reward.consecutiveDays)).toEqual([7, 15, 30]);

    expect(() => runtime.saveLoyaltyConfig({
      consumptionStarTenthsPerYuan: current.consumptionStarTenthsPerYuan,
      levels: current.levels,
      dailySignInRewardStarTenths: current.dailySignInRewardStarTenths,
      streakRewards: [
        { consecutiveDays: 7, bonusStarTenths: 70 },
        { consecutiveDays: 7, bonusStarTenths: 80 },
      ],
    })).toThrowError(/连续签到里程碑天数与 ID 必须唯一/);
  });

});
