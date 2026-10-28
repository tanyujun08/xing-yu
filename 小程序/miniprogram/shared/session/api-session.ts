import { demoStorage } from '../../preview/storage';
import type { components } from '../../../types/api/schema';

type SessionResponse = components['schemas']['SessionResponse'];
export interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId: string;
}
const storageKey = 'xingyu.api-session.v1';

export function readStoredApiSession(): ApiSession | null {
  const value: unknown = demoStorage.getStorageSync(storageKey);
  if (!value || typeof value !== 'object') return null;
  const session = value as Partial<ApiSession>;
  if (typeof session.accessToken !== 'string' || !session.accessToken || session.accessToken.startsWith('session:')
    || typeof session.refreshToken !== 'string' || typeof session.accountId !== 'string' || !session.accountId
    || typeof session.expiresAt !== 'number' || !Number.isFinite(session.expiresAt)) return null;
  return session as ApiSession;
}

export function readApiSession(): ApiSession | null {
  const session = readStoredApiSession();
  return session && session.expiresAt > Date.now() ? session : null;
}

export function saveApiSession(response: SessionResponse): void {
  if (response.token_type !== 'Bearer' || response.account.audience !== 'MINIPROGRAM'
    || !response.account.account_id || !response.access_token || response.access_token.startsWith('session:')
    || !response.refresh_token || !Number.isSafeInteger(response.expires_in) || response.expires_in < 1 || response.expires_in > 1800) {
    throw new Error('登录服务返回了无效会话');
  }
  demoStorage.setStorageSync(storageKey, { accessToken: response.access_token, refreshToken: response.refresh_token,
    expiresAt: Date.now() + response.expires_in * 1000, accountId: response.account.account_id } satisfies ApiSession);
}

export function clearApiSession(expectedToken: string): void {
  // A late 401 from an old request must never revoke a newer login.
  if (readStoredApiSession()?.accessToken === expectedToken) demoStorage.removeStorageSync(storageKey);
}
