/** Company implementation methodology, and each project's deliverables and phase gates. */
import { supabase } from './supabase';

export type Owner = 'HMC' | 'Client' | 'Joint';
export type DeliverableStatus = 'planned' | 'draft' | 'client_review' | 'signed' | 'final' | 'not_required';

export interface MethodPhase { id: string; name: string; description: string; gate: string; sortOrder: number; active: boolean }
export interface MethodStep { id: string; phaseId: string; name: string; owner: Owner; objective: string; activities: string[]; sortOrder: number }
export interface MethodDeliverable {
  id: string; phaseId: string; stepId: string | null; name: string; shortName: string; format: string; templateUrl: string;
  requiresSignoff: boolean; internalOnly: boolean; owner: Owner; sortOrder: number; active: boolean;
}
export interface Methodology { phases: MethodPhase[]; steps: MethodStep[]; deliverables: MethodDeliverable[] }

export interface ProjectDeliverable {
  projectId: string; deliverableId: string; status: DeliverableStatus; owner: Owner | null;
  dueDate: string | null; completedDate: string | null; link: string; notes: string; updatedAt: string;
}
export interface PhaseGate { projectId: string; phaseId: string; status: 'open' | 'passed'; passedAt: string | null; passedBy: string | null; notes: string }

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

export const methodologyApi = {
  load: async (): Promise<Methodology> => {
    const [phases, steps, deliverables] = await Promise.all([
      rows<MethodPhase>('methodology_phases'), rows<MethodStep>('methodology_steps'), rows<MethodDeliverable>('methodology_deliverables'),
    ]);
    return { phases, steps: steps.map((s) => ({ ...s, activities: s.activities || [] })), deliverables };
  },
  savePhase: async (phase: Partial<MethodPhase> & { id: string }) => {
    const { error } = await supabase.from('methodology_phases').upsert(snake(phase), { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },
  saveDeliverable: async (d: Partial<MethodDeliverable> & { id: string }) => {
    const { error } = await supabase.from('methodology_deliverables').upsert(snake(d), { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },
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
  setGate: async (projectId: string, phaseId: string, status: 'open' | 'passed', notes = '') => {
    const { error } = await supabase.from('project_phase_gates')
      .upsert({ project_id: projectId, phase_id: phaseId, status, notes }, { onConflict: 'project_id,phase_id' });
    if (error) throw new Error(error.message);
  },
};

/** The first phase whose gate is not passed (the phase the project is in), or null when all are passed. */
export function currentPhase(phases: MethodPhase[], gates: PhaseGate[]): MethodPhase | null {
  const passed = new Set(gates.filter((g) => g.status === 'passed').map((g) => g.phaseId));
  return phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder).find((p) => !passed.has(p.id)) || null;
}
