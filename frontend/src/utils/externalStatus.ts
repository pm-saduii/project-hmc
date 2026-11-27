/**
 * External Status Report (semi-monthly, for the customer).
 * Builds the model of the company status-report engine (Implementation Hub "PSR", served from /vendor/hub)
 * from the project's tasks, milestones, issues and risks, so the HTML, PDF and PowerPoint look like the company sample.
 */
import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import { projectHealth } from './projectHealth';
import { computeBaselineProgress } from './index';
import { internalTaskIds, type Issue, type Member, type Milestone, type Project, type ProjectProgressSnapshot, type Risk, type Task } from '../types';
import type { StatusReport } from '../services/statusReports';

/* ── Half-month periods ─────────────────────────────────────────────── */
export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])-[12]$/;
export const periodOf = (d: Date) => `${format(d, 'yyyy-MM')}-${d.getDate() <= 15 ? 1 : 2}`;
export function periodRange(period: string): { start: Date; end: Date } {
  const [y, m, h] = period.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  return h === 1 ? { start: first, end: new Date(y, m - 1, 15) } : { start: new Date(y, m - 1, 16), end: endOfMonth(first) };
}
export function shiftPeriod(period: string, dir: -1 | 1): string {
  const [y, m, h] = period.split('-').map(Number);
  if (dir > 0) return h === 1 ? `${y}-${String(m).padStart(2, '0')}-2` : `${format(addMonths(new Date(y, m - 1, 1), 1), 'yyyy-MM')}-1`;
  return h === 2 ? `${y}-${String(m).padStart(2, '0')}-1` : `${format(addMonths(new Date(y, m - 1, 1), -1), 'yyyy-MM')}-2`;
}
export function periodLabel(period: string): string {
  const { start, end } = periodRange(period);
  return `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}`;
}
/** The report date: what the PM set, else the end of the half-month (or today while it is running). */
export function reportDateOf(period: string, record: Pick<StatusReport, 'reportDate'> | null, today = new Date()): Date {
  const set = record?.reportDate ? parseISO(record.reportDate) : null;
  if (set && isValid(set)) return set;
  const { end } = periodRange(period);
  return end < today ? end : today;
}

/* ── Engine (loaded on demand) ──────────────────────────────────────── */
type PsrModel = { P: Record<string, unknown>; milestones: Record<string, unknown>[]; [k: string]: unknown };
interface PsrApi { compute: (raw: unknown) => PsrModel; fullDocument: (M: PsrModel, mode: string) => string; renderReport: (M: PsrModel, mode: string) => string; CSS: string }
interface PsrPptxApi { download: (M: PsrModel, mode: string) => Promise<void> }
declare global { interface Window { PSR?: PsrApi; PSRPPTX?: PsrPptxApi } }

const loaded: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (!loaded[src]) {
    loaded[src] = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => resolve();
      el.onerror = () => { delete loaded[src]; reject(new Error(`Could not load ${src}`)); };
      document.head.appendChild(el);
    });
  }
  return loaded[src];
}
export async function loadEngine(): Promise<PsrApi> {
  await loadScript('/vendor/hub/psr.js');
  if (!window.PSR) throw new Error('The report engine did not load');
  return window.PSR;
}

/* ── Building the model ─────────────────────────────────────────────── */
const UTC = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const dayOf = (v?: string | null): number | null => {
  if (!v) return null;
  const d = parseISO(String(v).slice(0, 10));
  return isValid(d) ? UTC(d) : null;
};
const DAY = 86400000;
const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const isDone = (t: Task) => t.status === 'Done' || (Number(t.percentComplete) || 0) >= 100;

/** HMC / Client / Joint from a task's resource text, using the project's members. */
export function sideOf(resource: string, members: Member[], customerTag = ''): 'HMC' | 'Client' | 'Joint' {
  const text = String(resource || '').trim();
  if (!text) return 'HMC';
  if (/joint/i.test(text)) return 'Joint';
  const sides = new Set<string>();
  text.split(/[,/&+;]|\band\b/i).map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((tok) => {
    if (/\b(hmc|humanica)\b/.test(tok)) { sides.add('HMC'); return; }
    if (/\b(client|customer)\b/.test(tok) || (customerTag && tok.includes(customerTag.toLowerCase()))) { sides.add('Client'); return; }
    const m = members.find((x) => [x.name, x.nickname, x.thaiName].filter(Boolean).some((n) => n.toLowerCase().includes(tok) || tok.includes(n.toLowerCase())));
    if (m) sides.add(m.type === 'client' ? 'Client' : 'HMC');
  });
  if (sides.has('HMC') && sides.has('Client')) return 'Joint';
  return sides.has('Client') ? 'Client' : 'HMC';
}

const STATUS = ['Completed', 'On Track', 'At Risk', 'Delayed', 'Not Started'] as const;
type Rag = typeof STATUS[number];
const TOL = 0.15;
const plannedAt = (rd: number, s: number | null, e: number | null) => (s == null || e == null ? 0 : rd < s ? 0 : rd >= e ? 1 : ((rd - s) / DAY + 1) / ((e - s) / DAY + 1));

export interface ExternalInput {
  project: Project; period: string; record: StatusReport | null;
  tasks: Task[]; milestones: Milestone[]; issues: Issue[]; risks: Risk[]; members: Member[];
  /** Current phase name (methodology), shown in the header. */
  phaseName: string;
  /** Saved progress history (actual % over time) for the S-curve. */
  snapshots?: ProjectProgressSnapshot[];
  today?: Date;
}

/** The engine's input ("raw") built from the project. */
export function buildRaw(input: ExternalInput) {
  const { project, period, record, milestones, issues, risks, members } = input;
  // Internal tasks (and everything under them) never reach the customer: not in the timeline, activities, milestones or highlights.
  const hidden = internalTaskIds(input.tasks);
  const tasks = input.tasks.filter((t) => !hidden.has(t.id));
  const rdDate = reportDateOf(period, record, input.today);
  const rd = UTC(rdDate);
  const tag = project.customerAbbreviation || '';
  const kids = new Map<string, Task[]>();
  tasks.forEach((t) => { if (t.parentId) kids.set(t.parentId, [...(kids.get(t.parentId) || []), t]); });
  const leavesOf = (t: Task): Task[] => { const k = kids.get(t.id) || []; return k.length ? k.flatMap(leavesOf) : [t]; };
  const roots = tasks.filter((t) => !t.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const pm = members.find((m) => /project manager/i.test(m.role) && m.type !== 'client');

  const phases: Record<string, unknown>[] = [];
  const structural: Record<string, unknown>[] = [];
  const activities: Record<string, unknown>[] = [];
  roots.forEach((root) => {
    const leaves = leavesOf(root);
    const sides = new Set(leaves.map((l) => sideOf(l.resource, members, tag)));
    const owner = sides.size > 1 ? 'Joint' : [...sides][0] || 'HMC';
    phases.push({ id: `P-${root.id}`, name: root.taskName || '(untitled)', pp: 'Phase 1', show: true, start: dayOf(root.startDate), end: dayOf(root.endDate), owner, override: '' });
    structural.push({ id: `S-${root.id}`, name: root.taskName, phase: `P-${root.id}`, key: false, start: dayOf(root.startDate), end: dayOf(root.endDate), owner, override: '' });
    leaves.forEach((t) => {
      const s = dayOf(t.startDate); const e = dayOf(t.endDate);
      const pct = Math.min(1, (Number(t.percentComplete) || 0) / 100);
      const days = s != null && e != null ? Math.max(1, (e - s) / DAY + 1) : 1;
      activities.push({
        id: t.id, ms: `S-${root.id}`, name: t.taskName, owner: sideOf(t.resource, members, tag), start: s, end: e,
        weight: Number(t.effortManday) > 0 ? Number(t.effortManday) : days,
        status: isDone(t) ? 'Done' : pct === 0 && t.status === 'Todo' ? 'Not Started' : 'In Progress', pctIn: pct,
        finish: dayOf(t.actualFinish),
      });
    });
  });

  // Key milestones: project milestones from tasks (marked "Key milestone", else ◆ one-day tasks), followed by the billing milestones (Milestones tab).
  const flagged = tasks.filter((t) => t.isMilestone);
  const diamonds = flagged.length ? [] : tasks.filter((t) => t.startDate && t.endDate && t.startDate === t.endDate && !kids.has(t.id));
  const fromTasks = (flagged.length ? flagged : diamonds)
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))
    .map((t) => ({ id: `K-${t.id}`, name: t.taskName, phase: '', key: true, start: dayOf(t.startDate), end: dayOf(t.endDate), owner: '', override: '', _grp: 'project',
      _pct: isDone(t) ? 1 : Math.min(1, (Number(t.percentComplete) || 0) / 100) }));
  const billing = [...milestones].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).map((m) => {
    const t = m.taskId ? tasks.find((x) => x.id === m.taskId) : undefined;
    return { id: `B-${m.id}`, name: `${m.name} · Billing`, phase: '', key: true, start: t ? dayOf(t.startDate) : null, end: dayOf(m.dueDate) ?? (t ? dayOf(t.endDate) : null), owner: '', override: '', _grp: 'billing',
      _pct: m.status === 'billed' || m.status === 'paid' ? 1 : t ? Math.min(1, (Number(t.percentComplete) || 0) / 100) : 0 };
  });
  const keyMs = [...fromTasks, ...billing];

  // Highlights: the PM's text, else tasks finished in the half-month / due in the next one.
  const { start: pStart, end: pEnd } = periodRange(period);
  const next = periodRange(shiftPeriod(period, 1));
  const leaves = roots.flatMap(leavesOf);
  const inRange = (v: string | null | undefined, a: Date, b: Date) => { const x = dayOf(v); return x != null && x >= UTC(a) && x <= UTC(b); };
  const autoAcc = leaves.filter((t) => isDone(t) && inRange(t.actualFinish || t.endDate, pStart, pEnd)).slice(0, 6).map((t) => t.taskName);
  const autoNext = leaves.filter((t) => !isDone(t) && (inRange(t.endDate, next.start, next.end) || inRange(t.startDate, next.start, next.end))).slice(0, 6).map((t) => t.taskName);
  const acc = record?.accomplishments?.trim() ? lines(record.accomplishments) : autoAcc;
  const up = record?.nextSteps?.trim() ? lines(record.nextSteps) : autoNext;
  const highlights = [
    ...acc.map((text, i) => ({ date: null, type: 'Accomplishment', text, vis: 'All', order: i })),
    ...up.map((text, i) => ({ date: null, type: 'Upcoming', text, vis: 'All', order: i })),
  ];

  // Issues and risks (open ones; "Internal" ones never reach the external report)
  const issueRows = [
    ...issues.map((i) => {
      const due = dayOf(i.dueDate);
      const rag: Rag = i.status === 'Resolved' ? 'Completed' : i.status === 'Blocked' || (due != null && due < rd) ? 'Delayed' : i.status === 'In Progress' ? 'On Track' : 'At Risk';
      return { id: i.id, type: i.steering === 'Decision' ? 'Decision Needed' : 'Issue', text: i.title, impact: i.impactArea || '', action: i.nextAction || i.notes || '',
        due, owner: i.assignedTo || '', rag, open: i.status !== 'Resolved', vis: i.visibility === 'Internal' ? 'Internal' : 'All', steer: i.steering || '', ask: i.steeringAsk || '' };
    }),
    ...risks.map((r) => {
      const due = dayOf(r.dueDate);
      const rag: Rag = r.status === 'Closed' ? 'Completed' : due != null && due < rd ? 'Delayed' : r.impact === 'High' || r.probability === 'High' ? 'At Risk' : 'On Track';
      return { id: r.id, type: 'Risk', text: r.title, impact: r.impactArea || '', action: r.mitigation || '', due, owner: r.owner || '', rag,
        open: r.status !== 'Closed', vis: r.visibility === 'Internal' ? 'Internal' : 'All', steer: r.steering || '', ask: r.steeringAsk || '' };
    }),
  ];

  const kv: Record<string, unknown> = {
    'Report Date': format(rdDate, 'yyyy-MM-dd'),
    'Client Name': project.client || project.name,
    'Client Short Name': project.customerAbbreviation || project.code || 'Project',
    'Company Name': 'HUMANICA',
    'Project Name': project.name,
    'Report Title': 'Semi-monthly Status Update',
    'Project Lead': pm?.name || '',
    'Project Model': project.softwareVersion || '',
    'Current Project Phase': input.phaseName || '',
    'Go-Live Date': project.endDate || '',
    'Assessment Rationale': record?.rationale || '',
    'Overall Status Override': record?.overallStatus || '',
    'Client Logo URL': project.logo && project.logo.startsWith('data:image/') ? project.logo : '',
  };
  return { raw: { kv, phases, milestones: [...structural, ...keyMs], activities, highlights, issues: issueRows, billing: [], warnings: [], format: 'plan', kickoff: null }, rd, rdDate };
}

/** Compute the model with the engine, then align it with the rest of the app (overall progress, key milestones). */
export function computeModel(psr: PsrApi, input: ExternalInput): PsrModel {
  const { raw, rd, rdDate } = buildRaw(input);
  const M = psr.compute(raw);
  // Overall progress = the project's progress used everywhere else (Dashboard, One Page)
  const health = projectHealth(input.tasks, format(rdDate, 'yyyy-MM-dd'));
  const ov = health.actual / 100; const pl = health.planned / 100;
  const auto: Rag = ov >= 1 ? 'Completed' : pl - ov > 2 * TOL ? 'Delayed' : pl - ov > TOL ? 'At Risk' : ov === 0 ? 'Not Started' : 'On Track';
  const override = String(input.record?.overallStatus || '');
  Object.assign(M.P, { overall: ov, overallPlanned: pl, overallAuto: auto, overallStatus: (STATUS as readonly string[]).includes(override) ? override : auto,
    projectSummary: lines(String(input.record?.projectSummary || '')), ...splitSummary(String(input.record?.projectSummary || '')) });
  // Key milestones: progress from the linked task (or billed/paid = done)
  M.milestones.forEach((m) => {
    if (!m.key) return;
    const src = (raw.milestones as Record<string, unknown>[]).find((x) => x.id === m.id);
    const pct = Number(src?._pct) || 0;
    const s = (m.start as number | null) ?? null; const e = (m.end as number | null) ?? null;
    const planned = plannedAt(rd, s, e);
    const status: Rag = pct >= 1 ? 'Completed' : e != null && rd > e ? 'Delayed' : pct === 0 && (s == null || rd < s) ? 'Not Started' : planned - pct > TOL ? 'At Risk' : pct === 0 ? 'Not Started' : 'On Track';
    Object.assign(m, { pct, planned, auto: status, status, grp: src?._grp });
  });
  (M as Record<string, unknown>).chart = chartData(input, M, rd, rdDate, health.actual);
  return M;
}

export const reportFileName = (project: Project, rdDate: Date) =>
  `${(project.customerAbbreviation || project.code || 'Project').replace(/[^\w-]+/g, '_')}_Status_External_${format(rdDate, 'yyyyMMdd')}`;

/** Editable PowerPoint (the company sample layout). */
export async function downloadExternalPptx(M: PsrModel): Promise<void> {
  const [{ default: PptxGenJS }, { default: JSZip }] = await Promise.all([import('pptxgenjs'), import('jszip')]);
  Object.assign(window as unknown as Record<string, unknown>, { PptxGenJS, JSZip });
  await loadEngine();
  await loadScript('/vendor/hub/status-pptx.js');
  if (!window.PSRPPTX) throw new Error('The PowerPoint engine did not load');
  await window.PSRPPTX.download(M, 'external');
}

/** Data for the "Progress Overview" page: S-curve (plan vs actual by month), phases plan vs actual, milestones by status. */
function chartData(input: ExternalInput, M: PsrModel, rd: number, rdDate: Date, actualNow: number) {
  const { tasks, project } = input;
  const starts = [project.startDate, ...tasks.map((t) => t.startDate)].map((v) => (v ? parseISO(v) : null)).filter((d): d is Date => !!d && isValid(d));
  const ends = [project.endDate, ...tasks.map((t) => t.endDate)].map((v) => (v ? parseISO(v) : null)).filter((d): d is Date => !!d && isValid(d));
  let points: { label: string; iso: string; past: boolean }[] = [];
  if (starts.length && ends.length) {
    const first = startOfMonth(new Date(Math.min(...starts.map((d) => d.getTime()))));
    const last = new Date(Math.max(...ends.map((d) => d.getTime())));
    for (let m = first; m <= last && points.length < 60; m = addMonths(m, 1)) {
      const end = endOfMonth(m);
      const current = UTC(m) <= rd && rd <= UTC(end);
      const at = current ? rdDate : end;
      points.push({ label: format(m, 'MMM yy'), iso: format(at, 'yyyy-MM-dd'), past: UTC(at) <= rd });
    }
    // keep the chart readable: at most 18 points (always keep the report-date point and the last one)
    if (points.length > 18) {
      const step = Math.ceil(points.length / 18);
      points = points.filter((p, i) => i % step === 0 || i === points.length - 1 || (p.past && !points[i + 1]?.past));
    }
  }
  const plan = points.length ? computeBaselineProgress(tasks, points.map((p) => p.iso)).map((r) => Math.round(r.baselinePercent)) : [];
  const snaps = [...(input.snapshots || [])].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const actual = points.map((p, i) => {
    if (!p.past) return null;
    const isLastPast = !points[i + 1]?.past;
    if (isLastPast) return Math.round(actualNow);
    const s = snaps.filter((x) => x.snapshotDate <= p.iso).pop();
    return s ? Math.round(Number(s.actualPercent) || 0) : null;
  });
  const phases = ((M as Record<string, unknown>).phases as Record<string, unknown>[] || []).map((p) => ({
    name: String(p.name), planned: Math.round((Number(p.planned) || 0) * 100), actual: Math.round((Number(p.pct) || 0) * 100), status: String(p.status),
  }));
  const count = (grp: string) => {
    const c: Record<string, number> = {};
    M.milestones.filter((m) => m.key && m.grp === grp).forEach((m) => { c[String(m.status)] = (c[String(m.status)] || 0) + 1; });
    return c;
  };
  return { labels: points.map((p) => p.label), plan, actual, phases, milestones: { project: count('project'), billing: count('billing') } };
}


/* ── Auto text for the editable fields ─────────────────────────────────── */
const POINT_RE = /^\s*(?:[-•*]\s*)?(achieved|completed|in progress|work in progress|current activities|attention required|attention|dependencies|dependency|risks?|decision required|management focus|next steps?)\s*:\s*(.+)$/i;
const PART_HEAD_RE = /^\s*(part\s*\d+\s*[:\-–]?\s*)?(executive summary|key highlights?( & | and )attention required)\s*:?\s*$/i;
/**
 * Project summary text → Part 1 "Executive summary" (the paragraph) and Part 2 "Key highlights & attention required"
 * (lines "Achieved: …", "In progress: …", "Attention required: …", or any "- " bullet).
 */
export function splitSummary(text: string): { execSummary: string; summaryPoints: { label: string; text: string }[] } {
  const para: string[] = []; const points: { label: string; text: string }[] = [];
  text.split('\n').forEach((raw) => {
    const l = raw.trim();
    if (!l || PART_HEAD_RE.test(l)) return;
    const m = l.match(POINT_RE);
    if (m) { points.push({ label: m[1].replace(/^\w/, (c) => c.toUpperCase()), text: m[2].trim() }); return; }
    if (/^[-•*]\s+/.test(l)) { points.push({ label: '', text: l.replace(/^[-•*]\s+/, '') }); return; }
    para.push(l);
  });
  return { execSummary: para.join(' '), summaryPoints: points };
}
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export interface SuggestedText { projectSummary: string; rationale: string; accomplishments: string; nextSteps: string }

/** Draft text for the four fields, written from the project's numbers (the PM edits it; saved text always wins). */
export function suggestText(psr: PsrApi, input: ExternalInput): SuggestedText {
  const blank = { ...(input.record || {}), projectSummary: '', rationale: '', accomplishments: '', nextSteps: '', overallStatus: input.record?.overallStatus || '' } as StatusReport;
  const { raw, rd } = buildRaw({ ...input, record: blank });
  const M = computeModel(psr, { ...input, record: blank }) as unknown as Record<string, unknown> & { P: Record<string, unknown>; milestones: Record<string, unknown>[] };
  const d = (ms: unknown) => (typeof ms === 'number' && Number.isFinite(ms) ? format(new Date(ms), 'dd/MM/yyyy') : '');
  const pct = (x: unknown) => Math.round((Number(x) || 0) * 100);
  const P = M.P;
  const act = pct(P.overall); const plan = pct(P.overallPlanned); const gap = act - plan;
  const status = String(P.overallStatus || P.overallAuto || '');
  const phases = ((M.phases as Record<string, unknown>[]) || []);
  const doneP = phases.filter((p) => pct(p.pct) >= 100);
  const nowP = phases.filter((p) => pct(p.pct) < 100 && (Number(p.start) <= rd || pct(p.pct) > 0));
  const nextP = phases.find((p) => pct(p.pct) === 0 && Number(p.start) > rd);
  const behind = nowP.filter((p) => pct(p.planned) - pct(p.pct) >= 10);
  const keyMs = M.milestones.filter((m) => m.key && m.status !== 'Completed').sort((a, b) => (Number(a.end) || Infinity) - (Number(b.end) || Infinity));
  const lateMs = keyMs.filter((m) => m.status === 'Delayed');
  const nextMs = keyMs.find((m) => m.status !== 'Delayed');
  const openIssues = input.issues.filter((i) => i.status !== 'Resolved');
  const blocked = openIssues.filter((i) => i.status === 'Blocked');
  const { project } = input;

  // Part 1 · Executive summary: status → progress → achievements → current work → dependencies/risks → next focus
  const hiddenT = internalTaskIds(input.tasks);
  const leavesNow = input.tasks.filter((t) => !hiddenT.has(t.id) && !input.tasks.some((k) => k.parentId === t.id))
    .filter((t) => !isDone(t) && dayOf(t.startDate) != null && Number(dayOf(t.startDate)) <= rd && (Number(t.percentComplete) || 0) > 0)
    .sort((x, y) => String(x.endDate).localeCompare(String(y.endDate)));
  const doing = (leavesNow.length ? leavesNow.map((t) => t.taskName) : nowP.map((p) => String(p.name))).filter(Boolean).slice(0, 2);
  const hlAcc = (raw.highlights as { type: string; text: string }[]).filter((h) => h.type === 'Accomplishment').map((h) => h.text);
  const standing = status === 'Completed' ? 'has been completed'
    : gap >= 5 ? 'is currently ahead of the planned schedule'
    : status === 'Delayed' ? `is currently behind the planned schedule (plan ${plan}%)`
    : status === 'At Risk' ? `is slightly behind the plan (${plan}%) and is being closely monitored`
    : status === 'Not Started' ? 'has not started yet' : 'is currently on track against the planned schedule';
  const readyFor = nextP ? ` to ensure readiness for the upcoming ${nextP.name} phase` : nextMs ? ` towards ${nextMs.name}` : '';
  const extIssues = openIssues.filter((i) => i.visibility !== 'Internal');
  const extRisks = input.risks.filter((r) => r.status !== 'Closed' && r.visibility !== 'Internal')
    .sort((x, y) => ({ High: 0, Medium: 1, Low: 2 }[x.impact] - { High: 0, Medium: 1, Low: 2 }[y.impact]));
  const dep = [...extIssues.filter((i) => i.status === 'Blocked'), ...extIssues.filter((i) => i.status !== 'Blocked')][0];
  const risk = extRisks[0];
  const nextTarget = nextP ? `the next phase of ${nextP.name}` : nextMs ? nextMs.name : 'the next phase';
  const para = [
    status === 'Completed' ? `The project has been completed with ${act}% overall progress.` : `The project has achieved ${act}% overall progress and ${standing}.`,
    hlAcc.length ? `Key work completed in this period includes ${joinList(hlAcc.slice(0, 2))}.` : doneP.length ? `${joinList(doneP.map((p) => String(p.name)))} ${doneP.length > 1 ? 'have' : 'has'} been completed.` : '',
    doing.length ? `The team is progressing with ${joinList(doing)}${readyFor}.` : '',
    dep ? `In parallel, the project team is working with ${dep.assignedTo || 'the customer'} on ${dep.title.replace(/\.$/, '')}, which is a key dependency for ${nextTarget}.`
      : risk ? `The team is monitoring ${risk.title.replace(/\.$/, '')}, which may affect ${nextTarget}.` : '',
    nextMs ? `The next key milestone is ${nextMs.name}, targeted for ${d(nextMs.end)}.` : '',
  ].filter(Boolean);
  // Part 2 · Key highlights & attention required
  const attention = [
    ...lateMs.slice(0, 2).map((m) => `${m.name} is past its target date (${d(m.end)})`),
    ...behind.slice(0, 1).map((p) => `${p.name} is ${pct(p.pct)}% against ${pct(p.planned)}% planned`),
    ...extIssues.filter((i) => i.steering === 'Decision').slice(0, 1).map((i) => `decision needed: ${i.steeringAsk || i.title}`),
    ...(dep ? [`${dep.title}${dep.dueDate ? ` (due ${d(dayOf(dep.dueDate))})` : ''}`] : []),
  ];
  const summary = [
    para.join(' '),
    '',
    `Achieved: ${hlAcc.length ? joinList(hlAcc.slice(0, 3)) : doneP.length ? joinList(doneP.map((p) => String(p.name))) : 'no major item completed in this period'}`,
    `In progress: ${doing.length ? joinList([...doing, ...nowP.map((p) => `${p.name} phase (${pct(p.pct)}%)`)].slice(0, 3)) : 'no work in progress'}`,
    `Attention required: ${attention.length ? attention.slice(0, 2).join('; ') : 'none at this stage'}`,
  ];

  const why = [
    gap === 0 ? `Overall progress is ${act}%, on plan.` : `Overall progress is ${act}% against ${plan}% planned (${gap > 0 ? '+' : ''}${gap} pts).`,
    behind.length ? `${behind.map((p) => `${p.name} is ${pct(p.pct)}% against ${pct(p.planned)}% planned`).join('; ')}.` : nowP.length ? 'Phases in progress are tracking to plan.' : '',
    lateMs.length ? `${lateMs.length} key milestone(s) past due: ${lateMs.slice(0, 2).map((m) => m.name).join(', ')}.` : nextMs ? `Next key milestone: ${nextMs.name} (${d(nextMs.end)}).` : '',
    openIssues.length ? `${openIssues.length} open issue(s)${blocked.length ? `, ${blocked.length} blocked` : ''}.` : '',
  ].filter(Boolean);

  const hl = (type: string) => (raw.highlights as { type: string; text: string }[]).filter((h) => h.type === type).map((h) => h.text).join('\n');
  return { projectSummary: summary.join('\n'), rationale: why.join(' '), accomplishments: hl('Accomplishment'), nextSteps: hl('Upcoming') };
}
