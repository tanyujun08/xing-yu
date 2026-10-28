import { randomId } from '../randomId';
import type { components } from '../api/generated/schema';
import type { ApiClient } from '../api/client';
import { ApiProblem } from '../api/problem';

export type ManagedCabinet = components['schemas']['Cabinet'];
export type ManagedCompartment = components['schemas']['CabinetCompartment'];
export function cabinetObservationSource(source: string | null | undefined): string {
  const labels: Record<string, string> = { INITIAL_REGISTRATION: '首次查询', MANUAL_REFRESH: '管理员查询', ADMIN_QUERY: '管理员查询', COMMAND_VERIFY: '命令回读', POLL: '定时查询' };
  return source ? labels[source] ?? '来源未知' : '暂无';
}
export type ManagedCabinetCredential = components['schemas']['OpsCabinetCredential'];
export type CabinetCreate = components['schemas']['CabinetCreateRequest'];
export type CabinetMerchant = components['schemas']['MerchantView'];
export type CabinetUpdate = components['schemas']['CabinetUpdateRequest'];
export type CabinetActivation = components['schemas']['CabinetActivateRequest'];
export type CabinetAdjustment = components['schemas']['CompartmentAdjustmentRequest'];
export type ManagedCabinetCommand = components['schemas']['CabinetCommand'];
export type CabinetProviderAction = components['schemas']['CabinetProviderAction'];
export type CabinetProviderQuery = components['schemas']['CabinetProviderQuery'];
export type CabinetProviderOperation = components['schemas']['CabinetProviderOperation'];
export type CabinetProviderOperationPage = components['schemas']['CabinetProviderOperationPage'];
export type CabinetStockingOptions = components['schemas']['OpsCabinetStockingOptions'];
export type CabinetPlacementReceipt = components['schemas']['OpsPlacementReceipt'];
export type CabinetOpenAllChallenge = components['schemas']['OpenAllChallenge'];
export type CabinetRecovery = components['schemas']['RecoveryRecord'];
export type CabinetOpenAllInput = { reason: string; on_site_responsible: string; confirmed_device_id: string };
export type CabinetRecoveryInput = components['schemas']['RecoveryRequest'];
type Context = { signal?: AbortSignal };
type Reason = components['schemas']['ReasonRequest'];
export type CabinetListFilter = {
  cursor?: string;
  merchantId?: string;
  keyword?: string;
  lifecycle?: 'INACTIVE' | 'ACTIVE' | 'ARCHIVED' | '';
  connectivity?: 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | '';
  occupancy?: 'OCCUPIED' | 'AVAILABLE' | 'FULL' | '';
};
export type CabinetProviderOperationFilter = {
  kind?: '' | 'ONLINE_QUERY' | 'DOOR_QUERY' | 'OPEN_ONE' | 'OPEN_ALL';
  status?: '' | 'QUEUED' | 'RUNNING' | 'ACCEPTED' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  createdFrom?: string;
  createdTo?: string;
  cursor?: string;
};
export interface CabinetManagementGateway {
  syncCover?(cabinetId: string, input: components['schemas']['CabinetCoverSyncRequest'], key: string): Promise<components['schemas']['CabinetCoverSyncReceipt']>;
  miniProgramCode?(cabinetId: string, signal?: AbortSignal): Promise<Blob>;
  merchants?(cursor?: string, context?: Context): Promise<components['schemas']['MerchantPage']>;
  list(filter?: CabinetListFilter, context?: Context): Promise<components['schemas']['CabinetPage']>;
  get(id: string, context?: Context): Promise<ManagedCabinet>;
  compartments(id: string, context?: Context): Promise<components['schemas']['CabinetCompartmentList']>;
  credential(id: string, context?: Context): Promise<ManagedCabinetCredential>;
  providerActions(id: string, context?: Context): Promise<components['schemas']['CabinetProviderActionList']>;
  queryOnline(id: string, key: string): Promise<CabinetProviderQuery>;
  queryDoor(cabinet: ManagedCabinet, number: number, key: string): Promise<CabinetProviderQuery>;
  providerQuery(cabinetId: string, queryId: string, context?: Context): Promise<CabinetProviderQuery>;
  providerOperations(cabinetId: string, filter?: CabinetProviderOperationFilter, context?: Context): Promise<CabinetProviderOperationPage>;
  stockingOptions(cabinetId: string, filter?: { query?: string; categoryId?: string; cursor?: string }, context?: Context): Promise<CabinetStockingOptions>;
  placeAsset(assetId: string, assetVersion: string, cabinetId: string, compartmentId: string, reason: string, key: string): Promise<CabinetPlacementReceipt>;
  endAssetPlacement(placementId: string, placementVersion: string, input: components['schemas']['OpsPlacementEndInput'], key: string): Promise<CabinetPlacementReceipt>;
  create(input: CabinetCreate, key: string): Promise<ManagedCabinet>;
  update(cabinet: ManagedCabinet, input: CabinetUpdate, key: string): Promise<ManagedCabinet>;
  activate(cabinet: ManagedCabinet, input: CabinetActivation, key: string): Promise<ManagedCabinet>;
  adjust(cabinet: ManagedCabinet, input: CabinetAdjustment, key: string): Promise<ManagedCabinet>;
  lifecycle(cabinet: ManagedCabinet, action: 'deactivate' | 'archive' | 'restore', input: Reason, key: string): Promise<ManagedCabinet>;
  observe(id: string, input: Reason, key: string): Promise<ManagedCabinetCommand>;
  openOne(cabinet: ManagedCabinet, number: number, key: string): Promise<ManagedCabinetCommand>;
  openAllChallenge(cabinet: ManagedCabinet, input: CabinetOpenAllInput, key: string): Promise<CabinetOpenAllChallenge>;
  getOpenAllChallenge(cabinetId: string, challengeId: string, context?: Context): Promise<CabinetOpenAllChallenge>;
  openAll(cabinet: ManagedCabinet, input: { challenge_id: string; proof: string }, key: string): Promise<ManagedCabinetCommand>;
  command(id: string, context?: Context): Promise<ManagedCabinetCommand>;
  recover(command: ManagedCabinetCommand, input: CabinetRecoveryInput, key: string): Promise<CabinetRecovery>;
}

export async function confirmCabinetDoorClosed(
  gateway: CabinetManagementGateway,
  cabinetId: string,
  compartmentNo: number,
  onQuery?: (queryId: string, stage: 'online' | 'door') => void,
  isActive: () => boolean = () => true,
): Promise<ManagedCabinet> {
  const awaitQuery = async (id: string) => {
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline && isActive()) {
      const result = await gateway.providerQuery(cabinetId, id);
      if (result.status !== 'QUEUED' && result.status !== 'RUNNING') return result;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 750));
    }
    throw new Error(isActive() ? '门态核查超时，未提交后续操作。请查看原查询记录。' : '页面已关闭，未提交后续操作。');
  };
  let cabinet = await gateway.get(cabinetId);
  if (cabinet.connectivity_status !== 'ONLINE' || cabinet.connectivity_stale) {
    const online = await gateway.queryOnline(cabinetId, randomId());
    onQuery?.(online.query_id, 'online');
    const result = await awaitQuery(online.query_id);
    if (result.status !== 'SUCCEEDED' || result.connectivity_status !== 'ONLINE') throw new Error('设备在线状态未确认，未提交后续操作。');
    cabinet = await gateway.get(cabinetId);
  }
  const door = await gateway.queryDoor(cabinet, compartmentNo, randomId());
  onQuery?.(door.query_id, 'door');
  const result = await awaitQuery(door.query_id);
  if (result.status !== 'SUCCEEDED' || result.door_status !== 'CLOSED') throw new Error(`格口 ${compartmentNo} 未确认门关，未提交后续操作。`);
  return gateway.get(cabinetId);
}

export function canPreflightCabinetOpenAll(cabinet: ManagedCabinet, slots: ManagedCompartment[], action?: CabinetProviderAction): boolean {
  const targets = slots.filter((slot) => slot.topology_status === 'IN_TOPOLOGY');
  const now = Date.now();
  const needsObservation = cabinet.connectivity_status !== 'ONLINE' || cabinet.connectivity_stale || targets.some((slot) => {
    const observed = Date.parse(slot.door_observed_at ?? '');
    return slot.door_status !== 'CLOSED' || !!slot.door_error_code || !Number.isFinite(observed) || observed > now || now - observed > 65_000;
  });
  return !!action && action.action === 'OPEN_ALL' && (action.enabled || (action.reason_code === 'CABINET_NOT_READY' && needsObservation)) &&
    cabinet.provider_mode === 'REAL' && cabinet.lifecycle_status === 'ACTIVE' && cabinet.active_command_id === null &&
    Number.isInteger(cabinet.topology_version) && cabinet.topology_version > 0 &&
    cabinet.topology_verification === 'OPERATOR_CONFIRMED' && cabinet.topology_confirmed_version === cabinet.topology_version &&
    Number.isInteger(cabinet.compartment_count) && cabinet.compartment_count >= 1 && cabinet.compartment_count <= 48 &&
    targets.length === cabinet.compartment_count && new Set(targets.map((slot) => slot.compartment_id)).size === targets.length &&
    new Set(targets.map((slot) => slot.compartment_no)).size === targets.length && targets.every((slot) =>
      slot.compartment_id !== '' && slot.cabinet_id === cabinet.cabinet_id && Number.isInteger(slot.compartment_no) && slot.compartment_no >= 1 && slot.compartment_no <= cabinet.compartment_count &&
      slot.service_status === 'ACTIVE' && slot.business_occupancy_status === 'AVAILABLE' && slot.occupant === null &&
      slot.retired_at === null && slot.last_topology_version === cabinet.topology_version);
}

export async function confirmCabinetAllDoorsClosed(
  gateway: CabinetManagementGateway,
  original: ManagedCabinet,
  onObservation?: (id: string, stage: 'online' | 'doors') => void,
  isActive: () => boolean = () => true,
): Promise<ManagedCabinet> {
  const assertActive = () => { if (!isActive()) throw new Error('全开前检已取消，未提交后续操作。'); };
  const pause = () => new Promise<void>((resolve) => window.setTimeout(resolve, 750));
  const read = async () => {
    assertActive();
    const [cabinet, slots, actions] = await Promise.all([
      gateway.get(original.cabinet_id), gateway.compartments(original.cabinet_id), gateway.providerActions(original.cabinet_id),
    ]);
    assertActive();
    const action = actions.items.find((item) => item.action === 'OPEN_ALL');
    if (cabinet.provider_device_id !== original.provider_device_id || cabinet.compartment_count !== original.compartment_count ||
      cabinet.topology_version !== original.topology_version || !canPreflightCabinetOpenAll(cabinet, slots.items, action)) {
      throw new Error('柜机拓扑、权限或格口业务资格已变化，未提交后续操作。');
    }
    return { cabinet, slots: slots.items.filter((slot) => slot.topology_status === 'IN_TOPOLOGY'), action };
  };
  const initial = await read();
  assertActive();
  const online = await gateway.queryOnline(original.cabinet_id, randomId());
  assertActive();
  onObservation?.(online.query_id, 'online');
  const onlineDeadline = Date.now() + 25_000;
  for (;;) {
    assertActive();
    if (Date.now() >= onlineDeadline) throw new Error('在线核查超时，未提交后续操作。请查看原查询记录。');
    const result = await gateway.providerQuery(original.cabinet_id, online.query_id);
    assertActive();
    if (result.status !== 'QUEUED' && result.status !== 'RUNNING') {
      if (result.query_id !== online.query_id || result.cabinet_id !== original.cabinet_id || result.status !== 'SUCCEEDED' || result.connectivity_status !== 'ONLINE') throw new Error('设备在线状态未确认，未提交后续操作。');
      break;
    }
    await pause();
  }
  assertActive();
  const observation = await gateway.observe(original.cabinet_id, { reason: '管理员全开前核查全部配置格口门态' }, randomId());
  assertActive();
  const matchesTargets = (command: ManagedCabinetCommand) => command.command_id === observation.command_id &&
    command.cabinet_id === original.cabinet_id && command.command_type === 'OBSERVE_CABINET' &&
    command.topology_version === original.topology_version && command.targets.length === original.compartment_count &&
    new Set(command.targets.map((target) => target.compartment_id)).size === command.targets.length &&
    command.targets.every((target) => initial.slots.some((slot) => slot.compartment_id === target.compartment_id && slot.compartment_no === target.compartment_no));
  if (!matchesTargets(observation)) throw new Error('全格观察目标与当前配置不一致，未提交后续操作。');
  onObservation?.(observation.command_id, 'doors');
  const deadline = Date.now() + 120_000 + original.compartment_count * 7_000;
  for (;;) {
    assertActive();
    if (Date.now() >= deadline) throw new Error('全格门态核查超时，未提交后续操作。请查看原观察记录。');
    const result = await gateway.command(observation.command_id);
    assertActive();
    if (!matchesTargets(result)) throw new Error('全格观察目标已变化，未提交后续操作。');
    if (result.execution_status !== 'REQUESTED' && result.execution_status !== 'DISPATCHING') {
      if (result.execution_status !== 'ACCEPTED' || result.resolution_status !== 'SAFE_RELEASED' || result.observation_status !== 'CLOSED') {
        throw new Error('全部格口未确认门关，未提交后续操作。请关好柜门后重新核查。');
      }
      break;
    }
    await pause();
  }
  const fresh = await read();
  const now = Date.now();
  const started = Date.parse(observation.created_at);
  if (!Number.isFinite(started) || fresh.cabinet.connectivity_status !== 'ONLINE' || fresh.cabinet.connectivity_stale || !fresh.action?.enabled ||
    !fresh.slots.every((slot) => {
      const observed = Date.parse(slot.door_observed_at ?? '');
      return slot.door_status === 'CLOSED' && !slot.door_error_code && Number.isFinite(observed) && observed >= started && observed <= now &&
        now - observed <= 65_000 && ['INITIAL_REGISTRATION', 'MANUAL_REFRESH', 'ADMIN_QUERY', 'COMMAND_VERIFY', 'POLL'].includes(slot.door_observation_source ?? '');
    })) throw new Error('全部格口门关、在线或业务资格未获近期确认，未提交后续操作。');
  assertActive();
  return fresh.cabinet;
}
const path = (id: string) => `/v1/ops/cabinets/${encodeURIComponent(id)}`;
export function createCabinetManagement(client: ApiClient): CabinetManagementGateway {
  const write = <T>(cabinet: ManagedCabinet, suffix: string, body: T, key: string, method: 'POST' | 'PATCH' = 'POST') =>
    client.request<ManagedCabinet, T>({ path: path(cabinet.cabinet_id) + suffix, method, body, idempotencyKey: key, aggregateVersion: `"v${cabinet.version}"` });
  return {
    syncCover: (id, body, key) => client.request({ path: path(id) + '/cover-syncs', method: 'POST', body, idempotencyKey: key }),
    miniProgramCode: (id, signal) => client.request<Blob, Record<string, never>>({ path: path(id) + '/mini-program-code', method: 'POST', body: {}, responseType: 'image', ...(signal ? { signal } : {}) }),
    merchants: (cursor = '', context) => client.request({ path: `/v1/ops/merchants?status=ACTIVE&page_size=20${cursor === '' ? '' : `&cursor=${encodeURIComponent(cursor)}`}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    list: (filter = {}, context) => {
      const query = new URLSearchParams({ page_size: '20' });
      if (filter.cursor) query.set('cursor', filter.cursor);
      if (filter.merchantId) query.set('merchant_id', filter.merchantId);
      if (filter.keyword) query.set('keyword', filter.keyword.trim());
      if (filter.lifecycle) query.set('lifecycle_status', filter.lifecycle);
      if (filter.connectivity) query.set('connectivity_status', filter.connectivity);
      if (filter.occupancy) query.set('occupancy', filter.occupancy);
      return client.request({ path: `/v1/ops/cabinets?${query.toString()}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) });
    },
    get: (id, context) => client.request({ path: path(id), ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    compartments: (id, context) => client.request({ path: path(id) + '/compartments', ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    credential: (id, context) => client.request({ path: `/v1/ops/cabinet-credentials/${encodeURIComponent(id)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    providerActions: (id, context) => client.request({ path: path(id) + '/provider-actions', ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    queryOnline: (id, key) => client.request({ path: path(id) + '/provider-queries/online', method: 'POST', idempotencyKey: key }),
    queryDoor: (cabinet, number, key) => client.request({ path: path(cabinet.cabinet_id) + `/compartments/${number}/provider-queries/door`, method: 'POST', idempotencyKey: key, aggregateVersion: `"v${cabinet.version}"` }),
    providerQuery: (cabinetId, queryId, context) => client.request({ path: path(cabinetId) + `/provider-queries/${encodeURIComponent(queryId)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    providerOperations: (cabinetId, filter = {}, context) => {
      const query = new URLSearchParams({ page_size: '20' });
      if (filter.kind) query.set('kind', filter.kind);
      if (filter.status) query.set('status', filter.status);
      if (filter.createdFrom) query.set('created_from', filter.createdFrom);
      if (filter.createdTo) query.set('created_to', filter.createdTo);
      if (filter.cursor) query.set('cursor', filter.cursor);
      return client.request({ path: path(cabinetId) + `/provider-operations?${query}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) });
    },
    stockingOptions: (cabinetId, filter = {}, context) => {
      const query = new URLSearchParams({ page_size: '20' });
      if (filter.query) query.set('query', filter.query);
      if (filter.categoryId) query.set('category_id', filter.categoryId);
      if (filter.cursor) query.set('cursor', filter.cursor);
      return client.request({ path: path(cabinetId) + `/stocking-options?${query}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) });
    },
    placeAsset: (assetId, assetVersion, cabinetId, compartmentId, reason, key) => client.request({ path: `/v1/ops/assets/${encodeURIComponent(assetId)}/placements`, method: 'POST', body: { location_kind: 'CABINET', cabinet_id: cabinetId, compartment_id: compartmentId, reason }, idempotencyKey: key, aggregateVersion: `"v${assetVersion}"` }),
    endAssetPlacement: (placementId, placementVersion, body, key) => client.request({ path: `/v1/ops/asset-placements/${encodeURIComponent(placementId)}/end`, method: 'POST', body, idempotencyKey: key, aggregateVersion: `"v${placementVersion}"` }),
    create: (input, key) => client.request<ManagedCabinet, CabinetCreate>({ path: '/v1/ops/cabinets', method: 'POST', body: input, idempotencyKey: key }),
    update: (cabinet, input, key) => write(cabinet, '', input, key, 'PATCH'),
    activate: (cabinet, input, key) => write(cabinet, '/activate', input, key),
    adjust: (cabinet, input, key) => write(cabinet, '/compartment-adjustments', input, key),
    lifecycle: (cabinet, action, input, key) => write(cabinet, '/' + action, input, key),
    observe: (id, body, key) => client.request({ path: path(id) + '/observation-refreshes', method: 'POST', body, idempotencyKey: key }),
    openOne: (cabinet, number, key) => client.request({ path: path(cabinet.cabinet_id) + `/compartments/${number}/maintenance-open-commands`, method: 'POST', idempotencyKey: key, aggregateVersion: `"v${cabinet.version}"` }),
    openAll: (cabinet, body, key) => client.request({ path: path(cabinet.cabinet_id) + '/open-all-commands', method: 'POST', body, idempotencyKey: key, aggregateVersion: `"v${cabinet.version}"` }),
    openAllChallenge: (cabinet, body, key) => client.request({ path: path(cabinet.cabinet_id) + '/open-all-challenges', method: 'POST', body, idempotencyKey: key, aggregateVersion: `"v${cabinet.version}"` }),
    getOpenAllChallenge: (cabinetId, challengeId, context) => client.request({ path: path(cabinetId) + `/open-all-challenges/${encodeURIComponent(challengeId)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    command: (id, context) => client.request({ path: `/v1/ops/cabinet-commands/${encodeURIComponent(id)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    recover: (command, body, key) => client.request({ path: `/v1/ops/cabinet-commands/${encodeURIComponent(command.command_id)}/recovery-records`, method: 'POST', body, idempotencyKey: key, aggregateVersion: `"v${command.version}"` }),
  };
}

export function cabinetManagementFailure(error: unknown, submitted: boolean, action?: 'open-all'): { uncertain: boolean; message: string; refreshRequired?: boolean } {
  const uncertain = submitted && (!(error instanceof ApiProblem) || error.status === 0 || error.status >= 500 || error.code === 'IDEMPOTENCY_PENDING');
  if (uncertain) return { uncertain, message: '结果尚未确认。仅可用原请求核对，不会自动再次提交。' };
  if (!(error instanceof ApiProblem)) return { uncertain, message: '请检查必填字段和物理布局确认。' };
  if (error.status === 409 && error.code === 'RESOURCE_CONFLICT' && error.details?.resource_type === 'CABINET_DEVICE_EXISTS') {
    return { uncertain: false, message: '设备编号已存在，请使用已录入的租赁柜或核对设备编号。' };
  }
  if (error.status === 409 && error.code === 'RESOURCE_CONFLICT') {
    const placementMessages: Record<string, string> = {
      PLACEMENT_CUSTODY_CONFLICT: '在柜关系或入柜条件已变化。请刷新候选，核对资产和格口后重新确认。',
      ASSET_ORDER_OR_FULFILLMENT_OCCUPIED: '资产、格口或柜机存在占用，也可能有查询或操作尚未结束。请刷新候选；若仍不可用，请核对订单及柜机操作记录。',
      SUBMITTED_ASSET_HANDOVER_EVIDENCE_REQUIRED: '交接凭证尚未满足要求，请补齐并提交交接凭证后重新确认。',
    };
    const resourceType = error.details?.resource_type;
    const message = typeof resourceType === 'string' ? placementMessages[resourceType] : undefined;
    if (message) return { uncertain: false, refreshRequired: true, message };
  }
  if (action === 'open-all' && error.code === 'REAUTHENTICATION_REQUIRED') {
    return { uncertain: false, message: '请使用当前管理员手机号完成短信验证登录，随后重新发起管理员全开；若仍失败，请核对管理员手机号配置。' };
  }
  const messages: Record<string, string> = {
    PRECONDITION_FAILED: '版本已变化，请关闭表单、刷新柜机后重新确认。',
    CABINET_OCCUPANCY_UNKNOWN: '缺少可靠空闲依据；门关不代表格口空闲，请核对资产、预约与未决命令。',
    CABINET_COMMAND_UNRESOLVED: '存在未释放命令或 Worker 锁，请先核对原命令记录。',
    CABINET_CONNECTIVITY_UNCONFIRMED: '设备在线或目标格口门态未获近期可靠确认，请重新核查。',
    CABINET_OCCUPIED: '目标格口存在资产或订单占用，不能执行本次操作。',
    CABINET_REAL_OPEN_ALL_DISABLED: '管理员全开暂不可用，请刷新柜机与短信渠道状态。',
    CABINET_REAL_RECOVERY_DISABLED: '命令互斥仍在保护中，请人工核对现场及原命令记录。',
    REAUTHENTICATION_REQUIRED: '请重新通过手机号验证登录，在 5 分钟内提交恢复；会话刷新不算重新验证。',
    CHALLENGE_REJECTED: '验证码错误或已锁定，请检查本次验证码；错误次数不会因重试清零。',
    CHALLENGE_EXPIRED: '本次验证码已过期，请重新发起挑战。',
  };
  return { uncertain, refreshRequired: error.status === 412, message: messages[error.code] ?? (error.status === 403 ? '权限或范围已变化，请刷新登录状态。' : '服务器拒绝本次操作，请检查输入并刷新状态。') };
}
