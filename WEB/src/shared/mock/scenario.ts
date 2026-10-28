export type MockLatencyMs = 0 | 300 | 1200;
export type MockFaultKind = 'NONE' | 'FORBIDDEN' | 'SERVER_ERROR' | 'TIMEOUT' | 'CONFLICT' | 'UNKNOWN';
export type MockFaultMode = 'ONCE' | 'PERSISTENT';

export interface MockBehaviorSnapshot {
  latencyMs: MockLatencyMs;
  fault: MockFaultKind;
  faultMode: MockFaultMode;
  revision: number;
}

export class MockInjectedServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: MockFaultKind;

  constructor(kind: Exclude<MockFaultKind, 'NONE'>, message: string, status: number, code: string) {
    super(message);
    this.name = 'MockInjectedServiceError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

type Listener = () => void;

const STORAGE_KEY = 'xingyu-admin.mock-behavior.v1';
const DEFAULT_SNAPSHOT: MockBehaviorSnapshot = Object.freeze({
  latencyMs: 0,
  fault: 'NONE',
  faultMode: 'ONCE',
  revision: 0,
});

function isLatency(value: unknown): value is MockLatencyMs {
  return value === 0 || value === 300 || value === 1200;
}

function isFault(value: unknown): value is MockFaultKind {
  return value === 'NONE' || value === 'FORBIDDEN' || value === 'SERVER_ERROR'
    || value === 'TIMEOUT' || value === 'CONFLICT' || value === 'UNKNOWN';
}

function isMode(value: unknown): value is MockFaultMode {
  return value === 'ONCE' || value === 'PERSISTENT';
}

function readStoredSnapshot(): MockBehaviorSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SNAPSHOT;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SNAPSHOT;
    const parsed = JSON.parse(raw) as Partial<MockBehaviorSnapshot>;
    if (!isLatency(parsed.latencyMs) || !isFault(parsed.fault) || !isMode(parsed.faultMode)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return DEFAULT_SNAPSHOT;
    }
    return {
      latencyMs: parsed.latencyMs,
      fault: parsed.fault,
      faultMode: parsed.faultMode,
      revision: Number.isSafeInteger(parsed.revision) ? Number(parsed.revision) : 0,
    };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return DEFAULT_SNAPSHOT;
  }
}

function waitForDelay(amountMs: number, signal?: AbortSignal): Promise<void> {
  if (amountMs === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason ?? new DOMException('Request aborted', 'AbortError'));
      return;
    }
    const timeoutId = window.setTimeout(resolve, amountMs);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException('Request aborted', 'AbortError'));
    }, { once: true });
  });
}

function injectedError(kind: Exclude<MockFaultKind, 'NONE'>): MockInjectedServiceError {
  if (kind === 'FORBIDDEN') return new MockInjectedServiceError(kind, 'Mock 注入：当前角色无权访问该能力', 403, 'FORBIDDEN');
  if (kind === 'SERVER_ERROR') return new MockInjectedServiceError(kind, 'Mock 注入：服务暂时不可用', 503, 'MOCK_SERVER_ERROR');
  if (kind === 'TIMEOUT') return new MockInjectedServiceError(kind, 'Mock 注入：请求处理超时', 0, 'REQUEST_TIMEOUT');
  if (kind === 'CONFLICT') return new MockInjectedServiceError(kind, 'Mock 注入：资源版本已经变化', 409, 'VERSION_CONFLICT');
  return new MockInjectedServiceError(kind, 'Mock 注入：操作结果未知，请查询后再决定是否重试', 409, 'UNKNOWN');
}

export class MockBehaviorController {
  private snapshot = readStoredSnapshot();
  private readonly listeners = new Set<Listener>();

  getSnapshot = (): MockBehaviorSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  configure(input: Pick<MockBehaviorSnapshot, 'latencyMs' | 'fault' | 'faultMode'>): void {
    this.update({ ...input, revision: this.snapshot.revision + 1 });
  }

  clearFault(): void {
    this.update({ ...this.snapshot, fault: 'NONE', revision: this.snapshot.revision + 1 });
  }

  reset(): void {
    this.update({ ...DEFAULT_SNAPSHOT, revision: this.snapshot.revision + 1 });
  }

  async execute<T>(operation: string, signal: AbortSignal | undefined, action: () => T | Promise<T>): Promise<T> {
    await waitForDelay(this.snapshot.latencyMs, signal);
    signal?.throwIfAborted();
    const fault = this.snapshot.fault;
    if (fault !== 'NONE') {
      if (this.snapshot.faultMode === 'ONCE') this.clearFault();
      throw injectedError(fault);
    }
    const result = await action();
    signal?.throwIfAborted();
    void operation;
    return result;
  }

  private update(next: MockBehaviorSnapshot): void {
    this.snapshot = Object.freeze(next);
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.listeners.forEach((listener) => listener());
  }
}
