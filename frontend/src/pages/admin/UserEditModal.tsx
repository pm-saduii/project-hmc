import React from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, isValid, parseISO } from 'date-fns';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Btn, C, Modal } from '../../components/Common';
import { F, FormModal, Pill, StatusDot, fieldLabel, hint, input } from '../../components/Admin/AdminUi';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../store';
import { USER_SCREEN_OPTIONS, type ScreenAccessLevel, type UserScreenPermissions } from '../../constants/rolePermissions';
import {
  ROLE_INFO, ROLE_ORDER, adminUsersApi, effectiveScreens, projectIdsFor, roleDefaultScreens, visibleScreenCount,
  type AdminUser, type SignInInfo, type UserPatch,
} from '../../services/adminUsers';
import { projectPath } from '../../utils/projectRoutes';
import type { UserRole } from '../../types';

const SCREEN_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'PORTFOLIO', ids: ['portfolio-overview', 'onepage'] },
  { title: 'PLAN', ids: ['tasks', 'ms', 'effort'] },
  { title: 'TRACKING', ids: ['issues', 'risks', 'cr', 'activities'] },
  { title: 'DELIVERY & INFO', ids: ['summary', 'checklists', 'lessons', 'members', 'env'] },
];
const SCREEN_NOTES: Record<string, string> = { 'portfolio-overview': 'Projects list and dashboard', ms: 'Contract amounts', env: 'URLs and passwords' };
const LEVELS: { value: ScreenAccessLevel; label: string }[] = [{ value: 'hidden', label: 'Hidden' }, { value: 'read', label: 'Read' }, { value: 'full', label: 'Full' }];
const when = (v?: string | null) => { if (!v) return ''; const d = parseISO(v); return isValid(d) ? format(d, 'dd/MM/yyyy') : ''; };

interface Draft { fullName: string; email: string; role: UserRole; scope: 'member' | 'all'; screens: UserScreenPermissions }
const draftOf = (u: AdminUser): Draft => ({ fullName: u.fullName, email: u.email, role: u.role, scope: u.role === 'admin' ? 'all' : u.projectAccessScope, screens: effectiveScreens(u) });

/**
 * Edit one user (opened from the Users list, /admin/users/:userId): profile, role, project access,
 * screen access, password and account status. Closes only from × or Close.
 */
export default function UserEditModal({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const { user: me } = useAuth();
  const projects = useStore((s) => s.projects);
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [signIn, setSignIn] = React.useState<SignInInfo | null>(null);
  const [projectIds, setProjectIds] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | 'deactivate' | 'activate' | 'delete'>(null);
  const isSelf = me?.id === userId;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, signIns, memberships] = await Promise.all([adminUsersApi.list(), adminUsersApi.signIns(), adminUsersApi.memberships()]);
      const found = list.find((u) => u.id === userId) || null;
      setUser(found);
      setDraft(found ? draftOf(found) : null);
      setSignIn(signIns[userId] || null);
      setProjectIds(found ? [...projectIdsFor(found, memberships)] : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the user');
    } finally { setLoading(false); }
  }, [userId]);
  React.useEffect(() => { void load(); }, [load]);

  if (!user || !draft) {
    return (
      <FormModal title={loading ? 'Loading…' : 'User not found'} onClose={onClose} width={440}
        footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={onClose}>Close</Btn></>}>
        <div style={{ fontSize: 13, color: C.text2 }}>{loading ? 'Loading the user…' : 'This user does not exist or was deleted.'}</div>
      </FormModal>
    );
  }

  const original = draftOf(user);
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const pickRole = (role: UserRole) => setDraft((d) => (d ? { ...d, role, scope: role === 'admin' ? 'all' : d.scope, screens: roleDefaultScreens(role) } : d));
  const isAdminDraft = draft.role === 'admin';
  const memberProjects = projectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
  const visible = visibleScreenCount(draft.screens);
  const matchesDefault = JSON.stringify(draft.screens) === JSON.stringify(roleDefaultScreens(draft.role));

  const save = async () => {
    setSaving(true);
    try {
      const profile: UserPatch = {};
      if (draft.fullName.trim() !== user.fullName) {
        if (!draft.fullName.trim()) throw new Error('Enter a name');
        profile.fullName = draft.fullName.trim();
      }
      if (draft.email.trim().toLowerCase() !== user.email.toLowerCase()) profile.email = draft.email.trim().toLowerCase();
      if (draft.role !== user.role) profile.role = draft.role;
      const access: UserPatch = {};
      if (!isAdminDraft) {
        if (draft.scope !== original.scope || draft.role !== user.role) access.project_access_scope = draft.scope;
        if (JSON.stringify(draft.screens) !== JSON.stringify(original.screens) || draft.role !== user.role) access.screen_permissions = draft.screens;
      }
      // Access fields of an admin are fixed, so a demoted admin's access is sent after the role change.
      if (user.role === 'admin' || profile.role) {
        if (Object.keys(profile).length) await adminUsersApi.update(user.id, profile);
        if (Object.keys(access).length) await adminUsersApi.update(user.id, access);
      } else {
        const patch = { ...profile, ...access };
        if (Object.keys(patch).length) await adminUsersApi.update(user.id, patch);
      }
      toast.success('Changes saved');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the changes');
    } finally { setSaving(false); }
  };

  const runConfirm = async () => {
    const action = confirm;
    if (!action) return;
    setSaving(true);
    try {
      if (action === 'delete') {
        await adminUsersApi.remove(user.id);
        toast.success('User deleted');
        onChanged();
        onClose();
        return;
      }
      await adminUsersApi.update(user.id, { is_active: action === 'activate' });
      toast.success(action === 'activate' ? 'User activated' : 'User deactivated');
      setConfirm(null);
      onChanged();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the user');
    } finally { setSaving(false); }
  };

  const block = (title: string, children: React.ReactNode, extra?: React.ReactNode) => (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
  const info = ROLE_INFO[user.role];
  const subtitle = `${user.email} · Added ${when(user.createdAt) || '—'}${signIn ? ` · ${signIn.lastSignInAt ? `Last sign-in ${when(signIn.lastSignInAt)}` : signIn.invitedAt && !signIn.confirmedAt ? 'Invited, not joined yet' : 'Never signed in'}` : ''}`;

  return (
    <>
      <FormModal title={`Edit user · ${user.fullName || user.email}`} subtitle={subtitle} onClose={onClose} busy={saving} width={1040}
        footer={<>
          <Pill bg={info.bg} fg={info.fg}>{info.label}</Pill>
          <StatusDot active={user.isActive} />
          {dirty && <span style={{ fontSize: 13, color: '#B45309', fontWeight: 600 }}>Unsaved changes</span>}
          <span style={{ marginLeft: 'auto' }} />
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Close</Btn>
          <Btn onClick={() => void save()} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</Btn>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {block('Profile', <>
              <label style={fieldLabel}>Full name<input value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} style={input} /></label>
              <label style={fieldLabel}>Email<input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} style={input} />
                <span style={hint}>Changing the email changes how they sign in.</span>
              </label>
            </>, <Btn small variant="outline" onClick={() => setPasswordOpen(true)}><KeyRound size={13} style={{ marginRight: 6 }} />Set password</Btn>)}

            {block('Role', <>
              <div role="radiogroup" aria-label="Role" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {ROLE_ORDER.map((r) => {
                  const on = draft.role === r;
                  return (
                    <button key={r} type="button" role="radio" aria-checked={on} disabled={isSelf} onClick={() => pickRole(r)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: isSelf ? 'default' : 'pointer', fontFamily: F, color: C.text,
                        border: on ? `2px solid ${C.primary}` : `1px solid ${C.border}`, background: on ? C.primaryBg : C.white, opacity: isSelf && !on ? 0.5 : 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{ROLE_INFO[r].label}</span>
                      <span style={{ fontSize: 11, color: C.text2, lineHeight: 1.5 }}>{ROLE_INFO[r].description}</span>
                    </button>
                  );
                })}
              </div>
              {isSelf ? <span style={hint}>You cannot change your own role.</span>
                : draft.role !== user.role && <span style={hint}>Changing the role resets screen access to the {ROLE_INFO[draft.role].label} defaults.</span>}
            </>)}

            {block('Project access', isAdminDraft ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#4338CA', background: C.primaryBg, padding: 12, borderRadius: 10 }}><ShieldCheck size={16} />Admins see every project.</div>
            ) : <>
              {([['member', 'Only their projects', 'Projects where they are in the member list'], ['all', 'All projects', 'Every project, now and later']] as const).map(([value, title, desc]) => (
                <label key={value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="scope" checked={draft.scope === value} onChange={() => set('scope', value)} style={{ marginTop: 3, accentColor: C.primary }} />
                  <span><strong>{title}</strong><br /><span style={{ fontSize: 11, color: C.text2 }}>{desc}</span></span>
                </label>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6 }}>MEMBER OF {memberProjects.length} PROJECT{memberProjects.length === 1 ? '' : 'S'}</div>
                {memberProjects.length === 0 && <div style={{ fontSize: 13, color: C.text3 }}>Not in any project member list.</div>}
                {memberProjects.map((p) => p && (
                  <Link key={p.id} to={projectPath(p.id, 'members')} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '5px 0', textDecoration: 'none', color: C.text }}>
                    <span>{p.code}{p.customerAbbreviation ? ` (${p.customerAbbreviation})` : ''}</span>
                    <span style={{ fontSize: 11, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{p.name}</span>
                  </Link>
                ))}
                <div style={hint}>Add or remove them in each project's Members page.</div>
              </div>
            </>)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {block('Screen access', isAdminDraft ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#4338CA', background: C.primaryBg, padding: 12, borderRadius: 10 }}><ShieldCheck size={16} />Admins can use every screen.</div>
            ) : <>
              <div style={{ fontSize: 11, color: C.text2, marginTop: -6 }}>{matchesDefault ? `${ROLE_INFO[draft.role].label} defaults` : 'Custom for this user'} · {visible} of {USER_SCREEN_OPTIONS.length} screens visible</div>
              {SCREEN_GROUPS.map((group) => (
                <div key={group.title}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: C.text2, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>{group.title}</div>
                  {group.ids.map((id) => {
                    const screen = USER_SCREEN_OPTIONS.find((s) => s.id === id);
                    if (!screen) return null;
                    const value = draft.screens[id] || 'hidden';
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.bg2}` }}>
                        <span style={{ fontSize: 13, color: C.text }}>{screen.label}{SCREEN_NOTES[id] && <span style={{ fontSize: 11, color: C.text3 }}> · {SCREEN_NOTES[id]}</span>}</span>
                        <span role="radiogroup" aria-label={`${screen.label} access`} style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          {LEVELS.map((level) => {
                            const on = value === level.value;
                            return (
                              <button key={level.value} type="button" role="radio" aria-checked={on}
                                onClick={() => set('screens', { ...draft.screens, [id]: level.value })}
                                style={{ height: 28, padding: '0 10px', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 11, fontWeight: 600,
                                  background: on ? (level.value === 'hidden' ? C.bg2 : C.primary) : C.white, color: on ? (level.value === 'hidden' ? C.text : '#fff') : C.text2 }}>
                                {level.label}
                              </button>
                            );
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>, !isAdminDraft && !matchesDefault ? (
              <Btn small variant="outline" onClick={() => set('screens', roleDefaultScreens(draft.role))}>Reset to {ROLE_INFO[draft.role].label} defaults</Btn>
            ) : undefined)}

            {user.role !== 'admin' && !isSelf && (
              <section style={{ border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#B91C1C' }}>{user.isActive ? 'Deactivate account' : 'Inactive account'}</h3>
                  <div style={{ fontSize: 13, color: C.text2 }}>
                    {user.isActive ? 'They can no longer sign in. Their history stays. An inactive account can then be deleted.' : 'This account cannot sign in. Activate it again, or delete it for good.'}
                  </div>
                </div>
                {user.isActive
                  ? <Btn variant="outline" onClick={() => setConfirm('deactivate')} style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}>Deactivate</Btn>
                  : <>
                    <Btn variant="outline" onClick={() => setConfirm('activate')}>Activate</Btn>
                    <Btn variant="danger" onClick={() => setConfirm('delete')}>Delete user</Btn>
                  </>}
              </section>
            )}
          </div>
        </div>
      </FormModal>

      {passwordOpen && <PasswordModal user={user} onClose={() => setPasswordOpen(false)} />}
      {confirm && (
        <Modal title={confirm === 'delete' ? 'Delete user' : confirm === 'activate' ? 'Activate user' : 'Deactivate user'} onClose={() => !saving && setConfirm(null)} width={440} closeOnBackdrop={false}>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
            {confirm === 'delete' ? `${user.email} and their sign-in account will be deleted permanently.`
              : confirm === 'activate' ? `${user.email} will be able to sign in again.`
                : `${user.email} will no longer be able to sign in.`}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setConfirm(null)} disabled={saving}>Cancel</Btn>
            <Btn variant={confirm === 'activate' ? 'primary' : 'danger'} onClick={() => void runConfirm()} disabled={saving}>
              {saving ? 'Working…' : confirm === 'delete' ? 'Delete user' : confirm === 'activate' ? 'Activate' : 'Deactivate'}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

function PasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (password.length < 6) { toast.error('The password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await adminUsersApi.update(user.id, { password });
      toast.success('Password set');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not set the password');
    } finally { setBusy(false); }
  };
  return (
    <FormModal title="Set password" subtitle={user.email} onClose={onClose} busy={busy} width={460}
      footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn><Btn onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Set password'}</Btn></>}>
      <label style={fieldLabel}>New password
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} autoFocus />
        <span style={hint}>At least 6 characters. Tell the user over a private channel; they can change it after signing in.</span>
      </label>
    </FormModal>
  );
}
