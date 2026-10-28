export interface PageResult<T> {
  items: readonly T[];
  hasMore: boolean;
  nextCursor: string | null;
  generation: string;
}

export type PageLoadMode = 'initial' | 'refresh' | 'load-more';

export interface PageRequest {
  mode: PageLoadMode;
  cursor: string | null;
  generation: string | null;
  pageSize: 20;
}
