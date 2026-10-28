import type { LegacyMediaState, MediaDensity, MediaState } from '../model/media';

export function normalizeMediaDensity(value: string): MediaDensity {
  return value === 'thumbnail' || value === 'hero' ? value : 'card';
}

export function normalizeMediaState(value: string, source: string): MediaState {
  const normalizedSource = source.trim();
  const candidate: MediaState | LegacyMediaState =
    value === 'loading' || value === 'ready' || value === 'error' ||
    value === 'real' || value === 'failed' || value === 'empty'
      ? value
      : 'idle';
  if (candidate === 'real') return normalizedSource ? 'ready' : 'idle';
  if (candidate === 'failed') return 'error';
  if (candidate === 'empty') return 'idle';
  if (candidate === 'ready' && !normalizedSource) return 'idle';
  return candidate;
}
