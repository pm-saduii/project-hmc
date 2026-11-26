import { supabase } from './supabase';

/** One External Status Report (semi-monthly) – the PM's text; the numbers are computed live from the project. */
export interface StatusReport {
  id: string;
  projectId: string;
  /** 'YYYY-MM-1' (1–15) or 'YYYY-MM-2' (16–end of month). */
  period: string;
  reportDate: string | null;
  /** '' = automatic */
  overallStatus: '' | 'Completed' | 'On Track' | 'At Risk' | 'Delayed' | 'Not Started';
  rationale: string;
  accomplishments: string;
  nextSteps: string;
  sentAt: string | null;
  sentBy: string | null;
  sentTo: string;
  updatedAt: string;
}
export type StatusReportPatch = Partial<Pick<StatusReport, 'reportDate' | 'overallStatus' | 'rationale' | 'accomplishments' | 'nextSteps' | 'sentAt' | 'sentBy' | 'sentTo'>>;

const camel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as unknown as StatusReport;
const snake = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));

export const statusReportApi = {
  get: async (projectId: string, period: string): Promise<StatusReport | null> => {
    const { data, error } = await supabase.from('status_reports').select('*').eq('project_id', projectId).eq('period', period).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? camel(data as Record<string, unknown>) : null;
  },
  /** Every project's report for a half-month (list badges). */
  listForPeriod: async (period: string): Promise<StatusReport[]> => {
    const { data, error } = await supabase.from('status_reports').select('*').eq('period', period);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => camel(r as Record<string, unknown>));
  },
  /** Sent reports of a project, newest first (the Report Log). */
  sentLog: async (projectId: string): Promise<StatusReport[]> => {
    const { data, error } = await supabase.from('status_reports').select('*').eq('project_id', projectId).not('sent_at', 'is', null).order('period', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r) => camel(r as Record<string, unknown>));
  },
  save: async (projectId: string, period: string, patch: StatusReportPatch): Promise<StatusReport> => {
    const { data, error } = await supabase.from('status_reports')
      .upsert({ project_id: projectId, period, ...snake(patch as Record<string, unknown>) }, { onConflict: 'project_id,period' }).select('*').single();
    if (error) throw new Error(error.message);
    return camel(data as Record<string, unknown>);
  },
};
