import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CabinetManagementGateway, ManagedCabinet, ManagedCabinetCommand, ManagedCompartment } from '../../shared/services/cabinetManagement';
import * as cabinetManagement from '../../shared/services/cabinetManagement';
import { CabinetApiCommands } from './CabinetApiCommands';

vi.mock('tdesign-react', async (importOriginal) => ({
  ...await importOriginal<typeof import('tdesign-react')>(),
  MessagePlugin: { info: vi.fn().mockResolvedValue(null) },
  Select: ({ 'aria-label': label, value, options, disabled, onChange }: {
    'aria-label'?: string; value: number | string; options: { label: string; value: number; disabled?: boolean }[];
    disabled?: boolean; onChange: (value: number) => void;
  }) => <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
    <option value="">选择格口</option>
    {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
  </select>,
}));

const cabinet = { cabinet_id: 'cab_single', provider_device_id: '481427234', version: 7, active_command_id: null, lifecycle_status: 'ACTIVE', connectivity_status: 'ONLINE', connectivity_stale: false } as ManagedCabinet;
const slot = { compartment_id: 'slot_2', compartment_no: 2, topology_status: 'IN_TOPOLOGY', service_status: 'ACTIVE', business_occupancy_status: 'AVAILABLE', door_status: 'CLOSED', door_observed_at: new Date().toISOString() } as ManagedCompartment;
const command = { command_id: 'cmd_single', execution_status: 'REQUESTED', observation_status: 'UNKNOWN', observed_open_count: 0, targets: [{ compartment_no: 2 }] } as unknown as ManagedCabinetCommand;

function show(openOne: ReturnType<typeof vi.fn>, queryStatus: 'SUCCEEDED' | 'UNKNOWN' = 'SUCCEEDED', staleEligibility = false, dispatched = false) {
  const readyActions = { items: [
    { action: 'ONLINE', enabled: false }, { action: 'DOOR_QUERY', enabled: false },
    { action: 'OPEN_ONE', enabled: true }, { action: 'OPEN_ALL', enabled: false },
  ] };
  const gateway = {
    providerActions: vi.fn().mockResolvedValueOnce(staleEligibility ? { items: readyActions.items.map((item) => item.action === 'OPEN_ONE' ? { ...item, enabled: false, reason_code: 'CABINET_NOT_READY', message: '当前状态不满足操作条件，请刷新柜机与格口' } : item) } : readyActions).mockResolvedValue(readyActions),
    openOne,
    get: vi.fn().mockResolvedValue(cabinet),
    compartments: vi.fn().mockResolvedValue({ items: [slot] }),
    queryDoor: vi.fn().mockResolvedValue({ query_id: 'query_preopen', status: 'QUEUED' }),
    providerQuery: vi.fn().mockResolvedValue({ query_id: 'query_preopen', status: queryStatus, kind: 'DOOR_QUERY', door_status: queryStatus === 'SUCCEEDED' ? 'CLOSED' : 'UNKNOWN' }),
    command: vi.fn().mockResolvedValue(dispatched ? { ...command, command_type: 'OPEN_ONE', execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'INCOMPLETE', version: 2, accepted_at: new Date().toISOString() } : command),
  } as unknown as CabinetManagementGateway;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (disabled: boolean) => <QueryClientProvider client={client}><CabinetApiCommands cabinet={cabinet} slots={[slot]} gateway={gateway} accountId="synthetic-admin" visible disabled={disabled} onBusyChange={vi.fn()} /></QueryClientProvider>;
  const shown = render(view(false));
  return Object.assign(gateway, { setDisabled: (disabled: boolean) => shown.rerender(view(disabled)) });
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('administrator single compartment open', () => {
  it('submits directly without site lead or safety confirmation fields', async () => {
    const openOne = vi.fn().mockResolvedValue(command);
    const gateway = show(openOne);
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '单格开门' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(openOne).toHaveBeenCalledOnce());
    expect(gateway.queryDoor).toHaveBeenCalledOnce();
    expect(openOne).toHaveBeenCalledWith(cabinet, 2, expect.any(String));
    expect(screen.queryByText('现场负责人')).not.toBeInTheDocument();
    expect(screen.queryByText('请先确认现场环境、人员与柜内物品安全')).not.toBeInTheDocument();
  });

  it('reuses the original request after an uncertain response', async () => {
    const openOne = vi.fn()
      .mockRejectedValueOnce(new Error('synthetic transport loss'))
      .mockResolvedValueOnce(command);
    const gateway = show(openOne);
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '单格开门' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const retry = await screen.findByRole('button', { name: '用原请求核对单格开门' });
    fireEvent.click(retry);
    await waitFor(() => expect(openOne).toHaveBeenCalledTimes(2));
    expect(openOne.mock.calls[1]).toEqual(openOne.mock.calls[0]);
    expect(gateway.queryDoor).toHaveBeenCalledOnce();
  });

  it('pauses original single-open recovery while disabled and retains its request for read recovery', async () => {
    const openOne = vi.fn().mockRejectedValueOnce(new Error('synthetic transport loss')).mockResolvedValue(command);
    const gateway = show(openOne);
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const open = screen.getByRole('button', { name: '单格开门' });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const retry = await screen.findByRole('button', { name: '用原请求核对单格开门' });
    gateway.setDisabled(true);
    expect(retry).toBeDisabled(); fireEvent.click(retry);
    expect(openOne).toHaveBeenCalledTimes(1);
    gateway.setDisabled(false); fireEvent.click(retry);
    await waitFor(() => expect(openOne).toHaveBeenCalledTimes(2));
    expect(openOne.mock.calls[1]).toEqual(openOne.mock.calls[0]);
    expect(gateway.queryDoor).toHaveBeenCalledOnce();
  });

  it('does not submit an open command when the preflight door result is unknown', async () => {
    const openOne = vi.fn().mockResolvedValue(command);
    show(openOne, 'UNKNOWN');
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '单格开门' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText('格口 2 未确认门关，未提交后续操作。')).toBeInTheDocument();
    expect(openOne).not.toHaveBeenCalled();
  });

  it('allows one click to recheck a stale door before opening', async () => {
    const openOne = vi.fn().mockResolvedValue(command);
    const gateway = show(openOne, 'SUCCEEDED', true);
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '单格开门' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(openOne).toHaveBeenCalledOnce());
    expect(gateway.queryDoor).toHaveBeenCalledOnce();
  });

  it('shows call success and refreshes worker observations without another provider door request', async () => {
    const openOne = vi.fn().mockResolvedValue(command);
    const gateway = show(openOne, 'SUCCEEDED', true, true);
    fireEvent.change(screen.getByLabelText('单格开门目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '单格开门' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText(/门态已过期/)).not.toBeInTheDocument();
    expect(screen.queryByText(/单格开门：当前状态不满足操作条件/)).not.toBeInTheDocument();
    fireEvent.click(button);
    await screen.findByText(/调用结果 调用成功/);
    expect(gateway.queryDoor).toHaveBeenCalledOnce();
    expect(openOne).toHaveBeenCalledOnce();
    expect(gateway.queryDoor).toHaveBeenLastCalledWith(cabinet, 2, expect.any(String));
    expect(screen.queryByText(/已观察打开/)).not.toBeInTheDocument();
  });
});

function showAll(stale = false, overrides: Partial<CabinetManagementGateway> = {}) {
  const allCabinet = { ...cabinet, provider_mode: 'REAL', compartment_count: 2, topology_version: 2,
    topology_verification: 'OPERATOR_CONFIRMED', topology_confirmed_version: 2 } as ManagedCabinet;
  const allSlots = [1, 2].map((number) => ({ ...slot, compartment_id: `slot_${number}`, cabinet_id: cabinet.cabinet_id,
    compartment_no: number, last_topology_version: 2, retired_at: null, occupant: null,
    door_observed_at: new Date(Date.now() - 120_000).toISOString(), door_observation_source: 'MANUAL_REFRESH', door_error_code: null } as ManagedCompartment));
  const challenge = { challenge_id: 'challenge_1', delivery_status: 'SENT', status: 'PENDING', expires_at: new Date(Date.now() + 300_000).toISOString(), remaining_attempts: 3, masked_destination: '+86138****0000' };
  const allCommand = { ...command, command_id: 'cmd_all', command_type: 'OPEN_ALL', execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'INCOMPLETE', accepted_at: new Date().toISOString(), version: 3, targets: [{ compartment_id: 'slot_2', compartment_no: 2 }, { compartment_id: 'slot_1', compartment_no: 1 }] };
  let current = allCabinet;
  let observations = 0;
  let completed = 0;
  const observation = (id: string) => ({ command_id: id, cabinet_id: cabinet.cabinet_id, command_type: 'OBSERVE_CABINET', topology_version: 2,
    created_at: new Date().toISOString(), execution_status: 'REQUESTED', resolution_status: 'UNRESOLVED', observation_status: 'NOT_OBSERVED',
    targets: allSlots.map((item) => ({ compartment_id: item.compartment_id, compartment_no: item.compartment_no })) } as ManagedCabinetCommand);
  const gateway = {
    get: vi.fn().mockImplementation(async () => current), compartments: vi.fn().mockResolvedValue({ items: allSlots }),
    providerActions: vi.fn().mockImplementation(async () => ({ items: [{ action: 'OPEN_ALL', enabled: !stale || (completed > 0 && completed === observations), reason_code: 'CABINET_NOT_READY', message: '当前状态不满足操作条件，请刷新柜机与格口' }] })),
    queryOnline: vi.fn().mockResolvedValue({ query_id: 'online_all' }),
    providerQuery: vi.fn().mockResolvedValue({ query_id: 'online_all', cabinet_id: cabinet.cabinet_id, status: 'SUCCEEDED', kind: 'ONLINE_QUERY', connectivity_status: 'ONLINE' }),
    observe: vi.fn().mockImplementation(async () => { observations++; current = { ...current, version: current.version + 1 }; return observation(`preflight_${observations}`); }),
    openAllChallenge: vi.fn().mockResolvedValue(challenge), getOpenAllChallenge: vi.fn().mockResolvedValue(challenge),
    openAll: vi.fn().mockResolvedValue({ ...allCommand, execution_status: 'REQUESTED' }),
    command: vi.fn().mockImplementation(async (id: string) => {
      if (!id.startsWith('preflight_')) return allCommand;
      completed = observations;
      allSlots.forEach((item) => { item.door_observed_at = new Date().toISOString(); });
      return { ...observation(id), execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'CLOSED' };
    }), queryDoor: vi.fn(), openOne: vi.fn(), ...overrides,
  } as unknown as CabinetManagementGateway;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const contents = (disabled: boolean) => <QueryClientProvider client={client}><CabinetApiCommands cabinet={allCabinet} slots={allSlots} gateway={gateway} accountId="synthetic-admin" visible disabled={disabled} onBusyChange={vi.fn()} /></QueryClientProvider>;
  const view = render(contents(false));
  return { gateway, client, invalidate, view, observation, allSlots, setDisabled: (disabled: boolean) => view.rerender(contents(disabled)) };
}
async function requestAllChallenge() {
  const begin = screen.getByRole('button', { name: '管理员全开' });
  await waitFor(() => expect(begin).toBeEnabled()); fireEvent.click(begin);
  fireEvent.change(screen.getByLabelText(/操作原因/), { target: { value: '管理员实际测试全开' } });
  fireEvent.change(screen.getByLabelText(/现场负责人/), { target: { value: '测试管理员' } });
  fireEvent.change(screen.getByLabelText(/重新输入设备编号/), { target: { value: cabinet.provider_device_id } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
}

describe('administrator open all', () => {
  it('blocks an already opened confirmation while disabled and resumes the existing challenge after recovery', async () => {
    const { gateway, setDisabled } = showAll();
    await requestAllChallenge();
    fireEvent.change(await screen.findByLabelText(/六位验证码/), { target: { value: '135790' } });
    const confirm = screen.getByRole('button', { name: '确认管理员全开' });
    setDisabled(true); expect(confirm).toBeDisabled(); fireEvent.click(confirm);
    expect(gateway.openAll).not.toHaveBeenCalled();
    expect(gateway.observe).toHaveBeenCalledOnce();
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce();
    setDisabled(false); fireEvent.click(confirm);
    await waitFor(() => expect(gateway.openAll).toHaveBeenCalledOnce());
    expect(gateway.openAll).toHaveBeenCalledWith(expect.any(Object), { challenge_id: 'challenge_1', proof: '135790' }, expect.any(String));
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce();
  });

  it('stops a pending all-open preflight if its parent becomes disabled before challenge submission', async () => {
    const { gateway, observation, setDisabled } = showAll();
    let complete!: (value: ManagedCabinetCommand) => void;
    vi.mocked(gateway.observe).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    await requestAllChallenge();
    await waitFor(() => expect(gateway.observe).toHaveBeenCalledOnce());
    setDisabled(true);
    await act(async () => { complete(observation('preflight_1')); });
    await waitFor(() => expect(screen.getByRole('button', { name: '获取验证码' })).not.toHaveClass('t-is-loading'));
    expect(screen.getByRole('button', { name: '获取验证码' })).toBeDisabled();
    expect(gateway.openAllChallenge).not.toHaveBeenCalled(); expect(gateway.openAll).not.toHaveBeenCalled();
  });

  it('shows the current OPS phone verification refusal without requesting a replacement challenge or opening', async () => {
    const rejected = Object.assign(new Error('synthetic OPS phone verification refusal'), { status: 403 });
    const message = '请使用当前管理员手机号完成短信验证登录，随后重新发起管理员全开；若仍失败，请核对管理员手机号配置。';
    const classify = vi.spyOn(cabinetManagement, 'cabinetManagementFailure').mockReturnValue({ uncertain: false, message });
    const { gateway } = showAll(false, { openAllChallenge: vi.fn().mockRejectedValue(rejected) });
    await requestAllChallenge();
    await screen.findByText(message);
    expect(classify).toHaveBeenCalledWith(rejected, true, 'open-all');
    expect(screen.queryByText(/版本已变化/)).not.toBeInTheDocument();
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce();
    expect(gateway.openAll).not.toHaveBeenCalled();
    expect(gateway.observe).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(/六位验证码/)).not.toBeInTheDocument();
  });
  it('checks stale facts before the challenge and again after OTP waiting, preserving the challenge and fresh CAS', async () => {
    const { gateway, invalidate } = showAll(true);
    await requestAllChallenge();
    const proof = await screen.findByLabelText(/六位验证码/);
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce();
    expect(gateway.openAllChallenge).toHaveBeenCalledWith(expect.objectContaining({ version: 8 }), expect.objectContaining({ confirmed_device_id: cabinet.provider_device_id }), expect.any(String));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 120_000);
    fireEvent.change(proof, { target: { value: '135790' } });
    const confirm = screen.getByRole('button', { name: '确认管理员全开' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByText(/调用结果 调用成功.*目标格口 2、1/);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cabinet-management', 'synthetic-admin', 'slots', cabinet.cabinet_id] }));
    expect(gateway.openAll).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ version: 9 }), { challenge_id: 'challenge_1', proof: '135790' }, expect.any(String));
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce(); expect(gateway.observe).toHaveBeenCalledTimes(2); expect(gateway.queryOnline).toHaveBeenCalledTimes(2);
    expect(gateway.getOpenAllChallenge).toHaveBeenCalledWith(cabinet.cabinet_id, 'challenge_1');
    expect(gateway.openOne).not.toHaveBeenCalled(); expect(gateway.queryDoor).not.toHaveBeenCalled();
    expect(screen.queryByText(/已观察打开/)).not.toBeInTheDocument();
  });
  it('does not request a challenge when a configured target is OPEN or unknown', async () => {
    const { gateway, observation } = showAll(true);
    vi.mocked(gateway.command).mockImplementation(async (id) => ({ ...observation(id), execution_status: 'UNKNOWN', resolution_status: 'SAFE_RELEASED', observation_status: 'INCOMPLETE' }));
    await requestAllChallenge();
    await screen.findByText(/全部格口未确认门关/);
    expect(gateway.openAllChallenge).not.toHaveBeenCalled(); expect(gateway.openAll).not.toHaveBeenCalled(); expect(gateway.observe).toHaveBeenCalledOnce();
  });
  it('retains the original challenge when the proof preflight cannot confirm CLOSED', async () => {
    const { gateway, observation } = showAll();
    await requestAllChallenge();
    const proof = await screen.findByLabelText(/六位验证码/);
    vi.mocked(gateway.command).mockImplementation(async (id) => ({ ...observation(id), execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'PARTIAL_OPEN' }));
    fireEvent.change(proof, { target: { value: '135790' } }); fireEvent.click(screen.getByRole('button', { name: '确认管理员全开' }));
    await screen.findByText(/全部格口未确认门关/);
    expect(screen.getByLabelText(/六位验证码/)).toHaveValue('135790');
    expect(gateway.openAllChallenge).toHaveBeenCalledOnce(); expect(gateway.openAll).not.toHaveBeenCalled(); expect(gateway.observe).toHaveBeenCalledTimes(2);
  });
  it('cancels an in-flight preflight and prevents duplicate or later challenge submission', async () => {
    const { gateway, observation } = showAll();
    let resolveObservation!: (value: ManagedCabinetCommand) => void;
    vi.mocked(gateway.observe).mockImplementation(() => new Promise((resolve) => { resolveObservation = resolve; }));
    await requestAllChallenge();
    await waitFor(() => expect(gateway.observe).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    expect(gateway.observe).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await act(async () => { resolveObservation(observation('preflight_1')); });
    await waitFor(() => expect(screen.queryByLabelText(/现场负责人/)).not.toBeInTheDocument());
    expect(gateway.openAllChallenge).not.toHaveBeenCalled(); expect(gateway.openAll).not.toHaveBeenCalled(); expect(gateway.command).not.toHaveBeenCalled();
  });
  it('does not repeat checks or physical writes after an unknown open-all response', async () => {
    const { gateway } = showAll(false, { openAll: vi.fn().mockRejectedValue(new Error('synthetic transport loss')) });
    await requestAllChallenge();
    fireEvent.change(await screen.findByLabelText(/六位验证码/), { target: { value: '135790' } });
    fireEvent.click(screen.getByRole('button', { name: '确认管理员全开' }));
    await screen.findByText('请求结果尚未确认。已停止重复提交；请核对柜门与原命令记录。');
    const blocked = screen.getByRole('button', { name: '管理员全开' }); expect(blocked).toBeDisabled(); fireEvent.click(blocked);
    expect(screen.getByLabelText(/六位验证码/)).toBeDisabled();
    expect(gateway.openAll).toHaveBeenCalledOnce(); expect(gateway.observe).toHaveBeenCalledTimes(2); expect(gateway.openAllChallenge).toHaveBeenCalledOnce();
  });
});

describe('provider door query', () => {
  it('refreshes compartment and action eligibility after the final provider result', async () => {
    const gateway = {
      providerActions: vi.fn().mockResolvedValue({ items: [
        { action: 'ONLINE', enabled: true }, { action: 'DOOR_QUERY', enabled: true },
        { action: 'OPEN_ONE', enabled: false }, { action: 'OPEN_ALL', enabled: false },
      ] }),
      queryDoor: vi.fn().mockResolvedValue({ query_id: 'query_1', status: 'QUEUED' }),
      providerQuery: vi.fn().mockResolvedValue({ query_id: 'query_1', status: 'SUCCEEDED', kind: 'DOOR_QUERY', door_status: 'CLOSED' }),
    } as unknown as CabinetManagementGateway;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(<QueryClientProvider client={client}><CabinetApiCommands cabinet={cabinet} slots={[slot]} gateway={gateway} accountId="synthetic-admin" visible disabled={false} onBusyChange={vi.fn()} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('箱门信息目标格口'), { target: { value: '2' } });
    const button = await screen.findByRole('button', { name: '查询箱门信息' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(gateway.providerQuery).toHaveBeenCalledWith(cabinet.cabinet_id, 'query_1', expect.any(Object)));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cabinet-management', 'synthetic-admin', 'slots', cabinet.cabinet_id] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cabinet-management', 'synthetic-admin', 'provider-actions', cabinet.cabinet_id] });
  });
});
