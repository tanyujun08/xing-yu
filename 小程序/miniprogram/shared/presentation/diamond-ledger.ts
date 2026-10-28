import { formatDateTime } from '../format/date-time';

export type DiamondLedgerFilter = 'all' | 'income' | 'expense';

export interface DiamondLedgerSource {
  id: string;
  direction: string;
  points: number;
  note: string;
  createdAt: string;
}

export interface DiamondLedgerItem {
  id: string;
  title: string;
  time: string;
  amount: string;
  tone: 'plus' | 'minus';
  kind: Exclude<DiamondLedgerFilter, 'all'>;
  points: number;
}

export interface MonthlyDiamondChange {
  monthlyGained: string;
  monthlySpent: string;
}

function isIncome(direction: string): boolean {
  return direction === 'credit' || direction === 'release';
}

export function presentDiamondLedgerItem(entry: DiamondLedgerSource): DiamondLedgerItem {
  const income = isIncome(entry.direction);
  return {
    id: entry.id,
    title: entry.note,
    time: formatDateTime(entry.createdAt),
    amount: `${income ? '+' : '−'}${entry.points}`,
    tone: income ? 'plus' : 'minus',
    kind: income ? 'income' : 'expense',
    points: entry.points,
  };
}

export function monthlyDiamondChange(
  entries: readonly DiamondLedgerSource[],
  now = new Date(),
): MonthlyDiamondChange {
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let gained = 0;
  let spent = 0;
  for (const entry of entries) {
    if (!entry.createdAt.startsWith(monthPrefix)) continue;
    if (isIncome(entry.direction)) gained += entry.points;
    else spent += entry.points;
  }
  return { monthlyGained: `+${gained}`, monthlySpent: `−${spent}` };
}
