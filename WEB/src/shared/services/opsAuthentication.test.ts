import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client';
import { createOpsAuthentication, validateOpsAccount, validateOpsSession } from './opsAuthentication';

const account = { account_id: 'acct_fixture', audience: 'OPS', roles: ['ops.super_admin'], permissions: ['ops.system_config.read'], scopes: [{ type: 'PLATFORM', id: 'platform' }] };
const session = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer', expires_in: 300, account };

describe('OPS authentication API boundary', () => {
  it('uses locked endpoints, explicit retry keys and the protected token only when needed', async () => {
    const request = vi.fn().mockResolvedValue(session);
    const secured = vi.fn().mockResolvedValue(account);
    const authenticated = vi.fn(() => ({ request: secured }) as ApiClient);
    const api = createOpsAuthentication({ request } as ApiClient, authenticated);
    request.mockResolvedValueOnce({ challenge_id: 'challenge_fixture', status: 'PENDING', expires_in: 300 });
    await api.createPhoneChallenge('synthetic-phone', 'intent-challenge-0001');
    expect(request).toHaveBeenLastCalledWith({ path: '/v1/ops/auth/phone/challenges', method: 'POST', idempotencyKey: 'intent-challenge-0001', body: { phone: 'synthetic-phone' } });
    await api.loginPhone('challenge_fixture', 'synthetic-proof', 'intent-login-0001');
    await api.refresh('synthetic-refresh', 'intent-refresh-0001');
    expect(authenticated).not.toHaveBeenCalled();
    await api.current('synthetic-access');
    expect(authenticated).toHaveBeenCalledWith('synthetic-access');
    expect(secured).toHaveBeenLastCalledWith({ path: '/v1/ops/auth/me' });
    await api.logout('synthetic-access', 'intent-logout-0001');
    expect(secured).toHaveBeenLastCalledWith({ path: '/v1/ops/auth/logout', method: 'POST', idempotencyKey: 'intent-logout-0001' });
  });
  it('rejects a MINI response, malformed permissions, missing tokens and fabricated success', () => {
    for (const invalid of [null, {}, { ...account, audience: 'MINI' }, { ...account, permissions: ['allowed', 7] }, { ...account, scopes: [{ type: 'ANY', id: '*' }] }]) expect(() => validateOpsAccount(invalid)).toThrow();
    for (const invalid of [null, {}, { ...session, access_token: '' }, { ...session, expires_in: Infinity }, { ...session, account: { ...account, audience: 'MINI' } }]) expect(() => validateOpsSession(invalid)).toThrow();
    const result = validateOpsSession(session);
    result.account.permissions.push('local-change');
    expect(account.permissions).not.toContain('local-change');
  });
  it('propagates failure without retrying or falling back to demo identity', async () => {
    const error = new Error('synthetic unavailable');
    const request = vi.fn().mockRejectedValue(error);
    const api = createOpsAuthentication({ request } as ApiClient, () => ({ request }) as ApiClient);
    await expect(api.loginPhone('challenge', 'proof', 'intent-0000000001')).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
