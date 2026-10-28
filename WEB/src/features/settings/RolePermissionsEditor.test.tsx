import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RolePermissionsEditor } from './RolePermissionsEditor';

const fixture = vi.hoisted(() => ({
  session: { accountId: 'operator', accessToken: 'synthetic', permissions: ['ops.accounts.read', 'ops.roles.assign'], revalidateAccessToken: vi.fn() },
  services: { iam: { replaceRolePermissions: vi.fn() } },
}));
vi.mock('../../shared/access/session', async (original) => ({ ...await original<object>(), useSession: () => fixture.session }));
vi.mock('../../shared/services/useAdminServices', () => ({ useAdminServices: () => fixture.services }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('role permissions save intent', () => {
  it('freezes an unconfirmed edit and retries the same role version, reason and idempotency key', async () => {
    fixture.services.iam.replaceRolePermissions.mockRejectedValue(new Error('connection interrupted'));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RolePermissionsEditor role={{ role_id: 'role_operations', role_code: 'OPERATIONS', status: 'ACTIVE', version: 3, permissions: ['ops.accounts.read'] }} onClose={vi.fn()} /></QueryClientProvider>);
    const reason = await screen.findByRole('textbox', { name: '修改原因' });
    fireEvent.change(reason, { target: { value: '调整运营权限' } });
    fireEvent.click(screen.getByRole('button', { name: '保存权限' }));
    await screen.findByText('尚未确认保存结果。内容已保留，请重试原请求。');
    expect(reason).toBeDisabled();
    const retry = screen.getByRole('button', { name: '重试原请求' });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(fixture.services.iam.replaceRolePermissions).toHaveBeenCalledTimes(2));
    expect(fixture.services.iam.replaceRolePermissions.mock.calls[1]).toEqual(fixture.services.iam.replaceRolePermissions.mock.calls[0]);
    expect(fixture.services.iam.replaceRolePermissions.mock.calls[0]?.[0]).toMatchObject({ version: 3 });
    expect(fixture.session.revalidateAccessToken).not.toHaveBeenCalled();
  });
});
