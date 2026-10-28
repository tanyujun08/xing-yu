import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IntegratedRulesSettingsPage } from '../../features/settings/IntegratedRulesSettingsPage';

const fixture = vi.hoisted(() => ({ effective: vi.fn(), publish: vi.fn(), versions: vi.fn(), categories: vi.fn() }));
vi.mock('./index', () => ({ useAdminServices: () => ({ businessConfig: fixture, catalog: { listCategories: fixture.categories } }) }));
vi.mock('../access/session', () => ({ useSession: () => ({ accountId: 'price-operator', permissions: ['ops.system_config.read', 'ops.business_config.publish'] }) }));
beforeEach(() => { vi.resetAllMocks(); fixture.effective.mockResolvedValue([]); fixture.publish.mockResolvedValue({}); fixture.categories.mockResolvedValue([]); });
afterEach(cleanup);

it('requires both positive prices and sends integer fen and integer PINK without a commercial default', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><IntegratedRulesSettingsPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByText('合同价格'));
  fireEvent.click(await screen.findByText('新增商品'));
  const price = screen.getByLabelText('人民币价格（元）');
  const form = within(price.closest('form')!);
  fireEvent.change(form.getByLabelText('商品名称'), { target: { value: '单次合同' } });
  fireEvent.change(form.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '配置合同双价格' } });
  const save = form.getByRole('button', { name: '保存并立即生效' });
  expect(price).toHaveValue('');
  expect(form.getByLabelText('粉钻价格（整数）')).toHaveValue('');
  expect(save).toBeDisabled();
  fireEvent.change(price, { target: { value: '0' } });
  fireEvent.change(form.getByLabelText('粉钻价格（整数）'), { target: { value: '1' } });
  expect(save).toBeDisabled();
  fireEvent.change(price, { target: { value: '0.01' } });
  expect(save).toBeEnabled();
  fireEvent.click(screen.getByText('组合套餐'));
  fireEvent.click(screen.getByText('合同价格'));
  expect(form.getByLabelText('商品名称')).toHaveValue('单次合同');
  expect(price).toHaveValue('0.01');
  fireEvent.click(save);
  await waitFor(() => expect(fixture.publish).toHaveBeenCalledTimes(1));
  expect(fixture.publish.mock.calls[0]?.[0]).toMatchObject({ config_key: 'entitlement.catalog', schema_version: 2, value: { offers: [{ name: '单次合同', cny_price_fen: '1', pink_price: '1', items: [{ kind: 'CONTRACT', quantity: '1' }] }] } });
});

it('routes the existing rules page to the one order policy editor without retired workflow controls', async () => {
  fixture.effective.mockResolvedValue([{ config_key: 'rental.order_policy', effective_epoch: 1, value: { schema_version: 2, return_instructions: '原订单归还说明', pickup_instructions: '原取件说明', grace_seconds: 300, evidence_templates: [{ template_key: 'personal', version: '1', title: '个人归还', slots: [{ slot_key: 'front', title: '外观照片', kind: 'PHOTO', stage: 'PRE_RETURN', instruction: '拍清外观', min_count: 1, max_count: 1, sort_order: 1, example: null }] }], template_bindings: [{ supply_channel: 'PERSONAL', fulfillment: 'EXPRESS', category_id: '', template_key: 'personal' }], personal_rent_basis_points: 8000, loss_beneficiary_basis_points: 10000 } }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><IntegratedRulesSettingsPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('tab', { name: '租赁基础配置' }));
  await waitFor(() => expect(fixture.categories).toHaveBeenCalledOnce());
  const input = await screen.findByLabelText('归还说明（必填）');
  const form = within(input.closest('form')!); expect(input).toHaveValue('原订单归还说明'); expect(form.getByLabelText('退押核费超期宽限（秒）')).toHaveDisplayValue('300');
  for (const name of [/续租/, /提现/, /个人拒单/, /回收依据/, /检查清单/, /备用渠道/]) expect(form.queryByLabelText(name)).not.toBeInTheDocument();
  fireEvent.change(form.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '原布局保存策略' } } );
  expect(form.getByPlaceholderText('至少填写 3 个字符')).toHaveValue('原布局保存策略');
  await waitFor(() => expect(form.getByRole('button', { name: '保存并立即生效' })).toBeEnabled());
  fireEvent.submit(input.closest('form')!); await waitFor(() => expect(fixture.publish).toHaveBeenCalledOnce());
  expect(fixture.publish.mock.calls[0]![0]).toMatchObject({ config_key: 'rental.order_policy', expected_epoch: 1, reason: '原布局保存策略', value: { grace_seconds: 300 } });
});
