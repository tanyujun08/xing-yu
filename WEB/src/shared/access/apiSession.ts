import { randomId } from '../randomId';
import { ApiProblem } from '../api/problem';
import { InvalidAuthResponse, validateOpsAccount, validateOpsSession, type OpsAuthentication, type OpsSession } from '../services/opsAuthentication';
import type { SessionProjection } from './session';

export const API_SESSION_STORAGE_KEY = 'xingyu.web-mock.v102.api-refresh.v1';
const empty: SessionProjection = { status: 'anonymous', accessToken: null, accountId: null, displayName: null, role: null, roleLabel: null, loginMethod: null, permissions: [], expiresAt: null };
interface RefreshIntent { token: string; key: string }
interface Snapshot { projection: SessionProjection; restoring: boolean; recoverable: boolean; error: string | null }
const obsolete = () => new Error('登录状态已变化，请重新确认');

// Only the opaque refresh credential and its replay key survive a reload.
// Stored permissions, roles, account IDs and mock sessions are never trusted.
export class ApiSessionStore {
  // The first render must wait for restore(), before a route guard can redirect
  // a deep link as anonymous. No stored credential is treated as authenticated.
  private snapshot: Snapshot = { projection: empty, restoring: true, recoverable: false, error: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private refreshIntent: RefreshIntent | null = null;
  private refreshFlight: Promise<void> | null = null;
  private accountFlight: Promise<void> | null = null;

  constructor(private readonly auth: OpsAuthentication, private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, private readonly now = Date.now, private readonly newKey: () => string = () => randomId()) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(next: Snapshot) { this.snapshot = next; this.listeners.forEach((listener) => listener()); }
  private save(intent: RefreshIntent | null) {
    if (intent === null) this.storage.removeItem(API_SESSION_STORAGE_KEY);
    else this.storage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(intent));
    this.refreshIntent = intent;
  }
  clear = () => {
    this.generation += 1;
    this.refreshIntent = null;
    this.refreshFlight = null;
    this.accountFlight = null;
    try { this.storage.removeItem(API_SESSION_STORAGE_KEY); } catch { /* Memory is cleared even when browser storage is unavailable. */ }
    this.emit({ projection: empty, restoring: false, recoverable: false, error: null });
  };
  invalidate = (accessToken: string | null) => {
    if (accessToken !== null && accessToken === this.snapshot.projection.accessToken) this.clear();
  };
  private fail(error: unknown, generation: number) {
    if (generation !== this.generation) return;
    const retryable = !(error instanceof InvalidAuthResponse) && (!(error instanceof ApiProblem) || error.status === 0 || error.status >= 500);
    const recoverable = retryable && this.refreshIntent !== null;
    if (!recoverable) this.clear();
    this.emit({ projection: empty, restoring: false, recoverable, error: recoverable ? '认证服务暂不可用，权限已暂停；可重试原刷新请求。' : '登录已失效，请重新登录。' });
  }
  private async accept(response: OpsSession, generation: number, expectedAccount?: string) {
    const result = validateOpsSession(response);
    if (generation !== this.generation) {
      // An in-flight login/rotation can finish after logout. Revoke that issued
      // credential without restoring it, and never replay any business action.
      await this.auth.logout(result.access_token, this.newKey()).catch(() => undefined);
      throw obsolete();
    }
    const account = validateOpsAccount(await this.auth.current(result.access_token));
    if (generation !== this.generation) {
      await this.auth.logout(result.access_token, this.newKey()).catch(() => undefined);
      throw obsolete();
    }
    if (account.account_id !== result.account.account_id || expectedAccount !== undefined && account.account_id !== expectedAccount) {
      this.clear();
      await this.auth.logout(result.access_token, this.newKey()).catch(() => undefined);
      throw obsolete();
    }
    this.save({ token: result.refresh_token, key: this.newKey() });
    this.emit({ projection: {
      status: 'authenticated', accessToken: result.access_token, accountId: account.account_id, displayName: account.display_name ?? account.account_id,
      role: null, roleLabel: account.roles.join(' / '), loginMethod: 'PHONE', permissions: account.permissions,
      roles: account.roles, scopes: account.scopes, expiresAt: new Date(this.now() + result.expires_in * 1000).toISOString(),
      ...(account.wechat_binding === undefined ? {} : { wechatBinding: account.wechat_binding }),
    }, restoring: false, recoverable: false, error: null });
  }
  createPhoneChallenge = (phone: string, key: string) => this.auth.createPhoneChallenge(phone, key);
  createWechatChallenge = async (purpose: 'LOGIN' | 'BIND', key: string) => {
    if (this.auth.wechat === undefined) throw new Error('微信绑定服务不可用');
    return this.auth.wechat.create(purpose, this.snapshot.projection.accessToken, key);
  };
  readWechatChallenge = async (purpose: 'LOGIN' | 'BIND', id: string, poll: string) => {
    if (this.auth.wechat === undefined) throw new Error('微信绑定服务不可用');
    return this.auth.wechat.read(purpose, this.snapshot.projection.accessToken, id, poll);
  };
  loginWechat = async (id: string, poll: string, key: string) => {
    if (this.auth.wechat === undefined) throw new Error('微信登录服务不可用');
    this.clear();
    const generation = this.generation;
    const response = await this.auth.wechat.login(id, poll, key);
    await this.accept(response, generation);
    if (generation === this.generation) this.emit({ ...this.snapshot, projection: { ...this.snapshot.projection, loginMethod: 'MINIPROGRAM_QR' } });
  };
  loginPhone = async (challenge: string, proof: string, key: string) => {
    this.clear();
    const generation = this.generation;
    const response = await this.auth.loginPhone(challenge, proof, key);
    await this.accept(response, generation);
  };
  restore = async () => {
    if (this.refreshFlight !== null || this.snapshot.projection.status === 'authenticated') return this.refreshFlight ?? undefined;
    if (this.refreshIntent === null) {
      try {
        const raw = this.storage.getItem(API_SESSION_STORAGE_KEY);
        if (raw === null) { this.emit({ ...this.snapshot, restoring: false }); return; }
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null || !('token' in value) || !('key' in value) || typeof value.token !== 'string' || value.token.length === 0 || typeof value.key !== 'string' || value.key.length < 16 || value.key.length > 64) { this.clear(); return; }
        this.refreshIntent = { token: value.token, key: value.key };
      } catch { this.clear(); return; }
    }
    return this.refresh();
  };
  refresh = (): Promise<void> => {
    if (this.refreshFlight !== null) return this.refreshFlight;
    const intent = this.refreshIntent;
    if (intent === null) return Promise.resolve();
    const generation = this.generation;
    const expectedAccount = this.snapshot.projection.accountId ?? undefined;
    this.emit({ ...this.snapshot, projection: empty, restoring: true, error: null });
    const flight = (async () => {
      try {
        // Persist before rotation; a lost response/reload uses this exact pair.
        this.save(intent);
        const response = await this.auth.refresh(intent.token, intent.key);
        await this.accept(response, generation, expectedAccount);
      } catch (error) { this.fail(error, generation); }
    })();
    this.refreshFlight = flight;
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; });
    return flight;
  };
  revalidate = (accessToken = this.snapshot.projection.accessToken): Promise<void> => {
    if (accessToken === null || accessToken !== this.snapshot.projection.accessToken) return Promise.resolve();
    if (this.accountFlight !== null) return this.accountFlight;
    const generation = this.generation;
    const previous = this.snapshot.projection;
    if (previous.expiresAt === null || Date.parse(previous.expiresAt) <= this.now()) return this.refresh();
    const flight = (async () => {
      try {
        const account = validateOpsAccount(await this.auth.current(accessToken));
        if (generation !== this.generation || accessToken !== this.snapshot.projection.accessToken) return;
        if (account.account_id !== previous.accountId) { this.clear(); return; }
        this.emit({ projection: { ...previous, displayName: account.display_name ?? account.account_id, ...(account.wechat_binding === undefined ? {} : { wechatBinding: account.wechat_binding }), permissions: account.permissions, roles: account.roles, scopes: account.scopes, roleLabel: account.roles.join(' / ') }, restoring: false, recoverable: false, error: null });
      } catch (error) { if (accessToken === this.snapshot.projection.accessToken) this.fail(error, generation); }
    })();
    this.accountFlight = flight;
    void flight.finally(() => { if (this.accountFlight === flight) this.accountFlight = null; });
    return flight;
  };
  logout = async () => {
    const token = this.snapshot.projection.accessToken;
    this.clear();
    if (token !== null) await this.auth.logout(token, this.newKey());
  };
}

// Read-only navigation aliases are UI affordances, not server grants. No
// DemoRole or broad system.manage/cabinet.open alias is manufactured.
const settingsReads = ['ops.system_config.read', 'ops.accounts.read', 'ops.roles.read', 'ops.audit.read'];
export function hasApiPermission(grants: readonly string[], permission: string) {
  if (grants.includes(permission)) return true;
  if (permission === 'system.view') return settingsReads.some((grant) => grants.includes(grant));
  if (permission === 'merchant.view') return grants.includes('ops.merchants.read');
  if (permission === 'merchant.manage') return grants.includes('ops.merchants.manage');
  if (permission === 'cabinet.view') return grants.includes('ops.cabinets.read');
  if (permission === 'catalog.view') return grants.includes('ops.catalog.read');
  if (permission === 'catalog.manage') return grants.includes('ops.catalog.manage');
  if (permission === 'asset.view') return grants.includes('ops.assets.read');
  if (permission === 'asset.manage') return grants.includes('ops.assets.manage');
  if (permission === 'asset.review') return grants.includes('ops.assets.review');
  if (permission === 'member.sensitive.read') return grants.includes('ops.members.sensitive.read');
  if (permission === 'order.view') return grants.includes('ops.orders.read') || grants.includes('ops.finance.read');
  if (permission === 'finance.view') return grants.includes('ops.finance.read');
  return permission.startsWith('ops.') && grants.includes(permission);
}
const pathPermissions: Readonly<Record<string, string>> = {
  '/settings/rules': 'ops.system_config.read', '/settings/admins': 'ops.accounts.read', '/settings/roles': 'ops.roles.read',
  '/settings/login-logs': 'ops.audit.read', '/settings/operation-logs': 'ops.audit.read',
  '/settings/loyalty': 'ops.system_config.read',
  '/settings/coupons': 'ops.system_config.read', '/settings/lottery-prizes': 'ops.system_config.read',
  '/merchants': 'ops.merchants.read',
  '/cabinets': 'ops.cabinets.read',
  '/catalog': 'ops.catalog.read',
  '/assets': 'ops.assets.read',
  '/orders': 'ops.orders.read', '/orders/rental': 'ops.orders.read', '/orders/contract-purchases': 'ops.finance.read', '/finance': 'ops.finance.read',
};
type LoyaltyIdentity = Pick<SessionProjection, 'roles' | 'scopes'>;
export function canAccessApiPath(grants: readonly string[], path: string, identity: LoyaltyIdentity = {}) {
  // This standalone copy has no server identity: the local preview persona sees all pages.
  if (identity.roles?.includes('ops.super_admin')) return true;
  const pathname = (path.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/';
  const route = /^\/merchants\/[^/]+$/.test(pathname) ? '/merchants' : /^\/assets\/[^/]+$/.test(pathname) ? '/assets' : pathname;
  if (route === '/settings/coupons' || route === '/settings/lottery-prizes') {
    if (identity.roles?.includes('ops.super_admin') !== true || identity.scopes?.some((scope) => scope.type === 'PLATFORM' && scope.id === 'platform') !== true) return false;
  }
  const grant = pathPermissions[route]; return grant !== undefined && grants.includes(grant);
}
export function firstApiPath(grants: readonly string[], identity: LoyaltyIdentity = {}) { return Object.keys(pathPermissions).find((path) => canAccessApiPath(grants, path, identity)) ?? '/403'; }
