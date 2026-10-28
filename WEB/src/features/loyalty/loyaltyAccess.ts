import type { SessionProjection } from '../../shared/access/session';

export function isLoyaltySuperAdmin(session: Pick<SessionProjection, 'roles' | 'scopes'>): boolean {
  return session.roles?.includes('ops.super_admin') === true
    && session.scopes?.some((scope) => scope.type === 'PLATFORM' && scope.id === 'platform') === true;
}

export function hasLoyaltyAccess(session: Pick<SessionProjection, 'roles' | 'scopes' | 'permissions'>, permission: string): boolean {
  return isLoyaltySuperAdmin(session) && session.permissions.includes(permission);
}
