import { useEffect, useState } from 'react';

/** Use for remote keyword queries only. Local filters, selects and pagination stay immediate. */
export function useDebouncedValue<T>(value: T, delayMs = 275): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);
  return debounced;
}
