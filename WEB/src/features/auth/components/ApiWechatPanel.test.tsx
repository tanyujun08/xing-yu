import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiWechatPanel, FirstLoginWechatBinding } from './ApiWechatPanel';
import type { OpsWechatChallenge } from '../../../shared/services/opsAuthentication';

const state = vi.hoisted(() => ({ apiMode: true, status: 'authenticated', accountId: 'synthetic-ops', accessToken: 'synthetic-session', wechatBinding: { status: 'UNBOUND' }, logout: vi.fn(), createWechatChallenge: vi.fn<(purpose: 'LOGIN' | 'BIND', key: string) => Promise<OpsWechatChallenge>>(() => new Promise(() => undefined)), readWechatChallenge: vi.fn(), loginWechat: vi.fn(), revalidateAccessToken: vi.fn() }));
vi.mock('../../../shared/access/session', () => ({ useSession: () => state }));
beforeEach(() => { state.status = 'authenticated'; state.accountId = 'synthetic-ops'; state.accessToken = 'synthetic-session'; state.wechatBinding = { status: 'UNBOUND' }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('renders the real QR login panel on HTTP without crypto.randomUUID', () => {
  const secureRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues: secureRandom });
  render(<ApiWechatPanel purpose="LOGIN" />);
  expect(screen.getByText('请使用已绑定的微信扫描，并在小程序中确认登录。')).toBeInTheDocument();
  expect(state.createWechatChallenge).toHaveBeenCalled();
});
it('keeps the original creation key when a QR request fails on HTTP', async () => {
  const secureRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues: secureRandom });
  state.createWechatChallenge.mockRejectedValueOnce(new Error('unconfirmed request'));
  render(<ApiWechatPanel purpose="LOGIN" />);
  const retry = await screen.findByRole('button', { name: '重试生成' });
  const originalKey = state.createWechatChallenge.mock.calls[0]![1];
  fireEvent.click(retry);
  await waitFor(() => expect(state.createWechatChallenge).toHaveBeenCalledTimes(2));
  expect(state.createWechatChallenge.mock.calls[1]).toEqual(['LOGIN', originalKey]);
});
it('allows a phone-authenticated administrator to defer binding without changing identity or logging out', () => {
  const view = render(<FirstLoginWechatBinding />);
  expect(screen.getByText('绑定微信账号')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '稍后绑定' }));
  expect(screen.queryByRole('button', { name: '稍后绑定' })).not.toBeInTheDocument();
  expect(state.wechatBinding.status).toBe('UNBOUND');
  expect(state.logout).not.toHaveBeenCalled();
  view.unmount();
  render(<FirstLoginWechatBinding />);
  expect(screen.getByRole('button', { name: '稍后绑定' })).toBeInTheDocument();
});

it('reminds the same unbound account after logout and login without a page reload', () => {
  const view = render(<FirstLoginWechatBinding />);
  fireEvent.click(screen.getByRole('button', { name: '稍后绑定' }));
  state.accessToken = 'rotated-token';
  view.rerender(<FirstLoginWechatBinding />);
  expect(screen.queryByRole('button', { name: '稍后绑定' })).not.toBeInTheDocument();
  state.status = 'anonymous';
  view.rerender(<FirstLoginWechatBinding />);
  state.status = 'authenticated';
  view.rerender(<FirstLoginWechatBinding />);
  expect(screen.getByRole('button', { name: '稍后绑定' })).toBeInTheDocument();
});

it('reminds a switched account and hides the reminder once binding is confirmed', () => {
  const view = render(<FirstLoginWechatBinding />);
  fireEvent.click(screen.getByRole('button', { name: '稍后绑定' }));
  state.accountId = 'another-synthetic-ops';
  view.rerender(<FirstLoginWechatBinding />);
  expect(screen.getByRole('button', { name: '稍后绑定' })).toBeInTheDocument();
  state.wechatBinding = { status: 'BOUND' };
  view.rerender(<FirstLoginWechatBinding />);
  expect(screen.queryByRole('button', { name: '稍后绑定' })).not.toBeInTheDocument();
});
