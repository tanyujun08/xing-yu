import type { MockRootState, MockServiceBalance } from './mock-store';


export function availableServices(state: MockRootState, userId: string, excludeOrder = ''): MockServiceBalance {
  const balance = { ...(state.serviceBalances[userId] ?? { contract: 0, face: 0, risk: 0 }) };
  for (const hold of state.pendingServices ?? []) if (hold.userId === userId && hold.orderId !== excludeOrder) balance[hold.kind] -= hold.quantity;
  return balance;
}


