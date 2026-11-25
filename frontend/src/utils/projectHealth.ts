import type { Task } from '../types';
import { computeBaselineProgress } from './index';

export type ScheduleStatus = 'On Track' | 'Delay' | 'Stoper' | 'Plan N/A';

export interface ProjectHealth {
  /** Average % complete of the top-level tasks. */
  actual: number;
  /** Baseline % that should be complete today. */
  planned: number;
  /** planned - actual (positive = behind). */
  gap: number;
  status: ScheduleStatus;
}

/**
 * Schedule health of one project, the same rule the project header uses:
 * behind by more than 20 points = Stoper, more than 3 = Delay, otherwise On Track.
 */
export function projectHealth(projectTasks: Task[], todayIso = new Date().toISOString().slice(0, 10)): ProjectHealth {
  const roots = projectTasks.filter((t) => !t.parentId);
  const actual = roots.length ? Math.round(roots.reduce((sum, t) => sum + (Number(t.percentComplete) || 0), 0) / roots.length) : 0;
  const baseline = computeBaselineProgress(projectTasks, [todayIso]);
  const planned = baseline[0]?.baselinePercent ?? 0;
  const gap = planned - actual;
  const status: ScheduleStatus = !baseline.length ? 'Plan N/A' : gap > 20 ? 'Stoper' : gap > 3 ? 'Delay' : 'On Track';
  return { actual, planned, gap, status };
}

/** Hyper Care: the project is live and only in post go-live support. */
export function isHyperCareStatus(status: string, label = ''): boolean {
  return /hyper\s*care/i.test(`${status} ${label}`);
}

/** Closed: a status meaning closed / completed / done / finished / cancelled. */
export function isClosedStatus(status: string, label = ''): boolean {
  return /close|complete|done|finish|cancel/i.test(`${status} ${label}`);
}
