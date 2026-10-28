import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { ApiProblem } from '../api/problem';
import type { ConfigVersion } from './contracts';
import { configurationFailureMessage, createIntegratedAdminServices, defaultConfigValues } from './createIntegratedAdminServices';

describe('configuration API gateway', () => {
  it('binds role permission changes to the original role version and retry intent', async () => {
    const role = { role_id: 'role/finance', role_code: 'ops.finance', status: 'ACTIVE' as const, version: 7, permissions: ['ops.audit.read'] };
    const request = vi.fn().mockResolvedValue(role);
    const iam = createIntegratedAdminServices({ request } as ApiClient).iam!;
    await iam.replaceRolePermissions!(role, ['ops.audit.read'], '更新财务权限', 'role-intent-12345678');
    await iam.replaceRolePermissions!(role, ['ops.audit.read'], '更新财务权限', 'role-intent-12345678');
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/iam/roles/role%2Ffinance/permissions', method: 'PUT', aggregateVersion: '"role-7"', idempotencyKey: 'role-intent-12345678', body: { permissions: ['ops.audit.read'], reason: '更新财务权限' } });
  });
  it('preserves each IAM cursor page without an unbounded fetch or first-page truncation', async () => {
    const page = { items: [], page: { page_size: 20, has_more: true, next_cursor: 'next' } };
    const request = vi.fn().mockResolvedValue(page);
    const services = createIntegratedAdminServices({ request } as ApiClient);
    const signal = new AbortController().signal;
    await expect(services.iam?.listAccounts('prior+cursor', { signal })).resolves.toBe(page);
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/iam/accounts?page_size=20&cursor=prior%2Bcursor', signal });
    await expect(services.iam?.listLoginEvents('login', { signal })).resolves.toBe(page);
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/iam/login-events?page_size=20&cursor=login', signal });
    await expect(services.iam?.listOperationEvents('operation', { signal })).resolves.toBe(page);
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/iam/operation-events?page_size=20&cursor=operation', signal });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('fails closed for every unimplemented domain instead of reading or writing a mock service', () => {
    const request = vi.fn();
    const services = createIntegratedAdminServices({ request } as ApiClient);
    expect(() => services.dashboard.getSummary()).toThrow('API 模式尚未接入');
    expect(() => services.rules.getCurrent()).toThrow('API 模式尚未接入');
    expect(() => services.cabinets.list()).toThrow('API 模式尚未接入');
    expect(request).not.toHaveBeenCalled();
  });
  it('sends only file and class multipart fields, the original key, progress and cancellation', async () => {
    const request = vi.fn().mockResolvedValue({});
    const services = createIntegratedAdminServices({ request } as ApiClient);
    const file = new File(['png'], 'original.png', { type: 'image/png' });
    const signal = new AbortController().signal;
    const onUploadProgress = vi.fn();
    await services.materials.uploadFile(file, 'CATALOG_IMAGE', 'original-upload-key', { signal, onUploadProgress });
    await services.materials.uploadFile(file, 'CATALOG_IMAGE', 'original-upload-key', { signal, onUploadProgress });
    expect(request).toHaveBeenCalledTimes(2);
    for (const [options] of request.mock.calls) {
      expect(options).toMatchObject({ path: '/v1/materials/files', method: 'POST', idempotencyKey: 'original-upload-key', timeoutMs: 300000, signal, onUploadProgress });
      expect(Array.from(options.body.keys())).toEqual(['file', 'class']);
      expect(options.body.get('file')).toBe(file);
      expect(options.body.get('class')).toBe('CATALOG_IMAGE');
    }
  });
  it('retains pagination metadata and sends only the selected cursor', async () => {
    const page = { items: [], page: { page_size: 20, has_more: true, next_cursor: 'signed.cursor' } };
    const request = vi.fn().mockResolvedValue(page);
    const services = createIntegratedAdminServices({ request } as ApiClient);
    const signal = new AbortController().signal;
    await expect(services.systemConfig.listVersions('sms.challenge_policy', 'prior+cursor', { signal })).resolves.toBe(page);
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/v1/ops/system-config/versions?config_key=sms.challenge_policy&page_size=20&cursor=prior%2Bcursor', signal });
  });
  it('uses explicit typed input, strong ETag and caller-owned retry keys', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    const services = createIntegratedAdminServices({ request } as ApiClient);
    const input = { config_key: 'material.upload_policy' as const, schema_version: 2 as const, value: { ...defaultConfigValues['material.upload_policy'], max_bytes: 1024, class_limits: defaultConfigValues['material.upload_policy'].class_limits.map((limit) => ({ ...limit, max_bytes: 1024 })) } };
    await services.systemConfig.createVersion(input, 'limit uploads', 'same-intent-12345678');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: 'same-intent-12345678', body: { ...input, reason: 'limit uploads' } }));
    const version = { config_version_id: 'cfg_fixture', version: 3 } as ConfigVersion;
    await services.systemConfig.transition(version, 'publish', 'publish policy', 'publish-intent-12345678');
    await services.systemConfig.transition(version, 'publish', 'publish policy', 'publish-intent-12345678');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ aggregateVersion: '"v3"', idempotencyKey: 'publish-intent-12345678', path: '/v1/ops/system-config/versions/cfg_fixture/publish' }));
    expect(request.mock.calls[1]).toEqual(request.mock.calls[2]);
    await services.systemConfig.listEffective();
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/system-config/effective' });
  });
  it('creates only the current V2 material default without enabling video or changing the other schemas', async () => {
    const request = vi.fn().mockResolvedValue({});
    const services = createIntegratedAdminServices({ request } as ApiClient);
    await services.systemConfig.createDefault('material.upload_policy', 'create image policy');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      path: '/v1/ops/system-config/versions', method: 'POST',
      body: { config_key: 'material.upload_policy', schema_version: 2, value: defaultConfigValues['material.upload_policy'], reason: 'create image policy' },
    }));
    const policy = defaultConfigValues['material.upload_policy'];
    expect(policy.allowed_classes).toEqual(['PROFILE_IMAGE', 'CATALOG_IMAGE', 'RENTAL_ASSET_IMAGE', 'MERCHANT_IMAGE', 'SYSTEM_MATERIAL', 'CHAT_IMAGE', 'CONTRACT_SIGNATURE_IMAGE']);
    expect(policy.class_limits.map((limit) => limit.class)).toEqual(policy.allowed_classes);
    expect(policy.class_limits).toHaveLength(7);
    expect(policy.max_bytes).toBe(10485760);
    for (const limit of policy.class_limits) {
      expect(limit.processing_required).toBe(false);
      expect(limit).not.toHaveProperty('max_duration_ms');
      expect(limit.max_bytes).toBe(limit.class === 'CONTRACT_SIGNATURE_IMAGE' ? 2097152 : 10485760);
      expect(limit.mimes).toEqual(limit.class === 'CONTRACT_SIGNATURE_IMAGE' ? ['image/png'] : ['image/jpeg', 'image/png', 'image/webp']);
    }
    await services.systemConfig.createDefault('identity.profile_policy', 'create profile policy');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ body: { config_key: 'identity.profile_policy', schema_version: 1, value: defaultConfigValues['identity.profile_policy'], reason: 'create profile policy' } }));
    await services.systemConfig.createDefault('sms.challenge_policy', 'create SMS policy');
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ body: { config_key: 'sms.challenge_policy', schema_version: 1, value: defaultConfigValues['sms.challenge_policy'], reason: 'create SMS policy' } }));
  });
  it('does not retry failed writes or replace errors with a fabricated default', async () => {
    const error = new ApiProblem(409, { code: 'VERSION_CONFLICT', message: 'synthetic', request_id: 'fixture' });
    const request = vi.fn().mockRejectedValue(error);
    const services = createIntegratedAdminServices({ request } as ApiClient);
    await expect(services.systemConfig.transition({ config_version_id: 'cfg_fixture', version: 3 } as ConfigVersion, 'publish', 'publish policy', 'intent-1234567890')).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
    expect(configurationFailureMessage(error)).toContain('版本已变化');
    await expect(services.systemConfig.listEffective()).rejects.toBe(error);
  });
});
