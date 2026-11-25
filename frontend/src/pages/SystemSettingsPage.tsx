import React from 'react';
import { NavLink } from 'react-router-dom';
import SetupModal from '../components/Setup/SetupModal';
import TaskTemplateModal from '../components/Setup/TaskTemplateModal';
import { C } from '../components/Common';
import { PageBody } from './AdminPages';

const noop = () => undefined;

/** /admin/settings and /admin/settings/templates */
export default function SystemSettingsPage({ section }: { section: 'lookup' | 'templates' }) {
  const tab = (to: string, label: string) => (
    <NavLink
      to={to}
      end
      style={({ isActive }) => ({
        height: 30, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: isActive ? 600 : 500,
        display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontFamily: 'Poppins, sans-serif',
        border: `1px solid ${isActive ? '#C7D2FE' : C.border}`, background: isActive ? C.primaryBg : C.white,
        color: isActive ? C.primary : C.text2,
      })}
    >
      {label}
    </NavLink>
  );
  return (
    <PageBody>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'Poppins, sans-serif' }}>System Settings</h2>
        <p style={{ margin: 0, fontSize: 13, color: C.text2 }}>Shared values, checklist topics and task templates used by every project.</p>
      </div>
      <nav aria-label="System settings sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {tab('/admin/settings', 'Lookup Values & Checklist Topics')}
        {tab('/admin/settings/templates', 'Task Templates')}
      </nav>
      {section === 'lookup'
        ? <SetupModal inline onClose={noop} />
        : <TaskTemplateModal inline only="templates" onClose={noop} />}
    </PageBody>
  );
}
