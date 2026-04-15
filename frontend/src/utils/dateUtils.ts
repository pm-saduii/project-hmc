import {
  differenceInCalendarDays,
  parseISO,
  format,
  addDays,
  isValid,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
} from 'date-fns';

export function calcDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e)) return 0;
  return Math.max(0, differenceInCalendarDays(e, s));
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, 'dd MMM yyyy');
}

export function isoToInput(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  if (!isValid(d)) return '';
  return format(d, 'yyyy-MM-dd');
}

export function getProjectDateRange(tasks: { startDate: string; endDate: string }[]) {
  const valid = tasks.filter((t) => t.startDate && t.endDate);
  if (valid.length === 0) {
    const today = new Date();
    return { minDate: today, maxDate: addDays(today, 30) };
  }
  const starts = valid.map((t) => parseISO(t.startDate)).filter(isValid);
  const ends = valid.map((t) => parseISO(t.endDate)).filter(isValid);
  const minDate = new Date(Math.min(...starts.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...ends.map((d) => d.getTime())));
  // Pad slightly
  return {
    minDate: addDays(minDate, -3),
    maxDate: addDays(maxDate, 7),
  };
}

export function getMonthColumns(minDate: Date, maxDate: Date) {
  return eachMonthOfInterval({ start: startOfMonth(minDate), end: endOfMonth(maxDate) });
}

export function getWeekColumns(minDate: Date, maxDate: Date) {
  return eachWeekOfInterval({ start: minDate, end: maxDate });
}

export function getDayColumns(minDate: Date, maxDate: Date) {
  return eachDayOfInterval({ start: minDate, end: maxDate });
}

export function dayOffset(minDate: Date, dateStr: string): number {
  const d = parseISO(dateStr);
  if (!isValid(d)) return 0;
  return Math.max(0, differenceInCalendarDays(d, minDate));
}

export { format, parseISO, addDays, isValid };
