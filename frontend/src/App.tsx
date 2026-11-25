import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { useRealtimeSubscription } from './hooks/useRealtime';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell      from './components/Layout/AppShell';
import Dashboard     from './components/Dashboard/Dashboard';
import AuthPage      from './components/Auth/AuthPage';
import { AdminOnly, PageBody } from './pages/AdminPages';
import { ForbiddenPage, NotFoundPage } from './pages/StatusPages';
import { useRolePermissions } from './hooks/useRolePermissions';
import { C } from './components/Common';

const noop = () => undefined;

// Everything except the dashboard is loaded on first visit, so the first screen opens faster.
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const MyTasksPage = lazy(() => import('./pages/MyTasksPage'));
const OnePagePage = lazy(() => import('./pages/OnePagePage'));
const EmailLogsPage = lazy(() => import('./pages/EmailLogsPage'));
const SettingsLayout = lazy(() => import('./pages/admin/settings/SettingsLayout'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage'));
const TimesheetModal = lazy(() => import('./components/Timesheet/TimesheetModal'));
const SystemNotesModal = lazy(() => import('./components/SystemNotes/SystemNotesModal'));

function OnePageGuard({ children }: { children: React.ReactNode }) {
  const permissions = useRolePermissions();
  return permissions.isTabVisible('onepage') ? <>{children}</> : <ForbiddenPage />;
}

const pageFallback = (
  <div style={{ padding: 32, color: C.text2, fontSize: 13, fontFamily: 'Poppins, sans-serif' }}>Loading…</div>
);
const page = (node: React.ReactNode) => <Suspense fallback={pageFallback}>{node}</Suspense>;

export default function App() {
  const { user, loading: authLoading, configured } = useAuth();
  const { theme } = useTheme();
  const fetchProjects = useStore(state => state.fetchProjects);
  const fetchMasterCodes = useStore(state => state.fetchMasterCodes);
  const activeProject = useStore(state => state.activeProject);
  const projectsLoading = useStore(state => state.projectsLoading);
  const projects = useStore(state => state.projects);
  const dataLoading = useStore(state => state.dataLoading);
  const error = useStore(state => state.error);

  // Realtime subscriptions
  useRealtimeSubscription(activeProject?.id);

  useEffect(() => {
    // Fetch projects and lookup codes if authenticated or if Supabase isn't configured (demo mode).
    // Use user?.id (not user object) to avoid re-fetching on every token refresh (tab switch).
    if (!configured || user) {
      fetchProjects();
      fetchMasterCodes();
    }
  }, [fetchProjects, fetchMasterCodes, user?.id, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = theme === 'dark';

  // Show loading while checking auth
  if (authLoading && configured) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        background: isDark ? '#0F172A' : '#F5F7FA', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36,
          border: `3px solid ${C.primary}`, borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: isDark ? '#94A3B8' : C.text2, fontSize: 13, fontFamily: 'Poppins, sans-serif' }}>
          Loading…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show auth page if Supabase is configured but user isn't logged in
  if (configured && !user) {
    return <AuthPage />;
  }

  // Dashboard / Projects show the connection state while the project list loads.
  const portfolio = (mode: 'dashboard' | 'projects') => (projectsLoading && !error ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: isDark ? '#94A3B8' : C.text2, fontSize: 13 }}>Loading projects…</p>
    </div>
  ) : error && !projects.length ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: C.red, fontWeight: 600, fontSize: 16 }}>Connection Error</p>
      <p style={{ color: isDark ? '#94A3B8' : C.text2, fontSize: 13 }}>{error}</p>
      <p style={{ color: isDark ? '#64748B' : C.text3, fontSize: 13 }}>
        {configured ? 'Check your Supabase configuration.' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'}
      </p>
    </div>
  ) : (
    <Dashboard mode={mode} />
  ));

  const bg = isDark ? '#0F172A' : C.bg;
  const toastBg = isDark ? '#1E293B' : C.white;
  const toastColor = isDark ? '#F1F5F9' : C.text;
  const toastBorder = isDark ? '#334155' : C.border;

  return (
    <div style={{ height: '100vh', background: bg, fontFamily: 'Poppins, sans-serif', overflow: 'hidden' }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={portfolio('dashboard')} />
          <Route path="one-page" element={<OnePageGuard>{page(<OnePagePage />)}</OnePageGuard>} />
          <Route path="one-page/:projectId" element={<OnePageGuard>{page(<OnePagePage />)}</OnePageGuard>} />
          <Route path="projects" element={portfolio('projects')} />
          <Route path="projects/:projectId/*" element={page(<ProjectPage />)} />
          <Route path="my-tasks" element={page(<MyTasksPage />)} />
          <Route path="timesheet" element={page(<PageBody><TimesheetModal inline onClose={noop} /></PageBody>)} />
          <Route path="admin" element={<AdminOnly />}>
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={page(<UsersPage />)} />
            <Route path="users/:userId" element={page(<UserDetailPage />)} />
            <Route path="settings/*" element={page(<SettingsLayout />)} />
            <Route path="email-logs" element={page(<div style={{ height: '100%', overflowY: 'auto' }}><EmailLogsPage /></div>)} />
            <Route path="system-notes" element={page(<PageBody><SystemNotesModal inline onClose={noop} /></PageBody>)} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {dataLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 450, cursor: 'wait' }}>
          <div style={{ position: 'absolute', inset: 0, background: isDark ? 'rgba(15,23,42,0.24)' : 'rgba(255,255,255,0.20)' }} />
          <div style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 999,
            background: isDark ? '#1E293B' : '#FFFFFF',
            border: `1px solid ${isDark ? '#334155' : C.border}`,
            boxShadow: C.shadow2,
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 14,
              height: 14,
              border: `2px solid ${C.primary}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? '#E2E8F0' : C.text2,
              fontFamily: 'Poppins, sans-serif',
            }}>
              Saving...
            </span>
          </div>
        </div>
      )}

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: 'Poppins, sans-serif',
            fontSize: 13,
            background: toastBg,
            color: toastColor,
            border: `1px solid ${toastBorder}`,
            borderRadius: 12,
            boxShadow: C.shadow2,
          },
          success: { iconTheme: { primary: C.green,   secondary: '#fff' } },
          error:   { iconTheme: { primary: C.red,     secondary: '#fff' } },
        }}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${isDark ? '#0F172A' : C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : C.border2}; border-radius: 3px; }
        input[type="date"] { color-scheme: ${isDark ? 'dark' : 'light'}; }
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
