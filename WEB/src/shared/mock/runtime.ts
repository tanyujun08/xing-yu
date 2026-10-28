import { DemoError } from '../demo';
import type {
  Asset,
  AdminAccount,
  AuditEvent,
  BusinessRuleConfigVersion,
  BusinessRuleLevel,
  Cabinet,
  CabinetBox,
  CabinetBoxEvent,

ContractCreditLedgerEntry,
  ContractPurchaseOrder,
  ContractPurchaseOrderProjection,
  CreateAdminInput,
  CreateCabinetInput,
  CreateMerchantInput,
  CreateOfficialAssetBatchInput,
  
  CreateProductInput,
  ArchiveEntityInput,
  DashboardSummary,
  
  DemoRuntimeInfo,
  DemoScenarioName,

LoyaltyConfigVersion,
  Merchant,
  MemberSummary,

Product,

RecordLoginAttemptInput,
  RecordRoleSwitchInput,

QueryContractPurchaseOrderInput,
  ReviewAssetInput,
  ReviewProductSupplementRequestInput,
  RestoreEntityInput,
  SaveBusinessRuleConfigInput,
  SaveLoyaltyConfigInput,

SetAdminStatusInput,
  SetAssetPublishStatusInput,
  SetCabinetStatusInput,
  StarAccount,
  StarLedgerEntry,
  UserDossier,
  UpdateAdminInput,
  UpdateAssetInput,
  UpdateCabinetInput,
  UpdateMerchantInput,
  UpdateProductInput,
  WechatPayMockOperationFacts,
} from '../services/contracts';
import { advanceDemoClock, nextDemoTimestamp } from './clock';
import { nextDemoId } from './ids';
import {
  createDemoPersistence,
  type DemoPersistence,
  type DemoStorage,
} from './persistence';
import { assertBusinessRuleValues, assertLoyaltyConfigValues, assertMockInvariants, type MockState } from './schema';
import { createSeedState } from './seed';
import {
  
  projectContractPurchaseOrder,
  
} from './orderProjections';
import { toShanghaiBusinessDate } from '../time/shanghai';

export interface DemoRuntimeOptions {
  scenarioName?: DemoScenarioName;
  persistence?: DemoPersistence;
  storage?: DemoStorage | null;
  storageKey?: string;
  /** Local-only deterministic responses returned by an explicit original-order query. */
  providerQueryResults?: Readonly<Record<string, string>>;
}

interface TransactionContext {
  occurredAt: string;
  nextId(namespace: string): string;
}

interface TransactionResult<T> {
  result: T;
  payload?: Readonly<Record<string, unknown>>;
}

type Listener = () => void;

const DEFAULT_ACTOR = 'mock-operator';
const RESERVED_INTERNAL_ACTORS = new Set([DEFAULT_ACTOR, 'system-seed', 'system-migration']);
const SAFE_PROVIDER_QUERY_RESULTS = new Set([
  'NOTPAY', 'PENDING', 'PROCESSING', 'CONFIRMING', 'SUCCESS', 'PAYERROR', 'REFUNDCLOSED', 'FAILED', 'UNKNOWN',
]);
function requireNonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized === '') {
    throw new DemoError('VALIDATION_FAILED', `${field} 不能为空`, { field });
  }
  return normalized;
}

function requireIntegerInRange(value: number, field: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new DemoError('VALIDATION_FAILED', `${field} 必须是 ${min} 到 ${max} 的整数`, { field, value });
  }
  return value;
}

function merchantPhotos(refs: readonly string[] | undefined): string[] {
  const photos = refs ?? [];
  if (photos.length > 9 || photos.some((ref) => ref.trim() === '') || new Set(photos).size !== photos.length) {
    throw new DemoError('VALIDATION_FAILED', '商家图片最多 9 张且不能重复');
  }
  return [...photos];
}

function merchantProjection(merchant: Merchant): Merchant {
  const photos = merchant.photoMaterialIds ?? [];
  return structuredClone({ ...merchant, version: merchant.version ?? '1', photoMaterialIds: [...photos], coverMaterialId: photos[0] ?? null });
}

function normalizeOperatingAddress(address: CreateMerchantInput['operatingAddress']): Merchant['operatingAddress'] {
  if (!Number.isFinite(address.longitude) || address.longitude < -180 || address.longitude > 180) {
    throw new DemoError('VALIDATION_FAILED', '经度必须位于 -180 到 180');
  }
  if (!Number.isFinite(address.latitude) || address.latitude < -90 || address.latitude > 90) {
    throw new DemoError('VALIDATION_FAILED', '纬度必须位于 -90 到 90');
  }
  return {
    provinceCode: address.provinceCode?.trim() || '000000',
    cityCode: address.cityCode?.trim() || '000000',
    districtCode: address.districtCode?.trim() || '000000',
    province: requireNonBlank(address.province, '省份'),
    city: requireNonBlank(address.city, '城市'),
    district: requireNonBlank(address.district, '区县'),
    poiName: address.poiName?.trim() || null,
    detailAddress: requireNonBlank(address.detailAddress, '详细地址'),
    fullAddress: requireNonBlank(address.fullAddress, '完整经营地址'),
    longitude: address.longitude,
    latitude: address.latitude,
    confirmationStatus: address.confirmationStatus ?? 'LEGACY_UNVERIFIED',
  };
}

function hasManagementPermission(
  state: MockState,
  actorId: string | undefined,
  permission:
    | 'merchant.manage'
    | 'cabinet.manage'
    | 'catalog.manage'
    | 'catalog.review'
    | 'asset.manage'
    | 'asset.review'
    | 'system.manage'
    | 'order.view'
    | 'finance.manage'
    | 'mock.control',
): void {
  const resolvedActorId = actorId ?? DEFAULT_ACTOR;
  if (resolvedActorId === DEFAULT_ACTOR || resolvedActorId === 'system-seed' || resolvedActorId === 'system-migration') return;
  const actor = state.admins.find((admin) => admin.id === resolvedActorId);
  if (actor === undefined || actor.status !== 'ACTIVE' || actor.archivedAt !== null) {
    throw new DemoError('FORBIDDEN', '当前管理员会话已失效', { actorId: resolvedActorId });
  }
  const allowed = actor.role === 'SUPER_ADMIN'
    || (permission === 'merchant.manage' && actor.role === 'OPERATIONS')
    || (permission === 'cabinet.manage' && actor.role === 'OPERATIONS')
    || ((permission === 'catalog.manage' || permission === 'catalog.review') && actor.role === 'OPERATIONS')
    || ((permission === 'asset.manage' || permission === 'asset.review') && actor.role === 'OPERATIONS')
    || (permission === 'order.view' && ['OPERATIONS', 'AFTER_SALES', 'FINANCE'].includes(actor.role))
    || (permission === 'finance.manage' && actor.role === 'FINANCE')
    || (permission === 'mock.control' && actor.role === 'OPERATIONS');
  if (!allowed) throw new DemoError('FORBIDDEN', '当前管理员没有执行此操作的权限', { actorId: resolvedActorId, permission });
}

function requireAdminActorId(value: string | undefined): string {
  const actorId = requireNonBlank(value ?? '', '管理员身份');
  if (RESERVED_INTERNAL_ACTORS.has(actorId)) {
    throw new DemoError('FORBIDDEN', 'Admin 工作台命令不得使用内部保留 actor 绕过角色权限', { actorId });
  }
  return actorId;
}

function advanceClockPastAggregateFacts(state: MockState, aggregateType: string, aggregateId: string): void {
  const timestamps: string[] = [];
  const add = (value: string | null | undefined) => {
    if (value !== null && value !== undefined && !Number.isNaN(Date.parse(value))) timestamps.push(value);
  };
  if (aggregateType === 'CONTRACT_PURCHASE_ORDER') {
    const order = state.contractPurchaseOrders.find((candidate) => candidate.id === aggregateId);
    if (order !== undefined) {
      add(order.createdAt); add(order.updatedAt); add(order.closedAt);
      for (const fact of [order.payment, order.refund]) {
        if (fact === null) continue;
        add(fact.createdAt); add(fact.updatedAt); add(fact.lastQueriedAt); add(fact.notificationReceivedAt);
      }
      for (const entry of state.contractCreditLedger.filter((candidate) => candidate.purchaseOrderId === order.id)) add(entry.occurredAt);
    }
  }
  const latest = Math.max(...timestamps.map((value) => Date.parse(value)));
  const current = Date.parse(state.meta.currentTime);
  if (Number.isFinite(latest) && current <= latest) state.meta.currentTime = new Date(latest + 1_000).toISOString();
}

function normalizeCatalogKey(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
}

function assertActiveMerchant(merchant: Merchant): void {
  if (merchant.status !== 'ACTIVE' || merchant.archivedAt !== null) {
    throw new DemoError('CONFLICT', '商家已停用或归档，不能继续创建或操作业务', { merchantId: merchant.id });
  }
}

function percentToBasisPoints(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new DemoError('VALIDATION_FAILED', '分润比例必须位于 0% 到 100%', { sharePercent: value });
  }
  const basisPoints = Math.round(value * 100);
  if (Math.abs(basisPoints / 100 - value) > 1e-8) {
    throw new DemoError('VALIDATION_FAILED', '分润比例最多保留两位小数', { sharePercent: value });
  }
  return basisPoints;
}

function maskMobile(value: string): string {
  const normalized = value.trim();
  if (!/^1\d{10}$/.test(normalized)) {
    throw new DemoError('VALIDATION_FAILED', '手机号必须为 11 位中国大陆手机号', { mobile: normalized });
  }
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function findOrThrow<T extends { id: string }>(items: readonly T[], id: string, entityName: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new DemoError('NOT_FOUND', `${entityName}不存在`, { id });
  }
  return item;
}

function findStarAccountOrThrow(items: readonly StarAccount[], userId: string): StarAccount {
  const account = items.find((candidate) => candidate.userId === userId);
  if (account === undefined) {
    throw new DemoError('NOT_FOUND', '星钻账户不存在', { userId });
  }
  return account;
}

export class DemoRuntime {
  private state: MockState;
  private readonly persistence: DemoPersistence;
  private readonly providerQueryResults: Readonly<Record<string, string>>;
  private readonly listeners = new Set<Listener>();

  constructor(options: DemoRuntimeOptions = {}) {
    this.persistence =
      options.persistence ?? createDemoPersistence(options.storage, options.storageKey);
    this.providerQueryResults = Object.freeze({ ...(options.providerQueryResults ?? {}) });
    const loaded = this.persistence.load();
    if (loaded !== null) {
      assertMockInvariants(loaded);
    }
    this.state = loaded ?? createSeedState(options.scenarioName ?? 'normal');
    assertMockInvariants(this.state);
    if (loaded === null) {
      this.persistence.save(this.state);
    }
  }

  private queryOriginalProviderStatus(aggregateId: string, fact: WechatPayMockOperationFacts): string {
    const configured = this.providerQueryResults[`${fact.operation}:${aggregateId}`];
    const result = configured ?? (
      ['PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(fact.providerStatus) ? 'SUCCESS' : fact.providerStatus
    );
    if (!SAFE_PROVIDER_QUERY_RESULTS.has(result)) {
      throw new DemoError('CONFLICT', 'Mock 原单查询结果必须是受控 Provider 枚举', { aggregateId, operation: fact.operation });
    }
    return result;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getInfo(): DemoRuntimeInfo {
    return {
      appMode: this.state.meta.appMode,
      productVersion: this.state.meta.productVersion,
      schemaVersion: this.state.meta.schemaVersion,
      scenarioName: this.state.meta.scenarioName,
      seed: this.state.meta.seed,
      now: this.state.meta.currentTime,
      revision: this.state.meta.revision,
      eventCount: this.state.auditEvents.length,
    };
  }

  getSnapshot(): Readonly<MockState> {
    return structuredClone(this.state);
  }

  resetScenario(scenarioName: DemoScenarioName = 'normal', actorId?: string): DemoRuntimeInfo {
    const resolvedActorId = requireAdminActorId(actorId);
    hasManagementPermission(this.state, resolvedActorId, 'mock.control');
    const next = createSeedState(scenarioName);
    const occurredAt = nextDemoTimestamp(next.meta);
    const event: AuditEvent = {
      id: nextDemoId(next.meta, 'audit'),
      sequence: next.auditEvents.length + 1,
      aggregateType: 'DEMO_RUNTIME',
      aggregateId: scenarioName,
      action: 'SCENARIO_RESET',
      actorId: resolvedActorId,
      occurredAt,
      payload: { scenarioName },
    };
    next.auditEvents.push(event);
    next.meta.revision = 1;
    assertMockInvariants(next);
    this.state = next;
    this.persistence.clear();
    this.persistence.save(next);
    this.notify();
    return this.getInfo();
  }

  getDashboardSummary(): DashboardSummary {
    
    const abnormalCabinets = this.state.cabinets.filter((cabinet) => cabinet.connectivity !== 'ONLINE').length;
    const frozenBoxes = this.state.boxes.filter((box) => box.businessStatus === 'FROZEN').length;
    
    return {
      merchantCount: this.state.merchants.length,
      operatingAddressCount: this.state.merchants.length,
      cabinetTotal: this.state.cabinets.length,
      cabinetOnline: this.state.cabinets.filter((cabinet) => cabinet.connectivity === 'ONLINE').length,
      cabinetOffline: this.state.cabinets.filter((cabinet) => cabinet.connectivity === 'OFFLINE').length,
      cabinetUnknown: this.state.cabinets.filter((cabinet) => cabinet.connectivity === 'UNKNOWN').length,
      boxTotal: this.state.boxes.length,
      boxAvailable: this.state.boxes.filter((box) => box.businessStatus === 'AVAILABLE').length,
      boxOccupied: this.state.boxes.filter(
        (box) => box.businessStatus === 'OCCUPIED' || box.businessStatus === 'RESERVED',
      ).length,
      assetTotal: this.state.assets.length,
      assetInCabinet: this.state.assets.filter((asset) => asset.boxId !== null).length,

openAlertCount: abnormalCabinets + frozenBoxes,
    };
  }

  listMerchants(): readonly Merchant[] {
    return this.state.merchants.filter((merchant) => merchant.archivedAt === null).map(merchantProjection);
  }

  getMerchantById(merchantId: string): Merchant {
    return merchantProjection(findOrThrow(this.state.merchants, merchantId, '商家'));
  }

  createMerchant(input: CreateMerchantInput): Merchant {
    return this.transact('MERCHANT', 'pending', 'MERCHANT_CREATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'merchant.manage');
      const name = requireNonBlank(input.name, '商家名称');
      if (draft.merchants.some((merchant) => merchant.name === name)) {
        throw new DemoError('CONFLICT', '商家名称已存在', { name });
      }
      const photos = merchantPhotos(input.photoMaterialIds);
      const merchant: Merchant = {
        id: context.nextId('merchant'),
        name,
        version: '1',
        photoMaterialIds: photos,
        coverMaterialId: photos[0] ?? null,
        status: 'ACTIVE',
        shareBps: percentToBasisPoints(input.sharePercent),
        settlementCycle: 'MONTHLY',
        settlementAccount: requireNonBlank(input.settlementAccount, '结算账户'),
        contactName: requireNonBlank(input.contactName, '联系人'),
        operatingAddress: normalizeOperatingAddress(input.operatingAddress),
        createdAt: context.occurredAt,
        updatedAt: context.occurredAt,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
      };
      draft.merchants.push(merchant);
      return { result: merchant, payload: { merchantId: merchant.id, name: merchant.name } };
    });
  }

  updateMerchant(input: UpdateMerchantInput): Merchant {
    return this.transact('MERCHANT', input.merchantId, 'MERCHANT_UPDATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'merchant.manage');
      const merchant = findOrThrow(draft.merchants, input.merchantId, '商家');
      if (merchant.archivedAt !== null) throw new DemoError('CONFLICT', '归档商家必须先恢复后再编辑');
      if (input.command?.expectedVersion !== undefined && input.command.expectedVersion !== (merchant.version ?? '1')) {
        throw new DemoError('CONFLICT', '商家版本已变化，请刷新后再编辑');
      }
      const name = requireNonBlank(input.name, '商家名称');
      if (draft.merchants.some((candidate) => candidate.id !== merchant.id && candidate.archivedAt === null && candidate.name === name)) {
        throw new DemoError('CONFLICT', '商家名称已存在', { name });
      }
      merchant.name = name;
      merchant.contactName = requireNonBlank(input.contactName, '联系人');
      merchant.shareBps = percentToBasisPoints(input.sharePercent);
      merchant.settlementAccount = requireNonBlank(input.settlementAccount, '结算账户');
      merchant.operatingAddress = normalizeOperatingAddress(input.operatingAddress);
      const photos = merchantPhotos(input.photoMaterialIds ?? merchant.photoMaterialIds);
      merchant.photoMaterialIds = photos;
      merchant.coverMaterialId = photos[0] ?? null;
      merchant.version = String(Number(merchant.version ?? '1') + 1);
      merchant.updatedAt = context.occurredAt;
      return { result: merchant, payload: { merchantId: merchant.id } };
    });
  }

  updateMerchantPhotos(merchantId: string, expectedVersion: string, photoMaterialIds: readonly string[], actorId?: string): Merchant {
    return this.transact('MERCHANT', merchantId, 'MERCHANT_PHOTOS_UPDATED', actorId, (draft, context) => {
      hasManagementPermission(draft, actorId, 'merchant.manage');
      const merchant = findOrThrow(draft.merchants, merchantId, '商家');
      if (merchant.archivedAt !== null) throw new DemoError('CONFLICT', '归档商家必须先恢复后再编辑');
      if ((merchant.version ?? '1') !== expectedVersion) throw new DemoError('CONFLICT', '商家版本已变化，请刷新后再编辑图片');
      const photos = merchantPhotos(photoMaterialIds);
      merchant.photoMaterialIds = photos;
      merchant.coverMaterialId = photos[0] ?? null;
      merchant.version = String(Number(expectedVersion) + 1);
      merchant.updatedAt = context.occurredAt;
      return { result: merchant, payload: { merchantId, photoCount: photos.length } };
    });
  }

  archiveMerchant(input: ArchiveEntityInput): Merchant {
    return this.transact('MERCHANT', input.id, 'MERCHANT_ARCHIVED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'merchant.manage');
      const merchant = findOrThrow(draft.merchants, input.id, '商家');
      if (merchant.archivedAt !== null) return { result: merchant, payload: { idempotent: true } };
      const blockingCabinets = draft.cabinets.filter((cabinet) => cabinet.merchantId === merchant.id && cabinet.archivedAt === null && cabinet.status === 'ACTIVE');

const cabinetIds = new Set(draft.cabinets.filter((cabinet) => cabinet.merchantId === merchant.id).map((cabinet) => cabinet.id));
      const unknownCommands = draft.commands.filter((command) => cabinetIds.has(command.cabinetRecordId) && command.status === 'UNKNOWN');
      if (blockingCabinets.length + unknownCommands.length > 0) {
        throw new DemoError('CONFLICT', '商家仍有启用柜机或未知命令，不能归档', {
          activeCabinets: blockingCabinets.length,

unknownCommands: unknownCommands.length,
        });
      }
      merchant.archivedAt = context.occurredAt;
      merchant.archivedBy = input.actorId ?? DEFAULT_ACTOR;
      merchant.archiveReason = requireNonBlank(input.reason, '归档原因');
      merchant.updatedAt = context.occurredAt;
      return { result: merchant };
    });
  }

  restoreMerchant(input: RestoreEntityInput): Merchant {
    return this.transact('MERCHANT', input.id, 'MERCHANT_RESTORED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'merchant.manage');
      const merchant = findOrThrow(draft.merchants, input.id, '商家');
      if (merchant.archivedAt === null) return { result: merchant, payload: { idempotent: true } };
      merchant.archivedAt = null;
      merchant.archivedBy = null;
      merchant.archiveReason = null;
      merchant.status = 'INACTIVE';
      merchant.updatedAt = context.occurredAt;
      return { result: merchant };
    });
  }

  listCabinets(): readonly Cabinet[] {
    return structuredClone(this.state.cabinets.filter((cabinet) => cabinet.archivedAt === null));
  }

  createCabinet(input: CreateCabinetInput): Cabinet {
    return this.transact('CABINET', 'pending', 'CABINET_CREATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'cabinet.manage');
      const merchant = findOrThrow(draft.merchants, input.merchantId, '商家');
      assertActiveMerchant(merchant);
      const externalId = requireNonBlank(input.cabinetId, 'cabinetId');
      if (draft.cabinets.some((cabinet) => cabinet.cabinetId === externalId)) {
        throw new DemoError('CONFLICT', 'cabinetId 已存在', { cabinetId: externalId });
      }
      const boxCount = requireIntegerInRange(input.boxCount, '格口数量', 1, 120);
      const cabinet: Cabinet = {
        id: context.nextId('cabinet'),
        cabinetId: externalId,
        merchantId: merchant.id,
        merchantSnapshot: { id: merchant.id, name: merchant.name },
        deploymentAddressSnapshot: structuredClone(merchant.operatingAddress),
        name: requireNonBlank(input.name, '柜机名称'),
        description: input.description?.trim() ?? '',
        boxCount,
        status: 'ACTIVE',
        connectivity: input.connectivity ?? 'UNKNOWN',
        capabilities: input.capabilities === undefined
          ? { doorFeedback: true, articleDetection: false }
          : { ...input.capabilities },
        createdAt: context.occurredAt,
        updatedAt: context.occurredAt,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
      };
      draft.cabinets.push(cabinet);
      for (let boxNo = 1; boxNo <= boxCount; boxNo += 1) {
        const box: CabinetBox = {
          id: context.nextId('box'),
          cabinetRecordId: cabinet.id,
          boxNo,
          doorStatus: cabinet.capabilities.doorFeedback ? 'UNKNOWN' : 'UNSUPPORTED',
          sensorStatus: 'UNKNOWN',
          businessStatus: 'AVAILABLE',
          assetId: null,
          lastCommandId: null,
          updatedAt: context.occurredAt,
        };
        draft.boxes.push(box);
      }
      return {
        result: cabinet,
        payload: { cabinetRecordId: cabinet.id, cabinetId: cabinet.cabinetId, merchantId: merchant.id, boxCount },
      };
    });
  }

  updateCabinet(input: UpdateCabinetInput): Cabinet {
    return this.transact('CABINET', input.cabinetRecordId, 'CABINET_UPDATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'cabinet.manage');
      const cabinet = findOrThrow(draft.cabinets, input.cabinetRecordId, '柜机');
      if (cabinet.archivedAt !== null) throw new DemoError('CONFLICT', '归档柜机必须先恢复后再编辑');
      cabinet.name = requireNonBlank(input.name, '柜机名称');
      cabinet.description = input.description.trim();
      cabinet.capabilities = { ...input.capabilities };
      cabinet.updatedAt = context.occurredAt;
      return { result: cabinet };
    });
  }

  setCabinetStatus(input: SetCabinetStatusInput): Cabinet {
    return this.transact('CABINET', input.cabinetRecordId, input.status === 'ACTIVE' ? 'CABINET_ENABLED' : 'CABINET_DISABLED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'cabinet.manage');
      const cabinet = findOrThrow(draft.cabinets, input.cabinetRecordId, '柜机');
      if (cabinet.archivedAt !== null) throw new DemoError('CONFLICT', '归档柜机不能变更状态');
      if (cabinet.status === input.status) return { result: cabinet, payload: { idempotent: true } };
      if (input.status === 'ACTIVE') assertActiveMerchant(findOrThrow(draft.merchants, cabinet.merchantId, '商家'));
      if (input.status === 'INACTIVE') this.assertCabinetCanDeactivate(draft, cabinet);
      cabinet.status = input.status;
      cabinet.updatedAt = context.occurredAt;
      return { result: cabinet };
    });
  }

  archiveCabinet(input: ArchiveEntityInput): Cabinet {
    return this.transact('CABINET', input.id, 'CABINET_ARCHIVED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'cabinet.manage');
      const cabinet = findOrThrow(draft.cabinets, input.id, '柜机');
      if (cabinet.archivedAt !== null) return { result: cabinet, payload: { idempotent: true } };
      this.assertCabinetCanDeactivate(draft, cabinet);
      cabinet.status = 'INACTIVE';
      cabinet.archivedAt = context.occurredAt;
      cabinet.archivedBy = input.actorId ?? DEFAULT_ACTOR;
      cabinet.archiveReason = requireNonBlank(input.reason, '归档原因');
      cabinet.updatedAt = context.occurredAt;
      return { result: cabinet };
    });
  }

  restoreCabinet(input: RestoreEntityInput): Cabinet {
    return this.transact('CABINET', input.id, 'CABINET_RESTORED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'cabinet.manage');
      const cabinet = findOrThrow(draft.cabinets, input.id, '柜机');
      assertActiveMerchant(findOrThrow(draft.merchants, cabinet.merchantId, '商家'));
      cabinet.archivedAt = null;
      cabinet.archivedBy = null;
      cabinet.archiveReason = null;
      cabinet.status = 'INACTIVE';
      cabinet.updatedAt = context.occurredAt;
      return { result: cabinet };
    });
  }

  listBoxes(cabinetRecordId: string): readonly CabinetBox[] {
    findOrThrow(this.state.cabinets, cabinetRecordId, '柜机');
    return structuredClone(
      this.state.boxes.filter((box) => box.cabinetRecordId === cabinetRecordId).sort((left, right) => left.boxNo - right.boxNo),
    );
  }

  listBoxEvents(cabinetRecordId: string, boxNo?: number): readonly CabinetBoxEvent[] {
    findOrThrow(this.state.cabinets, cabinetRecordId, '柜机');
    if (boxNo !== undefined) {
      requireIntegerInRange(boxNo, 'boxNo', 1, 120);
      const boxExists = this.state.boxes.some(
        (box) => box.cabinetRecordId === cabinetRecordId && box.boxNo === boxNo,
      );
      if (!boxExists) {
        throw new DemoError('NOT_FOUND', '格口不存在', { cabinetRecordId, boxNo });
      }
    }
    const events = this.state.boxEvents.filter(
      (event) => event.cabinetRecordId === cabinetRecordId && (boxNo === undefined || event.boxNo === boxNo),
    );
    return structuredClone([...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)));
  }

  listProducts(): readonly Product[] {
    return structuredClone(this.state.products);
  }

  listProductSupplementRequests() {
    return structuredClone([...this.state.productSupplementRequests].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  createProduct(input: CreateProductInput): Product {
    return this.transact('PRODUCT', 'pending', 'PRODUCT_CREATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'catalog.manage');
      const name = requireNonBlank(input.name, '商品名称');
      const brandId = requireNonBlank(input.brandId, '品牌 ID');
      const brand = requireNonBlank(input.brand, '品牌');
      const model = requireNonBlank(input.model, '型号');
      const normalizedName = normalizeCatalogKey(name);
      const normalizedModel = normalizeCatalogKey(model);
      if (draft.products.some((product) => product.brandId === brandId && product.normalizedModel === normalizedModel && product.normalizedName === normalizedName)) {
        throw new DemoError('CONFLICT', '品牌、型号与对外商品名组合已存在', { name, brand, model });
      }
      const imageMediaIds = [...new Set((input.imageMediaIds ?? []).map((id) => requireNonBlank(id, '商品图片')))];
      const coverMediaId = input.coverMediaId === undefined || input.coverMediaId === null ? imageMediaIds[0] ?? null : requireNonBlank(input.coverMediaId, '商品封面');
      if (coverMediaId !== null && !imageMediaIds.includes(coverMediaId)) imageMediaIds.unshift(coverMediaId);
      const product: Product = {
        id: context.nextId('product'),
        productNo: `XY-P-${String(draft.products.length + 1).padStart(6, '0')}`,
        brandId,
        name,
        brand,
        model,
        normalizedModel,
        normalizedName,
        category: requireNonBlank(input.category, '商品分类'),
        description: requireNonBlank(input.description, '商品说明'),
        tags: input.tags.map((tag) => requireNonBlank(tag, '经营标签')),
        coverMediaId,
        imageMediaIds,
        videoMediaIds: [...new Set((input.videoMediaIds ?? []).map((id) => requireNonBlank(id, '商品视频')))],
        status: 'ACTIVE',
        createdAt: context.occurredAt,
        updatedAt: context.occurredAt,
      };
      draft.products.push(product);
      return { result: product, payload: { productId: product.id, name: product.name } };
    });
  }

  updateProduct(input: UpdateProductInput): Product {
    return this.transact('PRODUCT', input.productId, 'PRODUCT_UPDATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'catalog.manage');
      const product = findOrThrow(draft.products, input.productId, '标准商品');
      const normalizedName = normalizeCatalogKey(requireNonBlank(input.name, '商品名称'));
      const normalizedModel = normalizeCatalogKey(requireNonBlank(input.model, '型号'));
      if (draft.products.some((candidate) => candidate.id !== product.id && candidate.brandId === input.brandId.trim() && candidate.normalizedModel === normalizedModel && candidate.normalizedName === normalizedName)) {
        throw new DemoError('CONFLICT', '品牌、型号与对外商品名组合已存在', { productId: product.id });
      }
      const imageMediaIds = [...new Set((input.imageMediaIds ?? []).map((id) => requireNonBlank(id, '商品图片')))];
      const coverMediaId = input.coverMediaId === undefined || input.coverMediaId === null ? imageMediaIds[0] ?? null : requireNonBlank(input.coverMediaId, '商品封面');
      if (coverMediaId !== null && !imageMediaIds.includes(coverMediaId)) imageMediaIds.unshift(coverMediaId);
      Object.assign(product, {
        name: input.name.trim(), brandId: requireNonBlank(input.brandId, '品牌 ID'), brand: requireNonBlank(input.brand, '品牌'),
        model: input.model.trim(), normalizedModel, normalizedName, category: requireNonBlank(input.category, '商品分类'),
        description: requireNonBlank(input.description, '商品说明'), tags: input.tags.map((tag) => requireNonBlank(tag, '经营标签')),
        coverMediaId, imageMediaIds, videoMediaIds: [...new Set((input.videoMediaIds ?? []).map((id) => requireNonBlank(id, '商品视频')))],
        status: input.status, updatedAt: context.occurredAt,
      });
      if (input.status !== 'ACTIVE') {
        for (const asset of draft.assets.filter((candidate) => candidate.productId === product.id)) asset.publishStatus = 'OFFLINE';
      }
      return { result: product, payload: { productId: product.id, status: product.status } };
    });
  }

  reviewProductSupplementRequest(input: ReviewProductSupplementRequestInput) {
    return this.transact('PRODUCT_SUPPLEMENT_REQUEST', input.requestId, 'PRODUCT_SUPPLEMENT_REVIEWED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'catalog.review');
      const request = findOrThrow(draft.productSupplementRequests, input.requestId, '商品补录申请');
      if (request.status !== 'PENDING') throw new DemoError('INVALID_TRANSITION', '只有待审核补录申请可以处理', { requestId: request.id });
      let linkedProductId: string | null = null;
      if (input.decision === 'MERGE') {
        linkedProductId = findOrThrow(draft.products, requireNonBlank(input.linkedProductId ?? '', '合并目标商品'), '标准商品').id;
        request.status = 'MERGED';
      } else if (input.decision === 'APPROVE') {
        if (input.linkedProductId !== undefined && input.linkedProductId !== null && input.linkedProductId.trim() !== '') {
          linkedProductId = findOrThrow(draft.products, input.linkedProductId, '标准商品').id;
        } else {
          const product: Product = {
            id: context.nextId('product'), productNo: `XY-P-${String(draft.products.length + 1).padStart(6, '0')}`,
            brandId: `brand_${normalizeCatalogKey(request.proposedBrand).replace(/[^a-z0-9]+/g, '_') || draft.products.length + 1}`,
            name: request.proposedName.trim(), brand: request.proposedBrand.trim(), model: request.proposedModel.trim(),
            normalizedModel: normalizeCatalogKey(request.proposedModel), normalizedName: normalizeCatalogKey(request.proposedName),
            category: request.category.trim(), description: request.description.trim(), tags: [],
            coverMediaId: request.evidenceMediaIds[0] ?? null, imageMediaIds: [...request.evidenceMediaIds], videoMediaIds: [],
            status: 'ACTIVE', createdAt: context.occurredAt, updatedAt: context.occurredAt,
          };
          draft.products.push(product);
          linkedProductId = product.id;
        }
        request.status = 'APPROVED';
      } else {
        request.status = 'REJECTED';
      }
      request.linkedProductId = linkedProductId;
      request.reviewRemark = requireNonBlank(input.reviewRemark, '审核备注');
      request.reviewedBy = input.actorId ?? DEFAULT_ACTOR;
      request.reviewedAt = context.occurredAt;
      request.updatedAt = context.occurredAt;
      return { result: request, payload: { requestId: request.id, status: request.status, linkedProductId } };
    });
  }

  listAssets(): readonly Asset[] {
    return structuredClone(this.state.assets.map((asset) => ({ ...asset, version: asset.version ?? '1' })));
  }

  listLessors() {
    return structuredClone(this.state.lessors);
  }

  listAssetTerms(assetId: string) {
    return structuredClone(this.state.assetTermsRevisions.filter((revision) => revision.assetId === assetId).sort((left, right) => right.revision - left.revision));
  }

  createOfficialAssetBatch(input: CreateOfficialAssetBatchInput): readonly Asset[] {
    return this.transact('ASSET_BATCH', 'pending', 'OFFICIAL_ASSET_BATCH_CREATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'asset.manage');
      const product = findOrThrow(draft.products, input.productId, '标准商品');
      const officialLessors = draft.lessors.filter((candidate) => candidate.businessMode === 'B2C' && candidate.lessorKind === 'PLATFORM' && candidate.status === 'ACTIVE');
      if (product.status !== 'ACTIVE' || officialLessors.length !== 1) throw new DemoError('CONFLICT', '官方资产必须关联启用商品和唯一有效的官方出租方');
      const lessor = officialLessors[0]!;
      if (input.identifiers.length < 1 || input.identifiers.length > 200) throw new DemoError('VALIDATION_FAILED', '单次批量创建必须包含 1 到 200 台设备');
      const identifiers = input.identifiers.map((entry) => {
        if (entry.rfidCode !== undefined && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(entry.rfidCode)) throw new DemoError('VALIDATION_FAILED', 'RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定');
        const identifierValue = entry.identifierType === 'PLATFORM_TAG' && entry.identifierValue === undefined ? context.nextId('asset_tag') : requireNonBlank(entry.identifierValue ?? '', '设备唯一标识');
        return { identifierType: entry.identifierType, identifierValue, normalized: normalizeCatalogKey(identifierValue), rfidCode: entry.rfidCode?.toUpperCase() ?? null };
      });
      const newKeys = new Set<string>();
      for (const identifier of identifiers) {
        const key = `${identifier.identifierType}:${identifier.normalized}`;
        if (newKeys.has(key) || draft.assets.some((asset) => asset.identifierType === identifier.identifierType && asset.identifierNormalizedValue === identifier.normalized)) {
          throw new DemoError('CONFLICT', '批次内或现有资产中存在重复设备唯一标识', { identifierValue: identifier.identifierValue });
        }
        newKeys.add(key);
        if (identifier.rfidCode !== null && draft.assets.some((asset) => asset.rfidCode === identifier.rfidCode)) throw new DemoError('CONFLICT', 'RFID 已绑定其他资产');
      }
      const unitPriceFen = requireIntegerInRange(input.unitPriceFen, '租金', 0, Number.MAX_SAFE_INTEGER);
      const minimumUnits = requireIntegerInRange(input.minimumUnits, '最低租期', 1, input.rentalType === 'DAY' ? 365 : 8_760);
      const depositFen = requireIntegerInRange(input.depositFen, '押金', 0, Number.MAX_SAFE_INTEGER);
      const referenceValueFen = requireIntegerInRange(input.referenceValueFen, '商品价值', 0, Number.MAX_SAFE_INTEGER);
      const imageMediaIds = [...new Set((input.imageMediaIds ?? product.imageMediaIds).map((id) => requireNonBlank(id, '资产图片')))];
      const coverMediaId = input.coverMediaId === undefined ? product.coverMediaId : input.coverMediaId;
      if (coverMediaId !== null && !imageMediaIds.includes(coverMediaId)) imageMediaIds.unshift(coverMediaId);
      const batchId = context.nextId('asset_batch');
      const assets = identifiers.map((identifier, index): Asset => {
        const id = context.nextId('asset');
        const asset: Asset = {
          id, assetNo: `XY-A-${String(draft.assets.length + index + 1).padStart(6, '0')}`, productId: product.id,
          displayName: requireNonBlank(input.displayName, '资产名称'), supplyMode: 'OFFICIAL', lessorId: lessor.id,
          identifierType: identifier.identifierType, identifierValue: identifier.identifierValue, identifierNormalizedValue: identifier.normalized, rfidCode: identifier.rfidCode, version: '1',
          condition: requireNonBlank(input.condition, '成色描述'), defectDescription: input.defectDescription.trim(), accessoryDescription: input.accessoryDescription.trim(),
          rentalType: input.rentalType, unitPriceFen, minimumUnits, depositFen, referenceValueFen, currency: 'CNY',
          termsRevision: 1, termsEffectiveAt: context.occurredAt, coverMediaId, imageMediaIds,
          videoMediaIds: [...new Set((input.videoMediaIds ?? product.videoMediaIds).map((mediaId) => requireNonBlank(mediaId, '资产视频')))],
          mediaSource: input.imageMediaIds === undefined && input.videoMediaIds === undefined ? 'PRODUCT_STANDARD' : 'ASSET_ACTUAL',
          publishLocationSnapshot: null, reviewStatus: 'NOT_REQUIRED', publishStatus: input.publishStatus ?? 'OFFLINE', availabilityStatus: 'AVAILABLE',
          boxId: null, creationBatchId: batchId, reviewRemark: null, createdAt: context.occurredAt, updatedAt: context.occurredAt,
        };
        draft.assetTermsRevisions.push({
          id: `terms_${id}_v1`, assetId: id, revision: 1, rentalType: asset.rentalType, unitPriceFen, minimumUnits, depositFen, referenceValueFen,
          currency: 'CNY', effectiveAt: context.occurredAt, changedBy: input.actorId ?? DEFAULT_ACTOR, changeReason: '官方批量投放初始租赁条件',
        });
        return asset;
      });
      draft.assets.push(...assets);
      return { result: assets, payload: { batchId, assetCount: assets.length, productId: product.id } };
    });
  }

  updateAssetRFID(assetId: string, expectedVersion: string, rfidCode: string | null, actorId?: string): Asset {
    return this.transact('ASSET', assetId, 'ASSET_RFID_UPDATED', actorId, (draft, context) => {
      hasManagementPermission(draft, actorId, 'asset.manage');
      const asset = findOrThrow(draft.assets, assetId, '资产');
      if (asset.supplyMode !== 'OFFICIAL') throw new DemoError('CONFLICT', '只有官方资产可编辑 RFID');
      if ((asset.version ?? '1') !== expectedVersion) throw new DemoError('CONFLICT', '资产版本已变化，请刷新后再修改 RFID');
      if (rfidCode !== null && !/^(?!00000000$)[0-9A-Fa-f]{8}$/.test(rfidCode)) throw new DemoError('VALIDATION_FAILED', 'RFID 必须为 8 位十六进制字符（0–9、A–F）；00000000 为空位标记，不可绑定');
      rfidCode = rfidCode?.toUpperCase() ?? null;
      if (rfidCode !== null && draft.assets.some((candidate) => candidate.id !== assetId && candidate.rfidCode === rfidCode)) {
        throw new DemoError('CONFLICT', 'RFID 已绑定其他资产');
      }
      asset.rfidCode = rfidCode;
      asset.version = String(Number(expectedVersion) + 1);
      asset.updatedAt = context.occurredAt;
      return { result: asset, payload: { assetId, rfidCode } };
    });
  }

  updateAsset(input: UpdateAssetInput): Asset {
    return this.transact('ASSET', input.assetId, 'ASSET_UPDATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'asset.manage');
      const asset = findOrThrow(draft.assets, input.assetId, '资产');
      if (asset.availabilityStatus !== 'AVAILABLE') throw new DemoError('CONFLICT', '资产当前不可用，不能修改关键信息', { assetId: asset.id });
      const displayName = requireNonBlank(input.displayName, '资产名称');
      const condition = requireNonBlank(input.condition, '成色与瑕疵描述');
      const unitPriceFen = requireIntegerInRange(input.unitPriceFen, '租金', 0, Number.MAX_SAFE_INTEGER);
      const minimumUnits = requireIntegerInRange(input.minimumUnits, '最低租期', 1, input.rentalType === 'DAY' ? 365 : 8_760);
      const depositFen = requireIntegerInRange(input.depositFen, '押金', 0, Number.MAX_SAFE_INTEGER);
      const referenceValueFen = requireIntegerInRange(input.referenceValueFen, '商品价值', 0, Number.MAX_SAFE_INTEGER);
      const termsChanged = asset.rentalType !== input.rentalType || asset.unitPriceFen !== unitPriceFen || asset.minimumUnits !== minimumUnits || asset.depositFen !== depositFen || asset.referenceValueFen !== referenceValueFen;
      const criticalChanged = termsChanged || asset.displayName !== displayName || asset.condition !== condition || asset.defectDescription !== input.defectDescription.trim() || asset.accessoryDescription !== input.accessoryDescription.trim();
      const imageMediaIds = [...new Set((input.imageMediaIds ?? asset.imageMediaIds).map((id) => requireNonBlank(id, '资产图片')))];
      const coverMediaId = input.coverMediaId === undefined ? asset.coverMediaId : input.coverMediaId;
      if (coverMediaId !== null && !imageMediaIds.includes(coverMediaId)) imageMediaIds.unshift(coverMediaId);
      Object.assign(asset, {
        displayName, condition, defectDescription: input.defectDescription.trim(), accessoryDescription: input.accessoryDescription.trim(), rentalType: input.rentalType,
        unitPriceFen, minimumUnits, depositFen, referenceValueFen, coverMediaId, imageMediaIds,
        videoMediaIds: [...new Set((input.videoMediaIds ?? asset.videoMediaIds).map((id) => requireNonBlank(id, '资产视频')))],
        mediaSource: 'ASSET_ACTUAL' as const,
      });
      if (termsChanged) {
        asset.termsRevision += 1;
        asset.termsEffectiveAt = context.occurredAt;
        draft.assetTermsRevisions.push({
          id: `terms_${asset.id}_v${asset.termsRevision}`, assetId: asset.id, revision: asset.termsRevision, rentalType: asset.rentalType,
          unitPriceFen, minimumUnits, depositFen, referenceValueFen, currency: 'CNY', effectiveAt: context.occurredAt,
          changedBy: input.actorId ?? DEFAULT_ACTOR, changeReason: requireNonBlank(input.changeReason, '变更原因'),
        });
      }
      if (asset.supplyMode === 'C2C' && criticalChanged) {
        asset.reviewStatus = 'PENDING';
        asset.reviewRemark = null;
        asset.publishStatus = 'OFFLINE';
      }
      asset.updatedAt = context.occurredAt;
      return { result: asset, payload: { assetId: asset.id, termsChanged, requiresReview: asset.supplyMode === 'C2C' && criticalChanged } };
    });
  }

  reviewAsset(input: ReviewAssetInput): Asset {
    return this.transact('ASSET', input.assetId, 'ASSET_REVIEWED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'asset.review');
      const asset = findOrThrow(draft.assets, input.assetId, '资产');
      if (asset.supplyMode !== 'C2C') throw new DemoError('CONFLICT', '官方资产不进入个人发布审核流程', { assetId: asset.id });
      if (input.decision === 'APPROVE') asset.reviewStatus = 'APPROVED';
      else {
        asset.reviewStatus = 'REJECTED';
        asset.publishStatus = 'OFFLINE';
        if (input.decision === 'FREEZE') asset.availabilityStatus = 'FROZEN';
      }
      asset.reviewRemark = requireNonBlank(input.reviewRemark, '审核备注');
      asset.updatedAt = context.occurredAt;
      return { result: asset, payload: { assetId: asset.id, decision: input.decision } };
    });
  }

  setAssetPublishStatus(input: SetAssetPublishStatusInput): Asset {
    return this.transact('ASSET', input.assetId, 'ASSET_PUBLISH_STATUS_CHANGED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'asset.manage');
      const asset = findOrThrow(draft.assets, input.assetId, '资产');
      const product = findOrThrow(draft.products, asset.productId, '标准商品');
      const lessor = findOrThrow(draft.lessors, asset.lessorId, '出租方');
      if (input.publishStatus === 'ONLINE' && (product.status !== 'ACTIVE' || lessor.status !== 'ACTIVE' || asset.availabilityStatus === 'FROZEN' || asset.availabilityStatus === 'RETIRED' || (asset.supplyMode === 'C2C' && asset.reviewStatus !== 'APPROVED'))) {
        throw new DemoError('CONFLICT', '资产不满足上架条件', { assetId: asset.id });
      }
      asset.publishStatus = input.publishStatus;
      asset.updatedAt = context.occurredAt;
      return { result: asset, payload: { assetId: asset.id, publishStatus: asset.publishStatus } };
    });
  }

listContractPurchaseOrders(): readonly ContractPurchaseOrderProjection[] {
    return structuredClone(
      [...this.state.contractPurchaseOrders]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(projectContractPurchaseOrder),
    );
  }

  listContractCreditLedger(purchaseOrderId?: string): readonly ContractCreditLedgerEntry[] {
    if (purchaseOrderId !== undefined) findOrThrow(this.state.contractPurchaseOrders, purchaseOrderId, '电子合同服务购买订单');
    return structuredClone(
      this.state.contractCreditLedger
        .filter((entry) => purchaseOrderId === undefined || entry.purchaseOrderId === purchaseOrderId)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id)),
    );
  }

  listContractPurchaseAuditTrail(purchaseOrderId: string): readonly AuditEvent[] {
    findOrThrow(this.state.contractPurchaseOrders, purchaseOrderId, '电子合同服务购买订单');
    return structuredClone(
      this.state.auditEvents
        .filter((event) => event.aggregateType === 'CONTRACT_PURCHASE_ORDER' && event.aggregateId === purchaseOrderId)
        .sort((left, right) => right.sequence - left.sequence),
    );
  }

  queryContractPurchasePayment(input: QueryContractPurchaseOrderInput): ContractPurchaseOrderProjection {
    return this.queryContractPurchaseProviderFact(input, 'PAYMENT');
  }

  queryContractPurchaseRefund(input: QueryContractPurchaseOrderInput): ContractPurchaseOrderProjection {
    return this.queryContractPurchaseProviderFact(input, 'REFUND');
  }

listMembers(): readonly MemberSummary[] {
    return structuredClone([...this.state.members].sort((left, right) => (right.lastOrderAt ?? '').localeCompare(left.lastOrderAt ?? '')));
  }

  getUserDossier(userId: string): UserDossier {
    const member = findOrThrow(this.state.members.map((entry) => ({ ...entry, id: entry.userId })), userId, '会员');
    const { id: _memberId, ...summary } = member;
    void _memberId;
    const account = this.state.starAccounts.find((entry) => entry.userId === userId) ?? {
      userId,
      availableTenths: 0,
      frozenTenths: 0,
      consumedTenths: 0,
      recoveryDueTenths: 0,
      updatedAt: this.state.meta.currentTime,
    };
    const loyalty = [...this.state.loyaltyConfigVersions].sort((left, right) => right.version - left.version)[0];
    if (loyalty === undefined) throw new DemoError('CONFLICT', '用户档案缺少忠诚度配置');
    const signInRecords = this.state.signInRecords.filter((record) => record.userId === userId).sort((left, right) => right.businessDate.localeCompare(left.businessDate));
    const today = toShanghaiBusinessDate(this.state.meta.currentTime);
    const currentStreakDays = signInRecords[0]?.streakDays ?? 0;
    const nextMilestone = [...loyalty.streakRewards].filter((reward) => reward.consecutiveDays > currentStreakDays).sort(
      (left, right) => left.consecutiveDays - right.consecutiveDays,
    )[0] ?? null;
    
    return structuredClone({
      ...summary,
      realNameMasked: summary.realNameStatus === 'VERIFIED' ? '演**' : null,
      identityNoMasked: summary.realNameStatus === 'VERIFIED' ? '4403**********001X' : null,
      starAccount: account,
      
      starLedger: this.state.starLedger.filter((entry) => entry.userId === userId).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
      signInRecords,
      
      signIn: {
        timezone: loyalty.timezone,
        signedInToday: signInRecords[0]?.businessDate === today,
        currentStreakDays,
        lastSignInAt: signInRecords[0]?.signedAt ?? null,
        dailyRewardStarTenths: loyalty.dailySignInRewardStarTenths,
        nextMilestoneDays: nextMilestone?.consecutiveDays ?? null,
        nextMilestoneBonusStarTenths: nextMilestone?.bonusStarTenths ?? null,
        nextMilestoneLoyaltyVersionId: loyalty.id,
      },
      
      riskTags: summary.realNameStatus === 'VERIFIED' ? ['实名已核验', '支付分已更新'] : ['待实名'],
      notes: ['Mock 用户档案仅用于管理后台需求确认，不连接真实微信用户数据。'],
    });
  }

  listAdmins(): readonly AdminAccount[] {
    return structuredClone(this.state.admins.filter((admin) => admin.archivedAt === null));
  }

  createAdmin(input: CreateAdminInput): AdminAccount {
    return this.transact('ADMIN_ACCOUNT', 'pending', 'ADMIN_CREATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'system.manage');
      const mobile = input.mobile.trim();
      const mobileMasked = maskMobile(mobile);
      if (draft.admins.some((admin) => admin.mobile === mobile)) {
        throw new DemoError('CONFLICT', '管理员手机号已存在', { mobileMasked });
      }
      const admin: AdminAccount = {
        id: context.nextId('admin'),
        displayName: requireNonBlank(input.displayName, '管理员姓名'),
        mobile,
        mobileMasked,
        role: input.role,
        status: input.status,
        loginCapabilities: { phone: true, wechat: false },
        wechatBinding: { status: 'UNBOUND', nickname: null, avatarUrl: null, boundAt: null },
        lastLoginAt: null,
        createdAt: context.occurredAt,
        createdBy: input.actorId ?? DEFAULT_ACTOR,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
      };
      draft.admins.push(admin);
      return { result: admin, payload: { adminId: admin.id, role: admin.role, mobileMasked } };
    });
  }

  updateAdmin(input: UpdateAdminInput): AdminAccount {
    return this.transact('ADMIN_ACCOUNT', input.adminId, 'ADMIN_UPDATED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'system.manage');
      const admin = findOrThrow(draft.admins, input.adminId, '管理员');
      if (admin.archivedAt !== null) throw new DemoError('CONFLICT', '归档管理员必须先恢复后再编辑');
      if (draft.admins.some((candidate) => candidate.id !== admin.id && candidate.mobile === input.mobile.trim())) {
        throw new DemoError('CONFLICT', '管理员手机号已存在');
      }
      if (input.actorId === admin.id && input.role !== 'SUPER_ADMIN') throw new DemoError('CONFLICT', '当前管理员不能将自己降级');
      const wasEffectiveSuper = admin.role === 'SUPER_ADMIN' && admin.status === 'ACTIVE' && admin.archivedAt === null;
      if (wasEffectiveSuper && input.role !== 'SUPER_ADMIN' && this.countEffectiveSuperAdmins(draft) <= 1) {
        throw new DemoError('CONFLICT', '必须保留至少一个有效超级管理员');
      }
      admin.displayName = requireNonBlank(input.displayName, '管理员姓名');
      admin.mobile = input.mobile.trim();
      admin.mobileMasked = maskMobile(admin.mobile);
      admin.role = input.role;
      return { result: admin, payload: { updatedAt: context.occurredAt } };
    });
  }

  setAdminStatus(input: SetAdminStatusInput): AdminAccount {
    return this.transact('ADMIN_ACCOUNT', input.adminId, input.status === 'ACTIVE' ? 'ADMIN_ENABLED' : 'ADMIN_DISABLED', input.actorId, (draft) => {
      hasManagementPermission(draft, input.actorId, 'system.manage');
      const admin = findOrThrow(draft.admins, input.adminId, '管理员');
      if (admin.archivedAt !== null) throw new DemoError('CONFLICT', '归档管理员不能变更状态');
      if (admin.status === 'LOCKED') throw new DemoError('INVALID_TRANSITION', '安全锁定管理员不能通过普通启用操作解锁');
      if (input.status === 'DISABLED' && input.actorId === admin.id) throw new DemoError('CONFLICT', '当前管理员不能禁用自己');
      if (input.status === 'DISABLED' && admin.role === 'SUPER_ADMIN' && this.countEffectiveSuperAdmins(draft) <= 1) {
        throw new DemoError('CONFLICT', '必须保留至少一个有效超级管理员');
      }
      if (admin.status === input.status) return { result: admin, payload: { idempotent: true } };
      admin.status = input.status;
      return { result: admin };
    });
  }

  archiveAdmin(input: ArchiveEntityInput): AdminAccount {
    return this.transact('ADMIN_ACCOUNT', input.id, 'ADMIN_ARCHIVED', input.actorId, (draft, context) => {
      hasManagementPermission(draft, input.actorId, 'system.manage');
      const admin = findOrThrow(draft.admins, input.id, '管理员');
      if (admin.archivedAt !== null) return { result: admin, payload: { idempotent: true } };
      if (input.actorId === admin.id) throw new DemoError('CONFLICT', '当前管理员不能删除自己');
      if (admin.role === 'SUPER_ADMIN' && admin.status === 'ACTIVE' && this.countEffectiveSuperAdmins(draft) <= 1) {
        throw new DemoError('CONFLICT', '必须保留至少一个有效超级管理员');
      }
      admin.archivedAt = context.occurredAt;
      admin.archivedBy = input.actorId ?? DEFAULT_ACTOR;
      admin.archiveReason = requireNonBlank(input.reason, '归档原因');
      admin.status = 'DISABLED';
      return { result: admin };
    });
  }

  restoreAdmin(input: RestoreEntityInput): AdminAccount {
    return this.transact('ADMIN_ACCOUNT', input.id, 'ADMIN_RESTORED', input.actorId, (draft) => {
      hasManagementPermission(draft, input.actorId, 'system.manage');
      const admin = findOrThrow(draft.admins, input.id, '管理员');
      admin.archivedAt = null;
      admin.archivedBy = null;
      admin.archiveReason = null;
      admin.status = 'DISABLED';
      return { result: admin };
    });
  }

  getStarAccount(userId: string): StarAccount {
    return structuredClone(findStarAccountOrThrow(this.state.starAccounts, userId));
  }

  listStarLedger(userId?: string): readonly StarLedgerEntry[] {
    const entries = userId === undefined ? this.state.starLedger : this.state.starLedger.filter((entry) => entry.userId === userId);
    return structuredClone([...entries].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)));
  }

listAuditEvents(limit?: number): readonly AuditEvent[] {
    const events = [...this.state.auditEvents].sort((left, right) => right.sequence - left.sequence);
    if (limit === undefined) {
      return structuredClone(events);
    }
    requireIntegerInRange(limit, '审计条数', 0, 10_000);
    return structuredClone(events.slice(0, limit));
  }

  recordLoginAttempt(input: RecordLoginAttemptInput): AuditEvent {
    return this.appendAuditEvent({
      aggregateType: 'ADMIN_SESSION',
      aggregateId: input.accountId,
      action: input.status === 'SUCCESS' ? 'ADMIN_LOGIN_SUCCEEDED' : 'ADMIN_LOGIN_FAILED',
      actorId: input.accountId,
      payload: {
        displayName: input.displayName,
        role: input.role,
        loginMethod: input.loginMethod,
        source: input.source,
        status: input.status,
        failureReason: input.failureReason ?? null,
      },
    });
  }

  recordRoleSwitch(input: RecordRoleSwitchInput): AuditEvent {
    const actorId = requireAdminActorId(input.actorId);
    hasManagementPermission(this.state, actorId, 'mock.control');
    const actor = findOrThrow(this.state.admins, actorId, '管理员');
    if (actor.role !== input.fromRole) {
      throw new DemoError('CONFLICT', '角色切换来源角色必须与当前有效管理员身份一致', {
        actorId,
        expectedRole: actor.role,
        actualRole: input.fromRole,
      });
    }
    return this.appendAuditEvent({
      aggregateType: 'ADMIN_SESSION',
      aggregateId: actorId,
      action: 'ADMIN_ROLE_SWITCHED',
      actorId,
      payload: { fromRole: input.fromRole, toRole: input.toRole },
    });
  }

  recordMockControl(action: 'MOCK_BEHAVIOR_CONFIGURED' | 'MOCK_CLOCK_ADVANCED', actorId: string, payload: Readonly<Record<string, unknown>>): AuditEvent {
    const resolvedActorId = requireAdminActorId(actorId);
    hasManagementPermission(this.state, resolvedActorId, 'mock.control');
    return this.appendAuditEvent({
      aggregateType: 'DEMO_RUNTIME',
      aggregateId: this.state.meta.scenarioName,
      action,
      actorId: resolvedActorId,
      payload,
    });
  }

  advanceClock(amountMs: number, actorId: string): DemoRuntimeInfo {
    const resolvedActorId = requireAdminActorId(actorId);
    hasManagementPermission(this.state, resolvedActorId, 'mock.control');
    requireIntegerInRange(amountMs, '演示时间推进量', 1, 31 * 24 * 60 * 60 * 1000);
    const draft = structuredClone(this.state);
    advanceDemoClock(draft.meta, amountMs);
    this.state = draft;
    this.persistence.save(draft);
    this.recordMockControl('MOCK_CLOCK_ADVANCED', resolvedActorId, { amountMs, now: draft.meta.currentTime });
    return this.getInfo();
  }

  getCurrentBusinessRules(): BusinessRuleConfigVersion {
    const current = [...this.state.businessRuleVersions].sort((left, right) => right.version - left.version)[0];
    if (current === undefined) {
      throw new DemoError('CONFLICT', '经营规则版本不存在');
    }
    return structuredClone(current);
  }

  listBusinessRuleVersions(): readonly BusinessRuleConfigVersion[] {
    return structuredClone(
      [...this.state.businessRuleVersions].sort((left, right) => right.version - left.version),
    );
  }

  saveBusinessRules(input: SaveBusinessRuleConfigInput): BusinessRuleConfigVersion {
    return this.transact('BUSINESS_RULES', 'pending', 'BUSINESS_RULES_VERSION_CREATED', input.actorId, (draft, context) => {
      const nextVersion = Math.max(0, ...draft.businessRuleVersions.map((version) => version.version)) + 1;
      const version: BusinessRuleConfigVersion = {
        id: context.nextId('business_rules'),
        version: nextVersion,
        payScoreDepositFreeEnabled: input.payScoreDepositFreeEnabled,
        payScoreDepositFreeThreshold: input.payScoreDepositFreeThreshold,
        contractUnitPriceFen: input.contractUnitPriceFen,
        publishingQuotaUnitPriceFen: input.publishingQuotaUnitPriceFen,
        minimumHourlyRentalHours: input.minimumHourlyRentalHours,
        minimumDailyRentalDays: input.minimumDailyRentalDays,
        createdAt: context.occurredAt,
        createdBy: input.actorId ?? DEFAULT_ACTOR,
      };
      assertBusinessRuleValues(version);
      draft.businessRuleVersions.push(version);
      return {
        result: version,
        payload: { rulesVersionId: version.id, version: version.version, assetTermsRemainIndependent: true },
      };
    });
  }

  getCurrentLoyaltyConfig(): LoyaltyConfigVersion {
    const current = [...this.state.loyaltyConfigVersions].sort((left, right) => right.version - left.version)[0];
    if (current === undefined) throw new DemoError('CONFLICT', '忠诚度规则版本不存在');
    return structuredClone(current);
  }

  listLoyaltyConfigVersions(): readonly LoyaltyConfigVersion[] {
    return structuredClone([...this.state.loyaltyConfigVersions].sort((left, right) => right.version - left.version));
  }

  saveLoyaltyConfig(input: SaveLoyaltyConfigInput): LoyaltyConfigVersion {
    return this.transact('LOYALTY_RULES', 'pending', 'LOYALTY_RULES_VERSION_CREATED', input.actorId, (draft, context) => {
      const levels: BusinessRuleLevel[] = input.levels.map((level) => ({
        id: level.id === undefined || level.id.trim() === '' ? context.nextId('loyalty_level') : level.id.trim(),
        name: requireNonBlank(level.name, '等级名称'),
        requiredStarTenths: level.requiredStarTenths,
      }));
      const streakRewards = [...input.streakRewards]
        .sort((left, right) => left.consecutiveDays - right.consecutiveDays)
        .map((reward) => ({
        id: context.nextId('loyalty_streak'),
        consecutiveDays: reward.consecutiveDays,
        bonusStarTenths: reward.bonusStarTenths,
        }));
      const version: LoyaltyConfigVersion = {
        id: context.nextId('loyalty_rules'),
        version: Math.max(0, ...draft.loyaltyConfigVersions.map((entry) => entry.version)) + 1,
        consumptionStarTenthsPerYuan: input.consumptionStarTenthsPerYuan,
        levels,
        dailySignInRewardStarTenths: input.dailySignInRewardStarTenths,
        streakRewards,
        timezone: 'Asia/Shanghai',
        createdAt: context.occurredAt,
        createdBy: input.actorId ?? DEFAULT_ACTOR,
      };
      assertLoyaltyConfigValues(version);
      draft.loyaltyConfigVersions.push(version);
      return { result: version, payload: { loyaltyVersionId: version.id, version: version.version } };
    });
  }

  private queryContractPurchaseProviderFact(
    input: QueryContractPurchaseOrderInput,
    operation: 'PAYMENT' | 'REFUND',
  ): ContractPurchaseOrderProjection {
    const actorId = requireAdminActorId(input.actorId);
    const idempotencyKey = requireNonBlank(input.idempotencyKey, '查询幂等键');
    findOrThrow(this.state.contractPurchaseOrders, input.orderId, '电子合同服务购买订单');
    const prior = this.state.auditEvents.find((event) => event.payload.idempotencyKey === idempotencyKey);
    if (prior !== undefined) {
      if (
        prior.aggregateId !== input.orderId
        || prior.payload.operation !== operation
        || prior.payload.expectedVersion !== input.expectedVersion
      ) {
        throw new DemoError('CONFLICT', '同一查询幂等键不得改写查询对象或类型', { idempotencyKey });
      }
      hasManagementPermission(this.state, actorId, 'finance.manage');
      const replaySnapshot = prior.payload.resultOrder;
      if (typeof replaySnapshot !== 'object' || replaySnapshot === null) {
        throw new DemoError('CONFLICT', '购买订单查询幂等回放缺少原响应快照', { idempotencyKey });
      }
      const replayOrder = structuredClone(replaySnapshot) as ContractPurchaseOrder;
      if (replayOrder.id !== input.orderId || replayOrder.version !== prior.payload.orderVersion) {
        throw new DemoError('CONFLICT', '购买订单查询幂等回放快照与原意图不一致', { idempotencyKey });
      }
      return structuredClone(projectContractPurchaseOrder(replayOrder));
    }
    return this.transact(
      'CONTRACT_PURCHASE_ORDER',
      input.orderId,
      operation === 'PAYMENT' ? 'CONTRACT_PAYMENT_QUERIED' : 'CONTRACT_REFUND_QUERIED',
      actorId,
      (draft, context) => {
        hasManagementPermission(draft, actorId, 'finance.manage');
        const order = findOrThrow(draft.contractPurchaseOrders, input.orderId, '电子合同服务购买订单');
        requireIntegerInRange(input.expectedVersion, 'expectedVersion', 1, Number.MAX_SAFE_INTEGER);
        if (order.version !== input.expectedVersion) {
          throw new DemoError('CONFLICT', '购买订单版本已变化，请刷新后再查询', { expectedVersion: input.expectedVersion, actualVersion: order.version });
        }
        const actionCode = operation === 'PAYMENT' ? 'QUERY_PAYMENT' : 'QUERY_REFUND';
        if (!projectContractPurchaseOrder(order).allowedActions.some((action) => action.code === actionCode)) {
          throw new DemoError('INVALID_TRANSITION', '当前支付或退款轴不允许查询原单', { orderId: order.id, operation });
        }
        const fact = operation === 'PAYMENT' ? order.payment : order.refund;
        if (fact === null) throw new DemoError('CONFLICT', '购买订单缺少可查询的原单事实', { orderId: order.id, operation });
        fact.lastQueriedAt = context.occurredAt;
        fact.resultSource = 'QUERY';
        fact.updatedAt = context.occurredAt;
        fact.providerStatus = this.queryOriginalProviderStatus(order.id, fact);

        if (fact.providerStatus === 'SUCCESS') {
          fact.status = 'SUCCEEDED';
          fact.errorCode = null;
          if (operation === 'PAYMENT') {
            fact.transactionId ??= `WXTX-${order.id}`;
            if (order.entitlement.status === 'NOT_GRANTED' || order.entitlement.status === 'GRANT_PENDING') {
              if (draft.contractCreditLedger.some((entry) => entry.purchaseOrderId === order.id && entry.type === 'GRANT')) {
                throw new DemoError('CONFLICT', '支付成功权益授予账本已存在但订单快照未收敛', { orderId: order.id });
              }
              this.appendContractCreditLedger(draft, context, order, 'GRANT', order.subject.quantity, `${order.id}:GRANT`);
              order.entitlement.status = 'GRANTED';
              order.entitlement.grantedAt = context.occurredAt;
              order.lifecycleStatus = 'COMPLETED';
            }
          } else {
            if (order.entitlement.status !== 'FROZEN' || order.entitlement.frozenCount < 1) {
              throw new DemoError('CONFLICT', '退款成功前权益必须已冻结且不得直接跳过回退', { orderId: order.id });
            }
            fact.transactionId ??= order.payment.transactionId;
            fact.refundId ??= `WXRF-REFUND-${order.id}`;
            this.appendContractCreditLedger(
              draft,
              context,
              order,
              'REVERSE',
              order.entitlement.frozenCount,
              `${order.id}:REVERSE`,
            );
            order.entitlement.status = 'REVERSED';
            order.lifecycleStatus = 'CLOSED';
            order.closedAt = context.occurredAt;
          }
        } else if (['PAYERROR', 'REFUNDCLOSED', 'FAILED'].includes(fact.providerStatus)) {
          fact.status = 'FAILED';
          fact.errorCode ??= operation === 'PAYMENT' ? 'MOCK_PAYERROR' : 'MOCK_REFUND_CLOSED';
          if (operation === 'REFUND' && order.entitlement.status === 'FROZEN') {
            const frozenQuantity = order.entitlement.frozenCount;
            if (frozenQuantity < 1) throw new DemoError('CONFLICT', '退款失败释放前缺少冻结权益余额', { orderId: order.id });
            this.appendContractCreditLedger(
              draft,
              context,
              order,
              'RELEASE',
              frozenQuantity,
              `${order.id}:RELEASE_REFUND_FREEZE`,
            );
            order.entitlement.status = 'GRANTED';
          }
          order.lifecycleStatus = 'EXCEPTION';
        } else if (operation === 'PAYMENT' && fact.providerStatus === 'NOTPAY') {
          fact.status = 'PENDING';
          fact.timeExpire ??= new Date(Date.parse(fact.createdAt) + 30 * 60 * 1_000).toISOString();
        } else if (['PENDING', 'PROCESSING', 'CONFIRMING', 'UNKNOWN'].includes(fact.providerStatus)) {
          fact.status = fact.providerStatus as 'PENDING' | 'PROCESSING' | 'CONFIRMING' | 'UNKNOWN';
        }
        // Only the explicit read-side query may apply its controlled Mock Provider result; no payment/refund retry occurs.
        order.entitlement.updatedAt = context.occurredAt;
        order.updatedAt = context.occurredAt;
        order.version += 1;
        return {
          result: projectContractPurchaseOrder(order),
          payload: {
            operation,
            idempotencyKey,
            expectedVersion: input.expectedVersion,
            providerStatus: fact.providerStatus,
            resultStatus: fact.status,
            orderVersion: order.version,
            resultOrder: structuredClone(order),
          },
        };
      },
    );
  }

  private appendContractCreditLedger(
    draft: MockState,
    context: TransactionContext,
    order: ContractPurchaseOrder,
    type: ContractCreditLedgerEntry['type'],
    quantity: number,
    idempotencyKey: string,
    
  ): ContractCreditLedgerEntry {
    requireIntegerInRange(quantity, '权益数量', 1, Number.MAX_SAFE_INTEGER);
    if (draft.contractCreditLedger.some((entry) => entry.idempotencyKey === idempotencyKey)) {
      throw new DemoError('CONFLICT', '电子合同权益账本幂等键不得重复', { idempotencyKey });
    }
    if (type === 'GRANT') { order.entitlement.grantedCount += quantity; order.entitlement.availableCount += quantity; }

if (type === 'RELEASE') { if (order.entitlement.frozenCount < quantity) throw new DemoError('CONFLICT', '冻结电子合同权益不足，不能释放退款冻结', { orderId: order.id }); order.entitlement.frozenCount -= quantity; order.entitlement.availableCount += quantity; }
    if (type === 'FREEZE') {
      if (order.entitlement.availableCount < quantity) throw new DemoError('CONFLICT', '可用电子合同权益不足，不能冻结', { orderId: order.id });
      order.entitlement.availableCount -= quantity; order.entitlement.frozenCount += quantity;
    }
    if (type === 'REVERSE') {
      if (order.entitlement.frozenCount < quantity) throw new DemoError('CONFLICT', '冻结权益不足，不能回退', { orderId: order.id });
      order.entitlement.frozenCount -= quantity; order.entitlement.reversedCount += quantity;
    }
    order.entitlement.updatedAt = context.occurredAt;
    const entry: ContractCreditLedgerEntry = {
      id: context.nextId('contract_credit_ledger'),
      lessorId: order.buyerSnapshot.lessorId,
      purchaseOrderId: order.id,

type,
      quantity,
      idempotencyKey,
      balanceAfter: {
        availableCount: order.entitlement.availableCount,
        reservedCount: order.entitlement.reservedCount,
        consumedCount: order.entitlement.consumedCount,
        frozenCount: order.entitlement.frozenCount,
        reversedCount: order.entitlement.reversedCount,
      },
      occurredAt: context.occurredAt,
      note: ({
        GRANT: '微信支付 Mock 原单确认成功，权益仅授予一次',

RELEASE: '微信退款明确失败后释放冻结权益',
        FREEZE: '全额退款前冻结全部未使用权益',
        REVERSE: '微信退款 Mock 原单确认成功，冻结权益完成回退',
      } satisfies Record<ContractCreditLedgerEntry['type'], string>)[type],
    };
    draft.contractCreditLedger.push(entry);
    return entry;
  }

  private transact<T>(
    aggregateType: string,
    aggregateId: string,
    action: string,
    actorId: string | undefined,
    mutation: (draft: MockState, context: TransactionContext) => TransactionResult<T>,
  ): T {
    const draft = structuredClone(this.state);
    advanceClockPastAggregateFacts(draft, aggregateType, aggregateId);
    const occurredAt = nextDemoTimestamp(draft.meta);
    const context: TransactionContext = {
      occurredAt,
      nextId: (namespace) => nextDemoId(draft.meta, namespace),
    };
    const transaction = mutation(draft, context);
    const resolvedAggregateId = aggregateId === 'pending' && 'id' in Object(transaction.result as object)
      ? String((transaction.result as { id: unknown }).id)
      : aggregateId;
    const event: AuditEvent = {
      id: context.nextId('audit'),
      sequence: draft.auditEvents.length + 1,
      aggregateType,
      aggregateId: resolvedAggregateId,
      action,
      actorId: actorId ?? DEFAULT_ACTOR,
      occurredAt,
      payload: transaction.payload ?? {},
    };
    draft.auditEvents.push(event);
    draft.meta.revision += 1;
    assertMockInvariants(draft);
    this.state = draft;
    this.persistence.save(draft);
    this.notify();
    return structuredClone(transaction.result);
  }

  private appendAuditEvent(input: Omit<AuditEvent, 'id' | 'sequence' | 'occurredAt'>): AuditEvent {
    const draft = structuredClone(this.state);
    const event: AuditEvent = {
      ...input,
      id: nextDemoId(draft.meta, 'audit'),
      sequence: draft.auditEvents.length + 1,
      occurredAt: nextDemoTimestamp(draft.meta),
    };
    draft.auditEvents.push(event);
    draft.meta.revision += 1;
    assertMockInvariants(draft);
    this.state = draft;
    this.persistence.save(draft);
    this.notify();
    return structuredClone(event);
  }

private countEffectiveSuperAdmins(state: MockState): number {
    return state.admins.filter((admin) => admin.role === 'SUPER_ADMIN' && admin.status === 'ACTIVE' && admin.archivedAt === null).length;
  }

private assertCabinetCanDeactivate(state: MockState, cabinet: Cabinet): void {
    const boxes = state.boxes.filter((box) => box.cabinetRecordId === cabinet.id);
    const hasBlockedBox = boxes.some((box) => box.assetId !== null || box.businessStatus !== 'AVAILABLE');
    
    const hasUnknownCommand = state.commands.some((command) => command.cabinetRecordId === cabinet.id && command.status === 'UNKNOWN');
    if (hasBlockedBox || hasUnknownCommand) {
      throw new DemoError('CONFLICT', '柜机仍有在柜资产、非空格口或未知命令，不能禁用或归档', {
        cabinetRecordId: cabinet.id,
        hasBlockedBox,
        
        hasUnknownCommand,
      });
    }
  }

private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createDemoRuntime(options: DemoRuntimeOptions = {}): DemoRuntime {
  return new DemoRuntime(options);
}
