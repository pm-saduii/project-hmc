import React from 'react';
import toast from 'react-hot-toast';
import { BookOpen, CheckCircle2, Link2, ListPlus, Wand2, ChevronDown, ChevronRight, Circle, CircleDot, ExternalLink, FileBarChart, FileDown, FileText, LayoutGrid, List, Lock, PenLine, Presentation, Repeat, Timer, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormModal } from '../Admin/AdminUi';
import { projectPath } from '../../utils/projectRoutes';
import SignoffFormModal from '../Documents/SignoffFormModal';
import MethodBoard from '../Methodology/MethodBoard';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import { taskApi } from '../../services/api';
import type { SignoffForm } from '../../utils/companyDocs';
import type { Task } from '../../types';
import { Btn, C, Input, Modal } from '../Common';
import { compareWbs, fmtDate } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import {
  OWNER_INFO, STATUS_INFO, currentPhase, hasGate, isComplete, methodologyApi, statusesFor, subtreeProgress, suggestLinks, matchScore,
  type DeliverableStatus, type MethodDeliverable, type MethodPhase, type Methodology, type Owner, type PhaseGate, type ProjectDeliverable,
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
  // Tasks of this project, for linking deliverables to the plan
  const allTasks = useStore((s) => s.tasks);
  const fetchTasks = useStore((s) => s.fetchTasks);
  const updateTask = useStore((s) => s.updateTask);
  const tasks = React.useMemo(() => allTasks.filter((t) => t.projectId === projectId)
    .sort((a, b) => compareWbs(String(a.wbs || ''), String(b.wbs || '')) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [allTasks, projectId]);
  React.useEffect(() => { if (!allTasks.some((t) => t.projectId === projectId)) void fetchTasks(projectId).catch(() => undefined); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [finishTask, setFinishTask] = React.useState<{ task: Task; date: string; deliverable: string } | null>(null);
  const [matching, setMatching] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

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
        ...('taskId' in patch ? { taskId: next.taskId || null } : {}),
      });
      return true;
    } catch (e) {
      setState((s) => ({ ...s, [d.id]: prev as ProjectDeliverable }));
      const msg = e instanceof Error ? e.message : 'Could not save';
      toast.error(/task_id/i.test(msg) ? 'Run the migration 2026-12-02-deliverable-task-link.sql to link tasks.' : msg);
      return false;
    }
  };
  const taskOf = (d: MethodDeliverable): Task | null => {
    const id = state[d.id]?.taskId;
    return id ? tasks.find((t) => t.id === id) || null : null;
  };
  /** Due date: the linked task's end date, else the date typed here. */
  const dueOf = (d: MethodDeliverable) => taskOf(d)?.endDate || state[d.id]?.dueDate || '';
  /** Finish date of the linked task once it is done (actual finish, else its end date). */
  const taskFinishOf = (d: MethodDeliverable): string => {
    const t = taskOf(d);
    if (!t || !(t.status === 'Done' || (Number(t.percentComplete) || 0) >= 100)) return '';
    return String(t.actualFinish || t.endDate || '').slice(0, 10);
  };
  /** Completed date: the linked task's finish date when the task is done, else the date typed here. */
  const completedOf = (d: MethodDeliverable) => taskFinishOf(d) || state[d.id]?.completedDate || '';
  /** The phase's main task in the plan and how far the tasks under it are. */
  const phaseTaskOf = (phaseId: string): Task | null => {
    const id = gates.find((g) => g.phaseId === phaseId)?.taskId;
    return id ? tasks.find((t) => t.id === id) || null : null;
  };
  const phaseTasks = (phaseId: string) => { const t = phaseTaskOf(phaseId); return t ? subtreeProgress(t.id, tasks) : null; };
  /** Ready to pass: every deliverable complete and every task under the phase done. */
  const gateReady = (phaseId: string) => deliverablesOf(phaseId).every((d) => isComplete(statusOf(d))) && (phaseTasks(phaseId)?.open.length ?? 0) === 0;
  const changeStatus = async (d: MethodDeliverable, status: DeliverableStatus) => {
    const done = isComplete(status) && status !== 'not_required';
    const date = done ? (taskFinishOf(d) || state[d.id]?.completedDate || today()) : null;
    const ok = await save(d, { status, completedDate: date });
    // Signed / final: offer to close the linked task too
    const task = taskOf(d);
    if (ok && done && date && task && task.status !== 'Done' && canWrite) setFinishTask({ task, date, deliverable: d.shortName || d.name });
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
                                <select value={status} onChange={(e) => void changeStatus(d, e.target.value as DeliverableStatus)} aria-label={`${d.name} status`}
                                  style={{ ...input, width: '100%', background: info.bg, color: info.fg, fontWeight: 600, borderColor: 'transparent' }}>
                                  {statusesFor(d).map((s) => <option key={s} value={s}>{STATUS_INFO[s].label}</option>)}
                                </select>
                              ) : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: info.bg, color: info.fg }}>{info.label}</span>}
                            </td>
                            <td style={cell}>
                              <TaskCell task={taskOf(d)} tasks={tasks} editable={canWrite} label={d.name} onChange={(taskId) => void save(d, { taskId })} />
                            </td>
                            <td style={cell}>
                              {taskOf(d)?.endDate
                                ? <span title="From the linked task — change it in Tasks">{fmtDate(taskOf(d)!.endDate)}<span style={{ display: 'block', fontSize: 11, color: C.text3 }}>from task</span></span>
                                : canWrite
                                  ? <Input type="date" value={st?.dueDate || ''} onChange={(v) => void save(d, { dueDate: v || null })} aria-label={`${d.name} due date`} style={{ minWidth: 130 }} />
                                  : fmtDate(st?.dueDate || '')}
                            </td>
                            <td style={cell}>
                              {taskFinishOf(d)
                                ? <span title="Finish date of the linked task — change it in Tasks">{fmtDate(taskFinishOf(d))}<span style={{ display: 'block', fontSize: 11, color: C.text3 }}>from task</span></span>
                                : canWrite
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
          <div style={{ fontSize: 13, color: C.text2 }}>{current ? <>Now in <strong style={{ color: '#4338CA' }}>{current.name}</strong>{hasGate(current) && !passed(current.id) && gateReady(current.id) && <span style={{ color: '#047857', fontWeight: 600 }}> · gate ready to pass</span>}</> : 'All phases passed'}</div>
        </div>
        {canWrite && (
          <Btn small variant="outline" onClick={() => setCreating(true)} title="Add tasks to the plan for the methodology phases, steps and deliverables"><ListPlus size={14} style={{ marginRight: 6 }} />Create tasks</Btn>
        )}
        {canWrite && tasks.length > 0 && (
          <Btn small variant="outline" onClick={() => setMatching(true)} title="Link deliverables to tasks in the plan"><Wand2 size={14} style={{ marginRight: 6 }} />Link tasks</Btn>
        )}
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
        <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '6px 6px 4px' }}>
          <MethodBoard
            phases={phases}
            stepsOf={stepsOf}
            deliverablesOf={deliverablesOf}
            highlight={current?.id}
            onStep={(st) => setStepOpen(st.id)}
            onDeliverable={(d) => { const st = d.stepId && method.steps.some((x) => x.id === d.stepId) ? d.stepId : null; if (st) setStepOpen(st); else setView('list'); }}
            stepMark={(p, st) => stepState(p.id, st.id)}
            deliverableTone={(d) => {
              const info = STATUS_INFO[statusOf(d)];
              const t = taskOf(d);
              return { bg: info.bg, fg: info.fg,
                title: `${d.name} · ${info.label}${t ? ` · task ${t.percentComplete || 0}%` : ''}${dueOf(d) ? ` · due ${fmtDate(dueOf(d))}` : ''}`,
                after: <>{d.requiresSignoff && <PenLine size={10} />}{t && <Link2 size={10} aria-label="linked to a task" />}</> };
            }}
            phaseExtra={(p) => {
              const list = deliverablesOf(p.id);
              const done = list.filter((d) => isComplete(statusOf(d))).length;
              const isPassed = passed(p.id);
              const isCurrent = current?.id === p.id;
              return (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 8px', borderRadius: 999,
                    background: isPassed ? C.greenBg : isCurrent ? '#FEF3C7' : C.bg2, color: isPassed ? '#047857' : isCurrent ? '#B45309' : C.text3 }}>
                    {isPassed ? 'PASSED' : isCurrent ? 'NOW' : 'UPCOMING'}
                  </span>
                  <div style={{ width: '80%', height: 4, borderRadius: 2, background: C.bg2 }}>
                    <div style={{ width: `${list.length ? (done / list.length) * 100 : 0}%`, height: '100%', borderRadius: 2, background: isPassed ? C.green : C.primary }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.text3 }}>{done}/{list.length} deliverables</span>
                </div>
              );
            }}
            phaseFooter={(p) => {
              if (!hasGate(p)) return null;
              const list = deliverablesOf(p.id);
              const missing = list.filter((d) => !isComplete(statusOf(d)));
              const isPassed = passed(p.id);
              const isCurrent = current?.id === p.id;
              const gate = gateOf(p.id);
              return (
                <div style={{ padding: '8px 10px', borderRadius: 10, border: `1px dashed ${isPassed ? '#86EFAC' : C.border2}`, background: isPassed ? '#F0FDF4' : '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: isPassed ? '#047857' : C.text2 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: isPassed ? C.green : C.text3 }} />
                    GATE {isPassed && gate?.passedAt ? `· ${fmtDate(gate.passedAt.slice(0, 10))}` : ''}
                    {!isPassed && gateReady(p.id) && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#047857', background: C.greenBg, padding: '0 6px', borderRadius: 999 }}>READY</span>}
                  </div>
                  <div title={p.gate} style={{ fontSize: 11, color: C.text2, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.gate}</div>
                  {!isPassed && <GateChecks deliverables={list.length - missing.length} deliverableTotal={list.length} tasks={phaseTasks(p.id)} />}
                  {canManage && isCurrent && !isPassed && (
                    <Btn small onClick={() => setConfirmGate({ phaseId: p.id, pass: true })} disabled={!!gateBusy || missing.length > 0}
                      title={missing.length ? `Waiting for: ${missing.map((d) => d.shortName || d.name).join(', ')}` : undefined}
                      style={{ marginTop: 6, width: '100%' }}>{missing.length ? `${missing.length} to complete` : 'Pass gate'}</Btn>
                  )}
                  {canManage && isPassed && (
                    <button type="button" onClick={() => setConfirmGate({ phaseId: p.id, pass: false })} disabled={!!gateBusy}
                      style={{ marginTop: 4, border: 0, background: 'transparent', padding: 0, fontFamily: F, fontSize: 11, color: C.text2, cursor: 'pointer', textDecoration: 'underline' }}>Reopen</button>
                  )}
                </div>
              );
            }}
          />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '6px 12px 8px', fontSize: 11, color: C.text2, borderTop: `1px solid ${C.border}` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} color="#047857" />Done</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CircleDot size={12} color={C.primary} />In progress</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PenLine size={11} />Needs sign-off</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} />Linked to a task</span>
            <span>Click a step or deliverable to update it.</span>
          </div>
        </section>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
                    <thead>
                      <tr>
                        <th style={head}>Deliverable</th><th style={head}>Owner</th><th style={{ ...head, width: 150 }}>Status</th>
                        <th style={{ ...head, width: 220 }}>Task</th><th style={{ ...head, width: 140 }}>Due</th><th style={{ ...head, width: 140 }}>Completed</th><th style={{ ...head, width: 220 }}>Document link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(rowOf)}
                    </tbody>
                  </table>
                </div>
                {/* Gate (none for phases like Hypercare) */}
                {hasGate(p) && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: isPassed ? '#F0FDF4' : '#F8FAFC' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>PHASE GATE</div>
                    <div style={{ fontSize: 13, color: C.text }}>{p.gate || '—'}</div>
                    <div style={{ fontSize: 11, color: isPassed ? '#047857' : missing.length ? '#B45309' : '#047857', marginTop: 2 }}>
                      {isPassed
                        ? `Passed${gate?.passedAt ? ` on ${fmtDate(gate.passedAt.slice(0, 10))}` : ''}`
                        : missing.length ? `Waiting for: ${missing.map((d) => d.shortName || d.name).join(', ')}`
                          : gateReady(p.id) ? 'All deliverables complete and tasks done — ready to pass' : 'All deliverables complete — tasks still open'}
                    </div>
                    {!isPassed && <GateChecks deliverables={list.length - missing.length} deliverableTotal={list.length} tasks={phaseTasks(p.id)} />}
                  </div>
                  {canManage && (isPassed
                    ? <Btn variant="ghost" small onClick={() => setConfirmGate({ phaseId: p.id, pass: false })} disabled={!!gateBusy}>Reopen gate</Btn>
                    : <Btn small onClick={() => setConfirmGate({ phaseId: p.id, pass: true })} disabled={!!gateBusy || missing.length > 0}
                        title={missing.length ? 'Complete every deliverable first (or mark it Not required)' : undefined}>Pass gate</Btn>)}
                </div>}
              </div>
            )}
          </section>
        );
      })}

      </>}

      {openStep && (
        <FormModal title={openStep.name} subtitle={`${phases.find((p) => p.id === openStep.phaseId)?.name || ''} · led by ${openStep.owner}`} onClose={() => setStepOpen(null)} width={1180}
          footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={() => setStepOpen(null)}>Close</Btn></>}>
          <div style={{ fontSize: 13, color: C.text }}>{openStep.objective}</div>
          {openStep.activities.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text2, lineHeight: 1.7 }}>{openStep.activities.map((a, k) => <li key={k}>{a}</li>)}</ul>
          )}
          {deliverablesOfStep(openStep.id).length ? (
            <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
                <thead><tr>
                  <th style={head}>Deliverable</th><th style={head}>Owner</th><th style={{ ...head, width: 150 }}>Status</th>
                  <th style={{ ...head, width: 220 }}>Task</th><th style={{ ...head, width: 140 }}>Due</th><th style={{ ...head, width: 140 }}>Completed</th><th style={{ ...head, width: 200 }}>Document link</th>
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
          signedDate={state[signoffFor.id]?.status === 'signed' ? completedOf(signoffFor) || null : null}
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
      {finishTask && (
        <Modal title="Close the linked task?" onClose={() => setFinishTask(null)} width={460} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
            {finishTask.deliverable} is complete. Mark the task <strong style={{ color: C.text }}>{finishTask.task.wbs} {finishTask.task.taskName}</strong> as Done (100%, finished {fmtDate(finishTask.date)})?
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setFinishTask(null)}>Not now</Btn>
            <Btn onClick={() => {
              const { task, date } = finishTask;
              setFinishTask(null);
              void updateTask(task.id, { status: 'Done', percentComplete: 100, actualFinish: date })
                .then(() => toast.success('Task marked Done'))
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not update the task'));
            }}>Mark Done</Btn>
          </div>
        </Modal>
      )}
      {creating && (
        <CreateTasksModal
          phases={phases}
          stepsOf={stepsOf}
          deliverablesOfStep={deliverablesOfStep}
          looseDeliverables={(phaseId) => deliverablesOf(phaseId).filter((d) => !d.stepId || !method.steps.some((x) => x.id === d.stepId))}
          linkedPhases={new Set(gates.filter((g) => g.taskId && tasks.some((t) => t.id === g.taskId)).map((g) => g.phaseId))}
          hasTasks={tasks.length > 0}
          onClose={() => setCreating(false)}
          onCreate={async (nodes, deliverableKeys, phaseKeys) => {
            const { data, ids } = await taskApi.appendTree(projectId, nodes);
            useStore.setState({ tasks: [...useStore.getState().tasks.filter((t) => t.projectId !== projectId), ...data] });
            let warned = false;
            for (const [deliverableId, key] of Object.entries(deliverableKeys)) {
              try { await methodologyApi.saveDeliverableState(projectId, deliverableId, { taskId: ids[key] }); }
              catch { if (!warned) { toast.error('Tasks created, but linking needs the migration 2026-12-02-deliverable-task-link.sql.'); warned = true; } break; }
            }
            for (const [phaseId, key] of Object.entries(phaseKeys)) {
              try { await methodologyApi.setGateTask(projectId, phaseId, ids[key]); }
              catch { if (!warned) { toast.error('Tasks created, but linking phases needs the migration 2026-12-03-phase-gate-task.sql.'); warned = true; } break; }
            }
            await load();
            if (!warned) toast.success(`${nodes.length} tasks added to the plan and linked`);
          }}
        />
      )}
      {matching && (
        <LinkTasksModal
          deliverables={phases.flatMap((p) => deliverablesOf(p.id))}
          phaseNameOf={(id) => phases.find((p) => p.id === id)?.name || ''}
          linked={Object.fromEntries(Object.values(state).filter((x) => x.taskId).map((x) => [x.deliverableId, x.taskId as string]))}
          phases={phases}
          phaseLinked={Object.fromEntries(gates.filter((g) => g.taskId).map((g) => [g.phaseId, g.taskId as string]))}
          tasks={tasks}
          onClose={() => setMatching(false)}
          onApply={async (links, phaseLinks) => {
            let ok = 0;
            const total = Object.keys(links).length + Object.keys(phaseLinks).length;
            for (const [deliverableId, taskId] of Object.entries(links)) {
              const d = method.deliverables.find((x) => x.id === deliverableId);
              if (d && await save(d, { taskId: taskId || null })) ok += 1; else break;
            }
            if (ok === Object.keys(links).length) {
              for (const [phaseId, taskId] of Object.entries(phaseLinks)) {
                try { await methodologyApi.setGateTask(projectId, phaseId, taskId || null); ok += 1; }
                catch (e) { const m = e instanceof Error ? e.message : ''; toast.error(/task_id/i.test(m) ? 'Run the migration 2026-12-03-phase-gate-task.sql to link phases.' : m || 'Could not save'); break; }
              }
              await load();
            }
            if (ok) toast.success(`${ok} link${ok > 1 ? 's' : ''} updated`);
            return ok === total;
          }}
        />
      )}
      {confirmGate && (
        <Modal title={confirmGate.pass ? 'Pass phase gate' : 'Reopen phase gate'} onClose={() => !gateBusy && setConfirmGate(null)} width={440} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
            {confirmGate.pass
              ? `Confirm that "${phases.find((p) => p.id === confirmGate.phaseId)?.name}" meets its gate. The project moves to the next phase.${(phaseTasks(confirmGate.phaseId)?.open.length ?? 0) > 0 ? ` Note: ${phaseTasks(confirmGate.phaseId)!.open.length} task(s) under this phase are not done yet.` : ''}`
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

const taskLabel = (t: Task) => `${t.wbs ? `${t.wbs} ` : ''}${t.taskName}`;
/** Dropdown option in WBS order, indented by depth (1 · 1.1 · 1.1.1). */
const taskOption = (t: Task) => {
  const depth = Math.max(0, String(t.wbs || '').split('.').filter(Boolean).length - 1);
  return <option key={t.id} value={t.id}>{'\u00A0\u00A0\u00A0'.repeat(depth)}{taskLabel(t)}</option>;
};
const TASK_STATUS_COLOR: Record<string, string> = { Done: '#047857', 'In Progress': '#4338CA', 'Block/Delay': '#B91C1C', Todo: '#64748B' };

/** Pick the task a deliverable is produced by; shows the task's progress under it. */
function TaskCell({ task, tasks, editable, label, onChange }: { task: Task | null; tasks: Task[]; editable: boolean; label: string; onChange: (taskId: string | null) => void }) {
  const progress = task && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.bg2, overflow: 'hidden', maxWidth: 90 }}>
        <div style={{ width: `${Math.min(100, task.percentComplete || 0)}%`, height: '100%', background: TASK_STATUS_COLOR[task.status] || C.primary }} />
      </div>
      <span style={{ fontSize: 11, color: TASK_STATUS_COLOR[task.status] || C.text2, whiteSpace: 'nowrap' }}>{task.percentComplete || 0}% · {task.status}</span>
    </div>
  );
  if (!editable) return task ? <div><div style={{ fontSize: 13 }}>{taskLabel(task)}</div>{progress}</div> : <span style={{ fontSize: 13, color: C.text3 }}>—</span>;
  return (
    <div style={{ minWidth: 0 }}>
      <select value={task?.id || ''} onChange={(e) => onChange(e.target.value || null)} aria-label={`${label} linked task`} title={task ? taskLabel(task) : 'Not linked'}
        style={{ height: 30, width: '100%', maxWidth: 220, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 6px', fontFamily: F, fontSize: 13, color: task ? C.text : C.text3, background: C.white }}>
        <option value="">— Not linked —</option>
        {tasks.map(taskOption)}
      </select>
      {progress}
    </div>
  );
}

/**
 * Link deliverables and phases to tasks: pick an item on the left, then click a task in the plan on the right.
 * Phases link to a main (top-level) task; the gate checks every task under it.
 */
export function LinkTasksModal({ deliverables, phaseNameOf, linked, phases, phaseLinked, tasks, onClose, onApply }: {
  deliverables: MethodDeliverable[]; phaseNameOf: (phaseId: string) => string; linked: Record<string, string>;
  phases: MethodPhase[]; phaseLinked: Record<string, string>; tasks: Task[];
  onClose: () => void; onApply: (links: Record<string, string>, phaseLinks: Record<string, string>) => Promise<boolean>;
}) {
  type Item = { key: string; kind: 'phase' | 'deliverable'; id: string; name: string; sub: string };
  const mainTasks = React.useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);
  // Suggestions for items not linked yet
  const suggestions = React.useMemo(() => {
    const out: Record<string, { taskId: string; score: number }> = {};
    Object.entries(suggestLinks(deliverables.filter((d) => !linked[d.id]), phaseNameOf, tasks)).forEach(([id, v]) => { out[`d:${id}`] = v; });
    phases.filter((p) => !phaseLinked[p.id]).forEach((p) => {
      let best: { taskId: string; score: number } | null = null;
      mainTasks.forEach((t) => { const sc = matchScore({ name: p.name, shortName: '' }, '', t); if (sc >= 0.5 && (!best || sc > best.score)) best = { taskId: t.id, score: sc }; });
      if (best) out[`p:${p.id}`] = best;
    });
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const original: Record<string, string> = React.useMemo(() => ({
    ...Object.fromEntries(Object.entries(phaseLinked).map(([k, v]) => [`p:${k}`, v])),
    ...Object.fromEntries(Object.entries(linked).map(([k, v]) => [`d:${k}`, v])),
  }), [linked, phaseLinked]);
  const [choice, setChoice] = React.useState<Record<string, string>>(() => ({ ...original, ...Object.fromEntries(Object.entries(suggestions).map(([k, v]) => [k, v.taskId])) }));
  const [onlyUnlinked, setOnlyUnlinked] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const items: Item[] = React.useMemo(() => phases.flatMap((p) => [
    { key: `p:${p.id}`, kind: 'phase' as const, id: p.id, name: p.name, sub: 'Phase → main task' },
    ...deliverables.filter((d) => d.phaseId === p.id).map((d) => ({ key: `d:${d.id}`, kind: 'deliverable' as const, id: d.id, name: d.shortName || d.name, sub: d.name })),
  ]), [phases, deliverables]);
  const visible = items.filter((it) => !onlyUnlinked || !original[it.key]);
  const [selected, setSelected] = React.useState<string>(() => (items.find((it) => !original[it.key]) || items[0])?.key || '');
  const sel = items.find((it) => it.key === selected) || null;

  const changes = Object.keys({ ...original, ...choice }).filter((k) => (choice[k] || '') !== (original[k] || ''));
  const taskById = React.useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const usedBy = React.useMemo(() => {
    const m = new Map<string, string[]>();
    items.forEach((it) => { const t = choice[it.key]; if (t) m.set(t, [...(m.get(t) || []), it.name]); });
    return m;
  }, [choice, items]);

  const assign = (taskId: string) => {
    if (!sel) return;
    setChoice((c) => ({ ...c, [sel.key]: taskId }));
    // move on to the next item in the list
    const i = visible.findIndex((it) => it.key === sel.key);
    if (taskId && i >= 0 && i < visible.length - 1) setSelected(visible[i + 1].key);
  };
  const apply = () => {
    const links: Record<string, string> = {}; const phaseLinks: Record<string, string> = {};
    changes.forEach((k) => { if (k.startsWith('d:')) links[k.slice(2)] = choice[k] || ''; else phaseLinks[k.slice(2)] = choice[k] || ''; });
    setBusy(true);
    void onApply(links, phaseLinks).then((ok) => { setBusy(false); if (ok) onClose(); });
  };

  const q = query.trim().toLowerCase();
  const taskList = tasks.filter((t) => !q || taskLabel(t).toLowerCase().includes(q));
  const tag = (it: Item) => {
    const now = choice[it.key] || ''; const was = original[it.key] || '';
    if (now !== was) return now ? (suggestions[it.key]?.taskId === now && !was ? { text: `Suggested ${Math.round(suggestions[it.key].score * 100)}%`, fg: '#B45309', bg: '#FFFBEB' } : { text: 'Changed', fg: C.primary, bg: C.primaryBg }) : { text: 'Unlink', fg: '#B91C1C', bg: '#FEF2F2' };
    return now ? { text: 'Linked', fg: '#047857', bg: C.greenBg } : { text: 'Not linked', fg: C.text3, bg: C.bg2 };
  };
  const colHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: '0.04em', flexShrink: 0 };
  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' };

  return (
    <FormModal title="Link tasks" subtitle="Pick a phase or deliverable on the left, then click its task on the right" onClose={onClose} busy={busy} width={1160}
      footer={<>
        <span style={{ fontSize: 11, color: C.text2 }}>Suggestions are pre-filled from matching names — check them before applying.</span>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
        <Btn disabled={!changes.length || busy} onClick={apply}>{busy ? 'Saving…' : `Apply ${changes.length || ''} change${changes.length === 1 ? '' : 's'}`}</Btn>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 12, height: 'min(64vh, 680px)' }}>
        {/* Left: phases and deliverables */}
        <div style={col}>
          <div style={colHead}>
            <span style={{ flex: 1 }}>PHASES &amp; DELIVERABLES</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, letterSpacing: 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} style={{ accentColor: C.primary }} />Not linked only
            </label>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {visible.map((it) => {
              const t = taskById.get(choice[it.key] || '');
              const tg = tag(it);
              const active = it.key === selected;
              return (
                <button key={it.key} type="button" onClick={() => setSelected(it.key)}
                  style={{ width: '100%', textAlign: 'left', display: 'block', border: 0, borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', fontFamily: F,
                    padding: it.kind === 'phase' ? '10px 12px' : '8px 12px 8px 26px',
                    background: active ? C.primaryBg : it.kind === 'phase' ? '#F8FAFC' : C.white, boxShadow: active ? `inset 3px 0 0 ${C.primary}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: it.kind === 'phase' ? 700 : 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.sub}>
                      {it.kind === 'phase' ? it.name.toUpperCase() : it.name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tg.fg, background: tg.bg, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{tg.text}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t ? C.text2 : C.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t ? <>→ {taskLabel(t)}</> : it.kind === 'phase' ? 'No main task' : 'No task'}
                  </div>
                </button>
              );
            })}
            {!visible.length && <div style={{ padding: 16, fontSize: 13, color: C.text3 }}>Everything is linked.</div>}
          </div>
        </div>

        {/* Right: the plan */}
        <div style={col}>
          <div style={colHead}>
            <span style={{ whiteSpace: 'nowrap' }}>TASKS (WBS)</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks"
              style={{ flex: 1, minWidth: 0, height: 28, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 8px', fontFamily: F, fontSize: 13, fontWeight: 400, letterSpacing: 0, background: C.white }} />
          </div>
          {sel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text2, flexShrink: 0 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Linking <strong style={{ color: C.text }}>{sel.name}</strong>{sel.kind === 'phase' ? ' — main tasks only' : ''}
              </span>
              {choice[sel.key] && <button type="button" onClick={() => assign('')} style={{ border: 0, background: 'transparent', color: '#B91C1C', fontFamily: F, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Unlink</button>}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {taskList.map((t) => {
              const depth = Math.max(0, String(t.wbs || '').split('.').filter(Boolean).length - 1);
              const disabled = !sel || (sel.kind === 'phase' && !!t.parentId);
              const picked = !!sel && choice[sel.key] === t.id;
              const users = usedBy.get(t.id) || [];
              return (
                <button key={t.id} type="button" disabled={disabled} onClick={() => assign(t.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, borderBottom: `1px solid ${C.bg2}`, fontFamily: F,
                    padding: `6px 12px 6px ${12 + depth * 18}px`, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
                    background: picked ? C.primaryBg : C.white, boxShadow: picked ? `inset 3px 0 0 ${C.primary}` : 'none' }}>
                  <span style={{ fontSize: 11, color: C.text3, minWidth: 34 }}>{t.wbs}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: depth === 0 ? 700 : 400, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.taskName}</span>
                  {users.length > 0 && <span title={users.join(', ')} style={{ fontSize: 10, fontWeight: 700, color: C.primary, background: C.primaryBg, padding: '1px 6px', borderRadius: 999, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{users.join(', ')}</span>}
                  {picked && <CheckCircle2 size={14} color={C.primary} />}
                </button>
              );
            })}
            {!taskList.length && <div style={{ padding: 16, fontSize: 13, color: C.text3 }}>No tasks match.</div>}
          </div>
        </div>
      </div>
    </FormModal>
  );
}

/** Gate checklist: deliverables complete, tasks under the phase done. */
function GateChecks({ deliverables, deliverableTotal, tasks }: { deliverables: number; deliverableTotal: number; tasks: { total: number; done: number } | null }) {
  const item = (ok: boolean, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: ok ? '#047857' : C.text2 }}>
      {ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}{text}
    </span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 4 }}>
      {item(deliverables === deliverableTotal, `Deliverables ${deliverables}/${deliverableTotal}`)}
      {tasks ? item(tasks.done === tasks.total, `Tasks ${tasks.done}/${tasks.total}`) : <span style={{ fontSize: 11, color: C.text3 }}>No phase task linked</span>}
    </div>
  );
}

type TreeNode = { key: string; parentKey: string | null; taskName: string };

/** Build Phase → Step (→ Deliverable) tasks from the methodology and link them. */
function CreateTasksModal({ phases, stepsOf, deliverablesOfStep, looseDeliverables, linkedPhases, hasTasks, onClose, onCreate }: {
  phases: MethodPhase[]; stepsOf: (phaseId: string) => { id: string; name: string }[]; deliverablesOfStep: (stepId: string) => MethodDeliverable[];
  looseDeliverables: (phaseId: string) => MethodDeliverable[]; linkedPhases: Set<string>; hasTasks: boolean; onClose: () => void;
  onCreate: (nodes: TreeNode[], deliverableKeys: Record<string, string>, phaseKeys: Record<string, string>) => Promise<void>;
}) {
  const [detail, setDetail] = React.useState<'steps' | 'deliverables'>('deliverables');
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(phases.filter((p) => !linkedPhases.has(p.id)).map((p) => p.id)));
  const [busy, setBusy] = React.useState(false);
  const plan = React.useMemo(() => {
    const nodes: TreeNode[] = []; const deliverableKeys: Record<string, string> = {}; const phaseKeys: Record<string, string> = {};
    phases.forEach((p) => {
      if (!picked.has(p.id)) return;
      const pk = `p:${p.id}`;
      nodes.push({ key: pk, parentKey: null, taskName: p.name });
      phaseKeys[p.id] = pk;
      stepsOf(p.id).forEach((st) => {
        const sk = `s:${st.id}`;
        nodes.push({ key: sk, parentKey: pk, taskName: st.name });
        deliverablesOfStep(st.id).forEach((d) => {
          if (detail === 'deliverables') {
            const dk = `d:${d.id}`;
            nodes.push({ key: dk, parentKey: sk, taskName: d.name });
            deliverableKeys[d.id] = dk;
          } else deliverableKeys[d.id] = sk;
        });
      });
      looseDeliverables(p.id).forEach((d) => {
        const dk = `d:${d.id}`;
        nodes.push({ key: dk, parentKey: pk, taskName: d.name });
        deliverableKeys[d.id] = dk;
      });
    });
    return { nodes, deliverableKeys, phaseKeys };
  }, [picked, detail]); // eslint-disable-line react-hooks/exhaustive-deps

  const radio = (value: 'steps' | 'deliverables', title: string, sub: string) => (
    <label style={{ flex: 1, display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${detail === value ? C.primary : C.border}`, background: detail === value ? C.primaryBg : C.white }}>
      <input type="radio" name="detail" checked={detail === value} onChange={() => setDetail(value)} style={{ accentColor: C.primary, marginTop: 2 }} />
      <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>{title}</span><span style={{ fontSize: 11, color: C.text2 }}>{sub}</span></span>
    </label>
  );
  return (
    <FormModal title="Create tasks from the methodology" subtitle="Tasks are added after the existing plan, without dates — then set dates and resources in Tasks" onClose={onClose} busy={busy} width={720}
      footer={<>
        <span style={{ fontSize: 11, color: C.text2 }}>{plan.nodes.length} tasks · deliverables and phase gates are linked automatically</span>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn disabled={!plan.nodes.length || busy} onClick={() => {
          setBusy(true);
          void onCreate(plan.nodes, plan.deliverableKeys, plan.phaseKeys)
            .then(() => onClose())
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not create the tasks'))
            .finally(() => setBusy(false));
        }}>{busy ? 'Creating…' : `Create ${plan.nodes.length} tasks`}</Btn>
      </>}>
      {hasTasks && <div style={{ fontSize: 13, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>This project already has tasks. New tasks go after them; phases already linked to a task are unticked. To link existing tasks instead, use “Link tasks”.</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {radio('deliverables', 'Phases, steps and deliverables', 'A task for each deliverable, under its step')}
        {radio('steps', 'Phases and steps', 'Deliverables link to their step task')}
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {phases.map((p, i) => {
          const steps = stepsOf(p.id);
          const dels = steps.reduce((n, st) => n + deliverablesOfStep(st.id).length, 0) + looseDeliverables(p.id).length;
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} style={{ accentColor: C.primary }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{i + 1}. {p.name}</span>
              <span style={{ fontSize: 11, color: C.text2 }}>{steps.length} steps · {dels} deliverables</span>
              {linkedPhases.has(p.id) && <span style={{ fontSize: 11, fontWeight: 600, color: '#047857', background: C.greenBg, padding: '0 6px', borderRadius: 999 }}>Linked</span>}
            </label>
          );
        })}
      </div>
    </FormModal>
  );
}

