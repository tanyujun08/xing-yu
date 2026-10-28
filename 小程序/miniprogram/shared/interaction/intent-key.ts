export type IntentOutcome = 'success' | 'business-failure' | 'cancelled' | 'unknown';

export interface IntentKeySnapshot {
  key: string;
  payloadFingerprint: string;
}

export interface ScopedIntentKeySnapshot extends IntentKeySnapshot {
  scope: string;
}

export class IntentKeyConflictError extends Error {
  constructor(readonly scope: string) {
    super(`Intent ${scope} is still pending with another payload`);
    this.name = 'IntentKeyConflictError';
  }
}

export interface IntentKeyRegistry {
  acquire(scope: string, payloadFingerprint?: string): string;
  peek(scope: string): string | null;
  peekSnapshot(scope: string): IntentKeySnapshot | null;
  findMatching(scopePrefix: string): ScopedIntentKeySnapshot | null;
  restore(scope: string, snapshot: IntentKeySnapshot): void;
  settle(scope: string, outcome: IntentOutcome): void;
  settleMatching(scopePrefix: string, outcome: IntentOutcome): void;
}

class StableIntentKeyRegistry implements IntentKeyRegistry {
  private readonly keys = new Map<string, IntentKeySnapshot>();

  constructor(private readonly createKey: (scope: string) => string) {}

  acquire(scope: string, payloadFingerprint = ''): string {
    const normalized = scope.trim();
    if (!normalized) throw new Error('Intent scope is required');
    const normalizedPayload = payloadFingerprint.trim();
    const existing = this.keys.get(normalized);
    if (existing) {
      if (existing.payloadFingerprint !== normalizedPayload) throw new IntentKeyConflictError(normalized);
      return existing.key;
    }
    const key = this.createKey(normalized).trim();
    if (!key) throw new Error('Intent key factory returned an empty key');
    this.keys.set(normalized, { key, payloadFingerprint: normalizedPayload });
    return key;
  }

  peek(scope: string): string | null {
    return this.keys.get(scope.trim())?.key ?? null;
  }

  peekSnapshot(scope: string): IntentKeySnapshot | null {
    const current = this.keys.get(scope.trim());
    return current ? { ...current } : null;
  }

  findMatching(scopePrefix: string): ScopedIntentKeySnapshot | null {
    const normalizedPrefix = scopePrefix.trim();
    if (!normalizedPrefix) throw new Error('Intent scope prefix is required');
    const matches = [...this.keys.entries()].filter(([scope]) => scope.startsWith(normalizedPrefix));
    if (matches.length > 1) throw new IntentKeyConflictError(normalizedPrefix);
    const match = matches[0];
    return match ? { scope: match[0], ...match[1] } : null;
  }

  restore(scope: string, snapshot: IntentKeySnapshot): void {
    const normalized = scope.trim();
    const key = snapshot.key.trim();
    const payloadFingerprint = snapshot.payloadFingerprint.trim();
    if (!normalized || !key) throw new Error('Intent restore requires a scope and key');
    const existing = this.keys.get(normalized);
    if (existing && (existing.key !== key || existing.payloadFingerprint !== payloadFingerprint)) {
      throw new IntentKeyConflictError(normalized);
    }
    this.keys.set(normalized, { key, payloadFingerprint });
  }

  settle(scope: string, outcome: IntentOutcome): void {
    if (outcome !== 'unknown') this.keys.delete(scope.trim());
  }

  settleMatching(scopePrefix: string, outcome: IntentOutcome): void {
    if (outcome === 'unknown') return;
    const normalizedPrefix = scopePrefix.trim();
    if (!normalizedPrefix) throw new Error('Intent scope prefix is required');
    for (const scope of this.keys.keys()) {
      if (scope.startsWith(normalizedPrefix)) this.keys.delete(scope);
    }
  }
}

export function createIntentKeyRegistry(createKey: (scope: string) => string): IntentKeyRegistry {
  return new StableIntentKeyRegistry(createKey);
}
