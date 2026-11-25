import React from 'react';
import toast from 'react-hot-toast';
import { GripVertical, Plus } from 'lucide-react';
import { Btn, C, Modal } from '../../../components/Common';
import { AdminHeader, F, SearchBox, FormModal, Switch, fieldLabel, hint, input, panel, td, th } from '../../../components/Admin/AdminUi';
import { useStore } from '../../../store';
import { supabase } from '../../../services/supabase';
import type { MasterCode } from '../../../types';
import type { LookupSection } from './sections';

type Usage = Record<string, number>;

/** One lookup list (Project Status, Task Phases, …): reorder, activate, add, edit, delete. */
export default function LookupListPage({ section }: { section: LookupSection & { group: string } }) {
  const masterCodes = useStore((s) => s.masterCodes);
  const projects = useStore((s) => s.projects);
  const createMasterCode = useStore((s) => s.createMasterCode);
  const updateMasterCode = useStore((s) => s.updateMasterCode);
  const deleteMasterCode = useStore((s) => s.deleteMasterCode);
  const [search, setSearch] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(true);
  const [usage, setUsage] = React.useState<Usage | null>(null);
  const [editing, setEditing] = React.useState<Partial<MasterCode> | null>(null);
  const [deleting, setDeleting] = React.useState<MasterCode | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragId, setDragId] = React.useState('');
  const [overId, setOverId] = React.useState('');

  const items = masterCodes
    .filter((c) => c.codeType === section.codeType)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const valuesKey = items.map((c) => c.codeValue).join('|');

  // How many records use each stored value.
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const result: Usage = {};
      await Promise.all(items.map(async (code) => {
        let total = 0;
        for (const source of section.usage) {
          if (source.table === 'projects') { total += projects.filter((p) => p.status === code.codeValue).length; continue; }
          const { count } = await supabase.from(source.table).select('id', { count: 'exact', head: true }).eq(source.column, code.codeValue);
          total += count || 0;
        }
        result[code.codeValue] = total;
      }));
      if (alive) setUsage(result);
    })();
    return () => { alive = false; };
  }, [valuesKey, section.codeType, projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const rows = items.filter((c) => (showInactive || c.active) && (!q || `${c.label} ${c.codeValue} ${c.codeKey}`.toLowerCase().includes(q)));
  const canReorder = !q && showInactive;
  const usedLabel = (code: MasterCode) => {
    if (!usage) return '…';
    const n = usage[code.codeValue] || 0;
    if (!n) return 'Not used';
    const unit = section.usage[0].label;
    return `${n} ${unit}${n > 1 ? 's' : ''}${section.usage.length > 1 ? ' and others' : ''}`;
  };

  const toggleActive = async (code: MasterCode, active: boolean) => {
    try { await updateMasterCode(code.id, { active }); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update'); }
  };

  const drop = async (targetId: string) => {
    const from = items.findIndex((c) => c.id === dragId);
    const to = items.findIndex((c) => c.id === targetId);
    setDragId(''); setOverId('');
    if (from < 0 || to < 0 || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    try {
      await Promise.all(next.map((c, i) => ((i + 1) * 10 !== c.sortOrder ? updateMasterCode(c.id, { sortOrder: (i + 1) * 10 }) : null)));
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save the new order'); }
  };

  const save = async () => {
    if (!editing) return;
    const label = String(editing.label || '').trim();
    const codeValue = String(editing.codeValue || '').trim() || label;
    if (!label) { toast.error('Enter a label'); return; }
    const duplicate = items.find((c) => c.id !== editing.id && c.codeValue.toLowerCase() === codeValue.toLowerCase());
    if (duplicate) { toast.error(`"${codeValue}" already exists`); return; }
    setBusy(true);
    try {
      const payload: Partial<MasterCode> = {
        codeType: section.codeType,
        label,
        codeValue,
        codeKey: String(editing.codeKey || '').trim() || codeValue.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'CODE',
        textColor: editing.textColor || '#0F172A',
        bgColor: editing.bgColor || '#EEF2FF',
        active: editing.active ?? true,
      };
      if (editing.id) await updateMasterCode(editing.id, payload);
      else await createMasterCode({ ...payload, sortOrder: ((items[items.length - 1]?.sortOrder) || 0) + 10 });
      toast.success(editing.id ? 'Saved' : `${section.noun[0].toUpperCase()}${section.noun.slice(1)} added`);
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteMasterCode(deleting.id);
      toast.success('Deleted');
      setDeleting(null); setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete');
    } finally { setBusy(false); }
  };

  const editingUsed = editing?.id && usage ? (usage[String(editing.codeValue)] || 0) : 0;
  const original = editing?.id ? items.find((c) => c.id === editing.id) : null;

  return (
    <>
      <AdminHeader eyebrow={`Settings › ${section.group}`} title={section.label} description={section.description}
        actions={<Btn onClick={() => setEditing({ active: true, textColor: '#0F172A', bgColor: '#EEF2FF' })}><Plus size={14} style={{ marginRight: 6 }} />Add {section.noun}</Btn>} />

      <section style={{ ...panel, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: C.primary }} />Show inactive
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 36 }}><span style={{ position: 'absolute', left: -9999 }}>Reorder</span></th>
                <th style={th}>Label</th><th style={th}>Stored value</th><th style={th}>Used by</th><th style={th}>Active</th>
                <th style={{ ...th, width: 140 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, color: C.text2 }}>{items.length ? 'Nothing matches.' : `No ${section.noun} yet.`}</td></tr>
              ) : rows.map((code) => {
                const used = usage?.[code.codeValue] || 0;
                return (
                  <tr key={code.id}
                    draggable={canReorder}
                    onDragStart={() => setDragId(code.id)}
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(code.id); } }}
                    onDragEnd={() => { setDragId(''); setOverId(''); }}
                    onDrop={() => void drop(code.id)}
                    style={{ background: overId === code.id && dragId !== code.id ? C.primaryBg : dragId === code.id ? C.bg : undefined, opacity: code.active ? 1 : 0.6 }}>
                    <td style={{ ...td, color: C.text3, cursor: canReorder ? 'grab' : 'default', paddingRight: 0 }} title={canReorder ? 'Drag to reorder' : 'Clear the search to reorder'}><GripVertical size={14} /></td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: code.bgColor || C.bg2, color: code.textColor || C.text }}>{code.label}</span></td>
                    <td style={{ ...td, color: C.text2 }}>{code.codeValue}</td>
                    <td style={{ ...td, color: C.text2 }}>{usedLabel(code)}</td>
                    <td style={td}><Switch checked={code.active} onChange={(v) => void toggleActive(code, v)} label={`${code.label} active`} /></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => setEditing({ ...code })} style={linkBtn(C.primary)}>Edit</button>
                      <button type="button" disabled={used > 0} title={used > 0 ? 'In use — make it inactive instead' : undefined} onClick={() => setDeleting(code)}
                        style={{ ...linkBtn('#B91C1C'), opacity: used > 0 ? 0.35 : 1, cursor: used > 0 ? 'not-allowed' : 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div style={hint}>Drag rows to change the order. A value in use cannot be deleted — make it inactive instead, so existing records keep it.</div>

      {editing && (
        <FormModal title={editing.id ? `Edit ${section.noun}` : `Add ${section.noun}`} subtitle={section.label} onClose={() => setEditing(null)} busy={busy}
          footer={<>
            {editing.id && original && <button type="button" disabled={editingUsed > 0} onClick={() => setDeleting(original)}
              title={editingUsed > 0 ? 'In use — make it inactive instead' : undefined}
              style={{ ...linkBtn('#B91C1C'), opacity: editingUsed > 0 ? 0.35 : 1 }}>Delete</button>}
            <span style={{ marginLeft: 'auto' }} />
            <Btn variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            <Btn onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
          </>}>
          <label style={fieldLabel}>Label
            <input value={editing.label || ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} style={input} autoFocus />
            <span style={hint}>What people see in lists and forms.</span>
          </label>
          <label style={fieldLabel}>Stored value
            <input value={editing.codeValue || ''} placeholder={editing.label || ''} disabled={editingUsed > 0}
              onChange={(e) => setEditing({ ...editing, codeValue: e.target.value })} style={{ ...input, background: editingUsed > 0 ? C.bg : C.white }} />
            <span style={hint}>{editingUsed > 0 ? `Used by ${editingUsed} record(s), so it cannot change. Edit the label instead.` : 'Saved on each record. Leave empty to use the label.'}</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Badge colours</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2 }}>Text
                <input type="color" value={editing.textColor || '#0F172A'} onChange={(e) => setEditing({ ...editing, textColor: e.target.value })} style={{ width: 36, height: 30, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2 }}>Background
                <input type="color" value={editing.bgColor || '#EEF2FF'} onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })} style={{ width: 36, height: 30, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }} />
              </label>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: editing.bgColor || '#EEF2FF', color: editing.textColor || '#0F172A' }}>{editing.label || 'Preview'}</span>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13 }}>
            <span><strong>Active</strong><br /><span style={{ fontSize: 11, color: C.text2 }}>Inactive values stay on existing records but cannot be picked for new ones.</span></span>
            <Switch checked={editing.active ?? true} onChange={(v) => setEditing({ ...editing, active: v })} label="Active" />
          </label>
        </FormModal>
      )}

      {deleting && (
        <Modal title={`Delete ${section.noun}`} onClose={() => !busy && setDeleting(null)} width={420} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px' }}>Delete "{deleting.label}"? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Btn>
            <Btn variant="danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

export const linkBtn = (color: string): React.CSSProperties => ({
  border: 0, background: 'transparent', color, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 6px', marginLeft: 6,
});
