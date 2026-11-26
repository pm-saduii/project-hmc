export interface Project {
  id: string;
  name: string;
  code: string;
  client: string;
  customerAbbreviation: string;
  customerId: string;
  softwareVersion: '' | 'Humatrix' | 'Workplaze';
  status: string;
  startDate: string;
  endDate: string;
  description: string;
  color: string;
  emailNotificationEnabled: boolean;
  emailNotificationMode: 'task' | 'custom';
  emailNotificationRecipients: string;
  emailNotificationTime: string;
  emailNotificationLastSentAt?: string;
  /** Customer logo as a PNG data URL ('' = none). */
  logo?: string;
}

export interface MasterCode {
  id: string;
  codeType: string;
  codeKey: string;
  codeValue: string;
  label: string;
  sortOrder: number;
  active: boolean;
  textColor: string;
  bgColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectEnvironment {
  id: string;
  projectId: string;
  environment: 'DEV' | 'QA' | 'UAT' | 'Production';
  url: string;
  username: string;
  password: string;
}

export interface ProjectProgressSnapshot {
  id: string;
  projectId: string;
  snapshotDate: string;
  baselinePercent: number;
  actualPercent: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  details: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetEntry {
  id: string;
  userId: string;
  workDate: string;
  projectKey: string;
  description: string;
  hours: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  wbs: string;
  taskName: string;
  effortManday: number;
  baselineStartDate?: string;
  baselineEndDate?: string;
  startDate: string;
  endDate: string;
  actualFinish: string;   // ← new: actual finish date
  phase?: string;
  duration: number;
  percentComplete: number;
  status: 'Todo' | 'In Progress' | 'Block/Delay' | 'Done';
  resource: string;
  relatedTask: string;
  relatedTaskType: 'FS' | 'SS' | 'FF' | 'SF';
  relatedTaskLagDays: number;
  parentId: string;
  level: number;
  sortOrder: number;
  /** Key milestone (External Status · Key Milestone Tracker). */
  isMilestone?: boolean;
}

export interface Member {
  id: string;
  projectId: string;
  name: string;
  thaiName: string;
  nickname: string;
  role: string;
  position: string;      // ← new
  email: string;
  tel: string;
  ext: string;
  type: 'internal' | 'client';
  notes: string;         // ← new
  signature?: string;    // PNG data URL; used for the Project Manager on reports
}

export interface Milestone {
  id: string;
  projectId: string;
  phase: string;
  name: string;
  percent: number;
  amount: number;
  phaseAmount: number;
  dueDate: string;
  billingDate: string;
  notes: string;
  status: 'pending' | 'billed' | 'paid';
  /** Task whose progress this milestone follows (External Status · Key Milestone Tracker). */
  taskId?: string | null;
}

export interface Effort {
  id: string;
  projectId: string;
  module: string;
  phase?: string;
  budgetAmount: number;
  budgetManday: number;
  monthly: Record<string, number>;
}

export interface TaskTemplate {
  id: string;
  templateNo: number;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateItem {
  id: string;
  templateId: string;
  wbs: string;
  parentWbs: string;
  level: number;
  sortOrder: number;
  taskName: string;
  duration: number;
  effortManday: number;
  createdAt: string;
}

// ── Change Request ────────────────────────────────────────────────────────────
export interface ChangeRequest {
  id: string;
  projectId: string;
  crId: string;          // e.g. CR-001
  title: string;
  requestedBy: string;
  requestDate: string;
  approvedBy: string;
  approvalDate: string;
  totalManday: number;
  discount: number;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Implemented' | 'Close';
  notes: string;
}

export interface CRItem {
  id: string;
  crId: string;          // FK → ChangeRequest.id
  detail: string;
  manday: number;
}

// ── Issue ─────────────────────────────────────────────────────────────────────
export interface Issue {
  id: string;
  projectId: string;
  issueDate: string;
  title: string;
  description: string;
  reportedBy: string;    // member name
  assignedTo: string;    // member name
  status: 'Open' | 'In Progress' | 'Resolved' | 'Blocked';
  resolvedDate: string;
  notes: string;
  // External Status Report
  dueDate?: string | null;
  /** S Scope · T Time · C Cost · Q Quality, e.g. "T,Q". */
  impactArea?: string;
  nextAction?: string;
  visibility?: 'External' | 'Internal';
  /** '' · Decision · Acknowledge – shown on "Items for Steering". */
  steering?: string;
  steeringAsk?: string;
}

// ── Risk ──────────────────────────────────────────────────────────────────────
export interface Risk {
  id: string;
  projectId: string;
  riskDate: string;
  title: string;
  description: string;
  probability: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  mitigation: string;
  owner: string;
  status: 'Monitoring' | 'Mitigating' | 'Closed';
  dueDate?: string | null;
  impactArea?: string;
  visibility?: 'External' | 'Internal';
  steering?: string;
  steeringAsk?: string;
}

export interface Activity {
  id: string;
  projectId: string;
  activityDate: string;
  activityType: string;
  channel: 'Online' | 'Onsite' | 'Email' | 'MS Teams' | 'Line' | 'Other';
  title: string;
  description: string;
}

export interface ProjectLessonLearned {
  id: string;
  projectId: string;
  title: string;
  category: 'success' | 'challenge' | 'process' | 'technical' | 'communication' | 'vendor';
  phase: string;
  occurredAt: string;
  context: string;
  impact: string;
  rootCause: string;
  lesson: string;
  recommendation: string;
  followUp: string;
  owner: string;
  dueDate: string | null;
  status: 'Open' | 'In Progress' | 'Done';
  referenceUrl: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'table' | 'split' | 'gantt' | 'kanban';
export type ProjectStatus = Project['status'];

// ── Auth ──────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'director' | 'am' | 'pm' | 'member' | 'client';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: UserRole;
  isActive?: boolean;
  projectAccessScope?: 'member' | 'all';
  screenPermissions?: Record<string, 'hidden' | 'read' | 'full'> | string[] | null;
  createdAt: string;
  updatedAt: string;
}

// ── Monthly executive report (One Page) ──────────────────────────────────────
export type ReportStatus = 'on_track' | 'at_risk' | 'off_track';

export interface MonthlyReport {
  id: string;
  projectId: string;
  period: string;              // 'YYYY-MM'
  state: 'draft' | 'published';
  summary: string;
  decisions: string;
  /** Customer version of the report: summary and the actions needed from the customer. */
  externalSummary?: string;
  clientActions?: string;
  overallStatus: ReportStatus | null;
  scheduleStatus: ReportStatus | null;
  budgetStatus: ReportStatus | null;
  scopeStatus: ReportStatus | null;
  paymentStatus: ReportStatus | null;
  /** Frozen report numbers and lists, set when published (MonthlyReportData). */
  snapshot: unknown | null;
  publishedAt: string | null;
  publishedBy: string | null;
  updatedAt: string;
}
