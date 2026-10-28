import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ListParamValue = string | number | boolean | null | undefined;
export type ListParamPatch = Readonly<Record<string, ListParamValue>>;

export interface UseListParamsOptions {
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  pageKey?: string;
  pageSizeKey?: string;
}

function readPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePageSizeOptions(values: readonly number[], fallback: number): number[] {
  const options = values.filter((value) => Number.isSafeInteger(value) && value > 0);
  return options.includes(fallback) ? options : [...options, fallback];
}

export interface PaginatedRows<T> {
  current: number;
  pageSize: number;
  total: number;
  rows: T[];
}

export function paginateListRows<T>(rows: readonly T[], requestedPage: number, pageSize: number): PaginatedRows<T> {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const current = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (current - 1) * safePageSize;
  return {
    current,
    pageSize: safePageSize,
    total: rows.length,
    rows: rows.slice(start, start + safePageSize),
  };
}

export function useListParams(options: UseListParamsOptions = {}) {
  const {
    defaultPageSize = 20,
    pageSizeOptions = [10, 20, 50],
    pageKey = 'page',
    pageSizeKey = 'pageSize',
  } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const page = readPositiveInteger(searchParams.get(pageKey), 1);
  const allowedPageSizes = normalizePageSizeOptions(pageSizeOptions, defaultPageSize);
  const requestedPageSize = readPositiveInteger(searchParams.get(pageSizeKey), defaultPageSize);
  const pageSize = allowedPageSizes.includes(requestedPageSize) ? requestedPageSize : defaultPageSize;

  const get = useCallback((key: string) => searchParams.get(key) ?? '', [searchParams]);
  const getAll = useCallback((key: string) => searchParams.getAll(key), [searchParams]);

  const update = useCallback((patch: ListParamPatch, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage && !(pageKey in patch)) next.delete(pageKey);
    setSearchParams(next, { replace: true });
  }, [pageKey, searchParams, setSearchParams]);

  const setFilters = useCallback((patch: ListParamPatch) => update(patch, true), [update]);
  const resetFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (pageSize !== defaultPageSize) next.set(pageSizeKey, String(pageSize));
    setSearchParams(next, { replace: true });
  }, [defaultPageSize, pageSize, pageSizeKey, setSearchParams]);

  return {
    page,
    pageSize,
    get,
    getAll,
    update,
    setFilters,
    resetFilters,
  };
}
