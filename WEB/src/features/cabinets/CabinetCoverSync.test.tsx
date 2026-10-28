import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CabinetManagementGateway, ManagedCabinet } from '../../shared/services/cabinetManagement';
import { CabinetCoverSync } from './CabinetCoverSync';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup(status: string | null = null, enabled = true, preview: { url: string | null; previous: boolean } = { url: null, previous: false }, missingActions = false) {
  const cabinet = { cabinet_id: 'cab-a', allowed_actions: { sync_cover: enabled }, cover: { sync_id: status ? 'sync-a' : null, status, cover_url: preview.url, accepted_at: null, code_ready: false, error_code: null, preview_is_previous: preview.previous } } as unknown as ManagedCabinet;
  if (missingActions) Reflect.deleteProperty(cabinet, 'allowed_actions');
  const syncCover = vi.fn().mockResolvedValue({ sync_id: 'sync-new' });
  const get = vi.fn().mockResolvedValue(cabinet);
  const gateway = { syncCover, get } as unknown as CabinetManagementGateway;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (visible: boolean, accountId = 'ops-a', cabinetId = 'cab-a', parentSync?: boolean | 'missing') => {
    const parent = { ...cabinet, cabinet_id: cabinetId };
    if (parentSync === 'missing') Reflect.deleteProperty(parent, 'allowed_actions');
    else if (parentSync !== undefined) parent.allowed_actions = { ...cabinet.allowed_actions, sync_cover: parentSync };
    return <QueryClientProvider client={client}><CabinetCoverSync cabinet={parent} gateway={gateway} accountId={accountId} visible={visible} disabled={false} /></QueryClientProvider>;
  };
  const result = render(view(true));
  return { syncCover, get, result, view, client, cabinet };
}
test.each([false, 'missing'] as const)('a fresh parent action %s immediately overrides an older terminal child grant', async parentSync => {
  const current = setup('ACCEPTED');
  await waitFor(() => expect(current.client.getQueryState(['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'])?.fetchStatus).toBe('idle'));
  expect(screen.getByRole('button', { name: '同步封面' })).toBeEnabled();
  current.result.rerender(current.view(true, 'ops-a', 'cab-a', parentSync));
  expect(screen.getByRole('button', { name: '同步封面' })).toBeDisabled();
  expect(current.client.getQueryData(['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'])).toMatchObject({ allowed_actions: { sync_cover: true } });
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  expect(current.syncCover).not.toHaveBeenCalled();
});
test('a parent denial from an active intent still allows explicit original-key readback', async () => {
  const current = setup();
  current.syncCover.mockRejectedValueOnce(new Error('transport unknown'));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  await screen.findByRole('button', { name: '用原请求核对封面同步' });
  current.result.rerender(current.view(true, 'ops-a', 'cab-a', false));
  expect(screen.getByRole('button', { name: '同步封面' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '用原请求核对封面同步' }));
  await waitFor(() => expect(current.syncCover).toHaveBeenCalledTimes(2));
  expect(current.syncCover.mock.calls[1]).toEqual(current.syncCover.mock.calls[0]);
});
test('a legacy cabinet projection without allowed_actions cannot grant or submit cover sync', async () => {
  const current = setup(null, true, { url: null, previous: false }, true);
  const button = screen.getByRole('button', { name: '同步封面' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  await waitFor(() => expect(current.client.getQueryData(['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'])).toBeDefined());
  expect(button).toBeDisabled();
  expect(current.syncCover).not.toHaveBeenCalled();
});
test('a fresh detail missing actions disables a previously granted parent action', async () => {
  const current = setup();
  await waitFor(() => expect(current.client.getQueryState(['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'])?.fetchStatus).toBe('idle'));
  const partial = { ...current.cabinet };
  Reflect.deleteProperty(partial, 'allowed_actions');
  current.get.mockResolvedValue(partial);
  await current.client.invalidateQueries({ queryKey: ['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'] });
  await waitFor(() => expect(screen.getByRole('button', { name: '同步封面' })).toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  expect(current.syncCover).not.toHaveBeenCalled();
});
test('a rejected null refetch cannot fall back to a stale granted sync action', async () => {
  const current = setup();
  await waitFor(() => expect(current.client.getQueryState(['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'])?.fetchStatus).toBe('idle'));
  current.get.mockResolvedValue(null);
  await current.client.invalidateQueries({ queryKey: ['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'] });
  await screen.findByText('封面状态读取失败，请刷新当前柜机。');
  expect(screen.getByRole('button', { name: '同步封面' })).toBeDisabled();
  expect(current.syncCover).not.toHaveBeenCalled();
});
test.each([true, false])('the server previous-preview flag %s labels the actual downloadable image', async previous => {
  const url = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/cabinet-cover/synthetic.png';
  const current = setup('FAILED', true, { url, previous });
  const link = await screen.findByRole('link', { name: previous ? '上次封面 · 预览/下载' : '预览/下载封面' });
  expect(link.getAttribute('href')).toBe(url);
  expect(screen.queryByText('当前预览为上次封面，本次同步尚未生成可用的新封面。') !== null).toBe(previous);
  expect(current.syncCover).not.toHaveBeenCalled();
});
test('a refreshed current material removes the previous-preview label even when URL is reused', async () => {
  const url = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/cabinet-cover/synthetic.png';
  const current = setup('PREPARING', false, { url, previous: true });
  await screen.findByRole('link', { name: '上次封面 · 预览/下载' });
  current.get.mockResolvedValue({ ...current.cabinet, cover: { ...current.cabinet.cover, status: 'ACCEPTED', preview_is_previous: false } });
  await current.client.invalidateQueries({ queryKey: ['cabinet-management', 'ops-a', 'cover-detail', 'cab-a'] });
  const link = await screen.findByRole('link', { name: '预览/下载封面' });
  expect(link.getAttribute('href')).toBe(url);
  expect(screen.queryByText('当前预览为上次封面，本次同步尚未生成可用的新封面。')).toBeNull();
});
test('no ready URL cannot produce a previous-preview link or phantom image', () => {
  setup('FAILED', true, { url: null, previous: true });
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByText('当前预览为上次封面，本次同步尚未生成可用的新封面。')).toBeNull();
});
test('normal sync submits an empty intent once without opening a confirmation form', async () => {
  const { syncCover } = setup();
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  await waitFor(() => expect(syncCover).toHaveBeenCalledTimes(1));
  expect(syncCover).toHaveBeenCalledWith('cab-a', {}, expect.any(String));
  expect(await screen.findByText(/同步任务已提交/)).toBeTruthy();
});
test('UNKNOWN requires explicit confirmation and binds recovery to the original sync', async () => {
  const { syncCover } = setup('UNKNOWN');
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  expect(syncCover).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: '确认再次下发' }));
  await waitFor(() => expect(syncCover).toHaveBeenCalledWith('cab-a', { original_sync_id: 'sync-a', confirm_resend: true }, expect.any(String)));
});
test('server denies sync and a hidden view rejects a late submit result', async () => {
  const denied = setup('QUEUED', false);
  expect(screen.getByRole('button', { name: '同步封面' }).getAttribute('disabled')).not.toBeNull();
  denied.result.unmount();
  const current = setup();
  let complete!: (value: { sync_id: string }) => void;
  current.syncCover.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  current.result.rerender(current.view(false));
  current.result.rerender(current.view(true));
  complete({ sync_id: 'late' });
  await Promise.resolve();
  expect(screen.queryByText(/同步任务已提交/)).toBeNull();
});
test('unknown transport failure retains the same idempotency intent for manual readback', async () => {
  const { syncCover } = setup();
  syncCover.mockRejectedValueOnce(new Error('network lost'));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  fireEvent.click(await screen.findByRole('button', { name: '用原请求核对封面同步' }));
  await waitFor(() => expect(syncCover).toHaveBeenCalledTimes(2));
  expect(syncCover.mock.calls[1]).toEqual(syncCover.mock.calls[0]);
});
test('UNKNOWN never auto-polls; visibility regain only re-reads the original detail', async () => {
  vi.useFakeTimers();
  const { get, result, view, syncCover } = setup('UNKNOWN');
  await vi.advanceTimersByTimeAsync(100);
  const initial = get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(get).toHaveBeenCalledTimes(initial);
  result.rerender(view(false));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(get).toHaveBeenCalledTimes(initial);
  result.rerender(view(true));
  await vi.advanceTimersByTimeAsync(100);
  expect(get.mock.calls.length).toBeGreaterThan(initial);
  expect(syncCover).not.toHaveBeenCalled();
});
test('running tasks poll within a finite budget and pause while hidden', async () => {
  vi.useFakeTimers();
  const { get, result, view } = setup('PREPARING', false);
  await vi.advanceTimersByTimeAsync(3_100);
  expect(get.mock.calls.length).toBeGreaterThan(1);
  result.rerender(view(false));
  const hidden = get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(get).toHaveBeenCalledTimes(hidden);
  result.rerender(view(true));
  await vi.advanceTimersByTimeAsync(130_000);
  const expired = get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(get).toHaveBeenCalledTimes(expired);
});
test.each(['accepted', 'timeout'])('hidden submission %s retains an unknown original intent after showing again', async outcome => {
  const current = setup();
  let complete!: (value: { sync_id: string }) => void;
  let fail!: (error: Error) => void;
  current.syncCover.mockImplementationOnce(() => new Promise((resolve, reject) => { complete = resolve; fail = reject; }));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  const first = current.syncCover.mock.calls[0];
  current.result.rerender(current.view(false));
  if (outcome === 'accepted') complete({ sync_id: 'late' }); else fail(new Error('timeout'));
  await Promise.resolve();
  current.result.rerender(current.view(true));
  const original = await screen.findByRole('button', { name: '用原请求核对封面同步' });
  expect(screen.getByRole('button', { name: '同步封面' }).getAttribute('disabled')).not.toBeNull();
  expect(screen.queryByText(/同步任务已提交/)).toBeNull();
  expect(current.syncCover).toHaveBeenCalledTimes(1);
  fireEvent.click(original);
  await waitFor(() => expect(current.syncCover).toHaveBeenCalledTimes(2));
  expect(current.syncCover.mock.calls[1]).toEqual(first);
});
test('rapid hide/show resets pending without accepting the earlier epoch result', async () => {
  const current = setup();
  let complete!: (value: { sync_id: string }) => void;
  current.syncCover.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  current.result.rerender(current.view(false));
  current.result.rerender(current.view(true));
  complete({ sync_id: 'late' });
  const original = await screen.findByRole('button', { name: '用原请求核对封面同步' });
  expect(screen.queryByText(/同步任务已提交/)).toBeNull();
  fireEvent.click(original);
  await waitFor(() => expect(current.syncCover).toHaveBeenCalledTimes(2));
  expect(current.syncCover.mock.calls[1]).toEqual(current.syncCover.mock.calls[0]);
});
test.each([['ops-b', 'cab-a'], ['ops-a', 'cab-b']])('identity switch to %s / %s cannot consume the earlier intent or notice', async (account, cabinetId) => {
  const current = setup();
  let complete!: (value: { sync_id: string }) => void;
  current.syncCover.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  const first = current.syncCover.mock.calls[0];
  current.result.rerender(current.view(true, account, cabinetId));
  complete({ sync_id: 'old-owner' });
  await Promise.resolve();
  expect(screen.queryByRole('button', { name: '用原请求核对封面同步' })).toBeNull();
  expect(screen.queryByText(/同步任务已提交/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '同步封面' }));
  await waitFor(() => expect(current.syncCover).toHaveBeenCalledTimes(2));
  expect(current.syncCover.mock.calls[1]?.[0]).toBe(cabinetId);
  expect(current.syncCover.mock.calls[1]?.[2]).not.toBe(first?.[2]);
});
