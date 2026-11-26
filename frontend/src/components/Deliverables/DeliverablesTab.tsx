import React from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileDown, FileText, Lock, PenLine } from 'lucide-react';
import SignoffFormModal from '../Documents/SignoffFormModal';
import { useStore } from '../../store';
import { supabase } from '../../services/supabase';
import type { SignoffForm } from '../../utils/companyDocs';
import { Btn, C, Modal } from '../Common';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import {
  OWNER_INFO, STATUS_INFO, currentPhase, isComplete, methodologyApi, statusesFor,
  type DeliverableStatus, type MethodDeliverable, type Methodology, type Owner, type PhaseGate, type ProjectDeliverable,
} from '../../services/methodology';

const F = 'Poppins, sans-serif';
const today = () => new Date().toISOString().slice(0, 10);

/** Project › Delivery › Deliverables: the methodology's documents per phase, their status, and the phase gates. */
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

  return (
    <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
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
                      {list.map((d) => {
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
                                ? <input type="date" value={st?.dueDate || ''} onChange={(e) => void save(d, { dueDate: e.target.value || null })} aria-label={`${d.name} due date`} style={{ ...input, width: '100%' }} />
                                : st?.dueDate || '—'}
                            </td>
                            <td style={cell}>
                              {canWrite
                                ? <input type="date" value={st?.completedDate || ''} onChange={(e) => void save(d, { completedDate: e.target.value || null })} aria-label={`${d.name} completed date`} style={{ ...input, width: '100%' }} />
                                : st?.completedDate || '—'}
                            </td>
                            <td style={cell}>
                              <LinkCell value={st?.link || ''} editable={canWrite} onSave={(link) => void save(d, { link })} label={d.name} />
                            </td>
                          </tr>
                        );
                      })}
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
                        ? `Passed${gate?.passedAt ? ` on ${new Date(gate.passedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
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
