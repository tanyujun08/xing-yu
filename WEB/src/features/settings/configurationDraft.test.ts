import { describe, expect, it } from 'vitest';
import { defaultConfigValues } from '../../shared/services/createIntegratedAdminServices';
import { validConfigurationDraft, validMaterialUploadPolicy } from './configurationDraft';

describe('material upload policy', () => {
  it('accepts contract signatures and chat images with their actual server limits', () => {
    const values = structuredClone(defaultConfigValues);
    const policy = values['material.upload_policy'];
    expect(policy.allowed_classes).toContain('CHAT_IMAGE');
    expect(policy.allowed_classes).toContain('CONTRACT_SIGNATURE_IMAGE');
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(true);
    const signature = policy.class_limits.find(limit => limit.class === 'CONTRACT_SIGNATURE_IMAGE')!;
    expect(signature).toEqual({ class: 'CONTRACT_SIGNATURE_IMAGE', mimes: ['image/png'], max_bytes: 2097152, processing_required: false });
    signature.max_bytes = 2097153;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
    signature.max_bytes = 2097152;
    signature.mimes = ['image/jpeg'];
    expect(validMaterialUploadPolicy(policy)).toBe(false);
    signature.mimes = ['image/png'];
    const chat = policy.class_limits.find(limit => limit.class === 'CHAT_IMAGE')!;
    expect(chat.max_bytes).toBe(10485760);
    expect(chat.mimes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    chat.max_bytes = 10485761;
    policy.max_bytes = 104857600;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
  it('keeps upload acceptance TTL bounds without browse expiry', () => {
    const values = structuredClone(defaultConfigValues);
    expect(values['material.upload_policy']).not.toHaveProperty('download_ttl_seconds');
    for (const ttl of [30, 900]) {
      values['material.upload_policy'].upload_ttl_seconds = ttl;
      expect(validConfigurationDraft('material.upload_policy', values)).toBe(true);
    }
    for (const ttl of [29, 901, 30.5, NaN, Infinity]) {
      values['material.upload_policy'].upload_ttl_seconds = ttl;
      expect(validConfigurationDraft('material.upload_policy', values)).toBe(false);
    }
  });
});

type MaterialPolicy = typeof defaultConfigValues['material.upload_policy'];
const invalidMaterialPolicies: readonly [string, (policy: MaterialPolicy) => void][] = [
  ['missing class limit', (p) => { p.class_limits.pop(); }],
  ['duplicate class', (p) => { p.allowed_classes[1] = p.allowed_classes[0]!; p.class_limits[1] = structuredClone(p.class_limits[0]!); }],
  ['duplicate limit class', (p) => { p.class_limits[1] = structuredClone(p.class_limits[0]!); }],
  ['class mismatch', (p) => { p.class_limits[0]!.class = 'EVIDENCE_IMAGE'; }],
  ['MIME outside global set', (p) => { p.allowed_mime_types = ['image/png']; }],
  ['wrong image MIME', (p) => { p.allowed_mime_types.push('video/mp4'); p.class_limits[0]!.mimes = ['video/mp4']; }],
  ['duplicate MIME', (p) => { p.class_limits[0]!.mimes.push('image/png'); }],
  ['zero class bytes', (p) => { p.class_limits[0]!.max_bytes = 0; }],
  ['fractional class bytes', (p) => { p.class_limits[0]!.max_bytes = 1.5; }],
  ['nonfinite class bytes', (p) => { p.class_limits[0]!.max_bytes = Infinity; }],
  ['class exceeds global', (p) => { p.max_bytes = 1024; }],
  ['image exceeds 10MiB', (p) => { p.max_bytes = 104857600; p.class_limits[0]!.max_bytes = 10485761; }],
  ['unexpected image processing', (p) => { p.class_limits[0]!.processing_required = true; }],
  ['unexpected image duration', (p) => { p.class_limits[0]!.max_duration_ms = 1; }],
  ['inactive document consumer', (p) => { p.allowed_classes[0] = 'CONTRACT_DOCUMENT'; p.allowed_mime_types.push('application/pdf'); p.class_limits[0] = { class: 'CONTRACT_DOCUMENT', mimes: ['application/pdf'], max_bytes: 1024, processing_required: false }; }],
];

describe('current material V2 limits', () => {
  it('accepts the seven-image default and rejects the retired root shape and unknown fields', () => {
    const policy = structuredClone(defaultConfigValues['material.upload_policy']);
    expect(validMaterialUploadPolicy(policy)).toBe(true);
    const { class_limits, ...withoutLimits } = policy;
    expect(class_limits).toHaveLength(7);
    expect(validMaterialUploadPolicy(withoutLimits)).toBe(false);
    expect(validMaterialUploadPolicy({ ...policy, download_ttl_seconds: 300 })).toBe(false);
  });
  it.each(invalidMaterialPolicies)('rejects %s', (_name, mutate) => {
    const policy = structuredClone(defaultConfigValues['material.upload_policy']);
    mutate(policy);
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
  it.each([0, 104857601, 1.5, NaN, Infinity])('rejects invalid global bytes %s', (bytes) => {
    const policy = structuredClone(defaultConfigValues['material.upload_policy']);
    policy.max_bytes = bytes;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
  it.each(['CATALOG_VIDEO', 'RENTAL_ASSET_VIDEO'] as const)('keeps %s as bounded MP4 original without a duration', (materialClass) => {
    const policy: MaterialPolicy = { allowed_classes: [materialClass], allowed_mime_types: ['video/mp4'], max_bytes: 104857600, upload_ttl_seconds: 300, scan_required: true, class_limits: [{ class: materialClass, mimes: ['video/mp4'], max_bytes: 100000000, processing_required: false }] };
    expect(validMaterialUploadPolicy(policy)).toBe(true);
    policy.class_limits[0]!.max_bytes = 100000001;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
    policy.class_limits[0]!.max_bytes = 100000000;
    policy.class_limits[0]!.processing_required = true;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
    policy.class_limits[0]!.processing_required = false;
    policy.class_limits[0]!.max_duration_ms = 1;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
  it('requires bounded evidence processing and keeps its global byte ceiling', () => {
    const policy: MaterialPolicy = { allowed_classes: ['EVIDENCE_VIDEO'], allowed_mime_types: ['video/mp4'], max_bytes: 104857600, upload_ttl_seconds: 300, scan_required: true, class_limits: [{ class: 'EVIDENCE_VIDEO', mimes: ['video/mp4'], max_bytes: 104857600, processing_required: true, max_duration_ms: 600000 }] };
    expect(validMaterialUploadPolicy(policy)).toBe(true);
    for (const duration of [0, 600001, 1.5, NaN, Infinity]) {
      policy.class_limits[0]!.max_duration_ms = duration;
      expect(validMaterialUploadPolicy(policy)).toBe(false);
    }
    policy.class_limits[0]!.max_duration_ms = 1;
    policy.class_limits[0]!.processing_required = false;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
    policy.class_limits[0]!.processing_required = true;
    delete policy.class_limits[0]!.max_duration_ms;
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
  it('accepts only PNG or WebP for the current icon consumer', () => {
    const policy: MaterialPolicy = { allowed_classes: ['SYSTEM_ICON'], allowed_mime_types: ['image/png', 'image/webp'], max_bytes: 10485760, upload_ttl_seconds: 30, scan_required: true, class_limits: [{ class: 'SYSTEM_ICON', mimes: ['image/png'], max_bytes: 10485760, processing_required: false }] };
    expect(validMaterialUploadPolicy(policy)).toBe(true);
    policy.allowed_mime_types.push('image/jpeg');
    policy.class_limits[0]!.mimes = ['image/jpeg'];
    expect(validMaterialUploadPolicy(policy)).toBe(false);
  });
});

describe('SMS policy attempt boundary', () => {
  it.each([0, 1, 2, 6, 10, 3.5, NaN, Infinity])('rejects out-of-contract attempts %s', (attempts) => {
    const values = structuredClone(defaultConfigValues);
    values['sms.challenge_policy'].max_attempts = attempts;
    expect(validConfigurationDraft('sms.challenge_policy', values)).toBe(false);
  });
  it.each([3, 4, 5])('accepts locked attempts %s', (attempts) => {
    const values = structuredClone(defaultConfigValues);
    values['sms.challenge_policy'].max_attempts = attempts;
    expect(validConfigurationDraft('sms.challenge_policy', values)).toBe(true);
  });
});
