import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiProblem } from '../../shared/services/testing/problemFixture';
import { BusinessConfigEditor } from './BusinessConfigEditor';
import { emptyRentalOrderPolicy, RentalOrderPolicyFields, validRentalOrderPolicy } from './RentalOrderPolicyFields';
const fixture = vi.hoisted(() => ({ effective: vi.fn(), publish: vi.fn(), versions: vi.fn() }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ businessConfig: fixture }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'policy-admin', permissions: ['ops.system_config.read', 'ops.business_config.publish'] }) }));
const policy: typeof emptyRentalOrderPolicy = { ...emptyRentalOrderPolicy, evidence_templates: [{ template_key: 'test', version: '1', title: '隔离模板', slots: [{ slot_key: 'front', title: '外观照片', kind: 'PHOTO', stage: 'PRE_RETURN', instruction: '拍清外观', min_count: 1, max_count: 1, sort_order: 1, example: null }, { slot_key: 'inspection', title: '验机视频', kind: 'VIDEO', stage: 'PRE_RETURN', instruction: '展示功能', min_count: 1, max_count: 1, sort_order: 2, example: null }] }], template_bindings: [{ supply_channel: 'PERSONAL', fulfillment: 'EXPRESS', category_id: '', template_key: 'test' }], return_instructions: '照片和视频', pickup_instructions: '柜机扫码', personal_rent_basis_points: 8000, loss_beneficiary_basis_points: 10000 };
let epoch = 1;
const current = () => [{ config_key: 'rental.order_policy', effective_epoch: epoch, value: policy, config_version: { version_no: epoch }, published_at: '2026-10-06T00:00:00Z' }];
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); epoch = 1; fixture.effective.mockImplementation(async () => current()); fixture.versions.mockResolvedValue({ items: [], page: { has_more: false } }); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client); return render(<QueryClientProvider client={client}><BusinessConfigEditor configKey="rental.order_policy" title="订单与归还规则" description="固定履约方式" initial={(row) => row?.value as typeof policy ?? policy} valid={validRentalOrderPolicy}>{(value, change, errors) => <RentalOrderPolicyFields value={value} onChange={change} errors={errors} />}</BusinessConfigEditor></QueryClientProvider>); }
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const reason = () => fireEvent.change(screen.getByPlaceholderText('至少填写 3 个字符'), { target: { value: '修改订单材料策略' } });

it('saves one current order policy with a reason and excludes retired workflow switches', async () => {
  fixture.publish.mockImplementation(async () => { epoch = 2; return {}; }); show(); await screen.findByLabelText('归还说明（必填）'); reason();
  fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' })); await screen.findByText('配置已保存并生效');
  expect(fixture.publish).toHaveBeenCalledExactlyOnceWith({ config_key: 'rental.order_policy', schema_version: 2, expected_epoch: 1, reason: '修改订单材料策略', value: policy }, expect.any(String));
  expect(await screen.findByText('生效版本 v2')).toBeInTheDocument();
  for (const forbidden of [/续租/, /提现/, /个人拒单/, /灭失结算/, /备用渠道准入/, /商家付款登记/, /联系客服/]) expect(screen.queryByLabelText(forbidden)).not.toBeInTheDocument();
  expect(Object.keys(fixture.publish.mock.calls[0]![0].value).sort()).toEqual(Object.keys(policy).sort());
});

it('keeps every policy draft field after an epoch conflict and requires explicit review of the current epoch', async () => {
  fixture.publish.mockImplementationOnce(async () => { epoch = 2; throw new ApiProblem(409, { code: 'VERSION_CONFLICT', message: '已更新', request_id: 'conflict' }); }).mockResolvedValueOnce({});
  show(); await screen.findByLabelText('归还说明（必填）'); change('归还说明（必填）', '保留新草稿'); change('退押核费超期宽限（秒）', '300'); reason();
  fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' })); await screen.findByText('生效版本 v2');
  expect(screen.getByLabelText('归还说明（必填）')).toHaveValue('保留新草稿'); expect(screen.getByLabelText('退押核费超期宽限（秒）')).toHaveDisplayValue('300'); expect(fixture.publish).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '保存并立即生效' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '已核对最新版本，继续编辑草稿' })); fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' }));
  await waitFor(() => expect(fixture.publish).toHaveBeenCalledTimes(2)); expect(fixture.publish.mock.calls[1]![0]).toMatchObject({ expected_epoch: 2, value: { return_instructions: '保留新草稿', grace_seconds: 300 } });
  expect(fixture.publish.mock.calls[1]![1]).not.toBe(fixture.publish.mock.calls[0]![1]);
});

it('locates a server field rejection without clearing policy inputs or treating it as an uncertain save', async () => {
  fixture.publish.mockRejectedValue(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '宽限值超出授权范围', request_id: 'field', details: { field: 'value.grace_seconds' } }));
  show(); await screen.findByLabelText('归还说明（必填）'); change('退押核费超期宽限（秒）', '300'); reason(); fireEvent.click(screen.getByRole('button', { name: '保存并立即生效' }));
  await screen.findAllByText('宽限值超出授权范围'); expect(screen.getByLabelText('退押核费超期宽限（秒）')).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByLabelText('退押核费超期宽限（秒）')).toHaveDisplayValue('300');
  expect(screen.getByLabelText('归还说明（必填）')).toHaveValue('照片和视频'); expect(screen.queryByRole('button', { name: '重试原保存请求' })).not.toBeInTheDocument(); expect(fixture.publish).toHaveBeenCalledOnce();
});

it('blocks invalid policy ranges and cross-field totals before publishing', async () => {
  show(); await screen.findByLabelText('归还说明（必填）'); reason();
  for (const [label, value] of [['退押核费超期宽限（秒）', '-1'], ['个人租金及超期收益比例（万分比）', '10001'], ['外观照片 最少份数', '0'], ['验机视频 最少份数', '1.5']] as const) {
    const element = screen.getByLabelText(label); const original = (element as HTMLInputElement).value; change(label, value); expect(screen.getByRole('button', { name: '保存并立即生效' })).toBeDisabled(); change(label, original);
  }
  change('外观照片 最少份数', '11'); change('验机视频 最少份数', '10'); expect(screen.getByRole('button', { name: '保存并立即生效' })).toBeDisabled();
  expect(fixture.publish).not.toHaveBeenCalled();
});

it('accepts one common and one specific official binding but rejects duplicate common bindings', () => {
  const common = { supply_channel: 'OFFICIAL_CABINET' as const, fulfillment: 'CABINET' as const, category_id: '', template_key: 'test' };
  expect(validRentalOrderPolicy({ ...policy, template_bindings: [common, { ...common, category_id: 'category-camera' }] })).toBe(true);
  expect(validRentalOrderPolicy({ ...policy, template_bindings: [common, common] })).toBe(false);
});

it('offers catalog categories and a common template instead of a manually editable ID', async () => {
  render(<RentalOrderPolicyFields value={{ ...policy, template_bindings: [{ supply_channel: 'OFFICIAL_CABINET', fulfillment: 'CABINET', category_id: 'missing-category', template_key: 'test' }] }} onChange={vi.fn()} categories={[{ id: 'current-camera', name: '相机', parentId: null }]} />);
  expect(screen.queryByLabelText('品类 ID（官方必填）')).not.toBeInTheDocument();
  expect(screen.getByText('原品类已不存在，请选择当前品类或通用模板。')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('适用品类 1'));
  expect(await screen.findByText('相机')).toBeInTheDocument();
  expect(await screen.findByText('通用模板（未设置专属的品类）')).toBeInTheDocument();
});
