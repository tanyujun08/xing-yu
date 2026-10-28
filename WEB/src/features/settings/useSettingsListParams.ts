import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

function readPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function useSettingsListParams(defaultPageSize = 10) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = readPositiveInteger(searchParams.get('page'), 1);
  const pageSize = readPositiveInteger(searchParams.get('pageSize'), defaultPageSize);

  const get = useCallback((key: string) => searchParams.get(key) ?? '', [searchParams]);
  const update = useCallback((patch: Readonly<Record<string, string | number | null | undefined>>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { page, pageSize, get, update };
}
