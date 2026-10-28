import { createContext } from 'react';
import type { AdminServices } from './contracts';

export const AdminServicesContext = createContext<AdminServices | null>(null);
