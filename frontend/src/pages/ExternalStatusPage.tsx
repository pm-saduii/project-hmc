import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, FileDown, Pencil, Presentation, Search, Send } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { Btn, C } from '../components/Common';
import { FormModal, fieldLabel, hint, input } from '../components/Admin/AdminUi';
import { memberApi } from '../services/api';
import { currentPhase, methodologyApi } from '../services/methodology';
import { statusReportApi, type StatusReport, type StatusReportPatch } from '../services/statusReports';
import { isClosedStatus, isHyperCareStatus } from '../utils/projectHealth';
import {
  PERIOD_RE, computeModel, downloadExternalPptx, loadEngine, periodLabel, periodOf, reportDateOf, shiftPeriod,
} from '../utils/externalStatus';
import type { Member, Project } from '../types';

const F = 'Poppins, sans-serif';
const PAGE_W = 1123;

/**
 * /external-status/:projectId?period=YYYY-MM-1|2 — External Status Report for the customer, every half-month.
 * Same layout as the company sample (Implementation Hub): summary, items for steering, 5-week look-ahead,
 * timeline and key milestones; PDF and editable PowerPoint.
 */
export default function ExternalStatusPage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'pm';
  const current = periodOf(new Date());
  const pParam = params.get('period') || '';
  const period = PERIOD_RE.test(pParam) && pParam <= current ? pParam : current;
  const setPeriod = (p: string) => setParams((x) => { const n = new URLSearchParams(x); n.set('period', p); return n; }, { replace: true });

  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const tasks = useStore((s) => s.tasks);
  const milestones = useStore((s) => s.milestones);
  const issues = useStore((s) => s.issues);
  const risks = useStore((s) => s.risks);
  const snapshots = useStore((s) => s.projectProgressSnapshots);

  const [query, setQuery] = React.useState('');
  const [states, setStates] = React.useState<Record<string, StatusReport>>({});
  const [record, setRecord] = React.useState<StatusReport | null>(null);
  const [log, setLog] = React.useState<StatusReport[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [phaseName, setPhaseName] = React.useState('');
  const [loadedKey, setLoadedKey] = React.useState('');
  const [engineReady, setEngineReady] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [noTable, setNoTable] = React.useState(false);
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [frameH, setFrameH] = React.useState(800);

  const labelOf = (p: Project) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === p.status)?.label || '';
  const q = query.trim().toLowerCase();
  // Finished projects (Hyper Care or closed) are not reported to the customer any more
  const list = projects.filter((p) => !isClosedStatus(p.status, labelOf(p)) && !isHyperCareStatus(p.status, labelOf(p)))
    .filter((p) => !q || `${p.code} ${p.name} ${p.client} ${p.customerAbbreviation}`.toLowerCase().includes(q))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const selected = projects.find((p) => p.id === projectId) || null;

  React.useEffect(() => { void loadEngine().then(() => setEngineReady(true)).catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load the report engine')); }, []);
  React.useEffect(() => {
    if (!projectId && list.length && window.innerWidth >= 900) navigate(`/external-status/${encodeURIComponent(list[0].id)}?period=${period}`, { replace: true });
  }, [projectId, list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStates = React.useCallback(async () => {
    try { setStates(Object.fromEntries((await statusReportApi.listForPeriod(period)).map((r) => [r.projectId, r]))); setNoTable(false); }
    catch (e) { setStates({}); if (/status_reports|schema cache/i.test(e instanceof Error ? e.message : '')) setNoTable(true); }
  }, [period]);
  React.useEffect(() => { void loadStates(); }, [loadStates]);

  // Project data
  React.useEffect(() => {
    if (!selected) return;
    let alive = true;
    const s = useStore.getState();
    if (s.activeProject?.id !== selected.id) s.setActiveProject(selected);
    void Promise.allSettled([
      s.fetchTasks(selected.id), s.fetchMilestones(selected.id), s.fetchIssues(selected.id), s.fetchRisks(selected.id), s.fetchProjectProgressSnapshots(selected.id),
      memberApi.getByProject(selected.id).then((r) => { if (alive) setMembers(r.data); }),
      Promise.all([methodologyApi.load(), methodologyApi.projectState(selected.id)]).then(([m, st]) => {
        if (alive) setPhaseName(currentPhase(m.phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder), st.gates)?.name || labelOf(selected));
      }).catch(() => { if (alive) setPhaseName(labelOf(selected)); }),
      statusReportApi.sentLog(selected.id).then((r) => { if (alive) setLog(r); }).catch(() => undefined),
    ]).then(() => { if (alive) setLoadedKey(selected.id); });
    return () => { alive = false; };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { useStore.getState().setActiveProject(null); }, []);

  React.useEffect(() => {
    if (!selected) return;
    let alive = true;
    statusReportApi.get(selected.id, period).then((r) => { if (alive) setRecord(r); }).catch(() => { if (alive) setRecord(null); });
    return () => { alive = false; };
  }, [selected?.id, period]);

  const ready = !!selected && engineReady && loadedKey === selected.id;
  const rdDate = reportDateOf(period, record);
  const model = React.useMemo(() => {
    if (!ready || !selected || !window.PSR) return null;
    const mine = <T extends { projectId: string }>(xs: T[]) => xs.filter((x) => x.projectId === selected.id);
    return computeModel(window.PSR, { project: selected, period, record, tasks: mine(tasks), milestones: mine(milestones), issues: mine(issues), risks: mine(risks), members, phaseName, snapshots: mine(snapshots) });
  }, [ready, selected, period, record, tasks, milestones, issues, risks, members, phaseName, snapshots]);
  const html = React.useMemo(() => (model && window.PSR ? window.PSR.fullDocument(model, 'external') : ''), [model]);

  // Fit the 1123px report pages to the available width
  const fit = React.useCallback(() => {
    const f = frameRef.current; const box = boxRef.current;
    const doc = f?.contentDocument;
    if (!f || !box || !doc?.body) return;
    const z = Math.min(1, (box.clientWidth - 8) / (PAGE_W + 40));
    (doc.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z);
    setFrameH(Math.ceil(doc.documentElement.scrollHeight) + 8);
  }, []);
  React.useEffect(() => { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [fit]);

  const save = async (patch: StatusReportPatch, ok: string) => {
    if (!selected) return false;
    setBusy(true);
    try {
      const r = await statusReportApi.save(selected.id, period, patch);
      setRecord(r); void loadStates();
      if (patch.sentAt !== undefined) setLog(await statusReportApi.sentLog(selected.id));
      toast.success(ok);
      return true;
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save';
      toast.error(/status_reports|schema cache/i.test(m) ? 'Run the migration 2026-12-06-external-status.sql first.' : m);
      return false;
    } finally { setBusy(false); }
  };

  const printPdf = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    const body = frameRef.current!.contentDocument!.body.style as CSSStyleDeclaration & { zoom: string };
    const z = body.zoom; body.zoom = '1';
    w.focus(); w.print();
    body.zoom = z;
  };
  const pptx = async () => {
    if (!model) return;
    setBusy(true);
    try { await downloadExternalPptx(model); toast.success('PowerPoint downloaded'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the PowerPoint'); }
    finally { setBusy(false); }
  };

  const monthBtn = (dir: -1 | 1) => {
    const blocked = dir > 0 && period >= current;
    return (
      <button type="button" aria-label={dir < 0 ? 'Previous half-month' : 'Next half-month'} disabled={blocked} onClick={() => setPeriod(shiftPeriod(period, dir))}
        style={{ width: 28, height: 28, border: 0, background: 'transparent', color: blocked ? C.border2 : C.text2, cursor: blocked ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}>
        {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: C.bg, fontFamily: F }}>
      <aside aria-label="Projects" style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: C.white, borderRight: `1px solid ${C.border}` }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>External Status</h2>
          <div style={{ fontSize: 11, color: C.text2, marginTop: -6 }}>For the customer · every half-month</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34, padding: '0 4px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            {monthBtn(-1)}<span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{periodLabel(period)}</span>{monthBtn(1)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
            <Search size={14} color={C.text3} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects"
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, fontFamily: F, color: C.text }} />
          </label>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {list.map((p) => {
            const active = p.id === projectId;
            const st = states[p.id];
            return (
              <Link key={p.id} to={`/external-status/${encodeURIComponent(p.id)}?period=${period}`} aria-current={active ? 'page' : undefined}
                style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, textDecoration: 'none', marginBottom: 2, background: active ? C.primaryBg : 'transparent' }}>
                <span style={{ width: 4, borderRadius: 2, background: p.color || C.primary, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? C.primary : C.text }}>{p.code || '—'}{p.customerAbbreviation ? ` (${p.customerAbbreviation})` : ''}</span>
                  <span style={{ display: 'block', fontSize: 11, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 11, marginTop: 2, color: st?.sentAt ? '#047857' : st ? '#B45309' : C.text3 }}>
                    {st?.sentAt ? `Sent ${format(new Date(st.sentAt), 'dd/MM/yyyy')}` : st ? 'Draft' : 'Not started'}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section aria-label="Report" style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {!selected ? <div style={{ padding: 32, fontSize: 13, color: C.text2 }}>Select a project.</div> : (<>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 20px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{selected.code}{selected.customerAbbreviation ? ` (${selected.customerAbbreviation})` : ''} · {periodLabel(period)}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>
                Report date {format(rdDate, 'dd/MM/yyyy')} · {record?.sentAt ? <span style={{ color: '#047857', fontWeight: 600 }}>Sent {format(new Date(record.sentAt), 'dd/MM/yyyy HH:mm')}{record.sentTo ? ` to ${record.sentTo}` : ''}</span> : <span style={{ color: '#B45309' }}>Not sent yet</span>}
              </div>
            </div>
            {canEdit && <Btn small variant="outline" onClick={() => setEditing(true)} disabled={busy || noTable}><Pencil size={13} style={{ marginRight: 6 }} />Edit</Btn>}
            <Btn small variant="ghost" onClick={printPdf} disabled={!html || busy} title="Print or save as PDF (A4 landscape, one page per section)"><FileDown size={14} style={{ marginRight: 6 }} />PDF</Btn>
            <Btn small variant="ghost" onClick={() => void pptx()} disabled={!model || busy} title="Editable PowerPoint"><Presentation size={14} style={{ marginRight: 6 }} />PowerPoint</Btn>
            {canEdit && <Btn small onClick={() => setSending(true)} disabled={busy || noTable}><Send size={13} style={{ marginRight: 6 }} />{record?.sentAt ? 'Sent ✓' : 'Mark as sent'}</Btn>}
          </div>
          {noTable && <div style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>Run the migration 2026-12-06-external-status.sql to save the report text and the report log. The preview below works already.</div>}
          {log.length > 0 && (
            <div style={{ padding: '8px 20px 0', fontSize: 11, color: C.text2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>Report log:</span>
              {log.slice(0, 8).map((r) => (
                <button key={r.period} type="button" onClick={() => setPeriod(r.period)} title={r.sentTo ? `To ${r.sentTo}` : undefined}
                  style={{ border: 0, background: 'transparent', padding: 0, color: C.primary, fontFamily: F, fontSize: 11, cursor: 'pointer' }}>
                  {periodLabel(r.period)} (sent {format(new Date(r.sentAt!), 'dd/MM/yyyy')})
                </button>
              ))}
            </div>
          )}
          <div ref={boxRef} style={{ padding: '12px 20px 24px', flex: 1 }}>
            {!html ? <div style={{ fontSize: 13, color: C.text2 }}>Loading…</div> : (
              <iframe ref={frameRef} title="External status report" srcDoc={html} onLoad={fit}
                style={{ width: '100%', height: frameH, border: 0, display: 'block', borderRadius: 12 }} />
            )}
          </div>
        </>)}
      </section>

      {editing && selected && (
        <EditReport record={record} period={period} busy={busy} onClose={() => setEditing(false)}
          onSave={(patch) => void save(patch, 'Saved').then((ok) => { if (ok) setEditing(false); })} />
      )}
      {sending && selected && (
        <SendModal record={record} busy={busy} onClose={() => setSending(false)}
          onSave={(sentTo, unsend) => void save(unsend ? { sentAt: null, sentBy: null, sentTo: '' } : { sentAt: new Date().toISOString(), sentBy: user?.id || null, sentTo }, unsend ? 'Marked as not sent' : 'Recorded in the report log')
            .then((ok) => { if (ok) setSending(false); })} />
      )}
    </div>
  );
}

const area: React.CSSProperties = { ...input, height: 'auto', padding: '8px 12px', lineHeight: 1.5, resize: 'vertical' };

function EditReport({ record, period, busy, onClose, onSave }: { record: StatusReport | null; period: string; busy: boolean; onClose: () => void; onSave: (p: StatusReportPatch) => void }) {
  const [f, setF] = React.useState<StatusReportPatch>({
    reportDate: record?.reportDate || '', overallStatus: record?.overallStatus || '', rationale: record?.rationale || '',
    accomplishments: record?.accomplishments || '', nextSteps: record?.nextSteps || '',
  });
  const set = (k: keyof StatusReportPatch, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <FormModal title={`External Status · ${periodLabel(period)}`} subtitle="Text the customer sees; numbers come from the project" onClose={onClose} busy={busy} width={720}
      footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...f, reportDate: f.reportDate || null })} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={fieldLabel}>Report date<input type="date" value={f.reportDate || ''} onChange={(e) => set('reportDate', e.target.value)} style={input} />
          <span style={hint}>Empty = end of the half-month (today while it runs).</span></label>
        <label style={fieldLabel}>Overall status
          <select value={f.overallStatus || ''} onChange={(e) => set('overallStatus', e.target.value)} style={{ ...input, padding: '0 10px' }}>
            <option value="">Automatic (from progress vs plan)</option>
            {['On Track', 'At Risk', 'Delayed', 'Completed', 'Not Started'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
      </div>
      <label style={fieldLabel}>Assessment rationale<textarea rows={3} value={f.rationale || ''} onChange={(e) => set('rationale', e.target.value)} style={area} placeholder="2–3 lines: the overall picture and why the status is what it is" /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={fieldLabel}>Key accomplishments<textarea rows={6} value={f.accomplishments || ''} onChange={(e) => set('accomplishments', e.target.value)} style={area} placeholder="One per line" />
          <span style={hint}>Empty = tasks finished in this half-month.</span></label>
        <label style={fieldLabel}>Next steps<textarea rows={6} value={f.nextSteps || ''} onChange={(e) => set('nextSteps', e.target.value)} style={area} placeholder="One per line" />
          <span style={hint}>Empty = tasks due in the next half-month.</span></label>
      </div>
      <div style={hint}>Issues and risks come from the Issues and Risks tabs (mark them Internal to keep them off this report; set Steering to Decision or Acknowledge for "Items for Steering"). Key milestones come from the Milestones tab.</div>
    </FormModal>
  );
}

function SendModal({ record, busy, onClose, onSave }: { record: StatusReport | null; busy: boolean; onClose: () => void; onSave: (sentTo: string, unsend?: boolean) => void }) {
  const [to, setTo] = React.useState(record?.sentTo || '');
  return (
    <FormModal title="Report log" subtitle="Record that this report was sent to the customer" onClose={onClose} busy={busy} width={480}
      footer={<>{record?.sentAt && <Btn variant="ghost" onClick={() => onSave('', true)} disabled={busy}>Mark as not sent</Btn>}
        <span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn onClick={() => onSave(to.trim())} disabled={busy}>{busy ? 'Saving…' : 'Mark as sent'}</Btn></>}>
      <label style={fieldLabel}>Sent to<input value={to} onChange={(e) => setTo(e.target.value)} style={input} placeholder="e.g. Khun Wanida (Payroll Supervisor)" /></label>
      <div style={hint}>The date and your name are recorded. Download the PDF or PowerPoint above to attach to the e-mail.</div>
    </FormModal>
  );
}
