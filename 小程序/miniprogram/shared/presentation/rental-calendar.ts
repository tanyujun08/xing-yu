export function localDateText(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysText(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateText(date);
}

export function dateDiffDays(startDate: string, endDate: string): number {
  return Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000);
}

export function shortDateText(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[2])}月${Number(match[3])}日` : value;
}

export type SheetSelectionMode = 'start' | 'end';

type SheetCalendarDay = {
  key: string;
  date: string;
  dayLabel: string;
  isPlaceholder: boolean;
  disabled: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  ariaLabel: string;
};

type SheetCalendarMonth = {
  key: string;
  title: string;
  days: SheetCalendarDay[];
};

export const calendarWeekdays = [{id:'sunday',label:'日'},{id:'monday',label:'一'},{id:'tuesday',label:'二'},{id:'wednesday',label:'三'},{id:'thursday',label:'四'},{id:'friday',label:'五'},{id:'saturday',label:'六'}];

function calendarDate(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}

function calendarDateText(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonthsText(value: string, months: number): string {
  const date = calendarDate(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return localDateText(date);
}

export function buildCalendarMonths(anchorDate: string, selectedStart = '', selectedEnd = ''): SheetCalendarMonth[] {
  const months: SheetCalendarMonth[] = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const firstDateText = addMonthsText(anchorDate, offset);
    const firstDate = calendarDate(firstDateText);
    const year = firstDate.getFullYear();
    const month = firstDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: SheetCalendarDay[] = [];

    for (let placeholder = 0; placeholder < firstWeekday; placeholder += 1) {
      days.push({ key: `${firstDateText}-empty-${placeholder}`, date: '', dayLabel: '', isPlaceholder: true, disabled: true, isToday: false, isStart: false, isEnd: false, inRange: false, ariaLabel: '' });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const value = calendarDateText(year, month, day);
      const isStart = value === selectedStart;
      const isEnd = value === selectedEnd;
      const disabled = value < anchorDate;
      days.push({
        key: value,
        date: value,
        dayLabel: String(day),
        isPlaceholder: false,
        disabled,
        isToday: value === localDateText(),
        isStart,
        isEnd,
        inRange: Boolean(selectedStart && selectedEnd && value > selectedStart && value < selectedEnd),
        ariaLabel: disabled ? `${month + 1}月${day}日不可选择` : `${month + 1}月${day}日`,
      });
    }

    months.push({ key: firstDateText, title: `${year}年${String(month + 1).padStart(2, '0')}月`, days });
  }
  return months;
}
