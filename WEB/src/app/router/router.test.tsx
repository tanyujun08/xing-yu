import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { roleDefinitions } from '../../shared/access/session';
import { AppProviders } from '../providers/AppProviders';
import { routes } from './routes';

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_MODE', 'mock-demo');
  vi.stubEnv('VITE_API_BASE_URL', '');
});

afterEach(() => cleanup());

function writeSuperAdminSession() {
  window.sessionStorage.setItem('xingyu-admin.mock-session.v1', JSON.stringify({
    status: 'authenticated',
    accessToken: null,
    accountId: 'mock-super-admin',
    displayName: '林运营',
    role: 'SUPER_ADMIN',
    roleLabel: roleDefinitions.SUPER_ADMIN.label,
    loginMethod: 'PHONE',
    permissions: roleDefinitions.SUPER_ADMIN.permissions,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }));
}

test('redirects an anonymous visitor to the Mock login screen', async () => {
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );
  expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
});

test('redirects the system parent route to the independent rules page', async () => {
  writeSuperAdminSession();
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/settings'] });
  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  expect(await screen.findByRole('heading', { name: '规则配置' })).toBeInTheDocument();
  expect(memoryRouter.state.location.pathname).toBe('/settings/rules');
});

test('does not grant the API-only rental route to a stored demo role', async () => {
  writeSuperAdminSession();
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/orders'] });
  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  await act(async () => {
    await vi.dynamicImportSettled();
  });

  expect(memoryRouter.state.location.pathname).toBe('/403');
  expect(screen.queryByText('租赁订单列表')).not.toBeInTheDocument();
});

test('does not expose real entitlement purchase data through a demo deep link', async () => {
  writeSuperAdminSession();
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/orders/contract-purchases'] });
  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  await act(async () => { await vi.dynamicImportSettled(); });
  expect(memoryRouter.state.location.pathname).toBe('/403');
  expect(screen.queryByText('服务购买记录')).not.toBeInTheDocument();
});

test('opens a system leaf route directly', async () => {
  writeSuperAdminSession();
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/settings/login-logs'] });
  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  expect(await screen.findByRole('heading', { name: '登录日志' })).toBeInTheDocument();
  expect(screen.getByText('系统配置 / 登录日志')).toBeInTheDocument();
});

test('does not expose Mock business configuration as effective API settings', async () => {
  writeSuperAdminSession();
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/settings/rules'] });
  render(<AppProviders><RouterProvider router={memoryRouter} /></AppProviders>);
  expect(await screen.findByRole('heading', { name: '规则配置' })).toBeInTheDocument();
  fireEvent.click(screen.getByText('合同价格'));
  expect(screen.getAllByText('当前账号没有配置读取权限').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: '保存并立即生效' })).not.toBeInTheDocument();
});
