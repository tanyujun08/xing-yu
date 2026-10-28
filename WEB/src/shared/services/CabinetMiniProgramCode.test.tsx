import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client';
import { createCabinetManagement } from './cabinetManagement';
import { CabinetMiniProgramCode } from '../../features/cabinets/CabinetMiniProgramCode';
const fixture = vi.hoisted(() => ({ session: { accountId: 'cabinet-reader', permissions: ['ops.cabinets.qrcode.read'] }, gateway: {} as ReturnType<typeof createCabinetManagement> }));
vi.mock('../../shared/access/session', () => ({ useSession: () => fixture.session }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ cabinetManagement: fixture.gateway }) }));
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
beforeEach(() => { fixture.session = { accountId: 'cabinet-reader', permissions: ['ops.cabinets.qrcode.read'] }; fixture.gateway = createCabinetManagement(createApiClient({ baseURL: '', getAccessToken: () => null })); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn().mockReturnValue('blob:original-cabinet'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('sends the K11 empty object and previews and downloads only verified PNG bytes', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(png, { headers: { 'Content-Type': 'image/png' } })); render(<CabinetMiniProgramCode cabinetId="cabinet-1" />);
  fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' }));
  const link = await screen.findByRole('link', { name: '下载柜体码' }); expect(link).toHaveAttribute('href', 'blob:original-cabinet'); expect(link).toHaveAttribute('download', 'cabinet-cabinet-1.png');
  expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:original-cabinet');
  expect(screen.getByRole('img')).toHaveAttribute('alt', '扫码进入本租赁柜详情页面');
  expect(screen.getByText('柜体码用于进入本柜详情页，不含订单或取件码。')).toBeInTheDocument();
  const [path, init] = vi.mocked(fetch).mock.calls[0]!; expect(path).toBe('/v1/ops/cabinets/cabinet-1/mini-program-code'); expect(init?.method).toBe('POST'); expect(init?.body).toBe('{}'); expect(URL.createObjectURL).toHaveBeenCalledOnce();
});

it('downloads an accepted JPEG response with its actual jpg extension', async () => {
  const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 255, 217]);
  vi.mocked(fetch).mockResolvedValue(new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }));
  render(<CabinetMiniProgramCode cabinetId="jpeg-cabinet" />);
  fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' }));
  const link = await screen.findByRole('link', { name: '下载柜体码' });
  expect(link).toHaveAttribute('download', 'cabinet-jpeg-cabinet.jpg');
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/jpeg' }));
  expect(screen.getByRole('img')).toHaveAttribute('alt', '扫码进入本租赁柜详情页面');
  expect(fetch).toHaveBeenCalledOnce();
});

it.each(['problem', 'false-image'] as const)('does not create a download for %s returned from K11', async (kind) => {
  const body = JSON.stringify({ code: 'CONFIGURATION_REQUIRED', message: '没有渠道配置', request_id: 'no-image' });
  vi.mocked(fetch).mockResolvedValue(new Response(body, { status: kind === 'problem' ? 503 : 200, headers: { 'Content-Type': kind === 'problem' ? 'application/problem+json' : 'image/png' } }));
  render(<CabinetMiniProgramCode cabinetId="cabinet-1" />); fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' }));
  await screen.findByText('柜体小程序码暂不可用，请核对封面同步状态后重试。'); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByRole('link', { name: '下载柜体码' })).not.toBeInTheDocument(); expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('isolates a late cabinet-code response after changing account or cabinet', async () => {
  let resolve!: (response: Response) => void; vi.mocked(fetch).mockImplementation(() => new Promise((r) => { resolve = r; }));
  const view = render(<CabinetMiniProgramCode cabinetId="old-cabinet" />); fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' })); await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  fixture.session.accountId = 'other-reader'; view.rerender(<CabinetMiniProgramCode cabinetId="new-cabinet" />);
  await act(async () => resolve(new Response(png, { headers: { 'Content-Type': 'image/png' } })));
  expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByRole('link', { name: '下载柜体码' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: '查看柜体小程序码' })).toBeEnabled();
});

it('does not offer or invoke K11 without its explicit cabinet-code permission', () => {
  fixture.session.permissions = ['ops.orders.read']; render(<CabinetMiniProgramCode cabinetId="cabinet-1" />);
  expect(screen.queryByRole('button', { name: '查看柜体小程序码' })).not.toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
});

it('explicitly retries failed K11 with the current cabinet and no order command headers or tasks', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'INTEGRATION_UNAVAILABLE', message: '合成渠道失败', request_id: 'code-failure' }), { status: 503, headers: { 'Content-Type': 'application/problem+json' } })).mockResolvedValueOnce(new Response(png, { headers: { 'Content-Type': 'image/png' } }));
  render(<CabinetMiniProgramCode cabinetId="current-cabinet" />); fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' }));
  await screen.findByText('柜体小程序码暂不可用，请核对封面同步状态后重试。'); expect(fetch).toHaveBeenCalledOnce(); expect(URL.createObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '查看柜体小程序码' })); await screen.findByRole('link', { name: '下载柜体码' });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url, init] of vi.mocked(fetch).mock.calls) {
    expect(url).toBe('/v1/ops/cabinets/current-cabinet/mini-program-code'); expect(init?.body).toBe('{}'); expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers); expect(headers.has('Idempotency-Key')).toBe(false); expect(headers.has('If-Match')).toBe(false);
  }
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
});
