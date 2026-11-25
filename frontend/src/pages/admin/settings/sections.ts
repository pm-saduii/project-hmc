import type { ProjectChecklistCategoryId } from '../../../utils/projectChecklist';

export interface LookupSection {
  kind: 'lookup'; path: string; label: string; codeType: string; noun: string; description: string;
  /** Where the stored value is used, for "Used by" and delete protection. */
  usage: { table: string; column: string; label: string }[];
}
export interface ChecklistSection { kind: 'checklist'; path: string; label: string; category: ProjectChecklistCategoryId; description: string }
export interface TemplatesSection { kind: 'templates'; path: string; label: string; description: string }
export type SettingsSection = LookupSection | ChecklistSection | TemplatesSection;

export const SETTINGS_GROUPS: { title: string; sections: SettingsSection[] }[] = [
  {
    title: 'Project setup',
    sections: [
      { kind: 'lookup', path: 'project-status', label: 'Project Status', codeType: 'project_status', noun: 'status',
        description: 'Stages a project moves through. The order here is the order used on the Projects page and in lists.',
        usage: [{ table: 'projects', column: 'status', label: 'project' }] },
      { kind: 'lookup', path: 'task-phases', label: 'Task Phases', codeType: 'task_phase', noun: 'phase',
        description: 'Phases a task or an effort line can belong to.',
        usage: [{ table: 'tasks', column: 'phase', label: 'task' }, { table: 'efforts', column: 'phase', label: 'effort line' }] },
      { kind: 'lookup', path: 'activity-types', label: 'Activity Types', codeType: 'activity_type', noun: 'activity type',
        description: 'Kinds of project activity recorded on the Activities page.',
        usage: [{ table: 'activities', column: 'activity_type', label: 'activity' }] },
      { kind: 'lookup', path: 'work-systems', label: 'Work Systems', codeType: 'work_system', noun: 'work system',
        description: 'Systems or modules that group the Setup and Data Migration checklists.',
        usage: [{ table: 'project_checklist_topics', column: 'work_system', label: 'checklist topic' }] },
    ],
  },
  {
    title: 'Checklists',
    sections: [
      { kind: 'checklist', path: 'checklists/project', label: 'Project Checklist', category: 'project',
        description: 'Topics every project checks at each stage, from planning to hyper care.' },
      { kind: 'checklist', path: 'checklists/setup', label: 'Setup Checklist', category: 'setup',
        description: 'Topics checked during system setup, grouped by work system.' },
      { kind: 'checklist', path: 'checklists/data-migration', label: 'Data Migration Checklist', category: 'migrate-data',
        description: 'Topics checked when migrating customer data, grouped by work system.' },
    ],
  },
  {
    title: 'Templates',
    sections: [
      { kind: 'templates', path: 'task-templates', label: 'Task Templates',
        description: 'Ready-made task plans a project can start from (Plan › Tasks › Replace tasks).' },
    ],
  },
];

export const ALL_SECTIONS = SETTINGS_GROUPS.flatMap((g) => g.sections.map((s) => ({ ...s, group: g.title })));
export const findSection = (path: string) => ALL_SECTIONS.find((s) => s.path === path) || null;
