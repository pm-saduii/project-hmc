import React from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Btn, C, Modal } from '../../../components/Common';
import { AdminHeader, FormModal, Pill, Switch, fieldLabel, hint, input, panel, td, th } from '../../../components/Admin/AdminUi';
import { OWNER_INFO, methodologyApi, type MethodDeliverable, type MethodPhase, type Methodology, type Owner } from '../../../services/methodology';
import { linkBtn } from './LookupListPage';

type Mode = 'phases' | 'deliverables';

/** Settings › Methodology: phases and gates, and the deliverables (with their template links). */
export default function MethodologySettingsPage({ mode, eyebrow }: { mode: Mode; eyebrow: string }) {
  const [method, setMethod] = React.useState<Methodology | null>(null);
  const [usage, setUsage] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState('');
  const [phase, setPhase] = React.useState<MethodPhase | null>(null);
  const [deliverable, setDeliverable] = React.useState<(Partial<MethodDeliverable> & { isNew?: boolean }) | null>(null);
  const [deleting, setDeleting] = React.useState<MethodDeliverable | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [m, u] = await Promise.all([methodologyApi.load(), methodologyApi.deliverableUsage()]);
      setMethod(m); setUsage(u); setError('');
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

  if (mode === 'phases') {
    return (
      <>
        <AdminHeader eyebrow={eyebrow} title="Phases & Gates" description="The five phases of the implementation methodology and the gate each must pass. Projects track them in Delivery › Deliverables." />
        <section style={{ ...panel, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, width: 60 }}>#</th><th style={th}>Phase</th><th style={th}>Gate</th><th style={th}>Deliverables</th><th style={{ ...th, width: 80 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {phases.map((p, i) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <td style={{ ...td, color: C.text3 }}>{i + 1}</td>
                  <td style={td}><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: C.text2 }}>{p.description}</div></td>
                  <td style={{ ...td, color: C.text2 }}>{p.gate}</td>
                  <td style={{ ...td, color: C.text2 }}>{method.deliverables.filter((d) => d.phaseId === p.id && d.active).length}</td>
                  <td style={{ ...td, textAlign: 'right' }}><button type="button" onClick={() => setPhase({ ...p })} style={linkBtn(C.primary)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {phase && (
          <FormModal title="Edit phase" subtitle={phase.id} onClose={() => setPhase(null)} busy={busy}
            footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={() => setPhase(null)} disabled={busy}>Cancel</Btn>
              <Btn onClick={() => void run(() => methodologyApi.savePhase(phase), 'Saved').then((ok) => ok && setPhase(null))} disabled={busy || !phase.name.trim()}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
            <label style={fieldLabel}>Name<input value={phase.name} onChange={(e) => setPhase({ ...phase, name: e.target.value })} style={input} /></label>
            <label style={fieldLabel}>Description<input value={phase.description} onChange={(e) => setPhase({ ...phase, description: e.target.value })} style={input} /></label>
            <label style={fieldLabel}>Gate
              <textarea rows={3} value={phase.gate} onChange={(e) => setPhase({ ...phase, gate: e.target.value })} style={{ ...input, height: 'auto', padding: '10px 12px', lineHeight: 1.5 }} />
              <span style={hint}>What must be true before a project leaves this phase.</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13 }}>
              <span><strong>Active</strong><br /><span style={{ fontSize: 11, color: C.text2 }}>Inactive phases are hidden from projects.</span></span>
              <Switch checked={phase.active} onChange={(v) => setPhase({ ...phase, active: v })} label="Active" />
            </label>
          </FormModal>
        )}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead><tr><th style={th}>Deliverable</th><th style={th}>Phase › Step</th><th style={th}>Owner</th><th style={th}>Template</th><th style={th}>Used by</th><th style={th}>Active</th><th style={{ ...th, width: 70 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
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
              ))}
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
