import React from 'react';
import toast from 'react-hot-toast';
import { differenceInCalendarDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { Btn, C } from '../components/Common';
import { AdminHeader, F, FormModal, Pill, SearchBox, panel, td, th } from '../components/Admin/AdminUi';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store';
import { effortApi, memberApi, taskApi } from '../services/api';
import { BUDGET_STATUS, budgetReportApi, type BudgetReport, type BudgetStatus } from '../services/budgetReports';
import {
  buildBudgetSnapshot, defaultPeriod, dueDateOf, exportBudgetPdf, exportBudgetPdfs, exportBudgetXlsx, type BudgetPdfArgs, periodLabel, shiftPeriod, usedToDate, type BudgetSnapshot,
} from '../utils/budgetControl';
import { isClosedStatus, isHyperCareStatus, projectHealth } from '../utils/projectHealth';
import type { Effort, Member, Project, Task } from '../types';

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
const when = (v: string | null) => (v ? format(new Date(v), 'dd/MM/yyyy') : '');

interface Row { project: Project; report: BudgetReport | null; snap: BudgetSnapshot; pmName: string; pm: Member | null; advisorName: string; frozen: boolean; finished: boolean }

/** /budget — the monthly Budget Control report: PM prepares, Account Manager reviews, Director approves (due by the 5th). */
export default function BudgetControlPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const thisMonth = format(new Date(), 'yyyy-MM');
  const [period, setPeriod] = React.useState(defaultPeriod());
  const [efforts, setEfforts] = React.useState<Effort[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [reports, setReports] = React.useState<BudgetReport[]>([]);
  const [reportsPeriod, setReportsPeriod] = React.useState('');
  const autoAdvanced = React.useRef(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [openId, setOpenId] = React.useState('');
  // Finished projects (Hyper Care, closed, or 100% complete) are hidden unless asked for.
  const [showFinished, setShowFinished] = React.useState(false);
  // Projects ticked for "Print selected" (one PDF, one project per page)
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [printing, setPrinting] = React.useState(false);

  const loadReports = React.useCallback(async () => {
    try { setReports(await budgetReportApi.listForPeriod(period)); setReportsPeriod(period); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load reports'); }
  }, [period]);
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([
      effortApi.getByProject().then((r) => r.data).catch(() => [] as Effort[]),
      taskApi.getByProject().then((r) => r.data).catch(() => [] as Task[]),
      memberApi.getByProject().then((r) => r.data).catch(() => [] as Member[]),
    ]).then(([e, t, m]) => { if (alive) { setEfforts(e); setTasks(t); setMembers(m); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => { void loadReports(); }, [loadReports]);

  const statusLabel = (p: Project) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === p.status)?.label || '';
  const pmMemberOf = (p: Project) => members.find((m) => m.projectId === p.id && /project manager/i.test(m.role) && m.type !== 'client') || null;
  const pmOf = (p: Project) => pmMemberOf(p)?.name || '';
  const advisorOf = (p: Project) => members.find((m) => m.projectId === p.id && /project advisor/i.test(m.role) && m.type !== 'client')?.name || '';

  const allRows: Row[] = projects
    .map((project) => {
      const report = reports.find((r) => r.projectId === project.id) || null;
      const frozen = !!report?.snapshot && report.status !== 'draft' && report.status !== 'returned';
      const actual = projectHealth(tasks.filter((t) => t.projectId === project.id)).actual;
      const snap = frozen ? report!.snapshot! : buildBudgetSnapshot(project, efforts.filter((e) => e.projectId === project.id), period, actual);
      const label = statusLabel(project);
      const finished = isClosedStatus(project.status, label) || isHyperCareStatus(project.status, label) || actual >= 100;
      return { project, report, snap, pmName: report?.preparedName || pmOf(project), pm: pmMemberOf(project), advisorName: advisorOf(project), frozen, finished };
    })
    .filter((r) => r.snap.budget > 0 || r.report);
  const finishedCount = allRows.filter((r) => r.finished).length;
  // On first load: when every running project's report for last month is already approved, open the next month.
  React.useEffect(() => {
    if (autoAdvanced.current || loading || reportsPeriod !== period || period !== defaultPeriod()) return;
    autoAdvanced.current = true;
    const active = allRows.filter((r) => !r.finished);
    const next = shiftPeriod(period, 1);
    if (active.length && active.every((r) => r.report?.status === 'approved') && next <= thisMonth) setPeriod(next);
  });
  const rows = allRows
    .filter((r) => showFinished || !r.finished)
    .filter((r) => !search.trim() || `${r.project.code} ${r.project.name} ${r.project.customerAbbreviation} ${r.pmName}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => String(a.project.code).localeCompare(String(b.project.code)));

  const due = dueDateOf(period);
  const daysToDue = differenceInCalendarDays(due, new Date());
  const statusOf = (r: Row): BudgetStatus | 'none' => r.report?.status || 'none';
  const counts = rows.reduce<Record<string, number>>((acc, r) => { const s = statusOf(r); acc[s] = (acc[s] || 0) + 1; return acc; }, {});
  const waitingOnMe = (r: Row) => (role === 'pm' && ['none', 'draft', 'returned'].includes(statusOf(r)))
    || (role === 'am' && statusOf(r) === 'submitted') || (role === 'director' && statusOf(r) === 'reviewed');
  const open = rows.find((r) => r.project.id === openId) || null;
  const pickedRows = rows.filter((r) => picked.has(r.project.id));
  const allPicked = rows.length > 0 && pickedRows.length === rows.length;
  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const printSelected = async () => {
    if (!pickedRows.length) return;
    setPrinting(true);
    try { await exportBudgetPdfs(pickedRows.map(pdfArgsOf)); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'PDF export failed'); }
    finally { setPrinting(false); }
  };

  const noTable = /relation|schema cache/i.test(error);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
      <AdminHeader title="Budget Control" description="Man-day budget against man-days used, reported every month by the 5th: the PM prepares, the Account Manager reviews and a Director approves." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36, padding: '0 4px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white }}>
          <button type="button" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))} style={navBtn(false)}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 120, textAlign: 'center' }}>{periodLabel(period)}</span>
          <button type="button" aria-label="Next month" disabled={period >= thisMonth} onClick={() => setPeriod(shiftPeriod(period, 1))} style={navBtn(period >= thisMonth)}><ChevronRight size={16} /></button>
        </div>
        <span style={{ fontSize: 13, color: daysToDue < 0 ? '#B91C1C' : C.text2 }}>
          Due {format(due, 'dd/MM/yyyy')} · {daysToDue > 0 ? `in ${daysToDue} day${daysToDue > 1 ? 's' : ''}` : daysToDue === 0 ? 'today' : `${-daysToDue} day${daysToDue < -1 ? 's' : ''} overdue`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['none', 'draft', 'returned', 'submitted', 'reviewed', 'approved'] as const).filter((s) => counts[s]).map((s) => (
            <Pill key={s} bg={BUDGET_STATUS[s].bg} fg={BUDGET_STATUS[s].fg}>{BUDGET_STATUS[s].label} · {counts[s]}</Pill>
          ))}
        </span>
      </div>

      {noTable ? (
        <div style={{ ...panel, padding: 18, fontSize: 13, color: C.red }}>Budget Control is not set up yet: run the migration 2026-11-27-methodology-and-budget-control.sql.</div>
      ) : (
        <section style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Search project or PM" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2, cursor: 'pointer' }}>
              <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} style={{ accentColor: C.primary }} />
              Show finished projects{finishedCount ? ` (${finishedCount})` : ''}
            </label>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {pickedRows.length > 0 && <button type="button" onClick={() => setPicked(new Set())} style={{ border: 0, background: 'transparent', color: C.text2, fontSize: 13, cursor: 'pointer', padding: 0 }}>Clear</button>}
              <Btn small onClick={() => void printSelected()} disabled={!pickedRows.length || printing}>
                <FileText size={14} style={{ marginRight: 6 }} />{printing ? 'Creating PDF…' : `Print selected${pickedRows.length ? ` (${pickedRows.length})` : ''}`}
              </Btn>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>
                    <input type="checkbox" aria-label="Select all projects" checked={allPicked} disabled={!rows.length}
                      ref={(el) => { if (el) el.indeterminate = pickedRows.length > 0 && !allPicked; }}
                      onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.project.id)))} style={{ accentColor: C.primary }} />
                  </th>
                  <th style={th}>Project</th><th style={th}>PM</th><th style={{ ...th, textAlign: 'right' }}>Budget (MD)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Used in month</th><th style={{ ...th, textAlign: 'right' }}>Used to date</th>
                  <th style={th}>Used vs progress</th><th style={th}>Status</th><th style={{ ...th, width: 90 }}><span style={{ position: 'absolute', left: -9999 }}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9} style={{ ...td, color: C.text2 }}>Loading…</td></tr>
                  : rows.length === 0 ? <tr><td colSpan={9} style={{ ...td, color: C.text2 }}>No projects with a man-day budget. Set budgets in each project's Plan › Effort.</td></tr>
                    : rows.map((r) => {
                      const pct = r.snap.budget ? Math.round((r.snap.usedToDate / r.snap.budget) * 100) : 0;
                      const over = pct - r.snap.progress;
                      const s = BUDGET_STATUS[statusOf(r)];
                      const late = daysToDue < 0 && ['none', 'draft', 'returned'].includes(statusOf(r));
                      return (
                        <tr key={r.project.id} onClick={() => setOpenId(r.project.id)} style={{ cursor: 'pointer', background: picked.has(r.project.id) ? C.primaryBg : waitingOnMe(r) ? '#FFFBEB' : undefined }}>
                          <td style={td} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${r.project.code}`} checked={picked.has(r.project.id)} onChange={() => toggle(r.project.id)} style={{ accentColor: C.primary }} />
                          </td>
                          <td style={td}>
                            <div style={{ fontWeight: 600 }}>{r.project.code}{r.project.customerAbbreviation ? ` (${r.project.customerAbbreviation})` : ''}</div>
                            <div style={{ fontSize: 11, color: C.text2 }}>{r.project.name}{r.finished && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: C.text2, background: C.bg2, padding: '0 6px', borderRadius: 999 }}>Finished</span>}</div>
                          </td>
                          <td style={{ ...td, color: C.text2 }}>{r.pmName || '—'}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmt(r.snap.budget)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmt(r.snap.usedInMonth)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmt(r.snap.usedToDate)}</td>
                          <td style={td}>
                            <div style={{ fontSize: 13, color: over > 15 ? '#B91C1C' : over > 5 ? '#B45309' : C.text }}>{pct}% used · {r.snap.progress}% done</div>
                            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: C.bg2, marginTop: 4, maxWidth: 180 }}>
                              <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 3, background: over > 15 ? C.red : over > 5 ? C.amber : C.primary }} />
                              <div title="Progress" style={{ position: 'absolute', top: -2, bottom: -2, width: 2, background: C.text, left: `calc(${Math.min(100, r.snap.progress)}% - 1px)` }} />
                            </div>
                          </td>
                          <td style={td}>
                            <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>
                            {late && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>Overdue</div>}
                            {waitingOnMe(r) && <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Waiting for you</div>}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}><Btn small variant="outline" onClick={() => setOpenId(r.project.id)}>Open</Btn></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {open && <ReportModal row={open} period={period} role={role} onClose={() => setOpenId('')} onChanged={() => void loadReports()} />}
    </div>
  );
}

/** PDF data for one row: PM (and signature) and Project Advisor come from Members. */
const pdfArgsOf = (r: Row): BudgetPdfArgs => ({
  snapshot: r.snap, project: r.project, pmName: r.pm?.name || r.pmName, status: BUDGET_STATUS[r.report?.status || 'none'].label,
  preparedAt: r.report?.preparedAt || null, pmSignature: r.pm?.signature || '', advisorName: r.advisorName,
});

const navBtn = (disabled: boolean): React.CSSProperties => ({ width: 28, height: 28, border: 0, background: 'transparent', color: disabled ? C.border2 : C.text2, cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center' });

function ReportModal({ row, period, role, onClose, onChanged }: { row: Row; period: string; role: string; onClose: () => void; onChanged: () => void }) {
  const { project, report, snap, pmName } = row;
  const status: BudgetStatus | 'none' = report?.status || 'none';
  const isAdmin = role === 'admin';
  const [comment, setComment] = React.useState(report?.comment || '');
  const [returning, setReturning] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const canSubmit = (isAdmin || role === 'pm') && ['none', 'draft', 'returned'].includes(status);
  const canReview = (isAdmin || role === 'am') && status === 'submitted';
  const canApprove = (isAdmin || role === 'director') && status === 'reviewed';
  const canReturn = (isAdmin || role === 'am' || role === 'director') && (status === 'submitted' || status === 'reviewed') && !(role === 'am' && status === 'reviewed');
  const canReopen = isAdmin && status !== 'none' && status !== 'draft';

  const act = async (next: BudgetStatus, extra: Parameters<typeof budgetReportApi.transition>[3] = {}, ok = 'Saved') => {
    setBusy(true);
    try {
      await budgetReportApi.transition(project.id, period, next, extra);
      toast.success(ok);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the report');
    } finally { setBusy(false); }
  };

  const doExport = async () => {
    try {
      const { skipped } = await exportBudgetXlsx({ snapshot: snap, project, pmName, reviewedName: report?.reviewedName || '', approvedName: report?.approvedName || '' });
      if (skipped.length) toast(`Not in the template, so not exported: ${skipped.join(', ')}`, { duration: 6000 });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); }
  };

  const doPdf = async () => {
    try {
      await exportBudgetPdf(pdfArgsOf(row));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF export failed'); }
  };

  const months = snap.months.filter((m) => m <= period);
  const cell: React.CSSProperties = { ...td, padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...th, padding: '8px 10px', textAlign: 'right' };
  const steps: { label: string; name: string; at: string | null; done: boolean }[] = [
    { label: 'Prepared by (PM)', name: report?.preparedName || '', at: report?.preparedAt || null, done: ['submitted', 'reviewed', 'approved'].includes(status) },
    { label: 'Reviewed by (Account Manager)', name: report?.reviewedName || '', at: report?.reviewedAt || null, done: ['reviewed', 'approved'].includes(status) },
    { label: 'Approved by (Director)', name: report?.approvedName || '', at: report?.approvedAt || null, done: status === 'approved' },
  ];
  const s = BUDGET_STATUS[status];

  return (
    <FormModal title={`Budget Control · ${periodLabel(period)}`} subtitle={`${project.code}${project.customerAbbreviation ? ` (${project.customerAbbreviation})` : ''} · ${project.name}`} onClose={onClose} busy={busy} width={1100}
      footer={<>
        <Btn onClick={() => void doPdf()} disabled={busy}><FileText size={14} style={{ marginRight: 6 }} />Export PDF</Btn>
        <Btn variant="ghost" onClick={() => void doExport()} disabled={busy} title="The company Excel template"><FileSpreadsheet size={14} style={{ marginRight: 6 }} />Excel</Btn>
        {canReopen && <Btn variant="ghost" onClick={() => void act('draft', {}, 'Reopened as draft')} disabled={busy}>Reopen</Btn>}
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
        {canReturn && <Btn variant="outline" onClick={() => setReturning(true)} disabled={busy} style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}>Return</Btn>}
        {canSubmit && <Btn onClick={() => void act('submitted', { snapshot: buildFresh(), comment }, 'Submitted for review')} disabled={busy || !snap.budget}>Submit</Btn>}
        {canReview && <Btn onClick={() => void act('reviewed', {}, 'Reviewed')} disabled={busy}>Mark reviewed</Btn>}
        {canApprove && <Btn onClick={() => void act('approved', {}, 'Approved')} disabled={busy}>Approve</Btn>}
      </>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>
        <span style={{ fontSize: 13, color: C.text2 }}>PM: {pmName || '—'} · Due {format(dueDateOf(period), 'dd/MM/yyyy')}</span>
        <span style={{ fontSize: 11, color: C.text3, marginLeft: 'auto' }}>{row.frozen ? `Figures frozen when submitted (${when(report?.preparedAt || null)})` : 'Live figures from Plan › Effort'}</span>
      </div>

      {status === 'returned' && report?.returnReason && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#991B1B' }}>
          Returned by {report.returnedName || '—'} on {when(report.returnedAt)}: {report.returnReason}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          ['Budget', `${fmt(snap.budget)} MD`],
          ['Used in month', `${fmt(snap.usedInMonth)} MD`],
          ['Used to date', `${fmt(snap.usedToDate)} MD`],
          ['Remaining', `${fmt(snap.budget - snap.usedToDate)} MD`],
          ['Used / progress', `${snap.budget ? Math.round((snap.usedToDate / snap.budget) * 100) : 0}% / ${snap.progress}%`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: C.bg }}>
            <div style={{ fontSize: 11, color: C.text2 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 + months.length * 64 }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Activity</th><th style={head}>Budget</th>
              {months.map((m) => <th key={m} style={{ ...head, color: m === period ? '#4338CA' : C.text2 }}>{format(new Date(`${m}-01T00:00:00`), 'MMM yy')}</th>)}
              <th style={head}>Used</th><th style={head}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {snap.lines.map((l, i) => {
              const used = usedToDate(l);
              return (
                <tr key={`${l.module}-${i}`}>
                  <td style={{ ...cell, textAlign: 'left', whiteSpace: 'normal' }}>{l.module}{!l.code && <span style={{ fontSize: 11, color: '#B45309' }}> · not a template line</span>}</td>
                  <td style={cell}>{fmt(l.budget)}</td>
                  {months.map((m) => <td key={m} style={{ ...cell, color: l.used[m] ? C.text : C.text3, background: m === period ? '#F5F7FF' : undefined }}>{l.used[m] ? fmt(l.used[m]) : '–'}</td>)}
                  <td style={{ ...cell, fontWeight: 600 }}>{fmt(used)}</td>
                  <td style={{ ...cell, color: l.budget - used < 0 ? '#B91C1C' : C.text }}>{fmt(l.budget - used)}</td>
                </tr>
              );
            })}
            <tr>
              <td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>Total</td>
              <td style={{ ...cell, fontWeight: 700 }}>{fmt(snap.budget)}</td>
              {months.map((m) => <td key={m} style={{ ...cell, fontWeight: 700 }}>{fmt(snap.lines.reduce((a, l) => a + (l.used[m] || 0), 0))}</td>)}
              <td style={{ ...cell, fontWeight: 700 }}>{fmt(snap.usedToDate)}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{fmt(snap.budget - snap.usedToDate)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {steps.map((st) => (
          <div key={st.label} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${st.done ? '#A7F3D0' : C.border}`, background: st.done ? '#F0FDF4' : C.white }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{st.label.toUpperCase()}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: st.done ? '#047857' : C.text3 }}>{st.done ? st.name || '—' : 'Pending'}</div>
            {st.done && <div style={{ fontSize: 11, color: C.text2 }}>{when(st.at)}</div>}
          </div>
        ))}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: C.text }}>
        Comment from the PM
        <textarea rows={2} value={comment} disabled={!canSubmit} onChange={(e) => setComment(e.target.value)} placeholder={canSubmit ? 'Explain any overrun or change (optional)' : ''}
          style={{ fontFamily: F, fontSize: 13, padding: '8px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, resize: 'vertical', background: canSubmit ? C.white : C.bg, color: C.text }} />
      </label>

      {returning && (
        <div style={{ padding: 12, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#991B1B' }}>
            Reason for returning
            <textarea rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} style={{ fontFamily: F, fontSize: 13, padding: '8px 12px', border: '1.5px solid #FCA5A5', borderRadius: 10 }} />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" small onClick={() => setReturning(false)} disabled={busy}>Cancel</Btn>
            <Btn variant="danger" small disabled={busy || !reason.trim()} onClick={() => void act('returned', { returnReason: reason.trim() }, 'Returned to the PM')}>Return to PM</Btn>
          </div>
        </div>
      )}
    </FormModal>
  );

  // Submitting freezes the figures as they are right now.
  function buildFresh(): BudgetSnapshot {
    return row.frozen ? snap : { ...snap, takenAt: new Date().toISOString() };
  }
}
