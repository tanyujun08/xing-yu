import { createApiClient, type ApiClient } from '../api/client';
import type { components } from '../api/generated/schema';

export interface OpsWechatBinding { status: 'BOUND' | 'UNBOUND'; nickname: string | null; avatar_material_id: string | null; bound_at: string | null }
export type OpsAccount = components['schemas']['AccountView'] & { display_name?: string; wechat_binding?: OpsWechatBinding };
export interface OpsWechatChallenge { challenge_id: string; purpose: 'LOGIN' | 'BIND'; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'EXPIRED'; expires_at: string; poll_token?: string; code_image?: string }
export type OpsSession = components['schemas']['SessionResponse'];
export type OpsChallenge = components['schemas']['ChallengeResponse'];

export interface OpsAuthentication {
  wechat?: {
    create(purpose: 'LOGIN' | 'BIND', accessToken: string | null, key: string): Promise<OpsWechatChallenge>;
    read(purpose: 'LOGIN' | 'BIND', accessToken: string | null, id: string, pollToken: string): Promise<OpsWechatChallenge>;
    login(id: string, pollToken: string, key: string): Promise<OpsSession>;
  };
  createPhoneChallenge(phone: string, idempotencyKey: string): Promise<OpsChallenge>;
  loginPhone(challengeId: string, proof: string, idempotencyKey: string): Promise<OpsSession>;
  refresh(refreshToken: string, idempotencyKey: string): Promise<OpsSession>;
  current(accessToken: string): Promise<OpsAccount>;
  logout(accessToken: string, idempotencyKey: string): Promise<void>;
}

export class InvalidAuthResponse extends Error {
  constructor() { super('认证服务返回无效响应，请重新登录'); this.name = 'InvalidAuthResponse'; }
}
const invalidResponse = () => new InvalidAuthResponse();
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item: unknown) => typeof item === 'string' && item.length > 0);

export function validateOpsAccount(value: unknown): OpsAccount {
  if (!isObject(value) || typeof value.account_id !== 'string' || value.account_id.length === 0 || value.audience !== 'OPS' || !isStringArray(value.roles) || !isStringArray(value.permissions) || !Array.isArray(value.scopes)) throw invalidResponse();
  const scopes: OpsAccount['scopes'] = value.scopes.map((scope: unknown) => {
    if (!isObject(scope) || typeof scope.id !== 'string' || scope.id.length === 0 || (scope.type !== 'PLATFORM' && scope.type !== 'MERCHANT' && scope.type !== 'ACCOUNT' && scope.type !== 'RESOURCE')) throw invalidResponse();
    return { id: scope.id, type: scope.type };
  });
  let binding: OpsWechatBinding | undefined;
  if (value.wechat_binding !== undefined) {
    const b = value.wechat_binding;
    if (!isObject(b) || (b.status !== 'BOUND' && b.status !== 'UNBOUND') || ![b.nickname, b.avatar_material_id, b.bound_at].every((part) => part === null || typeof part === 'string') || (b.status === 'BOUND' && (typeof b.bound_at !== 'string' || !Number.isFinite(Date.parse(b.bound_at))))) throw invalidResponse();
    binding = { status: b.status, nickname: b.nickname as string | null, avatar_material_id: b.avatar_material_id as string | null, bound_at: b.bound_at as string | null };
  }
  if (value.display_name !== undefined && typeof value.display_name !== 'string') throw invalidResponse();
  return { account_id: value.account_id, audience: 'OPS', roles: [...value.roles], permissions: [...value.permissions], scopes, ...(typeof value.display_name === 'string' ? { display_name: value.display_name } : {}), ...(binding === undefined ? {} : { wechat_binding: binding }) };
}

export function validateWechatChallenge(value: unknown, created = false): OpsWechatChallenge {
  if (!isObject(value) || typeof value.challenge_id !== 'string' || value.challenge_id === '' || (value.purpose !== 'LOGIN' && value.purpose !== 'BIND') || typeof value.status !== 'string' || !['PENDING', 'APPROVED', 'REJECTED', 'CONSUMED', 'EXPIRED'].includes(value.status) || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at))) throw invalidResponse();
  if (created && (typeof value.poll_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.poll_token) || typeof value.code_image !== 'string' || !/^data:image\/(?:png|jpeg|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(value.code_image))) throw invalidResponse();
  return { challenge_id: value.challenge_id, purpose: value.purpose, status: value.status as OpsWechatChallenge['status'], expires_at: value.expires_at, ...(created ? { poll_token: value.poll_token as string, code_image: value.code_image as string } : {}) };
}

export function validateOpsSession(value: unknown): OpsSession {
  if (!isObject(value) || value.token_type !== 'Bearer' || typeof value.access_token !== 'string' || value.access_token.length === 0 || typeof value.refresh_token !== 'string' || value.refresh_token.length === 0 || typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) throw invalidResponse();
  return { token_type: 'Bearer', access_token: value.access_token, refresh_token: value.refresh_token, expires_in: value.expires_in, account: validateOpsAccount(value.account) };
}

function validateChallenge(value: unknown): OpsChallenge {
  if (!isObject(value) || typeof value.challenge_id !== 'string' || value.challenge_id.length === 0 || value.status !== 'PENDING' || typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) throw invalidResponse();
  if (value.retry_after_seconds !== undefined && (typeof value.retry_after_seconds !== 'number' || !Number.isSafeInteger(value.retry_after_seconds) || value.retry_after_seconds < 0 || value.retry_after_seconds > 600)) throw invalidResponse();
  return { challenge_id: value.challenge_id, status: 'PENDING', expires_in: value.expires_in, ...(value.retry_after_seconds === undefined ? {} : { retry_after_seconds: value.retry_after_seconds as number }) };
}

// Public authentication requests deliberately use a client with no first-party
// access token. Protected requests use the exact supplied session token. Neither
// branch consults demo accounts, roles or a caller-selected provider mode.
export function createOpsAuthentication(publicClient: ApiClient, authenticatedClient: (token: string) => ApiClient): OpsAuthentication {
  return {
    wechat: {
      async create(purpose, accessToken, idempotencyKey) {
        const client = purpose === 'LOGIN' ? publicClient : authenticatedClient(accessToken ?? '');
        return validateWechatChallenge(await client.request<unknown, Record<string, never>>({ path: `/v1/ops/auth/${purpose === 'LOGIN' ? 'qr' : 'wechat-binding'}/challenges`, method: 'POST', idempotencyKey, body: {} }), true);
      },
      async read(purpose, accessToken, id, challengeToken) {
        const client = purpose === 'LOGIN' ? publicClient : authenticatedClient(accessToken ?? '');
        return validateWechatChallenge(await client.request<unknown>({ path: `/v1/ops/auth/${purpose === 'LOGIN' ? 'qr' : 'wechat-binding'}/challenges/${encodeURIComponent(id)}`, challengeToken }));
      },
      async login(challenge_id, proof, idempotencyKey) {
        return validateOpsSession(await publicClient.request<unknown, { challenge_id: string; proof: string }>({ path: '/v1/ops/auth/qr/sessions', method: 'POST', body: { challenge_id, proof }, idempotencyKey }));
      },
    },
    async createPhoneChallenge(phone, idempotencyKey) {
      return validateChallenge(await publicClient.request<unknown, components['schemas']['PhoneChallengeRequest']>({ path: '/v1/ops/auth/phone/challenges', method: 'POST', idempotencyKey, body: { phone } }));
    },
    async loginPhone(challengeId, proof, idempotencyKey) {
      return validateOpsSession(await publicClient.request<unknown, components['schemas']['ChallengeSessionRequest']>({ path: '/v1/ops/auth/phone/sessions', method: 'POST', idempotencyKey, body: { challenge_id: challengeId, proof } }));
    },
    async refresh(refreshToken, idempotencyKey) {
      return validateOpsSession(await publicClient.request<unknown, components['schemas']['RefreshRequest']>({ path: '/v1/ops/auth/token/refresh', method: 'POST', idempotencyKey, body: { refresh_token: refreshToken } }));
    },
    async current(accessToken) {
      return validateOpsAccount(await authenticatedClient(accessToken).request<unknown>({ path: '/v1/ops/auth/me' }));
    },
    async logout(accessToken, idempotencyKey) {
      await authenticatedClient(accessToken).request<void>({ path: '/v1/ops/auth/logout', method: 'POST', idempotencyKey });
    },
  };
}

export function createOpsAuthenticationClient(baseURL: string): OpsAuthentication {
  return createOpsAuthentication(createApiClient({ baseURL, getAccessToken: () => null }), (token) => createApiClient({ baseURL, getAccessToken: () => token }));
}
