import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../shared/access/session';

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  return session.hasPermission(permission) && session.canAccessPath(location.pathname) ? children : <Navigate to="/403" replace />;
}
