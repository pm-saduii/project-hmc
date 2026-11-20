const date = (offset: number) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

const createdAt = new Date().toISOString();
const projects = [
  {
    id: 'demo-project-1', name: 'HR & Payroll Transformation', code: 'HPT-2026',
    client: 'Acme Manufacturing', customer_abbreviation: 'ACME', customer_id: 'ACME',
    software_version: 'Humatrix', status: 'Testing', start_date: date(-90), end_date: date(45),
    description: 'Modernize HR operations, payroll, and employee self-service.',
    color: '#4F46E5', email_notification_enabled: false, email_notification_mode: 'task',
    email_notification_recipients: '', email_notification_time: '09:00',
  },
  {
    id: 'demo-project-2', name: 'Workplaze Digital Workplace', code: 'WDW-2026',
    client: 'Northstar Logistics', customer_abbreviation: 'NSL', customer_id: 'NSL',
    software_version: 'Workplaze', status: 'Go Live', start_date: date(-150), end_date: date(20),
    description: 'Deliver a connected digital workplace and employee portal.',
    color: '#0F766E', email_notification_enabled: false, email_notification_mode: 'task',
    email_notification_recipients: '', email_notification_time: '09:00',
  },
  {
    id: 'demo-project-3', name: 'Finance System Upgrade', code: 'FSU-2027',
    client: 'Brightside Retail', customer_abbreviation: 'BSR', customer_id: 'BSR',
    software_version: 'Humatrix', status: 'Planning', start_date: date(10), end_date: date(160),
    description: 'Upgrade finance operations with a phased implementation.',
    color: '#D97706', email_notification_enabled: false, email_notification_mode: 'task',
    email_notification_recipients: '', email_notification_time: '09:00',
  },
];

const task = (
  id: string, projectId: string, wbs: string, name: string, offsetStart: number,
  duration: number, progress: number, level: number, sortOrder: number,
  parentId = '', phase = 'Implementation', status = 'In Progress',
) => ({
  id, project_id: projectId, wbs, task_name: name, effort_manday: Math.max(2, duration * 0.8),
  baseline_start_date: date(offsetStart), baseline_end_date: date(offsetStart + duration),
  start_date: date(offsetStart), end_date: date(offsetStart + duration), actual_finish: '',
  phase, duration, percent_complete: progress, status, resource: 'Project Team',
  related_task: '', related_task_type: 'FS', related_task_lag_days: 0,
  parent_id: parentId, level, sort_order: sortOrder, order: sortOrder,
});

const tasks = [
  task('task-1', 'demo-project-1', '1', 'Project initiation', -85, 15, 100, 0, 1000, '', 'Planning', 'Done'),
  task('task-2', 'demo-project-1', '1.1', 'Kick-off and governance', -85, 5, 100, 1, 1000, 'task-1', 'Planning', 'Done'),
  task('task-3', 'demo-project-1', '1.2', 'Confirm project scope', -80, 10, 100, 1, 2000, 'task-1', 'Planning', 'Done'),
  task('task-4', 'demo-project-1', '2', 'Requirements & design', -68, 28, 100, 0, 2000, '', 'Req & Design', 'Done'),
  task('task-5', 'demo-project-1', '2.1', 'Fit-gap workshops', -68, 14, 100, 1, 1000, 'task-4', 'Req & Design', 'Done'),
  task('task-6', 'demo-project-1', '2.2', 'Solution design approval', -54, 14, 100, 1, 2000, 'task-4', 'Req & Design', 'Done'),
  task('task-7', 'demo-project-1', '3', 'Configuration & integration', -38, 42, 75, 0, 3000, '', 'Implementation', 'In Progress'),
  task('task-8', 'demo-project-1', '3.1', 'Configure HR and payroll', -38, 28, 85, 1, 1000, 'task-7', 'Implementation', 'In Progress'),
  task('task-9', 'demo-project-1', '3.2', 'Build payroll integrations', -20, 32, 65, 1, 2000, 'task-7', 'Implementation', 'In Progress'),
  task('task-10', 'demo-project-1', '4', 'Testing & deployment', 3, 42, 25, 0, 4000, '', 'Testing', 'In Progress'),
  task('task-11', 'demo-project-1', '4.1', 'User acceptance testing', 3, 20, 45, 1, 1000, 'task-10', 'Testing', 'In Progress'),
  task('task-12', 'demo-project-1', '4.2', 'Production readiness', 24, 21, 0, 1, 2000, 'task-10', 'Go Live', 'Todo'),
  task('task-13', 'demo-project-2', '1', 'Digital workplace rollout', -130, 120, 92, 0, 1000, '', 'Go Live', 'In Progress'),
  task('task-14', 'demo-project-2', '1.1', 'Employee portal launch', -15, 18, 100, 1, 1000, 'task-13', 'Go Live', 'Done'),
  task('task-15', 'demo-project-2', '1.2', 'Hypercare support', 1, 25, 55, 1, 2000, 'task-13', 'Hyper Care', 'In Progress'),
  task('task-16', 'demo-project-3', '1', 'Finance system upgrade', 10, 140, 8, 0, 1000, '', 'Planning', 'In Progress'),
  task('task-17', 'demo-project-3', '1.1', 'Discovery and assessment', 10, 28, 25, 1, 1000, 'task-16', 'Planning', 'In Progress'),
  task('task-18', 'demo-project-3', '1.2', 'Migration approach', 38, 30, 0, 1, 2000, 'task-16', 'Req & Design', 'Todo'),
];

const members = [
  { id: 'member-1', project_id: 'demo-project-1', name: 'Alex Morgan', thai_name: 'อเล็กซ์ มอร์แกน', nickname: 'Alex', role: 'Project Manager', position: 'Project Manager', email: 'alex.morgan@example.test', tel: '081-234-5678', ext: '', type: 'internal', notes: '', user_id: 'demo-user' },
  { id: 'member-2', project_id: 'demo-project-1', name: 'Nina Chen', thai_name: 'นีน่า เฉิน', nickname: 'Nina', role: 'Business Analyst', position: 'Business Analyst', email: 'nina.chen@example.test', tel: '082-345-6789', ext: '', type: 'internal', notes: '', user_id: '' },
  { id: 'member-3', project_id: 'demo-project-1', name: 'Jordan Lee', thai_name: 'จอร์แดน ลี', nickname: 'Jordan', role: 'Customer Lead', position: 'HR Director', email: 'jordan.lee@example.test', tel: '083-456-7890', ext: '', type: 'client', notes: '', user_id: '' },
  { id: 'member-4', project_id: 'demo-project-2', name: 'Sam Rivera', thai_name: 'แซม ริเวรา', nickname: 'Sam', role: 'Project Manager', position: 'Project Manager', email: 'sam.rivera@example.test', tel: '084-567-8901', ext: '', type: 'internal', notes: '', user_id: '' },
  { id: 'member-5', project_id: 'demo-project-3', name: 'Taylor Kim', thai_name: 'เทย์เลอร์ คิม', nickname: 'Taylor', role: 'Finance Lead', position: 'Finance Lead', email: 'taylor.kim@example.test', tel: '085-678-9012', ext: '', type: 'client', notes: '', user_id: '' },
];

const codes = [
  ...['Planning', 'Req & Design', 'Setup', 'Testing', 'Go Live', 'Hyper Care'].map((value, index) => ({
    id: `status-${index}`, code_type: 'project_status', code_key: value.toLowerCase().replace(/ /g, '-'),
    code_value: value, label: value, sort_order: index + 1, active: true,
    text_color: ['#92400E', '#0F766E', '#C2410C', '#1D4ED8', '#15803D', '#BE185D'][index],
    bg_color: ['#FEF3C7', '#CCFBF1', '#FFEDD5', '#DBEAFE', '#DCFCE7', '#FCE7F3'][index],
    created_at: createdAt, updated_at: createdAt,
  })),
  ...['Planning', 'Req & Design', 'Implementation', 'Testing', 'Go Live', 'Hyper Care'].map((value, index) => ({
    id: `phase-${index}`, code_type: 'task_phase', code_key: value.toLowerCase().replace(/ /g, '-'),
    code_value: value, label: value, sort_order: index + 1, active: true,
    text_color: '#334155', bg_color: '#F1F5F9', created_at: createdAt, updated_at: createdAt,
  })),
  ...['Core HR', 'Payroll', 'Integrations', 'Reporting'].map((value, index) => ({
    id: `system-${index}`, code_type: 'work_system', code_key: value.toLowerCase().replace(/ /g, '-'),
    code_value: value, label: value, sort_order: index + 1, active: true,
    text_color: '#334155', bg_color: '#F1F5F9', created_at: createdAt, updated_at: createdAt,
  })),
];

const checklistTopics = [
  ['project', '', 'planning', 'Project charter approved'],
  ['project', '', 'planning', 'Stakeholders and governance confirmed'],
  ['project', '', 'requirements-design', 'Business requirements signed off'],
  ['project', '', 'requirements-design', 'Solution design approved'],
  ['project', '', 'setup', 'Environments and access ready'],
  ['project', '', 'testing', 'UAT scenarios approved'],
  ['project', '', 'go-live', 'Go-live readiness confirmed'],
  ['project', '', 'hyper-care', 'Hypercare exit criteria agreed'],
  ['setup', 'Core HR', '', 'Organization structure configured'],
  ['setup', 'Core HR', '', 'Employee data fields reviewed'],
  ['setup', 'Payroll', '', 'Pay components configured'],
  ['setup', 'Payroll', '', 'Payroll calendar validated'],
  ['setup', 'Integrations', '', 'Inbound interface tested'],
  ['setup', 'Reporting', '', 'Standard reports reviewed'],
  ['migrate-data', 'Core HR', '', 'Employee master data reconciled'],
  ['migrate-data', 'Payroll', '', 'Opening balances validated'],
  ['migrate-data', 'Payroll', '', 'Year-to-date values confirmed'],
  ['migrate-data', 'Core HR', '', 'Production migration approved'],
].map(([category, workSystem, stage, title], index) => ({
  id: `check-${index + 1}`, category, work_system: workSystem || null, stage: stage || null,
  order_no: index + 1, title,
}));

export const mockSeedData: Record<string, Record<string, unknown>[]> = {
  projects,
  profiles: [{
    id: 'demo-user', email: 'alex.morgan@example.test', full_name: 'Alex Morgan',
    avatar_url: '', role: 'admin', is_active: true, project_access_scope: 'all',
    screen_permissions: null, created_at: createdAt, updated_at: createdAt,
  }],
  project_members: [
    { id: 'project-member-1', project_id: 'demo-project-1', user_id: 'demo-user' },
    { id: 'project-member-2', project_id: 'demo-project-2', user_id: 'demo-user' },
  ],
  tasks,
  members,
  milestones: [
    { id: 'milestone-1', project_id: 'demo-project-1', phase: 'Testing', name: 'UAT sign-off', percent: 30, amount: 360000, phase_amount: 1200000, due_date: date(12), billing_date: date(15), notes: 'Customer acceptance milestone', status: 'pending' },
    { id: 'milestone-2', project_id: 'demo-project-1', phase: 'Go Live', name: 'Production launch', percent: 40, amount: 480000, phase_amount: 1200000, due_date: date(45), billing_date: date(50), notes: '', status: 'pending' },
    { id: 'milestone-3', project_id: 'demo-project-2', phase: 'Go Live', name: 'Portal go-live', percent: 60, amount: 540000, phase_amount: 900000, due_date: date(-3), billing_date: date(3), notes: 'Launch completed', status: 'billed' },
    { id: 'milestone-4', project_id: 'demo-project-3', phase: 'Planning', name: 'Discovery complete', percent: 20, amount: 150000, phase_amount: 750000, due_date: date(38), billing_date: date(40), notes: '', status: 'pending' },
  ],
  efforts: [
    { id: 'effort-1', project_id: 'demo-project-1', module: 'Core HR', phase: 'Implementation', budget_amount: 720000, budget_manday: 120 },
    { id: 'effort-2', project_id: 'demo-project-1', module: 'Payroll', phase: 'Implementation', budget_amount: 540000, budget_manday: 90 },
    { id: 'effort-3', project_id: 'demo-project-2', module: 'Employee Portal', phase: 'Go Live', budget_amount: 480000, budget_manday: 80 },
    { id: 'effort-4', project_id: 'demo-project-3', module: 'Finance', phase: 'Planning', budget_amount: 600000, budget_manday: 100 },
  ],
  effort_monthly: [
    { id: 'effort-month-1', effort_id: 'effort-1', month: date(0).slice(0, 7), manday: 22 },
    { id: 'effort-month-2', effort_id: 'effort-1', month: date(30).slice(0, 7), manday: 18 },
    { id: 'effort-month-3', effort_id: 'effort-2', month: date(0).slice(0, 7), manday: 16 },
    { id: 'effort-month-4', effort_id: 'effort-3', month: date(0).slice(0, 7), manday: 10 },
  ],
  change_requests: [
    { id: 'cr-1', project_id: 'demo-project-1', cr_id: 'CR-001', title: 'Additional payroll validation rules', requested_by: 'Jordan Lee', request_date: date(-12), approved_by: 'Alex Morgan', approval_date: date(-8), total_manday: 8, discount: 0, status: 'Approved', notes: 'Add validation for exceptional payroll cases.' },
    { id: 'cr-2', project_id: 'demo-project-1', cr_id: 'CR-002', title: 'New management dashboard', requested_by: 'Jordan Lee', request_date: date(-2), approved_by: '', approval_date: '', total_manday: 12, discount: 0, status: 'Under Review', notes: 'Dashboard for monthly workforce reporting.' },
  ],
  cr_items: [
    { id: 'cr-item-1', cr_id: 'cr-1', detail: 'Configure and test new payroll validations', manday: 8 },
    { id: 'cr-item-2', cr_id: 'cr-2', detail: 'Design dashboard and reporting views', manday: 12 },
  ],
  issues: [
    { id: 'issue-1', project_id: 'demo-project-1', issue_date: date(-5), title: 'Payroll rounding discrepancy', description: 'A small rounding difference appears in one test scenario.', reported_by: 'Nina Chen', assigned_to: 'Alex Morgan', status: 'In Progress', resolved_date: '', notes: 'Review calculation configuration.' },
    { id: 'issue-2', project_id: 'demo-project-1', issue_date: date(-1), title: 'UAT access for finance team', description: 'Two customer testers need access to the UAT environment.', reported_by: 'Jordan Lee', assigned_to: 'Alex Morgan', status: 'Open', resolved_date: '', notes: '' },
    { id: 'issue-3', project_id: 'demo-project-2', issue_date: date(-10), title: 'Mobile home-page layout', description: 'One card needs spacing adjustment on smaller screens.', reported_by: 'Sam Rivera', assigned_to: 'Sam Rivera', status: 'Resolved', resolved_date: date(-4), notes: 'Updated layout.' },
  ],
  risks: [
    { id: 'risk-1', project_id: 'demo-project-1', risk_date: date(-20), title: 'Late employee data sign-off', description: 'Delayed validation could affect production migration.', probability: 'Medium', impact: 'High', mitigation: 'Run daily reconciliation and escalate outstanding records.', owner: 'Jordan Lee', status: 'Mitigating' },
    { id: 'risk-2', project_id: 'demo-project-1', risk_date: date(-7), title: 'Payroll integration capacity', description: 'Integration tests depend on an external vendor window.', probability: 'Low', impact: 'Medium', mitigation: 'Reserve a second test window.', owner: 'Alex Morgan', status: 'Monitoring' },
    { id: 'risk-3', project_id: 'demo-project-3', risk_date: date(0), title: 'Legacy data quality', description: 'Historical finance data needs additional profiling.', probability: 'High', impact: 'High', mitigation: 'Perform a sample migration during discovery.', owner: 'Taylor Kim', status: 'Monitoring' },
  ],
  activities: [
    { id: 'activity-1', project_id: 'demo-project-1', activity_date: date(-2), activity_type: 'Workshop', channel: 'Online', title: 'UAT weekly checkpoint', description: 'Reviewed open scenarios and owners.' },
    { id: 'activity-2', project_id: 'demo-project-1', activity_date: date(-6), activity_type: 'Decision', channel: 'MS Teams', title: 'Payroll sign-off approach', description: 'Agreed on the sample-based sign-off criteria.' },
    { id: 'activity-3', project_id: 'demo-project-2', activity_date: date(-4), activity_type: 'Go Live', channel: 'Onsite', title: 'Employee portal launch', description: 'Launch support and stakeholder check-in.' },
  ],
  project_lessons_learned: [
    { id: 'lesson-1', project_id: 'demo-project-1', title: 'Validate migration samples early', category: 'process', phase: 'Testing', occurred_at: date(-8), context: 'Initial data review found inconsistent employee identifiers.', impact: 'Resolved before full migration rehearsal.', root_cause: 'Source-system rules were not documented in one place.', lesson: 'Agree on validation ownership during discovery.', recommendation: 'Maintain a shared data quality checklist.', follow_up: 'Review at the next migration rehearsal.', owner: 'Nina Chen', due_date: date(14), status: 'In Progress', reference_url: '', created_by: 'demo-user', created_at: createdAt, updated_at: createdAt },
    { id: 'lesson-2', project_id: 'demo-project-1', title: 'Short feedback cycles improved UAT', category: 'success', phase: 'Testing', occurred_at: date(-3), context: 'Daily triage helped resolve issues quickly.', impact: 'Reduced time waiting for clarifications.', root_cause: 'Clear ownership and regular check-ins.', lesson: 'Keep customer and implementation teams aligned daily.', recommendation: 'Continue short UAT stand-ups.', follow_up: '', owner: 'Alex Morgan', due_date: null, status: 'Open', reference_url: '', created_by: 'demo-user', created_at: createdAt, updated_at: createdAt },
  ],
  project_environments: [
    { id: 'env-1', project_id: 'demo-project-1', environment: 'DEV', url: 'https://dev.example.test', username: 'demo-dev', password: 'mock-only' },
    { id: 'env-2', project_id: 'demo-project-1', environment: 'UAT', url: 'https://uat.example.test', username: 'demo-uat', password: 'mock-only' },
    { id: 'env-3', project_id: 'demo-project-1', environment: 'Production', url: 'https://app.example.test', username: 'demo-user', password: 'mock-only' },
  ],
  project_progress_snapshots: [
    { id: 'snapshot-1', project_id: 'demo-project-1', snapshot_date: date(-30), baseline_percent: 55, actual_percent: 50, note: 'Monthly review', created_at: createdAt, updated_at: createdAt },
    { id: 'snapshot-2', project_id: 'demo-project-1', snapshot_date: date(-15), baseline_percent: 68, actual_percent: 63, note: 'UAT preparation', created_at: createdAt, updated_at: createdAt },
    { id: 'snapshot-3', project_id: 'demo-project-1', snapshot_date: date(0), baseline_percent: 80, actual_percent: 74, note: 'Current status', created_at: createdAt, updated_at: createdAt },
  ],
  masters_code: codes,
  notes: [
    { id: 'note-1', title: 'Demo workspace', details: 'All displayed content is sample data stored only in this browser.', start_date: date(-30), end_date: date(60), status: 'active', created_at: createdAt, updated_at: createdAt },
    { id: 'note-2', title: 'UAT checkpoint', details: 'Review remaining UAT scenarios before sign-off.', start_date: date(-5), end_date: date(20), status: 'active', created_at: createdAt, updated_at: createdAt },
  ],
  timesheet_entries: [
    { id: 'timesheet-1', user_id: 'demo-user', work_date: date(-1), project_key: 'ACME', description: 'UAT planning and issue triage', hours: 6, created_at: createdAt, updated_at: createdAt },
    { id: 'timesheet-2', user_id: 'demo-user', work_date: date(-2), project_key: 'ACME', description: 'Payroll configuration review', hours: 7.5, created_at: createdAt, updated_at: createdAt },
    { id: 'timesheet-3', user_id: 'demo-user', work_date: date(-4), project_key: 'NSL', description: 'Go-live support checkpoint', hours: 4, created_at: createdAt, updated_at: createdAt },
  ],
  task_templates: [{ id: 'template-1', template_no: 1, name: 'Standard HR Implementation', created_by: 'demo-user', created_at: createdAt, updated_at: createdAt }],
  task_template_items: [
    { id: 'template-item-1', template_id: 'template-1', wbs: '1', parent_wbs: '', level: 0, sort_order: 1000, task_name: 'Project initiation', duration: 10, effort_manday: 8, created_at: createdAt },
    { id: 'template-item-2', template_id: 'template-1', wbs: '1.1', parent_wbs: '1', level: 1, sort_order: 1000, task_name: 'Kick-off and governance', duration: 5, effort_manday: 4, created_at: createdAt },
    { id: 'template-item-3', template_id: 'template-1', wbs: '2', parent_wbs: '', level: 0, sort_order: 2000, task_name: 'Requirements & design', duration: 20, effort_manday: 15, created_at: createdAt },
  ],
  project_checklist_topics: checklistTopics,
  project_checklist_progress: [
    { project_id: 'demo-project-1', topic_id: 'check-1', not_required: false, done: true, completion_date: date(-80), completed_by: 'Alex Morgan', jira_id: 'HPT-12', notes: '' },
    { project_id: 'demo-project-1', topic_id: 'check-2', not_required: false, done: true, completion_date: date(-76), completed_by: 'Alex Morgan', jira_id: '', notes: 'Approved at kick-off.' },
    { project_id: 'demo-project-1', topic_id: 'check-3', not_required: false, done: true, completion_date: date(-60), completed_by: 'Jordan Lee', jira_id: 'HPT-34', notes: '' },
    { project_id: 'demo-project-1', topic_id: 'check-10', not_required: false, done: true, completion_date: date(-24), completed_by: 'Nina Chen', jira_id: '', notes: 'Validated with HR.' },
    { project_id: 'demo-project-1', topic_id: 'check-15', not_required: false, done: false, completion_date: '', completed_by: '', jira_id: '', notes: '', uat_customer: '1200', uat_hmc: '1200', production_customer: '', production_hmc: '' },
  ],
  email_reminder_logs: [],
};
