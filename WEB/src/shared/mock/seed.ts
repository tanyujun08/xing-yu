import type {
  AdminAccount,
  
  AuditEvent,
  BusinessRuleConfigVersion,
  Cabinet,
  CabinetBox,
  ContractCreditLedgerEntry,
  ContractPurchaseOrder,
  
  DemoScenarioName,
  LegacyAssetV7 as Asset,
  LegacyCabinetBoxEventV7 as CabinetBoxEvent,
  
  LegacyOfferV7 as Offer,
  LegacyProductV7 as Product,

LegacySkuV7 as Sku,
  LoyaltyConfigVersion,
  Merchant,
  MemberSummary,

SignInRecord,
  StarAccount,
  StarLedgerEntry,
} from '../services/contracts';
import { MOCK_MEMBER_AVATAR_URL } from './avatar';
import { PRODUCT_VERSION } from '../demo/demoManifest';
import {
  assertMockInvariants,
  createDefaultBusinessRuleVersion,
  createDefaultLoyaltyConfigVersion,
  migrateLegacyV7StateForSeed,
  type MockState,
} from './schema';
import { createWechatPayMockFacts } from './orderProjections';

const START_TIME = '2026-08-25T09:00:00.000Z';

function createHistoricalLoginAuditEvents(): AuditEvent[] {
  const rows = [
    ['012', '2026-08-25T08:42:00.000Z', 'mock-super-admin', '林运营', 'SUPER_ADMIN', 'PHONE', '192.0.2.12 · Mock Web', 'SUCCESS', null],
    ['011', '2026-08-25T07:16:00.000Z', 'mock-operations-001', '周运营', 'OPERATIONS', 'MINIPROGRAM_QR', '192.0.2.34 · Mock QR', 'SUCCESS', null],
    ['010', '2026-08-25T05:40:00.000Z', 'mock-after-sales-002', '李质检', 'AFTER_SALES', 'PHONE', '192.0.2.58 · Mock Web', 'FAILED', '确定性演示：账号已锁定'],
    ['009', '2026-08-24T11:30:00.000Z', 'mock-operations-002', '宋巡检', 'OPERATIONS', 'PHONE', '192.0.2.45 · Mock Web', 'SUCCESS', null],
    ['008', '2026-08-24T09:05:00.000Z', 'mock-after-sales-001', '陈售后', 'AFTER_SALES', 'PHONE', '192.0.2.19 · Mock Web', 'SUCCESS', null],
    ['007', '2026-08-24T08:22:00.000Z', 'mock-finance-001', '王财务', 'FINANCE', 'MINIPROGRAM_QR', '192.0.2.81 · Mock QR', 'FAILED', '确定性演示：二维码已失效'],
    ['006', '2026-08-23T03:38:00.000Z', 'mock-finance-002', '赵结算', 'FINANCE', 'MINIPROGRAM_QR', '192.0.2.76 · Mock QR', 'SUCCESS', null],
    ['005', '2026-08-22T06:54:00.000Z', 'mock-after-sales-002', '李质检', 'AFTER_SALES', 'MINIPROGRAM_QR', '192.0.2.58 · Mock QR', 'SUCCESS', null],
    ['004', '2026-08-21T10:08:00.000Z', 'mock-super-admin', '林运营', 'SUPER_ADMIN', 'PHONE', '192.0.2.12 · Mock Web', 'SUCCESS', null],
    ['003', '2026-08-20T09:26:00.000Z', 'mock-operations-001', '周运营', 'OPERATIONS', 'PHONE', '192.0.2.34 · Mock Web', 'FAILED', '确定性演示：验证码已过期'],
    ['002', '2026-08-19T04:12:00.000Z', 'mock-after-sales-001', '陈售后', 'AFTER_SALES', 'MINIPROGRAM_QR', '192.0.2.19 · Mock QR', 'SUCCESS', null],
    ['001', '2026-08-18T02:30:00.000Z', 'mock-finance-001', '王财务', 'FINANCE', 'PHONE', '192.0.2.81 · Mock Web', 'SUCCESS', null],
  ] as const;
  return rows.map(([id, occurredAt, accountId, displayName, role, loginMethod, source, status, failureReason], index) => ({
    id: `audit_login_seed_${id}`,
    sequence: rows.length + 1 - index,
    aggregateType: 'ADMIN_SESSION',
    aggregateId: accountId,
    action: status === 'SUCCESS' ? 'ADMIN_LOGIN_SUCCEEDED' : 'ADMIN_LOGIN_FAILED',
    actorId: accountId,
    occurredAt,
    payload: { displayName, role, loginMethod, source, status, failureReason },
  }));
}

function createBoxes(cabinet: Cabinet): CabinetBox[] {
  return Array.from({ length: cabinet.boxCount }, (_, index) => ({
    id: `box_seed_${(index + 1).toString().padStart(2, '0')}`,
    cabinetRecordId: cabinet.id,
    boxNo: index + 1,
    doorStatus: 'CLOSED',
    sensorStatus: index < 2 ? 'OCCUPIED' : 'EMPTY',
    businessStatus: index < 2 ? 'OCCUPIED' : 'AVAILABLE',
    assetId: index < 2 ? `asset_seed_00${index + 1}` : null,
    lastCommandId: null,
    updatedAt: START_TIME,
  }));
}

export function createLegacySeedStateV7(scenarioName: DemoScenarioName = 'normal'): unknown {
  const merchant: Merchant = {
    id: 'merchant_seed_001',
    name: '星遇合作影像空间（演示）',
    status: 'ACTIVE',
    shareBps: 2_500,
    settlementCycle: 'MONTHLY',
    settlementAccount: '招商银行 6225888800008888',
    contactName: '演示店长',
    operatingAddress: {
      provinceCode: '440000',
      cityCode: '440300',
      districtCode: '440306',
      province: '广东省',
      city: '深圳市',
      district: '宝安区',
      poiName: '星遇合作影像空间',
      detailAddress: '演示路 100 号',
      fullAddress: '广东省深圳市宝安区演示路 100 号',
      longitude: 113.8451,
      latitude: 22.7072,
      confirmationStatus: 'TENCENT_CONFIRMED',
    },
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    createdAt: START_TIME,
    updatedAt: START_TIME,
  };
  const cabinet: Cabinet = {
    id: 'cabinet_seed_001',
    cabinetId: 'DEMO-CABINET-001',
    merchantId: merchant.id,
    merchantSnapshot: { id: merchant.id, name: merchant.name },
    deploymentAddressSnapshot: { ...merchant.operatingAddress },
    name: 'A区摄影器材柜',
    description: '演示摄影器材租赁柜',
    boxCount: 5,
    status: 'ACTIVE',
    connectivity: scenarioName === 'cabinet-offline' ? 'OFFLINE' : scenarioName === 'exceptions' ? 'UNKNOWN' : 'ONLINE',
    capabilities: { doorFeedback: true, articleDetection: true },
    createdAt: START_TIME,
    updatedAt: START_TIME,
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
  };
  const products: Product[] = [
    {
      id: 'product_seed_camera',
      name: 'Sony Alpha 7 IV 全画幅微单',
      brand: 'Sony',
      category: '相机',
      description: '适合人像、活动与视频拍摄的全画幅微单机身。',
      tags: ['演唱会神器', '人像专拍'],
      status: 'ACTIVE',
      createdAt: START_TIME,
      updatedAt: START_TIME,
    },
    {
      id: 'product_seed_lens',
      name: 'Sony FE 70-200mm F2.8 GM II',
      brand: 'Sony',
      category: '镜头',
      description: '恒定 F2.8 光圈的专业远摄变焦镜头。',
      tags: ['演唱会神器', '远摄'],
      status: 'ACTIVE',
      createdAt: START_TIME,
      updatedAt: START_TIME,
    },
  ];
  const skus: Sku[] = [
    {
      id: 'sku_seed_camera',
      productId: products[0]!.id,
      specName: '标准机身套装',
      brand: 'Sony',
      model: 'Alpha 7 IV',
      category: '全画幅微单相机',
      accessoryNames: ['原装电池', '充电器', '肩带'],
      tags: ['演唱会神器', '人像专拍'],
      rentalType: 'DAY',
      status: 'ACTIVE',
    },
    {
      id: 'sku_seed_lens',
      productId: products[1]!.id,
      specName: 'FE 卡口标准规格',
      brand: 'Sony',
      model: 'FE 70-200mm F2.8 GM II',
      category: '长焦镜头',
      accessoryNames: ['遮光罩', '前后盖', '镜头包'],
      tags: ['演唱会神器', '远摄'],
      rentalType: 'HOUR',
      status: 'ACTIVE',
    },
  ];
  const offers: Offer[] = [
    {
      id: 'offer_seed_camera',
      skuId: skus[0]!.id,
      version: 1,
      rulesVersion: 1,
      name: 'Sony A7M4 日租方案',
      rentalType: 'DAY',
      unitPriceFen: 29_900,
      minimumUnits: 3,
      dailyRentFen: 29_900,
      depositFen: 500_000,
      currency: 'CNY',
      starMaxPercent: 20,
      status: 'ACTIVE',
    },
    {
      id: 'offer_seed_lens',
      skuId: skus[1]!.id,
      version: 1,
      rulesVersion: 1,
      name: '70-200 GM II 小时租配置',
      rentalType: 'HOUR',
      unitPriceFen: 2_900,
      minimumUnits: 12,
      dailyRentFen: 0,
      depositFen: 300_000,
      currency: 'CNY',
      starMaxPercent: 20,
      status: 'ACTIVE',
    },
  ];
  const assets: Asset[] = [
    {
      id: 'asset_seed_001',
      assetNo: 'XY-A-000001',
      skuId: skus[0]!.id,
      serialNumber: 'DEMO-SN-A7M4-001',
      condition: '95新，底部有轻微使用痕迹',
      referenceValueFen: 1_699_900,
      status: 'IN_CABINET',
      boxId: 'box_seed_01',
      activeOrderId: null,
      createdAt: START_TIME,
      updatedAt: START_TIME,
    },
    {
      id: 'asset_seed_002',
      assetNo: 'XY-A-000002',
      skuId: skus[1]!.id,
      serialNumber: 'DEMO-SN-70200-002',
      condition: '98新，镜片完好',
      referenceValueFen: 1_799_900,
      status: 'IN_CABINET',
      boxId: 'box_seed_02',
      activeOrderId: null,
      createdAt: START_TIME,
      updatedAt: START_TIME,
    },
    
    {
      id: 'asset_seed_004',
      assetNo: 'XY-A-000004',
      skuId: skus[0]!.id,
      serialNumber: 'DEMO-SN-A7M4-004',
      condition: '98新，演示待投放资产',
      referenceValueFen: 1_699_900,
      status: 'READY_TO_DEPLOY',
      boxId: null,
      activeOrderId: null,
      createdAt: START_TIME,
      updatedAt: START_TIME,
    },
  ];

const starAccount: StarAccount = {
    userId: 'user_seed_001',
    availableTenths: 120_030,
    frozenTenths: 0,
    consumedTenths: 0,
    recoveryDueTenths: 0,
    updatedAt: START_TIME,
  };
  const starLedger: StarLedgerEntry[] = [
    {
      id: 'star_opening_001', idempotencyKey: 'opening:user_seed_001', accountSequence: 0,
      userId: starAccount.userId, type: 'OPENING', sourceType: 'OPENING', sourceId: starAccount.userId,
      grossStarTenths: 0, availableDeltaTenths: 120_000, frozenDeltaTenths: 10_000, consumedDeltaTenths: 0, recoveryDueDeltaTenths: 0,
      balanceAfter: { availableTenths: 120_000, frozenTenths: 10_000, consumedTenths: 0, recoveryDueTenths: 0 },
      occurredAt: '2026-08-20T09:00:00.000Z', note: '演示期初余额',
    },

{
      id: 'star_signin_23', idempotencyKey: 'signin:user_seed_001:2026-08-23', accountSequence: 3,
      userId: starAccount.userId, type: 'EARN', sourceType: 'SIGN_IN', sourceId: 'signin_seed_23',
      grossStarTenths: 10, availableDeltaTenths: 10, frozenDeltaTenths: 0, consumedDeltaTenths: 0, recoveryDueDeltaTenths: 0,
      balanceAfter: { availableTenths: 128_880, frozenTenths: 0, consumedTenths: 10_000, recoveryDueTenths: 0 },
      occurredAt: '2026-08-23T01:00:00.000Z', note: '每日签到奖励',
    },

{
      id: 'star_signin_24', idempotencyKey: 'signin:user_seed_001:2026-08-24', accountSequence: 6,
      userId: starAccount.userId, type: 'EARN', sourceType: 'SIGN_IN', sourceId: 'signin_seed_24',
      grossStarTenths: 10, availableDeltaTenths: 10, frozenDeltaTenths: 0, consumedDeltaTenths: 0, recoveryDueDeltaTenths: 0,
      balanceAfter: { availableTenths: 128_890, frozenTenths: 0, consumedTenths: 9_000, recoveryDueTenths: 0 },
      occurredAt: '2026-08-24T01:00:00.000Z', note: '每日签到奖励',
    },
    {
      id: 'star_signin_25', idempotencyKey: 'signin:user_seed_001:2026-08-25', accountSequence: 7,
      userId: starAccount.userId, type: 'EARN', sourceType: 'SIGN_IN', sourceId: 'signin_seed_25',
      grossStarTenths: 10, availableDeltaTenths: 10, frozenDeltaTenths: 0, consumedDeltaTenths: 0, recoveryDueDeltaTenths: 0,
      balanceAfter: { availableTenths: 128_900, frozenTenths: 0, consumedTenths: 9_000, recoveryDueTenths: 0 },
      occurredAt: '2026-08-25T01:00:00.000Z', note: '每日签到奖励',
    },
  ];
  // Rebuild only the retained opening and sign-in facts; no rental posting survives.
  const balance = { availableTenths: 0, frozenTenths: 0, consumedTenths: 0, recoveryDueTenths: 0 };
  starLedger.forEach((entry, index) => {
    entry.accountSequence = index;
    balance.availableTenths += entry.availableDeltaTenths;
    balance.frozenTenths += entry.frozenDeltaTenths;
    balance.consumedTenths += entry.consumedDeltaTenths;
    balance.recoveryDueTenths += entry.recoveryDueDeltaTenths;
    entry.balanceAfter = { ...balance };
  });
  Object.assign(starAccount, balance);

  const signInRecords: SignInRecord[] = [23, 24, 25].map((day, index) => ({
    signInId: `signin_seed_${day}`, userId: starAccount.userId, businessDate: `2026-08-${day}`,
    signedAt: `2026-08-${day}T01:00:00.000Z`, streakDays: index + 1, dailyRewardStarTenths: 10,
    milestoneDays: null, milestoneBonusStarTenths: 0, loyaltyVersionId: 'loyalty_rules_v1', ledgerEntryId: `star_signin_${day}`,
  }));

const deviceSnapshot = (asset: Asset) => {
    const sku = skus.find((candidate) => candidate.id === asset.skuId)!;
    return {
      assetId: asset.id,
      assetNo: asset.assetNo,
      skuId: sku.id,
      skuLabel: `${sku.brand} ${sku.model}`,
      model: sku.model,
      serialNumberDisplay: asset.serialNumber,
    };
  };
  const boxEvents: CabinetBoxEvent[] = [
    {
      id: 'box_event_seed_001',
      cabinetRecordId: cabinet.id,
      boxId: 'box_seed_01',
      boxNo: 1,
      type: 'STORE',
      result: 'SUCCEEDED',
      deviceSnapshot: deviceSnapshot(assets[0]!),
      orderNo: null,
      actorSnapshot: { actorId: 'mock-warehouse', displayName: '演示仓储员' },
      occurredAt: '2026-08-19T09:00:00.000Z',
    },

{
      id: 'box_event_seed_004',
      cabinetRecordId: cabinet.id,
      boxId: 'box_seed_02',
      boxNo: 2,
      type: 'STORE',
      result: 'SUCCEEDED',
      deviceSnapshot: deviceSnapshot(assets[1]!),
      orderNo: null,
      actorSnapshot: { actorId: 'mock-warehouse', displayName: '演示仓储员' },
      occurredAt: '2026-08-24T09:00:00.000Z',
    },
  ];
  const businessRuleVersions: BusinessRuleConfigVersion[] = [createDefaultBusinessRuleVersion(START_TIME)];
  const loyaltyConfigVersions: LoyaltyConfigVersion[] = [createDefaultLoyaltyConfigVersion(START_TIME)];

const members: MemberSummary[] = [{
    userId: 'user_seed_001',
    nickname: '星野旅人',
    avatarUrl: MOCK_MEMBER_AVATAR_URL,
    miniProgramOpenIdMasked: 'oXY***d001',
    miniProgramRegisteredAt: '2026-06-18T03:20:00.000Z',
    mobileMasked: '138****8899',
    realNameStatus: 'VERIFIED',
    wechatPayScoreRaw: 668,
    wechatPayScoreUpdatedAt: '2026-08-25T08:30:00.000Z',
    consumptionAmountFen: null,
    consumptionOrderCount: null,
    lastOrderAt: null,
  }];
  const admins: AdminAccount[] = [
    { id: 'mock-super-admin', displayName: '林运营', mobileMasked: '138****1001', mobile: '13800001001', role: 'SUPER_ADMIN', status: 'ACTIVE', loginCapabilities: { phone: true, wechat: true }, wechatBinding: { status: 'BOUND', nickname: '林小星', avatarUrl: MOCK_MEMBER_AVATAR_URL, boundAt: '2026-08-20T09:00:00.000Z' }, lastLoginAt: '2026-08-25T08:42:00.000Z', createdAt: START_TIME, createdBy: 'system-seed', archivedAt: null, archivedBy: null, archiveReason: null },
    { id: 'mock-operations-001', displayName: '周运营', mobileMasked: '138****1002', mobile: '13800001002', role: 'OPERATIONS', status: 'ACTIVE', loginCapabilities: { phone: true, wechat: true }, wechatBinding: { status: 'BOUND', nickname: '周周运营中', avatarUrl: MOCK_MEMBER_AVATAR_URL, boundAt: '2026-08-21T11:20:00.000Z' }, lastLoginAt: '2026-08-25T07:16:00.000Z', createdAt: START_TIME, createdBy: 'system-seed', archivedAt: null, archivedBy: null, archiveReason: null },
    { id: 'mock-after-sales-001', displayName: '陈售后', mobileMasked: '138****1004', mobile: '13800001004', role: 'AFTER_SALES', status: 'ACTIVE', loginCapabilities: { phone: true, wechat: false }, wechatBinding: { status: 'UNBOUND', nickname: null, avatarUrl: null, boundAt: null }, lastLoginAt: '2026-08-24T09:05:00.000Z', createdAt: START_TIME, createdBy: 'system-seed', archivedAt: null, archivedBy: null, archiveReason: null },
    { id: 'mock-finance-001', displayName: '王财务', mobileMasked: '138****1006', mobile: '13800001006', role: 'FINANCE', status: 'ACTIVE', loginCapabilities: { phone: true, wechat: true }, wechatBinding: { status: 'BOUND', nickname: '小王对账中', avatarUrl: MOCK_MEMBER_AVATAR_URL, boundAt: '2026-08-22T03:30:00.000Z' }, lastLoginAt: '2026-08-25T06:21:00.000Z', createdAt: START_TIME, createdBy: 'system-seed', archivedAt: null, archivedBy: null, archiveReason: null },
  ];
  const auditEvents: AuditEvent[] = [
    {
      id: 'audit_seed_001',
      sequence: 1,
      aggregateType: 'DEMO_RUNTIME',
      aggregateId: scenarioName,
      action: 'SCENARIO_SEEDED',
      actorId: 'system',
      occurredAt: START_TIME,
      payload: { scenarioName },
    },
    ...createHistoricalLoginAuditEvents(),
  ];

  const legacyState = {
    meta: {
      schemaVersion: 7,
      productVersion: PRODUCT_VERSION,
      appMode: 'mock-demo',
      scenarioName,
      seed: `xingyu-v1-${scenarioName}`,
      currentTime: '2026-08-25T09:00:01.000Z',
      nextId: 1_000,
      revision: 0,
    },
    merchants: [merchant],
    cabinets: [cabinet],
    boxes: createBoxes(cabinet),
    boxEvents,
    products,
    skus,
    offers,
    assets,

members,
    admins,
    starAccounts: [starAccount],
    starLedger,
    signInRecords,

commands: [],
    auditEvents,
    businessRuleVersions,
    loyaltyConfigVersions,
  };

  if (scenarioName === 'exceptions') {
    const abnormalBox = legacyState.boxes[4]!;
    abnormalBox.sensorStatus = 'OCCUPIED';
    abnormalBox.businessStatus = 'FROZEN';

}

  return legacyState;
}

function zeroEntitlement(status: ContractPurchaseOrder['entitlement']['status'], occurredAt: string): ContractPurchaseOrder['entitlement'] {
  return {
    status,
    grantedCount: 0,
    availableCount: 0,
    reservedCount: 0,
    consumedCount: 0,
    frozenCount: 0,
    reversedCount: 0,
    grantedAt: null,
    updatedAt: occurredAt,
  };
}

export function createSeedState(scenarioName: DemoScenarioName = 'normal'): MockState {
  const legacyState = createLegacySeedStateV7(scenarioName);
  const state: MockState = migrateLegacyV7StateForSeed(legacyState);
  state.lessors.push({
    id: 'lessor_personal_seed_001',
    lessorKind: 'PERSONAL',
    businessMode: 'C2C',
    displayName: '星野旅人',
    merchantId: null,
    userId: 'user_seed_001',
    status: 'ACTIVE',
    createdAt: START_TIME,
    updatedAt: START_TIME,
  });
  state.productSupplementRequests.push({
    id: 'product_request_seed_001',
    requesterId: 'user_seed_002',
    requesterName: '摄影玩家小周',
    proposedBrand: 'Fujifilm',
    proposedModel: 'X-T5',
    proposedName: 'Fujifilm X-T5 微单机身',
    category: 'APS-C 微单相机',
    description: '用户发布时未检索到对应标准商品，申请补录。',
    evidenceMediaIds: ['media_request_xt5_01'],
    status: 'PENDING',
    linkedProductId: null,
    reviewRemark: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-08-25T08:10:00.000Z',
    updatedAt: '2026-08-25T08:10:00.000Z',
  });
  const c2cLocation = {
    provinceCode: '440000', cityCode: '440300', districtCode: '440306', province: '广东省', city: '深圳市', district: '宝安区',
    poiName: '会展湾东城', detailAddress: '发布位置仅展示到附近范围', fullAddress: '广东省深圳市宝安区会展湾东城',
    longitude: 113.7856, latitude: 22.7068, confirmationStatus: 'MANUAL_DEMO' as const,
  };
  const c2cProduct = state.products.find((product) => product.id === 'product_seed_camera') ?? state.products[0]!;
  state.assets.push({
    id: 'asset_c2c_seed_001', assetNo: 'XY-C2C-000001', productId: c2cProduct.id, displayName: 'Sony A7M4 人像拍摄套装',
    supplyMode: 'C2C', lessorId: 'lessor_personal_seed_001', identifierType: 'MANUFACTURER_SERIAL', identifierValue: 'C2C-A7M4-USER-001', identifierNormalizedValue: 'c2c-a7m4-user-001',
    condition: '95新，功能正常', defectDescription: '底部轻微使用痕迹', accessoryDescription: '机身、原装电池2块、充电器、肩带',
    rentalType: 'DAY', unitPriceFen: 26_900, minimumUnits: 2, depositFen: 480_000, referenceValueFen: 1_599_900,
    currency: 'CNY', termsRevision: 1, termsEffectiveAt: '2026-08-25T08:20:00.000Z', coverMediaId: 'media_c2c_a7m4_cover',
    imageMediaIds: ['media_c2c_a7m4_cover', 'media_c2c_a7m4_detail'], videoMediaIds: ['media_c2c_a7m4_video'], mediaSource: 'ASSET_ACTUAL',
    publishLocationSnapshot: c2cLocation, reviewStatus: 'APPROVED', publishStatus: 'ONLINE', availabilityStatus: 'AVAILABLE', boxId: null,
    creationBatchId: null, reviewRemark: '设备与唯一标识核验通过', createdAt: '2026-08-25T08:20:00.000Z', updatedAt: '2026-08-25T08:40:00.000Z',
  });
  state.assetTermsRevisions.push({
    id: 'terms_asset_c2c_seed_001_v1', assetId: 'asset_c2c_seed_001', revision: 1, rentalType: 'DAY', unitPriceFen: 26_900,
    minimumUnits: 2, depositFen: 480_000, referenceValueFen: 1_599_900, currency: 'CNY',
    effectiveAt: '2026-08-25T08:20:00.000Z', changedBy: 'user_seed_001', changeReason: 'C2C 发布初始租赁条件',
  });

const personalLessorId = 'lessor_personal_seed_001';

const rules = [...state.businessRuleVersions].sort((left, right) => right.version - left.version)[0]!;
  const buyerSnapshot = {
    lessorId: personalLessorId,
    userId: 'user_seed_001',
    lessorKind: 'PERSONAL' as const,
    businessMode: 'C2C' as const,
    displayName: '星野旅人',
    mobileMasked: '138****0001',
  };
  const createPurchase = (input: {
    id: string;
    quantity: number;
    lifecycleStatus: ContractPurchaseOrder['lifecycleStatus'];
    paymentStatus: ContractPurchaseOrder['payment']['status'];
    paymentProviderStatus: string;
    entitlementStatus: ContractPurchaseOrder['entitlement']['status'];
    refundStatus?: NonNullable<ContractPurchaseOrder['refund']>['status'];
    refundProviderStatus?: string;
  }): ContractPurchaseOrder => {
    const occurredAt = `2026-08-25T0${state.contractPurchaseOrders.length}:00:00.000Z`;
    const totalAmountFen = rules.contractUnitPriceFen * input.quantity;
    const purchase: ContractPurchaseOrder = {
      id: input.id,
      orderNo: `CP-${input.id.toUpperCase()}`,
      buyerSnapshot: structuredClone(buyerSnapshot),
      subject: { type: 'ELECTRONIC_CONTRACT_SIGNATURE_CREDIT', quantity: input.quantity },
      priceSnapshot: {
        currency: 'CNY', unitPriceFen: rules.contractUnitPriceFen, quantity: input.quantity, totalAmountFen,
        businessRuleVersionId: rules.id, businessRuleVersion: rules.version,
      },
      lifecycleStatus: input.lifecycleStatus,
      payment: createWechatPayMockFacts({
        orderId: input.id, operation: 'PAYMENT', amountFen: totalAmountFen, status: input.paymentStatus,
        providerStatus: input.paymentProviderStatus, occurredAt,
        notificationReceived: input.paymentStatus === 'SUCCEEDED',
        errorCode: input.paymentStatus === 'FAILED' ? 'MOCK_PAYERROR' : null,
      }),
      refund: input.refundStatus === undefined ? null : createWechatPayMockFacts({
        orderId: input.id, operation: 'REFUND', amountFen: totalAmountFen, status: input.refundStatus,
        providerStatus: input.refundProviderStatus ?? input.refundStatus, occurredAt,
        notificationReceived: input.refundStatus === 'SUCCEEDED',
      }),
      entitlement: zeroEntitlement(input.entitlementStatus, occurredAt),
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      closedAt: input.lifecycleStatus === 'CLOSED' ? occurredAt : null,
    };
    state.contractPurchaseOrders.push(purchase);
    state.auditEvents.push({
      id: `audit_${input.id}_created`, sequence: state.auditEvents.length + 1, aggregateType: 'CONTRACT_PURCHASE_ORDER',
      aggregateId: input.id, action: 'CONTRACT_PURCHASE_ORDER_CREATED', actorId: buyerSnapshot.userId, occurredAt,
      payload: { quantity: input.quantity, unitPriceFen: rules.contractUnitPriceFen, totalAmountFen },
    });
    return purchase;
  };
  const appendCredit = (
    purchase: ContractPurchaseOrder,
    type: ContractCreditLedgerEntry['type'],
    quantity: number,
    
  ): void => {
    const balance = purchase.entitlement;
    if (type === 'GRANT') { balance.grantedCount += quantity; balance.availableCount += quantity; }

if (type === 'RELEASE') { balance.frozenCount -= quantity; balance.availableCount += quantity; }
    if (type === 'FREEZE') { balance.availableCount -= quantity; balance.frozenCount += quantity; }
    if (type === 'REVERSE') { balance.frozenCount -= quantity; balance.reversedCount += quantity; }
    const index = state.contractCreditLedger.length + 1;
    const occurredAt = `2026-08-25T08:${String(index).padStart(2, '0')}:00.000Z`;
    balance.updatedAt = occurredAt;
    purchase.updatedAt = occurredAt;
    
    state.contractCreditLedger.push({
      id: `contract_credit_${String(index).padStart(3, '0')}`,
      lessorId: personalLessorId,
      purchaseOrderId: purchase.id,

type,
      quantity,
      idempotencyKey: `${purchase.id}:${type}:${index}`,
      balanceAfter: {
        availableCount: balance.availableCount, reservedCount: balance.reservedCount, consumedCount: balance.consumedCount,
        frozenCount: balance.frozenCount, reversedCount: balance.reversedCount,
      },
      occurredAt,
      note: `电子合同权益 ${type} 确定性 fixture`,
    });
  };

  createPurchase({ id: 'cp_pending', quantity: 1, lifecycleStatus: 'OPEN', paymentStatus: 'PENDING', paymentProviderStatus: 'NOTPAY', entitlementStatus: 'NOT_GRANTED' });
  createPurchase({ id: 'cp_payment_unknown', quantity: 1, lifecycleStatus: 'OPEN', paymentStatus: 'UNKNOWN', paymentProviderStatus: 'UNKNOWN', entitlementStatus: 'NOT_GRANTED' });
  createPurchase({ id: 'cp_entitlement_pending', quantity: 1, lifecycleStatus: 'OPEN', paymentStatus: 'SUCCEEDED', paymentProviderStatus: 'SUCCESS', entitlementStatus: 'GRANT_PENDING' });
  const consumedPurchase = createPurchase({ id: 'cp_completed', quantity: 4, lifecycleStatus: 'COMPLETED', paymentStatus: 'SUCCEEDED', paymentProviderStatus: 'SUCCESS', entitlementStatus: 'GRANTED' });
  appendCredit(consumedPurchase, 'GRANT', 4);

consumedPurchase.entitlement.status = 'GRANTED';
  consumedPurchase.entitlement.grantedAt = consumedPurchase.payment.createdAt;

  const refundingPurchase = createPurchase({
    id: 'cp_refunding', quantity: 2, lifecycleStatus: 'COMPLETED', paymentStatus: 'SUCCEEDED', paymentProviderStatus: 'SUCCESS',
    entitlementStatus: 'FROZEN', refundStatus: 'PROCESSING', refundProviderStatus: 'PROCESSING',
  });
  appendCredit(refundingPurchase, 'GRANT', 2);
  appendCredit(refundingPurchase, 'FREEZE', 2);
  refundingPurchase.entitlement.status = 'FROZEN';
  refundingPurchase.entitlement.grantedAt = refundingPurchase.payment.createdAt;

  const refundedPurchase = createPurchase({
    id: 'cp_refunded', quantity: 2, lifecycleStatus: 'CLOSED', paymentStatus: 'SUCCEEDED', paymentProviderStatus: 'SUCCESS',
    entitlementStatus: 'REVERSED', refundStatus: 'SUCCEEDED', refundProviderStatus: 'SUCCESS',
  });
  appendCredit(refundedPurchase, 'GRANT', 2);
  appendCredit(refundedPurchase, 'FREEZE', 2);
  appendCredit(refundedPurchase, 'REVERSE', 2);
  refundedPurchase.entitlement.status = 'REVERSED';
  refundedPurchase.entitlement.grantedAt = refundedPurchase.payment.createdAt;
  refundedPurchase.closedAt = refundedPurchase.updatedAt;

  createPurchase({ id: 'cp_closed', quantity: 1, lifecycleStatus: 'CLOSED', paymentStatus: 'CLOSED', paymentProviderStatus: 'CLOSED', entitlementStatus: 'NOT_GRANTED' });
  createPurchase({ id: 'cp_exception', quantity: 1, lifecycleStatus: 'EXCEPTION', paymentStatus: 'FAILED', paymentProviderStatus: 'PAYERROR', entitlementStatus: 'FAILED' });
  assertMockInvariants(state);
  return state;
}
