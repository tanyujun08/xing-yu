const DATE_TIME_PREFIX = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/;

function pad(part: string): string {
  return part.padStart(2, '0');
}

function normalizedParts(value: string): { date: string; time?: string } | null {
  const match = value.trim().match(DATE_TIME_PREFIX);
  if (!match) return null;
  const [, year = '', month = '', day = '', hour, minute] = match;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  return hour === undefined || minute === undefined
    ? { date }
    : { date, time: `${pad(hour)}:${pad(minute)}` };
}

export function formatDate(value: string): string {
  return normalizedParts(value)?.date ?? value.trim();
}

export function formatDateTime(value: string): string {
  const parts = normalizedParts(value);
  if (!parts) return value.trim();
  return parts.time ? `${parts.date} ${parts.time}` : parts.date;
}
