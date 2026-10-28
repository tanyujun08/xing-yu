export function toShanghaiBusinessDate(isoTime: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoTime));
}

export function toShanghaiBusinessMonth(isoTime: string): string {
  return toShanghaiBusinessDate(isoTime).slice(0, 7);
}
