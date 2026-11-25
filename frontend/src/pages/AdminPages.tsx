import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ForbiddenPage } from './StatusPages';

/** Route guard for /admin/*: non-admins get a 403 page instead of an empty screen. */
export function AdminOnly() {
  const { profile } = useAuth();
  if (profile?.role !== 'admin') return <ForbiddenPage />;
  return <Outlet />;
}

/** Scrollable page body used by the routed screens. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return <div style={{ height: '100%', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }}>{children}</div>;
}
