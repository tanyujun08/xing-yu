import type { ReactNode } from 'react';
import { useSession } from './session';

export function PermissionGate(props: {
  permission: string | readonly string[];
  mode?: 'every' | 'some';
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const session = useSession();
  const required = typeof props.permission === 'string' ? [props.permission] : props.permission;
  const allowed =
    props.mode === 'some'
      ? required.some((permission) => session.hasPermission(permission))
      : required.every((permission) => session.hasPermission(permission));
  return allowed ? props.children : (props.fallback ?? null);
}
