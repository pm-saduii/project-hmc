import { format } from 'date-fns';
import { currentPhase, hasGate, isComplete, methodologyApi } from '../services/methodology';
import { computeModel, loadEngine, type ExternalInput } from './externalStatus';
import type { MonthlyReportData } from './monthlyReport';

type Extras = Pick<MonthlyReportData, 'phasePlan' | 'progressChart' | 'stages'>;
const iso = (ms: unknown) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '');

/** Overall Project Timeline + Progress Overview, computed with the External report engine (same numbers as that report). */
export async function timelineExtras(input: Omit<ExternalInput, 'period' | 'record' | 'phaseName'>, asOf: string): Promise<Extras> {
  await loadEngine();
  if (!window.PSR) return {};
  const d = new Date(`${asOf}T00:00:00`);
  const period = `${format(d, 'yyyy-MM')}-${d.getDate() <= 15 ? 1 : 2}`;
  const M = computeModel(window.PSR, { ...input, period, phaseName: '', record: { reportDate: asOf } as ExternalInput['record'] }) as unknown as Record<string, unknown>;
  const phases = ((M.phases as Record<string, unknown>[]) || []).map((p) => ({
    name: String(p.name || ''), start: iso(p.start), end: iso(p.end), owner: String(p.owner || ''),
    percent: Math.round((Number(p.pct) || 0) * 100), status: String(p.status || 'Not Started'),
  }));
  return { phasePlan: { phases }, progressChart: (M.chart as MonthlyReportData['progressChart']) || undefined };
}

/** Methodology phases with their steps, marked as on the Deliverables board (done / current / upcoming). */
export async function stageExtras(projectId: string): Promise<Extras> {
  const [m, st] = await Promise.all([methodologyApi.load(), methodologyApi.projectState(projectId)]);
  const phases = m.phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!phases.length) return {};
  const now = currentPhase(phases, st.gates);
  const nowIndex = now ? phases.findIndex((p) => p.id === now.id) : phases.length;
  const passed = new Set(st.gates.filter((g) => g.status === 'passed').map((g) => g.phaseId));
  const stages = phases.map((p, i) => {
    const statusOf = (deliverableId: string) => st.deliverables.find((y) => y.deliverableId === deliverableId)?.status || 'planned';
    const items = m.steps.filter((s) => s.phaseId === p.id).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => {
      const list = m.deliverables.filter((d) => d.active && d.stepId === s.id).map((d) => statusOf(d.id));
      const state: 'done' | 'current' | 'upcoming' = passed.has(p.id) || (list.length > 0 && list.every(isComplete)) ? 'done'
        : now?.id === p.id || list.some((x) => x !== 'planned') ? 'current' : 'upcoming';
      return { title: s.name, state };
    });
    const dels = m.deliverables.filter((x) => x.active && x.phaseId === p.id).map((x) => statusOf(x.id))
      .filter((s) => s !== 'not_required');
    return {
      name: p.name, icon: p.icon || '', color: p.color || '',
      state: (passed.has(p.id) || i < nowIndex ? 'passed' : i === nowIndex ? 'current' : 'upcoming') as 'passed' | 'current' | 'upcoming',
      noGate: !hasGate(p), deliverablesDone: dels.filter((s) => s === 'signed' || s === 'final').length, deliverablesTotal: dels.length, items,
    };
  });
  return { stages };
}
