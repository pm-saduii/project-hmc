import { supabase } from './supabase';
import type { BudgetSnapshot } from '../utils/budgetControl';

export type BudgetStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'returned';

export interface BudgetReport {
  id: string; projectId: string; period: string; status: BudgetStatus; comment: string; returnReason: string;
  snapshot: BudgetSnapshot | null;
  preparedName: string; preparedAt: string | null; reviewedName: string; reviewedAt: string | null;
  approvedName: string; approvedAt: string | null; returnedName: string; returnedAt: string | null;
}

export const BUDGET_STATUS: Record<BudgetStatus | 'none', { label: string; bg: string; fg: string }> = {
  none: { label: 'Not started', bg: '#F1F5F9', fg: '#475569' },
  draft: { label: 'Draft', bg: '#F1F5F9', fg: '#475569' },
  submitted: { label: 'Submitted', bg: '#DBEAFE', fg: '#1D4ED8' },
  reviewed: { label: 'Reviewed', bg: '#E0E7FF', fg: '#4338CA' },
  approved: { label: 'Approved', bg: '#D1FAE5', fg: '#047857' },
  returned: { label: 'Returned', bg: '#FEE2E2', fg: '#B91C1C' },
};

const fromRow = (r: Record<string, unknown>): BudgetReport => ({
  id: String(r.id), projectId: String(r.project_id), period: String(r.period), status: r.status as BudgetStatus,
  comment: String(r.comment || ''), returnReason: String(r.return_reason || ''), snapshot: (r.snapshot as BudgetSnapshot) || null,
  preparedName: String(r.prepared_name || ''), preparedAt: (r.prepared_at as string) || null,
  reviewedName: String(r.reviewed_name || ''), reviewedAt: (r.reviewed_at as string) || null,
  approvedName: String(r.approved_name || ''), approvedAt: (r.approved_at as string) || null,
  returnedName: String(r.returned_name || ''), returnedAt: (r.returned_at as string) || null,
});

export const budgetReportApi = {
  listForPeriod: async (period: string): Promise<BudgetReport[]> => {
    const { data, error } = await supabase.from('budget_reports').select('*').eq('period', period);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => fromRow(r as Record<string, unknown>));
  },
  /** Move the report to a new status; the database checks who may do which step. */
  transition: async (projectId: string, period: string, status: BudgetStatus, extra: { snapshot?: BudgetSnapshot; comment?: string; returnReason?: string } = {}) => {
    const row: Record<string, unknown> = { project_id: projectId, period, status };
    if (extra.snapshot) row.snapshot = extra.snapshot;
    if (extra.comment !== undefined) row.comment = extra.comment;
    if (extra.returnReason !== undefined) row.return_reason = extra.returnReason;
    if (status === 'draft') row.snapshot = null;
    // Update when the month's row exists, else insert. (An upsert would run the insert check first,
    // which judges the step from "draft" instead of the row's real status.)
    const updated = await supabase.from('budget_reports').update(row).eq('project_id', projectId).eq('period', period).select('*');
    if (updated.error) throw new Error(updated.error.message);
    if (updated.data && updated.data.length) return fromRow(updated.data[0] as Record<string, unknown>);
    const inserted = await supabase.from('budget_reports').insert(row).select('*').single();
    if (inserted.error) throw new Error(inserted.error.message);
    return fromRow(inserted.data as Record<string, unknown>);
  },
};
