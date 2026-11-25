import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, isValid, parseISO } from 'date-fns';
import { ChevronRight, RefreshCw, UserPlus } from 'lucide-react';
import { Btn, C } from '../../components/Common';
import { AdminHeader, F, Pill, SearchBox, SidePanel, StatusDot, fieldLabel, hint, input, panel, td, th } from '../../components/Admin/AdminUi';
import {
  ROLE_INFO, ROLE_ORDER, adminUsersApi, effectiveScreens, isCustomScreens, projectIdsFor, visibleScreenCount,
  type AdminUser, type SignInInfo,
} from '../../services/adminUsers';
import { USER_SCREEN_OPTIONS } from '../../constants/rolePermissions';
import type { UserRole } from '../../types';

const PAGE_SIZE = 25;
const AVATAR = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6'];
const avatarColor = (s: string) => AVATAR[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR.length];
const initials = (u: AdminUser) => (u.fullName || u.email).split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const when = (v?: string | null) => { if (!v) return ''; const d = parseISO(v); return isValid(d) ? format(d, 'd MMM yyyy') : ''; };

type Memberships = Awaited<ReturnType<typeof adminUsersApi.memberships>>;

/** /admin/users — everyone who can sign in. */
export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [signIns, setSignIns] = React.useState<Record<string, SignInInfo>>({});
  const [memberships, setMemberships] = React.useState<Memberships | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState<UserRole | 'all'>('all');
  const [status, setStatus] = React.useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage] = React.useState(0);
  const [inviting, setInviting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, signInMap, memberMap] = await Promise.all([adminUsersApi.list(), adminUsersApi.signIns(), adminUsersApi.memberships()]);
      setUsers(list); setSignIns(signInMap); setMemberships(memberMap);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load users');
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(0); }, [search, role, status]);

  const byStatus = users.filter((u) => status === 'all' || (status === 'active' ? u.isActive : !u.isActive));
  const counts = Object.fromEntries(ROLE_ORDER.map((r) => [r, byStatus.filter((u) => u.role === r).length])) as Record<UserRole, number>;
  const q = search.trim().toLowerCase();
  const rows = byStatus
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.fullName || a.email).localeCompare(b.fullName || b.email));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const signInKnown = Object.keys(signIns).length > 0;

  const chip = (key: UserRole | 'all', label: string, count: number) => {
    const active = role === key;
    return (
      <button key={key} type="button" aria-pressed={active} onClick={() => setRole(key)}
        style={{ height: 32, padding: '0 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F, fontSize: 13, cursor: 'pointer',
          border: `1px solid ${active ? '#C7D2FE' : C.border}`, background: active ? C.primaryBg : C.white, color: active ? '#4338CA' : C.text2, fontWeight: active ? 600 : 500 }}>
        {label}
        <span style={{ fontSize: 11, fontWeight: 700, padding: '0 6px', borderRadius: 999, background: active ? '#C7D2FE' : C.bg2 }}>{count}</span>
      </button>
    );
  };

  const projectsLabel = (u: AdminUser) => {
    if (u.role === 'admin' || u.projectAccessScope === 'all') return 'All projects';
    if (!memberships) return '…';
    const n = projectIdsFor(u, memberships).size;
    return n ? `${n} project${n > 1 ? 's' : ''}` : 'None';
  };
  const screensLabel = (u: AdminUser) => {
    if (u.role === 'admin') return 'Everything';
    if (!isCustomScreens(u)) return 'Role default';
    return `Custom · ${visibleScreenCount(effectiveScreens(u))} of ${USER_SCREEN_OPTIONS.length}`;
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
      <AdminHeader
        title="Users"
        description="People who can sign in, their role and which projects and screens they can use."
        actions={<>
          <Btn variant="ghost" onClick={() => void load()} disabled={loading} title="Refresh"><RefreshCw size={14} /></Btn>
          <Btn onClick={() => setInviting(true)}><UserPlus size={14} style={{ marginRight: 6 }} />Invite user</Btn>
        </>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {chip('all', 'All', byStatus.length)}
        {ROLE_ORDER.map((r) => chip(r, ROLE_INFO[r].label, counts[r]))}
      </div>

      <section style={{ ...panel, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search name or email" />
          <label style={{ fontSize: 13, color: C.text2, display: 'flex', alignItems: 'center', gap: 6 }}>Status
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              style={{ height: 34, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0 8px', fontFamily: F, fontSize: 13, background: C.white, color: C.text }}>
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
            </select>
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
            <thead>
              <tr>
                <th style={th}>User</th><th style={th}>Role</th><th style={th}>Projects</th><th style={th}>Screen access</th>
                <th style={th}>Status</th><th style={th}>{signInKnown ? 'Last sign-in' : 'Added'}</th>
                <th style={{ ...th, width: 48 }}><span style={{ position: 'absolute', left: -9999 }}>Open</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...td, color: C.text2 }}>Loading users…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, color: C.text2 }}>No users match.</td></tr>
              ) : pageRows.map((u) => {
                const info = ROLE_INFO[u.role];
                const sign = signIns[u.id];
                const lastText = signInKnown
                  ? (sign?.lastSignInAt ? when(sign.lastSignInAt) : sign?.invitedAt && !sign.confirmedAt ? 'Invited, not joined' : 'Never')
                  : when(u.createdAt);
                const to = `/admin/users/${encodeURIComponent(u.id)}`;
                return (
                  <tr key={u.id} onClick={() => navigate(to)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                    <td style={td}>
                      <Link to={to} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                        <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', background: u.isActive ? avatarColor(u.email) : C.text3, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(u)}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.fullName || '(no name)'}</span>
                          <span style={{ fontSize: 11, color: C.text2 }}>{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td style={td}><Pill bg={info.bg} fg={info.fg}>{info.label}</Pill></td>
                    <td style={td}>{projectsLabel(u)}</td>
                    <td style={{ ...td, color: C.text2 }}>{screensLabel(u)}</td>
                    <td style={td}><StatusDot active={u.isActive} /></td>
                    <td style={{ ...td, color: C.text2, whiteSpace: 'nowrap' }}>{lastText}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.text3 }}><ChevronRight size={16} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 11, color: C.text2 }}>
          <span>{rows.length ? `Showing ${page * PAGE_SIZE + 1}–${Math.min(rows.length, (page + 1) * PAGE_SIZE)} of ${rows.length}` : ''}</span>
          {pages > 1 && (
            <span style={{ display: 'flex', gap: 6 }}>
              <Btn small variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Btn>
              <Btn small variant="outline" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</Btn>
            </span>
          )}
        </div>
      </section>

      {inviting && <InvitePanel onClose={() => setInviting(false)} onDone={() => { setInviting(false); void load(); }} />}
    </div>
  );
}

function InvitePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<UserRole>('member');
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    const clean = email.normalize('NFC').replace(/\p{Cf}/gu, '').trim().toLowerCase();
    if (!name.trim() || !clean) { toast.error('Enter the name and email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { toast.error('Enter a valid email address'); return; }
    setBusy(true);
    try {
      await adminUsersApi.invite(clean, name.trim(), role);
      toast.success(`Invitation sent to ${clean}`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the invitation');
    } finally { setBusy(false); }
  };

  return (
    <SidePanel title="Invite user" subtitle="They get an email with a link to set their password." onClose={onClose} busy={busy}
      footer={<>
        <span style={{ marginLeft: 'auto' }} />
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn onClick={() => void send()} disabled={busy}>{busy ? 'Sending…' : 'Send invitation'}</Btn>
      </>}>
      <label style={fieldLabel}>Full name<input value={name} onChange={(e) => setName(e.target.value)} style={input} autoFocus /></label>
      <label style={fieldLabel}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        <span style={hint}>Except admins, the email must already be in a project's member list.</span>
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Role</legend>
        {ROLE_ORDER.map((r) => (
          <label key={r} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
            border: role === r ? `2px solid ${C.primary}` : `1px solid ${C.border}`, background: role === r ? C.primaryBg : C.white }}>
            <input type="radio" name="invite-role" checked={role === r} onChange={() => setRole(r)} style={{ marginTop: 3, accentColor: C.primary }} />
            <span><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ROLE_INFO[r].label}</span><br /><span style={{ fontSize: 11, color: C.text2 }}>{ROLE_INFO[r].description}</span></span>
          </label>
        ))}
      </fieldset>
    </SidePanel>
  );
}
