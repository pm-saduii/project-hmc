/**
 * Monthly executive report: everything the One Page shows for one project and one month,
 * computed from the project's data. The result is plain JSON so it can be frozen into
 * monthly_reports.snapshot when the PM publishes the month.
 */
import { addMonths, differenceInCalendarDays, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import type { ChangeRequest, Effort, Issue, Milestone, Project, ProjectProgressSnapshot, ReportStatus, Risk, Task } from '../types';
import { compareWbs, fmtDate } from './index';
import { projectHealth } from './projectHealth';
import { reportedEfforts } from './budgetControl';

export const REPORT_DATA_VERSION = 1;

export interface ReportListItem { name: string; date: string }
export interface ReportPhase {
  name: string;
  planStart: string; planEnd: string;
  start: string; end: string;
  percent: number;
}
export interface ReportCompletedPhase {
  name: string;
  done: number; total: number;
  state: 'done' | 'progress' | 'not_started';
  finishedOn: string;
  items: string[];
}

export interface MonthlyReportData {
  version: number;
  period: string;          // YYYY-MM
  asOf: string;            // YYYY-MM-DD the numbers were taken
  project: { code: string; name: string; client: string; customerAbbreviation: string; status: string; startDate: string; endDate: string };
  progress: { actual: number; planned: number; previous: number | null };
  goLive: { date: string; previous: string | null };
  manday: { budget: number; used: number };
  payment: { total: number; paid: number; billed: number; overdue: number; overdueAmount: number };
  issues: { open: number; blocked: number; opened: number; closed: number; risksOpen: number };
  changeRequests: { inMonth: { id: string; title: string; status: string; manday: number }[]; approvedManday: number; pending: number; delivered: number };
  suggested: { schedule: ReportStatus; budget: ReportStatus; scope: ReportStatus; payment: ReportStatus; overall: ReportStatus };
  timeline: { months: string[]; phases: ReportPhase[]; milestones: { name: string; date: string; status: string }[] };
  completed: {
    tasksDone: number; tasksTotal: number;
    milestonesAchieved: number; milestonesTotal: number;
    phasesComplete: number; phasesTotal: number;
    phases: ReportCompletedPhase[];
  };
  doneThisMonth: { count: number; items: ReportListItem[] };
  nextMonth: { count: number; items: ReportListItem[] };
  topIssues: { kind: 'Issue' | 'Risk'; title: string; status: string; meta: string }[];
  billing: { name: string; due: string; amount: number; status: string; overdueDays: number }[];
  /** Overall Project Timeline as in the External report (added before publishing; missing in older reports). */
  phasePlan?: { phases: { name: string; start: string; end: string; owner: string; percent: number; status: string }[] };
  /** Progress Overview as in the External report: S-curve, phases, milestones by status. */
  progressChart?: { labels: string[]; plan: (number | null)[]; actual: (number | null)[];
    phases: { name: string; planned: number; actual: number; status: string }[];
    milestones: { project: Record<string, number>; billing: Record<string, number> } };
  /** Methodology stages with the project checklist of each stage. */
  stages?: { name: string; icon: string; color: string; state: 'passed' | 'current' | 'upcoming'; noGate: boolean;
    deliverablesDone: number; deliverablesTotal: number;
    /** Methodology steps of the stage (older published reports: checklist topics with 'open' / 'na'). */
    items: { title: string; state: 'done' | 'current' | 'upcoming' | 'open' | 'na' }[] }[];
}

export interface ReportInputs {
  project: Project;
  projectStatusLabel: string;
  period: string;
  tasks: Task[];
  milestones: Milestone[];
  issues: Issue[];
  risks: Risk[];
  efforts: Effort[];
  changeRequests: ChangeRequest[];
  progressSnapshots: ProjectProgressSnapshot[];
  /** The previous month's published report, when there is one. */
  previous: MonthlyReportData | null;
  today?: Date;
}

const STATUS_RANK: Record<ReportStatus, number> = { completed: 0, not_started: 0, on_track: 1, at_risk: 2, off_track: 3 };
/** The most serious of the statuses (Completed / Not Started count below On Track). */
export const worstStatus = (...list: ReportStatus[]): ReportStatus =>
  list.reduce((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst), list[0] ?? 'on_track');

const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
};
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const isDone = (t: Task) => t.status === 'Done' || Number(t.percentComplete) >= 100;
/** When a finished task was finished: actual finish, else its end date. */
const finishDate = (t: Task) => toDate(t.actualFinish) || (isDone(t) ? toDate(t.endDate) : null);
const inRange = (d: Date | null, from: Date, to: Date) => !!d && d >= from && d <= to;

export function periodBounds(period: string) {
  const start = startOfMonth(parseISO(`${period}-01`));
  return { start, end: endOfMonth(start) };
}
export const shiftPeriod = (period: string, months: number) => format(addMonths(parseISO(`${period}-01`), months), 'yyyy-MM');
export const periodLabel = (period: string) => format(parseISO(`${period}-01`), 'MMMM yyyy');

export function buildMonthlyReport(input: ReportInputs): MonthlyReportData {
  const { project, period, tasks, milestones, issues, risks, efforts, changeRequests } = input;
  const today = input.today ?? new Date();
  const { start: monthStart, end: monthEnd } = periodBounds(period);
  // Numbers are "as of" today for the running month, the month end for a past month.
  const asOfDate = today < monthEnd ? today : monthEnd;
  const asOf = iso(asOfDate);
  const next = periodBounds(shiftPeriod(period, 1));

  // ── Task tree ───────────────────────────────────────────────────────────
  const sorted = [...tasks].sort((a, b) => (a.sortOrder - b.sortOrder) || compareWbs(a.wbs, b.wbs));
  const children = new Map<string, Task[]>();
  sorted.forEach((t) => { if (t.parentId) children.set(t.parentId, [...(children.get(t.parentId) || []), t]); });
  const isLeaf = (t: Task) => !children.has(t.id);
  const leaves = sorted.filter(isLeaf);
  const leavesUnder = (root: Task): Task[] => {
    const out: Task[] = [];
    const walk = (t: Task, depth: number) => {
      if (depth > 50) return; // guard against bad parent links
      const kids = children.get(t.id);
      if (!kids) out.push(t); else kids.forEach((k) => walk(k, depth + 1));
    };
    walk(root, 0);
    return out;
  };
  const roots = sorted.filter((t) => !t.parentId);

  // ── Progress / schedule ─────────────────────────────────────────────────
  const health = projectHealth(tasks, iso(today));
  const prevEnd = endOfMonth(addMonths(monthStart, -1));
  const prevSnapshot = [...input.progressSnapshots]
    .filter((s) => { const d = toDate(s.snapshotDate); return !!d && d <= prevEnd; })
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
  const previousActual = input.previous?.progress.actual ?? (prevSnapshot ? Math.round(Number(prevSnapshot.actualPercent) || 0) : null);

  // ── Manday ──────────────────────────────────────────────────────────────
  const counted = reportedEfforts(efforts);
  const budget = counted.reduce((s, e) => s + (Number(e.budgetManday) || 0), 0);
  const used = counted.reduce((s, e) => s + Object.entries(e.monthly || {})
    .filter(([month]) => month <= period)
    .reduce((a, [, v]) => a + (Number(v) || 0), 0), 0);

  // ── Payment ─────────────────────────────────────────────────────────────
  const amount = (m: Milestone) => Number(m.amount) || 0;
  const status = (m: Milestone) => String(m.status || '').toLowerCase();
  const overdueMs = milestones.filter((m) => status(m) !== 'paid' && (toDate(m.dueDate)?.getTime() ?? Infinity) < asOfDate.getTime());
  const payment = {
    total: milestones.reduce((s, m) => s + amount(m), 0),
    paid: milestones.filter((m) => status(m) === 'paid').reduce((s, m) => s + amount(m), 0),
    billed: milestones.filter((m) => status(m) === 'billed').reduce((s, m) => s + amount(m), 0),
    overdue: overdueMs.length,
    overdueAmount: overdueMs.reduce((s, m) => s + amount(m), 0),
  };
  const daysOverdue = (m: Milestone) => { const d = toDate(m.dueDate); return d ? Math.max(0, differenceInCalendarDays(asOfDate, d)) : 0; };

  // ── Issues / risks ──────────────────────────────────────────────────────
  const openIssues = issues.filter((i) => i.status !== 'Resolved');
  const openRisks = risks.filter((r) => r.status !== 'Closed');

  // ── Change requests ─────────────────────────────────────────────────────
  const crInMonth = changeRequests.filter((c) => inRange(toDate(c.requestDate), monthStart, monthEnd) || inRange(toDate(c.approvalDate), monthStart, monthEnd));
  const approvedInMonth = changeRequests.filter((c) => ['Approved', 'Implemented', 'Close'].includes(c.status) && inRange(toDate(c.approvalDate), monthStart, monthEnd));
  const pendingCr = changeRequests.filter((c) => ['Submitted', 'Under Review'].includes(c.status));

  // ── Suggested statuses (the PM can change them) ─────────────────────────
  const notStartedYet = health.actual === 0 && (toDate(project.startDate)?.getTime() ?? 0) > (toDate(asOf)?.getTime() ?? 0);
  const schedule: ReportStatus = health.actual >= 100 ? 'completed' : notStartedYet ? 'not_started'
    : health.status === 'Stoper' ? 'off_track' : health.status === 'Delay' ? 'at_risk' : 'on_track';
  const usedPct = budget > 0 ? (used / budget) * 100 : 0;
  const burnGap = usedPct - health.actual;
  const budgetStatus: ReportStatus = budget <= 0 ? 'on_track' : burnGap > 15 ? 'off_track' : burnGap > 5 ? 'at_risk' : 'on_track';
  const scope: ReportStatus = pendingCr.length > 0 || approvedInMonth.length > 0 ? 'at_risk' : 'on_track';
  const paymentStatus: ReportStatus = overdueMs.some((m) => daysOverdue(m) > 30) ? 'off_track' : overdueMs.length ? 'at_risk' : 'on_track';

  // ── Timeline ────────────────────────────────────────────────────────────
  const dates = [project.startDate, project.endDate, ...roots.flatMap((t) => [t.baselineStartDate, t.baselineEndDate, t.startDate, t.endDate])]
    .map((v) => toDate(v || '')).filter((d): d is Date => !!d);
  const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : monthStart;
  const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : monthEnd;
  const months: string[] = [];
  for (let m = startOfMonth(first); m <= last && months.length < 36; m = addMonths(m, 1)) months.push(format(m, 'yyyy-MM'));

  // ── Completed since start ───────────────────────────────────────────────
  const completedPhases: ReportCompletedPhase[] = roots.map((root) => {
    const ls = leavesUnder(root);
    const doneLs = ls.filter(isDone);
    const state: ReportCompletedPhase['state'] = ls.length && doneLs.length === ls.length ? 'done' : doneLs.length || Number(root.percentComplete) > 0 ? 'progress' : 'not_started';
    const finished = doneLs.map(finishDate).filter((d): d is Date => !!d);
    const latest = [...doneLs].filter((t) => t.id !== root.id)
      .sort((a, b) => (finishDate(b)?.getTime() ?? 0) - (finishDate(a)?.getTime() ?? 0))
      .slice(0, 3).map((t) => t.taskName || '(untitled)');
    return {
      name: root.taskName || '(untitled)', done: doneLs.length, total: ls.length, state,
      finishedOn: state === 'done' && finished.length ? iso(new Date(Math.max(...finished.map((d) => d.getTime())))) : '',
      items: latest,
    };
  });

  // ── Lists ───────────────────────────────────────────────────────────────
  const doneInMonth = leaves.filter((t) => isDone(t) && inRange(finishDate(t), monthStart, monthEnd))
    .sort((a, b) => (finishDate(b)?.getTime() ?? 0) - (finishDate(a)?.getTime() ?? 0));
  const dueNext = leaves.filter((t) => !isDone(t) && inRange(toDate(t.endDate), next.start, next.end))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const topIssues: MonthlyReportData['topIssues'] = [
    ...[...openIssues].sort((a, b) => Number(b.status === 'Blocked') - Number(a.status === 'Blocked')).map((i) => ({
      kind: 'Issue' as const, title: i.title, status: i.status,
      meta: [i.status, i.assignedTo && `Owner: ${i.assignedTo}`, i.issueDate && `Raised ${fmtDate(i.issueDate)}`].filter(Boolean).join(' · '),
    })),
    ...[...openRisks].sort((a, b) => Number(b.impact === 'High') - Number(a.impact === 'High') || Number(b.probability === 'High') - Number(a.probability === 'High')).map((r) => ({
      kind: 'Risk' as const, title: r.title, status: r.status,
      meta: [`${r.impact} impact`, `${r.probability} probability`, r.owner && `Owner: ${r.owner}`].filter(Boolean).join(' · '),
    })),
  ].slice(0, 5);

  const billing = [...milestones]
    .filter((m) => status(m) !== 'paid' || inRange(toDate(m.billingDate) || toDate(m.dueDate), monthStart, monthEnd))
    .sort((a, b) => daysOverdue(b) - daysOverdue(a) || String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 6)
    .map((m) => ({ name: m.name, due: m.dueDate, amount: amount(m), status: status(m), overdueDays: status(m) === 'paid' ? 0 : daysOverdue(m) }));

  return {
    version: REPORT_DATA_VERSION,
    period,
    asOf,
    project: {
      code: project.code, name: project.name, client: project.client, customerAbbreviation: project.customerAbbreviation || '',
      status: input.projectStatusLabel, startDate: project.startDate, endDate: project.endDate,
    },
    progress: { actual: health.actual, planned: health.planned, previous: previousActual },
    goLive: { date: project.endDate, previous: input.previous?.goLive.date ?? null },
    manday: { budget: Math.round(budget * 10) / 10, used: Math.round(used * 10) / 10 },
    payment,
    issues: {
      open: openIssues.length,
      blocked: openIssues.filter((i) => i.status === 'Blocked').length,
      opened: issues.filter((i) => inRange(toDate(i.issueDate), monthStart, monthEnd)).length,
      closed: issues.filter((i) => i.status === 'Resolved' && inRange(toDate(i.resolvedDate), monthStart, monthEnd)).length,
      risksOpen: openRisks.length,
    },
    changeRequests: {
      inMonth: crInMonth.map((c) => ({ id: c.crId, title: c.title, status: c.status, manday: Number(c.totalManday) || 0 })),
      approvedManday: approvedInMonth.reduce((s, c) => s + (Number(c.totalManday) || 0), 0),
      pending: pendingCr.length,
      delivered: changeRequests.filter((c) => c.status === 'Implemented' || c.status === 'Close').length,
    },
    suggested: { schedule, budget: budgetStatus, scope, payment: paymentStatus, overall: worstStatus(schedule, budgetStatus, scope, paymentStatus) },
    timeline: {
      months,
      phases: roots.map((t) => ({
        name: t.taskName || '(untitled)',
        planStart: t.baselineStartDate || t.startDate || '', planEnd: t.baselineEndDate || t.endDate || '',
        start: t.startDate || '', end: t.endDate || '', percent: Math.round(Number(t.percentComplete) || 0),
      })),
      milestones: milestones.filter((m) => toDate(m.dueDate)).map((m) => ({ name: m.name, date: m.dueDate, status: status(m) })),
    },
    completed: {
      tasksDone: leaves.filter(isDone).length, tasksTotal: leaves.length,
      milestonesAchieved: milestones.filter((m) => status(m) === 'billed' || status(m) === 'paid').length,
      milestonesTotal: milestones.length,
      phasesComplete: completedPhases.filter((p) => p.state === 'done').length, phasesTotal: completedPhases.length,
      phases: completedPhases,
    },
    doneThisMonth: { count: doneInMonth.length, items: doneInMonth.slice(0, 8).map((t) => ({ name: t.taskName, date: iso(finishDate(t)!) })) },
    nextMonth: { count: dueNext.length, items: dueNext.slice(0, 8).map((t) => ({ name: t.taskName, date: t.endDate })) },
    topIssues,
    billing,
  };
}
