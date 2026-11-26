/**
 * Project workspace navigation: 5 groups, each holding the screens (sub pages)
 * that used to be a flat row of 13 tabs.
 *
 * URL shape: /projects/:projectId/:group/:sub   e.g. /projects/<id>/plan/tasks
 * `screen` is the permission id used by role / screen permissions
 * (rolePermissions.ts and the database can_access_project_screen function).
 */
export interface ProjectSubPage {
  key: string;
  label: string;
  screen: string;
}

export interface ProjectGroup {
  key: string;
  label: string;
  subs: ProjectSubPage[];
}

export const PROJECT_GROUPS: ProjectGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    // One Page has its own menu (/one-page/:projectId), next to Dashboard.
    subs: [
      { key: 'summary', label: 'Summary', screen: 'summary' },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    subs: [
      { key: 'tasks', label: 'Tasks', screen: 'tasks' },
      { key: 'milestones', label: 'Milestones', screen: 'ms' },
      { key: 'effort', label: 'Effort', screen: 'effort' },
    ],
  },
  {
    key: 'tracking',
    label: 'Tracking',
    subs: [
      { key: 'issues', label: 'Issues', screen: 'issues' },
      { key: 'risks', label: 'Risks', screen: 'risks' },
      { key: 'change-requests', label: 'Change Requests', screen: 'cr' },
      { key: 'activities', label: 'Activities', screen: 'activities' },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    subs: [
      // Deliverables share the Checklist screen permission.
      { key: 'deliverables', label: 'Deliverables', screen: 'checklists' },
      { key: 'checklist', label: 'Checklist', screen: 'checklists' },
      { key: 'lessons', label: 'Lessons Learned', screen: 'lessons' },
    ],
  },
  {
    key: 'info',
    label: 'Project Info',
    subs: [
      { key: 'members', label: 'Members', screen: 'members' },
      { key: 'environments', label: 'Environments', screen: 'env' },
      // Editing the project itself needs write access to the portfolio.
      { key: 'settings', label: 'Settings', screen: 'portfolio-overview' },
    ],
  },
];

/** Order of the project tabs (sub-page keys); the first one the user can see opens by default. */
export const PROJECT_TAB_ORDER = [
  'tasks', 'summary', 'milestones', 'effort', 'members', 'checklist', 'activities', 'deliverables',
  'issues', 'risks', 'change-requests', 'lessons', 'environments', 'settings',
];

/** Where a screen id lives, e.g. 'ms' -> { group: 'plan', sub: 'milestones' }. */
export function locateScreen(screen: string): { group: string; sub: string } | null {
  for (const group of PROJECT_GROUPS) {
    const sub = group.subs.find((item) => item.screen === screen);
    if (sub) return { group: group.key, sub: sub.key };
  }
  return null;
}

/** URL of a project, optionally opened on a screen id ('tasks', 'ms', 'issues', …). */
export function projectPath(projectId: string, screen?: string): string {
  if (screen === 'onepage') return `/one-page/${encodeURIComponent(projectId)}`;
  const base = `/projects/${encodeURIComponent(projectId)}`;
  if (!screen) return base;
  const place = locateScreen(screen);
  return place ? `${base}/${place.group}/${place.sub}` : base;
}
