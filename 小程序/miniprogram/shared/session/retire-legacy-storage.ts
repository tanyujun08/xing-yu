import { demoStorage } from '../../preview/storage';
// Exact retired cache keys only: never clear a real API session or user preferences.
const retiredKeys = [
  'xingyu:rental:1.0.0.11', 'xingyu:rental:1.0.0.10',
  'xingyu:rental:1.0.0.9', 'xingyu:rental:1.0.0.8',
  'xingyu:mock:1.0.0.7', 'xingyu:mock:1.0.0.6', 'xingyu:mock:1.0.0.5',
  'xingyu.session.v1', 'xingyu:user-orders:v1', 'xingyu:account-identity:v1',
  'orderDetailActor', 'disputeActor', 'ordersRole',
] as const;

export function retireLegacyStorage(): void {
  for (const key of retiredKeys) demoStorage.removeStorageSync(key);
}
