import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CabinetManagementGateway } from '../../shared/services/cabinetManagement';
import { CabinetProviderOperationsPanel } from './CabinetProviderOperationsPanel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('cabinet physical operation history', () => {
  it('keeps call success distinct from incomplete door observations in the table and drawer', async () => {
    const gateway = {
      providerOperations: vi.fn().mockResolvedValue({ items: [{ operation_id: 'cmd_1', kind: 'OPEN_ONE', target: '1', request_status: 'ACCEPTED', observation_status: 'INCOMPLETE', connectivity_status: null, created_at: '2026-09-30T01:00:00Z', detail_ref: 'cmd_1' }], page: { has_more: false } }),
      command: vi.fn().mockResolvedValue({ command_id: 'cmd_1', command_type: 'OPEN_ONE', execution_status: 'ACCEPTED', resolution_status: 'SAFE_RELEASED', observation_status: 'INCOMPLETE', observed_open_count: 0, accepted_at: '2026-09-30T01:00:01Z', targets: [{ compartment_no: 1 }] }),
      queryDoor: vi.fn(), openOne: vi.fn(),
    } as unknown as CabinetManagementGateway;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CabinetProviderOperationsPanel cabinetId="cab_1" gateway={gateway} accountId="admin" visible /></QueryClientProvider>);
    await screen.findByText('门态见格口状态');
    expect(screen.getAllByText('调用成功').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    await screen.findByText('接口调用结果');
    expect(screen.getByText('通过独立查询更新，请查看格口状态')).toBeInTheDocument();
    expect(screen.queryByText('已观察打开')).not.toBeInTheDocument();
    expect(screen.queryByText('INCOMPLETE')).not.toBeInTheDocument();
    expect(gateway.queryDoor).not.toHaveBeenCalled(); expect(gateway.openOne).not.toHaveBeenCalled();
  });
});
