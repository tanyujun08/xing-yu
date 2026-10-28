import type { ConfigKey, ConfigValues } from '../../shared/services/contracts';

type MaterialPolicy = ConfigValues['material.upload_policy'];
type MaterialLimit = MaterialPolicy['class_limits'][number];

export const materialPolicyClasses = ['PROFILE_IMAGE', 'CATALOG_IMAGE', 'RENTAL_ASSET_IMAGE', 'MERCHANT_IMAGE', 'SYSTEM_MATERIAL', 'SYSTEM_ICON', 'EVIDENCE_IMAGE', 'CATALOG_VIDEO', 'RENTAL_ASSET_VIDEO', 'EVIDENCE_VIDEO', 'CHAT_IMAGE', 'CONTRACT_SIGNATURE_IMAGE'] as const;
const imageMIMEs = ['image/jpeg', 'image/png', 'image/webp'] as const;
const materialMIMEs = [...imageMIMEs, 'video/mp4', 'application/pdf', 'application/json', 'text/csv'] as const;

export function materialClassMIMEs(materialClass: MaterialLimit['class']): readonly MaterialLimit['mimes'][number][] {
  if (materialClass === 'CONTRACT_SIGNATURE_IMAGE') return ['image/png'];
  if (materialClass === 'SYSTEM_ICON') return ['image/png', 'image/webp'];
  if (materialClass.endsWith('_VIDEO')) return ['video/mp4'];
  return imageMIMEs;
}

export function materialClassMaxBytes(materialClass: MaterialLimit['class']): number {
  if (materialClass === 'CONTRACT_SIGNATURE_IMAGE') return 2097152;
  if (materialClass === 'CATALOG_VIDEO' || materialClass === 'RENTAL_ASSET_VIDEO') return 100000000;
  return materialClass === 'EVIDENCE_VIDEO' ? 104857600 : 10485760;
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;
}

function nonEmptySubset<T extends string>(values: unknown, allowed: readonly T[]): values is T[] {
  return Array.isArray(values) && values.length > 0 && values.every((value) => typeof value === 'string' && allowed.some((item) => item === value)) && new Set(values).size === values.length;
}

export function validMaterialUploadPolicy(value: unknown): value is MaterialPolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  const fields = ['allowed_classes', 'allowed_mime_types', 'max_bytes', 'upload_ttl_seconds', 'scan_required', 'class_limits'];
  if (Object.keys(p).some((field) => !fields.includes(field)) ||
    !nonEmptySubset(p.allowed_classes, materialPolicyClasses) || !nonEmptySubset(p.allowed_mime_types, materialMIMEs) ||
    !integerInRange(p.max_bytes, 1, 104857600) || !integerInRange(p.upload_ttl_seconds, 30, 900) || p.scan_required !== true ||
    !Array.isArray(p.class_limits) || p.class_limits.length !== p.allowed_classes.length) return false;
  const allowedClasses = p.allowed_classes;
  const allowedMIMEs = p.allowed_mime_types;
  const maxBytes = p.max_bytes;
  const classes = new Set<string>();
  for (const value of p.class_limits) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const limit = value as Record<string, unknown>;
    const limitFields = ['class', 'mimes', 'max_bytes', 'processing_required', 'max_duration_ms'];
    if (Object.keys(limit).some((field) => !limitFields.includes(field)) || typeof limit.class !== 'string' ||
      !allowedClasses.some((materialClass) => materialClass === limit.class) || classes.has(limit.class)) return false;
    const materialClass = allowedClasses.find((item) => item === limit.class);
    if (materialClass === undefined || !nonEmptySubset(limit.mimes, materialClassMIMEs(materialClass)) ||
      !limit.mimes.every((mime) => allowedMIMEs.some((allowed) => allowed === mime)) ||
      !integerInRange(limit.max_bytes, 1, Math.min(maxBytes, materialClassMaxBytes(materialClass)))) return false;
    if (materialClass === 'EVIDENCE_VIDEO') {
      if (limit.processing_required !== true || !integerInRange(limit.max_duration_ms, 1, 600000)) return false;
    } else if (limit.processing_required !== false || Object.hasOwn(limit, 'max_duration_ms')) return false;
    classes.add(materialClass);
  }
  return true;
}

export function validConfigurationDraft(key: ConfigKey, values: ConfigValues): boolean {
  if (Object.values(values[key]).some((value) => typeof value === 'number' && (!Number.isFinite(value) || !Number.isInteger(value)))) return false;
  if (key === 'material.upload_policy') {
    return validMaterialUploadPolicy(values[key]);
  }
  if (key === 'identity.profile_policy') { const p = values[key]; return p.display_name_min_length >= 1 && p.display_name_max_length <= 64 && p.display_name_min_length <= p.display_name_max_length; }
  const p = values[key];
  return p.allowed_scenes.length > 0 && p.ttl_seconds >= 60 && p.ttl_seconds <= 600 && p.cooldown_seconds >= 30 && p.cooldown_seconds <= p.ttl_seconds && p.max_attempts >= 3 && p.max_attempts <= 5 && p.phone_daily_limit >= 1 && p.phone_daily_limit <= 65535 && p.ip_daily_limit >= 1 && p.ip_daily_limit <= 65535;
}
