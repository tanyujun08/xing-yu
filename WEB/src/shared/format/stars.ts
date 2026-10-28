export function formatStarTenths(value: number): string {
  return (value / 10).toLocaleString('zh-CN', { minimumFractionDigits: value % 10 === 0 ? 0 : 1, maximumFractionDigits: 1 });
}
