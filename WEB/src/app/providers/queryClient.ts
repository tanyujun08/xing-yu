import { QueryClient } from '@tanstack/react-query';

interface RetryableProblem {
  status: number;
  code: string;
}

function isRetryableProblem(error: unknown): error is RetryableProblem {
  return typeof error === 'object' && error !== null
    && typeof (error as Partial<RetryableProblem>).status === 'number'
    && typeof (error as Partial<RetryableProblem>).code === 'string';
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (isRetryableProblem(error)) {
    return error.code !== 'REQUEST_CANCELLED'
      && error.code !== 'UNKNOWN'
      && (error.status === 0 || error.status >= 500);
  }
  return error instanceof TypeError;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        staleTime: 5_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
