import { afterEach, describe, expect, test, vi } from 'vitest';
import { createBusyVisibility } from '../miniprogram/shared/interaction/busy-visibility';
import { createFlushableDebounce } from '../miniprogram/shared/interaction/debounce';
import { createIntentKeyRegistry } from '../miniprogram/shared/interaction/intent-key';
import { createNavigateOnce, type NavigationCallbacks } from '../miniprogram/shared/interaction/navigate-once';
import { createOperationScope, OperationDisposedError } from '../miniprogram/shared/interaction/operation-scope';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('operation scope', () => {
  test('registers a single-flight promise before invoking a synchronous or asynchronous task', async () => {
    const scope = createOperationScope();
    const pending = deferred<string>();
    const task = vi.fn(() => pending.promise);
    const calls = Array.from({ length: 10 }, () => scope.singleFlight('purchase:quota', task));
    expect(calls.every((promise) => promise === calls[0])).toBe(true);
    expect(task).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    pending.resolve('ok');
    await expect(calls[0]).resolves.toBe('ok');

    const syncThrow = vi.fn(() => { throw new Error('sync failure'); });
    await expect(scope.singleFlight('retryable', syncThrow)).rejects.toThrow('sync failure');
    await expect(scope.singleFlight('retryable', () => 'recovered')).resolves.toBe('recovered');
    expect(syncThrow).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  test('accepts only the latest completion and invalidates callbacks after disposal', async () => {
    const scope = createOperationScope();
    const firstDeferred = deferred<string>();
    const secondDeferred = deferred<string>();
    const first = scope.latest('media:avatar', () => firstDeferred.promise);
    await Promise.resolve();
    const second = scope.latest('media:avatar', () => secondDeferred.promise);
    await Promise.resolve();
    secondDeferred.resolve('new');
    await expect(second).resolves.toEqual({ accepted: true, value: 'new' });
    firstDeferred.resolve('old');
    await expect(first).resolves.toEqual({ accepted: false });

    const lateEffect = vi.fn();
    const guarded = scope.guard(lateEffect);
    const flush = vi.fn();
    const cleanup = vi.fn();
    scope.registerFlush(flush);
    scope.registerCleanup(cleanup);
    scope.setTimeout(guarded, 1);
    scope.dispose();
    guarded();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(lateEffect).not.toHaveBeenCalled();
    await expect(scope.singleFlight('disposed', () => 'nope')).rejects.toBeInstanceOf(OperationDisposedError);
  });
});

describe('busy visibility', () => {
  test('does not flash before 100ms and remains visible for 200ms once shown', () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const busy = createBusyVisibility((visible) => changes.push(visible));
    const end = busy.begin();
    vi.advanceTimersByTime(99);
    expect(busy.visible).toBe(false);
    vi.advanceTimersByTime(1);
    expect(busy.visible).toBe(true);
    end();
    vi.advanceTimersByTime(199);
    expect(busy.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(busy.visible).toBe(false);
    expect(changes).toEqual([true, false]);
    busy.dispose();
  });

  test('cancels a short task without ever showing the spinner', () => {
    vi.useFakeTimers();
    const changes = vi.fn();
    const busy = createBusyVisibility(changes);
    const end = busy.begin();
    vi.advanceTimersByTime(40);
    end();
    vi.runAllTimers();
    expect(changes).not.toHaveBeenCalled();
  });
});

describe('navigation, debounce and intent keys', () => {
  test('uses a leading navigation lock and releases on complete, failure or watchdog', () => {
    vi.useFakeTimers();
    const gate = createNavigateOnce();
    let callbacks!: NavigationCallbacks;
    const invoke = vi.fn((value: NavigationCallbacks) => { callbacks = value; });
    expect(gate.navigateOnce('profile', invoke)).toBe(true);
    expect(gate.navigateOnce('profile', invoke)).toBe(false);
    callbacks.complete();
    expect(gate.navigateOnce('profile', invoke)).toBe(true);
    callbacks.fail(new Error('host failure'));
    expect(gate.navigateOnce('profile', invoke)).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(gate.navigateOnce('profile', invoke)).toBe(true);
    gate.dispose();
    expect(gate.navigateOnce('other', invoke)).toBe(false);
  });

  test('does not let a stale host callback release a newer navigation attempt', () => {
    vi.useFakeTimers();
    const gate = createNavigateOnce();
    const callbacks: NavigationCallbacks[] = [];
    const invoke = (value: NavigationCallbacks) => { callbacks.push(value); };
    expect(gate.navigateOnce('orders', invoke)).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(gate.navigateOnce('orders', invoke)).toBe(true);
    callbacks[0]?.complete();
    expect(gate.navigateOnce('orders', invoke)).toBe(false);
    callbacks[1]?.complete();
    expect(gate.navigateOnce('orders', invoke)).toBe(true);
  });

  test('flushes only the latest draft arguments and supports explicit cancellation', () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const debounce = createFlushableDebounce(save);
    debounce.schedule('a');
    debounce.schedule('b');
    vi.advanceTimersByTime(349);
    expect(save).not.toHaveBeenCalled();
    debounce.flush();
    expect(save).toHaveBeenCalledWith('b');
    debounce.schedule('c');
    debounce.cancel();
    vi.runAllTimers();
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('retains an intent key for unknown results and rotates only after a terminal outcome', () => {
    let counter = 0;
    const registry = createIntentKeyRegistry((scope) => `${scope}:${++counter}`);
    const first = registry.acquire('withdrawal');
    registry.settle('withdrawal', 'unknown');
    expect(registry.acquire('withdrawal')).toBe(first);
    registry.settle('withdrawal', 'business-failure');
    expect(registry.acquire('withdrawal')).not.toBe(first);
  });

  test('rejects payload drift, restores a known pending key and settles exact prefixes', () => {
    let counter = 0;
    const registry = createIntentKeyRegistry((scope) => `${scope}:${++counter}`);
    const first = registry.acquire('account:a:withdrawal', 'amount:100');
    expect(() => registry.acquire('account:a:withdrawal', 'amount:200')).toThrow(/another payload/);
    expect(registry.peekSnapshot('account:a:withdrawal')).toEqual({ key: first, payloadFingerprint: 'amount:100' });

    const restored = createIntentKeyRegistry((scope) => `${scope}:new`);
    restored.restore('account:a:withdrawal', { key: first, payloadFingerprint: 'amount:100' });
    expect(restored.acquire('account:a:withdrawal', 'amount:100')).toBe(first);
    expect(restored.findMatching('account:a:')).toEqual({ scope: 'account:a:withdrawal', key: first, payloadFingerprint: 'amount:100' });
    restored.acquire('account:a:cabinet:open:code', 'code:001');
    restored.acquire('account:a:cabinet:open:scan', 'code:002');
    expect(() => restored.findMatching('account:a:cabinet:open:')).toThrow(/still pending/);
    restored.acquire('account:b:cabinet:open:code', 'code:001');
    restored.settleMatching('account:a:cabinet:open:', 'success');
    expect(restored.peek('account:a:cabinet:open:code')).toBeNull();
    expect(restored.peek('account:a:cabinet:open:scan')).toBeNull();
    expect(restored.peek('account:b:cabinet:open:code')).not.toBeNull();
  });
});
