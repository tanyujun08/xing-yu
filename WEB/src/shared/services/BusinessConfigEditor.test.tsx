import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BusinessConfigEditor } from '../../features/settings/BusinessConfigEditor';
import { ApiProblem } from '../api/problem';

const fixture = vi.hoisted(() => ({ effective: vi.fn(), publish: vi.fn(), versions: vi.fn() }));
vi.mock('./index', () => ({ useAdminServices: () => ({ businessConfig: fixture }) }));
vi.mock('../access/session', () => ({ useSession: () => ({ accountId: 'operator', permissions: ['ops.system_config.read', 'ops.business_config.publish'] }) }));
beforeEach(() => { vi.resetAllMocks(); fixture.effective.mockResolvedValue([]); });
afterEach(cleanup);
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><BusinessConfigEditor configKey="rental.creation_defaults" title="起租时长配置" description="test"
    initial={() => ({ schema_version: 1, minimum_hourly_hours: 0, minimum_daily_days: 3, pay_score_enabled: false, pay_score_threshold: null })}
    valid={(v) => Number.isInteger(v.minimum_hourly_hours) && v.minimum_hourly_hours >= 6}>
    {(v, change) => <label>最短起租小时数<input value={v.minimum_hourly_hours} onChange={(e) => change({ ...v, minimum_hourly_hours: Number(e.target.value) })} /></label>}
  </BusinessConfigEditor></QueryClientProvider>);
}
it('requires a valid value and preserves the exact intent after an unknown save result', async () => {
  fixture.publish.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: 'unknown', request_id: 'test' })).mockResolvedValueOnce({});
  mount();
  expect(await screen.findByLabelText('最短起租小时数')).toHaveValue('0');
  expect(screen.getByRole('button', { name: '保存并立即生效' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('最短起租小时数'), { target: { value: '6' } });
  fireEvent.change(screen.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '设置起租时长' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' }));
  const retry = await screen.findByRole('button', { name: '重试原保存请求' });
  expect(screen.getByLabelText('最短起租小时数')).toBeDisabled();
  expect(retry).toBeEnabled();
  cleanup();
  mount();
  expect(await screen.findByLabelText('最短起租小时数')).toHaveValue('6');
  expect(screen.getByLabelText('最短起租小时数')).toBeDisabled();
  fireEvent.click(await screen.findByRole('button', { name: '重试原保存请求' }));
  await waitFor(() => expect(fixture.publish).toHaveBeenCalledTimes(2));
  expect(fixture.publish.mock.calls[0]).toEqual(fixture.publish.mock.calls[1]);
  expect(fixture.publish.mock.calls[0]?.[0]).toMatchObject({ config_key: 'rental.creation_defaults', expected_epoch: 0, schema_version: 1, value: { minimum_hourly_hours: 6, minimum_daily_days: 3 } });
});
it('does not retry or overwrite a server version conflict automatically', async () => {
  fixture.publish.mockRejectedValue(new ApiProblem(409, { code: 'VERSION_CONFLICT', message: 'conflict', request_id: 'test' }));
  mount();
  fireEvent.change(await screen.findByLabelText('最短起租小时数'), { target: { value: '12' } });
  fireEvent.change(screen.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '修改起租时长' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' }));
  expect(await screen.findByText('版本已变化，请刷新后重新确认状态。')).toBeInTheDocument();
  expect(fixture.publish).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('最短起租小时数')).not.toBeDisabled();
});

it('publishes creation defaults once and reads the new effective epoch without a second approval step', async () => {
  const value = { schema_version: 1, minimum_hourly_hours: 6, minimum_daily_days: 3, pay_score_enabled: false, pay_score_threshold: null };
  fixture.effective.mockResolvedValue([{ config_key: 'rental.creation_defaults', effective_epoch: 4, value, config_version: { version_no: 4 }, published_at: '2026-10-06T00:00:00Z' }]);
  fixture.publish.mockImplementation(async () => { fixture.effective.mockResolvedValue([{ config_key: 'rental.creation_defaults', effective_epoch: 5, value, config_version: { version_no: 5 }, published_at: '2026-10-06T00:01:00Z' }]); return {}; });
  mount(); fireEvent.change(await screen.findByLabelText('最短起租小时数'), { target: { value: '6' } }); fireEvent.change(screen.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '调整起租时长' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' })); await screen.findByText('配置已保存并生效'); expect(screen.getByText('生效版本 v5')).toBeInTheDocument();
  expect(fixture.publish).toHaveBeenCalledExactlyOnceWith({ config_key: 'rental.creation_defaults', schema_version: 1, expected_epoch: 4, value, reason: '调整起租时长' }, expect.any(String));
  expect(screen.queryByRole('button', { name: /发布审批|二次生效/ })).not.toBeInTheDocument();
});
