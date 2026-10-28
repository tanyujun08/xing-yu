import type { DemoRole } from './session';

export const demoAccountsByRole: Readonly<Record<DemoRole, { accountId: string; displayName: string }>> = Object.freeze({
  SUPER_ADMIN: { accountId: 'mock-super-admin', displayName: '林运营' },
  OPERATIONS: { accountId: 'mock-operations-001', displayName: '周运营' },
  AFTER_SALES: { accountId: 'mock-after-sales-001', displayName: '陈售后' },
  FINANCE: { accountId: 'mock-finance-001', displayName: '王财务' },
});
