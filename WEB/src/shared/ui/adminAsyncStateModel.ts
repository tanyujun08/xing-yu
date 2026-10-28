import type { AdminAsyncStateKind } from './AdminAsyncState';

export function classifyAdminAsyncError(error: unknown): AdminAsyncStateKind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (typeof error !== 'object' || error === null) return 'error';
  const code = 'code' in error ? String(error.code) : '';
  const status = 'status' in error ? Number(error.status) : undefined;
  if (status === 403 || code === 'FORBIDDEN') return 'forbidden';
  if (code === 'REQUEST_TIMEOUT' || code === 'TIMEOUT') return 'timeout';
  if (code === 'VERSION_CONFLICT' || code === 'CONFLICT') return 'conflict';
  if (code === 'UNKNOWN' || code === 'UNKNOWN_NOT_RESOLVABLE') return 'unknown';
  return 'error';
}
