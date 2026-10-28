import { readStoredApiSession } from '../session/api-session';

let snapshot: { owner: string; count: string; asOf: number } | null = null;
const listeners = new Set<() => void>();
export function publishOrderUnread(owner: string, count: string, asOf: string) {
  if (readStoredApiSession()?.accountId !== owner || !/^(0|[1-9][0-9]*)$/.test(count)) return;
  const time = Date.parse(asOf); if (!Number.isFinite(time) || snapshot?.owner === owner && time < snapshot.asOf) return;
  snapshot = { owner, count, asOf: time }; for (const callback of listeners) callback();
}
export function readOrderUnread() { return snapshot?.owner === readStoredApiSession()?.accountId ? snapshot?.count ?? '0' : '0'; }
export function subscribeOrderUnread(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
