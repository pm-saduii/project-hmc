/** Company implementation methodology, and each project's deliverables and phase gates. */
import { supabase } from './supabase';

export type Owner = 'HMC' | 'Client' | 'Joint';
export type DeliverableStatus = 'planned' | 'draft' | 'client_review' | 'signed' | 'final' | 'not_required';

export interface MethodPhase {
  id: string; name: string; description: string;
  /** What must be true to leave the phase; empty = no gate (e.g. Hypercare). */
  gate: string; sortOrder: number; active: boolean;
  /** Icon key (see PHASE_ICONS) and colour of the phase on the board. */
  icon?: string; color?: string;
}
export interface MethodStep { id: string; phaseId: string; name: string; owner: Owner; objective: string; activities: string[]; sortOrder: number }
export interface MethodDeliverable {
  id: string; phaseId: string; stepId: string | null; name: string; shortName: string; format: string; templateUrl: string;
  requiresSignoff: boolean; internalOnly: boolean; owner: Owner; sortOrder: number; active: boolean;
}
export interface Methodology { phases: MethodPhase[]; steps: MethodStep[]; deliverables: MethodDeliverable[] }

export interface ProjectDeliverable {
  projectId: string; deliverableId: string; status: DeliverableStatus; owner: Owner | null;
  dueDate: string | null; completedDate: string | null; link: string; notes: string; updatedAt: string;
  /** Task in the project plan this deliverable is produced by (due date and progress come from it). */
  taskId?: string | null;
  /** Data of the generated sign-off document (company template). */
  form?: Record<string, unknown> | null;
}
export interface PhaseGate { projectId: string; phaseId: string; status: 'open' | 'passed'; passedAt: string | null; passedBy: string | null; notes: string; /** Main task of this phase in the plan. */ taskId?: string | null }

export const STATUS_INFO: Record<DeliverableStatus, { label: string; bg: string; fg: string }> = {
  planned: { label: 'Planned', bg: '#F1F5F9', fg: '#475569' },
  draft: { label: 'Draft', bg: '#DBEAFE', fg: '#1D4ED8' },
  client_review: { label: 'Client review', bg: '#FEF3C7', fg: '#92400E' },
  signed: { label: 'Signed', bg: '#D1FAE5', fg: '#047857' },
  final: { label: 'Final', bg: '#D1FAE5', fg: '#047857' },
  not_required: { label: 'Not required', bg: '#F1F5F9', fg: '#64748B' },
};
export const OWNER_INFO: Record<Owner, { label: string; fg: string; bg: string }> = {
  HMC: { label: 'HMC', fg: '#1E40AF', bg: '#DBEAFE' },
  Client: { label: 'Client', fg: '#9A3412', bg: '#FFEDD5' },
  Joint: { label: 'Joint', fg: '#0F766E', bg: '#CCFBF1' },
};
/** Statuses a deliverable can take: sign-off documents end at Signed, others at Final. */
export const statusesFor = (d: Pick<MethodDeliverable, 'requiresSignoff'>): DeliverableStatus[] =>
  d.requiresSignoff ? ['planned', 'draft', 'client_review', 'signed', 'not_required'] : ['planned', 'draft', 'final', 'not_required'];
export const isComplete = (s: DeliverableStatus) => s === 'signed' || s === 'final' || s === 'not_required';

const camel = <T,>(row: Record<string, unknown>): T =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as unknown as T;
const snake = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));

async function rows<T>(table: string, order = 'sort_order'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => camel<T>(r as Record<string, unknown>));
}

/** Update the row with this id, or insert it when it does not exist yet (a partial upsert would fail on NOT NULL columns). */
async function saveRow(table: string, row: Record<string, unknown> & { id: string }) {
  const { id, ...rest } = row;
  const { data, error } = await supabase.from(table).update(snake(rest)).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (data && data.length) return;
  const ins = await supabase.from(table).insert(snake(row));
  if (ins.error) throw new Error(ins.error.message);
}

export const methodologyApi = {
  load: async (): Promise<Methodology> => {
    const [phases, steps, deliverables] = await Promise.all([
      rows<MethodPhase>('methodology_phases'), rows<MethodStep>('methodology_steps'), rows<MethodDeliverable>('methodology_deliverables'),
    ]);
    return { phases, steps: steps.map((s) => ({ ...s, activities: s.activities || [] })), deliverables };
  },
  savePhase: async (phase: Partial<MethodPhase> & { id: string }) => saveRow('methodology_phases', phase),
  deletePhase: async (id: string) => {
    const { error } = await supabase.from('methodology_phases').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  saveStep: async (step: Partial<MethodStep> & { id: string }) => saveRow('methodology_steps', step),
  deleteStep: async (id: string) => {
    const { error } = await supabase.from('methodology_steps').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  /** How many projects have a gate record for each phase (a phase in use cannot be deleted). */
  phaseUsage: async (): Promise<Record<string, number>> => {
    const { data } = await supabase.from('project_phase_gates').select('phase_id');
    const counts: Record<string, number> = {};
    (data || []).forEach((r: { phase_id: string }) => { counts[r.phase_id] = (counts[r.phase_id] || 0) + 1; });
    return counts;
  },
  saveDeliverable: async (d: Partial<MethodDeliverable> & { id: string }) => saveRow('methodology_deliverables', d),
  deleteDeliverable: async (id: string) => {
    const { error } = await supabase.from('methodology_deliverables').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  /** How many projects have recorded a status for each deliverable. */
  deliverableUsage: async (): Promise<Record<string, number>> => {
    const { data } = await supabase.from('project_deliverables').select('deliverable_id');
    const counts: Record<string, number> = {};
    (data || []).forEach((r: { deliverable_id: string }) => { counts[r.deliverable_id] = (counts[r.deliverable_id] || 0) + 1; });
    return counts;
  },

  projectState: async (projectId: string): Promise<{ deliverables: ProjectDeliverable[]; gates: PhaseGate[] }> => {
    const [d, g] = await Promise.all([
      supabase.from('project_deliverables').select('*').eq('project_id', projectId),
      supabase.from('project_phase_gates').select('*').eq('project_id', projectId),
    ]);
    if (d.error) throw new Error(d.error.message);
    if (g.error) throw new Error(g.error.message);
    return {
      deliverables: (d.data || []).map((r) => camel<ProjectDeliverable>(r as Record<string, unknown>)),
      gates: (g.data || []).map((r) => camel<PhaseGate>(r as Record<string, unknown>)),
    };
  },
  /** Gates of many projects (for the current phase shown in lists). */
  allGates: async (): Promise<PhaseGate[]> => {
    const { data, error } = await supabase.from('project_phase_gates').select('*');
    if (error) return [];
    return (data || []).map((r) => camel<PhaseGate>(r as Record<string, unknown>));
  },
  saveDeliverableState: async (projectId: string, deliverableId: string, patch: Partial<Omit<ProjectDeliverable, 'projectId' | 'deliverableId' | 'updatedAt'>>) => {
    const { error } = await supabase.from('project_deliverables')
      .upsert({ project_id: projectId, deliverable_id: deliverableId, ...snake(patch as Record<string, unknown>) }, { onConflict: 'project_id,deliverable_id' });
    if (error) throw new Error(error.message);
  },
  /** Deliverables linked to tasks of a project (for the badge in Tasks). Empty before the link migration. */
  taskLinks: async (projectId: string): Promise<{ taskId: string; deliverableId: string; name: string; status: DeliverableStatus }[]> => {
    const [pd, md] = await Promise.all([
      supabase.from('project_deliverables').select('*').eq('project_id', projectId),
      supabase.from('methodology_deliverables').select('id,name,short_name'),
    ]);
    if (pd.error || md.error) return [];
    const names = new Map((md.data || []).map((d: { id: string; name: string; short_name: string }) => [d.id, d.short_name || d.name]));
    return (pd.data || []).filter((r: { task_id?: string | null }) => r.task_id)
      .map((r: { task_id: string; deliverable_id: string; status: DeliverableStatus }) => ({ taskId: r.task_id, deliverableId: r.deliverable_id, name: names.get(r.deliverable_id) || r.deliverable_id, status: r.status }));
  },
  /** Link a phase to its main task in the plan (null to unlink). */
  setGateTask: async (projectId: string, phaseId: string, taskId: string | null) => {
    const { error } = await supabase.from('project_phase_gates')
      .upsert({ project_id: projectId, phase_id: phaseId, task_id: taskId }, { onConflict: 'project_id,phase_id' });
    if (error) throw new Error(error.message);
  },
  setGate: async (projectId: string, phaseId: string, status: 'open' | 'passed', notes = '') => {
    const { error } = await supabase.from('project_phase_gates')
      .upsert({ project_id: projectId, phase_id: phaseId, status, notes }, { onConflict: 'project_id,phase_id' });
    if (error) throw new Error(error.message);
  },
};

/**
 * The phase the project is in: the first phase not passed yet. A phase without a gate counts as passed
 * once a later phase's gate is passed; the last phases without a gate (Hypercare) stay current at the end.
 */
export function currentPhase(phases: MethodPhase[], gates: PhaseGate[]): MethodPhase | null {
  const passed = new Set(gates.filter((g) => g.status === 'passed').map((g) => g.phaseId));
  const list = phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  let lastPassed = -1;
  list.forEach((p, i) => { if (passed.has(p.id)) lastPassed = i; });
  return list.find((p, i) => !passed.has(p.id) && !(i < lastPassed && !p.gate.trim())) || null;
}
export const hasGate = (p: Pick<MethodPhase, 'gate'>) => !!p.gate.trim();

/* ── Linking deliverables to tasks ─────────────────────────────────────── */
const WORDS_IGNORED = new Set(['the', 'and', 'of', 'for', 'to', 'a', 'an', 'in', 'on', 'with', 'by', 'doc', 'document', 'report', 'plan', '&']);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g, ' ').split(' ').filter((w) => w.length > 1 && !WORDS_IGNORED.has(w));

/** 0–1 likeness of a task name to a deliverable (full and short name), with a small bonus when the task's phase matches. */
export function matchScore(d: Pick<MethodDeliverable, 'name' | 'shortName'>, phaseName: string, task: { taskName: string; phase?: string }): number {
  const t = words(task.taskName);
  if (!t.length) return 0;
  const near = (w: string) => t.some((x) => x === w || (x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))));
  const overlap = (dw: string[]) => (dw.length ? dw.filter(near).length / Math.max(dw.length, Math.min(t.length, dw.length + 2)) : 0);
  // A one-word short name (UAT, CSS, Training) found as a word in the task name is a strong match.
  const short = d.shortName.trim();
  const shortHit = /^[A-Za-z0-9]{2,}$/.test(short) && t.includes(short.toLowerCase()) ? 0.9 : 0;
  let score = Math.max(shortHit, overlap(words(d.name)), overlap(words(d.shortName)));
  if (score > 0 && phaseName && task.phase && words(task.phase).some((w) => words(phaseName).includes(w))) score += 0.1;
  return Math.min(1, score);
}

/** Best task for each deliverable not linked yet (score at least `min`). */
export function suggestLinks<T extends { id: string; taskName: string; phase?: string }>(
  deliverables: MethodDeliverable[], phaseNameOf: (phaseId: string) => string, tasks: T[], min = 0.5,
): Record<string, { taskId: string; score: number }> {
  const out: Record<string, { taskId: string; score: number }> = {};
  deliverables.forEach((d) => {
    let best: { taskId: string; score: number } | null = null;
    tasks.forEach((t) => {
      const score = matchScore(d, phaseNameOf(d.phaseId), t);
      if (score >= min && (!best || score > best.score)) best = { taskId: t.id, score };
    });
    if (best) out[d.id] = best;
  });
  return out;
}

/** Progress of a task and everything under it, counted on the lowest-level tasks. */
export function subtreeProgress<T extends { id: string; parentId: string; status: string; percentComplete: number }>(rootId: string, tasks: T[]): { total: number; done: number; open: T[] } {
  const kids = new Map<string, T[]>();
  tasks.forEach((t) => { if (t.parentId) { const l = kids.get(t.parentId) || []; l.push(t); kids.set(t.parentId, l); } });
  const leaves: T[] = [];
  const walk = (id: string, depth: number) => {
    const c = kids.get(id) || [];
    if (!c.length || depth > 20) { const t = tasks.find((x) => x.id === id); if (t) leaves.push(t); return; }
    c.forEach((x) => walk(x.id, depth + 1));
  };
  walk(rootId, 0);
  const isDone = (t: T) => t.status === 'Done' || (Number(t.percentComplete) || 0) >= 100;
  return { total: leaves.length, done: leaves.filter(isDone).length, open: leaves.filter((t) => !isDone(t)) };
}

