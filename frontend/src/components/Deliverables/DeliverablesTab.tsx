import React from 'react';
import toast from 'react-hot-toast';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDot, ExternalLink, FileBarChart, FileDown, FileText, LayoutGrid, List, Lock, PenLine, Presentation, Repeat, Timer, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormModal } from '../Admin/AdminUi';
import { projectPath } from '../../utils/projectRoutes';
import SignoffFormModal from '../Documents/SignoffFormModal';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import type { SignoffForm } from '../../utils/companyDocs';
import { Btn, C, Input, Modal } from '../Common';
import { fmtDate } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import {
  OWNER_INFO, STATUS_INFO, currentPhase, isComplete, methodologyApi, statusesFor,
  type DeliverableStatus, type MethodDeliverable, type Methodology, type Owner, type PhaseGate, type ProjectDeliverable,
} from '../../services/methodology';

const F = 'Poppins, sans-serif';
const today = () => new Date().toISOString().slice(0, 10);

/** Project › Methodology: the company methodology as a board (phases → steps → deliverables → gate), quick tools, and a list view. */
export default function DeliverablesTab({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
  const permissions = useRolePermissions();
  const canWrite = permissions.getScreenAccess('checklists') === 'full';
  const canManage = profile?.role === 'admin' || profile?.role === 'pm';
  const isClient = profile?.role === 'client';
  const [method, setMethod] = React.useState<Methodology | null>(null);
  const [state, setState] = React.useState<Record<string, ProjectDeliverable>>({});
  const [gates, setGates] = React.useState<PhaseGate[]>([]);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState('');
  const [gateBusy, setGateBusy] = React.useState('');
  const [confirmGate, setConfirmGate] = React.useState<{ phaseId: string; pass: boolean } | null>(null);
  const [signoffFor, setSignoffFor] = React.useState<MethodDeliverable | null>(null);
  const [view, setView] = React.useState<'board' | 'list'>('board');
  const [stepOpen, setStepOpen] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const activeProject = useStore((s) => s.activeProject);
  const members = useStore((s) => s.members);
  const fetchMembers = useStore((s) => s.fetchMembers);
  React.useEffect(() => { void fetchMembers(projectId).catch(() => undefined); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = React.useCallback(async () => {
    try {
      const [m, s] = await Promise.all([methodologyApi.load(), methodologyApi.projectState(projectId)]);
      setMethod(m);
      setState(Object.fromEntries(s.deliverables.map((d) => [d.deliverableId, d])));
      setGates(s.gates);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load deliverables');
    }
  }, [projectId]);
  React.useEffect(() => { void load(); }, [load]);

  const phases = (method?.phases || []).filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const current = currentPhase(phases, gates);
  React.useEffect(() => {
    if (current) setOpen((o) => (Object.keys(o).length ? o : { [current.id]: true }));
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <div style={{ padding: 24, fontSize: 13, color: C.red, fontFamily: F }}>{/relation|schema cache/i.test(error) ? 'Deliverables are not set up yet: run the migration 2026-11-27-methodology-and-budget-control.sql.' : error}</div>;
  }
  if (!method) return <div style={{ padding: 24, fontSize: 13, color: C.text2, fontFamily: F }}>Loading…</div>;

  const deliverablesOf = (phaseId: string) => method.deliverables
    .filter((d) => d.active && d.phaseId === phaseId && !(isClient && d.internalOnly))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const statusOf = (d: MethodDeliverable): DeliverableStatus => state[d.id]?.status || 'planned';
  const passed = (phaseId: string) => gates.some((g) => g.phaseId === phaseId && g.status === 'passed');
  const gateOf = (phaseId: string) => gates.find((g) => g.phaseId === phaseId);
  const stepName = (id: string | null) => method.steps.find((s) => s.id === id)?.name || '';

  const save = async (d: MethodDeliverable, patch: Partial<ProjectDeliverable>) => {
    const prev = state[d.id];
    const next: ProjectDeliverable = {
      projectId, deliverableId: d.id, status: prev?.status || 'planned', owner: prev?.owner ?? null, dueDate: prev?.dueDate ?? null,
      completedDate: prev?.completedDate ?? null, link: prev?.link || '', notes: prev?.notes || '', updatedAt: prev?.updatedAt || '', ...patch,
    };
    setState((s) => ({ ...s, [d.id]: next }));
    try {
      await methodologyApi.saveDeliverableState(projectId, d.id, {
        status: next.status, owner: next.owner, dueDate: next.dueDate || null, completedDate: next.completedDate || null, link: next.link, notes: next.notes,
      });
    } catch (e) {
      setState((s) => ({ ...s, [d.id]: prev as ProjectDeliverable }));
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };
  const changeStatus = (d: MethodDeliverable, status: DeliverableStatus) => {
    const done = isComplete(status) && status !== 'not_required';
    void save(d, { status, completedDate: done ? (state[d.id]?.completedDate || today()) : null });
  };

  const setGate = async (phaseId: string, pass: boolean) => {
    setGateBusy(phaseId);
    try {
      await methodologyApi.setGate(projectId, phaseId, pass ? 'passed' : 'open');
      toast.success(pass ? 'Phase gate passed' : 'Phase gate reopened');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the gate');
    } finally { setGateBusy(''); setConfirmGate(null); }
  };

  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, verticalAlign: 'middle' };
  const head: React.CSSProperties = { ...cell, fontSize: 11, fontWeight: 700, color: C.text2, background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' };
  const input: React.CSSProperties = { height: 30, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 6px', fontFamily: F, fontSize: 13, color: C.text, background: C.white, boxSizing: 'border-box' };

  // ── Board helpers ─────────────────────────────────────────────────────────
  const OWNER_COLOR: Record<Owner, string> = { HMC: '#2563EB', Client: '#EA580C', Joint: '#0D9488' };
  const PHASE_BG = ['#C7D2FE', '#A5B4FC', '#6366F1', '#4F46E5', '#312E81'];
  const stepsOf = (phaseId: string) => method.steps.filter((x) => x.phaseId === phaseId).sort((a, b) => a.sortOrder - b.sortOrder);
  const deliverablesOfStep = (stepId: string) => method.deliverables
    .filter((d) => d.active && d.stepId === stepId && !(isClient && d.internalOnly)).sort((a, b) => a.sortOrder - b.sortOrder);
  const stepState = (phaseId: string, stepId: string): 'done' | 'current' | 'upcoming' => {
    const list = deliverablesOfStep(stepId);
    if (passed(phaseId) || (list.length && list.every((d) => isComplete(statusOf(d))))) return 'done';
    if (current?.id === phaseId || list.some((d) => statusOf(d) !== 'planned')) return 'current';
    return 'upcoming';
  };
  const signoffs = method.deliverables.filter((d) => d.active && d.requiresSignoff);
  const role = profile?.role || '';
  const tools: { key: string; label: string; sub: string; icon: React.ReactNode; run: () => void; show?: boolean }[] = [
    { key: 'ppt', label: 'Weekly status', sub: 'PowerPoint', icon: <Presentation size={18} />, run: () => {
      if (!activeProject) return;
      const st = useStore.getState();
      const mine = <T extends { projectId: string }>(list: T[]) => list.filter((x) => x.projectId === projectId);
      void import('../../utils/statusPptx').then(({ downloadWeeklyStatus }) => downloadWeeklyStatus({ project: activeProject, tasks: mine(st.tasks), milestones: mine(st.milestones),
        issues: mine(st.issues), risks: mine(st.risks), changeRequests: mine(st.changeRequests), members: mine(st.members) }))
        .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not create the PowerPoint'));
    } },
    { key: 'onepage', label: 'Monthly report', sub: 'One Page', icon: <FileBarChart size={18} />, run: () => navigate(projectPath(projectId, 'onepage')) },
    { key: 'budget', label: 'Budget Control', sub: 'Monthly, by the 5th', icon: <Wallet size={18} />, run: () => navigate('/budget'), show: ['admin', 'pm', 'am', 'director'].includes(role) },
    { key: 'cr', label: 'Change request', sub: 'CR form (Word)', icon: <Repeat size={18} />, run: () => navigate(projectPath(projectId, 'cr')) },
    { key: 'effort', label: 'Man-days', sub: 'Effort & budget lines', icon: <Timer size={18} />, run: () => navigate(projectPath(projectId, 'effort')) },
    { key: 'guide', label: 'Methodology guide', sub: 'Steps & templates', icon: <BookOpen size={18} />, run: () => navigate('/methodology') },
  ];
  const openStep = stepOpen ? method.steps.find((x) => x.id === stepOpen) || null : null;

  /** One deliverable row: name, owner, status, dates, document link (used by the list and the step dialog). */
  const rowOf = (d: MethodDeliverable) => {
                        const st = state[d.id];
                        const status = statusOf(d);
                        const owner = (st?.owner || d.owner) as Owner;
                        const info = STATUS_INFO[status];
                        return (
                          <tr key={d.id}>
                            <td style={cell}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {d.name}
                                {d.requiresSignoff && <span title="Needs the customer's signature" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#047857', background: C.greenBg, padding: '0 6px', borderRadius: 999 }}><PenLine size={11} />Sign-off</span>}
                                {d.internalOnly && <span title="Internal — not shared with the customer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: C.text2, background: C.bg2, padding: '0 6px', borderRadius: 999 }}><Lock size={11} />Internal</span>}
                              </div>
                              <div style={{ fontSize: 11, color: C.text3, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                {stepName(d.stepId) && <span>{stepName(d.stepId)}</span>}
                                {d.format && <span>· {d.format}</span>}
                                {d.templateUrl && <a href={d.templateUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.primary, fontWeight: 600 }}><FileDown size={11} />Template</a>}
                                {d.requiresSignoff && activeProject && (
                                  <button type="button" onClick={() => setSignoffFor(d)} title="Fill in the company sign-off form and download it as Word"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 0, background: 'transparent', padding: 0, color: C.primary, fontWeight: 600, fontFamily: F, fontSize: 11, cursor: 'pointer' }}>
                                    <FileText size={11} />Sign-off form
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={cell}>
                              {canWrite ? (
                                <select value={owner} onChange={(e) => void save(d, { owner: e.target.value as Owner })} aria-label={`${d.name} owner`} style={{ ...input, color: OWNER_INFO[owner].fg }}>
                                  {(Object.keys(OWNER_INFO) as Owner[]).map((o) => <option key={o} value={o}>{OWNER_INFO[o].label}</option>)}
                                </select>
                              ) : <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: OWNER_INFO[owner].bg, color: OWNER_INFO[owner].fg }}>{owner}</span>}
                            </td>
                            <td style={cell}>
                              {canWrite ? (
                                <select value={status} onChange={(e) => changeStatus(d, e.target.value as DeliverableStatus)} aria-label={`${d.name} status`}
                                  style={{ ...input, width: '100%', background: info.bg, color: info.fg, fontWeight: 600, borderColor: 'transparent' }}>
                                  {statusesFor(d).map((s) => <option key={s} value={s}>{STATUS_INFO[s].label}</option>)}
                                </select>
                              ) : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: info.bg, color: info.fg }}>{info.label}</span>}
                            </td>
                            <td style={cell}>
                              {canWrite
                                ? <Input type="date" value={st?.dueDate || ''} onChange={(v) => void save(d, { dueDate: v || null })} aria-label={`${d.name} due date`} style={{ minWidth: 130 }} />
                                : fmtDate(st?.dueDate || '')}
                            </td>
                            <td style={cell}>
                              {canWrite
                                ? <Input type="date" value={st?.completedDate || ''} onChange={(v) => void save(d, { completedDate: v || null })} aria-label={`${d.name} completed date`} style={{ minWidth: 130 }} />
                                : fmtDate(st?.completedDate || '')}
                            </td>
                            <td style={cell}>
                              <LinkCell value={st?.link || ''} editable={canWrite} onSave={(link) => void save(d, { link })} label={d.name} />
                            </td>
                          </tr>
                        );
  };

  return (
    <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
      {/* Title, view switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Project methodology</div>
          <div style={{ fontSize: 13, color: C.text2 }}>{current ? <>Now in <strong style={{ color: '#4338CA' }}>{current.name}</strong></> : 'All phases passed'}</div>
        </div>
        <div role="group" aria-label="View" style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {([['board', 'Board', <LayoutGrid key="b" size={14} />], ['list', 'List', <List key="l" size={14} />]] as const).map(([key, label, icon]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 13, fontWeight: 600,
                background: view === key ? C.primary : C.white, color: view === key ? '#fff' : C.text2 }}>{icon}{label}</button>
          ))}
        </div>
      </div>

      {/* Quick tools */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {tools.filter((t) => t.show !== false).map((t) => (
          <button key={t.key} type="button" onClick={t.run}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', textAlign: 'left', fontFamily: F }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C7D2FE'; e.currentTarget.style.background = '#F8FAFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: C.primaryBg, color: C.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{t.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>{t.label}</span>
              <span style={{ display: 'block', fontSize: 11, color: C.text3 }}>{t.sub}</span>
            </span>
          </button>
        ))}
        {signoffs.length > 0 && activeProject && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, fontFamily: F }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: C.greenBg, color: '#047857', display: 'grid', placeItems: 'center', flexShrink: 0 }}><PenLine size={18} /></span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>Sign-off form</span>
              <select value="" onChange={(e) => { const d = signoffs.find((x) => x.id === e.target.value); if (d) setSignoffFor(d); }} aria-label="Choose a deliverable to sign off"
                style={{ width: '100%', border: 0, padding: 0, background: 'transparent', fontFamily: F, fontSize: 11, color: C.primary, cursor: 'pointer' }}>
                <option value="">Choose a deliverable…</option>
                {signoffs.map((d) => <option key={d.id} value={d.id}>{d.shortName || d.name}</option>)}
              </select>
            </span>
          </label>
        )}
      </div>

      {view === 'board' && (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, phases.length)}, minmax(220px, 1fr))`, gap: 10, minWidth: phases.length * 230 }}>
            {phases.map((p, i) => {
              const list = deliverablesOf(p.id);
              const done = list.filter((d) => isComplete(statusOf(d))).length;
              const missing = list.filter((d) => !isComplete(statusOf(d)));
              const isPassed = passed(p.id);
              const isCurrent = current?.id === p.id;
              const gate = gateOf(p.id);
              const light = i < 2;
              return (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  {/* chevron header */}
                  <div style={{ position: 'relative', padding: '10px 22px 10px 12px', background: PHASE_BG[i % PHASE_BG.length], color: light ? '#1E1B4B' : '#FFFFFF',
                    clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)', borderRadius: '8px 0 0 8px',
                    outline: isCurrent ? '3px solid #F59E0B' : 'none', outlineOffset: -3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
                      <span>{i + 1}/{phases.length}</span>
                      <span>{isPassed ? 'PASSED' : isCurrent ? 'NOW' : ''}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>{p.name.toUpperCase()}</div>
                    <div style={{ height: 4, borderRadius: 2, background: light ? 'rgba(30,27,75,0.15)' : 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                      <div style={{ width: `${list.length ? (done / list.length) * 100 : 0}%`, height: '100%', borderRadius: 2, background: light ? '#1E1B4B' : '#FFFFFF' }} />
                    </div>
                  </div>
                  {/* steps */}
                  {stepsOf(p.id).map((st) => {
                    const stState = stepState(p.id, st.id);
                    const dels = deliverablesOfStep(st.id);
                    return (
                      <button key={st.id} type="button" onClick={() => setStepOpen(st.id)} title={st.objective}
                        style={{ textAlign: 'left', padding: '10px 10px 10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: F,
                          border: `1px solid ${stState === 'current' ? '#C7D2FE' : C.border}`, borderLeft: `4px solid ${OWNER_COLOR[st.owner]}`,
                          background: stState === 'done' ? '#F0FDF4' : stState === 'current' ? '#F8FAFF' : C.white, opacity: stState === 'upcoming' ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span aria-label={stState} style={{ marginTop: 1, color: stState === 'done' ? '#047857' : stState === 'current' ? C.primary : C.text3, display: 'inline-flex' }}>
                            {stState === 'done' ? <CheckCircle2 size={14} /> : stState === 'current' ? <CircleDot size={14} /> : <Circle size={14} />}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{st.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: OWNER_COLOR[st.owner] }}>{st.owner}</span>
                        </div>
                        {dels.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {dels.map((d) => {
                              const info = STATUS_INFO[statusOf(d)];
                              return (
                                <span key={d.id} title={`${d.name} · ${info.label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1px 7px', borderRadius: 999, background: info.bg, color: info.fg, fontWeight: 600 }}>
                                  {d.requiresSignoff && <PenLine size={10} />}{d.shortName || d.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {/* gate */}
                  <div style={{ marginTop: 'auto', padding: '8px 10px', borderRadius: 10, border: `1px dashed ${isPassed ? '#86EFAC' : C.border2}`, background: isPassed ? '#F0FDF4' : '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: isPassed ? '#047857' : C.text2 }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: isPassed ? C.green : C.text3 }} />
                      GATE {isPassed && gate?.passedAt ? `· ${fmtDate(gate.passedAt.slice(0, 10))}` : ''}
                    </div>
                    <div title={p.gate} style={{ fontSize: 11, color: C.text2, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.gate}</div>
                    {canManage && isCurrent && !isPassed && (
                      <Btn small onClick={() => setConfirmGate({ phaseId: p.id, pass: true })} disabled={!!gateBusy || missing.length > 0}
                        title={missing.length ? `Waiting for: ${missing.map((d) => d.shortName || d.name).join(', ')}` : undefined}
                        style={{ marginTop: 6, width: '100%' }}>{missing.length ? `${missing.length} to complete` : 'Pass gate'}</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: C.text2 }}>
            {(Object.keys(OWNER_COLOR) as Owner[]).map((o) => <span key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: OWNER_COLOR[o] }} />{o === 'HMC' ? 'HMC leads' : o === 'Client' ? 'Client leads' : 'Joint'}</span>)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><PenLine size={11} />Needs sign-off</span>
            <span>Click a step to update its deliverables.</span>
          </div>
        </div>
      )}

      {view === 'list' && <>
      {/* Phase stepper */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, phases.length)}, minmax(0, 1fr))`, gap: 8 }}>
        {phases.map((p, i) => {
          const list = deliverablesOf(p.id);
          const done = list.filter((d) => isComplete(statusOf(d))).length;
          const isPassed = passed(p.id);
          const isCurrent = current?.id === p.id;
          return (
            <button key={p.id} type="button" onClick={() => setOpen((o) => ({ ...o, [p.id]: true }))}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: F,
                border: `1px solid ${isCurrent ? C.primary : C.border}`, background: isPassed ? '#F0FDF4' : isCurrent ? C.primaryBg : C.white }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isPassed ? '#047857' : isCurrent ? '#4338CA' : C.text3 }}>
                {isPassed ? 'PASSED' : isCurrent ? 'CURRENT PHASE' : `PHASE ${i + 1}`}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '2px 0 6px' }}>{p.name}</div>
              <div style={{ height: 6, borderRadius: 3, background: C.bg2, overflow: 'hidden' }}>
                <div style={{ width: `${list.length ? (done / list.length) * 100 : 0}%`, height: '100%', background: isPassed ? C.green : C.primary }} />
              </div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>{done} of {list.length} deliverables</div>
            </button>
          );
        })}
      </div>

      {phases.map((p) => {
        const list = deliverablesOf(p.id);
        const missing = list.filter((d) => !isComplete(statusOf(d)));
        const isPassed = passed(p.id);
        const gate = gateOf(p.id);
        const expanded = !!open[p.id];
        return (
          <section key={p.id} style={{ background: C.white, border: `1px solid ${current?.id === p.id ? '#C7D2FE' : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [p.id]: !expanded }))} aria-expanded={expanded}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: F, textAlign: 'left' }}>
              {expanded ? <ChevronDown size={16} color={C.text2} /> : <ChevronRight size={16} color={C.text2} />}
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{p.name}</span>
              <span style={{ fontSize: 13, color: C.text2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</span>
              {isPassed
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#047857' }}><CheckCircle2 size={14} />Gate passed</span>
                : <span style={{ fontSize: 11, color: C.text2 }}>{list.length - missing.length} / {list.length} complete</span>}
            </button>
            {expanded && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th style={head}>Deliverable</th><th style={head}>Owner</th><th style={{ ...head, width: 150 }}>Status</th>
                        <th style={{ ...head, width: 140 }}>Due</th><th style={{ ...head, width: 140 }}>Completed</th><th style={{ ...head, width: 220 }}>Document link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(rowOf)}
                    </tbody>
                  </table>
                </div>
                {/* Gate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: isPassed ? '#F0FDF4' : '#F8FAFC' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>PHASE GATE</div>
                    <div style={{ fontSize: 13, color: C.text }}>{p.gate || '—'}</div>
                    <div style={{ fontSize: 11, color: isPassed ? '#047857' : missing.length ? '#B45309' : '#047857', marginTop: 2 }}>
                      {isPassed
                        ? `Passed${gate?.passedAt ? ` on ${fmtDate(gate.passedAt.slice(0, 10))}` : ''}`
                        : missing.length ? `Waiting for: ${missing.map((d) => d.shortName || d.name).join(', ')}` : 'All deliverables complete — ready to pass'}
                    </div>
                  </div>
                  {canManage && (isPassed
                    ? <Btn variant="ghost" small onClick={() => setConfirmGate({ phaseId: p.id, pass: false })} disabled={!!gateBusy}>Reopen gate</Btn>
                    : <Btn small onClick={() => setConfirmGate({ phaseId: p.id, pass: true })} disabled={!!gateBusy || missing.length > 0}
                        title={missing.length ? 'Complete every deliverable first (or mark it Not required)' : undefined}>Pass gate</Btn>)}
                </div>
              </div>
            )}
          </section>
        );
      })}

      </>}

      {openStep && (
        <FormModal title={openStep.name} subtitle={`${phases.find((p) => p.id === openStep.phaseId)?.name || ''} · led by ${openStep.owner}`} onClose={() => setStepOpen(null)} width={1000}
          footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={() => setStepOpen(null)}>Close</Btn></>}>
          <div style={{ fontSize: 13, color: C.text }}>{openStep.objective}</div>
          {openStep.activities.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text2, lineHeight: 1.7 }}>{openStep.activities.map((a, k) => <li key={k}>{a}</li>)}</ul>
          )}
          {deliverablesOfStep(openStep.id).length ? (
            <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead><tr>
                  <th style={head}>Deliverable</th><th style={head}>Owner</th><th style={{ ...head, width: 150 }}>Status</th>
                  <th style={{ ...head, width: 140 }}>Due</th><th style={{ ...head, width: 140 }}>Completed</th><th style={{ ...head, width: 200 }}>Document link</th>
                </tr></thead>
                <tbody>{deliverablesOfStep(openStep.id).map(rowOf)}</tbody>
              </table>
            </div>
          ) : <div style={{ fontSize: 13, color: C.text3 }}>No deliverables in this step.</div>}
        </FormModal>
      )}

      {signoffFor && activeProject && (
        <SignoffFormModal
          project={activeProject}
          deliverableName={signoffFor.name}
          phaseName={phases.find((p) => p.id === signoffFor.phaseId)?.name || ''}
          members={members.filter((m) => m.projectId === projectId)}
          saved={(state[signoffFor.id]?.form as Partial<SignoffForm> | undefined) || null}
          signedDate={state[signoffFor.id]?.status === 'signed' ? state[signoffFor.id]?.completedDate || null : null}
          canEdit={canWrite}
          onClose={() => setSignoffFor(null)}
          onSave={async (form) => {
            const { error } = await supabase.from('project_deliverables')
              .upsert({ project_id: projectId, deliverable_id: signoffFor.id, form }, { onConflict: 'project_id,deliverable_id' });
            if (error) { toast.error(/column .*form/i.test(error.message) ? 'Run the migration 2026-11-28-document-forms.sql to save sign-off forms.' : error.message); return false; }
            setState((s) => ({ ...s, [signoffFor.id]: { ...(s[signoffFor.id] || { projectId, deliverableId: signoffFor.id, status: 'planned', owner: null, dueDate: null, completedDate: null, link: '', notes: '', updatedAt: '' }), form: form as unknown as Record<string, unknown> } }));
            return true;
          }}
        />
      )}
      {confirmGate && (
        <Modal title={confirmGate.pass ? 'Pass phase gate' : 'Reopen phase gate'} onClose={() => !gateBusy && setConfirmGate(null)} width={440} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
            {confirmGate.pass
              ? `Confirm that "${phases.find((p) => p.id === confirmGate.phaseId)?.name}" meets its gate. The project moves to the next phase.`
              : 'The project goes back to this phase until the gate is passed again.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setConfirmGate(null)} disabled={!!gateBusy}>Cancel</Btn>
            <Btn onClick={() => void setGate(confirmGate.phaseId, confirmGate.pass)} disabled={!!gateBusy}>{gateBusy ? 'Saving…' : confirmGate.pass ? 'Pass gate' : 'Reopen'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LinkCell({ value, editable, onSave, label }: { value: string; editable: boolean; onSave: (v: string) => void; label: string }) {
  const [draft, setDraft] = React.useState(value);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => { setDraft(value); }, [value]);
  const valid = /^https?:\/\//i.test(value);
  if (editing && editable) {
    return (
      <input autoFocus value={draft} placeholder="https://…" aria-label={`${label} document link`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        style={{ height: 30, width: '100%', border: `1px solid ${C.primary}`, borderRadius: 6, padding: '0 6px', fontFamily: F, fontSize: 13, boxSizing: 'border-box' }} />
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {value ? (valid
        ? <a href={value} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}><ExternalLink size={12} />Open</a>
        : <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{value}</span>)
        : <span style={{ fontSize: 13, color: C.text3 }}>—</span>}
      {editable && <button type="button" onClick={() => setEditing(true)} style={{ border: 0, background: 'transparent', color: C.primary, fontFamily: F, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{value ? 'Edit' : 'Add'}</button>}
    </span>
  );
}
