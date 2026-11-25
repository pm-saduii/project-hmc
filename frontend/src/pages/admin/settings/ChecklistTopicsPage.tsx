import React from 'react';
import toast from 'react-hot-toast';
import { GripVertical, Plus } from 'lucide-react';
import { Btn, C, Modal } from '../../../components/Common';
import { AdminHeader, SearchBox, FormModal, fieldLabel, hint, input, panel } from '../../../components/Admin/AdminUi';
import { useStore } from '../../../store';
import { projectChecklistApi } from '../../../services/api';
import { supabase } from '../../../services/supabase';
import { PROJECT_CHECKLIST_STAGES, type ProjectChecklistStageId, type ProjectChecklistTopic } from '../../../utils/projectChecklist';
import type { ChecklistSection } from './sections';
import { linkBtn } from './LookupListPage';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** One checklist (Project / Setup / Data Migration): topics grouped by stage or work system. */
export default function ChecklistTopicsPage({ section, topics, onChanged }: {
  section: ChecklistSection & { group: string };
  topics: ProjectChecklistTopic[] | null;
  onChanged: () => Promise<void>;
}) {
  const masterCodes = useStore((s) => s.masterCodes);
  const byStage = section.category === 'project';
  const [search, setSearch] = React.useState('');
  const [usage, setUsage] = React.useState<Record<string, number>>({});
  const [editing, setEditing] = React.useState<ProjectChecklistTopic | null>(null);
  const [isNew, setIsNew] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ProjectChecklistTopic | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState<{ id: string; group: string } | null>(null);
  const [overId, setOverId] = React.useState('');

  const mine = (topics || []).filter((t) => t.category === section.category);
  const workSystems = masterCodes.filter((c) => c.codeType === 'work_system').sort((a, b) => a.sortOrder - b.sortOrder);
  const groupKey = (t: ProjectChecklistTopic) => (byStage ? t.stage || '' : t.workSystem || '');
  const groups: { key: string; label: string }[] = byStage
    ? PROJECT_CHECKLIST_STAGES.map((s) => ({ key: s.id, label: s.label }))
    : [
      ...workSystems.map((w) => ({ key: w.codeValue, label: w.label + (w.active ? '' : ' (inactive)') })),
      ...[...new Set(mine.map(groupKey))].filter((k) => !workSystems.some((w) => w.codeValue === k)).map((k) => ({ key: k, label: k || '(no work system)' })),
    ];

  // Projects that have recorded progress on each topic (deleting a topic removes that progress).
  React.useEffect(() => {
    let alive = true;
    void supabase.from('project_checklist_progress').select('topic_id').then(({ data }) => {
      if (!alive) return;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: { topic_id: string }) => { counts[row.topic_id] = (counts[row.topic_id] || 0) + 1; });
      setUsage(counts);
    });
    return () => { alive = false; };
  }, [topics]);

  const q = search.trim().toLowerCase();
  const inGroup = (key: string) => mine.filter((t) => groupKey(t) === key).sort((a, b) => a.orderNo - b.orderNo || a.title.localeCompare(b.title));

  const openNew = (key?: string) => {
    const group = key ?? groups[0]?.key ?? '';
    setIsNew(true);
    setEditing({ id: newId(), category: section.category, title: '', orderNo: inGroup(group).length + 1,
      ...(byStage ? { stage: (group || 'planning') as ProjectChecklistStageId } : { workSystem: group }) });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const original = mine.find((t) => t.id === editing.id);
      const moved = !original || groupKey(original) !== groupKey(editing);
      // A topic moved to another group goes to the end of that group.
      const topic = moved ? { ...editing, orderNo: inGroup(groupKey(editing)).filter((t) => t.id !== editing.id).length + 1 } : editing;
      await projectChecklistApi.saveTopic(topic);
      toast.success(isNew ? 'Topic added' : 'Saved');
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await projectChecklistApi.deleteTopic(deleting.id);
      const rest = inGroup(groupKey(deleting)).filter((t) => t.id !== deleting.id).map((t) => t.id);
      await projectChecklistApi.saveTopicOrder(rest);
      toast.success('Topic deleted');
      setDeleting(null); setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete');
    } finally { setBusy(false); }
  };

  const drop = async (target: ProjectChecklistTopic) => {
    const d = drag;
    setDrag(null); setOverId('');
    if (!d || d.group !== groupKey(target) || d.id === target.id) return;
    const ids = inGroup(d.group).map((t) => t.id);
    const from = ids.indexOf(d.id); const to = ids.indexOf(target.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    try { await projectChecklistApi.saveTopicOrder(ids); await onChanged(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save the order'); }
  };

  const groupSelect = editing && (
    <label style={fieldLabel}>{byStage ? 'Stage' : 'Work system'}
      <select value={byStage ? editing.stage || '' : editing.workSystem || ''}
        onChange={(e) => setEditing(byStage ? { ...editing, stage: e.target.value as ProjectChecklistStageId } : { ...editing, workSystem: e.target.value })}
        style={{ ...input, padding: '0 10px' }}>
        {!byStage && !workSystems.length && <option value="">Add work systems first</option>}
        {(byStage ? PROJECT_CHECKLIST_STAGES.map((s) => ({ value: s.id, label: s.label })) : workSystems.filter((w) => w.active || w.codeValue === editing.workSystem).map((w) => ({ value: w.codeValue, label: w.label })))
          .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!byStage && <span style={hint}>Manage this list in Settings › Work Systems.</span>}
    </label>
  );

  return (
    <>
      <AdminHeader eyebrow={`Settings › ${section.group}`} title={section.label} description={section.description}
        actions={<Btn onClick={() => openNew()} disabled={!byStage && !workSystems.length}><Plus size={14} style={{ marginRight: 6 }} />Add topic</Btn>} />
      <div style={{ display: 'flex' }}><SearchBox value={search} onChange={setSearch} placeholder="Search topics" /></div>

      {topics === null ? <div style={{ fontSize: 13, color: C.text2 }}>Loading…</div> : (
        <section style={{ ...panel, overflow: 'hidden' }}>
          {groups.map((g) => {
            const list = inGroup(g.key).filter((t) => !q || t.title.toLowerCase().includes(q));
            if (q && !list.length) return null;
            return (
              <div key={g.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}`, marginTop: -1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{g.label.toUpperCase()} · {inGroup(g.key).length} topic{inGroup(g.key).length === 1 ? '' : 's'}</span>
                  <button type="button" onClick={() => openNew(g.key)} style={{ ...linkBtn(C.primary), fontSize: 11 }}>+ Add here</button>
                </div>
                {list.length === 0 && <div style={{ padding: '10px 14px', fontSize: 13, color: C.text3, borderBottom: `1px solid ${C.border}` }}>No topics.</div>}
                {list.map((t, i) => (
                  <div key={t.id}
                    draggable={!q}
                    onDragStart={() => setDrag({ id: t.id, group: g.key })}
                    onDragOver={(e) => { if (drag?.group === g.key) { e.preventDefault(); setOverId(t.id); } }}
                    onDragEnd={() => { setDrag(null); setOverId(''); }}
                    onDrop={() => void drop(t)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${C.border}`,
                      background: overId === t.id && drag?.id !== t.id ? C.primaryBg : drag?.id === t.id ? C.bg : C.white }}>
                    <span style={{ color: C.text3, cursor: q ? 'default' : 'grab', display: 'inline-flex' }} title={q ? 'Clear the search to reorder' : 'Drag to reorder'}><GripVertical size={14} /></span>
                    <span style={{ width: 24, fontSize: 11, color: C.text3 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontSize: 13, color: C.text, minWidth: 0 }}>{t.title}</span>
                    <span style={{ fontSize: 11, color: C.text3, whiteSpace: 'nowrap' }}>{usage[t.id] ? `${usage[t.id]} project${usage[t.id] > 1 ? 's' : ''}` : ''}</span>
                    <button type="button" onClick={() => { setIsNew(false); setEditing({ ...t }); }} style={linkBtn(C.primary)}>Edit</button>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}
      <div style={hint}>Drag topics to change their order within a group.</div>

      {editing && (
        <FormModal title={isNew ? 'Add topic' : 'Edit topic'} subtitle={section.label} onClose={() => setEditing(null)} busy={busy}
          footer={<>
            {!isNew && <button type="button" onClick={() => setDeleting(editing)} style={linkBtn('#B91C1C')}>Delete topic</button>}
            <span style={{ marginLeft: 'auto' }} />
            <Btn variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            <Btn onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
          </>}>
          <label style={fieldLabel}>Topic
            <textarea rows={3} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus
              style={{ ...input, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }} />
          </label>
          {groupSelect}
          {!isNew && usage[editing.id] ? <div style={hint}>{usage[editing.id]} project(s) have recorded progress on this topic.</div> : null}
        </FormModal>
      )}

      {deleting && (
        <Modal title="Delete topic" onClose={() => !busy && setDeleting(null)} width={440} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
            Delete "{deleting.title}"?{usage[deleting.id] ? ` The progress recorded on ${usage[deleting.id]} project(s) for this topic will also be removed.` : ''} This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Btn>
            <Btn variant="danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
