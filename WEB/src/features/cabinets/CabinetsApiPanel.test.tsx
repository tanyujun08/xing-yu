import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CabinetsApiPanel } from './CabinetsPage';

const fixture = vi.hoisted(() => ({
  session: { accountId: 'synthetic-ops', accessToken: 'synthetic-token', permissions: [] as string[] },
  services: { cabinetManagement: { list: vi.fn(), get: vi.fn(), compartments: vi.fn(), create: vi.fn(), update: vi.fn(), activate: vi.fn(), adjust: vi.fn(), lifecycle: vi.fn(), stockingOptions: vi.fn(), placeAsset: vi.fn(), providerActions: vi.fn(), providerOperations: vi.fn(), providerQuery: vi.fn(), queryOnline: vi.fn(), queryDoor: vi.fn(), openOne: vi.fn(), openAllChallenge: vi.fn(), getOpenAllChallenge: vi.fn(), openAll: vi.fn(), command: vi.fn(), recover: vi.fn(), miniProgramCode: vi.fn(), syncCover: vi.fn() } },
}));
vi.mock('../../shared/access/session', () => ({ useSession: () => fixture.session, permissions: {} }));
vi.mock('../../shared/config/env', () => ({ apiIntegrationEnabled: true }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => fixture.services }));
const cabinet = {
  cabinet_id: 'cab_synthetic', provider_device_id: '123456', cabinet_name: '合成测试柜', compartment_count: 3, version: 1, topology_version: 1,
  lifecycle_status: 'INACTIVE', connectivity_status: 'UNKNOWN', connectivity_stale: true, last_success_at: null,
  deployment_site_address: null, provider_mode: 'DISABLED', topology_verification: 'REQUIRED', active_command_id: null,
  occupancy_summary: { current: 3, available: 2, reserved: 0, occupied: 1, out_of_service: 0 },
  allowed_actions: { update: false, activate: false, deactivate: false, archive: false, restore: false, resize: false, observe: false, open_one: false, open_all: false },
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.clearAllMocks(); fixture.session.permissions = ['ops.cabinets.read'];
  fixture.services.cabinetManagement.list.mockResolvedValue({ items: [cabinet], page: { page_size: 20, has_more: false }, statistics: { total: 1, active: 0, inactive: 1, archived: 0, online: 0, offline: 0, unknown: 1, occupied: 1, available: 1, full: 0 } });
  fixture.services.cabinetManagement.get.mockResolvedValue(cabinet);
  fixture.services.cabinetManagement.compartments.mockResolvedValue({ items: [
    { compartment_id: 'slot3', cabinet_id: 'cab_synthetic', compartment_no: 3, topology_status: 'RETIRED', business_occupancy_status: 'UNKNOWN', door_status: 'CLOSED', service_status: 'OUT_OF_SERVICE' },
  ] });
});
function show(path = '/cabinets') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const result = render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><CabinetsApiPanel /></QueryClientProvider></MemoryRouter>);
  return { ...result, client };
}
describe('API cabinet page', () => {
  it('retains an unknown cover intent across parent detail failure and recovers with the original key', async () => {
    fixture.session.permissions = ['ops.cabinets.read', 'ops.cabinets.manage', 'ops.assets.read', 'ops.assets.manage'];
    const ready = { ...cabinet, allowed_actions: { ...cabinet.allowed_actions, sync_cover: true } };
    fixture.services.cabinetManagement.get.mockResolvedValue(ready);
    fixture.services.cabinetManagement.providerActions.mockResolvedValue({ items: [] });
    fixture.services.cabinetManagement.syncCover.mockRejectedValueOnce(new Error('transport unknown')).mockResolvedValue({ sync_id: 'cover-existing' });
    const shown = show('/cabinets?cabinet_id=cab_synthetic');
    const operationsTab = await screen.findByRole('tab', { name: '设备操作' });
    const panel = within(operationsTab.closest('section')!);
    fireEvent.click(operationsTab);
    const cover = within(await panel.findByRole('region', { name: '封面同步' }));
    const sync = cover.getByRole('button', { name: '同步封面' });
    const stocking = panel.getByRole('button', { name: '资产入柜' });
    const inventoryTab = panel.getByRole('tab', { name: '在柜资产' });
    const history = panel.getByRole('button', { name: '查看运行记录' });
    await waitFor(() => expect(sync).toBeEnabled());
    expect(stocking).toBeEnabled();
    fireEvent.click(sync);
    const retry = await cover.findByRole('button', { name: '用原请求核对封面同步' });
    const original = fixture.services.cabinetManagement.syncCover.mock.calls[0];
    fixture.services.cabinetManagement.get.mockRejectedValue(new Error('detail transport failure'));
    await act(async () => { await shown.client.invalidateQueries({ queryKey: ['cabinet-management', 'synthetic-ops', 'detail', 'cab_synthetic'], exact: true }); });
    await panel.findByText('详情读取失败，操作已暂停，请刷新核对。');
    // Keep the original nodes: replacing/unmounting this scope must fail rather
    // than asserting a detached disabled button or finding a replacement.
    expect(retry).toBeInTheDocument();
    expect(sync).toBeInTheDocument();
    expect(stocking).toBeInTheDocument();
    expect(retry).toBeDisabled();
    expect(sync).toBeDisabled();
    expect(stocking).toBeDisabled();
    fireEvent.click(inventoryTab);
    expect(retry).toBeInTheDocument();
    expect(history).toBeInTheDocument();
    expect(history).toBeDisabled(); fireEvent.click(history);
    expect(retry).toBeInTheDocument();
    expect(fixture.services.cabinetManagement.syncCover).toHaveBeenCalledTimes(1);
    fixture.services.cabinetManagement.get.mockResolvedValue(ready);
    await act(async () => { await shown.client.invalidateQueries({ queryKey: ['cabinet-management', 'synthetic-ops', 'detail', 'cab_synthetic'], exact: true }); });
    expect(retry).toBeInTheDocument();
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(fixture.services.cabinetManagement.syncCover).toHaveBeenCalledTimes(2));
    expect(fixture.services.cabinetManagement.syncCover.mock.calls[1]).toEqual(original);
  });
  it.each([
    ['PRESENT', '1937D715', '2026-10-08T01:00:00Z', '1937D715'],
    ['ABSENT', null, '2026-10-08T01:00:00Z', '未检测到设备'],
    ['UNKNOWN', null, null, '未读取'],
    ['UNKNOWN', null, '2026-10-08T01:00:00Z', '待核实'],
  ] as const)('shows trusted RFID %s in the slot card without using registered RFID or changing occupancy', async (status, code, checkedAt, label) => {
    fixture.services.cabinetManagement.compartments.mockResolvedValue({ items: [{
      compartment_id: 'rfid-slot', cabinet_id: 'cab_synthetic', compartment_no: 2, topology_status: 'IN_TOPOLOGY',
      business_occupancy_status: 'OCCUPIED', door_status: 'CLOSED', service_status: 'ACTIVE',
      door_observed_at: '2026-10-08T02:00:00Z', door_observation_source: 'ADMIN_QUERY',
      rfid_status: status, observed_rfid_code: code, rfid_checked_at: checkedAt,
      occupant: { asset_id: 'rfid-asset', asset_no: 'AS-RFID', display_name: '登记在柜设备', credential_id: null, registered_rfid: 'ABCDEF12' },
    }] });
    show('/cabinets?cabinet_id=cab_synthetic');
    const measured = await screen.findByText(`实测 RFID：${label}`); const card = measured.closest('article')!;
    expect(card).toHaveClass('cabinet-box--occupied'); expect(within(card).getByText('登记在柜设备')).toBeInTheDocument();
    expect(within(card).getByText(checkedAt ? '最近查询：2026年10月8日 09:00:00' : '最近查询：尚未查询')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('ABCDEF12'); expect(card).not.toHaveTextContent('00000000'); expect(card).not.toHaveTextContent('供应商失败');
    expect(fixture.services.cabinetManagement.queryDoor).not.toHaveBeenCalled(); expect(fixture.services.cabinetManagement.openOne).not.toHaveBeenCalled();
  });

  it('never renders a plaintext pickup credential in cabinet or slot details and keeps the public code separate', async () => {
    fixture.session.permissions = ['ops.cabinets.read', 'ops.cabinets.qrcode.read'];
    // A stray legacy field must not become a display field or a copy action.
    fixture.services.cabinetManagement.compartments.mockResolvedValue({ items: [{
      compartment_id: 'credential-slot', cabinet_id: 'cab_synthetic', compartment_no: 2, topology_status: 'IN_TOPOLOGY',
      business_occupancy_status: 'OCCUPIED', door_status: 'CLOSED', service_status: 'ACTIVE',
      occupant: { asset_id: 'credential-asset', asset_no: 'AS-CREDENTIAL', display_name: '凭证隔离设备' },
      credential: { status: 'ACTIVE', pickup_code: '001234' },
    }] });
    show('/cabinets?cabinet_id=cab_synthetic'); await screen.findByText('凭证隔离设备');
    expect(screen.getByRole('button', { name: '查看柜体小程序码' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('credential-asset')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('001234');
    expect(screen.queryByRole('button', { name: /查看取件码|复制取件码|显示明文/ })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('001234')).not.toBeInTheDocument();
    expect(fixture.services.cabinetManagement.openOne).not.toHaveBeenCalled();
  });
  it('shows the active in-cabinet asset in the slot card and detail drawer', async () => {
    fixture.services.cabinetManagement.compartments.mockResolvedValue({ items: [{
      compartment_id: 'slot2', cabinet_id: 'cab_synthetic', compartment_no: 2, topology_status: 'IN_TOPOLOGY',
      business_occupancy_status: 'OCCUPIED', door_status: 'CLOSED', service_status: 'ACTIVE',
      occupant: { asset_id: 'asset-2', asset_no: 'XY-002', display_name: '官方设备二号' },
    }] });
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('官方设备二号');
    expect(screen.getByText('XY-002')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('资产 ID')).toBeInTheDocument();
    expect(screen.getByText('asset-2')).toBeInTheDocument();
    expect(screen.queryByText(/占用待核查/)).not.toBeInTheDocument();
  });
  it('flags an occupied slot without an active asset placement', async () => {
    fixture.services.cabinetManagement.compartments.mockResolvedValue({ items: [{
      compartment_id: 'slot2', cabinet_id: 'cab_synthetic', compartment_no: 2, topology_status: 'IN_TOPOLOGY',
      business_occupancy_status: 'OCCUPIED', door_status: 'CLOSED', service_status: 'ACTIVE', occupant: null,
    }] });
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('占用待核查');
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText(/业务状态与有效在柜资产记录不一致/)).toBeInTheDocument();
  });
  it('opens cabinet details in a drawer without legacy simulated controls', async () => {
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('格口 3');
    expect(screen.getByText('占用待核查')).toBeInTheDocument();
    expect(screen.getByText('格口 3').closest('.t-drawer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('已退出当前拓扑')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fake 测试/ })).not.toBeInTheDocument();
    expect(fixture.services.cabinetManagement.openAll).not.toHaveBeenCalled();
  });
  it('offers lifecycle actions beside each cabinet without sending a device command', async () => {
    fixture.session.permissions = ['ops.cabinets.read', 'ops.cabinets.manage'];
    fixture.services.cabinetManagement.list.mockResolvedValue({ items: [{ ...cabinet, allowed_actions: { ...cabinet.allowed_actions, update: true, activate: true } }], page: { page_size: 20, has_more: false }, statistics: { total: 1 } });
    fixture.services.cabinetManagement.get.mockResolvedValue({ ...cabinet, allowed_actions: { ...cabinet.allowed_actions, update: true, activate: true } });
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('格口 3');
    fireEvent.click(screen.getByText('柜机管理'));
    expect(screen.getByRole('button', { name: '编辑租赁柜' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启用租赁柜' })).toBeInTheDocument();
    expect(fixture.services.cabinetManagement.openOne).not.toHaveBeenCalled();
  });
  it('activates with a reason and a fresh server probe even when the cached observation is offline', async () => {
    fixture.session.permissions = ['ops.cabinets.read', 'ops.cabinets.manage'];
    const offline = { ...cabinet, provider_mode: 'REAL', connectivity_status: 'OFFLINE', allowed_actions: { ...cabinet.allowed_actions, activate: true }, activation_readiness: { eligible: false, blocking_items: ['CABINET_CONNECTIVITY_UNCONFIRMED'], pending_compartment_nos: [1, 2], topology_version: 1 } };
    fixture.services.cabinetManagement.get.mockResolvedValue(offline);
    fixture.services.cabinetManagement.activate.mockResolvedValue({ ...offline, lifecycle_status: 'ACTIVE' });
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('格口 3');
    fireEvent.click(screen.getByText('柜机管理'));
    fireEvent.click(screen.getByRole('button', { name: '启用租赁柜' }));
    await screen.findByText(/提交时将实时检测柜机在线状态/);
    expect(screen.queryByText('已现场逐格核对以上格口为空')).not.toBeInTheDocument();
    expect(screen.queryByText('已核对本次目标物理布局')).not.toBeInTheDocument();
    fireEvent.change(within(screen.getByLabelText('操作原因')).getByRole('textbox'), { target: { value: '在线启用测试' } });
    fireEvent.click(screen.getByRole('button', { name: '提交服务器确认' }));
    await waitFor(() => expect(fixture.services.cabinetManagement.activate).toHaveBeenCalledWith(offline, { reason: '在线启用测试' }, expect.any(String)));
    expect(fixture.services.cabinetManagement.openOne).not.toHaveBeenCalled();
  });
  it('does not query without server read permission', () => {
    fixture.session.permissions = ['cabinet.view', 'cabinet.manage'];
    show();
    expect(screen.getByText(/不使用演示身份或数据/)).toBeInTheDocument();
    expect(fixture.services.cabinetManagement.list).not.toHaveBeenCalled();
  });
  it('uses selected cursor and leaves unrelated details untouched', async () => {
    fixture.services.cabinetManagement.list.mockResolvedValueOnce({ items: [cabinet], page: { page_size: 20, has_more: true, next_cursor: 'next.cursor' }, statistics: { total: 1 } });
    show();
    await screen.findByText('合成测试柜');
    expect(fixture.services.cabinetManagement.get).not.toHaveBeenCalled();
    expect(fixture.services.cabinetManagement.compartments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '下一页柜机' }));
    await waitFor(() => expect(fixture.services.cabinetManagement.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next.cursor' }), expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });
  it('shows server lifecycle and retired history; closed door never becomes empty', async () => {
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('格口 3');
    expect(screen.getByRole('button', { name: '资产入柜' })).toBeInTheDocument();
    expect(screen.getByText(/观察已过期或尚无可靠观察/)).toBeInTheDocument();
    expect(screen.getByText(/确认不代表格口空闲/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('柜机管理'));
    expect(screen.getByText('调整格口数量').closest('button')).toBeDisabled();
    expect(screen.getByText('启用租赁柜').closest('button')).toBeDisabled();
    expect(screen.getByRole('button', { name: '录入租赁柜' })).toBeDisabled();
    expect(screen.queryByText('本次演示结果')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /模拟开格/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('已退出当前拓扑')).toBeInTheDocument();
  });
  it('stops detail observers while hidden and refetches on visibility restore', async () => {
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const { client, unmount } = show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText('格口 3');
    hidden = true; fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ['cabinet-management', 'synthetic-ops', 'detail', 'cab_synthetic'] })?.isActive()).toBe(false));
    const count = fixture.services.cabinetManagement.get.mock.calls.length;
    hidden = false; fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(fixture.services.cabinetManagement.get.mock.calls.length).toBeGreaterThan(count));
    unmount();
    expect(client.getQueryCache().find({ queryKey: ['cabinet-management', 'synthetic-ops', 'detail', 'cab_synthetic'] })?.isActive() ?? false).toBe(false);
  });
  it('does not replace a failed read with demo data or offer stale actions', async () => {
    fixture.services.cabinetManagement.get.mockRejectedValue(new Error('synthetic'));
    show('/cabinets?cabinet_id=cab_synthetic');
    await screen.findByText(/详情读取失败/);
    expect(screen.queryByRole('button', { name: '调整格口数量' })).not.toBeInTheDocument();
    expect(fixture.services.cabinetManagement.get).toHaveBeenCalledOnce();
  });
});
