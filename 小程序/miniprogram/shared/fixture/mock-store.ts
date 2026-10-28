import { demoStorage } from '../../preview/storage';
import type { RentalOrder, OrderAction, OrderActionPayload, OrderActor } from './order-machine';
import { DEFAULT_MOCK_DIAMOND_BALANCE } from './diamond';

export const MOCK_NAMESPACE = 'xingyu:rental:1.0.0.11';
export const MOCK_SCHEMA_VERSION = '1.0.0.11';
export const ORDER_EXPERIENCE_REVISION = '2026-09-01-c2c-after-sales-submission-1';
export const PREVIOUS_MOCK_NAMESPACE = 'xingyu:rental:1.0.0.10';
const PREVIOUS_1_0_0_9_NAMESPACE = 'xingyu:rental:1.0.0.9';
const PREVIOUS_1_0_0_8_NAMESPACE = 'xingyu:rental:1.0.0.8';
export const LEGACY_MOCK_NAMESPACE = 'xingyu:mock:1.0.0.7';
const OLDEST_LEGACY_NAMESPACE = 'xingyu:mock:1.0.0.6';
const OLDER_LEGACY_NAMESPACE = 'xingyu:mock:1.0.0.5';

export interface MockAccount { id: string; name: string; description: string; }
export interface MockLocalProfile { accountId: string; name: string; avatarPath: string; phone: string; }
export interface MockIdentityProfile { status: 'unverified' | 'documents_submitted' | 'verified'; name: string; idNumber: string; submittedAt: string | null; verifiedAt: string | null; }
export interface MockAddress {
  id: string; userId: string; name: string; phone: string; region: string; detail: string;
  isDefault: boolean; createdAt: string; updatedAt: string;
}
export type MockListingStatus = 'draft' | 'reviewing' | 'pricing' | 'listed' | 'unlisted' | 'rejected';
export interface MockListingPriceGuidance {
  rentMinFen: number;
  rentMaxFen: number;
  depositMinFen: number;
  depositMaxFen: number;
}
export interface MockListing {
  id: string; lessorUserId: string; name: string; category: string; brand: string; model: string; condition: string;
  notes: string; accessories: string; description: string; location: string; deliveryMethods: string[];
  photoRefs: string[]; proofRefs: string[]; priceFen: number | null; depositFen: number | null;
  expectedRentFen?: number | null; expectedDepositFen?: number | null; priceGuidance?: MockListingPriceGuidance;
  status: MockListingStatus; createdAt: string; updatedAt: string;
  serialNumber?: string; availabilityStart?: string; availabilityEnd?: string;
  deliveryRules?: Record<string, string>; deliveryAddresses?: Record<string, string>; runnerContact?: string; runnerPhone?: string; runnerService?: string;
  meetingAddress?: string; meetingTime?: string; rejectReason?: string;
}
export type MockListingDraftRecord = Partial<MockListing> & {
  id: string;
  lessorUserId: string;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
  expectedRentYuan?: number;
  expectedDepositYuan?: number;
};
export interface MockDraftState {
  deviceId: string; days: number; startDate: string; endDate: string; delivery: string; depositPlan: string; guard: boolean; region: string;
  recipientName: string; recipientPhone: string; recipientAddress: string; pickupCabinetId: string; useDiamonds?: boolean;
  rentalMode?: 'hourly' | 'daily'; rentalVoucherId?: string; insuranceVoucherId?: string; guardVoucherId?: string; insurance?: boolean;
  idempotencyKey: string;
}
export interface ResourceReservation {
  id: string; orderId: string; assetId: string; cabinetSlotId: string | null;
  startAt: string; endAt: string; expiresAt: string | null;
  state: 'held' | 'occupied' | 'confirming' | 'released'; updatedAt: string;
}
export interface CabinetSlotState {
  id: string; cabinetId: string; index: number; size: 'small' | 'medium' | 'large';
  compatibleCategories: string[]; state: 'available' | 'reserved' | 'occupied' | 'unavailable'; assetId: string | null; orderId: string | null; deviceId?: string;
}
export interface RentalVoucher {
  id: string; ownerUserId: string; type: 'rental' | 'insurance' | 'guard' | 'express'; amountFen: number; expiresAt: string;
  coverage?: 'full_service';
  redemptionKey?: string;
  productId?: string;
  ruleVersion?: string;
  state: 'available' | 'reserved' | 'redeemed' | 'released'; orderId: string | null;
  supplyScope?: 'general' | 'cabinet'; applyAt?: 'checkout' | 'final_hourly_settlement';
  eligibleRentalModes?: Array<'hourly' | 'daily'>;
  applyAtByRentalMode?: Partial<Record<'hourly' | 'daily', 'checkout' | 'final_hourly_settlement'>>;
}
export interface SupportMessage {
  clientMessageId?: string;
  id: string; ownerUserId: string; orderId: string | null; kind: 'text' | 'image' | 'order_card' | 'progress';
  content: string; direction: 'inbound' | 'outbound' | 'system'; createdAt: string;
  conversationId?: string;
  senderUserId?: string;
  recipientUserId?: string;
}
export interface MockServiceBalance { contract: number; face: number; risk: number; }
export type MockServicePurchaseKind = 'contract' | 'face' | 'risk' | 'bundle';
export interface MockServicePurchaseRecord {
  idempotencyKey?: string;
  id: string;
  userId: string;
  kind: MockServicePurchaseKind;
  quantity: number;
  priceText: string;
  diamondCost?: number;
  ruleVersion?: string;
  createdAt: string;
}
export type MockWalletEntryState = 'pending' | 'escrow' | 'settled';
export interface MockWalletEntry {
  id: string;
  userId: string;
  listingId: string;
  orderId: string;
  listingNameSnapshot: string;
  rentFen: number;
  amountFen: number;
  state: MockWalletEntryState;
  settlementCondition: string;
  createdAt: string;
}
export type MockWithdrawalState = 'processing' | 'confirming' | 'completed' | 'failed' | 'unknown';
export interface MockWithdrawalRecord {
  id: string;
  userId: string;
  amountFen: number;
  state: MockWithdrawalState;
  idempotencyKey: string;
  accountLabel: string;
  createdAt: string;
}
export type MockMediaType = 'image' | 'video';
export type MockMediaStatus = 'saved' | 'submitted' | 'failed';
export type MockMediaRole = 'primary' | 'runner_info' | 'proposal' | 'evidence';
export interface MockMediaObject {
  id: string;
  businessObjectType: 'listing' | 'listing_evidence' | 'return' | 'dispute' | 'fulfillment';
  businessObjectId: string;
  mediaType: MockMediaType;
  localPath: string;
  createdAt: string;
  status: MockMediaStatus;
  immutable: boolean;
  mediaRole?: MockMediaRole;
  sourcePath?: string;
  failureReason?: string;
}
export type MockLedgerDirection = 'credit' | 'debit' | 'hold' | 'release';
export interface MockDiamondLedgerEntry {
  id: string;
  userId: string;
  businessKey: string;
  direction: MockLedgerDirection;
  points: number;
  note: string;
  createdAt: string;
}
export interface MockStarLedgerEntry {
  id: string;
  userId: string;
  businessKey: string;
  direction: 'credit' | 'debit';
  points: number;
  note: string;
  createdAt: string;
}
export type MockBenefitRecordKind = 'check_in' | 'growth_task';
export interface MockBenefitRecord {
  id: string;
  userId: string;
  kind: MockBenefitRecordKind;
  businessKey: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  starPoints: number;
  diamondPoints: number;
  createdAt: string;
  note: string;
  ruleVersion?: string;
}
export interface MockCashAccount {
  pendingReceivableFen: number;
  depositHeldFen: number;
  reserveFen: number;
  availableFen: number;
  frozenFen: number;
  withdrawalProcessingFen: number;
  settledFen: number;
  receivedFen: number;
}
export type MockFinancialFactKind = 'payment' | 'refund' | 'deposit_return' | 'supplement' | 'settlement' | 'withdrawal_request' | 'withdrawal_payout';
export interface MockFinancialFact {
  id: string;
  businessKey: string;
  kind: MockFinancialFactKind;
  orderId: string | null;
  userId: string;
  amountFen: number;
  source: 'order_action' | 'withdrawal_action' | 'migration';
  createdAt: string;
}
export type MockDisputeDraftMode = 'lessor_proposal' | 'tenant_objection' | 'lessor_review' | 'generic';
export interface MockDisputeDraft {
  orderId: string;
  userId: string;
  mode: MockDisputeDraftMode;
  proposalAmount: string;
  proposalNote: string;
  proposalImagePaths: string[];
  proposalVideoPaths: string[];
  description: string;
  evidencePaths: string[];
  videoPaths: string[];
  updatedAt: string;
}
export type MockTaskKind = 'listing_review' | 'wechat_waiver_confirm' | 'payment_expire' | 'payment_complete' | 'renewal_approval' | 'renewal_payment_complete' | 'cancellation_approval' | 'insurance_claim_complete' | 'approval_expire' | 'appeal_expire' | 'platform_dispatch' | 'platform_transit' | 'pickup_cabinet_open_result' | 'pickup_cabinet_detect' | 'pickup_cabinet_query' | 'return_cabinet_open_result' | 'return_cabinet_detect' | 'return_cabinet_query' | 'platform_receive' | 'platform_inspect' | 'dispute_review' | 'dispute_resolve' | 'deposit_start' | 'deposit_complete' | 'refund_start' | 'refund_complete' | 'settlement_start' | 'settlement_complete' | 'waived_close' | 'manual_recovery';
export interface MockTask { id: string; orderId: string; kind: MockTaskKind; dueAt: number; status: 'pending' | 'completed' | 'cancelled'; eventId: string; createdAt: number; processedAt?: number; attempts: number; lastError?: string; }
export interface MockActionReceipt {
  orderId: string;
  actor: string;
  action: string;
  payloadFingerprint: string;
  resultOrder: RentalOrder;
  createdAt: string;
}
export interface MockRootState {
  schema: 'xingyu-mock-state'; version: string; revision: number; initialized: boolean;
  experienceRevision?: string;
  platformSubject: { id: string; name: string }; accounts: MockAccount[]; currentAccountId: string;
  identityProfiles: Record<string, MockIdentityProfile>; verifiedPhones: Record<string, string>; addresses: MockAddress[]; orders: RentalOrder[]; listings: MockListing[]; diamondBalances: Record<string, number>; starBalances?: Record<string, number>; publishQuotas: Record<string, number>; publishQuotaTotals: Record<string, number>; serviceBalances: Record<string, MockServiceBalance>; servicePurchaseRecords: MockServicePurchaseRecord[];
  reservations: ResourceReservation[]; cabinetSlots: CabinetSlotState[]; vouchers: RentalVoucher[]; supportMessages: SupportMessage[];
  walletEntries: MockWalletEntry[]; withdrawals: MockWithdrawalRecord[]; financialFacts: MockFinancialFact[];
  listingDrafts: Record<string, MockListingDraftRecord>; returnDrafts: Record<string, Record<string, unknown>>; disputeDrafts: Record<string, MockDisputeDraft>;
  tasks: MockTask[]; processedEventIds: string[]; actionIdempotency: Record<string, MockActionReceipt>; drafts: Record<string, MockDraftState>; orderIdempotency: Record<string, string>; sequence: number; updatedAt: string;
  selectedRegion?: string;
  profileNames?: Record<string, string>;
  profileAvatars?: Record<string, string>;
  mediaObjects?: MockMediaObject[];
  diamondLedger?: MockDiamondLedgerEntry[];
  starLedger?: MockStarLedgerEntry[];
  benefitRecords?: MockBenefitRecord[];
  memberVisits?: { userId: string; day: string; kind: string; objectId: string }[];
  serviceUsage?: { userId: string; orderId: string; kind: 'contract' | 'face' | 'risk'; quantity: number; ruleVersion: string; createdAt: string }[];
  pendingServices?: { orderId: string; userId: string; kind: 'contract' | 'face' | 'risk'; quantity: number; action: OrderAction; actor: OrderActor; payload: OrderActionPayload }[];
  cashAccounts?: Record<string, MockCashAccount>;
}

export function emptyMockState(): MockRootState {
  return {
    schema: 'xingyu-mock-state', version: MOCK_SCHEMA_VERSION, revision: 0, initialized: false, experienceRevision: ORDER_EXPERIENCE_REVISION,
    platformSubject: { id: 'platform-xingyu', name: '星遇平台' },
    accounts: [
      { id: 'mock-tenant-a', name: '小星', description: '主要承租账号' },
      { id: 'mock-lessor-b', name: '小宇', description: 'C2C 个人出租账号' },
      { id: 'mock-user-c', name: '阿洛', description: '第二组演示账号' },
    ],
    currentAccountId: 'mock-tenant-a', identityProfiles: {}, verifiedPhones: { 'mock-tenant-a': '13800008888', 'mock-lessor-b': '13900006666', 'mock-user-c': '13600002222' }, addresses: [], orders: [], listings: [], diamondBalances: { 'mock-tenant-a': DEFAULT_MOCK_DIAMOND_BALANCE, 'mock-lessor-b': DEFAULT_MOCK_DIAMOND_BALANCE, 'mock-user-c': DEFAULT_MOCK_DIAMOND_BALANCE }, starBalances: { 'mock-tenant-a': 2_340, 'mock-lessor-b': 1_120, 'mock-user-c': 0 }, publishQuotas: { 'mock-tenant-a': 11, 'mock-lessor-b': 11, 'mock-user-c': 11 }, publishQuotaTotals: { 'mock-tenant-a': 12, 'mock-lessor-b': 12, 'mock-user-c': 12 }, serviceBalances: { 'mock-tenant-a': { contract: 0, face: 2, risk: 2 }, 'mock-lessor-b': { contract: 0, face: 2, risk: 2 }, 'mock-user-c': { contract: 0, face: 2, risk: 2 } }, servicePurchaseRecords: [],
    reservations: [], cabinetSlots: [], vouchers: [], supportMessages: [], walletEntries: [], withdrawals: [], financialFacts: [], listingDrafts: {}, returnDrafts: {}, disputeDrafts: {},
    tasks: [], processedEventIds: [], actionIdempotency: {}, drafts: {}, orderIdempotency: {}, sequence: 1, updatedAt: new Date().toISOString(),
    selectedRegion: '上海市徐汇区', profileNames: {}, profileAvatars: {}, mediaObjects: [], diamondLedger: [], starLedger: [], benefitRecords: [], cashAccounts: {},
  };
}

function canUseStorage(): boolean { return typeof wx !== 'undefined' && typeof demoStorage.getStorageSync === 'function' && typeof demoStorage.setStorageSync === 'function'; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
let memoryState: MockRootState | null = null;
let fallbackPersistedState: MockRootState | null = null;

function syncCashAccounts(state: MockRootState): void {
  state.cashAccounts = Object.fromEntries(state.accounts.map((account) => {
    const seededEntries = state.walletEntries
      .filter((entry) => entry.userId === account.id)
      .map((entry) => ({ orderId: entry.orderId, state: entry.state, amountFen: entry.amountFen }));
    const liveEntries = state.orders
      .filter((order) => order.kind === 'c2c' && order.lessorUserId === account.id && !order.diagnosticFixture)
      .map((order) => ({
        orderId: order.id,
        state: order.axes.settlement === 'succeeded' ? 'settled' as const : order.axes.payment === 'paid' ? 'escrow' as const : 'pending' as const,
        amountFen: order.amounts.settlementFen || order.amounts.rentFen,
      }));
    const entries = [...new Map([...seededEntries, ...liveEntries].map((entry) => [entry.orderId, entry])).values()];
    const pendingReceivableFen = entries.filter((entry) => entry.state === 'pending').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
    const frozenFen = entries.filter((entry) => entry.state === 'escrow').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
    const settledFen = entries.filter((entry) => entry.state === 'settled').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
    const withdrawalProcessingFen = state.withdrawals.filter((record) => record.userId === account.id && ['processing', 'confirming', 'unknown'].includes(record.state)).reduce((total, record) => total + Math.max(0, record.amountFen), 0);
    const withdrawnFen = state.withdrawals.filter((record) => record.userId === account.id && record.state !== 'failed').reduce((total, record) => total + Math.max(0, record.amountFen), 0);
    const depositHeldFen = state.orders.filter((order) => order.tenantUserId === account.id && ['held', 'frozen', 'deducted', 'partially_deducted'].includes(order.axes.deposit)).reduce((total, order) => total + Math.max(0, order.amounts.depositFen), 0);
    const cash: MockCashAccount = {
      pendingReceivableFen,
      depositHeldFen,
      reserveFen: 0,
      availableFen: Math.max(0, settledFen - withdrawnFen),
      frozenFen,
      withdrawalProcessingFen,
      settledFen,
      receivedFen: settledFen,
    };
    return [account.id, cash];
  }));
}

function isCompatibleState(value: unknown): value is MockRootState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MockRootState>;
  return candidate.schema === 'xingyu-mock-state' && ['1.0.0.5', '1.0.0.6', '1.0.0.7', '1.0.0.8', '1.0.0.9', '1.0.0.10', MOCK_SCHEMA_VERSION].includes(candidate.version ?? '') && Array.isArray(candidate.orders) && Array.isArray(candidate.tasks);
}

function migrateState(value: MockRootState): MockRootState {
  const migrated = clone(value);
  const sourceVersion = migrated.version;
  migrated.version = MOCK_SCHEMA_VERSION;
  migrated.revision = Number.isSafeInteger(migrated.revision) && migrated.revision >= 0 ? migrated.revision : 0;
  migrated.drafts = migrated.drafts ?? {};
  migrated.selectedRegion = migrated.selectedRegion ?? '上海市徐汇区';
  migrated.profileNames = migrated.profileNames && typeof migrated.profileNames === 'object' ? migrated.profileNames : {};
  migrated.profileAvatars = migrated.profileAvatars && typeof migrated.profileAvatars === 'object' ? migrated.profileAvatars : {};
  migrated.mediaObjects = Array.isArray(migrated.mediaObjects) ? migrated.mediaObjects : [];
  migrated.diamondLedger = Array.isArray(migrated.diamondLedger) ? migrated.diamondLedger : [];
  migrated.starLedger = Array.isArray(migrated.starLedger) ? migrated.starLedger : [];
  migrated.benefitRecords = Array.isArray(migrated.benefitRecords) ? migrated.benefitRecords : [];
  migrated.cashAccounts = migrated.cashAccounts && typeof migrated.cashAccounts === 'object' ? migrated.cashAccounts : {};
  migrated.processedEventIds = migrated.processedEventIds ?? [];
  migrated.verifiedPhones = migrated.verifiedPhones ?? {};
  migrated.diamondBalances = migrated.diamondBalances ?? Object.fromEntries(migrated.accounts.map((account) => [account.id, DEFAULT_MOCK_DIAMOND_BALANCE]));
  migrated.starBalances = migrated.starBalances ?? Object.fromEntries(migrated.accounts.map((account) => [account.id, account.id === 'mock-tenant-a' ? 2_340 : 0]));
  for (const account of migrated.accounts) {
    if (migrated.diamondBalances[account.id] === undefined) migrated.diamondBalances[account.id] = DEFAULT_MOCK_DIAMOND_BALANCE;
    if (migrated.starBalances[account.id] === undefined) migrated.starBalances[account.id] = 0;
  }
  migrated.reservations = migrated.reservations ?? [];
  migrated.cabinetSlots = migrated.cabinetSlots ?? [];
  migrated.vouchers = migrated.vouchers ?? [];
  migrated.supportMessages = migrated.supportMessages ?? [];
  migrated.publishQuotas = migrated.publishQuotas ?? {};
  migrated.publishQuotaTotals = migrated.publishQuotaTotals ?? {};
  migrated.serviceBalances = migrated.serviceBalances ?? {};
  migrated.servicePurchaseRecords = migrated.servicePurchaseRecords ?? [];
  migrated.walletEntries = migrated.walletEntries ?? [];
  migrated.withdrawals = (migrated.withdrawals ?? []).map((record) => ({ ...record, idempotencyKey: record.idempotencyKey ?? `migration:${record.id}` }));
  migrated.financialFacts = migrated.financialFacts ?? [];
  const diamondLedgerKeys = new Set(migrated.diamondLedger.map((entry) => entry.businessKey));
  const starLedgerKeys = new Set(migrated.starLedger.map((entry) => entry.businessKey));
  for (const account of migrated.accounts) {
    const diamondBusinessKey = `migration:${sourceVersion}:${account.id}:diamond-snapshot`;
    if (!diamondLedgerKeys.has(diamondBusinessKey)) {
      migrated.diamondLedger.push({
        id: `diamond-migration-${sourceVersion}-${account.id}`,
        userId: account.id,
        businessKey: diamondBusinessKey,
        direction: 'credit',
        points: Math.max(0, Math.floor(migrated.diamondBalances[account.id] ?? DEFAULT_MOCK_DIAMOND_BALANCE)),
        note: `从${sourceVersion}保留的粉钻余额`,
        createdAt: migrated.updatedAt,
      });
      diamondLedgerKeys.add(diamondBusinessKey);
    }
    const starBusinessKey = `migration:${sourceVersion}:${account.id}:star-snapshot`;
    if (!starLedgerKeys.has(starBusinessKey)) {
      migrated.starLedger.push({
        id: `star-migration-${sourceVersion}-${account.id}`,
        userId: account.id,
        businessKey: starBusinessKey,
        direction: 'credit',
        points: Math.max(0, Math.floor(migrated.starBalances[account.id] ?? 0)),
        note: `从${sourceVersion}保留的星光余额`,
        createdAt: migrated.updatedAt,
      });
      starLedgerKeys.add(starBusinessKey);
    }
  }
  for (const account of migrated.accounts) {
    if (migrated.publishQuotas[account.id] === undefined) migrated.publishQuotas[account.id] = 11;
    if (migrated.publishQuotaTotals[account.id] === undefined) migrated.publishQuotaTotals[account.id] = migrated.publishQuotas[account.id]! + 1;
    if (!migrated.serviceBalances[account.id]) migrated.serviceBalances[account.id] = { contract: 0, face: 2, risk: 2 };
  }
  migrated.listingDrafts = migrated.listingDrafts ?? {};
  // Existing paths are deterministic local evidence. Registering them as
  // objects preserves the old fact without inventing a remote asset id.
  const mediaObjects = migrated.mediaObjects ?? [];
  migrated.mediaObjects = mediaObjects;
  const mediaKeys = new Set(mediaObjects.map((item) => `${item.businessObjectType}:${item.businessObjectId}:${item.mediaType}:${item.localPath}`));
  const appendLegacyMedia = (businessObjectType: MockMediaObject['businessObjectType'], businessObjectId: string, localPath: string, mediaType: MockMediaType, immutable: boolean, createdAt: string): void => {
    const normalizedPath = String(localPath ?? '').trim();
    if (!normalizedPath) return;
    const key = `${businessObjectType}:${businessObjectId}:${mediaType}:${normalizedPath}`;
    if (mediaKeys.has(key)) return;
    mediaObjects.push({
      id: `media-migration-${businessObjectId}-${mediaObjects.length + 1}`,
      businessObjectType,
      businessObjectId,
      mediaType,
      localPath: normalizedPath,
      sourcePath: normalizedPath,
      createdAt,
      status: immutable ? 'submitted' : 'saved',
      immutable,
    });
    mediaKeys.add(key);
  };
  for (const listing of migrated.listings) {
    for (const path of listing.photoRefs ?? []) appendLegacyMedia('listing', listing.id, path, 'image', false, listing.createdAt);
    for (const path of listing.proofRefs ?? []) appendLegacyMedia('listing_evidence', listing.id, path, 'image', listing.status !== 'draft', listing.createdAt);
  }
  syncCashAccounts(migrated);
  migrated.sequence = migrated.sequence ?? 1;
  return migrated;
}

export function readMockState(): MockRootState {
  if (memoryState) return clone(memoryState);
  if (canUseStorage()) {
    const storageKeys = [MOCK_NAMESPACE, PREVIOUS_MOCK_NAMESPACE, PREVIOUS_1_0_0_9_NAMESPACE, PREVIOUS_1_0_0_8_NAMESPACE, LEGACY_MOCK_NAMESPACE, OLDEST_LEGACY_NAMESPACE, OLDER_LEGACY_NAMESPACE];
    for (const storageKey of storageKeys) {
      const stored = demoStorage.getStorageSync<unknown>(storageKey);
      if (!isCompatibleState(stored)) continue;
      memoryState = migrateState(stored);
      fallbackPersistedState = clone(memoryState);
      if (storageKey !== MOCK_NAMESPACE || stored.version !== MOCK_SCHEMA_VERSION) demoStorage.setStorageSync(MOCK_NAMESPACE, memoryState);
      return clone(memoryState);
    }
  }
  if (fallbackPersistedState) { memoryState = migrateState(fallbackPersistedState); return clone(memoryState); }
  memoryState = emptyMockState();
  return clone(memoryState);
}

export function writeMockState(state: MockRootState, expectedRevision?: number): MockRootState {
  const currentRevision = memoryState?.revision ?? fallbackPersistedState?.revision ?? state.revision ?? 0;
  if (expectedRevision !== undefined && currentRevision !== expectedRevision) throw new Error('STALE_MOCK_STATE');
  const next = clone(state);
  next.version = MOCK_SCHEMA_VERSION;
  next.revision = currentRevision + 1;
  next.updatedAt = new Date().toISOString();
  syncCashAccounts(next);
  memoryState = clone(next);
  fallbackPersistedState = clone(memoryState);
  if (canUseStorage()) demoStorage.setStorageSync(MOCK_NAMESPACE, memoryState);
  return clone(memoryState);
}

export function clearLegacyMockStorage(): void {
  if (!canUseStorage()) return;
  for (const key of ['xingyu:user-orders:v1', 'xingyu:account-identity:v1', 'orderDetailActor', 'disputeActor', 'ordersRole']) demoStorage.removeStorageSync(key);
}

export function simulateMockProcessRestartForTest(): void { memoryState = null; }
