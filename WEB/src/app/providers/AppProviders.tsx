import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ConfigProvider } from 'tdesign-react';
import zhConfig from 'tdesign-react/es/locale/zh_CN';
import { SessionProvider, roleDefinitions, useSession } from '../../shared/access/session';
import { MockAdminServicesProvider, useAdminServices } from '../../shared/services';
import { adminQueryScope } from '../../shared/query/adminQueryKeys';
import { createQueryClient } from './queryClient';
import { FirstLoginWechatBinding } from '../../features/auth/components/ApiWechatPanel';
import { PreviewControls } from '../../preview/PreviewControls';

function SessionAccountValidator({ queryClient }: { queryClient: QueryClient }) {
  const services = useAdminServices();
  const session = useSession();
  const scope = adminQueryScope(session);
  const previousScope = useRef('');
  useEffect(() => {
    if (previousScope.current !== '' && previousScope.current !== scope.key) {
      const oldScopeRoot = ['admin', 'scope', previousScope.current] as const;
      void queryClient.cancelQueries({ queryKey: oldScopeRoot });
      queryClient.removeQueries({ queryKey: oldScopeRoot });
    }
    previousScope.current = scope.key;
  }, [queryClient, scope.key]);
  useEffect(() => {
    const validate = async () => {
      if (session.status !== 'authenticated' || session.accountId === null || session.role === null) return;
      const account = (await services.admins.list()).find((candidate) => candidate.id === session.accountId);
      if (account === undefined || account.status !== 'ACTIVE' || account.archivedAt !== null || account.role !== session.role) {
        session.clearSession();
        return;
      }
      const definition = roleDefinitions[account.role];
      if (session.permissions.some((permission) => !definition.permissions.includes(permission))) session.clearSession();
    };
    void validate();
    const onFocus = () => { void validate(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [services, session]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ConfigProvider globalConfig={zhConfig}>
      <SessionProvider>
        <MockAdminServicesProvider>
          <SessionAccountValidator queryClient={queryClient} />
          <QueryClientProvider client={queryClient}>{children}<FirstLoginWechatBinding /><PreviewControls /></QueryClientProvider>
        </MockAdminServicesProvider>
      </SessionProvider>
    </ConfigProvider>
  );
}
