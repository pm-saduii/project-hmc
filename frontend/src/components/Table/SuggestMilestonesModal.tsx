import React from 'react';
import toast from 'react-hot-toast';
import { Btn, C } from '../Common';
import { FormModal, hint } from '../Admin/AdminUi';
import { methodologyApi } from '../../services/methodology';
import { taskApi } from '../../services/api';
import { useStore } from '../../store';
import { compareWbs, fmtDate } from '../../utils';
import type { Task } from '../../types';

const F = 'Poppins, sans-serif';
/** Task names that usually mark a milestone. */
const KEYWORDS = /\b(kick[\s-]?off|sign[\s-]?off|go[\s-]?live|go\s*\/\s*no[\s-]?go|uat|parallel\s*run|cut[\s-]?over|blueprint|hand[\s-]?over|closure|hypercare\s*close)\b/i;

interface Suggestion { task: Task; reasons: string[] }

/** Suggest which tasks are key milestones (External Status · Key Milestone Tracker): sign-off deliverables, ◆ one-day tasks, milestone-like names. */
export default function SuggestMilestonesModal({ projectId, tasks, onClose }: { projectId: string; tasks: Task[]; onClose: () => void }) {
  const [items, setItems] = React.useState<Suggestion[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    void Promise.all([methodologyApi.load().catch(() => null), methodologyApi.taskLinks(projectId).catch(() => [])]).then(([method, links]) => {
      if (!alive) return;
      const signoff = new Set((method?.deliverables || []).filter((d) => d.requiresSignoff).map((d) => d.id));
      const reasons = new Map<string, string[]>();
      const add = (id: string, r: string) => reasons.set(id, [...(reasons.get(id) || []), r]);
      links.forEach((l) => { if (signoff.has(l.deliverableId)) add(l.taskId, `Sign-off deliverable: ${l.name}`); });
      tasks.forEach((t) => {
        if (!parents.has(t.id) && t.startDate && t.startDate === t.endDate) add(t.id, '◆ one-day task');
        if (KEYWORDS.test(t.taskName || '')) add(t.id, 'Milestone-like name');
        if (t.isMilestone && !reasons.has(t.id)) add(t.id, 'Already a milestone');
      });
      const list = tasks.filter((t) => reasons.has(t.id))
        .sort((a, b) => compareWbs(String(a.wbs || ''), String(b.wbs || '')))
        .map((t) => ({ task: t, reasons: reasons.get(t.id)! }));
      setItems(list);
      // Pre-tick: already flagged, plus strong suggestions (sign-off deliverable or ◆) when nothing is flagged yet
      const anyFlagged = tasks.some((t) => t.isMilestone);
      setPicked(new Set(list.filter(({ task, reasons: r }) => task.isMilestone || (!anyFlagged && r.some((x) => x.startsWith('Sign-off') || x.startsWith('◆')))).map((x) => x.task.id)));
    });
    return () => { alive = false; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps -- suggest once when opened

  const current = new Set(tasks.filter((t) => t.isMilestone).map((t) => t.id));
  const on = [...picked].filter((id) => !current.has(id));
  const off = (items || []).map((x) => x.task.id).filter((id) => current.has(id) && !picked.has(id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const apply = async () => {
    setBusy(true);
    try {
      const r = await taskApi.setMilestones(projectId, on, off);
      useStore.setState({ tasks: [...useStore.getState().tasks.filter((t) => t.projectId !== projectId), ...r.data] });
      toast.success(`${on.length} marked · ${off.length} unmarked`);
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  const chip = (r: string) => {
    const tone = r.startsWith('Sign-off') ? ['#047857', C.greenBg] : r.startsWith('◆') ? ['#B45309', '#FEF3C7'] : r.startsWith('Already') ? [C.primary, C.primaryBg] : [C.text2, C.bg2];
    return <span key={r} style={{ fontSize: 11, fontWeight: 600, color: tone[0], background: tone[1], padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{r}</span>;
  };

  return (
    <FormModal title="Suggest milestones" subtitle="Key milestones appear on the External Status report (Key Milestone Tracker)" onClose={onClose} busy={busy} width={820}
      footer={<>
        <span style={hint}>{picked.size} selected{on.length || off.length ? ` · ${on.length} to mark, ${off.length} to unmark` : ''}</span>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn onClick={() => void apply()} disabled={busy || (!on.length && !off.length)}>{busy ? 'Saving…' : 'Apply'}</Btn>
      </>}>
      {!items ? <div style={{ fontSize: 13, color: C.text2 }}>Looking for milestones…</div>
        : items.length === 0 ? <div style={{ fontSize: 13, color: C.text3 }}>No suggestions. Mark a task yourself in Edit Task › ◆ Key milestone.</div> : (
          <>
            <div style={hint}>Suggested from: tasks linked to deliverables that need the customer's sign-off (Methodology), one-day tasks (◆ in the Gantt), and names like Kick-off, Sign-off, UAT, Go-live, Cut-over.</div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {items.map(({ task, reasons }) => (
                <label key={task.id} style={{ display: 'grid', gridTemplateColumns: '24px 56px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', background: picked.has(task.id) ? '#FFFBEB' : C.white, fontFamily: F }}>
                  <input type="checkbox" checked={picked.has(task.id)} onChange={() => toggle(task.id)} style={{ accentColor: C.primary }} />
                  <span style={{ fontSize: 11, color: C.text3 }}>{task.wbs}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picked.has(task.id) && <b style={{ color: '#B45309' }}>◆ </b>}{task.taskName}</span>
                    <span style={{ fontSize: 11, color: C.text3 }}>Target {fmtDate(task.endDate)} · {task.percentComplete || 0}%</span>
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{reasons.map(chip)}</span>
                </label>
              ))}
            </div>
          </>
        )}
    </FormModal>
  );
}
