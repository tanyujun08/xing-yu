import { describe, expect, test, vi } from 'vitest';
import { createCursorList, type CursorListPatch } from '../miniprogram/shared/interaction/cursor-list';
import type { PageRequest, PageResult } from '../miniprogram/shared/model/pagination';

interface Item { id: string; label: string }

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

function page(items: readonly Item[], generation: string, nextCursor: string | null): PageResult<Item> {
  return { items, generation, nextCursor, hasMore: nextCursor !== null };
}

describe('cursor list controller', () => {
  test('deduplicates concurrent bottom triggers and emits only incremental row paths', async () => {
    const more = deferred<PageResult<Item>>();
    const load = vi.fn((request: PageRequest) => request.mode === 'initial'
      ? page([{ id: '1', label: 'one' }], 'g1', 'cursor-1')
      : more.promise);
    const patches: CursorListPatch<Item>[] = [];
    const list = createCursorList<Item, Item>({
      load,
      present: (item) => ({ ...item }),
      getId: (item) => item.id,
      onPatch: (patch) => patches.push(patch),
    });

    await list.initial();
    const triggers = Array.from({ length: 10 }, () => list.loadMore());
    expect(triggers.every((promise) => promise === triggers[0])).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    more.resolve(page([{ id: '1', label: 'duplicate' }, { id: '2', label: 'two' }], 'g1', null));
    await triggers[0];
    expect(list.rows.map((item) => item.id)).toEqual(['1', '2']);
    expect(patches[patches.length - 1]?.append).toEqual([{ path: 'items[1]', value: { id: '2', label: 'two' } }]);
    expect(list.state).toEqual({ phase: 'ready', incremental: 'done' });
    await list.loadMore();
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('invalidates an old generation and preserves content when refresh fails', async () => {
    const oldMore = deferred<PageResult<Item>>();
    let refreshFails = false;
    const load = vi.fn((request: PageRequest) => {
      if (request.mode === 'initial') return page([{ id: '1', label: 'one' }], 'g1', 'cursor-1');
      if (request.mode === 'load-more') return oldMore.promise;
      if (refreshFails) throw new Error('refresh failed');
      return page([{ id: '3', label: 'new snapshot' }], 'g2', null);
    });
    const list = createCursorList<Item, Item>({
      load,
      present: (item) => ({ ...item }),
      getId: (item) => item.id,
      onPatch: () => undefined,
    });
    await list.initial();
    const stale = list.loadMore();
    await Promise.resolve();
    await list.refresh();
    oldMore.resolve(page([{ id: '2', label: 'old' }], 'g1', null));
    await stale;
    expect(list.rows).toEqual([{ id: '3', label: 'new snapshot' }]);

    refreshFails = true;
    await list.refresh();
    expect(list.rows).toEqual([{ id: '3', label: 'new snapshot' }]);
    expect(list.state).toEqual({ phase: 'ready', incremental: 'refresh-error' });
  });

  test.each(['resolve', 'reject'] as const)('does not append an old cursor while refresh is pending and then %s', async (outcome) => {
    const refresh = deferred<PageResult<Item>>();
    const load = vi.fn((request: PageRequest) => {
      if (request.mode === 'initial') return page([{ id: '1', label: 'old snapshot' }], 'g1', 'cursor-1');
      if (request.mode === 'refresh') return refresh.promise;
      return page([{ id: '2', label: 'must not append' }], 'g1', null);
    });
    const list = createCursorList<Item, Item>({
      load,
      present: (item) => ({ ...item }),
      getId: (item) => item.id,
      onPatch: () => undefined,
    });
    await list.initial();
    const refreshing = list.refresh();
    const bottomTriggers = Array.from({ length: 10 }, () => list.loadMore());
    await Promise.all(bottomTriggers);
    expect(load.mock.calls.filter(([request]) => request.mode === 'load-more')).toHaveLength(0);
    expect(list.rows).toEqual([{ id: '1', label: 'old snapshot' }]);
    if (outcome === 'resolve') {
      refresh.resolve(page([{ id: '3', label: 'new snapshot' }], 'g2', null));
      await refreshing;
      expect(list.rows).toEqual([{ id: '3', label: 'new snapshot' }]);
      expect(list.state).toEqual({ phase: 'ready', incremental: 'done' });
    } else {
      refresh.reject(new Error('refresh failed'));
      await refreshing;
      expect(list.rows).toEqual([{ id: '1', label: 'old snapshot' }]);
      expect(list.state).toEqual({ phase: 'ready', incremental: 'refresh-error' });
    }
  });

  test('converts malformed pages and duplicate ids into explicit error states', async () => {
    const malformed = createCursorList<Item, Item>({
      load: () => page([{ id: '1', label: 'one' }], '', 'cursor'),
      present: (item) => item,
      getId: (item) => item.id,
      onPatch: () => undefined,
    });
    await expect(malformed.initial()).resolves.toBeUndefined();
    expect(malformed.state).toMatchObject({ phase: 'initial-error' });

    const duplicate = createCursorList<Item, Item>({
      load: () => page([{ id: '1', label: 'one' }, { id: '1', label: 'again' }], 'g1', null),
      present: (item) => item,
      getId: (item) => item.id,
      onPatch: () => undefined,
    });
    await expect(duplicate.initial()).resolves.toBeUndefined();
    expect(duplicate.state).toMatchObject({ phase: 'initial-error' });
  });

  test('does not poison deduplication when presentation fails before a same-cursor retry', async () => {
    let presentationFails = true;
    const load = vi.fn((request: PageRequest) => request.mode === 'initial'
      ? page([{ id: '1', label: 'one' }], 'g1', 'cursor-1')
      : page([{ id: '2', label: 'two' }], 'g1', null));
    const list = createCursorList<Item, Item>({
      load,
      present: (item) => {
        if (item.id === '2' && presentationFails) throw new Error('presentation failed');
        return { ...item };
      },
      getId: (item) => item.id,
      onPatch: () => undefined,
    });

    await list.initial();
    await list.loadMore();
    expect(list.rows).toEqual([{ id: '1', label: 'one' }]);
    expect(list.state).toEqual({ phase: 'ready', incremental: 'load-more-error' });

    presentationFails = false;
    await list.loadMore();
    expect(list.rows).toEqual([{ id: '1', label: 'one' }, { id: '2', label: 'two' }]);
    expect(list.state).toEqual({ phase: 'ready', incremental: 'done' });
    expect(load).toHaveBeenCalledTimes(3);
  });
});
