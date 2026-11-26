import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { parseISO, isValid } from 'date-fns';
import {
  Bell, BellRing, BookOpen, ChevronDown, Clock3, FileText, FolderKanban, Wallet, LayoutDashboard, ListChecks, LogOut, Mail, Menu, Moon, PanelLeftClose,
  PanelLeftOpen, Presentation, Search, Settings, StickyNote, Sun, Users, X,
} from 'lucide-react';
import { fmtDate } from '../../utils';
import { useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { C } from '../Common';
import CommandPalette from './CommandPalette';
import { useRolePermissions } from '../../hooks/useRolePermissions';

const F = 'Poppins, sans-serif';
const SIDEBAR_KEY = 'hmc-sidebar-collapsed';

type NavItem = { to: string; label: string; icon: React.ReactNode; end?: boolean };

const WORKSPACE_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
  { to: '/one-page', label: 'One Page', icon: <FileText size={18} /> },
  { to: '/external-status', label: 'External Status', icon: <Presentation size={18} /> },
  { to: '/projects', label: 'Projects', icon: <FolderKanban size={18} /> },
  { to: '/my-tasks', label: 'My Tasks', icon: <ListChecks size={18} /> },
  { to: '/budget', label: 'Budget Control', icon: <Wallet size={18} /> },
  { to: '/notifications', label: 'Notifications', icon: <BellRing size={18} /> },
  { to: '/methodology', label: 'Methodology', icon: <BookOpen size={18} /> },
  { to: '/timesheet', label: 'Timesheet', icon: <Clock3 size={18} /> },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/users', label: 'Users', icon: <Users size={18} /> },
  { to: '/admin/settings', label: 'System Settings', icon: <Settings size={18} /> },
  { to: '/admin/email-logs', label: 'Email Logs', icon: <Mail size={18} /> },
  { to: '/admin/system-notes', label: 'System Notes', icon: <StickyNote size={18} /> },
];

function readCollapsed(): boolean {
  try { return window.localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

/** Layout after sign-in: top bar, sidebar (collapsible; a drawer on phones) and the routed page. */
export default function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const isAdmin = profile?.role === 'admin';
  const permissions = useRolePermissions();
  // One Page follows the project "onepage" screen permission.
  const canBudget = ['admin', 'pm', 'am', 'director'].includes(profile?.role || '');
  const workspaceItems = WORKSPACE_ITEMS.filter((item) => (!['/one-page', '/external-status'].includes(item.to) || permissions.isTabVisible('onepage')) && (!['/budget', '/notifications'].includes(item.to) || canBudget));
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const searchPages = React.useMemo(
    () => [...workspaceItems, ...(isAdmin ? ADMIN_ITEMS : [])].map(({ to, label }) => ({ to, label })),
    [isAdmin, workspaceItems.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Ctrl+K / ⌘K opens search from anywhere (also while typing in a field).
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* storage unavailable */ }
  }, [collapsed]);

  // Fetch the project workspace code in the background so opening a project does not show "Loading…" first.
  React.useEffect(() => {
    const t = window.setTimeout(() => { void import('../../pages/ProjectPage').catch(() => undefined); }, 2000);
    return () => window.clearTimeout(t);
  }, []);

  // Close the phone drawer and search after navigating.
  React.useEffect(() => { setDrawerOpen(false); setSearchOpen(false); }, [location.pathname]);

  const surface = isDark ? '#1E293B' : C.white;
  const border = isDark ? '#334155' : C.border;
  const textColor = isDark ? '#F1F5F9' : C.text;
  const textMuted = isDark ? '#94A3B8' : C.text2;
  const commitId = String(import.meta.env.VITE_COMMIT_ID || 'local').slice(0, 8);

  const renderNav = (showLabels: boolean) => {
    const link = (item: NavItem) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        title={item.label}
        style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 12px',
          justifyContent: showLabels ? 'flex-start' : 'center',
          borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 600 : 500, fontFamily: F,
          background: isActive ? (isDark ? '#312E81' : C.primaryBg) : 'transparent',
          color: isActive ? (isDark ? '#C7D2FE' : C.primary) : textMuted,
        })}
      >
        <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
        {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      </NavLink>
    );
    const heading = (label: string) => showLabels
      ? <div style={{ padding: '0 12px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isDark ? '#64748B' : C.text3 }}>{label}</div>
      : <hr style={{ border: 0, borderTop: `1px solid ${border}`, margin: '4px 8px' }} />;
    return (
      <nav aria-label="Main menu" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {heading('Workspace')}
          {workspaceItems.map(link)}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {heading('Admin')}
            {ADMIN_ITEMS.map(link)}
          </div>
        )}
      </nav>
    );
  };

  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 12px', flexShrink: 0,
        background: surface, borderBottom: `1px solid ${border}`, position: 'relative', zIndex: 100,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)', fontFamily: F,
      }}>
        <button
          type="button"
          onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed((value) => !value))}
          aria-label={isMobile ? 'Open menu' : collapsed ? 'Expand menu' : 'Collapse menu'}
          title={isMobile ? 'Menu' : collapsed ? 'Expand menu' : 'Collapse menu'}
          style={iconButton(isDark)}
        >
          {isMobile ? <Menu size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button type="button" onClick={() => navigate('/')} title="Dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${C.primary}, #818CF8)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, fontFamily: F }}>PT</span>
          {!isMobile && <span style={{ fontSize: 16, fontWeight: 800, color: textColor, fontFamily: F, letterSpacing: '-0.3px' }}>Project Tracking System</span>}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMobile ? (
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search" style={iconButton(isDark)}>
              <Search size={17} />
            </button>
          ) : (
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search projects and pages" title="Search"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 34, width: 240, padding: '0 10px', borderRadius: 10, cursor: 'pointer', fontFamily: F,
                background: isDark ? '#334155' : '#F8FAFC', border: `1px solid ${isDark ? '#475569' : '#E2E8F0'}`, color: textMuted, fontSize: 13,
              }}>
              <Search size={15} />
              <span>Search…</span>
              <kbd style={{ marginLeft: 'auto', fontFamily: F, fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `1px solid ${isDark ? '#475569' : C.border}`, color: textMuted }}>
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          )}
          <NotificationBell isDark={isDark} isMobile={isMobile} />
          <button type="button" onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Light mode' : 'Dark mode'} style={iconButton(isDark)}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user && (
            <UserMenu
              name={profile?.fullName || user.email?.split('@')[0] || 'User'}
              email={user.email || ''}
              role={profile?.role || 'member'}
              isDark={isDark}
              isMobile={isMobile}
              onTimesheet={() => navigate('/timesheet')}
              onSignOut={signOut}
            />
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── Sidebar (tablet / desktop) ─────────────────────────────────── */}
        {!isMobile && (
          <aside style={{
            width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: surface, borderRight: `1px solid ${border}`, padding: '14px 10px', overflowY: 'auto', transition: 'width 0.15s',
          }}>
            {renderNav(!collapsed)}
            <div style={{ fontSize: 11, color: isDark ? '#64748B' : C.text3, textAlign: collapsed ? 'center' : 'left', padding: '8px 12px 0', fontFamily: F }} title={`Build ${commitId}`}>
              {collapsed ? commitId.slice(0, 4) : `Build ${commitId}`}
            </div>
          </aside>
        )}

        {/* ── Page ───────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Outlet />
        </main>
      </div>

      {/* ── Phone bottom bar ──────────────────────────────────────────── */}
      {isMobile && (
        <nav aria-label="Quick menu" style={{
          display: 'flex', flexShrink: 0, background: surface, borderTop: `1px solid ${border}`,
          paddingBottom: 'env(safe-area-inset-bottom)', fontFamily: F,
        }}>
          {workspaceItems.filter((item) => !['/one-page', '/external-status', '/budget', '/methodology', '/notifications'].includes(item.to)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, height: 56,
                textDecoration: 'none', fontSize: 11, fontWeight: isActive ? 600 : 500,
                color: isActive ? (isDark ? '#C7D2FE' : C.primary) : textMuted,
              })}>
              <span style={{ display: 'inline-flex' }} aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="More menu"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, height: 56, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: textMuted, fontFamily: F }}>
            <Menu size={18} aria-hidden="true" />
            More
          </button>
        </nav>
      )}

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} pages={searchPages} />

      {/* ── Phone drawer ──────────────────────────────────────────────── */}
      {isMobile && drawerOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu" style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 260, maxWidth: '85%', background: surface, padding: 12, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: C.shadow2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: textColor, fontFamily: F }}>Menu</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" style={iconButton(isDark)}><X size={18} /></button>
            </div>
            {renderNav(true)}
            <div style={{ marginTop: 'auto', fontSize: 11, color: C.text3, fontFamily: F }}>Build {commitId}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function iconButton(isDark: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    background: isDark ? '#334155' : '#F8FAFC', border: `1px solid ${isDark ? '#475569' : '#E2E8F0'}`,
    cursor: 'pointer', color: isDark ? '#F8FAFC' : '#475569', flexShrink: 0,
  };
}

/** Due / overdue tasks and milestones from the data currently loaded (same rules as before). */
function NotificationBell({ isDark, isMobile }: { isDark: boolean; isMobile: boolean }) {
  const tasks = useStore((state) => state.tasks);
  const milestones = useStore((state) => state.milestones);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const parseDate = (value: string) => {
    if (!value) return null;
    const d = parseISO(value);
    return isValid(d) ? d : null;
  };
  // Due dates are date-only, so compare with the start of today: "due today" is upcoming.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endIn7 = new Date(today);
  endIn7.setDate(endIn7.getDate() + 7);
  const dueIn10 = new Date(today);
  dueIn10.setDate(dueIn10.getDate() + 10);

  const open_ = tasks.filter((t) => t.percentComplete < 100);
  const overdue = open_.filter((t) => { const due = parseDate(t.endDate); return due && due < today; })
    .map((t) => ({ id: t.id, title: `Task: ${t.taskName}`, subtitle: `Due ${fmtDate(t.endDate)}`, overdue: true }));
  const upcoming = open_.filter((t) => { const due = parseDate(t.endDate); return due && due >= today && due <= endIn7; })
    .map((t) => ({ id: t.id, title: `Task: ${t.taskName}`, subtitle: `Due ${fmtDate(t.endDate)}`, overdue: false }));
  const dueMilestones = milestones
    .filter((m) => String(m.status).toLowerCase() === 'pending')
    .filter((m) => { const due = parseDate(m.dueDate); return due && due <= dueIn10; })
    .map((m) => {
      const due = parseDate(m.dueDate);
      return { id: m.id, title: `Milestone: ${m.name}`, subtitle: m.billingDate ? `Billing ${fmtDate(m.billingDate)}` : `Due ${fmtDate(m.dueDate)}`, overdue: !!due && due < today };
    });
  const items = [...overdue, ...upcoming, ...dueMilestones];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifications, ${items.length}`} title="Notifications" style={{ ...iconButton(isDark), position: 'relative' }}>
        <Bell size={17} />
        {items.length > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: C.red, color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: isMobile ? 'fixed' : 'absolute', top: isMobile ? 56 : 42, right: isMobile ? 12 : 0, left: isMobile ? 12 : 'auto',
          width: isMobile ? 'auto' : 320, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
          boxShadow: C.shadow2, zIndex: 300, padding: 12, maxHeight: 360, overflowY: 'auto', fontFamily: F,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Notifications</div>
            <span style={{ fontSize: 11, color: C.text3 }}>{items.length} items</span>
          </div>
          {items.length === 0 ? (
            <div style={{ color: C.text2, fontSize: 13 }}>No new notifications.</div>
          ) : items.map((item) => (
            <div key={item.id} style={{
              padding: '10px 12px', borderRadius: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4,
              border: `1px solid ${item.overdue ? C.red : C.green}`, background: item.overdue ? '#FEF2F2' : '#ECFDF5',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.title}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{item.subtitle}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, email, role, isDark, isMobile, onTimesheet, onSignOut }: {
  name: string; email: string; role: string; isDark: boolean; isMobile: boolean; onTimesheet: () => void; onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const menuButton: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0, background: 'transparent', fontSize: 13, cursor: 'pointer', color: C.text, fontFamily: F };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Account menu" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 6px', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: F }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${C.primary}, #818CF8)`, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
          {name.substring(0, 2).toUpperCase()}
        </span>
        {!isMobile && (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#F1F5F9' : C.text }}>{name}</span>
            <span style={{ fontSize: 11, color: isDark ? '#94A3B8' : C.text3 }}>{roleLabel}</span>
          </span>
        )}
        <ChevronDown size={14} color={isDark ? '#94A3B8' : C.text3} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, width: 230, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow2, overflow: 'hidden', zIndex: 300 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontFamily: F }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: 11, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>Role: {roleLabel}</div>
          </div>
          <button type="button" onClick={() => { setOpen(false); onTimesheet(); }} style={menuButton}>My Timesheet</button>
          <button type="button" onClick={() => { setOpen(false); onSignOut(); }} style={{ ...menuButton, borderTop: `1px solid ${C.border}`, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
