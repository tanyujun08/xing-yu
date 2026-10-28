function normalizeBaseURL(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
}

export const publicEnv = Object.freeze({
  appMode: 'visual-preview',
  apiBaseURL: normalizeBaseURL('/preview-local'),
  materialPublicOrigin: (import.meta.env.VITE_DIRECT_OSS_ORIGIN ?? '').trim(),
  tencentMapKey: (import.meta.env.VITE_TENCENT_MAP_KEY ?? '').trim(),
});

export const apiIntegrationEnabled = true;
