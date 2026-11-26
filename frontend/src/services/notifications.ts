import { supabase } from './supabase';

export interface NotifyRule { id: string; name: string; description: string; recipients: string; enabled: boolean; email: boolean; teams: boolean; days: number | null; sortOrder: number }
export interface QueueItem { project: string; text: string; when: string; link: string }
export interface QueueMessage {
  key: string; ruleId: string; ruleName: string; channel: 'email' | 'teams'; recipient: string; cc: string[];
  projectIds: string[]; subject: string; items: QueueItem[]; noRecipient: boolean;
}
export interface LogRow { id: string; ruleId: string; projectId: string | null; channel: string; recipient: string; subject: string; itemCount: number; status: string; error: string; trigger: string; sentOn: string; createdAt: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: `Notification service unavailable (HTTP ${response.status})` }; }
  if (!response.ok) throw new Error(String(json.error || `HTTP ${response.status}`));
  return json as T;
}

const camel = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]));

export const notificationsApi = {
  preview: () => call<{ date: string; period: string; messages: QueueMessage[] }>({ action: 'preview' }),
  send: (keys?: string[]) => call<{ results: { key: string; status: string; error: string }[] }>({ action: 'send', ...(keys ? { keys } : {}) }),
  testTeams: (projectId: string) => call<{ ok: boolean }>({ action: 'test-teams', projectId }),

  rules: async (): Promise<NotifyRule[]> => {
    const { data, error } = await supabase.from('notification_rules').select('*').order('sort_order');
    if (error) throw new Error(error.message);
    return (data || []).map((r) => camel(r as Record<string, unknown>) as unknown as NotifyRule);
  },
  saveRule: async (id: string, patch: Partial<Pick<NotifyRule, 'enabled' | 'email' | 'teams' | 'days'>>) => {
    const { error } = await supabase.from('notification_rules').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  log: async (): Promise<LogRow[]> => {
    const { data, error } = await supabase.from('notification_log').select('*').order('created_at', { ascending: false }).limit(150);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => camel(r as Record<string, unknown>) as unknown as LogRow);
  },
  hooks: async (): Promise<Record<string, string>> => {
    const { data } = await supabase.from('project_integrations').select('project_id,teams_webhook_url');
    return Object.fromEntries((data || []).map((r: { project_id: string; teams_webhook_url: string }) => [r.project_id, r.teams_webhook_url]));
  },
  saveHook: async (projectId: string, url: string) => {
    const { error } = await supabase.from('project_integrations').upsert({ project_id: projectId, teams_webhook_url: url, updated_at: new Date().toISOString() }, { onConflict: 'project_id' });
    if (error) throw new Error(error.message);
  },
  globalHook: async (): Promise<string> => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'teams_webhook_url').maybeSingle();
    return String(data?.value || '');
  },
  saveGlobalHook: async (url: string) => {
    const { error } = await supabase.from('app_settings').upsert({ key: 'teams_webhook_url', value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  },
};
