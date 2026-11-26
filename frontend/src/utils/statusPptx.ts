/**
 * Weekly External Status Report as an editable PowerPoint (16:9): cover, status summary,
 * milestones & overdue work, issues / risks / change requests. Built from the project's live data.
 */
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { ChangeRequest, Issue, Member, Milestone, Project, Risk, Task } from '../types';
import { projectHealth } from './projectHealth';
import type PptxGenJSType from 'pptxgenjs';

type Slide = ReturnType<PptxGenJSType['addSlide']>;

const NAVY = '13284C';
const INK = '14233A';
const MUTED = '5B6B82';
const LINE = 'DBE3EE';
const STATUS_COLOR: Record<string, string> = { 'On Track': '2E9E6B', Delay: 'E0A100', Stoper: 'D64545', 'Plan N/A': '94A3B8' };
const STATUS_TEXT: Record<string, string> = { 'On Track': 'On track', Delay: 'At risk', Stoper: 'Off track', 'Plan N/A': 'No plan' };

const toDate = (v?: string | null) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };
const fd = (v?: string | null) => { const d = toDate(v); return d ? format(d, 'dd/MM/yyyy') : '—'; };
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const isDone = (t: Task) => t.status === 'Done' || Number(t.percentComplete) >= 100;

export interface StatusInput {
  project: Project; tasks: Task[]; milestones: Milestone[]; issues: Issue[]; risks: Risk[]; changeRequests: ChangeRequest[]; members: Member[];
  asOf?: Date; internal?: boolean;
}

export async function downloadWeeklyStatus(input: StatusInput) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const { project, tasks, milestones, issues, risks, changeRequests, members } = input;
  const asOf = input.asOf || new Date();
  asOf.setHours(0, 0, 0, 0);
  const weekStart = addDays(asOf, -6);
  const horizon = addDays(asOf, 14);
  const health = projectHealth(tasks);
  const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leaves = tasks.filter((t) => !parents.has(t.id));
  const finished = (t: Task) => toDate(t.actualFinish) || toDate(t.endDate);
  const done = leaves.filter((t) => isDone(t) && (() => { const d = finished(t); return !!d && d >= weekStart && d <= asOf; })())
    .sort((a, b) => (finished(b)?.getTime() || 0) - (finished(a)?.getTime() || 0));
  const next = leaves.filter((t) => !isDone(t) && (() => { const d = toDate(t.endDate); return !!d && d >= asOf && d <= horizon; })())
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const overdue = leaves.filter((t) => !isDone(t) && (() => { const d = toDate(t.endDate); return !!d && d < asOf; })())
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const openIssues = issues.filter((i) => i.status !== 'Resolved').sort((a, b) => Number(b.status === 'Blocked') - Number(a.status === 'Blocked'));
  const openRisks = risks.filter((r) => r.status !== 'Closed').sort((a, b) => Number(b.impact === 'High') - Number(a.impact === 'High'));
  const openCrs = changeRequests.filter((c) => !['Rejected', 'Close', 'Implemented'].includes(c.status));
  const pm = members.find((m) => /project manager/i.test(m.role || '') && m.type !== 'client')?.name || '';
  const goLive = toDate(project.endDate);
  const daysToGoLive = goLive ? differenceInCalendarDays(goLive, asOf) : null;
  const title = `${project.code}${project.customerAbbreviation ? ` (${project.customerAbbreviation})` : ''}`;

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = `${title} – Weekly Status`;
  pres.company = 'HUMANICA';
  pres.theme = { headFontFace: 'Poppins', bodyFontFace: 'Poppins' };
  const W = 13.333;
  const footer = (slide: Slide, n: number) => {
    slide.addText(`${input.internal ? 'Internal use only' : 'Confidential'} · ${title} · Week ending ${format(asOf, 'dd/MM/yyyy')}`, { x: 0.5, y: 7.05, w: 9, h: 0.3, fontSize: 9, color: '8796AB' });
    slide.addText(String(n), { x: W - 1, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: '8796AB', align: 'right' });
  };
  const heading = (slide: Slide, text: string, sub?: string) => {
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.9, fill: { color: NAVY } });
    slide.addText(text, { x: 0.5, y: 0.15, w: 9, h: 0.6, fontSize: 22, bold: true, color: 'FFFFFF' });
    if (sub) slide.addText(sub, { x: 8.5, y: 0.15, w: 4.33, h: 0.6, fontSize: 12, color: 'C7D2FE', align: 'right' });
  };
  const cellHead = { bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontSize: 11 };
  const table = (slide: Slide, rows: (string | number)[][], header: string[], opts: { x: number; y: number; w: number; colW: number[]; empty: string }) => {
    const body = rows.length
      ? rows.map((r) => r.map((c) => ({ text: String(c), options: { fontSize: 10.5, color: INK } })))
      : [[{ text: opts.empty, options: { fontSize: 10.5, color: MUTED, colspan: header.length } }]];
    slide.addTable([header.map((h) => ({ text: h, options: cellHead })), ...body] as never, {
      x: opts.x, y: opts.y, w: opts.w, colW: opts.colW, border: { type: 'solid', color: LINE, pt: 0.75 }, valign: 'middle', rowH: 0.32, margin: 0.06,
    });
  };

  // 1 · Cover
  const cover = pres.addSlide();
  cover.background = { color: NAVY };
  cover.addText('Weekly Status Report', { x: 0.8, y: 1.6, w: 11, h: 0.5, fontSize: 16, color: 'A5B4FC' });
  cover.addText(project.name, { x: 0.8, y: 2.2, w: 11.5, h: 1.2, fontSize: 36, bold: true, color: 'FFFFFF' });
  cover.addText(`${title} · ${project.client || ''}`, { x: 0.8, y: 3.45, w: 11.5, h: 0.5, fontSize: 18, color: 'E0E7FF' });
  cover.addText(`Week ending ${format(asOf, 'dd/MM/yyyy')}${pm ? `  ·  Project Manager: ${pm}` : ''}`, { x: 0.8, y: 4.3, w: 11.5, h: 0.4, fontSize: 14, color: 'C7D2FE' });

  // 2 · Summary
  const s2 = pres.addSlide();
  heading(s2, 'Status summary', format(asOf, 'dd/MM/yyyy'));
  const kpis: [string, string, string, string][] = [
    ['Progress', `${health.actual}%`, `Plan ${health.planned}%`, STATUS_COLOR[health.status] || NAVY],
    ['Schedule', STATUS_TEXT[health.status] || health.status, health.planned > health.actual ? `${health.planned - health.actual} pts behind plan` : 'On or ahead of plan', STATUS_COLOR[health.status] || NAVY],
    ['Go-live', goLive ? format(goLive, 'dd/MM/yyyy') : '—', daysToGoLive == null ? '' : daysToGoLive >= 0 ? `${daysToGoLive} days to go` : 'Past plan end', NAVY],
    ['Open items', `${openIssues.length} issue${openIssues.length === 1 ? '' : 's'} · ${openRisks.length} risk${openRisks.length === 1 ? '' : 's'}`, `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`, overdue.length ? 'D64545' : NAVY],
  ];
  kpis.forEach(([label, value, sub, color], i) => {
    const x = 0.5 + i * 3.1;
    s2.addShape(pres.ShapeType.rect, { x, y: 1.2, w: 2.9, h: 1.35, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 } });
    s2.addShape(pres.ShapeType.rect, { x, y: 1.2, w: 2.9, h: 0.08, fill: { color } });
    s2.addText(label, { x: x + 0.15, y: 1.35, w: 2.6, h: 0.3, fontSize: 11, color: MUTED });
    s2.addText(value, { x: x + 0.15, y: 1.65, w: 2.6, h: 0.5, fontSize: 20, bold: true, color: INK });
    s2.addText(sub, { x: x + 0.15, y: 2.15, w: 2.6, h: 0.3, fontSize: 10.5, color: MUTED });
  });
  const bullets = (slide: Slide, label: string, items: string[], x: number, empty: string) => {
    slide.addText(label, { x, y: 2.85, w: 6, h: 0.4, fontSize: 15, bold: true, color: NAVY });
    slide.addText(
      (items.length ? items : [empty]).map((t) => ({ text: t, options: { bullet: items.length ? { indent: 14 } : false, breakLine: true } })) as never,
      { x, y: 3.3, w: 6, h: 3.5, fontSize: 12, color: items.length ? INK : MUTED, valign: 'top', paraSpaceAfter: 4 },
    );
  };
  bullets(s2, 'Done this week', done.slice(0, 9).map((t) => cut(t.taskName, 70)), 0.5, 'No tasks finished this week.');
  bullets(s2, 'Next two weeks', next.slice(0, 9).map((t) => `${cut(t.taskName, 56)} — ${fd(t.endDate)}`), 6.85, 'No tasks due in the next two weeks.');
  footer(s2, 2);

  // 3 · Milestones and overdue work
  const s3 = pres.addSlide();
  heading(s3, 'Milestones & overdue work');
  const msRows = [...milestones].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 10).map((m) => {
    const late = m.status !== 'paid' && (toDate(m.dueDate)?.getTime() ?? Infinity) < asOf.getTime();
    return [cut(m.name, 40), fd(m.dueDate), late ? 'Overdue' : m.status === 'paid' ? 'Completed' : m.status === 'billed' ? 'Achieved' : 'Planned'];
  });
  table(s3, msRows, ['Milestone', 'Due', 'Status'], { x: 0.5, y: 1.2, w: 6.1, colW: [3.4, 1.4, 1.3], empty: 'No milestones.' });
  const odRows = overdue.slice(0, 10).map((t) => [cut(t.taskName, 38), fd(t.endDate), `${differenceInCalendarDays(asOf, toDate(t.endDate)!)} d`, t.resource ? cut(t.resource, 14) : '—']);
  table(s3, odRows, ['Overdue task', 'Due', 'Late', 'Owner'], { x: 6.85, y: 1.2, w: 6, colW: [3, 1.2, 0.7, 1.1], empty: 'Nothing overdue.' });
  footer(s3, 3);

  // 4 · Issues, risks and change requests
  const s4 = pres.addSlide();
  heading(s4, 'Issues, risks & change requests');
  const irRows = [
    ...openIssues.slice(0, 6).map((i) => ['Issue', cut(i.title, 52), i.status, i.assignedTo ? cut(i.assignedTo, 16) : '—']),
    ...openRisks.slice(0, 5).map((r) => ['Risk', cut(r.title, 52), `${r.impact} impact`, r.owner ? cut(r.owner, 16) : '—']),
  ];
  table(s4, irRows, ['Type', 'Title', 'Status', 'Owner'], { x: 0.5, y: 1.2, w: 12.33, colW: [1, 7.33, 2, 2], empty: 'No open issues or risks.' });
  const crRows = openCrs.slice(0, 5).map((c) => [c.crId, cut(c.title, 60), c.status, `${Number(c.totalManday) || 0} MD`]);
  const crY = 1.2 + 0.32 * (Math.max(1, irRows.length) + 1) + 0.85;
  s4.addText('Change requests in progress', { x: 0.5, y: crY - 0.5, w: 8, h: 0.35, fontSize: 13, bold: true, color: NAVY });
  table(s4, crRows, ['CR', 'Title', 'Status', 'Effort'], { x: 0.5, y: crY, w: 12.33, colW: [1.2, 7.63, 2, 1.5], empty: 'No change requests in progress.' });
  footer(s4, 4);

  await pres.writeFile({ fileName: `${format(asOf, 'yyyyMMdd')} ${project.customerAbbreviation || project.code} Weekly Status.pptx` });
}
