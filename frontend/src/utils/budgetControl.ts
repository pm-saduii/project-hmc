/**
 * Monthly Budget Control: man-day budget vs. man-days used, per the company template
 * (public/templates/budget-control-template.xlsx, sheet "Clients").
 * The figures come from the project's Effort lines (budget man-days + man-days per month).
 */
import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import type { Effort, Project } from '../types';
import { patchXlsx, downloadBytes, type RowEdit } from './xlsxPatch';

/** Standard budget lines and their row in the template. */
export const STANDARD_LINES: { code: string; name: string; group: string; row: number }[] = [
  { code: '1.1', name: '1.1 Kickoff Meeting', group: '1. Project Management', row: 13 },
  { code: '1.2', name: '1.2 Project Meeting', group: '1. Project Management', row: 14 },
  { code: '1.3', name: '1.3 Project Document (Minute, Progress status, Issue Log, Change Request)', group: '1. Project Management', row: 15 },
  { code: '2.1', name: '2.1 Requirement Assessment', group: '2. Implementation & Consults', row: 17 },
  { code: '2.2', name: '2.2 Analysis & Design (BBP)', group: '2. Implementation & Consults', row: 18 },
  { code: '2.3', name: '2.3 System Configuration', group: '2. Implementation & Consults', row: 19 },
  { code: '2.4', name: '2.4 Customization', group: '2. Implementation & Consults', row: 20 },
  { code: '2.5', name: '2.5 User Acceptance Test (UAT)', group: '2. Implementation & Consults', row: 21 },
  { code: '2.6', name: '2.6 Support Parallel & Golive', group: '2. Implementation & Consults', row: 22 },
  { code: '3.1', name: '3.1 Migration Template Training', group: '3. Data Conversion', row: 24 },
  { code: '3.2', name: '3.2 Migration data on Test base', group: '3. Data Conversion', row: 25 },
  { code: '3.3', name: '3.3 Migration data on Production base', group: '3. Data Conversion', row: 26 },
  { code: '4.1', name: '4.1 HR Training', group: '4. Training', row: 28 },
  { code: '4.2', name: '4.2 ESS Training', group: '4. Training', row: 29 },
];
const MONTH_COLUMNS = 12;   // template columns D..O
const FIRST_MONTH_COL = 4;

/** The standard line an Effort module belongs to: by its leading code ("2.3 …") or by its exact name. */
export function standardLineOf(module: string) {
  const text = String(module || '').trim();
  const code = /^(\d+\.\d+)\b/.exec(text)?.[1];
  return STANDARD_LINES.find((l) => (code && l.code === code) || l.name.toLowerCase() === text.toLowerCase()) || null;
}

export interface BudgetLine { module: string; code: string | null; budget: number; used: Record<string, number> }
export interface BudgetSnapshot {
  version: 1;
  period: string;                // YYYY-MM reported
  months: string[];              // 12-month window shown / exported
  lines: BudgetLine[];
  budget: number;
  usedToDate: number;
  usedInMonth: number;
  progress: number;              // actual % complete when taken
  takenAt: string;
}

const round = (n: number) => Math.round(n * 100) / 100;
const toDate = (v?: string) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };

export const periodLabel = (period: string) => format(parseISO(`${period}-01`), 'MMMM yyyy');
export const shiftPeriod = (period: string, n: number) => format(addMonths(parseISO(`${period}-01`), n), 'yyyy-MM');
/** The report for a month is due on the 5th of the next month. */
export const dueDateOf = (period: string) => new Date(addMonths(parseISO(`${period}-01`), 1).getFullYear(), addMonths(parseISO(`${period}-01`), 1).getMonth(), 5);
/** Last finished month: the one whose report is being prepared now. */
export const defaultPeriod = (today = new Date()) => format(addMonths(startOfMonth(today), -1), 'yyyy-MM');

/** 12 months from the project start, moved forward so the reported month is included. */
export function monthWindow(project: Pick<Project, 'startDate'>, period: string): string[] {
  const start = toDate(project.startDate);
  let first = start ? startOfMonth(start) : addMonths(parseISO(`${period}-01`), -(MONTH_COLUMNS - 1));
  const last = parseISO(`${period}-01`);
  while (addMonths(first, MONTH_COLUMNS - 1) < last) first = addMonths(first, 1);
  return Array.from({ length: MONTH_COLUMNS }, (_, i) => format(addMonths(first, i), 'yyyy-MM'));
}

export function buildBudgetSnapshot(project: Project, efforts: Effort[], period: string, progress: number): BudgetSnapshot {
  const months = monthWindow(project, period);
  const lines: BudgetLine[] = efforts.map((e) => {
    const used: Record<string, number> = {};
    Object.entries(e.monthly || {}).forEach(([m, v]) => { if (m <= period && Number(v)) used[m] = round(Number(v)); });
    return { module: e.module, code: standardLineOf(e.module)?.code || null, budget: round(Number(e.budgetManday) || 0), used };
  }).sort((a, b) => (a.code || '9').localeCompare(b.code || '9', undefined, { numeric: true }) || a.module.localeCompare(b.module));
  const sum = (f: (l: BudgetLine) => number) => round(lines.reduce((s, l) => s + f(l), 0));
  return {
    version: 1, period, months, lines,
    budget: sum((l) => l.budget),
    usedToDate: sum((l) => Object.values(l.used).reduce((a, v) => a + v, 0)),
    usedInMonth: sum((l) => l.used[period] || 0),
    progress: Math.round(progress),
    takenAt: new Date().toISOString(),
  };
}

export const usedToDate = (l: BudgetLine) => round(Object.values(l.used).reduce((a, v) => a + v, 0));

/** Fill the company template and download it. Lines that are not standard lines are not in the template. */
export async function exportBudgetXlsx(args: {
  snapshot: BudgetSnapshot; project: Project; pmName: string; reviewedName: string; approvedName: string;
}): Promise<{ skipped: string[] }> {
  const { snapshot: s, project } = args;
  const response = await fetch('/templates/budget-control-template.xlsx');
  if (!response.ok) throw new Error('The Budget Control template could not be loaded');
  const template = await response.arrayBuffer();
  const ms = (d: Date | null) => (d ? { date: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) } : null);
  const edits: RowEdit[] = [];
  const row = (r: number, cells: RowEdit['cells']) => edits.push({ sheet: 'Clients', row: r, cells });

  row(5, { 3: project.client || project.name, 11: project.code });
  row(6, { 3: project.softwareVersion || project.name, 11: args.pmName });
  row(7, { 3: ms(endOfMonth(parseISO(`${s.period}-01`))), 11: ms(toDate(project.startDate)) });
  row(8, { 3: ms(toDate(project.startDate)), 11: ms(toDate(project.endDate)) });
  row(11, Object.fromEntries(s.months.map((m, i) => [FIRST_MONTH_COL + i, ms(parseISO(`${m}-01`))])));

  const skipped: string[] = [];
  const byRow = new Map<number, { budget: number; used: Record<string, number> }>();
  s.lines.forEach((l) => {
    const std = l.code ? STANDARD_LINES.find((x) => x.code === l.code) : null;
    if (!std) { if (l.budget || usedToDate(l)) skipped.push(l.module); return; }
    const acc = byRow.get(std.row) || { budget: 0, used: {} };
    acc.budget += l.budget;
    Object.entries(l.used).forEach(([m, v]) => { acc.used[m] = (acc.used[m] || 0) + v; });
    byRow.set(std.row, acc);
  });
  STANDARD_LINES.forEach((std) => {
    const acc = byRow.get(std.row);
    const cells: RowEdit['cells'] = { 3: acc ? round(acc.budget) : null };
    s.months.forEach((m, i) => { const v = acc?.used[m]; cells[FIRST_MONTH_COL + i] = m <= s.period && v ? round(v) : null; });
    row(std.row, cells);
  });
  row(41, { 2: args.pmName || null, 4: args.approvedName || null, 10: args.reviewedName || null });

  const bytes = await patchXlsx(template, edits);
  downloadBytes(bytes, `Project Budget control report ${project.code || project.name} ${s.period.replace('-', '')}.xlsx`);
  return { skipped };
}
