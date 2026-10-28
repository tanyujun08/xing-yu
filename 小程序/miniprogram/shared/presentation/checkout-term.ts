import { beijingInputToUTC, rentalDate } from './rental-order';
import { dateDiffDays } from './rental-calendar';

export function validateCheckoutDates(start: string, end: string, minimumDays: number, earliest = '', latest = '') {
  if (!start || !end) throw new Error('请先选择开始日期和归还日期');
  const from = beijingInputToUTC(start, '00:00'), to = beijingInputToUTC(end, '00:00');
  if (start < rentalDate(new Date().toISOString())) throw new Error('开始日期已过期，请重新选择今天或之后的日期');
  const days = dateDiffDays(start, end);
  if (days <= 0) throw new Error('归还日期必须晚于开始日期');
  if (days < minimumDays) throw new Error(`该设备至少租用 ${minimumDays} 天，请延后归还日期`);
  if ((earliest && start < earliest) || (latest && end > latest)) throw new Error('所选租期超出设备可租日期，请重新选择');
  return { from, to, days };
}

export function checkoutError(error: unknown): string {
  if (error instanceof Error && 'code' in error && error.code === 'VALIDATION_FAILED') {
    const details = 'details' in error && error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : undefined;
    const issues = details?.['errors'];
    if (Array.isArray(issues)) {
      const reasons = issues.flatMap((issue: unknown) => {
        if (!issue || typeof issue !== 'object') return [];
        const value = issue as Record<string, unknown>;
        return typeof value['reason'] === 'string' && typeof value['rule'] === 'string' && value['rule'].startsWith('RENTAL_') ? [value['reason']] : [];
      });
      if (reasons.length) return [...new Set(reasons)].join('；');
    }
    return '租赁条件未通过校验，请重新选择完整租期，并核对设备起租天数和可租日期';
  }
  return error instanceof Error ? error.message : '暂时无法核对费用，请稍后重试';
}
