import { describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '../api/problem';
import type { OpsAccount, OpsAuthentication, OpsSession } from '../services/opsAuthentication';
import { API_SESSION_STORAGE_KEY, ApiSessionStore, canAccessApiPath, firstApiPath, hasApiPermission } from './apiSession';

const account = (id = 'synthetic-ops', permissions = ['ops.accounts.read']): OpsAccount => ({ account_id: id, audience: 'OPS', roles: ['ops.operator'], permissions, scopes: [{ type: 'PLATFORM', id: 'platform' }] });
const response = (token = 'synthetic-access', identity = account()): OpsSession => ({ access_token: token, refresh_token: `refresh-${token}`, token_type: 'Bearer', expires_in: 900, account: identity });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const auth = {
    createPhoneChallenge: vi.fn().mockResolvedValue({ challenge_id: 'synthetic-challenge', status: 'PENDING', expires_in: 300 }),
    loginPhone: vi.fn().mockResolvedValue(response()), refresh: vi.fn().mockResolvedValue(response('rotated-access')),
    current: vi.fn().mockResolvedValue(account()), logout: vi.fn().mockResolvedValue(undefined),
  } satisfies OpsAuthentication;
  let time = 1_700_000_000_000;
  let sequence = 0;
  const store = new ApiSessionStore(auth, storage, () => time, () => `synthetic-request-${++sequence}`);
  return { store, data, storage, auth, advance: () => { time += 901_000; } };
}

describe('API session authority and rotation', () => {
  it('holds the first route render until credential restoration resolves', async () => {
    const { store, data, auth } = fixture();
    expect(store.getSnapshot()).toMatchObject({ restoring: true, projection: { status: 'anonymous', permissions: [] } });
    data.set(API_SESSION_STORAGE_KEY, JSON.stringify({ token: 'prior-refresh', key: 'synthetic-request-prior' }));
    const pending = deferred<OpsSession>(); auth.refresh.mockReturnValueOnce(pending.promise);
    const restoring = store.restore();
    expect(store.getSnapshot()).toMatchObject({ restoring: true, projection: { status: 'anonymous' } });
    pending.resolve(response('restored-access')); await restoring;
    expect(store.getSnapshot()).toMatchObject({ restoring: false, projection: { status: 'authenticated' } });
  });
  it('ends the initial restoration wait when no refresh credential exists', async () => {
    const { store, auth } = fixture();
    await store.restore();
    expect(store.getSnapshot()).toMatchObject({ restoring: false, projection: { status: 'anonymous' } });
    expect(auth.refresh).not.toHaveBeenCalled();
  });
  it('ignores demo storage and fabricated role/permission fields until a server readback', async () => {
    const { store, data, auth } = fixture();
    data.set('xingyu-admin.mock-session.v1', JSON.stringify({ status: 'authenticated', role: 'SUPER_ADMIN', permissions: ['system.manage'] }));
    await store.restore();
    expect(store.getSnapshot().projection.status).toBe('anonymous');
    expect(auth.refresh).not.toHaveBeenCalled();
    data.set(API_SESSION_STORAGE_KEY, JSON.stringify({ token: 'untrusted', key: 'synthetic-request-old', roles: ['ops.super_admin'], permissions: ['system.manage'] }));
    const readback = deferred<OpsAccount>(); auth.current.mockReturnValueOnce(readback.promise);
    const restoring = store.restore();
    await vi.waitFor(() => expect(auth.current).toHaveBeenCalled());
    expect(store.getSnapshot().projection.permissions).toEqual([]);
    readback.resolve(account()); await restoring;
    expect(store.getSnapshot().projection.role).toBeNull();
    expect(store.getSnapshot().projection.permissions).toEqual(['ops.accounts.read']);
    expect(JSON.parse(data.get(API_SESSION_STORAGE_KEY)!)).toEqual({ token: 'refresh-rotated-access', key: 'synthetic-request-1' });
    expect(data.has('xingyu-admin.mock-session.v1')).toBe(true);
  });
  it('coalesces rotation and retries a lost response with the exact persisted token/key', async () => {
    const { store, data, auth } = fixture();
    await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    const original = data.get(API_SESSION_STORAGE_KEY);
    auth.refresh.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: 'synthetic', request_id: 'test' }));
    const first = store.refresh(); expect(store.refresh()).toBe(first); await first;
    expect(store.getSnapshot()).toMatchObject({ recoverable: true, projection: { status: 'anonymous', permissions: [] } });
    expect(data.get(API_SESSION_STORAGE_KEY)).toBe(original);
    await store.restore();
    expect(auth.refresh.mock.calls[0]).toEqual(auth.refresh.mock.calls[1]);
    expect(store.getSnapshot().projection.accessToken).toBe('rotated-access');
    expect(data.get(API_SESSION_STORAGE_KEY)).not.toBe(original);
  });
  it.each([401, 403])('clears revoked credentials after an authentication %s', async (status) => {
    const { store, data, auth } = fixture();
    await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    auth.refresh.mockRejectedValueOnce(new ApiProblem(status, { code: 'UNAUTHENTICATED', message: 'synthetic', request_id: 'test' }));
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ recoverable: false, projection: { status: 'anonymous' } });
    expect(data.has(API_SESSION_STORAGE_KEY)).toBe(false);
  });
  it('rejects MINI responses and never derives super permissions from a server role alone', async () => {
    const { store, data, auth } = fixture();
    await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    auth.refresh.mockResolvedValueOnce({ ...response(), account: { ...account(), audience: 'MINIPROGRAM' } });
    await store.refresh();
    expect(store.getSnapshot().projection.status).toBe('anonymous'); expect(data.has(API_SESSION_STORAGE_KEY)).toBe(false);
    auth.current.mockResolvedValueOnce({ ...account(), roles: ['ops.super_admin'], permissions: [] });
    await store.loginPhone('challenge', '000000', 'synthetic-login-key-2');
    expect(store.getSnapshot().projection.permissions).toEqual([]);
    expect(firstApiPath(store.getSnapshot().projection.permissions)).toBe('/403');
  });
  it('does not let a late 401 for an old token clear the rotated identity', async () => {
    const { store } = fixture(); await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    await store.refresh(); store.invalidate('synthetic-access');
    expect(store.getSnapshot().projection.accessToken).toBe('rotated-access');
    store.invalidate('rotated-access'); expect(store.getSnapshot().projection.status).toBe('anonymous');
  });
  it('updates permissions and scope from current identity and fails closed on a Redis outage', async () => {
    const { store, auth } = fixture(); await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    auth.current.mockResolvedValueOnce({ ...account('synthetic-ops', ['ops.audit.read']), scopes: [{ type: 'RESOURCE', id: 'synthetic-resource' }] });
    await store.revalidate();
    expect(store.getSnapshot().projection).toMatchObject({ permissions: ['ops.audit.read'], scopes: [{ type: 'RESOURCE', id: 'synthetic-resource' }] });
    auth.current.mockRejectedValueOnce(new ApiProblem(503, { code: 'STORE_UNAVAILABLE', message: 'synthetic', request_id: 'test' }));
    await store.revalidate(); expect(store.getSnapshot().projection.permissions).toEqual([]);
  });
  it('rejects account changes during rotation and clears the candidate credential', async () => {
    const { store, auth } = fixture(); await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    auth.refresh.mockResolvedValueOnce(response('foreign', account('other-ops'))); auth.current.mockResolvedValueOnce(account('other-ops'));
    await store.refresh(); expect(store.getSnapshot().projection.status).toBe('anonymous');
    expect(auth.logout).toHaveBeenCalledWith('foreign', expect.any(String));
  });
  it('does not restore in-flight login or rotation after logout', async () => {
    for (const kind of ['login', 'refresh'] as const) {
      const { store, auth, data } = fixture();
      await store.loginPhone('challenge', '000000', 'synthetic-login-key');
      const result = deferred<OpsSession>(); auth[kind === 'login' ? 'loginPhone' : 'refresh'].mockReturnValueOnce(result.promise);
      const operation = kind === 'login' ? store.loginPhone('challenge', '000000', 'synthetic-login-key-2').catch(() => undefined) : store.refresh();
      await store.logout(); result.resolve(response('late-access')); await operation;
      expect(store.getSnapshot().projection.status).toBe('anonymous'); expect(data.has(API_SESSION_STORAGE_KEY)).toBe(false);
      expect(auth.logout).toHaveBeenCalledWith('late-access', expect.any(String));
    }
  });
  it('expires before accepting a current-account read and never replays a business request', async () => {
    const { store, auth, advance } = fixture(); await store.loginPhone('challenge', '000000', 'synthetic-login-key');
    advance(); await store.revalidate(); expect(auth.refresh).toHaveBeenCalledOnce();
    expect(store.getSnapshot().projection.accessToken).toBe('rotated-access');
  });
  it('maps only explicit read navigation and does not grant demo writes or unrelated pages', () => {
    expect(canAccessApiPath(['ops.materials.read'], '/settings/materials')).toBe(false);
    expect(hasApiPermission(['ops.materials.read'], 'system.view')).toBe(false);
    expect(hasApiPermission(['ops.materials.read'], 'ops.materials.upload')).toBe(false);
    const grants = ['ops.accounts.read', 'ops.audit.read'];
    expect(hasApiPermission(grants, 'system.view')).toBe(true);
    for (const permission of ['system.manage', 'cabinet.open', 'mock.control', 'ops.cabinets.open_one']) expect(hasApiPermission(grants, permission)).toBe(false);
    expect(canAccessApiPath(grants, '/settings/admins')).toBe(true);
    for (const path of ['/settings/rules', '/settings/loyalty', '/cabinet', '/', '/orders/rentals']) expect(canAccessApiPath(grants, path)).toBe(false);
    const businessGrants = ['ops.merchants.read', 'ops.catalog.read', 'ops.catalog.manage', 'ops.assets.read', 'ops.assets.manage', 'ops.assets.review'];
    expect(hasApiPermission(businessGrants, 'catalog.view')).toBe(true);
    expect(hasApiPermission(businessGrants, 'catalog.manage')).toBe(true);
    expect(hasApiPermission(businessGrants, 'asset.view')).toBe(true);
    expect(hasApiPermission(businessGrants, 'asset.manage')).toBe(true);
    expect(hasApiPermission(businessGrants, 'asset.review')).toBe(true);
    for (const path of ['/merchants', '/catalog', '/assets', '/assets/asset-test']) expect(canAccessApiPath(businessGrants, path)).toBe(true);
    expect(canAccessApiPath(businessGrants, '/cabinets')).toBe(false);
  });
  it('requires super role, platform scope and resource read permission on both loyalty routes and deep links', () => {
    const identity = { roles: ['ops.super_admin'], scopes: [{ type: 'PLATFORM', id: 'platform' }] };
    for (const path of ['/settings/coupons', '/settings/coupons/?detail_kind=coupon&detail_id=coupon-A', '/settings/lottery-prizes?tab=attempts']) {
      expect(canAccessApiPath(['ops.system_config.read'], path, identity)).toBe(true);
      expect(canAccessApiPath(['ops.system_config.read'], path)).toBe(false);
      expect(canAccessApiPath(['ops.system_config.read'], path, { ...identity, roles: ['ops.operations'] })).toBe(false);
      expect(canAccessApiPath(['ops.system_config.read'], path, { ...identity, scopes: [{ type: 'RESOURCE', id: 'platform' }] })).toBe(false);
      expect(canAccessApiPath([], path, identity)).toBe(false);
    }
  });
});
