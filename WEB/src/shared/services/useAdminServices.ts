import { useContext } from 'react';
import { AdminServicesContext } from './AdminServicesContext';
import type { AdminServices } from './contracts';

export function useAdminServices(): AdminServices {
  const services = useContext(AdminServicesContext);
  if (services === null) {
    throw new Error('useAdminServices must be used inside AdminServicesProvider');
  }
  return services;
}
