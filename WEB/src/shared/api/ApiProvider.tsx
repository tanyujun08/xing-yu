import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSession } from '../access/session';
import { publicEnv } from '../config/env';
import { createApiClient, type ApiClient } from './client';

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const client = useMemo(
    () =>
      createApiClient({
        baseURL: publicEnv.apiBaseURL,
        getAccessToken: () => session.accessToken,
        onUnauthorized: session.clearSession,
      }),
    [session.accessToken, session.clearSession],
  );
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error('useApiClient must be used inside ApiProvider');
  }
  return client;
}
