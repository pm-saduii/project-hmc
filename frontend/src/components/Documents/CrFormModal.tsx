import React from 'react';
import toast from 'react-hot-toast';
import { FileText } from 'lucide-react';
import { Btn, C, Input } from '../Common';
import { FormModal, fieldLabel, hint, input } from '../Admin/AdminUi';
import { supabase } from '../../services/supabase';
import { CR_MILESTONES, CR_MODULES, contactsFromMembers, defaultCrForm, downloadCrForm, type CrForm } from '../../utils/companyDocs';
import type { ChangeRequest, CRItem, Member, Project } from '../../types';

type CR = ChangeRequest & { items?: CRItem[]; form?: Partial<CrForm> | null };
const F = 'Poppins, sans-serif';
const area: React.CSSProperties = { ...input, height: 'auto', padding: '8px 12px', lineHeight: 1.5, resize: 'vertical' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const section = (title: string) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: C.text2, borderBottom: `1px solid ${C.border}`, paddingBottom: 4, marginTop: 4 }}>{title}</div>;

/** Fill in the company Change Request Form v1.4 for one CR, save it with the CR, and download it as Word. */
export default function CrFormModal({ cr, project, members, canEdit, onClose, onSaved }: {
  cr: CR; project: Project; members: Member[]; canEdit: boolean; onClose: () => void; onSaved: (form: CrForm) => void;
}) {
  const [form, setForm] = React.useState<CrForm>(() => ({ ...defaultCrForm(cr), ...(cr.form || {}) } as CrForm));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof CrForm>(k: K, v: CrForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const contacts = contactsFromMembers(members);
  const total = form.manday.sa + form.manday.dev + form.manday.qa + form.manday.imp;

  const save = async (): Promise<boolean> => {
    if (!canEdit) return true;
    const { error } = await supabase.from('change_requests').update({ form }).eq('id', cr.id);
    if (error) {
      toast.error(/column .*form/i.test(error.message) ? 'Run the migration 2026-11-28-document-forms.sql to save CR forms.' : error.message);
      return false;
    }
    onSaved(form);
    return true;
  };
  const run = async (download: boolean) => {
    setBusy(true);
    try {
      if (!(await save())) return;
      if (download) { await downloadCrForm(project, cr, form, contacts); toast.success('CR form downloaded'); }
      else { toast.success('Saved'); onClose(); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the document'); }
    finally { setBusy(false); }
  };

  const ro = !canEdit;
  const text = (k: keyof CrForm, label: string, rows = 3, placeholder = '') => (
    <label style={fieldLabel}>{label}<textarea rows={rows} value={String(form[k] || '')} readOnly={ro} placeholder={placeholder} onChange={(e) => set(k, e.target.value as never)} style={area} /></label>
  );

  return (
    <FormModal title={`Change Request Form · ${cr.crId}`} subtitle={`${cr.title} · company template v1.4`} onClose={onClose} busy={busy} width={920}
      footer={<>
        <span style={{ ...hint, maxWidth: 420 }}>Client, job code, request date, status and decision date come from the project and the CR. Signatories come from the Members list (Project Sponsor / Project Manager).</span>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
        {canEdit && <Btn variant="outline" onClick={() => void run(false)} disabled={busy}>Save</Btn>}
        <Btn onClick={() => void run(true)} disabled={busy}><FileText size={14} style={{ marginRight: 6 }} />{busy ? 'Working…' : canEdit ? 'Save & download Word' : 'Download Word'}</Btn>
      </>}>
      {section('GENERAL')}
      <div style={grid2}>
        <label style={fieldLabel}>Service type
          <select value={form.serviceType} disabled={ro} onChange={(e) => set('serviceType', e.target.value as CrForm['serviceType'])} style={{ ...input, padding: '0 10px' }}>
            <option>Chargeable</option><option>Non-chargeable</option>
          </select>
        </label>
        <label style={fieldLabel}>Prepared by<input value={form.preparedBy} readOnly={ro} onChange={(e) => set('preparedBy', e.target.value)} style={input} /></label>
        <label style={fieldLabel}>Project model<input value={form.projectModel} readOnly={ro} onChange={(e) => set('projectModel', e.target.value)} style={input} placeholder="e.g. Cloud" /></label>
        <label style={fieldLabel}>Expected finish date<Input type="date" value={form.expectedFinish} disabled={ro} onChange={(v) => set('expectedFinish', v)} /></label>
      </div>

      {section('PART 1 · REQUEST')}
      {text('background', 'Background')}
      {text('scope', 'Scope of work', 4, 'One item per line')}
      {text('requirement', 'Implementation requirement')}
      <div style={grid2}>
        {text('risks', 'Risks', 2)}
        {text('remarks', 'Remarks', 2)}
      </div>
      <label style={{ ...fieldLabel, flexDirection: 'row', alignItems: 'center', gap: 16 }}>Priority
        {(['Normal', 'Urgent'] as const).map((p) => (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input type="radio" name="cr-prio" checked={form.priority === p} disabled={ro} onChange={() => set('priority', p)} style={{ accentColor: C.primary }} />{p}
          </span>
        ))}
      </label>

      {section('PART 2 · IMPACT AND COST')}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {CR_MODULES.map((m) => {
          const on = form.modules.includes(m);
          return (
            <div key={m} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 8, alignItems: 'center', padding: '4px 10px', borderBottom: `1px solid ${C.bg2}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={on} disabled={ro} style={{ accentColor: C.primary }}
                  onChange={(e) => set('modules', e.target.checked ? [...form.modules, m] : form.modules.filter((x) => x !== m))} />{m}
              </label>
              {on ? <input value={form.moduleDetails[m] || ''} readOnly={ro} placeholder="Details" onChange={(e) => set('moduleDetails', { ...form.moduleDetails, [m]: e.target.value })} style={{ ...input, height: 30 }} />
                : <span style={{ fontSize: 11, color: C.text3 }}>Not impacted</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {([['sa', 'SA/SE (MD)'], ['dev', 'DEV (MD)'], ['qa', 'QA (MD)'], ['imp', 'IMP/OP (MD)']] as const).map(([k, l]) => (
          <label key={k} style={fieldLabel}>{l}<input type="number" min={0} step={0.5} value={form.manday[k] || ''} readOnly={ro}
            onChange={(e) => set('manday', { ...form.manday, [k]: Number(e.target.value) || 0 })} style={input} /></label>
        ))}
        <label style={fieldLabel}>Rate (฿ / MD)<input type="number" min={0} value={form.rate} readOnly={ro} onChange={(e) => set('rate', Number(e.target.value) || 0)} style={input} /></label>
      </div>
      <div style={{ fontSize: 13, color: C.text2 }}>Total {total} MD · Estimated cost ฿{(total * form.rate - (Number(cr.discount) || 0)).toLocaleString('en-US')}{cr.discount ? ` (after ฿${Number(cr.discount).toLocaleString('en-US')} discount)` : ''}</div>
      <label style={fieldLabel}>Payment terms
        <select value={form.payment} disabled={ro} onChange={(e) => set('payment', e.target.value as CrForm['payment'])} style={{ ...input, padding: '0 10px' }}>
          <option value="">— (not chargeable / not set)</option>
          <option value="Partial">Partial payment (50% on signing, 50% on completion)</option>
          <option value="Advance">Paid in advance (100%)</option>
        </select>
      </label>

      {section('PART 3 · PLAN')}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {CR_MILESTONES.map((m, i) => (
          <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 160px', gap: 8, alignItems: 'center', padding: '4px 10px', borderBottom: `1px solid ${C.bg2}`, fontSize: 13, fontFamily: F }}>
            <span>{m.name}</span><span style={{ color: C.text2 }}>{m.pic}</span>
            <Input type="date" value={form.milestones[i] || ''} disabled={ro} aria-label={`${m.name} planned finish`}
              onChange={(v) => set('milestones', form.milestones.map((d, k) => (k === i ? v : d)))} />
          </div>
        ))}
      </div>
      <div style={hint}>Leave a date empty for N/A.</div>

      {section('PART 4–5')}
      <div style={grid2}>
        {text('assumptions', 'Assumptions', 3, 'One per line')}
        {text('references', 'References', 3, 'One per line')}
      </div>
    </FormModal>
  );
}
