import { describe, expect, it } from 'vitest';
import { adminQueryScope, createAdminQueryKeys } from './adminQueryKeys';

describe('admin query keys', () => {
  it('isolates equal resources by account, role and permission scope', () => {
    const base = {
      status: 'authenticated' as const,
      accessToken: null,
      displayName: '测试用户',
      roleLabel: '运营人员',
      loginMethod: 'PHONE' as const,
      expiresAt: '2026-08-29T00:00:00.000Z',
    };
    const first = createAdminQueryKeys(adminQueryScope({ ...base, accountId: 'a', role: 'OPERATIONS', permissions: ['order.view'] }));
    const second = createAdminQueryKeys(adminQueryScope({ ...base, accountId: 'b', role: 'OPERATIONS', permissions: ['order.view'] }));
    expect(first.resource('orders', 'list')).not.toEqual(second.resource('orders', 'list'));
    expect(first.resource('orders', 'list').slice(0, 3)).toEqual(first.scope);
  });
});
