import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { monthlyReportApi } from '../services/api';
import { Btn, C, Modal } from '../components/Common';
import MonthlyReportView, { STATUS_LOOK, effectiveStatus } from '../components/OnePage/MonthlyReportView';
import MonthlyReportEditor, { draftFrom, type ReportDraft } from '../components/OnePage/MonthlyReportEditor';
import { isClosedStatus, isHyperCareStatus } from '../utils/projectHealth';
import { REPORT_DATA_VERSION, buildMonthlyReport, periodLabel, shiftPeriod, type MonthlyReportData } from '../utils/monthlyReport';
import type { MonthlyReport, Project, ReportStatus } from '../types';

const F = 'Poppins, sans-serif';
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  React.useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

function ConfirmBox({ title, message, confirmLabel, busy, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={busy ? () => undefined : onCancel} width={440}>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Btn>
        <Btn onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

/**
 * /one-page/:projectId?month=YYYY-MM — Monthly Executive Report.
 * Left: month and running projects (with each one's report state). Right: the report.
 * A draft shows live numbers; a published month shows the numbers frozen when it was published.
 */
export default function OnePagePage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const narrow = useIsNarrow();
  const { user, profile } = useAuth();
  const permissions = useRolePermissions();
  const canEdit = profile?.role === 'admin' || profile?.role === 'pm';
  const showAmounts = permissions.getMaskedAmount(1) !== 0;

  const thisMonth = format(new Date(), 'yyyy-MM');
  const monthParam = params.get('month') || '';
  const period = PERIOD_RE.test(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;
  const setPeriod = (next: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('month', next); return n; }, { replace: true });
  const audience: 'internal' | 'external' = params.get('view') === 'external' ? 'external' : 'internal';
  const setAudience = (v: 'internal' | 'external') => setParams((p) => { const n = new URLSearchParams(p); if (v === 'external') n.set('view', 'external'); else n.delete('view'); return n; }, { replace: true });
  const withMonth = (path: string) => `${path}?month=${period}${audience === 'external' ? '&view=external' : ''}`;

  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const activeProject = useStore((s) => s.activeProject);
  const tasks = useStore((s) => s.tasks);
  const milestones = useStore((s) => s.milestones);
  const issues = useStore((s) => s.issues);
  const risks = useStore((s) => s.risks);
  const efforts = useStore((s) => s.efforts);
  const changeRequests = useStore((s) => s.changeRequests);
  const progressSnapshots = useStore((s) => s.projectProgressSnapshots);

  const [query, setQuery] = React.useState('');
  const [states, setStates] = React.useState<Record<string, { state: string; overall: ReportStatus | null }>>({});
  const [record, setRecord] = React.useState<MonthlyReport | null>(null);
  const [previous, setPrevious] = React.useState<MonthlyReport | null>(null);
  const [recordKey, setRecordKey] = React.useState('');
  const [publishedPeriods, setPublishedPeriods] = React.useState<string[]>([]);
  const [loadedKey, setLoadedKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | 'publish' | 'unpublish'>(null);

  const statusOf = (p: Project) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === p.status);
  const isRunning = (p: Project) => {
    const label = statusOf(p)?.label || '';
    return !isHyperCareStatus(p.status, label) && !isClosedStatus(p.status, label);
  };
  const q = query.trim().toLowerCase();
  const list = [...projects]
    .filter(isRunning)
    .filter((p) => !q || `${p.code} ${p.name} ${p.client} ${p.customerAbbreviation}`.toLowerCase().includes(q))
    .sort((a, b) => (statusOf(a)?.sortOrder ?? 999) - (statusOf(b)?.sortOrder ?? 999) || String(a.code).localeCompare(String(b.code)));
  const selected = projects.find((p) => p.id === projectId) || null;

  // Report state of every project for the month (list badges).
  const loadStates = React.useCallback(async () => {
    try {
      const rows = await monthlyReportApi.listForPeriod(period);
      setStates(Object.fromEntries(rows.map((r) => [r.projectId, { state: r.state, overall: r.overallStatus }])));
    } catch { setStates({}); }
  }, [period]);
  React.useEffect(() => { void loadStates(); }, [loadStates]);

  // Open the first project when none is chosen (desktop only; phones start on the list).
  React.useEffect(() => {
    if (!projectId && !narrow && list.length) navigate(withMonth(`/one-page/${encodeURIComponent(list[0].id)}`), { replace: true });
  }, [projectId, narrow, list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Project data for the live report (the store holds one active project at a time).
  React.useEffect(() => {
    if (!selected) return;
    let alive = true;
    const store = useStore.getState();
    if (store.activeProject?.id !== selected.id) store.setActiveProject(selected);
    const s = useStore.getState();
    void Promise.allSettled([
      s.fetchTasks(selected.id), s.fetchMilestones(selected.id), s.fetchEfforts(selected.id),
      s.fetchCRs(selected.id), s.fetchIssues(selected.id), s.fetchRisks(selected.id),
      s.fetchProjectProgressSnapshots(selected.id),
    ]).then(() => { if (alive) setLoadedKey(selected.id); });
    return () => { alive = false; };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The month's report row, last month's (for comparisons) and the published months.
  const key = selected ? `${selected.id}|${period}` : '';
  React.useEffect(() => {
    if (!selected) return;
    let alive = true;
    void Promise.all([
      monthlyReportApi.get(selected.id, period),
      monthlyReportApi.get(selected.id, shiftPeriod(period, -1)),
      monthlyReportApi.publishedPeriods(selected.id),
    ]).then(([cur, prev, periods]) => {
      if (!alive) return;
      setRecord(cur); setPrevious(prev); setPublishedPeriods(periods); setRecordKey(`${selected.id}|${period}`);
    }).catch((error) => {
      if (!alive) return;
      const message = error instanceof Error ? error.message : 'Unable to load the monthly report';
      // Until the monthly_reports migration is run, show the live report without an error popup.
      if (!/monthly_reports|schema cache/i.test(message)) toast.error(message);
      setRecord(null); setPrevious(null); setRecordKey(`${selected.id}|${period}`);
    });
    return () => { alive = false; };
  }, [selected?.id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => { useStore.getState().setActiveProject(null); }, []);

  const recordReady = recordKey === key;
  const frozen = recordReady && record?.state === 'published' && record.snapshot && (record.snapshot as MonthlyReportData).version === REPORT_DATA_VERSION
    ? record.snapshot as MonthlyReportData : null;
  const previousData = recordReady && previous?.state === 'published' ? (previous.snapshot as MonthlyReportData | null) : null;
  const ready = !!selected && recordReady && activeProject?.id === selected.id && loadedKey === selected.id;
  const live = React.useMemo(() => {
    if (!selected || !ready) return null;
    return buildMonthlyReport({
      project: selected, projectStatusLabel: statusOf(selected)?.label || selected.status, period,
      tasks: tasks.filter((t) => t.projectId === selected.id),
      milestones: milestones.filter((m) => m.projectId === selected.id),
      issues: issues.filter((i) => i.projectId === selected.id),
      risks: risks.filter((r) => r.projectId === selected.id),
      efforts: efforts.filter((e) => e.projectId === selected.id),
      changeRequests: changeRequests.filter((c) => c.projectId === selected.id),
      progressSnapshots: progressSnapshots.filter((p) => p.projectId === selected.id),
      previous: previousData,
    });
  }, [selected, ready, period, tasks, milestones, issues, risks, efforts, changeRequests, progressSnapshots, previousData, masterCodes]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = frozen || (recordReady ? live : null);

  const afterChange = (saved: MonthlyReport) => {
    setRecord(saved);
    void loadStates();
    if (selected) void monthlyReportApi.publishedPeriods(selected.id).then(setPublishedPeriods).catch(() => undefined);
  };

  /** Leave out the external fields while they are empty and the database has no columns for them yet. */
  const cleanDraft = (draft: ReportDraft): Partial<ReportDraft> => {
    const hasColumns = !record || 'externalSummary' in record;
    if (hasColumns || draft.externalSummary.trim() || draft.clientActions.trim()) return draft;
    const { externalSummary, clientActions, ...rest } = draft;
    void externalSummary; void clientActions;
    return rest;
  };
  const reportError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    toast.error(/external_summary|client_actions/i.test(message) ? 'Run the migration 2026-12-05-external-report-and-baseline-fix.sql to save the external report.' : message);
  };

  const saveDraft = async (draft: ReportDraft) => {
    if (!selected) return;
    setBusy(true);
    try {
      afterChange(await monthlyReportApi.saveDraft(selected.id, period, cleanDraft(draft)));
      toast.success('Draft saved');
      setEditing(false);
    } catch (error) {
      reportError(error, 'Unable to save the draft');
    } finally { setBusy(false); }
  };

  const publish = async (draft: ReportDraft) => {
    if (!selected || !live) return;
    setBusy(true);
    try {
      // Store the statuses as shown, so the frozen report and the list badge agree.
      const pick = (v: ReportStatus | null, s: ReportStatus) => v ?? s;
      const patch: Partial<ReportDraft> = {
        ...cleanDraft(draft),
        overallStatus: pick(draft.overallStatus, live.suggested.overall),
        scheduleStatus: pick(draft.scheduleStatus, live.suggested.schedule),
        budgetStatus: pick(draft.budgetStatus, live.suggested.budget),
        scopeStatus: pick(draft.scopeStatus, live.suggested.scope),
        paymentStatus: pick(draft.paymentStatus, live.suggested.payment),
      };
      afterChange(await monthlyReportApi.publish(selected.id, period, patch, live, user?.id || null));
      toast.success(`${periodLabel(period)} report published`);
      setEditing(false);
    } catch (error) {
      reportError(error, 'Unable to publish');
    } finally { setBusy(false); setConfirm(null); }
  };

  const unpublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      afterChange(await monthlyReportApi.unpublish(selected.id, period));
      toast.success('Back to draft');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to unpublish');
    } finally { setBusy(false); setConfirm(null); }
  };

  const showList = !narrow || !projectId;
  const showReport = !narrow || !!projectId;
  const stateCounts = list.reduce((acc, p) => {
    const st = states[p.id]?.state;
    acc[st === 'published' ? 'published' : st === 'draft' ? 'draft' : 'none'] += 1;
    return acc;
  }, { published: 0, draft: 0, none: 0 });

  const monthButton = (dir: -1 | 1) => {
    const blocked = dir > 0 && period >= thisMonth; // no reports for future months
    return (
      <button type="button" aria-label={dir < 0 ? 'Previous month' : 'Next month'} disabled={blocked} onClick={() => setPeriod(shiftPeriod(period, dir))}
        style={{ width: 28, height: 28, border: 0, background: 'transparent', color: blocked ? C.border2 : C.text2, cursor: blocked ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}>
        {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    );
  };

  const listPane = (
    <aside aria-label="Projects" style={{ width: narrow ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: C.white, borderRight: narrow ? 0 : `1px solid ${C.border}` }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>One Page</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34, padding: '0 4px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {monthButton(-1)}
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{periodLabel(period)}</span>
          {monthButton(1)}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
          <Search size={14} color={C.text3} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, fontFamily: F, color: C.text }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: C.text2 }}>
          <span>{list.length} projects</span>
          <span style={{ color: '#047857' }}>{stateCounts.published} published</span>
          <span style={{ color: '#B45309' }}>{stateCounts.draft} draft</span>
          <span>{stateCounts.none} not started</span>
        </div>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {list.length === 0 && <div style={{ padding: 12, fontSize: 13, color: C.text2 }}>No running projects found.</div>}
        {list.map((p) => {
          const active = p.id === projectId;
          const st = states[p.id];
          const overall = st?.overall ? STATUS_LOOK[st.overall] : null;
          return (
            <Link key={p.id} to={withMonth(`/one-page/${encodeURIComponent(p.id)}`)} aria-current={active ? 'page' : undefined}
              style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, textDecoration: 'none', marginBottom: 2, background: active ? C.primaryBg : 'transparent' }}>
              <span style={{ width: 4, borderRadius: 2, background: p.color || C.primary, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? C.primary : C.text }}>
                  {p.code || '—'}{p.customerAbbreviation ? ` (${p.customerAbbreviation})` : ''}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {overall && st?.state === 'published' && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '0 8px', borderRadius: 999, background: overall.bg, color: overall.fg }}>{overall.label}</span>
                  )}
                  <span style={{ fontSize: 11, color: st?.state === 'published' ? '#047857' : st?.state === 'draft' ? '#B45309' : C.text3 }}>
                    {st?.state === 'published' ? 'Published' : st?.state === 'draft' ? 'Draft' : 'Not started'}
                  </span>
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
  } else if (!data) {
    report = <div style={{ padding: 32, fontSize: 13, color: C.text2 }}>Loading…</div>;
  } else {
    report = (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '16px 24px 0' }}>
        <div role="group" aria-label="Report version" style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.white }}>
          {([['internal', 'Internal'], ['external', 'External (customer)']] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={audience === key} onClick={() => setAudience(key)}
              style={{ height: 32, padding: '0 14px', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 13, fontWeight: 600,
                background: audience === key ? C.primary : C.white, color: audience === key ? '#fff' : C.text2 }}>{label}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: C.text3 }}>
          {audience === 'external' ? 'For the customer: no man-days, amounts, billing or internal decisions.' : 'For management: includes man-days, payment and decisions.'}
        </span>
      </div>
      <MonthlyReportView
        audience={audience}
        logo={selected.logo}
        data={data}
        record={record}
        showAmounts={showAmounts}
        canEdit={canEdit}
        busy={busy}
        publishedPeriods={publishedPeriods}
        onEdit={() => setEditing(true)}
        onPublish={() => (record?.summary?.trim() ? setConfirm('publish') : setEditing(true))}
        onUnpublish={() => setConfirm('unpublish')}
        onOpenPeriod={setPeriod}
      />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: C.bg, fontFamily: F }}>
      {showList && listPane}
      {showReport && (
        <section aria-label="Monthly report" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {narrow && (
            <div style={{ padding: '12px 16px 0' }}>
              <Link to={withMonth('/one-page')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: 'none' }}>
                <ChevronLeft size={16} /> All projects
              </Link>
            </div>
          )}
          {report}
        </section>
      )}

      {editing && live && (
        <MonthlyReportEditor
          data={live}
          record={record}
          previousSummary={previous?.summary || ''}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={(d) => { void saveDraft(d); }}
          onPublish={(d) => { void publish(d); }}
        />
      )}
      {confirm === 'publish' && live && (
        <ConfirmBox
          title={`Publish ${periodLabel(period)}`}
          message={`The report's numbers, lists and text will be frozen as they are now. Overall status: ${STATUS_LOOK[effectiveStatus(record, live, 'overall')].label}.`}
          confirmLabel="Publish"
          busy={busy}
          onConfirm={() => { void publish(draftFrom(record)); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'unpublish' && (
        <ConfirmBox
          title={`Unpublish ${periodLabel(period)}`}
          message="The report goes back to draft and shows live numbers again. The summary, decisions and statuses are kept."
          confirmLabel="Unpublish"
          busy={busy}
          onConfirm={() => { void unpublish(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
