import React from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { Btn, C, Modal } from '../../../components/Common';
import { AdminHeader, FormModal, Pill, Switch, fieldLabel, hint, input, panel, td, th } from '../../../components/Admin/AdminUi';
import { OWNER_INFO, hasGate, methodologyApi, type MethodDeliverable, type MethodPhase, type MethodStep, type Methodology, type Owner } from '../../../services/methodology';
import { PHASE_ICONS, PhaseIconBadge, phaseColor } from '../../../components/Methodology/MethodBoard';
import { linkBtn } from './LookupListPage';

type Mode = 'phases' | 'steps' | 'deliverables';
const CODE_RE = /^[A-Z0-9_]{2,16}$/;

/** Move item `index` of an ordered group up or down; returns the rows whose sort order changes (10, 20, 30 …). */
function reorder<T extends { id: string; sortOrder: number }>(group: T[], index: number, dir: -1 | 1): { id: string; sortOrder: number }[] {
  const j = index + dir;
  if (j < 0 || j >= group.length) return [];
  const next = [...group];
  [next[index], next[j]] = [next[j], next[index]];
  return next.map((x, k) => ({ id: x.id, sortOrder: (k + 1) * 10 })).filter((x) => group.find((g) => g.id === x.id)?.sortOrder !== x.sortOrder);
}
const arrowBtn = (disabled: boolean): React.CSSProperties => ({ width: 26, height: 26, display: 'inline-grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: disabled ? C.border2 : C.text2, cursor: disabled ? 'default' : 'pointer', padding: 0 });
function MoveButtons({ index, count, onMove, disabled }: { index: number; count: number; onMove: (dir: -1 | 1) => void; disabled?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button type="button" aria-label="Move up" disabled={disabled || index === 0} onClick={() => onMove(-1)} style={arrowBtn(!!disabled || index === 0)}><ArrowUp size={13} /></button>
      <button type="button" aria-label="Move down" disabled={disabled || index === count - 1} onClick={() => onMove(1)} style={arrowBtn(!!disabled || index === count - 1)}><ArrowDown size={13} /></button>
    </span>
  );
}

/** Settings › Methodology: phases and gates, and the deliverables (with their template links). */
export default function MethodologySettingsPage({ mode, eyebrow }: { mode: Mode; eyebrow: string }) {
  const [method, setMethod] = React.useState<Methodology | null>(null);
  const [usage, setUsage] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState('');
  const [phase, setPhase] = React.useState<(MethodPhase & { isNew?: boolean }) | null>(null);
  const [step, setStep] = React.useState<(Partial<MethodStep> & { isNew?: boolean; activitiesText?: string }) | null>(null);
  const [phaseUse, setPhaseUse] = React.useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = React.useState<{ title: string; text: string; run: () => Promise<void> } | null>(null);
  const [deliverable, setDeliverable] = React.useState<(Partial<MethodDeliverable> & { isNew?: boolean }) | null>(null);
  const [deleting, setDeleting] = React.useState<MethodDeliverable | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [m, u, pu] = await Promise.all([methodologyApi.load(), methodologyApi.deliverableUsage(), methodologyApi.phaseUsage()]);
      setMethod(m); setUsage(u); setPhaseUse(pu); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load'); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <div style={{ ...panel, padding: 18, color: C.red, fontSize: 13 }}>{/relation|schema cache/i.test(error) ? 'Run the migration 2026-11-27-methodology-and-budget-control.sql first.' : error}</div>;
  if (!method) return <div style={{ fontSize: 13, color: C.text2 }}>Loading…</div>;
  const phases = [...method.phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const phaseName = (id: string) => phases.find((p) => p.id === id)?.name || id;
  const stepName = (id: string | null) => method.steps.find((s) => s.id === id)?.name || '—';

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); return true; } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); return false; } finally { setBusy(false); }
  };

  const move = (rows: { id: string; sortOrder: number }[], save: (r: { id: string; sortOrder: number }) => Promise<void>) => {
    if (!rows.length) return;
    void run(async () => { for (const r of rows) await save(r); }, 'Order saved');
  };
  const deleteModal = confirmDelete && (
    <Modal title={confirmDelete.title} onClose={() => !busy && setConfirmDelete(null)} width={420} closeOnBackdrop={false}>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px' }}>{confirmDelete.text}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</Btn>
        <Btn variant="danger" disabled={busy} onClick={() => void run(confirmDelete.run, 'Deleted').then((ok) => { if (ok) { setConfirmDelete(null); setPhase(null); setStep(null); } })}>{busy ? 'Deleting…' : 'Delete'}</Btn>
      </div>
    </Modal>
  );

  if (mode === 'steps') {
    const stepsOf = (phaseId: string) => method.steps.filter((x) => x.phaseId === phaseId).sort((a, b) => a.sortOrder - b.sortOrder);
    const delCount = (stepId: string) => method.deliverables.filter((d) => d.stepId === stepId).length;
    const st = step;
    const saveStep = async () => {
      if (!st) return;
      const id = String(st.id || '').trim().toUpperCase();
      if (!CODE_RE.test(id)) { toast.error('Code: 2–16 letters, digits or _'); return; }
      if (st.isNew && method.steps.some((x) => x.id === id)) { toast.error(`Code ${id} already exists`); return; }
      if (!String(st.name || '').trim()) { toast.error('Enter a name'); return; }
      const moved = !st.isNew && method.steps.find((x) => x.id === id)?.phaseId !== st.phaseId;
      const payload: Partial<MethodStep> & { id: string } = {
        id, phaseId: st.phaseId, name: String(st.name).trim(), owner: (st.owner || 'HMC') as Owner, objective: String(st.objective || '').trim(),
        activities: String(st.activitiesText || '').split('\n').map((x) => x.trim()).filter(Boolean),
        sortOrder: st.isNew || moved ? Math.max(0, ...stepsOf(String(st.phaseId)).map((x) => x.sortOrder)) + 10 : st.sortOrder,
      };
      const ok = await run(async () => {
        await methodologyApi.saveStep(payload);
        // Deliverables of a step that moves go with it to the new phase
        if (moved) for (const d of method.deliverables.filter((x) => x.stepId === id)) await methodologyApi.saveDeliverable({ id: d.id, phaseId: payload.phaseId });
      }, st.isNew ? 'Step added' : 'Saved');
      if (ok) setStep(null);
    };
    return (
      <>
        <AdminHeader eyebrow={eyebrow} title="Steps" description="What the team does in each phase. Steps show as the bullets on the Methodology board; their checklist opens when a step is clicked."
          actions={<Btn onClick={() => setStep({ isNew: true, phaseId: phases[0]?.id, owner: 'HMC', activitiesText: '' })}><Plus size={14} style={{ marginRight: 6 }} />Add step</Btn>} />
        {phases.map((p, pi) => {
          const list = stepsOf(p.id);
          return (
            <section key={p.id} style={{ ...panel, overflow: 'hidden', opacity: p.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: '#F8FAFC' }}>
                <PhaseIconBadge phase={p} index={pi} size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{String(pi + 1).padStart(2, '0')} · {p.name}</span>
                <button type="button" onClick={() => setStep({ isNew: true, phaseId: p.id, owner: 'HMC', activitiesText: '' })} style={linkBtn(C.primary)}>+ Add step</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {list.length === 0 && <tr><td style={{ ...td, color: C.text3 }}>No steps yet.</td></tr>}
                  {list.map((x, i) => (
                    <tr key={x.id}>
                      <td style={{ ...td, width: 70 }}><MoveButtons index={i} count={list.length} disabled={busy} onMove={(dir) => move(reorder(list, i, dir), (r) => methodologyApi.saveStep(r))} /></td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{x.name} <span style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>{x.id}</span></div>
                        <div style={{ fontSize: 11, color: C.text2 }}>{x.objective || '—'}</div>
                      </td>
                      <td style={{ ...td, width: 90 }}><Pill bg={OWNER_INFO[x.owner].bg} fg={OWNER_INFO[x.owner].fg}>{x.owner}</Pill></td>
                      <td style={{ ...td, width: 130, color: C.text2 }}>{x.activities.length} checklist · {delCount(x.id)} deliv.</td>
                      <td style={{ ...td, width: 60, textAlign: 'right' }}><button type="button" onClick={() => setStep({ ...x, activitiesText: x.activities.join('\n') })} style={linkBtn(C.primary)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        {st && (
          <FormModal title={st.isNew ? 'Add step' : 'Edit step'} subtitle="Methodology" onClose={() => setStep(null)} busy={busy} width={600}
            footer={<>
              {!st.isNew && <button type="button" disabled={delCount(String(st.id)) > 0} title={delCount(String(st.id)) ? 'Move or delete its deliverables first' : undefined}
                onClick={() => setConfirmDelete({ title: 'Delete step', text: `Delete "${st.name}"? This cannot be undone.`, run: () => methodologyApi.deleteStep(String(st.id)) })}
                style={{ ...linkBtn('#B91C1C'), opacity: delCount(String(st.id)) ? 0.35 : 1 }}>Delete</button>}
              <span style={{ marginLeft: 'auto' }} />
              <Btn variant="ghost" onClick={() => setStep(null)} disabled={busy}>Cancel</Btn>
              <Btn onClick={() => void saveStep()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
            </>}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
              <label style={fieldLabel}>Code<input value={st.id || ''} disabled={!st.isNew} onChange={(e) => setStep({ ...st, id: e.target.value.toUpperCase() })} style={{ ...input, background: st.isNew ? C.white : C.bg }} placeholder="e.g. PS5" /></label>
              <label style={fieldLabel}>Name<input value={st.name || ''} onChange={(e) => setStep({ ...st, name: e.target.value })} style={input} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={fieldLabel}>Phase
                <select value={st.phaseId || ''} onChange={(e) => setStep({ ...st, phaseId: e.target.value })} style={{ ...input, padding: '0 10px' }}>
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={fieldLabel}>Led by
                <select value={st.owner || 'HMC'} onChange={(e) => setStep({ ...st, owner: e.target.value as Owner })} style={{ ...input, padding: '0 10px' }}>
                  {(Object.keys(OWNER_INFO) as Owner[]).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
            <label style={fieldLabel}>Objective<input value={st.objective || ''} onChange={(e) => setStep({ ...st, objective: e.target.value })} style={input} placeholder="One sentence: what this step achieves" /></label>
            <label style={fieldLabel}>Checklist
              <textarea rows={6} value={st.activitiesText || ''} onChange={(e) => setStep({ ...st, activitiesText: e.target.value })} style={{ ...input, height: 'auto', padding: '10px 12px', lineHeight: 1.5 }} />
              <span style={hint}>One item per line.{!st.isNew ? ' Moving a step to another phase moves its deliverables too.' : ''}</span>
            </label>
          </FormModal>
        )}
        {deleteModal}
      </>
    );
  }

  if (mode === 'phases') {
    return (
      <>
        <AdminHeader eyebrow={eyebrow} title="Phases & Gates" description="The phases of the implementation methodology, their icon and colour on the board, and the gate each must pass. Leave the gate empty for a phase without one (e.g. Hypercare)."
          actions={<Btn onClick={() => setPhase({ isNew: true, id: '', name: '', description: '', gate: '', sortOrder: Math.max(0, ...phases.map((p) => p.sortOrder)) + 10, active: true, icon: 'flag', color: '' })}><Plus size={14} style={{ marginRight: 6 }} />Add phase</Btn>} />
        <section style={{ ...panel, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, width: 70 }}>Order</th><th style={th}>Phase</th><th style={th}>Gate</th><th style={{ ...th, width: 150 }}>Contents</th><th style={{ ...th, width: 70 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {phases.map((p, i) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <td style={td}><MoveButtons index={i} count={phases.length} disabled={busy} onMove={(dir) => move(reorder(phases, i, dir), (r) => methodologyApi.savePhase(r))} /></td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PhaseIconBadge phase={p} index={i} size={34} />
                      <div><div style={{ fontWeight: 600 }}>{String(i + 1).padStart(2, '0')} · {p.name} <span style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>{p.id}</span></div><div style={{ fontSize: 11, color: C.text2 }}>{p.description}</div></div>
                    </div>
                  </td>
                  <td style={{ ...td, color: C.text2 }}>{hasGate(p) ? p.gate : <span style={{ color: C.text3 }}>No gate</span>}</td>
                  <td style={{ ...td, color: C.text2 }}>{method.steps.filter((s) => s.phaseId === p.id).length} steps · {method.deliverables.filter((d) => d.phaseId === p.id && d.active).length} deliv.</td>
                  <td style={{ ...td, textAlign: 'right' }}><button type="button" onClick={() => setPhase({ ...p })} style={linkBtn(C.primary)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {phase && (() => {
          const contents = method.steps.filter((s) => s.phaseId === phase.id).length + method.deliverables.filter((d) => d.phaseId === phase.id).length;
          const blocked = contents > 0 || (phaseUse[phase.id] || 0) > 0;
          const savePhase = async () => {
            const id = phase.id.trim().toUpperCase();
            if (!CODE_RE.test(id)) { toast.error('Code: 2–16 letters, digits or _'); return; }
            if (phase.isNew && phases.some((p) => p.id === id)) { toast.error(`Code ${id} already exists`); return; }
            const { isNew, ...row } = phase;
            void isNew;
            if (await run(() => methodologyApi.savePhase({ ...row, id, name: row.name.trim(), description: row.description.trim(), gate: row.gate.trim() }), phase.isNew ? 'Phase added' : 'Saved')) setPhase(null);
          };
          const color = phaseColor(phase, phases.findIndex((p) => p.id === phase.id));
          return (
            <FormModal title={phase.isNew ? 'Add phase' : 'Edit phase'} subtitle={phase.isNew ? 'Methodology' : phase.id} onClose={() => setPhase(null)} busy={busy} width={620}
              footer={<>
                {!phase.isNew && <button type="button" disabled={blocked} title={blocked ? 'Move its steps and deliverables first; a phase used by projects cannot be deleted — make it inactive instead' : undefined}
                  onClick={() => setConfirmDelete({ title: 'Delete phase', text: `Delete "${phase.name}"? This cannot be undone.`, run: () => methodologyApi.deletePhase(phase.id) })}
                  style={{ ...linkBtn('#B91C1C'), opacity: blocked ? 0.35 : 1 }}>Delete</button>}
                <span style={{ marginLeft: 'auto' }} />
                <Btn variant="ghost" onClick={() => setPhase(null)} disabled={busy}>Cancel</Btn>
                <Btn onClick={() => void savePhase()} disabled={busy || !phase.name.trim()}>{busy ? 'Saving…' : 'Save'}</Btn>
              </>}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <label style={fieldLabel}>Code<input value={phase.id} disabled={!phase.isNew} onChange={(e) => setPhase({ ...phase, id: e.target.value.toUpperCase() })} style={{ ...input, background: phase.isNew ? C.white : C.bg }} placeholder="e.g. HC" /></label>
                <label style={fieldLabel}>Name<input value={phase.name} onChange={(e) => setPhase({ ...phase, name: e.target.value })} style={input} /></label>
              </div>
              <label style={fieldLabel}>Description<input value={phase.description} onChange={(e) => setPhase({ ...phase, description: e.target.value })} style={input} /></label>
              <div style={fieldLabel}>Icon and colour
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {Object.entries(PHASE_ICONS).map(([key, { label, Icon }]) => (
                    <button key={key} type="button" title={label} aria-label={label} aria-pressed={phase.icon === key} onClick={() => setPhase({ ...phase, icon: key })}
                      style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
                        border: phase.icon === key ? `2px solid ${color}` : `1px solid ${C.border}`, background: phase.icon === key ? color : C.white, color: phase.icon === key ? '#FFFFFF' : C.text2 }}>
                      <Icon size={17} />
                    </button>
                  ))}
                  <input type="color" aria-label="Colour" value={color} onChange={(e) => setPhase({ ...phase, color: e.target.value })}
                    style={{ width: 44, height: 36, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, background: C.white, cursor: 'pointer' }} />
                </div>
              </div>
              <label style={fieldLabel}>Gate
                <textarea rows={3} value={phase.gate} onChange={(e) => setPhase({ ...phase, gate: e.target.value })} style={{ ...input, height: 'auto', padding: '10px 12px', lineHeight: 1.5 }} placeholder="Leave empty for no gate" />
                <span style={hint}>What must be true before a project leaves this phase. Empty = no gate (the phase shows no gate box).</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13 }}>
                <span><strong>Active</strong><br /><span style={{ fontSize: 11, color: C.text2 }}>Inactive phases are hidden from projects.</span></span>
                <Switch checked={phase.active} onChange={(v) => setPhase({ ...phase, active: v })} label="Active" />
              </label>
            </FormModal>
          );
        })()}
        {deleteModal}
      </>
    );
  }

  const list = [...method.deliverables].sort((a, b) => phases.findIndex((p) => p.id === a.phaseId) - phases.findIndex((p) => p.id === b.phaseId) || a.sortOrder - b.sortOrder);
  const d = deliverable;
  const stepsOf = (phaseId?: string) => method.steps.filter((s) => s.phaseId === phaseId).sort((a, b) => a.sortOrder - b.sortOrder);
  const saveDeliverable = async () => {
    if (!d) return;
    const id = String(d.id || '').trim().toUpperCase();
    if (!id || !/^[A-Z0-9_]{2,16}$/.test(id)) { toast.error('Code: 2–16 letters, digits or _'); return; }
    if (d.isNew && method.deliverables.some((x) => x.id === id)) { toast.error(`Code ${id} already exists`); return; }
    if (!String(d.name || '').trim()) { toast.error('Enter a name'); return; }
    const url = String(d.templateUrl || '').trim();
    if (url && !/^https?:\/\//i.test(url)) { toast.error('The template link must start with http:// or https://'); return; }
    const sameStep = method.deliverables.filter((x) => x.phaseId === d.phaseId);
    const payload: Partial<MethodDeliverable> & { id: string } = {
      id, phaseId: d.phaseId, stepId: d.stepId || null, name: String(d.name).trim(), shortName: String(d.shortName || '').trim(),
      format: String(d.format || '').trim(), templateUrl: url, requiresSignoff: !!d.requiresSignoff, internalOnly: !!d.internalOnly,
      owner: (d.owner || 'HMC') as Owner, active: d.active ?? true,
      sortOrder: d.sortOrder ?? (Math.max(0, ...sameStep.map((x) => x.sortOrder)) + 10),
    };
    if (await run(() => methodologyApi.saveDeliverable(payload), d.isNew ? 'Deliverable added' : 'Saved')) setDeliverable(null);
  };

  return (
    <>
      <AdminHeader eyebrow={eyebrow} title="Deliverables" description="Documents every project delivers, by phase. Link each one to its standard template so teams always start from the right form."
        actions={<Btn onClick={() => setDeliverable({ isNew: true, phaseId: phases[0]?.id, owner: 'HMC', active: true })}><Plus size={14} style={{ marginRight: 6 }} />Add deliverable</Btn>} />
      <section style={{ ...panel, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead><tr><th style={{ ...th, width: 70 }}>Order</th><th style={th}>Deliverable</th><th style={th}>Phase › Step</th><th style={th}>Owner</th><th style={th}>Template</th><th style={th}>Used by</th><th style={th}>Active</th><th style={{ ...th, width: 70 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {list.map((x) => {
                const group = list.filter((y) => y.phaseId === x.phaseId);
                const gi = group.findIndex((y) => y.id === x.id);
                return (
                <tr key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
                  <td style={td}><MoveButtons index={gi} count={group.length} disabled={busy} onMove={(dir) => move(reorder(group, gi, dir), (r) => methodologyApi.saveDeliverable(r))} /></td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{x.name} <span style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>{x.id}</span></div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                      {x.requiresSignoff && <Pill bg={C.greenBg} fg="#047857">Sign-off</Pill>}
                      {x.internalOnly && <Pill bg={C.bg2} fg={C.text2}>Internal</Pill>}
                      {x.format && <span style={{ fontSize: 11, color: C.text3 }}>{x.format}</span>}
                    </div>
                  </td>
                  <td style={{ ...td, color: C.text2 }}>{phaseName(x.phaseId)} › {stepName(x.stepId)}</td>
                  <td style={td}><Pill bg={OWNER_INFO[x.owner].bg} fg={OWNER_INFO[x.owner].fg}>{x.owner}</Pill></td>
                  <td style={td}>{x.templateUrl ? <a href={x.templateUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>Open</a> : <span style={{ color: '#B45309', fontSize: 11 }}>Not linked</span>}</td>
                  <td style={{ ...td, color: C.text2 }}>{usage[x.id] ? `${usage[x.id]} project${usage[x.id] > 1 ? 's' : ''}` : 'Not used'}</td>
                  <td style={td}><Switch checked={x.active} label={`${x.name} active`} onChange={(v) => void run(() => methodologyApi.saveDeliverable({ id: x.id, active: v }), v ? 'Activated' : 'Deactivated')} /></td>
                  <td style={{ ...td, textAlign: 'right' }}><button type="button" onClick={() => setDeliverable({ ...x })} style={linkBtn(C.primary)}>Edit</button></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div style={hint}>A deliverable used by projects cannot be deleted — make it inactive instead.</div>

      {d && (
        <FormModal title={d.isNew ? 'Add deliverable' : 'Edit deliverable'} subtitle="Methodology" onClose={() => setDeliverable(null)} busy={busy} width={600}
          footer={<>
            {!d.isNew && <button type="button" disabled={!!usage[String(d.id)]} title={usage[String(d.id)] ? 'Used by projects — make it inactive instead' : undefined}
              onClick={() => setDeleting(method.deliverables.find((x) => x.id === d.id) || null)} style={{ ...linkBtn('#B91C1C'), opacity: usage[String(d.id)] ? 0.35 : 1 }}>Delete</button>}
            <span style={{ marginLeft: 'auto' }} />
            <Btn variant="ghost" onClick={() => setDeliverable(null)} disabled={busy}>Cancel</Btn>
            <Btn onClick={() => void saveDeliverable()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
          </>}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <label style={fieldLabel}>Code<input value={d.id || ''} disabled={!d.isNew} onChange={(e) => setDeliverable({ ...d, id: e.target.value.toUpperCase() })} style={{ ...input, background: d.isNew ? C.white : C.bg }} placeholder="e.g. CHR" /></label>
            <label style={fieldLabel}>Name<input value={d.name || ''} onChange={(e) => setDeliverable({ ...d, name: e.target.value })} style={input} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={fieldLabel}>Phase
              <select value={d.phaseId || ''} onChange={(e) => setDeliverable({ ...d, phaseId: e.target.value, stepId: null })} style={{ ...input, padding: '0 10px' }}>
                {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label style={fieldLabel}>Step
              <select value={d.stepId || ''} onChange={(e) => setDeliverable({ ...d, stepId: e.target.value || null })} style={{ ...input, padding: '0 10px' }}>
                <option value="">—</option>
                {stepsOf(d.phaseId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={fieldLabel}>Short name<input value={d.shortName || ''} onChange={(e) => setDeliverable({ ...d, shortName: e.target.value })} style={input} placeholder="Shown in gate lists" /></label>
            <label style={fieldLabel}>Default owner
              <select value={d.owner || 'HMC'} onChange={(e) => setDeliverable({ ...d, owner: e.target.value as Owner })} style={{ ...input, padding: '0 10px' }}>
                {(Object.keys(OWNER_INFO) as Owner[]).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <label style={fieldLabel}>Format<input value={d.format || ''} onChange={(e) => setDeliverable({ ...d, format: e.target.value })} style={input} placeholder="e.g. Word v1.3" /></label>
          <label style={fieldLabel}>Template link
            <input value={d.templateUrl || ''} onChange={(e) => setDeliverable({ ...d, templateUrl: e.target.value })} style={input} placeholder="https://… (SharePoint, Google Drive, …)" />
            <span style={hint}>The standard template; shown on the Methodology page and in every project's Deliverables.</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([['requiresSignoff', 'Needs the customer\'s sign-off', 'Completed at "Signed" instead of "Final".'], ['internalOnly', 'Internal only', 'Hidden from client users.'], ['active', 'Active', 'Inactive deliverables are hidden from projects.']] as const).map(([key, title, desc]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13 }}>
                <span><strong>{title}</strong><br /><span style={{ fontSize: 11, color: C.text2 }}>{desc}</span></span>
                <Switch checked={key === 'active' ? d.active ?? true : !!d[key]} onChange={(v) => setDeliverable({ ...d, [key]: v })} label={title} />
              </label>
            ))}
          </div>
        </FormModal>
      )}

      {deleting && (
        <Modal title="Delete deliverable" onClose={() => !busy && setDeleting(null)} width={420} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px' }}>Delete "{deleting.name}"? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Btn>
            <Btn variant="danger" disabled={busy} onClick={() => void run(() => methodologyApi.deleteDeliverable(deleting.id), 'Deleted').then((ok) => { if (ok) { setDeleting(null); setDeliverable(null); } })}>{busy ? 'Deleting…' : 'Delete'}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
