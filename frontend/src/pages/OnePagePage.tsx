import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import { useStore } from '../store';
import { C } from '../components/Common';
import ExecutiveOnePage from '../components/Dashboard/ExecutiveOnePage';
import type { Project } from '../types';
import { isClosedStatus, isHyperCareStatus } from '../utils/projectHealth';

const F = 'Poppins, sans-serif';

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  React.useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

/**
 * /one-page and /one-page/:projectId — project list on the left, the selected project's
 * One Page report on the right. On narrow screens the two panes are shown one at a time.
 */
export default function OnePagePage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const narrow = useIsNarrow();
  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const activeProject = useStore((s) => s.activeProject);
  const [query, setQuery] = React.useState('');

  const statusOf = (p: Project) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === p.status);
  const statusOrder = (p: Project) => statusOf(p)?.sortOrder ?? 999;
  const q = query.trim().toLowerCase();
  // Running projects only: Hyper Care and closed projects are left out of the list.
  const isRunning = (p: Project) => {
    const label = statusOf(p)?.label || '';
    return !isHyperCareStatus(p.status, label) && !isClosedStatus(p.status, label);
  };
  const list = [...projects]
    .filter(isRunning)
    .filter((p) => !q || `${p.code} ${p.name} ${p.client}`.toLowerCase().includes(q))
    .sort((a, b) => statusOrder(a) - statusOrder(b) || String(a.code).localeCompare(String(b.code)));
  const selected = projects.find((p) => p.id === projectId) || null;

  // Open the first project when none is chosen (desktop only; phones start on the list).
  React.useEffect(() => {
    if (!projectId && !narrow && list.length) navigate(`/one-page/${encodeURIComponent(list[0].id)}`, { replace: true });
  }, [projectId, narrow, list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // The report reads the store, so make the chosen project active and load its data.
  React.useEffect(() => {
    if (!selected) return;
    const store = useStore.getState();
    if (store.activeProject?.id !== selected.id) store.setActiveProject(selected);
    const s = useStore.getState();
    void Promise.allSettled([
      s.fetchTasks(selected.id),
      s.fetchMembers(selected.id),
      s.fetchMilestones(selected.id),
      s.fetchEfforts(selected.id),
      s.fetchCRs(selected.id),
      s.fetchIssues(selected.id),
      s.fetchRisks(selected.id),
    ]);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => { useStore.getState().setActiveProject(null); }, []);

  const showList = !narrow || !projectId;
  const showReport = !narrow || !!projectId;

  const listPane = (
    <aside aria-label="Projects" style={{
      width: narrow ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: C.white, borderRight: narrow ? 0 : `1px solid ${C.border}`,
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: C.text }}>One Page</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
          <Search size={14} color={C.text3} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, fontFamily: F, color: C.text }} />
        </label>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {list.length === 0 && <div style={{ padding: 12, fontSize: 13, color: C.text2 }}>No projects found.</div>}
        {list.map((p) => {
          const active = p.id === projectId;
          const status = statusOf(p);
          return (
            <Link key={p.id} to={`/one-page/${encodeURIComponent(p.id)}`} aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex', gap: 10, padding: '10px 10px', borderRadius: 10, textDecoration: 'none', marginBottom: 2,
                background: active ? C.primaryBg : 'transparent',
              }}>
              <span style={{ width: 4, borderRadius: 2, background: p.color || C.primary, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? C.primary : C.text }}>{p.code || '—'}</span>
                <span style={{ display: 'block', fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: status?.bgColor || C.bg2, color: status?.textColor || C.text2 }}>
                    {status?.label || p.status || '—'}
                  </span>
                  <span style={{ fontSize: 11, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  let report: React.ReactNode;
  if (!selected) {
    report = <div style={{ padding: 32, fontSize: 13, color: C.text2 }}>{projectId ? 'Project not found or no access.' : 'Select a project.'}</div>;
  } else if (activeProject?.id !== selected.id) {
    report = <div style={{ padding: 32, fontSize: 13, color: C.text2 }}>Loading…</div>;
  } else {
    report = <ExecutiveOnePage key={selected.id} project={selected} />;
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: C.bg, fontFamily: F }}>
      {showList && listPane}
      {showReport && (
        <section aria-label="One Page report" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {narrow && (
            <div style={{ padding: '12px 16px 0' }}>
              <Link to="/one-page" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: 'none' }}>
                <ChevronLeft size={16} /> All projects
              </Link>
            </div>
          )}
          {report}
        </section>
      )}
    </div>
  );
}
