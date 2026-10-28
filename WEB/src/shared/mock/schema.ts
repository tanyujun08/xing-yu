import { DemoError } from '../demo';
import { PRODUCT_VERSION, type ProductVersion } from '../demo/demoManifest';
import type {
  Asset as CurrentAsset,
  AssetRentalTermsRevision,
  AdminAccount,
  AuditEvent,
  BusinessRuleConfigVersion,
  Cabinet,
  CabinetBox,
  CabinetBoxEvent as CurrentCabinetBoxEvent,
  CabinetCommand,
  ContractCreditLedgerEntry,
  ContractPurchaseOrder,
  
  DemoScenarioName,
  
  LegacyAssetV7,
  LegacyCabinetBoxEventV7,
  
  LegacyOfferV7,
  LegacyProductV7,

LegacySkuV7,
  LessorProfile,
  LoyaltyConfigVersion,
  Merchant,
  MemberSummary,
  Product as CurrentProduct,
  ProductSupplementRequest,

SignInRecord,
  StarAccount,
  StarLedgerEntry,
} from '../services/contracts';
import { MOCK_MEMBER_AVATAR_URL } from './avatar';
import {

projectContractPurchaseOrder,
  
} from './orderProjections';

type Asset = LegacyAssetV7;
type Offer = LegacyOfferV7;

type Sku = LegacySkuV7;
type LegacyAdminAccountV8 = Omit<AdminAccount, 'loginCapabilities' | 'wechatBinding'> & {
  loginMethod: 'PHONE' | 'MINIPROGRAM_QR';
};

interface LegacyMockStateV9 extends Omit<MockState, 'meta' | 'contractPurchaseOrders' | 'contractCreditLedger'> {
  meta: MockMetadata;

}

interface LegacyMockStateV8 extends Omit<LegacyMockStateV9, 'admins'> {
  admins: LegacyAdminAccountV8[];
}

export const MOCK_SCHEMA_VERSION = 10;
export const DEFAULT_DEMO_STORAGE_KEY = 'xingyu.admin.mock-demo.v1';

export interface MockMetadata {
  schemaVersion: number;
  productVersion: ProductVersion;
  appMode: 'mock-demo';
  scenarioName: DemoScenarioName;
  seed: string;
  currentTime: string;
  nextId: number;
  revision: number;
  
}

interface LegacyMockStateV7 {
  meta: MockMetadata;
  merchants: Merchant[];
  cabinets: Cabinet[];
  boxes: CabinetBox[];
  boxEvents: LegacyCabinetBoxEventV7[];
  products: LegacyProductV7[];
  skus: LegacySkuV7[];
  offers: LegacyOfferV7[];
  assets: LegacyAssetV7[];

members: MemberSummary[];
  admins: LegacyAdminAccountV8[];
  starAccounts: StarAccount[];
  starLedger: StarLedgerEntry[];
  signInRecords: SignInRecord[];

commands: CabinetCommand[];
  auditEvents: AuditEvent[];
  businessRuleVersions: BusinessRuleConfigVersion[];
  loyaltyConfigVersions: LoyaltyConfigVersion[];
}

export interface MockState {
  meta: MockMetadata;
  merchants: Merchant[];
  lessors: LessorProfile[];
  cabinets: Cabinet[];
  boxes: CabinetBox[];
  boxEvents: CurrentCabinetBoxEvent[];
  products: CurrentProduct[];
  productSupplementRequests: ProductSupplementRequest[];
  assets: CurrentAsset[];
  assetTermsRevisions: AssetRentalTermsRevision[];

members: MemberSummary[];
  admins: AdminAccount[];
  starAccounts: StarAccount[];
  starLedger: StarLedgerEntry[];
  signInRecords: SignInRecord[];

contractPurchaseOrders: ContractPurchaseOrder[];
  contractCreditLedger: ContractCreditLedgerEntry[];

commands: CabinetCommand[];
  auditEvents: AuditEvent[];
  businessRuleVersions: BusinessRuleConfigVersion[];
  loyaltyConfigVersions: LoyaltyConfigVersion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function migrateSchemaSixState(value: Record<string, unknown>): LegacyMockStateV7 {
  if (
    !isRecord(value.meta)
    || value.meta.schemaVersion !== 6
    || !Array.isArray(value.skus)
    || !Array.isArray(value.offers)
    || !Array.isArray(value.assets)
  ) {
    throwMigrationBlocked('Mock v6 数据结构不完整', { migrationKind: 'SCHEMA_V6_SHAPE_INVALID' });
  }
  const offers = value.offers as Offer[];
  const skus = (value.skus as Array<Record<string, unknown>>).map((row) => {
    const skuId = typeof row.id === 'string' ? row.id : '';
    const activeOffers = offers.filter((offer) => offer.skuId === skuId && offer.status === 'ACTIVE');
    if (activeOffers.length !== 1) {
      throwMigrationBlocked('旧版 SKU 存在多种或缺失当前租赁模式，必须显式重置演示数据', {
        migrationKind: 'SCHEMA_V6_SKU_RENTAL_MODE_AMBIGUOUS',
        skuId,
        activeOfferIds: activeOffers.map((offer) => offer.id),
        rentalTypes: [...new Set(activeOffers.map((offer) => offer.rentalType))],
      });
    }
    return { ...row, rentalType: activeOffers[0]!.rentalType } as unknown as Sku;
  });
  const assets = (value.assets as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    referenceValueFen: null,
  })) as unknown as Asset[];

return {
    ...(value as unknown as LegacyMockStateV7),
    meta: { ...(value.meta as unknown as MockMetadata), schemaVersion: 7, productVersion: PRODUCT_VERSION },
    skus,
    assets,

};
}

function hasLegacyMockStateShape(value: unknown): value is LegacyMockStateV7 {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return false;
  }
  const meta = value.meta;
  return (
    meta.schemaVersion === 7 &&
    typeof meta.productVersion === 'string' &&
    meta.appMode === 'mock-demo' &&
    (meta.scenarioName === 'normal' || meta.scenarioName === 'cabinet-offline' || meta.scenarioName === 'exceptions') &&
    typeof meta.seed === 'string' &&
    typeof meta.currentTime === 'string' &&
    typeof meta.nextId === 'number' &&
    typeof meta.revision === 'number' &&
    Array.isArray(value.merchants) &&
    Array.isArray(value.cabinets) &&
    Array.isArray(value.boxes) &&
    Array.isArray(value.boxEvents) &&
    Array.isArray(value.products) &&
    Array.isArray(value.skus) &&
    Array.isArray(value.offers) &&
    Array.isArray(value.assets) &&
    Array.isArray(value.members) &&
    Array.isArray(value.admins) &&
    Array.isArray(value.starAccounts) &&
    Array.isArray(value.starLedger) &&
    Array.isArray(value.signInRecords) &&
    Array.isArray(value.commands) &&
    Array.isArray(value.auditEvents) &&
    Array.isArray(value.businessRuleVersions) &&
    Array.isArray(value.loyaltyConfigVersions)
  );
}

function normalizeCatalogKey(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
}

function migrateLegacyAdminAccount(admin: LegacyAdminAccountV8): AdminAccount {
  const wechatBound = admin.loginMethod === 'MINIPROGRAM_QR';
  const { loginMethod: _loginMethod, ...base } = admin;
  void _loginMethod;
  return {
    ...base,
    loginCapabilities: { phone: true, wechat: wechatBound },
    wechatBinding: wechatBound
      ? {
          status: 'BOUND',
          nickname: `${admin.displayName}微信`,
          avatarUrl: MOCK_MEMBER_AVATAR_URL,
          boundAt: admin.lastLoginAt ?? admin.createdAt,
        }
      : { status: 'UNBOUND', nickname: null, avatarUrl: null, boundAt: null },
  };
}

function mapLegacyAvailability(status: LegacyAssetV7['status']): CurrentAsset['availabilityStatus'] {
  if (status === 'RESERVED') return 'RESERVED';
  if (status === 'RENTED') return 'RENTING';
  if (status === 'RETURNED_PENDING_INSPECTION') return 'RETURN_PENDING';
  if (status === 'MAINTENANCE') return 'MAINTENANCE';
  if (status === 'FROZEN') return 'FROZEN';
  if (status === 'RETIRED') return 'RETIRED';
  return 'AVAILABLE';
}

function migrateSchemaSevenState(legacy: LegacyMockStateV7): MockState {
  assertLegacyMockInvariants(legacy);

  const skuById = new Map(legacy.skus.map((sku) => [sku.id, sku]));
  const legacyProductById = new Map(legacy.products.map((product) => [product.id, product]));
  const activeOfferBySku = new Map<string, LegacyOfferV7>();
  for (const sku of legacy.skus) {
    const activeOffers = legacy.offers.filter((offer) => offer.skuId === sku.id && offer.status === 'ACTIVE');
    if (activeOffers.length !== 1) {
      throwMigrationBlocked('Mock v7 SKU 无法唯一确定当前租赁条件，原始数据已保留', {
        migrationKind: 'SCHEMA_V7_SKU_OFFER_AMBIGUOUS',
        skuId: sku.id,
        activeOfferIds: activeOffers.map((offer) => offer.id),
      });
    }
    activeOfferBySku.set(sku.id, activeOffers[0]!);
  }
  for (const product of legacy.products) {
    if (product.status === 'ACTIVE' && !legacy.skus.some((sku) => sku.productId === product.id)) {
      throwMigrationBlocked('Mock v7 启用商品缺少 SKU，无法确定标准型号', {
        migrationKind: 'SCHEMA_V7_PRODUCT_SKU_MISSING', productId: product.id,
      });
    }
  }

  const productIdBySku = new Map<string, string>();
  const productKeys = new Set<string>();
  const products: CurrentProduct[] = legacy.skus.map((sku, index) => {
    const legacyProduct = legacyProductById.get(sku.productId);
    if (legacyProduct === undefined) {
      throwMigrationBlocked('Mock v7 SKU 引用了不存在的商品', {
        migrationKind: 'SCHEMA_V7_SKU_PRODUCT_MISSING', skuId: sku.id, productId: sku.productId,
      });
    }
    const siblingCount = legacy.skus.filter((candidate) => candidate.productId === legacyProduct.id).length;
    const id = siblingCount === 1 ? legacyProduct.id : `${legacyProduct.id}_${sku.id}`;
    const baseName = legacyProduct.name.trim();
    const specName = sku.specName.trim();
    const name = normalizeCatalogKey(baseName).includes(normalizeCatalogKey(specName))
      ? baseName
      : `${baseName} ${specName}`.trim();
    const normalizedModel = normalizeCatalogKey(sku.model);
    const normalizedName = normalizeCatalogKey(name);
    const key = `${normalizeCatalogKey(sku.brand)}|${normalizedModel}|${normalizedName}`;
    if (productKeys.has(key)) {
      throwMigrationBlocked('Mock v7 标准商品归一化键冲突，原始数据已保留', {
        migrationKind: 'SCHEMA_V7_PRODUCT_KEY_CONFLICT', skuId: sku.id, key,
      });
    }
    productKeys.add(key);
    productIdBySku.set(sku.id, id);
    const coverMediaId = `media_standard_${index + 1}_cover`;
    return {
      id,
      productNo: `XY-P-${String(index + 1).padStart(6, '0')}`,
      brandId: `brand_${normalizeCatalogKey(sku.brand).replace(/[^a-z0-9]+/g, '_') || index + 1}`,
      name,
      brand: sku.brand,
      model: sku.model,
      normalizedModel,
      normalizedName,
      category: sku.category,
      description: legacyProduct.description,
      tags: [...new Set([...legacyProduct.tags, ...sku.tags])],
      coverMediaId,
      imageMediaIds: [coverMediaId, `media_standard_${index + 1}_detail`],
      videoMediaIds: [`media_standard_${index + 1}_video`],
      status: legacyProduct.status,
      createdAt: legacyProduct.createdAt,
      updatedAt: legacyProduct.updatedAt,
    };
  });

  const platformLessor: LessorProfile = {
    id: 'lessor_platform',
    lessorKind: 'PLATFORM',
    businessMode: 'B2C',
    displayName: '星遇直营',
    merchantId: null,
    userId: null,
    status: 'ACTIVE',
    createdAt: legacy.meta.currentTime,
    updatedAt: legacy.meta.currentTime,
  };
  const lessors: LessorProfile[] = [
    platformLessor,
    ...legacy.merchants.map((merchant) => ({
      id: `lessor_${merchant.id}`,
      lessorKind: 'MERCHANT' as const,
      businessMode: 'B2C' as const,
      displayName: merchant.name,
      merchantId: merchant.id,
      userId: null,
      status: merchant.status === 'ACTIVE' && merchant.archivedAt === null ? 'ACTIVE' as const : 'INACTIVE' as const,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    })),
  ];

  const assets: CurrentAsset[] = legacy.assets.map((asset) => {
    const sku = skuById.get(asset.skuId);
    const offer = activeOfferBySku.get(asset.skuId);
    const productId = productIdBySku.get(asset.skuId);
    const product = products.find((candidate) => candidate.id === productId);
    if (sku === undefined || offer === undefined || product === undefined) {
      throwMigrationBlocked('Mock v7 资产关系断裂，原始数据已保留', {
        migrationKind: 'SCHEMA_V7_ASSET_RELATION_MISSING', assetId: asset.id, skuId: asset.skuId,
      });
    }
    const availabilityStatus = mapLegacyAvailability(asset.status);
    return {
      id: asset.id,
      assetNo: asset.assetNo,
      productId: product.id,
      displayName: product.name,
      supplyMode: 'OFFICIAL',
      lessorId: platformLessor.id,
      identifierType: 'MANUFACTURER_SERIAL',
      identifierValue: asset.serialNumber,
      identifierNormalizedValue: normalizeCatalogKey(asset.serialNumber),
      condition: asset.condition,
      defectDescription: '',
      accessoryDescription: sku.accessoryNames.join('、'),
      rentalType: offer.rentalType,
      unitPriceFen: offer.unitPriceFen,
      minimumUnits: offer.minimumUnits,
      depositFen: offer.depositFen,
      referenceValueFen: asset.referenceValueFen ?? 0,
      currency: 'CNY',
      termsRevision: offer.version,
      termsEffectiveAt: asset.updatedAt,
      coverMediaId: product.coverMediaId,
      imageMediaIds: product.imageMediaIds,
      videoMediaIds: product.videoMediaIds,
      mediaSource: 'PRODUCT_STANDARD',
      publishLocationSnapshot: null,
      reviewStatus: 'NOT_REQUIRED',
      publishStatus: availabilityStatus === 'RETIRED' || availabilityStatus === 'FROZEN' ? 'OFFLINE' : 'ONLINE',
      availabilityStatus,
      boxId: asset.boxId,
      creationBatchId: 'batch_v7_migration',
      reviewRemark: null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  });
  const currentAssetById = new Map(assets.map((asset) => [asset.id, asset]));
  const assetTermsRevisions: AssetRentalTermsRevision[] = assets.map((asset) => ({
    id: `terms_${asset.id}_v${asset.termsRevision}`,
    assetId: asset.id,
    revision: asset.termsRevision,
    rentalType: asset.rentalType,
    unitPriceFen: asset.unitPriceFen,
    minimumUnits: asset.minimumUnits,
    depositFen: asset.depositFen,
    referenceValueFen: asset.referenceValueFen,
    currency: 'CNY',
    effectiveAt: asset.termsEffectiveAt,
    changedBy: 'system-migration',
    changeReason: 'Mock v7 租赁条件迁移',
  }));

const boxEvents: CurrentCabinetBoxEvent[] = legacy.boxEvents.map((event) => {
    const asset = currentAssetById.get(event.deviceSnapshot.assetId);
    const product = asset === undefined ? undefined : products.find((candidate) => candidate.id === asset.productId);
    return {
      ...event,
      deviceSnapshot: {
        assetId: event.deviceSnapshot.assetId,
        assetNo: event.deviceSnapshot.assetNo,
        productId: product?.id ?? '',
        productName: product?.name ?? event.deviceSnapshot.skuLabel,
        assetDisplayName: asset?.displayName ?? event.deviceSnapshot.skuLabel,
        model: product?.model ?? event.deviceSnapshot.model,
        identifierDisplay: asset?.identifierValue ?? event.deviceSnapshot.serialNumberDisplay,
      },
    };
  });

  const migrated: MockState = {
    meta: { ...legacy.meta, schemaVersion: MOCK_SCHEMA_VERSION, productVersion: PRODUCT_VERSION },
    merchants: structuredClone(legacy.merchants),
    lessors,
    cabinets: structuredClone(legacy.cabinets),
    boxes: structuredClone(legacy.boxes),
    boxEvents,
    products,
    productSupplementRequests: [],
    assets,
    assetTermsRevisions,

members: structuredClone(legacy.members),
    admins: legacy.admins.map(migrateLegacyAdminAccount),
    starAccounts: structuredClone(legacy.starAccounts),
    starLedger: structuredClone(legacy.starLedger),
    signInRecords: structuredClone(legacy.signInRecords),

contractPurchaseOrders: [],
    contractCreditLedger: [],

commands: structuredClone(legacy.commands),
    auditEvents: structuredClone(legacy.auditEvents),
    businessRuleVersions: structuredClone(legacy.businessRuleVersions),
    loyaltyConfigVersions: structuredClone(legacy.loyaltyConfigVersions),
  };
  assertMockInvariants(migrated);
  return migrated;
}

export function migrateLegacyV7StateForSeed(value: unknown): MockState {
  if (!hasLegacyMockStateShape(value)) {
    throw new DemoError('VALIDATION_FAILED', 'Mock v7 seed 结构不完整');
  }
  return migrateSchemaSevenState(structuredClone(value));
}

function hasCurrentMockStateShape(value: unknown): value is MockState {
  if (!isRecord(value) || !isRecord(value.meta)) return false;
  const meta = value.meta;
  return meta.schemaVersion === MOCK_SCHEMA_VERSION
    && typeof meta.productVersion === 'string'
    && meta.appMode === 'mock-demo'
    && (meta.scenarioName === 'normal' || meta.scenarioName === 'cabinet-offline' || meta.scenarioName === 'exceptions')
    && Array.isArray(value.merchants)
    && Array.isArray(value.lessors)
    && Array.isArray(value.cabinets)
    && Array.isArray(value.boxes)
    && Array.isArray(value.boxEvents)
    && Array.isArray(value.products)
    && Array.isArray(value.productSupplementRequests)
    && Array.isArray(value.assets)
    && Array.isArray(value.assetTermsRevisions)
    && Array.isArray(value.members)
    && Array.isArray(value.admins)
    && Array.isArray(value.starAccounts)
    && Array.isArray(value.starLedger)
    && Array.isArray(value.signInRecords)
    && Array.isArray(value.contractPurchaseOrders)
    && Array.isArray(value.contractCreditLedger)
    && Array.isArray(value.commands)
    && Array.isArray(value.auditEvents)
    && Array.isArray(value.businessRuleVersions)
    && Array.isArray(value.loyaltyConfigVersions)
    && !('skus' in value)
    && !('offers' in value);
}

function hasLegacySchemaEightOrNineCollections(value: Record<string, unknown>): boolean {
  return Array.isArray(value.merchants)
    && Array.isArray(value.lessors)
    && Array.isArray(value.cabinets)
    && Array.isArray(value.boxes)
    && Array.isArray(value.boxEvents)
    && Array.isArray(value.products)
    && Array.isArray(value.productSupplementRequests)
    && Array.isArray(value.assets)
    && Array.isArray(value.assetTermsRevisions)
    && Array.isArray(value.members)
    && Array.isArray(value.admins)
    && Array.isArray(value.starAccounts)
    && Array.isArray(value.starLedger)
    && Array.isArray(value.signInRecords)
    && Array.isArray(value.commands)
    && Array.isArray(value.auditEvents)
    && Array.isArray(value.businessRuleVersions)
    && Array.isArray(value.loyaltyConfigVersions)
    && !('skus' in value)
    && !('offers' in value);
}

function hasSchemaNineMockStateShape(value: unknown): value is LegacyMockStateV9 {
  if (!isRecord(value) || !isRecord(value.meta)) return false;
  return value.meta.schemaVersion === 9
    && value.meta.appMode === 'mock-demo'
    && hasLegacySchemaEightOrNineCollections(value);
}

function hasSchemaEightMockStateShape(value: unknown): value is LegacyMockStateV8 {
  if (!isRecord(value) || !isRecord(value.meta)) return false;
  return value.meta.schemaVersion === 8
    && value.meta.appMode === 'mock-demo'
    && hasLegacySchemaEightOrNineCollections(value);
}

function migrateSchemaNineState(legacy: LegacyMockStateV9): MockState {

const migrated: MockState = {
    ...legacy,
    meta: { ...legacy.meta, schemaVersion: MOCK_SCHEMA_VERSION, productVersion: PRODUCT_VERSION },

contractPurchaseOrders: [],
    contractCreditLedger: [],
  };
  assertMockInvariants(migrated);
  return migrated;
}

function migrateSchemaEightState(legacy: LegacyMockStateV8): MockState {
  return migrateSchemaNineState({
    ...legacy,
    meta: { ...legacy.meta, schemaVersion: 9 },
    admins: legacy.admins.map(migrateLegacyAdminAccount),
  });
}

export function isMockState(value: unknown): value is MockState {
  return hasCurrentMockStateShape(value) && value.meta.productVersion === PRODUCT_VERSION;
}

export function createDefaultBusinessRuleVersion(
  createdAt: string,
  createdBy = 'system-seed',
): BusinessRuleConfigVersion {
  return {
    id: 'business_rules_v1',
    version: 1,
    payScoreDepositFreeEnabled: true,
    payScoreDepositFreeThreshold: 650,
    contractUnitPriceFen: 100,
    publishingQuotaUnitPriceFen: 500,
    minimumHourlyRentalHours: 12,
    minimumDailyRentalDays: 3,
    createdAt,
    createdBy,
  };
}

export function createDefaultLoyaltyConfigVersion(
  createdAt: string,
  createdBy = 'system-seed',
): LoyaltyConfigVersion {
  return {
    id: 'loyalty_rules_v1',
    version: 1,
    consumptionStarTenthsPerYuan: 10,
    levels: [
      { id: 'level_seed_1', name: '初见', requiredStarTenths: 0 },
      { id: 'level_seed_2', name: '相知', requiredStarTenths: 10_000 },
      { id: 'level_seed_3', name: '星遇', requiredStarTenths: 50_000 },
    ],
    dailySignInRewardStarTenths: 10,
    streakRewards: [7, 15, 30, 90, 150, 365].map((consecutiveDays, index) => ({
      id: `streak_seed_${consecutiveDays}`,
      consecutiveDays,
      bonusStarTenths: [20, 50, 100, 300, 600, 2_000][index]!,
    })),
    timezone: 'Asia/Shanghai',
    createdAt,
    createdBy,
  };
}

function throwMigrationBlocked(message: string, details: Readonly<Record<string, unknown>> = {}): never {
  throw new DemoError('PERSISTENCE_INVALID', message, { ...details, migrationBlocked: true });
}

export function normalizePersistedMockState(value: unknown): MockState | null {
  if (isRecord(value) && ['orders', 'fulfillmentLogs', 'rentalContracts', 'settlements', 'settlementLines', 'depositClosureEvents', 'refundEvents', 'settlementAdjustmentEvents'].some((key) => key in value)) {
    throw new DemoError('PERSISTENCE_INVALID', '旧租赁订单 Mock 数据已退役，请重置本地演示数据');
  }

  if (isMockState(value)) {
    assertMockInvariants(value);
    return value;
  }
  if (hasCurrentMockStateShape(value)) {
    const normalized: MockState = {
      ...value,
      meta: { ...value.meta, productVersion: PRODUCT_VERSION },
    };
    assertMockInvariants(normalized);
    return normalized;
  }
  if (hasSchemaNineMockStateShape(value)) {
    return migrateSchemaNineState(structuredClone(value));
  }
  if (hasSchemaEightMockStateShape(value)) {
    return migrateSchemaEightState(structuredClone(value));
  }
  if (hasLegacyMockStateShape(value)) {
    return migrateSchemaSevenState(structuredClone(value));
  }
  if (isRecord(value) && isRecord(value.meta) && value.meta.schemaVersion === 6) {
    return migrateSchemaSevenState(migrateSchemaSixState(structuredClone(value)));
  }
  if (isRecord(value) && isRecord(value.meta) && value.meta.schemaVersion === 5) {
    return migrateSchemaSevenState(migrateSchemaSixState({ ...structuredClone(value), meta: { ...value.meta, schemaVersion: 6 } }));
  }
  return null;
}

function assertInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new DemoError('VALIDATION_FAILED', `${field} 必须是安全整数`, { field, value });
  }
}

function assertAddress(address: Merchant['operatingAddress'], field: string): void {
  if (address.fullAddress.trim() === '' || address.detailAddress.trim() === '' || !/^\d{6}$/.test(address.provinceCode) || !/^\d{6}$/.test(address.cityCode) || !/^\d{6}$/.test(address.districtCode)) {
    throw new DemoError('CONFLICT', '经营地址与详细地址不能为空', { field });
  }
  if (!Number.isFinite(address.longitude) || address.longitude < -180 || address.longitude > 180) {
    throw new DemoError('CONFLICT', '经营地址经度必须位于 -180 到 180', { field, longitude: address.longitude });
  }
  if (!Number.isFinite(address.latitude) || address.latitude < -90 || address.latitude > 90) {
    throw new DemoError('CONFLICT', '经营地址纬度必须位于 -90 到 90', { field, latitude: address.latitude });
  }
}

export function assertBusinessRuleValues(values: BusinessRuleConfigVersion | {
  payScoreDepositFreeEnabled: boolean;
  payScoreDepositFreeThreshold: number | null;
  contractUnitPriceFen: number;
  publishingQuotaUnitPriceFen: number;
  minimumHourlyRentalHours: number;
  minimumDailyRentalDays: number;
}): void {
  assertInteger(values.contractUnitPriceFen, 'contractUnitPriceFen');
  assertInteger(values.publishingQuotaUnitPriceFen, 'publishingQuotaUnitPriceFen');
  assertInteger(values.minimumHourlyRentalHours, 'minimumHourlyRentalHours');
  assertInteger(values.minimumDailyRentalDays, 'minimumDailyRentalDays');
  if (values.payScoreDepositFreeEnabled) {
    if (values.payScoreDepositFreeThreshold === null) {
      throw new DemoError('VALIDATION_FAILED', '开启支付分免押后必须配置原始分阈值');
    }
    assertInteger(values.payScoreDepositFreeThreshold, 'payScoreDepositFreeThreshold');
    if (values.payScoreDepositFreeThreshold < 1 || values.payScoreDepositFreeThreshold > 1_000) {
      throw new DemoError('VALIDATION_FAILED', '支付分免押阈值必须是 1 到 1000 的整数');
    }
  } else if (values.payScoreDepositFreeThreshold !== null) {
    throw new DemoError('VALIDATION_FAILED', '关闭支付分免押时阈值必须为空');
  }
  if (values.contractUnitPriceFen <= 0 || values.publishingQuotaUnitPriceFen <= 0) {
    throw new DemoError('VALIDATION_FAILED', '人民币价格必须使用大于 0 的整数分');
  }
  if (values.minimumHourlyRentalHours < 12 || values.minimumHourlyRentalHours > 720) {
    throw new DemoError('VALIDATION_FAILED', '最短小时租期必须为 12 到 720 小时');
  }
  if (values.minimumDailyRentalDays < 3 || values.minimumDailyRentalDays > 365) {
    throw new DemoError('VALIDATION_FAILED', '最短日租租期必须为 3 到 365 天');
  }
}

export function assertLoyaltyConfigValues(values: LoyaltyConfigVersion): void {
  assertInteger(values.consumptionStarTenthsPerYuan, 'consumptionStarTenthsPerYuan');
  assertInteger(values.dailySignInRewardStarTenths, 'dailySignInRewardStarTenths');
  if (values.consumptionStarTenthsPerYuan < 1 || values.dailySignInRewardStarTenths < 1) {
    throw new DemoError('VALIDATION_FAILED', '消费获星钻与每日签到奖励最少为 0.1 星钻');
  }
  if (values.timezone !== 'Asia/Shanghai') {
    throw new DemoError('VALIDATION_FAILED', '签到自然日时区必须为 Asia/Shanghai');
  }
  if (values.levels.length === 0) {
    throw new DemoError('VALIDATION_FAILED', '至少需要配置一个等级');
  }
  const names = new Set<string>();
  let previousThreshold = -1;
  for (const level of values.levels) {
    const name = level.name.trim();
    if (name === '' || names.has(name)) {
      throw new DemoError('VALIDATION_FAILED', '等级名称不能为空且必须唯一', { levelName: name });
    }
    assertInteger(level.requiredStarTenths, 'requiredStarTenths');
    if (level.requiredStarTenths < 0 || level.requiredStarTenths <= previousThreshold) {
      throw new DemoError('VALIDATION_FAILED', '等级所需星钻必须按录入顺序严格递增', {
        levelName: name,
        requiredStarTenths: level.requiredStarTenths,
      });
    }
    names.add(name);
    previousThreshold = level.requiredStarTenths;
  }
  const streakDays = new Set<number>();
  const streakIds = new Set<string>();
  for (const reward of values.streakRewards) {
    assertInteger(reward.consecutiveDays, 'consecutiveDays');
    assertInteger(reward.bonusStarTenths, 'bonusStarTenths');
    if (reward.consecutiveDays < 1 || reward.consecutiveDays > 3_650 || reward.bonusStarTenths < 0) {
      throw new DemoError('VALIDATION_FAILED', '连续签到天数需为 1 到 3650，额外奖励不得小于 0');
    }
    if (streakDays.has(reward.consecutiveDays) || streakIds.has(reward.id)) {
      throw new DemoError('VALIDATION_FAILED', '连续签到里程碑天数与 ID 必须唯一');
    }
    streakDays.add(reward.consecutiveDays);
    streakIds.add(reward.id);
  }
}

function assertLegacyMockInvariants(state: LegacyMockStateV7): void {
  const merchantIds = new Set(state.merchants.map((merchant) => merchant.id));
  const cabinetIds = new Set(state.cabinets.map((cabinet) => cabinet.id));
  const boxIds = new Set(state.boxes.map((box) => box.id));
  const productIds = new Set(state.products.map((product) => product.id));
  const skuIds = new Set(state.skus.map((sku) => sku.id));
  const offerIds = new Set(state.offers.map((offer) => offer.id));
  const assetIds = new Set(state.assets.map((asset) => asset.id));

  if (merchantIds.size !== state.merchants.length) {
    throw new DemoError('CONFLICT', '商家 ID 重复');
  }
  if (cabinetIds.size !== state.cabinets.length || boxIds.size !== state.boxes.length) {
    throw new DemoError('CONFLICT', '柜机或格口 ID 重复');
  }
  if (productIds.size !== state.products.length || skuIds.size !== state.skus.length || offerIds.size !== state.offers.length || assetIds.size !== state.assets.length) {
    throw new DemoError('CONFLICT', '商品、规格、租赁方案或资产 ID 重复');
  }

  for (const product of state.products) {
    if (product.name.trim() === '' || product.brand.trim() === '' || product.category.trim() === '') {
      throw new DemoError('CONFLICT', '商品名称、品牌和分类不能为空', { productId: product.id });
    }
  }
  for (const sku of state.skus) {
    if (!productIds.has(sku.productId) || sku.specName.trim() === '' || (sku.rentalType !== 'DAY' && sku.rentalType !== 'HOUR')) {
      throw new DemoError('CONFLICT', '规格必须关联有效商品且规格名称不能为空', { skuId: sku.id, productId: sku.productId });
    }
    const activeOffers = state.offers.filter((offer) => offer.skuId === sku.id && offer.status === 'ACTIVE');
    if ((sku.status === 'ACTIVE' && activeOffers.length !== 1) || activeOffers.length > 1) {
      throw new DemoError('CONFLICT', '启用规格必须且只能关联一个当前租赁配置', { skuId: sku.id, activeOfferCount: activeOffers.length });
    }
    if (activeOffers.some((offer) => offer.rentalType !== sku.rentalType)) {
      throw new DemoError('CONFLICT', '租赁配置必须使用 SKU 锁定的租赁模式', { skuId: sku.id, rentalType: sku.rentalType });
    }
  }

  for (const merchant of state.merchants) {
    assertAddress(merchant.operatingAddress, `merchant:${merchant.id}:operatingAddress`);
    assertInteger(merchant.shareBps, 'shareBps');
    if (merchant.shareBps < 0 || merchant.shareBps > 10_000) {
      throw new DemoError('CONFLICT', '商家分润比例必须位于 0% 到 100%', { merchantId: merchant.id });
    }
  }

  const externalCabinetIds = new Set<string>();
  for (const cabinet of state.cabinets) {
    if (!merchantIds.has(cabinet.merchantId)) {
      throw new DemoError('CONFLICT', '柜机引用了不存在的商家', { cabinetRecordId: cabinet.id });
    }
    assertAddress(cabinet.deploymentAddressSnapshot, `cabinet:${cabinet.id}:deploymentAddressSnapshot`);
    if (cabinet.merchantSnapshot.id !== cabinet.merchantId || cabinet.merchantSnapshot.name.trim() === '') {
      throw new DemoError('CONFLICT', '柜机必须保存创建时商家快照', { cabinetRecordId: cabinet.id });
    }
    if (externalCabinetIds.has(cabinet.cabinetId)) {
      throw new DemoError('CONFLICT', 'cabinetId 必须全局唯一', { cabinetId: cabinet.cabinetId });
    }
    externalCabinetIds.add(cabinet.cabinetId);
    const cabinetBoxes = state.boxes.filter((box) => box.cabinetRecordId === cabinet.id);
    if (cabinetBoxes.length !== cabinet.boxCount) {
      throw new DemoError('CONFLICT', '柜机 boxCount 与格口记录数量不一致', { cabinetRecordId: cabinet.id });
    }
    const boxNumbers = new Set(cabinetBoxes.map((box) => box.boxNo));
    if (boxNumbers.size !== cabinet.boxCount) {
      throw new DemoError('CONFLICT', '同一柜机 boxNo 重复', { cabinetRecordId: cabinet.id });
    }
    for (let boxNo = 1; boxNo <= cabinet.boxCount; boxNo += 1) {
      if (!boxNumbers.has(boxNo)) {
        throw new DemoError('CONFLICT', '柜机 boxNo 必须连续生成 1..N', { cabinetRecordId: cabinet.id, boxNo });
      }
    }
  }

  const occupiedAssetIds = new Set<string>();
  for (const box of state.boxes) {
    if (!cabinetIds.has(box.cabinetRecordId)) {
      throw new DemoError('CONFLICT', '格口引用了不存在的柜机', { boxId: box.id });
    }
    if (box.assetId !== null) {
      if (!assetIds.has(box.assetId) || occupiedAssetIds.has(box.assetId)) {
        throw new DemoError('CONFLICT', '一个资产最多绑定一个格口', { assetId: box.assetId });
      }
      occupiedAssetIds.add(box.assetId);
    }
  }

  const boxEventIds = new Set<string>();
  for (const event of state.boxEvents) {
    if (boxEventIds.has(event.id)) {
      throw new DemoError('CONFLICT', '格口事件 ID 重复', { eventId: event.id });
    }
    boxEventIds.add(event.id);
    const box = state.boxes.find((candidate) => candidate.id === event.boxId);
    if (
      box === undefined ||
      box.cabinetRecordId !== event.cabinetRecordId ||
      box.boxNo !== event.boxNo
    ) {
      throw new DemoError('CONFLICT', '格口事件引用与柜机格口不一致', { eventId: event.id });
    }
    if (event.type !== 'STORE' && event.type !== 'TAKE_OUT') {
      throw new DemoError('CONFLICT', '格口事件类型无效', { eventId: event.id, type: event.type });
    }
    if (!['SUCCEEDED', 'FAILED', 'UNKNOWN'].includes(event.result)) {
      throw new DemoError('CONFLICT', '格口事件结果无效', { eventId: event.id, result: event.result });
    }
    if (
      event.deviceSnapshot.assetId.trim() === '' ||
      event.deviceSnapshot.assetNo.trim() === '' ||
      event.deviceSnapshot.skuId.trim() === '' ||
      event.deviceSnapshot.skuLabel.trim() === '' ||
      event.deviceSnapshot.model.trim() === '' ||
      event.deviceSnapshot.serialNumberDisplay.trim() === '' ||
      event.actorSnapshot.actorId.trim() === '' ||
      event.actorSnapshot.displayName.trim() === ''
    ) {
      throw new DemoError('CONFLICT', '格口事件必须保存完整设备与操作人快照', { eventId: event.id });
    }
  }

  const rulesByVersion = new Map(state.businessRuleVersions.map((rules) => [rules.version, rules]));
  const currentBusinessRules = [...state.businessRuleVersions]
    .sort((left, right) => right.version - left.version)[0];
  const activeOfferKeys = new Set<string>();
  for (const offer of state.offers) {
    if (!skuIds.has(offer.skuId)) {
      throw new DemoError('CONFLICT', '租赁方案引用了不存在的 SKU', { offerId: offer.id });
    }
    if (offer.rentalType !== 'DAY' && offer.rentalType !== 'HOUR') {
      throw new DemoError('CONFLICT', '租赁方案类型必须为按天或按小时', { offerId: offer.id });
    }
    assertInteger(offer.unitPriceFen, 'unitPriceFen');
    assertInteger(offer.minimumUnits, 'minimumUnits');
    assertInteger(offer.dailyRentFen, 'dailyRentFen');
    assertInteger(offer.depositFen, 'depositFen');
    assertInteger(offer.version, 'offerVersion');
    assertInteger(offer.rulesVersion, 'offerRulesVersion');
    const offerRules = rulesByVersion.get(offer.rulesVersion);
    const expectedMinimum = offerRules === undefined
      ? null
      : offer.rentalType === 'DAY'
        ? offerRules.minimumDailyRentalDays
        : offerRules.minimumHourlyRentalHours;
    if (
      offer.unitPriceFen < 0
      || offer.version < 1
      || offer.rulesVersion < 1
      || expectedMinimum === null
      || offer.minimumUnits !== expectedMinimum
      || offer.dailyRentFen !== (offer.rentalType === 'DAY' ? offer.unitPriceFen : 0)
    ) {
      throw new DemoError('CONFLICT', '租赁方案单位价格、最小单位或兼容日租投影无效', { offerId: offer.id });
    }
    if (offer.status === 'ACTIVE') {
      const activeKey = offer.skuId;
      if (activeOfferKeys.has(activeKey)) {
        throw new DemoError('CONFLICT', '同一规格最多一个启用租赁配置', { offerId: offer.id, activeKey });
      }
      activeOfferKeys.add(activeKey);
      const sku = state.skus.find((candidate) => candidate.id === offer.skuId);
      if (sku?.rentalType !== offer.rentalType) {
        throw new DemoError('CONFLICT', '启用租赁配置必须匹配 SKU 租赁模式', { offerId: offer.id, skuRentalType: sku?.rentalType });
      }
      if (currentBusinessRules === undefined || offer.rulesVersion !== currentBusinessRules.version) {
        throw new DemoError('CONFLICT', '启用租赁方案必须同步当前基础规则版本', {
          offerId: offer.id,
          offerRulesVersion: offer.rulesVersion,
          currentRulesVersion: currentBusinessRules?.version ?? null,
        });
      }
    }
  }

  for (const asset of state.assets) {
    if (!skuIds.has(asset.skuId)) {
      throw new DemoError('CONFLICT', '资产引用了不存在的 SKU', { assetId: asset.id });
    }
    if (asset.referenceValueFen !== null) {
      assertInteger(asset.referenceValueFen, 'referenceValueFen');
      if (asset.referenceValueFen <= 0) throw new DemoError('CONFLICT', '资产参考价值必须为正整数分', { assetId: asset.id });
    }
    if (asset.boxId !== null) {
      const box = state.boxes.find((candidate) => candidate.id === asset.boxId);
      if (box === undefined || box.assetId !== asset.id) {
        throw new DemoError('CONFLICT', '资产与格口必须双向一致', { assetId: asset.id, boxId: asset.boxId });
      }
    }
  }

const memberIds = new Set<string>();
  for (const member of state.members) {
    if (memberIds.has(member.userId)) throw new DemoError('CONFLICT', '会员 userId 重复', { userId: member.userId });
    memberIds.add(member.userId);

}

const adminIds = new Set<string>();
  const adminMobiles = new Set<string>();
  for (const admin of state.admins) {
    if (adminIds.has(admin.id) || adminMobiles.has(admin.mobile) || !/^1\d{10}$/.test(admin.mobile)) {
      throw new DemoError('CONFLICT', '管理员 ID、手机号必须唯一且手机号格式有效', { adminId: admin.id });
    }
    adminIds.add(admin.id);
    adminMobiles.add(admin.mobile);
  }
  if (!state.admins.some((admin) => admin.role === 'SUPER_ADMIN' && admin.status === 'ACTIVE' && admin.archivedAt === null)) {
    throw new DemoError('CONFLICT', '必须保留至少一个有效超级管理员');
  }

const ledgerIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const account of state.starAccounts) {
    const entries = state.starLedger.filter((entry) => entry.userId === account.userId).sort((a, b) => a.accountSequence - b.accountSequence);
    if (entries[0]?.type !== 'OPENING' || entries[0].accountSequence !== 0 || entries.filter((entry) => entry.type === 'OPENING').length !== 1) throw new DemoError('CONFLICT', '每个星钻账户必须恰有一条 sequence 0 的 OPENING 流水');
    const balance = { availableTenths: 0, frozenTenths: 0, consumedTenths: 0, recoveryDueTenths: 0 };
    entries.forEach((entry, index) => {
      if (entry.accountSequence !== index || ledgerIds.has(entry.id) || idempotencyKeys.has(entry.idempotencyKey)) throw new DemoError('CONFLICT', '星钻流水 ID、幂等键和账户 sequence 必须唯一连续');
      ledgerIds.add(entry.id); idempotencyKeys.add(entry.idempotencyKey);
      for (const [field, amount] of Object.entries({
        grossStarTenths: entry.grossStarTenths,
        availableDeltaTenths: entry.availableDeltaTenths,
        frozenDeltaTenths: entry.frozenDeltaTenths,
        consumedDeltaTenths: entry.consumedDeltaTenths,
        recoveryDueDeltaTenths: entry.recoveryDueDeltaTenths,
      })) assertInteger(amount, `starLedger.${entry.id}.${field}`);
      if (entry.type !== 'OPENING' && entry.grossStarTenths <= 0) throw new DemoError('CONFLICT', '非 OPENING 流水 grossStarTenths 必须为正整数');
      balance.availableTenths += entry.availableDeltaTenths;
      balance.frozenTenths += entry.frozenDeltaTenths;
      balance.consumedTenths += entry.consumedDeltaTenths;
      balance.recoveryDueTenths += entry.recoveryDueDeltaTenths;
      if (Object.values(balance).some((amount) => amount < 0) || JSON.stringify(balance) !== JSON.stringify(entry.balanceAfter)) throw new DemoError('CONFLICT', '星钻流水四桶重放或 balanceAfter 不守恒');
    });
    if (balance.availableTenths !== account.availableTenths || balance.frozenTenths !== account.frozenTenths || balance.consumedTenths !== account.consumedTenths || balance.recoveryDueTenths !== account.recoveryDueTenths) throw new DemoError('CONFLICT', '星钻账户必须等于流水重放结果');
  }
  const signInKeys = new Set<string>();
  for (const record of state.signInRecords) {
    const key = `${record.userId}:${record.businessDate}`;
    const ledger = state.starLedger.find((entry) => entry.id === record.ledgerEntryId);
    if (signInKeys.has(key) || ledger?.sourceType !== 'SIGN_IN' || ledger.sourceId !== record.signInId || ledger.grossStarTenths !== record.dailyRewardStarTenths + record.milestoneBonusStarTenths) throw new DemoError('CONFLICT', '签到记录必须同日唯一并与一条 EARN 流水双向关联');
    signInKeys.add(key);
  }

if (state.businessRuleVersions.length === 0) {
    throw new DemoError('CONFLICT', '至少需要一个经营规则版本');
  }
  const ruleIds = new Set<string>();
  const ruleVersions = new Set<number>();
  for (const rules of state.businessRuleVersions) {
    assertInteger(rules.version, 'businessRuleVersion');
    if (rules.version < 1 || ruleIds.has(rules.id) || ruleVersions.has(rules.version)) {
      throw new DemoError('CONFLICT', '经营规则版本 ID 与版本号必须唯一且从 1 开始', {
        ruleId: rules.id,
        version: rules.version,
      });
    }
    ruleIds.add(rules.id);
    ruleVersions.add(rules.version);
    assertBusinessRuleValues(rules);
  }
  if (state.loyaltyConfigVersions.length === 0) throw new DemoError('CONFLICT', '至少需要一个忠诚度规则版本');
  const loyaltyIds = new Set<string>();
  const loyaltyVersions = new Set<number>();
  
  for (const loyalty of state.loyaltyConfigVersions) {
    if (loyalty.version < 1 || loyaltyIds.has(loyalty.id) || loyaltyVersions.has(loyalty.version)) {
      throw new DemoError('CONFLICT', '忠诚度规则版本 ID 与版本号必须唯一', { loyaltyId: loyalty.id, version: loyalty.version });
    }
    loyaltyIds.add(loyalty.id);
    loyaltyVersions.add(loyalty.version);
    assertLoyaltyConfigValues(loyalty);
  }
}

function assertUniqueIds(rows: readonly { id: string }[], entity: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.id.trim() === '' || ids.has(row.id)) {
      throw new DemoError('CONFLICT', `${entity} ID 不能为空且必须唯一`, { id: row.id });
    }
    ids.add(row.id);
  }
  return ids;
}

function assertCurrentAdmins(admins: readonly AdminAccount[]): void {
  const adminIds = new Set<string>();
  const adminMobiles = new Set<string>();
  for (const admin of admins) {
    if (adminIds.has(admin.id) || adminMobiles.has(admin.mobile) || !/^1\d{10}$/.test(admin.mobile)) {
      throw new DemoError('CONFLICT', '管理员 ID、手机号必须唯一且手机号格式有效', { adminId: admin.id });
    }
    adminIds.add(admin.id);
    adminMobiles.add(admin.mobile);
    if (admin.loginCapabilities.phone !== true || admin.loginCapabilities.wechat !== (admin.wechatBinding.status === 'BOUND')) {
      throw new DemoError('CONFLICT', '管理员登录能力必须与微信绑定状态一致', { adminId: admin.id });
    }
    if (admin.wechatBinding.status === 'BOUND') {
      if ((admin.wechatBinding.nickname ?? '').trim() === '' || (admin.wechatBinding.avatarUrl ?? '').trim() === '' || admin.wechatBinding.boundAt === null) {
        throw new DemoError('CONFLICT', '已绑定微信的管理员必须回显昵称、头像和绑定时间', { adminId: admin.id });
      }
    } else if (admin.wechatBinding.nickname !== null || admin.wechatBinding.avatarUrl !== null || admin.wechatBinding.boundAt !== null) {
      throw new DemoError('CONFLICT', '未绑定微信的管理员不能保留微信资料', { adminId: admin.id });
    }
  }
  if (!admins.some((admin) => admin.role === 'SUPER_ADMIN' && admin.status === 'ACTIVE' && admin.archivedAt === null)) {
    throw new DemoError('CONFLICT', '必须保留至少一个有效超级管理员');
  }
}

const WECHAT_PAY_OPERATIONS = new Set(['PAYMENT', 'REFUND', 'DEPOSIT_RETURN', 'SUPPLEMENT', 'SETTLEMENT']);
const WECHAT_PAY_STATUSES = new Set(['NOT_STARTED', 'PENDING', 'PROCESSING', 'CONFIRMING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'CLOSED']);
const WECHAT_PAY_RESULT_SOURCES = new Set(['CREATED', 'NOTIFICATION', 'QUERY', 'MANUAL_VERIFICATION', 'MIGRATION']);
const WECHAT_PAY_NOTIFICATION_STATUSES = new Set(['NOT_RECEIVED', 'RECEIVED', 'IGNORED']);
const WECHAT_PAY_PROVIDER_STATUSES_BY_LOCAL_STATUS: Readonly<Record<string, ReadonlySet<string>>> = {
  NOT_STARTED: new Set(['NOT_STARTED']),
  PENDING: new Set(['NOTPAY', 'PENDING']),
  PROCESSING: new Set(['PROCESSING']),
  CONFIRMING: new Set(['CONFIRMING']),
  SUCCEEDED: new Set(['SUCCESS']),
  FAILED: new Set(['PAYERROR', 'REFUNDCLOSED', 'FAILED']),
  UNKNOWN: new Set(['UNKNOWN']),
  CLOSED: new Set(['CLOSED']),
};
const CONTRACT_PURCHASE_LIFECYCLE_STATUSES = new Set(['OPEN', 'COMPLETED', 'CLOSED', 'EXCEPTION']);
const CONTRACT_ENTITLEMENT_STATUSES = new Set(['NOT_GRANTED', 'GRANT_PENDING', 'GRANTED', 'FROZEN', 'REVERSED', 'FAILED']);
const CONTRACT_LEDGER_TYPES = new Set(['GRANT', 'RELEASE', 'FREEZE', 'REVERSE']);

const SAFE_SYNTHETIC_ID = /^[0-9A-Za-z_.:\-|*@]{1,128}$/;
const RFC3339_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const SENSITIVE_PROVIDER_VALUE_MARKER = /(openid|mchid|merchant[_-]?id|api[_-]?v?3|secret|token|authorization|private[_-]?key|callback[_-]?payload|notify[_-]?payload)/i;

function isStrictRfc3339Timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = RFC3339_TIMESTAMP.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === 'Z' ? 0 : Number(match[10]);
  const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]!
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && !Number.isNaN(Date.parse(value));
}

function assertEnumValue(value: unknown, allowed: ReadonlySet<string>, field: string): void {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new DemoError('CONFLICT', 'Mock 持久化枚举值无效', { field, value });
  }
}

function assertSafeSyntheticValue(value: string | null, field: string): void {
  if (value === null) return;
  if (!SAFE_SYNTHETIC_ID.test(value) || SENSITIVE_PROVIDER_VALUE_MARKER.test(value)) {
    throw new DemoError('CONFLICT', '支付 Mock 外部文本必须是无敏感标记的合成标识', { field });
  }
}

function assertWechatPayMockFacts(
  fact: ContractPurchaseOrder['payment'],
  field: string,
): void {
  const allowedKeys = new Set([
    'provider', 'operation', 'merchantRequestNo', 'outTradeNo', 'transactionId', 'outRefundNo', 'refundId',
    'amountFen', 'currency', 'status', 'providerStatus', 'resultSource', 'notificationStatus', 'notificationId',
    'notificationDedupeKey', 'notificationReceivedAt', 'idempotencyKey', 'lastQueriedAt', 'timeExpire', 'errorCode',
    'createdAt', 'updatedAt',
  ]);
  const unknownKeys = Object.keys(fact).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new DemoError('CONFLICT', '支付 Mock 事实含未授权字段，拒绝持久化未知或敏感 Provider 内容', { field, unknownKeys });
  }
  if (fact.provider !== 'WECHAT_PAY_MOCK' || fact.currency !== 'CNY') {
    throw new DemoError('CONFLICT', '支付 Mock 事实必须使用 WECHAT_PAY_MOCK 与 CNY', { field });
  }
  assertEnumValue(fact.operation, WECHAT_PAY_OPERATIONS, `${field}.operation`);
  assertEnumValue(fact.status, WECHAT_PAY_STATUSES, `${field}.status`);
  assertEnumValue(fact.resultSource, WECHAT_PAY_RESULT_SOURCES, `${field}.resultSource`);
  assertEnumValue(fact.notificationStatus, WECHAT_PAY_NOTIFICATION_STATUSES, `${field}.notificationStatus`);
  assertEnumValue(fact.providerStatus, WECHAT_PAY_PROVIDER_STATUSES_BY_LOCAL_STATUS[fact.status] ?? new Set(), `${field}.providerStatus`);
  if (
    fact.providerStatus === 'NOTPAY' && !['PAYMENT', 'SUPPLEMENT'].includes(fact.operation)
    || fact.providerStatus === 'PAYERROR' && !['PAYMENT', 'SUPPLEMENT'].includes(fact.operation)
    || fact.providerStatus === 'REFUNDCLOSED' && !['REFUND', 'DEPOSIT_RETURN'].includes(fact.operation)
  ) {
    throw new DemoError('CONFLICT', '支付 Mock Provider 状态必须与具体操作语义一致', { field, operation: fact.operation });
  }
  assertInteger(fact.amountFen, `${field}.amountFen`);
  if (
    fact.amountFen < 0
    || typeof fact.providerStatus !== 'string'
    || fact.providerStatus.trim() === ''
    || fact.merchantRequestNo.trim() === ''
    || fact.outTradeNo.trim() === ''
    || fact.idempotencyKey.trim() === ''
  ) {
    throw new DemoError('CONFLICT', '支付 Mock 金额和商户单号必须完整', { field });
  }
  if (!/^[0-9A-Za-z_\-|*]{6,32}$/.test(fact.outTradeNo)) {
    throw new DemoError('CONFLICT', 'outTradeNo 必须为 6–32 位且只含微信商户单号允许字符', { field, outTradeNo: fact.outTradeNo });
  }
  if (fact.outRefundNo !== null && (!/^[0-9A-Za-z_\-|*@]{1,64}$/.test(fact.outRefundNo))) {
    throw new DemoError('CONFLICT', 'outRefundNo 必须不超过 64 位且只含微信商户单号允许字符', { field, outRefundNo: fact.outRefundNo });
  }
  for (const [identityField, value] of Object.entries({
    merchantRequestNo: fact.merchantRequestNo,
    transactionId: fact.transactionId,
    refundId: fact.refundId,
    providerStatus: fact.providerStatus,
    notificationId: fact.notificationId,
    notificationDedupeKey: fact.notificationDedupeKey,
    idempotencyKey: fact.idempotencyKey,
    errorCode: fact.errorCode,
  })) assertSafeSyntheticValue(value, `${field}.${identityField}`);
  const isRefundOperation = fact.operation === 'REFUND' || fact.operation === 'DEPOSIT_RETURN';
  if (
    !isRefundOperation && (fact.outRefundNo !== null || fact.refundId !== null)
    || !['PAYMENT', 'REFUND', 'DEPOSIT_RETURN'].includes(fact.operation) && fact.transactionId !== null
  ) {
    throw new DemoError('CONFLICT', '支付、退款与其他资金操作的 Provider 身份字段不得混用', { field, operation: fact.operation });
  }
  for (const [timeField, value] of Object.entries({
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
    lastQueriedAt: fact.lastQueriedAt,
    notificationReceivedAt: fact.notificationReceivedAt,
    timeExpire: fact.timeExpire,
  })) {
    if (value !== null && !isStrictRfc3339Timestamp(value)) {
      throw new DemoError('CONFLICT', '支付 Mock 时间必须是可解析的 RFC3339 时间', { field, timeField, value });
    }
  }
  if (fact.operation === 'PAYMENT' && fact.status === 'PENDING' && fact.timeExpire === null) {
    throw new DemoError('CONFLICT', '新建待支付订单必须保存支付过期时间', { field });
  }
  if (
    fact.operation !== 'PAYMENT' && fact.timeExpire !== null
    || fact.timeExpire !== null && Date.parse(fact.timeExpire) <= Date.parse(fact.createdAt)
  ) {
    throw new DemoError('CONFLICT', '支付过期时间仅属于原支付单且必须晚于创建时间', { field });
  }
  if (fact.notificationStatus === 'RECEIVED' && (
    fact.notificationId === null
    || fact.notificationDedupeKey === null
    || fact.notificationReceivedAt === null
  )) {
    throw new DemoError('CONFLICT', '已接收支付通知必须保存合成通知标识、去重键和时间', { field });
  }
  if (
    fact.resultSource === 'QUERY' && fact.lastQueriedAt === null
    || fact.resultSource === 'NOTIFICATION' && fact.notificationStatus !== 'RECEIVED'
    || ['CREATED', 'MIGRATION'].includes(fact.resultSource) && fact.notificationStatus === 'RECEIVED'
    || ['CREATED', 'MIGRATION'].includes(fact.resultSource) && fact.lastQueriedAt !== null
    || fact.notificationStatus !== 'RECEIVED' && (
      fact.notificationId !== null || fact.notificationDedupeKey !== null || fact.notificationReceivedAt !== null
    )
  ) {
    throw new DemoError('CONFLICT', '支付 Mock 当前结果来源必须有对应审计字段，历史通知或查单证据不得因后续人工核对而丢失', { field });
  }
  if (
    Date.parse(fact.createdAt) > Date.parse(fact.updatedAt)
    || fact.lastQueriedAt !== null && (
      Date.parse(fact.lastQueriedAt) < Date.parse(fact.createdAt) || Date.parse(fact.lastQueriedAt) > Date.parse(fact.updatedAt)
    )
    || fact.notificationReceivedAt !== null && (
      Date.parse(fact.notificationReceivedAt) < Date.parse(fact.createdAt) || Date.parse(fact.notificationReceivedAt) > Date.parse(fact.updatedAt)
    )
  ) {
    throw new DemoError('CONFLICT', '支付 Mock 审计时间必须满足 created <= notification/query <= updated', { field });
  }
  if (fact.operation === 'PAYMENT' && fact.status === 'SUCCEEDED' && fact.transactionId === null) {
    throw new DemoError('CONFLICT', '成功支付事实必须保存合成 transactionId', { field });
  }
  if (
    ['REFUND', 'DEPOSIT_RETURN'].includes(fact.operation)
    && fact.status === 'SUCCEEDED'
    && (fact.refundId === null || fact.transactionId === null)
  ) {
    throw new DemoError('CONFLICT', '成功退款或退押事实必须保存合成 refundId 与原支付 transactionId', { field });
  }
  if (fact.status === 'FAILED' && (fact.errorCode ?? '').trim() === '') {
    throw new DemoError('CONFLICT', '失败支付 Mock 事实必须保存错误码', { field });
  }
  if (fact.status !== 'FAILED' && fact.errorCode !== null) {
    throw new DemoError('CONFLICT', '非失败支付 Mock 事实不得保留伪造错误码', { field });
  }
  if ((fact.operation === 'REFUND' || fact.operation === 'DEPOSIT_RETURN') && fact.outRefundNo === null) {
    throw new DemoError('CONFLICT', '退款或退押事实必须保存合成退款单号', { field });
  }
}

function assertWechatPayMockIdentityUniqueness(state: MockState): void {
  const facts = [
    
    ...state.contractPurchaseOrders.flatMap((order) => [order.payment, order.refund].filter((fact): fact is NonNullable<typeof fact> => fact !== null)),
  ];
  const paymentOutTradeNos = new Set<string>();
  const refundNos = new Set<string>();
  const refundIds = new Set<string>();
  const transactionOwners = new Map<string, string>();
  
  const notificationIds = new Set<string>();
  const notificationDedupeKeys = new Set<string>();
  const operationIdempotencyKeys = new Set<string>();
  for (const fact of facts) {
    if (fact.operation === 'PAYMENT') {
      if (paymentOutTradeNos.has(fact.outTradeNo)) throw new DemoError('CONFLICT', '同商户 outTradeNo 必须唯一', { outTradeNo: fact.outTradeNo });
      paymentOutTradeNos.add(fact.outTradeNo);
    }
    if (fact.outRefundNo !== null) {
      if (refundNos.has(fact.outRefundNo)) throw new DemoError('CONFLICT', '同商户 outRefundNo 必须唯一且同号只能表示同一退款意图', { outRefundNo: fact.outRefundNo });
      refundNos.add(fact.outRefundNo);
    }
    if (fact.transactionId !== null) {
      const existingOutTradeNo = transactionOwners.get(fact.transactionId);
      if (existingOutTradeNo !== undefined && existingOutTradeNo !== fact.outTradeNo) {
        throw new DemoError('CONFLICT', '同一微信支付 transactionId 只能绑定一个原支付商户单', {
          transactionId: fact.transactionId,
          existingOutTradeNo,
          outTradeNo: fact.outTradeNo,
        });
      }
      transactionOwners.set(fact.transactionId, fact.outTradeNo);
    }
    if (fact.refundId !== null) {
      if (refundIds.has(fact.refundId)) throw new DemoError('CONFLICT', '微信支付 refundId 必须全局唯一', { refundId: fact.refundId });
      refundIds.add(fact.refundId);
    }
    if (fact.notificationId !== null) {
      if (notificationIds.has(fact.notificationId)) throw new DemoError('CONFLICT', '微信支付 Mock 通知标识必须唯一', { notificationId: fact.notificationId });
      notificationIds.add(fact.notificationId);
    }
    if (fact.notificationDedupeKey !== null) {
      if (notificationDedupeKeys.has(fact.notificationDedupeKey)) throw new DemoError('CONFLICT', '重复通知必须命中同一已保存事实，不得生成第二条去重键记录', { notificationDedupeKey: fact.notificationDedupeKey });
      notificationDedupeKeys.add(fact.notificationDedupeKey);
    }
    if (operationIdempotencyKeys.has(fact.idempotencyKey)) throw new DemoError('CONFLICT', '支付 Mock 操作幂等键必须唯一', { idempotencyKey: fact.idempotencyKey });
    operationIdempotencyKeys.add(fact.idempotencyKey);
  }
}

function assertContractPurchaseFacts(state: MockState, lessorIds: ReadonlySet<string>): void {
  const purchaseIds = assertUniqueIds(state.contractPurchaseOrders, '电子合同服务购买订单');
  const purchaseNos = new Set<string>();
  for (const purchase of state.contractPurchaseOrders) {
    if (purchaseNos.has(purchase.orderNo)) throw new DemoError('CONFLICT', '电子合同服务购买订单号必须唯一', { orderId: purchase.id });
    purchaseNos.add(purchase.orderNo);
    assertEnumValue(purchase.lifecycleStatus, CONTRACT_PURCHASE_LIFECYCLE_STATUSES, `contractPurchase:${purchase.id}:lifecycleStatus`);
    assertEnumValue(purchase.entitlement.status, CONTRACT_ENTITLEMENT_STATUSES, `contractPurchase:${purchase.id}:entitlement.status`);
    if (
      !isStrictRfc3339Timestamp(purchase.createdAt)
      || !isStrictRfc3339Timestamp(purchase.updatedAt)
      || Date.parse(purchase.createdAt) > Date.parse(purchase.updatedAt)
    ) {
      throw new DemoError('CONFLICT', '电子合同服务购买订单时间必须满足 createdAt <= updatedAt', { orderId: purchase.id });
    }
    const lessor = state.lessors.find((candidate) => candidate.id === purchase.buyerSnapshot.lessorId);
    if (
      lessor === undefined
      || !lessorIds.has(lessor.id)
      || lessor.lessorKind !== 'PERSONAL'
      || lessor.businessMode !== 'C2C'
      || lessor.userId !== purchase.buyerSnapshot.userId
      || purchase.buyerSnapshot.lessorKind !== 'PERSONAL'
      || purchase.buyerSnapshot.businessMode !== 'C2C'
    ) {
      throw new DemoError('CONFLICT', '电子合同服务只允许 PERSONAL + C2C 出租方购买', { orderId: purchase.id });
    }
    const rules = state.businessRuleVersions.find((candidate) => candidate.id === purchase.priceSnapshot.businessRuleVersionId);
    const quantity = purchase.subject.quantity;
    for (const [field, value] of Object.entries({
      quantity,
      snapshotQuantity: purchase.priceSnapshot.quantity,
      unitPriceFen: purchase.priceSnapshot.unitPriceFen,
      totalAmountFen: purchase.priceSnapshot.totalAmountFen,
      version: purchase.version,
    })) {
      assertInteger(value, `contractPurchase:${purchase.id}:${field}`);
      if (value < 1) throw new DemoError('CONFLICT', '电子合同服务购买数量、金额和版本必须为正整数', { orderId: purchase.id, field });
    }
    if (
      purchase.subject.type !== 'ELECTRONIC_CONTRACT_SIGNATURE_CREDIT'
      || purchase.priceSnapshot.currency !== 'CNY'
      || rules === undefined
      || rules.version !== purchase.priceSnapshot.businessRuleVersion
      || rules.contractUnitPriceFen !== purchase.priceSnapshot.unitPriceFen
      || purchase.priceSnapshot.quantity !== quantity
      || purchase.priceSnapshot.totalAmountFen !== purchase.priceSnapshot.unitPriceFen * quantity
    ) {
      throw new DemoError('CONFLICT', '电子合同服务价格必须来自不可变经营规则快照且不使用固定套餐价', { orderId: purchase.id });
    }
    assertWechatPayMockFacts(purchase.payment, `contractPurchase:${purchase.id}:payment`);
    if (purchase.payment.operation !== 'PAYMENT' || purchase.payment.amountFen !== purchase.priceSnapshot.totalAmountFen) {
      throw new DemoError('CONFLICT', '电子合同服务支付事实必须对应订单总金额', { orderId: purchase.id });
    }
    const refundInFlight = purchase.refund !== null
      && ['NOT_STARTED', 'PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(purchase.refund.status);
    const purchaseHasUnresolvedAxis = ['NOT_STARTED', 'PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(purchase.payment.status)
      || refundInFlight
      || ['GRANT_PENDING', 'FROZEN'].includes(purchase.entitlement.status);
    if (purchase.lifecycleStatus === 'CLOSED' && purchaseHasUnresolvedAxis) {
      throw new DemoError('CONFLICT', '合同购买订单存在支付、退款或权益未决轴时不得关闭', { orderId: purchase.id });
    }
    if (purchase.refund !== null) {
      assertWechatPayMockFacts(purchase.refund, `contractPurchase:${purchase.id}:refund`);
      if (purchase.refund.operation !== 'REFUND' || purchase.refund.amountFen !== purchase.priceSnapshot.totalAmountFen) {
        throw new DemoError('CONFLICT', '电子合同服务只允许全部权益未消费、未预占时全额退款', { orderId: purchase.id });
      }
      if (
        purchase.refund.outTradeNo !== purchase.payment.outTradeNo
        || purchase.refund.transactionId !== null && purchase.refund.transactionId !== purchase.payment.transactionId
      ) {
        throw new DemoError('CONFLICT', '电子合同服务退款必须绑定本订单唯一原支付单身份', { orderId: purchase.id });
      }
      if (refundInFlight && purchase.entitlement.status !== 'FROZEN') {
        throw new DemoError('CONFLICT', '退款处理中或结果未知时权益必须保持冻结', { orderId: purchase.id });
      }
      if (refundInFlight && (
        purchase.entitlement.availableCount !== 0
        || purchase.entitlement.reservedCount !== 0
        || purchase.entitlement.consumedCount !== 0
        || purchase.entitlement.frozenCount !== purchase.entitlement.grantedCount
        || purchase.entitlement.reversedCount !== 0
      )) {
        throw new DemoError('CONFLICT', '退款处理中必须冻结全部且仅冻结未消费、未预占权益', { orderId: purchase.id });
      }
      if (purchase.refund.status === 'SUCCEEDED' && purchase.entitlement.status !== 'REVERSED') {
        throw new DemoError('CONFLICT', '退款成功必须与权益完整回退同时成立', { orderId: purchase.id });
      }
      if (purchase.refund.status === 'SUCCEEDED' && (
        purchase.entitlement.availableCount !== 0
        || purchase.entitlement.reservedCount !== 0
        || purchase.entitlement.consumedCount !== 0
        || purchase.entitlement.frozenCount !== 0
        || purchase.entitlement.reversedCount !== purchase.entitlement.grantedCount
      )) {
        throw new DemoError('CONFLICT', '退款成功必须完整回退全部权益且其他余额归零', { orderId: purchase.id });
      }
    }
    if (purchase.entitlement.status === 'FROZEN' && !refundInFlight) {
      throw new DemoError('CONFLICT', '冻结权益必须且仅可对应存在且在途的全额退款', { orderId: purchase.id });
    }
    if (purchase.entitlement.status === 'REVERSED' && purchase.refund?.status !== 'SUCCEEDED') {
      throw new DemoError('CONFLICT', '已回退权益必须且仅可对应明确成功的全额退款', { orderId: purchase.id });
    }
    const balance = purchase.entitlement;
    for (const [field, value] of Object.entries({
      grantedCount: balance.grantedCount,
      availableCount: balance.availableCount,
      reservedCount: balance.reservedCount,
      consumedCount: balance.consumedCount,
      frozenCount: balance.frozenCount,
      reversedCount: balance.reversedCount,
    })) {
      assertInteger(value, `contractPurchase:${purchase.id}:entitlement:${field}`);
      if (value < 0) throw new DemoError('CONFLICT', '电子合同权益数量不得为负数', { orderId: purchase.id, field });
    }
    if (balance.grantedCount !== balance.availableCount + balance.reservedCount + balance.consumedCount + balance.frozenCount + balance.reversedCount) {
      throw new DemoError('CONFLICT', '电子合同权益账户必须守恒', { orderId: purchase.id });
    }
    const projection = projectContractPurchaseOrder(purchase);
    const allowedProjectionByLifecycle = {
      OPEN: new Set(['PENDING_PAYMENT', 'PAYMENT_CONFIRMING', 'ENTITLEMENT_PENDING']),
      COMPLETED: new Set(['COMPLETED', 'REFUNDING']),
      CLOSED: new Set(['REFUNDED', 'CLOSED']),
      EXCEPTION: new Set(['EXCEPTION']),
    } satisfies Record<ContractPurchaseOrder['lifecycleStatus'], ReadonlySet<string>>;
    const hasFailedAxis = purchase.payment.status === 'FAILED'
      || purchase.entitlement.status === 'FAILED'
      || purchase.refund?.status === 'FAILED';
    if (
      !allowedProjectionByLifecycle[purchase.lifecycleStatus].has(projection.projectionStatus)
      || purchase.lifecycleStatus === 'EXCEPTION' && !hasFailedAxis
      || (purchase.lifecycleStatus === 'CLOSED') !== (purchase.closedAt !== null)
      || purchase.closedAt !== null && (
        !isStrictRfc3339Timestamp(purchase.closedAt)
        || Date.parse(purchase.closedAt) < Date.parse(purchase.createdAt)
        || Date.parse(purchase.closedAt) > Date.parse(purchase.updatedAt)
      )
    ) {
      throw new DemoError('CONFLICT', '合同购买生命周期必须与支付、退款、权益和关闭时间双向一致', {
        orderId: purchase.id,
        lifecycleStatus: purchase.lifecycleStatus,
        projectionStatus: projection.projectionStatus,
      });
    }
    // Ensure runtime projection is total without persisting queue/action output.
    if ('projectionStatus' in purchase || 'allowedActions' in purchase || 'blockingReasons' in purchase) {
      throw new DemoError('CONFLICT', '合同购买工作台投影不得写入持久订单事实', { orderId: purchase.id });
    }
  }

  const ledgerIds = assertUniqueIds(state.contractCreditLedger, '电子合同权益账本');
  void ledgerIds;
  const idempotencyKeys = new Set<string>();
  const entriesByPurchase = new Map<string, ContractCreditLedgerEntry[]>();
  
  for (const entry of state.contractCreditLedger) {
    assertEnumValue(entry.type, CONTRACT_LEDGER_TYPES, `contractLedger:${entry.id}:type`);
    if (!purchaseIds.has(entry.purchaseOrderId) || idempotencyKeys.has(entry.idempotencyKey) || entry.idempotencyKey.trim() === '') {
      throw new DemoError('CONFLICT', '电子合同权益账本必须关联购买订单且幂等键唯一', { ledgerEntryId: entry.id });
    }
    idempotencyKeys.add(entry.idempotencyKey);
    assertInteger(entry.quantity, `contractLedger:${entry.id}:quantity`);
    if (entry.quantity < 1 || !isStrictRfc3339Timestamp(entry.occurredAt)) {
      throw new DemoError('CONFLICT', '电子合同权益账本数量必须为正整数且时间必须为 RFC3339', { ledgerEntryId: entry.id });
    }
    const purchase = state.contractPurchaseOrders.find((candidate) => candidate.id === entry.purchaseOrderId);
    if (purchase === undefined || purchase.buyerSnapshot.lessorId !== entry.lessorId) {
      throw new DemoError('CONFLICT', '电子合同权益账本出租方必须与购买快照一致', { ledgerEntryId: entry.id });
    }
    const occurredAtEpoch = Date.parse(entry.occurredAt);
    if (occurredAtEpoch < Date.parse(purchase.createdAt) || occurredAtEpoch > Date.parse(purchase.updatedAt)) {
      throw new DemoError('CONFLICT', '电子合同权益账本时间必须位于购买订单事实时间窗内', { ledgerEntryId: entry.id });
    }

const rows = entriesByPurchase.get(entry.purchaseOrderId) ?? [];
    rows.push(entry);
    entriesByPurchase.set(entry.purchaseOrderId, rows);
  }

for (const purchase of state.contractPurchaseOrders) {
    const running = { availableCount: 0, reservedCount: 0, consumedCount: 0, frozenCount: 0, reversedCount: 0 };
    const entries = [...(entriesByPurchase.get(purchase.id) ?? [])]
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id));
    const grantEntries = entries.filter((entry) => entry.type === 'GRANT');
    const freezeEntries = entries.filter((entry) => entry.type === 'FREEZE');
    const reverseEntries = entries.filter((entry) => entry.type === 'REVERSE');
    const refundReleaseEntries = entries.filter((entry) => entry.type === 'RELEASE');
    if (grantEntries.length > 1 || (grantEntries[0] !== undefined && grantEntries[0].quantity !== purchase.subject.quantity)) {
      throw new DemoError('CONFLICT', '每笔支付成功购买订单只能按购买数量授予一次权益', { orderId: purchase.id });
    }
    if (purchase.payment.status !== 'SUCCEEDED' && (grantEntries.length > 0 || purchase.entitlement.grantedCount !== 0)) {
      throw new DemoError('CONFLICT', '支付未成功不得授予或保留电子合同权益', { orderId: purchase.id });
    }
    if (['GRANTED', 'FROZEN', 'REVERSED'].includes(purchase.entitlement.status) && (
      purchase.payment.status !== 'SUCCEEDED'
      || grantEntries.length !== 1
      || purchase.entitlement.grantedCount !== purchase.subject.quantity
    )) {
      throw new DemoError('CONFLICT', '已授予、冻结或回退权益必须对应一次成功支付和完整购买数量', { orderId: purchase.id });
    }
    if (['NOT_GRANTED', 'GRANT_PENDING', 'FAILED'].includes(purchase.entitlement.status) && (
      purchase.entitlement.grantedCount !== 0
      || grantEntries.length !== 0
    )) {
      throw new DemoError('CONFLICT', '未授予或授予失败状态不得提前写入权益和 GRANT 账本', { orderId: purchase.id });
    }
    const refundInFlight = purchase.refund !== null
      && ['NOT_STARTED', 'PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(purchase.refund.status);
    const hasSingleFullFreeze = freezeEntries.length === 1 && freezeEntries[0]!.quantity === purchase.entitlement.grantedCount;
    if (purchase.refund === null) {
      if (freezeEntries.length > 0 || reverseEntries.length > 0 || refundReleaseEntries.length > 0) {
        throw new DemoError('CONFLICT', '无退款事实不得写入冻结、回退或退款释放权益流水', { orderId: purchase.id });
      }
    } else if (refundInFlight) {
      if (!hasSingleFullFreeze || reverseEntries.length > 0 || refundReleaseEntries.length > 0) {
        throw new DemoError('CONFLICT', '在途退款必须唯一冻结全部权益且尚未回退或释放', { orderId: purchase.id });
      }
    } else if (purchase.refund.status === 'SUCCEEDED') {
      if (
        !hasSingleFullFreeze
        || reverseEntries.length !== 1
        || reverseEntries[0]!.quantity !== freezeEntries[0]!.quantity
        || refundReleaseEntries.length > 0
        || Date.parse(reverseEntries[0]!.occurredAt) < Date.parse(freezeEntries[0]!.occurredAt)
      ) {
        throw new DemoError('CONFLICT', '成功退款必须且仅可由唯一 FREEZE→REVERSE 全额链收敛', { orderId: purchase.id });
      }
    } else if (purchase.refund.status === 'FAILED' || purchase.refund.status === 'CLOSED') {
      if (
        !hasSingleFullFreeze
        || reverseEntries.length > 0
        || refundReleaseEntries.length !== 1
        || refundReleaseEntries[0]!.quantity !== freezeEntries[0]!.quantity
        || Date.parse(refundReleaseEntries[0]!.occurredAt) < Date.parse(freezeEntries[0]!.occurredAt)
      ) {
        throw new DemoError('CONFLICT', '明确失败退款不得回退权益，已冻结权益必须唯一释放回可用余额', { orderId: purchase.id });
      }
    } else {
      throw new DemoError('CONFLICT', '退款意图必须处于可解释的在途、成功或明确失败终态', { orderId: purchase.id });
    }
    for (const entry of entries) {
      if (entry.type === 'GRANT') running.availableCount += entry.quantity;

if (entry.type === 'RELEASE') { running.frozenCount -= entry.quantity; running.availableCount += entry.quantity; }
      if (entry.type === 'FREEZE') { running.availableCount -= entry.quantity; running.frozenCount += entry.quantity; }
      if (entry.type === 'REVERSE') { running.frozenCount -= entry.quantity; running.reversedCount += entry.quantity; }
      if (Object.values(running).some((value) => value < 0) || Object.entries(running).some(([key, value]) => entry.balanceAfter[key as keyof typeof running] !== value)) {
        throw new DemoError('CONFLICT', '电子合同权益账本转换及余额快照必须逐笔守恒', { ledgerEntryId: entry.id });
      }
    }
    if (
      purchase.entitlement.grantedCount !== grantEntries.reduce((sum, entry) => sum + entry.quantity, 0)
      ||
      running.availableCount !== purchase.entitlement.availableCount
      || running.reservedCount !== purchase.entitlement.reservedCount
      || running.consumedCount !== purchase.entitlement.consumedCount
      || running.frozenCount !== purchase.entitlement.frozenCount
      || running.reversedCount !== purchase.entitlement.reversedCount
    ) {
      throw new DemoError('CONFLICT', '电子合同权益订单快照必须等于不可变账本末值', { orderId: purchase.id });
    }
  }
}

export function assertMockInvariants(state: MockState): void {
  if (state.meta.schemaVersion !== MOCK_SCHEMA_VERSION || state.meta.appMode !== 'mock-demo') {
    throw new DemoError('CONFLICT', 'Mock 元数据版本或运行模式不正确');
  }

  const merchantIds = assertUniqueIds(state.merchants, '商家');
  const lessorIds = assertUniqueIds(state.lessors, '出租方');
  const cabinetIds = assertUniqueIds(state.cabinets, '柜机');
  const boxIds = assertUniqueIds(state.boxes, '格口');
  const productIds = assertUniqueIds(state.products, '标准商品');
  const assetIds = assertUniqueIds(state.assets, '资产');
  assertCurrentAdmins(state.admins);
  assertUniqueIds(state.productSupplementRequests, '商品补录申请');
  assertUniqueIds(state.assetTermsRevisions, '资产租赁条件版本');

  for (const merchant of state.merchants) {
    assertAddress(merchant.operatingAddress, `merchant:${merchant.id}:operatingAddress`);
    assertInteger(merchant.shareBps, 'shareBps');
    if (merchant.shareBps < 0 || merchant.shareBps > 10_000) {
      throw new DemoError('CONFLICT', '商家分润比例必须位于 0% 到 100%', { merchantId: merchant.id });
    }
  }

  const lessorBindings = new Set<string>();
  for (const lessor of state.lessors) {
    if (lessor.displayName.trim() === '') throw new DemoError('CONFLICT', '出租方显示名称不能为空', { lessorId: lessor.id });
    const binding = lessor.lessorKind === 'PERSONAL' ? lessor.userId : lessor.lessorKind === 'MERCHANT' ? lessor.merchantId : lessor.id;
    if (binding === null || binding.trim() === '' || lessorBindings.has(`${lessor.lessorKind}:${binding}`)) {
      throw new DemoError('CONFLICT', '出租方主体映射必须完整且唯一', { lessorId: lessor.id });
    }
    lessorBindings.add(`${lessor.lessorKind}:${binding}`);
    if (lessor.lessorKind === 'PERSONAL' && (lessor.businessMode !== 'C2C' || lessor.merchantId !== null)) {
      throw new DemoError('CONFLICT', '个人出租方只能映射 C2C 用户主体', { lessorId: lessor.id });
    }
    if (lessor.lessorKind === 'MERCHANT' && (lessor.businessMode !== 'B2C' || lessor.userId !== null || lessor.merchantId === null || !merchantIds.has(lessor.merchantId))) {
      throw new DemoError('CONFLICT', '商家出租方必须映射有效 B2C 商家', { lessorId: lessor.id });
    }
    if (lessor.lessorKind === 'PLATFORM' && (lessor.businessMode !== 'B2C' || lessor.merchantId !== null || lessor.userId !== null)) {
      throw new DemoError('CONFLICT', '平台出租方不能映射商家或用户主体', { lessorId: lessor.id });
    }
  }

  const productKeys = new Set<string>();
  for (const product of state.products) {
    if (product.productNo.trim() === '' || product.name.trim() === '' || product.brand.trim() === '' || product.model.trim() === '' || product.category.trim() === '') {
      throw new DemoError('CONFLICT', '标准商品编号、名称、品牌、型号和分类不能为空', { productId: product.id });
    }
    if (product.normalizedModel !== normalizeCatalogKey(product.model) || product.normalizedName !== normalizeCatalogKey(product.name)) {
      throw new DemoError('CONFLICT', '标准商品归一化字段必须由原始字段确定', { productId: product.id });
    }
    const key = `${product.brandId}:${product.normalizedModel}:${product.normalizedName}`;
    if (productKeys.has(key)) throw new DemoError('CONFLICT', '品牌、型号与对外商品名组合必须唯一', { productId: product.id });
    productKeys.add(key);
    if (product.coverMediaId !== null && !product.imageMediaIds.includes(product.coverMediaId)) {
      throw new DemoError('CONFLICT', '标准商品封面必须包含在标准图片集合中', { productId: product.id });
    }
  }

  for (const request of state.productSupplementRequests) {
    if (request.requesterId.trim() === '' || request.proposedBrand.trim() === '' || request.proposedModel.trim() === '' || request.proposedName.trim() === '') {
      throw new DemoError('CONFLICT', '商品补录申请的申请人、品牌、型号和名称不能为空', { requestId: request.id });
    }
    if (request.status === 'PENDING' && (request.linkedProductId !== null || request.reviewedAt !== null || request.reviewedBy !== null)) {
      throw new DemoError('CONFLICT', '待审商品补录申请不能提前写入审核结果', { requestId: request.id });
    }
    if ((request.status === 'APPROVED' || request.status === 'MERGED') && (request.linkedProductId === null || !productIds.has(request.linkedProductId))) {
      throw new DemoError('CONFLICT', '通过或合并的商品补录申请必须关联标准商品', { requestId: request.id });
    }
  }

  const identifierKeys = new Set<string>();
  for (const asset of state.assets) {
    const product = state.products.find((candidate) => candidate.id === asset.productId);
    const lessor = state.lessors.find((candidate) => candidate.id === asset.lessorId);
    if (product === undefined || lessor === undefined || !productIds.has(asset.productId) || !lessorIds.has(asset.lessorId)) {
      throw new DemoError('CONFLICT', '资产必须关联有效标准商品与出租方', { assetId: asset.id });
    }
    if (asset.assetNo.trim() === '' || asset.displayName.trim() === '' || asset.identifierValue.trim() === '' || asset.identifierNormalizedValue !== normalizeCatalogKey(asset.identifierValue)) {
      throw new DemoError('CONFLICT', '资产编号、名称和唯一标识必须完整且正确归一化', { assetId: asset.id });
    }
    const identifierKey = `${product.brandId}:${asset.identifierType}:${asset.identifierNormalizedValue}`;
    if (identifierKeys.has(identifierKey)) throw new DemoError('CONFLICT', '同品牌同标识类型的设备唯一标识不得重复', { assetId: asset.id });
    identifierKeys.add(identifierKey);
    for (const [field, amount] of Object.entries({ unitPriceFen: asset.unitPriceFen, depositFen: asset.depositFen, referenceValueFen: asset.referenceValueFen })) {
      assertInteger(amount, field);
      if (amount < 0) throw new DemoError('CONFLICT', '资产金额必须是不小于 0 的整数分', { assetId: asset.id, field });
    }
    assertInteger(asset.minimumUnits, 'minimumUnits');
    assertInteger(asset.termsRevision, 'termsRevision');
    if (asset.minimumUnits < 1 || asset.termsRevision < 1) {
      throw new DemoError('CONFLICT', '资产租期或租赁条件版本无效', { assetId: asset.id });
    }
    if (asset.coverMediaId !== null && !asset.imageMediaIds.includes(asset.coverMediaId)) {
      throw new DemoError('CONFLICT', '资产封面必须包含在资产图片集合中', { assetId: asset.id });
    }
    if (asset.supplyMode === 'C2C') {
      if (lessor.lessorKind !== 'PERSONAL' || lessor.businessMode !== 'C2C' || asset.boxId !== null || asset.creationBatchId !== null || asset.publishLocationSnapshot === null || asset.reviewStatus === 'NOT_REQUIRED') {
        throw new DemoError('CONFLICT', 'C2C 资产必须属于个人、不可入柜或批量创建，并保存发布位置与审核状态', { assetId: asset.id });
      }
      assertAddress(asset.publishLocationSnapshot, `asset:${asset.id}:publishLocationSnapshot`);
    } else if (lessor.businessMode !== 'B2C' || asset.publishLocationSnapshot !== null || asset.reviewStatus !== 'NOT_REQUIRED') {
      throw new DemoError('CONFLICT', '官方资产必须属于 B2C 出租方且不进入个人审核或发布位置模型', { assetId: asset.id });
    }
    if (asset.publishStatus === 'ONLINE' && (product.status !== 'ACTIVE' || lessor.status !== 'ACTIVE' || asset.availabilityStatus === 'FROZEN' || asset.availabilityStatus === 'RETIRED' || (asset.supplyMode === 'C2C' && asset.reviewStatus !== 'APPROVED'))) {
      throw new DemoError('CONFLICT', '资产上架必须满足商品、出租方、审核与可用状态门槛', { assetId: asset.id });
    }
    if (asset.boxId !== null && (!boxIds.has(asset.boxId) || state.boxes.find((box) => box.id === asset.boxId)?.assetId !== asset.id)) {
      throw new DemoError('CONFLICT', '资产与格口必须双向一致', { assetId: asset.id, boxId: asset.boxId });
    }
    
    const revision = state.assetTermsRevisions.find((candidate) => candidate.assetId === asset.id && candidate.revision === asset.termsRevision);
    if (revision === undefined || revision.rentalType !== asset.rentalType || revision.unitPriceFen !== asset.unitPriceFen || revision.minimumUnits !== asset.minimumUnits || revision.depositFen !== asset.depositFen || revision.referenceValueFen !== asset.referenceValueFen) {
      throw new DemoError('CONFLICT', '资产当前租赁条件必须有完全一致的版本记录', { assetId: asset.id, revision: asset.termsRevision });
    }
  }

  const termsKeys = new Set<string>();
  for (const revision of state.assetTermsRevisions) {
    if (!assetIds.has(revision.assetId)) throw new DemoError('CONFLICT', '租赁条件版本引用了不存在的资产', { revisionId: revision.id });
    const key = `${revision.assetId}:${revision.revision}`;
    if (termsKeys.has(key) || revision.revision < 1) throw new DemoError('CONFLICT', '同资产租赁条件版本必须唯一且从 1 开始', { revisionId: revision.id });
    termsKeys.add(key);
  }

  const externalCabinetIds = new Set<string>();
  for (const cabinet of state.cabinets) {
    if (!merchantIds.has(cabinet.merchantId) || !cabinetIds.has(cabinet.id)) throw new DemoError('CONFLICT', '柜机必须关联有效商家', { cabinetId: cabinet.id });
    assertAddress(cabinet.deploymentAddressSnapshot, `cabinet:${cabinet.id}:deploymentAddressSnapshot`);
    if (externalCabinetIds.has(cabinet.cabinetId)) throw new DemoError('CONFLICT', 'cabinetId 必须全局唯一', { cabinetId: cabinet.cabinetId });
    externalCabinetIds.add(cabinet.cabinetId);
  }
  for (const box of state.boxes) {
    if (!cabinetIds.has(box.cabinetRecordId)) throw new DemoError('CONFLICT', '格口必须关联有效柜机', { boxId: box.id });
    if (box.assetId !== null && (!assetIds.has(box.assetId) || state.assets.find((asset) => asset.id === box.assetId)?.boxId !== box.id)) {
      throw new DemoError('CONFLICT', '格口与资产必须双向一致', { boxId: box.id, assetId: box.assetId });
    }
  }

if (state.businessRuleVersions.length === 0 || state.loyaltyConfigVersions.length === 0) {
    throw new DemoError('CONFLICT', '经营规则与忠诚度规则至少各保留一个版本');
  }
  for (const rules of state.businessRuleVersions) assertBusinessRuleValues(rules);
  for (const loyalty of state.loyaltyConfigVersions) assertLoyaltyConfigValues(loyalty);
  assertContractPurchaseFacts(state, lessorIds);
  assertWechatPayMockIdentityUniqueness(state);
}
