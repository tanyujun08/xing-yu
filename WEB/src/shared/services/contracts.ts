import type { ProductVersion } from '../demo/demoManifest';
import type { DemoRole } from '../access/session';
import type { components } from '../api/generated/schema';
import type { CabinetManagementGateway } from './cabinetManagement';
import type { BusinessConfigurationGateway } from './businessConfiguration';
import type { RentalOrdersGateway } from './rentalOrders';
import type { LoyaltyManagementGateway } from './loyaltyManagement';

export type DemoScenarioName = 'normal' | 'cabinet-offline' | 'exceptions';

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type DoorStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN' | 'UNSUPPORTED';
export type SensorStatus = 'OCCUPIED' | 'EMPTY' | 'UNKNOWN';
export type BoxBusinessStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'FROZEN';
export type CommandOutcome = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
export type AddressConfirmationStatus = 'TENCENT_CONFIRMED' | 'MANUAL_DEMO' | 'LEGACY_UNVERIFIED';
export type RentalType = 'DAY' | 'HOUR';

export interface ServiceRequestContext {
  signal?: AbortSignal;
}

export interface CommandMetadata {
  /** Stable for one user intent and reused when that intent is retried. */
  intentId: string;
  idempotencyKey: string;
  expectedVersion?: string;
}

export interface ArchiveMetadata {
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
}

export interface DashboardSummary {
  merchantCount: number;
  operatingAddressCount: number;
  cabinetTotal: number;
  cabinetOnline: number;
  cabinetOffline: number;
  cabinetUnknown: number;
  boxTotal: number;
  boxAvailable: number;
  boxOccupied: number;
  assetTotal: number;
  assetInCabinet: number;
  

openAlertCount: number;
}

export interface Merchant extends ArchiveMetadata {
  photoMaterialIds?: readonly string[];
  coverMaterialId?: string | null;
  cabinetCount?: string;
  
  phoneDial?: string;
  responsibleLessorId?: string;
  version?: string;
  businessHours?: components['schemas']['BusinessHours'] | null;
  allowedActions?: components['schemas']['MerchantView']['allowed_actions'];
  id: string;
  name: string;
  status: RecordStatus;
  shareBps: number;
  settlementCycle: 'MONTHLY';
  settlementAccount: string;
  contactName: string;
  operatingAddress: OperatingAddress;
  createdAt: string;
  updatedAt: string;
}

export interface OperatingAddress {
  datasetId?: string;
  provinceId?: string;
  cityId?: string;
  districtId?: string;
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  province: string;
  city: string;
  district: string;
  poiName: string | null;
  detailAddress: string;
  fullAddress: string;
  longitude: number;
  latitude: number;
  confirmationStatus: AddressConfirmationStatus;
}

export interface CabinetCapabilities {
  doorFeedback: boolean;
  articleDetection: boolean;
}

export interface Cabinet extends ArchiveMetadata {
  id: string;
  cabinetId: string;
  merchantId: string;
  merchantSnapshot: { id: string; name: string };
  deploymentAddressSnapshot: OperatingAddress;
  name: string;
  description: string;
  boxCount: number;
  status: RecordStatus;
  connectivity: ConnectivityStatus;
  capabilities: CabinetCapabilities;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetBox {
  id: string;
  cabinetRecordId: string;
  boxNo: number;
  doorStatus: DoorStatus;
  sensorStatus: SensorStatus;
  businessStatus: BoxBusinessStatus;
  assetId: string | null;
  lastCommandId: string | null;
  updatedAt: string;
}

export type CabinetBoxEventType = 'STORE' | 'TAKE_OUT';

export interface CabinetBoxEventDeviceSnapshot {
  assetId: string;
  assetNo: string;
  productId: string;
  productName: string;
  assetDisplayName: string;
  model: string;
  identifierDisplay: string;
}

export interface CabinetBoxEventActorSnapshot {
  actorId: string;
  displayName: string;
}

export interface CabinetBoxEvent {
  id: string;
  cabinetRecordId: string;
  boxId: string;
  boxNo: number;
  type: CabinetBoxEventType;
  result: CommandOutcome;
  deviceSnapshot: CabinetBoxEventDeviceSnapshot;
  orderNo: string | null;
  actorSnapshot: CabinetBoxEventActorSnapshot;
  occurredAt: string;
}

export type StandardProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export interface ProductActionDecision {
  code: 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE';
  enabled: boolean;
  blocked_reasons: readonly { code: string; message: string }[];
}
export type LessorKind = 'PLATFORM' | 'MERCHANT' | 'PERSONAL';
export type SupplyMode = 'OFFICIAL' | 'C2C';
export type AssetIdentifierType = 'IMEI' | 'MANUFACTURER_SERIAL' | 'PLATFORM_TAG';
export type AssetReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AssetPublishStatus = 'DRAFT' | 'ONLINE' | 'OFFLINE';
export type AssetAvailabilityStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTING'
  | 'RETURN_PENDING'
  | 'MAINTENANCE'
  | 'FROZEN'
  | 'RETIRED';
export type CabinetPresence = 'IN_CABINET' | 'OUT_OF_CABINET' | 'NOT_APPLICABLE';

export interface StandardProduct {
  id: string;
  productNo: string;
  brandId: string;
  categoryId?: string;
  name: string;
  brand: string;
  model: string;
  normalizedModel: string;
  normalizedName: string;
  category: string;
  description: string;
  tags: readonly string[];
  coverMediaId: string | null;
  imageMediaIds: readonly string[];
  videoMediaIds: readonly string[];
  status: StandardProductStatus;
  version?: string;
  assetCount?: number;
  allowedActions?: readonly ProductActionDecision[];
  createdAt: string;
  updatedAt: string;
}

export type Product = StandardProduct;

export interface LessorProfile {
  id: string;
  lessorKind: LessorKind;
  businessMode: 'B2C' | 'C2C';
  displayName: string;
  merchantId: string | null;
  userId: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export type ProductSupplementRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED';

export interface ProductSupplementRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  proposedBrand: string;
  proposedModel: string;
  proposedName: string;
  category: string;
  description: string;
  evidenceMediaIds: readonly string[];
  status: ProductSupplementRequestStatus;
  linkedProductId: string | null;
  reviewRemark: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalAsset {
  version?: string;
  rfidCode?: string | null;
  id: string;
  assetNo: string;
  productId: string;
  displayName: string;
  supplyMode: SupplyMode;
  lessorId: string;
  identifierType: AssetIdentifierType;
  identifierValue: string;
  identifierNormalizedValue: string;
  condition: string;
  defectDescription: string;
  accessoryDescription: string;
  rentalType: RentalType;
  unitPriceFen: number;
  /** Exact API integer strings for PERSONAL review; numeric fields may be NaN above JS safe range. */
  unitPriceFenRaw?: string;
  minimumUnits: number;
  depositFen: number;
  depositFenRaw?: string;
  /** User-facing reference value only. It never participates in rent, deposit, damages or settlement. */
  referenceValueFen: number;
  referenceValueFenRaw?: string;
  currency: 'CNY';
  termsRevision: number;
  /** Latest submitted revision shown to an operator before a review decision. */
  latestRevisionId?: string | null;
  publicationBlockers?: readonly string[];
  allowedActions?: readonly { code: string; enabled: boolean; blockedReasons: readonly string[] }[];
  reviewBlockedReasons?: readonly string[];
  termsEffectiveAt: string;
  coverMediaId: string | null;
  imageMediaIds: readonly string[];
  videoMediaIds: readonly string[];
  mediaSource: 'PRODUCT_STANDARD' | 'ASSET_ACTUAL';
  publishLocationSnapshot: OperatingAddress | null;
  reviewStatus: AssetReviewStatus;
  publishStatus: AssetPublishStatus;
  availabilityStatus: AssetAvailabilityStatus;
  boxId: string | null;
  /** Current cabinet placement identity. boxId is an internal compartment ID, not boxNo. */
  cabinetId?: string | null;
  /** Exact server placement identity and version, distinct from the asset version. */
  placement?: components['schemas']['OpsAssetPlacement'] | null;
  
  creationBatchId: string | null;
  reviewRemark: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Asset = RentalAsset;

export interface AssetRentalTermsRevision {
  id: string;
  assetId: string;
  revision: number;
  rentalType: RentalType;
  unitPriceFen: number;
  unitPriceFenRaw?: string;
  minimumUnits: number;
  depositFen: number;
  depositFenRaw?: string;
  referenceValueFen: number;
  referenceValueFenRaw?: string;
  currency: 'CNY';
  effectiveAt: string;
  changedBy: string;
  changeReason: string;
}

/** v7 persistence compatibility only. Never expose these records through current gateways. */
export interface LegacyProductV7 {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  tags: readonly string[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

/** v7 persistence compatibility only. */
export interface LegacySkuV7 {
  id: string;
  productId: string;
  specName: string;
  brand: string;
  model: string;
  category: string;
  accessoryNames: readonly string[];
  tags: readonly string[];
  rentalType: RentalType;
  status: RecordStatus;
}

/** v7 persistence compatibility only. */
export interface LegacyOfferV7 {
  id: string;
  skuId: string;
  version: number;
  rulesVersion: number;
  name: string;
  rentalType: RentalType;
  unitPriceFen: number;
  minimumUnits: number;
  dailyRentFen: number;
  depositFen: number;
  currency: 'CNY';
  starMaxPercent: number;
  status: RecordStatus;
}

/** v7 persistence compatibility only. */
export interface LegacyAssetV7 {
  id: string;
  assetNo: string;
  skuId: string;
  serialNumber: string;
  condition: string;
  referenceValueFen: number | null;
  status: 'READY_TO_DEPLOY' | 'IN_CABINET' | 'RESERVED' | 'RENTED' | 'RETURNED_PENDING_INSPECTION' | 'MAINTENANCE' | 'RETIRED' | 'FROZEN';
  boxId: string | null;
  activeOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderPermissionKey =
  | 'order.view'
  | 'finance.manage';

export interface OrderProjectionBadge {
  code: string;
  label: string;
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export interface OrderBlockingReason {
  code: string;
  message: string;
  axis: 'PAYMENT' | 'ENTITLEMENT' | 'REFUND';
}

export type WechatPayMockOperation =
  | 'PAYMENT'
  | 'REFUND'
  | 'DEPOSIT_RETURN'
  | 'SUPPLEMENT'
  | 'SETTLEMENT';

export type WechatPayMockStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'CLOSED';

export type WechatPayMockResultSource =
  | 'CREATED'
  | 'NOTIFICATION'
  | 'QUERY'
  | 'MANUAL_VERIFICATION'
  | 'MIGRATION';

/**
 * Synthetic, display-safe WeChat Pay facts. It intentionally excludes openid,
 * secrets, signatures, access tokens and callback payloads.
 */
export interface WechatPayMockOperationFacts {
  provider: 'WECHAT_PAY_MOCK';
  operation: WechatPayMockOperation;
  merchantRequestNo: string;
  outTradeNo: string;
  transactionId: string | null;
  outRefundNo: string | null;
  refundId: string | null;
  amountFen: number;
  currency: 'CNY';
  status: WechatPayMockStatus;
  providerStatus: string;
  resultSource: WechatPayMockResultSource;
  notificationStatus: 'NOT_RECEIVED' | 'RECEIVED' | 'IGNORED';
  notificationId: string | null;
  notificationDedupeKey: string | null;
  notificationReceivedAt: string | null;
  idempotencyKey: string;
  lastQueriedAt: string | null;
  timeExpire: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Synthetic, queryable fact for the original C2C electronic-signature attempt.
 * It never contains a provider token, signature, callback body or real network identity.
 */

/** Runtime-only Admin workbench projection. It is never persisted in MockState. */

export interface StarAccount {
  userId: string;
  availableTenths: number;
  frozenTenths: number;
  consumedTenths: number;
  recoveryDueTenths: number;
  updatedAt: string;
}

export type StarLedgerEntryType = 'OPENING' | 'EARN' | 'FREEZE' | 'CONSUME' | 'RELEASE' | 'REFUND' | 'RECOVERY';
export type StarLedgerSourceType = 'OPENING' | 'SIGN_IN' | 'REFUND';

export interface StarBalanceTenths {
  availableTenths: number;
  frozenTenths: number;
  consumedTenths: number;
  recoveryDueTenths: number;
}

export interface StarLedgerEntry {
  id: string;
  idempotencyKey: string;
  accountSequence: number;
  userId: string;
  type: StarLedgerEntryType;
  sourceType: StarLedgerSourceType;
  sourceId: string;
  grossStarTenths: number;
  availableDeltaTenths: number;
  frozenDeltaTenths: number;
  consumedDeltaTenths: number;
  recoveryDueDeltaTenths: number;
  balanceAfter: StarBalanceTenths;
  occurredAt: string;
  note: string;
}

export interface SignInRecord {
  signInId: string;
  userId: string;
  businessDate: string;
  signedAt: string;
  streakDays: number;
  dailyRewardStarTenths: number;
  milestoneDays: number | null;
  milestoneBonusStarTenths: number;
  loyaltyVersionId: string;
  ledgerEntryId: string;
  rewardDisplay?: string;
}

export type ContractPurchaseProjectionStatus =
  | 'ALL'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_CONFIRMING'
  | 'ENTITLEMENT_PENDING'
  | 'COMPLETED'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'CLOSED'
  | 'EXCEPTION';

export type ContractPurchaseLifecycleStatus = 'OPEN' | 'COMPLETED' | 'CLOSED' | 'EXCEPTION';
export type ContractPurchaseEntitlementStatus =
  | 'NOT_GRANTED'
  | 'GRANT_PENDING'
  | 'GRANTED'
  | 'FROZEN'
  | 'REVERSED'
  | 'FAILED';

export interface ContractPurchaseEntitlementFacts {
  status: ContractPurchaseEntitlementStatus;
  grantedCount: number;
  availableCount: number;
  reservedCount: number;
  consumedCount: number;
  frozenCount: number;
  reversedCount: number;
  grantedAt: string | null;
  updatedAt: string;
}

export interface ContractPurchaseOrder {
  id: string;
  orderNo: string;
  buyerSnapshot: {
    lessorId: string;
    userId: string;
    lessorKind: 'PERSONAL';
    businessMode: 'C2C';
    displayName: string;
    mobileMasked: string;
  };
  subject: {
    type: 'ELECTRONIC_CONTRACT_SIGNATURE_CREDIT';
    quantity: number;
  };
  priceSnapshot: {
    currency: 'CNY';
    unitPriceFen: number;
    quantity: number;
    totalAmountFen: number;
    businessRuleVersionId: string;
    businessRuleVersion: number;
  };
  lifecycleStatus: ContractPurchaseLifecycleStatus;
  payment: WechatPayMockOperationFacts;
  refund: WechatPayMockOperationFacts | null;
  entitlement: ContractPurchaseEntitlementFacts;
  version: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export type ContractPurchaseActionCode = 'VIEW_DETAIL' | 'QUERY_PAYMENT' | 'QUERY_REFUND';

export interface ContractPurchaseAllowedAction {
  code: ContractPurchaseActionCode;
  label: string;
  permission: Extract<OrderPermissionKey, 'order.view' | 'finance.manage'>;
  kind: 'NAVIGATION' | 'COMMAND';
}

/** Runtime-only Admin workbench projection. It is never persisted in MockState. */
export interface ContractPurchaseOrderProjection extends ContractPurchaseOrder {
  projectionStatus: Exclude<ContractPurchaseProjectionStatus, 'ALL'>;
  currentNode: string;
  badges: readonly OrderProjectionBadge[];
  allowedActions: readonly ContractPurchaseAllowedAction[];
  blockingReasons: readonly OrderBlockingReason[];
}

export type ContractCreditLedgerEntryType =
  | 'GRANT'
  | 'RELEASE'
  | 'FREEZE'
  | 'REVERSE';

export interface ContractCreditBalanceSnapshot {
  availableCount: number;
  reservedCount: number;
  consumedCount: number;
  frozenCount: number;
  reversedCount: number;
}

/** Append-only entitlement fact. Runtime code never updates or removes an entry. */
export interface ContractCreditLedgerEntry {
  id: string;
  lessorId: string;
  purchaseOrderId: string;

type: ContractCreditLedgerEntryType;
  quantity: number;
  idempotencyKey: string;
  balanceAfter: ContractCreditBalanceSnapshot;
  occurredAt: string;
  note: string;
}

/** v7 persistence compatibility only. */

/** v7 persistence compatibility only. */

/** v7 persistence compatibility only. */

/** v7 persistence compatibility only. */
export interface LegacyCabinetBoxEventV7 extends Omit<CabinetBoxEvent, 'deviceSnapshot'> {
  deviceSnapshot: {
    assetId: string;
    assetNo: string;
    skuId: string;
    skuLabel: string;
    model: string;
    serialNumberDisplay: string;
  };
}

export interface CabinetCommand {
  id: string;
  cabinetRecordId: string;
  boxId: string;
  boxNo: number;
  type: 'OPEN_BOX';
  status: CommandOutcome;
  resultMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  sequence: number;
  aggregateType: string;
  aggregateId: string;
  action: string;
  actorId: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface RecordLoginAttemptInput {
  accountId: string;
  displayName: string;
  role: DemoRole;
  loginMethod: 'PHONE' | 'MINIPROGRAM_QR';
  status: 'SUCCESS' | 'FAILED';
  source: string;
  failureReason?: string | null;
}

export interface RecordRoleSwitchInput {
  actorId: string;
  fromRole: DemoRole;
  toRole: DemoRole;
}

export interface DemoRuntimeInfo {
  appMode: 'mock-demo';
  productVersion: ProductVersion;
  schemaVersion: number;
  scenarioName: DemoScenarioName;
  seed: string;
  now: string;
  revision: number;
  eventCount: number;
}

export interface BusinessRuleLevel {
  id: string;
  name: string;
  requiredStarTenths: number;
}

export interface BusinessRuleConfigVersion {
  id: string;
  version: number;
  payScoreDepositFreeEnabled: boolean;
  payScoreDepositFreeThreshold: number | null;
  contractUnitPriceFen: number;
  publishingQuotaUnitPriceFen: number;
  minimumHourlyRentalHours: number;
  minimumDailyRentalDays: number;
  createdAt: string;
  createdBy: string;
}

export interface BusinessRuleLevelInput {
  id?: string | undefined;
  name: string;
  requiredStarTenths: number;
}

export interface SaveBusinessRuleConfigInput {
  payScoreDepositFreeEnabled: boolean;
  payScoreDepositFreeThreshold: number | null;
  contractUnitPriceFen: number;
  publishingQuotaUnitPriceFen: number;
  minimumHourlyRentalHours: number;
  minimumDailyRentalDays: number;
  actorId?: string;
}

export interface LoyaltyStreakReward {
  id: string;
  consecutiveDays: number;
  bonusStarTenths: number;
}

export interface LoyaltyConfigVersion {
  id: string;
  version: number;
  consumptionStarTenthsPerYuan: number;
  levels: readonly BusinessRuleLevel[];
  dailySignInRewardStarTenths: number;
  streakRewards: readonly LoyaltyStreakReward[];
  timezone: 'Asia/Shanghai';
  createdAt: string;
  createdBy: string;
}

export interface SaveLoyaltyConfigInput {
  consumptionStarTenthsPerYuan: number;
  levels: readonly BusinessRuleLevelInput[];
  dailySignInRewardStarTenths: number;
  streakRewards: readonly Omit<LoyaltyStreakReward, 'id'>[];
  actorId?: string;
}

export interface MemberSummary {
  userId: string;
  nickname: string;
  avatarUrl: string;
  miniProgramOpenIdMasked: string;
  miniProgramRegisteredAt: string;
  mobileMasked: string;
  realNameStatus: 'UNVERIFIED' | 'VERIFIED';
  wechatPayScoreRaw: number | null;
  wechatPayScoreUpdatedAt: string | null;
  consumptionAmountFen: number | null;
  consumptionOrderCount: number | null;
  lastOrderAt: string | null;
}

export interface UserDossier extends MemberSummary {
  realNameMasked: string | null;
  identityNoMasked: string | null;
  starAccount: StarAccount;
  demoPinkBalance?: number;
  
  starLedger: readonly StarLedgerEntry[];
  signInRecords: readonly SignInRecord[];
  
  signIn: {
    timezone: 'Asia/Shanghai';
    signedInToday: boolean;
    currentStreakDays: number;
    lastSignInAt: string | null;
    dailyRewardStarTenths: number;
    nextMilestoneDays: number | null;
    nextMilestoneBonusStarTenths: number | null;
    nextMilestoneLoyaltyVersionId: string;
  };
  
  riskTags: readonly string[];
  notes: readonly string[];
}

export interface AdminAccount extends ArchiveMetadata {
  id: string;
  displayName: string;
  mobileMasked: string;
  mobile: string;
  role: DemoRole;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
  loginCapabilities: {
    phone: true;
    wechat: boolean;
  };
  wechatBinding: {
    status: 'BOUND' | 'UNBOUND';
    nickname: string | null;
    avatarUrl: string | null;
    boundAt: string | null;
  };
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface CreateAdminInput {
  displayName: string;
  mobile: string;
  role: DemoRole;
  status: AdminAccount['status'];
  actorId?: string;
}

export interface CreateMerchantInput {
  photoMaterialIds?: readonly string[];
  phoneDial?: string;
  command?: CommandMetadata;
  name: string;
  sharePercent: number;
  settlementAccount: string;
  contactName: string;
  operatingAddress: OperatingAddress | (Omit<OperatingAddress, 'provinceCode' | 'cityCode' | 'districtCode' | 'poiName' | 'confirmationStatus'> & {
    provinceCode?: string;
    cityCode?: string;
    districtCode?: string;
    poiName?: string | null;
    confirmationStatus?: AddressConfirmationStatus;
  });
  actorId?: string;
}

export interface UpdateMerchantInput extends CreateMerchantInput {
  merchantId: string;
}

export interface ArchiveEntityInput {
  id: string;
  reason: string;
  actorId?: string;
  command?: CommandMetadata;
}

export interface RestoreEntityInput {
  id: string;
  reason?: string;
  command?: CommandMetadata;
  actorId?: string;
}

export interface CreateCabinetInput {
  merchantId: string;
  cabinetId: string;
  name: string;
  description?: string;
  boxCount: number;
  connectivity?: ConnectivityStatus;
  capabilities?: CabinetCapabilities;
  actorId?: string;
}

export interface UpdateCabinetInput {
  cabinetRecordId: string;
  name: string;
  description: string;
  capabilities: CabinetCapabilities;
  actorId?: string;
}

export interface SetCabinetStatusInput {
  cabinetRecordId: string;
  status: RecordStatus;
  actorId?: string;
  command?: CommandMetadata;
}

export interface UpdateAdminInput {
  adminId: string;
  displayName: string;
  mobile: string;
  role: DemoRole;
  actorId?: string;
}

export interface SetAdminStatusInput {
  adminId: string;
  status: 'ACTIVE' | 'DISABLED';
  actorId?: string;
  command?: CommandMetadata;
}

export interface CreateProductInput {
  name: string;
  brandId: string;
  brand: string;
  model: string;
  categoryId?: string;
  category: string;
  description: string;
  tags: readonly string[];
  coverMediaId?: string | null;
  imageMediaIds?: readonly string[];
  videoMediaIds?: readonly string[];
  actorId?: string;
  command?: CommandMetadata;
}

export interface UpdateProductInput extends CreateProductInput {
  productId: string;
  status: StandardProductStatus;
  version?: string;
}

export interface CatalogDirectoryOption {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ReviewProductSupplementRequestInput {
  requestId: string;
  decision: 'APPROVE' | 'MERGE' | 'REJECT';
  linkedProductId?: string | null;
  reviewRemark: string;
  actorId?: string;
  command?: CommandMetadata;
}

export interface OfficialAssetIdentifierInput {
  identifierType: AssetIdentifierType;
  identifierValue?: string;
  rfidCode?: string;
}

export interface CreateOfficialAssetBatchInput {
  productId: string;
  displayName: string;
  identifiers: readonly OfficialAssetIdentifierInput[];
  condition: string;
  defectDescription: string;
  accessoryDescription: string;
  rentalType: RentalType;
  unitPriceFen: number;
  minimumUnits: number;
  depositFen: number;
  referenceValueFen: number;
  coverMediaId?: string | null;
  imageMediaIds?: readonly string[];
  videoMediaIds?: readonly string[];
  publishStatus?: AssetPublishStatus;
  actorId?: string;
}

export interface UpdateAssetInput {
  assetId: string;
  expectedVersion?: string;
  command?: CommandMetadata;
  displayName: string;
  condition: string;
  defectDescription: string;
  accessoryDescription: string;
  rentalType: RentalType;
  unitPriceFen: number;
  minimumUnits: number;
  depositFen: number;
  referenceValueFen: number;
  coverMediaId?: string | null;
  imageMediaIds?: readonly string[];
  videoMediaIds?: readonly string[];
  changeReason: string;
  actorId?: string;
}

export interface ReviewAssetInput {
  assetId: string;
  decision: 'APPROVE' | 'REJECT' | 'FREEZE';
  reviewRemark: string;
  expectedRevisionId?: string;
  actorId?: string;
  command?: CommandMetadata;
}

export interface AssetPrivateReviewDetails {
  assetId: string;
  revisionId: string;
  expiresAt: string;
  publicationAddress: { provinceName:string;cityName:string;districtName:string;detailAddress:string;recipientName:string;phone:string } | null;
  publicationPosition: {latitude:string;longitude:string;source:string} | null;
  deliveryMethods: readonly {method:string;detailAddress:string | null}[];
}

export interface SetAssetPublishStatusInput {
  assetId: string;
  publishStatus: Extract<AssetPublishStatus, 'ONLINE' | 'OFFLINE'>;
  expectedVersion?: string;
  actorId?: string;
  command?: CommandMetadata;
}

export interface QueryContractPurchaseOrderInput {
  orderId: string;
  expectedVersion: number;
  idempotencyKey: string;
  actorId: string;
}

export interface DemoRuntimeGateway {
  getInfo(context?: ServiceRequestContext): Promise<DemoRuntimeInfo>;
  resetScenario(scenarioName?: DemoScenarioName): Promise<DemoRuntimeInfo>;
}

export interface DashboardGateway {
  getSummary(context?: ServiceRequestContext): Promise<DashboardSummary>;
}

export interface MerchantGateway {
  updatePhotos?(merchantId: string, expectedVersion: string, photoMaterialIds: readonly string[], idempotencyKey: string): Promise<Merchant>;
  listRegions?(datasetId?: string, parentId?: string, context?: ServiceRequestContext): Promise<{ datasetId: string; items: Array<{ id: string; parentId: string | null; code: string; name: string; level: 'PROVINCE' | 'CITY' | 'DISTRICT'; codeKind: string; isVirtual: boolean }> }>;
  search?(filter: { name: string; address: string; region: string; status: string; cursor: string; pageSize: number }, context?: ServiceRequestContext): Promise<{ items: Merchant[]; hasMore: boolean; nextCursor: string | null }>;
  changeStatus?(merchant: Merchant, action: 'activate' | 'deactivate', command: CommandMetadata): Promise<Merchant>;
  list(context?: ServiceRequestContext): Promise<readonly Merchant[]>;
  getById(merchantId: string, context?: ServiceRequestContext): Promise<Merchant>;
  create(input: CreateMerchantInput): Promise<Merchant>;
  update(input: UpdateMerchantInput): Promise<Merchant>;
  archive(input: ArchiveEntityInput): Promise<Merchant>;
  restore(input: RestoreEntityInput): Promise<Merchant>;
}

export interface CabinetGateway {
  list(context?: ServiceRequestContext): Promise<readonly Cabinet[]>;
}

export interface CatalogGateway {
  listProducts(context?: ServiceRequestContext): Promise<readonly Product[]>;
  listBrands(context?: ServiceRequestContext): Promise<readonly CatalogDirectoryOption[]>;
  listCategories(context?: ServiceRequestContext): Promise<readonly CatalogDirectoryOption[]>;
  createBrand?(name: string): Promise<CatalogDirectoryOption>;
  createCategory?(name: string): Promise<CatalogDirectoryOption>;
  listSupplementRequests(context?: ServiceRequestContext): Promise<readonly ProductSupplementRequest[]>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(input: UpdateProductInput): Promise<Product>;
  setProductStatus?(product: Product, action: 'activate' | 'deactivate', command: CommandMetadata): Promise<Product>;
  reviewSupplementRequest(input: ReviewProductSupplementRequestInput): Promise<ProductSupplementRequest>;
}

export interface AssetGateway {
  list(context?: ServiceRequestContext): Promise<readonly Asset[]>;
  listLessors(context?: ServiceRequestContext): Promise<readonly LessorProfile[]>;
  listTerms(assetId: string, context?: ServiceRequestContext): Promise<readonly AssetRentalTermsRevision[]>;
  createOfficialBatch(input: CreateOfficialAssetBatchInput): Promise<readonly Asset[]>;
  updateRFID?(assetId: string, expectedVersion: string, rfidCode: string | null, idempotencyKey: string): Promise<Asset>;
  update(input: UpdateAssetInput): Promise<Asset>;
  review(input: ReviewAssetInput): Promise<Asset>;
  readPrivateReviewDetails?(assetId:string,expectedRevisionId:string):Promise<AssetPrivateReviewDetails>;
  setPublishStatus(input: SetAssetPublishStatusInput): Promise<Asset>;
}

export interface StarGateway {
  getAccount(userId: string, context?: ServiceRequestContext): Promise<StarAccount>;
  listLedger(userId?: string, context?: ServiceRequestContext): Promise<readonly StarLedgerEntry[]>;
}

export interface AuditGateway {
  list(limit?: number, context?: ServiceRequestContext): Promise<readonly AuditEvent[]>;
}

export interface SessionAuditGateway {
  recordLoginAttempt(input: RecordLoginAttemptInput): Promise<AuditEvent>;
  recordRoleSwitch(input: RecordRoleSwitchInput): Promise<AuditEvent>;
}

export interface BusinessRulesGateway {
  getCurrent(context?: ServiceRequestContext): Promise<BusinessRuleConfigVersion>;
  listVersions(context?: ServiceRequestContext): Promise<readonly BusinessRuleConfigVersion[]>;
  save(input: SaveBusinessRuleConfigInput): Promise<BusinessRuleConfigVersion>;
}

export type ConfigKey = 'material.upload_policy' | 'identity.profile_policy' | 'sms.challenge_policy';
export interface ConfigValues {
  'material.upload_policy': components['schemas']['MaterialUploadPolicyV2'];
  'identity.profile_policy': components['schemas']['IdentityProfilePolicy'];
  'sms.challenge_policy': components['schemas']['SMSChallengePolicy'];
}
export type ConfigInput = { [K in ConfigKey]: { config_key: K; schema_version: K extends 'material.upload_policy' ? 2 : 1; value: ConfigValues[K] } }[ConfigKey];
export interface EffectiveConfig {
  config_key: ConfigKey;
  source: 'DEFAULT_CODE' | 'PUBLISHED';
  schema_version: number;
  value: ConfigValues[ConfigKey];
  config_version?: ConfigVersion;
  effective_epoch?: number;
}
export type ConfigStatus = 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED';

export interface ConfigDefinition {
  config_key: ConfigKey;
  schema_version: number;
  value_type: string;
  scope_type: 'GLOBAL';
  status: 'ACTIVE' | 'RETIRED';
  description_code: string;
  updated_at: string;
}

export interface ConfigVersion {
  publication_mode?: components['schemas']['ConfigVersion']['publication_mode'];
  config_version_id: string;
  config_key: ConfigKey;
  version_no: number;
  schema_version: number;
  value: Record<string, unknown>;
  content_hash: string;
  status: ConfigStatus;
  created_by: string;
  validated_by?: string;
  approved_by?: string;
  published_by?: string;
  reason: string;
  version: number;
  created_at: string;
}

export interface ConfigVersionPage {
  items: readonly ConfigVersion[];
  page: components['schemas']['CursorPageMeta'];
}

export interface SystemConfigurationGateway {
  listDefinitions(context?: ServiceRequestContext): Promise<readonly ConfigDefinition[]>;
  listEffective(context?: ServiceRequestContext): Promise<readonly EffectiveConfig[]>;
  listVersions(key: ConfigKey, cursor?: string, context?: ServiceRequestContext): Promise<ConfigVersionPage>;
  createVersion(input: ConfigInput, reason: string, idempotencyKey: string): Promise<ConfigVersion>;
  createDefault(key: ConfigKey, reason: string): Promise<ConfigVersion>;
  transition(version: ConfigVersion, action: 'validate' | 'approve' | 'publish', reason: string, idempotencyKey: string): Promise<ConfigVersion>;
}

export type MaterialClass = components['schemas']['MaterialClass'];
export type Material = components['schemas']['Material'];
export type MaterialFileResult = components['schemas']['MaterialFileResult'];
export type ReadyMaterialValue = Pick<Material, 'material_id' | 'material_class' | 'public_url' | 'playback_url' | 'mime_type' | 'size_bytes' | 'metadata' | 'poster'>;

export interface MaterialGateway {
  uploadFile(file: File, materialClass: MaterialClass, idempotencyKey: string, context?: ServiceRequestContext & { onUploadProgress?: (progress: import('../api/client').UploadProgress) => void }): Promise<MaterialFileResult>;
  get(materialId: string, context?: ServiceRequestContext): Promise<Material>;
}

export interface LoyaltyGateway {
  getCurrent(context?: ServiceRequestContext): Promise<LoyaltyConfigVersion>;
  listVersions(context?: ServiceRequestContext): Promise<readonly LoyaltyConfigVersion[]>;
  save(input: SaveLoyaltyConfigInput): Promise<LoyaltyConfigVersion>;
}

export interface MemberGateway {
  list(context?: ServiceRequestContext): Promise<readonly MemberSummary[]>;
  getDossier(userId: string, context?: ServiceRequestContext): Promise<UserDossier>;
}

export interface AdminGateway {
  list(context?: ServiceRequestContext): Promise<readonly AdminAccount[]>;
  create(input: CreateAdminInput): Promise<AdminAccount>;
  update(input: UpdateAdminInput): Promise<AdminAccount>;
  setStatus(input: SetAdminStatusInput): Promise<AdminAccount>;
  archive(input: ArchiveEntityInput): Promise<AdminAccount>;
  restore(input: RestoreEntityInput): Promise<AdminAccount>;
}

export interface IAMRoleProjection {
  role_id: string;
  role_code: string;
  status: 'ACTIVE' | 'DISABLED';
  version: number;
  permissions: readonly string[];
}

export interface IAMAccountProjection {
  wechat_binding?: { status: 'BOUND' | 'UNBOUND'; nickname: string | null; avatar_material_id: string | null; bound_at: string | null };
  account_id: string;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  security_version: number;
  display_name: string;
  phone_masked?: string | null;
  last_login_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  roles: readonly string[];
  scopes: readonly { type: string; id: string }[];
  created_at: string;
  updated_at: string;
}

export interface IAMLoginEventProjection {
  current_display_name?: string;
  current_roles?: readonly string[];
  event_id: string;
  result_code: string;
  account_id?: string;
  login_method: string;
  provider_code: string;
  request_id: string;
  occurred_at: string;
}

export interface IAMOperationEventProjection {
  current_display_name?: string;
  event_id: string;
  actor_account_id: string;
  operation_id: string;
  resource_type?: string;
  resource_id?: string;
  action_code: string;
  result_code: string;
  field_change_summary: Readonly<Record<string, unknown>>;
  occurred_at: string;
}

export interface IAMGateway {
  accounts?: {
    create(input: { display_name: string; phone: string; role_ids: readonly string[]; scopes: readonly { type: string; id: string }[]; status: 'ACTIVE' | 'DISABLED'; reason: string }, key: string): Promise<IAMAccountProjection>;
    update(account: IAMAccountProjection, input: { display_name: string; phone?: string; role_ids: readonly string[]; reason: string }, key: string): Promise<IAMAccountProjection>;
    changeStatus(account: IAMAccountProjection, action: 'deactivate' | 'reactivate' | 'archive', reason: string, key: string): Promise<IAMAccountProjection>;
  };
  listRoles(context?: ServiceRequestContext): Promise<readonly IAMRoleProjection[]>;
  replaceRolePermissions?(role: IAMRoleProjection, permissions: readonly string[], reason: string, idempotencyKey: string): Promise<IAMRoleProjection>;
  listAccounts(cursor?: string, context?: ServiceRequestContext, filter?: { keyword?: string; role?: string; status?: string; wechat_status?: string }): Promise<IAMPage<IAMAccountProjection>>;
  listLoginEvents(cursor?: string, context?: ServiceRequestContext, filter?: IAMAuditFilter): Promise<IAMPage<IAMLoginEventProjection>>;
  listOperationEvents(cursor?: string, context?: ServiceRequestContext, filter?: IAMAuditFilter): Promise<IAMPage<IAMOperationEventProjection>>;
}

export interface IAMAuditFilter {
  keyword?: string; object_keyword?: string; action_code?: string;
  resource_type?: string; resource_id?: string;
  login_method?: 'SMS_OTP' | 'QR_CHALLENGE'; result_class?: 'SUCCESS' | 'FAILED';
  audience?: 'OPS' | 'MINIPROGRAM'; from?: string; to?: string; page_size?: number;
}

export interface IAMPage<T> {
  items: T[];
  page: { page_size: number; has_more: boolean; next_cursor?: string };
}

export interface AdminServices {
  rentalOrders?: RentalOrdersGateway;
  runtime: DemoRuntimeGateway;
  dashboard: DashboardGateway;
  merchants: MerchantGateway;
  cabinets: CabinetGateway;
  cabinetManagement?: CabinetManagementGateway;
  catalog: CatalogGateway;
  assets: AssetGateway;
  
  stars: StarGateway;

audit: AuditGateway;
  sessionAudit: SessionAuditGateway;
  rules: BusinessRulesGateway;
  systemConfig: SystemConfigurationGateway;
  businessConfig?: BusinessConfigurationGateway;
  loyaltyManagement?: LoyaltyManagementGateway;
  materials: MaterialGateway;
  loyalty: LoyaltyGateway;
  members: MemberGateway;
  admins: AdminGateway;
  iam?: IAMGateway;
}

/** @deprecated Only retained for compatibility with older adapters. */
export type DemoServices = AdminServices;
