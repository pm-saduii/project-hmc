import React from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { C } from '../../../components/Common';
import { F } from '../../../components/Admin/AdminUi';
import { useStore } from '../../../store';
import { projectChecklistApi } from '../../../services/api';
import type { ProjectChecklistTopic } from '../../../utils/projectChecklist';
import { SETTINGS_GROUPS, findSection } from './sections';
import LookupListPage from './LookupListPage';
import ChecklistTopicsPage from './ChecklistTopicsPage';
import MethodologySettingsPage from './MethodologySettingsPage';
import NotificationRulesPage from './NotificationRulesPage';
import TaskTemplateModal from '../../../components/Setup/TaskTemplateModal';

const noop = () => undefined;

/** /admin/settings/* — one page per setting, chosen from the menu on the left. */
export default function SettingsLayout() {
  const path = useParams()['*'] || '';
  const section = findSection(path);
  const masterCodes = useStore((s) => s.masterCodes);
  const [topics, setTopics] = React.useState<ProjectChecklistTopic[] | null>(null);

  const reloadTopics = React.useCallback(async () => {
    try { setTopics(await projectChecklistApi.getTopics()); } catch { setTopics([]); }
    // Open project checklists refresh their topic list.
    window.dispatchEvent(new Event('checklist-topics-updated'));
  }, []);
  React.useEffect(() => { void reloadTopics(); }, [reloadTopics]);

  if (!section) return <Navigate to="/admin/settings/project-status" replace />;

  const countFor = (s: (typeof SETTINGS_GROUPS)[number]['sections'][number]) => {
    if (s.kind === 'lookup') return masterCodes.filter((c) => c.codeType === s.codeType).length;
    if (s.kind === 'checklist') return topics ? topics.filter((t) => t.category === s.category).length : '';
    return '';
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', height: '100%', overflowY: 'auto', fontFamily: F }}>
      <nav aria-label="Settings" style={{ flex: '0 0 240px', padding: '24px 12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 2px 10px', fontSize: 20, fontWeight: 800, color: C.text }}>Settings</h1>
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ padding: '0 10px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: C.text3, textTransform: 'uppercase' }}>{group.title}</div>
            {group.sections.map((s) => (
              <NavLink key={s.path} to={`/admin/settings/${s.path}`}
                style={({ isActive }) => ({
                  height: 36, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 8,
                  fontSize: 13, textDecoration: 'none', color: isActive ? '#4338CA' : C.text, fontWeight: isActive ? 600 : 400,
                  background: isActive ? C.white : 'transparent', boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                })}>
                <span>{s.label}</span>
                <span style={{ fontSize: 11, color: C.text3 }}>{countFor(s)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '24px 32px 32px 8px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {section.kind === 'lookup' && <LookupListPage key={section.path} section={section} />}
        {section.kind === 'checklist' && <ChecklistTopicsPage key={section.path} section={section} topics={topics} onChanged={reloadTopics} />}
        {section.kind === 'methodology' && <MethodologySettingsPage key={section.path} mode={section.mode} eyebrow={`Settings › ${section.group}`} />}
        {section.kind === 'notifications' && <NotificationRulesPage eyebrow={`Settings › ${section.group}`} />}
        {section.kind === 'templates' && <>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: -8 }}>Settings › {section.group} · {section.description}</div>
          <TaskTemplateModal inline only="templates" onClose={noop} />
        </>}
      </main>
    </div>
  );
}
