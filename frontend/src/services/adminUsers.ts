/**
 * Admin user management. Reads profiles directly (admins can read all rows under RLS);
 * every change goes through /api/users/manage, which checks the caller is an active admin
 * and uses the service role for auth changes (email, password, invite, delete).
 */
import { supabase } from './supabase';
import { getPermissionsByRole, USER_SCREEN_OPTIONS, type ScreenAccessLevel, type UserScreenPermissions } from '../constants/rolePermissions';
import type { Profile, UserRole } from '../types';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  projectAccessScope: 'member' | 'all';
  screenPermissions: UserScreenPermissions | string[] | null;
  createdAt: string;
}

export interface SignInInfo { lastSignInAt: string | null; invitedAt: string | null; confirmedAt: string | null }

export interface UserPatch {
  fullName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  project_access_scope?: 'member' | 'all';
  screen_permissions?: UserScreenPermissions;
}

export const ROLE_INFO: Record<UserRole, { label: string; description: string; bg: string; fg: string }> = {
  admin: { label: 'Admin', description: 'Everything, including users and system settings', bg: '#EEF2FF', fg: '#4338CA' },
  director: { label: 'Director', description: 'Sees every project; approves the monthly Budget Control', bg: '#F3E8FF', fg: '#6B21A8' },
  am: { label: 'Account Manager', description: 'Follows customer accounts; reviews the monthly Budget Control', bg: '#FFEDD5', fg: '#9A3412' },
  pm: { label: 'PM', description: 'Runs projects and writes the monthly report', bg: '#E0F2FE', fg: '#0369A1' },
  member: { label: 'Member', description: 'Works on the projects they belong to', bg: '#F1F5F9', fg: '#334155' },
  client: { label: 'Client', description: 'Customer user; read-only by default', bg: '#FEF3C7', fg: '#92400E' },
};
export const ROLE_ORDER: UserRole[] = ['admin', 'director', 'am', 'pm', 'member', 'client'];

/** Screen access a role gets when no custom permissions are set. */
export function roleDefaultScreens(role: UserRole): UserScreenPermissions {
  const defaults = getPermissionsByRole(role);
  const visible = new Set<string>([...defaults.visibleProjectTabs, ...(defaults.canViewPortfolioOverview ? ['portfolio-overview'] : [])]);
  const readOnly = role === 'client' || role === 'director' || role === 'am';
  return Object.fromEntries(USER_SCREEN_OPTIONS.map((s) => [s.id, visible.has(s.id) ? (readOnly ? 'read' : 'full') : 'hidden'])) as UserScreenPermissions;
}

/** The user's effective screen access (custom, else role default). */
export function effectiveScreens(user: Pick<AdminUser, 'role' | 'screenPermissions'>): UserScreenPermissions {
  const defaults = roleDefaultScreens(user.role);
  if (Array.isArray(user.screenPermissions)) {
    const on = new Set(user.screenPermissions);
    return Object.fromEntries(USER_SCREEN_OPTIONS.map((s) => [s.id, on.has(s.id) ? 'full' : 'hidden'])) as UserScreenPermissions;
  }
  return { ...defaults, ...(user.screenPermissions || {}) };
}

export const visibleScreenCount = (screens: UserScreenPermissions) =>
  USER_SCREEN_OPTIONS.filter((s) => (screens[s.id] || 'hidden') !== 'hidden').length;

export const isCustomScreens = (user: Pick<AdminUser, 'screenPermissions'>) =>
  !!user.screenPermissions && (Array.isArray(user.screenPermissions) ? true : Object.keys(user.screenPermissions).length > 0);

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Sign in again.');
  return accessToken;
}

const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: 'Only administrators can do this.',
  EMAIL_NOT_ALLOWED: 'This email is not in any project member list. Add the person to a project first.',
  ROLE_TYPE_MISMATCH: 'This role does not match the member type (customer contacts can only be clients).',
  ADMIN_ACCESS_IS_FIXED: 'Admins always have full access.',
  CANNOT_DEACTIVATE_SELF: 'You cannot deactivate your own account.',
  CANNOT_CHANGE_SELF_ROLE: 'You cannot change your own role.',
  CANNOT_DELETE_SELF: 'You cannot delete your own account.',
  ONLY_INACTIVE_USERS_CAN_BE_DELETED: 'Deactivate the user before deleting.',
  PASSWORD_TOO_SHORT: 'The password must be at least 6 characters.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_SCREEN_PERMISSIONS: 'Some screen permissions are not valid.',
};

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/users/manage', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let result: Record<string, unknown> = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { error: `User service unavailable (HTTP ${response.status})` }; }
  if (!response.ok) {
    const code = String(result.error || `HTTP ${response.status}`);
    throw new Error(ERROR_TEXT[code] || code);
  }
  return result;
}

export const adminUsersApi = {
  list: async (): Promise<AdminUser[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,is_active,screen_permissions,project_access_scope,created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      email: String(row.email || ''),
      fullName: String(row.full_name || ''),
      role: (ROLE_ORDER.includes(row.role as UserRole) ? row.role : 'member') as UserRole,
      isActive: row.is_active !== false,
      projectAccessScope: row.project_access_scope === 'all' ? 'all' : 'member',
      screenPermissions: Array.isArray(row.screen_permissions)
        ? row.screen_permissions.map(String)
        : row.screen_permissions && typeof row.screen_permissions === 'object' ? row.screen_permissions as UserScreenPermissions : null,
      createdAt: String(row.created_at || ''),
    }));
  },

  /** Last sign-in per user id; empty when the server API is not reachable (e.g. local dev). */
  signIns: async (): Promise<Record<string, SignInInfo>> => {
    try {
      const result = await call('GET');
      const users = (result.users as ({ id: string } & SignInInfo)[]) || [];
      return Object.fromEntries(users.map((u) => [u.id, { lastSignInAt: u.lastSignInAt, invitedAt: u.invitedAt, confirmedAt: u.confirmedAt }]));
    } catch {
      return {};
    }
  },

  /** Projects each user can see through the member lists: user id or email → project ids. */
  memberships: async (): Promise<{ byUserId: Map<string, Set<string>>; byEmail: Map<string, Set<string>> }> => {
    const byUserId = new Map<string, Set<string>>();
    const byEmail = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, key: string, projectId: string) => {
      if (!key || !projectId) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(projectId);
    };
    const [members, links] = await Promise.all([
      supabase.from('members').select('project_id,email,user_id,role'),
      supabase.from('project_members').select('project_id,user_id'),
    ]);
    (members.data || []).forEach((m: Record<string, unknown>) => {
      add(byUserId, String(m.user_id || ''), String(m.project_id || ''));
      add(byEmail, String(m.email || '').trim().toLowerCase(), String(m.project_id || ''));
    });
    (links.data || []).forEach((m: Record<string, unknown>) => add(byUserId, String(m.user_id || ''), String(m.project_id || '')));
    return { byUserId, byEmail };
  },

  update: (userId: string, patch: UserPatch) => call('PATCH', { userId, ...patch }),
  invite: (email: string, fullName: string, role: UserRole) => call('POST', { email, fullName, role }),
  /** Deletes an inactive, non-admin user and their sign-in account (database function checks the rules). */
  remove: async (userId: string) => {
    const { error } = await supabase.rpc('admin_delete_inactive_user', { p_user_id: userId });
    if (error) throw new Error(ERROR_TEXT[error.message] || error.message);
  },
};

export const projectIdsFor = (
  user: Pick<AdminUser, 'id' | 'email'>,
  memberships: { byUserId: Map<string, Set<string>>; byEmail: Map<string, Set<string>> },
): Set<string> => new Set([
  ...(memberships.byUserId.get(user.id) || []),
  ...(memberships.byEmail.get(user.email.trim().toLowerCase()) || []),
]);

export type { ScreenAccessLevel, UserScreenPermissions, Profile };
