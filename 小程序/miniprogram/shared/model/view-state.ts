export interface ViewError {
  code: string;
  message: string;
  retryable: boolean;
}

export type ListIncrementalState =
  | 'idle'
  | 'refreshing'
  | 'loading-more'
  | 'refresh-error'
  | 'load-more-error'
  | 'done';

export type ListState =
  | { phase: 'initial-loading' }
  | { phase: 'initial-error'; error: ViewError }
  | { phase: 'empty' }
  | { phase: 'ready'; incremental: ListIncrementalState };
