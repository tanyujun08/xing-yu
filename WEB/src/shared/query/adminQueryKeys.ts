import { useSession, type SessionProjection } from '../access/session';

export interface AdminQueryScope {
  readonly key: string;
  readonly accountId: string;
  readonly role: string;
  readonly permissions: readonly string[];
}

export function adminQueryScope(session: SessionProjection): AdminQueryScope {
  const accountId = session.accountId ?? 'anonymous';
  const role = session.role ?? 'none';
  const permissions = [...session.permissions].sort();
  return Object.freeze({
    key: `${accountId}:${role}:${permissions.join(',')}${session.scopes === undefined ? '' : ':' + JSON.stringify(session.scopes.map((scope) => [scope.type, scope.id]).sort())}`,
    accountId,
    role,
    permissions,
  });
}

export function createAdminQueryKeys(scope: AdminQueryScope) {
  const scopeRoot = ['admin', 'scope', scope.key] as const;
  return Object.freeze({
    root: ['admin'] as const,
    scope: scopeRoot,
    domain: (domain: string) => [...scopeRoot, domain] as const,
    resource: (domain: string, resource: string, ...params: readonly unknown[]) =>
      [...scopeRoot, domain, resource, ...params] as const,
  });
}

export function useAdminQueryKeys() {
  const session = useSession();
  return createAdminQueryKeys(adminQueryScope(session));
}
