import { designAssets } from '../design/assets';
import { formatDateTime } from '../format/date-time';

type LedgerEntry = { entry_id: string; point_kind: string; action: string; occurred_at: string; available_delta: string; earned_delta: string };
type GrowthLedger = {
  account: { point_kind: string; total_earned_points: string };
  items: readonly LedgerEntry[];
  statistics: { timezone: string; today_earned_delta: string; week_earned_delta: string };
  as_of_at: string;
};
type PointKind = 'PINK' | 'GROWTH';

/** Signed integer strings remain exact beyond JavaScript's safe integer range. */
export function pointUnits(value: string, kind: PointKind, signed = false): string {
  if (!/^-?(0|[1-9][0-9]{0,18})$/.test(value) || value === '-0') throw new Error('积分数据格式无效');
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const maximum = negative ? '9223372036854775808' : '9223372036854775807';
  if (digits.length > maximum.length || (digits.length === maximum.length && digits > maximum)) throw new Error('积分数据超出范围');
  let amount = digits;
  if (kind === 'GROWTH') {
    const whole = digits.length === 1 ? '0' : digits.slice(0, -1);
    amount = digits.endsWith('0') ? whole : whole + '.' + digits.slice(-1);
  }
  return (negative ? '−' : signed && digits !== '0' ? '+' : '') + amount;
}

/** Whole-period totals can exceed a single posting's int64 range. */
export function pointTotalUnits(value: string, kind: PointKind): string {
  if (!/^(0|[1-9][0-9]{0,64})$/.test(value)) throw new Error('积分汇总数据无效');
  if (kind === 'PINK') return value;
  const whole = value.length === 1 ? '0' : value.slice(0, -1);
  return value.endsWith('0') ? whole : whole + '.' + value.slice(-1);
}

const actionTitles: Record<string, string> = {
  EARN: '积分奖励', RESERVE: '积分预占', CONSUME: '积分使用',
  RELEASE: '解除预占', RESTORE: '积分返还', REVERSE: '积分冲正',
};
export function pointLedgerEntry(entry: LedgerEntry) {
  if (entry.point_kind !== 'GROWTH' && entry.point_kind !== 'PINK') throw new Error('积分类型无效');
  if (!Object.prototype.hasOwnProperty.call(actionTitles, entry.action) || !Number.isFinite(Date.parse(entry.occurred_at))) throw new Error('积分流水数据无效');
  const delta = entry.point_kind === 'GROWTH' ? entry.earned_delta : entry.available_delta;
  return {
    id: entry.entry_id, title: actionTitles[entry.action], detail: formatDateTime(new Date(Date.parse(entry.occurred_at) + 8 * 60 * 60 * 1000).toISOString()),
    amount: pointUnits(delta, entry.point_kind, true), tone: delta.startsWith('-') ? 'minus' : 'plus',
    icon: delta.startsWith('-') ? designAssets.membershipDiamond : designAssets.membershipTaskUpgrade,
  };
}
export function growthLedgerSummary(value: GrowthLedger) {
  if (value.account.point_kind !== 'GROWTH' || value.items.some(entry => entry.point_kind !== 'GROWTH')) throw new Error('积分账户类型不一致');
  if (value.statistics.timezone !== 'Asia/Shanghai' || !Number.isFinite(Date.parse(value.as_of_at))) throw new Error('积分统计数据无效');
  return {
    starBalance: pointUnits(value.account.total_earned_points, 'GROWTH'),
    today: pointUnits(value.statistics.today_earned_delta, 'GROWTH', true),
    week: pointUnits(value.statistics.week_earned_delta, 'GROWTH', true),
  };
}

type PinkLedger = {
  statistics: { timezone: string; month_start: string; month_increase_units: string; month_decrease_units: string };
  account: { point_kind: string; available_points: string; reserved_points: string; total_earned_points: string };
  items: readonly LedgerEntry[];
  as_of_at: string;
};
export function pinkLedgerSummary(value: PinkLedger) {
  if (value.account.point_kind !== 'PINK' || value.items.some(entry => entry.point_kind !== 'PINK')) throw new Error('积分账户类型不一致');
  if (value.statistics.timezone !== 'Asia/Shanghai' || !Number.isFinite(Date.parse(value.statistics.month_start)) || !Number.isFinite(Date.parse(value.as_of_at)) || Date.parse(value.statistics.month_start) > Date.parse(value.as_of_at)) throw new Error('积分账户时间无效');
  return {
    monthIncrease: pointTotalUnits(value.statistics.month_increase_units, 'PINK'),
    monthDecrease: pointTotalUnits(value.statistics.month_decrease_units, 'PINK'),
    balance: pointUnits(value.account.available_points, 'PINK'),
    totalEarned: pointUnits(value.account.total_earned_points, 'PINK'),
    reserved: pointUnits(value.account.reserved_points, 'PINK'),
  };
}
export function pinkLedgerEntry(entry: LedgerEntry & { reserved_delta: string }) {
  if (entry.point_kind !== 'PINK') throw new Error('积分类型无效');
  const row = pointLedgerEntry(entry);
  const delta = entry.action === 'CONSUME' && entry.reserved_delta!=='0' ? entry.reserved_delta : entry.available_delta;
  const transfer = entry.action === 'RESERVE' || entry.action === 'RELEASE';
  return {
    ...row, amount: pointUnits(delta, 'PINK', true), tone: delta.startsWith('-') ? 'minus' : 'plus',
    marker: transfer ? '↔' : delta === '0' ? '·' : delta.startsWith('-') ? '−' : '+',
    movementText: '可用 ' + pointUnits(entry.available_delta, 'PINK', true) + '；预占 ' + pointUnits(entry.reserved_delta, 'PINK', true),
  };
}
