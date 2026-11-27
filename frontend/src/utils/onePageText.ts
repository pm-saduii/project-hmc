/**
 * Auto draft of the One Page (Monthly Executive Report) text, written from the month's numbers:
 * Part 1 Executive summary (paragraph) + Part 2 Key highlights & attention required (Achieved / In progress / Attention required),
 * and the decisions needed from management. The PM edits it; saved text always wins.
 */
import { format, isValid, parseISO } from 'date-fns';
import { periodLabel, type MonthlyReportData } from './monthlyReport';

const dmy = (v?: string | null) => { if (!v) return ''; const d = parseISO(v); return isValid(d) ? format(d, 'dd/MM/yyyy') : ''; };
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const clean = (s: string) => s.replace(/\.$/, '');

export interface OnePageSuggestion { summary: string; decisions: string }

export function suggestOnePageText(data: MonthlyReportData): OnePageSuggestion {
  const { progress, goLive, manday, payment, issues, changeRequests: cr } = data;
  const month = periodLabel(data.period).split(' ')[0];
  const gap = progress.actual - progress.planned;
  const status = data.suggested.overall;
  const usedPct = manday.budget > 0 ? Math.round((manday.used / manday.budget) * 100) : null;
  const paidPct = payment.total > 0 ? Math.round((payment.paid / payment.total) * 100) : null;

  // phases: External-style plan (status + percent), with planned % from the progress chart when there
  const planned = new Map((data.progressChart?.phases || []).map((p) => [p.name, p.planned]));
  const phases = (data.phasePlan?.phases || data.timeline.phases.map((p) => ({ name: p.name, start: p.planStart || p.start, end: p.planEnd || p.end, owner: '', percent: p.percent, status: '' })))
    .map((p) => ({ ...p, planned: planned.get(p.name) ?? null }));
  const asOf = data.asOf;
  const doneP = phases.filter((p) => p.percent >= 100);
  const nowP = phases.filter((p) => p.percent < 100 && (p.percent > 0 || (p.start && p.start <= asOf)));
  const nextP = phases.find((p) => p.percent === 0 && p.start > asOf);
  const behind = nowP.filter((p) => p.status === 'Delayed' || p.status === 'At Risk' || (p.planned != null && p.planned - p.percent >= 10));
  const doneItems = data.doneThisMonth.items.map((t) => t.name);
  const nextItems = data.nextMonth.items.map((t) => t.name);
  const keyIssue = data.topIssues[0];
  const goLiveShift = goLive.previous && goLive.date && goLive.previous !== goLive.date
    ? Math.round((parseISO(goLive.date).getTime() - parseISO(goLive.previous).getTime()) / 86400000) : 0;

  const standing = progress.actual >= 100 ? 'has been completed'
    : gap >= 5 ? 'is currently ahead of the planned schedule'
    : status === 'off_track' ? `is currently behind the planned schedule (plan ${progress.planned}%)`
    : status === 'at_risk' ? `is slightly behind the plan (${progress.planned}%), with close monitoring in place`
    : status === 'not_started' ? 'has not started yet' : 'is currently on track against the planned schedule';
  const moved = progress.previous != null ? ` (${progress.actual - progress.previous >= 0 ? '+' : ''}${progress.actual - progress.previous} pts since last month)` : '';

  const para = [
    progress.actual >= 100 ? `The project has been completed.` : `The project has achieved ${progress.actual}% overall progress${moved} and ${standing}.`,
    data.doneThisMonth.count ? `In ${month}, the team completed ${data.doneThisMonth.count} task${data.doneThisMonth.count > 1 ? 's' : ''}${doneItems.length ? `, including ${joinList(doneItems.slice(0, 2))}` : ''}.`
      : doneP.length ? `${joinList(doneP.map((p) => p.name))} ${doneP.length > 1 ? 'have' : 'has'} been completed.` : '',
    nowP.length ? `Work is progressing on ${joinList(nowP.slice(0, 2).map((p) => `${p.name} (${p.percent}%)`))}${nextP ? ` to ensure readiness for the upcoming ${nextP.name} phase` : ''}.` : '',
    keyIssue ? `There ${issues.open === 1 ? 'is 1 open issue' : `are ${issues.open} open issues`}${issues.blocked ? ` (${issues.blocked} blocked)` : ''} and ${issues.risksOpen} open risk${issues.risksOpen === 1 ? '' : 's'}; the key item is ${clean(keyIssue.title)}.` : '',
    usedPct != null ? `Man-day usage is ${usedPct}% of the budget against ${progress.actual}% progress${paidPct != null ? `, and ${paidPct}% of the contract value has been received` : ''}.` : paidPct != null ? `${paidPct}% of the contract value has been received.` : '',
    nextItems.length ? `Next month the team will focus on ${joinList(nextItems.slice(0, 2))}${goLive.date ? `, with go-live targeted for ${dmy(goLive.date)}` : ''}.` : goLive.date ? `Go-live is targeted for ${dmy(goLive.date)}.` : '',
  ].filter(Boolean);

  const attention = [
    ...behind.slice(0, 2).map((p) => `${p.name} is ${p.percent}%${p.planned != null ? ` against ${p.planned}% planned` : ` (${p.status})`}`),
    ...(goLiveShift > 0 ? [`go-live moved by ${goLiveShift} days to ${dmy(goLive.date)}`] : []),
    ...(usedPct != null && usedPct - progress.actual >= 10 ? [`man-day usage ${usedPct}% is ahead of progress ${progress.actual}%`] : []),
    ...(payment.overdue ? [`${payment.overdue} billing milestone${payment.overdue > 1 ? 's' : ''} past due`] : []),
    ...(issues.blocked && keyIssue ? [`blocked: ${clean(keyIssue.title)}`] : []),
    ...(cr.pending ? [`${cr.pending} change request${cr.pending > 1 ? 's' : ''} pending review`] : []),
  ];
  const summary = [
    para.join(' '),
    '',
    `Achieved: ${doneItems.length ? joinList(doneItems.slice(0, 3)) : doneP.length ? joinList(doneP.map((p) => p.name)) : 'no major item completed this month'}`,
    `In progress: ${nowP.length ? joinList(nowP.slice(0, 3).map((p) => `${p.name} (${p.percent}%)`)) : 'no work in progress'}`,
    `Attention required: ${attention.length ? attention.slice(0, 3).join('; ') : 'none at this stage'}`,
  ].join('\n');

  const decisions = [
    ...behind.filter((p) => p.status === 'Delayed').slice(0, 1).map((p) => `Agree the recovery plan for ${p.name} (${p.percent}%${p.planned != null ? ` vs ${p.planned}% planned` : ''})`),
    ...(goLiveShift > 0 ? [`Acknowledge the new go-live date ${dmy(goLive.date)}`] : []),
    ...(cr.pending ? [`Approve or reject ${cr.pending} pending change request${cr.pending > 1 ? 's' : ''}`] : []),
    ...(payment.overdue ? [`Support the follow-up of ${payment.overdue} overdue billing milestone${payment.overdue > 1 ? 's' : ''} with the customer`] : []),
    ...(usedPct != null && usedPct - progress.actual >= 10 ? ['Review the man-day budget against the remaining scope'] : []),
    ...data.topIssues.filter((i) => i.status === 'Blocked').slice(0, 1).map((i) => `Help unblock: ${clean(i.title)}`),
  ].slice(0, 4).join('\n');

  return { summary, decisions };
}
