import { randomId } from '../randomId';
import { createMerchantManagement } from './merchantManagement';
import type { ApiClient } from '../api/client';
import { ApiProblem } from '../api/problem';
import { createCabinetManagement } from './cabinetManagement';
import { createBusinessConfiguration } from './businessConfiguration';
import { createRentalOrders } from './rentalOrders';
import { createLoyaltyManagement } from './loyaltyManagement';
import { createCatalogManagement } from './catalogManagement';
import { createAssetManagement } from './assetManagement';
import type { AdminServices, ConfigDefinition, ConfigInput, ConfigKey, ConfigVersion, ConfigVersionPage, ConfigValues, EffectiveConfig, IAMAccountProjection, IAMLoginEventProjection, IAMOperationEventProjection, IAMRoleProjection, IAMPage, Material, MaterialFileResult } from './contracts';

interface ItemList<T> { items: T[] }

function auditQuery(cursor: string, filter: import('./contracts').IAMAuditFilter = {}): string {
  const query = new URLSearchParams({ page_size: String(filter.page_size ?? 20) });
  if (cursor !== '') query.set('cursor', cursor);
  for (const [key, value] of Object.entries(filter)) if (key !== 'page_size' && value !== undefined && value !== '') query.set(key, String(value));
  return query.toString();
}

async function unsupportedAdminWrite(): Promise<never> {
  throw new Error('旧管理员网关已停用，请使用后台身份管理接口');
}

export function configurationFailureMessage(error: unknown): string {
  if (error instanceof ApiProblem && error.code === 'VERSION_CONFLICT') return '版本已变化，请刷新后重新确认状态。';
  if (error instanceof ApiProblem && error.status === 403) return '当前账户没有操作权限，请刷新登录状态。';
  if (error instanceof ApiProblem && error.code === 'PRECONDITION_FAILED') return '状态或异人审批条件不满足，配置未更新。';
  if (error instanceof ApiProblem && error.status >= 400 && error.status < 500 && error.status !== 408) return error.message;
  return '操作未确认成功，请先刷新核对；相同请求重试将复用幂等键。';
}
export function isConfigurationEpochConflict(error: unknown): boolean { return error instanceof ApiProblem && error.status === 409; }

export function isDefinitiveSettingsRejection(error: unknown): boolean {
  return error instanceof ApiProblem && error.status >= 400 && error.status < 500 && error.status !== 408 && error.code !== 'IDEMPOTENCY_PENDING';
}

export const defaultConfigValues: ConfigValues = {
  'material.upload_policy': {
    allowed_classes: ['PROFILE_IMAGE', 'CATALOG_IMAGE', 'RENTAL_ASSET_IMAGE', 'MERCHANT_IMAGE', 'SYSTEM_MATERIAL', 'CHAT_IMAGE', 'CONTRACT_SIGNATURE_IMAGE'],
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    max_bytes: 10 * 1024 * 1024,
    upload_ttl_seconds: 300,
    scan_required: true,
    class_limits: (['PROFILE_IMAGE', 'CATALOG_IMAGE', 'RENTAL_ASSET_IMAGE', 'MERCHANT_IMAGE', 'SYSTEM_MATERIAL', 'CHAT_IMAGE', 'CONTRACT_SIGNATURE_IMAGE'] as const).map<ConfigValues['material.upload_policy']['class_limits'][number]>((materialClass) => ({
      class: materialClass,
      mimes: materialClass === 'CONTRACT_SIGNATURE_IMAGE' ? ['image/png'] : ['image/jpeg', 'image/png', 'image/webp'],
      max_bytes: materialClass === 'CONTRACT_SIGNATURE_IMAGE' ? 2 * 1024 * 1024 : 10 * 1024 * 1024,
      processing_required: false,
    })),
  },
  'identity.profile_policy': {
    display_name_min_length: 1,
    display_name_max_length: 64,
    allowed_locales: ['zh-CN'],
    avatar_material_class: 'PROFILE_IMAGE',
    avatar_required_status: 'READY',
  },
  'sms.challenge_policy': {
    allowed_scenes: ['OPS_LOGIN', 'PHONE_BIND'],
    digits: 6,
    ttl_seconds: 300,
    cooldown_seconds: 60,
    max_attempts: 5,
    phone_daily_limit: 10,
    ip_daily_limit: 30,
  },
};

export function configurationInput(key: ConfigKey, values: ConfigValues): ConfigInput {
  switch (key) {
    case 'material.upload_policy': return { config_key: key, schema_version: 2, value: values[key] };
    case 'identity.profile_policy': return { config_key: key, schema_version: 1, value: values[key] };
    case 'sms.challenge_policy': return { config_key: key, schema_version: 1, value: values[key] };
  }
}

function unavailableGateway<T extends object>(domain: string): T {
  return new Proxy({} as T, { get: () => () => { throw new Error(`API 模式尚未接入 ${domain}，未执行演示读写。`); } });
}

export function createIntegratedAdminServices(client: ApiClient): AdminServices {
  return {
    runtime: unavailableGateway('runtime'), dashboard: unavailableGateway('dashboard'), merchants: createMerchantManagement(client),
    cabinets: unavailableGateway('cabinets'), catalog: createCatalogManagement(client), assets: createAssetManagement(client),
    cabinetManagement: createCabinetManagement(client),
    businessConfig: createBusinessConfiguration(client),
    rentalOrders: createRentalOrders(client),
    loyaltyManagement: createLoyaltyManagement(client),
    stars: unavailableGateway('stars'),
      audit: unavailableGateway('audit'),
    sessionAudit: unavailableGateway('sessionAudit'), rules: unavailableGateway('rules'), loyalty: unavailableGateway('loyalty'), members: unavailableGateway('members'),
    systemConfig: {
      listDefinitions: async (context) => (await client.request<ItemList<ConfigDefinition>>({ path: '/v1/ops/system-config/definitions', ...(context?.signal === undefined ? {} : { signal: context.signal }) })).items,
      listEffective: async (context) => (await client.request<ItemList<EffectiveConfig>>({ path: '/v1/ops/system-config/effective', ...(context?.signal === undefined ? {} : { signal: context.signal }) })).items,
      listVersions: (key, cursor = '', context) => client.request<ConfigVersionPage>({ path: `/v1/ops/system-config/versions?config_key=${encodeURIComponent(key)}&page_size=20${cursor === '' ? '' : `&cursor=${encodeURIComponent(cursor)}`}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
      createVersion: (input, reason, idempotencyKey) => client.request<ConfigVersion, typeof input & { reason: string }>({ path: '/v1/ops/system-config/versions', method: 'POST', idempotencyKey, body: { ...input, reason } }),
      createDefault: (key, reason) => client.request<ConfigVersion, ConfigInput & { reason: string }>({ path: '/v1/ops/system-config/versions', method: 'POST', idempotencyKey: randomId(), body: { ...configurationInput(key, defaultConfigValues), reason } }),
      transition: (version, action, reason, idempotencyKey) => client.request<ConfigVersion, { reason: string }>({ path: `/v1/ops/system-config/versions/${encodeURIComponent(version.config_version_id)}/${action}`, method: 'POST', idempotencyKey, aggregateVersion: `"v${version.version}"`, body: { reason } }),
    },
    materials: {
      uploadFile: (file, materialClass, idempotencyKey, context) => {
        const body = new FormData();
        body.append('file', file);
        body.append('class', materialClass);
        return client.request<MaterialFileResult, FormData>({ path: '/v1/materials/files', method: 'POST', body, idempotencyKey, timeoutMs: 300_000, ...(context?.signal === undefined ? {} : { signal: context.signal }), ...(context?.onUploadProgress === undefined ? {} : { onUploadProgress: context.onUploadProgress }) });
      },
      get: (materialId, context) => client.request<Material>({ path: `/v1/materials/${encodeURIComponent(materialId)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    },
    admins: {
      list: async () => { throw new Error('API 账号请使用带游标的 IAM 列表；不会截断为前 100 行。'); },
      create: unsupportedAdminWrite,
      update: unsupportedAdminWrite,
      setStatus: unsupportedAdminWrite,
      archive: unsupportedAdminWrite,
      restore: unsupportedAdminWrite,
    },
    iam: {
      accounts: {
        create: (input, key) => client.request<IAMAccountProjection, typeof input>({ path: '/v1/ops/iam/accounts', method: 'POST', body: input, idempotencyKey: key }),
        update: (account, input, key) => client.request<IAMAccountProjection, typeof input>({ path: `/v1/ops/iam/accounts/${encodeURIComponent(account.account_id)}`, method: 'PATCH', body: input, idempotencyKey: key, aggregateVersion: `"account-${account.security_version}"` }),
        changeStatus: (account, action, reason, key) => client.request<IAMAccountProjection, { reason: string }>({ path: `/v1/ops/iam/accounts/${encodeURIComponent(account.account_id)}/${action}`, method: 'POST', body: { reason }, idempotencyKey: key, aggregateVersion: `"account-${account.security_version}"` }),
      },
      replaceRolePermissions: (role, permissions, reason, idempotencyKey) => client.request<IAMRoleProjection, { permissions: readonly string[]; reason: string }>({ path: `/v1/ops/iam/roles/${encodeURIComponent(role.role_id)}/permissions`, method: 'PUT', aggregateVersion: `"role-${role.version}"`, idempotencyKey, body: { permissions, reason } }),
      listRoles: async (context) => (await client.request<ItemList<IAMRoleProjection>>({ path: '/v1/ops/iam/roles', ...(context?.signal === undefined ? {} : { signal: context.signal }) })).items,
      listAccounts: (cursor = '', context, filter = {}) => {
        const query = new URLSearchParams({ page_size: '20' });
        if (cursor !== '') query.set('cursor', cursor);
        for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') query.set(key, value);
        return client.request<IAMPage<IAMAccountProjection>>({ path: `/v1/ops/iam/accounts?${query}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) });
      },
      listLoginEvents: (cursor = '', context, filter) => client.request<IAMPage<IAMLoginEventProjection>>({ path: `/v1/ops/iam/login-events?${auditQuery(cursor, filter)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
      listOperationEvents: (cursor = '', context, filter) => client.request<IAMPage<IAMOperationEventProjection>>({ path: `/v1/ops/iam/operation-events?${auditQuery(cursor, filter)}`, ...(context?.signal === undefined ? {} : { signal: context.signal }) }),
    },
  };
}
