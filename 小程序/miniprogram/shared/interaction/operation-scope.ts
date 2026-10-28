export class OperationDisposedError extends Error {
  constructor() {
    super('Operation scope has been disposed');
    this.name = 'OperationDisposedError';
  }
}

export type LatestResult<T> =
  | { accepted: true; value: T }
  | { accepted: false };

export interface OperationScope {
  readonly disposed: boolean;
  singleFlight<T>(key: string, task: () => T | Promise<T>): Promise<T>;
  latest<T>(key: string, task: (isCurrent: () => boolean) => T | Promise<T>): Promise<LatestResult<T>>;
  guard<TArgs extends readonly unknown[]>(callback: (...args: TArgs) => void): (...args: TArgs) => void;
  registerCleanup(cleanup: () => void): () => void;
  registerFlush(flush: () => void): () => void;
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  setInterval(callback: () => void, delayMs: number): ReturnType<typeof setInterval>;
  clearTimer(handle: ReturnType<typeof setTimeout>): void;
  onHide(): void;
  dispose(): void;
}

function normalizeKey(key: string): string {
  const normalized = key.trim();
  if (!normalized) throw new Error('Operation key is required');
  return normalized;
}

class PageOperationScope implements OperationScope {
  private disposedValue = false;
  private readonly flights = new Map<string, Promise<unknown>>();
  private readonly latestTokens = new Map<string, number>();
  private readonly cleanups = new Set<() => void>();
  private readonly flushes = new Set<() => void>();
  private readonly timers = new Map<ReturnType<typeof setTimeout>, 'timeout' | 'interval'>();

  get disposed(): boolean {
    return this.disposedValue;
  }

  singleFlight<T>(key: string, task: () => T | Promise<T>): Promise<T> {
    const normalized = normalizeKey(key);
    const existing = this.flights.get(normalized);
    if (existing) return existing as Promise<T>;
    if (this.disposedValue) return Promise.reject(new OperationDisposedError());

    const operation = Promise.resolve().then(() => {
      if (this.disposedValue) throw new OperationDisposedError();
      return task();
    });
    this.flights.set(normalized, operation);
    const release = () => {
      if (this.flights.get(normalized) === operation) this.flights.delete(normalized);
    };
    void operation.then(release, release);
    return operation;
  }

  latest<T>(key: string, task: (isCurrent: () => boolean) => T | Promise<T>): Promise<LatestResult<T>> {
    const normalized = normalizeKey(key);
    if (this.disposedValue) return Promise.resolve({ accepted: false });
    const token = (this.latestTokens.get(normalized) ?? 0) + 1;
    this.latestTokens.set(normalized, token);
    const isCurrent = () => !this.disposedValue && this.latestTokens.get(normalized) === token;
    return new Promise<LatestResult<T>>((resolve, reject) => {
      void Promise.resolve().then(() => {
        if (!isCurrent()) {
          resolve({ accepted: false });
          return;
        }
        void Promise.resolve()
          .then(() => task(isCurrent))
          .then(
            (value) => resolve(isCurrent() ? { accepted: true, value } : { accepted: false }),
            (error: unknown) => {
              if (isCurrent()) reject(error);
              else resolve({ accepted: false });
            },
          );
      });
    });
  }

  guard<TArgs extends readonly unknown[]>(callback: (...args: TArgs) => void): (...args: TArgs) => void {
    return (...args: TArgs) => {
      if (!this.disposedValue) callback(...args);
    };
  }

  registerCleanup(cleanup: () => void): () => void {
    if (this.disposedValue) {
      cleanup();
      return () => undefined;
    }
    this.cleanups.add(cleanup);
    return () => this.cleanups.delete(cleanup);
  }

  registerFlush(flush: () => void): () => void {
    if (this.disposedValue) return () => undefined;
    this.flushes.add(flush);
    return () => this.flushes.delete(flush);
  }

  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    if (this.disposedValue) throw new OperationDisposedError();
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      if (!this.disposedValue) callback();
    }, delayMs);
    this.timers.set(handle, 'timeout');
    return handle;
  }

  setInterval(callback: () => void, delayMs: number): ReturnType<typeof setInterval> {
    if (this.disposedValue) throw new OperationDisposedError();
    const handle = setInterval(() => {
      if (!this.disposedValue) callback();
    }, delayMs);
    this.timers.set(handle, 'interval');
    return handle;
  }

  clearTimer(handle: ReturnType<typeof setTimeout>): void {
    const kind = this.timers.get(handle);
    if (kind === 'interval') clearInterval(handle);
    else clearTimeout(handle);
    this.timers.delete(handle);
  }

  onHide(): void {
    if (this.disposedValue) return;
    for (const flush of [...this.flushes]) flush();
  }

  dispose(): void {
    if (this.disposedValue) return;
    for (const flush of [...this.flushes]) flush();
    this.disposedValue = true;
    this.flushes.clear();
    this.latestTokens.clear();
    for (const [handle, kind] of this.timers) {
      if (kind === 'interval') clearInterval(handle);
      else clearTimeout(handle);
    }
    this.timers.clear();
    for (const cleanup of [...this.cleanups]) cleanup();
    this.cleanups.clear();
    this.flights.clear();
  }
}

export function createOperationScope(): OperationScope {
  return new PageOperationScope();
}
