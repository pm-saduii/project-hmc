// ── User Role Management (Admin Only) ─────────────────────────────────────
export async function updateUserRole(userId: string, newRole: 'member' | 'client'): Promise<void> {
  // Get current user profile for role
  const { data: sessionData } = await supabase.auth.getSession();
  let role = 'member';
  let myId = '';
  if (sessionData?.session?.user?.id) {
    myId = sessionData.session.user.id;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', myId).single();
    if (profile?.role) role = profile.role;
  }
  if (role !== 'admin') throw new Error('FORBIDDEN');
  if (!['member','client'].includes(newRole)) throw new Error('INVALID_ROLE');
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) throw new Error(error.message);
}
// ── RBAC Utility ──────────────────────────────────────────────────────────
export async function checkProjectPermission(projectId: string, action: 'read' | 'write', screenId?: string): Promise<boolean> {
  const { role, userId, email, projectAccessScope, screenPermissions } = await getCurrentUserRoleAndId();
  if (role === 'admin') return true;
  const isMember = await isProjectMember(projectId, userId, email);
  if (screenId && screenPermissions) {
    const inheritsLessonAccess = screenId === 'lessons'
      && !Array.isArray(screenPermissions)
      && !Object.prototype.hasOwnProperty.call(screenPermissions, screenId);
    const access = Array.isArray(screenPermissions)
      ? screenPermissions.includes(screenId) ? 'full' : 'hidden'
      : inheritsLessonAccess
        ? role === 'client' ? 'read' : 'full'
        : screenPermissions[screenId] || 'hidden';
    if (access === 'hidden') return false;
    if (action === 'read') return projectAccessScope === 'all' || isMember;
    return access === 'full' && (projectAccessScope === 'all' || isMember);
  }
  if (action === 'read' && projectAccessScope === 'all') return true;
  if (role === 'client') return action === 'read' && isMember;
  if (role === 'member' || role === 'pm') return isMember;
  return false;
}

async function getProjectIdsFromMembership(userId: string, email: string | null): Promise<string[]> {
  const ids = new Set<string>();

  if (userId) {
    const { data: pmData, error: pmErr } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);
    if (pmErr) throw new Error(pmErr.message);
    (pmData || []).forEach((row: any) => { if (row.project_id) ids.add(row.project_id); });
  }

  if (ids.size === 0 && email) {
    const { data: memberRows, error: memberErr } = await supabase
      .from('members')
      .select('project_id')
      .ilike('email', email);
    if (memberErr) throw new Error(memberErr.message);
    (memberRows || []).forEach((row: any) => { if (row.project_id) ids.add(row.project_id); });
  }

  if (ids.size === 0 && userId) {
    const { data: memberRows, error: memberErr } = await supabase
      .from('members')
      .select('project_id')
      .eq('user_id', userId);
    if (memberErr) throw new Error(memberErr.message);
    (memberRows || []).forEach((row: any) => { if (row.project_id) ids.add(row.project_id); });
  }

  return Array.from(ids);
}

async function isProjectMember(projectId: string, userId: string, email: string | null): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return true;

  if (!email) return false;
  const { data: memberData, error: memberErr } = await supabase
    .from('members')
    .select('project_id')
    .eq('project_id', projectId)
    .ilike('email', email)
    .limit(1);
  if (memberErr) throw new Error(memberErr.message);
  return Array.isArray(memberData) && memberData.length > 0;
}

// helper: get current user id and role (with short-lived cache to avoid lock contention)
type CachedAuthInfo = { role: string; userId: string; email: string | null; projectAccessScope: 'member' | 'all'; screenPermissions: Record<string, 'hidden' | 'read' | 'full'> | string[] | null };
let _authCache: (CachedAuthInfo & { expiresAt: number }) | null = null;
const AUTH_CACHE_TTL_MS = 30_000;

export function clearAuthCache(): void {
  _authCache = null;
}

// Deduplicate concurrent calls: if a fetch is in-flight, queue behind it
let _authFetchPromise: Promise<CachedAuthInfo> | null = null;

export async function getCurrentUserRoleAndId(): Promise<CachedAuthInfo> {
  const now = Date.now();
  if (_authCache && _authCache.expiresAt > now) {
    return { role: _authCache.role, userId: _authCache.userId, email: _authCache.email, projectAccessScope: _authCache.projectAccessScope, screenPermissions: _authCache.screenPermissions };
  }
  if (_authFetchPromise) return _authFetchPromise;

  _authFetchPromise = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let role = 'member';
    let userId = '';
    let email: string | null = null;
    let projectAccessScope: 'member' | 'all' = 'member';
    let screenPermissions: CachedAuthInfo['screenPermissions'] = null;
    const user = sessionData?.session?.user;
    if (user?.id) {
      userId = user.id;
      const { data: profile, error } = await supabase.from('profiles').select('role,email,project_access_scope,screen_permissions').eq('id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      if ((profile as any)?.role) role = (profile as any).role;
      if ((profile as any)?.email) email = (profile as any).email;
      if ((profile as any)?.project_access_scope === 'all') projectAccessScope = 'all';
      if (Array.isArray((profile as any)?.screen_permissions)) screenPermissions = (profile as any).screen_permissions;
      else if ((profile as any)?.screen_permissions && typeof (profile as any).screen_permissions === 'object') screenPermissions = (profile as any).screen_permissions;
      if (!email && user.email) {
        email = user.email;
      }
    }
    _authCache = { role, userId, email, projectAccessScope, screenPermissions, expiresAt: Date.now() + AUTH_CACHE_TTL_MS };
    return { role, userId, email, projectAccessScope, screenPermissions };
  })().finally(() => { _authFetchPromise = null; });

  return _authFetchPromise;
}
import { compareWbs } from '../utils';

// ===== SUPABASE API SERVICE =====
// All data operations go through Supabase PostgreSQL directly.
// No custom backend needed.

import { supabase } from './supabase';
import { parseISO, isValid } from 'date-fns';
import type { Project, Task, Member, Milestone, Effort, ChangeRequest, CRItem, Issue, Risk, ProjectEnvironment, ProjectProgressSnapshot, MasterCode, TaskTemplate, TaskTemplateItem, Activity, Note, TimesheetEntry, ProjectLessonLearned, MonthlyReport } from '../types';
import type { ProjectChecklistCategoryId, ProjectChecklistProgress, ProjectChecklistProgressEntry, ProjectChecklistTopic } from '../utils/projectChecklist';

const TASK_DEPENDENCY_TYPES = new Set(['FS', 'SS', 'FF', 'SF']);

// ── Snake ↔ Camel conversion helpers ────────────────────────────────────────

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function rowToObj<T>(row: Record<string, unknown>): T {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    obj[snakeToCamel(k)] = v;
  }
  return obj as T;
}

function objToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'monthly' || k === 'items') continue; // skip virtual fields
    row[camelToSnake(k)] = v;
  }
  return row;
}

function rowsToObjs<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => rowToObj<T>(r));
}

// ── Projects ────────────────────────────────────────────────────────────────

export const projectApi = {
  getAll: async (): Promise<{ data: Project[] }> => {
    const { role, userId, email, projectAccessScope } = await getCurrentUserRoleAndId();
    if (role === 'admin' || projectAccessScope === 'all') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return { data: rowsToObjs<Project>(data || []) };
    } else {
      // Member/Client เห็นเฉพาะ project ที่อยู่ใน project_members หรือ members
      const projectIds = await getProjectIdsFromMembership(userId, email);
      if (!projectIds.length) return { data: [] };
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return { data: rowsToObjs<Project>(data || []) };
    }
  },

  create: async (p: Partial<Project>): Promise<{ data: Project }> => {
    const { role } = await getCurrentUserRoleAndId();
    if (role !== 'admin') throw new Error('FORBIDDEN');
    const row = objToRow(p as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    const { data, error } = await supabase
      .from('projects')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Project>(data) };
  },

  update: async (id: string, p: Partial<Project>): Promise<{ data: Project }> => {
    const can = await checkProjectPermission(id, 'write', 'portfolio-overview');
    if (!can) throw new Error('FORBIDDEN');
    const row = objToRow(p as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    const { data, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Project>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const can = await checkProjectPermission(id, 'write', 'portfolio-overview');
    if (!can) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Project Environments ───────────────────────────────────────────────────

export const projectEnvironmentApi = {
  getByProject: async (pid?: string): Promise<{ data: ProjectEnvironment[] }> => {
    let q = supabase.from('project_environments').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<ProjectEnvironment>(data || []) };
  },

  create: async (env: Partial<ProjectEnvironment>): Promise<{ data: ProjectEnvironment }> => {
    const projectId = String(env.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'env')) throw new Error('FORBIDDEN');
    const row = objToRow(env as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('project_environments')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<ProjectEnvironment>(data) };
  },

  update: async (id: string, env: Partial<ProjectEnvironment>): Promise<{ data: ProjectEnvironment }> => {
    const { data: existing, error: lookupError } = await supabase.from('project_environments').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || env.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'env')) throw new Error('FORBIDDEN');
    const row = objToRow(env as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('project_environments')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<ProjectEnvironment>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('project_environments').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'env')) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('project_environments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

export const projectProgressApi = {
  getByProject: async (pid?: string): Promise<{ data: ProjectProgressSnapshot[] }> => {
    const q = supabase.from('project_progress_snapshots').select('*').order('snapshot_date', { ascending: true });
    const query = pid ? q.eq('project_id', pid) : q;
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<ProjectProgressSnapshot>(data || []) };
  },

  save: async (snapshot: Partial<ProjectProgressSnapshot>): Promise<{ data: ProjectProgressSnapshot }> => {
    if (!snapshot.projectId) throw new Error('MISSING_PROJECT_ID');
    const can = await checkProjectPermission(snapshot.projectId, 'write', 'summary');
    if (!can) throw new Error('FORBIDDEN');
    const row = objToRow(snapshot as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;

    if (snapshot.id) {
      const { data, error } = await supabase
        .from('project_progress_snapshots')
        .update(row)
        .eq('id', snapshot.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { data: rowToObj<ProjectProgressSnapshot>(data) };
    }

    const { data, error } = await supabase
      .from('project_progress_snapshots')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<ProjectProgressSnapshot>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data, error: fetchErr } = await supabase.from('project_progress_snapshots').select('project_id').eq('id', id).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const projectId = (data as any)?.project_id;
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const can = await checkProjectPermission(projectId, 'write', 'summary');
    if (!can) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('project_progress_snapshots').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

export const masterCodeApi = {
  getAll: async (codeType?: string): Promise<{ data: MasterCode[] }> => {
    let q = supabase.from('masters_code').select('*');
    if (codeType) q = q.eq('code_type', codeType);
    q = q.order('sort_order', { ascending: true }).order('code_value', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<MasterCode>(data || []) };
  },

  create: async (m: Partial<MasterCode>): Promise<{ data: MasterCode }> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    const { data, error } = await supabase.from('masters_code').insert(row).select().single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<MasterCode>(data) };
  },

  update: async (id: string, m: Partial<MasterCode>): Promise<{ data: MasterCode }> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    const { data, error } = await supabase.from('masters_code').update(row).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<MasterCode>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const { error } = await supabase.from('masters_code').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Notes ───────────────────────────────────────────────────────────────────

export const noteApi = {
  getAll: async (): Promise<{ data: Note[] }> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Note>(data || []) };
  },

  create: async (note: Partial<Note>): Promise<{ data: Note }> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const row = objToRow(note as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    if (row.start_date === '') row.start_date = null;
    if (row.end_date === '') row.end_date = null;
    const { data, error } = await supabase.from('notes').insert(row).select().single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Note>(data) };
  },

  update: async (id: string, note: Partial<Note>): Promise<{ data: Note }> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const row = objToRow(note as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    if (row.start_date === '') row.start_date = null;
    if (row.end_date === '') row.end_date = null;
    const { data, error } = await supabase.from('notes').update(row).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Note>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Personal Timesheets ─────────────────────────────────────────────────────

type TimesheetInput = Pick<TimesheetEntry, 'workDate' | 'projectKey' | 'description' | 'hours'>;

function validateTimesheetInput(entry: TimesheetInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.workDate)) throw new Error('INVALID_WORK_DATE');
  if (!entry.projectKey.trim()) throw new Error('PROJECT_REQUIRED');
  if (!entry.description.trim()) throw new Error('DESCRIPTION_REQUIRED');
  if (!Number.isFinite(entry.hours) || entry.hours <= 0 || entry.hours > 24) {
    throw new Error('INVALID_HOURS');
  }
}

export const timesheetApi = {
  getByDateRange: async (startDate: string, endDate: string): Promise<{ data: TimesheetEntry[] }> => {
    const { userId } = await getCurrentUserRoleAndId();
    if (!userId) throw new Error('UNAUTHENTICATED');
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<TimesheetEntry>(data || []) };
  },

  create: async (entry: TimesheetInput): Promise<{ data: TimesheetEntry }> => {
    validateTimesheetInput(entry);
    const { userId } = await getCurrentUserRoleAndId();
    if (!userId) throw new Error('UNAUTHENTICATED');
    const { data, error } = await supabase
      .from('timesheet_entries')
      .insert({
        user_id: userId,
        work_date: entry.workDate,
        project_key: entry.projectKey.trim(),
        description: entry.description.trim(),
        hours: entry.hours,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<TimesheetEntry>(data) };
  },

  update: async (id: string, entry: TimesheetInput): Promise<{ data: TimesheetEntry }> => {
    validateTimesheetInput(entry);
    const { userId } = await getCurrentUserRoleAndId();
    if (!userId) throw new Error('UNAUTHENTICATED');
    const { data, error } = await supabase
      .from('timesheet_entries')
      .update({
        work_date: entry.workDate,
        project_key: entry.projectKey.trim(),
        description: entry.description.trim(),
        hours: entry.hours,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<TimesheetEntry>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { userId } = await getCurrentUserRoleAndId();
    if (!userId) throw new Error('UNAUTHENTICATED');
    const { error } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  },
};


// ── Project Checklist ──────────────────────────────────────────────────────

export const projectChecklistApi = {
  getTopics: async (): Promise<ProjectChecklistTopic[]> => {
    const { userId } = await getCurrentUserRoleAndId();
    if (!userId) throw new Error('UNAUTHENTICATED');
    const { data, error } = await supabase
      .from('project_checklist_topics')
      .select('*')
      .order('category', { ascending: true })
      .order('work_system', { ascending: true })
      .order('stage', { ascending: true })
      .order('order_no', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      category: row.category as ProjectChecklistCategoryId,
      ...(row.work_system ? { workSystem: String(row.work_system) } : {}),
      ...(row.stage ? { stage: String(row.stage) as ProjectChecklistTopic['stage'] } : {}),
      orderNo: Number(row.order_no || 10),
      title: String(row.title || ''),
    }));
  },

  replaceTopics: async (topics: ProjectChecklistTopic[]): Promise<ProjectChecklistTopic[]> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');

    const rows = topics.map((topic) => {
      const workSystem = topic.category === 'project' ? '' : String(topic.workSystem || '').trim();
      const stage = topic.category === 'project' ? String(topic.stage || '').trim() : '';
      if (topic.category !== 'project' && !workSystem) throw new Error('WORK_SYSTEM_REQUIRED');
      if (topic.category === 'project' && !stage) throw new Error('STAGE_REQUIRED');
      const orderNo = Number(topic.orderNo);
      if (!Number.isFinite(orderNo) || orderNo < 1) throw new Error('INVALID_ORDER_NO');
      return {
        id: topic.id,
        category: topic.category,
        work_system: workSystem,
        stage,
        order_no: orderNo,
        title: topic.title.trim(),
      };
    });

    const { data: existingRows, error: listError } = await supabase.from('project_checklist_topics').select('id');
    if (listError) throw new Error(listError.message);
    if (rows.length) {
      const { error } = await supabase.from('project_checklist_topics').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    const retainedIds = new Set(rows.map((row) => row.id));
    const removedIds = (existingRows || [])
      .map((row: { id: string }) => row.id)
      .filter((id: string) => !retainedIds.has(id));
    if (removedIds.length) {
      const { error } = await supabase.from('project_checklist_topics').delete().in('id', removedIds);
      if (error) throw new Error(error.message);
    }

    return projectChecklistApi.getTopics();
  },

  /** Create or update one topic (admin). */
  saveTopic: async (topic: ProjectChecklistTopic): Promise<void> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const title = topic.title.trim();
    if (!title) throw new Error('Enter the topic');
    const workSystem = topic.category === 'project' ? '' : String(topic.workSystem || '').trim();
    const stage = topic.category === 'project' ? String(topic.stage || '').trim() : '';
    if (topic.category !== 'project' && !workSystem) throw new Error('Choose a work system');
    if (topic.category === 'project' && !stage) throw new Error('Choose a stage');
    const { error } = await supabase.from('project_checklist_topics').upsert({
      id: topic.id, category: topic.category, work_system: workSystem, stage, order_no: Math.max(1, Math.round(Number(topic.orderNo) || 1)), title,
    }, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },

  /** Renumber topics (admin): order_no 1..n in the given order. */
  saveTopicOrder: async (ids: string[]): Promise<void> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    for (let i = 0; i < ids.length; i += 1) {
      const { error } = await supabase.from('project_checklist_topics').update({ order_no: i + 1 }).eq('id', ids[i]);
      if (error) throw new Error(error.message);
    }
  },

  deleteTopic: async (id: string): Promise<void> => {
    const user = await getCurrentUserRoleAndId();
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    const { error } = await supabase.from('project_checklist_topics').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getProgress: async (projectId: string): Promise<ProjectChecklistProgress> => {
    const canRead = await checkProjectPermission(projectId, 'read', 'checklists');
    if (!canRead) throw new Error('FORBIDDEN');
    const { data, error } = await supabase
      .from('project_checklist_progress')
      .select('topic_id, not_required, done, completion_date, completed_by, jira_id, notes, uat_customer, uat_hmc, production_customer, production_hmc')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);

    return (data || []).reduce<ProjectChecklistProgress>((progress, row: Record<string, unknown>) => {
      progress[String(row.topic_id)] = {
        notRequired: Boolean(row.not_required),
        done: Boolean(row.done),
        completionDate: String(row.completion_date || ''),
        completedBy: String(row.completed_by || ''),
        jiraId: String(row.jira_id || ''),
        notes: String(row.notes || ''),
        uatCustomer: row.uat_customer == null ? '' : String(row.uat_customer),
        uatHmc: row.uat_hmc == null ? '' : String(row.uat_hmc),
        productionCustomer: row.production_customer == null ? '' : String(row.production_customer),
        productionHmc: row.production_hmc == null ? '' : String(row.production_hmc),
      };
      return progress;
    }, {});
  },

  saveProgress: async (projectId: string, progress: ProjectChecklistProgress): Promise<void> => {
    const canWrite = await checkProjectPermission(projectId, 'write', 'checklists');
    if (!canWrite) throw new Error('FORBIDDEN');
    const { userId } = await getCurrentUserRoleAndId();
    const numberOrNull = (value?: string) => {
      if (value == null || value.trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const rows = Object.entries(progress).map(([topicId, item]) => ({
      project_id: projectId,
      topic_id: topicId,
      not_required: Boolean(item.notRequired),
      done: Boolean(item.done),
      completion_date: item.completionDate || null,
      completed_by: item.completedBy || '',
      jira_id: item.jiraId || '',
      notes: item.notes || '',
      uat_customer: numberOrNull(item.uatCustomer),
      uat_hmc: numberOrNull(item.uatHmc),
      production_customer: numberOrNull(item.productionCustomer),
      production_hmc: numberOrNull(item.productionHmc),
      updated_by: userId || null,
    }));
    if (!rows.length) return;
    const { error } = await supabase
      .from('project_checklist_progress')
      .upsert(rows, { onConflict: 'project_id,topic_id' });
    if (error) throw new Error(error.message);
  },
};
// ── Tasks ───────────────────────────────────────────────────────────────────

export const taskApi = {
  getByProject: async (pid?: string): Promise<{ data: Task[] }> => {
    let q = supabase.from('tasks').select('*');
    if (pid) q = q.eq('project_id', pid);
    // Prefer new sort_order, fallback to legacy order for older rows.
    q = q.order('sort_order', { ascending: true }).order('order', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const tasks = rowsToObjs<Task>(data || []);
    const normalized = tasks.map((task) => {
      const normalizedEffort = normalizeEffortManday((task as any).effortManday);
      const normalizedDependencyType = normalizeDependencyType((task as any).relatedTaskType);
      const normalizedDependencyLagDays = normalizeDependencyLagDays((task as any).relatedTaskLagDays);
      const withEffort = normalizedEffort !== Number((task as any).effortManday || 0)
        ? { ...task, effortManday: normalizedEffort, relatedTaskType: normalizedDependencyType, relatedTaskLagDays: normalizedDependencyLagDays }
        : {
          ...task,
          effortManday: Number((task as any).effortManday || 0),
          relatedTaskType: normalizedDependencyType,
          relatedTaskLagDays: normalizedDependencyLagDays,
        };
      if (!task.startDate || !task.endDate) return withEffort;
      const calculated = calcDurationFromDates(task);
      return withEffort.duration !== calculated ? { ...withEffort, duration: calculated } : withEffort;
    });
    const mismatches = normalized.filter((task, index) => task.duration !== tasks[index].duration);
    if (mismatches.length > 0) {
      for (const task of mismatches) {
        await supabase.from('tasks').update({ duration: task.duration }).eq('id', task.id);
      }
    }
    return { data: normalized };
  },

  saveBaselineOnce: async (projectId: string): Promise<{ data: Task[] }> => {
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!canWrite) throw new Error('FORBIDDEN');

    const { data: existingRows, error: existingErr } = await supabase
      .from('tasks')
      .select('id, start_date, end_date, baseline_start_date, baseline_end_date')
      .eq('project_id', projectId);
    if (existingErr) throw new Error(existingErr.message);

    const rows = existingRows || [];
    const alreadySaved = rows.some((row: any) => row.baseline_start_date || row.baseline_end_date);
    if (alreadySaved) throw new Error('BASELINE_ALREADY_SAVED');

    const writes = rows.map((row: any) =>
      supabase
        .from('tasks')
        .update({ baseline_start_date: row.start_date || null, baseline_end_date: row.end_date || null })
        .eq('id', row.id)
    );
    const results = await Promise.all(writes);
    const writeErr = results.find((result) => result.error);
    if (writeErr?.error) throw new Error(writeErr.error.message);

    return taskApi.getByProject(projectId);
  },

  /** Mark / unmark tasks as key milestones in two requests (no plan recalculation needed). */
  setMilestones: async (projectId: string, on: string[], off: string[]): Promise<{ data: Task[] }> => {
    const canWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!canWrite) throw new Error('FORBIDDEN');
    for (const [ids, value] of [[on, true], [off, false]] as const) {
      if (!ids.length) continue;
      const { error } = await supabase.from('tasks').update({ is_milestone: value }).eq('project_id', projectId).in('id', ids);
      if (error) throw new Error(/is_milestone/.test(error.message) ? 'Run the migration 2026-12-07-task-milestone.sql first.' : error.message);
    }
    return taskApi.getByProject(projectId);
  },

  /** Replace the baseline of every task with its current plan dates. */
  resaveBaseline: async (projectId: string): Promise<{ data: Task[] }> => {
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!canWrite) throw new Error('FORBIDDEN');
    const { data: rows, error } = await supabase.from('tasks').select('id, start_date, end_date').eq('project_id', projectId);
    if (error) throw new Error(error.message);
    const results = await Promise.all((rows || []).map((row: any) =>
      supabase.from('tasks').update({ baseline_start_date: row.start_date || null, baseline_end_date: row.end_date || null }).eq('id', row.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return taskApi.getByProject(projectId);
  },

  create: async (t: Partial<Task>): Promise<{ data: Task; allTasks: Task[] }> => {
    const row = objToRow(t as Record<string, unknown>);
        if (row.effort_manday !== undefined) {
          row.effort_manday = normalizeEffortManday(row.effort_manday);
        }
        if (row.related_task_type !== undefined) {
          row.related_task_type = normalizeDependencyType(row.related_task_type);
        } else {
          row.related_task_type = 'FS';
        }
        if (row.related_task_lag_days !== undefined) {
          row.related_task_lag_days = normalizeDependencyLagDays(row.related_task_lag_days);
        } else {
          row.related_task_lag_days = 0;
        }
        if (!row.related_task) {
          row.related_task_type = 'FS';
          row.related_task_lag_days = 0;
        }

    delete row.id;
    delete row.created_at;

    const requestedOrder = Number(row.order);
    const projectId = String(row.project_id || '');
    const normalizeParent = (v: unknown): string => {
      if (v === null || v === undefined || v === '') return '';
      return String(v);
    };

    // Insert-before/after from UI sends .5 order markers. Convert them to integer slots.
    if (projectId && Number.isFinite(requestedOrder) && !Number.isInteger(requestedOrder)) {
      const insertSlot = Math.max(1, Math.ceil(requestedOrder));
      const targetParent = normalizeParent(row.parent_id);

      const { data: siblingRows, error: siblingErr } = await supabase
        .from('tasks')
        .select('id, "order", parent_id')
        .eq('project_id', projectId);
      if (siblingErr) throw new Error(siblingErr.message);

      const siblings = (siblingRows || [])
        .filter((s) => normalizeParent(s.parent_id) === targetParent)
        .filter((s) => Number(s.order) >= insertSlot)
        .sort((a, b) => Number(b.order) - Number(a.order));

      for (const s of siblings) {
        await supabase
          .from('tasks')
          .update({ order: Number(s.order) + 1 })
          .eq('id', s.id);
      }

      row.order = insertSlot;
    }

    if (Number.isFinite(requestedOrder) && Number.isInteger(requestedOrder)) {
      row.order = requestedOrder;
    }

    // permission: must have write access to project
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const okCreate = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!okCreate) throw new Error('FORBIDDEN');

    const { data, error } = await supabase
      .from('tasks')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const created = rowToObj<Task>(data);
    // Fetch all tasks and recalc full structure + parent dates/percent
    const all = await taskApi.getByProject(created.projectId);
    const structured = recalcStructure(all.data);
    const allTasks = recalcParents(structured);
    await persistTaskChanges(all.data, allTasks);
    return { data: created, allTasks };
  },

  update: async (id: string, t: Partial<Task>): Promise<{ data: Task; allTasks: Task[] }> => {
    const row = objToRow(t as Record<string, unknown>);
        if (row.effort_manday !== undefined) {
          row.effort_manday = normalizeEffortManday(row.effort_manday);
        }
        if (row.related_task_type !== undefined) {
          row.related_task_type = normalizeDependencyType(row.related_task_type);
        }
        if (row.related_task_lag_days !== undefined) {
          row.related_task_lag_days = normalizeDependencyLagDays(row.related_task_lag_days);
        }
        if (row.related_task !== undefined && !row.related_task) {
          if (row.related_task_type === undefined) row.related_task_type = 'FS';
          if (row.related_task_lag_days === undefined) row.related_task_lag_days = 0;
        }

    delete row.id;
    delete row.created_at;
    // permission: must have write access to project
    const { data: existing } = await supabase.from('tasks').select('project_id').eq('id', id).maybeSingle();
    const projectIdForUpdate = (existing as any)?.project_id || row.project_id;
    if (!projectIdForUpdate) throw new Error('MISSING_PROJECT_ID');
    const okUpdate = await checkProjectPermission(projectIdForUpdate, 'write', 'tasks');
    if (!okUpdate) throw new Error('FORBIDDEN');

    // A task may not become a child of itself or of one of its own descendants.
    const newParentId = row.parent_id ? String(row.parent_id) : '';
    if (newParentId) {
      if (newParentId === id) throw new Error('A task cannot be its own parent');
      const { data: links, error: linksErr } = await supabase
        .from('tasks')
        .select('id, parent_id')
        .eq('project_id', projectIdForUpdate);
      if (linksErr) throw new Error(linksErr.message);
      const parentOf = new Map((links || []).map((link: { id: string; parent_id: string | null }) => [String(link.id), String(link.parent_id || '')]));
      const seen = new Set<string>();
      let cursor = newParentId;
      while (cursor && !seen.has(cursor)) {
        if (cursor === id) throw new Error('Cannot move a task under one of its own sub tasks');
        seen.add(cursor);
        cursor = parentOf.get(cursor) || '';
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    let updatedData = data;
    if (error) {
      const statusValue = row.status as string | undefined;
      if (statusValue !== undefined) {
        const statusAlternatives: Record<string, string> = {
          'Block/Delay': 'Blocked/Delay',
          'Blocked/Delay': 'Block/Delay',
          'Review': 'Block/Delay',
        };
        const altStatus = statusAlternatives[statusValue];
        if (altStatus) {
          const retry = await supabase
            .from('tasks')
            .update({ ...row, status: altStatus })
            .eq('id', id)
            .select()
            .single();
          if (!retry.error) {
            updatedData = retry.data;
          }
        }
      }
      if (!updatedData) {
        const fallbackRow = { ...row } as Record<string, unknown>;
        delete fallbackRow.status;
        if (fallbackRow.percent_complete === undefined && statusValue !== undefined) {
          if (statusValue === 'Todo') fallbackRow.percent_complete = 0;
          else if (statusValue === 'Done') fallbackRow.percent_complete = 100;
          else fallbackRow.percent_complete = 1;
        }
        const retry = await supabase
          .from('tasks')
          .update(fallbackRow)
          .eq('id', id)
          .select()
          .single();
        if (retry.error) throw new Error(retry.error.message);
        updatedData = retry.data;
      }
    }
    const updated = rowToObj<Task>(updatedData);

    // If this is a main/root task and its phase was updated, propagate the phase to all descendant subtasks.
    if (row.phase !== undefined && (!updated.parentId || updated.parentId === '')) {
      const allTasksForProject = await taskApi.getByProject(updated.projectId);
      const childrenByParent = allTasksForProject.data.reduce<Record<string, Task[]>>((map, task) => {
        const pid = String(task.parentId || '');
        map[pid] = map[pid] || [];
        map[pid].push(task);
        return map;
      }, {});
      const descendantIds: string[] = [];
      const queue = [updated.id];
      while (queue.length) {
        const parentId = queue.shift()!;
        const children = childrenByParent[parentId] || [];
        for (const child of children) {
          descendantIds.push(child.id);
          queue.push(child.id);
        }
      }
      if (descendantIds.length) {
        const { error: phaseErr } = await supabase
          .from('tasks')
          .update({ phase: updated.phase })
          .in('id', descendantIds);
        if (phaseErr) throw new Error(phaseErr.message);
      }
    }

    const all = await taskApi.getByProject(updated.projectId);
    const structured = recalcStructure(all.data);
    const allTasks = recalcParents(structured);
    await persistTaskChanges(all.data, allTasks);
    return { data: updated, allTasks };
  },

  reorderSiblings: async (projectId: string, orderedIds: string[]): Promise<{ allTasks: Task[] }> => {
    const ok = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!ok) throw new Error('FORBIDDEN');
    // Assign clean, monotonically-increasing sort_order values so recalcStructure
    // will produce the exact WBS sequence that matches the desired visual order.
    // Use individual UPDATE queries (not upsert) to avoid accidentally clearing
    // other columns via partial upsert semantics.
    const writeResults = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('tasks').update({ sort_order: (i + 1) * 1000 }).eq('id', id)
      )
    );
    const writeError = writeResults.find((r) => r.error);
    if (writeError?.error) throw new Error(writeError.error.message);
    const all = await taskApi.getByProject(projectId);
    const structured = recalcStructure(all.data);
    const allTasks = recalcParents(structured);
    await persistTaskChanges(all.data, allTasks);
    return { allTasks };
  },

  /** Save many task date ranges, then recalculate parents once (instead of once per task). */
  bulkUpdateDates: async (projectId: string, assignments: Array<{ id: string; startDate: string; endDate: string }>): Promise<{ allTasks: Task[] }> => {
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'tasks')) throw new Error('FORBIDDEN');
    const CHUNK = 20;
    for (let i = 0; i < assignments.length; i += CHUNK) {
      const results = await Promise.all(assignments.slice(i, i + CHUNK).map((item) =>
        supabase
          .from('tasks')
          .update({
            start_date: item.startDate,
            end_date: item.endDate,
            duration: calcDurationFromDates({ startDate: item.startDate, endDate: item.endDate } as Task),
          })
          .eq('id', item.id)
          .eq('project_id', projectId)
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
    }
    return { allTasks: await recalcAndPersistProject(projectId) };
  },

  setComplete: async (id: string, pct: number): Promise<{ allTasks: Task[] }> => {
    const { data: existing, error: lookupError } = await supabase.from('tasks').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!canWrite) throw new Error('FORBIDDEN');
    const { data, error } = await supabase
      .from('tasks')
      .update({ percent_complete: pct })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const task = rowToObj<Task>(data);
    // Recalculate full structure + parent percentages and dates on client side
    const all = await taskApi.getByProject(task.projectId);
    const structured = recalcStructure(all.data);
    const allTasks = recalcParents(structured);
    await persistTaskChanges(all.data, allTasks);
    return { allTasks };
  },

  remove: async (id: string): Promise<{ allTasks: Task[] }> => {
    // Get task first to know project
    const { data: taskData } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', id)
      .single();
    const projectId = taskData?.project_id;
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const okRemove = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!okRemove) throw new Error('FORBIDDEN');
    // Delete task and children
    await deleteTaskAndChildren(id);
    if (projectId) {
      const all = await taskApi.getByProject(projectId);
      const structured = recalcStructure(all.data);
      const allTasks = recalcParents(structured);
      await persistTaskChanges(all.data, allTasks);
      return { allTasks };
    }
    return { allTasks: [] };
  },

  /**
   * Append a tree of new tasks (no dates) after the project's existing tasks, in one insert.
   * `nodes` are in display order; `parentKey` refers to an earlier node. Returns the new task id of each key.
   */
  appendTree: async (projectId: string, nodes: Array<{ key: string; parentKey: string | null; taskName: string }>): Promise<{ data: Task[]; ids: Record<string, string> }> => {
    const okWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!okWrite) throw new Error('FORBIDDEN');
    const existing = (await taskApi.getByProject(projectId)).data;
    const emptyRelationValue: string | null = existing.some((t) => t.parentId === '' || t.relatedTask === '') ? '' : null;
    let next = existing.reduce((m, t) => Math.max(m, Number(t.sortOrder) || 0, Number((t as any).order) || 0), 0);
    const ids: Record<string, string> = {};
    const levels: Record<string, number> = {};
    const rows = nodes.map((n) => {
      const id = newTaskId();
      ids[n.key] = id;
      levels[n.key] = n.parentKey ? (levels[n.parentKey] ?? 0) + 1 : 0;
      next += 1;
      return {
        id, project_id: projectId, wbs: '', task_name: n.taskName, effort_manday: 0,
        start_date: null, end_date: null, actual_finish: null, baseline_start_date: null, baseline_end_date: null,
        phase: '', duration: 0, percent_complete: 0, status: 'Todo', resource: '',
        related_task: emptyRelationValue, related_task_type: 'FS', related_task_lag_days: 0,
        parent_id: n.parentKey ? ids[n.parentKey] : emptyRelationValue, level: levels[n.key], sort_order: next, order: next,
      } as Record<string, unknown>;
    });
    if (rows.length) await insertTaskRowsInOneRequest(rows);
    return { data: await recalcAndPersistProject(projectId), ids };
  },

  copyFromProject: async (sourceProjectId: string, targetProjectId: string, scope: 'all' | 'main' = 'all'): Promise<{ data: Task[] }> => {
    const canWriteTarget = await checkProjectPermission(targetProjectId, 'write', 'tasks');
    if (!canWriteTarget) throw new Error('FORBIDDEN');
    const src = await taskApi.getByProject(sourceProjectId);
    const selectedSource = scope === 'main'
      ? src.data.filter((t) => !t.parentId)
      : src.data;

    const usesEmptyStringRelations = selectedSource.some(
      (t) => t.parentId === '' || t.relatedTask === ''
    );
    const emptyRelationValue: string | null = usesEmptyStringRelations ? '' : null;

    const rows = buildCopiedTaskRows(selectedSource, targetProjectId, emptyRelationValue);
    if (rows.length) await insertTaskRowsInOneRequest(rows);
    return { data: await recalcAndPersistProject(targetProjectId) };
  },

  replaceFromProject: async (sourceProjectId: string, targetProjectId: string): Promise<{ data: Task[] }> => {
    const canWriteTarget = await checkProjectPermission(targetProjectId, 'write', 'tasks');
    if (!canWriteTarget) throw new Error('FORBIDDEN');

    const src = await taskApi.getByProject(sourceProjectId);
    const emptyRelationValue: string | null = src.data.some((t) => t.parentId === '' || t.relatedTask === '') ? '' : null;
    const rows = buildCopiedTaskRows(src.data, targetProjectId, emptyRelationValue);
    if (!rows.length) throw new Error('SOURCE_PROJECT_HAS_NO_TASKS');
    await replaceProjectTasks(targetProjectId, rows);
    return { data: await recalcAndPersistProject(targetProjectId) };
  },

  replaceByImport: async (projectId: string, importedTasks: Array<Partial<Task> & { parentWbs?: string; predecessorWbs?: string; predecessorType?: string; predecessorLagDays?: number }>): Promise<{ data: Task[] }> => {
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const okWrite = await checkProjectPermission(projectId, 'write', 'tasks');
    if (!okWrite) throw new Error('FORBIDDEN');

    const clean = (value: unknown) => String(value ?? '').trim();
    const toDate = (value: unknown) => {
      const text = clean(value);
      if (!text) return '';
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    };
    const toPercent = (value: unknown) => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? Math.min(100, Math.max(0, Math.round(num))) : 0;
    };
    const toEffort = (value: unknown) => normalizeEffortManday(Number(value ?? 0));
    const allowedStatuses = new Set(['Todo', 'In Progress', 'Block/Delay', 'Done']);

    const rows = importedTasks.map((item, index) => ({
      sourceRow: index + 2,
      wbs: clean(item.wbs),
      taskName: clean(item.taskName),
      startDate: toDate(item.startDate),
      endDate: toDate(item.endDate),
      actualFinish: toDate(item.actualFinish),
      percentComplete: toPercent(item.percentComplete),
      status: clean(item.status) || 'Todo',
      phase: clean(item.phase),
      resource: clean(item.resource),
      relatedTask: '',
      parentWbs: clean(item.parentWbs),
      predecessorWbs: clean(item.predecessorWbs),
      predecessorType: normalizeDependencyType((item as any).predecessorType || item.relatedTaskType || 'FS'),
      predecessorLagDays: normalizeDependencyLagDays((item as any).predecessorLagDays ?? item.relatedTaskLagDays ?? 0),
      orderHint: clean((item as any).order),
      levelHint: clean((item as any).level),
      effortManday: toEffort(item.effortManday),
    }));

    if (!rows.length) throw new Error('IMPORT_FILE_EMPTY');

    const wbsSet = new Set<string>();
    const phaseOptions = (await masterCodeApi.getAll('task_phase')).data
      .filter((code: MasterCode) => code.active)
      .map((code: MasterCode) => String(code.codeValue || '').trim());
    const allowAnyPhase = phaseOptions.length === 0;

    for (const row of rows) {
      if (!row.wbs) throw new Error(`Row ${row.sourceRow}: WBS is required`);
      if (wbsSet.has(row.wbs)) throw new Error(`Row ${row.sourceRow}: duplicate WBS '${row.wbs}'`);
      wbsSet.add(row.wbs);
      if (!row.taskName) throw new Error(`Row ${row.sourceRow}: Task Name is required`);
      if (!row.startDate) throw new Error(`Row ${row.sourceRow}: Start Date must be YYYY-MM-DD`);
      if (!row.endDate) throw new Error(`Row ${row.sourceRow}: End Date must be YYYY-MM-DD`);
      if (row.actualFinish && !row.actualFinish) throw new Error(`Row ${row.sourceRow}: Actual Finish must be YYYY-MM-DD`);
      if (!allowedStatuses.has(row.status)) throw new Error(`Row ${row.sourceRow}: invalid Status '${row.status}'`);
      if (!allowAnyPhase && row.phase && !phaseOptions.includes(row.phase)) throw new Error(`Row ${row.sourceRow}: invalid Phase '${row.phase}'`);
    }

    for (const row of rows) {
      if (row.parentWbs && !wbsSet.has(row.parentWbs)) {
        throw new Error(`Row ${row.sourceRow}: Parent WBS '${row.parentWbs}' not found`);
      }
      if (row.predecessorWbs && !wbsSet.has(row.predecessorWbs)) {
        throw new Error(`Row ${row.sourceRow}: Predecessor WBS '${row.predecessorWbs}' not found`);
      }
      if (row.predecessorType && !TASK_DEPENDENCY_TYPES.has(row.predecessorType)) {
        throw new Error(`Row ${row.sourceRow}: Predecessor Type must be one of FS, SS, FF, SF`);
      }
    }

    const sorted = [...rows].sort((a, b) => compareWbs(a.wbs, b.wbs));
    const rowByWbs = new Map(sorted.map((row) => [row.wbs, row]));

    // Reject parent loops (e.g. 1.1 -> 1.2 -> 1.1): such rows would never be reachable from a root.
    const levelByWbs = new Map<string, number>();
    for (const row of sorted) {
      const seen = new Set<string>();
      let cursor: typeof row | undefined = row;
      let depth = 0;
      while (cursor?.parentWbs) {
        if (seen.has(cursor.wbs)) throw new Error(`Row ${row.sourceRow}: Parent WBS forms a loop`);
        seen.add(cursor.wbs);
        cursor = rowByWbs.get(cursor.parentWbs);
        depth += 1;
      }
      levelByWbs.set(row.wbs, depth);
    }

    const idByWbs = new Map(sorted.map((row) => [row.wbs, newTaskId()]));
    const payloads = sorted.map((row, index) => objToRow({
      id: idByWbs.get(row.wbs),
      projectId,
      wbs: row.wbs,
      taskName: row.taskName,
      effortManday: row.effortManday,
      startDate: row.startDate,
      endDate: row.endDate,
      actualFinish: row.actualFinish,
      phase: row.phase,
      duration: calcDurationFromDates({ startDate: row.startDate, endDate: row.endDate } as Task),
      percentComplete: row.percentComplete,
      status: row.status,
      resource: row.resource,
      relatedTask: row.predecessorWbs ? idByWbs.get(row.predecessorWbs) || '' : '',
      relatedTaskType: row.predecessorWbs ? row.predecessorType : 'FS',
      relatedTaskLagDays: row.predecessorWbs ? normalizeDependencyLagDays(row.predecessorLagDays || 0) : 0,
      parentId: row.parentWbs ? idByWbs.get(row.parentWbs) || '' : '',
      level: levelByWbs.get(row.wbs) || 0,
      order: index + 1,
      sortOrder: (index + 1) * 1000,
    } as Record<string, unknown>));

    await replaceProjectTasks(projectId, payloads);
    return { data: await recalcAndPersistProject(projectId) };
  },
};

// ── Bulk task helpers ──────────────────────────────────────────────────────
// Imports/copies/templates build every row (with pre-generated ids so parent and
// predecessor links can point at each other) and insert them in ONE request.
// PostgREST runs a single insert as one statement, so it either fully succeeds
// or leaves nothing behind. Replacements delete the old tasks only after the
// new set is safely stored, so a failure can never leave a half-empty project.

function newTaskId(): string {
  return window.crypto.randomUUID();
}

async function insertTaskRowsInOneRequest(rows: Record<string, unknown>[]): Promise<void> {
  // Callers build every row with the same keys, so no column falls back to NULL.
  const { error } = await supabase.from('tasks').insert(rows);
  if (error) throw new Error(error.message);
}

async function replaceProjectTasks(projectId: string, rows: Record<string, unknown>[]): Promise<void> {
  const { data: oldRows, error: listErr } = await supabase.from('tasks').select('id').eq('project_id', projectId);
  if (listErr) throw new Error(listErr.message);
  const oldIds = (oldRows || []).map((row: { id: string }) => row.id);

  await insertTaskRowsInOneRequest(rows);

  if (oldIds.length) {
    const { error: deleteErr } = await supabase.from('tasks').delete().eq('project_id', projectId).in('id', oldIds);
    if (deleteErr) {
      throw new Error(`New tasks were saved, but the previous tasks could not be removed (${deleteErr.message}). Please retry or remove the old tasks manually.`);
    }
  }
}

async function recalcAndPersistProject(projectId: string): Promise<Task[]> {
  const all = await taskApi.getByProject(projectId);
  const allTasks = recalcParents(recalcStructure(all.data));
  await persistTaskChanges(all.data, allTasks);
  return allTasks;
}

/** Copy tasks into another project with fresh ids, remapping parent/predecessor links. */
function buildCopiedTaskRows(sourceTasks: Task[], targetProjectId: string, emptyRelationValue: string | null): Record<string, unknown>[] {
  const idMap = new Map(sourceTasks.map((task) => [task.id, newTaskId()]));
  return sourceTasks.map((srcTask) => {
    const mappedPredecessor = srcTask.relatedTask ? idMap.get(srcTask.relatedTask) : undefined;
    const row = objToRow({
      ...srcTask,
      id: idMap.get(srcTask.id),
      projectId: targetProjectId,
      startDate: null,
      endDate: null,
      actualFinish: null,
      baselineStartDate: null,
      baselineEndDate: null,
      percentComplete: 0,
      status: 'Todo',
      parentId: srcTask.parentId ? (idMap.get(srcTask.parentId) ?? emptyRelationValue) : emptyRelationValue,
      // A predecessor outside the copied set (e.g. "main tasks only") is dropped.
      relatedTask: mappedPredecessor ?? emptyRelationValue,
      relatedTaskType: mappedPredecessor ? normalizeDependencyType(srcTask.relatedTaskType || 'FS') : 'FS',
      relatedTaskLagDays: mappedPredecessor ? normalizeDependencyLagDays(srcTask.relatedTaskLagDays) : 0,
    } as Record<string, unknown>);
    delete row.created_at;
    delete row.updated_at;
    return row;
  });
}

// ── Task Templates (System-wide) ───────────────────────────────────────────

type UpsertTemplateItem = {
  wbs: string;
  parentWbs: string;
  level: number;
  sortOrder: number;
  taskName: string;
  duration: number;
  effortManday: number;
  resource?: string;
  isMilestone?: boolean;
  visibility?: 'external' | 'internal';
  methodologyPhaseId?: string | null;
  deliverableId?: string | null;
};
const templateExtras = (item: UpsertTemplateItem) => ({
  resource: String(item.resource || '').trim(),
  is_milestone: !!item.isMilestone,
  visibility: item.visibility === 'internal' ? 'internal' : 'external',
  methodology_phase_id: item.methodologyPhaseId || null,
  deliverable_id: item.deliverableId || null,
});
/** Template owner (HMC / Customer / Joint) → the task's resource in a project. */
function resourceForProject(owner: string, customerTag: string): string {
  const o = owner.trim().toLowerCase();
  const cust = customerTag || 'Customer';
  if (o === 'customer' || o === 'client') return cust;
  if (o === 'joint') return `HMC,${cust}`;
  return owner.trim();
}

async function ensureAdminRole(): Promise<string> {
  const { role, userId } = await getCurrentUserRoleAndId();
  if (role !== 'admin') throw new Error('FORBIDDEN');
  return userId;
}

export const taskTemplateApi = {
  getAll: async (): Promise<{ data: TaskTemplate[] }> => {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('template_no', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<TaskTemplate>(data || []) };
  },

  getItems: async (templateId: string): Promise<{ data: TaskTemplateItem[] }> => {
    const { data, error } = await supabase
      .from('task_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<TaskTemplateItem>(data || []) };
  },

  createFromProject: async (name: string, sourceProjectId: string): Promise<{ data: TaskTemplate }> => {
    const createdBy = await ensureAdminRole();
    const source = await taskApi.getByProject(sourceProjectId);
    const sourceTasks = [...source.data].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    if (!sourceTasks.length) throw new Error('SOURCE_PROJECT_HAS_NO_TASKS');

    const { data: tplRow, error: tplErr } = await supabase
      .from('task_templates')
      .insert({ name: String(name || '').trim(), created_by: createdBy })
      .select()
      .single();
    if (tplErr) throw new Error(tplErr.message);

    const parentById = new Map<string, Task>(sourceTasks.map((t) => [t.id, t]));
    const items = sourceTasks.map((t) => ({
      template_id: (tplRow as any).id,
      wbs: t.wbs || '',
      parent_wbs: t.parentId ? (parentById.get(t.parentId)?.wbs || '') : '',
      level: Number(t.level || 0),
      sort_order: Number(t.sortOrder || 0),
      task_name: t.taskName || '',
      duration: Number(t.duration || 0),
      effort_manday: normalizeEffortManday(t.effortManday),
      is_milestone: !!t.isMilestone,
      visibility: t.visibility === 'internal' ? 'internal' : 'external',
    }));

    const { error: itemErr } = await supabase.from('task_template_items').insert(items);
    if (itemErr) throw new Error(itemErr.message);

    return { data: rowToObj<TaskTemplate>(tplRow as Record<string, unknown>) };
  },

  updateTemplate: async (templateId: string, updates: Partial<Pick<TaskTemplate, 'name'>>): Promise<{ data: TaskTemplate }> => {
    await ensureAdminRole();
    const row = objToRow(updates as Record<string, unknown>);
    const { data, error } = await supabase
      .from('task_templates')
      .update(row)
      .eq('id', templateId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<TaskTemplate>(data as Record<string, unknown>) };
  },

  replaceItems: async (templateId: string, items: UpsertTemplateItem[]): Promise<{ data: TaskTemplateItem[] }> => {
    await ensureAdminRole();
    const normalized = items
      .filter((item) => String(item.taskName || '').trim())
      .map((item) => ({
        template_id: templateId,
        wbs: String(item.wbs || '').trim(),
        parent_wbs: String(item.parentWbs || '').trim(),
        level: Math.max(0, Number(item.level || 0)),
        sort_order: Number(item.sortOrder || 0),
        task_name: String(item.taskName || '').trim(),
        duration: Math.max(0, Number(item.duration || 0)),
        effort_manday: normalizeEffortManday(item.effortManday),
        ...templateExtras(item),
      }));

    const { error: deleteErr } = await supabase
      .from('task_template_items')
      .delete()
      .eq('template_id', templateId);
    if (deleteErr) throw new Error(deleteErr.message);

    if (!normalized.length) return { data: [] };

    const { data, error } = await supabase
      .from('task_template_items')
      .insert(normalized)
      .select()
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<TaskTemplateItem>(data || []) };
  },

  removeTemplate: async (templateId: string): Promise<void> => {
    await ensureAdminRole();
    const { error } = await supabase.from('task_templates').delete().eq('id', templateId);
    if (error) throw new Error(error.message);
  },

  applyToProject: async (templateId: string, targetProjectId: string): Promise<{ data: Task[] }> => {
    const canWriteTarget = await checkProjectPermission(targetProjectId, 'write', 'tasks');
    if (!canWriteTarget) throw new Error('FORBIDDEN');

    const { data: itemRows, error: itemErr } = await supabase
      .from('task_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });
    if (itemErr) throw new Error(itemErr.message);

    const items = rowsToObjs<TaskTemplateItem>(itemRows || []);
    if (!items.length) throw new Error('TEMPLATE_HAS_NO_ITEMS');
    const { data: projRow } = await supabase.from('projects').select('customer_abbreviation').eq('id', targetProjectId).maybeSingle();
    const customerTag = String((projRow as { customer_abbreviation?: string } | null)?.customer_abbreviation || '');

    const sorted = [...items].sort((a, b) => {
      const levelDiff = Number(a.level || 0) - Number(b.level || 0);
      if (levelDiff !== 0) return levelDiff;
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });
    const idByWbs = new Map<string, string>();
    sorted.forEach((item) => { if (item.wbs && !idByWbs.has(item.wbs)) idByWbs.set(item.wbs, newTaskId()); });
    const payloadIds = new Set<string>();

    const payloads = sorted.map((item) => {
      const ownId = item.wbs && idByWbs.get(item.wbs);
      // Duplicate/blank WBS rows still get their own id.
      const id = ownId && !payloadIds.has(ownId) ? ownId : newTaskId();
      payloadIds.add(id);
      const parentId = item.parentWbs ? idByWbs.get(item.parentWbs) || '' : '';
      return objToRow({
        id,
        projectId: targetProjectId,
        wbs: item.wbs,
        taskName: item.taskName,
        effortManday: normalizeEffortManday(item.effortManday),
        startDate: '',
        endDate: '',
        actualFinish: '',
        phase: '',
        duration: Math.max(0, Number(item.duration || 0)),
        percentComplete: 0,
        status: 'Todo',
        resource: resourceForProject(String(item.resource || ''), customerTag),
        relatedTask: '',
        relatedTaskType: 'FS',
        relatedTaskLagDays: 0,
        parentId: parentId === id ? '' : parentId,
        level: Number(item.level || 0),
        sortOrder: Number(item.sortOrder || 0),
        isMilestone: !!item.isMilestone,
        visibility: item.visibility === 'internal' ? 'internal' : 'external',
      } as Record<string, unknown>);
    });

    breakParentCycles(payloads);
    await replaceProjectTasks(targetProjectId, payloads);

    // Methodology: link each deliverable to the task that produces it, and each phase gate to its phase task.
    const idOfItem = (item: TaskTemplateItem) => String(payloads[sorted.indexOf(item)]?.id || '');
    const delLinks = sorted.filter((i) => i.deliverableId).map((i) => ({ project_id: targetProjectId, deliverable_id: i.deliverableId, task_id: idOfItem(i) }));
    const gateLinks = sorted.filter((i) => i.methodologyPhaseId).map((i) => ({ project_id: targetProjectId, phase_id: i.methodologyPhaseId, task_id: idOfItem(i) }));
    if (delLinks.length) {
      const { error } = await supabase.from('project_deliverables').upsert(delLinks, { onConflict: 'project_id,deliverable_id' });
      if (error) console.warn('Template: could not link deliverables', error.message);
    }
    if (gateLinks.length) {
      const { error } = await supabase.from('project_phase_gates').upsert(gateLinks, { onConflict: 'project_id,phase_id' });
      if (error) console.warn('Template: could not link phase gates', error.message);
    }
    return { data: await recalcAndPersistProject(targetProjectId) };
  },
};

/** Detach any row whose parent chain loops back to itself (it would vanish from the tree). */
function breakParentCycles(rows: Record<string, unknown>[]): void {
  const parentOf = new Map(rows.map((row) => [String(row.id), String(row.parent_id || '')]));
  for (const row of rows) {
    const seen = new Set<string>();
    let cursor = String(row.id);
    while (cursor) {
      if (seen.has(cursor)) {
        row.parent_id = '';
        parentOf.set(String(row.id), '');
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) || '';
    }
  }
}

async function deleteTaskAndChildren(taskId: string): Promise<void> {
  // Find children
  const { data: children } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_id', taskId);
  if (children) {
    for (const child of children) {
      await deleteTaskAndChildren(child.id);
    }
  }
  await supabase.from('tasks').delete().eq('id', taskId);
}

async function persistTaskChanges(origTasks: Task[], newTasks: Task[]): Promise<void> {
  // Build a Map for O(1) lookup instead of O(n²) find in loop
  const origById = new Map(origTasks.map((o) => [o.id, o]));
  const writes: PromiseLike<void>[] = [];

  for (const t of newTasks) {
    const orig = origById.get(t.id);
    if (!orig) continue;
    const updates: Record<string, unknown> = {};
    if (orig.wbs !== t.wbs) updates.wbs = t.wbs;
    if (orig.level !== t.level) updates.level = t.level;
    if (orig.sortOrder !== t.sortOrder) updates.sort_order = t.sortOrder;
    if ((orig.parentId || '') !== (t.parentId || '')) updates.parent_id = t.parentId || null;
    if (orig.percentComplete !== t.percentComplete) updates.percent_complete = t.percentComplete;
    if (orig.startDate !== t.startDate) updates.start_date = t.startDate;
    if (orig.endDate !== t.endDate) updates.end_date = t.endDate;
    if (Number(orig.effortManday || 0) !== Number(t.effortManday || 0)) updates.effort_manday = normalizeEffortManday(t.effortManday);
    const calculatedDuration = calcDurationFromDates(t);
    if (t.startDate && t.endDate && orig.duration !== calculatedDuration) updates.duration = calculatedDuration;
    if ((orig.actualFinish || '') !== (t.actualFinish || '')) updates.actual_finish = t.actualFinish || '';
    if (Object.keys(updates).length > 0) {
      writes.push(
        supabase.from('tasks').update(updates).eq('id', t.id).then(({ error }) => {
          if (error) console.error('persistTaskChanges error for task', t.id, error.message);
        })
      );
    }
  }
  // Fire all writes in parallel instead of sequential round-trips
  await Promise.all(writes);
}

function recalcStructure(tasks: Task[]): Task[] {
  const result = tasks.map((t) => ({ ...t }));
  const byParent = new Map<string, Task[]>();

  const pushChild = (parentId: string, task: Task) => {
    const list = byParent.get(parentId) || [];
    list.push(task);
    byParent.set(parentId, list);
  };

  for (const t of result) {
    const pid = t.parentId || '';
    pushChild(pid, t);
  }

  const sortSiblings = (items: Task[]) =>
    [...items].sort((a, b) => {
      const ao = Number(a.sortOrder || 0);
      const bo = Number(b.sortOrder || 0);
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });

  const walk = (parentId: string, level: number, prefix: string) => {
    const siblings = sortSiblings(byParent.get(parentId) || []);
    siblings.forEach((task, idx) => {
      const wbs = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      task.wbs = wbs;
      task.level = level;
      // sortOrder is NOT renumbered here — preserving existing values prevents
      // marking every task as changed and triggering unnecessary DB writes.
      // sortOrder is updated only when explicitly set by move/reorder operations.
      walk(task.id, level + 1, wbs);
    });
  };

  walk('', 0, '');
  return result;
}

function recalcParents(tasks: Task[]): Task[] {
  const result = tasks.map((t) => ({ ...t }));
  // Build Maps for O(1) lookups instead of O(n) find/filter in loops
  const taskById = new Map(result.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, Task[]>();
  for (const t of result) {
    const pid = t.parentId || '';
    const list = childrenByParent.get(pid) || [];
    list.push(t);
    childrenByParent.set(pid, list);
  }

  // Process bottom-up: find all parent IDs, then recalc each
  const parentIds = [...new Set(result.filter((t) => t.parentId).map((t) => t.parentId))];

  // Multiple passes to handle nested parents (bottom-up)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    for (const pid of parentIds) {
      const parent = taskById.get(pid as string);
      if (!parent) continue;
      const children = childrenByParent.get(pid as string) || [];
      if (children.length === 0) {
        if (!parent.parentId && Number(parent.effortManday || 0) !== 0) {
          parent.effortManday = 0;
          changed = true;
        }
        continue;
      }

      // Recalc percent complete (weighted by duration)
      const totalDuration = children.reduce((s, c) => s + (c.duration || 1), 0);
      const weighted = children.reduce((s, c) => s + c.percentComplete * (c.duration || 1), 0);
      const allChildrenComplete = children.every((c) => c.percentComplete === 100);
      const newPct = allChildrenComplete ? 100 : (totalDuration > 0 ? Math.round(weighted / totalDuration) : 0);
      if (parent.percentComplete !== newPct) {
        parent.percentComplete = newPct;
        changed = true;
      }

      // Recalc parent effort manday as sum of direct children.
      const summedEffort = normalizeEffortManday(children.reduce((s, c) => s + Number(c.effortManday || 0), 0));
      if (Number(parent.effortManday || 0) !== summedEffort) {
        parent.effortManday = summedEffort;
        changed = true;
      }

      // Recalc start date = min of children start dates
      const childStarts = children.map((c) => c.startDate).filter(Boolean).sort();
      if (childStarts.length > 0 && parent.startDate !== childStarts[0]) {
        parent.startDate = childStarts[0];
        changed = true;
      }

      // Recalc end date = max of children end dates
      const childEnds = children.map((c) => c.endDate).filter(Boolean).sort();
      if (childEnds.length > 0 && parent.endDate !== childEnds[childEnds.length - 1]) {
        parent.endDate = childEnds[childEnds.length - 1];
        changed = true;
      }

      // If all direct children are complete, set actual finish from latest child end date
      if (allChildrenComplete && childEnds.length > 0) {
        const latestChildEnd = childEnds[childEnds.length - 1];
        if (parent.actualFinish !== latestChildEnd) {
          parent.actualFinish = latestChildEnd;
          changed = true;
        }
      }

      // Recalc duration from new dates
      if (parent.startDate && parent.endDate) {
        const s = new Date(parent.startDate).getTime();
        const e = new Date(parent.endDate).getTime();
        const dur = Math.max(0, Math.round((e - s) / 86400000));
        if (parent.duration !== dur) {
          parent.duration = dur;
        }
      }
    }
  }
  return result;
}

function normalizeEffortManday(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const step = 0.025;
  const rounded = Math.round(n / step) * step;
  return Number(rounded.toFixed(3));
}

function normalizeDependencyType(value: unknown): 'FS' | 'SS' | 'FF' | 'SF' {
  const text = String(value || 'FS').trim().toUpperCase();
  return TASK_DEPENDENCY_TYPES.has(text) ? (text as 'FS' | 'SS' | 'FF' | 'SF') : 'FS';
}

function normalizeDependencyLagDays(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function calcDurationFromDates(task: Task): number {
  if (!task.startDate || !task.endDate) return task.duration || 0;
  const start = parseISO(task.startDate);
  const end = parseISO(task.endDate);
  if (!isValid(start) || !isValid(end) || end < start) return 0;

  let count = 0;
  const current = new Date(start.getTime());
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ── Members ─────────────────────────────────────────────────────────────────

export const memberApi = {
  getByProject: async (pid?: string): Promise<{ data: Member[] }> => {
    if (pid) {
      const ok = await checkProjectPermission(pid, 'read', 'members');
      if (!ok) throw new Error('FORBIDDEN');
    }
    let q = supabase.from('members').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Member>(data || []) };
  },

  create: async (m: Partial<Member>): Promise<{ data: Member }> => {
    const projectId = String((m as any).projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(projectId, 'write', 'members');
    if (!ok) throw new Error('FORBIDDEN');

    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('members')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Member>(data) };
  },

  update: async (id: string, m: Partial<Member>): Promise<{ data: Member }> => {
    // ensure write permission for the member's project
    const { data: orig } = await supabase.from('members').select('project_id').eq('id', id).maybeSingle();
    const pid = (orig as any)?.project_id || (m as any).projectId;
    if (!pid) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(pid, 'write', 'members');
    if (!ok) throw new Error('FORBIDDEN');

    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('members')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Member>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: orig } = await supabase.from('members').select('project_id').eq('id', id).maybeSingle();
    const pid = (orig as any)?.project_id;
    if (!pid) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(pid, 'write', 'members');
    if (!ok) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  copyFromProject: async (sourceProjectId: string, targetProjectId: string): Promise<{ data: Member[] }> => {
    const ok = await checkProjectPermission(targetProjectId, 'write', 'members');
    if (!ok) throw new Error('FORBIDDEN');

    const src = await memberApi.getByProject(sourceProjectId);
    if (!src.data.length) return { data: [] };

    const rows = src.data.map((m) => {
      const row = objToRow({ ...m, projectId: targetProjectId } as Record<string, unknown>);
      delete row.id;
      delete row.created_at;
      return row;
    });

    const { data, error } = await supabase.from('members').insert(rows).select();
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Member>(data || []) };
  },
};

// ── Milestones ──────────────────────────────────────────────────────────────

export const milestoneApi = {
  getByProject: async (pid?: string): Promise<{ data: Milestone[] }> => {
    let q = supabase.from('milestones').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('due_date', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Milestone>(data || []) };
  },

  create: async (m: Partial<Milestone>): Promise<{ data: Milestone }> => {
    const projectId = String(m.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'ms')) throw new Error('FORBIDDEN');
    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('milestones')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Milestone>(data) };
  },

  update: async (id: string, m: Partial<Milestone>): Promise<{ data: Milestone }> => {
    const { data: existing, error: lookupError } = await supabase.from('milestones').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || m.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'ms')) throw new Error('FORBIDDEN');
    const row = objToRow(m as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('milestones')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Milestone>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('milestones').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'ms')) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  copyFromProject: async (sourceProjectId: string, targetProjectId: string): Promise<{ data: Milestone[] }> => {
    const ok = await checkProjectPermission(targetProjectId, 'write', 'ms');
    if (!ok) throw new Error('FORBIDDEN');

    const src = await milestoneApi.getByProject(sourceProjectId);
    if (!src.data.length) return { data: [] };

    const rows = src.data.map((m) => {
      const row = objToRow({ ...m, projectId: targetProjectId } as Record<string, unknown>);
      delete row.id;
      delete row.created_at;
      return row;
    });

    const { data, error } = await supabase.from('milestones').insert(rows).select();
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Milestone>(data || []) };
  },
};

// ── Efforts ─────────────────────────────────────────────────────────────────

export const effortApi = {
  getByProject: async (pid?: string): Promise<{ data: Effort[] }> => {
    let q = supabase.from('efforts').select('*, effort_monthly(*)');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // Transform effort_monthly rows into a monthly Record
    return {
      data: (data || []).map((row) => {
        const effort = rowToObj<Effort>(row);
        const monthly: Record<string, number> = {};
        const monthlyRows = (row as Record<string, unknown>).effort_monthly as
          | Array<{ month: string; manday: number }>
          | undefined;
        if (monthlyRows) {
          for (const em of monthlyRows) {
            monthly[em.month] = Number(em.manday) || 0;
          }
        }
        effort.monthly = monthly;
        return effort;
      }),
    };
  },

  create: async (e: Partial<Effort>): Promise<{ data: Effort }> => {
    const projectId = String(e.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'effort')) throw new Error('FORBIDDEN');
    const base: Record<string, unknown> = {
      project_id: e.projectId,
      module: e.module ?? '',
      budget_amount: e.budgetAmount ?? 0,
      budget_manday: e.budgetManday ?? 0,
    };
    // Try with phase; fall back without it if DB column is absent
    let { data, error } = await supabase.from('efforts').insert({ ...base, phase: e.phase ?? '' }).select().single();
    if (error) {
      const retry = await supabase.from('efforts').insert(base).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const effort = rowToObj<Effort>(data);
    effort.monthly = {};
    return { data: effort };
  },

  update: async (id: string, e: Partial<Effort>): Promise<{ data: Effort }> => {
    const { data: existing, error: lookupError } = await supabase.from('efforts').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || e.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'effort')) throw new Error('FORBIDDEN');
    // Only the fields given are changed; a partial update (e.g. just the budget man-days) must not
    // blank the line's name, amount or phase.
    const base: Record<string, unknown> = {};
    if (e.module !== undefined) base.module = e.module ?? '';
    if (e.budgetAmount !== undefined) base.budget_amount = e.budgetAmount ?? 0;
    if (e.budgetManday !== undefined) base.budget_manday = e.budgetManday ?? 0;
    const withPhase = e.phase !== undefined ? { ...base, phase: e.phase ?? '' } : base;
    // Try with phase; fall back without it if DB column is absent
    let { data, error } = await supabase.from('efforts').update(withPhase).eq('id', id).select().single();
    if (error && withPhase !== base) {
      const retry = await supabase.from('efforts').update(base).eq('id', id).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const effort = rowToObj<Effort>(data);
    effort.monthly = {};
    return { data: effort };
  },

  updateMonthly: async (id: string, month: string, manday: number): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('efforts').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'effort')) throw new Error('FORBIDDEN');
    // Upsert monthly record
    const { error } = await supabase
      .from('effort_monthly')
      .upsert(
        { effort_id: id, month, manday },
        { onConflict: 'effort_id,month' }
      );
    if (error) throw new Error(error.message);
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('efforts').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'effort')) throw new Error('FORBIDDEN');
    // effort_monthly cascades via FK
    const { error } = await supabase.from('efforts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  copyFromProject: async (sourceProjectId: string, targetProjectId: string): Promise<{ data: Effort[] }> => {
    const ok = await checkProjectPermission(targetProjectId, 'write', 'effort');
    if (!ok) throw new Error('FORBIDDEN');

    const src = await effortApi.getByProject(sourceProjectId);
    if (!src.data.length) return { data: [] };

    const copied: Effort[] = [];
    for (const e of src.data) {
      const created = await effortApi.create({
        projectId: targetProjectId,
        module: e.module,
        phase: e.phase,
        budgetAmount: e.budgetAmount,
        budgetManday: e.budgetManday,
      });
      const monthlyEntries = Object.entries(e.monthly || {});
      if (monthlyEntries.length) {
        await Promise.all(monthlyEntries.map(([month, manday]) => effortApi.updateMonthly(created.data.id, month, Number(manday || 0))));
      }
      copied.push({ ...created.data, monthly: { ...(e.monthly || {}) } });
    }

    return { data: copied };
  },
};

// ── Change Requests ─────────────────────────────────────────────────────────

export const crApi = {
  getByProject: async (
    pid?: string
  ): Promise<{ data: (ChangeRequest & { items: CRItem[] })[] }> => {
    let q = supabase.from('change_requests').select('*, cr_items(*)');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      data: (data || []).map((row) => {
        const cr = rowToObj<ChangeRequest>(row);
        const itemRows = (row as Record<string, unknown>).cr_items as
          | Array<Record<string, unknown>>
          | undefined;
        const items = itemRows ? rowsToObjs<CRItem>(itemRows) : [];
        return { ...cr, items };
      }),
    };
  },

  create: async (
    c: Partial<ChangeRequest> & { items?: Partial<CRItem>[] }
  ): Promise<{ data: ChangeRequest & { items: CRItem[] } }> => {
    const { items, ...rest } = c;
    const projectId = String(rest.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'cr')) throw new Error('FORBIDDEN');
    const row = objToRow(rest as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('change_requests')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const cr = rowToObj<ChangeRequest>(data);

    // Insert items
    let crItems: CRItem[] = [];
    if (items && items.length > 0) {
      const itemRows = items.map((item) => ({
        cr_id: cr.id,
        detail: item.detail || '',
        manday: item.manday || 0,
      }));
      const { data: itemData, error: itemErr } = await supabase
        .from('cr_items')
        .insert(itemRows)
        .select();
      if (itemErr) throw new Error(itemErr.message);
      crItems = rowsToObjs<CRItem>(itemData || []);
    }

    return { data: { ...cr, items: crItems } };
  },

  update: async (
    id: string,
    c: Partial<ChangeRequest> & { items?: Partial<CRItem>[] }
  ): Promise<{ data: ChangeRequest & { items: CRItem[] } }> => {
    const { items, ...rest } = c;
    const { data: existing, error: lookupError } = await supabase.from('change_requests').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || rest.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'cr')) throw new Error('FORBIDDEN');
    const row = objToRow(rest as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('change_requests')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const cr = rowToObj<ChangeRequest>(data);

    // Replace items
    let crItems: CRItem[] = [];
    if (items) {
      await supabase.from('cr_items').delete().eq('cr_id', id);
      if (items.length > 0) {
        const itemRows = items.map((item) => ({
          cr_id: id,
          detail: item.detail || '',
          manday: item.manday || 0,
        }));
        const { data: itemData, error: itemErr } = await supabase
          .from('cr_items')
          .insert(itemRows)
          .select();
        if (itemErr) throw new Error(itemErr.message);
        crItems = rowsToObjs<CRItem>(itemData || []);
      }
    }

    return { data: { ...cr, items: crItems } };
  },

  remove: async (id: string): Promise<void> => {
    // cr_items cascades via FK
    const { data: existing, error: lookupError } = await supabase.from('change_requests').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'cr')) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('change_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Issues ──────────────────────────────────────────────────────────────────

export const issueApi = {
  getByProject: async (pid?: string): Promise<{ data: Issue[] }> => {
    let q = supabase.from('issues').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Issue>(data || []) };
  },

  create: async (i: Partial<Issue>): Promise<{ data: Issue }> => {
    const projectId = String(i.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'issues')) throw new Error('FORBIDDEN');
    const row = objToRow(i as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('issues')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Issue>(data) };
  },

  update: async (id: string, i: Partial<Issue>): Promise<{ data: Issue }> => {
    const { data: existing, error: lookupError } = await supabase.from('issues').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || i.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'issues')) throw new Error('FORBIDDEN');
    const row = objToRow(i as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('issues')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Issue>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('issues').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'issues')) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('issues').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Activities ──────────────────────────────────────────────────────────────

export const activityApi = {
  getByProject: async (pid?: string): Promise<{ data: Activity[] }> => {
    if (pid) {
      const ok = await checkProjectPermission(pid, 'read', 'activities');
      if (!ok) throw new Error('FORBIDDEN');
    }
    let q = supabase.from('activities').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('activity_date', { ascending: false }).order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Activity>(data || []) };
  },

  create: async (a: Partial<Activity>): Promise<{ data: Activity }> => {
    const projectId = String((a as any).projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(projectId, 'write', 'activities');
    if (!ok) throw new Error('FORBIDDEN');

    const row = objToRow(a as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('activities')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Activity>(data) };
  },

  update: async (id: string, a: Partial<Activity>): Promise<{ data: Activity }> => {
    const { data: orig } = await supabase.from('activities').select('project_id').eq('id', id).maybeSingle();
    const projectId = (orig as any)?.project_id || (a as any).projectId;
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(projectId, 'write', 'activities');
    if (!ok) throw new Error('FORBIDDEN');

    const row = objToRow(a as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('activities')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Activity>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: orig } = await supabase.from('activities').select('project_id').eq('id', id).maybeSingle();
    const projectId = (orig as any)?.project_id;
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const ok = await checkProjectPermission(projectId, 'write', 'activities');
    if (!ok) throw new Error('FORBIDDEN');

    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Lessons Learned ────────────────────────────────────────────────────────

export const projectLessonsApi = {
  getByProject: async (projectId: string): Promise<{ data: ProjectLessonLearned[] }> => {
    const canRead = await checkProjectPermission(projectId, 'read', 'lessons');
    if (!canRead) throw new Error('FORBIDDEN');
    const { data, error } = await supabase
      .from('project_lessons_learned')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<ProjectLessonLearned>(data || []) };
  },

  create: async (lesson: Partial<ProjectLessonLearned>): Promise<{ data: ProjectLessonLearned }> => {
    const projectId = String(lesson.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'lessons');
    if (!canWrite) throw new Error('FORBIDDEN');
    const { userId } = await getCurrentUserRoleAndId();
    const row = objToRow({ ...lesson, createdBy: userId || null } as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    row.due_date = row.due_date || null;
    const { data, error } = await supabase.from('project_lessons_learned').insert(row).select().single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<ProjectLessonLearned>(data) };
  },

  update: async (id: string, lesson: Partial<ProjectLessonLearned>): Promise<{ data: ProjectLessonLearned }> => {
    const { data: existing, error: lookupError } = await supabase
      .from('project_lessons_learned')
      .select('project_id')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || lesson.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'lessons');
    if (!canWrite) throw new Error('FORBIDDEN');
    const row = objToRow(lesson as Record<string, unknown>);
    delete row.id;
    delete row.project_id;
    delete row.created_by;
    delete row.created_at;
    delete row.updated_at;
    if (row.due_date === '') row.due_date = null;
    const { data, error } = await supabase
      .from('project_lessons_learned')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<ProjectLessonLearned>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase
      .from('project_lessons_learned')
      .select('project_id')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    const canWrite = await checkProjectPermission(projectId, 'write', 'lessons');
    if (!canWrite) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('project_lessons_learned').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Risks ───────────────────────────────────────────────────────────────────

export const riskApi = {
  getByProject: async (pid?: string): Promise<{ data: Risk[] }> => {
    let q = supabase.from('risks').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Risk>(data || []) };
  },

  create: async (r: Partial<Risk>): Promise<{ data: Risk }> => {
    const projectId = String(r.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'risks')) throw new Error('FORBIDDEN');
    const row = objToRow(r as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('risks')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Risk>(data) };
  },

  update: async (id: string, r: Partial<Risk>): Promise<{ data: Risk }> => {
    const { data: existing, error: lookupError } = await supabase.from('risks').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || r.projectId || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'risks')) throw new Error('FORBIDDEN');
    const row = objToRow(r as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('risks')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data: rowToObj<Risk>(data) };
  },

  remove: async (id: string): Promise<void> => {
    const { data: existing, error: lookupError } = await supabase.from('risks').select('project_id').eq('id', id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const projectId = String(existing?.project_id || '');
    if (!projectId) throw new Error('MISSING_PROJECT_ID');
    if (!await checkProjectPermission(projectId, 'write', 'risks')) throw new Error('FORBIDDEN');
    const { error } = await supabase.from('risks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  copyFromProject: async (sourceProjectId: string, targetProjectId: string): Promise<{ data: Risk[] }> => {
    const ok = await checkProjectPermission(targetProjectId, 'write', 'risks');
    if (!ok) throw new Error('FORBIDDEN');

    const src = await riskApi.getByProject(sourceProjectId);
    if (!src.data.length) return { data: [] };

    const rows = src.data.map((r) => {
      const row = objToRow({ ...r, projectId: targetProjectId } as Record<string, unknown>);
      delete row.id;
      delete row.created_at;
      return row;
    });

    const { data, error } = await supabase.from('risks').insert(rows).select();
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Risk>(data || []) };
  },
};

// ── Monthly executive reports ───────────────────────────────────────────────
type MonthlyReportPatch = Partial<Pick<MonthlyReport,
  'summary' | 'decisions' | 'externalSummary' | 'clientActions' | 'overallStatus' | 'scheduleStatus' | 'budgetStatus' | 'scopeStatus' | 'paymentStatus'>>;

export const monthlyReportApi = {
  /** One project's report for a month, or null when none was written yet. */
  get: async (projectId: string, period: string): Promise<MonthlyReport | null> => {
    const { data, error } = await supabase.from('monthly_reports').select('*')
      .eq('project_id', projectId).eq('period', period).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowsToObjs<MonthlyReport>([data])[0] : null;
  },

  /** State of every readable project's report for a month (for the project list). */
  listForPeriod: async (period: string): Promise<Pick<MonthlyReport, 'projectId' | 'state' | 'overallStatus'>[]> => {
    const { data, error } = await supabase.from('monthly_reports').select('project_id,state,overall_status').eq('period', period);
    if (error) throw new Error(error.message);
    return rowsToObjs<Pick<MonthlyReport, 'projectId' | 'state' | 'overallStatus'>>(data || []);
  },

  /** Published months of a project, newest first. */
  publishedPeriods: async (projectId: string): Promise<string[]> => {
    const { data, error } = await supabase.from('monthly_reports').select('period')
      .eq('project_id', projectId).eq('state', 'published').order('period', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => String(row.period));
  },

  /** Create or update the draft text and statuses. */
  saveDraft: async (projectId: string, period: string, patch: MonthlyReportPatch): Promise<MonthlyReport> => {
    const row = { project_id: projectId, period, ...objToRow(patch as Record<string, unknown>) };
    const { data, error } = await supabase.from('monthly_reports')
      .upsert(row, { onConflict: 'project_id,period' }).select('*').single();
    if (error) throw new Error(error.message);
    return rowsToObjs<MonthlyReport>([data])[0];
  },

  /** Freeze the month: store the computed report with the text and statuses. */
  publish: async (projectId: string, period: string, patch: MonthlyReportPatch, snapshot: unknown, userId: string | null): Promise<MonthlyReport> => {
    const row = {
      project_id: projectId, period, ...objToRow(patch as Record<string, unknown>),
      state: 'published', snapshot, published_at: new Date().toISOString(), published_by: userId,
    };
    const { data, error } = await supabase.from('monthly_reports')
      .upsert(row, { onConflict: 'project_id,period' }).select('*').single();
    if (error) throw new Error(error.message);
    return rowsToObjs<MonthlyReport>([data])[0];
  },

  /** Back to draft: numbers become live again; the text is kept. */
  unpublish: async (projectId: string, period: string): Promise<MonthlyReport> => {
    const { data, error } = await supabase.from('monthly_reports')
      .update({ state: 'draft', snapshot: null, published_at: null, published_by: null })
      .eq('project_id', projectId).eq('period', period).select('*').single();
    if (error) throw new Error(error.message);
    return rowsToObjs<MonthlyReport>([data])[0];
  },
};
