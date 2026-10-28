import type { ReactNode } from 'react';
import type { AdminServices } from './contracts';
import { AdminServicesContext } from './AdminServicesContext';

export interface AdminServicesProviderProps {
  children: ReactNode;
  services: AdminServices;
}

/** Environment-neutral service boundary consumed by every feature. */
export function AdminServicesProvider({ children, services }: AdminServicesProviderProps) {
  return <AdminServicesContext.Provider value={services}>{children}</AdminServicesContext.Provider>;
}
