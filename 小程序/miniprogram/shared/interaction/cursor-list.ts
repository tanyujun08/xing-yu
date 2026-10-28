import type { PageRequest, PageResult } from '../model/pagination';
import type { ListState, ViewError } from '../model/view-state';
import { createOperationScope, type OperationScope } from './operation-scope';

export interface IncrementalRow<T> {
  path: `items[${number}]`;
  value: T;
}

export interface CursorListPatch<T> {
  state: ListState;
  replace?: readonly T[];
  append?: readonly IncrementalRow<T>[];
}

export interface CursorListOptions<TSource, TRow> {
  load: (request: PageRequest) => PageResult<TSource> | Promise<PageResult<TSource>>;
  present: (source: TSource) => TRow;
  getId: (source: TSource) => string;
  onPatch: (patch: CursorListPatch<TRow>) => void;
  toError?: (error: unknown) => ViewError;
}

export interface CursorList<T> {
  readonly state: ListState;
  readonly rows: readonly T[];
  initial(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  dispose(): void;
}

function defaultViewError(error: unknown): ViewError {
  return {
    code: 'LIST_REQUEST_FAILED',
    message: error instanceof Error ? error.message : '列表加载失败',
    retryable: true,
  };
}

class CursorListController<TSource, TRow> implements CursorList<TRow> {
  private readonly scope: OperationScope = createOperationScope();
  private stateValue: ListState = { phase: 'initial-loading' };
  private rowsValue: readonly TRow[] = [];
  private ids = new Set<string>();
  private generation: string | null = null;
  private cursor: string | null = null;
  private hasMore = true;
  private epoch = 0;
  private resetScheduled = 0;

  constructor(private readonly options: CursorListOptions<TSource, TRow>) {}

  get state(): ListState {
    return this.stateValue;
  }

  get rows(): readonly TRow[] {
    return this.rowsValue;
  }

  initial(): Promise<void> {
    return this.scheduleReset('initial');
  }

  refresh(): Promise<void> {
    return this.scheduleReset('refresh');
  }

  loadMore(): Promise<void> {
    if (this.scope.disposed || this.resetScheduled > 0 || this.stateValue.phase !== 'ready' || this.stateValue.incremental === 'refreshing' || !this.hasMore || !this.cursor || !this.generation) {
      return Promise.resolve();
    }
    const generation = this.generation;
    const cursor = this.cursor;
    return this.scope.singleFlight(`list:load-more:${generation}:${cursor}`, () => this.appendPage(generation, cursor));
  }

  dispose(): void {
    this.scope.dispose();
  }

  private scheduleReset(mode: 'initial' | 'refresh'): Promise<void> {
    // singleFlight starts its task in a microtask. Register the reset
    // synchronously so a same-tick bottom event cannot enqueue an old cursor.
    this.resetScheduled += 1;
    const operation = this.scope.singleFlight(`list:${mode}`, () => this.loadReset(mode));
    const release = () => { this.resetScheduled = Math.max(0, this.resetScheduled - 1); };
    void operation.then(release, release);
    return operation;
  }

  private loadReset(mode: 'initial' | 'refresh'): Promise<void> {
    const epoch = ++this.epoch;
    this.stateValue = mode === 'initial' || this.rowsValue.length === 0
      ? { phase: 'initial-loading' }
      : { phase: 'ready', incremental: 'refreshing' };
    this.emit({ state: this.stateValue });
    const request: PageRequest = {
      mode,
      cursor: null,
      generation: mode === 'refresh' ? this.generation : null,
      pageSize: 20,
    };
    return Promise.resolve()
      .then(() => this.options.load(request))
      .then((result) => {
          if (this.scope.disposed || epoch !== this.epoch) return;
          this.validatePage(result);
          const ids = new Set<string>();
          const rows = result.items.map((source) => {
            const id = this.normalizedId(source);
            if (ids.has(id)) throw new Error(`Duplicate list item id: ${id}`);
            ids.add(id);
            return this.options.present(source);
          });
          this.ids = ids;
          this.rowsValue = rows;
          this.generation = result.generation;
          this.cursor = result.nextCursor;
          this.hasMore = result.hasMore;
          this.stateValue = rows.length === 0
            ? { phase: 'empty' }
            : { phase: 'ready', incremental: result.hasMore ? 'idle' : 'done' };
          this.emit({ state: this.stateValue, replace: rows });
        })
      .catch((error: unknown) => {
          if (this.scope.disposed || epoch !== this.epoch) return;
          if (mode === 'refresh' && this.rowsValue.length > 0) {
            this.stateValue = { phase: 'ready', incremental: 'refresh-error' };
          } else {
            this.stateValue = { phase: 'initial-error', error: this.toError(error) };
          }
          this.emit({ state: this.stateValue });
        });
  }

  private appendPage(generation: string, cursor: string): Promise<void> {
    const epoch = this.epoch;
    this.stateValue = { phase: 'ready', incremental: 'loading-more' };
    this.emit({ state: this.stateValue });
    return Promise.resolve()
      .then(() => this.options.load({ mode: 'load-more', cursor, generation, pageSize: 20 }))
      .then((result) => {
          if (this.scope.disposed || epoch !== this.epoch || generation !== this.generation || cursor !== this.cursor) return;
          this.validatePage(result);
          if (result.generation !== generation) return;
          const additions: TRow[] = [];
          const nextIds = new Set(this.ids);
          for (const source of result.items) {
            const id = this.normalizedId(source);
            if (nextIds.has(id)) continue;
            nextIds.add(id);
            additions.push(this.options.present(source));
          }
          const startIndex = this.rowsValue.length;
          this.ids = nextIds;
          this.rowsValue = [...this.rowsValue, ...additions];
          this.cursor = result.nextCursor;
          this.hasMore = result.hasMore;
          this.stateValue = { phase: 'ready', incremental: result.hasMore ? 'idle' : 'done' };
          this.emit({
            state: this.stateValue,
            append: additions.map((value, index) => ({ path: `items[${startIndex + index}]`, value })),
          });
        })
      .catch((error: unknown) => {
          if (this.scope.disposed || epoch !== this.epoch || generation !== this.generation || cursor !== this.cursor) return;
          void this.toError(error);
          this.stateValue = { phase: 'ready', incremental: 'load-more-error' };
          this.emit({ state: this.stateValue });
        });
  }

  private validatePage(result: PageResult<TSource>): void {
    if (!result.generation.trim()) throw new Error('Page generation is required');
    if (result.hasMore && !result.nextCursor) throw new Error('A page with more items requires a next cursor');
  }

  private normalizedId(source: TSource): string {
    const id = this.options.getId(source).trim();
    if (!id) throw new Error('List item id is required');
    return id;
  }

  private toError(error: unknown): ViewError {
    return this.options.toError?.(error) ?? defaultViewError(error);
  }

  private emit(patch: CursorListPatch<TRow>): void {
    if (!this.scope.disposed) this.options.onPatch(patch);
  }
}

export function createCursorList<TSource, TRow>(options: CursorListOptions<TSource, TRow>): CursorList<TRow> {
  return new CursorListController(options);
}
