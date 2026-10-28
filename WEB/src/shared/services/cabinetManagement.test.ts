import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { ApiProblem } from '../api/problem';
import { cabinetManagementFailure, canPreflightCabinetOpenAll, confirmCabinetAllDoorsClosed, confirmCabinetDoorClosed, createCabinetManagement, type CabinetManagementGateway, type CabinetProviderAction, type CabinetProviderQuery, type ManagedCabinet, type ManagedCabinetCommand, type ManagedCompartment } from './cabinetManagement';
import { canAccessApiPath, hasApiPermission } from '../access/apiSession';

describe('cabinet management API boundary', () => {
  it('explains definite placement conflicts without treating unknown writes as rejected', () => {
    for (const resourceType of ['PLACEMENT_CUSTODY_CONFLICT', 'ASSET_ORDER_OR_FULFILLMENT_OCCUPIED', 'SUBMITTED_ASSET_HANDOVER_EVIDENCE_REQUIRED']) {
      const failure = (status: number, code: string) => new ApiProblem(status, { code, message: 'synthetic', request_id: 'synthetic', details: { resource_type: resourceType } });
      expect(cabinetManagementFailure(failure(409, 'RESOURCE_CONFLICT'), true)).toMatchObject({ uncertain: false, refreshRequired: true });
      for (const [status, code] of [[0, 'RESOURCE_CONFLICT'], [500, 'RESOURCE_CONFLICT'], [409, 'IDEMPOTENCY_PENDING']] as const) {
        expect(cabinetManagementFailure(failure(status, code), true)).toEqual({ uncertain: true, message: '结果尚未确认。仅可用原请求核对，不会自动再次提交。' });
      }
    }
    const unknownReason = new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: 'synthetic', request_id: 'synthetic', details: { resource_type: 'UNKNOWN_REASON' } });
    expect(cabinetManagementFailure(unknownReason, true).refreshRequired).not.toBe(true);
  });
  it('reads only the selected redacted credential with no mutation headers or replacement request', async () => {
    const result = { credential_id: 'credential/one', status: 'ACTIVE' }; const request = vi.fn().mockResolvedValue(result);
    const signal = new AbortController().signal;
    await expect(createCabinetManagement({ request } as ApiClient).credential('credential/one', { signal })).resolves.toBe(result);
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/v1/ops/cabinet-credentials/credential%2Fone', signal });
  });
  it('ends one actual placement with its own ETag and reason only, without device commands', async () => {
    const receipt = { state: { publish_status: 'OFFLINE' }, placement: { status: 'ENDED', version: '7' } };
    const request = vi.fn().mockResolvedValue(receipt);
    const api = createCabinetManagement({ request } as ApiClient);
    await expect(api.endAssetPlacement('placement/one', '6', { reason: '管理员实际出柜' }, 'original-out-key-001')).resolves.toBe(receipt);
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/v1/ops/asset-placements/placement%2Fone/end', method: 'POST', body: { reason: '管理员实际出柜' }, aggregateVersion: '"v6"', idempotencyKey: 'original-out-key-001' });
  });
  it('translates definite precondition failures without treating unknown writes as refreshable', () => {
    const problem = (status: number, code: string) => new ApiProblem(status, { code, message: 'synthetic', request_id: 'synthetic' });
    expect(cabinetManagementFailure(problem(412, 'PRECONDITION_FAILED'), true)).toMatchObject({ uncertain: false, refreshRequired: true });
    for (const error of [problem(0, 'REQUEST_TIMEOUT'), problem(500, 'STORE_UNAVAILABLE'), problem(409, 'IDEMPOTENCY_PENDING'), problem(412, 'IDEMPOTENCY_PENDING'), new Error('synthetic transport loss')]) {
      const result = cabinetManagementFailure(error, true);
      expect(result.uncertain).toBe(true);
      expect(result.refreshRequired).not.toBe(true);
    }
    expect(cabinetManagementFailure(problem(403, 'PERMISSION_DENIED'), true).refreshRequired).toBe(false);
  });
  it('identifies a duplicate device only from its definite conflict detail', () => {
    const duplicate = new ApiProblem(409, { code: 'RESOURCE_CONFLICT', message: 'synthetic', request_id: 'synthetic', details: { resource_type: 'CABINET_DEVICE_EXISTS' } });
    expect(cabinetManagementFailure(duplicate, true)).toEqual({ uncertain: false, message: '设备编号已存在，请使用已录入的租赁柜或核对设备编号。' });
    for (const [status, code, resourceType] of [[409, 'RESOURCE_CONFLICT', 'rental_cabinet'], [409, 'RESOURCE_CONFLICT', 'ASSET_PUBLICATION_BLOCKED'], [409, 'IDEMPOTENCY_PENDING', 'CABINET_DEVICE_EXISTS'], [500, 'RESOURCE_CONFLICT', 'CABINET_DEVICE_EXISTS']] as const) {
      const result = cabinetManagementFailure(new ApiProblem(status, { code, message: 'synthetic', request_id: 'synthetic', details: { resource_type: resourceType } }), true);
      expect(result.message).not.toContain('设备编号已存在');
      expect(result.uncertain).toBe(status >= 500 || code === 'IDEMPOTENCY_PENDING');
    }
  });
  it('distinguishes ALL phone verification from a cabinet version conflict and preserves recovery guidance', () => {
    const phone = new ApiProblem(403, { code: 'REAUTHENTICATION_REQUIRED', message: 'synthetic', request_id: 'synthetic' });
    const failure = cabinetManagementFailure(phone, true, 'open-all');
    expect(failure).toEqual({ uncertain: false, message: '请使用当前管理员手机号完成短信验证登录，随后重新发起管理员全开；若仍失败，请核对管理员手机号配置。' });
    expect(failure.message).not.toContain('版本已变化');
    expect(cabinetManagementFailure(phone, true).message).toContain('5 分钟内提交恢复');
    const version = new ApiProblem(412, { code: 'PRECONDITION_FAILED', message: 'synthetic', request_id: 'synthetic' });
    expect(cabinetManagementFailure(version, true, 'open-all')).toMatchObject({ uncertain: false, refreshRequired: true, message: '版本已变化，请关闭表单、刷新柜机后重新确认。' });
  });
  it('uses only the current cabinet routes and keeps cabinet and command ETags distinct', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = createCabinetManagement({ request } as ApiClient);
    const cabinet = { cabinet_id: 'cab_test', version: 7 } as ManagedCabinet;
    const command = { command_id: 'cmd_test', version: 11 } as ManagedCabinetCommand;
    const reason = { reason: '合成安全测试' };
    await api.observe(cabinet.cabinet_id, reason, 'observe-original-01');
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/cabinets/cab_test/observation-refreshes', method: 'POST', body: reason, idempotencyKey: 'observe-original-01' });
    await api.openOne(cabinet, 2, 'maintenance-single-01');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/cabinets/cab_test/compartments/2/maintenance-open-commands', aggregateVersion: '"v7"', idempotencyKey: 'maintenance-single-01' }));
    await api.openAllChallenge(cabinet, { ...reason, on_site_responsible: '合成管理员', confirmed_device_id: '123456' }, 'challenge-key-001');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/cabinets/cab_test/open-all-challenges', aggregateVersion: '"v7"' }));
    await api.openAll(cabinet, { challenge_id: 'synthetic-challenge', proof: '135790' }, 'proof-original-01');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/cabinets/cab_test/open-all-commands', aggregateVersion: '"v7"', body: { challenge_id: 'synthetic-challenge', proof: '135790' } }));
    const signal = new AbortController().signal;
    await api.command(command.command_id, { signal });
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/cabinet-commands/cmd_test', signal });
    await api.recover(command, { ...reason, on_site_responsible: '合成管理员', evidence_material_ids: ['mat_test'], disposition: 'SAFE_TO_RELEASE_WITHOUT_REPLAY' }, 'recovery-key-001');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/cabinet-commands/cmd_test/recovery-records', aggregateVersion: '"v11"' }));
    expect(request).toHaveBeenCalledTimes(6);
  });
  it('uses one selected cursor page, no all-cabinet fan-out or mock inventory reads', async () => {
    const result = { items: [], page: { has_more: true, next_cursor: 'next' } };
    const request = vi.fn().mockResolvedValue(result);
    const api = createCabinetManagement({ request } as ApiClient);
    const signal = new AbortController().signal;
    await expect(api.list({ cursor: 'prior+cursor', merchantId: 'merchant-1', keyword: ' 南山 ', lifecycle: 'ACTIVE', connectivity: 'ONLINE', occupancy: 'AVAILABLE' }, { signal })).resolves.toBe(result);
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/v1/ops/cabinets?page_size=20&cursor=prior%2Bcursor&merchant_id=merchant-1&keyword=%E5%8D%97%E5%B1%B1&lifecycle_status=ACTIVE&connectivity_status=ONLINE&occupancy=AVAILABLE', signal });
    await api.compartments('cab_test', { signal });
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/cabinets/cab_test/compartments', signal });
  });
  it('keeps original ETag and idempotency key after an unknown write', async () => {
    const unknown = new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: 'test', request_id: 'test' });
    const request = vi.fn().mockRejectedValue(unknown);
    const api = createCabinetManagement({ request } as ApiClient);
    const cabinet = { cabinet_id: 'cab_test', version: 7, topology_version: 3 } as ManagedCabinet;
    const body = { target_count: 4, reason: '现场扩容', physical_layout_confirmed: true } as const;
    await expect(api.adjust(cabinet, body, 'same-intent-123456')).rejects.toBe(unknown);
    expect(request).toHaveBeenCalledTimes(1);
    await expect(api.adjust(cabinet, body, 'same-intent-123456')).rejects.toBe(unknown);
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/cabinets/cab_test/compartment-adjustments', method: 'POST', body, idempotencyKey: 'same-intent-123456', aggregateVersion: '"v7"' });
  });
  it('navigation read aliases never manufacture open or manage grants', () => {
    expect(canAccessApiPath(['ops.cabinets.read'], '/cabinets')).toBe(true);
    expect(hasApiPermission(['ops.cabinets.read'], 'cabinet.view')).toBe(true);
    expect(hasApiPermission(['ops.cabinets.manage'], 'cabinet.open')).toBe(false);
    expect(canAccessApiPath(['cabinet.view'], '/cabinets')).toBe(false);
  });
  it('confirms a stale device online before reading the target door, without opening it', async () => {
    const cabinet = { cabinet_id: 'cab_test', version: 8, connectivity_status: 'ONLINE', connectivity_stale: false } as ManagedCabinet;
    const get = vi.fn().mockResolvedValueOnce({ ...cabinet, connectivity_stale: true }).mockResolvedValue(cabinet);
    const gateway = {
      get,
      queryOnline: vi.fn().mockResolvedValue({ query_id: 'online_1' }),
      queryDoor: vi.fn().mockResolvedValue({ query_id: 'door_1' }),
      providerQuery: vi.fn().mockImplementation(async (_id: string, queryId: string) => queryId === 'online_1'
        ? { query_id: queryId, status: 'SUCCEEDED', connectivity_status: 'ONLINE' }
        : { query_id: queryId, status: 'SUCCEEDED', door_status: 'CLOSED' }),
      openOne: vi.fn(),
    } as unknown as CabinetManagementGateway;
    await expect(confirmCabinetDoorClosed(gateway, 'cab_test', 4)).resolves.toBe(cabinet);
    expect(gateway.queryOnline).toHaveBeenCalledOnce();
    expect(gateway.queryDoor).toHaveBeenCalledWith(cabinet, 4, expect.any(String));
    expect(gateway.openOne).not.toHaveBeenCalled();
  });
});

function allDoorFixture(count = 3) {
  const cabinet = { cabinet_id: 'cab_all', provider_device_id: '481427234', provider_mode: 'REAL', version: 7,
    compartment_count: count, topology_version: 2, topology_verification: 'OPERATOR_CONFIRMED', topology_confirmed_version: 2,
    active_command_id: null, lifecycle_status: 'ACTIVE', connectivity_status: 'ONLINE', connectivity_stale: false } as ManagedCabinet;
  const slots = Array.from({ length: count }, (_, index) => ({ compartment_id: `slot_${index + 1}`, cabinet_id: cabinet.cabinet_id,
    compartment_no: index + 1, service_status: 'ACTIVE', business_occupancy_status: 'AVAILABLE', occupant: null,
    topology_status: 'IN_TOPOLOGY', last_topology_version: 2, retired_at: null, door_status: 'CLOSED',
    door_observed_at: new Date(Date.now() - 120_000).toISOString(), door_observation_source: 'MANUAL_REFRESH', door_error_code: null } as ManagedCompartment));
  let current = cabinet;
  let completed = false;
  const action = { action: 'OPEN_ALL', enabled: false, reason_code: 'CABINET_NOT_READY' } as CabinetProviderAction;
  const observation = { command_id: 'observe_all_original', cabinet_id: cabinet.cabinet_id, command_type: 'OBSERVE_CABINET', topology_version: 2,
    created_at: new Date().toISOString(), execution_status: 'REQUESTED', resolution_status: 'UNRESOLVED', observation_status: 'NOT_OBSERVED',
    targets: slots.map((slot) => ({ compartment_id: slot.compartment_id, compartment_no: slot.compartment_no })) } as ManagedCabinetCommand;
  const gateway = {
    get: vi.fn().mockImplementation(async () => current),
    compartments: vi.fn().mockResolvedValue({ items: slots }),
    providerActions: vi.fn().mockImplementation(async () => ({ items: [{ ...action, enabled: completed }] })),
    queryOnline: vi.fn().mockResolvedValue({ query_id: 'online_original' }),
    providerQuery: vi.fn().mockResolvedValue({ query_id: 'online_original', cabinet_id: cabinet.cabinet_id, status: 'SUCCEEDED', connectivity_status: 'ONLINE' }),
    observe: vi.fn().mockImplementation(async () => { current = { ...cabinet, version: 8 }; return observation; }),
    command: vi.fn().mockImplementation(async () => {
      completed = true;
      slots.forEach((slot) => { slot.door_observed_at = new Date().toISOString(); });
      return { ...observation, execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'CLOSED' };
    }),
    queryDoor: vi.fn(), openAll: vi.fn(), openAllChallenge: vi.fn(),
  } as unknown as CabinetManagementGateway;
  return { cabinet, slots, action, observation, gateway };
}

describe('administrator all-door preflight', () => {
  it('observes exactly the configured ten targets through one original command and returns fresh CAS', async () => {
    const { cabinet, gateway } = allDoorFixture(10);
    await expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).resolves.toMatchObject({ version: 8 });
    expect(gateway.observe).toHaveBeenCalledExactlyOnceWith(cabinet.cabinet_id, { reason: '管理员全开前核查全部配置格口门态' }, expect.any(String));
    expect(gateway.command).toHaveBeenCalledExactlyOnceWith('observe_all_original');
    expect(gateway.providerQuery).toHaveBeenCalledExactlyOnceWith(cabinet.cabinet_id, 'online_original');
    expect(gateway.queryDoor).not.toHaveBeenCalled();
    expect(gateway.openAll).not.toHaveBeenCalled();
  });
  it.each(['UNKNOWN', 'OPEN'] as const)('rejects a completed observation with %s facts', async (door) => {
    const { cabinet, slots, gateway } = allDoorFixture();
    vi.mocked(gateway.command).mockResolvedValue({ command_id: 'observe_all_original', cabinet_id: cabinet.cabinet_id,
      command_type: 'OBSERVE_CABINET', topology_version: 2, targets: slots.map((slot) => ({ compartment_id: slot.compartment_id, compartment_no: slot.compartment_no })),
      execution_status: door === 'OPEN' ? 'ACCEPTED' : 'UNKNOWN', resolution_status: 'SAFE_RELEASED', observation_status: door === 'OPEN' ? 'ALL_OPEN' : 'INCOMPLETE' } as ManagedCabinetCommand);
    await expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).rejects.toThrow('全部格口未确认门关');
    expect(gateway.openAll).not.toHaveBeenCalled();
  });
  it('rejects a truncated target set and does not start a replacement observation', async () => {
    const { cabinet, observation, gateway } = allDoorFixture(10);
    vi.mocked(gateway.observe).mockResolvedValue({ ...observation, targets: observation.targets.slice(0, 9) });
    await expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).rejects.toThrow('观察目标与当前配置不一致');
    expect(gateway.observe).toHaveBeenCalledOnce(); expect(gateway.command).not.toHaveBeenCalled();
  });
  it('waits for the original observation to release, then respects server capability refusal', async () => {
    const { cabinet, observation, gateway } = allDoorFixture();
    vi.mocked(gateway.command).mockResolvedValueOnce({ ...observation, execution_status: 'DISPATCHING' });
    vi.mocked(gateway.providerActions).mockResolvedValue({ items: [{ action: 'OPEN_ALL', enabled: false, reason_code: 'CABINET_NOT_READY' } as CabinetProviderAction] });
    vi.useFakeTimers();
    try {
      const pending = expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).rejects.toThrow('资格已变化');
      await vi.advanceTimersByTimeAsync(750);
      await pending;
      expect(gateway.command).toHaveBeenCalledTimes(2);
      expect(vi.mocked(gateway.command).mock.calls.every(([id]) => id === observation.command_id)).toBe(true);
      expect(gateway.observe).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it('times out the original queued online query without observing or dispatching', async () => {
    const { cabinet, gateway } = allDoorFixture();
    vi.mocked(gateway.providerQuery).mockResolvedValue({ query_id: 'online_original', status: 'QUEUED' } as CabinetProviderQuery);
    vi.useFakeTimers();
    try {
      const pending = expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).rejects.toThrow('在线核查超时');
      await vi.advanceTimersByTimeAsync(26_000);
      await pending;
      expect(gateway.queryOnline).toHaveBeenCalledOnce(); expect(gateway.observe).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('stops immediately when cancelled after an observation request resolves', async () => {
    const { cabinet, observation, gateway } = allDoorFixture();
    let active = true;
    vi.mocked(gateway.observe).mockImplementation(async () => { active = false; return observation; });
    await expect(confirmCabinetAllDoorsClosed(gateway, cabinet, undefined, () => active)).rejects.toThrow('已取消');
    expect(gateway.command).not.toHaveBeenCalled(); expect(gateway.openAll).not.toHaveBeenCalled();
  });
  it('rejects stale stored door facts even when the observation command reports CLOSED', async () => {
    const { cabinet, slots, gateway } = allDoorFixture();
    const stale = slots.map((slot) => ({ ...slot }));
    vi.mocked(gateway.compartments).mockResolvedValueOnce({ items: slots }).mockResolvedValue({ items: stale });
    await expect(confirmCabinetAllDoorsClosed(gateway, cabinet)).rejects.toThrow('未获近期确认');
  });
  it('preserves real topology, occupancy, service, provider and permission blocks before preflight', () => {
    const { cabinet, slots, action } = allDoorFixture();
    expect(canPreflightCabinetOpenAll(cabinet, slots, action)).toBe(true);
    for (const change of [{ provider_mode: 'DISABLED' }, { lifecycle_status: 'INACTIVE' }, { active_command_id: 'other-command' },
      { topology_verification: 'REQUIRED' }, { topology_confirmed_version: 1 }, { compartment_count: 4 }]) {
      expect(canPreflightCabinetOpenAll({ ...cabinet, ...change } as ManagedCabinet, slots, action)).toBe(false);
    }
    for (const change of [{ service_status: 'OUT_OF_SERVICE' }, { business_occupancy_status: 'OCCUPIED' },
      { business_occupancy_status: 'RESERVED' }, { business_occupancy_status: 'UNKNOWN' }, { last_topology_version: 1 },
      { occupant: { asset_id: 'bound-asset', asset_no: 'bound', display_name: 'bound' } }]) {
      expect(canPreflightCabinetOpenAll(cabinet, [{ ...slots[0], ...change } as ManagedCompartment, ...slots.slice(1)], action)).toBe(false);
    }
    expect(canPreflightCabinetOpenAll(cabinet, slots, { ...action, reason_code: 'PERMISSION_DENIED' })).toBe(false);
    expect(canPreflightCabinetOpenAll(cabinet, slots, { ...action, reason_code: 'PROVIDER_UNAVAILABLE' })).toBe(false);
    const fresh = slots.map((slot) => ({ ...slot, door_observed_at: new Date().toISOString() }));
    expect(canPreflightCabinetOpenAll(cabinet, fresh, action)).toBe(false);
  });
});
