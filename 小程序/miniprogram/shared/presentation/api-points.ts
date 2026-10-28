/** F-LOYALTY: GROWTH uses tenths; PINK is a separate integer account. */
export function displayGrowthUnits(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value)) return '—';
  if (value.length === 19 && value > '9223372036854775807') return '—';
  const whole = value.length === 1 ? '0' : value.slice(0, -1);
  const fraction = value.slice(-1);
  return fraction === '0' ? whole : `${whole}.${fraction}`;
}
