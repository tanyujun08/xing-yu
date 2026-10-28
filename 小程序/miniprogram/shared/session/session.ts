import { demoStorage } from '../../preview/storage';
export interface SessionSnapshot {
  accessToken: string;
  expiresAt: number;
}

const storageKey = 'xingyu.session.v1';
let memorySession: SessionSnapshot | null = null;

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<SessionSnapshot>;
  return typeof candidate.accessToken === 'string' && typeof candidate.expiresAt === 'number';
}

export function readSession(now = Date.now()): SessionSnapshot | null {
  const stored: unknown = typeof wx !== 'undefined' && typeof demoStorage.getStorageSync === 'function' ? demoStorage.getStorageSync(storageKey) : memorySession;
  if (!isSessionSnapshot(stored) || stored.expiresAt <= now) {
    memorySession = null;
    if (typeof wx !== 'undefined' && typeof demoStorage.removeStorageSync === 'function' && stored !== '') demoStorage.removeStorageSync(storageKey);
    return null;
  }
  memorySession = stored;
  return stored;
}

export function writeSession(session: SessionSnapshot): void {
  if (!isSessionSnapshot(session) || session.expiresAt <= Date.now()) {
    throw new Error('Cannot persist an invalid or expired session');
  }
  memorySession = session;
  if (typeof wx !== 'undefined' && typeof demoStorage.setStorageSync === 'function') demoStorage.setStorageSync(storageKey, session);
}

export function clearSession(): void {
  memorySession = null;
  if (typeof wx !== 'undefined' && typeof demoStorage.removeStorageSync === 'function') demoStorage.removeStorageSync(storageKey);
}

export function startSession(accountId: string, expiresInMs = 30 * 24 * 60 * 60 * 1000): SessionSnapshot {
  const session = { accessToken: `session:${accountId}`, expiresAt: Date.now() + expiresInMs };
  writeSession(session);
  return session;
}

export function sessionAccountId(): string | null {
  const session = readSession();
  if (!session || !session.accessToken.startsWith('session:')) return null;
  return session.accessToken.slice('session:'.length) || null;
}

export function hasActiveSession(): boolean {
  return sessionAccountId() !== null;
}
