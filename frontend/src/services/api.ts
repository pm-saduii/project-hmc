// ===== SUPABASE API SERVICE =====
// All data operations go through Supabase PostgreSQL directly.
// No custom backend needed.

import { supabase } from './supabase';
import type { Project, Task, Member, Milestone, Effort, ChangeRequest, CRItem, Issue, Risk } from '../types';

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
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Project>(data || []) };
  },

  create: async (p: Partial<Project>): Promise<{ data: Project }> => {
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
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Tasks ───────────────────────────────────────────────────────────────────

export const taskApi = {
  getByProject: async (pid?: string): Promise<{ data: Task[] }> => {
    let q = supabase.from('tasks').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('order', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Task>(data || []) };
  },

  create: async (t: Partial<Task>): Promise<{ data: Task; allTasks: Task[] }> => {
    const row = objToRow(t as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('tasks')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const created = rowToObj<Task>(data);
    // Fetch all tasks for this project to support parent recalc on client
    const all = await taskApi.getByProject(created.projectId);
    return { data: created, allTasks: all.data };
  },

  update: async (id: string, t: Partial<Task>): Promise<{ data: Task; allTasks: Task[] }> => {
    const row = objToRow(t as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = rowToObj<Task>(data);
    const all = await taskApi.getByProject(updated.projectId);
    return { data: updated, allTasks: all.data };
  },

  setComplete: async (id: string, pct: number): Promise<{ allTasks: Task[] }> => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ percent_complete: pct })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const task = rowToObj<Task>(data);
    // Recalculate parent percentages on client side
    const all = await taskApi.getByProject(task.projectId);
    const allTasks = recalcParents(all.data);
    // Persist updated parent percentages
    for (const t of allTasks) {
      const orig = all.data.find((o) => o.id === t.id);
      if (orig && orig.percentComplete !== t.percentComplete) {
        await supabase
          .from('tasks')
          .update({ percent_complete: t.percentComplete })
          .eq('id', t.id);
      }
    }
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
    // Delete task and children
    await deleteTaskAndChildren(id);
    if (projectId) {
      const all = await taskApi.getByProject(projectId);
      return { allTasks: all.data };
    }
    return { allTasks: [] };
  },
};

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

function recalcParents(tasks: Task[]): Task[] {
  const result = tasks.map((t) => ({ ...t }));
  const parentIds = [...new Set(result.filter((t) => t.parentId).map((t) => t.parentId))];

  for (const pid of parentIds) {
    const parent = result.find((t) => t.id === pid);
    if (!parent) continue;
    const children = result.filter((t) => t.parentId === pid);
    if (children.length === 0) continue;
    const totalDuration = children.reduce((s, c) => s + (c.duration || 1), 0);
    const weighted = children.reduce((s, c) => s + c.percentComplete * (c.duration || 1), 0);
    parent.percentComplete = totalDuration > 0 ? Math.round(weighted / totalDuration) : 0;
  }
  return result;
}

// ── Members ─────────────────────────────────────────────────────────────────

export const memberApi = {
  getByProject: async (pid?: string): Promise<{ data: Member[] }> => {
    let q = supabase.from('members').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Member>(data || []) };
  },

  create: async (m: Partial<Member>): Promise<{ data: Member }> => {
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
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ── Milestones ──────────────────────────────────────────────────────────────

export const milestoneApi = {
  getByProject: async (pid?: string): Promise<{ data: Milestone[] }> => {
    let q = supabase.from('milestones').select('*');
    if (pid) q = q.eq('project_id', pid);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: rowsToObjs<Milestone>(data || []) };
  },

  create: async (m: Partial<Milestone>): Promise<{ data: Milestone }> => {
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
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (error) throw new Error(error.message);
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
    const row = objToRow(e as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('efforts')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const effort = rowToObj<Effort>(data);
    effort.monthly = {};
    return { data: effort };
  },

  update: async (id: string, e: Partial<Effort>): Promise<{ data: Effort }> => {
    const row = objToRow(e as Record<string, unknown>);
    delete row.id;
    delete row.created_at;
    const { data, error } = await supabase
      .from('efforts')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const effort = rowToObj<Effort>(data);
    effort.monthly = {};
    return { data: effort };
  },

  updateMonthly: async (id: string, month: string, manday: number): Promise<void> => {
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
    // effort_monthly cascades via FK
    const { error } = await supabase.from('efforts').delete().eq('id', id);
    if (error) throw new Error(error.message);
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
    const { error } = await supabase.from('issues').delete().eq('id', id);
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
    const { error } = await supabase.from('risks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
