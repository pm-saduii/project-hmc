import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isValid, parseISO } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store';
import { memberApi, taskApi } from '../services/api';
import { C, ProgressBar } from '../components/Common';
import { fmtDate } from '../utils';
import { projectPath } from '../utils/projectRoutes';
import type { Member, Task } from '../types';
import { PageBody } from './AdminPages';

type Filter = 'open' | 'overdue' | 'week' | 'done' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week', label: 'Due in 7 days' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

function toDate(value: string): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * Names a task's Resource may use for the signed-in user: their email, profile name, and the
 * name / nickname / Thai name of every member row with the same email (same rule as the reminder email).
 */
function identityNames(email: string, fullName: string, members: Member[]): Set<string> {
  const names = new Set<string>();
  const me = norm(email);
  if (me) names.add(me);
  if (norm(fullName)) names.add(norm(fullName));
  members.filter((m) => norm(m.email) === me && me).forEach((m) => {
    [m.name, m.nickname, m.thaiName].forEach((value) => { if (norm(value)) names.add(norm(value)); });
  });
  return names;
}

/** /my-tasks — leaf tasks assigned to me across every project I can read. */
export default function MyTasksPage() {
  const { user, profile } = useAuth();
  const projects = useStore((state) => state.projects);
  const navigate = useNavigate();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('open');
  const [query, setQuery] = React.useState('');

  // Loaded here, not into the store, so the active project's data is left alone.
  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Member rows only add name aliases; if they cannot be read, match on email / profile name.
      const [taskResult, memberResult] = await Promise.all([
        taskApi.getByProject(),
        memberApi.getByProject().catch(() => ({ data: [] as Member[] })),
      ]);
      setTasks(taskResult.data);
      setMembers(memberResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const projectById = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const mine = React.useMemo(() => {
    const names = identityNames(user?.email || '', profile?.fullName || '', members);
    if (!names.size) return [];
    const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    return tasks.filter((t) => {
      if (parentIds.has(t.id)) return false; // summary rows roll up their children
      const owners = String(t.resource || '').split(/[,;/]/).map(norm).filter(Boolean);
      return owners.some((owner) => names.has(owner));
    });
  }, [tasks, members, user?.email, profile?.fullName]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const isDone = (t: Task) => t.status === 'Done' || Number(t.percentComplete) >= 100;
  const isOverdue = (t: Task) => { const due = toDate(t.endDate); return !isDone(t) && !!due && due < today; };
  const isThisWeek = (t: Task) => { const due = toDate(t.endDate); return !isDone(t) && !!due && due >= today && due <= in7; };

  const counts: Record<Filter, number> = {
    open: mine.filter((t) => !isDone(t)).length,
    overdue: mine.filter(isOverdue).length,
    week: mine.filter(isThisWeek).length,
    done: mine.filter(isDone).length,
    all: mine.length,
  };

  const q = norm(query);
  const rows = mine
    .filter((t) => (filter === 'open' ? !isDone(t)
      : filter === 'overdue' ? isOverdue(t)
        : filter === 'week' ? isThisWeek(t)
          : filter === 'done' ? isDone(t) : true))
    .filter((t) => {
      if (!q) return true;
      const p = projectById.get(t.projectId);
      return [t.taskName, t.wbs, p?.name, p?.code].some((value) => norm(value).includes(q));
    })
    .sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999') || a.taskName.localeCompare(b.taskName));

  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', background: C.bg };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' };

  return (
    <PageBody>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: C.text }}>My Tasks</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.text2 }}>Tasks whose Resource is you, across all your projects.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.text2, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'Poppins, sans-serif' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <nav aria-label="Task filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            const danger = item.key === 'overdue' && counts.overdue > 0;
            return (
              <button key={item.key} type="button" aria-pressed={active} onClick={() => setFilter(item.key)}
                style={{
                  height: 30, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                  border: `1px solid ${active ? '#C7D2FE' : C.border}`, background: active ? C.primaryBg : C.white, color: active ? C.primary : C.text2,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                {item.label}
                <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: danger ? C.redBg : C.bg2, color: danger ? C.red : C.text2 }}>{counts[item.key]}</span>
              </button>
            );
          })}
        </nav>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search task or project" aria-label="Search my tasks"
          style={{ marginLeft: 'auto', height: 32, minWidth: 200, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'Poppins, sans-serif', background: C.white, color: C.text }} />
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: C.text2 }}>Loading tasks…</div>
        ) : error ? (
          <div style={{ padding: 24, fontSize: 13, color: C.red }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: C.text2 }}>
            {mine.length === 0
              ? 'No tasks are assigned to you. A task counts as yours when its Resource is your email, your name, or your name/nickname in the project member list.'
              : 'No tasks match this filter.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Project</th>
                <th style={th}>Due</th>
                <th style={{ ...th, width: 160 }}>Progress</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const p = projectById.get(t.projectId);
                const overdue = isOverdue(t);
                return (
                  <tr key={t.id} onClick={() => navigate(projectPath(t.projectId, 'tasks'))} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{t.taskName || '(untitled)'}</div>
                      {t.wbs && <div style={{ fontSize: 11, color: C.text3 }}>WBS {t.wbs}</div>}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: p?.color || C.primary, flexShrink: 0 }} />
                        <span>{p ? `${p.code} · ${p.name}` : '—'}</span>
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: overdue ? C.red : C.text, fontWeight: overdue ? 600 : 400 }}>
                      {t.endDate ? fmtDate(t.endDate) : '—'}{overdue ? ' · Overdue' : ''}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1 }}><ProgressBar value={Number(t.percentComplete) || 0} /></div>
                        <span style={{ fontSize: 12, color: C.text2, width: 36, textAlign: 'right' }}>{Number(t.percentComplete) || 0}%</span>
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: C.text2 }}>{t.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageBody>
  );
}
