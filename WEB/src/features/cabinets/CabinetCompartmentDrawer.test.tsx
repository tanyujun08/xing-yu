import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManagedCabinetCredential, ManagedCompartment } from '../../shared/services/cabinetManagement';
import { CabinetCompartmentDrawer } from './CabinetCompartmentDrawer';

const fx = vi.hoisted(() => ({ accountId: 'ops-original', permissions: ['ops.cabinets.credentials.read'], read: vi.fn() }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: fx.accountId, permissions: fx.permissions }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ cabinetManagement: { credential: fx.read } }) }));
const time = '2026-10-06T00:00:00Z';
const slot = (id = 'slot-original', credentialId: string | null = 'credential-original'): ManagedCompartment => ({ compartment_id: id, cabinet_id: 'cabinet-original', compartment_no: 2, service_status: 'ACTIVE', business_occupancy_status: 'OCCUPIED', door_status: 'CLOSED', rfid_status: 'UNKNOWN', observed_rfid_code: null, rfid_checked_at: null, version: 1, topology_status: 'IN_TOPOLOGY', retired_at: null, last_topology_version: 1, created_at: time, updated_at: time, occupant: { asset_id: 'asset-original', asset_no: 'AS-1', display_name: '原资产', credential_id: credentialId } });
const record = (status: ManagedCabinetCredential['status'] = 'ACTIVE'): ManagedCabinetCredential => ({ credential_id: 'credential-original', kind: 'PICKUP', cabinet_id: 'cabinet-original', compartment_id: 'slot-original', placement_id: 'placement-original', status, generated_at: time, activated_at: status === 'DORMANT' ? null : time, consumed_at: status === 'CONSUMED' ? time : null, revoked_at: status === 'REVOKED' ? time : null, updated_at: time, version: '2' });
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); fx.accountId = 'ops-original'; fx.permissions = ['ops.cabinets.credentials.read']; fx.read.mockResolvedValue(record()); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });
function show(initial = slot()) { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); const element = (value: ManagedCompartment | null) => <QueryClientProvider client={client}><CabinetCompartmentDrawer compartment={value} onClose={() => {}} /></QueryClientProvider>; const view = render(element(initial)); return { ...view, update: (value: ManagedCompartment | null) => view.rerender(element(value)) }; }

it('distinguishes an unregistered asset from a device actually detected in the compartment', () => {
  show({ ...slot(), business_occupancy_status: 'AVAILABLE', occupant: null, rfid_status: 'PRESENT', observed_rfid_code: '1937D715', rfid_checked_at: time });
  expect(screen.getByText('未登记在柜资产')).toBeInTheDocument(); expect(screen.getByText('1937D715')).toBeInTheDocument();
  expect(screen.queryByText('未检测到设备')).not.toBeInTheDocument(); expect(fx.read).not.toHaveBeenCalled();
});

it('replaces measured RFID with explicit absent or unconfirmed facts while keeping independent time and occupancy', async () => {
  fx.permissions = [];
  const original = { ...slot(), door_observed_at: '2026-10-08T02:00:00Z', rfid_status: 'PRESENT' as const, observed_rfid_code: '1937D715', rfid_checked_at: '2026-10-08T01:00:00Z' };
  const view = show(original);
  const fact = () => screen.getByText('实测 RFID', { selector: 'dt' }).nextElementSibling;
  expect(fact()).toHaveTextContent('1937D715'); expect(fact()).toHaveTextContent('最近查询：2026年10月8日 09:00:00');
  expect(fact()).not.toHaveTextContent('10:00:00');
  view.update({ ...original, rfid_status: 'ABSENT', observed_rfid_code: null, rfid_checked_at: '2026-10-08T03:00:00Z' });
  expect(fact()).toHaveTextContent('未检测到设备'); expect(fact()).toHaveTextContent('最近查询：2026年10月8日 11:00:00');
  expect(screen.queryByText('1937D715')).not.toBeInTheDocument(); expect(screen.getByText('原资产')).toBeInTheDocument();
  view.update({ ...original, rfid_status: 'UNKNOWN', observed_rfid_code: null, rfid_checked_at: '2026-10-08T04:00:00Z' });
  expect(fact()).toHaveTextContent('待核实'); expect(fact()).toHaveTextContent('最近查询：2026年10月8日 12:00:00');
  view.update({ ...original, rfid_status: 'UNKNOWN', observed_rfid_code: null, rfid_checked_at: null });
  expect(fact()).toHaveTextContent('未读取'); expect(fact()).toHaveTextContent('最近查询：尚未查询');
  expect(fx.read).not.toHaveBeenCalled();
});

it.each([['DORMANT', '休眠'], ['ACTIVE', '可取件'], ['CONSUMED', '已使用'], ['REVOKED', '已撤销']] as const)('reads the original credential and renders %s lifecycle facts without plaintext or device commands', async (status, label) => {
  fx.read.mockResolvedValue({ ...record(status), pickup_code: '001234' }); show();
  await screen.findByText(label, { selector: 'dd' });
  expect(fx.read).toHaveBeenCalledExactlyOnceWith('credential-original', { signal: expect.any(AbortSignal) });
  expect(screen.getByText('placement-original')).toBeInTheDocument(); expect(screen.getAllByText('2026年10月6日 08:00:00').length).toBeGreaterThan(0);
  expect(screen.queryByText('001234')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /开柜|复制|替换|撤销|生成/ })).not.toBeInTheDocument();
});

it.each(['permission', 'locator'] as const)('does not read a credential without %s', (kind) => {
  if (kind === 'permission') fx.permissions = []; show(slot('slot-original', kind === 'locator' ? null : 'credential-original'));
  expect(fx.read).not.toHaveBeenCalled(); expect(screen.getByText(kind === 'permission' ? '当前角色没有取件凭证读取权限。' : '当前格口没有可查询的取件凭证。')).toBeInTheDocument();
});

it.each(['slot', 'account', 'close'] as const)('discards a late credential result after %s changes', async (kind) => {
  let resolve!: (value: ManagedCabinetCredential) => void; fx.read.mockReturnValueOnce(new Promise<ManagedCabinetCredential>((r) => { resolve = r; })).mockReturnValue(new Promise(() => {}));
  const view = show(); await waitFor(() => expect(fx.read).toHaveBeenCalledOnce());
  if (kind === 'account') fx.accountId = 'ops-new';
  view.update(kind === 'close' ? null : kind === 'slot' ? slot('slot-new', 'credential-new') : slot());
  await act(async () => { resolve(record()); await Promise.resolve(); });
  expect(screen.queryByText('placement-original')).not.toBeInTheDocument();
});

it('hides a cached credential immediately on permission loss and rejects mismatched binding on reread', async () => {
  const view = show(); await screen.findByText('placement-original'); fx.permissions = []; view.update(slot());
  expect(screen.queryByText('placement-original')).not.toBeInTheDocument();
  fx.permissions = ['ops.cabinets.credentials.read']; fx.read.mockResolvedValue({ ...record(), cabinet_id: 'foreign-cabinet', placement_id: 'foreign-placement' });
  view.update(slot('slot-new', 'credential-new')); await screen.findByText('取件凭证读取失败，请核对当前权限与格口绑定后重试。');
  expect(screen.queryByText('foreign-placement')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新读取凭证' })); await waitFor(() => expect(fx.read).toHaveBeenCalledTimes(3));
  expect(fx.read).toHaveBeenLastCalledWith('credential-new', { signal: expect.any(AbortSignal) });
});
