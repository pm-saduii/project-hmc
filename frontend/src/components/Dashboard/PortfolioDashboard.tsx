import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { AlertTriangle, CalendarClock, CircleDollarSign, FolderKanban, ListChecks, ShieldAlert, TrendingDown, Bug } from 'lucide-react';
import { useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { issueApi, memberApi, riskApi } from '../../services/api';
import { C, ProgressBar } from '../Common';
import { fmtDate, fmtMoney } from '../../utils';
import { projectHealth, type ProjectHealth } from '../../utils/projectHealth';
import { isMyTask, myIdentityNames } from '../../utils/myTasks';
import { projectPath } from '../../utils/projectRoutes';
import type { Issue, Member, Milestone, Project, Risk, Task } from '../../types';

const F = 'Poppins, sans-serif';

const toDate = (value?: string) => {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
};
const isDone = (t: Task) => t.status === 'Done' || Number(t.percentComplete) >= 100;

interface ProjectRow {
  project: Project;
  health: ProjectHealth;
  overdueTasks: number;
  openIssues: number;
  blockedIssues: number;
  highRisks: number;
  overdueMilestones: number;
  unpaidMilestones: number;
  finished: boolean;
}

const HEALTH_STYLE: Record<ProjectHealth['status'], { color: string; bg: string; rank: number }> = {
  Stoper: { color: C.red, bg: C.redBg, rank: 0 },
  Delay: { color: C.amber, bg: C.amberBg, rank: 1 },
  'On Track': { color: C.green, bg: C.greenBg, rank: 3 },
  'Plan N/A': { color: C.text3, bg: C.bg2, rank: 2 },
};

/**
 * Home page: what needs attention today and how the portfolio is doing.
 * Each section follows the user's screen permissions: issues, risks and milestones only when
 * those screens are visible, money only when amounts are not masked for the role.
 */
export default function PortfolioDashboard({ isMobile }: { isMobile: boolean }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const role = profile?.role || 'member';
  const permissions = useRolePermissions();
  const showTasks = permissions.isTabVisible('tasks');
  const showIssues = permissions.isTabVisible('issues');
  const showRisks = permissions.isTabVisible('risks');
  const showMs = permissions.isTabVisible('ms');
  const canSeeBilling = showMs && permissions.getMaskedAmount(1) !== 0;
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const milestones = useStore((s) => s.milestones);
  const masterCodes = useStore((s) => s.masterCodes);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [risks, setRisks] = React.useState<Risk[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);

  // Cross-project lists the store does not hold; RLS limits them to the user's projects.
  React.useEffect(() => {
    let alive = true;
    const safe = <T,>(p: Promise<{ data: T[] }>) => p.then((r) => r.data).catch(() => [] as T[]);
    void Promise.all([
      showIssues ? safe(issueApi.getByProject()) : Promise.resolve([] as Issue[]),
      showRisks ? safe(riskApi.getByProject()) : Promise.resolve([] as Risk[]),
      safe(memberApi.getByProject()),
    ]).then(([i, r, m]) => {
      if (!alive) return;
      setIssues(i); setRisks(r); setMembers(m);
    });
    return () => { alive = false; };
  }, [showIssues, showRisks]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = addDays(today, 7);
  const in14 = addDays(today, 14);

  const hyperCareValues = new Set(masterCodes
    .filter((c) => c.codeType === 'project_status' && c.label === 'Hyper Care')
    .map((c) => c.codeValue));
  hyperCareValues.add('Hyper Care');
  const isHyperCare = (p: Project) => hyperCareValues.has(p.status);
  const statusLabel = (p: Project) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === p.status)?.label || p.status || '—';

  // ── Per-project numbers ───────────────────────────────────────────────────
  const tasksByProject = new Map<string, Task[]>();
  tasks.forEach((t) => { const list = tasksByProject.get(t.projectId) || []; list.push(t); tasksByProject.set(t.projectId, list); });
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leafTasks = tasks.filter((t) => !parentIds.has(t.id));
  const overdueLeaf = (showTasks ? leafTasks : []).filter((t) => { const d = toDate(t.endDate); return !isDone(t) && !!d && d < today; });
  const openIssues = issues.filter((i) => i.status !== 'Resolved');
  const highRisks = risks.filter((r) => r.status !== 'Closed' && (r.probability === 'High' || r.impact === 'High'));
  const pendingMilestones = (showMs ? milestones : []).filter((m) => String(m.status).toLowerCase() === 'pending');
  const overdueMilestones = pendingMilestones.filter((m) => { const d = toDate(m.dueDate); return !!d && d < today; });

  const unpaidMilestones = (showMs ? milestones : []).filter((m) => String(m.status).toLowerCase() !== 'paid');
  const count = <T extends { projectId: string }>(list: T[], id: string) => list.filter((x) => x.projectId === id).length;
  const rows: ProjectRow[] = projects.map((project) => ({
    project,
    health: projectHealth(tasksByProject.get(project.id) || []),
    overdueTasks: count(overdueLeaf, project.id),
    openIssues: count(openIssues, project.id),
    blockedIssues: openIssues.filter((i) => i.projectId === project.id && i.status === 'Blocked').length,
    highRisks: count(highRisks, project.id),
    overdueMilestones: count(overdueMilestones, project.id),
    unpaidMilestones: count(unpaidMilestones, project.id),
    finished: false,
  }));
  const activeRows = rows.filter((r) => !isHyperCare(r.project));
  const behind = activeRows.filter((r) => r.health.status === 'Delay' || r.health.status === 'Stoper');

  // Finished = Hyper Care (already live), 100% complete, or a closed / completed / cancelled status.
  // Running projects: schedule, overdue tasks, blocked issues, past-due milestones, high risks.
  // Finished projects: only money not yet paid and issues not yet resolved (risks no longer matter).
  rows.forEach((r) => {
    r.finished = isHyperCare(r.project)
      || r.health.actual >= 100
      || /close|complete|done|finish|cancel/i.test(`${r.project.status} ${statusLabel(r.project)}`);
  });
  const attention = rows
    .filter((r) => (r.finished
      ? r.unpaidMilestones > 0 || r.openIssues > 0
      : r.health.status === 'Delay' || r.health.status === 'Stoper'
        || r.overdueTasks || r.blockedIssues || r.overdueMilestones || r.highRisks))
    .sort((a, b) => Number(a.finished) - Number(b.finished)
      || HEALTH_STYLE[a.health.status].rank - HEALTH_STYLE[b.health.status].rank
      || b.health.gap - a.health.gap || b.overdueTasks - a.overdueTasks);

  // ── Billing (admin / PM) ──────────────────────────────────────────────────
  const monthKey = (d: Date) => format(d, 'yyyy-MM');
  const billingDate = (m: Milestone) => toDate(m.billingDate) || toDate(m.dueDate);
  const thisMonth = monthKey(today);
  const amount = (m: Milestone) => Number(m.amount) || 0;
  const dueThisMonth = pendingMilestones.filter((m) => { const d = billingDate(m); return !!d && (monthKey(d) <= thisMonth); });
  const billedUnpaid = (canSeeBilling ? milestones : []).filter((m) => m.status === 'billed');
  const paidThisYear = (canSeeBilling ? milestones : []).filter((m) => m.status === 'paid' && (billingDate(m)?.getFullYear() === today.getFullYear()));
  const months = Array.from({ length: 6 }, (_, i) => new Date(today.getFullYear(), today.getMonth() + i, 1));
  const pendingByMonth = months.map((d) => ({
    label: format(d, 'MMM yyyy'),
    value: pendingMilestones.filter((m) => { const b = billingDate(m); return !!b && monthKey(b) === monthKey(d); }).reduce((s, m) => s + amount(m), 0),
  }));
  const maxMonth = Math.max(1, ...pendingByMonth.map((m) => m.value));

  // ── My work ───────────────────────────────────────────────────────────────
  const names = myIdentityNames(user?.email || '', profile?.fullName || '', members);
  const myOpen = tasks.filter((t) => isMyTask(t, names, parentIds) && !isDone(t));
  const myOverdue = myOpen.filter((t) => { const d = toDate(t.endDate); return !!d && d < today; });
  const myWeek = myOpen.filter((t) => { const d = toDate(t.endDate); return !!d && d >= today && d <= in7; });
  const myList = [...myOverdue, ...myWeek].sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 6);

  // ── Next 14 days ──────────────────────────────────────────────────────────
  const projectById = new Map(projects.map((p) => [p.id, p]));
  type Upcoming = { date: Date; key: string; kind: 'Milestone' | 'Billing' | 'Tasks'; label: string; project?: Project; to: string };
  const upcoming: Upcoming[] = [];
  pendingMilestones.forEach((m) => {
    const p = projectById.get(m.projectId);
    const due = toDate(m.dueDate);
    if (due && due >= today && due <= in14) upcoming.push({ date: due, key: `m-${m.id}`, kind: 'Milestone', label: m.name, project: p, to: projectPath(m.projectId, 'ms') });
    const bill = toDate(m.billingDate);
    if (canSeeBilling && bill && bill >= today && bill <= in14 && m.billingDate !== m.dueDate) {
      upcoming.push({ date: bill, key: `b-${m.id}`, kind: 'Billing', label: `${m.name} · ฿${fmtMoney(amount(m))}`, project: p, to: projectPath(m.projectId, 'ms') });
    }
  });
  if (showTasks) {
    const grouped = new Map<string, { date: Date; projectId: string; n: number }>();
    leafTasks.forEach((t) => {
      const d = toDate(t.endDate);
      if (!d || isDone(t) || d < today || d > in14) return;
      const k = `${t.endDate}|${t.projectId}`;
      const g = grouped.get(k) || { date: d, projectId: t.projectId, n: 0 };
      g.n += 1;
      grouped.set(k, g);
    });
    grouped.forEach((g, k) => upcoming.push({
      date: g.date, key: `t-${k}`, kind: 'Tasks', label: `${g.n} task${g.n > 1 ? 's' : ''} due`,
      project: projectById.get(g.projectId), to: projectPath(g.projectId, 'tasks'),
    }));
  }
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime() || a.kind.localeCompare(b.kind));
  const upcomingDays = new Map<string, Upcoming[]>();
  upcoming.forEach((u) => { const k = format(u.date, 'yyyy-MM-dd'); upcomingDays.set(k, [...(upcomingDays.get(k) || []), u]); });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const hyperCareCount = rows.length - activeRows.length;
  const kpis: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string; to?: string; hidden?: boolean }[] = [
    { label: 'Active projects', value: String(activeRows.length), sub: hyperCareCount ? `+${hyperCareCount} in Hyper Care` : undefined, icon: <FolderKanban size={18} />, color: C.primary, to: '/projects' },
    { label: 'Behind schedule', value: String(behind.length), sub: `${behind.filter((r) => r.health.status === 'Stoper').length} critical`, icon: <TrendingDown size={18} />, color: behind.length ? C.amber : C.green },
    { label: 'Overdue tasks', value: String(overdueLeaf.length), icon: <AlertTriangle size={18} />, color: overdueLeaf.length ? C.red : C.green, hidden: !showTasks },
    { label: 'Open issues', value: String(openIssues.length), sub: `${openIssues.filter((i) => i.status === 'Blocked').length} blocked`, icon: <Bug size={18} />, color: C.blue, hidden: !showIssues },
    { label: 'High risks', value: String(highRisks.length), icon: <ShieldAlert size={18} />, color: highRisks.length ? C.red : C.green, hidden: !showRisks },
    { label: 'Pending billing', value: `฿${fmtMoney(dueThisMonth.reduce((s, m) => s + amount(m), 0))}`, sub: `${dueThisMonth.length} milestone${dueThisMonth.length === 1 ? '' : 's'} due by month end`, icon: <CircleDollarSign size={18} />, color: C.green, hidden: !canSeeBilling },
  ].filter((k) => !k.hidden);

  // ── Layout pieces ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow, padding: 18, minWidth: 0 };
  const sectionTitle = (title: string, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{title}</h3>
      {extra}
    </div>
  );
  const empty = (text: string) => <div style={{ fontSize: 13, color: C.text2, padding: '8px 0' }}>{text}</div>;
  const chip = (text: string, color: string, bg: string, to: string) => (
    <Link key={text} to={to} onClick={(e) => e.stopPropagation()}
      style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: bg, color, textDecoration: 'none', whiteSpace: 'nowrap' }}>
      {text}
    </Link>
  );

  const myWorkCard = showTasks && role !== 'client' && (
    <section style={card} aria-label="My work">
      {sectionTitle('My work', <Link to="/my-tasks" style={{ fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: 'none' }}>All my tasks →</Link>)}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: myOverdue.length ? C.redBg : C.bg }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: myOverdue.length ? C.red : C.text }}>{myOverdue.length}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>Overdue</div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: C.bg }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{myWeek.length}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>Due in 7 days</div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: C.bg }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{myOpen.length}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>Open</div>
        </div>
      </div>
      {myList.length === 0 ? empty('Nothing overdue or due this week.') : myList.map((t) => {
        const p = projectById.get(t.projectId);
        const d = toDate(t.endDate);
        const late = !!d && d < today;
        return (
          <Link key={t.id} to={projectPath(t.projectId, 'tasks')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.border}`, textDecoration: 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p?.color || C.primary, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.taskName}</span>
              <span style={{ display: 'block', fontSize: 11, color: C.text3 }}>{p?.code || ''}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: late ? C.red : C.text2, whiteSpace: 'nowrap' }}>{fmtDate(t.endDate)}</span>
          </Link>
        );
      })}
    </section>
  );

  const attentionCard = (
    <section style={card} aria-label="Needs attention">
      {sectionTitle('Needs attention', <span style={{ fontSize: 11, color: C.text3 }}>{attention.length} project{attention.length === 1 ? '' : 's'}</span>)}
      {attention.length === 0 ? empty('All projects are on track. Nothing overdue.') : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {attention.slice(0, 8).map((r) => {
            const hs = HEALTH_STYLE[r.health.status];
            const id = r.project.id;
            return (
              <div key={id} role="link" tabIndex={0} onClick={() => navigate(projectPath(id))}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(projectPath(id)); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}`, cursor: 'pointer', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: r.project.color || C.primary, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    <span style={{ color: C.primary }}>{r.project.code}</span> · {r.project.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                    {r.finished ? <>
                      {r.unpaidMilestones > 0 && chip(`${r.unpaidMilestones} milestone${r.unpaidMilestones > 1 ? 's' : ''} not paid`, C.amber, C.amberBg, projectPath(id, 'ms'))}
                      {r.openIssues > 0 && chip(`${r.openIssues} open issue${r.openIssues > 1 ? 's' : ''}`, C.red, C.redBg, projectPath(id, 'issues'))}
                    </> : <>
                      {r.overdueTasks > 0 && chip(`${r.overdueTasks} overdue task${r.overdueTasks > 1 ? 's' : ''}`, C.red, C.redBg, projectPath(id, 'tasks'))}
                      {r.blockedIssues > 0 && chip(`${r.blockedIssues} blocked issue${r.blockedIssues > 1 ? 's' : ''}`, C.red, C.redBg, projectPath(id, 'issues'))}
                      {r.highRisks > 0 && chip(`${r.highRisks} high risk${r.highRisks > 1 ? 's' : ''}`, C.amber, C.amberBg, projectPath(id, 'risks'))}
                      {r.overdueMilestones > 0 && chip(`${r.overdueMilestones} milestone${r.overdueMilestones > 1 ? 's' : ''} past due`, C.amber, C.amberBg, projectPath(id, 'ms'))}
                    </>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {r.finished ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: C.bg2, color: C.text2 }}>Finished · {statusLabel(r.project)}</span>
                  ) : <>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: hs.bg, color: hs.color }}>{r.health.status}</span>
                    <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>{r.health.actual}% of {r.health.planned}% planned</div>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const chartRows = [...activeRows].sort((a, b) => b.health.gap - a.health.gap);
  const healthCard = (
    <section style={card} aria-label="Portfolio health">
      {sectionTitle('Portfolio health', (
        <span style={{ display: 'flex', gap: 12, fontSize: 11, color: C.text2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 6, borderRadius: 3, background: C.primary }} />Actual</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 2, height: 10, background: C.text }} />Plan today</span>
        </span>
      ))}
      {chartRows.length === 0 ? empty('No active projects.') : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chartRows.map((r) => {
            const hs = HEALTH_STYLE[r.health.status];
            return (
              <Link key={r.project.id} to={projectPath(r.project.id)} title={`${r.project.name}: ${r.health.actual}% actual, ${r.health.planned}% planned (${statusLabel(r.project)})`}
                style={{ display: 'grid', gridTemplateColumns: isMobile ? '90px 1fr 70px' : '140px 1fr 90px', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.project.code || r.project.name}</span>
                <span style={{ position: 'relative', height: 10, background: C.bg2, borderRadius: 5 }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, r.health.actual)}%`, background: r.health.status === 'On Track' ? C.primary : hs.color, borderRadius: 5 }} />
                  {r.health.status !== 'Plan N/A' && (
                    <span style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${Math.min(100, r.health.planned)}% - 1px)`, width: 2, background: C.text, borderRadius: 1 }} />
                  )}
                </span>
                <span style={{ fontSize: 11, color: hs.color, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.health.actual}%{r.health.status !== 'Plan N/A' && r.health.gap > 0 ? ` (−${r.health.gap})` : ''}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );

  const kindStyle: Record<Upcoming['kind'], { color: string; bg: string }> = {
    Milestone: { color: C.primary, bg: C.primaryBg },
    Billing: { color: C.green, bg: C.greenBg },
    Tasks: { color: C.text2, bg: C.bg2 },
  };
  const upcomingCard = (
    <section style={card} aria-label="Next 14 days">
      {sectionTitle('Next 14 days', <CalendarClock size={16} color={C.text3} aria-hidden="true" />)}
      {upcomingDays.size === 0 ? empty('Nothing due in the next 14 days.') : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
          {[...upcomingDays.entries()].map(([day, items]) => {
            const d = parseISO(day);
            const isToday = day === format(today, 'yyyy-MM-dd');
            return (
              <div key={day} style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 44, flexShrink: 0, textAlign: 'center', padding: '4px 0', borderRadius: 8, background: isToday ? C.primaryBg : C.bg, alignSelf: 'flex-start' }}>
                  <div style={{ fontSize: 11, color: isToday ? C.primary : C.text3, fontWeight: 600 }}>{isToday ? 'Today' : format(d, 'EEE')}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? C.primary : C.text }}>{format(d, 'd')}</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{format(d, 'MMM')}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((u) => (
                    <Link key={u.key} to={u.to} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: kindStyle[u.kind].bg, color: kindStyle[u.kind].color, flexShrink: 0 }}>{u.kind}</span>
                      <span style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.label}</span>
                      <span style={{ fontSize: 11, color: C.text3, marginLeft: 'auto', flexShrink: 0 }}>{u.project?.code || ''}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const billingCard = canSeeBilling && (
    <section style={card} aria-label="Billing">
      {sectionTitle('Billing')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Pending (due by this month)', value: dueThisMonth.reduce((s, m) => s + amount(m), 0), color: C.amber },
          { label: 'Billed, awaiting payment', value: billedUnpaid.reduce((s, m) => s + amount(m), 0), color: C.blue },
          { label: `Paid in ${today.getFullYear()}`, value: paidThisYear.reduce((s, m) => s + amount(m), 0), color: C.green },
        ].map((b) => (
          <div key={b.label} style={{ padding: '10px 12px', borderRadius: 10, background: C.bg }}>
            <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 800, color: b.color }}>฿{fmtMoney(b.value)}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{b.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 8 }}>Pending billing by month</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pendingByMonth.map((m) => (
          <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 110px', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: C.text2 }}>{m.label}</span>
            <ProgressBar value={(m.value / maxMonth) * 100} color={C.green} height={8} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right' }}>฿{fmtMoney(m.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );

  const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)', gap: 16, marginBottom: 16, alignItems: 'start' };

  return (
    <div style={{ padding: isMobile ? '18px 14px' : '28px 32px', fontFamily: F }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Dashboard</h2>
        <p style={{ color: C.text2, fontSize: 13, margin: 0 }}>{format(today, 'EEEE d MMMM yyyy')} · what needs attention across your projects</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : `repeat(${kpis.length}, minmax(0, 1fr))`, gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => {
          const body = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: k.color, marginBottom: 6 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>{k.icon}</span>
                <span style={{ fontSize: 11, color: C.text2, fontWeight: 500 }}>{k.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{k.sub}</div>}
            </>
          );
          const style: React.CSSProperties = { ...card, padding: '14px 16px', borderTop: `3px solid ${k.color}`, textDecoration: 'none', display: 'block' };
          return k.to ? <Link key={k.label} to={k.to} style={style}>{body}</Link> : <div key={k.label} style={style}>{body}</div>;
        })}
      </div>

      {/* Members see their own work first; managers see the portfolio first. */}
      {role === 'member' ? (
        <div style={twoCol}>{myWorkCard}{attentionCard}</div>
      ) : myWorkCard ? (
        <div style={twoCol}>{attentionCard}{myWorkCard}</div>
      ) : (
        <div style={{ marginBottom: 16 }}>{attentionCard}</div>
      )}
      <div style={twoCol}>
        {healthCard}
        {upcomingCard}
      </div>
      {billingCard && <div style={{ marginBottom: 16 }}>{billingCard}</div>}
      {!projects.length && (
        <div style={{ ...card, textAlign: 'center', color: C.text2, fontSize: 13 }}>
          <ListChecks size={20} style={{ marginBottom: 6 }} /><br />No projects yet. <Link to="/projects" style={{ color: C.primary }}>Go to Projects</Link>
        </div>
      )}
    </div>
  );
}
