import { demoStorage } from '../../preview/storage';
import { demoWx } from '../../preview/platform';
import type { components } from '../../../types/api/schema';
import { apiOrigin } from '../config/env';
import { newIdempotencyKey, newRequestId } from '../api/idempotency';
import { ApiProblem, isProblemPayload } from '../api/problem';
import { clearApiSession, readStoredApiSession, saveApiSession, type ApiSession } from './api-session';

type SessionResponse = components['schemas']['SessionResponse'];
const intentKey = 'xingyu.api-session-refresh-intent.v1';
type RefreshIntent = { accountId: string; refreshToken: string; key: string };
let inFlight: { token: string; promise: Promise<ApiSession> } | null = null;

function refreshIntent(session: ApiSession): RefreshIntent {
  const saved: unknown = demoStorage.getStorageSync(intentKey);
  if (saved && typeof saved === 'object') {
    const value = saved as Partial<RefreshIntent>;
    if (value.accountId === session.accountId && value.refreshToken === session.refreshToken &&
      typeof value.key === 'string' && /^[!-~]{16,64}$/.test(value.key)) return value as RefreshIntent;
  }
  const value = { accountId: session.accountId, refreshToken: session.refreshToken,
    key: newIdempotencyKey('mini-refresh') };
  demoStorage.setStorageSync(intentKey, value);
  return value;
}

function performRefresh(session: ApiSession): Promise<ApiSession> {
  const intent = refreshIntent(session);
  return new Promise((resolve, reject) => {
    const requestId = newRequestId();
    demoWx.request<SessionResponse>({
      url: `${apiOrigin()}/v1/auth/token/refresh`, method: 'POST', timeout: 15_000,
      header: { Accept: 'application/json', 'Content-Type': 'application/json',
        'X-Request-ID': requestId, 'Idempotency-Key': intent.key },
      data: { refresh_token: session.refreshToken },
      success(response) {
        const current = readStoredApiSession();
        if (!current || current.refreshToken !== session.refreshToken || current.accountId !== session.accountId) {
          reject(new ApiProblem(0, { code: 'SESSION_CHANGED', message: '登录状态已变化，请重新查询', request_id: requestId }));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            if (response.data.account.account_id !== session.accountId) throw new Error('续期账户与当前账户不一致');
            saveApiSession(response.data);
            demoStorage.removeStorageSync(intentKey);
            const renewed = readStoredApiSession();
            if (!renewed) throw new Error('续期会话保存失败');
            resolve(renewed);
          } catch (error) { reject(error); }
          return;
        }
        if (response.statusCode === 401) {
          clearApiSession(session.accessToken);
          demoStorage.removeStorageSync(intentKey);
        }
        reject(new ApiProblem(response.statusCode, isProblemPayload(response.data) ? response.data :
          { code: 'SESSION_REFRESH_FAILED', message: '登录续期失败，请重新登录', request_id: requestId }));
      },
      fail(error) {
        reject(new ApiProblem(0, { code: 'SESSION_REFRESH_UNKNOWN',
          message: error.errMsg.toLowerCase().includes('timeout') ? '登录续期超时，请重试' : '登录续期网络不可用，请重试', request_id: requestId }));
      },
    });
  });
}

/** Only refresh before a business request. Never replay that request after an unknown outcome. */
export function ensureApiSession(session: ApiSession): Promise<ApiSession> {
  if (session.expiresAt > Date.now() + 30_000) return Promise.resolve(session);
  if (inFlight?.token === session.refreshToken) return inFlight.promise;
  const promise = performRefresh(session).finally(() => {
    if (inFlight?.token === session.refreshToken) inFlight = null;
  });
  inFlight = { token: session.refreshToken, promise };
  return promise;
}
