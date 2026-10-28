import type { PageRequest, PageResult } from '../../model/pagination';

export interface MockCursorItem {
  id: string;
  createdAt: string;
}

export interface MockCursorPager<T extends MockCursorItem> {
  page(snapshotKey: string, request: PageRequest, readSnapshot: () => readonly T[]): PageResult<T>;
}

interface Snapshot<T> {
  key: string;
  generation: string;
  items: readonly T[];
  cursorByOffset: Map<number, string>;
}

interface CursorRecord {
  key: string;
  generation: string;
  offset: number;
}

function stableNewestFirst<T extends MockCursorItem>(left: T, right: T): number {
  return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
}

function shallowClone<T extends MockCursorItem>(item: T): T {
  return { ...item };
}

/**
 * In-memory Mock cursor contract. Consumers must treat generation and cursor
 * values as opaque; offsets remain private to this adapter.
 */
export function createMockCursorPager<T extends MockCursorItem>(
  cloneItem: (item: T) => T = shallowClone,
): MockCursorPager<T> {
  const snapshots = new Map<string, Snapshot<T>>();
  const activeGenerationByKey = new Map<string, string>();
  const cursors = new Map<string, CursorRecord>();
  let tokenSequence = 0;

  function nextToken(kind: 'generation' | 'cursor'): string {
    tokenSequence += 1;
    return `mock-${kind}-${tokenSequence.toString(36).padStart(8, '0')}`;
  }

  function removeSnapshot(generation: string): void {
    const snapshot = snapshots.get(generation);
    if (!snapshot) return;
    for (const cursor of snapshot.cursorByOffset.values()) cursors.delete(cursor);
    snapshots.delete(generation);
  }

  function cursorFor(snapshot: Snapshot<T>, offset: number): string {
    const existing = snapshot.cursorByOffset.get(offset);
    if (existing) return existing;
    const cursor = nextToken('cursor');
    snapshot.cursorByOffset.set(offset, cursor);
    cursors.set(cursor, { key: snapshot.key, generation: snapshot.generation, offset });
    return cursor;
  }

  function resultFor(snapshot: Snapshot<T>, offset: number): PageResult<T> {
    const end = Math.min(offset + 20, snapshot.items.length);
    const hasMore = end < snapshot.items.length;
    return {
      items: snapshot.items.slice(offset, end).map(cloneItem),
      hasMore,
      nextCursor: hasMore ? cursorFor(snapshot, end) : null,
      generation: snapshot.generation,
    };
  }

  function createSnapshot(key: string, readSnapshot: () => readonly T[]): PageResult<T> {
    const seen = new Set<string>();
    const items = readSnapshot().map(cloneItem).sort(stableNewestFirst);
    for (const item of items) {
      const id = item.id.trim();
      if (!id) throw new Error('Mock cursor item id is required');
      if (!item.createdAt.trim()) throw new Error(`Mock cursor item createdAt is required: ${id}`);
      if (seen.has(id)) throw new Error(`Duplicate Mock cursor item id: ${id}`);
      seen.add(id);
    }

    const previousGeneration = activeGenerationByKey.get(key);
    if (previousGeneration) removeSnapshot(previousGeneration);
    const generation = nextToken('generation');
    const snapshot: Snapshot<T> = { key, generation, items, cursorByOffset: new Map() };
    snapshots.set(generation, snapshot);
    activeGenerationByKey.set(key, generation);
    return resultFor(snapshot, 0);
  }

  return {
    page(snapshotKey, request, readSnapshot) {
      const key = snapshotKey.trim();
      if (!key) throw new Error('Mock cursor snapshot key is required');
      if (request.pageSize !== 20) throw new Error('Mock cursor pageSize must be 20');

      if (request.mode !== 'load-more') {
        if (request.cursor !== null) throw new Error('Reset pagination cannot carry a cursor');
        return createSnapshot(key, readSnapshot);
      }

      if (!request.cursor || !request.generation) throw new Error('Load-more requires cursor and generation');
      const activeGeneration = activeGenerationByKey.get(key);
      if (activeGeneration !== request.generation) throw new Error('Stale Mock cursor generation');
      const cursor = cursors.get(request.cursor);
      if (!cursor || cursor.key !== key || cursor.generation !== request.generation) throw new Error('Invalid Mock cursor');
      const snapshot = snapshots.get(request.generation);
      if (!snapshot) throw new Error('Mock cursor snapshot is unavailable');
      return resultFor(snapshot, cursor.offset);
    },
  };
}
