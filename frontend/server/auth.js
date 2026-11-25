// Shared server-side helpers for Vercel API functions.
// Kept outside /api so it is not deployed as its own endpoint.
import { createClient } from '@supabase/supabase-js';

export function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Escape LIKE wildcards so an email can be matched case-insensitively but literally. */
export function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/**
 * Resolve the signed-in caller from the request's Bearer token.
 * Returns null when the token is missing/invalid or the account is inactive.
 */
export async function getCaller(supabase, req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id,email,role,is_active,project_access_scope')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile?.is_active === false) return null;
  return {
    id: data.user.id,
    email: String(profile?.email || data.user.email || '').trim().toLowerCase(),
    role: profile?.role || 'member',
    projectAccessScope: profile?.project_access_scope === 'all' ? 'all' : 'member',
  };
}

/** Admin, "all projects" scope, or a member of the given project. */
export async function canAccessProject(supabase, caller, projectId) {
  if (!caller || !projectId) return false;
  if (caller.role === 'admin' || caller.projectAccessScope === 'all') return true;
  const { data: link } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', caller.id)
    .limit(1);
  if (Array.isArray(link) && link.length > 0) return true;
  if (!caller.email) return false;
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('project_id', projectId)
    .ilike('email', escapeLike(caller.email))
    .limit(1);
  return Array.isArray(member) && member.length > 0;
}
