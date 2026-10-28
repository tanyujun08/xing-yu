import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SystemConfigurationPanel } from './SystemConfigurationPanel';
import { defaultConfigValues } from '../../shared/services/createIntegratedAdminServices';

const fixture = vi.hoisted(() => ({
  session: { accessToken: 'synthetic-session', accountId: 'maker', permissions: [] as string[], roles: [] as string[] },
  services: { systemConfig: { listDefinitions: vi.fn(), listVersions: vi.fn(), listEffective: vi.fn(), createVersion: vi.fn(), transition: vi.fn() }, materials: { uploadFile: vi.fn(), get: vi.fn() } },
}));
vi.mock('../../shared/access/session', () => ({ useSession: () => fixture.session }));
vi.mock('../../shared/config/env', () => ({ apiIntegrationEnabled: true, publicEnv: { materialPublicOrigin: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com' } }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => fixture.services }));
vi.mock('../../shared/services/useAdminServices', () => ({ useAdminServices: () => fixture.services }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fixture.session.accountId = 'maker';
  fixture.session.roles = [];
  fixture.session.permissions = ['ops.system_config.read', 'ops.system_config.write', 'ops.system_config.approve'];
  fixture.services.systemConfig.listDefinitions.mockResolvedValue([{ config_key: 'material.upload_policy', schema_version: 2 }]);
  fixture.services.systemConfig.listVersions.mockResolvedValue({ items: [{ config_version_id: 'cfg_fixture', config_key: 'material.upload_policy', schema_version: 2, version_no: 1, status: 'VALIDATED', created_by: 'maker', version: 2, value: structuredClone(defaultConfigValues['material.upload_policy']) }], page: { page_size: 20, has_more: false } });
  fixture.services.systemConfig.listEffective.mockResolvedValue([{ config_key: 'material.upload_policy', schema_version: 2, source: 'DEFAULT_CODE', value: structuredClone(defaultConfigValues['material.upload_policy']) }]);
});
function showPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><SystemConfigurationPanel /></QueryClientProvider></MemoryRouter>);
}

describe('configuration panel permissions and retries', () => {
  it('follows the server cursor and exposes older versions without inventing another page', async () => {
    fixture.services.systemConfig.listVersions.mockResolvedValueOnce({
      items: [{ config_version_id: 'cfg_new', config_key: 'material.upload_policy', schema_version: 2, version_no: 21, status: 'VALIDATED', created_by: 'maker', version: 2, value: structuredClone(defaultConfigValues['material.upload_policy']) }],
      page: { page_size: 20, has_more: true, next_cursor: 'synthetic.cursor' },
    });
    showPanel();
    await waitFor(() => expect(screen.getByRole('button', { name: '下一页版本' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '下一页版本' }));
    await screen.findByDisplayValue('v1 · VALIDATED');
    expect(fixture.services.systemConfig.listVersions).toHaveBeenLastCalledWith('material.upload_policy', 'synthetic.cursor', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: '下一页版本' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '最新一页' })).toBeEnabled();
  });
  it('copies current V2 limits and creates a valid schema2 draft', async () => {
    const policy = structuredClone(defaultConfigValues['material.upload_policy']);
    policy.max_bytes = 2048;
    policy.class_limits = policy.class_limits.map((limit) => ({ ...limit, max_bytes: 2048 }));
    fixture.services.systemConfig.listVersions.mockResolvedValue({ items: [{ config_version_id: 'cfg_current', config_key: 'material.upload_policy', schema_version: 2, version_no: 2, status: 'PUBLISHED', created_by: 'maker', version: 4, value: policy }], page: { page_size: 20, has_more: false } });
    fixture.services.systemConfig.createVersion.mockResolvedValue({});
    showPanel();
    const copy = await screen.findByRole('button', { name: '复制所选内容到草案表单' });
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);
    expect(screen.getByLabelText('单文件上限（字节）')).toHaveDisplayValue('2048');
    expect(screen.getByLabelText('MERCHANT_IMAGE 单文件上限（字节）')).toHaveDisplayValue('2048');
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'update material policy' } });
    fireEvent.click(screen.getByRole('button', { name: '创建配置草案' }));
    await waitFor(() => expect(fixture.services.systemConfig.createVersion).toHaveBeenCalledExactlyOnceWith({ config_key: 'material.upload_policy', schema_version: 2, value: policy }, 'update material policy', expect.any(String)));
  });
  it('blocks invalid cross-limits and preserves the original create intent after transport failure', async () => {
    fixture.services.systemConfig.createVersion.mockRejectedValue(new Error('synthetic transport failure'));
    showPanel();
    await screen.findByDisplayValue('v1 · VALIDATED');
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'material retry reason' } });
    const create = screen.getByRole('button', { name: '创建配置草案' });
    fireEvent.change(screen.getByLabelText('单文件上限（字节）'), { target: { value: '1024' } });
    expect(create).toBeDisabled();
    expect(fixture.services.systemConfig.createVersion).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('单文件上限（字节）'), { target: { value: '10485760' } });
    fireEvent.click(create);
    await screen.findByText(/相同请求重试将复用幂等键/);
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    await waitFor(() => expect(fixture.services.systemConfig.createVersion).toHaveBeenCalledTimes(2));
    expect(fixture.services.systemConfig.createVersion.mock.calls[0]).toEqual(fixture.services.systemConfig.createVersion.mock.calls[1]);
    expect(fixture.services.systemConfig.createVersion.mock.calls[0]?.[0]).toMatchObject({ schema_version: 2 });
  });
  it('adds signing and chat purposes to a published policy without losing existing six limits or publishing it', async () => {
    const policy = structuredClone(defaultConfigValues['material.upload_policy']);
    policy.allowed_classes = ['PROFILE_IMAGE', 'CATALOG_IMAGE', 'RENTAL_ASSET_IMAGE', 'MERCHANT_IMAGE', 'EVIDENCE_IMAGE', 'EVIDENCE_VIDEO'];
    policy.allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    policy.max_bytes = 104857600;
    policy.class_limits = policy.allowed_classes.map(materialClass => materialClass === 'EVIDENCE_VIDEO'
      ? { class: materialClass, mimes: ['video/mp4'], max_bytes: 104857600, processing_required: true, max_duration_ms: 600000 }
      : { class: materialClass, mimes: ['image/jpeg', 'image/png', 'image/webp'], max_bytes: 10485760, processing_required: false });
    const originalLimits = structuredClone(policy.class_limits);
    fixture.services.systemConfig.listVersions.mockResolvedValue({ items: [{ config_version_id: 'cfg_six', config_key: 'material.upload_policy', schema_version: 2, version_no: 2, status: 'PUBLISHED', created_by: 'maker', version: 4, value: policy }], page: { page_size: 20, has_more: false } });
    fixture.services.systemConfig.createVersion.mockResolvedValue({});
    showPanel();
    const copy = await screen.findByRole('button', { name: '复制所选内容到草案表单' });
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);
    expect(screen.getByRole('checkbox', { name: 'CHAT_IMAGE' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'CONTRACT_SIGNATURE_IMAGE' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'CHAT_IMAGE' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'CONTRACT_SIGNATURE_IMAGE' }));
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'enable order signing and offline images' } });
    fireEvent.click(screen.getByRole('button', { name: '创建配置草案' }));
    await waitFor(() => expect(fixture.services.systemConfig.createVersion).toHaveBeenCalledTimes(1));
    const submitted = fixture.services.systemConfig.createVersion.mock.calls[0]?.[0] as { schema_version: number; value: typeof policy };
    expect(submitted.schema_version).toBe(2);
    expect(submitted.value.class_limits.slice(0, 6)).toEqual(originalLimits);
    expect(submitted.value.class_limits.slice(6)).toEqual([
      { class: 'CHAT_IMAGE', mimes: ['image/jpeg', 'image/png', 'image/webp'], max_bytes: 10485760, processing_required: false },
      { class: 'CONTRACT_SIGNATURE_IMAGE', mimes: ['image/png'], max_bytes: 2097152, processing_required: false },
    ]);
    expect(submitted.value.allowed_classes).toEqual([...policy.allowed_classes, 'CHAT_IMAGE', 'CONTRACT_SIGNATURE_IMAGE']);
    expect(submitted.value.allowed_mime_types).toEqual(policy.allowed_mime_types);
    expect(fixture.services.systemConfig.transition).not.toHaveBeenCalled();
  });
  it('does not edit or transition a non-current material schema', async () => {
    fixture.services.systemConfig.listVersions.mockResolvedValue({ items: [{ config_version_id: 'cfg_noncurrent', config_key: 'material.upload_policy', schema_version: 1, version_no: 1, status: 'VALIDATED', created_by: 'maker', version: 2, value: {} }], page: { page_size: 20, has_more: false } });
    showPanel();
    await screen.findByDisplayValue('v1 · VALIDATED');
    expect(screen.getByRole('button', { name: '复制所选内容到草案表单' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '审批' })).not.toBeInTheDocument();
    expect(fixture.services.systemConfig.transition).not.toHaveBeenCalled();
  });
  it('never infers API permissions from demo permissions', () => {
    fixture.session.permissions = ['system.manage'];
    showPanel();
    expect(screen.getByText(/不会使用演示角色推导 API 权限/)).toBeInTheDocument();
    expect(fixture.services.systemConfig.listVersions).not.toHaveBeenCalled();
  });
  it('shows code defaults separately and blocks maker self-approval', async () => {
    showPanel();
    expect(await screen.findByText('当前生效：代码默认值（未发布）')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'synthetic reason' } });
    expect(await screen.findByRole('button', { name: '审批' })).toBeDisabled();
    expect(fixture.services.systemConfig.transition).not.toHaveBeenCalled();
  });
  it('allows a server-projected super admin to approve their own validated draft', async () => {
    fixture.session.roles = ['ops.super_admin'];
    fixture.services.systemConfig.transition.mockResolvedValue({});
    showPanel();
    await screen.findByDisplayValue('v1 · VALIDATED');
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'approve signing policy' } });
    const approve = screen.getByRole('button', { name: '审批' });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => expect(fixture.services.systemConfig.transition).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ config_version_id: 'cfg_fixture', version: 2 }), 'approve', 'approve signing policy', expect.any(String)));
  });
  it('keeps self-approval disabled for a super admin without the approval permission', async () => {
    fixture.session.roles = ['ops.super_admin'];
    fixture.session.permissions = ['ops.system_config.read', 'ops.system_config.write'];
    showPanel();
    await screen.findByDisplayValue('v1 · VALIDATED');
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'review signing policy' } });
    expect(screen.getByRole('button', { name: '审批' })).toBeDisabled();
    expect(fixture.services.systemConfig.transition).not.toHaveBeenCalled();
  });
  it('shows the persisted super-admin approval basis after publication', async () => {
    fixture.services.systemConfig.listVersions.mockResolvedValue({ items: [{ config_version_id: 'cfg_self', config_key: 'material.upload_policy', schema_version: 2, version_no: 2, status: 'PUBLISHED', created_by: 'maker', approved_by: 'maker', publication_mode: 'SUPER_ADMIN_SELF', version: 4, value: structuredClone(defaultConfigValues['material.upload_policy']) }], page: { page_size: 20, has_more: false } });
    showPanel();
    expect(await screen.findByText('超管本人审批')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '审批' })).not.toBeInTheDocument();
  });
  it('preserves the idempotency key when an unconfirmed approval is manually retried', async () => {
    fixture.session.accountId = 'checker';
    fixture.services.systemConfig.transition.mockRejectedValue(new Error('synthetic transport failure'));
    showPanel();
    fireEvent.change(screen.getByLabelText('配置变更原因'), { target: { value: 'synthetic reason' } });
    const button = await screen.findByRole('button', { name: '审批' });
    fireEvent.click(button);
    await screen.findByText(/相同请求重试将复用幂等键/);
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(fixture.services.systemConfig.transition).toHaveBeenCalledTimes(2));
    expect(fixture.services.systemConfig.transition.mock.calls[0]).toEqual(fixture.services.systemConfig.transition.mock.calls[1]);
  });
});

it('does not expose env-managed payment configuration', async () => {
  showPanel();
  await screen.findByRole('button', { name: '素材上传策略' });
  expect(screen.queryByRole('button', { name: '微信支付配置' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('微信 AppID')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('微信商户号')).not.toBeInTheDocument();
});
