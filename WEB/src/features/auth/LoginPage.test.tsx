import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from '../../shared/access/session';
import { MockAdminServicesProvider } from '../../shared/services/DemoServicesProvider';
import { DEFAULT_DEMO_STORAGE_KEY } from '../../shared/mock';
import { LoginPage } from './LoginPage';

const auth = vi.hoisted(() => ({ createPhoneChallenge: vi.fn(), loginPhone: vi.fn(), refresh: vi.fn(), current: vi.fn(), logout: vi.fn() }));
vi.mock('../../shared/config/env', () => ({ apiIntegrationEnabled: true, publicEnv: { apiBaseURL: '', appMode: 'api-integration' } }));
vi.mock('../../shared/services/opsAuthentication', async (original) => ({ ...await original<typeof import('../../shared/services/opsAuthentication')>(), createOpsAuthenticationClient: () => auth }));

const identity = { account_id: 'synthetic-ops', audience: 'OPS', roles: ['ops.operator'], permissions: ['ops.accounts.read'], scopes: [{ type: 'PLATFORM', id: 'platform' }] };
function SessionView() { const session = useSession(); return <p>{session.accountId} {session.permissions.join(',')}</p>; }
function mount() {
  return render(<StrictMode><MemoryRouter initialEntries={['/login']}><SessionProvider><MockAdminServicesProvider>
    <Routes><Route path="/login" element={<LoginPage />} /><Route path="/settings/admins" element={<SessionView />} /><Route path="/403" element={<p>forbidden</p>} /></Routes>
  </MockAdminServicesProvider></SessionProvider></MemoryRouter></StrictMode>);
}
beforeEach(() => {
  vi.resetAllMocks(); window.sessionStorage.clear(); window.localStorage.clear();
  auth.createPhoneChallenge.mockResolvedValue({ challenge_id: 'synthetic-challenge', status: 'PENDING', expires_in: 300, retry_after_seconds: 60 });
  auth.loginPhone.mockResolvedValue({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer', expires_in: 900, account: identity });
  auth.current.mockResolvedValue(identity); auth.logout.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); window.localStorage.clear(); });

describe('API login composition', () => {
  it('sends phone challenges on HTTP and reuses the unconfirmed request key', async () => {
    const secureRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', { getRandomValues: secureRandom });
    auth.createPhoneChallenge.mockRejectedValueOnce(new Error('synthetic lost response'));
    mount();
    // Synthetic phone stays inside the mocked authentication client.
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await screen.findByText(/验证码请求未确认成功/);
    expect(auth.createPhoneChallenge).toHaveBeenCalledTimes(1);
    const originalKey = auth.createPhoneChallenge.mock.calls[0]![1];
    expect(originalKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    expect(await screen.findByRole('button', { name: '60s 后重试' })).toBeDisabled();
    expect(auth.createPhoneChallenge).toHaveBeenCalledTimes(2);
    expect(auth.createPhoneChallenge.mock.calls[1]).toEqual(['19900000000', originalKey]);
  });
  it('uses the remaining server cooldown and never invents a shorter fallback', async () => {
    auth.createPhoneChallenge.mockResolvedValueOnce({ challenge_id: 'synthetic-challenge', status: 'PENDING', expires_in: 280, retry_after_seconds: 73 });
    mount();
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    expect(await screen.findByRole('button', { name: '73s 后重试' })).toBeDisabled();
    cleanup();
    auth.createPhoneChallenge.mockResolvedValueOnce({ challenge_id: 'synthetic-legacy-challenge', status: 'PENDING', expires_in: 280 });
    mount();
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    expect(await screen.findByRole('button', { name: '280s 后重试' })).toBeDisabled();
  });
  it('does not hydrate demo identity or migrate corrupt mock data in API mode', async () => {
    window.sessionStorage.setItem('xingyu-admin.mock-session.v1', JSON.stringify({ role: 'SUPER_ADMIN', status: 'authenticated', expiresAt: '2099-01-01' }));
    window.localStorage.setItem(DEFAULT_DEMO_STORAGE_KEY, 'preserved-invalid-demo-bytes');
    mount();
    expect(screen.getByRole('form', { name: 'API 手机号登录' })).toBeInTheDocument();
    const phonePanel = screen.getByRole('tabpanel', { name: '手机号登录' });
    expect(screen.getByRole('tab', { name: '手机号登录' })).toHaveAttribute('aria-controls', phonePanel.id);
    expect(phonePanel).toContainElement(screen.getByRole('form', { name: 'API 手机号登录' }));
    expect(screen.queryByText('演示身份')).not.toBeInTheDocument();
    expect(screen.queryByText(/246810/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DEFAULT_DEMO_STORAGE_KEY)).toBe('preserved-invalid-demo-bytes');
    expect(auth.refresh).not.toHaveBeenCalled(); expect(auth.current).not.toHaveBeenCalled();
  });
  it('retains challenge and login retry keys, then navigates using readback permissions', async () => {
    auth.createPhoneChallenge.mockRejectedValueOnce(new Error('synthetic network outage'));
    auth.loginPhone.mockRejectedValueOnce(new Error('synthetic lost response'));
    mount();
    // Reserved synthetic input; never sent to a real SMS provider.
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await screen.findByText(/验证码请求未确认成功/);
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await screen.findByRole('button', { name: '60s 后重试' });
    expect(auth.createPhoneChallenge.mock.calls[0]).toEqual(auth.createPhoneChallenge.mock.calls[1]);
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.submit(screen.getByRole('form', { name: 'API 手机号登录' }));
    await screen.findByText(/登录未成功/);
    fireEvent.submit(screen.getByRole('form', { name: 'API 手机号登录' }));
    await screen.findByText('synthetic-ops ops.accounts.read');
    expect(auth.loginPhone.mock.calls[0]).toEqual(auth.loginPhone.mock.calls[1]);
    expect(auth.loginPhone).toHaveBeenLastCalledWith('synthetic-challenge', '123456', expect.any(String));
    expect(auth.current).toHaveBeenCalledWith('synthetic-access');
    expect(window.sessionStorage.getItem('xingyu-admin.mock-session.v1')).toBeNull();
  });
  it('does not reuse the previous phone challenge after changing the phone', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000000' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await screen.findByRole('button', { name: '60s 后重试' });
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '19900000001' } });
    fireEvent.submit(screen.getByRole('form', { name: 'API 手机号登录' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('请先获取当前手机号的有效验证码'));
    expect(auth.loginPhone).not.toHaveBeenCalled();
  });
});
