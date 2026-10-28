import { expect, it } from 'vitest';
import { hasLoyaltyAccess, isLoyaltySuperAdmin } from './loyaltyAccess';

it('requires the current super role, exact platform scope, and the resource permission together', () => {
  const superAdmin = { roles: ['ops.super_admin'], scopes: [{ type: 'PLATFORM', id: 'platform' }], permissions: ['ops.system_config.read'] };
  expect(hasLoyaltyAccess(superAdmin, 'ops.system_config.read')).toBe(true);
  expect(hasLoyaltyAccess(superAdmin, 'ops.business_config.publish')).toBe(false);
  expect(hasLoyaltyAccess({ ...superAdmin, roles: ['ops.operations'] }, 'ops.system_config.read')).toBe(false);
  expect(hasLoyaltyAccess({ ...superAdmin, scopes: [{ type: 'PLATFORM', id: 'other' }] }, 'ops.system_config.read')).toBe(false);
  expect(hasLoyaltyAccess({ ...superAdmin, scopes: [{ type: 'ACCOUNT', id: 'platform' }] }, 'ops.system_config.read')).toBe(false);
  expect(isLoyaltySuperAdmin({})).toBe(false);
});
