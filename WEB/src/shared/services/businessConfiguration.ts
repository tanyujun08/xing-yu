import type { ApiClient } from '../api/client';
import type { components } from '../api/generated/schema';
import { ApiProblem } from '../api/problem';

export function businessConfigurationFieldErrors(error: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!(error instanceof ApiProblem)) return fields;
  if (typeof error.details?.field === 'string') fields[error.details.field.replace(/^value\./, '')] = error.message;
  if (Array.isArray(error.details?.errors)) for (const item of error.details.errors as unknown[]) {
    if (typeof item === 'object' && item !== null && 'field' in item && typeof item.field === 'string' && 'reason' in item && typeof item.reason === 'string') fields[item.field.replace(/^value\./, '')] = item.reason;
  }
  return fields;
}

export interface BusinessPolicies {
  'membership.levels': components['schemas']['MembershipLevelsPolicy'];
  'benefits.check_in': components['schemas']['CheckInPolicyV2'];
  'entitlement.catalog': components['schemas']['EntitlementCatalogPolicyV2'];
  'rental.creation_defaults': components['schemas']['RentalCreationDefaultsPolicy'];
  'rental.order_policy': components['schemas']['RentalOrderPolicy'];
}
export type BusinessKey = keyof BusinessPolicies;
export type BusinessEffective = components['schemas']['BusinessEffectiveConfig'];
export type BusinessVersion = components['schemas']['BusinessConfigVersion'];
export type BusinessReward = components['schemas']['BusinessRewardItem'];
export type BusinessInput<K extends BusinessKey = BusinessKey> = {
  config_key: K; schema_version: number; expected_epoch: number;
  value: BusinessPolicies[K]; reason: string;
};
export interface BusinessConfigurationGateway {
  effective(signal?: AbortSignal): Promise<BusinessEffective[]>;
  publish<K extends BusinessKey>(input: BusinessInput<K>, key: string): Promise<BusinessVersion>;
  versions(key: BusinessKey | 'benefits.catalog', cursor: string, signal?: AbortSignal): Promise<{ items: BusinessVersion[]; page: components['schemas']['CursorPageMeta'] }>;
}
export function createBusinessConfiguration(client: ApiClient): BusinessConfigurationGateway {
  return {
    effective: async (signal) => (await client.request<{ items: BusinessEffective[] }>({ path: '/v1/ops/system-config/effective', ...(signal === undefined ? {} : { signal }) })).items,
    publish: (body, idempotencyKey) => client.request({ path: '/v1/ops/system-config/business-publications', method: 'POST', body, idempotencyKey }),
    versions: (key, cursor, signal) => client.request({ path: `/v1/ops/system-config/versions?config_key=${encodeURIComponent(key)}&page_size=20${cursor === '' ? '' : `&cursor=${encodeURIComponent(cursor)}`}`, ...(signal === undefined ? {} : { signal }) }),
  };
}
