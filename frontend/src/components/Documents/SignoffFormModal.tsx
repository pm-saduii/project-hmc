import React from 'react';
import toast from 'react-hot-toast';
import { FileText, Plus, X } from 'lucide-react';
import { Btn, C } from '../Common';
import { FormModal, fieldLabel, hint, input } from '../Admin/AdminUi';
import { contactsFromMembers, defaultSignoffForm, downloadSignoff, type Participant, type SignoffForm } from '../../utils/companyDocs';
import type { Member, Project } from '../../types';

const area: React.CSSProperties = { ...input, height: 'auto', padding: '8px 12px', lineHeight: 1.5, resize: 'vertical' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };

/** Fill in the company Project Deliverable Sign-off v1.3 for one deliverable and download it as Word. */
export default function SignoffFormModal({ project, deliverableName, phaseName, members, saved, signedDate, canEdit, onSave, onClose }: {
  project: Project; deliverableName: string; phaseName: string; members: Member[]; saved: Partial<SignoffForm> | null;
  signedDate: string | null; canEdit: boolean; onSave: (form: SignoffForm) => Promise<boolean>; onClose: () => void;
}) {
  const [form, setForm] = React.useState<SignoffForm>(() => ({ ...defaultSignoffForm(project, deliverableName, phaseName, members), ...(saved || {}) } as SignoffForm));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof SignoffForm>(k: K, v: SignoffForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ro = !canEdit;

  const run = async (download: boolean) => {
    setBusy(true);
    try {
      if (canEdit && !(await onSave(form))) return;
      if (download) { await downloadSignoff(project, deliverableName, form, contactsFromMembers(members), signedDate); toast.success('Sign-off downloaded'); }
      else { toast.success('Saved'); onClose(); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the document'); }
    finally { setBusy(false); }
  };

  const people = (key: 'clientParticipants' | 'hmcParticipants', title: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</span>
      {form[key].map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 6 }}>
          <input value={p.name} readOnly={ro} placeholder="Name" aria-label={`${title} ${i + 1} name`} style={{ ...input, height: 32 }}
            onChange={(e) => set(key, form[key].map((q, k) => (k === i ? { ...q, name: e.target.value } : q)))} />
          <input value={p.title} readOnly={ro} placeholder="Title" aria-label={`${title} ${i + 1} title`} style={{ ...input, height: 32 }}
            onChange={(e) => set(key, form[key].map((q, k) => (k === i ? { ...q, title: e.target.value } : q)))} />
          {canEdit && <button type="button" aria-label="Remove" onClick={() => set(key, form[key].filter((_, k) => k !== i))}
            style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 6, cursor: 'pointer', color: C.text2, display: 'grid', placeItems: 'center' }}><X size={14} /></button>}
        </div>
      ))}
      {canEdit && <button type="button" onClick={() => set(key, [...form[key], { name: '', title: '' } as Participant])}
        style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}><Plus size={14} />Add person</button>}
    </div>
  );

  return (
    <FormModal title={`Sign-off · ${deliverableName}`} subtitle="Project Deliverable Sign-off · company template v1.3" onClose={onClose} busy={busy} width={820}
      footer={<>
        <span style={{ ...hint, maxWidth: 380 }}>{signedDate ? `The signing date (${signedDate}) is the deliverable's completed date.` : 'Signing dates are left blank until the deliverable is Signed.'}</span>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
        {canEdit && <Btn variant="outline" onClick={() => void run(false)} disabled={busy}>Save</Btn>}
        <Btn onClick={() => void run(true)} disabled={busy}><FileText size={14} style={{ marginRight: 6 }} />{busy ? 'Working…' : canEdit ? 'Save & download Word' : 'Download Word'}</Btn>
      </>}>
      <div style={grid}>
        <label style={fieldLabel}>Document no.<input value={form.documentNo} readOnly={ro} onChange={(e) => set('documentNo', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Application<input value={form.application} readOnly={ro} onChange={(e) => set('application', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Module<input value={form.module} readOnly={ro} onChange={(e) => set('module', e.target.value)} style={input} placeholder="All modules in scope" /></label>
        <label style={fieldLabel}>Project model<input value={form.projectModel} readOnly={ro} onChange={(e) => set('projectModel', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Place of service<input value={form.place} readOnly={ro} onChange={(e) => set('place', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Phase<input value={form.phase} readOnly={ro} onChange={(e) => set('phase', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Start date<input type="date" value={form.start} readOnly={ro} onChange={(e) => set('start', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Completion date<input type="date" value={form.end} readOnly={ro} onChange={(e) => set('end', e.target.value)} style={input} /></label>
      </div>
      <label style={fieldLabel}>Brief description of services<textarea rows={2} value={form.description} readOnly={ro} onChange={(e) => set('description', e.target.value)} style={area} /></label>
      <label style={fieldLabel}>Deliverables<textarea rows={3} value={form.deliverables} readOnly={ro} onChange={(e) => set('deliverables', e.target.value)} style={area} />
        <span style={hint}>One per line.</span>
      </label>
      <div style={grid}>
        {people('clientParticipants', 'Client participants')}
        {people('hmcParticipants', 'HUMANICA participants')}
      </div>
      <div style={hint}>Signatories (Project Manager and Project Sponsor on each side) come from the project's Members list.</div>
    </FormModal>
  );
}
